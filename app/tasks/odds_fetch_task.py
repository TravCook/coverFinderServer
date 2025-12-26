from app.celery_app.celery import celery
from app.helpers.dataHelpers.db_getters.get_sports_sync import get_sports_sync
from app.helpers.dataHelpers.sport_in_season import sport_in_season
import logging
import asyncio
from app.helpers.dataHelpers.db_getters.odds_api_request import fetch_odds_api_with_backoff
from app.helpers.dataHelpers.get_async_session_factory import get_async_session_factory
from app.helpers.dataHelpers.db_setters.save_game_async import save_game_async
from app.database.team_model import Teams
from app.helpers.dataHelpers.db_getters.get_team_single import get_team_single
from app.helpers.dataHelpers.db_setters.save_stats_async import save_stats_async
from app.helpers.dataHelpers.db_getters.get_games_sync import get_games_sync
from app.helpers.dataHelpers.db_getters.load_model_checkpoint import load_model_checkpoint
from app.helpers.dataHelpers.prediction_history_builder import prediction_history_builder
from app.helpers.dataHelpers.is_game_today import is_game_today
from app.helpers.trainingHelpers.feature_extraction import feature_extraction_single
import pandas as pd
from zoneinfo import ZoneInfo  # Python 3.9
from datetime import datetime, timedelta
import os
import numpy as np
from datetime import datetime
logger = logging.getLogger(__name__)




@celery.task
def odds_fetch():
    asyncio.run(odds_fetch_async())


async def odds_fetch_async():
    """Fetch odds data from the API and save to the database."""
    AsyncSessionLocal, engine = get_async_session_factory()
    all_sports = await get_sports_sync(AsyncSessionLocal)
    in_season_sports = [sport for sport in all_sports if sport_in_season(sport)]
    for sport in in_season_sports:
        logger.info(F"{sport.name} IS IN SEASON")
    fetched_odds = await fetch_odds_api_with_backoff(in_season_sports)
    
    logger.info('======================AMOUNT OF FETCHED GAMES==================')
    logger.info(len(fetched_odds))

    for game in fetched_odds:
        commence_time_str  = game['commence_time']

        # Parse ISO8601 timestamp (UTC or with timezone)
        commence_time = datetime.fromisoformat(
            commence_time_str.replace("Z", "+00:00")
        )     
        commence_time = commence_time.astimezone(ZoneInfo("America/Denver"))  
        # Get Denver today
        now = datetime.now(ZoneInfo("America/Denver"))

        # Skip past games
        if commence_time <= now:
            continue
        #Build Payload
        game_sport = next((s for s in all_sports if s.name == game['sport_key']), None)


        #team fetcher helper
        home_team = await get_team_single(game['home_team'], game_sport.name, AsyncSessionLocal)

        away_team = await get_team_single(game['away_team'], game_sport.name, AsyncSessionLocal)

        if home_team != None and away_team != None:

            payload = {
                "oddsApiID": game['id'],
                "sport": game_sport.id,
                "homeTeam": home_team.id,
                "homeTeamIndex": home_team.statIndex,
                "homeTeamScaledIndex": home_team.scaledStatIndex,
                "awayTeam": away_team.id,
                "awayTeamIndex": away_team.statIndex,
                "awayTeamScaledIndex": away_team.scaledStatIndex,
                "commence_time": datetime.fromisoformat(game['commence_time']),
                "sport_title": game_sport.league,
                "sport_key": game_sport.name,
            }
            #Save game,bookmakers,markets,and outcomes
            game_id = await save_game_async(game, payload, AsyncSessionLocal, game['sport_key'], True)

            #build stat payloads
            payload = {
                "gameId": game_id,
                "teamId": home_team.id,
                "sport": game_sport.id,
                "data": home_team.currentStats
            }
            await save_stats_async(home_team, payload, AsyncSessionLocal)
            payload = {
                "gameId": game_id,
                "teamId": away_team.id,
                "sport": game_sport.id,
                "data": away_team.currentStats
            }
            await save_stats_async(away_team, payload, AsyncSessionLocal)
        else:
            logger.info(F"Missing Home or Away team for {game['home_team']} vs {game['away_team']} in sport {game['sport_key']}")

    for sport in in_season_sports:
        logger.info(f"----------------------------Starting Prediction for {sport.name}-----------------------")
        
        # Load regression ensemble + isotonic calibration
        regression_models, iso, margin_scale = load_model_checkpoint(sport.name)
        final_xgb, final_lgb, final_cb = regression_models  # unpack ensemble

        # Get all games for this sport
        sport_games = await get_games_sync(sport, AsyncSessionLocal)

        # Split into upcoming / past
        upcoming_games = list(filter(lambda g: not g.complete, sport_games))
        past_games = list(filter(lambda g: g.complete, sport_games))
        
        logger.info(f"{len(upcoming_games)} upcoming games to predict")

        # Build team history for feature extraction
        team_history, last_games_info, team_home_history, team_away_history, team_vs_team_history, team_elo, team_elo_history, team_sos_components, last_seen_season_month = prediction_history_builder(past_games, sport)

        # ----------------------------------------- UPCOMING GAME PREDICTIONS ---------------------------------------------------
        for game in sorted(upcoming_games, key=lambda g: g.commence_time):
            commence_time = game.commence_time

            # Get Denver today
            now = datetime.now(ZoneInfo("America/Denver"))

            # Skip past games
            if commence_time <= now:
                continue

            # ---------------------------------------------------------------
            # Extract features (2 rows: home + away)
            # ---------------------------------------------------------------
            prediction_features = feature_extraction_single(
                game, sport,
                team_history, last_games_info,
                team_home_history, team_away_history,
                team_vs_team_history,
                team_elo, team_elo_history,
                team_sos_components, last_seen_season_month
            )

            if not prediction_features:
                logger.info(f"NO FEATURES DETECTED FOR GAME {game.id} {game.homeTeamDetails.espnDisplayName} vs {game.awayTeamDetails.espnDisplayName}")
                continue

            prediction_df = pd.DataFrame(prediction_features)
            # Ensure column order matches training if needed:
            # prediction_df = prediction_df.reindex(columns=feature_labels_as_DataFrame.columns, fill_value=0)

            # ---------------------------------------------------------------
            # 1. Predict regression (scores) using ensemble
            # ---------------------------------------------------------------
            reg_pred = (
                0.40 * final_xgb.predict(prediction_df) +
                0.30 * final_lgb.predict(prediction_df) +
                0.30 * final_cb.predict(prediction_df)
            )

            homePrediction = reg_pred[0]
            awayPrediction = reg_pred[1]

            homeScore = round(homePrediction)
            awayScore = round(awayPrediction)

            # ---------------------------------------------------------------
            # 2. Predict probability of home team winning using isotonic regression
            # ---------------------------------------------------------------
            home_margin = homePrediction - awayPrediction
            home_margin_scaled = np.array([home_margin / margin_scale])
            homeConfidence = iso.predict(home_margin_scaled)[0]
            awayConfidence = 1 - homeConfidence            # Probability away team wins

            # ---------------------------------------------------------------
            # 3. Tie-Breaker Logic
            # ---------------------------------------------------------------
            if homeScore == awayScore:
                score_increment = 1 if sport.espnSport != 'football' else 7

                if homePrediction != awayPrediction:
                    # raw regression decides tie
                    if homePrediction > awayPrediction:
                        homeScore += score_increment
                    else:
                        awayScore += score_increment
                else:
                    # isotonic confidence decides tie
                    if homeConfidence > awayConfidence:
                        homeScore += score_increment
                    elif awayConfidence > homeConfidence:
                        awayScore += score_increment

            # Prediction confidence is the probability of the predicted winner
            predictionConfidence = homeConfidence if homeScore > awayScore else awayConfidence


            if is_game_today(game.commence_time):
                logger.info(
                    f"{game.homeTeamDetails.espnDisplayName} {homeScore} | "
                    f"{game.awayTeamDetails.espnDisplayName} {awayScore} "
                    f"PREDICTED WINNER: "
                    f"{game.homeTeamDetails.espnDisplayName if homeScore > awayScore else game.awayTeamDetails.espnDisplayName} "
                    f"CONFIDENCE: {predictionConfidence * 100:.2f}%"
                )

            # ---------------------------------------------------------------
            # 4. Save prediction to DB
            # ---------------------------------------------------------------
            payload = {
                "predictedWinner": "home" if homeScore > awayScore else "away",
                "predictionConfidence": predictionConfidence,
                "predictedHomeScore": homeScore,
                "predictedAwayScore": awayScore
            }

            await save_game_async(game, payload, AsyncSessionLocal, sport)


            # Use inSeason / START/ENDMONTH variable to determine if statYear needs to be increased


    logger.info("THIS IS WHEN THE ODDS-API FETCH")

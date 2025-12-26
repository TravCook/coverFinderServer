from app.celery_app.celery import celery
from datetime import datetime
from app.helpers.dataHelpers.get_async_session_factory import get_async_session_factory
from app.helpers.dataHelpers.db_getters.get_sports_sync import get_sports_sync
from app.helpers.dataHelpers.db_setters.save_game_async import save_game_async
from app.helpers.dataHelpers.db_getters.get_games_sync import get_games_with_bookmakers_sync
from app.helpers.dataHelpers.sport_in_season import sport_in_season
from xgboost import  XGBClassifier
import pandas as pd
import numpy as np
import logging
import asyncio
from dateutil import parser
from collections import defaultdict
from statistics import mean, stdev
import pytz

PACIFIC_TZ = pytz.timezone("America/Los_Angeles")
logger = logging.getLogger(__name__)

def ev_condition(outcome, game, sportsbook=None, min_ev=0.0, custom_prob=None):
    """
    outcome: object with .price or .odds
    game: object with .prediction_confidence
    sportsbook: unused here but kept for compatibility
    min_ev: minimum expected value threshold
    custom_prob: optional custom probability instead of game.prediction_confidence
    """

    # 1. Use custom probability if provided
    p_model = custom_prob if custom_prob is not None else game.predictionConfidence

    # 2. Get odds
    odds = getattr(outcome, 'price', None) or getattr(outcome, 'odds', None)
    if odds is None:
        return False

    # 3. Convert American odds to decimal odds if in range
    if (-1000 < odds < 1000):
        if odds > 0:
            odds = 1 + odds / 100
        else:  # odds < 0
            odds = 1 - 100 / odds

    # 4. Compute EV
    ev = (p_model * odds) - 1

    return ev > min_ev


def is_value_bet(game, game_sport, market="h2h", sportsbook=None):
    best_outcome = None

    # 1. Pick best outcome
    for bookmaker in game.bookmakers:
        market_data = next((m for m in bookmaker.markets if m.key == market), None)
        if not market_data:
            continue

        for outcome in market_data.outcomes:
            predicted_name = (
                game.homeTeamDetails.espnDisplayName if game.predictedWinner == "home"
                else game.awayTeamDetails.espnDisplayName
            )
            if outcome.name != predicted_name:
                continue

            if best_outcome is None or outcome.price > best_outcome.price:
                best_outcome = outcome

    if best_outcome is None:
        return False

    # 2. Compute edge
    edge = game.predictionConfidence - best_outcome.impliedProbability

    # 3. Handle sport-level stats
    if not game_sport:
        return False

    sport_variance = game_sport.variance
    sport_reliability = game_sport.reliabilityWeight
    sport_threshold = game_sport.threshold

    if not game_sport.valueBetSettings:
        value_score = edge * (sport_reliability / sport_variance)
    else:
        segments = game_sport.valueBetSettings
        avg_segment_variance = sum(s.segmentVariance for s in segments) / len(segments)
        avg_segment_reliability = sum(s.segmentReliability for s in segments) / len(segments)
        avg_segment_threshold = sum(s.segmentThreshold for s in segments) / len(segments)

        final_variance = (sport_variance + avg_segment_variance) / 2
        final_reliability = (sport_reliability + avg_segment_reliability) / 2
        final_threshold = (sport_threshold + avg_segment_threshold) / 2

        value_score = edge * (final_reliability / final_variance)

    # 4. Apply threshold and expected value condition
    return value_score >= (final_threshold if game_sport.valueBetSettings else sport_threshold) \
           and ev_condition(best_outcome, game, sportsbook)



def to_pacific_datetime(dt: datetime):
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=pytz.UTC)
    return dt.astimezone(PACIFIC_TZ)


def get_pacific_day_key(dt: datetime):
    # Ensure timezone-aware
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=pytz.UTC)

    # Convert to Pacific Time
    dt = dt.astimezone(PACIFIC_TZ)

    return dt.strftime("%Y-%m-%d")



def split_games_by_day(games):
    days = defaultdict(list)

    for game in games:
        key = get_pacific_day_key(game.commence_time)
        days[key].append(game)

    return dict(days)


def log_day_sanity(games_by_day, sport_name):
    logger.info(f"DAY SANITY CHECK — {sport_name}")

    previous_day = None

    sorted_day_keys = sorted(games_by_day.keys())

    for day_key in sorted_day_keys:
        games = games_by_day[day_key]

        times = sorted(
            to_pacific_datetime(g.commence_time) for g in games
        )

        logger.info(
            f"  {day_key}: {len(games)} games | "
            f"{times[0].strftime('%Y-%m-%d %H:%M')} → "
            f"{times[-1].strftime('%Y-%m-%d %H:%M')} PT"
        )

        if previous_day and day_key < previous_day:
            logger.error(f"❌ DAY ORDER ERROR: {previous_day} → {day_key}")

        previous_day = day_key

CONFIDENCE_BINS = [
    (0.0, 0.1),
    (0.1, 0.2),
    (0.2, 0.3),
    (0.3, 0.4),
    (0.4, 0.5),
    (0.5, 0.6),
    (0.6, 0.7),
    (0.7, 0.8),
    (0.8, 0.9),
    (0.9, 1.0),
]
BETTING_STRATEGIES = [
    "flat",
    "kelly-.1", "kelly-.15", "kelly-.2", "kelly-.25",
    "kelly-.3", "kelly-.35", "kelly-.4", "kelly-.45",
    "kelly-.5", "kelly-.55", "kelly-.6", "kelly-.65",
    "kelly-.7", "kelly-.75", "kelly-.8", "kelly-.85",
    "kelly-.9", "kelly-1.0",
]

def us_odds_payout(odds: float, stake: float) -> float:
    """
    Calculate payout from US odds.

    Parameters:
        odds (float): US odds, e.g., +150 or -200
        stake (float): Amount wagered

    Returns:
        float: Total payout (profit + original stake)
    """
    if odds > 0:
        # Positive odds: profit = stake * (odds / 100)
        profit = stake * (odds / 100)
    else:
        # Negative odds: profit = stake * (100 / abs(odds))
        profit = stake * (100 / abs(odds))

    return stake + profit
def us_to_decimal(odds: float) -> float:
    """
    Convert US odds to decimal odds.

    Args:
        odds (float): US odds. Positive for underdog, negative for favorite.

    Returns:
        float: Decimal odds
    """
    if odds > 0:
        return 1 + (odds / 100)
    else:
        return 1 + (100 / abs(odds))



@celery.task
def value_bet_backtest():
    asyncio.run(value_bet_backtest_async())


async def value_bet_backtest_async():
    AsyncSessionLocal, engine = get_async_session_factory()
    all_sports = await get_sports_sync(AsyncSessionLocal)
    in_season_sports = [sport for sport in all_sports if sport_in_season(sport)]

    for sport in in_season_sports:
        sport_games = await get_games_with_bookmakers_sync(sport, AsyncSessionLocal)
        clf = XGBClassifier(
            n_estimators=200,         # start moderately high; early stopping can handle overfitting
            max_depth=4,              # shallow trees to avoid overfitting
            learning_rate=0.05,       # small steps for stable training
            subsample=0.8,            # row sampling for regularization
            colsample_bytree=0.8,     # column sampling for regularization
            scale_pos_weight=1,       # adjust if your positive/negative labels are imbalanced
            eval_metric="logloss",
            random_state=122021
        )
        cumulative_features = []
        cumulative_labels = []
        game_index = 0
        logger.info(f"=============================GAMES TO SCORE FOR {sport.name}: {len(sport_games)}=============================================")
        games_to_process = sorted(
            sport_games,
            key=lambda g: g.commence_time
        )
        tracked_games_for_corr = []
        from collections import defaultdict

        # Store recent values by team
        recent_spreads = defaultdict(list)      # e.g., recent point spreads
        recent_confidences = defaultdict(list)  # recent prediction confidences
        recent_errors = defaultdict(list)       # whether past predictions were correct (0/1)

        for game in games_to_process:
            best_h2h_outcome = None
            best_spread_outcome = None
            for bookmaker in game.bookmakers:
                h2h_market_data = next((m for m in bookmaker.markets if m.key == 'h2h'), None)
                if not h2h_market_data:
                    continue

                spread_market_data = next((m for m in bookmaker.markets if m.key == 'spreads'), None)
                if not spread_market_data:
                    continue
                for outcome in spread_market_data.outcomes:
                    predicted_name = (
                        game.homeTeamDetails.espnDisplayName if game.predictedWinner == "home"
                        else game.awayTeamDetails.espnDisplayName
                    )
                    if outcome.name != predicted_name:
                        continue

                    if best_spread_outcome is None or outcome.price > best_spread_outcome.price:
                        best_spread_outcome = outcome

                for outcome in h2h_market_data.outcomes:
                    predicted_name = (
                        game.homeTeamDetails.espnDisplayName if game.predictedWinner == "home"
                        else game.awayTeamDetails.espnDisplayName
                    )
                    if outcome.name != predicted_name:
                        continue

                    if best_h2h_outcome is None or outcome.price > best_h2h_outcome.price:
                        best_h2h_outcome = outcome

            if best_h2h_outcome is None or best_spread_outcome is None:
                continue


            # Inside your loop over games_to_process

            home = game.homeTeamDetails.espnDisplayName
            away = game.awayTeamDetails.espnDisplayName
            day_games = [g for g in games_to_process if g.commence_time.date() == game.commence_time.date()]

            # Recent history for rolling features
            home_recent_spreads = recent_spreads[home][-10:]  # last 10 games
            away_recent_spreads = recent_spreads[away][-10:]

            home_recent_confidences = recent_confidences[home][-10:]
            away_recent_confidences = recent_confidences[away][-10:]

            home_recent_errors = recent_errors[home][-10:]
            away_recent_errors = recent_errors[away][-10:]

            projected_spread = game.predictedHomeScore - game.predictedAwayScore
            abs_projected_spread = abs(projected_spread)
            model_confidence = game.predictionConfidence
            distance_mean = model_confidence - 0.5
            spread_x_confidence = projected_spread * model_confidence
            picked_home = 1 if game.predictedWinner == 'home' else 0
            # distance_to_vegas_line
            ev = (model_confidence * us_odds_payout(best_h2h_outcome.price, 1)) - ((1-model_confidence) * 1)
            implied_probability = best_h2h_outcome.impliedProbability

            # On-the-fly calculations
            def safe_mean(lst):
                return mean(lst) if lst else 0.0

            def safe_stdev(lst):
                return stdev(lst) if len(lst) > 1 else 0.0

            # Disagreement with recent predictions
            home_disagreement = abs(projected_spread - safe_mean(home_recent_spreads))
            away_disagreement = abs(-projected_spread - safe_mean(away_recent_spreads))

            # Accuracy history
            home_recent_accuracy = safe_mean(home_recent_errors)
            away_recent_accuracy = safe_mean(away_recent_errors)

            # Day-level ranks
            abs_spreads_today = [abs(g.predictedHomeScore - g.predictedAwayScore) for g in day_games]
            spread_rank_today = sum(1 for s in abs_spreads_today if abs_projected_spread >= s) / len(abs_spreads_today)

            # Interaction terms
            spread_x_disagreement = projected_spread * (home_disagreement + away_disagreement)
            confidence_x_disagreement = model_confidence * (home_disagreement + away_disagreement)

            features = {
                "projected_spread": float(projected_spread),
                "abs_projected_spread": float(abs_projected_spread),
                "model_confidence": float(model_confidence),
                "distance_mean": float(distance_mean),
                "spread_x_confidence": float(spread_x_confidence),
                "picked_home": int(picked_home),
                "ev": float(ev),
                # "implied_probability": float(implied_probability),

                "home_recent_confidences_mean": float(safe_mean(home_recent_confidences)),
                "away_recent_confidences_mean": float(safe_mean(away_recent_confidences)),
                "home_recent_confidences_stdev": float(safe_stdev(home_recent_confidences)),
                "away_recent_confidences_stdev": float(safe_stdev(away_recent_confidences)),

                # Rolling / recent features
                "home_recent_mean_spread": float(safe_mean(home_recent_spreads)),
                "away_recent_mean_spread": float(safe_mean(away_recent_spreads)),
                "home_recent_spread_std": float(safe_stdev(home_recent_spreads)),
                "away_recent_spread_std": float(safe_stdev(away_recent_spreads)),

                "home_recent_accuracy": float(home_recent_accuracy),
                "away_recent_accuracy": float(away_recent_accuracy),

                # Disagreement features
                "home_disagreement": float(home_disagreement),
                "away_disagreement": float(away_disagreement),
                "abs_disagreement": float(home_disagreement + away_disagreement),

                # Day-level features
                "spread_rank_today": float(spread_rank_today),

                # Interaction features
                "spread_x_disagreement": float(spread_x_disagreement),
                "confidence_x_disagreement": float(confidence_x_disagreement),
            }
            if not game.complete:
                value_score = clf.predict_proba(pd.DataFrame([features]))[0,1]
                # logger.info(f"Value Score for game: {game.homeTeamDetails.espnDisplayName} vs {game.awayTeamDetails.espnDisplayName} on {game.commence_time} : {value_score} | Prediction: {game.predictionCorrect}")
                payload={
                    "value_score": value_score
                }
                await save_game_async(game, payload, AsyncSessionLocal, sport, False)
                continue

            # logger.info(features)
            label = int(game.predictionCorrect)


            X_train = pd.DataFrame(cumulative_features).astype(float)
            y_train = np.array(cumulative_labels)

            if game_index > 10:
                clf.fit(X_train, y_train)
                # value_score = clf.predict_proba(pd.DataFrame([features]))[:,1]  # gives probability of correct prediction
                value_score = clf.predict_proba(pd.DataFrame([features]))[0,1]
                tracked_games_for_corr.append({"value_score":value_score,"prediction": int(game.predictionCorrect),"stake": 1,"odds": us_to_decimal(best_h2h_outcome.price)})
                # payload={
                #     "value_score": value_score
                # }
                # await save_game_async(game, payload, AsyncSessionLocal, sport, False)


            
            cumulative_features.append(features)
            cumulative_labels.append(label)
            # Update history for next games
            recent_spreads[home].append(game.predictedHomeScore - game.predictedAwayScore)
            recent_spreads[away].append(game.predictedAwayScore - game.predictedHomeScore)

            recent_confidences[home].append(game.predictionConfidence)
            recent_confidences[away].append(1 - game.predictionConfidence if game.predictedWinner == 'home' else game.predictionConfidence)

            recent_errors[home].append(int(game.predictionCorrect))
            recent_errors[away].append(int(game.predictionCorrect))


            game_index += 1

        df = pd.DataFrame(tracked_games_for_corr)

        # Correlation between score and correctness
        corr_df = df.drop(columns=['stake']).corr()
        logger.info(corr_df)


        # Assume your df has these columns:
        # 'score_bin' -> binned value score
        # 'prediction' -> 1 if correct, 0 if incorrect
        # 'stake' -> how much was bet
        # 'odds' -> decimal odds (or you can convert from US odds)

        df['score_bin'] = pd.cut(df['value_score'], bins=[0, 0.33, 0.66, 1.0], labels=['low','medium','high'])

        # # Calculate profit for each game
        
        df['profit'] = df.apply(lambda row: row['stake'] * (row['odds'] -1) if row['prediction'] else -row['stake'], axis=1)


        summary = df.groupby('score_bin', observed=True).agg(
            win_rate=('prediction', 'mean'),
            count=('prediction', 'count'),
            total_profit=('profit', 'sum'),  # profit column you compute per game
            roi=('profit', lambda x: x.sum() / x.count())  # or total_profit / total_stake
        )

        logger.info(summary)

        
                
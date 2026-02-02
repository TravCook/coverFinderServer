from app.celery_app.celery import celery
from datetime import datetime
from app.helpers.dataHelpers.get_async_session_factory import get_async_session_factory
from app.helpers.dataHelpers.db_getters.get_sports_sync import get_sports_sync
from app.helpers.dataHelpers.db_setters.save_game_async import save_game_async
from app.helpers.trainingHelpers.value_feature_extraction import extract_features, backtest_value_score_roi
from app.helpers.dataHelpers.db_getters.get_games_sync import get_games_with_bookmakers_sync
from app.helpers.dataHelpers.sport_in_season import sport_in_season
from app.helpers.dataHelpers.db_setters.save_sport_async import save_sport
from app.helpers.trainingHelpers.value_feature_extraction import us_odds_payout, us_to_decimal, plot_value_score_decile_returns
from app.helpers.dataHelpers.db_setters.save_model_checkpoint import save_model_checkpoint
from xgboost import XGBClassifier
import matplotlib.pyplot as plt
from statistics import mean, stdev
import pandas as pd
import logging
import asyncio
import pytz
from itertools import product
import numpy as np
from collections import defaultdict
from math import log


PACIFIC_TZ = pytz.timezone("America/Los_Angeles")
logger = logging.getLogger(__name__)

def desirability_metric(roi, coverage, winrate, alpha=1, beta=1, gamma=1):
    """
    Generalized metric for threshold selection.
    """
    return (roi ** alpha) * (coverage ** beta) * (winrate ** gamma)
# Example: scale linearly from 0.5x to 1.5x Kelly based on decile
def compute_stake_multiplier(summary, min_mult=0.75, max_mult=1.5):
    """
    Maps decile to a stake multiplier.
    Higher decile → bigger stake.
    """
    # Normalize decile to 0-1
    normalized = summary["decile"].values / summary["decile"].max()
    multipliers = min_mult + (max_mult - min_mult) * normalized
    # Return dict: decile -> multiplier
    return dict(zip(summary["decile"], multipliers))


@celery.task
def value_bet_backtest():
    asyncio.run(value_bet_backtest_async())

async def value_bet_backtest_async(sport, AsyncSessionLocal, sport_games):
        
    logger.info(f"=============================GAMES TO SCORE FOR {sport.name}: {len(sport_games)}=============================================")
    
    clf = XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=1,
        eval_metric="logloss",
        random_state=122021
    )

    # Only completed games with a value_score (i.e., prediction was made)
    complete_games = [
        game for game in sport_games
        if game.complete and getattr(game, 'value_score', None) is not None
    ]
    if len(complete_games) == 0: return
    # Extract features
    rows = extract_features(sport_games)

    # Keep the full game object in the dataframe
    df = pd.DataFrame(rows)

    # Split into train and predict sets
    train_df = df[df.complete & df.label.notna()]
    predict_df = df[~df.complete]

    # Prepare training data
    X_train = pd.DataFrame(list(train_df["features"]))
    y_train = train_df["label"].astype(int)

    clf.fit(X_train, y_train)

    best_thresh, roi_curve = backtest_value_score_roi(complete_games, sport)
    # logger.info(f"{sport.name} OPTIMAL THRESHOLD: {best_thresh['threshold']}")
    summary, bin_edges = plot_value_score_decile_returns(sport_games, sport)
    decile_multipliers = compute_stake_multiplier(summary)

    decile_info = []
    for i in range(len(bin_edges) - 1):
        decile_info.append({
            "decile": i,
            "min_value_score": bin_edges[i],
            "max_value_score": bin_edges[i+1],
            "multiplier": decile_multipliers[i]
        })

    payload = {
        'sport': sport.id,
        'value_threshold': best_thresh['threshold'],
        'value_map': decile_info
    }
    
    await save_sport(AsyncSessionLocal, payload)

    # Make predictions for upcoming games
    if not predict_df.empty:
        X_pred = pd.DataFrame(list(predict_df["features"]))
        predict_df = predict_df.copy()
        predict_df["value_score"] = clf.predict_proba(X_pred)[:, 1]

    # Save value scores back to the DB
    for _, row in predict_df.iterrows():
        game = row.game_obj  # Original game object preserved
        payload = {"value_score": float(row.value_score)}
        predictedWinner = game.homeTeamDetails.espnDisplayName if game.predictedWinner == 'home' else game.awayTeamDetails.espnDisplayName
        predictedLoser = game.homeTeamDetails.espnDisplayName if game.predictedWinner == 'away' else game.awayTeamDetails.espnDisplayName
        if(float(row.value_score) > best_thresh['threshold']):
            logger.info(f"Value Score for game: {predictedWinner} to beat {predictedLoser} on {game.commence_time.astimezone(PACIFIC_TZ).date()} : {row.value_score:.2f}")
        
        await save_game_async(game, payload, AsyncSessionLocal, sport, False)
    save_model_checkpoint(
        sport.name,
        regression_models=[],
        calibration_model=None,
        margin_scale=None,
        value_classifier=clf
    )



async def value_bet_model_analysis():
    AsyncSessionLocal, engine = get_async_session_factory()
    all_sports = await get_sports_sync(AsyncSessionLocal)
    in_season_sports = [sport for sport in all_sports if sport_in_season(sport)]


    for sport in in_season_sports:
        sport_games = await get_games_with_bookmakers_sync(sport, AsyncSessionLocal)
        logger.info(f"=============================GAMES TO SCORE FOR {sport.name}: {len(sport_games)}=============================================")
        clf = XGBClassifier(
            n_estimators=500,
            max_depth=10,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            eval_metric="logloss",
            random_state=122021
        )

        cumulative_features = []
        cumulative_labels = []
        tracked_games_for_corr = []

        recent_spreads = defaultdict(list)
        recent_confidences = defaultdict(list)
        recent_errors = defaultdict(list)
        recent_ev = defaultdict(list)

        games_to_process = sorted(sport_games, key=lambda g: g.commence_time)
        game_index = 0

        def safe_mean(x): return float(mean(x)) if x else 0.0
        def safe_std(x): return float(stdev(x)) if len(x) > 1 else 0.0

        for game in games_to_process:
            best_h2h_outcome = None
            best_spread_outcome = None

            for bookmaker in game.bookmakers:
                h2h = next((m for m in bookmaker.markets if m.key == "h2h"), None)
                spreads = next((m for m in bookmaker.markets if m.key == "spreads"), None)
                if not h2h or not spreads:
                    continue

                predicted_name = (
                    game.homeTeamDetails.espnDisplayName
                    if game.predictedWinner == "home"
                    else game.awayTeamDetails.espnDisplayName
                )

                for o in h2h.outcomes:
                    if o.name == predicted_name:
                        if best_h2h_outcome is None or o.price > best_h2h_outcome.price:
                            best_h2h_outcome = o

                for o in spreads.outcomes:
                    if o.name == predicted_name:
                        if best_spread_outcome is None or o.price > best_spread_outcome.price:
                            best_spread_outcome = o

            if not best_h2h_outcome or not best_spread_outcome:
                continue

            home = game.homeTeamDetails.espnDisplayName
            away = game.awayTeamDetails.espnDisplayName
            day_games = [g for g in games_to_process if g.commence_time.date() == game.commence_time.date()]

            # --- Core projections ---
            projected_spread = game.predictedHomeScore - game.predictedAwayScore
            abs_projected_spread = abs(projected_spread)
            model_confidence = game.predictionConfidence
            picked_home = int(game.predictedWinner == "home")

            decimal_odds = us_to_decimal(best_h2h_outcome.price)
            implied_prob = best_h2h_outcome.impliedProbability
            edge = model_confidence - implied_prob

            ev = (model_confidence * (decimal_odds - 1)) - (1 - model_confidence)

            # Kelly fraction (raw, unclipped)
            b = decimal_odds - 1
            q = 1 - model_confidence
            raw_kelly = ((b * model_confidence) - q) / b if b > 0 else 0

            # --- Rolling history ---
            home_spreads = recent_spreads[home][-10:]
            away_spreads = recent_spreads[away][-10:]

            home_conf = recent_confidences[home][-10:]
            away_conf = recent_confidences[away][-10:]

            home_err = recent_errors[home][-10:]
            away_err = recent_errors[away][-10:]

            home_ev = recent_ev[home][-10:]
            away_ev = recent_ev[away][-10:]

            # --- Disagreement metrics ---
            home_disagreement = abs(projected_spread - safe_mean(home_spreads))
            away_disagreement = abs(-projected_spread - safe_mean(away_spreads))
            total_disagreement = home_disagreement + away_disagreement

            # --- Cross-sectional (day-level) ---
            day_abs_spreads = [abs(g.predictedHomeScore - g.predictedAwayScore) for g in day_games]
            spread_rank_today = sum(abs_projected_spread >= s for s in day_abs_spreads) / len(day_abs_spreads)

            day_confidences = [g.predictionConfidence for g in day_games]
            confidence_rank_today = sum(model_confidence >= c for c in day_confidences) / len(day_confidences)

            # --- Normalizations ---
            spread_z = (
                (abs_projected_spread - safe_mean(day_abs_spreads)) /
                (safe_std(day_abs_spreads) + 1e-6)
            )

            confidence_z = (
                (model_confidence - safe_mean(day_confidences)) /
                (safe_std(day_confidences) + 1e-6)
            )

            # --- Interaction terms ---
            spread_x_conf = projected_spread * model_confidence
            conf_x_edge = model_confidence * edge
            kelly_x_edge = raw_kelly * edge
            conf_x_disagreement = model_confidence * total_disagreement
            ev_x_conf = ev * model_confidence

            # --- Risk proxies ---
            confidence_volatility = safe_std(home_conf + away_conf)
            recent_accuracy_mean = safe_mean(home_err + away_err)
            recent_accuracy_std = safe_std(home_err + away_err)

            # --- Final feature vector ---
            features = {
                # Core
                "model_confidence": model_confidence,
                "implied_probability": implied_prob,
                "edge": edge,
                "ev": ev,
                "raw_kelly": raw_kelly,

                # Spread
                "projected_spread": projected_spread,
                "abs_projected_spread": abs_projected_spread,
                "spread_z": spread_z,
                "spread_rank_today": spread_rank_today,

                # Confidence
                "confidence_z": confidence_z,
                "confidence_rank_today": confidence_rank_today,
                "confidence_volatility": confidence_volatility,

                # History
                "home_recent_spread_mean": safe_mean(home_spreads),
                "away_recent_spread_mean": safe_mean(away_spreads),
                "home_recent_conf_mean": safe_mean(home_conf),
                "away_recent_conf_mean": safe_mean(away_conf),
                "recent_accuracy_mean": recent_accuracy_mean,
                "recent_accuracy_std": recent_accuracy_std,
                "home_recent_ev_mean": safe_mean(home_ev),
                "away_recent_ev_mean": safe_mean(away_ev),

                # Disagreement
                "home_disagreement": home_disagreement,
                "away_disagreement": away_disagreement,
                "total_disagreement": total_disagreement,

                # Interactions
                "spread_x_conf": spread_x_conf,
                "conf_x_edge": conf_x_edge,
                "kelly_x_edge": kelly_x_edge,
                "conf_x_disagreement": conf_x_disagreement,
                "ev_x_conf": ev_x_conf,

                # Flags
                "picked_home": picked_home,
            }

            if not game.complete:
                continue

            label = int(game.predictionCorrect)

            if len(set(cumulative_labels)) > 1:
                X = pd.DataFrame(cumulative_features).astype(float)
                y = np.array(cumulative_labels)
                clf.fit(X, y)

                value_score = clf.predict_proba(pd.DataFrame([features]))[0, 1]

                tracked_games_for_corr.append({
                    "value_score": value_score,
                    "prediction": label,
                    "stake": 1,
                    "odds": decimal_odds
                })
                payload={ "value_score": value_score }
                await save_game_async(game, payload, AsyncSessionLocal, sport, False)

            cumulative_features.append(features)
            cumulative_labels.append(label)

            # --- Update rolling history ---
            recent_spreads[home].append(projected_spread)
            recent_spreads[away].append(-projected_spread)

            recent_confidences[home].append(model_confidence)
            recent_confidences[away].append(1 - model_confidence)

            recent_errors[home].append(label)
            recent_errors[away].append(label)

            if picked_home:
                recent_ev[home].append(ev)
            else:
                recent_ev[away].append(ev)

            game_index += 1


        df = pd.DataFrame(tracked_games_for_corr)

        # Correlation between score and correctness
        corr_df = df.drop(columns=['stake']).corr()
        logger.info(corr_df)

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



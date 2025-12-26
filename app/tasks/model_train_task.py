import asyncio
import pandas as pd
import logging
from app.celery_app.celery import celery
from xgboost import XGBRegressor, XGBClassifier
from catboost import CatBoostRegressor
import lightgbm as lgb
from sklearn.metrics import mean_absolute_error, log_loss, brier_score_loss
from sklearn.isotonic import IsotonicRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.preprocessing import StandardScaler
from zoneinfo import ZoneInfo  # Python 3.9
from datetime import datetime, timedelta
from app.main import AsyncSessionLocal
import numpy as np
from app.helpers.betting_helpers.value_segment_helper import value_segment_search, compute_segment_threshold, get_best_odds_for_game
from app.helpers.dataHelpers.sport_in_season import sport_in_season
from app.helpers.dataHelpers.db_getters.get_sports_sync import get_sports_sync
from app.helpers.dataHelpers.db_getters.get_games_sync import get_games_sync
from app.helpers.trainingHelpers.feature_extraction import feature_extraction, feature_extraction_single
from app.helpers.dataHelpers.is_game_today import is_game_today
from app.helpers.config_helpers.stat_config import stat_config_map
from app.helpers.dataHelpers.db_setters.save_model_checkpoint import save_model_checkpoint
from app.helpers.dataHelpers.db_setters.save_ml_weights import save_ml_weights
from app.helpers.dataHelpers.prediction_history_builder import prediction_history_builder
from app.helpers.dataHelpers.get_async_session_factory import get_async_session_factory
from app.helpers.dataHelpers.db_setters.save_game_async import save_game_async
from app.helpers.dataHelpers.db_setters.save_sport_async import save_sport
from app.helpers.trainingHelpers.rolling_window_split import RollingTimeSeriesSplit
logger = logging.getLogger(__name__)
scaler = StandardScaler()


def leakage_test(X, y):
    shuffled = np.random.permutation(y)

    # VERY small model for speed
    model = XGBRegressor(
        n_estimators=150,
        max_depth=3,
        learning_rate=0.1,
        subsample=0.7,
        colsample_bytree=0.7,
    )

    model.fit(X, shuffled)
    preds = model.predict(X)
    corr = np.corrcoef(shuffled, preds)[0, 1]

    logger.info(f"[LEAKAGE TEST] corr(preds, random_labels) = {corr:.4f}")

def leakage_scan(X, y_random):

    leakage_results = []

    for col in X.columns:

        # Extract one feature
        feature_values = X[col].values

        # Skip columns full of NaN or constant values
        if np.all(np.isnan(feature_values)):
            logger.warning(f"[LEAK SCAN] feature={col} -> ALL NAN, skipping")
            continue

        if np.nanstd(feature_values) == 0:
            logger.warning(f"[LEAK SCAN] feature={col} -> CONSTANT VALUE, skipping")
            continue

        # Fit model on single feature
        try:
            model = XGBRegressor(
                n_estimators=200,
                max_depth=3,
                learning_rate=0.1,
                subsample=0.8,
                colsample_bytree=1.0
            )

            model.fit(feature_values.reshape(-1, 1), y_random)
            preds = model.predict(feature_values.reshape(-1, 1))

        except Exception as e:
            logger.warning(f"[LEAK FIT ERROR] feature={col} error={e}")
            continue

        # Try correlation
        try:
            corr = np.corrcoef(preds, y_random)[0,1]
        except Exception as e:
            logger.warning(f"[LEAK CORR ERROR] feature={col} error={e}")
            continue

        # Catch NaN correlations
        if np.isnan(corr):
            logger.warning(f"[LEAK SCAN NAN] feature={col} correlation=nan")
            continue

        leakage_results.append((col, corr))

    leakage_results.sort(key=lambda x: abs(x[1]), reverse=True)
    return leakage_results

def compute_ece(preds, labels, n_bins=10):
    bins = np.linspace(0, 1, n_bins+1)
    ece = 0.0

    for i in range(n_bins):
        mask = (preds >= bins[i]) & (preds < bins[i+1])
        if mask.sum() == 0:
            continue
        bucket_conf = preds[mask].mean()
        bucket_acc  = labels[mask].mean()
        ece += abs(bucket_conf - bucket_acc) * (mask.sum() / len(preds))
    return float(ece)

@celery.task
def train_k_fold():
    asyncio.run(train_k_fold_async())

async def train_k_fold_async():
    """Train regression + classification models using grouped rolling TSCV,
    prevent leakage, and evaluate on a final 10% holdout set."""

    AsyncSessionLocal, engine = get_async_session_factory()
    all_sports = await get_sports_sync(AsyncSessionLocal)

    for sport in all_sports:
        if not sport_in_season(sport):
            continue

        logger.info(f"===== TRAINING SPORT: {sport.name} =====")

        # ---------------------------------------------------------------
        # Load & sort game data
        # ---------------------------------------------------------------
        sport_games = await get_games_sync(sport, AsyncSessionLocal)
        upcoming_games = list(filter(lambda g: not g.complete, sport_games))
        past_games = sorted(
            filter(lambda g: g.complete, sport_games),
            key=lambda g: g.commence_time
        )

        if len(past_games) < 100:
            logger.warning(f"Not enough games for {sport.name}. Skipping.")
            continue

        # ---------------------------------------------------------------
        # 10% HOLDOUT SPLIT (Temporally)
        # ---------------------------------------------------------------
        split_point = int(len(past_games) * 0.9)
        train_game_data = past_games[:split_point]
        test_game_data  = past_games[split_point:]

        # ---------------------------------------------------------------
        # Feature extraction MUST be separate for train & test
        # ---------------------------------------------------------------
        train_features, train_scores, train_labels = feature_extraction(train_game_data, sport)
        test_features,  test_scores,  test_labels  = feature_extraction(test_game_data,  sport)

        train_df = pd.DataFrame(train_features)
        test_df  = pd.DataFrame(test_features)

        groups = np.arange(len(train_df)) // 2

        # ---------------------------------------------------------------
        # Prepare cross-validation
        # ---------------------------------------------------------------
        tscv = RollingTimeSeriesSplit(
            n_splits=6,
            train_size=0.7,
            test_size=0.2,
            purge_gap=20
        )

        fold_mae_scores = []
        fold_best_iters = []
        xgb_params = {
            "max_depth": sport.hyperParameters.xgb_max_depth,
            "learning_rate": sport.hyperParameters.xgb_learning_rate,
            "subsample": sport.hyperParameters.xgb_subsample,
            "colsample_bytree": sport.hyperParameters.xgb_colsample_bytree,
            "reg_alpha": sport.hyperParameters.xgb_reg_alpha,
            "reg_lambda": sport.hyperParameters.xgb_reg_lambda,
            "min_child_weight": sport.hyperParameters.xgb_min_child_weight,
            "n_estimators": sport.hyperParameters.xgb_estimators,        # CV will early-stop long before this
            "tree_method": "hist",
        }

        lgb_params = {
            "num_leaves": int(sport.hyperParameters.lgb_num_leaves),
            "learning_rate": sport.hyperParameters.lgb_learning_rate,
            "feature_fraction": sport.hyperParameters.lgb_feature_fraction,
            "bagging_fraction": sport.hyperParameters.lgb_bagging_fraction,
            "bagging_freq": int(sport.hyperParameters.lgb_bagging_freq),
            "min_data_in_leaf": int(sport.hyperParameters.lgb_min_data_in_leaf),
            "lambda_l1": sport.hyperParameters.lgb_lambda_l1,
            "lambda_l2": sport.hyperParameters.lgb_lambda_l2,
            "n_estimators": sport.hyperParameters.lgb_n_estimators,
            "objective": "regression_l1",    # MAE works very well for spreads
            "verbosity": -1
        }

        cat_params = {
            "depth": sport.hyperParameters.cb_depth,
            "learning_rate": sport.hyperParameters.cb_learning_rate,
            "l2_leaf_reg": sport.hyperParameters.cb_l2_leaf_reg,
            "bagging_temperature": sport.hyperParameters.cb_bagging_temperature,
            "loss_function": "MAE",
            "iterations": sport.hyperParameters.cb_iterations,
        }

        # ------------------------------------------------------------
        # Model parameter dicts
        # ------------------------------------------------------------
        hyper = {
            "xgb_params": xgb_params,
            "lgb_params": lgb_params,
            "cat_params": cat_params
        }

        # ------------------------------------------------------------
        # STORAGE FOR OUT-OF-FOLD MARGINS (for calibration)
        # ------------------------------------------------------------
        oof_margins = []
        oof_labels  = []      # home-team win labels
        oof_mae_scores = []

        # ------------------------------------------------------------
        # CROSS-VALIDATION LOOP
        # ------------------------------------------------------------
        for fold_idx, (train_idx, val_idx) in enumerate(tscv.split(train_df, groups=groups), start=1):

            X_train = train_df.iloc[train_idx]
            X_val   = train_df.iloc[val_idx]

            y_train = [train_scores[i] for i in train_idx]     # regression raw scores
            y_val   = [train_scores[i] for i in val_idx]

            # ------------------------------------------------------------
            # ENSURE EVEN NUMBER OF ROWS IN VALIDATION (home+away pairs)
            # ------------------------------------------------------------
            if len(X_val) % 2 != 0:
                X_val = X_val[:-1]
                y_val = y_val[:-1]

            # -----------------------------
            # LightGBM dataset
            # -----------------------------
            train_data = lgb.Dataset(X_train, label=y_train)
            valid_data = lgb.Dataset(X_val, label=y_val)

            # -----------------------------
            # Build models
            # -----------------------------
            xgb_reg = XGBRegressor(
                **hyper["xgb_params"],
                random_state=122021,
                n_jobs=-1,
                early_stopping_rounds=200,
                eval_metric="mae"
            )

            lgb_reg = lgb.train(
                params=hyper["lgb_params"],
                train_set=train_data,
                valid_sets=[valid_data],
                callbacks=[
                    lgb.early_stopping(stopping_rounds=200, verbose=False),
                    lgb.log_evaluation(period=0)  # <-- this disables printing
                ]
            )

            cb_reg = CatBoostRegressor(
                **hyper["cat_params"],
                verbose=False,
                early_stopping_rounds=200,
                random_seed=122021
            )

            # -----------------------------
            # TRAIN
            # -----------------------------
            xgb_reg.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
            cb_reg.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

            # -----------------------------
            # ENSEMBLE PRED
            # -----------------------------
            pred_val = (
                0.40 * xgb_reg.predict(X_val) +
                0.30 * lgb_reg.predict(X_val) +
                0.30 * cb_reg.predict(X_val)
            )

            fold_mae = mean_absolute_error(y_val, pred_val)
            oof_mae_scores.append(fold_mae)
            logger.info(f"FOLD: {fold_idx} --------- MAE: {fold_mae}")
            # -----------------------------
            # BUILD OUT-OF-FOLD MARGINS
            # -----------------------------
            for i in range(0, len(val_idx) -1, 2):
                home_pred = pred_val[i]
                away_pred = pred_val[i + 1]
                margin = home_pred - away_pred

                home_label = train_labels[val_idx[i]]   # 1 if home won, else 0

                oof_margins.append(margin)
                oof_labels.append(home_label)


        # ==================================================================
        #              1. PREPARE CALIBRATION DATA (OOF ONLY)
        # ==================================================================

        oof_margins = np.array(oof_margins)
        oof_labels  = np.array(oof_labels)

        # ------------------------------------------------------------
        # Normalize margin scale (industry standard)
        # ------------------------------------------------------------
        margin_scale = np.std(oof_margins)
        oof_margins_scaled = oof_margins / margin_scale

        # ------------------------------------------------------------
        # Quantile binning (critical to prevent isotonic overfitting)
        # ------------------------------------------------------------
        df_bins = pd.DataFrame({"m": oof_margins_scaled, "y": oof_labels})
        df_bins["bin"] = pd.qcut(df_bins["m"], q=200, duplicates='drop')

        bin_stats = df_bins.groupby("bin", observed=True).agg({"m": "mean", "y": "mean"})
        m_bin = bin_stats["m"].values
        y_bin = bin_stats["y"].values

        # ------------------------------------------------------------
        # Optional Laplace smoothing to avoid 0/1 probabilities
        # ------------------------------------------------------------
        y_bin = (y_bin * len(df_bins) + 1) / (len(df_bins) + 2)

        # ------------------------------------------------------------
        # Fit isotonic on smoothed binned OOF data (NO LEAKAGE)
        # ------------------------------------------------------------
        iso = IsotonicRegression(out_of_bounds="clip")
        iso.fit(m_bin, y_bin)


        # ==================================================================
        #                2. TRAIN FINAL FULL MODELS ON ALL TRAIN DATA
        # ==================================================================

        # -----------------------------
        # Final XGB
        # -----------------------------
        final_xgb = XGBRegressor(
            **hyper["xgb_params"],
            random_state=122021,
            eval_metric="mae"
        )
        final_xgb.fit(train_df, train_scores)

        # -----------------------------
        # Final LGB
        # -----------------------------
        train_data_full = lgb.Dataset(train_df, label=train_scores)
        valid_data_full = lgb.Dataset(test_df, label=test_scores)

        final_lgb = lgb.train(
            params=hyper["lgb_params"],
            train_set=train_data_full,
            valid_sets=[valid_data_full]
        )

        # -----------------------------
        # Final CatBoost
        # -----------------------------
        final_cb = CatBoostRegressor(
            **hyper["cat_params"],
            verbose=False
        )
        final_cb.fit(train_df, train_scores)

        # -----------------------------
        # Ensemble function
        # -----------------------------
        def blended_regression(X):
            return (
                0.40 * final_xgb.predict(X) +
                0.30 * final_lgb.predict(X) +
                0.30 * final_cb.predict(X)
            )


        # ==================================================================
        #                3. HOLDOUT TEST EVALUATION
        # ==================================================================

        test_pred_scores = blended_regression(test_df)
        holdout_mae = mean_absolute_error(test_scores, test_pred_scores)

        # -----------------------------
        # Convert test regression → margins
        # -----------------------------
        test_margins = []
        test_home_labels = []

        for i in range(0, len(test_pred_scores) - 1, 2):
            home = test_pred_scores[i]
            away = test_pred_scores[i+1]

            test_margins.append(home - away)
            test_home_labels.append(test_labels[i])

        test_margins = np.array(test_margins) / margin_scale  # SCALE MATCHES TRAINING

        # -----------------------------
        # Apply calibrated isotonic
        # -----------------------------
        test_pred_probs = iso.predict(test_margins)
        holdout_logloss = log_loss(test_home_labels, test_pred_probs)

        logger.info("===== FINAL HOLDOUT RESULTS =====")
        logger.info(f"Holdout MAE: {holdout_mae:.4f}")
        logger.info(f"Holdout LogLoss: {holdout_logloss:.4f}")

        # -----------------------------
        # CALCULATE RELIABILITY / VARIANCE
        # -----------------------------
        sport_games_threshold_list = []
        for game in past_games:
            outcome = get_best_odds_for_game(game, "h2h")
            if outcome is None:
                continue
            outcome_dict = {
                "price": outcome.price,
                "team": outcome.teamId,
                "implied_prob": outcome.impliedProbability,
                "point": getattr(outcome, "point", None)
            }
            sport_games_threshold_list.append({
                "game": game,
                "outcome": outcome_dict
            })

        sport_threshold = compute_segment_threshold(sport_games_threshold_list)
        all_preds = iso.predict(oof_margins_scaled)
        errors = all_preds - oof_labels

        sport_variance = float(np.var(errors))
        sport_mae = float(np.mean(np.abs(errors)))
        ece = compute_ece(all_preds, oof_labels)

        reliability = max(0.05, 1 - ece - sport_variance)

        payload={
            'sport': sport.id,
            'name': sport.name,
            'variance': sport_variance,
            'calibrationECE': ece,
            'reliabilityWeight': reliability,
            'threshold': sport_threshold
        }

        await save_sport(AsyncSessionLocal, payload)

        await value_segment_search(sport, past_games)
        # ==================================================================
        # SAVE CHECKPOINT
        # ==================================================================

        save_model_checkpoint(
            sport.name,
            regression_models=[final_xgb, final_lgb, final_cb],
            calibration_model=iso,
            margin_scale=margin_scale      # NEW parameter you MUST save
        )

        logger.info(f"===== FINISHED TRAINING FOR {sport.name} =====")

            
        logger.info(f"===== STARTING PREDICTIONS FOR {sport.name} =====")
        #------------------------------------ UPCOMING GAME PREDICTIONS ------------------------------------

        team_history, last_games_info, team_home_history, team_away_history, team_vs_team_history, team_elo, team_elo_history, team_sos_components, last_seen_season_month = prediction_history_builder(past_games, sport)

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
                continue

            prediction_df = pd.DataFrame(prediction_features)
            # --- Ensure column order matches training data ---
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


            # if is_game_today(game.commence_time):
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

        logger.info(f"===== FINISHED PREDICTIONS FOR {sport.name} =====")
        # ----------------------------------------- FEATURE IMPORTANCE EXTRACTION ---------------------------------------------------
        # Get feature importances from each model
        xgb_importance = final_xgb.get_booster().get_score(importance_type='gain')
        lgb_importance = final_lgb.feature_importance(importance_type='gain')
        cb_importance = final_cb.get_feature_importance(type='PredictionValuesChange')

        # Convert each to a dict keyed by feature name
        lgb_features = final_lgb.feature_name()
        lgb_importance_dict = {feat: imp for feat, imp in zip(lgb_features, lgb_importance)}

        cb_features = final_cb.feature_names_
        cb_importance_dict = {feat: imp for feat, imp in zip(cb_features, cb_importance)}

        # Ensemble weighting
        weights = {"xgb": 0.4, "lgb": 0.3, "cb": 0.3}

        # Combine weighted importances
        combined_importance = {}
        all_features = set(list(xgb_importance.keys()) + list(lgb_importance_dict.keys()) + list(cb_importance_dict.keys()))

        for f in all_features:
            combined_importance[f] = (
                weights["xgb"] * xgb_importance.get(f, 0) +
                weights["lgb"] * lgb_importance_dict.get(f, 0) +
                weights["cb"] * cb_importance_dict.get(f, 0)
            )

        # Normalize so sum = 1
        total_importance = sum(combined_importance.values())
        if total_importance > 0:
            for f in combined_importance:
                combined_importance[f] /= total_importance

        # Sort for easy inspection
        combined_importance_sorted = sorted(
            [{"feature": f, "importance": imp} for f, imp in combined_importance.items()],
            key=lambda x: x["importance"],
            reverse=True
        )

        # Extract home/team feature importances
        team_features = [f for f in combined_importance.keys() if f.startswith("team_")]
        combined_team_importance = {f: combined_importance[f] for f in team_features}

        # Normalize team-only importances
        total_team_importance = sum(combined_team_importance.values())
        if total_team_importance > 0:
            for f in combined_team_importance:
                combined_team_importance[f] /= total_team_importance

        # Sort and drop prefix "team_"
        combined_team_importance_sorted = sorted(
            [
                {
                    "feature": f.replace("team_", ""),  # <<-- REMOVE PREFIX
                    "importance": imp
                }
                for f, imp in combined_team_importance.items()
            ],
            key=lambda x: x["importance"],
            reverse=True
        )

        # Optional: Save payloads to DB or log top features
        payload = {"featureImportanceScoresFull": combined_importance_sorted}
        payload_team = {"featureImportanceScoresTeam": combined_team_importance_sorted}
        await save_ml_weights(sport, payload, AsyncSessionLocal)
        await save_ml_weights(sport, payload_team, AsyncSessionLocal)

        # logger.info("==== ENSEMBLE FEATURE IMPORTANCE (normalized) ====")
        # for f in combined_importance_sorted:  # top 20 features
        #     logger.info(f"{f['feature']}: {f['importance']*100:.2f}%")

        # logger.info("==== ENSEMBLE TEAM FEATURE IMPORTANCE (normalized) ====")
        # for f in combined_team_importance_sorted:  # top 20 team features
        #     logger.info(f"{f['feature']}: {f['importance']*100:.4f}%")

        await engine.dispose()
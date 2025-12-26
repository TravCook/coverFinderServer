import optuna
from optuna.pruners import SuccessiveHalvingPruner
from optuna.samplers import TPESampler
import logging, re
import numpy as np
import pandas as pd
from xgboost import XGBRegressor, XGBClassifier
from catboost import CatBoostRegressor
import lightgbm as lgb
from sklearn.metrics import mean_absolute_error, brier_score_loss, log_loss
from sklearn.preprocessing import StandardScaler
from app.helpers.trainingHelpers.rolling_window_split import RollingTimeSeriesSplit
from app.helpers.dataHelpers.db_getters.get_games_sync import get_games_sync
from app.helpers.trainingHelpers.feature_extraction import feature_extraction
from app.helpers.dataHelpers.get_async_session_factory import get_async_session_factory
from app.helpers.dataHelpers.db_getters.get_sports_sync import get_sports_sync
from app.helpers.dataHelpers.db_setters.save_hyperparams_async import save_hyperparams

logger = logging.getLogger(__name__)

class OptunaCleanFormatter(logging.Formatter):
    def format(self, record):
        msg = record.getMessage()

        # Print simplified trial result lines
        if "finished with value" in msg:
            trial = re.search(r"Trial (\d+)", msg)
            value = re.search(r"value:\s*([-\d\.eE]+)", msg)
            best = re.search(r"Best is trial (\d+) with value:\s*([-\d\.eE]+)", msg)

            if trial and value:
                if best:
                    return (
                        f"[Optuna] Trial {trial.group(1)} finished with value {value.group(1)}. "
                        f"Best: Trial {best.group(1)} ({best.group(2)})"
                    )
                else:
                    return f"[Optuna] Trial {trial.group(1)} finished with value {value.group(1)}"

        return msg


def install_optuna_clean_logging():
    optuna_logger = logging.getLogger("optuna")
    for handler in optuna_logger.handlers:
        handler.setFormatter(OptunaCleanFormatter())
    optuna.logging.set_verbosity(optuna.logging.INFO)

def calibration_error(y_true, y_pred_proba, n_bins=10):
    """Compute Expected Calibration Error (ECE) and Brier-like score."""
    bins = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    total = len(y_true)
    for i in range(n_bins):
        bin_lower, bin_upper = bins[i], bins[i + 1]
        in_bin = (y_pred_proba > bin_lower) & (y_pred_proba <= bin_upper)
        prop_in_bin = np.mean(in_bin)
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(y_true[in_bin])
            avg_confidence_in_bin = np.mean(y_pred_proba[in_bin])
            ece += np.abs(accuracy_in_bin - avg_confidence_in_bin) * prop_in_bin
    return ece

def log_calibration_buckets(y_true, y_pred_proba, num_bins=10, label="Fold"):
    bins = np.linspace(0.0, 1.0, num_bins + 1)
    bin_ids = np.digitize(y_pred_proba, bins) - 1
    bucket_stats = []

    logger.info(f"Calibration Buckets ({label})")
    for i in range(num_bins):
        in_bin = bin_ids == i
        if np.sum(in_bin) == 0:
            continue
        avg_conf = np.mean(y_pred_proba[in_bin])
        winrate = np.mean(y_true[in_bin])
        count = np.sum(in_bin)
        bucket_stats.append((i, bins[i], bins[i+1], avg_conf, winrate, count))
        logger.info(
            f"  Bin {i+1}: [{bins[i]:.1f}-{bins[i+1]:.1f}) | "
            f"AvgConf={avg_conf:.3f}, WinRate={winrate:.3f}, n={count}"
        )
    return bucket_stats

async def tune_hyperparams_async(
        n_trials_stage1: int = 8,
        n_trials_stage2: int = 5,
        purge_gap: int = 20
):
    '''Takes roughly 8 hours, tunes hyperparams for all 3 models used in ensemble regression prediction pipeline'''

    
    logger.info("=== STARTING FAST QUANT TUNING (2-Stage + ASHA + Composite Objective) ===")

    AsyncSessionLocal, engine = get_async_session_factory()
    sports = await get_sports_sync(AsyncSessionLocal)

    install_optuna_clean_logging()

    # ---------------------------------------------------------
    # COMPOSITE METRIC USED BY QUANT SHOPS / SPORTSBOOKS
    # ---------------------------------------------------------
    def composite_score(y_true, preds):
        mae = mean_absolute_error(y_true, preds)

        # correlation (safe)
        corr = np.corrcoef(y_true, preds)[0, 1]
        if np.isnan(corr):
            corr = 0

        # directional accuracy
        direction_true = (y_true > 0).astype(int)
        direction_pred = (preds > 0).astype(int)
        direction_acc = np.mean(direction_true == direction_pred)

        # final weighted score
        return (
            mae
            - 0.05 * corr
            - 0.10 * direction_acc
        )

    # ---------------------------------------------------------
    # LOOP OVER SPORTS
    # ---------------------------------------------------------
    for sport in sorted(sports, key=lambda s: s.startMonth or 0):
        tuned_sports = ['baseball_mlb', 'americanfootball_ncaaf', 'americanfootball_nfl', 'basketball_nba']
        if sport.name in tuned_sports:
            continue
        games = await get_games_sync(sport, AsyncSessionLocal)
        past_games = sorted([g for g in games if g.complete], key=lambda g: g.commence_time)

        if len(past_games) < 400:
            logger.warning(f"Skipping {sport.name}: not enough data ({len(past_games)})")
            continue

        features, scorelabels, winLabels = feature_extraction(past_games, sport)
        X = pd.DataFrame(features)
        y = np.array(scorelabels)

        tscv = RollingTimeSeriesSplit(n_splits=4, train_size=0.7, test_size=0.2, purge_gap=purge_gap)

        logger.info(f"---- {sport.name.upper()} | Stage 1 (Tree Shape) ----")

        # ---------------------------------------------------------
        # STAGE 1 — TREE STRUCTURE SEARCH
        # ---------------------------------------------------------

        # ========== XGBoost Stage 1 ==========
        def objective_xgb_stage1(trial):
            params = {
                "n_estimators": 300,
                "learning_rate": trial.suggest_float("learning_rate", 0.005, 0.2, log=True),
                "max_depth": trial.suggest_int("max_depth", 3, 11),
                "subsample": trial.suggest_float("subsample", 0.6, 1.0),
                "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
                "min_child_weight": trial.suggest_float("min_child_weight", 1, 20),
                "random_state": 122021,
                "verbosity": 0,
                "n_jobs": -1
            }

            fold_scores = []
            for train_idx, val_idx in tscv.split(X):
                model = XGBRegressor(**params)
                model.fit(X.iloc[train_idx], y[train_idx])
                preds = model.predict(X.iloc[val_idx])

                fold_scores.append(composite_score(y[val_idx], preds))

            return np.mean(fold_scores)

        # ========== LightGBM Stage 1 ==========
        def objective_lgb_stage1(trial):
            params = {
                "num_leaves": trial.suggest_int("num_leaves", 15, 127),
                "learning_rate": trial.suggest_float("learning_rate", 0.005, 0.2, log=True),
                "feature_fraction": trial.suggest_float("feature_fraction", 0.5, 1.0),
                "bagging_fraction": trial.suggest_float("bagging_fraction", 0.5, 1.0),
                "bagging_freq": trial.suggest_int("bagging_freq", 1, 10),
                "min_data_in_leaf": trial.suggest_int("min_data_in_leaf", 10, 100),
                "objective": "regression_l1",
                "verbose": -1
            }

            fold_scores = []
            for train_idx, val_idx in tscv.split(X):
                train_data = lgb.Dataset(X.iloc[train_idx], label=y[train_idx])
                valid_data = lgb.Dataset(X.iloc[val_idx], label=y[val_idx])

                model = lgb.train(params, train_data, valid_sets=[valid_data])
                preds = model.predict(X.iloc[val_idx])

                fold_scores.append(composite_score(y[val_idx], preds))

            return np.mean(fold_scores)

        # ========== CatBoost Stage 1 ==========
        def objective_cb_stage1(trial):
            params = {
                "depth": trial.suggest_int("depth", 3, 11),
                "learning_rate": trial.suggest_float("learning_rate", 0.005, 0.2, log=True),
                "l2_leaf_reg": trial.suggest_float("l2_leaf_reg", 1, 10),
                "bagging_temperature": trial.suggest_float("bagging_temperature", 0.0, 1.0),
                "loss_function": "MAE",
                "random_seed": 122021,
                "verbose": False
            }

            fold_scores = []
            for train_idx, val_idx in tscv.split(X):
                model = CatBoostRegressor(**params)
                model.fit(X.iloc[train_idx], y[train_idx], verbose=False)
                preds = model.predict(X.iloc[val_idx])

                fold_scores.append(composite_score(y[val_idx], preds))

            return np.mean(fold_scores)

        sampler = TPESampler()
        pruner = SuccessiveHalvingPruner()

        study_xgb_stage1 = optuna.create_study(direction="minimize", sampler=sampler, pruner=pruner)
        study_xgb_stage1.optimize(objective_xgb_stage1, n_trials=n_trials_stage1)
        best_xgb_shape = study_xgb_stage1.best_params

        study_lgb_stage1 = optuna.create_study(direction="minimize", sampler=sampler, pruner=pruner)
        study_lgb_stage1.optimize(objective_lgb_stage1, n_trials=n_trials_stage1)
        best_lgb_shape = study_lgb_stage1.best_params

        study_cb_stage1 = optuna.create_study(direction="minimize", sampler=sampler, pruner=pruner)
        study_cb_stage1.optimize(objective_cb_stage1, n_trials=n_trials_stage1)
        best_cb_shape = study_cb_stage1.best_params

        # ---------------------------------------------------------
        # STAGE 2 — REGULARIZATION / FINETUNING
        # ---------------------------------------------------------
        logger.info(f"---- {sport.name.upper()} | Stage 2 (Regularization) ----")

        # == XGBoost Stage 2 ==
        def objective_xgb_stage2(trial):
            params = {
                **best_xgb_shape,
                "n_estimators": 300,
                "reg_alpha": trial.suggest_float("reg_alpha", 1e-4, 10.0, log=True),
                "reg_lambda": trial.suggest_float("reg_lambda", 1e-4, 10.0, log=True),
                "random_state": 122021,
                "verbosity": 0,
                "n_jobs": -1
            }

            fold_scores = []
            for train_idx, val_idx in tscv.split(X):
                model = XGBRegressor(**params)
                model.fit(X.iloc[train_idx], y[train_idx])
                preds = model.predict(X.iloc[val_idx])

                fold_scores.append(composite_score(y[val_idx], preds))

            return np.mean(fold_scores)

        # == LightGBM Stage 2 ==
        def objective_lgb_stage2(trial):
            params = {
                **best_lgb_shape,
                "n_estimators": 1500,
                "lambda_l1": trial.suggest_float("lambda_l1", 1e-4, 10.0, log=True),
                "lambda_l2": trial.suggest_float("lambda_l2", 1e-4, 10.0, log=True),
                "verbose": -1
            }

            fold_scores = []
            for train_idx, val_idx in tscv.split(X):
                model = lgb.train(
                    params,
                    lgb.Dataset(X.iloc[train_idx], label=y[train_idx]),
                    valid_sets=[lgb.Dataset(X.iloc[val_idx], label=y[val_idx])]
                )
                preds = model.predict(X.iloc[val_idx])
                fold_scores.append(composite_score(y[val_idx], preds))

            return np.mean(fold_scores)

        # == CatBoost Stage 2 ==
        def objective_cb_stage2(trial):
            params = {
                **best_cb_shape,
                "iterations": 1500,
                "l2_leaf_reg": trial.suggest_float("l2_leaf_reg", 1e-4, 20.0, log=True),
                "verbose": False
            }

            fold_scores = []
            for train_idx, val_idx in tscv.split(X):
                model = CatBoostRegressor(**params)
                model.fit(X.iloc[train_idx], y[train_idx], verbose=False)
                preds = model.predict(X.iloc[val_idx])

                fold_scores.append(composite_score(y[val_idx], preds))

            return np.mean(fold_scores)

        # Run stage 2
        study_xgb_stage2 = optuna.create_study(direction="minimize", sampler=sampler, pruner=pruner)
        study_xgb_stage2.optimize(objective_xgb_stage2, n_trials=n_trials_stage2)
        best_xgb_params = {**best_xgb_shape, **study_xgb_stage2.best_params, "n_estimators": 2500}

        study_lgb_stage2 = optuna.create_study(direction="minimize", sampler=sampler, pruner=pruner)
        study_lgb_stage2.optimize(objective_lgb_stage2, n_trials=n_trials_stage2)
        best_lgb_params = {**best_lgb_shape, **study_lgb_stage2.best_params, "n_estimators": 2500}

        study_cb_stage2 = optuna.create_study(direction="minimize", sampler=sampler, pruner=pruner)
        study_cb_stage2.optimize(objective_cb_stage2, n_trials=n_trials_stage2)
        best_cb_params = {**best_cb_shape, **study_cb_stage2.best_params, "iterations": 2500}

        # Log nicely
        logger.info(f"[{sport.name}] Final XGB Params: {best_xgb_params}")
        logger.info(f"[{sport.name}] Final LGB Params: {best_lgb_params}")
        logger.info(f"[{sport.name}] Final CB Params: {best_cb_params}")

        # Save hyperparameters to DB
        payload = {
            "xgb_estimators": best_xgb_params["n_estimators"],
            "xgb_learning_rate": best_xgb_params["learning_rate"],
            "xgb_max_depth": best_xgb_params["max_depth"],
            "xgb_subsample": best_xgb_params["subsample"],
            "xgb_colsample_bytree": best_xgb_params["colsample_bytree"],
            "xgb_reg_alpha": best_xgb_params["reg_alpha"],
            "xgb_reg_lambda": best_xgb_params["reg_lambda"],
            "xgb_min_child_weight": best_xgb_params["min_child_weight"],

            "lgb_num_leaves": best_lgb_params["num_leaves"],
            "lgb_learning_rate": best_lgb_params["learning_rate"],
            "lgb_feature_fraction": best_lgb_params["feature_fraction"],
            "lgb_bagging_fraction": best_lgb_params["bagging_fraction"],
            "lgb_bagging_freq": best_lgb_params["bagging_freq"],
            "lgb_min_data_in_leaf": best_lgb_params["min_data_in_leaf"],
            "lgb_lambda_l1": best_lgb_params["lambda_l1"],
            "lgb_lambda_l2": best_lgb_params["lambda_l2"],
            "lgb_n_estimators": best_lgb_params["n_estimators"],

            "cb_depth": best_cb_params["depth"],
            "cb_learning_rate": best_cb_params["learning_rate"],
            "cb_l2_leaf_reg": best_cb_params["l2_leaf_reg"],
            "cb_bagging_temperature": best_cb_params["bagging_temperature"],
            "cb_iterations": best_cb_params["iterations"],
        }

        await save_hyperparams(AsyncSessionLocal, sport, payload)

    await engine.dispose()
    logger.info("FINISHED FAST QUANT TUNING (Composite Objective)")



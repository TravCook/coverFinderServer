import os
import logging
import joblib

logger = logging.getLogger(__name__)

def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)

def save_model_checkpoint(sport_key: str, regression_models: list, calibration_model, margin_scale: float):
    """
    Save regression ensemble models and calibration model + margin scale.

    Parameters:
    - sport_key: str, unique key for the sport
    - regression_models: list of trained regression models
    - calibration_model: fitted isotonic regression model
    - margin_scale: float, scaling factor used for margin normalization
    """
    MODEL_DIR = "app/models"

    try:
        reg_dir = os.path.join(MODEL_DIR, "regression")
        calib_dir = os.path.join(MODEL_DIR, "calibration")

        ensure_dir(reg_dir)
        ensure_dir(calib_dir)

        # ----------------------------------------
        # Save regression models
        # ----------------------------------------
        for idx, model in enumerate(regression_models, start=1):
            reg_path = os.path.join(reg_dir, f"{sport_key}_regressor_{idx}.joblib")
            joblib.dump(model, reg_path, compress=3)
            # logger.info(f"Saved regression model {idx}: {reg_path}")

        # ----------------------------------------
        # Save calibration bundle (iso + margin_scale)
        # ----------------------------------------
        calib_bundle = {
            "iso_model": calibration_model,
            "margin_scale": margin_scale
        }

        calib_path = os.path.join(calib_dir, f"{sport_key}_calibration.joblib")
        joblib.dump(calib_bundle, calib_path, compress=3)
        # logger.info(f"Saved calibration bundle: {calib_path}")

    except Exception as e:
        logger.exception(f"Failed to save models for {sport_key}: {e}")

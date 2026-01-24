import os
import logging
import joblib

logger = logging.getLogger(__name__)

def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)

def save_model_checkpoint(
    sport_key: str,
    regression_models: list,
    calibration_model,
    margin_scale: float,
    value_classifier=None
):
    """
    Save regression ensemble models, calibration model + margin scale,
    and optional value-bet classifier.
    """
    MODEL_DIR = "app/models"

    try:
        reg_dir   = os.path.join(MODEL_DIR, "regression")
        calib_dir = os.path.join(MODEL_DIR, "calibration")
        clf_dir   = os.path.join(MODEL_DIR, "value_classifier")

        ensure_dir(reg_dir)
        ensure_dir(calib_dir)
        ensure_dir(clf_dir)

        # ----------------------------------------
        # Save regression models
        # ----------------------------------------
        for idx, model in enumerate(regression_models, start=1):
            reg_path = os.path.join(
                reg_dir,
                f"{sport_key}_regressor_{idx}.joblib"
            )
            joblib.dump(model, reg_path, compress=3)

        # ----------------------------------------
        # Save calibration bundle
        # ----------------------------------------
        calib_bundle = {
            "iso_model": calibration_model,
            "margin_scale": margin_scale
        }

        calib_path = os.path.join(
            calib_dir,
            f"{sport_key}_calibration.joblib"
        )
        joblib.dump(calib_bundle, calib_path, compress=3)

        # ----------------------------------------
        # Save value-bet classifier (optional)
        # ----------------------------------------
        if value_classifier is not None:
            clf_path = os.path.join(
                clf_dir,
                f"{sport_key}_value_classifier.joblib"
            )
            joblib.dump(value_classifier, clf_path, compress=3)

    except Exception as e:
        logger.exception(f"Failed to save models for {sport_key}: {e}")

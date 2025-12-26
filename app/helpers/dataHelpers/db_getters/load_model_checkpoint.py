import os
import joblib

def load_model_checkpoint(sport_key: str):
    """
    Load regression ensemble models and calibrated isotonic model + margin scale.

    Returns:
    - regression_models: list of loaded regressors
    - iso_model: fitted isotonic regression model
    - margin_scale: float used during calibration
    """
    MODEL_DIR = "app/models"

    reg_dir = os.path.join(MODEL_DIR, "regression")
    calib_dir = os.path.join(MODEL_DIR, "calibration")

    # ----------------------------------------------------------
    # Load regression models
    # ----------------------------------------------------------
    regression_models = []
    for idx in range(1, 4):  # 3 models in ensemble
        reg_path = os.path.join(reg_dir, f"{sport_key}_regressor_{idx}.joblib")
        model = joblib.load(reg_path)
        regression_models.append(model)

    # ----------------------------------------------------------
    # Load calibration bundle
    # ----------------------------------------------------------
    calib_path = os.path.join(calib_dir, f"{sport_key}_calibration.joblib")
    bundle = joblib.load(calib_path)

    iso_model    = bundle["iso_model"]
    margin_scale = bundle["margin_scale"]

    return regression_models, iso_model, margin_scale

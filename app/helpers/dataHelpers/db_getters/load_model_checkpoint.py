import os
import joblib

def load_model_checkpoint(sport_key: str):
    """
    Load regression ensemble models, calibration model + margin scale,
    and optional value-bet classifier.
    """
    MODEL_DIR = "app/models"

    reg_dir   = os.path.join(MODEL_DIR, "regression")
    calib_dir = os.path.join(MODEL_DIR, "calibration")
    clf_dir   = os.path.join(MODEL_DIR, "value_classifier")

    # ----------------------------------------------------------
    # Load regression models
    # ----------------------------------------------------------
    regression_models = []
    for idx in range(1, 4):
        reg_path = os.path.join(
            reg_dir,
            f"{sport_key}_regressor_{idx}.joblib"
        )
        regression_models.append(joblib.load(reg_path))

    # ----------------------------------------------------------
    # Load calibration bundle
    # ----------------------------------------------------------
    calib_path = os.path.join(
        calib_dir,
        f"{sport_key}_calibration.joblib"
    )
    bundle = joblib.load(calib_path)

    iso_model    = bundle["iso_model"]
    margin_scale = bundle["margin_scale"]

    # ----------------------------------------------------------
    # Load value-bet classifier (if exists)
    # ----------------------------------------------------------
    clf_path = os.path.join(
        clf_dir,
        f"{sport_key}_value_classifier.joblib"
    )

    value_classifier = None
    if os.path.exists(clf_path):
        value_classifier = joblib.load(clf_path)

    return regression_models, iso_model, margin_scale, value_classifier

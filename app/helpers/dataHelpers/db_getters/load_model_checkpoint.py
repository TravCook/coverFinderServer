import os
import joblib

def load_model_checkpoint(sport_key: str):
    MODEL_DIR = "app/models"

    reg_dir   = os.path.join(MODEL_DIR, "regression")
    calib_dir = os.path.join(MODEL_DIR, "calibration")
    clf_dir   = os.path.join(MODEL_DIR, "value_classifier")

    try:
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
        # Load value-bet classifier (optional)
        # ----------------------------------------------------------
        clf_path = os.path.join(
            clf_dir,
            f"{sport_key}_value_classifier.joblib"
        )

        value_classifier = (
            joblib.load(clf_path) if os.path.exists(clf_path) else None
        )

        return regression_models, iso_model, margin_scale, value_classifier

    except (FileNotFoundError, KeyError, OSError) as e:
        # Anything missing or malformed → skip sport
        return None, None, None, None

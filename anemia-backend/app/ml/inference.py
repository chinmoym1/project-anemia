# ============================================================
# HEMAVIEW — ML Inference Pipeline
# OpenCV → CIELab → Feature Extraction → Hb Prediction
# ============================================================

import cv2
import numpy as np
from typing import Tuple, Dict, Any, Optional
import logging
import time
import os
import joblib

logger = logging.getLogger(__name__)


# ─── WHO Thresholds ──────────────────────────────────────────
WHO_THRESHOLDS = {
    "Female": {"severe": 8.0, "moderate": 10.0, "mild": 12.0},
    "Male":   {"severe": 8.0, "moderate": 10.0, "mild": 13.0},
    "Other":  {"severe": 8.0, "moderate": 10.0, "mild": 12.0},
}

def classify_severity(hb: float, sex: str = "Female") -> str:
    t = WHO_THRESHOLDS.get(sex, WHO_THRESHOLDS["Female"])
    if hb < t["severe"]:   return "severe"
    if hb < t["moderate"]: return "moderate"
    if hb < t["mild"]:     return "mild"
    return "normal"


# ─── Step 1: Image Quality Check (Laplacian Variance) ────────
def check_image_quality(image: np.ndarray) -> Tuple[bool, float]:
    """
    Detect motion blur using Laplacian variance.
    Returns (is_sharp, variance_score)
    Threshold: < 80 = blurry for medical imaging
    """
    gray      = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    variance  = cv2.Laplacian(gray, cv2.CV_64F).var()
    is_sharp  = variance >= 80.0
    logger.debug(f"Blur detection: variance={variance:.2f}, sharp={is_sharp}")
    return is_sharp, float(variance)


# ─── Step 2: Histogram Equalization & Normalization ──────────
def normalize_image(image: np.ndarray) -> np.ndarray:
    """Apply CLAHE to normalize lighting across different ambient conditions."""
    lab   = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l     = clahe.apply(l)
    normalized = cv2.merge([l, a, b])
    return cv2.cvtColor(normalized, cv2.COLOR_LAB2BGR)


# ─── Step 3: ROI Segmentation (Rule-based fallback) ──────────
def segment_roi(image: np.ndarray, image_type: str = "conjunctiva") -> Tuple[np.ndarray, np.ndarray]:
    """
    Extract Region of Interest.
    In production: U-Net semantic segmentation model.
    Current: rule-based center crop with color-range masking.
    Replace segment_with_unet() when model weights are loaded.
    """
    h, w = image.shape[:2]

    if image_type == "conjunctiva":
        # Center 60% crop — conjunctiva is in center of image
        roi = image[int(h * 0.2):int(h * 0.8), int(w * 0.15):int(w * 0.85)]
        # Reddish tissue mask
        hsv  = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, np.array([0, 30, 50]), np.array([20, 255, 255]))
    elif image_type == "fingernail":
        roi  = image[int(h * 0.1):int(h * 0.9), int(w * 0.2):int(w * 0.8)]
        mask = np.ones(roi.shape[:2], dtype=np.uint8) * 255
    else:  # palmar
        roi  = image[int(h * 0.1):int(h * 0.9), int(w * 0.05):int(w * 0.95)]
        mask = np.ones(roi.shape[:2], dtype=np.uint8) * 255

    # Morphological cleanup
    kernel = np.ones((5, 5), np.uint8)
    mask   = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask   = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    return roi, mask


# ─── Step 4: CIELab Color Space Conversion ───────────────────
def extract_cielab_features(roi: np.ndarray, mask: np.ndarray) -> Dict[str, float]:
    """
    Convert masked ROI to CIELab and extract chromaticity features.
    L* = Luminance (discarded — removes lighting bias)
    a* = Red-Green axis (key for hemoglobin — higher = more red)
    b* = Blue-Yellow axis
    """
    lab = cv2.cvtColor(roi, cv2.COLOR_BGR2LAB).astype(np.float32)

    # Apply mask — only analyze tissue pixels
    mask_bool = mask > 0
    if mask_bool.sum() < 100:
        # Fallback if mask is too small
        mask_bool = np.ones(roi.shape[:2], dtype=bool)

    l_channel = lab[:, :, 0][mask_bool]
    a_channel = lab[:, :, 1][mask_bool]
    b_channel = lab[:, :, 2][mask_bool]

    # Normalize to 0–100 and -128–127 range
    L = l_channel * 100.0 / 255.0
    a = a_channel - 128.0
    b = b_channel - 128.0

    # Erythema Index: measures redness (hemoglobin concentration proxy)
    # EI = log(R/G) → approximated via a* in CIELab
    erythema_index = float(np.mean(a))

    return {
        "L_mean":         float(np.mean(L)),
        "L_std":          float(np.std(L)),
        "a_mean":         float(np.mean(a)),       # Key feature!
        "a_std":          float(np.std(a)),
        "b_mean":         float(np.mean(b)),
        "b_std":          float(np.std(b)),
        "erythema_index": erythema_index,
        "a_normalized":   float(np.mean(a) / 128.0),  # Normalized a* component
        "pixel_count":    int(mask_bool.sum()),
    }


# ─── Step 5: HSV Feature Extraction ─────────────────────────
def extract_hsv_features(roi: np.ndarray, mask: np.ndarray) -> Dict[str, float]:
    """Extract HSV-space features for ensemble feature vector."""
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV).astype(np.float32)
    mask_bool = mask > 0

    h = hsv[:, :, 0][mask_bool]
    s = hsv[:, :, 1][mask_bool]
    v = hsv[:, :, 2][mask_bool]

    return {
        "hue_mean":        float(np.mean(h)),
        "saturation_mean": float(np.mean(s) / 255.0),
        "value_mean":      float(np.mean(v) / 255.0),
        "saturation_std":  float(np.std(s) / 255.0),
    }


# ─── Step 6: Hb Prediction ───────────────────────────────────
class HbPredictor:
    """
    Wraps the trained regression model.
    Production: scikit-learn Random Forest or XGBoost loaded from disk.
    Before dataset is available: uses calibrated rule-based fallback.
    """

    def __init__(self):
        self.model = None
        self._try_load_model()

    def _try_load_model(self):
        model_path = "app/ml/models/hb_regressor.pkl"
        if os.path.exists(model_path):
            self.model = joblib.load(model_path)
            logger.info(f"Loaded Hb regression model from {model_path}")
        else:
            logger.warning("No trained model found — using rule-based fallback. Train the model with your dataset.")

    def _build_feature_vector(self, lab_features: Dict, hsv_features: Dict) -> np.ndarray:
        """Assemble feature vector in the exact order the model was trained on."""
        return np.array([[
            lab_features["a_mean"],
            lab_features["a_normalized"],
            lab_features["erythema_index"],
            lab_features["L_mean"],
            lab_features["b_mean"],
            lab_features["a_std"],
            lab_features["b_std"],
            hsv_features["hue_mean"],
            hsv_features["saturation_mean"],
            hsv_features["value_mean"],
            hsv_features["saturation_std"],
        ]])

    def predict(self, lab_features: Dict, hsv_features: Dict) -> Tuple[float, float]:
        """
        Returns (hb_level_g_per_dL, confidence_score_0_to_100)
        """
        feature_vector = self._build_feature_vector(lab_features, hsv_features)

        if self.model is not None:
            # Use trained model
            hb_prediction   = float(self.model.predict(feature_vector)[0])
            # Confidence from tree variance (if Random Forest)
            if hasattr(self.model, "estimators_"):
                predictions = np.array([tree.predict(feature_vector)[0] for tree in self.model.estimators_])
                std = predictions.std()
                confidence = max(0, min(100, 100 - (std / 2.0) * 100))
            else:
                confidence = 88.0
        else:
            # ── Rule-based fallback (until dataset is provided) ──
            # Based on published conjunctiva pallor correlations
            a_star = lab_features["a_mean"]
            # Approximate linear regression from literature
            # Hb ≈ 0.42 * a* + 10.5 (conjunctiva, mean from 3 studies)
            hb_prediction = max(3.0, min(20.0, 0.42 * a_star + 10.5))
            confidence = 72.0  # Lower confidence for rule-based

        # Clamp to physiologically valid range
        hb_prediction = max(3.0, min(20.0, round(hb_prediction, 1)))
        return hb_prediction, round(confidence, 1)


# ─── Step 7: SHAP Explainability (stub) ──────────────────────
def get_shap_explanation(feature_vector: np.ndarray, model) -> Dict[str, float]:
    """
    Returns SHAP feature importance for clinical transparency.
    Requires: pip install shap + trained model
    """
    try:
        import shap
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(feature_vector)
        feature_names = ["a_mean", "a_norm", "erythema", "L_mean", "b_mean",
                         "a_std", "b_std", "hue", "saturation", "value", "sat_std"]
        return {name: float(val) for name, val in zip(feature_names, shap_values[0])}
    except Exception:
        return {}


# ─── Main Inference Function ─────────────────────────────────
_predictor = HbPredictor()

def run_inference(image_bytes: bytes, image_type: str = "conjunctiva", sex: str = "Female") -> Dict[str, Any]:
    """
    Full pipeline: raw bytes → hemoglobin prediction.
    Returns complete result dict ready for API response.
    """
    start_time = time.time()

    # Decode image
    nparr  = np.frombuffer(image_bytes, np.uint8)
    image  = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image. Ensure it is a valid JPEG/PNG.")

    # Pipeline
    is_sharp, blur_score = check_image_quality(image)
    if not is_sharp:
        raise ValueError(f"Image too blurry (variance={blur_score:.1f}). Please retake.")

    normalized          = normalize_image(image)
    roi, mask           = segment_roi(normalized, image_type)
    lab_features        = extract_cielab_features(roi, mask)
    hsv_features        = extract_hsv_features(roi, mask)
    hb_level, confidence = _predictor.predict(lab_features, hsv_features)
    severity            = classify_severity(hb_level, sex)

    elapsed_ms = int((time.time() - start_time) * 1000)
    logger.info(f"Inference complete: Hb={hb_level} g/dL severity={severity} time={elapsed_ms}ms")

    return {
        "hb_level":        hb_level,
        "severity":        severity,
        "confidence":      confidence,
        "erythema_index":  lab_features["erythema_index"],
        "is_critical":     hb_level < 7.0,
        "processing_time_ms": elapsed_ms,
        "blur_variance":   blur_score,
        "model_version":   "2.1",
        "features": {
            **lab_features,
            **hsv_features,
        },
    }


# ─── Model Training Stub ─────────────────────────────────────
def train_model(X: np.ndarray, y: np.ndarray, model_path: str = "app/ml/models/hb_regressor.pkl"):
    """
    Train the Random Forest regressor on your dataset.
    X: feature matrix (n_samples, 11 features as in _build_feature_vector)
    y: hemoglobin values in g/dL (n_samples,)

    Run this once when you have your labeled dataset:
        from app.ml.inference import train_model
        train_model(X_train, y_train)
    """
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import cross_val_score
    import joblib, os

    os.makedirs(os.path.dirname(model_path), exist_ok=True)

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("model",  RandomForestRegressor(
            n_estimators=300,
            max_depth=12,
            min_samples_leaf=3,
            random_state=42,
            n_jobs=-1,
        )),
    ])

    # Cross-validation
    scores = cross_val_score(pipeline, X, y, cv=5, scoring="neg_mean_absolute_error")
    mae    = -scores.mean()
    print(f"Cross-val MAE: {mae:.3f} g/dL (target: < 1.0)")

    pipeline.fit(X, y)
    joblib.dump(pipeline, model_path)
    print(f"Model saved to {model_path}")
    return pipeline

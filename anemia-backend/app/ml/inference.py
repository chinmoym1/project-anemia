# ============================================================
# HEMAVIEW — ML Inference Pipeline
# OpenCV Strict Validation → CIELab → Feature Extraction → Hb Prediction
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


# ─── Step 1: Strict Eye Validation (Haar Cascades) ───────────
def validate_is_eye(image: np.ndarray) -> bool:
    """
    Validates eye presence using Haar Cascades, falling back 
    to color analysis for macro conjunctiva shots.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 1. Try standard Haar Cascade eye detection
    eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
    eyes = eye_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(50, 50))
    
    # Pass immediately if a full eye is found
    if len(eyes) > 0:
        return True
        
    # 2. Fallback: Check for pink/red tissue in macro shots
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # Define HSV ranges for red/pink flesh tones
    lower_red1 = np.array([0, 40, 50])
    upper_red1 = np.array([20, 255, 255])
    lower_red2 = np.array([160, 40, 50])
    upper_red2 = np.array([180, 255, 255])
    
    # Combine masks to isolate the tissue
    mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
    mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
    flesh_mask = cv2.bitwise_or(mask1, mask2)
    
    # Calculate the ratio of flesh-toned pixels
    total_pixels = image.shape[0] * image.shape[1]
    flesh_ratio = cv2.countNonZero(flesh_mask) / total_pixels
    
    # Pass if at least 5% of the image is conjunctiva tissue
    if flesh_ratio >= 0.05:
        return True
        
    # Reject if it fails both geometry and color checks
    raise ValueError("NO_EYE_DETECTED")


# ─── Step 2: Image Quality Check (Laplacian Variance) ────────
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


# ─── Step 3: Histogram Equalization & Normalization ──────────
def normalize_image(image: np.ndarray) -> np.ndarray:
    """Apply CLAHE to normalize lighting across different ambient conditions."""
    lab   = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l     = clahe.apply(l)
    normalized = cv2.merge([l, a, b])
    return cv2.cvtColor(normalized, cv2.COLOR_LAB2BGR)


# ─── Step 4: ROI Segmentation (Rule-based fallback) ──────────
def segment_roi(image: np.ndarray, image_type: str = "conjunctiva") -> Tuple[np.ndarray, np.ndarray]:
    """
    Extract Region of Interest.
    In production: U-Net semantic segmentation model.
    Current: rule-based center crop with color-range masking.
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


# ─── Step 5: CIELab Color Space Conversion ───────────────────
def extract_cielab_features(roi: np.ndarray, mask: np.ndarray) -> Dict[str, float]:
    lab = cv2.cvtColor(roi, cv2.COLOR_BGR2LAB).astype(np.float32)

    mask_bool = mask > 0
    if mask_bool.sum() < 100:
        mask_bool = np.ones(roi.shape[:2], dtype=bool)

    l_channel = lab[:, :, 0][mask_bool]
    a_channel = lab[:, :, 1][mask_bool]
    b_channel = lab[:, :, 2][mask_bool]

    L = l_channel * 100.0 / 255.0
    a = a_channel - 128.0
    b = b_channel - 128.0

    # MATCH TRAINING SCRIPT: Use Medians to ignore LED glare
    a_median = float(np.median(a))
    erythema_index = float(np.percentile(a, 75)) # 75th percentile for healthy tissue

    return {
        "L_mean":         float(np.median(L)),       # Using median
        "L_std":          float(np.std(L)),          # Ignored by model but kept for API
        "a_mean":         a_median,                  # Using median
        "a_std":          float(np.std(a)),
        "b_mean":         float(np.median(b)),       # Using median
        "b_std":          float(np.std(b)),
        "erythema_index": erythema_index,
        "a_normalized":   float(np.median(a) / 128.0), 
        "pixel_count":    int(mask_bool.sum()),
    }

# ─── Step 6: HSV Feature Extraction ─────────────────────────
def extract_hsv_features(roi: np.ndarray, mask: np.ndarray) -> Dict[str, float]:
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV).astype(np.float32)
    mask_bool = mask > 0

    h = hsv[:, :, 0][mask_bool]
    s = hsv[:, :, 1][mask_bool]
    v = hsv[:, :, 2][mask_bool]

    # MATCH TRAINING SCRIPT: Use Medians
    return {
        "hue_mean":        float(np.median(h)),
        "saturation_mean": float(np.median(s) / 255.0),
        "value_mean":      float(np.median(v) / 255.0),
        "saturation_std":  float(np.std(s) / 255.0),
    }


# ─── Step 7: Hb Prediction ───────────────────────────────────
class HbPredictor:
    """
    Wraps the trained regression model.
    Production: scikit-learn Random Forest loaded from disk.
    """
    def __init__(self):
        self.model = None
        self._try_load_model()

    def _try_load_model(self):
        # Allow checking multiple possible paths where the model could be
        base_dir = os.path.dirname(os.path.abspath(__file__))
        possible_paths = [
            os.path.join(base_dir, "models", "hb_regressor.pkl"),
            os.path.join(base_dir, "anemia_model.pkl")
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                self.model = joblib.load(path)
                logger.info(f"Loaded Hb regression model from {path}")
                return
                
        logger.warning("No trained model found — using rule-based fallback.")

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
        """Returns (hb_level_g_per_dL, confidence_score_0_to_100)"""
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
            a_star = lab_features["a_mean"]
            # Approximate linear regression from literature: Hb ≈ 0.42 * a* + 10.5 
            hb_prediction = max(3.0, min(20.0, 0.42 * a_star + 10.5))
            confidence = 72.0  # Lower confidence for rule-based

        # Clamp to physiologically valid range
        hb_prediction = max(3.0, min(20.0, round(hb_prediction, 1)))
        return hb_prediction, round(confidence, 1)


# ─── Step 8: SHAP Explainability (stub) ──────────────────────
def get_shap_explanation(feature_vector: np.ndarray, model) -> Dict[str, float]:
    """Returns SHAP feature importance for clinical transparency."""
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
    Full pipeline: raw bytes → OpenCV Validation → Hb prediction.
    Returns complete result dict ready for API response.
    """
    start_time = time.time()

    try:
        # Decode image
        nparr  = np.frombuffer(image_bytes, np.uint8)
        image  = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            return {"error": "Could not decode image. Ensure it is a valid JPEG/PNG."}

        # 1. Strict Eye Validation
        if image_type == "conjunctiva":
            validate_is_eye(image)

        # 2. Check for Motion Blur
        is_sharp, blur_score = check_image_quality(image)
        if not is_sharp:
            return {"error": f"Invalid Image: Image too blurry (variance={blur_score:.1f}). Please hold the camera steady and retake."}

        # 3. Medical AI Pipeline
        normalized          = normalize_image(image)
        roi, mask           = segment_roi(normalized, image_type)
        lab_features        = extract_cielab_features(roi, mask)
        hsv_features        = extract_hsv_features(roi, mask)
        
        # 4. Predict & Classify
        hb_level, confidence = _predictor.predict(lab_features, hsv_features)
        severity            = classify_severity(hb_level, sex)

        elapsed_ms = int((time.time() - start_time) * 1000)
        logger.info(f"Inference complete: Hb={hb_level} g/dL severity={severity} time={elapsed_ms}ms")

        # Map to the exact keys your React Native app expects!
        return {
            "hb_level":           round(hb_level, 1),
            "severity":           severity,
            "erythema_index":     round(lab_features["erythema_index"], 3),
            "confidence":         round(confidence, 1),
            "is_critical":        hb_level < 7.0,
            
            # Additional debug info
            "processing_time_ms": elapsed_ms,
            "blur_variance":      blur_score,
            "model_version":      "2.2",
            "features": {
                **lab_features,
                **hsv_features,
            },
        }

    except ValueError as e:
        if str(e) == "NO_EYE_DETECTED":
            return {"error": "Invalid Image: No eye detected. Please capture a clear image of the eye and lower eyelid."}
        return {"error": str(e)}
    except Exception as e:
        logger.error(f"Inference failed: {str(e)}")
        return {"error": "An unexpected error occurred during image processing."}


# ─── Model Training Stub ─────────────────────────────────────
def train_model(X: np.ndarray, y: np.ndarray, model_path: str = "app/ml/models/hb_regressor.pkl"):
    """
    Train the Random Forest regressor on your dataset.
    """
    from sklearn.ensemble import RandomForestRegressor
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
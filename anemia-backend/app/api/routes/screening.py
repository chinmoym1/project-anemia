# ============================================================
# HEMAVIEW — Screening & ML Inference Routes
# Image upload → PII strip → AI inference → Result storage
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import os, uuid, time, logging

from app.db.database import get_db
from app.models import HealthcareProvider, Patient, ScreeningSession, ImageAsset, DiagnosticResult
from app.core.security import get_current_provider, encrypt_data
from app.core.config import settings
from app.ml.inference import run_inference

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/dng", "image/tiff", "image/webp"}
MAX_IMAGE_BYTES = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024  # bytes


# ─── Helpers ─────────────────────────────────────────────────
def strip_exif_pii(image_bytes: bytes) -> bytes:
    """
    Strip ALL EXIF metadata (GPS, device serial, timestamps) from image.
    This is the PII anonymization step required by DISHA.
    """
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes))
        # Create fresh image without EXIF
        clean_img = Image.new(img.mode, img.size)
        clean_img.putdata(list(img.getdata()))
        buffer = io.BytesIO()
        clean_img.save(buffer, format="JPEG", quality=95)
        return buffer.getvalue()
    except Exception as e:
        logger.warning(f"EXIF strip failed: {e} — proceeding with caution")
        return image_bytes


# ─── Analyze Endpoint ────────────────────────────────────────
@router.post("/analyze")
async def analyze_image(
    image:        UploadFile = File(...),
    patient_id:   int        = Form(...),
    image_type:   str        = Form("conjunctiva"),
    device_model: str        = Form("unknown"),
    ambient_lux:  float      = Form(0.0),
    provider:     HealthcareProvider = Depends(get_current_provider),
    db:           Session    = Depends(get_db),
):
    """
    Main inference endpoint:
    1. Validate image
    2. Strip PII/EXIF
    3. Run ML inference pipeline
    4. Store session + result in DB
    5. Return prediction
    """
    # ── Validate image type ──────────────────────────────────
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid image type: {image.content_type}. Use JPEG or PNG.")

    # ── Read & size-check ────────────────────────────────────
    image_bytes = await image.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail=f"Image too large. Max {settings.MAX_IMAGE_SIZE_MB}MB.")
    if len(image_bytes) < 1024:
        raise HTTPException(status_code=400, detail="Image too small — likely corrupted.")

    # ── Verify patient belongs to this provider ───────────────
    patient = db.query(Patient).filter(
        Patient.patient_id == patient_id,
        Patient.provider_id == provider.provider_id,
        Patient.is_active == True,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found or unauthorized.")

    # ── Strip PII from image (DISHA compliance) ───────────────
    clean_image_bytes = strip_exif_pii(image_bytes)

    # ─── Run ML inference pipeline ────────────────────────────
    try:
        inference_result = run_inference(
            image_bytes=clean_image_bytes,
            image_type=image_type,
            sex=patient.biological_sex,
        )
        
        if "error" in inference_result:
            raise HTTPException(status_code=400, detail=inference_result["error"])
            
    except HTTPException:
        raise  # Lets the 400 error pass cleanly to your mobile app
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        logger.exception(f"Inference failed: {e}")
        raise HTTPException(status_code=500, detail="AI inference failed. Please try again.")

    # ── Save to database ─────────────────────────────────────
    # 1. Create screening session
    session = ScreeningSession(
        patient_id        = patient_id,
        provider_id       = provider.provider_id,
        ambient_lux_value = ambient_lux,
        device_model      = device_model[:200],
        image_type        = image_type,
    )
    db.add(session)
    db.flush()  # Get session_id

    # 2. Save image reference (encrypted) — never store raw image in DB
    file_ref    = f"local://uploads/{session.session_id}_{uuid.uuid4().hex}.jpg"
    enc_uri     = encrypt_data(file_ref)
    key_ref_id  = f"key_{session.session_id}"

    image_asset = ImageAsset(
        session_id             = session.session_id,
        storage_uri_encrypted  = enc_uri,
        file_size_bytes        = len(clean_image_bytes),
        encryption_key_ref     = key_ref_id,
        blur_variance_score    = inference_result.get("blur_variance"),
        is_anonymized          = True,
    )
    db.add(image_asset)

    # 3. Save diagnostic result
    hb            = inference_result["hb_level"]
    is_critical   = hb < 7.0

    result = DiagnosticResult(
        session_id              = session.session_id,
        estimated_hb_level      = hb,
        severity_classification = inference_result["severity"],
        confidence_score        = inference_result["confidence"],
        erythema_index          = inference_result.get("erythema_index"),
        model_version           = inference_result.get("model_version", "2.1"),
        processing_time_ms      = inference_result.get("processing_time_ms"),
        is_critical             = is_critical,
    )
    db.add(result)
    db.commit()

    logger.info(f"Screening complete: session={session.session_id} Hb={hb} severity={inference_result['severity']} critical={is_critical}")

    return {
        "session_id":   session.session_id,
        "patient_id":   patient_id,
        "hb_level":     hb,
        "severity":     inference_result["severity"],
        "confidence":   inference_result["confidence"],
        "is_critical":  is_critical,
        "image_type":   image_type,
        "timestamp":    session.timestamp.isoformat() if session.timestamp else None,
        "processing_time_ms": inference_result.get("processing_time_ms"),
        "model_version": inference_result.get("model_version"),
        "erythema_index": inference_result.get("erythema_index"),
    }


# ─── Get Result ──────────────────────────────────────────────
@router.get("/results/{session_id}")
async def get_result(
    session_id: int,
    provider:   HealthcareProvider = Depends(get_current_provider),
    db:         Session = Depends(get_db),
):
    session = db.query(ScreeningSession).filter(
        ScreeningSession.session_id == session_id,
        ScreeningSession.provider_id == provider.provider_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    result = session.diagnostic_result
    if not result:
        raise HTTPException(status_code=404, detail="Result not yet available.")

    return {
        "session_id":    session_id,
        "patient_id":    session.patient_id,
        "hb_level":      result.estimated_hb_level,
        "severity":      result.severity_classification,
        "confidence":    result.confidence_score,
        "is_critical":   result.is_critical,
        "timestamp":     session.timestamp.isoformat(),
        "model_version": result.model_version,
    }


# ─── Recent Results ──────────────────────────────────────────
@router.get("/recent")
async def get_recent_results(
    limit:    int = 10,
    provider: HealthcareProvider = Depends(get_current_provider),
    db:       Session = Depends(get_db),
):
    sessions = (
        db.query(ScreeningSession)
        .filter(ScreeningSession.provider_id == provider.provider_id)
        .order_by(ScreeningSession.timestamp.desc())
        .limit(min(limit, 50))
        .all()
    )

    results = []
    for s in sessions:
        r = s.diagnostic_result
        if r:
            results.append({
                "session_id": s.session_id,
                "patient_id": s.patient_id,
                "hb_level":   r.estimated_hb_level,
                "severity":   r.severity_classification,
                "timestamp":  s.timestamp.isoformat(),
                "is_critical": r.is_critical,
            })
    return {"items": results, "count": len(results)}

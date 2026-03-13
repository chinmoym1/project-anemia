# ============================================================
# HEMAVIEW — Patient API Routes
# Full CRUD with provider-scoped access control
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.db.database import get_db
from app.models import Patient, ScreeningSession, DiagnosticResult, HealthcareProvider
from app.core.security import get_current_provider, hash_pii

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────
class PatientCreate(BaseModel):
    full_name:         str  = Field(..., min_length=2, max_length=200)
    age:               int  = Field(..., ge=0, le=120)
    biological_sex:    str  = Field(..., pattern="^(Male|Female|Other)$")
    baseline_skin_tone: Optional[str] = Field(None, max_length=50)
    phone:             Optional[str]  = Field(None, max_length=20)   # Will be hashed
    notes:             Optional[str]  = Field(None, max_length=1000)

class PatientUpdate(BaseModel):
    full_name:         Optional[str] = Field(None, min_length=2, max_length=200)
    age:               Optional[int] = Field(None, ge=0, le=120)
    baseline_skin_tone: Optional[str] = None
    notes:             Optional[str]  = None

class PatientOut(BaseModel):
    patient_id:        int
    full_name:         str
    age:               int
    biological_sex:    str
    baseline_skin_tone: Optional[str]
    notes:             Optional[str]
    created_at:        Optional[datetime]
    last_hb_level:     Optional[float]    = None
    last_severity:     Optional[str]      = None

    class Config:
        from_attributes = True


# ─── Helpers ─────────────────────────────────────────────────
def _get_patient_or_404(patient_id: int, provider_id: int, db: Session) -> Patient:
    p = db.query(Patient).filter(
        Patient.patient_id == patient_id,
        Patient.provider_id == provider_id,
        Patient.is_active == True,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return p

def _enrich_patient(patient: Patient, db: Session) -> dict:
    """Add last screening result to patient dict."""
    last_session = (
        db.query(ScreeningSession)
        .filter(ScreeningSession.patient_id == patient.patient_id)
        .order_by(ScreeningSession.timestamp.desc())
        .first()
    )
    last_hb = last_severity = None
    if last_session and last_session.diagnostic_result:
        last_hb       = last_session.diagnostic_result.estimated_hb_level
        last_severity = last_session.diagnostic_result.severity_classification

    return {
        "patient_id":        patient.patient_id,
        "full_name":         patient.full_name,
        "age":               patient.age,
        "biological_sex":    patient.biological_sex,
        "baseline_skin_tone": patient.baseline_skin_tone,
        "notes":             patient.notes,
        "created_at":        patient.created_at.isoformat() if patient.created_at else None,
        "last_hb_level":     last_hb,
        "last_severity":     last_severity,
    }


# ─── Create Patient ───────────────────────────────────────────
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload:  PatientCreate,
    provider: HealthcareProvider = Depends(get_current_provider),
    db:       Session = Depends(get_db),
):
    patient = Patient(
        provider_id        = provider.provider_id,
        full_name          = payload.full_name.strip(),
        age                = payload.age,
        biological_sex     = payload.biological_sex,
        baseline_skin_tone = payload.baseline_skin_tone,
        phone_hash         = hash_pii(payload.phone) if payload.phone else None,
        notes              = payload.notes,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return {"message": "Patient created.", "patient_id": patient.patient_id}


# ─── List Patients ────────────────────────────────────────────
@router.get("")
async def list_patients(
    page:     int = Query(1, ge=1),
    limit:    int = Query(20, ge=1, le=100),
    search:   str = Query("", max_length=100),
    provider: HealthcareProvider = Depends(get_current_provider),
    db:       Session = Depends(get_db),
):
    query = db.query(Patient).filter(
        Patient.provider_id == provider.provider_id,
        Patient.is_active == True,
    )

    if search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Patient.full_name.ilike(term),
                Patient.patient_id.cast(str).like(term),
            )
        )

    total  = query.count()
    offset = (page - 1) * limit
    items  = query.order_by(Patient.created_at.desc()).offset(offset).limit(limit).all()

    enriched = [_enrich_patient(p, db) for p in items]

    return {
        "items":       enriched,
        "total":       total,
        "page":        page,
        "total_pages": (total + limit - 1) // limit,
    }


# ─── Get Patient ─────────────────────────────────────────────
@router.get("/{patient_id}")
async def get_patient(
    patient_id: int,
    provider:   HealthcareProvider = Depends(get_current_provider),
    db:         Session = Depends(get_db),
):
    patient = _get_patient_or_404(patient_id, provider.provider_id, db)
    return _enrich_patient(patient, db)


# ─── Update Patient ───────────────────────────────────────────
@router.patch("/{patient_id}")
async def update_patient(
    patient_id: int,
    payload:    PatientUpdate,
    provider:   HealthcareProvider = Depends(get_current_provider),
    db:         Session = Depends(get_db),
):
    patient = _get_patient_or_404(patient_id, provider.provider_id, db)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(patient, field, value)
    db.commit()
    return {"message": "Patient updated."}


# ─── Delete Patient (Soft Delete) ────────────────────────────
@router.delete("/{patient_id}")
async def delete_patient(
    patient_id: int,
    provider:   HealthcareProvider = Depends(get_current_provider),
    db:         Session = Depends(get_db),
):
    patient = _get_patient_or_404(patient_id, provider.provider_id, db)
    patient.is_active = False  # Soft delete — never hard-delete medical records
    db.commit()
    return {"message": "Patient record deactivated."}


# ─── Get Patient Screening History ────────────────────────────
@router.get("/{patient_id}/history")
async def get_patient_history(
    patient_id: int,
    provider:   HealthcareProvider = Depends(get_current_provider),
    db:         Session = Depends(get_db),
):
    _get_patient_or_404(patient_id, provider.provider_id, db)

    sessions = (
        db.query(ScreeningSession)
        .filter(ScreeningSession.patient_id == patient_id)
        .order_by(ScreeningSession.timestamp.desc())
        .all()
    )

    history = []
    for s in sessions:
        r = s.diagnostic_result
        history.append({
            "session_id":  s.session_id,
            "timestamp":   s.timestamp.isoformat() if s.timestamp else None,
            "image_type":  s.image_type,
            "hb_level":    r.estimated_hb_level if r else None,
            "severity":    r.severity_classification if r else None,
            "confidence":  r.confidence_score if r else None,
            "is_critical": r.is_critical if r else None,
        })

    return {"patient_id": patient_id, "history": history, "total_screenings": len(history)}

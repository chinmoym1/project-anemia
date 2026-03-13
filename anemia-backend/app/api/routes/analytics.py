# ============================================================
# HEMAVIEW — Analytics Routes
# ============================================================

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.models import Patient, ScreeningSession, DiagnosticResult, HealthcareProvider
from app.core.security import get_current_provider

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard_stats(
    provider: HealthcareProvider = Depends(get_current_provider),
    db:       Session = Depends(get_db),
):
    from datetime import date, datetime, timezone
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_patients = db.query(Patient).filter(
        Patient.provider_id == provider.provider_id,
        Patient.is_active == True,
    ).count()

    screenings_today = db.query(ScreeningSession).filter(
        ScreeningSession.provider_id == provider.provider_id,
        ScreeningSession.timestamp >= today_start,
    ).count()

    # Severity breakdown
    all_results = (
        db.query(DiagnosticResult)
        .join(ScreeningSession, ScreeningSession.session_id == DiagnosticResult.session_id)
        .filter(ScreeningSession.provider_id == provider.provider_id)
        .all()
    )
    total_results = len(all_results)
    severe_cases  = sum(1 for r in all_results if r.severity_classification == "severe")
    normal_pct    = round(sum(1 for r in all_results if r.severity_classification == "normal") / max(total_results, 1) * 100)

    return {
        "total_patients":    total_patients,
        "screenings_today":  screenings_today,
        "severe_cases":      severe_cases,
        "normal_cases":      normal_pct,
        "total_screenings":  total_results,
    }


@router.get("/patient/{patient_id}/trend")
async def get_patient_trend(
    patient_id: int,
    days:       int = 30,
    provider:   HealthcareProvider = Depends(get_current_provider),
    db:         Session = Depends(get_db),
):
    sessions = (
        db.query(ScreeningSession)
        .filter(
            ScreeningSession.patient_id == patient_id,
            ScreeningSession.provider_id == provider.provider_id,
        )
        .order_by(ScreeningSession.timestamp.asc())
        .all()
    )

    trend = []
    for s in sessions:
        r = s.diagnostic_result
        if r:
            trend.append({
                "timestamp": s.timestamp.isoformat() if s.timestamp else None,
                "hb_level":  r.estimated_hb_level,
                "severity":  r.severity_classification,
            })

    return {"patient_id": patient_id, "trend": trend}

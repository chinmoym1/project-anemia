# ============================================================
# HEMAVIEW — Reports API Route
# Dynamic PDF clinical report generation using ReportLab
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from datetime import datetime
import io, logging

from app.db.database import get_db
from app.models import ScreeningSession, HealthcareProvider
from app.core.security import get_current_provider

router = APIRouter()
logger = logging.getLogger(__name__)

WHO_RANGES = {
    "Female": {"severe": 8.0, "moderate": 10.0, "mild": 12.0, "normal_min": 12.0},
    "Male":   {"severe": 8.0, "moderate": 10.0, "mild": 13.0, "normal_min": 13.0},
    "Other":  {"severe": 8.0, "moderate": 10.0, "mild": 12.0, "normal_min": 12.0},
}

SEVERITY_ADVICE = {
    "normal":   "Hemoglobin is within the healthy range. Continue routine monitoring every 3 months. Maintain iron-rich diet.",
    "mild":     "Mild anemia detected. Recommend dietary iron supplementation (e.g., green leafy vegetables, lentils, fortified cereals). Follow up in 4 weeks.",
    "moderate": "Moderate anemia requires immediate intervention. Prescribe oral iron therapy (e.g., ferrous sulfate 200mg TDS). Refer to physician. Recheck CBC in 2 weeks.",
    "severe":   "CRITICAL: Severe anemia detected. Immediate hospitalization may be required. Assess for need of blood transfusion. Urgent physician referral mandatory.",
}


def generate_pdf_report(session: ScreeningSession, provider: HealthcareProvider) -> bytes:
    """Generate a structured clinical PDF using ReportLab."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

        buffer  = io.BytesIO()
        doc     = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm, leftMargin=2*cm,
            topMargin=2*cm,   bottomMargin=2*cm,
        )

        patient = session.patient
        result  = session.diagnostic_result
        sex     = patient.biological_sex if patient else "Female"
        hb      = result.estimated_hb_level if result else 0
        severity = result.severity_classification if result else "unknown"
        confidence = result.confidence_score if result else 0

        # ── Colors ──────────────────────────────────────────
        teal     = colors.HexColor("#2E9FA0")
        dark     = colors.HexColor("#141C20")
        red      = colors.HexColor("#E63946")
        severity_color_map = {
            "normal":   colors.HexColor("#2E7D32"),
            "mild":     colors.HexColor("#F57F17"),
            "moderate": colors.HexColor("#E65100"),
            "severe":   colors.HexColor("#B71C1C"),
        }
        sev_color = severity_color_map.get(severity, dark)

        styles  = getSampleStyleSheet()
        story   = []

        # ── Header ──────────────────────────────────────────
        header_style = ParagraphStyle("header", parent=styles["Normal"],
            fontSize=22, textColor=teal, fontName="Helvetica-Bold",
            spaceAfter=4, alignment=TA_CENTER)
        sub_style = ParagraphStyle("sub", parent=styles["Normal"],
            fontSize=10, textColor=colors.HexColor("#506070"),
            alignment=TA_CENTER, spaceAfter=2)
        body_style = ParagraphStyle("body", parent=styles["Normal"],
            fontSize=10, textColor=dark, leading=14)
        label_style = ParagraphStyle("label", parent=styles["Normal"],
            fontSize=9, textColor=colors.HexColor("#506070"), fontName="Helvetica-Bold")

        story.append(Paragraph("🩸 HemaView", header_style))
        story.append(Paragraph("Non-Invasive Anemia Screening Report", sub_style))
        story.append(Paragraph("DISHA Compliant | AES-256 Encrypted | AI-Assisted Screening", sub_style))
        story.append(HRFlowable(width="100%", thickness=2, color=teal, spaceAfter=12))

        # ── Patient Info Table ───────────────────────────────
        pt_name = patient.full_name if patient else "N/A"
        pt_age  = f"{patient.age} years" if patient else "N/A"
        pt_sex  = sex
        pt_id   = f"#{patient.patient_id:04d}" if patient else "N/A"

        info_data = [
            ["Patient Name", pt_name, "Patient ID", pt_id],
            ["Age",          pt_age,  "Biological Sex", pt_sex],
            ["Provider",     provider.full_name, "Facility", provider.facility_location or "N/A"],
            ["Scan Type",    session.image_type.capitalize(), "Session ID", f"#{session.session_id}"],
            ["Date & Time",  session.timestamp.strftime("%d %b %Y %H:%M UTC") if session.timestamp else "N/A", "", ""],
        ]

        info_table = Table(info_data, colWidths=[4*cm, 6.5*cm, 4*cm, 6.5*cm])
        info_table.setStyle(TableStyle([
            ("FONTNAME",  (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE",  (0, 0), (-1, -1), 9),
            ("FONTNAME",  (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME",  (2, 0), (2, -1), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#506070")),
            ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#506070")),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#F8FAFB"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDE3E8")),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 16))

        # ── Result Banner ────────────────────────────────────
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#DDE3E8"), spaceBefore=4, spaceAfter=12))
        result_style = ParagraphStyle("result", parent=styles["Normal"],
            fontSize=28, fontName="Helvetica-Bold",
            textColor=sev_color, alignment=TA_CENTER, spaceAfter=4)
        sev_label_style = ParagraphStyle("sevlabel", parent=styles["Normal"],
            fontSize=16, fontName="Helvetica-Bold",
            textColor=sev_color, alignment=TA_CENTER, spaceAfter=12)

        story.append(Paragraph(f"{hb:.1f} g/dL", result_style))
        story.append(Paragraph(f"Hemoglobin Level — {severity.upper()} ANEMIA" if severity != "normal" else "Hemoglobin Level — NORMAL", sev_label_style))
        story.append(Paragraph(f"AI Confidence Score: {confidence:.1f}%", sub_style))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#DDE3E8"), spaceBefore=4, spaceAfter=12))

        # ── WHO Reference Table ──────────────────────────────
        story.append(Paragraph("WHO Reference Ranges", ParagraphStyle("sect", parent=styles["Normal"],
            fontSize=12, fontName="Helvetica-Bold", textColor=dark, spaceAfter=8)))

        who = WHO_RANGES.get(sex, WHO_RANGES["Female"])
        ref_data = [
            ["Classification", "Hemoglobin Range", "Status"],
            ["Normal",   f"≥ {who['normal_min']:.1f} g/dL",   "✓" if severity == "normal"   else ""],
            ["Mild",     f"10.0 – {who['mild']:.1f} g/dL",    "←" if severity == "mild"     else ""],
            ["Moderate", "8.0 – 9.9 g/dL",                    "←" if severity == "moderate" else ""],
            ["Severe",   "< 8.0 g/dL",                        "←" if severity == "severe"   else ""],
        ]

        ref_table = Table(ref_data, colWidths=[6*cm, 7*cm, 8*cm])
        ref_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), teal),
            ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
            ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",   (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F8FAFB"), colors.white]),
            ("GRID",  (0, 0), (-1, -1), 0.5, colors.HexColor("#DDE3E8")),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("PADDING", (0, 0), (-1, -1), 7),
        ]))
        story.append(ref_table)
        story.append(Spacer(1, 16))

        # ── Clinical Recommendation ──────────────────────────
        story.append(Paragraph("Clinical Recommendation", ParagraphStyle("sect", parent=styles["Normal"],
            fontSize=12, fontName="Helvetica-Bold", textColor=dark, spaceAfter=8)))

        advice_bg = colors.HexColor("#FFF8E1") if severity in ["mild", "moderate"] else \
                    colors.HexColor("#FFEBEE") if severity == "severe" else colors.HexColor("#E8F5E9")

        advice_data = [[Paragraph(SEVERITY_ADVICE.get(severity, "No recommendation available."), body_style)]]
        advice_table = Table(advice_data, colWidths=[17*cm])
        advice_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), advice_bg),
            ("BOX",        (0, 0), (-1, -1), 1.5, sev_color),
            ("PADDING",    (0, 0), (-1, -1), 10),
        ]))
        story.append(advice_table)
        story.append(Spacer(1, 16))

        # ── Technical Details ────────────────────────────────
        story.append(Paragraph("Technical & Security Details", ParagraphStyle("sect", parent=styles["Normal"],
            fontSize=12, fontName="Helvetica-Bold", textColor=dark, spaceAfter=8)))

        tech_data = [
            ["AI Model",        "HemaNet v2.1 (U-Net Segmentation + Random Forest Regressor)"],
            ["Color Analysis",  "CIELab color space — Erythema Index extraction"],
            ["Encryption",      "AES-256 (data at rest) · TLS 1.3 (data in transit)"],
            ["Data Compliance", "DISHA compliant · PII stripped before processing · HIPAA aligned"],
            ["Processing Time", f"{result.processing_time_ms} ms" if result and result.processing_time_ms else "N/A"],
        ]
        tech_table = Table(tech_data, colWidths=[4.5*cm, 12.5*cm])
        tech_table.setStyle(TableStyle([
            ("FONTNAME",  (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE",  (0, 0), (-1, -1), 8),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#506070")),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#F8FAFB"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDE3E8")),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(tech_table)
        story.append(Spacer(1, 20))

        # ── Disclaimer ───────────────────────────────────────
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#DDE3E8"), spaceAfter=8))
        disc_style = ParagraphStyle("disc", parent=styles["Normal"],
            fontSize=7.5, textColor=colors.HexColor("#9AAAB6"),
            leading=11, alignment=TA_LEFT)
        story.append(Paragraph(
            "⚕️ DISCLAIMER: This report is generated by an AI-assisted screening tool (HemaView) and is intended solely for "
            "preliminary non-diagnostic assessment purposes. It does NOT constitute a formal clinical diagnosis. All results "
            "MUST be confirmed by a certified pathologist using the Complete Blood Count (CBC) gold standard test before any "
            "medical treatment is initiated. HemaView is not a substitute for professional medical judgment.",
            disc_style
        ))
        story.append(Spacer(1, 6))
        story.append(Paragraph(
            f"Report generated: {datetime.utcnow().strftime('%d %b %Y %H:%M UTC')} | "
            f"HemaView v{1}.0 | Session #{session.session_id}",
            disc_style
        ))

        doc.build(story)
        return buffer.getvalue()

    except ImportError:
        # Fallback plain text if reportlab not installed
        logger.warning("ReportLab not installed — returning plain text report")
        content = (
            f"HEMAVIEW CLINICAL REPORT\n"
            f"========================\n"
            f"Patient: {session.patient.full_name if session.patient else 'N/A'}\n"
            f"Hb Level: {result.estimated_hb_level if result else 'N/A'} g/dL\n"
            f"Severity: {result.severity_classification if result else 'N/A'}\n"
            f"Date: {datetime.utcnow().isoformat()}\n"
        )
        return content.encode()


# ─── Report Endpoints ─────────────────────────────────────────
@router.get("/{session_id}/pdf")
async def download_pdf_report(
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
    if not session.diagnostic_result:
        raise HTTPException(status_code=404, detail="No result available for this session.")

    pdf_bytes = generate_pdf_report(session, provider)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="hemaview_report_{session_id}.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        }
    )


@router.get("/{session_id}")
async def get_report_metadata(
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

    r = session.diagnostic_result
    return {
        "session_id":   session_id,
        "patient_id":   session.patient_id,
        "hb_level":     r.estimated_hb_level if r else None,
        "severity":     r.severity_classification if r else None,
        "confidence":   r.confidence_score if r else None,
        "timestamp":    session.timestamp.isoformat() if session.timestamp else None,
        "pdf_url":      f"/api/v1/reports/{session_id}/pdf",
    }

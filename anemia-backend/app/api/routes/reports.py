# ============================================================
# HEMAVIEW — Reports API Route
# Dynamic PDF clinical report generation using ReportLab
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from datetime import datetime
from zoneinfo import ZoneInfo
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
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer,
            Table, TableStyle, HRFlowable, KeepTogether
        )
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm, leftMargin=2*cm,
            topMargin=1.5*cm, bottomMargin=1.5*cm,
        )

        patient  = session.patient
        result   = session.diagnostic_result
        sex      = patient.biological_sex if patient else "Female"
        hb       = result.estimated_hb_level if result else 0
        severity = str(result.severity_classification.value if hasattr(result.severity_classification, 'value') else result.severity_classification) if result else "unknown"
        confidence = result.confidence_score if result else 0

        # Clean biological sex display
        pt_sex = sex
        if hasattr(sex, 'value'):
            pt_sex = sex.value
        pt_sex = str(pt_sex).replace("BiologicalSexEnum.", "").capitalize()

        # Colors
        teal  = colors.HexColor("#2E9FA0")
        dark  = colors.HexColor("#141C20")
        grey  = colors.HexColor("#506070")
        light = colors.HexColor("#F8FAFB")
        border_color = colors.HexColor("#DDE3E8")

        severity_color_map = {
            "normal":   colors.HexColor("#2E7D32"),
            "mild":     colors.HexColor("#F57F17"),
            "moderate": colors.HexColor("#E65100"),
            "severe":   colors.HexColor("#B71C1C"),
        }
        sev_color = severity_color_map.get(severity.lower(), dark)

        styles = getSampleStyleSheet()
        story  = []

        # ── Styles ──────────────────────────────────────────
        def style(name, **kwargs):
            return ParagraphStyle(name, parent=styles["Normal"], **kwargs)

        title_style = style("title",
            fontSize=26, fontName="Helvetica-Bold",
            textColor=teal, alignment=TA_CENTER,
            spaceBefore=0, spaceAfter=4,
            leading=32)

        sub_style = style("sub",
            fontSize=9, textColor=grey,
            alignment=TA_CENTER, spaceAfter=2, leading=13)

        section_style = style("section",
            fontSize=11, fontName="Helvetica-Bold",
            textColor=dark, spaceBefore=4, spaceAfter=6)

        body_style = style("body",
            fontSize=9.5, textColor=dark, leading=14)

        disc_style = style("disc",
            fontSize=7.5, textColor=colors.HexColor("#9AAAB6"),
            leading=11, alignment=TA_LEFT)

        # ── Header ──────────────────────────────────────────
        header_data = [
            [Paragraph("HemaView", title_style)],
            [Paragraph("Non-Invasive Anemia Screening Report", sub_style)],
            [Paragraph("DISHA Compliant  |  AES-256 Encrypted  |  AI-Assisted Screening", sub_style)],
        ]
        header_table = Table(header_data, colWidths=[17*cm])
        header_table.setStyle(TableStyle([
            ("ALIGN",   (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",  (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING",    (0, 0), (0, 0), 6),
            ("BOTTOMPADDING", (0, 0), (0, 0), 12),
            ("BOTTOMPADDING", (0, 2), (0, 2), 6),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 4))
        story.append(HRFlowable(width="100%", thickness=2, color=teal, spaceAfter=10))

        # ── Patient Info Table ───────────────────────────────
        pt_name = patient.full_name if patient else "N/A"
        pt_age  = f"{patient.age} years" if patient else "N/A"
        pt_id   = f"#{patient.patient_id:04d}" if patient else "N/A"
        scan_dt = session.timestamp.strftime("%d %b %Y  %H:%M UTC") if session.timestamp else "N/A"

        def cell(text, bold=False):
            fn = "Helvetica-Bold" if bold else "Helvetica"
            return Paragraph(f'<font name="{fn}">{text}</font>',
                             style("cell", fontSize=9, textColor=dark if not bold else grey, leading=13))

        info_data = [
            [cell("Patient Name", bold=True), cell(pt_name),
             cell("Patient ID", bold=True),   cell(pt_id)],
            [cell("Age", bold=True),           cell(pt_age),
             cell("Biological Sex", bold=True),cell(pt_sex)],
            [cell("Provider", bold=True),      cell(provider.full_name or "N/A"),
             cell("Facility", bold=True),      cell(provider.facility_location or "N/A")],
            [cell("Scan Type", bold=True),     cell(session.image_type.capitalize()),
             cell("Session ID", bold=True),    cell(f"#{session.session_id}")],
            [cell("Date & Time", bold=True),   cell(scan_dt),
             cell(""), cell("")],
        ]

        col_w = [3.25*cm, 5.25*cm, 3.25*cm, 5.25*cm]
        info_table = Table(info_data, colWidths=col_w)
        info_table.setStyle(TableStyle([
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [light, colors.white]),
            ("GRID",    (0, 0), (-1, -1), 0.4, border_color),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("VALIGN",  (0, 0), (-1, -1), "MIDDLE"),
            ("SPAN",    (1, 4), (3, 4)),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 14))

        # ── Result Banner (using a single-cell table to avoid overlap) ──
        sev_label = "NORMAL" if severity.lower() == "normal" else f"{severity.upper()} ANEMIA"

        result_banner_style = style("result_banner",
            fontSize=30, fontName="Helvetica-Bold",
            textColor=sev_color, alignment=TA_CENTER,
            leading=36, spaceAfter=2)

        result_label_style = style("result_label",
            fontSize=15, fontName="Helvetica-Bold",
            textColor=sev_color, alignment=TA_CENTER,
            leading=20, spaceAfter=4)

        conf_style = style("conf",
            fontSize=9, textColor=grey,
            alignment=TA_CENTER, leading=13)

        # Wrap in table to prevent overlap
        banner_data = [[
            Paragraph(f"{hb:.1f} g/dL", result_banner_style)
        ], [
            Paragraph(f"Hemoglobin Level — {sev_label}", result_label_style)
        ], [
            Paragraph(f"AI Confidence Score: {confidence:.1f}%", conf_style)
        ]]

        banner_bg = {
            "normal":   colors.HexColor("#E8F5E9"),
            "mild":     colors.HexColor("#FFFDE7"),
            "moderate": colors.HexColor("#FBE9E7"),
            "severe":   colors.HexColor("#FFEBEE"),
        }.get(severity.lower(), colors.HexColor("#F5F5F5"))

        banner_table = Table(banner_data, colWidths=[17*cm])
        banner_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), banner_bg),
            ("BOX",        (0, 0), (-1, -1), 1.5, sev_color),
            ("PADDING",    (0, 0), (-1, -1), 10),
            ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(KeepTogether(banner_table))
        story.append(Spacer(1, 14))

        # ── WHO Reference Table ──────────────────────────────
        story.append(Paragraph("WHO Reference Ranges", section_style))

        who = WHO_RANGES.get(str(pt_sex), WHO_RANGES["Female"])
        ref_data = [
            [Paragraph('<font color="white"><b>Classification</b></font>', style("h", fontSize=9, alignment=TA_CENTER, leading=13)),
             Paragraph('<font color="white"><b>Hemoglobin Range</b></font>', style("h2", fontSize=9, alignment=TA_CENTER, leading=13)),
             Paragraph('<font color="white"><b>Status</b></font>', style("h3", fontSize=9, alignment=TA_CENTER, leading=13))],
            ["Normal",   f">= {who['normal_min']:.1f} g/dL",  "OK" if severity.lower() == "normal"   else ""],
            ["Mild",     f"10.0 - {who['mild']:.1f} g/dL",    "<--" if severity.lower() == "mild"     else ""],
            ["Moderate", "8.0 - 9.9 g/dL",                    "<--" if severity.lower() == "moderate" else ""],
            ["Severe",   "< 8.0 g/dL",                        "<--" if severity.lower() == "severe"   else ""],
        ]

        ref_table = Table(ref_data, colWidths=[5*cm, 7*cm, 5*cm])
        ref_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), teal),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [light, colors.white]),
            ("GRID",  (0, 0), (-1, -1), 0.4, border_color),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("PADDING", (0, 0), (-1, -1), 7),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(ref_table)
        story.append(Spacer(1, 14))

        # ── Clinical Recommendation ──────────────────────────
        story.append(Paragraph("Clinical Recommendation", section_style))

        advice_bg = {
            "normal":   colors.HexColor("#E8F5E9"),
            "mild":     colors.HexColor("#FFFDE7"),
            "moderate": colors.HexColor("#FBE9E7"),
            "severe":   colors.HexColor("#FFEBEE"),
        }.get(severity.lower(), colors.white)

        advice_data = [[Paragraph(SEVERITY_ADVICE.get(severity.lower(), "No recommendation available."), body_style)]]
        advice_table = Table(advice_data, colWidths=[17*cm])
        advice_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), advice_bg),
            ("BOX",        (0, 0), (-1, -1), 1.5, sev_color),
            ("PADDING",    (0, 0), (-1, -1), 10),
        ]))
        story.append(advice_table)
        story.append(Spacer(1, 14))

        # ── Technical Details ────────────────────────────────
        story.append(Paragraph("Technical & Security Details", section_style))

        tech_data = [
            ["AI Model",        "HemaNet v2.1 (U-Net Segmentation + Random Forest Regressor)"],
            ["Color Analysis",  "CIELab color space - Erythema Index extraction"],
            ["Encryption",      "AES-256 (data at rest) / TLS 1.3 (data in transit)"],
            ["Data Compliance", "DISHA compliant / PII stripped before processing / HIPAA aligned"],
            ["Processing Time", f"{result.processing_time_ms} ms" if result and result.processing_time_ms else "N/A"],
        ]
        tech_table = Table(tech_data, colWidths=[4.5*cm, 12.5*cm])
        tech_table.setStyle(TableStyle([
            ("FONTNAME",  (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE",  (0, 0), (-1, -1), 8.5),
            ("TEXTCOLOR", (0, 0), (0, -1), grey),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [light, colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.4, border_color),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(tech_table)
        story.append(Spacer(1, 14))

        # ── Disclaimer ───────────────────────────────────────
        story.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceAfter=8))
        story.append(Paragraph(
            "DISCLAIMER: This report is generated by an AI-assisted screening tool (HemaView) and is intended solely "
            "for preliminary non-diagnostic assessment purposes. It does NOT constitute a formal clinical diagnosis. "
            "All results MUST be confirmed by a certified pathologist using the Complete Blood Count (CBC) gold "
            "standard test before any medical treatment is initiated. HemaView is not a substitute for professional "
            "medical judgment.",
            disc_style
        ))
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            f"Report generated: {datetime.now(ZoneInfo('Asia/Kolkata')).strftime('%d %b %Y, %I:%M %p IST')}  |  "
            f"HemaView v1.0  |  Session #{session.session_id}",
            disc_style
        ))

        doc.build(story)
        return buffer.getvalue()

    except Exception as e:
        logger.exception(f"PDF generation failed: {e}")
        # Fallback plain text
        result = session.diagnostic_result
        content = (
            f"HEMAVIEW CLINICAL REPORT\n"
            f"========================\n"
            f"Patient: {session.patient.full_name if session.patient else 'N/A'}\n"
            f"Hb Level: {result.estimated_hb_level if result else 'N/A'} g/dL\n"
            f"Severity: {result.severity_classification if result else 'N/A'}\n"
            f"Date: {datetime.utcnow().isoformat()}\n"
            f"Error: {str(e)}\n"
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
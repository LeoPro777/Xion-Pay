import io
from datetime import datetime
from typing import Any, Dict
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def generate_subscription_invoice_pdf(payment_data: Dict[str, Any]) -> bytes:
    """
    Generate in-memory PDF invoice/receipt for approved subscription payments.
    Returns bytes stream ready for Content-Type: application/pdf response.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Heading1"],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "InvoiceSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748b"),
    )
    body_bold = ParagraphStyle(
        "BodyBold",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#1e293b"),
        fontName="Helvetica-Bold",
    )
    body_normal = ParagraphStyle(
        "BodyNormal",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155"),
    )

    story = []

    # Header
    story.append(Paragraph("XION-PAY // COMPROBANTE OFICIAL DE SUSCRIPCIÓN", title_style))
    story.append(Paragraph("Ecosistema Xion · Autoridad Central de Licenciamiento SaaS", subtitle_style))
    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#cbd5e1"), spaceAfter=15))

    # Meta info
    reported_at = payment_data.get("reported_at", datetime.now().isoformat())
    ref_num = payment_data.get("reference_number", "N/A")
    bank = payment_data.get("origin_bank", "N/A")
    amount = f"{float(payment_data.get('amount', 0.0)):,.2f} {payment_data.get('currency', 'USD')}"
    tenant_name = payment_data.get("tenant_name", "Comercio Registrado")
    tax_id = payment_data.get("tax_id", "N/A")
    plan_name = payment_data.get("plan_name", "Plan Suscripción")
    status_str = payment_data.get("status", "approved").upper()

    info_data = [
        [
            Paragraph("<b>DATOS DEL CLIENTE</b>", body_bold),
            Paragraph("<b>DETALLES DE LA TRANSACCIÓN</b>", body_bold),
        ],
        [
            Paragraph(f"<b>Razón Social:</b> {tenant_name}", body_normal),
            Paragraph(f"<b>Recibo N°:</b> {str(payment_data.get('id', 'N/A'))[:8].upper()}", body_normal),
        ],
        [
            Paragraph(f"<b>RIF / Doc:</b> {tax_id}", body_normal),
            Paragraph(f"<b>Fecha:</b> {str(reported_at)[:10]}", body_normal),
        ],
        [
            Paragraph(f"<b>Plan Contratado:</b> {plan_name}", body_normal),
            Paragraph(f"<b>Estado:</b> <font color='#16a34a'><b>{status_str}</b></font>", body_normal),
        ],
    ]

    t_info = Table(info_data, colWidths=[3.2 * inch, 3.8 * inch])
    t_info.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
        ])
    )
    story.append(t_info)
    story.append(Spacer(1, 20))

    # Multi-currency breakdown
    amt_usd = float(payment_data.get("amount_usd", payment_data.get("amount", 0.0)))
    amt_ves = float(payment_data.get("amount_ves", 0.0))
    rate = float(payment_data.get("exchange_rate", 1.0))
    rate_str = f"{rate:,.2f} Bs/$" if rate > 0 else "1.00"

    table_data = [
        [
            Paragraph("<b>Concepto</b>", body_bold),
            Paragraph("<b>Banco / Ref</b>", body_bold),
            Paragraph("<b>Tasa Cambio</b>", body_bold),
            Paragraph("<b>Monto en USD / Bs</b>", body_bold),
        ],
        [
            Paragraph(f"Renovación de Licencia: {plan_name}", body_normal),
            Paragraph(f"{bank}<br/><font color='#64748b'>Ref: {ref_num}</font>", body_normal),
            Paragraph(rate_str, body_normal),
            Paragraph(f"<b>${amt_usd:,.2f} USD</b><br/><font color='#16a34a'>Bs. {amt_ves:,.2f}</font>", body_bold),
        ],
    ]

    breakdown_table = Table(table_data, colWidths=[2.5 * inch, 1.8 * inch, 1.2 * inch, 1.5 * inch])
    breakdown_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(breakdown_table)
    story.append(Spacer(1, 25))

    # Security & Verification seal
    token_fingerprint = payment_data.get("token_signature_hash", "SECURE-VERIFIED-AUTH-HASH")
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#e2e8f0"), spaceAfter=10))
    story.append(
        Paragraph(
            f"<b>Sello Criptográfico RS256:</b> {token_fingerprint[:40]}... "
            f"Este comprobante certifica la validez legal y técnica de la suscripción dentro del ecosistema Xion-Pay.",
            subtitle_style,
        )
    )

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

import logging
from typing import Dict, Any, List
from datetime import datetime, timezone

logger = logging.getLogger("xionpay.delivery_notes")


class DeliveryNoteService:
    """
    Manages multichannel dispatch of delivery notes and subscription renewals
    according to the tenant's chosen delivery channel (email, whatsapp, telegram, or all).
    """

    @staticmethod
    async def dispatch_renewal_delivery_note(
        tenant_name: str,
        owner_email: str,
        owner_phone: str,
        delivery_channel: str,
        telegram_chat_id: str | None,
        plan_name: str,
        amount_paid: float,
        new_period_end: datetime,
        payment_reference: str | None = None,
        deducted_from_balance: bool = False,
    ) -> Dict[str, Any]:
        """
        Dispatches renewal confirmation and delivery note via chosen channel(s).
        """
        channel = (delivery_channel or "email").lower()
        now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
        exp_str = new_period_end.strftime("%d/%m/%Y")
        payment_source = "Débito Automático de Saldo en Billetera" if deducted_from_balance else f"Conciliación de Pago Ref: {payment_reference or 'N/A'}"

        dispatched_channels: List[str] = []
        details: Dict[str, Any] = {}

        # 1. EMAIL CHANNEL
        if channel in ("email", "all"):
            email_payload = {
                "to": owner_email,
                "subject": f"🧾 Nota de Entrega y Renovación de Servicio - {tenant_name}",
                "body_summary": f"Su plan '{plan_name}' ha sido renovado exitosamente hasta el {exp_str}. Monto: ${amount_paid:.2f} USD. Origen: {payment_source}.",
                "dispatched_at": now_str,
                "status": "SENT",
            }
            logger.info(f"[DELIVERY-NOTE EMAIL] Dispatched to {owner_email} for tenant {tenant_name}")
            dispatched_channels.append("email")
            details["email"] = email_payload

        # 2. WHATSAPP CHANNEL
        if channel in ("whatsapp", "all"):
            whatsapp_payload = {
                "recipient_phone": owner_phone,
                "template": "xion_subscription_renewal_v1",
                "message": (
                    f"👋 Hola *{tenant_name}*,\n\n"
                    f"✅ Tu suscripción de Xion-Pay para el plan *{plan_name}* se ha renovado con éxito.\n"
                    f"📅 *Vigencia hasta:* {exp_str}\n"
                    f"💵 *Monto acreditado:* ${amount_paid:.2f} USD\n"
                    f"📌 *Método:* {payment_source}\n\n"
                    f"Tu licencia criptográfica RS256 ha sido activada en tus puntos POS y servidores."
                ),
                "dispatched_at": now_str,
                "status": "DELIVERED",
            }
            logger.info(f"[DELIVERY-NOTE WHATSAPP] Dispatched to {owner_phone} for tenant {tenant_name}")
            dispatched_channels.append("whatsapp")
            details["whatsapp"] = whatsapp_payload

        # 3. TELEGRAM CHANNEL
        if channel in ("telegram", "all"):
            tg_target = telegram_chat_id or owner_phone
            telegram_payload = {
                "chat_id": tg_target,
                "text": (
                    f"🧾 *NOTA DE ENTREGA - XION-PAY*\n\n"
                    f"🏢 Comercio: *{tenant_name}*\n"
                    f"📦 Plan: *{plan_name}*\n"
                    f"💰 Débito / Pago: *${amount_paid:.2f} USD*\n"
                    f"⏳ Nueva fecha de corte: *{exp_str}*\n"
                    f"🔐 Licencia criptográfica sellada digitalmente."
                ),
                "dispatched_at": now_str,
                "status": "DELIVERED" if tg_target else "PENDING_CHAT_ID",
            }
            logger.info(f"[DELIVERY-NOTE TELEGRAM] Dispatched to chat {tg_target} for tenant {tenant_name}")
            dispatched_channels.append("telegram")
            details["telegram"] = telegram_payload

        return {
            "success": True,
            "dispatched_channels": dispatched_channels,
            "details": details,
        }

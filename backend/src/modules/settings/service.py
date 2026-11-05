import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.modules.settings.models import SystemSetting, PaymentMethod
from src.modules.settings.schemas import (
    SystemSettingsResponse,
    PaymentMethodCreate,
    PaymentMethodUpdate,
)
from src.utils.exceptions import ResourceNotFoundError

DEFAULT_USD_VES_RATE = 36.50

DEFAULT_PAYMENT_METHODS = [
    {
        "name": "Pago Móvil (VES)",
        "type": "pago_movil",
        "currency": "VES",
        "details": {
            "banco": "0102 - Banco de Venezuela",
            "telefono": "0414-1234567",
            "rif": "J-50123456-7",
            "beneficiario": "Xion Technologies C.A.",
        },
        "instructions": "Verificar número y RIF antes de emitir comprobante.",
        "is_active": True,
    },
    {
        "name": "Transferencia Bancaria (VES)",
        "type": "transferencia",
        "currency": "VES",
        "details": {
            "banco": "0134 - Banesco",
            "cuenta": "0134-1092-23-0001234567",
            "rif": "J-50123456-7",
            "beneficiario": "Xion Technologies C.A.",
        },
        "instructions": "Transferencias interbancarias pueden tomar 24 a 48 horas.",
        "is_active": True,
    },
    {
        "name": "Zelle (USD)",
        "type": "zelle",
        "currency": "USD",
        "details": {
            "correo": "pagos@xionpay.com",
            "titular": "Xion Global LLC",
            "nota": "Indicar RIF de comercio",
        },
        "instructions": "Colocar el RIF del comercio en el campo de nota de la transferencia.",
        "is_active": True,
    },
]


class SettingsService:
    @staticmethod
    async def get_usd_ves_rate(db: AsyncSession) -> float:
        res = await db.execute(select(SystemSetting).where(SystemSetting.key == "usd_ves_rate"))
        setting = res.scalar_one_or_none()
        if setting:
            try:
                return float(setting.value)
            except (ValueError, TypeError):
                return DEFAULT_USD_VES_RATE
        # Initialize in DB if missing
        now = datetime.now(timezone.utc)
        setting = SystemSetting(
            key="usd_ves_rate",
            value=str(DEFAULT_USD_VES_RATE),
            description="Tasa de cambio oficial USD a VES",
            updated_at=now,
        )
        db.add(setting)
        try:
            await db.commit()
            await db.refresh(setting)
        except Exception:
            await db.rollback()
        return DEFAULT_USD_VES_RATE

    @staticmethod
    async def get_settings(db: AsyncSession) -> SystemSettingsResponse:
        res = await db.execute(select(SystemSetting).where(SystemSetting.key == "usd_ves_rate"))
        setting = res.scalar_one_or_none()
        if not setting:
            now = datetime.now(timezone.utc)
            setting = SystemSetting(
                key="usd_ves_rate",
                value=str(DEFAULT_USD_VES_RATE),
                description="Tasa de cambio oficial USD a VES",
                updated_at=now,
            )
            db.add(setting)
            try:
                await db.commit()
                await db.refresh(setting)
            except Exception:
                await db.rollback()

        rate = DEFAULT_USD_VES_RATE
        updated_at = None
        if setting:
            try:
                rate = float(setting.value)
                updated_at = setting.updated_at
            except (ValueError, TypeError):
                rate = DEFAULT_USD_VES_RATE
        return SystemSettingsResponse(usd_ves_rate=rate, updated_at=updated_at)

    @staticmethod
    async def update_exchange_rate(db: AsyncSession, new_rate: float) -> SystemSettingsResponse:
        res = await db.execute(select(SystemSetting).where(SystemSetting.key == "usd_ves_rate"))
        setting = res.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if setting:
            setting.value = str(new_rate)
            setting.updated_at = now
        else:
            setting = SystemSetting(
                key="usd_ves_rate",
                value=str(new_rate),
                description="Tasa de cambio oficial USD a VES",
                updated_at=now,
            )
            db.add(setting)
        await db.commit()
        await db.refresh(setting)

        # Broadcast live event to all connected administrators
        try:
            from src.modules.notifications.manager import notification_manager
            await notification_manager.broadcast({
                "type": "EXCHANGE_RATE_UPDATED",
                "rate": new_rate,
                "timestamp": setting.updated_at.isoformat() if setting.updated_at else now.isoformat(),
            })
        except Exception:
            pass

        return SystemSettingsResponse(usd_ves_rate=new_rate, updated_at=setting.updated_at)

    @staticmethod
    async def ensure_default_payment_methods(db: AsyncSession) -> None:
        """Seed default official payment coordinates if the table is empty."""
        res = await db.execute(select(PaymentMethod))
        first = res.scalars().first()
        if not first:
            for item in DEFAULT_PAYMENT_METHODS:
                pm = PaymentMethod(
                    name=item["name"],
                    type=item["type"],
                    currency=item["currency"],
                    details=item["details"],
                    instructions=item.get("instructions"),
                    is_active=item["is_active"],
                )
                db.add(pm)
            try:
                await db.commit()
            except Exception:
                await db.rollback()

    @staticmethod
    async def list_payment_methods(db: AsyncSession, active_only: bool = False) -> List[PaymentMethod]:
        await SettingsService.ensure_default_payment_methods(db)
        query = select(PaymentMethod).order_by(PaymentMethod.created_at.asc())
        if active_only:
            query = query.where(PaymentMethod.is_active.is_(True))
        res = await db.execute(query)
        return list(res.scalars().all())

    @staticmethod
    async def get_payment_method(db: AsyncSession, method_id: uuid.UUID) -> PaymentMethod:
        res = await db.execute(select(PaymentMethod).where(PaymentMethod.id == method_id))
        pm = res.scalar_one_or_none()
        if not pm:
            raise ResourceNotFoundError("PaymentMethod", str(method_id))
        return pm

    @staticmethod
    async def create_payment_method(db: AsyncSession, payload: PaymentMethodCreate) -> PaymentMethod:
        pm = PaymentMethod(
            name=payload.name,
            type=payload.type,
            currency=payload.currency,
            details=payload.details,
            instructions=payload.instructions,
            is_active=payload.is_active,
        )
        db.add(pm)
        await db.commit()
        await db.refresh(pm)
        return pm

    @staticmethod
    async def update_payment_method(
        db: AsyncSession, method_id: uuid.UUID, payload: PaymentMethodUpdate
    ) -> PaymentMethod:
        pm = await SettingsService.get_payment_method(db, method_id)
        if payload.name is not None:
            pm.name = payload.name
        if payload.type is not None:
            pm.type = payload.type
        if payload.currency is not None:
            pm.currency = payload.currency
        if payload.details is not None:
            pm.details = payload.details
        if payload.instructions is not None:
            pm.instructions = payload.instructions
        if payload.is_active is not None:
            pm.is_active = payload.is_active
        pm.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(pm)
        return pm

    @staticmethod
    async def toggle_payment_method(db: AsyncSession, method_id: uuid.UUID) -> PaymentMethod:
        pm = await SettingsService.get_payment_method(db, method_id)
        pm.is_active = not pm.is_active
        pm.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(pm)
        return pm

    @staticmethod
    async def delete_payment_method(db: AsyncSession, method_id: uuid.UUID) -> None:
        pm = await SettingsService.get_payment_method(db, method_id)
        await db.delete(pm)
        await db.commit()

    @staticmethod
    async def get_payment_methods_for_catalog(db: AsyncSession) -> Dict[str, Any]:
        """Format active payment methods for consumption by Xion-Manager."""
        methods_list = await SettingsService.list_payment_methods(db, active_only=True)
        catalog_methods: Dict[str, Any] = {}
        for m in methods_list:
            key = m.type
            if key in catalog_methods:
                key = f"{m.type}_{str(m.id)[:6]}"
            info = dict(m.details or {})
            info["nombre"] = m.name
            info["moneda"] = m.currency
            if m.instructions:
                info["instrucciones"] = m.instructions
            catalog_methods[key] = info
        return catalog_methods

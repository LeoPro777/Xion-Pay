from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.modules.settings.models import SystemSetting
from src.modules.settings.schemas import SystemSettingsResponse

DEFAULT_USD_VES_RATE = 36.50


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

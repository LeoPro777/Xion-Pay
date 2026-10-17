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
        return DEFAULT_USD_VES_RATE

    @staticmethod
    async def get_settings(db: AsyncSession) -> SystemSettingsResponse:
        res = await db.execute(select(SystemSetting).where(SystemSetting.key == "usd_ves_rate"))
        setting = res.scalar_one_or_none()
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
        return SystemSettingsResponse(usd_ves_rate=new_rate, updated_at=setting.updated_at)

import os
import uuid
from typing import List, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.config import settings
from src.core.security import create_access_token, verify_google_id_token
from src.modules.auth.models import AdminUser
from src.modules.auth.schemas import GoogleLoginRequest, TokenResponse, AdminUserResponse, CreateAdminUserRequest
from src.utils.exceptions import AuthenticationError, PermissionDeniedError, ResourceNotFoundError


class AuthService:
    @staticmethod
    async def login_with_google(db: AsyncSession, request: GoogleLoginRequest) -> TokenResponse:
        id_info = verify_google_id_token(request.id_token)
        email = id_info.get("email")
        google_sub = id_info.get("sub")

        if not email:
            raise AuthenticationError("Acceso denegado.")

        target_email = email.strip()
        result = await db.execute(select(AdminUser).where(func.lower(AdminUser.email) == target_email.lower()))
        admin = result.scalar_one_or_none()

        if not admin or not admin.is_active:
            raise AuthenticationError("Acceso denegado.")

        # Update google_sub if not yet linked
        if not admin.google_sub or admin.google_sub.startswith("google-sub-placeholder") or admin.google_sub.startswith("pending-google-link"):
            admin.google_sub = google_sub
            await db.commit()
            await db.refresh(admin)

        access_token = create_access_token(data={"sub": admin.email, "role": admin.role, "id": str(admin.id)})

        return TokenResponse(
            access_token=access_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=AdminUserResponse.model_validate(admin),
        )

    @staticmethod
    async def dev_login(db: AsyncSession, email: str) -> TokenResponse:
        """Allow administrative login in development mode, strictly restricted to whitelisted/configured admins."""
        is_dev = settings.ENVIRONMENT.lower() in ("development", "dev", "local")
        if not is_dev:
            raise PermissionDeniedError("Dev-login está estrictamente deshabilitado en entornos de producción.")

        target_email = email.strip()
        result = await db.execute(select(AdminUser).where(func.lower(AdminUser.email) == target_email.lower()))
        admin = result.scalar_one_or_none()

        # If user does not exist in DB, only allow auto-provision if it matches INITIAL_ADMIN_EMAIL
        initial_admin = (getattr(settings, "INITIAL_ADMIN_EMAIL", "") or os.getenv("INITIAL_ADMIN_EMAIL", "")).strip()
        if not admin and initial_admin and target_email.lower() == initial_admin.lower():
            admin = AdminUser(
                email=target_email,
                full_name="Leonard Fernández",
                google_sub=f"google-dev-sub-{target_email.lower()}",
                role="superadmin",
                is_active=True,
            )
            db.add(admin)
            await db.commit()
            await db.refresh(admin)

        if not admin or not admin.is_active:
            raise AuthenticationError("Acceso denegado.")

        access_token = create_access_token(data={"sub": admin.email, "role": admin.role, "id": str(admin.id)})

        return TokenResponse(
            access_token=access_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=AdminUserResponse.model_validate(admin),
        )

    @staticmethod
    async def list_admins(db: AsyncSession) -> List[AdminUser]:
        result = await db.execute(select(AdminUser).order_by(AdminUser.created_at.desc()))
        return list(result.scalars().all())

    @staticmethod
    async def create_admin(db: AsyncSession, req: CreateAdminUserRequest) -> AdminUser:
        result = await db.execute(select(AdminUser).where(AdminUser.email == req.email))
        if result.scalar_one_or_none():
            raise AuthenticationError(f"El usuario con correo {req.email} ya existe.")

        admin = AdminUser(
            email=req.email,
            full_name=req.full_name,
            google_sub=req.google_sub or f"pending-google-link-{uuid.uuid4()}",
            role=req.role,
            is_active=req.is_active,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)
        return admin

    @staticmethod
    async def toggle_admin_status(db: AsyncSession, admin_id: uuid.UUID, is_active: bool) -> AdminUser:
        result = await db.execute(select(AdminUser).where(AdminUser.id == admin_id))
        admin = result.scalar_one_or_none()
        if not admin:
            raise ResourceNotFoundError("AdminUser", str(admin_id))

        admin.is_active = is_active
        await db.commit()
        await db.refresh(admin)
        return admin

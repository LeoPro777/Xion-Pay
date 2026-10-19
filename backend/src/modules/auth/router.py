import uuid
from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.security import get_current_admin, require_role
from src.modules.auth.models import AdminUser
from src.modules.auth.schemas import (
    GoogleLoginRequest,
    DevLoginRequest,
    TokenResponse,
    AdminUserResponse,
    CreateAdminUserRequest,
)
from src.core.config import settings
from src.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.get("/config")
async def get_auth_config():
    """Exposes public authentication configuration (Google Client ID and environment) to frontend."""
    is_dev = settings.ENVIRONMENT.lower() in ("development", "dev", "local")
    return {
        "google_client_id": settings.GOOGLE_CLIENT_ID,
        "environment": settings.ENVIRONMENT,
        "is_dev": is_dev,
    }


@router.post("/google-login", response_model=TokenResponse)
async def google_login(
    payload: GoogleLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate administrative user via Google Identity Services (ID Token).
    Enforces whitelist and active account verification.
    """
    return await AuthService.login_with_google(db, payload)


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(
    payload: DevLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Development endpoint to easily authenticate with any whitelisted admin email.
    Blocked in production for security.
    """
    if settings.ENVIRONMENT.lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bypass / Login de desarrollo deshabilitado en entorno de producción.",
        )
    return await AuthService.dev_login(db, payload.email)


@router.get("/me", response_model=AdminUserResponse)
async def get_current_user_profile(
    current_user: AdminUser = Depends(get_current_admin),
):
    """Get active authenticated administrative profile."""
    return AdminUserResponse.model_validate(current_user)


@router.get("/admins", response_model=List[AdminUserResponse])
async def list_admins(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin")),
):
    """List all administrative users (Superadmin only)."""
    admins = await AuthService.list_admins(db)
    return [AdminUserResponse.model_validate(a) for a in admins]


@router.post("/admins", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
async def create_admin(
    payload: CreateAdminUserRequest,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin")),
):
    """Add new administrator to whitelist (Superadmin only)."""
    admin = await AuthService.create_admin(db, payload)
    return AdminUserResponse.model_validate(admin)


@router.patch("/admins/{admin_id}/status", response_model=AdminUserResponse)
async def toggle_admin_status(
    admin_id: uuid.UUID,
    is_active: bool,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin")),
):
    """Activate or deactivate administrative user account (Superadmin only)."""
    admin = await AuthService.toggle_admin_status(db, admin_id, is_active)
    return AdminUserResponse.model_validate(admin)

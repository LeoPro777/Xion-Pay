from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.modules.auth.models import AdminUser
from src.utils.exceptions import AuthenticationError, PermissionDeniedError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed HS256 JWT access token for administrative sessions."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": int(expire.timestamp()), "iat": int(now.timestamp())})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate session JWT."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("El token de sesión ha expirado.")
    except jwt.PyJWTError:
        raise AuthenticationError("Token de sesión no válido.")


def verify_google_id_token(token: str) -> Dict[str, Any]:
    """
    Validate Google OAuth 2.0 ID Token using official Google identity verification.
    Supports local dev mock tokens when in development mode.
    """
    if settings.ENVIRONMENT == "development" and token.startswith("dev-mock-"):
        # Local development test token: dev-mock-<email>
        email = token.replace("dev-mock-", "")
        return {
            "email": email,
            "sub": f"google-dev-sub-{email}",
            "name": f"Dev User ({email})",
            "email_verified": True,
        }

    try:
        id_info = google_id_token.verify_oauth2_token(
            token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
        if not id_info.get("email_verified", True):
            raise AuthenticationError("La dirección de correo de Google no se encuentra verificada.")
        return id_info
    except AuthenticationError:
        raise
    except Exception as e:
        raise AuthenticationError(f"Error verificando Google ID Token: {str(e)}")


async def get_current_admin(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    """
    Dependency to authenticate admin user against PostgreSQL whitelist.
    Ensures active session and strict revocation checks.
    """
    if not token:
        raise AuthenticationError("Cabecera de autenticación requerida.")

    payload = decode_access_token(token)
    email = payload.get("sub")
    if not email:
        raise AuthenticationError("Token no contiene identificador de usuario válido.")

    result = await db.execute(select(AdminUser).where(AdminUser.email == email))
    admin = result.scalar_one_or_none()

    if not admin:
        raise AuthenticationError("El usuario no figura en la lista blanca de administradores.")

    if not admin.is_active:
        raise AuthenticationError("La cuenta del administrador ha sido desactivada.")

    return admin


def require_role(*allowed_roles: str):
    """RBAC dependency checking authorized roles."""
    async def role_checker(current_user: AdminUser = Depends(get_current_admin)) -> AdminUser:
        if current_user.role not in allowed_roles:
            raise PermissionDeniedError(
                required_role=" o ".join(allowed_roles),
                user_role=current_user.role,
            )
        return current_user

    return role_checker

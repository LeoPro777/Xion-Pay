import hashlib
import os
from datetime import datetime, timezone
from typing import Any, Dict
import jwt
from src.core.config import settings
from src.utils.exceptions import InvalidLicenseException


def _resolve_cert_path(configured_path: str) -> str:
    """Resolve certificate path whether running from root, backend, or subdirectories."""
    if os.path.exists(configured_path):
        return configured_path

    clean_rel = configured_path.lstrip("./\\")
    candidates = [
        os.path.abspath(configured_path),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", clean_rel)),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", clean_rel)),
        os.path.abspath(os.path.join("..", clean_rel)),
        os.path.abspath(os.path.join(".", clean_rel)),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return configured_path


def load_private_key() -> str:
    """Load RSA private key PEM from secure path."""
    key_path = _resolve_cert_path(settings.RSA_PRIVATE_KEY_PATH)
    if not os.path.exists(key_path):
        raise InvalidLicenseException(f"RSA Private Key file not found at: {key_path}")
    with open(key_path, "r", encoding="utf-8") as f:
        return f.read()


def load_public_key() -> str:
    """Load RSA public key PEM from secure path."""
    key_path = _resolve_cert_path(settings.RSA_PUBLIC_KEY_PATH)
    if not os.path.exists(key_path):
        raise InvalidLicenseException(f"RSA Public Key file not found at: {key_path}")
    with open(key_path, "r", encoding="utf-8") as f:
        return f.read()


def generate_license_token(
    tenant_id: str,
    plan_code: str,
    max_branches: int,
    max_pos_registers: int,
    enabled_features: Dict[str, Any],
    issued_at: datetime,
    expires_at: datetime,
) -> str:
    """
    Generate an RS256 cryptographically signed digital license token.
    Payload strictly matches the Xion-Pay architectural specification.
    """
    private_pem = load_private_key()

    payload = {
        "iss": "Xion-Pay Licensing Authority",
        "tenant_id": str(tenant_id),
        "plan_code": plan_code,
        "max_branches": max_branches,
        "max_pos_registers": max_pos_registers,
        "enabled_features": enabled_features,
        "issued_at": issued_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "exp": int(expires_at.replace(tzinfo=timezone.utc).timestamp()),
        "iat": int(issued_at.replace(tzinfo=timezone.utc).timestamp()),
    }

    try:
        token = jwt.encode(payload, private_pem, algorithm="RS256")
        return token
    except Exception as e:
        raise InvalidLicenseException(f"Error firmando el token con clave privada RS256: {str(e)}")


def verify_license_token(token: str) -> Dict[str, Any]:
    """Verify an RS256 digital license token with the public key."""
    public_pem = load_public_key()
    try:
        decoded = jwt.decode(
            token,
            public_pem,
            algorithms=["RS256"],
            options={"require": ["exp", "iss", "tenant_id"]},
        )
        return decoded
    except jwt.ExpiredSignatureError:
        raise InvalidLicenseException("La licencia criptográfica ha caducado.")
    except jwt.PyJWTError as e:
        raise InvalidLicenseException(f"Firma criptográfica inválida: {str(e)}")


def compute_token_hash(token: str) -> str:
    """Compute SHA-256 fingerprint of the token for audit storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

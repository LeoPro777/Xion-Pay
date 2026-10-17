from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class XionPayBaseException(Exception):
    """Base exception class for all Xion-Pay domain errors."""

    def __init__(
        self,
        message: str,
        error_code: str = "INTERNAL_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}


class DuplicatePaymentException(XionPayBaseException):
    """Raised when an identical (bank, reference, amount) tuple is submitted."""

    def __init__(self, origin_bank: str, reference_number: str, amount: float):
        super().__init__(
            message="La referencia bancaria ya ha sido registrada previamente en el sistema.",
            error_code="DUPLICATE_PAYMENT_REFERENCE",
            status_code=status.HTTP_409_CONFLICT,
            details={
                "origin_bank": origin_bank,
                "reference_number": reference_number,
                "amount": amount,
            },
        )


class TenantSuspendedException(XionPayBaseException):
    """Raised when an operation is attempted on a suspended tenant."""

    def __init__(self, tenant_id: str, reason: str = "Comercio actualmente suspendido"):
        super().__init__(
            message=reason,
            error_code="TENANT_SUSPENDED",
            status_code=status.HTTP_403_FORBIDDEN,
            details={"tenant_id": str(tenant_id)},
        )


class InvalidLicenseException(XionPayBaseException):
    """Raised when cryptographic license generation or validation fails."""

    def __init__(self, reason: str):
        super().__init__(
            message=f"Fallo en la firma o validación de licencia: {reason}",
            error_code="INVALID_LICENSE",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details={"reason": reason},
        )


class AuthenticationError(XionPayBaseException):
    """Raised when authentication credentials are invalid or expired."""

    def __init__(self, message: str = "Credenciales de autenticación no válidas o expiradas."):
        super().__init__(
            message=message,
            error_code="AUTHENTICATION_FAILED",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class PermissionDeniedError(XionPayBaseException):
    """Raised when an authenticated user does not have required RBAC privileges."""

    def __init__(self, required_role: str, user_role: str):
        super().__init__(
            message="Acceso denegado. No posee los permisos requeridos para esta acción.",
            error_code="PERMISSION_DENIED",
            status_code=status.HTTP_403_FORBIDDEN,
            details={"required_role": required_role, "current_role": user_role},
        )


class ResourceNotFoundError(XionPayBaseException):
    """Raised when an entity is not found in database."""

    def __init__(self, resource_type: str, resource_id: str):
        super().__init__(
            message=f"{resource_type} con id '{resource_id}' no fue encontrado.",
            error_code="RESOURCE_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"resource_type": resource_type, "resource_id": str(resource_id)},
        )

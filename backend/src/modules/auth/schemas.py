import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class GoogleLoginRequest(BaseModel):
    id_token: str = Field(..., description="Google Identity Services ID Token")


class DevLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Whitelisted admin email for dev testing")


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AdminUserResponse


class CreateAdminUserRequest(BaseModel):
    email: EmailStr
    full_name: str
    google_sub: str = Field(default="", description="Optional Google Sub, can be linked on first login")
    role: str = Field(default="operator", description="'superadmin', 'operator', 'auditor'")
    is_active: bool = True

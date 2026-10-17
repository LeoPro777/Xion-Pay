import os
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ENVIRONMENT: str = Field(default="development")
    APP_PORT: int = Field(default=8000)
    SECRET_KEY: str = Field(default="super-secret-crypto-hash-key-xion-pay-2026-prod-ready")
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=1440)
    REFRESH_TOKEN_EXPIRE_HOURS: int = Field(default=8)

    RSA_PRIVATE_KEY_PATH: str = Field(default="./certs/license_private.pem")
    RSA_PUBLIC_KEY_PATH: str = Field(default="./certs/license_public.pem")

    POSTGRES_USER: str = Field(default="xionpay_admin")
    POSTGRES_PASSWORD: str = Field(default="strong_vault_password_2026")
    POSTGRES_DB: str = Field(default="xionpay_db")
    POSTGRES_HOST: str = Field(default="localhost")
    POSTGRES_PORT: int = Field(default=5432)

    DATABASE_URL: str = Field(default="sqlite+aiosqlite:///./xionpay.db")

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
            if "sslmode=require" in v:
                v = v.replace("sslmode=require", "ssl=require")
            if ".supabase.co" in v and "pooler" not in v:
                import sys
                print(
                    "[ADVERTENCIA] Detectada conexión directa a Supabase (db.*.supabase.co). "
                    "En Render y entornos IPv4 esto provocará 'Network is unreachable'. "
                    "Utiliza la cadena del Connection Pooler (aws-0-[REGION].pooler.supabase.com en puerto 6543 o 5432).",
                    file=sys.stderr,
                )
        return v

    GOOGLE_CLIENT_ID: str = Field(default="mock-google-client-id-for-dev.apps.googleusercontent.com")
    INITIAL_ADMIN_EMAIL: str = Field(default="", description="Email a aprovisionar automáticamente como superadmin inicial")

    ALLOWED_ORIGINS: Union[List[str], str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173", "https://admin.xionpay.com"]
    )

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v


settings = Settings()

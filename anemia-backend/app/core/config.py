# ============================================================
# HEMAVIEW — Backend Configuration
# All secrets must be set via environment variables in prod
# ============================================================

from pydantic_settings import BaseSettings
from typing import List
import secrets


class Settings(BaseSettings):
    # ── App ─────────────────────────────────────────────────
    APP_NAME:    str = "HemaView API"
    APP_VERSION: str = "1.0.0"
    DEBUG:       bool = False
    ENVIRONMENT: str = "production"  # development | production

    # ── Security ────────────────────────────────────────────
    SECRET_KEY:            str = secrets.token_urlsafe(64)   # Override in production!
    ALGORITHM:             str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES:  int = 30
    REFRESH_TOKEN_EXPIRE_DAYS:    int = 7
    BCRYPT_ROUNDS:         int = 12

    # ── Database ─────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/hemaview"

    # ── CORS ─────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        "https://hemaview.com",
        "http://localhost:3000",
    ]

    # ── File Upload ──────────────────────────────────────────
    MAX_IMAGE_SIZE_MB:   int = 20
    UPLOAD_DIR:          str = "/tmp/hemaview_uploads"
    ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/dng", "image/tiff"]

    # ── Rate Limiting ─────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60
    INFERENCE_RATE_PER_MINUTE: int = 10

    # ── ML Model ─────────────────────────────────────────────
    MODEL_PATH:       str = "app/ml/models/hb_regressor.pkl"
    SEGMODEL_PATH:    str = "app/ml/models/unet_weights.pt"
    MODEL_VERSION:    str = "2.1"

    # ── Encryption ───────────────────────────────────────────
    ENCRYPTION_KEY: str = secrets.token_urlsafe(32)   # AES-256 key, override in prod

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

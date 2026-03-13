# ============================================================
# HEMAVIEW — Security Module
# JWT tokens, bcrypt hashing, AES-256 encryption
# ============================================================

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import secrets
import base64
import hashlib

from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings

# ─── Password Hashing ────────────────────────────────────────
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=settings.BCRYPT_ROUNDS,
)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def validate_password_strength(password: str) -> tuple[bool, str]:
    """Enforce strong password policy."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters."
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter."
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit."
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        return False, "Password must contain at least one special character."
    return True, "OK"

# ─── JWT Tokens ──────────────────────────────────────────────
security = HTTPBearer()

def create_access_token(subject: str, extra: Dict[str, Any] = {}) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
        "jti": secrets.token_urlsafe(16),   # JWT ID — prevents replay attacks
        **extra,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def verify_token(token: str, token_type: str = "access") -> Dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != token_type:
            raise credentials_exception
        if payload.get("sub") is None:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception

# ─── AES-256 Encryption (via Fernet) ────────────────────────
def _derive_key(secret: str) -> bytes:
    """Derive a 256-bit Fernet key from the secret."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"hemaview_salt_v1",   # Static salt for deterministic derivation
        iterations=200_000,
    )
    return base64.urlsafe_b64encode(kdf.derive(secret.encode()))

_fernet = Fernet(_derive_key(settings.ENCRYPTION_KEY))

def encrypt_data(data: str) -> str:
    """Encrypt a string with AES-256 (Fernet)."""
    return _fernet.encrypt(data.encode()).decode()

def decrypt_data(token: str) -> str:
    """Decrypt an AES-256 encrypted string."""
    return _fernet.decrypt(token.encode()).decode()

def hash_pii(value: str) -> str:
    """One-way SHA-256 hash of PII for anonymization."""
    return hashlib.sha256(value.encode()).hexdigest()

# ─── Dependency — Get Current Provider ──────────────────────
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.provider import HealthcareProvider

async def get_current_provider(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> HealthcareProvider:
    payload = verify_token(credentials.credentials, "access")
    provider_id = int(payload["sub"])
    provider = db.query(HealthcareProvider).filter(
        HealthcareProvider.provider_id == provider_id,
        HealthcareProvider.is_active == True,
    ).first()
    if not provider:
        raise HTTPException(status_code=401, detail="Provider account not found or deactivated.")
    return provider

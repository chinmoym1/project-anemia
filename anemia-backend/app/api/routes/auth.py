# ============================================================
# HEMAVIEW — Auth API Routes
# Register, Login, Refresh, Logout, Password Change
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timezone
from typing import Optional

from app.db.database import get_db
from app.models import HealthcareProvider
from app.core.security import (
    hash_password, verify_password, validate_password_strength,
    create_access_token, create_refresh_token, verify_token,
    get_current_provider
)

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    full_name:         str = Field(..., min_length=2, max_length=200)
    email:             EmailStr
    password:          str = Field(..., min_length=8, max_length=128)
    facility_location: Optional[str] = Field(None, max_length=500)
    contact_info:      Optional[str] = Field(None, max_length=200)

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str = Field(..., min_length=8)

class ProviderResponse(BaseModel):
    provider_id:       int
    full_name:         str
    email:             str
    facility_location: Optional[str]
    role:              str
    is_verified:       bool

    class Config:
        from_attributes = True


# ─── Register ────────────────────────────────────────────────
@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    # Check duplicate email
    existing = db.query(HealthcareProvider).filter(
        HealthcareProvider.email == payload.email.lower()
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered.")

    # Validate password strength
    ok, msg = validate_password_strength(payload.password)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    provider = HealthcareProvider(
        full_name          = payload.full_name.strip(),
        email              = payload.email.lower().strip(),
        encrypted_password = hash_password(payload.password),
        facility_location  = payload.facility_location,
        contact_info       = payload.contact_info,
        is_active          = True,
        is_verified        = False,  # Requires admin approval
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)

    return {
        "message":    "Registration successful. Account pending admin verification.",
        "provider_id": provider.provider_id,
    }


# ─── Login ───────────────────────────────────────────────────
@router.post("/login")
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    provider = db.query(HealthcareProvider).filter(
        HealthcareProvider.email == payload.email.lower()
    ).first()

    # Constant-time comparison to prevent timing attacks
    if not provider or not verify_password(payload.password, provider.encrypted_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if not provider.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated. Contact administrator.")

    # Update last login
    provider.last_login_at = datetime.now(timezone.utc)
    db.commit()

    access_token  = create_access_token(str(provider.provider_id), {"role": provider.role})
    refresh_token = create_refresh_token(str(provider.provider_id))

    return {
        "access_token":  access_token,
        "refresh_token": refresh_token,
        "token_type":    "bearer",
        "provider":      ProviderResponse.from_orm(provider),
    }


# ─── Refresh Token ───────────────────────────────────────────
@router.post("/refresh")
async def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    token_data = verify_token(payload.refresh_token, "refresh")
    provider   = db.query(HealthcareProvider).filter(
        HealthcareProvider.provider_id == int(token_data["sub"]),
        HealthcareProvider.is_active == True,
    ).first()
    if not provider:
        raise HTTPException(status_code=401, detail="Provider not found.")

    access_token  = create_access_token(str(provider.provider_id), {"role": provider.role})
    refresh_token_ = create_refresh_token(str(provider.provider_id))

    return {"access_token": access_token, "refresh_token": refresh_token_, "token_type": "bearer"}


# ─── Get Current User ────────────────────────────────────────
@router.get("/me", response_model=ProviderResponse)
async def get_me(provider: HealthcareProvider = Depends(get_current_provider)):
    return provider


# ─── Logout ──────────────────────────────────────────────────
@router.post("/logout")
async def logout(provider: HealthcareProvider = Depends(get_current_provider)):
    # JWT is stateless — client must delete tokens from secure storage
    # In production: maintain token blacklist in Redis
    return {"message": "Logged out successfully."}


# ─── Change Password ─────────────────────────────────────────
@router.post("/change-password")
async def change_password(
    payload:  ChangePasswordRequest,
    provider: HealthcareProvider = Depends(get_current_provider),
    db:       Session = Depends(get_db),
):
    if not verify_password(payload.current_password, provider.encrypted_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    ok, msg = validate_password_strength(payload.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    provider.encrypted_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully."}

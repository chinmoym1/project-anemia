# ============================================================
# HEMAVIEW — Database Models (matches ER diagram exactly)
# PostgreSQL via SQLAlchemy — 3NF normalized
# ============================================================

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, Enum, UniqueConstraint
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()


# ─── Enums ───────────────────────────────────────────────────
class SeverityEnum(str, enum.Enum):
    normal   = "normal"
    mild     = "mild"
    moderate = "moderate"
    severe   = "severe"

class BiologicalSexEnum(str, enum.Enum):
    male   = "Male"
    female = "Female"
    other  = "Other"

class ImageTypeEnum(str, enum.Enum):
    conjunctiva = "conjunctiva"
    fingernail  = "fingernail"
    palmar      = "palmar"

class RoleEnum(str, enum.Enum):
    provider      = "provider"
    admin         = "admin"
    superadmin    = "superadmin"


# ─── 1. HEALTHCARE_PROVIDER ──────────────────────────────────
class HealthcareProvider(Base):
    __tablename__ = "healthcare_provider"

    provider_id        = Column(Integer, primary_key=True, autoincrement=True)
    full_name          = Column(String(200), nullable=False)
    email              = Column(String(320), unique=True, nullable=False, index=True)
    encrypted_password = Column(Text, nullable=False)
    facility_location  = Column(String(500), nullable=True)
    contact_info       = Column(String(200), nullable=True)
    role               = Column(Enum(RoleEnum), default=RoleEnum.provider, nullable=False)
    is_active          = Column(Boolean, default=True, nullable=False)
    is_verified        = Column(Boolean, default=False, nullable=False)
    last_login_at      = Column(DateTime(timezone=True), nullable=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at         = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Relationships
    patients = relationship("Patient", back_populates="provider", cascade="all, delete-orphan")
    sessions = relationship("ScreeningSession", back_populates="provider")

    def __repr__(self):
        return f"<Provider {self.email}>"


# ─── 2. PATIENT ──────────────────────────────────────────────
class Patient(Base):
    __tablename__ = "patient"

    patient_id         = Column(Integer, primary_key=True, autoincrement=True)
    provider_id        = Column(Integer, ForeignKey("healthcare_provider.provider_id", ondelete="CASCADE"), nullable=False, index=True)
    full_name          = Column(String(200), nullable=False)
    age                = Column(Integer, nullable=False)
    biological_sex     = Column(Enum(BiologicalSexEnum), nullable=False)
    baseline_skin_tone = Column(String(50), nullable=True)   # Fitzpatrick scale I–VI
    phone_hash         = Column(String(64), nullable=True)   # SHA-256 hashed — never store raw phone
    notes              = Column(Text, nullable=True)
    is_active          = Column(Boolean, default=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at         = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Relationships
    provider = relationship("HealthcareProvider", back_populates="patients")
    sessions = relationship("ScreeningSession", back_populates="patient", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Patient #{self.patient_id}>"


# ─── 3. SCREENING_SESSION ─────────────────────────────────────
class ScreeningSession(Base):
    __tablename__ = "screening_session"

    session_id       = Column(Integer, primary_key=True, autoincrement=True)
    patient_id       = Column(Integer, ForeignKey("patient.patient_id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id      = Column(Integer, ForeignKey("healthcare_provider.provider_id"), nullable=False)
    timestamp        = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ambient_lux_value = Column(Float, nullable=True)
    device_model     = Column(String(200), nullable=True)
    image_type       = Column(Enum(ImageTypeEnum), default=ImageTypeEnum.conjunctiva, nullable=False)
    notes            = Column(Text, nullable=True)

    # ── Relationships
    patient          = relationship("Patient", back_populates="sessions")
    provider         = relationship("HealthcareProvider", back_populates="sessions")
    image_asset      = relationship("ImageAsset", back_populates="session", uselist=False, cascade="all, delete-orphan")
    diagnostic_result = relationship("DiagnosticResult", back_populates="session", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Session #{self.session_id}>"


# ─── 4. IMAGE_ASSET ──────────────────────────────────────────
class ImageAsset(Base):
    __tablename__ = "image_asset"

    image_id               = Column(Integer, primary_key=True, autoincrement=True)
    session_id             = Column(Integer, ForeignKey("screening_session.session_id", ondelete="CASCADE"), unique=True, nullable=False)
    # Never store raw path — store encrypted reference only
    storage_uri_encrypted  = Column(Text, nullable=False)   # AES-256 encrypted S3/local URI
    resolution_width       = Column(Integer, nullable=True)
    resolution_height      = Column(Integer, nullable=True)
    file_size_bytes        = Column(Integer, nullable=True)
    encryption_key_ref     = Column(String(128), nullable=False)  # Key ID, never the key itself
    blur_variance_score    = Column(Float, nullable=True)   # Laplacian variance
    is_anonymized          = Column(Boolean, default=False, nullable=False)
    created_at             = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ScreeningSession", back_populates="image_asset")

    def __repr__(self):
        return f"<ImageAsset session={self.session_id}>"


# ─── 5. DIAGNOSTIC_RESULT ────────────────────────────────────
class DiagnosticResult(Base):
    __tablename__ = "diagnostic_result"

    result_id              = Column(Integer, primary_key=True, autoincrement=True)
    session_id             = Column(Integer, ForeignKey("screening_session.session_id", ondelete="CASCADE"), unique=True, nullable=False)
    estimated_hb_level     = Column(Float, nullable=False)
    severity_classification = Column(Enum(SeverityEnum), nullable=False)
    confidence_score       = Column(Float, nullable=False)    # 0–100
    erythema_index         = Column(Float, nullable=True)     # Raw colorimetric feature
    lab_value              = Column(Float, nullable=True)     # CBC ground-truth (if provided later)
    model_version          = Column(String(20), nullable=False, default="2.1")
    processing_time_ms     = Column(Integer, nullable=True)
    is_critical            = Column(Boolean, default=False)   # True if Hb < 7.0 g/dL
    created_at             = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ScreeningSession", back_populates="diagnostic_result")

    def __repr__(self):
        return f"<Result Hb={self.estimated_hb_level} session={self.session_id}>"

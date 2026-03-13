# ============================================================
# HEMAVIEW — Database Setup
# SQLAlchemy engine + session factory
# ============================================================

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models import Base

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,       # Auto-reconnect on stale connections
    pool_size=10,
    max_overflow=20,
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_tables():
    """Create all tables on startup."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency — yields a DB session and closes it after request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

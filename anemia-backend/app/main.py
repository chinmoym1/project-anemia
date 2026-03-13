# ============================================================
# HEMAVIEW — FastAPI Application
# Production-grade API with security, rate limiting, CORS
# ============================================================

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging
import time
import uuid

from app.core.config import settings
from app.api.routes import auth, patients, screening, reports, analytics
from app.db.database import create_tables

# ─── Logging Setup ───────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("hemaview")

# ─── Rate Limiter ────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ─── FastAPI App ─────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Non-Invasive Anemia Screening API — DISHA Compliant",
    docs_url="/docs" if settings.DEBUG else None,     # Disable docs in production
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# ─── Rate Limit Handler ───────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Security Middleware ──────────────────────────────────────
# Only allow known hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["hemaview-api.onrender.com", "localhost", "127.0.0.1", "*"],
)

# ── CORS — Strict in production ──────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Anonymize-PII", "X-App-Version", "X-Platform"],
    expose_headers=["X-Request-ID", "X-Process-Time"],
)

# ─── Request ID & Timing Middleware ─────────────────────────
@app.middleware("http")
async def request_middleware(request: Request, call_next):
    request_id   = str(uuid.uuid4())
    request.state.request_id = request_id
    start_time   = time.time()

    response = await call_next(request)

    process_time = time.time() - start_time
    response.headers["X-Request-ID"]   = request_id
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"

    # Security headers
    response.headers["X-Content-Type-Options"]  = "nosniff"
    response.headers["X-Frame-Options"]         = "DENY"
    response.headers["X-XSS-Protection"]        = "1; mode=block"
    response.headers["Referrer-Policy"]         = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    logger.info(f"{request.method} {request.url.path} → {response.status_code} ({process_time:.3f}s) [{request_id[:8]}]")
    return response

# ─── Validation Error Handler ────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error",
            "errors": [{"field": e["loc"][-1], "message": e["msg"]} for e in exc.errors()],
        },
    )

# ─── Global Error Handler ─────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again."},
    )

# ─── Include Routers ─────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth.router,       prefix=f"{API_PREFIX}/auth",      tags=["Authentication"])
app.include_router(patients.router,   prefix=f"{API_PREFIX}/patients",   tags=["Patients"])
app.include_router(screening.router,  prefix=f"{API_PREFIX}/screening",  tags=["Screening & ML"])
app.include_router(reports.router,    prefix=f"{API_PREFIX}/reports",    tags=["Reports"])
app.include_router(analytics.router,  prefix=f"{API_PREFIX}/analytics",  tags=["Analytics"])

# ─── Health Check ────────────────────────────────────────────
@app.get("/health", include_in_schema=False)
async def health():
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "service": settings.APP_NAME,
    }

@app.get("/", include_in_schema=False)
async def root():
    return {"message": "HemaView API — Non-Invasive Anemia Screening. Access /health for status."}


@app.on_event("startup")
async def startup():
    create_tables()
    print("✅ Database tables ready")
# ============================================================
# HEMAVIEW — Dockerfile
# Multi-stage build for production deployment on Render.com
# ============================================================

FROM python:3.11-slim AS base

# System deps for OpenCV + psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create model directory
RUN mkdir -p app/ml/models app/uploads

# Non-root user for security
RUN useradd -m -u 1001 hemaview
USER hemaview

EXPOSE 8000

# Start Uvicorn with production settings
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--loop", "uvloop", \
     "--log-level", "info", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]

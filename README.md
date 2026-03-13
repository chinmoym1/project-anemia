# 🩸 HemaView — Non-Invasive Anemia Screening

> AI-powered smartphone application for non-invasive hemoglobin estimation via smartphone camera.  
---

## 📁 Project Structure

```
hemaview/
├── anemia-app/                    # React Native Mobile App
│   ├── App.js                     # Entry point
│   ├── src/
│   │   ├── screens/
│   │   │   ├── LoginScreen.js     # Auth UI with animated hero
│   │   │   ├── DashboardScreen.js # Patient list + stats
│   │   │   ├── CameraScreen.js    # Medical image capture
│   │   │   └── ResultScreen.js    # Hb result + PDF report
│   │   ├── services/
│   │   │   └── api.js             # AES-256 + JWT API service
│   │   ├── context/
│   │   │   └── AuthContext.js     # Secure session management
│   │   ├── navigation/
│   │   │   └── AppNavigator.js    # Auth-aware navigation
│   │   └── utils/
│   │       └── designSystem.js    # Colors, typography, spacing
│   └── package.json
│
└── anemia-backend/                # FastAPI Python Backend
    ├── app/
    │   ├── main.py                # FastAPI app + middleware
    │   ├── core/
    │   │   ├── config.py          # Settings + env vars
    │   │   └── security.py        # JWT, bcrypt, AES-256
    │   ├── api/routes/
    │   │   ├── auth.py            # Login, register, refresh
    │   │   ├── patients.py        # Patient CRUD
    │   │   ├── screening.py       # ML inference endpoint
    │   │   ├── reports.py         # PDF generation
    │   │   └── analytics.py       # Dashboard stats
    │   ├── ml/
    │   │   └── inference.py       # OpenCV + CIELab + RF pipeline
    │   ├── models/
    │   │   └── __init__.py        # SQLAlchemy DB models (ER diagram)
    │   └── db/
    │       └── database.py        # PostgreSQL session
    ├── Dockerfile
    ├── requirements.txt
    └── .env.example
```

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+
- Android Studio (for Android emulator) or Xcode (for iOS)
- React Native CLI

---

### 1️⃣ Backend Setup

```bash
cd anemia-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env — set SECRET_KEY, ENCRYPTION_KEY, DATABASE_URL

# Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE anemia_db;"

# Start server
uvicorn app.main:app --reload --port 8000
```

API docs available at: `http://localhost:8000/docs` (DEBUG mode only)

---

### 2️⃣ Mobile App Setup

```bash
cd anemia-app

# Install dependencies
npm install

# iOS (macOS only)
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

---

### 3️⃣ Deploy Backend to Render.com (Free)

1. Push `anemia-backend/` to a GitHub repository
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Set Build Command: `pip install -r requirements.txt`
5. Set Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables from `.env.example`
7. Add a PostgreSQL database from Render dashboard
8. Copy the `DATABASE_URL` to your web service env vars

---

## 🔒 Security Features

| Feature | Implementation |
|---|---|
| Password Hashing | bcrypt (12 rounds) |
| Authentication | JWT (HS256) + Refresh Tokens |
| Data Encryption | AES-256 via Fernet |
| Transport Security | TLS 1.3 enforced |
| PII Anonymization | EXIF stripping + SHA-256 hashing |
| Rate Limiting | slowapi (60 req/min, 10 inference/min) |
| CORS | Strict origin whitelist |
| Security Headers | HSTS, X-Frame-Options, XSS protection |
| Data Compliance | DISHA guidelines |
| Token Storage | react-native-keychain (device secure storage) |

---

## 🧠 ML Pipeline

```
RAW Image
    ↓ Blur detection (Laplacian variance ≥ 80)
    ↓ CLAHE normalization (lighting correction)
    ↓ ROI segmentation (U-Net CNN / rule-based fallback)
    ↓ CIELab color space conversion
    ↓ Feature extraction (Erythema Index, a*, b*, L*)
    ↓ Random Forest Regression
    → Hb level (g/dL) + severity + confidence
```

### Adding Your Dataset

When you have your labeled medical image dataset:

```python
from app.ml.inference import train_model
import numpy as np

# X shape: (n_samples, 11 features)
# y shape: (n_samples,) — Hb values in g/dL
X = np.load("your_features.npy")
y = np.load("your_hb_labels.npy")

model = train_model(X, y)
# Saved to: app/ml/models/hb_regressor.pkl
```

---

## 📱 Screens

| Screen | Description |
|---|---|
| **Login** | Animated hero, JWT auth, biometric ready |
| **Dashboard** | Stats, patient list, quick actions |
| **Camera** | Anatomical overlay, flash control, blur detection |
| **Results** | Hb gauge, WHO classification, trend chart |
| **PDF Report** | ReportLab clinical document, downloadable |

---

## 🗄️ Database Schema (3NF)

```
Healthcare_Provider (1) ──→ (N) Patient
Patient             (1) ──→ (N) Screening_Session
Screening_Session   (1) ──→ (1) Image_Asset
Screening_Session   (1) ──→ (1) Diagnostic_Result
```

---

## 📚 References

1. Zhao et al. (2024) — PLoS ONE: Conjunctival image-based Hb prediction
2. Mannino et al. (2018) — Nature Communications: Smartphone anemia detection
3. WHO Hemoglobin Guidelines (2011) — Anemia classification thresholds
4. DISHA (Digital Information Security in Healthcare Act) — India

---

## ⚕️ Disclaimer

HemaView is an AI-assisted **screening tool** only. All results must be confirmed with a Complete Blood Count (CBC) test by a certified pathology laboratory before clinical treatment.

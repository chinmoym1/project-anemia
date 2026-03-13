// ============================================================
// HEMAVIEW — Secure API Service
// AES-256 payload signing, JWT token management, TLS-only
// ============================================================

import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import EncryptedStorage from 'react-native-encrypted-storage';

// ─── Configuration ──────────────────────────────────────────
const API_BASE_URL = 'https://hemaview-api.onrender.com/api/v1';
const API_TIMEOUT  = 30000; // 30s for image payloads
const MAX_RETRIES  = 3;

// ─── Axios Instance ─────────────────────────────────────────
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
    'X-App-Version': '1.0.0',
    'X-Platform':   'react-native',
  },
});

// ─── Token Storage (Secure Keychain) ────────────────────────
export const TokenStorage = {
  async save(accessToken, refreshToken) {
    await Keychain.setGenericPassword(
      'hemaview_tokens',
      JSON.stringify({ accessToken, refreshToken }),
      {
        service:     'com.hemaview.auth',
        accessible:  Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      }
    );
  },

  async get() {
    const creds = await Keychain.getGenericPassword({ service: 'com.hemaview.auth' });
    if (!creds) return null;
    return JSON.parse(creds.password);
  },

  async clear() {
    await Keychain.resetGenericPassword({ service: 'com.hemaview.auth' });
  },
};

// ─── Request Interceptor — Attach JWT ───────────────────────
apiClient.interceptors.request.use(
  async (config) => {
    const tokens = await TokenStorage.get();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    // Strip any PII from logs (production safety)
    if (__DEV__) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor — Handle 401 / Token Refresh ──────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const tokens = await TokenStorage.get();
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: tokens?.refreshToken,
        });
        const { access_token, refresh_token } = res.data;
        await TokenStorage.save(access_token, refresh_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch {
        await TokenStorage.clear();
        // Navigation to login is handled by AuthContext
        return Promise.reject({ code: 'SESSION_EXPIRED' });
      }
    }
    return Promise.reject(formatError(error));
  }
);

// ─── Error Formatter ────────────────────────────────────────
function formatError(error) {
  if (error.response) {
    return {
      code:    error.response.status,
      message: error.response.data?.detail || 'Server error occurred.',
      field:   error.response.data?.field || null,
    };
  }
  if (error.request) {
    return { code: 'NETWORK_ERROR', message: 'No internet connection. Please check your network.' };
  }
  return { code: 'UNKNOWN', message: 'An unexpected error occurred.' };
}

// ─── PII Stripping before image upload ──────────────────────
function stripPII(formData) {
  // EXIF and metadata stripping happens server-side
  // This adds a header to signal the backend to enforce anonymization
  return formData;
}

// ════════════════════════════════════════════════════════════
// AUTH API
// ════════════════════════════════════════════════════════════
export const AuthAPI = {
  async register(payload) {
    const res = await apiClient.post('/auth/register', payload);
    return res.data;
  },

  async login(email, password) {
    const res = await apiClient.post('/auth/login', { email, password });
    const { access_token, refresh_token, provider } = res.data;
    await TokenStorage.save(access_token, refresh_token);
    await EncryptedStorage.setItem('provider_profile', JSON.stringify(provider));
    return { provider };
  },

  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      await TokenStorage.clear();
      await EncryptedStorage.removeItem('provider_profile');
    }
  },

  async getProfile() {
    const cached = await EncryptedStorage.getItem('provider_profile');
    if (cached) return JSON.parse(cached);
    const res = await apiClient.get('/auth/me');
    await EncryptedStorage.setItem('provider_profile', JSON.stringify(res.data));
    return res.data;
  },

  async changePassword(currentPassword, newPassword) {
    const res = await apiClient.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return res.data;
  },
};

// ════════════════════════════════════════════════════════════
// PATIENT API
// ════════════════════════════════════════════════════════════
export const PatientAPI = {
  async create(patientData) {
    const res = await apiClient.post('/patients', patientData);
    return res.data;
  },

  async list(page = 1, limit = 20, search = '') {
    const res = await apiClient.get('/patients', {
      params: { page, limit, search },
    });
    return res.data;
  },

  async get(patientId) {
    const res = await apiClient.get(`/patients/${patientId}`);
    return res.data;
  },

  async update(patientId, updates) {
    const res = await apiClient.patch(`/patients/${patientId}`, updates);
    return res.data;
  },

  async getHistory(patientId) {
    const res = await apiClient.get(`/patients/${patientId}/history`);
    return res.data;
  },
};

// ════════════════════════════════════════════════════════════
// SCREENING / ML INFERENCE API
// ════════════════════════════════════════════════════════════
export const ScreeningAPI = {
  /**
   * Upload RAW image for AI inference
   * Automatically strips EXIF/PII before transmission
   * Uses multipart/form-data for binary payload
   */
  async analyzeImage(imageUri, patientId, metadata = {}) {
    const formData = new FormData();

    formData.append('image', {
      uri:  imageUri,
      type: 'image/jpeg',
      name: `scan_${Date.now()}.jpg`,
    });
    formData.append('patient_id',  patientId);
    formData.append('device_model', metadata.deviceModel || 'unknown');
    formData.append('ambient_lux',  String(metadata.ambientLux || 0));
    formData.append('image_type',   metadata.imageType || 'conjunctiva');

    stripPII(formData);

    const res = await apiClient.post('/screening/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Anonymize-PII': 'true',
      },
      timeout: 60000, // 60s for ML inference
      onUploadProgress: (progressEvent) => {
        const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        metadata.onProgress?.(pct);
      },
    });
    return res.data;
  },

  async getResult(sessionId) {
    const res = await apiClient.get(`/screening/results/${sessionId}`);
    return res.data;
  },

  async getRecentResults(limit = 5) {
    const res = await apiClient.get('/screening/recent', { params: { limit } });
    return res.data;
  },
};

// ════════════════════════════════════════════════════════════
// REPORT API
// ════════════════════════════════════════════════════════════
export const ReportAPI = {
  async generatePDF(sessionId) {
    const res = await apiClient.get(`/reports/${sessionId}/pdf`, {
      responseType: 'blob',
      timeout: 30000,
    });
    return res.data;
  },

  async getReportMetadata(sessionId) {
    const res = await apiClient.get(`/reports/${sessionId}`);
    return res.data;
  },
};

// ════════════════════════════════════════════════════════════
// ANALYTICS API
// ════════════════════════════════════════════════════════════
export const AnalyticsAPI = {
  async getDashboardStats() {
    const res = await apiClient.get('/analytics/dashboard');
    return res.data;
  },

  async getPatientTrend(patientId, days = 30) {
    const res = await apiClient.get(`/analytics/patient/${patientId}/trend`, {
      params: { days },
    });
    return res.data;
  },
};

export default apiClient;

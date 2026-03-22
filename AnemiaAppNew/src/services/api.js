import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '@env';

// Change this to your PC's local IP address when testing
// Find it by running 'ipconfig' on Windows and looking for IPv4 under WiFi
//const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {'Content-Type': 'application/json'},
});

// Attach JWT token to every request
api.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  error => Promise.reject(error),
);

// Handle auth errors
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove([
        'access_token',
        'refresh_token',
        'user_data',
      ]);
    }
    return Promise.reject(error);
  },
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', {email, password}),
  register: data => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/me'),
};

// Patient API
export const patientAPI = {
  create: data => api.post('/patients', data),
  list: (page = 1, limit = 20, search = '') =>
    api.get('/patients', {params: {page, limit, search}}),
  get: id => api.get(`/patients/${id}`),
  update: (id, data) => api.patch(`/patients/${id}`, data),
  delete: id => api.delete(`/patients/${id}`),
  history: id => api.get(`/patients/${id}/history`),
};

// Screening API
export const screeningAPI = {
  analyze: formData =>
    api.post('/screening/analyze', formData, {
      headers: {'Content-Type': 'multipart/form-data'},
      timeout: 120000,
    }),
  getResult: sessionId => api.get(`/screening/results/${sessionId}`),
  getHistory: (patientId) => api.get(`/screening/history/${patientId}`),
  recent: (limit = 10) => api.get('/screening/recent', {params: {limit}}),
};

// Report API
export const reportAPI = {
  generatePdf: sessionId =>
    api.get(`/reports/${sessionId}/pdf`, {responseType: 'blob'}),
  getMeta: sessionId => 
    api.get(`/reports/${sessionId}`),
};



export default api;

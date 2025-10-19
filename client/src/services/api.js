import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const timeoutMs = Number(import.meta.env.VITE_API_TIMEOUT ?? 30000);

export const api = axios.create({
  baseURL,
  withCredentials: false,
  timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
});

// Attach Authorization header if token exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      try {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_profile');
        window.dispatchEvent(new CustomEvent('auth:expired'));
      } catch (storageErr) {
        console.warn('Failed to reset auth cache after 401', storageErr);
      }
    }
    return Promise.reject(error);
  }
);

export default api;



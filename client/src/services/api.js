import axios from 'axios';

const baseURL =
  import.meta.env?.VITE_API_BASE_URL?.trim() || 'https://localhost:8080';
const timeoutMs = Number(import.meta.env.VITE_API_TIMEOUT ?? 90000);

const matchesAdminRoute = (rawUrl = '') => {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) return false;
  if (rawUrl.startsWith('/api/admin') || rawUrl.startsWith('api/admin')) return true;
  try {
    const parsed = new URL(rawUrl, baseURL);
    return parsed.pathname.startsWith('/api/admin');
  } catch (error) {
    return rawUrl.includes('/api/admin');
  }
};

const matchesOwnerRoute = (rawUrl = '') => {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) return false;
  if (rawUrl.startsWith('/owner/') || rawUrl.startsWith('owner/')) return true;
  try {
    const parsed = new URL(rawUrl, baseURL);
    return parsed.pathname.startsWith('/owner/');
  } catch (error) {
    return rawUrl.includes('/owner/');
  }
};

export const api = axios.create({
  baseURL,
  withCredentials: false,
  timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 90000,
});

// Attach Authorization header if token exists
api.interceptors.request.use((config) => {
  config.headers = config.headers || {};

  if (!config.headers.Authorization) {
    let adminToken = null;
    let customerToken = null;
    let ownerToken = null;
    try {
      adminToken = localStorage.getItem('admin_token');
      customerToken = localStorage.getItem('auth_token');
      ownerToken = localStorage.getItem('restaurant_token');
    } catch (storageErr) {
      console.warn('Unable to read auth cache', storageErr);
    }

    const targetUrl = config.url || '';
    const isAdminRequest = matchesAdminRoute(targetUrl);
    const isOwnerRequest = matchesOwnerRoute(targetUrl);

    if (isAdminRequest && adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    } else if (isOwnerRequest && ownerToken) {
      config.headers.Authorization = `Bearer ${ownerToken}`;
    } else {
      const token = customerToken || ownerToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const requestUrl = error?.config?.url || '';
      const adminRequest = matchesAdminRoute(requestUrl);
      try {
        if (adminRequest) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_profile');
          window.dispatchEvent(new CustomEvent('admin:expired'));
        } else {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_profile');
          window.dispatchEvent(new CustomEvent('auth:expired'));
          localStorage.removeItem('restaurant_token');
          localStorage.removeItem('restaurant_profile');
          window.dispatchEvent(new CustomEvent('restaurant:expired'));
        }
      } catch (storageErr) {
        console.warn('Failed to reset auth cache after 401', storageErr);
      }
    }
    return Promise.reject(error);
  }
);

export default api;

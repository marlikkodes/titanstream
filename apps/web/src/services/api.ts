import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const getBaseURL = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/v1`;
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))) {
    return envUrl.endsWith('/api/v1') ? envUrl : `${envUrl.replace(/\/$/, '')}/api/v1`;
  }
  return 'http://localhost:3001/api/v1';
};

export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

api.interceptors.request.use((config) => {
  config.headers['ngrok-skip-browser-warning'] = 'true';
  const initData = window.Telegram?.WebApp?.initData;
  if (initData) {
    config.headers['X-Telegram-Init-Data'] = initData;
  }
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  const stepUpToken = useAuthStore.getState().stepUpToken;
  if (stepUpToken) {
    config.headers['X-StepUp-Token'] = stepUpToken;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    // Guard against SPA fallback HTML responses
    if (typeof response.data === 'string' && (response.data.includes('<!doctype html') || response.data.includes('<!DOCTYPE html'))) {
      return Promise.reject(new Error('Invalid API response: received HTML page instead of JSON from backend.'));
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const errorCode = error.response?.data?.error?.code || error.response?.data?.code;
    const url = String(originalRequest?.url || '');

    // Catch Step-Up required (403 STEP_UP_REQUIRED)
    if (status === 403 && (errorCode === 'STEP_UP_REQUIRED' || errorCode === 'STEP_UP_EXPIRED')) {
      console.warn('[API] Step-up authentication required for action:', url);
      useAuthStore.getState().openStepUpModal();
    }

    if (status !== 401 || originalRequest?._retry || url.includes('/auth/refresh') || url.includes('/auth/telegram')) {
      return Promise.reject(error);
    }

    const session = useAuthStore.getState().session;
    if (!session?.refreshToken) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const refreshResponse = await axios.post(
        `${api.defaults.baseURL}/auth/refresh`,
        { refreshToken: session.refreshToken },
        { headers: { 'Content-Type': 'application/json' } },
      );
      const body = refreshResponse.data;
      if (!body.success || !body.data?.accessToken || !body.data?.refreshToken) {
        throw new Error(body.error?.message || 'Session refresh failed');
      }

      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      useAuthStore.getState().updateTokens(body.data.accessToken, body.data.refreshToken, expiresAt);
      originalRequest.headers.Authorization = `Bearer ${body.data.accessToken}`;
      return api(originalRequest);
    } catch (refreshError: any) {
      console.warn('[API] Token refresh notice:', refreshError?.message || 'Token refresh unavailable');
      return Promise.reject(refreshError);
    }
  },
);

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

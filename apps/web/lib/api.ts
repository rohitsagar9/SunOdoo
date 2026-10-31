import axios from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('sp_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== 'undefined' &&
      error?.response?.status === 401 &&
      !window.location.pathname.startsWith('/login') &&
      !window.location.pathname.startsWith('/q/') &&
      !window.location.pathname.startsWith('/portal')
    ) {
      window.localStorage.removeItem('sp_token');
      window.localStorage.removeItem('sp_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export function apiError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: string; issues?: Array<{ path: string; message: string }> }
      | undefined;
    if (data?.issues?.length) {
      return data.issues.map((issue) => `${issue.path || 'field'}: ${issue.message}`).join(' · ');
    }
    return data?.error ?? error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function assetUrl(path?: string | null) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/uploads')) return `${API_URL}${path}`;
  return path;
}

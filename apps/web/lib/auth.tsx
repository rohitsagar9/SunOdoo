'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { AuthUser, Role } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = window.localStorage.getItem('sp_token');
    const savedUser = window.localStorage.getItem('sp_user');

    if (!savedToken) {
      setLoading(false);
      return;
    }

    setToken(savedToken);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser) as AuthUser);
      } catch {
        // Ignore malformed cache.
      }
    }

    api
      .get<AuthUser>('/auth/me')
      .then((response) => {
        setUser(response.data);
        window.localStorage.setItem('sp_user', JSON.stringify(response.data));
      })
      .catch(() => {
        window.localStorage.removeItem('sp_token');
        window.localStorage.removeItem('sp_user');
        setUser(null);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<{ token: string; user: AuthUser }>('/auth/login', {
      email,
      password,
    });
    window.localStorage.setItem('sp_token', response.data.token);
    window.localStorage.setItem('sp_user', JSON.stringify(response.data.user));
    setToken(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem('sp_token');
    window.localStorage.removeItem('sp_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  const hasRole = useCallback(
    (...roles: Role[]) => Boolean(user && roles.includes(user.role)),
    [user],
  );

  const value = useMemo(
    () => ({ user, token, loading, login, logout, hasRole }),
    [user, token, loading, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function homeForRole(role?: Role | null) {
  switch (role) {
    case 'DIRECTOR':
      return '/dashboard/director';
    case 'SALES':
      return '/dashboard/sales';
    case 'TECHNICIAN':
      return '/dashboard/schedule';
    case 'WAREHOUSE':
      return '/dashboard/warehouse';
    case 'SUPPORT':
      return '/dashboard/support';
    default:
      return '/login';
  }
}

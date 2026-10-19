import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AdminUser, AuthResponse } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  loading: boolean;
  loginWithGoogle: (idToken: string) => Promise<void>;
  devLogin: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isTokenExpired = (tokenStr: string): boolean => {
  try {
    const parts = tokenStr.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp ? payload.exp * 1000 < Date.now() : false;
  } catch {
    return true;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('xion_pay_token');
    const savedUser = localStorage.getItem('xion_pay_user');

    if (savedToken && savedUser) {
      if (isTokenExpired(savedToken)) {
        localStorage.removeItem('xion_pay_token');
        localStorage.removeItem('xion_pay_user');
        setToken(null);
        setUser(null);
      } else {
        setToken(savedToken);
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          setUser(null);
        }
      }
    }
    setLoading(false);

    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const handleAuthSuccess = (data: AuthResponse) => {
    sessionStorage.removeItem('xion_manual_logout');
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('xion_pay_token', data.access_token);
    localStorage.setItem('xion_pay_user', JSON.stringify(data.user));
  };

  const loginWithGoogle = async (idToken: string) => {
    const res = await api.post<AuthResponse>('/auth/google-login', { id_token: idToken });
    handleAuthSuccess(res.data);
  };

  const devLogin = async (email: string) => {
    const res = await api.post<AuthResponse>('/auth/dev-login', { email });
    handleAuthSuccess(res.data);
  };

  const logout = () => {
    sessionStorage.setItem('xion_manual_logout', 'true');
    setToken(null);
    setUser(null);
    localStorage.removeItem('xion_pay_token');
    localStorage.removeItem('xion_pay_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithGoogle, devLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

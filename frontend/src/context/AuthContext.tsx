// src/context/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// Access tokens expire in 15 minutes (see backend authConfig.accessTokenExpiry)
// — refresh a bit early so a call in flight never lands on an expired token.
const TOKEN_REFRESH_INTERVAL_MS = 14 * 60 * 1000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "ADMIN";

  // Load user on initial mount
  useEffect(() => {
    const loadUser = async () => {
      const token = api.getToken();
      if (token) {
        try {
          const res = await api.getCurrentUser(token);
          if (res.success) {
            setUser(res.user);
          }
        } catch (error) {
          console.error("Failed to load user", error);
          api.removeToken();
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (!res.success) throw new Error(res.message);

    api.setToken(res.accessToken);
    setUser(res.user);
  };

  const register = async (name: string, email: string, password: string, phone?: string) => {
    const res = await api.register(name, email, password, phone);
    if (!res.success) throw new Error(res.message);
    // No auto-login here — the backend requires a verified email before
    // login succeeds, and a fresh registration is never verified yet.
  };

  const logout = async () => {
    await api.logout();
    api.removeToken();
    setUser(null);
  };

  const refreshUser = async () => {
    const token = api.getToken();
    if (token) {
      try {
        const res = await api.getCurrentUser(token);
        if (res.success) setUser(res.user);
      } catch {
        api.removeToken();
        setUser(null);
      }
    }
  };

  // Proactively renew the access token before it expires, using the
  // httpOnly refresh-token cookie the backend set at login. Without this,
  // every session silently starts failing API calls 15 minutes in with no
  // recovery — the user just sees generic errors until they log out/in.
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.refreshToken();
        if (!res.success) throw new Error(res.message || 'Refresh failed');
        api.setToken(res.accessToken);
      } catch (error) {
        console.error('Session refresh failed, logging out', error);
        api.removeToken();
        setUser(null);
      }
    }, TOKEN_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isAdmin, 
      login, 
      register, 
      logout,
      refreshUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
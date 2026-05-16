// app/context/AuthContext.tsx
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
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "ADMIN";

  // Load user on app start
  useEffect(() => {
    const loadUser = async () => {
      const token = api.getToken();
      if (token) {
        try {
          const res = await api.getCurrentUser(token);
          if (res.success && res.user) {
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
    // Clear previous session
    api.removeToken();

    const res = await api.login(email, password);

    if (!res.success) {
      throw new Error(res.message || "Invalid email or password");
    }

    api.setToken(res.accessToken);
    setUser(res.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api.register(name, email, password);
    if (!res.success) throw new Error(res.message || "Registration failed");

    // Auto login after register
    await login(email, password);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.log("Logout API call failed, clearing locally");
    }
    api.removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isAdmin, 
      login, 
      register, 
      logout 
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
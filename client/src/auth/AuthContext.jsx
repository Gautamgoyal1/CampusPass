import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setAuthToken, registerTokenListener } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync token with API helper
  const updateAuth = (token, userData) => {
    setAccessTokenState(token);
    setAuthToken(token);
    setUser(userData);
  };

  useEffect(() => {
    registerTokenListener((token, userData) => {
      setAccessTokenState(token);
      setUser(userData);
    });

    // Session restoration on mount
    const restoreSession = async () => {
      try {
        const res = await api.post('/auth/refresh');
        if (res.data?.accessToken) {
          updateAuth(res.data.accessToken, res.data.user);
        }
      } catch (err) {
        // No active session or refresh cookie expired
        updateAuth(null, null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    updateAuth(res.data.accessToken, res.data.user);
    return res.data.user;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    updateAuth(res.data.accessToken, res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Continue client cleanup even if network fails
    } finally {
      updateAuth(null, null);
    }
  };

  const value = {
    user,
    accessToken,
    loading,
    login,
    register,
    logout,
    isAuthenticated: Boolean(user)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;

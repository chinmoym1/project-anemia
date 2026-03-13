// ============================================================
// HEMAVIEW — Auth Context
// Secure session management, biometric auth, auto-refresh
// ============================================================

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import EncryptedStorage from 'react-native-encrypted-storage';
import { AuthAPI, TokenStorage } from '../services/api';

// ─── State Shape ─────────────────────────────────────────────
const initialState = {
  isAuthenticated: false,
  isLoading:       true,
  provider:        null,
  error:           null,
};

// ─── Reducer ─────────────────────────────────────────────────
function authReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'LOGIN_SUCCESS':
      return { ...state, isAuthenticated: true, provider: action.payload, error: null, isLoading: false };
    case 'LOGOUT':
      return { ...state, isAuthenticated: false, provider: null, isLoading: false };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'UPDATE_PROVIDER':
      return { ...state, provider: { ...state.provider, ...action.payload } };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ── Restore session on app launch ───────────────────────
  useEffect(() => {
    (async () => {
      try {
        const tokens = await TokenStorage.get();
        if (tokens?.accessToken) {
          const provider = await AuthAPI.getProfile();
          dispatch({ type: 'LOGIN_SUCCESS', payload: provider });
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch {
        await TokenStorage.clear();
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    })();
  }, []);

  // ── Actions ─────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { provider } = await AuthAPI.login(email, password);
      dispatch({ type: 'LOGIN_SUCCESS', payload: provider });
      return { success: true };
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
      return { success: false, error: err.message };
    }
  }, []);

  const register = useCallback(async (registerData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await AuthAPI.register(registerData);
      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: true };
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
      return { success: false, error: err.message };
    }
  }, []);

  const logout = useCallback(async () => {
    await AuthAPI.logout();
    dispatch({ type: 'LOGOUT' });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

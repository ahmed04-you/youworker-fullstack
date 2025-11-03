'use client';

/**
 * Authentication Context Provider
 *
 * Manages authentication state and provides auth methods throughout the app.
 * Automatically authenticates using the Authentik API key passed from the gateway.
 * In development, the API key is simulated via environment variables.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  getCurrentUser,
  logout as apiLogout,
  getCsrfToken,
  loginWithApiKey,
} from '../lib/api/auth';
import type { User } from '../lib/types';
import { ACTIVE_SESSION_STORAGE_KEY } from '../lib/constants';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  csrfToken: string | null;
  logout: () => Promise<void>;
  login: (apiKey: string, username?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshCsrfToken: () => Promise<string>;
  reauthenticate: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const isAuthenticated = user !== null;

  const refreshCsrfToken = useCallback(async (): Promise<string> => {
    try {
      const tokenData = await getCsrfToken();
      setCsrfToken(tokenData.csrf_token);
      return tokenData.csrf_token;
    } catch (err) {
      console.error('Failed to refresh CSRF token:', err);
      throw err;
    }
  }, []);

  /**
   * Explicit login flow requiring a manually provided API key.
   */
  const login = useCallback(
    async (apiKey: string, username?: string) => {
      try {
        setIsLoading(true);
        setError(null);

        await loginWithApiKey(apiKey, username);
        const userData = await getCurrentUser();
        setUser(userData);
        await refreshCsrfToken();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setError(message);
        setUser(null);
        setCsrfToken(null);
        console.error('Authentication error:', err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshCsrfToken]
  );

  /**
   * Logout and clear authentication
   */
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await apiLogout();
      setUser(null);
      setError(null);
      setCsrfToken(null);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logout failed';
      setError(message);
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh current user data
   */
  const refreshUser = useCallback(async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch user';
      setError(message);
      console.error('Refresh user error:', err);
      setUser(null);
    }
  }, []);

  /**
   * Re-authenticate when session expires (handles 401 errors)
   */
  const reauthenticate = useCallback(async () => {
    try {
      setUser(null);
      setCsrfToken(null);
      setIsLoading(false);
      setError('Session expired. Please sign in again.');
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      }
      throw new Error('AUTHENTICATION_REQUIRED');
    } catch (err) {
      console.error('Re-authentication failed:', err);
      throw err;
    }
  }, []);

  /**
   * Auto-login on mount - always attempt authentication using Authentik API key
   */
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // First, check if we already have a valid session
        try {
          const userData = await getCurrentUser();
          if (cancelled) {
            return;
          }
          setUser(userData);
          await refreshCsrfToken();
          return;
        } catch {
          // No valid session, continue with authentication flow
        }

      } catch (err) {
        if (!cancelled) {
          console.error('Initial authentication failed:', err);
          setUser(null);
          setCsrfToken(null);
          setError(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void initAuth();

    return () => {
      cancelled = true;
    };
  }, [refreshCsrfToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        error,
        csrfToken,
        logout,
        login,
        refreshUser,
        refreshCsrfToken,
        reauthenticate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use authentication context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

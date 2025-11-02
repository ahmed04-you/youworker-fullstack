'use client';

/**
 * Authentication Context Provider
 *
 * Manages authentication state and provides auth methods throughout the app.
 * Automatically authenticates using the Authentik API key passed from the gateway.
 * In development, the API key is simulated via environment variables.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { autoLogin, getCurrentUser, logout as apiLogout, getCsrfToken } from '../lib/api/auth';
import type { User } from '../lib/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  csrfToken: string | null;
  logout: () => Promise<void>;
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
   * Perform automatic login using the API key from Authentik (or environment in dev)
   */
  const performLogin = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      await autoLogin();
      const userData = await getCurrentUser();
      setUser(userData);
      await refreshCsrfToken();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      setUser(null);
      console.error('Auto-login failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshCsrfToken]);

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
      console.log('Re-authenticating due to expired session...');

      setUser(null);
      setCsrfToken(null);

      await performLogin();

      console.log('Re-authentication successful');
    } catch (err) {
      console.error('Re-authentication failed:', err);
      throw err;
    }
  }, [performLogin]);

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

        // Attempt auto-login with API key from Authentik (or environment in dev)
        if (!cancelled) {
          await performLogin();
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Initial authentication failed:', err);
          setUser(null);
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
  }, [performLogin, refreshCsrfToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        error,
        csrfToken,
        logout,
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

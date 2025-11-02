'use client';

/**
 * Authentication Context Provider
 *
 * Manages authentication state and provides auth methods throughout the app.
 * Automatically attempts auto-login on mount using the simulated Authentik API key.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { autoLogin, getCurrentUser, logout as apiLogout, getCsrfToken } from '../lib/api/auth';
import type { User } from '../lib/types';

interface StoredCredentials {
  apiKey: string;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  csrfToken: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshCsrfToken: () => Promise<string>;
  reauthenticate: () => Promise<void>;
  loginWithApiKey: (apiKey: string, username?: string) => Promise<void>;
  storedCredentials: StoredCredentials | null;
  clearStoredCredentials: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const LOCAL_STORAGE_KEY = 'youworker:auth:credentials';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [storedCredentials, setStoredCredentialsState] = useState<StoredCredentials | null>(null);
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);

  const isAuthenticated = user !== null;

  const persistCredentials = (creds: StoredCredentials | null) => {
    setStoredCredentialsState(creds);
    if (typeof window === 'undefined') {
      return;
    }

    if (creds) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(creds));
    } else {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  const loadStoredCredentials = () => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) {
        setStoredCredentialsState(null);
        return;
      }

      const parsed = JSON.parse(raw) as StoredCredentials;
      if (parsed?.apiKey) {
        setStoredCredentialsState(parsed);
        return;
      }

      setStoredCredentialsState(null);
    } catch {
      setStoredCredentialsState(null);
    }
  };

  const clearStoredCredentials = () => {
    persistCredentials(null);
  };

  useEffect(() => {
    loadStoredCredentials();
    setCredentialsLoaded(true);
  }, []);

  const refreshCsrfToken = async (): Promise<string> => {
    try {
      const tokenData = await getCsrfToken();
      setCsrfToken(tokenData.csrf_token);
      return tokenData.csrf_token;
    } catch (err) {
      console.error('Failed to refresh CSRF token:', err);
      throw err;
    }
  };

  const performLogin = async (
    options: { apiKey?: string; username?: string; persist?: boolean } = {},
    config: { manageLoading?: boolean } = {}
  ) => {
    const { manageLoading = true } = config;

    if (manageLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      await autoLogin({ apiKey: options.apiKey, username: options.username });
      const userData = await getCurrentUser();
      setUser(userData);
      await refreshCsrfToken();

      if (options.persist && options.apiKey) {
        persistCredentials({
          apiKey: options.apiKey,
          username: options.username && options.username.trim().length > 0 ? options.username : undefined,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      setUser(null);
      throw err;
    } finally {
      if (manageLoading) {
        setIsLoading(false);
      }
    }
  };

  /**
   * Attempt auto-login using environment-provided credentials
   */
  const login = async () => {
    await performLogin();
  };

  /**
   * Manual login with user-supplied API key
   */
  const loginWithApiKey = async (rawApiKey: string, rawUsername?: string) => {
    const apiKey = rawApiKey.trim();
    const username = (rawUsername ?? 'root').trim();

    if (!apiKey) {
      const message = 'API key is required';
      setError(message);
      throw new Error(message);
    }

    await performLogin(
      { apiKey, username, persist: true },
      { manageLoading: true }
    );
  };

  /**
   * Logout and clear authentication
   */
  const logout = async () => {
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
  };

  /**
   * Refresh current user data
   */
  const refreshUser = async () => {
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
  };

  /**
   * Re-authenticate when session expires (handles 401 errors)
   */
  const reauthenticate = async () => {
    try {
      console.log('Re-authenticating due to expired session...');

      setUser(null);
      setCsrfToken(null);

      if (storedCredentials?.apiKey) {
        await performLogin(
          {
            apiKey: storedCredentials.apiKey,
            username: storedCredentials.username,
            persist: true,
          }
        );
      } else {
        await performLogin();
      }

      console.log('Re-authentication successful');
    } catch (err) {
      console.error('Re-authentication failed:', err);
      throw err;
    }
  };

  /**
   * Auto-login on mount
   */
  useEffect(() => {
    if (!credentialsLoaded) {
      return;
    }

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

        // Attempt login with stored credentials
        if (!cancelled && storedCredentials?.apiKey) {
          try {
            await performLogin(
              {
                apiKey: storedCredentials.apiKey,
                username: storedCredentials.username,
                persist: true,
              },
              { manageLoading: false }
            );
            if (!cancelled) {
              setIsLoading(false);
            }
            return;
          } catch (err) {
            console.warn('Stored credentials failed, clearing saved API key');
            if (!cancelled) {
              persistCredentials(null);
            }
          }
        }

        // Finally, try environment-provided credentials
        await performLogin({}, { manageLoading: false });
      } catch (err) {
        if (!cancelled) {
          console.error('Initial auth failed:', err);
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
  }, [credentialsLoaded]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        error,
        csrfToken,
        login,
        logout,
        refreshUser,
        refreshCsrfToken,
        reauthenticate,
        loginWithApiKey,
        storedCredentials,
        clearStoredCredentials,
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

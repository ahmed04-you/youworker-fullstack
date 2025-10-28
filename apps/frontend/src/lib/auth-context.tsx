"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { apiGet, apiPost } from "@/lib/api-client";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  username: string | null;
  login: (apiKey: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  attemptAutoLogin: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimeout = () => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  };

  const activateGuestSession = () => {
    clearRefreshTimeout();
    setIsAuthenticated(true);
    setUsername("guest");
  };

  const scheduleRefresh = (expiresIn?: number | null) => {
    clearRefreshTimeout();
    const ttlSeconds = (expiresIn ?? 1800) - 60;
    if (ttlSeconds > 0) {
      refreshTimeoutRef.current = setTimeout(() => {
        void refreshToken();
      }, ttlSeconds * 1000);
    }
  };

  const checkAuth = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const data = await apiGet<{ username: string }>("/v1/auth/me");
      setIsAuthenticated(true);
      setUsername(data.username);
      scheduleRefresh();
      return true;
    } catch (error) {
      console.error("Auth check failed:", error);
      clearRefreshTimeout();
      setIsAuthenticated(false);
      setUsername(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const attemptAutoLogin = async (): Promise<boolean> => {
    try {
      const data = await apiPost<{ username: string; expires_in: number }>(
        "/v1/auth/auto-login"
      );
      setIsAuthenticated(true);
      setUsername(data.username);
      scheduleRefresh(data.expires_in);
      return true;
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("Auto-login skipped:", error);
      }
      return false;
    }
  };

  const login = async (apiKey: string): Promise<void> => {
    try {
      const data = await apiPost<{ username: string; expires_in: number }>(
        "/v1/auth/login",
        {
          api_key: apiKey,
        }
      );
      setIsAuthenticated(true);
      setUsername(data.username);
      scheduleRefresh(data.expires_in);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiPost("/v1/auth/logout");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      clearRefreshTimeout();
      setIsAuthenticated(false);
      setUsername(null);
    }
  };

  const refreshToken = async (): Promise<void> => {
    try {
      const data = await apiPost<{ expires_in: number }>("/v1/auth/refresh");
      scheduleRefresh(data.expires_in);
    } catch (error) {
      console.error("Token refresh failed:", error);
      await logout();
    }
  };

  // First useEffect: Mark component as mounted (runs after hydration)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Second useEffect: Run auth bootstrap only after component is mounted
  useEffect(() => {
    if (!isMounted) {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      const initialAuth = await checkAuth();
      if (!initialAuth && !cancelled) {
        setIsLoading(true);
        const auto = await attemptAutoLogin();
        if (!cancelled && !auto) {
          activateGuestSession();
        }
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void bootstrap();

    return () => {
      cancelled = true;
      clearRefreshTimeout();
    };
  }, [isMounted]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        username,
        login,
      logout,
      checkAuth,
      attemptAutoLogin,
    }}
  >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiGet, apiPost } from "@/lib/api-client";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  username: string | null;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const checkAuth = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const data = await apiGet<{ username: string }>("/v1/auth/me");
      setIsAuthenticated(true);
      setUsername(data.username);
      return true;
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
      setUsername(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const attemptAuthentikLogin = async (): Promise<boolean> => {
    try {
      // Send the API key as the Authentik header for simulated SSO in development
      const apiKey = process.env.NEXT_PUBLIC_API_KEY;
      const headers: Record<string, string> = {};

      if (apiKey) {
        headers["x-authentik-api-key"] = apiKey;
      }

      const data = await apiPost<{ username: string; expires_in: number }>(
        "/v1/auth/auto-login",
        undefined,
        { headers }
      );
      setIsAuthenticated(true);
      setUsername(data.username);
      return true;
    } catch (error) {
      console.error("Authentik SSO authentication failed:", error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiPost("/v1/auth/logout");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsAuthenticated(false);
      setUsername(null);
    }
  };

  // First useEffect: Mark component as mounted (runs after hydration)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Second useEffect: Authentik SSO bootstrap - no guest mode fallback
  useEffect(() => {
    if (!isMounted) {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      // Try to restore existing session
      const existingSession = await checkAuth();

      // If no existing session, attempt Authentik SSO authentication
      if (!existingSession && !cancelled) {
        setIsLoading(true);
        const authentikAuth = await attemptAuthentikLogin();

        if (!authentikAuth && !cancelled) {
          // No guest mode fallback - user must authenticate via Authentik
          console.warn("Authentication required: Authentik SSO not configured or unavailable");
          setIsAuthenticated(false);
          setUsername(null);
        }

        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isMounted]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        username,
        logout,
        checkAuth,
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

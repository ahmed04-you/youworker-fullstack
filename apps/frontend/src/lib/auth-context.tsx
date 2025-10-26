"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  isAuthenticated: boolean;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);

  useEffect(() => {
    // Load API key from localStorage on mount
    const storedKey = localStorage.getItem("youworker-api-key");
    if (storedKey) {
      setApiKeyState(storedKey);
    }
  }, []);

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem("youworker-api-key", key);
  };

  const clearAuth = () => {
    setApiKeyState(null);
    localStorage.removeItem("youworker-api-key");
  };

  const isAuthenticated = !!apiKey;

  return (
    <AuthContext.Provider value={{ apiKey, setApiKey, isAuthenticated, clearAuth }}>
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
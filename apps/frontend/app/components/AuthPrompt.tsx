"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

interface AuthPromptProps {
  title?: string;
  description?: string;
}

export default function AuthPrompt({
  title = "Sign in to continue",
  description = "Provide the simulated Authentik API key to authenticate.",
}: AuthPromptProps) {
  const { login, isLoading, error } = useAuth();
  const [apiKey, setApiKey] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);

  const helperText = useMemo(() => {
    if (localError) {
      return localError;
    }
    if (error) {
      return error;
    }
    return null;
  }, [error, localError]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedKey = apiKey.trim();
      if (!trimmedKey) {
        setLocalError("API key is required.");
        return;
      }

      try {
        setLocalError(null);
        await login(trimmedKey, username.trim() || undefined);
        setApiKey("");
        setUsername("");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Authentication failed. Please try again.";
        setLocalError(message);
      }
    },
    [apiKey, login, username]
  );

  return (
    <div className="card auth-card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        <p className="card-subtitle">{description}</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="form-label" htmlFor="auth-api-key">
          Authentik API Key
        </label>
        <input
          id="auth-api-key"
          type="password"
          className="input"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter API key"
          disabled={isLoading}
          autoComplete="off"
        />

        <label className="form-label" htmlFor="auth-username">
          Username <span className="muted-text">(optional)</span>
        </label>
        <input
          id="auth-username"
          type="text"
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Defaults to root"
          disabled={isLoading}
        />

        {helperText && <div className="form-error">{helperText}</div>}

        <button className="btn btn-primary" type="submit" disabled={isLoading}>
          {isLoading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

interface AuthPromptProps {
  title?: string;
  description?: string;
}

export default function AuthPrompt({
  title = "Accedi a YouWorker.ai",
  description = "Inserisci la tua API key per continuare",
}: AuthPromptProps) {
  const { login, isLoading, error } = useAuth();
  const [apiKey, setApiKey] = useState<string>("");
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
        setLocalError("L'API key è obbligatoria.");
        return;
      }

      try {
        setLocalError(null);
        await login(trimmedKey, undefined);
        setApiKey("");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Autenticazione fallita. Riprova.";
        setLocalError(message);
      }
    },
    [apiKey, login]
  );

  return (
    <div className="auth-card-centered">
      <div className="auth-header">
        <h2 className="auth-title">{title}</h2>
        <p className="auth-subtitle">{description}</p>
      </div>

      <form className="auth-form-modern" onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label" htmlFor="auth-api-key">
            API Key
          </label>
          <input
            id="auth-api-key"
            type="password"
            className="input-modern"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Inserisci la tua API key"
            disabled={isLoading}
            autoComplete="off"
          />
        </div>

        {helperText && <div className="form-error-modern">{helperText}</div>}

        <button className="btn-modern btn-modern-primary" type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <svg className="btn-spinner" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"></path>
              </svg>
              Accesso in corso...
            </>
          ) : (
            <>
              <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              Accedi
            </>
          )}
        </button>
      </form>
    </div>
  );
}

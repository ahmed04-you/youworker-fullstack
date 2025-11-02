"use client";

import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { ApiClientError } from "../../lib/api/client";

interface AuthPromptProps {
  title?: string;
  description?: string;
}

export default function AuthPrompt({
  title = "Authenticate to continue",
  description = "Enter a valid Authentik API key to establish a session. The key is forwarded as the X-Authentik-Api-Key header so it should match the backend's ROOT_API_KEY (or a user-specific key).",
}: AuthPromptProps) {
  const {
    loginWithApiKey,
    isLoading,
    error,
    storedCredentials,
    clearStoredCredentials,
  } = useAuth();

  const [apiKey, setApiKey] = useState(storedCredentials?.apiKey ?? "");
  const [username, setUsername] = useState(storedCredentials?.username ?? "root");
  const [localError, setLocalError] = useState<string | null>(null);
  const [justCleared, setJustCleared] = useState(false);

  const combinedError = useMemo(() => localError || error, [localError, error]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    setJustCleared(false);

    try {
      await loginWithApiKey(apiKey, username);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setLocalError(err.apiError?.message || err.message);
      } else if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError(String(err));
      }
    }
  };

  const handleClearStored = () => {
    clearStoredCredentials();
    setApiKey("");
    setUsername("root");
    setJustCleared(true);
  };

  return (
    <div className="card auth-card">
      <div>
        <h2 className="card-title">{title}</h2>
        <p className="card-subtitle">{description}</p>
      </div>

      {combinedError && (
        <div className="banner banner-error">
          {combinedError}
        </div>
      )}

      {justCleared && (
        <div className="banner banner-success">
          Saved credentials cleared. Enter a new key below.
        </div>
      )}

      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>API key</span>
          <textarea
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Paste your Authentik API key"
            rows={3}
            required
          />
        </label>

        <label className="form-field">
          <span>Username (optional)</span>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="root"
          />
        </label>

        <div className="auth-actions">
          <button className="btn btn-primary" type="submit" disabled={isLoading}>
            {isLoading ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClearStored}
            disabled={isLoading || !storedCredentials}
          >
            Clear saved credentials
          </button>
        </div>
      </form>

      <p className="muted-text-small">
        Tip: when running locally, align `NEXT_PUBLIC_API_KEY` with the backend&apos;s `ROOT_API_KEY` (or paste the actual key above).
      </p>
    </div>
  );
}

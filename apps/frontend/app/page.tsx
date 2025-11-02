"use client";

import { useAuth } from "../contexts/AuthContext";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading while authenticating
  if (isLoading) {
    return (
      <main className="dashboard-page">
        <div className="card">
          <div className="loading-state">Authenticating...</div>
        </div>
      </main>
    );
  }

  // Show error if authentication failed
  if (!isAuthenticated) {
    return (
      <main className="dashboard-page">
        <div className="card">
          <div className="banner banner-error">
            Authentication failed. Please check your configuration and try again.
          </div>
        </div>
      </main>
    );
  }

  // Show home page content
  return (
    <main className="dashboard-page">
      <div className="card">
        <h1 style={{ marginBottom: '20px', fontSize: '24px', fontWeight: '600' }}>Welcome to YouWorker.ai</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Your AI-powered workspace assistant
        </p>
      </div>
    </main>
  );
}

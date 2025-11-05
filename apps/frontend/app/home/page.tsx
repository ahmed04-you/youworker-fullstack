"use client";

import { useAuth } from "../../contexts/AuthContext";
import AuthPrompt from "../components/AuthPrompt";
import Image from "next/image";
import Link from "next/link";

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

  // Show login form if authentication required
  if (!isAuthenticated) {
    return (
      <main className="landing-page">
        <section className="hero-section-compact">
          {/* Decorative Elements */}
          <div className="hero-decoration hero-decoration-1"></div>
          <div className="hero-decoration hero-decoration-2"></div>

          <div className="hero-content-compact">
            <div className="logo-container-compact">
              <Image
                src="/youco-logo.svg"
                alt="youco"
                width={240}
                height={128}
                priority
                className="hero-logo"
              />
            </div>
            <AuthPrompt />
          </div>
        </section>
      </main>
    );
  }

  // Show home page content
  return (
    <main className="landing-page">
      <section className="hero-section-compact">
        {/* Decorative Elements */}
        <div className="hero-decoration hero-decoration-1"></div>
        <div className="hero-decoration hero-decoration-2"></div>

        <div className="hero-content-compact">
          <div className="logo-container-compact">
            <Image
              src="/youco-logo.svg"
              alt="youco"
              width={240}
              height={128}
              priority
              className="hero-logo"
            />
          </div>

          <h1 className="hero-title-compact">
            Your Company for Innovation
          </h1>

          <p className="hero-subtitle-compact">
            Empowering businesses with cutting-edge AI solutions
          </p>

          <div className="features-compact">
            <div className="feature-compact">
              <svg className="feature-icon-compact" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>Intelligent Chat</span>
            </div>

            <div className="feature-compact">
              <svg className="feature-icon-compact" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span>Document Analysis</span>
            </div>

            <div className="feature-compact">
              <svg className="feature-icon-compact" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18"></path>
                <path d="m19 9-5 5-4-4-3 3"></path>
              </svg>
              <span>Real-time Analytics</span>
            </div>

            <div className="feature-compact">
              <svg className="feature-icon-compact" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>Secure & Private</span>
            </div>
          </div>

          <div className="hero-cta-compact">
            <Link href="/chats" className="cta-button primary">
              <svg className="cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Start Chatting
            </Link>
            <Link href="/analytics" className="cta-button secondary">
              <svg className="cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18"></path>
                <path d="m19 9-5 5-4-4-3 3"></path>
              </svg>
              View Analytics
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function RedirectLanding() {
  const [seconds, setSeconds] = useState(5);
  const router = useRouter();

  useEffect(() => {
    // Countdown timer
    const countdown = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdown);
          window.location.href = "https://youco.eu";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, []);

  const handleContinue = () => {
    router.push("/home");
  };

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
            Benvenuto su YouCo
          </h1>

          <div className="redirect-message">
            <p className="hero-subtitle-compact">
              Stai per essere reindirizzato a youco.eu tra
            </p>
            <div className="countdown-display">
              {seconds}
            </div>
            <p className="hero-subtitle-compact">
              {seconds === 1 ? "secondo" : "secondi"}
            </p>
          </div>

          <div className="hero-cta-compact" style={{ marginTop: "32px" }}>
            <button onClick={handleContinue} className="cta-button primary">
              <svg className="cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"></path>
              </svg>
              Continua su YouWorker.ai
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

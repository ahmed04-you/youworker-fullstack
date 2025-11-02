"use client";

import { useState, useEffect, useRef } from "react";

interface ChatComposerProps {
  onFirstSend?: () => void;
  onSend?: (message: string) => void;
  isLoading?: boolean;
}

export default function ChatComposer({ onFirstSend, onSend, isLoading = false }: ChatComposerProps) {
  const [message, setMessage] = useState("");
  const [hasSent, setHasSent] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!hasSent) return; // Only handle scroll after first message

      const container = chatContainerRef.current?.parentElement;
      if (!container) return;

      const currentScrollY = container.scrollTop;

      // Scrolling up - hide composer
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
      }
      // Scrolling down - show composer
      else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    const container = chatContainerRef.current?.parentElement;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [lastScrollY, hasSent]);

  const handleSend = () => {
    if (!message.trim() || isLoading) return;

    // Call parent's onSend callback
    if (onSend) {
      onSend(message.trim());
    }

    if (!hasSent && onFirstSend) {
      onFirstSend();
    }
    setHasSent(true);
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <label className={`composer-label ${hasSent ? "fade-out" : ""}`}>
        What can I help with?
      </label>

      <div
        ref={chatContainerRef}
        className={`chat-composer ${hasSent ? "sent" : ""} ${!isVisible ? "hidden" : ""}`}
      >
        <textarea
          className="composer-input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
        />

        <div className="composer-controls">
          <button
            className={`control-btn audio-toggle ${isAudioEnabled ? "active" : ""}`}
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            title="Toggle audio"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </button>

          <div className="control-right">
            <button
              className={`control-btn mic-btn ${isPushToTalkActive ? "active" : ""}`}
              onMouseDown={() => setIsPushToTalkActive(true)}
              onMouseUp={() => setIsPushToTalkActive(false)}
              onMouseLeave={() => setIsPushToTalkActive(false)}
              onTouchStart={() => setIsPushToTalkActive(true)}
              onTouchEnd={() => setIsPushToTalkActive(false)}
              title="Push to talk"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <button
              className="control-btn send-btn"
              onClick={handleSend}
              disabled={!message.trim() || isPushToTalkActive || isLoading}
              title="Send message"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

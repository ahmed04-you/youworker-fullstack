"use client";

import { useState, useEffect, useRef } from "react";

interface ChatComposerProps {
  onFirstSend?: () => void;
  onSend?: (message: string) => void;
  onAudioSend?: (audioBlob: Blob, expectAudio: boolean) => void;
  isLoading?: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  hasMessages?: boolean;
  expectAudio?: boolean;
  onExpectAudioChange?: (enabled: boolean) => void;
  enableWeb?: boolean;
  onEnableWebChange?: (enabled: boolean) => void;
}

export default function ChatComposer({
  onFirstSend,
  onSend,
  onAudioSend,
  isLoading = false,
  scrollContainerRef,
  hasMessages = false,
  expectAudio = false,
  onExpectAudioChange,
  enableWeb = true,
  onEnableWebChange
}: ChatComposerProps) {
  const [message, setMessage] = useState("");
  const [hasSent, setHasSent] = useState(hasMessages);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isAutoScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update hasSent when hasMessages changes (e.g., when messages load or cleared)
  useEffect(() => {
    if (hasMessages && !hasSent) {
      setHasSent(true);
    } else if (!hasMessages && hasSent) {
      setHasSent(false);
    }
  }, [hasMessages, hasSent]);

  useEffect(() => {
    const handleScroll = () => {
      if (!hasSent) return; // Only handle scroll after first message

      const scrollContainer = scrollContainerRef?.current;
      if (!scrollContainer) return;

      // Ignore programmatic/auto scrolls
      if (isAutoScrollingRef.current) {
        return;
      }

      const currentScrollY = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;
      const distanceFromBottom = scrollHeight - clientHeight - currentScrollY;

      // Only hide composer if user scrolls up significantly (more than 100px from bottom)
      if (distanceFromBottom > 100) {
        setIsVisible(false);
      } else {
        // Show composer when near bottom
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    const scrollContainer = scrollContainerRef?.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }
  }, [lastScrollY, hasSent, scrollContainerRef]);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Send audio to parent for transcription
        if (onAudioSend) {
          onAudioSend(audioBlob, expectAudio);
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Reset state
        setIsRecording(false);
        setIsPushToTalkActive(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsPushToTalkActive(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handlePushToTalkStart = () => {
    setIsPushToTalkActive(true);
    startRecording();
  };

  const handlePushToTalkEnd = () => {
    setIsPushToTalkActive(false);
    stopRecording();
  };

  const handleAudioToggle = () => {
    if (onExpectAudioChange) {
      onExpectAudioChange(!expectAudio);
    }
  };

  const handleWebToggle = () => {
    if (onEnableWebChange) {
      onEnableWebChange(!enableWeb);
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
          <div className="control-left">
            <button
              className={`control-btn audio-toggle ${expectAudio ? "active" : ""}`}
              onClick={handleAudioToggle}
              title="Expect audio response"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>

            <button
              className={`control-btn web-toggle ${enableWeb ? "active" : ""}`}
              onClick={handleWebToggle}
              title="Enable web search"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </button>
          </div>

          <div className="control-right">
            <button
              className={`control-btn mic-btn ${isPushToTalkActive ? "active" : ""}`}
              onMouseDown={handlePushToTalkStart}
              onMouseUp={handlePushToTalkEnd}
              onMouseLeave={handlePushToTalkEnd}
              onTouchStart={handlePushToTalkStart}
              onTouchEnd={handlePushToTalkEnd}
              title="Push to talk"
              disabled={isLoading}
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

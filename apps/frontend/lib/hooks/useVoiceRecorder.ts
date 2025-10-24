/**
 * Voice recording hook with comprehensive error handling and browser compatibility checks.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface VoiceRecorderOptions {
  sampleRate?: number;
  onError?: (error: Error) => void;
  onStart?: () => void;
  onStop?: (audioBlob: Blob) => void;
  maxDuration?: number; // in milliseconds
}

export interface VoiceRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  error: Error | null;
  isSupported: boolean;
}

export interface VoiceRecorderControls {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
}

export function useVoiceRecorder(
  options: VoiceRecorderOptions = {}
): [VoiceRecorderState, VoiceRecorderControls] {
  const {
    sampleRate = 16000,
    onError,
    onStart,
    onStop,
    maxDuration = 300000, // 5 minutes default
  } = options;

  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    error: null,
    isSupported: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.onerror = null;
      mediaRecorderRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    chunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      // Check browser support
      if (!navigator.mediaDevices?.getUserMedia) {
        const error = new Error(
          'MediaRecorder API is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.'
        );
        setState((s) => ({ ...s, error }));
        onError?.(error);
        return;
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;

      // Create MediaRecorder
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Setup event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event: Event) => {
        const error = new Error(`MediaRecorder error: ${(event as any).error || 'Unknown error'}`);
        setState((s) => ({ ...s, error, isRecording: false }));
        onError?.(error);
        cleanup();
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();

      // Start duration tracker
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setState((s) => ({ ...s, duration: elapsed }));

        // Auto-stop at max duration
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 100);

      setState((s) => ({
        ...s,
        isRecording: true,
        isPaused: false,
        duration: 0,
        error: null,
      }));

      onStart?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording');
      setState((s) => ({ ...s, error, isRecording: false }));
      onError?.(error);
      cleanup();
    }
  }, [sampleRate, maxDuration, onError, onStart, cleanup]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setState((s) => ({ ...s, isRecording: false, isPaused: false, duration: 0 }));
        onStop?.(blob);
        cleanup();
        resolve(blob);
      };

      mediaRecorder.stop();

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    });
  }, [onStop, cleanup]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setState((s) => ({ ...s, isPaused: true }));

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;

    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setState((s) => ({ ...s, isPaused: false }));

      // Resume duration tracker
      const pausedDuration = state.duration;
      startTimeRef.current = Date.now() - pausedDuration;

      durationIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setState((s) => ({ ...s, duration: elapsed }));

        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 100);
    }
  }, [state.duration, maxDuration, stopRecording]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    setState((s) => ({ ...s, isRecording: false, isPaused: false, duration: 0 }));
    cleanup();
  }, [cleanup]);

  return [
    state,
    {
      startRecording,
      stopRecording,
      pauseRecording,
      resumeRecording,
      cancelRecording,
    },
  ];
}

/**
 * Get the first supported MIME type for MediaRecorder.
 */
function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/wav',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  // Fallback to empty string (browser will choose)
  return '';
}

/**
 * Convert audio blob to base64 PCM16 format.
 */
export async function audioBlobToPCM16Base64(
  blob: Blob,
  targetSampleRate: number = 16000
): Promise<string> {
  const audioContext = new AudioContext({ sampleRate: targetSampleRate });

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get audio data as Float32Array
    const channelData = audioBuffer.getChannelData(0);

    // Convert to PCM16 (Int16)
    const pcm16 = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    // Convert to base64
    const uint8Array = new Uint8Array(pcm16.buffer);
    const base64 = btoa(String.fromCharCode(...uint8Array));

    return base64;
  } finally {
    await audioContext.close();
  }
}

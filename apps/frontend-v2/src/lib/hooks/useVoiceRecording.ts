'use client'

import { useState, useRef, useCallback } from 'react'
import { errorTracker } from '@/src/lib/utils'

export type RecordingState = 'idle' | 'recording' | 'processing' | 'error'

interface UseVoiceRecordingOptions {
  onRecordingComplete?: (audioBlob: Blob) => void
  onError?: (error: Error) => void
  maxDuration?: number // in milliseconds
}

export function useVoiceRecording({
  onRecordingComplete,
  onError,
  maxDuration = 120000 // 2 minutes default
}: UseVoiceRecordingOptions = {}) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const checkBrowserSupport = useCallback(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Audio recording is not supported in this browser')
    }
    if (!window.MediaRecorder) {
      throw new Error('MediaRecorder API is not supported in this browser')
    }
  }, [])

  const setupAudioVisualization = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const microphone = audioContext.createMediaStreamSource(stream)

      analyser.fftSize = 256
      microphone.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser

      // Start monitoring audio levels
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const checkLevel = () => {
        if (analyserRef.current && recordingState === 'recording') {
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel(Math.min(100, (average / 128) * 100))
          animationFrameRef.current = requestAnimationFrame(checkLevel)
        }
      }

      checkLevel()
    } catch (error) {
      errorTracker.captureError(error as Error, {
        component: 'useVoiceRecording',
        action: 'setupAudioVisualization'
      })
    }
  }, [recordingState])

  const startRecording = useCallback(async () => {
    try {
      checkBrowserSupport()

      setRecordingState('recording')
      setDuration(0)
      audioChunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      // Setup audio visualization
      setupAudioVisualization(stream)

      const options: MediaRecorderOptions = {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      }

      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType })

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())

        // Cleanup audio context
        if (audioContextRef.current) {
          audioContextRef.current.close()
          audioContextRef.current = null
        }

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }

        setRecordingState('idle')
        setAudioLevel(0)

        if (onRecordingComplete) {
          onRecordingComplete(audioBlob)
        }
      }

      mediaRecorder.onerror = (_event) => {
        const error = new Error('Recording failed')
        setRecordingState('error')
        if (onError) {
          onError(error)
        }
      }

      mediaRecorder.start(100) // Collect data every 100ms

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setDuration(prev => prev + 100)
      }, 100)

      // Set max duration timeout
      maxDurationTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          setRecordingState('processing')
          mediaRecorderRef.current.stop()

          // Clear intervals
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current)
            durationIntervalRef.current = null
          }
        }
      }, maxDuration)

    } catch (error) {
      setRecordingState('error')
      const errorMessage = error instanceof Error ? error : new Error('Failed to start recording')
      if (onError) {
        onError(errorMessage)
      }
    }
  }, [checkBrowserSupport, setupAudioVisualization, onRecordingComplete, onError, maxDuration])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setRecordingState('processing')
      mediaRecorderRef.current.stop()

      // Clear intervals and timeouts
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }

      if (maxDurationTimeoutRef.current) {
        clearTimeout(maxDurationTimeoutRef.current)
        maxDurationTimeoutRef.current = null
      }
    }
  }, [])

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      const stream = mediaRecorderRef.current.stream
      stream.getTracks().forEach(track => track.stop())

      // Cleanup
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }

      if (maxDurationTimeoutRef.current) {
        clearTimeout(maxDurationTimeoutRef.current)
        maxDurationTimeoutRef.current = null
      }

      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      mediaRecorderRef.current = null
      audioChunksRef.current = []
    }

    setRecordingState('idle')
    setDuration(0)
    setAudioLevel(0)
  }, [])

  return {
    recordingState,
    duration,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording: recordingState === 'recording',
    isProcessing: recordingState === 'processing',
    hasError: recordingState === 'error'
  }
}

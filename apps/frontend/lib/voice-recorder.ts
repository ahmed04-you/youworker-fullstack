import { clamp } from "@/lib/utils"

type RecorderCallbacks = {
  onAudioLevel?: (level: number) => void
  onStart?: () => void
  onStop?: () => void
}

/**
 * Lightweight utility to capture microphone audio and export PCM16 buffers.
 */
export class VoiceRecorder {
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private processorNode: ScriptProcessorNode | null = null
  private buffers: Float32Array[] = []
  private recording = false
  private callbacks: RecorderCallbacks | null = null

  constructor(public readonly sampleRate = 16000) {}

  get isRecording() {
    return this.recording
  }

  async start(callbacks: RecorderCallbacks = {}) {
    if (this.recording) {
      return
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      throw new Error("L'accesso al microfono non è supportato su questo dispositivo.")
    }

    this.callbacks = callbacks
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
    })

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    this.audioContext = new AudioContextCtor()
    const actualSampleRate = this.audioContext.sampleRate

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1)

    this.processorNode.onaudioprocess = (event) => {
      if (!this.recording) return

      const inputBuffer = event.inputBuffer.getChannelData(0)
      this.buffers.push(new Float32Array(inputBuffer))

      if (this.callbacks?.onAudioLevel) {
        let sum = 0
        for (let i = 0; i < inputBuffer.length; i += 1) {
          sum += inputBuffer[i] * inputBuffer[i]
        }
        const rms = Math.sqrt(sum / inputBuffer.length)
        this.callbacks.onAudioLevel(clamp(rms, 0, 1))
      }
    }

    this.sourceNode.connect(this.processorNode)
    this.processorNode.connect(this.audioContext.destination)

    this.recording = true
    this.callbacks.onStart?.()

    // Stash sample rate used for downsampling on stop.
    this.actualSampleRate = actualSampleRate
  }

  private actualSampleRate: number | null = null

  async stop(): Promise<Uint8Array> {
    if (!this.recording) {
      throw new Error("Registrazione non attiva.")
    }

    this.recording = false
    this.callbacks?.onStop?.()

    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode.onaudioprocess = null
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect()
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop()
      }
    }

    const merged = this.mergeBuffers(this.buffers)
    const downsampled = this.downsampleBuffer(
      merged,
      this.actualSampleRate ?? this.sampleRate,
      this.sampleRate,
    )
    const pcm16 = this.encodePCM16(downsampled)

    this.cleanup()

    return pcm16
  }

  async dispose() {
    if (this.recording) {
      try {
        await this.stop()
      } catch {
        // ignore failures during disposal
      }
    } else {
      this.cleanup()
    }
  }

  private cleanup() {
    this.processorNode = null
    this.sourceNode = null
    if (this.audioContext) {
      this.audioContext.close().catch(() => undefined)
    }
    this.audioContext = null
    this.mediaStream = null
    this.buffers = []
    this.callbacks = null
    this.actualSampleRate = null
  }

  private mergeBuffers(buffers: Float32Array[]): Float32Array {
    if (buffers.length === 1) {
      return buffers[0]
    }
    const totalLength = buffers.reduce((acc, buffer) => acc + buffer.length, 0)
    const result = new Float32Array(totalLength)
    let offset = 0
    for (const buffer of buffers) {
      result.set(buffer, offset)
      offset += buffer.length
    }
    return result
  }

  private downsampleBuffer(buffer: Float32Array, rate: number, outRate: number): Float32Array {
    if (outRate === rate) {
      return buffer
    }
    const ratio = rate / outRate
    const newLength = Math.floor(buffer.length / ratio)
    const result = new Float32Array(newLength)
    let offset = 0
    for (let i = 0; i < newLength; i += 1) {
      let nextOffset = Math.floor((i + 1) * ratio)
      if (nextOffset > buffer.length) {
        nextOffset = buffer.length
      }
      let sum = 0
      let count = 0
      for (let j = offset; j < nextOffset; j += 1) {
        sum += buffer[j]
        count += 1
      }
      result[i] = count > 0 ? sum / count : 0
      offset = nextOffset
    }
    return result
  }

  private encodePCM16(buffer: Float32Array): Uint8Array {
    const data = new DataView(new ArrayBuffer(buffer.length * 2))
    let offset = 0
    for (let i = 0; i < buffer.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, buffer[i]))
      data.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
    return new Uint8Array(data.buffer)
  }
}

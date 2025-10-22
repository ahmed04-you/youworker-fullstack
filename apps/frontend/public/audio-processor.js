/**
 * AudioWorkletProcessor for capturing microphone input
 * Replaces deprecated ScriptProcessorNode with modern Web Audio API
 */

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(0)
    this.samplesPer20ms = Math.floor(sampleRate * 0.02) // 20ms frames at current sample rate

    // Listen for messages from main thread
    this.port.onmessage = (event) => {
      if (event.data === 'reset') {
        this.buffer = new Float32Array(0)
      }
    }
  }

  /**
   * Calculate RMS (Root Mean Square) audio level
   * @param {Float32Array} data - Audio samples
   * @returns {number} - RMS level (0-1)
   */
  calculateRMS(data) {
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i]
    }
    return Math.sqrt(sum / data.length)
  }

  /**
   * Process audio in 128-sample chunks (Web Audio quantum)
   * @param {Float32Array[][]} inputs - Array of input channels
   * @param {Float32Array[][]} outputs - Array of output channels (unused)
   * @param {object} parameters - AudioParam values (unused)
   * @returns {boolean} - true to keep processor alive
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0]

    // If no input, keep running
    if (!input || !input[0]) {
      return true
    }

    const channelData = input[0] // Mono input

    // Calculate and send audio level
    const rms = this.calculateRMS(channelData)
    const level = Math.min(100, Math.floor(rms * 500)) // Scale to 0-100
    this.port.postMessage({
      type: 'audiolevel',
      level: level
    })

    // Accumulate samples
    const newBuffer = new Float32Array(this.buffer.length + channelData.length)
    newBuffer.set(this.buffer, 0)
    newBuffer.set(channelData, this.buffer.length)
    this.buffer = newBuffer

    // Send 20ms frames to main thread
    let offset = 0
    while (this.buffer.length - offset >= this.samplesPer20ms) {
      const frame = this.buffer.subarray(offset, offset + this.samplesPer20ms)

      // Send frame to main thread
      this.port.postMessage({
        type: 'audioframe',
        data: frame,
        timestamp: currentTime
      })

      offset += this.samplesPer20ms
    }

    // Keep remaining samples for next iteration
    this.buffer = this.buffer.subarray(offset)

    // Return true to keep processor alive
    return true
  }
}

// Register the processor
registerProcessor('audio-capture-processor', AudioCaptureProcessor)

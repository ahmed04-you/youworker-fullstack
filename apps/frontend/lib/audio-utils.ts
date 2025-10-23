/**
 * Convert a Uint8Array containing PCM16 audio into a base64 string.
 */
export function uint8ToBase64(buffer: Uint8Array): string {
  if (buffer.length === 0) {
    return ""
  }

  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/**
 * Play a WAV audio payload encoded as base64 and return the audio element.
 */
export async function playBase64Wav(base64: string): Promise<HTMLAudioElement> {
  if (typeof window === "undefined") {
    throw new Error("Audio playback is only available in the browser.")
  }

  const audio = new Audio(`data:audio/wav;base64,${base64}`)
  audio.crossOrigin = "anonymous"

  await audio.play()
  return audio
}

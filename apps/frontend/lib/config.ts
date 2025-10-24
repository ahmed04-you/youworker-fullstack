import { API_BASE_URL } from "./env"

// API base URL
export const API_BASE = API_BASE_URL

// Headers for streaming requests
const API_KEY = process.env.NEXT_PUBLIC_API_KEY
if (!API_KEY) {
  // Surface a clear warning during build/dev so missing credentials don't manifest as 401s only at runtime.
  console.warn("[config] NEXT_PUBLIC_API_KEY is not set; protected API requests will return 401.")
}
export const STREAM_HEADERS = {
  Accept: "text/event-stream",
  "Content-Type": "application/json",
  ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
} as const

// Heartbeat timeout (set slightly above backend heartbeat interval)
// Backend typically sends heartbeats every 15-30s, so we set timeout to 45s
export const HEARTBEAT_TIMEOUT_MS = 45000

import { API_BASE, STREAM_HEADERS } from "./config"
import type {
  ChatRequest,
  UnifiedChatRequestPayload,
  ChatSseEvent,
  TokenEvent,
  ToolEvent,
  LogEvent,
  DoneEvent,
} from "./types"

/**
 * Callbacks for handling SSE events from the chat stream
 */
export interface StreamCallbacks {
  onToken?: (data: TokenEvent["data"]) => void
  onTool?: (data: ToolEvent["data"]) => void
  onLog?: (data: LogEvent["data"]) => void
  onHeartbeat?: () => void
  onDone?: (data: DoneEvent["data"]) => void
  onError?: (error: Error) => void
}

/**
 * Return type for streamChat - provides a close function to abort the stream
 */
export interface StreamController {
  close: () => void
}

/**
 * Parse a single SSE message from buffered lines
 * SSE format:
 *   event: <event_name>
 *   data: <json_data>
 *   data: <continuation>
 *   (blank line)
 */
function parseSSEMessage(lines: string[]): { event: string; data: string } | null {
  let event = "message" // default event type
  const dataLines: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "") // normalize CRLF endings

    if (line.startsWith("event:")) {
      event = line.slice(6).trim()
    } else if (line.startsWith("data:")) {
      // Keep payload spacing intact other than removing the initial field prefix
      dataLines.push(line.slice(5).trimStart())
    }
    // Ignore comments (lines starting with :) and other fields
  }

  if (dataLines.length === 0) {
    return null
  }

  // Join multiple data lines with newline
  const data = dataLines.join("\n")
  return { event, data }
}

/**
 * Stream chat messages using fetch + ReadableStream
 * Manually parses SSE frames over POST response body
 *
 * @param request - Chat request payload
 * @param callbacks - Event handlers for different SSE event types
 * @returns StreamController with close() method to abort the stream
 */
export async function streamChat(request: ChatRequest | UnifiedChatRequestPayload, callbacks: StreamCallbacks): Promise<StreamController> {
  const abortController = new AbortController()

  // Start the fetch request
  ;(async () => {
    try {
      const response = await fetch(`${API_BASE}/v1/unified-chat`, {
        method: "POST",
        headers: STREAM_HEADERS,
        body: JSON.stringify(request),
        signal: abortController.signal,
      })

      // Check response status
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Errore sconosciuto")
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      // Ensure we have a readable body
      if (!response.body) {
        throw new Error("Il corpo della risposta è nullo")
      }

      // Read the stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        // Decode chunk and add to buffer
        const decoded = decoder.decode(value, { stream: true })
        buffer += decoded

        // Process complete SSE messages (separated by double newlines, including CRLF)
        while (true) {
          const lfIndex = buffer.indexOf("\n\n")
          const crlfIndex = buffer.indexOf("\r\n\r\n")

          let delimiterIndex = -1
          let delimiterLength = 0

          if (lfIndex !== -1 && (crlfIndex === -1 || lfIndex < crlfIndex)) {
            delimiterIndex = lfIndex
            delimiterLength = 2
          } else if (crlfIndex !== -1) {
            delimiterIndex = crlfIndex
            delimiterLength = 4
          }

          if (delimiterIndex === -1) {
            break
          }

          const messageText = buffer.slice(0, delimiterIndex)
          buffer = buffer.slice(delimiterIndex + delimiterLength)

          if (!messageText.trim()) {
            continue
          }

          const lines = messageText.split(/\r?\n/)
          const parsed = parseSSEMessage(lines)

          if (!parsed) {
            continue
          }

          try {
            // Parse the data as JSON
            const eventData = JSON.parse(parsed.data) as ChatSseEvent["data"]
            const event: ChatSseEvent = {
              event: parsed.event,
              data: eventData,
            } as ChatSseEvent

            // Dispatch to appropriate callback
            switch (event.event) {
              case "token":
                callbacks.onToken?.(event.data)
                break
              case "tool":
                callbacks.onTool?.(event.data)
                break
              case "log":
                callbacks.onLog?.(event.data)
                break
              case "heartbeat":
                callbacks.onHeartbeat?.()
                break
              case "done":
                callbacks.onDone?.(event.data)
                break
              default:
                console.warn("[v0] Tipo di evento SSE sconosciuto:", parsed.event)
          }
        } catch (parseError) {
            console.error("[v0] Impossibile analizzare i dati SSE:", parseError, parsed.data)
        }
        }

        // Trim buffer if it's getting too large (safety check)
        if (buffer.length > 100000) {
          console.warn("[v0] Il buffer SSE ha superato 100 KB, si procede al troncamento")
          buffer = buffer.slice(-10000)
        }
      }
    } catch (error) {
      // Don't report abort errors as actual errors
      if (error instanceof Error && error.name === "AbortError") {
        return
      }

      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  })()

  // Return controller with close method
  return {
    close: () => {
      abortController.abort()
    },
  }
}

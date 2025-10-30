import { getCsrfToken } from './auth'

export type MessageHandler = (data: any) => void
export type ErrorHandler = (error: Error) => void
export type CloseHandler = () => void

export interface WebSocketMessage {
  type: 'text' | 'audio' | 'tool_call' | 'status' | 'error'
  content?: string
  data?: any
  timestamp: string
}

export class ChatWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private heartbeatInterval: NodeJS.Timeout | null = null
  private messageHandlers: Set<MessageHandler> = new Set()
  private errorHandlers: Set<ErrorHandler> = new Set()
  private closeHandlers: Set<CloseHandler> = new Set()

  constructor(
    private sessionId: string,
    private wsUrl: string = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'
  ) {}

  async connect(): Promise<void> {
    // Get auth token from cookies
    const csrfToken = await getCsrfToken()
    const url = `${this.wsUrl}/chat/${this.sessionId}?csrf_token=${csrfToken}`

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      this.startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        this.messageHandlers.forEach(handler => handler(message))
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    this.ws.onerror = (event) => {
      const error = new Error('WebSocket error')
      this.errorHandlers.forEach(handler => handler(error))
    }

    this.ws.onclose = () => {
      console.log('WebSocket closed')
      this.stopHeartbeat()
      this.closeHandlers.forEach(handler => handler())
      this.attemptReconnect()
    }
  }

  send(message: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'text',
        content: message,
        timestamp: new Date().toISOString(),
      }))
    } else {
      throw new Error('WebSocket not connected')
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler)
    return () => this.errorHandlers.delete(handler)
  }

  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler)
    return () => this.closeHandlers.delete(handler)
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }))
      }
    }, 30000) // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

      setTimeout(() => {
        console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`)
        this.connect()
      }, delay)
    }
  }
}

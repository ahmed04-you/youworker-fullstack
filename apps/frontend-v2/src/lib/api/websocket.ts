import { getCsrfToken } from './auth'
import { APP_CONFIG } from '@/src/lib/constants/app'
import { errorTracker } from '@/src/lib/utils/errorTracking'

export interface WebSocketMessage {
  type: 'text' | 'audio' | 'tool_call' | 'status' | 'error'
  content?: string
  data?: Record<string, unknown>
  timestamp: string
}

export type MessageHandler = (data: WebSocketMessage) => void
export type ErrorHandler = (error: Error) => void
export type CloseHandler = () => void
export type ConnectionStateHandler = (state: ConnectionState) => void

export type ConnectionState = 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'error'

export class ChatWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = APP_CONFIG.websocket.maxReconnectAttempts
  private reconnectDelay = APP_CONFIG.websocket.reconnectDelay
  private heartbeatInterval: NodeJS.Timeout | null = null
  private messageHandlers: Set<MessageHandler> = new Set()
  private errorHandlers: Set<ErrorHandler> = new Set()
  private closeHandlers: Set<CloseHandler> = new Set()
  private connectionStateHandlers: Set<ConnectionStateHandler> = new Set()
  private messageQueue: Array<{ type: string; content: string; timestamp: string }> = []
  private connectionState: ConnectionState = 'disconnected'

  constructor(
    private sessionId: string,
    private wsUrl: string = APP_CONFIG.api.wsUrl
  ) {}

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state
    this.connectionStateHandlers.forEach(handler => handler(state))
  }

  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    this.setConnectionState('connecting')

    try {
      const csrfToken = await getCsrfToken()
      const url = `${this.wsUrl}/chat/${this.sessionId}?csrf_token=${csrfToken}`

      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.setConnectionState('connected')
        this.startHeartbeat()
        this.flushMessageQueue()
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.messageHandlers.forEach(handler => handler(message))
        } catch (error) {
          errorTracker.captureError(error as Error, {
            component: 'ChatWebSocket',
            action: 'onmessage',
            metadata: { sessionId: this.sessionId }
          })
        }
      }

      this.ws.onerror = () => {
        const error = new Error('WebSocket error')
        this.errorHandlers.forEach(handler => handler(error))
        this.setConnectionState('error')
        errorTracker.captureError(error, {
          component: 'ChatWebSocket',
          action: 'onerror',
          metadata: { sessionId: this.sessionId }
        })
      }

      this.ws.onclose = () => {
        this.stopHeartbeat()
        this.setConnectionState('disconnected')
        this.closeHandlers.forEach(handler => handler())
        this.attemptReconnect()
      }
    } catch (error) {
      this.setConnectionState('error')
      errorTracker.captureError(error as Error, {
        component: 'ChatWebSocket',
        action: 'connect',
        metadata: { sessionId: this.sessionId }
      })
      throw error
    }
  }

  send(message: string): void {
    const wsMessage = {
      type: 'text' as const,
      content: message,
      timestamp: new Date().toISOString(),
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(wsMessage))
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(wsMessage)
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift()
      if (message) {
        this.ws.send(JSON.stringify(message))
      }
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

  onConnectionState(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.add(handler)
    return () => this.connectionStateHandlers.delete(handler)
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
    }, APP_CONFIG.websocket.heartbeatInterval)
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
      this.setConnectionState('reconnecting')
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

      setTimeout(() => {
        this.connect()
      }, delay)
    } else {
      errorTracker.captureMessage(
        'Max reconnection attempts reached',
        'error',
        { component: 'ChatWebSocket', metadata: { sessionId: this.sessionId } }
      )
    }
  }
}

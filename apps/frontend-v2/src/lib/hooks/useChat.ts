'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatWebSocket } from '@/src/lib/api/websocket'
import { getMessages, createSession } from '@/src/lib/api/chat'
import type { Message } from '@/src/lib/types'

export function useChat(sessionId?: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState(sessionId)
  const [ws, setWs] = useState<ChatWebSocket | null>(null)
  const [selectedModel, setSelectedModel] = useState('gpt-oss:20b')

  // Initialize WebSocket connection
  useEffect(() => {
    if (!currentSessionId) return

    const websocket = new ChatWebSocket(currentSessionId)

    websocket.onMessage((message) => {
      if (message.type === 'text' && message.content) {
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: message.content!,
            timestamp: message.timestamp,
          }
        ])
      }
      setIsLoading(false)
    })

    websocket.onError((error) => {
      console.error('WebSocket error:', error)
      setIsConnected(false)
    })

    websocket.onClose(() => {
      setIsConnected(false)
    })

    websocket.connect().then(() => {
      setIsConnected(true)
    })

    setWs(websocket)

    return () => {
      websocket.disconnect()
    }
  }, [currentSessionId])

  // Load existing messages
  useEffect(() => {
    if (!currentSessionId) return

    getMessages(currentSessionId).then(setMessages)
  }, [currentSessionId])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    // Create session if needed
    let sid = currentSessionId
    if (!sid) {
      const session = await createSession()
      sid = session.id
      setCurrentSessionId(sid)
    }

    // Add user message optimistically
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Send via WebSocket
    try {
      ws?.send(content)
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsLoading(false)
    }
  }, [currentSessionId, ws])

  return {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
    isConnected,
    sessionId: currentSessionId,
    selectedModel,
    setSelectedModel,
  }
}

"use client"

import { useEffect, useState } from "react"
import { MainContainer, ChatContainer, MessageList, Message, MessageInput, TypingIndicator } from "@chatscope/chat-ui-kit-react"
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css"
import { useWebSocket, WSMessage } from "@/lib/websocket-client"
import { apiClient } from "@/lib/api-client"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Mic, Square, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const { connect, disconnect, sendMessage, messages: wsMessages, isConnected, clearMessages } = useWebSocket()

  useEffect(() => {
    // Create or load session
    const loadSession = async () => {
      try {
        const sessions = await apiClient.getSessions()
        if (sessions.length > 0) {
          const lastSession = sessions[0]
          setSessionId(lastSession.id)
          const sessionMessages = await apiClient.getMessages(lastSession.id)
          setMessages(sessionMessages.map(msg => ({
            message: msg.content,
            sentTime: msg.timestamp,
            sender: msg.role === 'user' ? 'User' : 'Assistant',
            direction: msg.role === 'user' ? 'outgoing' : 'incoming',
            position: 'single'
          })))
        }
      } catch (error) {
        console.error('Failed to load session:', error)
      }
    }

    loadSession()
    connect()

    return () => {
      disconnect()
    }
  }, [])

  useEffect(() => {
    // Process WebSocket messages
    if (wsMessages.length > 0) {
      const latestMessage = wsMessages[wsMessages.length - 1]
      
      if (latestMessage.type === 'token' && latestMessage.content) {
        setMessages(prev => {
          const updated = [...prev]
          if (updated.length > 0 && updated[updated.length - 1].sender === 'Assistant' && updated[updated.length - 1].isStreaming) {
            updated[updated.length - 1].message += latestMessage.content
          } else {
            updated.push({
              message: latestMessage.content,
              sentTime: new Date().toISOString(),
              sender: 'Assistant',
              direction: 'incoming',
              position: 'single',
              isStreaming: true
            })
          }
          return updated
        })
      } else if (latestMessage.type === 'done') {
        setIsTyping(false)
        setMessages(prev => {
          const updated = [...prev]
          if (updated.length > 0 && updated[updated.length - 1].isStreaming) {
            delete updated[updated.length - 1].isStreaming
          }
          return updated
        })
      } else if (latestMessage.type === 'error') {
        setIsTyping(false)
        toast.error(latestMessage.error || 'An error occurred')
      } else if (latestMessage.type === 'tool_call') {
        toast.info(`Using tool: ${latestMessage.tool_name}`)
      }
    }
  }, [wsMessages])

  const handleSend = (message: string) => {
    if (!message.trim() || !isConnected) return

    const userMessage = {
      message,
      sentTime: new Date().toISOString(),
      sender: 'User',
      direction: 'outgoing',
      position: 'single'
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue("")
    setIsTyping(true)

    sendMessage(message, sessionId || undefined)
  }

  const handleVoiceRecord = () => {
    if (isRecording) {
      setIsRecording(false)
      toast.success("Voice recording stopped")
    } else {
      setIsRecording(true)
      toast.info("Voice recording started")
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <div className="flex-1 overflow-hidden">
          <MainContainer>
            <ChatContainer>
              <MessageList
                typingIndicator={isTyping ? <TypingIndicator content="Assistant is typing" /> : null}
              >
                {messages.map((msg, index) => (
                  <Message
                    key={index}
                    model={{
                      message: msg.message,
                      sentTime: msg.sentTime,
                      sender: msg.sender,
                      direction: msg.direction,
                      position: msg.position
                    }}
                  />
                ))}
              </MessageList>
              <MessageInput
                placeholder="Type your message here..."
                value={inputValue}
                onChange={(val) => setInputValue(val)}
                onSend={handleSend}
                attachButton={false}
                sendButton={true}
              />
              <div className="flex gap-2 p-4 border-t">
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  size="icon"
                  onClick={handleVoiceRecord}
                  disabled={!isConnected}
                >
                  {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
            </ChatContainer>
          </MainContainer>
        </div>
      </div>
    </div>
  )
}
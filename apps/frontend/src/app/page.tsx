"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Send, StopCircle, Loader2, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWebSocket } from "@/lib/websocket";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const { apiKey, isAuthenticated } = useAuth();
  const router = useRouter();

  const { ws, isConnected, sendText, sendAudio } = useWebSocket(
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001",
    "default-session", // Default session; can be dynamic later
    apiKey
  );

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/settings");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (role: "user" | "assistant" | "system", content: string, isStreaming = false) => {
    const id = Date.now().toString();
    setMessages((prev) => [...prev, { id, role, content, timestamp: new Date(), isStreaming }]);
    if (role === "assistant") {
      setCurrentMessageId(id);
    }
    return id;
  };

  const appendToMessage = (id: string, delta: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, content: msg.content + delta } : msg
      )
    );
  };

  const handleSend = () => {
    if (!input.trim() || !isConnected || isLoading) return;

    const userId = addMessage("user", input);
    const assistantId = addMessage("assistant", "", true);
    setInput("");
    setIsLoading(true);

    ws?.setCallbacks({
      onText: (content, metadata) => {
        if (metadata?.is_streaming) {
          appendToMessage(assistantId, content);
        } else if (metadata?.is_final) {
          appendToMessage(assistantId, content);
          setMessages((prev) => prev.map((msg) => msg.id === assistantId ? { ...msg, isStreaming: false } : msg));
          setIsLoading(false);
          setCurrentMessageId(null);
        }
      },
      onStatus: (status, metadata) => {
        if (status === "thinking") {
          appendToMessage(assistantId, "Thinking");
        } else if (metadata?.stage === "tool") {
          appendToMessage(assistantId, `Executing tool: ${metadata.tool}...`);
        }
      },
      onTool: (tool, metadata) => {
        if (metadata?.status === "start") {
          appendToMessage(assistantId, `Starting tool: ${tool} with args: ${JSON.stringify(metadata.args)}`);
        } else if (metadata?.status === "end") {
          appendToMessage(assistantId, `Tool ${tool} completed.`);
        }
      },
      onAudio: (audioB64, sampleRate) => {
        // Play audio response
        playAudio(audioB64, sampleRate);
      },
      onTranscript: (transcript, metadata) => {
        addMessage("assistant", `Transcript: ${transcript} (confidence: ${metadata?.confidence || 'N/A'})`);
      },
      onError: (error, metadata) => {
        appendToMessage(assistantId, `Error: ${error}`);
        setIsLoading(false);
        setCurrentMessageId(null);
      },
      onSystem: (message) => {
        console.log("System:", message);
      },
    });

    sendText(input);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      let pcmData: Int16Array[] = [];

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        pcmData.push(pcm16);
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      setIsRecording(true);

      // Stop after 30s or on button press
      const timeout = setTimeout(() => stopRecording(), 30000);

      // Wait for stop
      await new Promise<void>((resolve) => {
        const stopListener = () => {
          clearTimeout(timeout);
          processor.disconnect();
          source.disconnect();
          stream.getTracks().forEach(track => track.stop());
          resolve();
        };
        // Set global stop function
        (window as any).stopVoiceRecording = stopListener;
      });

      // Convert PCM to base64
      const fullPcm = new Int16Array(pcmData.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      pcmData.forEach(chunk => {
        fullPcm.set(chunk, offset);
        offset += chunk.length;
      });

      const pcmBytes = new Uint8Array(fullPcm.buffer);
      const pcmB64 = btoa(String.fromCharCode(...pcmBytes));

      sendAudio(pcmB64, 16000);
      setIsRecording(false);
    } catch (error) {
      console.error("Recording error:", error);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    (window as any).stopVoiceRecording?.();
  };

  const playAudio = async (audioB64: string, sampleRate: number) => {
    try {
      let audioContext = audioContextRef.current;
      if (!audioContext || audioContext.state === "closed") {
        audioContext = new AudioContext({ sampleRate });
        audioContextRef.current = audioContext;
      }
      const audioBytes = Uint8Array.from(atob(audioB64), (c) => c.charCodeAt(0));
      const audioBuffer = await audioContext.decodeAudioData(audioBytes.buffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.error("Playback error:", error);
    }
  };

  if (!isAuthenticated) {
    return <div className="flex items-center justify-center h-screen">Redirecting to settings...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              YouWorker.AI Chat
              {isConnected ? (
                <div className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-xs font-medium text-white">
                  Connected
                </div>
              ) : (
                <div className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-xs font-medium text-white">
                  Disconnected
                </div>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
            <h3 className="text-lg font-medium">Welcome to YouWorker.AI</h3>
            <p className="text-sm">Start a conversation by typing a message or using voice input.</p>
          </div>
        ) : (
          messages.map((message) => (
            <Card key={message.id} className={`w-full ${message.role === "user" ? "bg-primary/10 ml-auto max-w-lg" : "bg-secondary/10"}`}>
              <CardContent className="p-4">
                <div className={`text-sm space-y-2 ${message.role === "user" ? "text-right" : "text-left"}`}>
                  <p>{message.content}</p>
                  {message.isStreaming && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Typing...</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4">
        <Card>
          <CardContent className="p-0">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!isConnected || isLoading}
                className="h-12 w-12"
              >
                {isRecording ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Type your message..."
                disabled={!isConnected || isLoading}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={!input.trim() || !isConnected || isLoading} className="h-12">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

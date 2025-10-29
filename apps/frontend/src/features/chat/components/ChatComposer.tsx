"use client";

import { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Send,
  Loader2,
  LogOut,
  Mic,
  StopCircle,
  Volume2,
} from "lucide-react";

import { useHapticFeedback } from "@/hooks/useHapticFeedback";

/**
 * Props for the ChatComposer component
 */
interface ChatComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSendText: () => void;
  isStreaming: boolean;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onStopStreaming: () => void;
  assistantLanguage: string;
  onAssistantLanguageChange: (value: string) => void;
  selectedModel: string;
  onSelectedModelChange: (value: string) => void;
  enableTools: boolean;
  onToggleTools: () => void;
  expectAudio: boolean;
  onToggleAudio: () => void;
  voiceSupported?: boolean;
}

/**
 * Chat composer component with voice recording and model selection
 *
 * A comprehensive input interface for the chat experience featuring text input,
 * voice recording, model selection, language configuration, and tool toggles.
 * Optimized with React.memo for performance and includes haptic feedback on
 * mobile devices.
 *
 * @component
 * @param {ChatComposerProps} props - Component props
 * @param {string} props.input - Current input text value
 * @param {function} props.onInputChange - Handler for input text changes
 * @param {function} props.onSendText - Handler for sending text messages
 * @param {boolean} props.isStreaming - Whether AI is currently streaming a response
 * @param {boolean} props.isRecording - Whether voice recording is active
 * @param {function} props.onStartRecording - Handler to start voice recording
 * @param {function} props.onStopRecording - Handler to stop voice recording
 * @param {function} props.onStopStreaming - Handler to stop AI response streaming
 * @param {string} props.assistantLanguage - Selected assistant response language
 * @param {function} props.onAssistantLanguageChange - Handler for language selection
 * @param {string} props.selectedModel - Currently selected AI model
 * @param {function} props.onSelectedModelChange - Handler for model selection
 * @param {boolean} props.enableTools - Whether tools are enabled
 * @param {function} props.onToggleTools - Handler to toggle tools on/off
 * @param {boolean} props.expectAudio - Whether to expect audio responses
 * @param {function} props.onToggleAudio - Handler to toggle audio responses
 * @param {boolean} [props.voiceSupported=true] - Whether voice input is supported on device
 *
 * @example
 * ```tsx
 * <ChatComposer
 *   input={input}
 *   onInputChange={setInput}
 *   onSendText={handleSend}
 *   isStreaming={false}
 *   isRecording={false}
 *   onStartRecording={startRecording}
 *   onStopRecording={stopRecording}
 *   onStopStreaming={stopStreaming}
 *   assistantLanguage="en"
 *   onAssistantLanguageChange={setLanguage}
 *   selectedModel="gpt-oss:20b"
 *   onSelectedModelChange={setModel}
 *   enableTools={true}
 *   onToggleTools={toggleTools}
 *   expectAudio={false}
 *   onToggleAudio={toggleAudio}
 *   voiceSupported={true}
 * />
 * ```
 *
 * Features:
 * - Multi-line textarea with Enter to send (Shift+Enter for new line)
 * - Voice recording with animated waveform visualization
 * - Model selection dropdown with preset and custom models
 * - Language selection for assistant responses
 * - Tools toggle button with active state indicator
 * - Audio response toggle
 * - Loading state during streaming
 * - Mobile-friendly with haptic feedback
 * - Auto-scroll to input on mobile focus
 * - Keyboard shortcuts (Cmd+Enter to send, Cmd+Shift+V for voice)
 * - Tooltips for all interactive elements
 *
 * @see {@link useHapticFeedback} for mobile haptic feedback
 * @see {@link VoiceWaveform} for recording visualization
 */
export const ChatComposer = memo(function ChatComposer({
  input,
  onInputChange,
  onSendText,
  isStreaming,
  isRecording,
  onStartRecording,
  onStopRecording,
  onStopStreaming,
  assistantLanguage,
  onAssistantLanguageChange,
  selectedModel,
  onSelectedModelChange,
  enableTools,
  onToggleTools,
  expectAudio,
  onToggleAudio,
  voiceSupported = true,
}: ChatComposerProps) {
  const [mounted, setMounted] = useState(false);
  const triggerHaptic = useHapticFeedback();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggleTools = () => {
    triggerHaptic();
    onToggleTools();
  };

  const handleToggleAudio = () => {
    triggerHaptic();
    onToggleAudio();
  };

  const handleSend = () => {
    triggerHaptic([8, 32]);
    onSendText();
  };

  const handleMicPress = () => {
    triggerHaptic(12);
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  const handleStopStreaming = () => {
    triggerHaptic();
    onStopStreaming();
  };

  return (
    <div className="mt-6 rounded-3xl border border-border bg-card/80 p-5 shadow-xl" data-testid="chat-composer">
      <div className="flex flex-col gap-3">
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSendText();
            }
          }}
          onFocus={(event) => {
            if (window.innerWidth < 768) {
              setTimeout(() => {
                event.currentTarget.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 300);
            }
          }}
          placeholder="Ask anything… Request a plan, run a tool, or brainstorm in crimson style."
          className="min-h-[80px] md:min-h-[110px] w-full resize-none rounded-2xl border border-border/70 bg-background/70 p-3 md:p-4 text-sm leading-relaxed shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          rows={3}
          aria-label="Message input"
          data-testid="input"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={expectAudio ? "default" : "outline"}
                  size="icon"
                  className="rounded-full"
                  onClick={handleToggleAudio}
                  data-testid="toggle-audio"
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{expectAudio ? "Disable voice responses" : "Enable voice responses"}</p>
              </TooltipContent>
            </Tooltip>
            {mounted && voiceSupported && isRecording && (
              <VoiceWaveform active={isRecording} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {isStreaming && (
              <Button variant="ghost" onClick={handleStopStreaming} className="rounded-full">
                <LogOut className="mr-2 h-4 w-4" />
                Stop
              </Button>
            )}
            {mounted && voiceSupported && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={`rounded-full ${isRecording ? "border-destructive text-destructive" : ""}`}
                    onClick={handleMicPress}
                    disabled={isStreaming}
                    data-testid="mic-button"
                  >
                    {isRecording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isRecording ? "Stop recording" : "Start voice recording"}</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className="rounded-full"
                  size="icon"
                  data-testid="send"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isStreaming ? "Streaming..." : "Send message"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
});
ChatComposer.displayName = "ChatComposer";

const WAVEFORM_BARS = Array.from({ length: 8 }, (_, index) => ({
  id: `wave-${index}`,
  delay: index * 0.08,
}));

function VoiceWaveform({ active }: { active: boolean }) {
  return (
    <div
      className="flex h-6 items-end gap-[3px]"
      aria-hidden={!active}
    >
      {WAVEFORM_BARS.map(({ id, delay }) => (
        <motion.span
          key={id}
          initial={{ scaleY: 0.4 }}
          animate={
            active
              ? { scaleY: [0.4, 1.1, 0.7, 1] }
              : { scaleY: 0.3 }
          }
          transition={{
            repeat: active ? Infinity : 0,
            repeatType: "loop",
            duration: 1.4,
            delay,
            ease: "easeInOut",
          }}
          className="w-1 rounded-full bg-primary/80"
          style={{ transformOrigin: "center bottom" }}
        />
      ))}
    </div>
  );
}

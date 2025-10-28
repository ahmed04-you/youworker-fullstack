"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Sparkles,
  Volume2,
} from "lucide-react";

import { useHapticFeedback } from "@/hooks/useHapticFeedback";

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

export function ChatComposer({
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
  const triggerHaptic = useHapticFeedback();
  const languageOptions = useMemo(
    () => ["auto", "en", "es", "fr", "de", "ja"],
    []
  );

  const modelPresets = useMemo(
    () => ["gpt-oss:20b", "gpt-4-turbo", "gpt-3.5", "claude-3-opus"],
    []
  );

  const modelOptions = useMemo(() => {
    if (!selectedModel || modelPresets.includes(selectedModel)) {
      return modelPresets;
    }
    return [selectedModel, ...modelPresets];
  }, [selectedModel, modelPresets]);

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
        <div className="flex flex-wrap items-center gap-3">
          <Select value={assistantLanguage} onValueChange={onAssistantLanguageChange}>
            <SelectTrigger className="h-9 w-40 rounded-full border border-border/80 bg-background px-3 text-xs font-semibold uppercase text-foreground">
              <SelectValue placeholder="Language" data-testid="assistant-language" />
            </SelectTrigger>
            <SelectContent>
              {languageOptions.map((language) => (
                <SelectItem key={language} value={language} className="text-xs uppercase">
                  {language === "auto" ? "Auto" : language.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedModel} onValueChange={onSelectedModelChange}>
            <SelectTrigger className="h-9 w-48 rounded-full border border-border/80 bg-background px-3 text-xs font-semibold text-foreground">
              <SelectValue placeholder="Model" data-testid="model-input" />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((model) => (
                <SelectItem key={model} value={model} className="text-xs">
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={enableTools ? "default" : "outline"}
                className="rounded-full"
                onClick={handleToggleTools}
                data-testid="toggle-tools"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {enableTools ? "Tools active" : "Enable tools"}
                {enableTools && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide" data-testid="tools-active">
                    Active
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{enableTools ? "Disable tools" : "Enable tools like web search, code execution"}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={expectAudio ? "default" : "outline"}
                className="rounded-full"
                onClick={handleToggleAudio}
                data-testid="toggle-audio"
              >
                <Volume2 className="mr-2 h-4 w-4" />
                {expectAudio ? "Voice-on" : "Voice-off"}
                {expectAudio && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide" data-testid="voice-on">
                    Voice
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{expectAudio ? "Disable voice responses" : "Enable voice responses from assistant"}</p>
            </TooltipContent>
          </Tooltip>
        </div>

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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={`rounded-full ${isRecording ? "border-destructive text-destructive" : ""}`}
                onClick={handleMicPress}
                disabled={isStreaming || !voiceSupported}
                data-testid="mic-button"
              >
                {isRecording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isRecording ? "Stop recording (Cmd+Shift+V)" : "Start voice recording (Cmd+Shift+V)"}</p>
              </TooltipContent>
            </Tooltip>
            <span data-testid={isRecording ? "recording-indicator" : undefined}>
              {!voiceSupported
                ? "Voice input not supported on this device."
                : isRecording
                  ? "Recording… release to send."
                  : "Hold to speak."}
            </span>
            {voiceSupported && (
              <VoiceWaveform active={isRecording} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {isStreaming && (
              <Button variant="ghost" onClick={handleStopStreaming} className="rounded-full">
                <LogOut className="mr-2 h-4 w-4" />
                Stop response
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className="rounded-full px-6"
                  data-testid="send"
                >
                  {isStreaming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                      Streaming…
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isStreaming ? "Response streaming..." : "Send message (Cmd+Enter)"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

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

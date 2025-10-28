"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Loader2,
  LogOut,
  Mic,
  StopCircle,
  Sparkles,
  Volume2,
} from "lucide-react";

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
}: ChatComposerProps) {
  return (
    <div
      className="mt-6 rounded-3xl border border-border bg-card/80 p-5 shadow-xl backdrop-blur"
      data-testid="chat-composer"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <span>Assistant language</span>
            <Input
              value={assistantLanguage}
              onChange={(event) => onAssistantLanguageChange(event.target.value)}
              className="h-7 w-16 rounded-full border-0 bg-transparent px-2 text-xs font-semibold uppercase text-foreground"
              data-testid="assistant-language"
            />
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <span>Model</span>
            <Input
              value={selectedModel}
              onChange={(event) => onSelectedModelChange(event.target.value)}
              className="h-7 w-[140px] rounded-full border-0 bg-transparent px-2 text-xs font-semibold text-foreground"
              data-testid="model-input"
            />
          </div>
          <Button
            variant={enableTools ? "default" : "outline"}
            className="rounded-full"
            onClick={onToggleTools}
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
          <Button
            variant={expectAudio ? "default" : "outline"}
            className="rounded-full"
            onClick={onToggleAudio}
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
          onFocus={(e) => {
            // Scroll into view on mobile to prevent keyboard overlap
            if (window.innerWidth < 768) {
              setTimeout(() => {
                e.target.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 300);
            }
          }}
          placeholder="Ask anything… Request a plan, run a tool, or brainstorm in crimson style."
          className="min-h-[80px] md:min-h-[110px] w-full rounded-2xl border border-border/70 bg-background/70 p-3 md:p-4 text-sm leading-relaxed shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none touch-manipulation"
          rows={3}
          aria-label="Message input"
          data-testid="input"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={`rounded-full ${isRecording ? "border-destructive text-destructive" : ""}`}
              onClick={() => (isRecording ? onStopRecording() : onStartRecording())}
              disabled={isStreaming}
              data-testid="mic-button"
            >
              {isRecording ? (
                <StopCircle className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <span data-testid={isRecording ? "recording-indicator" : undefined}>
              {isRecording ? "Recording… release to send." : "Hold to speak."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isStreaming && (
              <Button variant="ghost" onClick={onStopStreaming} className="rounded-full">
                <LogOut className="mr-2 h-4 w-4" />
                Stop response
              </Button>
            )}
            <Button
              onClick={onSendText}
              disabled={!input.trim() || isStreaming}
              className="rounded-full px-6"
              data-testid="send"
            >
              {isStreaming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Streaming…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

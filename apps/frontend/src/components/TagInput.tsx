"use client";

import { useState, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  maxTagLength?: number;
  className?: string;
  disabled?: boolean;
}

export function TagInput({
  tags,
  onTagsChange,
  placeholder = "Add tags...",
  maxTags = 20,
  maxTagLength = 50,
  className,
  disabled = false,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(
    (tag: string) => {
      const trimmedTag = tag.trim().toLowerCase();

      if (!trimmedTag) {
        setError("Tag cannot be empty");
        return;
      }

      if (trimmedTag.length > maxTagLength) {
        setError(`Tag must be less than ${maxTagLength} characters`);
        return;
      }

      if (tags.includes(trimmedTag)) {
        setError("Tag already exists");
        return;
      }

      if (tags.length >= maxTags) {
        setError(`Maximum ${maxTags} tags allowed`);
        return;
      }

      onTagsChange([...tags, trimmedTag]);
      setInput("");
      setError(null);
      inputRef.current?.focus();
    },
    [tags, onTagsChange, maxTags, maxTagLength]
  );

  const removeTag = useCallback(
    (tagToRemove: string) => {
      onTagsChange(tags.filter((tag) => tag !== tagToRemove));
      setError(null);
    },
    [tags, onTagsChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const newTags = pastedText
      .split(/[,\s]+/)
      .filter((tag) => tag.trim().length > 0);

    newTags.forEach((tag) => {
      if (tags.length < maxTags) {
        addTag(tag);
      }
    });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2 rounded-lg border border-border/70 bg-background/50 p-2">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="flex items-center gap-1 rounded-full"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              disabled={disabled}
              className="ml-1 hover:text-destructive focus:outline-none"
              aria-label={`Remove tag: ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={tags.length < maxTags ? placeholder : "Max tags reached"}
          disabled={disabled || tags.length >= maxTags}
          className="flex-1 border-0 bg-transparent px-0 py-1 text-sm focus:outline-none focus:ring-0"
          aria-label="Tag input"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        {tags.length}/{maxTags} tags
      </p>
    </div>
  );
}

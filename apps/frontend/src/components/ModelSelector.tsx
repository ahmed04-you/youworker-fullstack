"use client";

import * as React from "react";
import { memo } from "react";
import { cn } from "@/lib/utils";

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

interface Model {
  value: string;
  label: string;
  description?: string;
}

interface ModelSelectorProps {
  models: Model[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function ModelSelectorComponent({
  models,
  value,
  onValueChange,
  placeholder = "Select model...",
  className,
}: ModelSelectorProps) {
  const selectedModel = models.find((m) => m.value === value);
  const tooltipText = selectedModel?.description || "Select the AI model for your conversation";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Select value={value} onValueChange={onValueChange} aria-label="Select AI model">
            <SelectTrigger className={cn("w-[200px]", className)}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <Tooltip key={model.value}>
                  <TooltipTrigger asChild>
                    <div>
                      <SelectItem value={model.value}>
                        {model.label}
                      </SelectItem>
                    </div>
                  </TooltipTrigger>
                  {model.description && (
                    <TooltipContent side="right">
                      <p className="max-w-xs text-xs">{model.description}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs text-xs">{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

ModelSelectorComponent.displayName = 'ModelSelector';

export const ModelSelector = memo(ModelSelectorComponent);

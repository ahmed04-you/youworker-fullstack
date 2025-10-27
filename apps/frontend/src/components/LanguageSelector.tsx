"use client";

import * as React from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Language {
  value: string;
  label: string;
  native: string;
}

interface LanguageSelectorProps {
  languages: Language[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function LanguageSelector({
  languages,
  value,
  onValueChange,
  placeholder = "Select language...",
  className,
}: LanguageSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("w-[200px]", className)}>
        <Globe className="mr-2 h-4 w-4" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {languages.map((language) => (
          <SelectItem key={language.value} value={language.value}>
            {language.label} ({language.native})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

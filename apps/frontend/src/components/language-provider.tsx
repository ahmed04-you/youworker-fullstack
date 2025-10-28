"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { translations, type Language } from "@/lib/i18n";

type TranslationParams = Record<string, string | number>;

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  translate: (key: string, params?: TranslationParams) => string;
}

const STORAGE_KEY = "youworker.language";

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function getNestedTranslation(
  tree: Record<string, unknown>,
  key: string
): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, tree);
}

function applyParams(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, paramKey) => {
    if (paramKey in params) {
      return String(params[paramKey]);
    }
    return match;
  });
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isMounted, setIsMounted] = useState(false);

  // First useEffect: Mark as mounted (runs after hydration)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Second useEffect: Load language from storage only after mounting
  useEffect(() => {
    if (!isMounted || typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && stored in translations) {
      setLanguageState(stored);
    }
  }, [isMounted]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, lang);
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    const translate = (key: string, params?: TranslationParams) => {
      // During SSR and initial hydration, always use English to prevent mismatches
      const effectiveLanguage = isMounted ? language : "en";
      const fallback = translations.en;
      const current = translations[effectiveLanguage];

      const fromCurrent = getNestedTranslation(current, key);
      const fromFallback = getNestedTranslation(fallback, key);

      const template =
        typeof fromCurrent === "string"
          ? fromCurrent
          : typeof fromFallback === "string"
          ? fromFallback
          : key;

      return applyParams(template, params);
    };

    return {
      language: isMounted ? language : "en",
      setLanguage,
      translate,
    };
  }, [language, setLanguage, isMounted]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export function useTranslations(prefix?: string) {
  const { translate, language, setLanguage } = useLanguage();
  return {
    language,
    setLanguage,
    t: (key: string, params?: TranslationParams) =>
      translate(prefix ? `${prefix}.${key}` : key, params),
  };
}

export const supportedLanguages: Array<{ code: Language; label: string }> = [
  { code: "en", label: "english" },
  { code: "it", label: "italian" },
];

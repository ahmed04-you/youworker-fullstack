"use client";

import { supportedLanguages, useTranslations } from "@/components/language-provider";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useTranslations("language");

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 p-1"
      role="group"
      aria-label={t("aria")}
    >
      {supportedLanguages.map(({ code, label }) => (
        <Button
          key={code}
          type="button"
          variant={language === code ? "default" : "ghost"}
          size="sm"
          className="rounded-full px-4 text-xs"
          onClick={() => setLanguage(code)}
          aria-pressed={language === code}
        >
          {t(label)}
        </Button>
      ))}
    </div>
  );
}

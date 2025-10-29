"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Laptop } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslations } from "@/components/language-provider";

export function ThemeToggle() {
  const { setTheme, resolvedTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslations("theme");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="inline-flex items-center gap-2 rounded-full text-xs text-muted-foreground hover:text-primary"
        disabled
        aria-label="Loading theme toggle"
      >
        <Laptop className="h-4 w-4" />
        <span>System</span>
      </Button>
    );
  }

  const effectiveTheme = theme ?? "system";
  const displayTheme = effectiveTheme === "system" ? "system" : effectiveTheme;
  const resolved = resolvedTheme ?? "light";

  const cycleTheme = () => {
    if (!theme || theme === "system") {
      setTheme("light");
    } else if (theme === "light") {
      setTheme("dark");
    } else {
      setTheme("system");
    }
  };

  const iconTheme = displayTheme === "system" ? resolved : displayTheme;

  const icon =
    iconTheme === "light" ? (
      <Sun className="h-4 w-4" />
    ) : iconTheme === "dark" ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Laptop className="h-4 w-4" />
    );

  const label =
    displayTheme === "system"
      ? t("system")
      : iconTheme === "dark"
      ? t("dark")
      : t("light");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="inline-flex items-center gap-2 rounded-full text-xs text-muted-foreground hover:text-primary"
          onClick={cycleTheme}
          aria-label={t("aria")}
        >
          {icon}
          <span>{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Toggle theme (System / Light / Dark)</p>
      </TooltipContent>
    </Tooltip>
  );
}

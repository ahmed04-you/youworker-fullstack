"use client"

import { useRouter } from "next/navigation"
import { Settings, History } from "lucide-react"
import { Card } from "@/components/ui/card"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useChatSettings, ASSISTANT_LANGUAGE_OPTIONS, UI_LANGUAGE_OPTIONS } from "@/lib/mode"
import { useI18n } from "@/lib/i18n"

export default function SettingsPage() {
  const router = useRouter()
  const { assistantLanguage, setAssistantLanguage, uiLanguage, setUiLanguage } = useChatSettings()
  const { t } = useI18n()

  return (
    <div className="container mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Settings className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("settings.quick_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("settings.quick_description")}</p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-3 rounded-2xl border-border/40 bg-card/30 p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("settings.workspace")}</h2>
          <div className="flex flex-col gap-2 rounded-xl border border-border/40 bg-background/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium">{t("settings.workspace.theme")}</span>
              <ThemeToggle />
            </div>
            <p className="text-xs text-muted-foreground">{t("settings.workspace.theme_hint")}</p>
          </div>
          <div className="rounded-xl border border-dashed border-border/40 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            {t("settings.workspace.theme_note")}
          </div>
        </Card>

        <Card className="flex flex-col gap-3 rounded-2xl border-border/40 bg-card/30 p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("settings.history")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.history.description")}</p>
          <Button variant="outline" className="justify-between rounded-xl" onClick={() => router.push("/history")}>
            <span className="flex items-center gap-2">
              <History className="h-4 w-4" aria-hidden="true" />
              {t("settings.history.open")}
            </span>
          </Button>
        </Card>

        <Card className="flex flex-col gap-4 rounded-2xl border-border/40 bg-card/30 p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("settings.language.interface")}</h2>
            <p className="text-xs text-muted-foreground">{t("settings.language.interface_description")}</p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-background/40 p-3">
            <div className="flex flex-col gap-1">
              <span className="text-base font-medium">{t("settings.language.interface")}</span>
              <span className="text-xs text-muted-foreground">{t("settings.language.interface_description")}</span>
            </div>
            <Select value={uiLanguage} onValueChange={setUiLanguage}>
              <SelectTrigger className="w-[160px] rounded-xl">
                <SelectValue placeholder={t("settings.language.placeholder")} />
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl">
                {UI_LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("settings.language.assistant")}</h3>
            <p className="text-xs text-muted-foreground">{t("settings.language.assistant_description")}</p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-background/40 p-3">
            <div className="flex flex-col gap-1">
              <span className="text-base font-medium">{t("settings.language.assistant")}</span>
              <span className="text-xs text-muted-foreground">{t("settings.language.assistant_description")}</span>
            </div>
            <Select value={assistantLanguage} onValueChange={setAssistantLanguage}>
              <SelectTrigger className="w-[160px] rounded-xl">
                <SelectValue placeholder={t("settings.language.placeholder")} />
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl">
                {ASSISTANT_LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>
      </section>

      <Card className="rounded-2xl border-border/40 bg-card/30 p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("settings.accessibility")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("settings.accessibility.description")}</p>
      </Card>
    </div>
  )
}

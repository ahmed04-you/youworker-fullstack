"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ShieldAlert, Sparkles, DoorOpen, Cookie, Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { useTranslations } from "@/components/language-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const { isAuthenticated, username, logout, isLoading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { t } = useTranslations("settings");

  const statusBadge = isLoading
    ? { label: t("hero.status.loading"), variant: "outline" as const }
    : isAuthenticated
    ? { label: t("hero.status.authenticated"), variant: "default" as const }
    : { label: t("hero.status.guest"), variant: "secondary" as const };

  const statusMessage = isAuthenticated
    ? t("hero.statusMessage.authenticated", { username: username ?? "root" })
    : t("hero.statusMessage.guest");

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success(t("authentication.card.logoutSuccess"));
    } catch (error) {
      toast.error(t("authentication.card.logoutError"));
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:px-8">
      <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("hero.eyebrow")}
            </p>
            <h1 className="text-2xl font-semibold text-foreground">
              {t("hero.heading")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {t("hero.description")}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <Badge variant={statusBadge.variant} className="rounded-full px-3 py-1">
              {statusBadge.label}
            </Badge>
            {isAuthenticated && username ? (
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {username}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-full rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4 text-primary" />
              {t("authentication.title")}
            </CardTitle>
            <CardDescription>{t("authentication.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
              <p className="font-medium text-foreground">{statusMessage}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("authentication.card.statusBody")}
              </p>
            </div>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/70 p-3">
                <Cookie className="mt-1 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    {t("authentication.card.sessionCookiesTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("authentication.card.sessionCookiesBody")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/70 p-3">
                <Sparkles className="mt-1 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    {t("authentication.card.continuousRefreshTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("authentication.card.continuousRefreshBody")}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {isAuthenticated ? (
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("authentication.card.logoutWorking")}
                    </>
                  ) : (
                    <>
                      <DoorOpen className="mr-2 h-4 w-4" />
                      {t("authentication.card.logoutButton")}
                    </>
                  )}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("authentication.card.unauthenticatedMessage")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("preferences.title")}
            </CardTitle>
            <CardDescription>{t("preferences.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <PreferenceTile
              title={t("preferences.theme.title")}
              description={t("preferences.theme.description")}
              action={<ThemeToggle aria-label="Toggle theme" />}
            />
            <PreferenceTile
              title={t("preferences.language.title")}
              description={t("preferences.language.description")}
              action={<LanguageSwitcher aria-label="Switch language" />}
            />
            <PreferenceTile
              title={t("preferences.voice.title")}
              description={t("preferences.voice.description")}
            />
            <PreferenceTile
              title={t("preferences.analytics.title")}
              description={t("preferences.analytics.description")}
            />
            <PreferenceTile
              title={t("preferences.sessions.title")}
              description={t("preferences.sessions.description")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PreferenceTile({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <article className="group rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm hover:shadow-md transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/30">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-foreground group-hover:text-primary">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      {action ? (
        <div className="mt-3">
          {action}
        </div>
      ) : null}
    </article>
  );
}

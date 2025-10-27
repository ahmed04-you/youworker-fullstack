"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, Sparkles, DoorOpen, Cookie, Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
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

  const statusBadge = useMemo(() => {
    if (isLoading) {
      return { label: "Checking status…", variant: "outline" as const };
    }
    if (isAuthenticated) {
      return { label: "Authenticated", variant: "default" as const };
    }
    return { label: "Guest mode", variant: "secondary" as const };
  }, [isAuthenticated, isLoading]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success("Signed out successfully.");
    } catch (error) {
      toast.error("Logout failed. Please retry.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const statusMessage = isAuthenticated
    ? `Signed in as ${username ?? "root"}.`
    : "Log in with your API key to unlock the full workspace.";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:px-8">
      <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Control center
            </p>
            <h1 className="text-2xl font-semibold text-foreground">
              Personalize your YouWorker experience
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Manage authentication, learn how sessions are protected, and surface quick links for
              everyday workflows. Cream-forward visuals keep the experience calm, even when YouWorker
              is in crimson acceleration.
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
              Authentication
            </CardTitle>
            <CardDescription>Cookie-based access to every backend capability.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
              <p className="font-medium text-foreground">{statusMessage}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                YouWorker uses secure, HTTP-only cookies issued by the backend. Tokens refresh
                automatically so you stay connected during longer analysis sessions.
              </p>
            </div>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/70 p-3">
                <Cookie className="mt-1 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Session cookies
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JWT tokens are stored in HttpOnly cookies. Client-side code never sees raw keys.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/70 p-3">
                <Sparkles className="mt-1 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Continuous refresh
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tokens refresh a minute before expiry so long-running chats and analytics stay
                    authorized.
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
                      Signing out…
                    </>
                  ) : (
                    <>
                      <DoorOpen className="mr-2 h-4 w-4" />
                      Sign out
                    </>
                  )}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Open the login dialog to authenticate with your API key. The form appears
                  automatically when you’re not authenticated.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Workspace Preferences
            </CardTitle>
            <CardDescription>
              Tune environment defaults so the agent behaves exactly how your team expects.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <PreferenceTile
              title="Theme adaptation"
              description="Switch between light, dark, or system theme using the sidebar toggle."
            />
            <PreferenceTile
              title="Voice-ready UI"
              description="Microphone controls live in the chat composer whenever you need push-to-talk."
            />
            <PreferenceTile
              title="Analytics clarity"
              description="Dashboards adopt cream + crimson, adapting to theme for easier scanning."
            />
            <PreferenceTile
              title="Session insights"
              description="Every conversation is stored with the originating model, tool usage, and timestamps."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PreferenceTile({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

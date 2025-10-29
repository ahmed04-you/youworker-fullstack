"use client";

import { Palette } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { useSettings } from '@/lib/settings-context';

export default function SettingsPage() {
  const { isAuthenticated, username, isLoading } = useAuth();
  const { settings, updateSetting } = useSettings();

  const statusBadge = isLoading
    ? { label: "Loading", variant: "outline" as const }
    : isAuthenticated
    ? { label: "Authenticated", variant: "default" as const }
    : { label: "Guest", variant: "secondary" as const };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateSetting('theme', theme);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 lg:px-8">
      {/* Hero Section */}
      <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage your preferences and account
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
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

      <div className="space-y-6">
        {/* Theme Settings */}
        <Card className="rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Appearance
            </CardTitle>
            <CardDescription>Customize the look and feel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex gap-2">
                <Button
                  variant={settings.theme === 'light' ? 'default' : 'outline'}
                  onClick={() => handleThemeChange('light')}
                  className="flex-1"
                >
                  Light
                </Button>
                <Button
                  variant={settings.theme === 'dark' ? 'default' : 'outline'}
                  onClick={() => handleThemeChange('dark')}
                  className="flex-1"
                >
                  Dark
                </Button>
                <Button
                  variant={settings.theme === 'system' ? 'default' : 'outline'}
                  onClick={() => handleThemeChange('system')}
                  className="flex-1"
                >
                  System
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

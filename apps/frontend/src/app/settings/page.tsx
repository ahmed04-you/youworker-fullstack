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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 lg:px-8">
      {/* Hero Section with better hierarchy */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="h1">Settings</h1>
            <p className="text-body text-muted-foreground">
              Manage your preferences and account
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <Badge variant={statusBadge.variant} className="rounded-full px-4 py-1.5">
              {statusBadge.label}
            </Badge>
            {isAuthenticated && username && (
              <Badge variant="outline" className="rounded-full px-4 py-1.5">
                {username}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content sections with clear separation */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="h4">Appearance</CardTitle>
                <CardDescription className="text-body-sm">
                  Customize the look and feel of your workspace
                </CardDescription>
              </div>
            </div>
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

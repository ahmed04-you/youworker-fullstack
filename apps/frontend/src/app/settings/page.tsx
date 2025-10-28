"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ShieldAlert, Sparkles, DoorOpen, Cookie, Loader2, Palette, MessageCircle, Key, Database, Eye, Trash2, Download, Globe, Volume2, Mic, Zap, Globe2, EyeOff, VolumeX, Play, FastForward, Settings, User, Lock, KeyRound, Mic2, ZapOff } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useSettings } from '@/lib/settings-context';

export default function SettingsPage() {
  const { isAuthenticated, username, logout, isLoading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [newShortcutKey, setNewShortcutKey] = useState('');
  const [newShortcutAction, setNewShortcutAction] = useState('');
  const { t } = useTranslations("settings");
  const { settings, updateSetting, isConnected } = useSettings();

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

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateSetting('theme', theme);
  };

  const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
    updateSetting('fontSize', size);
  };

  const handleReduceMotionChange = (checked: boolean) => {
    updateSetting('reduceMotion', checked);
  };

  const handleDefaultModelChange = (model: string) => {
    updateSetting('defaultModel', model);
  };

  const handleDefaultLanguageChange = (language: string) => {
    updateSetting('defaultLanguage', language);
  };

  const handleEnableToolsChange = (checked: boolean) => {
    updateSetting('enableTools', checked);
  };

  const handleAutoPlayAudioChange = (checked: boolean) => {
    updateSetting('autoPlayAudio', checked);
  };

  const handleStreamSpeedChange = (speed: 'normal' | 'fast' | 'slow') => {
    updateSetting('streamSpeed', speed);
  };

  const handleAccentColorChange = (color: string) => {
    updateSetting('accentColor', color);
  };

  const handleApiEndpointChange = (endpoint: string) => {
    updateSetting('apiEndpoint', endpoint);
  };

  const handleApiKeyChange = (key: string | null) => {
    updateSetting('apiKey', key);
  };

  const handleHighContrastChange = (checked: boolean) => {
    updateSetting('highContrast', checked);
  };

  const handleScreenReaderChange = (checked: boolean) => {
    updateSetting('screenReader', checked);
  };

  const handleExportData = () => {
    toast.success('Data exported successfully');
  };

  const handleClearHistory = () => {
    if (confirm('Clear all conversation history? This cannot be undone.')) {
      // Implement clear history logic
      toast.success('History cleared');
    }
  };

  const handleDownloadData = () => {
    // Implement download personal data
    toast.success('Personal data download started');
  };

  const handleDeleteAccount = () => {
    if (confirm('Delete your account? This action cannot be undone.')) {
      // Implement delete account
      toast.success('Account deletion requested');
    }
  };

  const handleAddShortcut = () => {
    if (newShortcutKey && newShortcutAction) {
      const newShortcuts = { ...settings.shortcuts, [newShortcutKey]: newShortcutAction };
      updateSetting('shortcuts', newShortcuts);
      setNewShortcutKey('');
      setNewShortcutAction('');
      toast.success('Shortcut added');
    }
  };

  const handleShortcutChange = (key: string, action: string) => {
    const newShortcuts = { ...settings.shortcuts, [key]: action };
    updateSetting('shortcuts', newShortcuts);
  };

  const connectionIndicator = (
    <div className={`flex items-center gap-2 text-xs ${
      isConnected ? 'text-green-600' : 'text-red-600'
    }`}>
      <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
      {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  );

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
            {connectionIndicator}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Authentication */}
        <Card className="rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Authentication
            </CardTitle>
            <CardDescription>Manage your authentication status</CardDescription>
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
                    Session Cookies
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Session-based authentication using secure cookies
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/70 p-3">
                <Sparkles className="mt-1 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Continuous Refresh
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Automatic session refresh to keep you logged in
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
                      Logging out...
                    </>
                  ) : (
                    <>
                      <DoorOpen className="mr-2 h-4 w-4" />
                      Logout
                    </>
                  )}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Guest mode - no authentication required
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card className="rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Palette className="h-4 w-4 text-primary" />
              Theme Settings
            </CardTitle>
            <CardDescription>Customize the appearance of your interface</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Theme</Label>
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
            <div className="space-y-2">
              <Label className="text-sm font-medium">Accent Color</Label>
              <div className="flex gap-2">
                {['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'].map((color) => (
                  <Button
                    key={color}
                    variant={settings.accentColor === color ? 'default' : 'outline'}
                    onClick={() => handleAccentColorChange(color)}
                    style={{ backgroundColor: color, color: 'white' }}
                    className="h-10 w-10 p-0 rounded-full"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Font Size</Label>
              <div className="flex gap-2">
                <Button
                  variant={settings.fontSize === 'small' ? 'default' : 'outline'}
                  onClick={() => handleFontSizeChange('small')}
                  className="flex-1"
                >
                  Small
                </Button>
                <Button
                  variant={settings.fontSize === 'medium' ? 'default' : 'outline'}
                  onClick={() => handleFontSizeChange('medium')}
                  className="flex-1"
                >
                  Medium
                </Button>
                <Button
                  variant={settings.fontSize === 'large' ? 'default' : 'outline'}
                  onClick={() => handleFontSizeChange('large')}
                  className="flex-1"
                >
                  Large
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  id="reduce-motion"
                  checked={settings.reduceMotion}
                  onChange={(e) => handleReduceMotionChange(e.target.checked)}
                  className="rounded border-2"
                />
                Reduce Motion (Respects system preference)
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Chat Preferences */}
        <Card className="rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <MessageCircle className="h-4 w-4 text-primary" />
              Chat Preferences
            </CardTitle>
            <CardDescription>Configure your chat experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Default Model</Label>
              <select
                value={settings.defaultModel}
                onChange={(e) => handleDefaultModelChange(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Default Language</Label>
              <select
                value={settings.defaultLanguage}
                onChange={(e) => handleDefaultLanguageChange(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  id="enable-tools"
                  checked={settings.enableTools}
                  onChange={(e) => handleEnableToolsChange(e.target.checked)}
                  className="rounded border-2"
                />
                Enable Tools by Default
              </Label>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  id="auto-play-audio"
                  checked={settings.autoPlayAudio}
                  onChange={(e) => handleAutoPlayAudioChange(e.target.checked)}
                  className="rounded border-2"
                />
                Auto-play Audio Responses
              </Label>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Stream Speed</Label>
              <div className="flex gap-2">
                <Button
                  variant={settings.streamSpeed === 'slow' ? 'default' : 'outline'}
                  onClick={() => handleStreamSpeedChange('slow')}
                  className="flex-1"
                >
                  Slow
                </Button>
                <Button
                  variant={settings.streamSpeed === 'normal' ? 'default' : 'outline'}
                  onClick={() => handleStreamSpeedChange('normal')}
                  className="flex-1"
                >
                  Normal
                </Button>
                <Button
                  variant={settings.streamSpeed === 'fast' ? 'default' : 'outline'}
                  onClick={() => handleStreamSpeedChange('fast')}
                  className="flex-1"
                >
                  Fast
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card className="rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Key className="h-4 w-4 text-primary" />
              API Configuration
            </CardTitle>
            <CardDescription>Manage your API keys and endpoints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">API Endpoint</Label>
              <Input
                value={settings.apiEndpoint}
                onChange={(e) => handleApiEndpointChange(e.target.value)}
                className="w-full"
                placeholder="API endpoint URL"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={settings.apiKey || ''}
                  onChange={(e) => handleApiKeyChange(e.target.value || null)}
                  className="w-full pr-20"
                  placeholder="Enter API key"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                {connectionIndicator}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                if (confirm('Regenerate API key? This will invalidate the current key.')) {
                  // Implement regenerate
                  toast.success('New API key generated');
                }
              }}>
                Regenerate Key
              </Button>
              <Button variant="destructive" size="sm" onClick={() => {
                if (confirm('Remove API key?')) {
                  handleApiKeyChange(null);
                  toast.success('API key removed');
                }
              }}>
                Remove Key
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card className="rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Settings className="h-4 w-4 text-primary" />
              Keyboard Shortcuts
            </CardTitle>
            <CardDescription>View and customize keyboard shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-muted-foreground mb-4">
              Press <kbd className="px-1 bg-muted rounded">?</kbd> for shortcuts help
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Shortcut (e.g., Cmd+K)"
                  value={newShortcutKey}
                  onChange={(e) => setNewShortcutKey(e.target.value)}
                  className="flex-1 rounded-md border px-3 py-2 text-sm"
                />
                <select 
                  value={newShortcutAction}
                  onChange={(e) => setNewShortcutAction(e.target.value)}
                  className="w-48 rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select action</option>
                  <option value="New Session">New Session</option>
                  <option value="Send Message">Send Message</option>
                  <option value="Voice Input">Voice Input</option>
                  <option value="Upload Document">Upload Document</option>
                </select>
                <Button size="sm" onClick={handleAddShortcut}>
                  Add
                </Button>
              </div>
            </div>
            <div className="rounded-md border overflow-auto max-h-40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shortcut</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(settings.shortcuts).map(([key, action]) => (
                    <TableRow key={key}>
                      <TableCell><kbd className="px-1 bg-muted rounded">{key}</kbd></TableCell>
                      <TableCell>{action}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Database className="h-4 w-4 text-primary" />
              Data Management
            </CardTitle>
            <CardDescription>Manage your personal data and privacy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={handleExportData} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Export All Sessions
            </Button>
            <Button variant="outline" onClick={handleClearHistory} className="w-full">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Conversation History
            </Button>
            <Button variant="outline" onClick={handleDownloadData} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Download Personal Data
            </Button>
            <Separator />
            <Button variant="destructive" onClick={handleDeleteAccount} className="w-full">
              <User className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </CardContent>
        </Card>

        {/* Accessibility */}
        <Card className="rounded-3xl border border-border bg-card/70 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="h-4 w-4 text-primary" />
              Accessibility
            </CardTitle>
            <CardDescription>Optimize for accessibility needs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  id="high-contrast"
                  checked={settings.highContrast}
                  onChange={(e) => handleHighContrastChange(e.target.checked)}
                  className="rounded border-2"
                />
                High Contrast Mode
              </Label>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  id="screen-reader"
                  checked={settings.screenReader}
                  onChange={(e) => handleScreenReaderChange(e.target.checked)}
                  className="rounded border-2"
                />
                Screen Reader Optimized
              </Label>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Keyboard navigation enabled throughout the app</p>
              <p>• Color contrast meets WCAG AA standards</p>
              <p>• Skip links available for screen readers</p>
              <p>• Focus indicators visible on all interactive elements</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

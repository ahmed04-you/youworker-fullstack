"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function SettingsPage() {
  const { apiKey, setApiKey, clearAuth, isAuthenticated } = useAuth();
  const [newApiKey, setNewApiKey] = useState(apiKey || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!newApiKey.trim()) return;
    setIsSaving(true);
    setApiKey(newApiKey.trim());
    setIsSaving(false);
  };

  const handleClear = () => {
    clearAuth();
    setNewApiKey("");
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Configure your API key for authentication with the backend.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Enter your API key..."
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              disabled={isSaving}
            />
            <p className="text-sm text-muted-foreground">
              {isAuthenticated ? "API key is set." : "No API key configured. Some features require authentication."}
            </p>
          </div>
          <div className="flex gap-4">
            <Button onClick={handleSave} disabled={!newApiKey.trim() || isSaving} className="flex-1">
              {isSaving ? "Saving..." : "Save API Key"}
            </Button>
            {isAuthenticated && (
              <Button variant="destructive" onClick={handleClear} disabled={isSaving} className="flex-1">
                Clear
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            <p>API Key is stored securely in your browser. For production, consider JWT tokens.</p>
            <Link href="/docs/API.md#authentication" className="underline">Learn more about authentication</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
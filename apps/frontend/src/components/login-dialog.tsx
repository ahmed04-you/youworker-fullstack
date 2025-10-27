"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock } from "lucide-react";

export function LoginDialog() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(apiKey.trim());
      setApiKey(""); // Clear input after successful login
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't show dialog if authenticated or still loading
  if (isAuthenticated || isLoading) {
    return null;
  }

  return (
    <Dialog open={!isAuthenticated} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-6 w-6 text-primary" />
            <DialogTitle>Authentication Required</DialogTitle>
          </div>
          <DialogDescription>
            YouWorker normally signs you in automatically via Authentik. If this dialog appears,
            supply a valid API key to continue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isSubmitting}
              required
              autoFocus
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              "Login"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Sessions are secured with HttpOnly cookies. Authentik-managed API keys never touch the client.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

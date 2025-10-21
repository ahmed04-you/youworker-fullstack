"use client"

import { Settings } from "lucide-react"
import { Card } from "@/components/ui/card"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"

export default function SettingsPage() {
  return (
    <div className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-2xl rounded-2xl border-border/50 bg-card/50 p-8 shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
          <Settings className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-semibold">Impostazioni</h1>
        </div>

        <div className="mt-6 space-y-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-medium">Aspetto</h2>
              <p className="text-sm text-muted-foreground">Personalizza look and feel dell&apos;applicazione</p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="theme-toggle">Tema</Label>
                <p className="text-sm text-muted-foreground">Seleziona la combinazione di colori preferita</p>
              </div>
              <ThemeToggle />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-medium">Accessibilità</h2>
              <p className="text-sm text-muted-foreground">
                Le preferenze di animazione vengono rilevate automaticamente dalle impostazioni di sistema
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

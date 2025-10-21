"use client"

import { Settings } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary" aria-hidden="true" />
            <DialogTitle className="text-2xl">Impostazioni</DialogTitle>
          </div>
          <DialogDescription>Personalizza look and feel dell&apos;applicazione</DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6 pb-2">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-medium">Aspetto</h2>
              <p className="text-sm text-muted-foreground">Seleziona la combinazione di colori preferita</p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="theme-toggle">Tema</Label>
                <p className="text-sm text-muted-foreground">Scegli tema chiaro, scuro o quello di sistema</p>
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
      </DialogContent>
    </Dialog>
  )
}

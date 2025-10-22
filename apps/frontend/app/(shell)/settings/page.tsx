"use client"

import { useRouter } from "next/navigation"
import { Settings, History } from "lucide-react"
import { Card } from "@/components/ui/card"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  const router = useRouter()

  return (
    <div className="container mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Settings className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Impostazioni rapide</h1>
          <p className="text-sm text-muted-foreground">Gestisci l&apos;aspetto e gli strumenti essenziali della workspace.</p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-3 rounded-2xl border-border/40 bg-card/30 p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Workspace</h2>
          <div className="flex flex-col gap-2 rounded-xl border border-border/40 bg-background/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium">Tema</span>
              <ThemeToggle />
            </div>
            <p className="text-xs text-muted-foreground">Scegli rapidamente tra modalità chiara, scura o automatica.</p>
          </div>
          <div className="rounded-xl border border-dashed border-border/40 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            Il tema selezionato viene salvato e applicato a tutte le sessioni attive.
          </div>
        </Card>

        <Card className="flex flex-col gap-3 rounded-2xl border-border/40 bg-card/30 p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Cronologia</h2>
          <p className="text-sm text-muted-foreground">
            Consulta conversazioni e documenti inviati di recente senza lasciare questa finestra.
          </p>
          <Button variant="outline" className="justify-between rounded-xl" onClick={() => router.push("/history")}>
            <span className="flex items-center gap-2">
              <History className="h-4 w-4" aria-hidden="true" />
              Apri cronologia
            </span>
          </Button>
        </Card>
      </section>

      <Card className="rounded-2xl border-border/40 bg-card/30 p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Accessibilità</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Adattiamo automaticamente animazioni e riduzione del movimento seguendo le preferenze di sistema. Non serve
          alcuna configurazione aggiuntiva.
        </p>
      </Card>
    </div>
  )
}

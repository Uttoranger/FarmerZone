'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const MODI = [
  { key: 'light', label: 'Hell', icon: Sun },
  { key: 'dark', label: 'Dunkel', icon: Moon },
  { key: 'system', label: 'System', icon: Monitor },
] as const

// Die Wahl liegt im localStorage des Geräts. Der Server kennt sie nicht und
// würde beim ersten Rendern zwangsläufig das falsche Segment markieren — die
// Markierung spränge dann sichtbar um. useSyncExternalStore liefert auf dem
// Server und während der Hydration `false`, danach `true`: bis dahin steht ein
// Platzhalter gleicher Höhe da, damit nichts hüpft (Muster wie meldung-form).
function nichtsAbonnieren(): () => void {
  return () => {}
}
function imBrowser(): boolean {
  return true
}
function aufDemServer(): boolean {
  return false
}

export function DarstellungKarte() {
  const { theme, setTheme } = useTheme()
  const montiert = useSyncExternalStore(nichtsAbonnieren, imBrowser, aufDemServer)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sun className="size-4 text-primary" />
          <CardTitle>Darstellung</CardTitle>
        </div>
        <CardDescription>Hell, dunkel — oder so, wie dein Gerät es eingestellt hat.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {montiert ? (
          <div
            role="group"
            aria-label="Darstellung"
            className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
          >
            {MODI.map(({ key, label, icon: Icon }) => {
              const aktiv = (theme ?? 'system') === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={aktiv}
                  onClick={() => setTheme(key)}
                  // min-h-11 = 44px: die kleinste Fläche, die ein Daumen auf
                  // dem Handy zuverlässig trifft.
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                    aktiv
                      ? 'bg-card text-foreground ring-1 ring-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              )
            })}
          </div>
        ) : (
          // 44px Knopf + 2×4px Wannenrand = 52px, damit die Karte nicht wächst.
          <div className="h-13 rounded-xl bg-muted" aria-hidden="true" />
        )}
        <p className="text-sm text-muted-foreground">
          Die Einstellung gilt nur auf diesem Gerät und in diesem Browser. Deine Hofseite sieht für
          Besucher weiterhin so aus, wie deren Gerät eingestellt ist.
        </p>
      </CardContent>
    </Card>
  )
}

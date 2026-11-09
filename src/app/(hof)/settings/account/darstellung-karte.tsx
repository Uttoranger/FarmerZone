'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { KARTEN_TITEL } from '@/components/hof-einstellungen/knopf'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChipGruppe, type ChipGruppeOption } from '@/components/ui/segment'

const MODI: readonly ChipGruppeOption[] = [
  { wert: 'light', label: 'Hell' },
  { wert: 'dark', label: 'Dunkel' },
  { wert: 'system', label: 'System' },
]

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

/** „Gilt für dieses Gerät.“ wörtlich nach Board s2-/w2-konto-hof Bild 2 (Nr. 250). */
export const DARSTELLUNG_SATZ = 'Gilt für dieses Gerät.'

/**
 * Darstellung als Chip-Gruppe (G11) mit dem einen Satz des Boards — vorher ein Segment mit Symbolen und
 * einem Absatz (Liste Lauf 32, konto-hof „Darstellung als Segment“, Nr. 250).
 */
export function DarstellungKarte() {
  const { theme, setTheme } = useTheme()
  const montiert = useSyncExternalStore(nichtsAbonnieren, imBrowser, aufDemServer)

  return (
    <Card>
      <CardHeader>
        <CardTitle className={KARTEN_TITEL}>Darstellung</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{DARSTELLUNG_SATZ}</p>
        {montiert ? (
          <ChipGruppe beschriftung="Darstellung" optionen={MODI} wert={theme ?? 'system'} onWertChange={setTheme} />
        ) : (
          // So hoch wie eine Reihe Pillen (44 px), damit die Karte nicht wächst.
          <div className="h-11" aria-hidden="true" />
        )}
      </CardContent>
    </Card>
  )
}

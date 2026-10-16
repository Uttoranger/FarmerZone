'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLinkStatus } from 'next/link'
import { cn } from '@/lib/utils'

/*
 * Laden ohne Ladebild (Register N14, Ergänzung; Nr. 105; Mockup
 * admin-postfach-ruhig): Ein Wechsel über einen Link lässt den bisherigen
 * Inhalt stehen, bis der neue da ist. So lange zeigt der gewählte Link einen
 * kleinen Punkt (`LadePunkt`, nur innerhalb eines `<Link>` — `useLinkStatus`
 * aus next/link), und der Inhalt trägt `aria-busy` (`LadeInhalt`) für
 * Screenreader. `LadeRahmen` umfasst beides und zählt, wie viele Links gerade
 * laden. Eigene Datei, weil `useLinkStatus` eine Client-Komponente verlangt —
 * chip.tsx bleibt serverseitig nutzbar (Seiten reichen dort Funktionen weiter).
 */

/** Stabil über alle Renders: Ein Punkt meldet sich mit +1 an und mit -1 ab. */
const MeldeKontext = createContext<((schritt: 1 | -1) => void) | null>(null)
const LaedtKontext = createContext(false)

export function LadeRahmen({ children }: { children: ReactNode }): React.JSX.Element {
  const [anzahl, setAnzahl] = useState(0)
  const melde = useCallback((schritt: 1 | -1) => setAnzahl((n) => Math.max(0, n + schritt)), [])
  return (
    <MeldeKontext.Provider value={melde}>
      <LaedtKontext.Provider value={anzahl > 0}>{children}</LaedtKontext.Provider>
    </MeldeKontext.Provider>
  )
}

/**
 * Der Inhalt, der während eines Wechsels stehen bleibt — `aria-busy` nur,
 * solange ein Link im selben `LadeRahmen` lädt (sonst fehlt das Attribut).
 */
export function LadeInhalt({ children, className }: { children: ReactNode; className?: string }): React.JSX.Element {
  const laedt = useContext(LaedtKontext)
  return (
    <div data-slot="lade-inhalt" aria-busy={laedt ? 'true' : undefined} className={className}>
      {children}
    </div>
  )
}

/**
 * Der kleine Kreis im gewählten Link, solange die neue Seite lädt. Absolut
 * gesetzt (im Polster des Chips), damit nichts daneben rückt; die Farbe ist
 * die des Texts. Für Screenreader steht `aria-busy` am Inhalt, nicht hier.
 */
export function LadePunkt({ className }: { className?: string }): React.JSX.Element | null {
  const { pending } = useLinkStatus()
  const melde = useContext(MeldeKontext)
  useEffect(() => {
    if (!pending || !melde) return
    melde(1)
    return () => melde(-1)
  }, [pending, melde])
  if (!pending) return null
  return (
    <span
      aria-hidden="true"
      data-slot="lade-punkt"
      className={cn('pointer-events-none absolute top-1/2 right-1.5 size-1.5 -translate-y-1/2 rounded-full bg-current motion-safe:animate-pulse', className)}
    />
  )
}

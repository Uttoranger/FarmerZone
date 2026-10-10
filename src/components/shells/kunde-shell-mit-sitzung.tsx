'use client'

import type { ReactNode } from 'react'
import { useKundenSitzung } from '@/lib/use-kunden-sitzung'
import { KundeShell } from '@/components/shells/kunde-shell'

/**
 * Die KundeShell für statische Seiten: Die Sitzung liest der Browser
 * (useKundenSitzung → useSession), nicht der Server. Liest eine Seite die
 * Sitzung auf dem Server (headers()), wird sie dynamisch — jeder Besuch
 * startet dann eine Serverless-Funktion, und Kopf und Standbild warten
 * darauf. Auf der Startseite war das der Preis nur für den Knopf rechts oben.
 *
 * Solange die Sitzung lädt, steht die Shell ohne Sitzung da („Anmelden") —
 * genau das HTML, das der Server statisch ausliefert; „Mein Konto"
 * (Kundensitzung) bzw. „Mein Hof" (Hof-Sitzung, Register N1) erscheint einen
 * Augenblick später.
 */
export function KundeShellMitSitzung({
  unterleiste,
  children,
}: {
  /** Durchgereicht an die KundeShell — `false` für Fokus-Seiten mit Kopf (Produktseite). */
  unterleiste?: boolean
  children: ReactNode
}): React.JSX.Element {
  const sitzung = useKundenSitzung()
  return (
    <KundeShell sitzung={sitzung} unterleiste={unterleiste}>
      {children}
    </KundeShell>
  )
}

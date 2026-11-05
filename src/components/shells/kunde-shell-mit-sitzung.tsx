'use client'

import type { ReactNode } from 'react'
import { useKundenSitzung } from '@/lib/use-kunden-sitzung'
import type { KundenNavId } from '@/lib/kunden-navigation'
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
  aktiv,
  handyTitel,
  fussSpalte,
  children,
}: {
  /** Durchgereicht an die KundeShell — `false` für Fokus-Seiten mit Kopf (Produktseite). */
  unterleiste?: boolean
  /** Durchgereicht an die KundeShell — Hof- und Produktseite setzen `entdecken` (Nr. 177). */
  aktiv?: KundenNavId
  /** Durchgereicht an die KundeShell — die Titelzeile am Handy (Bestätigung, Bestellseite; Lauf 31). */
  handyTitel?: string
  /** Durchgereicht an die KundeShell — der Seitenfuß im Browser in der Spalte des Inhalts (Lauf 31). */
  fussSpalte?: string
  children: ReactNode
}): React.JSX.Element {
  const sitzung = useKundenSitzung()
  return (
    <KundeShell sitzung={sitzung} unterleiste={unterleiste} aktiv={aktiv} handyTitel={handyTitel} fussSpalte={fussSpalte}>
      {children}
    </KundeShell>
  )
}

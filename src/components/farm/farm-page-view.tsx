'use client'

/*
 * FarmPageView — DIE Hofseite. Es gibt sie genau einmal (ARCHITECTURE §4);
 * genau eine Stelle bindet sie ein, tests/hofseite-einmal.test.ts lässt eine
 * zweite fehlschlagen:
 *
 * src/app/(public)/[farmSlug]/page.tsx — Kundinnen und die Vorschau des
 * Hofs (?vorschau=1, dieselbe Route). Gerendert wird die Hofseite im neuen
 * Design (components/hofseite/hofseite-kunde.tsx, Nachtlauf Nr. 10) in der
 * KundeShell der Seite. Was die Vorschau anders macht, kommt fertig
 * entschieden als `ansicht` aus `ansichtsModus` (src/lib/ansichts-modus.ts):
 * `kaufen` (wirkungslos in der Vorschau) und `art` (der Empfänger für die
 * Markierung des Editors, VorschauImRahmen). Dazu `reorderItems` aus dem
 * Nachbestell-Link — nur, wo Kaufen wirkt. Kein Stift, keine Werkzeugleiste,
 * kein Bearbeitungs-Hinweis.
 *
 * Bis Nr. 49 gab es hier auch den Bearbeitungsmodus des Besitzers mit
 * Stiften (am Handy unter lg auf /farm-page). Seit Nr. 50 bearbeitet Mein Hof
 * mit der Liste der Abschnitte und dem Blatt von unten
 * (components/mein-hof/abschnitte-liste.tsx); der Bearbeitungsmodus ist seit
 * Nr. 50 Runde 1 entfernt. Geblieben ist hier nur der Stil der Knöpfe auf
 * dem Titelbild (TITELBILD_KNOPF_STIL); den Knopf selbst (CoverEditButton)
 * trägt seit Nr. 306 components/farm/titelbild-knopf.tsx, damit er nicht im
 * Paket der Hofseite landet — diese Datei bindet ihn nie ein. Den Ausschnitt wählt seit
 * Nr. 97 der Bild-Baustein (components/shared/bild-ausschnitt.tsx), das
 * frühere CoverFocusAdjust (nur senkrecht) ist entfallen.
 */

import { PreisAnzeigeRahmen } from '@/components/shared/preis-anzeige'
import type { ActiveStatusPost } from '@/server/queries/status-posts'
import { HofseiteKunde, type HofseiteHof } from '@/components/hofseite/hofseite-kunde'
import type { SeitenAnsicht } from '@/lib/ansichts-modus'
import type { KaufSperre } from '@/lib/bereiche-anzeige'

// ── Titelbild: Knöpfe für Mein Hof ────────────────────────────────────────────

/**
 * Knöpfe, die auf dem Titelbildfoto liegen (Baustein „Titelbild" von Mein
 * Hof, components/mein-hof/bild-bausteine.tsx): in beiden Modi eine weiße
 * Marke mit dunkelgrüner Schrift — das Foto darunter folgt keinem Modus, die
 * Schrift deshalb auch nicht (`--foto-knopf-ink`, in beiden Modi gleich).
 */
export const TITELBILD_KNOPF_STIL = {
  background: 'rgba(255,255,255,0.94)',
  color: 'var(--foto-knopf-ink)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
} as const

// ── Die Hofseite ──────────────────────────────────────────────────────────────

type ReorderItem = { productId: string; productName: string; quantity: number }

type Props = {
  /** Der Hof ohne Telefon und E-Mail (Nr. 60) — page.tsx entfernt beide auf dem Server. */
  farm: HofseiteHof
  /** Die aktiven Beiträge, der neueste zuerst (Register F8). */
  beitraege: ActiveStatusPost[]
  /** Das Laden der Beiträge ist gescheitert (page.tsx): Die Seite sagt zu `?beitrag=` nichts (Nr. 134). */
  beitraegeFehler?: boolean
  reorderItems?: ReorderItem[]
  /**
   * Wer die öffentliche Seite sieht, entschieden von `ansichtsModus`
   * (src/lib/ansichts-modus.ts): In der Vorschau ist Kaufen wirkungslos, und
   * der Editor im Bauern-Bereich darf Abschnitte markieren (vorschau-im-rahmen.tsx).
   * Ohne Angabe: die Seite für Kundinnen.
   */
  ansicht?: Pick<SeitenAnsicht, 'art' | 'kaufen'>
  /**
   * Zeitpunkt der Anfrage (ISO), einmal auf dem Server bestimmt — page.tsx
   * setzt ihn immer.
   */
  jetzt?: string
  /** Die Kaufsperre (Register N24) — page.tsx rechnet sie einmal mit `jetzt` (kaufSperre). */
  sperre: KaufSperre
}

const FUER_KUNDINNEN: Pick<SeitenAnsicht, 'art' | 'kaufen'> = { art: 'kundin', kaufen: true }

export function FarmPageView({ farm, beitraege, beitraegeFehler = false, reorderItems, ansicht = FUER_KUNDINNEN, jetzt, sperre }: Props) {
  // Ohne Zeitpunkt vom Server (kein Aufrufer heute) die eigene Uhr — dann
  // kann „vor N Stunden" zwischen Server und Browser abweichen.
  // Die Preisanzeige (N38, Nr. 197) einmal für die ganze Seite: Karten, Korb und Seitenspalte lesen sie (usePreisAnzeige).
  return (
    <PreisAnzeigeRahmen anzeige={farm.preisAnzeige}>
      <HofseiteKunde
        farm={farm}
        beitraege={beitraege}
        beitraegeFehler={beitraegeFehler}
        reorderItems={reorderItems}
        ansicht={ansicht}
        jetzt={jetzt ?? new Date().toISOString()}
        sperre={sperre}
      />
    </PreisAnzeigeRahmen>
  )
}

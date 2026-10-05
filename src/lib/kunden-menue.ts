/**
 * Das Menü der Handy-Leiste auf den Kundenseiten — welche Punkte es hat und
 * welcher davon die aktuelle Seite ist. Rein, ohne Browser prüfbar
 * (tests/kunden-menue.test.ts); das Blatt in src/components/shared/kunden-kopf.tsx
 * zeigt nur an.
 *
 * Anlass: Am Handy gab es außerhalb der Startseite keinen Weg zur Startseite
 * und kein Menü — Kundenseiten haben keine Leiste unten, also muss die obere
 * Leiste alle Wege tragen, die im Browser die Kopfzeile trägt.
 */
import { hoefeLink } from '@/lib/bereiche-anzeige'

export type MenuePunkt = {
  href: string
  text: string
  /** Kunden gehen einkaufen, Höfe gehen zu ihrem Bereich — zwischen beiden steht im Blatt ein Trennstrich. */
  gruppe: 'kunden' | 'hoefe' | 'hilfe'
}

/** Die Reihenfolge ist die Anzeige. */
export const MENUE_PUNKTE: readonly MenuePunkt[] = [
  { href: '/', text: 'Startseite', gruppe: 'kunden' },
  { href: hoefeLink('LEBENSMITTEL'), text: 'Hofladen entdecken', gruppe: 'kunden' },
  { href: hoefeLink('FUTTERMITTEL'), text: 'Heu & Futter finden', gruppe: 'kunden' },
  // Sprungmarke auf das Band „Für Höfe" der Startseite (id="fuer-hoefe"), wie im Browser.
  { href: '/#fuer-hoefe', text: 'Für Höfe', gruppe: 'hoefe' },
  { href: '/login', text: 'Hofbetreiber-Login', gruppe: 'hoefe' },
  { href: '/problem-melden', text: 'Problem melden', gruppe: 'hilfe' },
]

export type AngezeigterMenuePunkt = MenuePunkt & { aktuell: boolean }

/**
 * Die Punkte mit Markierung der aktuellen Seite (aria-current). Verglichen
 * wird der Pfad und — für /hoefe — der Bereich: „Hofladen entdecken" und
 * „Heu & Futter finden" führen auf dieselbe Seite, aber nicht zum selben
 * Inhalt. „Für Höfe" ist ein Anker auf der Startseite und nie „aktuell".
 */
export function menuePunkte(pfad: string, suche: string): AngezeigterMenuePunkt[] {
  const futter = new URLSearchParams(suche).get('bereich') === 'futter'
  const aktuellerLink = pfad === '/hoefe' && futter ? hoefeLink('FUTTERMITTEL') : pfad
  return MENUE_PUNKTE.map((punkt) => ({ ...punkt, aktuell: punkt.href === aktuellerLink }))
}

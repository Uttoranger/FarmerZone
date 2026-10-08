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
import { kopfKnopf, type KundenSitzung } from '@/lib/kunden-navigation'

export type MenuePunkt = {
  href: string
  text: string
  /** Kunden gehen einkaufen, Höfe gehen zu ihrem Bereich — zwischen beiden steht im Blatt ein Trennstrich. */
  gruppe: 'kunden' | 'hoefe' | 'hilfe'
}

const EINKAUFEN: readonly MenuePunkt[] = [
  { href: '/', text: 'Startseite', gruppe: 'kunden' },
  { href: hoefeLink('LEBENSMITTEL'), text: 'Hofladen entdecken', gruppe: 'kunden' },
  { href: hoefeLink('FUTTERMITTEL'), text: 'Heu & Futter finden', gruppe: 'kunden' },
]
// Die Seite für Höfe (seit Nr. 15, vorher eine Sprungmarke auf die Startseite).
const FUER_HOEFE: MenuePunkt = { href: '/fuer-hoefe', text: 'Für Höfe', gruppe: 'hoefe' }
const PROBLEM_MELDEN: MenuePunkt = { href: '/problem-melden', text: 'Problem melden', gruppe: 'hilfe' }

/**
 * Die Punkte in Anzeigereihenfolge. Der Weg der Höfe ist derselbe Punkt wie
 * der Knopf oben rechts (kopfKnopf, Register N1): „Anmelden" (→ /login), mit
 * Hof-Sitzung „Mein Hof" (→ /dashboard) — vorher hieß er „Hofbetreiber-Login".
 */
export function menueFuer(sitzung: KundenSitzung): readonly MenuePunkt[] {
  const knopf = kopfKnopf(sitzung)
  return [...EINKAUFEN, FUER_HOEFE, { href: knopf.href, text: knopf.label, gruppe: 'hoefe' }, PROBLEM_MELDEN]
}

export type AngezeigterMenuePunkt = MenuePunkt & { aktuell: boolean }

/**
 * Die Punkte mit Markierung der aktuellen Seite (aria-current). Verglichen
 * wird der Pfad und — für /hoefe — der Bereich: „Hofladen entdecken" und
 * „Heu & Futter finden" führen auf dieselbe Seite, aber nicht zum selben
 * Inhalt. „Für Höfe" ist seit Nr. 15 eine eigene Seite (/fuer-hoefe).
 */
export function menuePunkte(pfad: string, suche: string, sitzung: KundenSitzung): AngezeigterMenuePunkt[] {
  const futter = new URLSearchParams(suche).get('bereich') === 'futter'
  const aktuellerLink = pfad === '/hoefe' && futter ? hoefeLink('FUTTERMITTEL') : pfad
  return menueFuer(sitzung).map((punkt) => ({ ...punkt, aktuell: punkt.href === aktuellerLink }))
}

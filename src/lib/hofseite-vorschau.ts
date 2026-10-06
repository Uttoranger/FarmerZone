/**
 * Rund um die Vorschau der Hofseite (/[farmSlug]?vorschau=1): Adresse,
 * Korb-Regel, Nachrichten zwischen Editor und Rahmen, Maße. WER die Vorschau
 * bekommt und was dann anders ist, entscheidet nicht diese Datei, sondern
 * `ansichtsModus` (src/lib/ansichts-modus.ts) — nur dort wird der Parameter
 * gelesen. Rein und ohne Datenbank prüfbar (tests/hofseite-vorschau.test.ts).
 */
import { bereitSchema, markierungSchema, type HofseiteZeileId } from '@/schemas/hofseite-vorschau'

/** Der Name des Parameters — zum Schreiben von Adressen. Gelesen wird er nur in ansichtsModus. */
export const VORSCHAU_PARAMETER = 'vorschau'

/** Statt „In den Warenkorb" — im Vorschau-Modus wird nichts bestellt und kein Korb angelegt. */
export const VORSCHAU_KAUF_HINWEIS = 'Vorschau — hier wird nichts bestellt'

/**
 * Ob die Hofseite überhaupt einen Warenkorb führen darf. EINE Regel für
 * jeden Weg in den Korb — Kaufknopf, Nachbestell-Link, #warenkorb-Anker,
 * Korb-Knopf und Sheet (product-grid.tsx). Der Bearbeitungsmodus des Hofs
 * kennt keinen Korb; ob Kaufen überhaupt wirkt, sagt `ansichtsModus` —
 * in der Vorschau nie, denn ein Korb reserviert Bestand.
 */
export function korbErlaubt(lage: { isEditMode: boolean; kaufen: boolean }): boolean {
  return !lage.isEditMode && lage.kaufen
}

/**
 * Die Markierungs-Nachricht des Editors, aus dem Ereignis der Vorschau
 * gelesen: nur vom eigenen Ursprung und nur in der vereinbarten Form, sonst
 * null. Eine fremde Seite im Browser kann jedem Fenster Nachrichten schicken.
 */
export function leseMarkierung(ereignis: { origin: string; data: unknown }, eigenerUrsprung: string): HofseiteZeileId | null {
  if (ereignis.origin !== eigenerUrsprung) return null
  const gelesen = markierungSchema.safeParse(ereignis.data)
  return gelesen.success ? gelesen.data.abschnitt : null
}

/**
 * Die Bereit-Meldung der Hofseite im Rahmen, aus dem Ereignis des Editors
 * gelesen — dieselbe Vorsicht wie bei der Markierung: nur der eigene Ursprung,
 * nur die vereinbarte Form.
 */
export function leseBereit(ereignis: { origin: string; data: unknown }, eigenerUrsprung: string): boolean {
  if (ereignis.origin !== eigenerUrsprung) return false
  return bereitSchema.safeParse(ereignis.data).success
}

/**
 * Ob ein Klick auf einen Link die Hofseite im Rahmen verlässt — dann öffnet
 * die Vorschau ihn in einem neuen Tab, weil die Zielseite sich nicht einbetten
 * lässt (X-Frame-Options DENY). Bleibt: ein Link, der ohnehin einen neuen Tab
 * öffnet; tel:, mailto: und alles, was nicht http(s) ist (das regelt der
 * Browser); Anker und andere Bereiche derselben Seite (`#fotos`,
 * `?bereich=futter`); eine Adresse, die sich nicht lesen lässt.
 */
export function verlaesstRahmen(link: { href: string; target: string }, hier: string): boolean {
  if (link.target === '_blank') return false
  let ziel: URL
  let jetzt: URL
  try {
    ziel = new URL(link.href, hier)
    jetzt = new URL(hier)
  } catch {
    return false
  }
  if (ziel.protocol !== 'http:' && ziel.protocol !== 'https:') return false
  return ziel.origin !== jetzt.origin || ziel.pathname !== jetzt.pathname
}

/** Das Gerät, das die Vorschau nachstellt — der Umschalter im Editor (DESIGN_SYSTEM „Vorschau im Hofbereich"). */
export type VorschauGeraet = 'handy' | 'web'

/** Breite der Kundenseite je Gerät in CSS-Pixeln: Handy rendert ihr Handy-Layout, Web das Browser-Layout der Mockups. */
export const VORSCHAU_SEITENBREITE: Record<VorschauGeraet, number> = { handy: 390, web: 1440 }

/** Die Höhe eines Handy-Bildschirms in der Vorschau — der Rahmen zeigt genau diesen Ausschnitt. */
export const VORSCHAU_HANDY_HOEHE = 844

/** Ab dieser Fensterbreite passt die Web-Vorschau neben die Bearbeitung (useMindestbreite); darunter öffnet „Web" das Overlay. */
export const VORSCHAU_WEB_MINDESTBREITE = 1280

/** So schmal darf die Bearbeitung neben der Web-Vorschau werden — die Vorschau nimmt den Rest der Breite. */
export const VORSCHAU_BEARBEITUNG_BREITE = 400

/**
 * Der Maßstab, mit dem die Seite in einen Rahmen passt — berechnet aus der
 * Rahmenbreite, nie hart codiert; nie größer als 1 (eine Seite wird nicht
 * aufgeblasen). Für das Handy zählt auch die Höhe, wenn der Rahmen eine hat
 * (Overlay); die Web-Seite scrollt im Rahmen und braucht keine.
 */
export function vorschauMassstab(rahmen: { breite: number; hoehe?: number }, geraet: VorschauGeraet): number {
  if (rahmen.breite <= 0) return 1
  let massstab = Math.min(1, rahmen.breite / VORSCHAU_SEITENBREITE[geraet])
  if (geraet === 'handy' && rahmen.hoehe !== undefined && rahmen.hoehe > 0) {
    massstab = Math.min(massstab, rahmen.hoehe / VORSCHAU_HANDY_HOEHE)
  }
  return massstab
}

/**
 * Die Adresse der Vorschau zu einem Hof — für „In neuem Tab öffnen". Wer eine
 * Vorschau-Adresse braucht, nimmt diese oder `vorschauAdresse`; die Konstante
 * selbst steht nur hier und in ansichtsModus (tests/hofseite-einmal.test.ts).
 */
export function vorschauLink(slug: string, unterseite?: string): string {
  // Eine Unterseite des Hofs (die Produktseite, Nr. 11) bleibt in der Vorschau:
  // Der Lader dort fragt ansichtsModus wie die Hofseite.
  return `/${slug}${unterseite ? `/${unterseite}` : ''}?${VORSCHAU_PARAMETER}=1`
}

/** Die Adresse der Vorschau im Editor-Rahmen — `stand` erzwingt ein Neuladen nach dem Speichern. */
export function vorschauAdresse(slug: string, stand: number): string {
  return `${vorschauLink(slug)}&stand=${stand}`
}

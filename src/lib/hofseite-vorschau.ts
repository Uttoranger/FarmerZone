/**
 * Der Vorschau-Modus der öffentlichen Hofseite (/[farmSlug]?vorschau=1):
 * Der Hof sieht seine Seite so, wie Kundinnen sie sehen — auch, solange sie
 * noch nicht freigegeben ist. Rein und ohne Datenbank prüfbar
 * (tests/hofseite-vorschau.test.ts); die Seite fragt nur hier.
 */
import { bereitSchema, markierungSchema, vorschauParameterSchema, type HofseiteZeileId } from '@/schemas/hofseite-vorschau'

export const VORSCHAU_PARAMETER = 'vorschau'

/** Statt „In den Warenkorb" — im Vorschau-Modus wird nichts bestellt und kein Korb angelegt. */
export const VORSCHAU_KAUF_HINWEIS = 'Vorschau — hier wird nichts bestellt'

/**
 * Ob die Hofseite überhaupt einen Warenkorb führen darf. EINE Regel für
 * jeden Weg in den Korb — Kaufknopf, Nachbestell-Link, #warenkorb-Anker,
 * Korb-Knopf und Sheet (product-grid.tsx). Der Bearbeitungsmodus des Hofs
 * kennt keinen Korb, die Vorschau auch nicht: Ein Korb reserviert Bestand.
 */
export function korbErlaubt(lage: { isEditMode: boolean; vorschau: boolean }): boolean {
  return !lage.isEditMode && !lage.vorschau
}

export type VorschauZugriff = 'vorschau' | 'oeffentlich'

/** Ob die Adresse die Vorschau verlangt — nur genau `?vorschau=1`. */
export function vorschauGewuenscht(parameter: string | string[] | undefined): boolean {
  return vorschauParameterSchema.safeParse(parameter).success
}

/**
 * Wer den Parameter bekommt: nur der angemeldete Besitzer GENAU dieses Hofs.
 * Alle anderen — abgemeldet, fremder Hof, falscher Wert — sehen die Seite,
 * als stünde der Parameter nicht da. Ein nicht freigegebener Hof ist dann
 * weiter „nicht gefunden".
 */
export function vorschauZugriff(eingabe: {
  parameter: string | string[] | undefined
  angemeldeterNutzerId: string | null
  /** ownerId des Hofs zu diesem Slug — null, wenn es den Hof nicht gibt. */
  besitzerId: string | null
}): VorschauZugriff {
  const { parameter, angemeldeterNutzerId, besitzerId } = eingabe
  if (!vorschauGewuenscht(parameter)) return 'oeffentlich'
  if (!angemeldeterNutzerId || !besitzerId) return 'oeffentlich'
  return angemeldeterNutzerId === besitzerId ? 'vorschau' : 'oeffentlich'
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

/** Die Adresse der Vorschau zu einem Hof — `stand` erzwingt ein Neuladen nach dem Speichern. */
export function vorschauAdresse(slug: string, stand: number): string {
  return `/${slug}?${VORSCHAU_PARAMETER}=1&stand=${stand}`
}

/**
 * Der Katalog der Werte, die ein Hof auf seiner Seite zeigen kann
 * (Einstellungen → Auftritt, „Unsere Werte"). Rein und ohne Datenbank prüfbar
 * (tests/hof-werte.test.ts); die Symbole ordnet die Komponente zu.
 *
 * Ein gewählter Wert wird am TITEL erkannt, nicht an der Spalte
 * `FarmValue.icon`: Dort stand bis Oktober 2026 ein Emoji („🐄"), seither der
 * Schlüssel („tierwohl"). Ältere Zeilen behalten ihr Emoji — angezeigt wird es
 * nirgends mehr, die Hofseite zeigt einen Haken, der Editor das Symbol des
 * Katalogs. Eine Datenänderung ist deshalb nicht nötig.
 */

export const WERTE_KATALOG = [
  { schluessel: 'tierwohl', titel: 'Tierwohl' },
  { schluessel: 'bio', titel: 'Bio-zertifiziert' },
  { schluessel: 'saisonal', titel: 'Saisonal' },
  { schluessel: 'regional', titel: 'Regional' },
  { schluessel: 'handarbeit', titel: 'Handarbeit' },
  { schluessel: 'familie', titel: 'Familienbetrieb' },
] as const

export type WertKatalogEintrag = (typeof WERTE_KATALOG)[number]
export type WertSchluessel = WertKatalogEintrag['schluessel']

/** Der Katalogeintrag zu einem gespeicherten Wert, sonst null (z. B. ein Wert von außerhalb des Katalogs). */
export function katalogEintrag(wert: { title: string }): WertKatalogEintrag | null {
  return WERTE_KATALOG.find((k) => k.titel === wert.title) ?? null
}

/** Ist dieser Katalogeintrag unter den gespeicherten Werten? */
export function istGewaehlt(werte: readonly { title: string }[], eintrag: WertKatalogEintrag): boolean {
  return werte.some((w) => w.title === eintrag.titel)
}

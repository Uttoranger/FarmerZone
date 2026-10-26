/**
 * Die Käuferart als Vorbelegung in der Adresse (`?kaeufer=betrieb`, Nachtlauf
 * Nr. 29, Gate 8 „Region › Futter kaufen"). Ein Hof, der bei einem anderen
 * Hof Futter kauft, findet in der Kasse „Ich bestelle als landwirtschaftlicher
 * Betrieb" schon angehakt.
 *
 * Die Adresse ist eine Systemgrenze: Erlaubt ist nur `betrieb`, alles andere
 * fällt still weg — dann bleibt die Kasse, wie sie ohne Parameter ist. Der
 * Wert ist NUR der Startwert eines Formularfelds: Die Kundin kann umstellen,
 * und ob die Käuferart reicht, prüft allein /api/checkout
 * (pruefeBetriebsnachweis gegen Product.abgabe aus der Datenbank).
 *
 * Bewusst nur die Adresse — kein Cookie, kein Speicher im Browser: Der Wert
 * reist von „Futter kaufen" über die Produktseite bis zur Kasse und ist
 * danach vergessen (tests/kaeufer-vorbelegung.test.ts wacht darüber).
 *
 * Ohne Zod (Nr. 196): `mitKaeuferVorbelegung` läuft im Korb-Blatt und in der
 * Kasse im Browser (tests/leistung-196.test.ts).
 */
export const KAEUFER_PARAMETER = 'kaeufer'

export const KAEUFER_VORBELEGUNG_VALUES = ['betrieb'] as const

export type KaeuferVorbelegung = (typeof KAEUFER_VORBELEGUNG_VALUES)[number]

/** Die Vorbelegung aus einem beliebigen Wert; alles andere ist null (wie vorher `z.enum(…).nullable().catch(null)`). */
export function kaeuferVorbelegungAus(roh: unknown): KaeuferVorbelegung | null {
  return KAEUFER_VORBELEGUNG_VALUES.find((wert) => wert === roh) ?? null
}

/** Der Wert aus den Suchparametern der Seite; steht er mehrfach da, zählt der letzte (wie bei leseGroesse). */
export function leseKaeuferVorbelegung(roh: string | string[] | undefined): KaeuferVorbelegung | null {
  const wert = Array.isArray(roh) ? roh.at(-1) : roh
  return kaeuferVorbelegungAus(wert)
}

/**
 * Hängt `?kaeufer=…` an eine Adresse an — übrige Parameter (Vorschau, Größe)
 * bleiben. Ohne Vorbelegung kommt die Adresse unverändert zurück.
 */
export function mitKaeuferVorbelegung(href: string, kaeufer: KaeuferVorbelegung | null): string {
  if (kaeufer === null) return href
  const [pfad = '', suche = ''] = href.split('?')
  const params = new URLSearchParams(suche)
  params.set(KAEUFER_PARAMETER, kaeufer)
  return `${pfad}?${params.toString()}`
}

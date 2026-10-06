/**
 * Obergrenzen für Namen und Freitexte — EINE Quelle für die Zod-Schemas
 * (src/schemas/), die Zeichenzähler der Formulare und die Tests.
 *
 * Ohne Grenze landete beliebig langer Text in der Datenbank und sprengte
 * Hofkarte, Seitenleiste und Bestellzeilen. Die Zahlen lassen echten Namen
 * Luft; wer anstößt, hat meist etwas ins falsche Feld getippt.
 */

export const HOFNAME_MAX = 80
export const PERSONENNAME_MAX = 80
export const TELEFON_MAX = 30
export const NOTIZ_MAX = 500
/** Mehr lässt das Mailprotokoll nicht zu (RFC 5321). */
export const EMAIL_MAX = 254
/** Wie im Produktformular — eine Checkout-Position trägt den Produktnamen. */
export const PRODUKTNAME_MAX = 100
/** Grund eines Stornos — steht in der Mail an die Kundin (Nr. 19). */
export const STORNO_GRUND_MAX = 200
/** Bildunterschrift eines Galeriefotos (Nr. 19b, Runde 1). */
export const BILDUNTERSCHRIFT_MAX = 200
/**
 * Länge einer gespeicherten Bild-Adresse. Unsere Blob-Adressen sind weit
 * kürzer; die Grenze hält nur Müll aus der Datenbank (Nr. 19b, Runde 1).
 */
export const BILD_URL_MAX = 2048
/**
 * Der höchste Vorrat, den der Hof in der Produkttabelle direkt eintippt
 * (Nachtlauf Nr. 18). Fängt Tippfehler ab („99999" statt „99") und bleibt weit
 * unter der Grenze der Int-Spalte. Ein Altbestand darüber darf sinken, nie
 * steigen (src/schemas/vorrat.ts).
 */
export const VORRAT_MAX = 99_999

/**
 * Betrag und Menge eines eingetragenen Verkaufs (Nachtlauf Nr. 22b). Die
 * Spalten (Decimal(10,2) bzw. Decimal(10,3)) fassen mehr; darüber schlüge das
 * Speichern mit einem Datenbankfehler fehl statt mit einem Satz. Die Grenzen
 * fangen Tippfehler ab und lassen jedem echten Hofverkauf Luft.
 */
export const VERKAUF_BETRAG_MAX = 1_000_000
export const VERKAUF_MENGE_MAX = 999_999

/**
 * Der Name einer Bestellposition — immer der Name des Produkts aus der
 * Datenbank, nie, was der Browser schickt. GEKÜRZT statt abgelehnt: Ein
 * Produkt, dessen Name vor der Grenze länger gespeichert wurde (auch aus dem
 * Onboarding), muss kaufbar bleiben. Gezählt wird in Zeichen, nicht in
 * UTF-16-Einheiten, damit kein Zeichen in der Mitte zerschnitten wird.
 */
export function bestellPositionsName(produktname: string): string {
  return [...produktname].slice(0, PRODUKTNAME_MAX).join('')
}

/** Die Meldung am Feld, wenn ein neuer Wert zu lang ist — mit dem Ausweg. */
export const ZU_LANG = {
  hofname: `Der Hofname darf höchstens ${HOFNAME_MAX} Zeichen haben — bitte kürzen.`,
  personenname: `Der Name darf höchstens ${PERSONENNAME_MAX} Zeichen haben — bitte kürzen.`,
  telefon: `Die Telefonnummer darf höchstens ${TELEFON_MAX} Zeichen haben — bitte kürzen.`,
  notiz: `Die Notiz darf höchstens ${NOTIZ_MAX} Zeichen haben — bitte kürzen.`,
  email: `Die E-Mail-Adresse darf höchstens ${EMAIL_MAX} Zeichen haben.`,
  produktname: `Der Produktname darf höchstens ${PRODUKTNAME_MAX} Zeichen haben.`,
  stornoGrund: `Der Grund darf höchstens ${STORNO_GRUND_MAX} Zeichen haben — bitte kürzen.`,
} as const

/**
 * Passt ein Wert in die Grenze? Beim Bearbeiten zählt der gespeicherte Wert
 * als passend, solange er unverändert bleibt: Ein Hof, dessen Name vor der
 * Grenze länger gespeichert wurde, bleibt speicherbar, ohne ihn erst umbauen
 * zu müssen (CODING_STANDARDS §8). Jeder neue Wert hält die Grenze ein.
 */
export function passtInGrenze(wert: string, max: number, bestand?: string | null): boolean {
  return wert.length <= max || (bestand != null && wert === bestand)
}

/** Was der Zähler unter einem Feld zeigt. */
export type ZeichenStand = { sichtbar: false } | { sichtbar: true; text: string; zuLang: boolean }

/**
 * Der Zähler erscheint ab 80 % Füllung — vorher lenkt er nur ab. Über der
 * Grenze sagt er „Bitte kürzen", als Hinweis und nicht als Fehler: Ob der Wert
 * so gespeichert werden darf, entscheidet das Schema erst beim Speichern
 * (ein unveränderter Altwert darf es, siehe passtInGrenze).
 */
export function zeichenStand(laenge: number, max: number): ZeichenStand {
  // Ganzzahlig statt laenge / max >= 0.8 — keine Rundungsfrage an der Schwelle.
  if (laenge * 5 < max * 4) return { sichtbar: false }
  const zuLang = laenge > max
  return { sichtbar: true, zuLang, text: zuLang ? `${laenge} / ${max} · Bitte kürzen` : `${laenge} / ${max}` }
}

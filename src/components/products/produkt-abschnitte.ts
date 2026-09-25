/**
 * Die Abschnitte des Produktformulars — Zuordnung Feld → Abschnitt und die
 * Wahl des ersten Fehlerfelds (Sprint Taxonomie 1). Rein, ohne React, damit
 * der Dialog nur noch anzeigt, was hier entschieden wurde.
 */
import type { FieldErrors } from 'react-hook-form'
import type { z } from 'zod'
import { PRODUKT_FELD_REIHENFOLGE, type ProductFormData } from '@/schemas/product'
import { UNTERKATEGORIE_LABEL, type ProductSubcategoryValue } from '@/lib/taxonomie'

export const ABSCHNITTE = ['grunddaten', 'preis', 'details', 'kennzeichnung'] as const
export type Abschnitt = (typeof ABSCHNITTE)[number]

export const ABSCHNITT_TITEL: Record<Abschnitt, string> = {
  grunddaten: 'Grunddaten',
  preis: 'Preis & Verfügbarkeit',
  details: 'Details',
  kennzeichnung: 'Kennzeichnung',
}

type Feld = (typeof PRODUKT_FELD_REIHENFOLGE)[number]

const ABSCHNITT_VON_FELD: Record<Feld, Abschnitt> = {
  name: 'grunddaten',
  category: 'grunddaten',
  subcategory: 'grunddaten',
  imageUrl: 'grunddaten',
  description: 'grunddaten',
  price: 'preis',
  unit: 'preis',
  unitSize: 'preis',
  stock: 'preis',
  isAvailable: 'preis',
  seasonStart: 'preis',
  seasonEnd: 'preis',
  unavailableReason: 'preis',
  labels: 'details',
  allergens: 'details',
  requiresCool: 'details',
  requiresFreezer: 'details',
  countsTowardLimit: 'details',
  vatRate: 'details',
  futter: 'kennzeichnung',
  // Der Schalter „Nur an landwirtschaftliche Betriebe" steht in der Futter-Sektion (Konzept 6.1).
  abgabe: 'kennzeichnung',
}

/**
 * Vorbelegung beim Einschalten von „Nur saisonal verfügbar": aktueller Monat
 * bis aktueller Monat + 2, über den Jahreswechsel hinweg (Nov → Jän). Monate
 * 1–12, nie 0 — der Schalter kennt keinen leeren Zustand.
 */
export function saisonVorbelegung(jetzt: Date): { start: number; end: number } {
  const start = jetzt.getMonth() + 1
  const end = ((start - 1 + 2) % 12) + 1
  return { start, end }
}

/**
 * Das Gewicht je Gebinde gehört zur Kennzeichnung, wird aber im Abschnitt
 * Preis direkt unter der Einheit eingegeben — dort, wo der Hof über das
 * Gebinde nachdenkt. Ein Fehler daran öffnet deshalb den Abschnitt Preis.
 */
export const FUTTER_FELDER_BEIM_PREIS = ['nettoMenge', 'nettoEinheit'] as const

/** Reihenfolge der Kennzeichnungsfelder = Reihenfolge im Formular (ohne die Felder beim Preis). */
export const FUTTER_FELD_REIHENFOLGE = [
  'futtermittelart',
  'zielTierarten',
  'zusammensetzung',
  'analytischeBestandteile',
  'rohprotein',
  'rohfaser',
  'rohfett',
  'rohasche',
  'zusatzstoffe',
  'gebrauchshinweis',
  'bestaetigt',
] as const

/**
 * Alle Formularfelder in Anzeigereihenfolge mit ihrem Abschnitt — die
 * Gewichtsfelder der Kennzeichnung stehen dabei hinter der Einheit.
 */
type FeldImAbschnitt = { feld: string; abschnitt: Abschnitt }

const FELDER_IN_REIHENFOLGE: readonly FeldImAbschnitt[] = PRODUKT_FELD_REIHENFOLGE.flatMap(
  (feld): FeldImAbschnitt[] => {
    if (feld === 'futter') {
      return FUTTER_FELD_REIHENFOLGE.map((f) => ({ feld: `futter.${f}`, abschnitt: 'kennzeichnung' }))
    }
    const eintrag: FeldImAbschnitt = { feld, abschnitt: ABSCHNITT_VON_FELD[feld] }
    if (feld === 'unit') {
      return [eintrag, ...FUTTER_FELDER_BEIM_PREIS.map((f): FeldImAbschnitt => ({ feld: `futter.${f}`, abschnitt: 'preis' }))]
    }
    return [eintrag]
  }
)

/** Trägt dieses Feld („name", „futter.nettoMenge") einen Fehler? */
function hatFehler(errors: FieldErrors<ProductFormData>, feld: string): boolean {
  const [oben, unten] = feld.split('.')
  const eintrag = (errors as Record<string, unknown>)[oben]
  if (unten === undefined) return eintrag !== undefined
  return (eintrag as Record<string, unknown> | undefined)?.[unten] !== undefined
}

/**
 * Ein Fehler an `futter` selbst (Kennzeichnung fehlt ganz) hat kein
 * Unterfeld — er zählt für den Abschnitt Kennzeichnung.
 */
function futterFehltGanz(errors: FieldErrors<ProductFormData>): boolean {
  const f = errors.futter as Record<string, unknown> | undefined
  if (f === undefined) return false
  return FELDER_IN_REIHENFOLGE.every((e) => !e.feld.startsWith('futter.') || !hatFehler(errors, e.feld))
}

/** Alle Abschnitte, in denen mindestens ein Feld einen Fehler trägt. */
export function abschnitteMitFehlern(errors: FieldErrors<ProductFormData>): Set<Abschnitt> {
  const betroffen = new Set<Abschnitt>()
  for (const { feld, abschnitt } of FELDER_IN_REIHENFOLGE) {
    if (hatFehler(errors, feld)) betroffen.add(abschnitt)
  }
  if (futterFehltGanz(errors)) betroffen.add('kennzeichnung')
  return betroffen
}

/**
 * Das erste Feld mit Fehler in Formularreihenfolge, mit seinem Abschnitt.
 * Bei der Kennzeichnung zählt das erste fehlerhafte Unterfeld
 * („futter.zusammensetzung"); ein fehlendes Gewicht („futter.nettoMenge")
 * liegt beim Preis. Ein Fehler an `futter` selbst (Kennzeichnung fehlt ganz)
 * meldet den Abschnitt Kennzeichnung mit seinem ersten Feld.
 */
export function erstesFehlerfeld(
  errors: FieldErrors<ProductFormData>
): { feld: string; abschnitt: Abschnitt } | null {
  const treffer = FELDER_IN_REIHENFOLGE.find((e) => hatFehler(errors, e.feld))
  if (treffer) return treffer
  if (futterFehltGanz(errors)) return { feld: `futter.${FUTTER_FELD_REIHENFOLGE[0]}`, abschnitt: 'kennzeichnung' }
  return null
}

/**
 * Wie viele Angaben dem Speichern noch fehlen — für den Button „Noch 2
 * Angaben fehlen". Gezählt wird je Feld, nicht je Meldung: Ein Preis, der
 * leer UND ungültig wäre, ist eine Angabe. Dasselbe Schema wie beim Absenden,
 * damit Button und Prüfung nie verschieden zählen.
 */
export function fehlendeAngaben(werte: unknown, schema: z.ZodType): number {
  const ergebnis = schema.safeParse(werte)
  if (ergebnis.success) return 0
  return new Set(ergebnis.error.issues.map((i) => i.path.slice(0, 2).join('.'))).size
}

/** Der Text des Speichern-Buttons. */
export function speichernText(fehlend: number, bearbeiten: boolean): string {
  if (fehlend === 1) return 'Noch 1 Angabe fehlt'
  if (fehlend > 1) return `Noch ${fehlend} Angaben fehlen`
  return bearbeiten ? 'Speichern' : 'Anlegen'
}

/**
 * Zusammensetzung aus der Futter-Sorte vorbelegen: Wiesenheu → „Wiesenheu".
 * Nur, solange das Feld leer ist oder noch die Vorbelegung der alten Sorte
 * trägt — was der Hof selbst getippt hat, wird nie überschrieben.
 */
export function zusammensetzungVorbelegung(
  bisher: string,
  alteSorte: ProductSubcategoryValue | null,
  neueSorte: ProductSubcategoryValue | null
): string {
  const text = bisher.trim()
  const vorbelegt = text === '' || (alteSorte !== null && text === UNTERKATEGORIE_LABEL[alteSorte])
  if (!vorbelegt) return bisher
  return neueSorte ? UNTERKATEGORIE_LABEL[neueSorte] : ''
}

/** Das Label zum Wert eines Auswahlfelds — der geschlossene Select zeigt sonst den Rohwert („KG"). */
export function auswahlLabel(
  optionen: readonly { value: string | number; label: string }[],
  wert: unknown
): string | null {
  if (wert === null || wert === undefined || wert === '') return null
  return optionen.find((o) => String(o.value) === String(wert))?.label ?? null
}

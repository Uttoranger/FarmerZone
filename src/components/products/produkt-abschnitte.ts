/**
 * Die Abschnitte des Produktformulars — Zuordnung Feld → Abschnitt und die
 * Wahl des ersten Fehlerfelds (Sprint Taxonomie 1). Rein, ohne React, damit
 * der Dialog nur noch anzeigt, was hier entschieden wurde.
 */
import type { FieldErrors } from 'react-hook-form'
import { PRODUKT_FELD_REIHENFOLGE, type ProductFormData } from '@/schemas/product'

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

/** Reihenfolge der Kennzeichnungsfelder = Reihenfolge im Formular. */
export const FUTTER_FELD_REIHENFOLGE = [
  'zielTierarten',
  'zusammensetzung',
  'analytischeBestandteile',
  'zusatzstoffe',
  'registrierungsnummer',
  'gebrauchshinweis',
  'bestaetigt',
] as const

/** Alle Abschnitte, in denen mindestens ein Feld einen Fehler trägt. */
export function abschnitteMitFehlern(errors: FieldErrors<ProductFormData>): Set<Abschnitt> {
  const betroffen = new Set<Abschnitt>()
  for (const feld of PRODUKT_FELD_REIHENFOLGE) {
    if (errors[feld] !== undefined) betroffen.add(ABSCHNITT_VON_FELD[feld])
  }
  return betroffen
}

/**
 * Das erste Feld mit Fehler in Formularreihenfolge, mit seinem Abschnitt.
 * Bei der Kennzeichnung zählt das erste fehlerhafte Unterfeld
 * („futter.zusammensetzung"); ein Fehler an `futter` selbst (Kennzeichnung
 * fehlt ganz) meldet den Abschnitt mit dem ersten Unterfeld.
 */
export function erstesFehlerfeld(
  errors: FieldErrors<ProductFormData>
): { feld: string; abschnitt: Abschnitt } | null {
  const feld = PRODUKT_FELD_REIHENFOLGE.find((f) => errors[f] !== undefined)
  if (!feld) return null
  if (feld !== 'futter') return { feld, abschnitt: ABSCHNITT_VON_FELD[feld] }

  const futterFehler = errors.futter as Record<string, unknown> | undefined
  const unterfeld = FUTTER_FELD_REIHENFOLGE.find((f) => futterFehler?.[f] !== undefined)
  return { feld: `futter.${unterfeld ?? FUTTER_FELD_REIHENFOLGE[0]}`, abschnitt: 'kennzeichnung' }
}

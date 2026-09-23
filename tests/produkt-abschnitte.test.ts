/**
 * Tests für die Abschnittslogik des Produktformulars
 * (src/components/products/produkt-abschnitte.ts, Sprint Taxonomie 1).
 *
 * Beweist: Das erste Fehlerfeld wird in Formularreihenfolge gewählt, nicht in
 * der Reihenfolge des Fehlerobjekts; jedes Feld landet im richtigen Abschnitt;
 * Fehler in der Kennzeichnung nennen das erste fehlerhafte Unterfeld.
 */
import { describe, it, expect } from 'vitest'
import type { FieldErrors } from 'react-hook-form'
import type { ProductFormData } from '@/schemas/product'
import {
  abschnitteMitFehlern,
  erstesFehlerfeld,
  saisonVorbelegung,
} from '@/components/products/produkt-abschnitte'

const fehler = (message = 'x') => ({ type: 'custom', message })

describe('saisonVorbelegung', () => {
  it('aktueller Monat bis aktueller Monat + 2', () => {
    expect(saisonVorbelegung(new Date(2026, 2, 15))).toEqual({ start: 3, end: 5 })
    expect(saisonVorbelegung(new Date(2026, 0, 1))).toEqual({ start: 1, end: 3 })
  })

  it('läuft über den Jahreswechsel, nie auf 0', () => {
    expect(saisonVorbelegung(new Date(2026, 10, 30))).toEqual({ start: 11, end: 1 })
    expect(saisonVorbelegung(new Date(2026, 11, 31))).toEqual({ start: 12, end: 2 })
    expect(saisonVorbelegung(new Date(2026, 9, 1))).toEqual({ start: 10, end: 12 })
  })
})

describe('Abschnitt der MwSt', () => {
  it('ein MwSt-Fehler liegt im Abschnitt Details, nicht mehr bei Preis', () => {
    const errors = { vatRate: fehler() } as unknown as FieldErrors<ProductFormData>
    expect(erstesFehlerfeld(errors)).toEqual({ feld: 'vatRate', abschnitt: 'details' })
  })
})

describe('abschnitteMitFehlern', () => {
  it('ohne Fehler: leer', () => {
    expect(abschnitteMitFehlern({}).size).toBe(0)
  })

  it('sammelt jeden betroffenen Abschnitt genau einmal', () => {
    const errors = {
      name: fehler(),
      category: fehler(),
      stock: fehler(),
      futter: { bestaetigt: fehler() },
    } as unknown as FieldErrors<ProductFormData>
    expect([...abschnitteMitFehlern(errors)].sort()).toEqual(['grunddaten', 'kennzeichnung', 'preis'])
  })
})

describe('erstesFehlerfeld', () => {
  it('ohne Fehler: null', () => {
    expect(erstesFehlerfeld({})).toBeNull()
  })

  it('wählt nach Formularreihenfolge, nicht nach Objektreihenfolge', () => {
    const errors = { stock: fehler(), name: fehler() } as unknown as FieldErrors<ProductFormData>
    expect(erstesFehlerfeld(errors)).toEqual({ feld: 'name', abschnitt: 'grunddaten' })
  })

  it('ordnet Preisfelder dem Abschnitt Preis & Verfügbarkeit zu', () => {
    const errors = { price: fehler() } as unknown as FieldErrors<ProductFormData>
    expect(erstesFehlerfeld(errors)).toEqual({ feld: 'price', abschnitt: 'preis' })
  })

  it('ordnet Siegel dem Abschnitt Details zu', () => {
    const errors = { labels: fehler() } as unknown as FieldErrors<ProductFormData>
    expect(erstesFehlerfeld(errors)).toEqual({ feld: 'labels', abschnitt: 'details' })
  })

  it('Kennzeichnung: das erste fehlerhafte Unterfeld in Formularreihenfolge', () => {
    const errors = {
      futter: { bestaetigt: fehler(), zusammensetzung: fehler() },
    } as unknown as FieldErrors<ProductFormData>
    expect(erstesFehlerfeld(errors)).toEqual({
      feld: 'futter.zusammensetzung',
      abschnitt: 'kennzeichnung',
    })
  })

  it('Kennzeichnung fehlt ganz: Abschnitt Kennzeichnung, erstes Unterfeld (seit Bereiche 1 die Futtermittelart)', () => {
    const errors = { futter: fehler('fehlt') } as unknown as FieldErrors<ProductFormData>
    expect(erstesFehlerfeld(errors)).toEqual({
      feld: 'futter.futtermittelart',
      abschnitt: 'kennzeichnung',
    })
  })

  it('Grunddaten schlagen Kennzeichnung, wenn beide Fehler haben', () => {
    const errors = {
      futter: { zielTierarten: fehler() },
      subcategory: fehler(),
    } as unknown as FieldErrors<ProductFormData>
    expect(erstesFehlerfeld(errors)).toEqual({ feld: 'subcategory', abschnitt: 'grunddaten' })
  })
})

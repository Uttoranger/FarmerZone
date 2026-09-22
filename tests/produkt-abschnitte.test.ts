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
import { abschnitteMitFehlern, erstesFehlerfeld } from '@/components/products/produkt-abschnitte'

const fehler = (message = 'x') => ({ type: 'custom', message })

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

  it('Kennzeichnung fehlt ganz: Abschnitt Kennzeichnung, erstes Unterfeld', () => {
    const errors = { futter: fehler('fehlt') } as unknown as FieldErrors<ProductFormData>
    expect(erstesFehlerfeld(errors)).toEqual({
      feld: 'futter.zielTierarten',
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

/**
 * Tests für die Preis-Semantik des Produktformulars
 * (src/components/products/produkt-preis.ts).
 *
 * Beweist: Das Preisfeld heißt je nach Gebinde anders; die Vorschau zeigt,
 * was Kundinnen sehen; die Rückfrage kommt nur, wenn der Preis nach dem
 * Setzen einer Gebindegröße beim alten Einheitspreis geblieben ist.
 */
import { describe, it, expect } from 'vitest'
import {
  preisFeldLabel,
  kundenVorschau,
  paketpreisFraglich,
  paketpreisHinweis,
} from '@/components/products/produkt-preis'

describe('preisFeldLabel', () => {
  it('ohne Gebinde: Preis je Einheit', () => {
    expect(preisFeldLabel('KG')).toBe('Preis je kg')
    expect(preisFeldLabel('KG', null)).toBe('Preis je kg')
    expect(preisFeldLabel('KG', 1)).toBe('Preis je kg')
    expect(preisFeldLabel('STUECK')).toBe('Preis je Stück')
  })

  it('mit Gebinde bei Maßeinheit: Preis für das Paket', () => {
    expect(preisFeldLabel('KG', 2)).toBe('Preis für das 2-kg-Paket')
    expect(preisFeldLabel('LITER', 0.5)).toBe('Preis für das 0,5-L-Paket')
  })

  it('mit Gebinde bei Stück und Paket: Preis für n Stück / Pakete', () => {
    expect(preisFeldLabel('PAKET', 6)).toBe('Preis für 6 Pakete')
    expect(preisFeldLabel('STUECK', 10)).toBe('Preis für 10 Stück')
  })
})

describe('kundenVorschau', () => {
  it('zeigt Gebindepreis und Grundpreis, wie Kundinnen es sehen', () => {
    expect(kundenVorschau(50, 'KG', 2)).toBe('Kunden sehen: € 50,00 für 2 kg · € 25,00 / kg')
  })

  it('ohne Gebinde nur den Preis je Einheit', () => {
    expect(kundenVorschau(3.5, 'KG')).toBe('Kunden sehen: € 3,50 / kg')
  })

  it('bei Paketen ohne Grundpreis-Teil', () => {
    expect(kundenVorschau(3.6, 'PAKET', 6)).toBe('Kunden sehen: € 3,60 für 6 Pakete')
  })

  it('nichts, solange kein Preis eingetragen ist', () => {
    expect(kundenVorschau(0, 'KG', 2)).toBeNull()
    expect(kundenVorschau(Number.NaN, 'KG', 2)).toBeNull()
  })
})

describe('paketpreisFraglich', () => {
  it('Kilopreis stehen gelassen, Gebinde ergänzt → fraglich', () => {
    expect(paketpreisFraglich({ price: 50, unitSize: 2, referenzPreis: 50 })).toBe(true)
  })

  it('bis 20 % über dem alten Preis noch fraglich, darüber nicht', () => {
    expect(paketpreisFraglich({ price: 60, unitSize: 2, referenzPreis: 50 })).toBe(true)
    expect(paketpreisFraglich({ price: 60.01, unitSize: 2, referenzPreis: 50 })).toBe(false)
    expect(paketpreisFraglich({ price: 100, unitSize: 2, referenzPreis: 50 })).toBe(false)
  })

  it('ohne Gebinde oder Gebinde ≤ 1 nie', () => {
    expect(paketpreisFraglich({ price: 50, unitSize: null, referenzPreis: 50 })).toBe(false)
    expect(paketpreisFraglich({ price: 50, unitSize: 1, referenzPreis: 50 })).toBe(false)
    expect(paketpreisFraglich({ price: 50, unitSize: 0.5, referenzPreis: 50 })).toBe(false)
  })

  it('ohne Referenz nie — Bestandsprodukte mit Gebinde bleiben ohne Rückfrage', () => {
    expect(paketpreisFraglich({ price: 50, unitSize: 2, referenzPreis: null })).toBe(false)
    expect(paketpreisFraglich({ price: 50, unitSize: 2, referenzPreis: 0 })).toBe(false)
  })

  it('unbrauchbarer Preis nie', () => {
    expect(paketpreisFraglich({ price: Number.NaN, unitSize: 2, referenzPreis: 50 })).toBe(false)
    expect(paketpreisFraglich({ price: 0, unitSize: 2, referenzPreis: 50 })).toBe(false)
  })
})

describe('paketpreisHinweis', () => {
  it('nennt die Rechnung bei Maßeinheiten', () => {
    expect(paketpreisHinweis(50, 'KG', 2)).toBe(
      'Ist das der Preis für das ganze Paket? € 50,00 für 2 kg heißt € 25,00 / kg.'
    )
  })

  it('bei Paketen nur die Frage', () => {
    expect(paketpreisHinweis(3.6, 'PAKET', 6)).toBe('Ist das der Preis für das ganze Paket?')
  })
})

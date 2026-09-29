/**
 * Tests für den Dialog „Verkauf eintragen" (src/lib/verkauf-eintragen.ts,
 * src/lib/verkaufskanal-speicher.ts, src/schemas/manual-sale.ts).
 *
 * Beweist:
 *  - Der zuletzt benutzte Kanal ist vorausgewählt; Kaputtes, Fremdes und ein
 *    Speicher, der wirft, fallen still auf den Hofladen zurück.
 *  - Die Produkt-Chips: meistverkauft zuerst, aufgefüllt aus dem Katalog, das
 *    gewählte Produkt immer dabei.
 *  - Ohne Produkt und Menge wird „Ohne Angabe" und 1 gespeichert.
 *  - Der Knopf nennt den Betrag, ohne Betrag bleibt er grau.
 *  - Das Schema verlangt nur Betrag, Kanal und Datum.
 */
import { describe, it, expect } from 'vitest'
import {
  datumKurz,
  istOhneProdukt,
  knopfText,
  meistverkaufteProdukte,
  produktChips,
  verkaufOhneAngaben,
} from '@/lib/verkauf-eintragen'
import { STANDARD_KANAL, VERKAUFSKANAL_SCHLUESSEL, kanalVorauswahl, merkeKanal } from '@/lib/verkaufskanal-speicher'
import { manualSaleFormSchema } from '@/schemas/manual-sale'
import { OHNE_PRODUKT } from '@/lib/umsatz'

function speicher(start: Record<string, string> = {}) {
  const daten = new Map(Object.entries(start))
  return {
    getItem: (k: string) => daten.get(k) ?? null,
    setItem: (k: string, v: string) => void daten.set(k, v),
    daten,
  }
}

const wirft = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
}

describe('Kanal-Vorauswahl', () => {
  it('ohne Merker der Hofladen', () => {
    expect(STANDARD_KANAL).toBe('HOFLADEN')
    expect(kanalVorauswahl(speicher())).toBe('HOFLADEN')
    expect(kanalVorauswahl(null)).toBe('HOFLADEN')
  })

  it('der zuletzt benutzte Kanal ist gewählt', () => {
    const s = speicher()
    merkeKanal(s, 'MARKT')
    expect(s.daten.get(VERKAUFSKANAL_SCHLUESSEL)).toBe('MARKT')
    expect(kanalVorauswahl(s)).toBe('MARKT')
  })

  it('Kaputtes und PLATFORM gelten nicht', () => {
    expect(kanalVorauswahl(speicher({ [VERKAUFSKANAL_SCHLUESSEL]: 'PLATFORM' }))).toBe('HOFLADEN')
    expect(kanalVorauswahl(speicher({ [VERKAUFSKANAL_SCHLUESSEL]: '{"x":1}' }))).toBe('HOFLADEN')
  })

  it('ein Speicher, der wirft, hält nichts auf', () => {
    expect(kanalVorauswahl(wirft)).toBe('HOFLADEN')
    expect(() => merkeKanal(wirft, 'MARKT')).not.toThrow()
  })
})

describe('Produkt-Chips', () => {
  const produkte = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }]

  it('meistverkauft nach Anzahl, bei Gleichstand nach Betrag', () => {
    const ids = meistverkaufteProdukte([
      { productId: 'd', cent: 5000 },
      { productId: 'b', cent: 300 },
      { productId: 'b', cent: 300 },
      { productId: 'c', cent: 100 },
      { productId: 'c', cent: 100 },
      { productId: 'e', cent: 9000 },
    ])
    expect(ids).toEqual(['b', 'c', 'e'])
  })

  it('aufgefüllt aus dem Katalog, gelöschte Produkte fallen weg', () => {
    expect(produktChips(['weg', 'd'], produkte, null).map((p) => p.id)).toEqual(['d', 'a', 'b'])
  })

  it('das gewählte Produkt steht immer dabei', () => {
    expect(produktChips(['a', 'b', 'c'], produkte, 'e').map((p) => p.id)).toEqual(['a', 'b', 'c', 'e'])
    expect(produktChips(['a', 'b', 'c'], produkte, 'b').map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('Verkauf ohne Angaben', () => {
  it('ohne Produkt und Menge: „Ohne Angabe" und 1', () => {
    expect(verkaufOhneAngaben({})).toEqual({ productName: OHNE_PRODUKT, quantity: 1 })
    expect(verkaufOhneAngaben({ productName: '   ', quantity: null })).toEqual({ productName: OHNE_PRODUKT, quantity: 1 })
    expect(verkaufOhneAngaben({ productName: 'Kürbis', quantity: 2.5 })).toEqual({ productName: 'Kürbis', quantity: 2.5 })
  })

  it('beim Bearbeiten ist ein solcher Verkauf ohne Produkt', () => {
    expect(istOhneProdukt({ productId: null, productName: OHNE_PRODUKT })).toBe(true)
    expect(istOhneProdukt({ productId: null, productName: 'Kürbis' })).toBe(false)
    expect(istOhneProdukt({ productId: 'p1', productName: OHNE_PRODUKT })).toBe(false)
  })
})

describe('Knopf und Datum', () => {
  it('der Knopf nennt den Betrag', () => {
    expect(knopfText(24.5, false)).toEqual({ text: '€ 24,50 eintragen', aktiv: true })
    expect(knopfText(24.5, true)).toEqual({ text: '€ 24,50 speichern', aktiv: true })
  })

  it('ohne Betrag grau', () => {
    expect(knopfText(null, false)).toEqual({ text: 'Eintragen', aktiv: false })
    expect(knopfText(0, false).aktiv).toBe(false)
    expect(knopfText(Number.NaN, false).aktiv).toBe(false)
  })

  it('Heute, Gestern, sonst Wochentag mit Datum', () => {
    expect(datumKurz('2026-09-29', '2026-09-29')).toBe('Heute')
    expect(datumKurz('2026-09-28', '2026-09-29')).toBe('Gestern')
    expect(datumKurz('2026-09-25', '2026-09-29')).toBe('Fr, 25. Sep')
    expect(datumKurz('2025-12-31', '2026-01-02')).toBe('Mi, 31. Dez 2025')
  })
})

describe('manualSaleFormSchema', () => {
  const basis = { totalAmount: 24.5, channel: 'HOFLADEN', saleDate: '2026-09-29' }

  it('Betrag, Kanal und Datum reichen', () => {
    expect(manualSaleFormSchema.safeParse(basis).success).toBe(true)
  })

  it('ohne Betrag ein verständlicher Satz', () => {
    const ergebnis = manualSaleFormSchema.safeParse({ ...basis, totalAmount: null })
    expect(ergebnis.success).toBe(false)
    expect(ergebnis.error?.issues[0].message).toBe('Bitte gib einen Betrag ein.')
  })

  it('PLATFORM darf ein Hof nicht eintragen', () => {
    expect(manualSaleFormSchema.safeParse({ ...basis, channel: 'PLATFORM' }).success).toBe(false)
  })
})

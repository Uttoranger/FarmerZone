/**
 * Tests für die Preis-Semantik des Produktformulars
 * (src/components/products/produkt-preis.ts).
 *
 * Beweist: Das Preisfeld heißt je nach Gebinde anders; die Vorschau zeigt,
 * was Kundinnen sehen; die Rückfrage kommt nur, wenn der Preis nach dem
 * Setzen einer Gebindegröße beim alten Einheitspreis geblieben ist.
 * Seit Nr. 51: Die Karte „So sehen Käufer dein Produkt" entsteht aus Foto,
 * Name, Preis und Einheit; ein leerer oder ungültiger Preis gibt keinen Betrag.
 */
import { describe, it, expect } from 'vitest'
import {
  preisFeldLabel,
  kundenVorschau,
  kaeuferVorschau,
  gueltigerPreis,
  paketpreisFraglich,
  paketpreisAntworten,
  PAKETPREIS_FRAGE,
} from '@/components/products/produkt-preis'
import { KAEUFER_VORSCHAU } from '@/lib/hofseite-kunde'

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

describe('paketpreisAntworten', () => {
  it('die Frage ist nur die Frage — die Rechnung steht in der Vorschau', () => {
    expect(PAKETPREIS_FRAGE).toBe('Ist das der Preis für das ganze Paket?')
  })

  it('nennt beide Antworten mit Betrag und Einheit', () => {
    const a = paketpreisAntworten(50, 'KG', 2)
    expect(a.ja).toBe('Ja, das Paket kostet € 50,00')
    expect(a.nein).toBe('Nein, € 50,00 ist der Preis je kg')
  })

  it('„Nein" trägt Einheitspreis × Gebinde ein, auf Cent gerundet', () => {
    expect(paketpreisAntworten(50, 'KG', 2).paketpreis).toBe(100)
    expect(paketpreisAntworten(4.99, 'KG', 3).paketpreis).toBe(14.97)
    expect(paketpreisAntworten(3.333, 'LITER', 3).paketpreis).toBe(10)
  })

  it('ohne Gebinde bleibt der Preis, wie er ist', () => {
    expect(paketpreisAntworten(50, 'KG', null).paketpreis).toBe(50)
  })
})

describe('kaeuferVorschau — die Karte „So sehen Käufer dein Produkt" aus den Formularwerten (Nr. 51)', () => {
  const OHNE_BILD = { foto: null, kategorie: null }

  it('übernimmt Foto, Name, Preis und Einheit', () => {
    expect(
      kaeuferVorschau({ name: '  Bergkäse ', price: 12.9, unit: 'KG', unitSize: 0.5 }, { foto: 'blob:foto', kategorie: 'MILCH' })
    ).toEqual({
      name: 'Bergkäse',
      imageUrl: 'blob:foto',
      categoryImageUrl: '/categories/milch.webp',
      price: 12.9,
      unit: 'KG',
      unitSize: 0.5,
    })
  })

  it('ohne Namen ein ruhiger Platzhalter', () => {
    expect(kaeuferVorschau({ name: '   ', price: 3, unit: 'STUECK', unitSize: null }, OHNE_BILD).name).toBe(KAEUFER_VORSCHAU.name)
  })

  it('ein leerer oder ungültiger Preis ergibt keinen Betrag — die Karte zeigt dann den Platzhalter, nie „NaN" oder „€ 0,00"', () => {
    for (const price of [Number.NaN, 0, -1, 4.505, Number.POSITIVE_INFINITY, null]) {
      expect(kaeuferVorschau({ name: 'Eier', price, unit: 'STUECK', unitSize: null }, OHNE_BILD).price, String(price)).toBeNull()
    }
  })

  it('der Preis gilt nach derselben Regel wie beim Speichern (preisZahl): größer 0, höchstens zwei Nachkommastellen', () => {
    expect(kaeuferVorschau({ name: 'Eier', price: 4.55, unit: 'STUECK', unitSize: null }, OHNE_BILD).price).toBe(4.55)
    expect(kaeuferVorschau({ name: 'Eier', price: 0.01, unit: 'STUECK', unitSize: null }, OHNE_BILD).price).toBe(0.01)
  })

  it('ohne Foto die Illustration der Kategorie, ohne beides kein Bild; keine Gebindegröße bleibt null', () => {
    const ohneFoto = kaeuferVorschau({ name: 'Honig', price: 9, unit: 'G', unitSize: undefined }, { foto: null, kategorie: 'HONIG' })
    expect(ohneFoto.imageUrl).toBeNull()
    expect(ohneFoto.categoryImageUrl).toBe('/categories/honig.webp')
    expect(ohneFoto.unitSize).toBeNull()
    expect(kaeuferVorschau({ name: 'Honig', price: 9, unit: 'G', unitSize: null }, OHNE_BILD).categoryImageUrl).toBeNull()
  })
})

describe('gueltigerPreis — derselbe Maßstab wie beim Speichern (Nr. 51, Runde 1)', () => {
  it('gibt den Preis nur zurück, wenn er preisZahl besteht', () => {
    expect(gueltigerPreis(4.5)).toBe(4.5)
    expect(gueltigerPreis(0.01)).toBe(0.01)
    for (const price of [Number.NaN, 0, -2, 4.505, Number.POSITIVE_INFINITY, null]) {
      expect(gueltigerPreis(price), String(price)).toBeNull()
    }
  })

  it('die Käufer-Vorschau nimmt genau diesen Preis', () => {
    for (const price of [Number.NaN, 0, 4.505, 4.5, 12.9]) {
      expect(kaeuferVorschau({ name: 'x', price, unit: 'STUECK', unitSize: null }, { foto: null, kategorie: null }).price).toBe(gueltigerPreis(price))
    }
  })
})

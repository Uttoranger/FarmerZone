/**
 * Tests für die reinen Hilfen des Produktformulars aus Sprint
 * Produktformular Nachschliff (produkt-abschnitte.ts, produkt-preis.ts).
 *
 * Beweist: Der Button zählt fehlende Angaben je Feld; ein fehlendes Gewicht
 * öffnet den Abschnitt Preis; die Zusammensetzung wird nur vorbelegt, solange
 * der Hof nichts Eigenes getippt hat; Auswahlfelder zeigen Labels statt
 * Rohwerten; die Gewichtsfrage und die Vergleichszeile rechnen richtig.
 */
import { describe, it, expect } from 'vitest'
import type { FieldErrors } from 'react-hook-form'
import {
  productFormSchema,
  productAnlegenSchema,
  UNIT_OPTIONS,
  MONTH_OPTIONS,
  type ProductFormData,
} from '@/schemas/product'
import {
  auswahlLabel,
  erstesFehlerfeld,
  abschnitteMitFehlern,
  fehlendeAngaben,
  speichernText,
  zusammensetzungVorbelegung,
} from '@/components/products/produkt-abschnitte'
import {
  gewichtFrage,
  inhaltZeile,
  nettoAutomatisch,
  nettoNachEinheitswechsel,
  vergleichsKilopreis,
  kundenVorschau,
} from '@/components/products/produkt-preis'

const fehler = (message = 'x') => ({ type: 'custom', message })

describe('auswahlLabel — geschlossener Select zeigt das Label', () => {
  it('Einheit KG → „kg", LITER → „Liter"', () => {
    expect(auswahlLabel(UNIT_OPTIONS, 'KG')).toBe('kg')
    expect(auswahlLabel(UNIT_OPTIONS, 'LITER')).toBe('Liter')
    expect(auswahlLabel(UNIT_OPTIONS, 'BIGBAG')).toBe('Big Bag')
  })

  it('Monat 3 → „März", auch als Zahl', () => {
    expect(auswahlLabel(MONTH_OPTIONS, 3)).toBe('März')
    expect(auswahlLabel(MONTH_OPTIONS, '12')).toBe('Dezember')
  })

  it('leer oder unbekannt → null (dann steht der Platzhalter)', () => {
    expect(auswahlLabel(UNIT_OPTIONS, null)).toBeNull()
    expect(auswahlLabel(UNIT_OPTIONS, '')).toBeNull()
    expect(auswahlLabel(UNIT_OPTIONS, 'FASS')).toBeNull()
  })
})

describe('fehlendeAngaben und speichernText', () => {
  const leer = { name: '', price: Number.NaN, unit: 'STUECK', category: null }

  it('neues Produkt: Name, Preis und Kategorie fehlen → 3', () => {
    expect(fehlendeAngaben(leer, productAnlegenSchema)).toBe(3)
  })

  it('zählt herunter, sobald Angaben da sind', () => {
    expect(fehlendeAngaben({ ...leer, name: 'Lammfleisch' }, productAnlegenSchema)).toBe(2)
    expect(fehlendeAngaben({ ...leer, name: 'Lammfleisch', category: 'FLEISCH' }, productAnlegenSchema)).toBe(1)
    expect(fehlendeAngaben({ ...leer, name: 'Lammfleisch', category: 'FLEISCH', price: 18 }, productAnlegenSchema)).toBe(0)
  })

  it('Bearbeiten ohne Kategorie zählt die Kategorie nicht', () => {
    expect(fehlendeAngaben({ ...leer, name: 'Lammfleisch', price: 18 }, productFormSchema)).toBe(0)
  })

  it('mehrere Meldungen an einem Feld zählen einmal', () => {
    expect(fehlendeAngaben({ ...leer, name: 'Lammfleisch', category: 'FLEISCH', price: 'abc' }, productAnlegenSchema)).toBe(1)
  })

  it('Unterfelder der Kennzeichnung zählen einzeln', () => {
    const heu = {
      name: 'Heu',
      price: 45,
      unit: 'BALLEN',
      category: 'HEU_STROH',
      subcategory: 'WIESENHEU',
      futter: {
        futtermittelart: 'EINZELFUTTERMITTEL',
        zielTierarten: [],
        zusammensetzung: 'Wiesenheu',
        analytischeBestandteile: '',
        nettoMenge: Number.NaN,
        nettoEinheit: 'KG',
        rohprotein: null,
        rohfaser: null,
        rohfett: null,
        rohasche: null,
        zusatzstoffe: '',
        gebrauchshinweis: '',
        bestaetigt: false,
      },
    }
    // Tierarten, analytische Bestandteile, Nettomenge, Bestätigung
    expect(fehlendeAngaben(heu, productAnlegenSchema)).toBe(4)
  })

  it('Button-Text: Einzahl, Mehrzahl, Anlegen, Speichern', () => {
    expect(speichernText(2, false)).toBe('Noch 2 Angaben fehlen')
    expect(speichernText(1, true)).toBe('Noch 1 Angabe fehlt')
    expect(speichernText(0, false)).toBe('Anlegen')
    expect(speichernText(0, true)).toBe('Speichern')
  })
})

describe('Gewicht je Gebinde liegt beim Preis', () => {
  it('ein fehlendes Gewicht öffnet den Abschnitt Preis', () => {
    const errors = { futter: { nettoMenge: fehler() } } as unknown as FieldErrors<ProductFormData>
    expect(erstesFehlerfeld(errors)).toEqual({ feld: 'futter.nettoMenge', abschnitt: 'preis' })
    expect([...abschnitteMitFehlern(errors)]).toEqual(['preis'])
  })

  it('das Gewicht kommt in der Reihenfolge nach der Einheit, vor dem Preis', () => {
    const errors = {
      price: fehler(),
      futter: { nettoMenge: fehler(), zusammensetzung: fehler() },
    } as unknown as FieldErrors<ProductFormData>
    expect(erstesFehlerfeld(errors)?.feld).toBe('futter.nettoMenge')
    expect(abschnitteMitFehlern(errors)).toEqual(new Set(['preis', 'kennzeichnung']))
  })

  it('fehlt die Kennzeichnung ganz, zählt sie zur Kennzeichnung', () => {
    const errors = { futter: fehler() } as unknown as FieldErrors<ProductFormData>
    expect(erstesFehlerfeld(errors)).toEqual({ feld: 'futter.futtermittelart', abschnitt: 'kennzeichnung' })
    expect([...abschnitteMitFehlern(errors)]).toEqual(['kennzeichnung'])
  })

  it('das Foto steht jetzt vorn', () => {
    const errors = { imageUrl: fehler(), name: fehler() } as unknown as FieldErrors<ProductFormData>
    expect(erstesFehlerfeld(errors)?.feld).toBe('imageUrl')
  })
})

describe('zusammensetzungVorbelegung', () => {
  it('leeres Feld bekommt das Label der Sorte', () => {
    expect(zusammensetzungVorbelegung('', null, 'WIESENHEU')).toBe('Wiesenheu')
  })

  it('Sortenwechsel ersetzt die eigene Vorbelegung', () => {
    expect(zusammensetzungVorbelegung('Wiesenheu', 'WIESENHEU', 'STROH')).toBe('Stroh')
  })

  it('Getipptes bleibt stehen', () => {
    expect(zusammensetzungVorbelegung('Heu vom ersten Schnitt', 'WIESENHEU', 'STROH')).toBe('Heu vom ersten Schnitt')
    expect(zusammensetzungVorbelegung('Wiesenheu', null, 'STROH')).toBe('Wiesenheu')
  })

  it('Sorte entfernt → Vorbelegung verschwindet', () => {
    expect(zusammensetzungVorbelegung('Wiesenheu', 'WIESENHEU', null)).toBe('')
  })
})

describe('Gewichtsfrage und Vergleichspreis', () => {
  it('fragt je Einheit, bei kg und Liter nicht', () => {
    expect(gewichtFrage('BALLEN')).toBe('Wie viel wiegt ein Ballen?')
    expect(gewichtFrage('BIGBAG')).toBe('Wie viel wiegt ein Big Bag?')
    expect(gewichtFrage('PAKET')).toBe('Wie viel wiegt ein Paket?')
    expect(gewichtFrage('STUECK')).toBe('Wie viel wiegt ein Stück?')
    expect(gewichtFrage('KG')).toBeNull()
    expect(gewichtFrage('LITER')).toBeNull()
  })

  it('bei kg und Liter ist ein Gebinde 1 kg bzw. 1 L', () => {
    expect(nettoAutomatisch('KG')).toEqual({ nettoMenge: 1, nettoEinheit: 'KG' })
    expect(nettoAutomatisch('LITER')).toEqual({ nettoMenge: 1, nettoEinheit: 'LITER' })
    expect(nettoAutomatisch('BALLEN')).toBeNull()
  })

  it('Rundballen 300 kg zu € 45: Kunden sehen den Ballenpreis, der Hof den Kilopreis zum Vergleich', () => {
    expect(kundenVorschau(45, 'BALLEN', null)).toBe('Kunden sehen: € 45,00 / Ballen')
    expect(vergleichsKilopreis(45, 'BALLEN', 300, 'KG')).toBe('Das sind € 0,15 / kg — zum Vergleichen.')
  })

  it('keine Vergleichszeile ohne Gewicht, ohne Preis oder bei kg', () => {
    expect(vergleichsKilopreis(45, 'BALLEN', null, 'KG')).toBeNull()
    expect(vergleichsKilopreis(Number.NaN, 'BALLEN', 300, 'KG')).toBeNull()
    expect(vergleichsKilopreis(2, 'KG', 1, 'KG')).toBeNull()
  })

  it('Inhaltszeile in der Kennzeichnung', () => {
    expect(inhaltZeile(300, 'KG')).toBe('Inhalt eines Gebindes: 300 kg — oben bei Preis')
    expect(inhaltZeile(Number.NaN, 'KG')).toBe('Inhalt eines Gebindes: noch offen — oben bei Preis')
  })
})

describe('nettoNachEinheitswechsel', () => {
  it('zu kg → 1 kg, zu Liter → 1 L', () => {
    expect(nettoNachEinheitswechsel({ nettoMenge: 300, nettoEinheit: 'KG' }, 'BALLEN', 'KG')).toEqual({
      nettoMenge: 1,
      nettoEinheit: 'KG',
    })
    expect(nettoNachEinheitswechsel({ nettoMenge: 1, nettoEinheit: 'KG' }, 'KG', 'LITER')).toEqual({
      nettoMenge: 1,
      nettoEinheit: 'LITER',
    })
  })

  it('weg von kg: die automatische 1 wird leer, damit der Ballen nicht „1 kg" wiegt', () => {
    const neu = nettoNachEinheitswechsel({ nettoMenge: 1, nettoEinheit: 'KG' }, 'KG', 'BALLEN')
    expect(Number.isNaN(neu.nettoMenge)).toBe(true)
  })

  it('ein eingetragenes Gewicht bleibt beim Wechsel zwischen Ballen und Big Bag', () => {
    expect(nettoNachEinheitswechsel({ nettoMenge: 300, nettoEinheit: 'KG' }, 'BALLEN', 'BIGBAG')).toEqual({
      nettoMenge: 300,
      nettoEinheit: 'KG',
    })
  })
})

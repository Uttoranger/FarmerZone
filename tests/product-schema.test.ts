/**
 * Tests für das Produkt-Zod-Schema (Kategorie + Grenzwert-Flag, Sprint 17K;
 * Unterkategorie, Siegel und Futter-Kennzeichnung, Sprint Taxonomie 1).
 *
 * Beweist: Gültige Kategorie-Werte werden akzeptiert, leer/fehlend wird zu
 * null ("Keine Angabe"), ungültige Werte werden verweigert, countsTowardLimit
 * defaultet auf true. Eine Unterkategorie muss zur Kategorie passen, darf aber
 * fehlen (Bestandsprodukte). Siegel ohne Doppelte. Futtermittel verlangen
 * Unterkategorie und Kennzeichnung; alle anderen Kategorien verbieten sie.
 * Seit Sprint Bereiche 1: Die Altlast-Werte werden abgelehnt, der Bereich
 * entscheidet (bereichVon), Futtermittelart und Nettomenge sind Pflicht, die
 * MwSt startet mit dem Vorschlag der Kategorie (mwstStandard).
 */
import { describe, it, expect } from 'vitest'
import {
  productFormSchema,
  PRODUCT_CATEGORY_VALUES,
  CATEGORY_OPTIONS,
  FUTTER_FEHLER,
} from '@/schemas/product'
import { mwstStandard } from '@/lib/mwst'
import { istFuttermittel } from '@/lib/taxonomie'

const minimalValid = {
  name: 'Heumilch',
  price: 2.5,
  unit: 'STUECK' as const,
}

/** Eine vollständige, gültige Kennzeichnung — so, wie das Formular sie liefert. */
const futterGueltig = {
  futtermittelart: 'EINZELFUTTERMITTEL',
  zielTierarten: ['PFERD', 'RIND'],
  zusammensetzung: 'Heu vom ersten Schnitt, Wiesenmischung',
  analytischeBestandteile: 'Rohprotein 9 %, Rohfaser 28 %',
  nettoMenge: '300',
  nettoEinheit: 'KG',
  rohprotein: '',
  rohfaser: '',
  rohfett: '',
  rohasche: '',
  zusatzstoffe: '',
  gebrauchshinweis: '',
  bestaetigt: true,
}

const heu = {
  ...minimalValid,
  name: 'Heu',
  unit: 'BALLEN' as const,
  category: 'HEU_STROH',
  subcategory: 'WIESENHEU',
  futter: futterGueltig,
}

/** Ein gültiges Futtermittel je Futter-Kategorie — für Schleifen über alle Kategorien. */
function gueltigFuer(category: string) {
  if (category === 'HEU_STROH') return heu
  if (category === 'GETREIDE_KOERNER') return { ...heu, category, subcategory: 'HAFER' }
  if (category === 'MISCHFUTTER') {
    return { ...heu, category, subcategory: null, futter: { ...futterGueltig, futtermittelart: 'ALLEINFUTTERMITTEL' } }
  }
  if (category === 'ERGAENZUNGSFUTTER') {
    return { ...heu, category, subcategory: null, futter: { ...futterGueltig, futtermittelart: 'MINERALFUTTERMITTEL' } }
  }
  return { ...minimalValid, category }
}

/** Die Fehlermeldungen eines fehlgeschlagenen Parse, nach Pfad. */
function fehlerNachPfad(input: unknown): Record<string, string> {
  const ergebnis = productFormSchema.safeParse(input)
  if (ergebnis.success) return {}
  return Object.fromEntries(ergebnis.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('category', () => {
  it('akzeptiert jeden wählbaren Kategorie-Wert', () => {
    for (const { value } of CATEGORY_OPTIONS) {
      // Futtermittel verlangen mehr — dafür gibt es unten eigene Tests.
      const parsed = productFormSchema.parse(gueltigFuer(value))
      expect(parsed.category).toBe(value)
    }
  })

  it('macht aus leerem String und fehlendem Feld null (Keine Angabe)', () => {
    expect(productFormSchema.parse({ ...minimalValid, category: '' }).category).toBeNull()
    expect(productFormSchema.parse(minimalValid).category).toBeNull()
    expect(productFormSchema.parse({ ...minimalValid, category: null }).category).toBeNull()
  })

  it('verweigert ungültige Kategorie-Werte', () => {
    expect(() => productFormSchema.parse({ ...minimalValid, category: 'PIZZA' })).toThrow()
    expect(() => productFormSchema.parse({ ...minimalValid, category: 'milch' })).toThrow()
  })

  it('jede wählbare Kategorie hat ein deutsches Label — die Altlast ist nicht wählbar', () => {
    expect(CATEGORY_OPTIONS.map((o) => o.value).sort()).toEqual(
      PRODUCT_CATEGORY_VALUES.filter((v) => v !== 'FUTTERMITTEL').sort()
    )
    for (const o of CATEGORY_OPTIONS) expect(o.label.length).toBeGreaterThan(1)
  })
})

describe('subcategory', () => {
  it('fehlt sie, ist das kein Fehler — auch bei einer Kategorie mit Unterkategorien', () => {
    const parsed = productFormSchema.parse({ ...minimalValid, category: 'FLEISCH' })
    expect(parsed.subcategory).toBeNull()
    expect(productFormSchema.parse({ ...minimalValid, category: 'FLEISCH', subcategory: '' }).subcategory).toBeNull()
  })

  it('passt sie zur Kategorie, wird sie übernommen', () => {
    const parsed = productFormSchema.parse({ ...minimalValid, category: 'FLEISCH', subcategory: 'RIND' })
    expect(parsed.subcategory).toBe('RIND')
  })

  it('passt sie nicht zur Kategorie, nennt der Fehler die Kategorie', () => {
    const fehler = fehlerNachPfad({ ...minimalValid, category: 'EIER', subcategory: 'RIND' })
    expect(fehler['subcategory']).toBe('Diese Unterkategorie passt nicht zu Eier.')
  })

  it('ohne Kategorie ist eine Unterkategorie ein Fehler', () => {
    const fehler = fehlerNachPfad({ ...minimalValid, subcategory: 'RIND' })
    expect(fehler['subcategory']).toBe('Wähle zuerst eine Kategorie.')
  })

  it('verweigert erfundene Unterkategorien', () => {
    expect(() =>
      productFormSchema.parse({ ...minimalValid, category: 'FLEISCH', subcategory: 'DRACHE' })
    ).toThrow()
  })
})

describe('labels (Siegel)', () => {
  it('defaultet auf leer', () => {
    expect(productFormSchema.parse(minimalValid).labels).toEqual([])
  })

  it('nimmt mehrere Siegel an', () => {
    const parsed = productFormSchema.parse({ ...minimalValid, labels: ['BIO', 'GENTECHNIKFREI'] })
    expect(parsed.labels).toEqual(['BIO', 'GENTECHNIKFREI'])
  })

  it('verweigert Doppelte', () => {
    const fehler = fehlerNachPfad({ ...minimalValid, labels: ['BIO', 'BIO'] })
    expect(fehler['labels']).toBe('Ein Siegel kann nur einmal gewählt werden.')
  })

  it('verweigert unbekannte Siegel', () => {
    expect(() => productFormSchema.parse({ ...minimalValid, labels: ['FAIRTRADE'] })).toThrow()
  })

  it('isOrganic ist kein Formularfeld mehr — es wird still ignoriert', () => {
    const parsed = productFormSchema.parse({ ...minimalValid, isOrganic: true })
    expect('isOrganic' in parsed).toBe(false)
    expect(parsed.labels).toEqual([])
  })
})

describe('Futtermittel', () => {
  it('vollständig: Unterkategorie und Kennzeichnung werden übernommen', () => {
    const parsed = productFormSchema.parse(heu)
    expect(parsed.subcategory).toBe('WIESENHEU')
    expect(parsed.futter?.zielTierarten).toEqual(['PFERD', 'RIND'])
    expect(parsed.futter?.bestaetigt).toBe(true)
  })

  it('ohne Unterkategorie: Fehler am Feld subcategory', () => {
    const fehler = fehlerNachPfad({ ...heu, subcategory: null })
    expect(fehler['subcategory']).toBe(FUTTER_FEHLER.unterkategorie)
  })

  it('ohne Kennzeichnung: Fehler am Feld futter — bei undefined wie bei null', () => {
    expect(fehlerNachPfad({ ...heu, futter: undefined })['futter']).toBe(FUTTER_FEHLER.fehlt)
    expect(fehlerNachPfad({ ...heu, futter: null })['futter']).toBe(FUTTER_FEHLER.fehlt)
  })

  it('bei anderen Kategorien ist futter = null erlaubt (das Formular schreibt null)', () => {
    const parsed = productFormSchema.parse({ ...minimalValid, category: 'OBST', futter: null })
    expect(parsed.futter).toBeNull()
  })

  it('Saison: leer und 0 werden null, nie undefined', () => {
    const parsed = productFormSchema.parse({ ...minimalValid, seasonStart: '', seasonEnd: '0' })
    expect(parsed.seasonStart).toBeNull()
    expect(parsed.seasonEnd).toBeNull()
    expect(productFormSchema.parse(minimalValid).seasonStart).toBeNull()
  })

  it('ohne Tierart: Fehler in Du-Form', () => {
    const fehler = fehlerNachPfad({ ...heu, futter: { ...futterGueltig, zielTierarten: [] } })
    expect(fehler['futter.zielTierarten']).toBe(FUTTER_FEHLER.tierarten)
  })

  it('Zusammensetzung und analytische Bestandteile brauchen mindestens 3 Zeichen — der Fehler sagt, wo der Wert steht', () => {
    const fehler = fehlerNachPfad({
      ...heu,
      futter: { ...futterGueltig, zusammensetzung: 'ab', analytischeBestandteile: '  ' },
    })
    expect(fehler['futter.zusammensetzung']).toBe(FUTTER_FEHLER.zusammensetzung)
    expect(fehler['futter.analytischeBestandteile']).toBe(FUTTER_FEHLER.analytischeBestandteile)
  })

  it('ohne Bestätigung: Fehler am Haken', () => {
    const fehler = fehlerNachPfad({ ...heu, futter: { ...futterGueltig, bestaetigt: false } })
    expect(fehler['futter.bestaetigt']).toBe(FUTTER_FEHLER.bestaetigt)
  })

  it('eine Futter-Unterkategorie an einer anderen Kategorie passt nicht', () => {
    const fehler = fehlerNachPfad({ ...minimalValid, category: 'OBST', subcategory: 'HAFER' })
    expect(fehler['subcategory']).toBe('Diese Unterkategorie passt nicht zu Obst.')
  })

  it('bei jeder Kategorie außerhalb der Futtermittel ist eine Kennzeichnung verboten', () => {
    for (const value of PRODUCT_CATEGORY_VALUES) {
      if (istFuttermittel(value)) continue
      const fehler = fehlerNachPfad({ ...minimalValid, category: value, futter: futterGueltig })
      expect(fehler['futter'], value).toBe(FUTTER_FEHLER.verboten)
    }
  })

  it('ohne Kategorie ist eine Kennzeichnung ebenfalls verboten', () => {
    const fehler = fehlerNachPfad({ ...minimalValid, futter: futterGueltig })
    expect(fehler['futter']).toBe(FUTTER_FEHLER.verboten)
  })
})

describe('Dezimaleingabe — Preis, Gebindegröße, MwSt', () => {
  it('nimmt Preis mit Komma und Punkt an', () => {
    expect(productFormSchema.parse({ ...minimalValid, price: '5,99' }).price).toBe(5.99)
    expect(productFormSchema.parse({ ...minimalValid, price: '5.99' }).price).toBe(5.99)
    expect(productFormSchema.parse({ ...minimalValid, price: 5.99 }).price).toBe(5.99)
  })

  it('Preis: leer, Buchstaben, Tausenderpunkt und drei Nachkommastellen sind Fehler', () => {
    expect(fehlerNachPfad({ ...minimalValid, price: '' })['price']).toBe('Bitte gib einen Preis ein, z. B. 5,99.')
    expect(fehlerNachPfad({ ...minimalValid, price: 'abc' })['price']).toBe('Bitte gib einen Preis ein, z. B. 5,99.')
    expect(fehlerNachPfad({ ...minimalValid, price: '1.500' })['price']).toBe('Bitte gib einen Preis ein, z. B. 5,99.')
    // „5,999" ist als Tausender zweideutig und fällt schon beim Lesen durch;
    // erst eine eindeutige Zahl mit zu vielen Stellen trifft die Stellenregel.
    expect(fehlerNachPfad({ ...minimalValid, price: '5,999' })['price']).toBe('Bitte gib einen Preis ein, z. B. 5,99.')
    expect(fehlerNachPfad({ ...minimalValid, price: '5,9999' })['price']).toBe('Höchstens zwei Nachkommastellen, z. B. 5,99.')
    expect(fehlerNachPfad({ ...minimalValid, price: 5.999 })['price']).toBe('Höchstens zwei Nachkommastellen, z. B. 5,99.')
    expect(fehlerNachPfad({ ...minimalValid, price: 0 })['price']).toBe('Preis muss größer als 0 sein')
  })

  it('Gebindegröße: Komma erlaubt, drei Nachkommastellen erlaubt, vier nicht', () => {
    expect(productFormSchema.parse({ ...minimalValid, unitSize: '0,125' }).unitSize).toBe(0.125)
    // Leer ist null, nie undefined — react-hook-form läse undefined als „Ausgangswert zurück".
    expect(productFormSchema.parse({ ...minimalValid, unitSize: '' }).unitSize).toBeNull()
    expect(productFormSchema.parse({ ...minimalValid, unitSize: null }).unitSize).toBeNull()
    expect(productFormSchema.parse({ ...minimalValid, unitSize: undefined }).unitSize).toBeNull()
    expect(fehlerNachPfad({ ...minimalValid, unitSize: 0.0625 })['unitSize']).toBe('Höchstens drei Nachkommastellen, z. B. 0,125.')
    expect(fehlerNachPfad({ ...minimalValid, unitSize: 'zwei' })['unitSize']).toBe('Bitte nur Zahlen, z. B. 2 oder 0,5.')
  })

  it('MwSt: leer wird zum Standard, Komma erlaubt, außerhalb 0–100 Fehler', () => {
    expect(productFormSchema.parse(minimalValid).vatRate).toBe(mwstStandard(null))
    expect(productFormSchema.parse({ ...minimalValid, vatRate: '' }).vatRate).toBe(mwstStandard(null))
    expect(productFormSchema.parse({ ...minimalValid, vatRate: '13' }).vatRate).toBe(13)
    expect(productFormSchema.parse({ ...minimalValid, vatRate: '7,5' }).vatRate).toBe(7.5)
    expect(fehlerNachPfad({ ...minimalValid, vatRate: 120 })['vatRate']).toBeDefined()
  })
})

describe('countsTowardLimit', () => {
  it('defaultet auf true (zählt zur Grenze)', () => {
    expect(productFormSchema.parse(minimalValid).countsTowardLimit).toBe(true)
  })

  it('lässt sich explizit auf false setzen (Urproduktion)', () => {
    expect(
      productFormSchema.parse({ ...minimalValid, countsTowardLimit: false }).countsTowardLimit
    ).toBe(false)
  })

  it('verweigert Nicht-Boolean-Werte', () => {
    expect(() =>
      productFormSchema.parse({ ...minimalValid, countsTowardLimit: 'ja' })
    ).toThrow()
  })
})

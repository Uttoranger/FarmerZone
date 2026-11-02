/**
 * Schemas der Formulare mit Verkaufsgrößen (src/schemas/produktfamilie.ts,
 * Nachtlauf Nr. 20) — echt durch Zod, ohne Mock.
 *
 * Beweist: eine vollständige Futter-Familie geht durch; Sorte, passende
 * Futtermittelart, Größen und Namenslänge werden am richtigen Feld gemeldet;
 * Brennmaterial verlangt je Art die richtigen Angaben (Scheitlänge,
 * Wassergehalt und Körnung) und kennt keine Raummeter für Hackschnitzel.
 * Die Sperre je Gebinde entscheidet das Schema NICHT — sie hängt am Hof.
 * Rücktritt (Nr. 218): beide Familien nehmen Haken und Schätzung in ganzen
 * Cent an — dieselbe Grenze und dieselben Sätze wie das Produktformular.
 */
import { describe, it, expect } from 'vitest'
import { brennmaterialFamilieSchema, futterFamilieSchema, FAMILIE_FEHLER } from '@/schemas/produktfamilie'
import { FUTTER_FEHLER } from '@/schemas/product'
import { PRODUKTNAME_MAX } from '@/lib/eingabegrenzen'
import { RUECKSENDEKOSTEN_MAX_CENTS, RUECKTRITT_TEXT, ruecksendekostenAusEingabe } from '@/lib/ruecktritt-angaben'

const KENNZEICHNUNG = {
  futtermittelart: 'EINZELFUTTERMITTEL',
  zielTierarten: ['PFERD', 'HEIMTIER'],
  zusammensetzung: 'Wiesenheu, erster Schnitt',
  analytischeBestandteile: 'Rohprotein 9 %, Rohfaser 28 %',
  rohprotein: null,
  rohfaser: null,
  rohfett: null,
  rohasche: null,
  zusatzstoffe: '',
  gebrauchshinweis: '',
  bestaetigt: true,
}

const HEU = {
  name: 'Bergwiesen-Heu',
  description: '',
  category: 'HEU_STROH',
  subcategory: 'WIESENHEU',
  bio: false,
  abgabe: 'ALLE',
  kennzeichnung: KENNZEICHNUNG,
  groessen: [
    { bezeichnung: '1 kg-Sackerl', verpackung: 'ABGEPACKT_ETIKETT', unit: 'STUECK', nettoMenge: 1, price: 2.5, stock: 20 },
    { bezeichnung: '5 kg-Sack', verpackung: 'ABGEPACKT_ETIKETT', unit: 'STUECK', nettoMenge: '5', price: '8,00', stock: 10 },
    { bezeichnung: 'Kleinballen', verpackung: 'LOSE_BALLEN', unit: 'BALLEN', nettoMenge: 15, price: 4.5, stock: 40 },
    { bezeichnung: 'Rundballen', verpackung: 'LOSE_BALLEN', unit: 'BALLEN', nettoMenge: '250', price: 45, stock: 8 },
  ],
}

function pfade(ergebnis: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return ergebnis.success ? [] : (ergebnis.error?.issues ?? []).map((i) => i.path.map(String).join('.'))
}

describe('futterFamilieSchema', () => {
  it('nimmt Heu mit vier Größen an — getippte Zahlen mit Komma werden zu Zahlen', () => {
    const r = futterFamilieSchema.safeParse(HEU)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.groessen[1].price).toBe(8)
      expect(r.data.groessen[3].nettoMenge).toBe(250)
    }
  })

  it('Heu ohne Sorte: Meldung an der Sorte (Rückfrage F2)', () => {
    const r = futterFamilieSchema.safeParse({ ...HEU, subcategory: null })
    expect(pfade(r)).toContain('subcategory')
    if (!r.success) expect(r.error.issues.find((i) => i.path[0] === 'subcategory')?.message).toBe(FUTTER_FEHLER.unterkategorie)
  })

  it('eine Sorte, die nicht zur Kategorie gehört, wird abgelehnt', () => {
    expect(pfade(futterFamilieSchema.safeParse({ ...HEU, subcategory: 'HAFER' }))).toContain('subcategory')
    expect(pfade(futterFamilieSchema.safeParse({ ...HEU, subcategory: 'HACKSCHNITZEL' }))).toContain('subcategory')
  })

  it('Mischfutter hat keine Sorte und ist ein Alleinfuttermittel — Einzelfuttermittel wird abgelehnt', () => {
    const misch = { ...HEU, category: 'MISCHFUTTER', subcategory: null }
    expect(pfade(futterFamilieSchema.safeParse(misch))).toEqual(['kennzeichnung.futtermittelart'])
    const richtig = { ...misch, kennzeichnung: { ...KENNZEICHNUNG, futtermittelart: 'ALLEINFUTTERMITTEL' } }
    expect(futterFamilieSchema.safeParse(richtig).success).toBe(true)
  })

  it('nur Futter-Kategorien — Brennholz oder Eier sind hier kein Futter', () => {
    expect(pfade(futterFamilieSchema.safeParse({ ...HEU, category: 'BRENNHOLZ', subcategory: null }))).toContain('category')
    expect(pfade(futterFamilieSchema.safeParse({ ...HEU, category: 'EIER', subcategory: null }))).toContain('category')
  })

  it('ohne Größe, mit mehr als sechs Größen oder mit zwei gleich benannten wird abgelehnt', () => {
    expect(pfade(futterFamilieSchema.safeParse({ ...HEU, groessen: [] }))).toContain('groessen')
    const sieben = Array.from({ length: 7 }, (_, i) => ({ ...HEU.groessen[2], bezeichnung: `Ballen ${i}` }))
    expect(pfade(futterFamilieSchema.safeParse({ ...HEU, groessen: sieben }))).toContain('groessen')
    const doppelt = [HEU.groessen[2], { ...HEU.groessen[3], bezeichnung: ' kleinballen ' }]
    const r = futterFamilieSchema.safeParse({ ...HEU, groessen: doppelt })
    expect(pfade(r)).toContain('groessen.1.bezeichnung')
    if (!r.success) expect(r.error.issues.map((i) => i.message)).toContain(FAMILIE_FEHLER.doppelt)
  })

  it('Name und Größe zusammen über der Grenze des Produktnamens: Meldung am Namen', () => {
    const r = futterFamilieSchema.safeParse({ ...HEU, name: 'H'.repeat(PRODUKTNAME_MAX - 5) })
    expect(pfade(r)).toContain('name')
    if (!r.success) expect(r.error.issues.find((i) => i.path[0] === 'name')?.message).toBe(FAMILIE_FEHLER.nameZuLang)
  })

  it('Preis, Gewicht und Vorrat je Größe werden an der Größe gemeldet', () => {
    const kaputt = [{ ...HEU.groessen[0], price: undefined, nettoMenge: 0, stock: -1 }]
    const r = futterFamilieSchema.safeParse({ ...HEU, groessen: kaputt })
    expect(pfade(r)).toEqual(expect.arrayContaining(['groessen.0.price', 'groessen.0.nettoMenge', 'groessen.0.stock']))
  })

  it('ohne Bestätigung der Kennzeichnung kein Speichern', () => {
    const r = futterFamilieSchema.safeParse({ ...HEU, kennzeichnung: { ...KENNZEICHNUNG, bestaetigt: false } })
    expect(pfade(r)).toContain('kennzeichnung.bestaetigt')
  })

  it('eine unbekannte Verpackung oder Einheit wird abgelehnt', () => {
    expect(pfade(futterFamilieSchema.safeParse({ ...HEU, groessen: [{ ...HEU.groessen[0], verpackung: 'GESCHENKT' }] }))).toContain(
      'groessen.0.verpackung'
    )
    expect(pfade(futterFamilieSchema.safeParse({ ...HEU, groessen: [{ ...HEU.groessen[0], unit: 'RAUMMETER' }] }))).toContain(
      'groessen.0.unit'
    )
  })

  it('NUR_BETRIEBE geht durch (Kauf als Betrieb mit vorbelegter Nummer im Checkout)', () => {
    const r = futterFamilieSchema.safeParse({ ...HEU, abgabe: 'NUR_BETRIEBE' })
    expect(r.success && r.data.abgabe).toBe('NUR_BETRIEBE')
  })
})

const BUCHE = {
  name: 'Buche, ofenfertig',
  description: '',
  art: 'BRENNHOLZ_SCHEIT',
  holzart: 'Buche',
  scheitlaengeCm: 33,
  trocknung: 'OFENFERTIG',
  wassergehalt: null,
  koernung: null,
  gelagertJahre: 2,
  ueberdacht: true,
  groessen: [
    { bezeichnung: 'Sack ca. 15 kg', unit: 'STUECK', price: 8.9, stock: 30 },
    { bezeichnung: 'Schüttraummeter', unit: 'SCHUETTRAUMMETER', price: 99, stock: 12 },
    { bezeichnung: 'Raummeter', unit: 'RAUMMETER', price: 129, stock: 4 },
  ],
}

describe('brennmaterialFamilieSchema', () => {
  it('Abnahme: Brennholz mit drei Größen', () => {
    expect(brennmaterialFamilieSchema.safeParse(BUCHE).success).toBe(true)
  })

  it('Brennholz ohne Scheitlänge wird abgelehnt, Anzündholz nicht', () => {
    expect(pfade(brennmaterialFamilieSchema.safeParse({ ...BUCHE, scheitlaengeCm: null }))).toEqual(['scheitlaengeCm'])
    expect(brennmaterialFamilieSchema.safeParse({ ...BUCHE, art: 'ANZUENDHOLZ', scheitlaengeCm: null }).success).toBe(true)
  })

  it('Abnahme: Hackschnitzel pro Schüttraummeter, mit Wassergehalt und Körnung', () => {
    const hack = {
      ...BUCHE,
      name: 'Hackschnitzel Fichte',
      art: 'HACKSCHNITZEL',
      holzart: 'Fichte',
      wassergehalt: 30,
      koernung: 31,
      groessen: [{ bezeichnung: 'Schüttraummeter', unit: 'SCHUETTRAUMMETER', price: 35, stock: 50 }],
    }
    const r = brennmaterialFamilieSchema.safeParse(hack)
    expect(r.success).toBe(true)
    // Eine übrig gebliebene Scheitlänge aus der vorigen Art wird nicht gespeichert.
    if (r.success) expect(r.data.scheitlaengeCm).toBeNull()
  })

  it('Hackschnitzel ohne W/P oder in Raummetern werden abgelehnt', () => {
    const hack = { ...BUCHE, art: 'HACKSCHNITZEL', groessen: [BUCHE.groessen[1]] }
    expect(pfade(brennmaterialFamilieSchema.safeParse(hack))).toEqual(expect.arrayContaining(['wassergehalt', 'koernung']))
    const imRaummeter = { ...hack, wassergehalt: 30, koernung: 31, groessen: [BUCHE.groessen[2]] }
    const r = brennmaterialFamilieSchema.safeParse(imRaummeter)
    expect(pfade(r)).toEqual(['groessen.0.unit'])
  })

  it('Scheitholz trägt keine W/P-Klassen weiter', () => {
    const r = brennmaterialFamilieSchema.safeParse({ ...BUCHE, wassergehalt: 25, koernung: 16 })
    expect(r.success && [r.data.wassergehalt, r.data.koernung]).toEqual([null, null])
  })

  it('ohne Holzart kein Speichern; „gelagert seit" höchstens zehn Jahre', () => {
    expect(pfade(brennmaterialFamilieSchema.safeParse({ ...BUCHE, holzart: ' ' }))).toContain('holzart')
    expect(pfade(brennmaterialFamilieSchema.safeParse({ ...BUCHE, gelagertJahre: 11 }))).toContain('gelagertJahre')
  })

  it('Ballen oder Big Bags sind keine Brennmaterial-Größe dieses Formulars', () => {
    expect(pfade(brennmaterialFamilieSchema.safeParse({ ...BUCHE, groessen: [{ ...BUCHE.groessen[0], unit: 'BALLEN' }] }))).toContain(
      'groessen.0.unit'
    )
  })
})

describe('Rücktritt in beiden Familien (Nr. 218, wie Nr. 214 im Produktformular)', () => {
  const familien = [
    ['Futter', futterFamilieSchema, HEU],
    ['Brennmaterial', brennmaterialFamilieSchema, BUCHE],
  ] as const

  /** Der Satz am Feld der Schätzung — derselbe, den das Produktformular zeigt. */
  function satzAmFeld(schema: (typeof familien)[number][1], eingabe: object): string | undefined {
    const r = schema.safeParse(eingabe)
    return r.success ? undefined : r.error.issues.find((i) => i.path.join('.') === 'ruecksendekostenCents')?.message
  }

  it.each(familien)('%s ohne Angabe: kein Haken, keine Schätzung (false/null)', (_, schema, familie) => {
    const r = schema.safeParse(familie)
    expect(r.success && [r.data.keinRuecktritt, r.data.ruecksendekostenCents]).toEqual([false, null])
  })

  it.each(familien)('%s mit Haken und Schätzung: beide Werte kommen in ganzen Cent durch', (_, schema, familie) => {
    const r = schema.safeParse({ ...familie, keinRuecktritt: true, ruecksendekostenCents: ruecksendekostenAusEingabe('25,50') })
    expect(r.success && [r.data.keinRuecktritt, r.data.ruecksendekostenCents]).toEqual([true, 2550])
  })

  it.each(familien)('%s: ein negativer Betrag ist ein Fehler am Feld, getippt „-5“ ebenso', (_, schema, familie) => {
    expect(satzAmFeld(schema, { ...familie, ruecksendekostenCents: -500 })).toBe(RUECKTRITT_TEXT.betragNegativ)
    // Getippt wird ein „-“ nicht zu Cent, sondern zu NaN — abgelehnt, nie still „keine Angabe“.
    expect(satzAmFeld(schema, { ...familie, ruecksendekostenCents: ruecksendekostenAusEingabe('-5') })).toBe(RUECKTRITT_TEXT.betragUngueltig)
  })

  it.each(familien)('%s: 0 €, halbe Cent und über der Grenze werden abgelehnt; an der Grenze geht es', (_, schema, familie) => {
    expect(satzAmFeld(schema, { ...familie, ruecksendekostenCents: 0 })).toBe(RUECKTRITT_TEXT.betragNull)
    expect(satzAmFeld(schema, { ...familie, ruecksendekostenCents: 12.5 })).toBe(RUECKTRITT_TEXT.betragUngueltig)
    expect(satzAmFeld(schema, { ...familie, ruecksendekostenCents: RUECKSENDEKOSTEN_MAX_CENTS + 1 })).toBe(RUECKTRITT_TEXT.betragZuHoch)
    expect(schema.safeParse({ ...familie, ruecksendekostenCents: RUECKSENDEKOSTEN_MAX_CENTS }).success).toBe(true)
  })

  it('Gegenprobe: ein Text statt Cent geht nicht durch (kein coerce)', () => {
    expect(satzAmFeld(futterFamilieSchema, { ...HEU, ruecksendekostenCents: '25' })).toBe(RUECKTRITT_TEXT.betragUngueltig)
  })
})

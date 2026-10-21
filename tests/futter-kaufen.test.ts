/**
 * Region › Futter kaufen (Nachtlauf Nr. 22c; seit Nr. 123 nach N23 und der
 * E9-Ergänzung) — die reine Regel aus src/lib/futter-kaufen.ts: nur Höfe mit
 * LFBIS-Nummer, nur angebotene, nicht gesperrte Größen (Nr. 20, S7), je
 * Familie eine Karte in der Reihenfolge des Hofs (E3), Vorwahl und „derzeit
 * aus", die Marke „günstigster Kilopreis" (mehr als 5 %), Filter Abholung samt
 * Leerzustand, Zahl je Stufe, „Selbst verkaufen", Schild „· laut Hof", keine
 * Kontaktdaten. Ohne Datenbank, feste Uhr als Parameter.
 */
import { describe, it, expect } from 'vitest'
import {
  FUTTER_ERKLAERUNG,
  FUTTER_KARTE_TEXT,
  FUTTER_KAUFEN_HINWEIS,
  FUTTER_NUR_LFBIS,
  FUTTER_SELBST_VERKAUFEN,
  abholKennzeichen,
  angeboteneGroessen,
  baueFutterKaufen,
  bestellenText,
  guenstigsteGroesse,
  istRegistrierterBetrieb,
  type EigenerFutterHof,
  type FutterHof,
  type FutterKaufenEingabe,
  type FutterProdukt,
} from '@/lib/futter-kaufen'
import { MARKE } from '@/lib/marke'
import type { FutterKaufenFilter } from '@/schemas/region'

// Sa, 24. Okt 2026, 07:00 in Wien (Sommerzeit bis 25. Okt) — vor dem Fenster 08:00–12:00.
const SAMSTAG_FRUEH = new Date('2026-10-24T05:00:00Z')
// Sa, 13:00 — das Samstagsfenster ist vorbei.
const SAMSTAG_MITTAG = new Date('2026-10-24T11:00:00Z')
// So, 25. Okt 2026, 09:00 in Wien (ab 3:00 Winterzeit, UTC+1).
const SONNTAG_FRUEH = new Date('2026-10-25T08:00:00Z')
const ALLES: FutterKaufenFilter = { km: 25, art: null, menge: null, abholung: null }
const SAMSTAG = { dayOfWeek: 6, startTime: '08:00', endTime: '12:00' }
const SONNTAG = { dayOfWeek: 0, startTime: '09:00', endTime: '11:00' }

function hof(abweichend: Partial<FutterHof> = {}): FutterHof {
  return {
    id: 'hof-a',
    slug: 'testhof-a',
    name: 'Testhof A',
    postalCode: '1234',
    city: 'Beispielort',
    latitude: 48.1,
    longitude: 14.1,
    entfernungKm: 6,
    betriebsnummer: 'LFBIS 1234567',
    betriebsstatus: 'PRIMAERPRODUKTION',
    abholfenster: [SAMSTAG],
    fotos: [],
    kategorien: ['HEU_STROH'],
    ...abweichend,
  }
}

function produkt(abweichend: Partial<FutterProdukt> = {}): FutterProdukt {
  return {
    id: 'p1',
    farmId: 'hof-a',
    name: 'Bergwiesen-Heu Rundballen',
    familieId: null,
    category: 'HEU_STROH',
    subcategory: 'WIESENHEU',
    price: 45,
    isAvailable: true,
    stock: 3,
    reservedStock: 0,
    verpackung: 'LOSE_BALLEN',
    futter: { nettoMenge: 250, nettoEinheit: 'KG', betriebsnummer: '1234567' },
    abholhinweise: [],
    foto: null,
    fotoAusschnitt: null,
    illustration: '/categories/heu.webp',
    ...abweichend,
  }
}

function eigen(abweichend: Partial<EigenerFutterHof> = {}): EigenerFutterHof {
  return { name: 'Sonnhof', latitude: 48, longitude: 14, sichtbar: true, betriebsnummer: null, betriebsstatus: null, futter: [], ...abweichend }
}

function eingabe(abweichend: Partial<FutterKaufenEingabe> = {}): FutterKaufenEingabe {
  return {
    hoefe: [hof()],
    produkte: [produkt()],
    ohneStandort: [],
    abgeschnitten: false,
    eigen: eigen(),
    filter: ALLES,
    jetzt: SAMSTAG_FRUEH,
    ...abweichend,
  }
}

/** Eine Familie mit Kilopreisen: rund 0,18 €/kg, klein 0,30 €/kg — in dieser Reihenfolge eingetragen. */
const familie = [
  produkt({ id: 'rund', familieId: 'f1', name: 'Bergwiesen-Heu Rundballen ~250 kg', price: 45, futter: { nettoMenge: 250, nettoEinheit: 'KG', betriebsnummer: '1234567' } }),
  produkt({ id: 'klein', familieId: 'f1', name: 'Bergwiesen-Heu Kleinballen ~15 kg', price: 4.5, futter: { nettoMenge: 15, nettoEinheit: 'KG', betriebsnummer: '1234567' } }),
]

describe('Wer erscheint — nur Höfe mit LFBIS-Nummer', () => {
  it('eine eingetragene Nummer genügt (E9: ungeprüft), nur Leerzeichen nicht', () => {
    expect(istRegistrierterBetrieb({ betriebsnummer: 'LFBIS 1', betriebsstatus: 'PRIMAERPRODUKTION' })).toBe(true)
    expect(istRegistrierterBetrieb({ betriebsnummer: '1234', betriebsstatus: 'REGISTRIERT' })).toBe(true)
    expect(istRegistrierterBetrieb({ betriebsnummer: '   ', betriebsstatus: 'PRIMAERPRODUKTION' })).toBe(false)
    expect(istRegistrierterBetrieb({ betriebsnummer: null, betriebsstatus: null })).toBe(false)
  })

  it('ein Hof ohne Nummer erscheint nicht, auch wenn er Futter hat', () => {
    const ansicht = baueFutterKaufen(eingabe({ hoefe: [hof({ betriebsnummer: null })] }))
    expect(ansicht.angebote).toEqual([])
    expect(ansicht.leer?.satz).toBe('Im Umkreis von 25 km verkauft gerade kein Hof mit LFBIS-Nummer Futter.')
  })
})

describe('Welche Größe erscheint — angeboten, nicht gesperrt, Futtermittel', () => {
  it('ausgeblendet und kein Futter fallen weg; ausverkauft bleibt als „derzeit aus" in der Familie', () => {
    const jeHof = angeboteneGroessen(
      [hof()],
      [
        produkt({ id: 'ok' }),
        produkt({ id: 'leer', stock: 0 }),
        produkt({ id: 'reserviert', stock: 2, reservedStock: 2 }),
        produkt({ id: 'aus', isAvailable: false }),
        produkt({ id: 'eier', category: 'EIER', verpackung: null, futter: null }),
      ]
    )
    expect(jeHof.get('hof-a')?.map((p) => p.id)).toEqual(['ok', 'leer', 'reserviert'])
  })

  it('ein Angebot ohne kaufbare Größe erscheint nicht', () => {
    const ansicht = baueFutterKaufen(eingabe({ produkte: [produkt({ stock: 0 })] }))
    expect(ansicht.angebote).toEqual([])
  })

  it('S7: abgepacktes Heimtierfutter ohne BAES-Meldung ist gesperrt und erscheint nicht', () => {
    const sackerl = produkt({ id: 'sackerl', verpackung: 'ABGEPACKT_ETIKETT', name: 'Bergwiesen-Heu 1 kg-Sackerl', price: 2.5 })
    expect(baueFutterKaufen(eingabe({ produkte: [sackerl] })).angebote).toEqual([])
    const mitMeldung = baueFutterKaufen(eingabe({ hoefe: [hof({ betriebsstatus: 'REGISTRIERT' })], produkte: [sackerl] }))
    expect(mitMeldung.angebote.map((a) => a.groessen.map((g) => g.id))).toEqual([['sackerl']])
  })

  it('Mischfutter ohne BAES-Meldung ist gesperrt (Mischen/Zukauf, E10)', () => {
    const misch = produkt({ id: 'misch', category: 'MISCHFUTTER', verpackung: 'LOSE_BALLEN' })
    expect(baueFutterKaufen(eingabe({ produkte: [misch] })).angebote).toEqual([])
  })

  it('Produkte fremder, nicht übergebener Höfe erscheinen nie', () => {
    expect(baueFutterKaufen(eingabe({ produkte: [produkt({ farmId: 'hof-fremd' })] })).angebote).toEqual([])
  })
})

describe('Größen — Reihenfolge des Hofs, Vorwahl, „derzeit aus", kaufLink', () => {
  it('eine Karte je Familie, die Größen in der Reihenfolge des Hofs (nie nach Preis), je mit Gebinde- und Kilopreis', () => {
    const [karte] = baueFutterKaufen(eingabe({ produkte: familie })).angebote
    expect(karte).toMatchObject({
      name: 'Bergwiesen-Heu',
      hof: { slug: 'testhof-a', name: 'Testhof A', postalCode: '1234', city: 'Beispielort', entfernungKm: 6 },
      schild: 'Futtermittelbetrieb · LFBIS 1234567 · laut Hof',
      grundpreis: 'ab € 0,18 / kg',
      vorgewaehlt: 'rund',
    })
    expect(karte.groessen).toEqual([
      { id: 'rund', name: 'Rundballen ~250 kg', preis: '€ 45,00', kilopreis: '€ 0,18 / kg', kaufbar: true, kaufLink: '/testhof-a/produkt/rund?kaeufer=betrieb', guenstigster: true },
      { id: 'klein', name: 'Kleinballen ~15 kg', preis: '€ 4,50', kilopreis: '€ 0,30 / kg', kaufbar: true, kaufLink: '/testhof-a/produkt/klein?kaeufer=betrieb', guenstigster: false },
    ])
  })

  it('vorgewählt ist die erste KAUFBARE Größe; eine ausverkaufte steht als „derzeit aus" da und zählt nicht zum Grundpreis', () => {
    const [karte] = baueFutterKaufen(eingabe({ produkte: [{ ...familie[0], stock: 0 }, familie[1]] })).angebote
    expect(karte.vorgewaehlt).toBe('klein')
    expect(karte.groessen.map((g) => [g.id, g.kaufbar])).toEqual([
      ['rund', false],
      ['klein', true],
    ])
    expect(karte.grundpreis).toBe('€ 0,30 / kg')
  })

  it('der Knopf nennt Größe und Preis, bei nur einer Größe nur den Preis', () => {
    const [mehrere] = baueFutterKaufen(eingabe({ produkte: familie })).angebote
    expect(bestellenText(mehrere, mehrere.groessen[1])).toBe('Bestellen · Kleinballen ~15 kg · € 4,50')
    const [eine] = baueFutterKaufen(eingabe({ produkte: [produkt({ price: 42 })] })).angebote
    expect(bestellenText(eine, eine.groessen[0])).toBe('Bestellen · € 42,00')
  })
})

describe('Marke „günstigster Kilopreis" — nur innerhalb des Angebots, mehr als 5 %', () => {
  const groesse = (id: string, price: number, nettoMenge: number, mehr: Partial<FutterProdukt> = {}) =>
    produkt({ id, familieId: 'f', price, futter: { nettoMenge, nettoEinheit: 'KG', betriebsnummer: '1' }, ...mehr })

  it('genau 5 % darunter gibt keine Marke, 5,1 % schon', () => {
    expect(guenstigsteGroesse([groesse('a', 100, 100), groesse('b', 95, 100)])).toBeNull()
    expect(guenstigsteGroesse([groesse('a', 100, 100), groesse('b', 94.9, 100)])).toBe('b')
    // An der Grenze ohne Rundungsfehler: € 4,00 / 20 kg gegen € 3,80 / 20 kg sind genau 5 %.
    expect(guenstigsteGroesse([groesse('a', 4, 20), groesse('b', 3.8, 20)])).toBeNull()
  })

  it('erst ab zwei kaufbaren Größen mit Kilopreis; eine ausverkaufte zählt nicht', () => {
    expect(guenstigsteGroesse([groesse('a', 45, 250)])).toBeNull()
    expect(guenstigsteGroesse([groesse('a', 45, 250), groesse('b', 4.5, 15, { futter: null })])).toBeNull()
    expect(guenstigsteGroesse([groesse('a', 45, 250, { stock: 0 }), groesse('b', 4.5, 15)])).toBeNull()
  })
})

describe('Abholhinweise als Kennzeichen', () => {
  it('tragen alle Größen dieselben, steht keine Größe davor; sonst die Größen, die ihn tragen', () => {
    expect(abholKennzeichen([{ name: 'Rundballen', abholhinweise: ['FRONTLADER', 'ANHAENGER_NOETIG'] }])).toEqual([
      { hinweis: 'ANHAENGER_NOETIG', groessen: null },
      { hinweis: 'FRONTLADER', groessen: null },
    ])
    expect(
      abholKennzeichen([
        { name: 'Kleinballen', abholhinweise: ['NACH_ABSPRACHE'] },
        { name: 'Rundballen', abholhinweise: ['ANHAENGER_NOETIG', 'NACH_ABSPRACHE'] },
      ])
    ).toEqual([
      { hinweis: 'ANHAENGER_NOETIG', groessen: 'Rundballen' },
      { hinweis: 'NACH_ABSPRACHE', groessen: null },
    ])
  })

  it('die Karte trägt sie aus den Größen der Familie', () => {
    const [karte] = baueFutterKaufen(eingabe({ produkte: [{ ...familie[0], abholhinweise: ['ANHAENGER_NOETIG'] }, familie[1]] })).angebote
    expect(karte.abholhinweise).toEqual([{ hinweis: 'ANHAENGER_NOETIG', groessen: 'Rundballen ~250 kg' }])
  })
})

describe('Schild, Texte, Datensparsamkeit', () => {
  it('das Schild endet auf „· laut Hof" und fehlt bei anderen Status (Wortlaut nicht entschieden)', () => {
    const [karte] = baueFutterKaufen(eingabe()).angebote
    expect(karte.schild).toBe('Futtermittelbetrieb · LFBIS 1234567 · laut Hof')
    expect(karte.schild).not.toMatch(/gepr|registriert/i)
    const [registriert] = baueFutterKaufen(eingabe({ hoefe: [hof({ betriebsstatus: 'REGISTRIERT' })] })).angebote
    expect(registriert.schild).toBeNull()
  })

  it('kein sichtbarer Text zu Futter sagt „registriert" oder „geprüft" (E9); „prüft sie nicht" nennt die Marke', () => {
    const leer = baueFutterKaufen(eingabe({ hoefe: [], produkte: [] }))
    const texte = [
      FUTTER_KAUFEN_HINWEIS,
      FUTTER_NUR_LFBIS,
      FUTTER_SELBST_VERKAUFEN,
      FUTTER_ERKLAERUNG.titel,
      ...FUTTER_ERKLAERUNG.punkte,
      ...Object.values(FUTTER_KARTE_TEXT),
      leer.leer?.titel,
      leer.leer?.satz,
      leer.zahlZeile,
    ].join('\n')
    expect(texte).not.toMatch(/registriert|geprüft/i)
    // Gegenprobe: Die Suche schlägt an einem Text mit dem Wort an.
    expect('nur registrierte Futtermittelbetriebe').toMatch(/registriert|geprüft/i)
    expect(FUTTER_ERKLAERUNG.punkte[1]).toBe(`Die Nummer gibt der Hof selbst an. ${MARKE} prüft sie nicht.`)
  })

  it('keine Kontaktdaten und kein Bestand in den Angeboten; die Pins tragen nur Nummer, Name und Kartenpunkt', () => {
    const ansicht = baueFutterKaufen(eingabe({ produkte: familie }))
    expect(JSON.stringify(ansicht.angebote)).not.toMatch(/latitude|longitude|stock|reserved|@|telefon|phone|address/i)
    expect(ansicht.karte.pins).toEqual([{ slug: 'testhof-a', nummer: 1, lat: 48.1, lon: 14.1, name: 'Testhof A' }])
  })

  it('Höfe nach Entfernung (nie nach Preis), ein langer Name bleibt ganz', () => {
    const lang = 'H'.repeat(80)
    const ansicht = baueFutterKaufen(
      eingabe({
        hoefe: [hof({ id: 'weit', slug: 'weit', name: lang, entfernungKm: 19 }), hof()],
        produkte: [produkt({ id: 'w', farmId: 'weit', price: 1 }), produkt()],
      })
    )
    expect(ansicht.angebote.map((a) => a.hof.name)).toEqual(['Testhof A', lang])
  })
})

describe('Filter, Chips, Zahl je Stufe', () => {
  const heu = produkt({ id: 'heu', futter: { nettoMenge: 250, nettoEinheit: 'KG', betriebsnummer: '1' } })
  const hafer = produkt({ id: 'hafer', category: 'GETREIDE_KOERNER', subcategory: null, name: 'Hafer 25 kg', futter: { nettoMenge: 25, nettoEinheit: 'KG', betriebsnummer: '1' } })

  it('Art und Menge filtern je Größe; Chips zählen Karten bei der übrigen Auswahl', () => {
    const ansicht = baueFutterKaufen(eingabe({ produkte: [heu, hafer], filter: { ...ALLES, art: 'HEU_STROH' } }))
    expect(ansicht.angebote.map((a) => a.groessen[0].id)).toEqual(['heu'])
    expect(ansicht.artChips.map((c) => [c.label, c.anzahl, c.aktiv])).toEqual([
      ['Alle', 2, false],
      ['Heu & Stroh', 1, true],
      ['Getreide & Körner', 1, false],
    ])
    expect(ansicht.mengeChips.map((c) => [c.label, c.anzahl])).toEqual([
      ['Alle Mengen', 1],
      ['Ballen & mehr', 1],
    ])
    const klein = baueFutterKaufen(eingabe({ produkte: [heu, hafer], filter: { ...ALLES, menge: 'klein' } }))
    expect(klein.angebote.map((a) => a.groessen[0].id)).toEqual(['hafer'])
  })

  it('die Zahl je Stufe zählt die Angebote mit den gewählten Filtern; die Liste zeigt nur den gewählten Umkreis', () => {
    const hoefe = [hof({ id: 'n', slug: 'n', entfernungKm: 6 }), hof({ id: 'm', slug: 'm', entfernungKm: 19 }), hof({ id: 'w', slug: 'w', entfernungKm: 40 })]
    const produkte = [
      produkt({ id: 'n1', farmId: 'n' }),
      produkt({ id: 'm1', farmId: 'm' }),
      produkt({ id: 'm2', farmId: 'm', category: 'GETREIDE_KOERNER', subcategory: null }),
      produkt({ id: 'w1', farmId: 'w' }),
    ]
    const alle = baueFutterKaufen(eingabe({ hoefe, produkte, filter: { ...ALLES, km: 10 } }))
    expect(alle.zahlenJeStufe).toEqual({ 10: 1, 25: 3, 50: 4 })
    expect(alle.angebote.map((a) => a.groessen[0].id)).toEqual(['n1'])
    const heuAllein = baueFutterKaufen(eingabe({ hoefe, produkte, filter: { ...ALLES, art: 'HEU_STROH' } }))
    expect(heuAllein.zahlenJeStufe).toEqual({ 10: 1, 25: 2, 50: 3 })
    // Gegenprobe Abholung: Am Sonntag holt hier keiner ab — jede Stufe 0.
    const sonntag = baueFutterKaufen(eingabe({ hoefe, produkte, filter: { ...ALLES, abholung: 'wochenende' }, jetzt: SONNTAG_FRUEH }))
    expect(sonntag.zahlenJeStufe).toEqual({ 10: 0, 25: 0, 50: 0 })
  })
})

describe('Filter Abholung — dieselbe Regel wie /hoefe', () => {
  const samstagHof = hof({ id: 'sa', slug: 'sa', abholfenster: [SAMSTAG] })
  const sonntagHof = hof({ id: 'so', slug: 'so', name: 'Testhof B', entfernungKm: 9, abholfenster: [SONNTAG] })
  const produkte = [produkt({ id: 'sa1', farmId: 'sa' }), produkt({ id: 'so1', farmId: 'so' })]
  const ids = (e: Partial<FutterKaufenEingabe>) => baueFutterKaufen(eingabe({ hoefe: [samstagHof, sonntagHof], produkte, ...e })).angebote.map((a) => a.hof.slug)

  it('heute, morgen und Wochenende am Samstag früh', () => {
    expect(ids({ filter: { ...ALLES, abholung: 'heute' } })).toEqual(['sa'])
    expect(ids({ filter: { ...ALLES, abholung: 'morgen' } })).toEqual(['so'])
    expect(ids({ filter: { ...ALLES, abholung: 'wochenende' } })).toEqual(['sa', 'so'])
  })

  it('Grenze Wochenende: am Sonntag zählt nur noch der Sonntag; ein laufendes Fenster ist nicht mehr bestellbar', () => {
    expect(ids({ filter: { ...ALLES, abholung: 'wochenende' }, jetzt: SONNTAG_FRUEH })).toEqual([])
    expect(ids({ filter: { ...ALLES, abholung: 'heute' }, jetzt: SAMSTAG_MITTAG })).toEqual([])
  })

  it('die Reihe hat immer alle vier Wahlen, die Zeile am Handy nennt die Zahl samt „nur Höfe mit LFBIS-Nummer"', () => {
    const ansicht = baueFutterKaufen(eingabe({ hoefe: [samstagHof, sonntagHof], produkte, filter: { ...ALLES, abholung: 'heute' } }))
    expect(ansicht.abholungChips.map((c) => [c.label, c.anzahl, c.aktiv])).toEqual([
      ['Alle Tage', 2, false],
      ['Heute', 1, true],
      ['Morgen', 1, false],
      ['Wochenende', 2, false],
    ])
    expect(ansicht.zahlZeile).toBe('1 Angebot holt heute ab · nur Höfe mit LFBIS-Nummer')
    expect(baueFutterKaufen(eingabe({ hoefe: [samstagHof, sonntagHof], produkte })).zahlZeile).toBe('2 Angebote · nur Höfe mit LFBIS-Nummer')
  })
})

describe('Leerzustand', () => {
  it('„Heute holt hier kein Hof mehr Futter ab" mit „Morgen zeigen", wenn morgen Höfe abholen', () => {
    const hoefe = [hof({ id: 'a', slug: 'a', abholfenster: [SAMSTAG, SONNTAG] }), hof({ id: 'b', slug: 'b', abholfenster: [SONNTAG] })]
    const produkte = [produkt({ id: 'a1', farmId: 'a' }), produkt({ id: 'b1', farmId: 'b' })]
    const ansicht = baueFutterKaufen(eingabe({ hoefe, produkte, filter: { ...ALLES, abholung: 'heute' }, jetzt: SAMSTAG_MITTAG }))
    expect(ansicht.leer).toEqual({
      titel: 'Heute holt hier kein Hof mehr Futter ab',
      satz: 'Morgen holen 2 Höfe im Umkreis von 25 km ab.',
      ausweg: { art: 'abholung', label: 'Morgen zeigen', abholung: 'morgen' },
    })
  })

  it('kommt auch morgen nichts, schlägt der Knopf den größeren Umkreis vor, beim größten „Alle Tage"', () => {
    const nurSamstag = eingabe({ filter: { ...ALLES, abholung: 'heute' }, jetzt: SAMSTAG_MITTAG })
    expect(baueFutterKaufen(nurSamstag).leer?.ausweg).toEqual({ art: 'umkreis', label: 'Umkreis auf 50 km', km: 50 })
    expect(baueFutterKaufen({ ...nurSamstag, filter: { ...nurSamstag.filter, km: 50 } }).leer?.ausweg).toEqual({ art: 'abholung', label: 'Alle Tage', abholung: null })
  })

  it('leer durch Art oder Menge: „Alles Futter zeigen"; leer im Umkreis: nächste Stufe, beim größten kein Ausweg', () => {
    const auswahl = baueFutterKaufen(eingabe({ filter: { ...ALLES, art: 'MISCHFUTTER' } }))
    expect(auswahl.leer?.ausweg).toEqual({ art: 'auswahl', label: 'Alles Futter zeigen' })
    expect(auswahl.artChips.find((c) => c.wert === 'MISCHFUTTER')).toMatchObject({ aktiv: true, anzahl: 0 })
    expect(baueFutterKaufen(eingabe({ hoefe: [], produkte: [], filter: { ...ALLES, km: 10 } })).leer?.ausweg).toEqual({ art: 'umkreis', label: 'Umkreis auf 25 km', km: 25 })
    expect(baueFutterKaufen(eingabe({ hoefe: [], produkte: [], filter: { ...ALLES, km: 50 } })).leer?.ausweg).toBeNull()
  })

  it('Höfe ohne Standort werden nur gezählt — und nur solche mit Nummer und kaufbarem Angebot', () => {
    const ansicht = baueFutterKaufen(
      eingabe({
        ohneStandort: [
          { id: 'ohne-1', betriebsnummer: 'LFBIS 9', betriebsstatus: 'PRIMAERPRODUKTION' },
          { id: 'ohne-2', betriebsnummer: null, betriebsstatus: null },
          { id: 'ohne-3', betriebsnummer: 'LFBIS 8', betriebsstatus: 'PRIMAERPRODUKTION' },
        ],
        produkte: [produkt(), produkt({ id: 'x1', farmId: 'ohne-1' }), produkt({ id: 'x2', farmId: 'ohne-2' }), produkt({ id: 'x3', farmId: 'ohne-3', stock: 0 })],
      })
    )
    expect(ansicht.hinweise).toEqual(['1 Hof hat noch keinen Standort auf der Karte und fehlt hier.'])
    expect(ansicht.angebote).toHaveLength(1)
  })
})

describe('„Selbst verkaufen" — nur ohne eigenes Futter', () => {
  const eigenesHeu = (mehr: Partial<FutterProdukt> = {}) => produkt({ id: 'e1', farmId: 'eigen', ...mehr })
  const mitNummer = { betriebsnummer: 'LFBIS 7654321', betriebsstatus: 'PRIMAERPRODUKTION' as const }

  it('ohne eigenes Futter im Shop: der Kasten zum Anlegen', () => {
    expect(baueFutterKaufen(eingabe({ eigen: eigen() })).selbst).toEqual({ art: 'anlegen' })
  })

  it('mit Futter und sichtbar: „Deine 3 Futter-Angebote …" bzw. bei einem „Dein Futter-Angebot …", mit Link zur eigenen Liste', () => {
    const drei = [eigenesHeu(), eigenesHeu({ id: 'e2' }), eigenesHeu({ id: 'e3', familieId: 'f' }), eigenesHeu({ id: 'e4', familieId: 'f' })]
    expect(baueFutterKaufen(eingabe({ eigen: eigen({ ...mitNummer, futter: drei }) })).selbst).toEqual({
      art: 'zeile',
      satz: 'Deine 3 Futter-Angebote sehen andere Höfe hier.',
      href: '/products?filter=futter',
    })
    expect(baueFutterKaufen(eingabe({ eigen: eigen({ ...mitNummer, futter: [eigenesHeu()] }) })).selbst).toMatchObject({
      satz: 'Dein Futter-Angebot sehen andere Höfe hier.',
    })
  })

  it('mit Futter, aber nicht sichtbar (Testhof) oder ohne Nummer: keine Zeile und kein Kasten', () => {
    expect(baueFutterKaufen(eingabe({ eigen: eigen({ ...mitNummer, sichtbar: false, futter: [eigenesHeu()] }) })).selbst).toBeNull()
    expect(baueFutterKaufen(eingabe({ eigen: eigen({ futter: [eigenesHeu()] }) })).selbst).toBeNull()
  })
})

describe('Karte am Pin', () => {
  it('das erste Angebot des Hofs mit zwei Größen samt Preis und dem Hinweis auf weitere Angebote', () => {
    const ansicht = baueFutterKaufen(eingabe({ produkte: [...familie, produkt({ id: 'stroh', name: 'Stroh', price: 28 }), produkt({ id: 'hafer', name: 'Hafer', price: 20 })] }))
    const karte = ansicht.karte.karten['testhof-a']
    expect(karte.angebot.schluessel).toBe('testhof-a:f1')
    expect(karte.zeilen).toEqual([
      { name: 'Bergwiesen-Heu Rundballen ~250 kg', preis: '€ 45,00 · € 0,18 / kg' },
      { name: 'Bergwiesen-Heu Kleinballen ~15 kg', preis: '€ 4,50 · € 0,30 / kg' },
    ])
    expect(karte.weitere).toBe('und 2 weitere Angebote in der Liste')
    expect(ansicht.karte.zentrum).toEqual({ lat: 48, lon: 14, radiusKm: 25, titel: 'Sonnhof (dein Hof)' })
  })
})

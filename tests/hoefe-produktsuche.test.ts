/**
 * Tests für die dynamische Produktsuche der Hofübersicht
 * (src/lib/hofuebersicht.ts): die Vorschlags-Liste aus dem verfügbaren
 * Angebot (verfuegbareProduktnamen), die Suchwirkung auf die Hofliste
 * (filtereNachSuche), die Trefferbevorzugung im Schaufenster
 * (waehleVorschauProdukte, fünfter Parameter) und die GESAMTE Verdrahtung
 * (berechneHofAuswahl — die eine Funktion, die die Komponente aufruft).
 *
 * `suchNamen` sind die Namen ALLER verfügbaren Produkte je Hof (ungedeckelt,
 * queries/farm.ts) — Ausverkauftes steht dort nie drin; DASS die Query das
 * garantiert, prüft tests/hofuebersicht.test.ts.
 */
import { describe, it, expect } from 'vitest'
import {
  berechneHofAuswahl,
  filtereHoefe,
  filtereNachSuche,
  verfuegbareProduktnamen,
  waehleVorschauProdukte,
  VORSCHAU_ZEILEN,
  VORSCHLAGS_DECKEL,
  type VorschauProdukt,
} from '@/lib/hofuebersicht'
import type { ProductCategoryValue } from '@/schemas/product'

let laufnummer = 0
function produkt(teil: Partial<VorschauProdukt> & { name: string }): VorschauProdukt {
  laufnummer += 1
  return {
    id: `p${laufnummer}`,
    price: 5,
    unit: 'KG',
    unitSize: null,
    imageUrl: null,
    category: null,
    verfuegbar: true,
    ...teil,
  }
}

function hof(
  name: string,
  suchNamen: string[],
  kategorien: ProductCategoryValue[] = [],
  teil: Record<string, unknown> = {}
) {
  return {
    name,
    suchNamen,
    kategorien,
    produkte: [] as VorschauProdukt[],
    latitude: 48.2,
    longitude: 13.5,
    ...teil,
  }
}

describe('verfuegbareProduktnamen — die Vorschlags-Knöpfe', () => {
  it('fasst gleiche Namen über Schreibweisen zusammen; Anzeigename ist die häufigste', () => {
    const vorschlaege = verfuegbareProduktnamen([
      hof('A', ['Freilandeier']),
      hof('B', ['freilandeier']),
      hof('C', ['Freilandeier', '  Freilandeier  ']),
    ])

    expect(vorschlaege).toEqual([{ name: 'Freilandeier', hoefe: 3 }])
  })

  it('bei Gleichstand der Schreibweisen gewinnt die Großschreibung, nicht die Ladereihenfolge', () => {
    const vorschlaege = verfuegbareProduktnamen([hof('A', ['freilandeier']), hof('B', ['Freilandeier'])])

    expect(vorschlaege).toEqual([{ name: 'Freilandeier', hoefe: 2 }])
  })

  it('auch die Schreibweisen-Abstimmung zählt je Hof nur EINMAL — Zeilen-Duplikate überstimmen keine Mehrheit', () => {
    // Hof A führt „eier" dreimal (6er-, 10er-, 30er-Gebinde), B und C
    // schreiben „Eier": Die Mehrheit der HÖFE beschriftet den Knopf.
    const vorschlaege = verfuegbareProduktnamen([
      hof('A', ['eier', 'eier', 'eier']),
      hof('B', ['Eier']),
      hof('C', ['Eier']),
    ])

    expect(vorschlaege).toEqual([{ name: 'Eier', hoefe: 3 }])
  })

  it('Leerzeichen-Unterschiede zählen nicht — „Bio  Brot" und „Bio Brot" sind eines', () => {
    const vorschlaege = verfuegbareProduktnamen([hof('A', ['Bio  Brot']), hof('B', ['Bio Brot'])])

    expect(vorschlaege).toHaveLength(1)
    expect(vorschlaege[0]).toMatchObject({ hoefe: 2 })
  })

  it('gleich aussehende Unicode-Formen (NFC/NFD) sind EIN Vorschlag — und die Marke filtert beide', () => {
    const nfc = 'Käse'.normalize('NFC')
    const nfd = 'Käse'.normalize('NFD')
    const hoefe = [hof('A', [nfc]), hof('B', [nfd])]

    expect(verfuegbareProduktnamen(hoefe)).toEqual([{ name: nfc, hoefe: 2 }])
    expect(filtereNachSuche(hoefe, '', [nfc])).toHaveLength(2)
  })

  it('sortiert nach Hofanzahl absteigend, bei Gleichstand alphabetisch', () => {
    const vorschlaege = verfuegbareProduktnamen([
      hof('A', ['Brot', 'Eier']),
      hof('B', ['Eier', 'Apfelsaft']),
    ])

    expect(vorschlaege.map((v) => v.name)).toEqual(['Eier', 'Apfelsaft', 'Brot'])
  })

  it('je Hof zählt ein Name EINMAL, auch wenn er mehrfach in den Zeilen steht', () => {
    expect(verfuegbareProduktnamen([hof('A', ['Eier', 'eier'])])).toEqual([
      { name: 'Eier', hoefe: 1 },
    ])
  })

  it('der Deckel greift bei zwölf', () => {
    const viele = hof(
      'A',
      Array.from({ length: 20 }, (_, i) => `Produkt ${String(i).padStart(2, '0')}`)
    )

    expect(VORSCHLAGS_DECKEL).toBe(12)
    expect(verfuegbareProduktnamen([viele])).toHaveLength(12)
  })

  it('der Suchtext verengt die Liste VOR dem Deckel — auch Namen hinter den Zwölf tauchen auf', () => {
    // 13 Höfe führen je ein Massenprodukt, EIN Hof zusätzlich den „Wels" —
    // ohne Eingabe fällt er hinter den Deckel, mit „wel" erscheint er.
    const hoefe = Array.from({ length: 13 }, (_, i) =>
      hof(`Hof ${i}`, [`Massenware ${String(i).padStart(2, '0')}`])
    )
    hoefe[0]!.suchNamen.push('Wels')

    expect(verfuegbareProduktnamen(hoefe).map((v) => v.name)).not.toContain('Wels')
    expect(verfuegbareProduktnamen(hoefe, 'wel').map((v) => v.name)).toEqual(['Wels'])
  })
})

describe('filtereNachSuche — die Wirkung auf die Hofliste', () => {
  // Ausverkauftes steht NIE in suchNamen (Vertrag der Query, dort getestet):
  // Die Fischerei führt „Eier" nur ausverkauft — für die Suche existieren
  // sie nicht, ihr Hofname trifft aber weiterhin.
  const HOEFE = [
    hof('Eierhof Maier', ['Nudeln']),
    hof('Biohof Huber', ['Freilandeier', 'Brot']),
    hof('Fischerei Wagner', ['Wels']),
  ]

  it('leere Suche zeigt alle', () => {
    expect(filtereNachSuche(HOEFE, '', [])).toHaveLength(3)
  })

  it('der Suchtext trifft Hofnamen — Groß-/Kleinschreibung egal, Teiltreffer erlaubt', () => {
    expect(filtereNachSuche(HOEFE, 'maier', []).map((h) => h.name)).toEqual(['Eierhof Maier'])
    expect(filtereNachSuche(HOEFE, 'HOF', []).map((h) => h.name)).toEqual([
      'Eierhof Maier',
      'Biohof Huber',
    ])
  })

  it('der Suchtext trifft Produktnamen — ausverkaufte Eier zählen nicht (nicht in suchNamen)', () => {
    expect(filtereNachSuche(HOEFE, 'eier', []).map((h) => h.name)).toEqual([
      'Eierhof Maier',
      'Biohof Huber',
    ])
  })

  it('ein Hof wird auch über Produkte JENSEITS der acht Vorschau-Zeilen gefunden', () => {
    // Das Loch, das der Kategoriefilter bewusst gestopft hat, darf die
    // Suche nicht wieder aufreißen: suchNamen sind ungedeckelt — das
    // Produkt ab Platz neun trifft, obwohl die Vorschau es nie lädt.
    const gross = hof('Großer Hof', [
      ...Array.from({ length: 8 }, (_, i) => `Vorne ${i}`),
      'Honig',
    ])

    expect(filtereNachSuche([gross], 'honig', []).map((h) => h.name)).toEqual(['Großer Hof'])
    expect(filtereNachSuche([gross], '', ['Honig']).map((h) => h.name)).toEqual(['Großer Hof'])
  })

  it('mehrere aktive Marken sind ein ODER', () => {
    expect(filtereNachSuche(HOEFE, '', ['Wels', 'Brot']).map((h) => h.name)).toEqual([
      'Biohof Huber',
      'Fischerei Wagner',
    ])
  })

  it('eine Marke trifft als Teilbegriff — „Eier" behält den Hof, der „Freilandeier" schreibt', () => {
    expect(filtereNachSuche(HOEFE, '', ['Eier']).map((h) => h.name)).toEqual(['Biohof Huber'])
  })

  it('Suchtext UND Marken zusammen schränken weiter ein (UND)', () => {
    expect(filtereNachSuche(HOEFE, 'huber', ['Brot', 'Wels']).map((h) => h.name)).toEqual([
      'Biohof Huber',
    ])
  })

  it('die Kombination mit dem Kategoriefilter ist ein UND — wie in der echten Filterkette', () => {
    const mitKategorien = [
      hof('Biohof Huber', ['Eier'], ['EIER']),
      hof('Gemüsehof Gruber', ['Eier'], ['GEMUESE']),
    ]
    const ergebnis = filtereNachSuche(filtereHoefe(mitKategorien, ['EIER']), '', ['Eier'])

    expect(ergebnis.map((h) => h.name)).toEqual(['Biohof Huber'])
  })

  it('die Eingabe wird nicht verändert', () => {
    const eingabe = [...HOEFE]
    filtereNachSuche(eingabe, 'ei', ['Brot'])
    expect(eingabe).toEqual(HOEFE)
  })
})

describe('berechneHofAuswahl — die Verdrahtung der Übersicht als Ganzes', () => {
  const FILTER = {
    kategorien: [] as ProductCategoryValue[],
    bezugspunkt: null,
    umkreis: null,
    suchtext: '',
    suchMarken: [] as string[],
  }
  const HOEFE = [
    hof('Biohof Huber', ['Freilandeier', 'Brot'], ['EIER', 'BROT']),
    hof('Gemüsehof Gruber', ['Karotten'], ['GEMUESE']),
    // Weit im Norden — fliegt bei Umkreis 10 km um Ried heraus.
    hof('Ferner Hof', ['Wels'], ['SONSTIGES'], { latitude: 50.5, longitude: 14.5 }),
  ]

  it('die Vorschläge speisen sich aus dem KATEGORIE-Ausschnitt, nicht aus allen Höfen', () => {
    const { vorschlaege } = berechneHofAuswahl(HOEFE, { ...FILTER, kategorien: ['EIER'] })

    expect(vorschlaege.map((v) => v.name)).toEqual(['Brot', 'Freilandeier'])
  })

  it('auch der Umkreis begrenzt das Angebot der Vorschläge', () => {
    const { vorschlaege } = berechneHofAuswahl(HOEFE, {
      ...FILTER,
      bezugspunkt: { lat: 48.2, lon: 13.5 },
      umkreis: 10,
    })

    expect(vorschlaege.map((v) => v.name)).not.toContain('Wels')
  })

  it('aktive Marken verschwinden aus den Vorschlägen, begrenzen sie aber NICHT (ODER bleibt erweiterbar)', () => {
    const { vorschlaege, gefiltert } = berechneHofAuswahl(HOEFE, {
      ...FILTER,
      suchMarken: ['Freilandeier'],
    })

    // Gefiltert ist nur der Eier-Hof — angeboten werden trotzdem die
    // Produkte der Nachbarhöfe, denn eine zweite Marke ERWEITERT die Liste.
    expect(gefiltert.map((h) => h.name)).toEqual(['Biohof Huber'])
    expect(vorschlaege.map((v) => v.name)).toEqual(['Brot', 'Karotten', 'Wels'])
  })

  it('suchbegriffe = Marken plus getippter Text; sucheAktiv folgt beidem', () => {
    expect(berechneHofAuswahl(HOEFE, FILTER).sucheAktiv).toBe(false)
    expect(berechneHofAuswahl(HOEFE, { ...FILTER, suchMarken: ['Brot'] }).suchbegriffe).toEqual([
      'Brot',
    ])
    expect(
      berechneHofAuswahl(HOEFE, { ...FILTER, suchMarken: ['Brot'], suchtext: ' Wels ' })
        .suchbegriffe
    ).toEqual(['Brot', 'Wels'])
  })

  it('sucheLeertDieListe nur, wenn WIRKLICH die Suche die Ursache ist — nicht der Umkreis', () => {
    // Suche leert: Basis voll, Suchtext trifft nichts → Zurücksetzen hilft.
    expect(
      berechneHofAuswahl(HOEFE, { ...FILTER, suchtext: 'gibtesnicht' }).sucheLeertDieListe
    ).toBe(true)
    // Umkreis leert die BASIS: „Suche zurücksetzen" hülfe nicht — die
    // Leermeldung muss den Umkreis nennen.
    const umkreisLeer = berechneHofAuswahl(HOEFE, {
      ...FILTER,
      suchtext: 'wels',
      bezugspunkt: { lat: 40.0, lon: 5.0 },
      umkreis: 10,
    })
    expect(umkreisLeer.gefiltert).toHaveLength(0)
    expect(umkreisLeer.sucheLeertDieListe).toBe(false)
  })
})

describe('waehleVorschauProdukte — Treffer stehen im Schaufenster zuerst', () => {
  it('das gesuchte Produkt rückt nach vorn, der Rest behält seine Ordnung', () => {
    const produkte = [
      produkt({ name: 'Nudeln' }),
      produkt({ name: 'Brot' }),
      produkt({ name: 'Freilandeier' }),
      produkt({ name: 'Speck' }),
    ]

    const { produkte: gezeigt } = waehleVorschauProdukte(
      produkte,
      [],
      produkte.length,
      VORSCHAU_ZEILEN,
      ['Eier']
    )

    expect(gezeigt.map((p) => p.name)).toEqual(['Freilandeier', 'Nudeln', 'Brot'])
  })

  it('ein ausverkaufter Treffer steht vor verfügbaren Nicht-Treffern — „derzeit aus" erklärt es', () => {
    const produkte = [produkt({ name: 'Brot' }), produkt({ name: 'Eier', verfuegbar: false })]

    const { produkte: gezeigt } = waehleVorschauProdukte(produkte, [], 2, VORSCHAU_ZEILEN, ['Eier'])

    expect(gezeigt.map((p) => p.name)).toEqual(['Eier', 'Brot'])
  })

  it('Suchtreffer schlagen den Kategorie-Vorrang', () => {
    const produkte = [
      produkt({ name: 'Käse', category: 'MILCH' }),
      produkt({ name: 'Eier', category: 'EIER' }),
    ]

    const { produkte: gezeigt } = waehleVorschauProdukte(
      produkte,
      ['MILCH'],
      2,
      VORSCHAU_ZEILEN,
      ['Eier']
    )

    expect(gezeigt.map((p) => p.name)).toEqual(['Eier', 'Käse'])
  })

  it('ohne Suchbegriffe bleibt die bisherige Rangfolge unangetastet', () => {
    const produkte = [produkt({ name: 'B', verfuegbar: false }), produkt({ name: 'A' })]

    const { produkte: gezeigt } = waehleVorschauProdukte(produkte, [], 2)

    expect(gezeigt.map((p) => p.name)).toEqual(['A', 'B'])
  })
})

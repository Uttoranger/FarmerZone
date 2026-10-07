/**
 * Pflicht-Bestätigung des Hofs und Verantwortungs-Hinweise bei Futter
 * (Register E10a, Nachtlauf Nr. 23) — src/lib/futter-registrierung.ts, rein
 * und ohne Mock.
 *
 * Beweist: Die Wortlaute stehen genau so, wie das Register sie vorgibt (EINE
 * Quelle für Formular, Server und Kundenseite). Eine neue Bestätigung braucht
 * jede Änderung außer Preis, Vorrat, Sichtbarkeit und Foto; Schreibweisen
 * desselben Werts (leer/null, Decimal/Zahl, Reihenfolge einer Liste) zählen
 * nicht als Änderung. Der Kundenhinweis erscheint nur bei Futter, der Zusatz
 * nur bei „nur an Betriebe".
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  BAES_FUTTERMITTEL_URL,
  BETRIEB_VERANTWORTUNG,
  FUTTER_BESTAETIGUNG_TEXT,
  KUNDEN_VERANTWORTUNG,
  OHNE_NEUE_BESTAETIGUNG,
  ORIENTIERUNG_HINWEIS,
  brauchtNeueBestaetigung,
  futterStandAusFormular,
  futterVerantwortung,
  futterVerantwortungImKorb,
  type FutterStand,
} from '@/lib/futter-registrierung'

describe('Wortlaute aus E10a', () => {
  it('der Haken sagt genau den Satz aus dem Register', () => {
    expect(FUTTER_BESTAETIGUNG_TEXT).toBe(
      'Ich bestätige, dass meine Angaben zu Registrierung, Kennzeichnung und Verpackung richtig und vollständig sind. Für die Richtigkeit bin ich verantwortlich. Falsche Angaben können nach dem Futtermittelgesetz bestraft werden.'
    )
  })

  it('der Kopfhinweis über den Fällen sagt genau den Satz aus dem Register', () => {
    expect(ORIENTIERUNG_HINWEIS).toBe(
      'Zur Orientierung, keine Rechtsberatung. Im Zweifel bei der Bezirkshauptmannschaft, beim BAES oder bei der Landwirtschaftskammer nachfragen.'
    )
  })

  it('der Kundenhinweis und der Zusatz für Betriebe sagen genau die Sätze aus dem Register', () => {
    expect(KUNDEN_VERANTWORTUNG).toBe(
      'Die Angaben zu Registrierung und Kennzeichnung stammen vom Hof. Der Hof ist für ihre Richtigkeit verantwortlich; FarmerZone vermittelt nur und prüft die Angaben nicht.'
    )
    expect(BETRIEB_VERANTWORTUNG).toBe('Als Betrieb bist du für den bestimmungsgemäßen Einsatz verantwortlich.')
  })

  it('der BAES-Link ist eine offizielle Adresse unter baes.gv.at über https', () => {
    const url = new URL(BAES_FUTTERMITTEL_URL)
    expect(url.protocol).toBe('https:')
    expect(url.hostname).toBe('www.baes.gv.at')
  })
})

/** Ein gespeichertes Heu, wie es die Datenbank liefert (Decimal als Objekt mit toNumber). */
function dezimal(n: number): { toNumber: () => number; toString: () => string } {
  return { toNumber: () => n, toString: () => String(n) }
}

function heuStand(): FutterStand {
  return {
    produkt: {
      name: 'Bergheu – Rundballen',
      description: null,
      imageUrl: '/bild-alt.jpg',
      category: 'HEU_STROH',
      subcategory: 'WIESENHEU',
      labels: ['BIO'],
      abgabe: 'ALLE',
      countsTowardLimit: true,
      price: dezimal(45),
      vatRate: dezimal(13),
      unit: 'BALLEN',
      unitSize: null,
      isAvailable: true,
      allergens: [],
      seasonStart: null,
    },
    kennzeichnung: {
      futtermittelart: 'EINZELFUTTERMITTEL',
      zielTierarten: ['PFERD', 'RIND'],
      zusammensetzung: 'Wiesenheu, erster Schnitt',
      analytischeBestandteile: 'Rohprotein 9 %',
      nettoMenge: dezimal(250),
      nettoEinheit: 'KG',
      rohprotein: dezimal(9.5),
      zusatzstoffe: null,
      bestaetigtAm: new Date('2026-10-01T08:00:00.000Z'),
    },
  }
}

/** Derselbe Stand, wie ihn das Formular schickt: Zahlen statt Decimal, leer statt null, andere Reihenfolge. */
function heuAusFormular(): FutterStand {
  return {
    produkt: {
      name: 'Bergheu – Rundballen',
      description: '',
      imageUrl: '/bild-alt.jpg',
      category: 'HEU_STROH',
      subcategory: 'WIESENHEU',
      labels: ['BIO'],
      abgabe: 'ALLE',
      countsTowardLimit: true,
      price: 45,
      vatRate: 13,
      unit: 'BALLEN',
      unitSize: null,
      isAvailable: true,
      allergens: [],
      seasonStart: null,
    },
    kennzeichnung: {
      futtermittelart: 'EINZELFUTTERMITTEL',
      zielTierarten: ['RIND', 'PFERD'],
      zusammensetzung: 'Wiesenheu, erster Schnitt',
      analytischeBestandteile: 'Rohprotein 9 %',
      nettoMenge: 250,
      nettoEinheit: 'KG',
      rohprotein: 9.5,
      zusatzstoffe: '',
      bestaetigt: false,
    },
  }
}

function mitProdukt(stand: FutterStand, aenderung: Record<string, unknown>): FutterStand {
  return { ...stand, produkt: { ...stand.produkt, ...aenderung } }
}

function mitKennzeichnung(stand: FutterStand, aenderung: Record<string, unknown>): FutterStand {
  return { ...stand, kennzeichnung: { ...(stand.kennzeichnung ?? {}), ...aenderung } }
}

describe('brauchtNeueBestaetigung — jede inhaltliche Änderung verlangt den Haken neu', () => {
  it('unverändert gespeichert: keine neue Bestätigung, auch wenn Schreibweisen abweichen', () => {
    expect(brauchtNeueBestaetigung(heuStand(), heuAusFormular())).toBe(false)
  })

  it('nur Preis, Vorrat, Sichtbarkeit oder Foto geändert: keine neue Bestätigung', () => {
    const neu = mitProdukt(heuAusFormular(), { price: 49.5, stock: 3, isAvailable: false, imageUrl: '/bild-neu.jpg' })
    expect(brauchtNeueBestaetigung(heuStand(), neu)).toBe(false)
  })

  it('ausgenommen sind genau Preis, Vorrat, Sichtbarkeit und Foto', () => {
    expect([...OHNE_NEUE_BESTAETIGUNG].sort()).toEqual(['imageUrl', 'isAvailable', 'price', 'stock'])
  })

  it.each([
    ['Zusammensetzung', { zusammensetzung: 'Wiesenheu, zweiter Schnitt' }],
    ['Tierarten', { zielTierarten: ['PFERD'] }],
    ['Nettomenge', { nettoMenge: 300 }],
    ['Rohwert gelöscht', { rohprotein: null }],
    ['Zusatzstoffe eingetragen', { zusatzstoffe: 'keine' }],
    ['Futtermittelart', { futtermittelart: 'MISCHFUTTERMITTEL' }],
  ])('Kennzeichnung geändert (%s): neue Bestätigung', (_fall, aenderung) => {
    expect(brauchtNeueBestaetigung(heuStand(), mitKennzeichnung(heuAusFormular(), aenderung))).toBe(true)
  })

  it.each([
    ['Name', { name: 'Bergheu – Kleinballen' }],
    ['Beschreibung', { description: 'staubarm' }],
    ['Sorte', { subcategory: 'GRUMMET' }],
    ['Bio-Siegel', { labels: [] }],
    ['Abgabe nur an Betriebe', { abgabe: 'NUR_BETRIEBE' }],
    ['Einheit (Verpackung)', { unit: 'STUECK' }],
    ['Gebindegröße', { unitSize: 25 }],
    ['MwSt', { vatRate: 20 }],
    ['ein Feld, das es bisher nicht gab', { neuesFeld: 'x' }],
  ])('Produktangabe geändert (%s): neue Bestätigung', (_fall, aenderung) => {
    expect(brauchtNeueBestaetigung(heuStand(), mitProdukt(heuAusFormular(), aenderung))).toBe(true)
  })

  it('ohne gespeicherte Kennzeichnung (Altbestand) oder ohne Vorstand: immer bestätigen', () => {
    expect(brauchtNeueBestaetigung({ ...heuStand(), kennzeichnung: null }, heuAusFormular())).toBe(true)
    expect(brauchtNeueBestaetigung(null, heuAusFormular())).toBe(true)
  })

  it('der Haken selbst und der alte Zeitpunkt sind keine Änderung', () => {
    const neu = mitKennzeichnung(heuAusFormular(), { bestaetigt: true })
    expect(brauchtNeueBestaetigung(heuStand(), neu)).toBe(false)
  })
})

describe('futterStandAusFormular — Formularwerte in den Vergleichsstand', () => {
  it('trennt die Kennzeichnung vom Produkt', () => {
    const stand = futterStandAusFormular({ name: 'Heu', price: 10, futter: { zusammensetzung: 'Heu' } })
    expect(stand).toEqual({ produkt: { name: 'Heu', price: 10 }, kennzeichnung: { zusammensetzung: 'Heu' } })
  })

  it('ohne Kennzeichnung ist sie null', () => {
    expect(futterStandAusFormular({ name: 'Heu', futter: null }).kennzeichnung).toBeNull()
  })
})

describe('futterVerantwortung — Hinweis für Kundinnen bei jedem Futter', () => {
  it('Futter für alle: nur der Verantwortungs-Hinweis', () => {
    expect(futterVerantwortung([{ category: 'HEU_STROH', abgabe: 'ALLE' }])).toEqual([KUNDEN_VERANTWORTUNG])
  })

  it('Futter nur an Betriebe: dazu der Zusatz', () => {
    expect(futterVerantwortung([{ category: 'MISCHFUTTER', abgabe: 'NUR_BETRIEBE' }])).toEqual([
      KUNDEN_VERANTWORTUNG,
      BETRIEB_VERANTWORTUNG,
    ])
  })

  it('kein Futter (Lebensmittel, Brennmaterial, ohne Kategorie): kein Hinweis', () => {
    expect(
      futterVerantwortung([
        { category: 'EIER', abgabe: 'ALLE' },
        { category: 'BRENNHOLZ', abgabe: 'ALLE' },
        { category: null, abgabe: 'ALLE' },
      ])
    ).toEqual([])
  })

  it('auch die Altlast-Kategorie FUTTERMITTEL ist Futter', () => {
    expect(futterVerantwortung([{ category: 'FUTTERMITTEL', abgabe: 'ALLE' }])).toEqual([KUNDEN_VERANTWORTUNG])
  })

  it('der Zusatz hängt nur an Futter: „nur an Betriebe" an einem Nicht-Futter zählt nicht', () => {
    expect(
      futterVerantwortung([
        { category: 'HEU_STROH', abgabe: 'ALLE' },
        { category: 'EIER', abgabe: 'NUR_BETRIEBE' },
      ])
    ).toEqual([KUNDEN_VERANTWORTUNG])
  })
})

describe('futterVerantwortungImKorb — Warenkorb mit Futter', () => {
  const produkte = [
    { id: 'eier', category: 'EIER' as const, abgabe: 'ALLE' as const },
    { id: 'heu', category: 'HEU_STROH' as const, abgabe: 'ALLE' as const },
    { id: 'misch', category: 'MISCHFUTTER' as const, abgabe: 'NUR_BETRIEBE' as const },
  ]

  it('nur, wenn der Korb Futter enthält', () => {
    expect(futterVerantwortungImKorb([{ productId: 'eier' }], produkte)).toEqual([])
    expect(futterVerantwortungImKorb([{ productId: 'eier' }, { productId: 'heu' }], produkte)).toEqual([KUNDEN_VERANTWORTUNG])
  })

  it('mit Futter nur an Betriebe: dazu der Zusatz', () => {
    expect(futterVerantwortungImKorb([{ productId: 'misch' }], produkte)).toEqual([KUNDEN_VERANTWORTUNG, BETRIEB_VERANTWORTUNG])
  })

  it('leerer Korb und unbekannte Positionen: kein Hinweis', () => {
    expect(futterVerantwortungImKorb([], produkte)).toEqual([])
    expect(futterVerantwortungImKorb([{ productId: 'weg' }], produkte)).toEqual([])
  })
})

describe('EINE Quelle für die Futter-Texte (E10a)', () => {
  const WURZEL = join(__dirname, '..', 'src')
  const QUELLE = 'lib/futter-registrierung.ts'

  function dateien(ordner: string): string[] {
    return readdirSync(ordner).flatMap((name) => {
      const pfad = join(ordner, name)
      if (statSync(pfad).isDirectory()) return dateien(pfad)
      return /\.(ts|tsx)$/.test(name) ? [pfad] : []
    })
  }

  /** Dateien unter src/, die dieses Stück Text wörtlich enthalten. */
  function fundstellen(stueck: string): string[] {
    return dateien(WURZEL)
      .filter((d) => readFileSync(d, 'utf8').includes(stueck))
      .map((d) => relative(WURZEL, d).split('\\').join('/'))
  }

  it.each([
    ['Haken', 'nach dem Futtermittelgesetz bestraft'],
    ['Kopfhinweis', 'keine Rechtsberatung'],
    ['Kundenhinweis', 'FarmerZone vermittelt nur'],
    ['Zusatz Betriebe', 'bestimmungsgemäßen Einsatz'],
    ['BAES-Adresse', 'baes.gv.at'],
  ])('%s (%s) steht nur in der Quelle', (_name, stueck) => {
    // Gegenprobe steckt im Ergebnis: Die Quelle selbst muss gefunden werden.
    expect(fundstellen(stueck)).toEqual([QUELLE])
  })

  it.each([
    ['components/produkte/futter-formular.tsx', 'FUTTER_BESTAETIGUNG_TEXT'],
    ['components/products/product-dialog.tsx', 'FUTTER_BESTAETIGUNG_TEXT'],
    ['components/produkte/futter-registrierungen.tsx', 'ORIENTIERUNG_HINWEIS'],
    ['components/produkte/futter-registrierungen.tsx', 'BAES_FUTTERMITTEL_URL'],
    ['components/produktdetail/produktdetail-kunde.tsx', 'futterVerantwortung('],
    ['components/produktdetail/produktdetail-kunde.tsx', 'futterVerantwortungImKorb('],
    ['components/farm/product-grid.tsx', 'futterVerantwortungImKorb('],
    ['components/hofseite/hofseite-seitenspalte.tsx', 'futterVerantwortungImKorb('],
  ])('%s zeigt %s aus der Quelle', (datei, name) => {
    expect(readFileSync(join(WURZEL, datei), 'utf8')).toContain(name)
  })
})

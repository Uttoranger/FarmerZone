/**
 * Entwurf und Fassung der Startseite (Register N16, Änderung Nr. 99) — das
 * Format (src/schemas/startseite-fassung.ts) und die reinen Regeln
 * (src/lib/startseite-fassung.ts), ohne Mock.
 *
 * Beweist:
 *  - Das Format ist strikt (v: 1, keine fremden Felder), hält dieselben Grenzen
 *    wie das Block-Formular und die festen Abschnitte an ihren Plätzen.
 *  - Entwurf → Fassung → Zeilen der Seite ist EIN Weg; ein inzwischen
 *    gesperrter Hof fällt beim Rendern weg.
 *  - vergleicheMitLive erkennt alle sechs Arten — neu, entfernt, verschoben,
 *    ausgeblendet, eingeblendet, geändert — und bei gleichem Stand keine.
 *  - Ein Termin darf höchstens eine Minute zurück und höchstens 365 Tage voraus liegen.
 *  - Live ist die jüngste nicht zurückgezogene Fassung, deren Zeit erreicht ist
 *    (ordneFassungen); ist der Termin der nächsten erreicht, liest die Seite
 *    am Cache vorbei (mussFrischLesen).
 *  - Das Band der Vorschau nennt Quelle und Tag; nach einer Speicherung steht
 *    nie ein leerer Rahmen, und es stehen höchstens zwei (Nr. 106).
 *  - Nr. 129 (N16, „Neu bei den Höfen“ als Zusatz): Eine gespeicherte Fassung
 *    von vor dem Lauf (samt Block) und der Entwurf aus den Zeilen der Migration
 *    bleiben gültig und rendern unverändert; der Zusatz geht durch das Format
 *    höchstens einmal und nach den Höfen.
 */
import { describe, expect, it } from 'vitest'
import {
  entwurfUebernehmenSchema,
  fassungInhaltSchema,
  veroeffentlichenSchema,
  type FassungBlock,
  type FassungInhalt,
  type FassungZeile,
} from '@/schemas/startseite-fassung'
import { STANDARD_REIHENFOLGE, TITEL_MAX, standText, zuRendern } from '@/lib/startseite-gestalten'
import {
  aenderungKurz,
  aenderungSatz,
  abstandText,
  beschreibeFassung,
  blockHinweise,
  fassungAusEntwurf,
  mussFrischLesen,
  ordneFassungen,
  pruefeTermin,
  standardFassung,
  vergleicheMitLive,
  vorschauBandText,
  vorschauRahmen,
  zeilenAusFassung,
  zeilenMarken,
  zeitraumKurz,
} from '@/lib/startseite-fassung'

const JETZT = new Date('2026-10-15T18:30:00.000Z')

function block(teil: Partial<FassungBlock> = {}): FassungBlock {
  return {
    id: 'b-kuerbis',
    vorlage: 'SAISONKARTE',
    titel: 'Kürbis, Äpfel und Most',
    farmIds: [],
    liveAb: '2026-10-17T22:00:00.000Z',
    liveBis: '2026-10-31T22:59:00.000Z',
    ...teil,
  }
}

/** Die Standard-Reihenfolge mit einem Block nach „Höfe in deiner Nähe". */
function mitBlock(b: FassungBlock = block()): FassungInhalt {
  const [kopf, hoefe, ...rest] = standardFassung().zeilen
  return { v: 1, zeilen: [kopf, hoefe, { art: 'BLOCK', sichtbar: true, block: b }, ...rest] }
}

/** Der Block an einer Zeile (die Zeile ist im Test eine Block-Zeile). */
function blockAn(f: FassungInhalt, index: number): FassungBlock {
  const zeile = f.zeilen[index]
  if (zeile.art !== 'BLOCK') throw new Error(`Zeile ${index} ist kein Block`)
  return zeile.block
}

describe('Format einer Fassung (v: 1)', () => {
  it('nimmt die Standard-Reihenfolge und eine Liste mit Block', () => {
    expect(fassungInhaltSchema.safeParse(standardFassung()).success).toBe(true)
    expect(fassungInhaltSchema.safeParse(mitBlock()).success).toBe(true)
  })

  it('ist strikt: eine andere Version oder ein fremdes Feld ist kein gültiger Inhalt', () => {
    expect(fassungInhaltSchema.safeParse({ ...standardFassung(), v: 2 }).success).toBe(false)
    expect(fassungInhaltSchema.safeParse({ ...standardFassung(), extra: 1 }).success).toBe(false)
    const fremd = mitBlock()
    ;(blockAn(fremd, 2) as Record<string, unknown>).html = '<b>x</b>'
    expect(fassungInhaltSchema.safeParse(fremd).success).toBe(false)
  })

  it('hält die Grenzen des Block-Formulars ein', () => {
    expect(fassungInhaltSchema.safeParse(mitBlock(block({ titel: 'x'.repeat(TITEL_MAX + 1) }))).success).toBe(false)
    expect(fassungInhaltSchema.safeParse(mitBlock(block({ linkUrl: '//fremd.example' }))).success).toBe(false)
    expect(fassungInhaltSchema.safeParse(mitBlock(block({ vorlage: 'HOEFE_AUSWAHL', farmIds: [] }))).success).toBe(false)
    expect(fassungInhaltSchema.safeParse(mitBlock(block({ vorlage: 'HOEFE_AUSWAHL', farmIds: ['a', 'b', 'c', 'd'] }))).success).toBe(false)
    expect(fassungInhaltSchema.safeParse(mitBlock(block({ liveBis: '2026-10-01T00:00:00.000Z' }))).success).toBe(false)
  })

  it('lässt feste Abschnitte nur an ihren Plätzen und einen Block nur an einer Block-Zeile zu', () => {
    const kopfUnten = standardFassung()
    kopfUnten.zeilen.push(kopfUnten.zeilen.shift() as FassungInhalt['zeilen'][number])
    expect(fassungInhaltSchema.safeParse(kopfUnten).success).toBe(false)
    const hoefeAus = standardFassung()
    hoefeAus.zeilen[1] = { art: 'HOEFE', sichtbar: false }
    expect(fassungInhaltSchema.safeParse(hoefeAus).success).toBe(false)
    const blockAmFutter = standardFassung()
    blockAmFutter.zeilen[2] = { art: 'FUTTER', sichtbar: true, block: block() } as unknown as FassungZeile
    expect(fassungInhaltSchema.safeParse(blockAmFutter).success).toBe(false)
    const fehlt = standardFassung()
    fehlt.zeilen.splice(6, 1)
    expect(fassungInhaltSchema.safeParse(fehlt).success).toBe(false)
  })
})

describe('Entwurf → Fassung → Zeilen der Seite', () => {
  it('ist ein Weg: was der Entwurf zeigt, zeigt die Fassung', () => {
    const entwurf = [
      { art: 'KOPF' as const, sichtbar: true, block: null },
      { art: 'HOEFE' as const, sichtbar: true, block: null },
      {
        art: 'BLOCK' as const,
        sichtbar: true,
        block: {
          id: 'b1',
          vorlage: 'HOEFE_AUSWAHL' as const,
          ueberzeile: null,
          titel: 'Brennholz jetzt',
          text: null,
          bildUrl: null,
          linkUrl: '/hoefe',
          linkText: null,
          farmIds: ['hof-offen', 'hof-gesperrt'],
          kategorie: null,
          liveAb: '2026-10-01T04:00:00.000Z',
          liveBis: null,
        },
      },
      ...STANDARD_REIHENFOLGE.slice(2).map((art) => ({ art, sichtbar: art !== 'FRAGEN', block: null })),
    ]
    const inhalt = fassungAusEntwurf(entwurf)
    expect(fassungInhaltSchema.safeParse(inhalt).success).toBe(true)
    expect(blockAn(inhalt, 2)).toEqual({ id: 'b1', vorlage: 'HOEFE_AUSWAHL', titel: 'Brennholz jetzt', linkUrl: '/hoefe', farmIds: ['hof-offen', 'hof-gesperrt'], liveAb: '2026-10-01T04:00:00.000Z' })

    // Nur der freigeschaltete Hof hat einen Slug — der gesperrte fällt beim Rendern weg.
    const zeilen = zeilenAusFassung(inhalt, new Map([['hof-offen', 'hof-offen-slug']]))
    const imBlock = zeilen[2]
    expect(imBlock.art === 'BLOCK' && imBlock.block.hofSlugs).toEqual(['hof-offen-slug'])
    const gerendert = zuRendern(zeilen, JETZT, { brennmaterialSaison: true }).map((e) => e.art)
    expect(gerendert).toEqual(['KOPF', 'HOEFE', 'BLOCK', 'FUTTER', 'BRENNMATERIAL', 'SO_FUNKTIONIERTS', 'FUER_HOEFE', 'FUSS'])
  })

  it('ohne Fassung die Standard-Reihenfolge: acht Abschnitte, alle sichtbar, keine Blöcke', () => {
    const zeilen = zeilenAusFassung(standardFassung(), new Map())
    expect(zeilen).toEqual(STANDARD_REIHENFOLGE.map((art) => ({ art, sichtbar: true })))
    expect(beschreibeFassung(standardFassung())).toBe('8 Abschnitte · keine Blöcke · Standard-Reihenfolge')
  })
})

describe('vergleicheMitLive', () => {
  it('findet bei gleichem Stand nichts', () => {
    expect(vergleicheMitLive(mitBlock(), mitBlock())).toEqual([])
    expect(vergleicheMitLive(standardFassung(), standardFassung())).toEqual([])
  })

  it('erkennt alle sechs Arten, in der Reihenfolge des Entwurfs — Entferntes zuletzt', () => {
    const live = mitBlock(block({ id: 'b-alt', vorlage: 'HINWEISBAND', titel: 'Winterpause', liveBis: undefined }))
    // Live: KOPF HOEFE [Winterpause] FUTTER BRENNMATERIAL SO_FUNKTIONIERTS FUER_HOEFE FRAGEN FUSS, BRENNMATERIAL aus.
    live.zeilen[4] = { art: 'BRENNMATERIAL', sichtbar: false }
    live.zeilen.splice(3, 0, { art: 'BLOCK', sichtbar: true, block: block({ id: 'b-geaendert', titel: 'Erntedank' }) })

    const entwurf = standardFassung()
    const art = (a: string) => entwurf.zeilen.findIndex((z) => z.art === a)
    entwurf.zeilen.splice(2, 0, { art: 'BLOCK', sichtbar: true, block: block() }) // neu
    entwurf.zeilen.splice(3, 0, { art: 'BLOCK', sichtbar: true, block: block({ id: 'b-geaendert', titel: 'Erntedank am Hof' }) }) // geändert
    entwurf.zeilen[art('FRAGEN')] = { art: 'FRAGEN', sichtbar: false } // ausgeblendet
    // BRENNMATERIAL ist im Entwurf sichtbar (eingeblendet); FUER_HOEFE vor SO_FUNKTIONIERTS (verschoben).
    const so = art('SO_FUNKTIONIERTS')
    ;[entwurf.zeilen[so], entwurf.zeilen[so + 1]] = [entwurf.zeilen[so + 1], entwurf.zeilen[so]]
    // Winterpause fehlt im Entwurf (entfernt).

    expect(vergleicheMitLive(live, entwurf).map((a) => [a.art, a.titel])).toEqual([
      ['neu', 'Kürbis, Äpfel und Most'],
      ['geaendert', 'Erntedank am Hof'],
      ['eingeblendet', 'Brennmaterial'],
      ['verschoben', 'Für Höfe'],
      ['ausgeblendet', 'Fragen'],
      ['entfernt', 'Winterpause'],
    ])
  })

  it('nennt die Änderungen wie das Mockup: Neu mit Ort und Zeitraum, Verschoben mit Nachbar, Ausgeblendet', () => {
    const entwurf = mitBlock()
    const so = entwurf.zeilen.findIndex((z) => z.art === 'SO_FUNKTIONIERTS')
    ;[entwurf.zeilen[so], entwurf.zeilen[so + 1]] = [entwurf.zeilen[so + 1], entwurf.zeilen[so]]
    entwurf.zeilen[entwurf.zeilen.findIndex((z) => z.art === 'FRAGEN')] = { art: 'FRAGEN', sichtbar: false }

    const aenderungen = vergleicheMitLive(standardFassung(), entwurf)
    expect(aenderungen.map(aenderungSatz)).toEqual([
      'Saisonkarte „Kürbis, Äpfel und Most“ nach „Höfe in deiner Nähe“ – sichtbar 18.–31. Okt',
      '„Für Höfe“ vor „So funktioniert’s“',
      '„Fragen“',
    ])
    expect(aenderungen.map(aenderungKurz).join(' · ')).toBe('Neu: Saisonkarte (18.–31. Okt) · „Für Höfe“ verschoben · „Fragen“ ausgeblendet')
  })

  it('erkennt einen geänderten Zeitraum als Änderung des Blocks', () => {
    const entwurf = mitBlock(block({ liveBis: '2026-11-07T22:59:00.000Z' }))
    expect(vergleicheMitLive(mitBlock(), entwurf).map((a) => a.art)).toEqual(['geaendert'])
  })
})

describe('Termin und Zeiträume', () => {
  it('lässt einen Termin bis eine Minute zurück und bis 365 Tage voraus zu', () => {
    const minute = 60_000
    const tag = 24 * 60 * minute
    expect(pruefeTermin(new Date(JETZT.getTime() - minute), JETZT)).toBeNull()
    expect(pruefeTermin(new Date(JETZT.getTime() - minute - 1), JETZT)).toBe('vergangen')
    expect(pruefeTermin(new Date(JETZT.getTime() + 365 * tag), JETZT)).toBeNull()
    expect(pruefeTermin(new Date(JETZT.getTime() + 365 * tag + 1), JETZT)).toBe('zu-weit')
  })

  it('schreibt Zeiträume kurz in Wiener Tagen', () => {
    expect(zeitraumKurz('2026-10-17T22:00:00.000Z', '2026-10-31T22:59:00.000Z')).toBe('18.–31. Okt')
    expect(zeitraumKurz('2026-10-28T08:00:00.000Z', '2026-11-03T08:00:00.000Z')).toBe('28. Okt – 3. Nov')
    expect(zeitraumKurz('2026-10-17T22:00:00.000Z', null)).toBe('ab 18. Okt')
  })

  it('sagt, wie weit ein Termin weg ist', () => {
    expect(abstandText(new Date(JETZT.getTime() + (36 * 60 + 5) * 60_000), JETZT)).toBe('in 1 Tag 12 Std')
    expect(abstandText(new Date(JETZT.getTime() + 75 * 60_000), JETZT)).toBe('in 1 Std 15 Min')
    expect(abstandText(new Date(JETZT.getTime() + 10 * 60_000), JETZT)).toBe('in 10 Min')
  })

  it('weist auf einen Block hin, der erst nach dem Termin beginnt oder vorher endet', () => {
    const termin = new Date('2026-10-17T07:00:00.000Z') // Sa, 17. Okt, 09:00 Wiener Zeit
    expect(blockHinweise(mitBlock(), termin)).toEqual([
      'Die Saisonkarte hat ihren eigenen Zeitraum (18.–31. Okt). Sie erscheint erst ab 18. Okt, auch wenn diese Fassung am 17. live geht.',
    ])
    const vorbei = mitBlock(block({ vorlage: 'HINWEISBAND', liveAb: '2026-10-01T04:00:00.000Z', liveBis: '2026-10-10T21:59:00.000Z' }))
    expect(blockHinweise(vorbei, termin)).toEqual([
      'Das Hinweisband hat seinen eigenen Zeitraum (1.–10. Okt). Es ist schon vorbei, wenn diese Fassung am 17. live geht.',
    ])
    expect(blockHinweise(mitBlock(block({ liveAb: '2026-10-01T04:00:00.000Z' })), termin)).toEqual([])
  })
})

describe('Systemgrenzen von Veröffentlichen und Übernehmen', () => {
  it('nimmt jetzt oder Tag und Uhrzeit, nichts dazwischen', () => {
    expect(veroeffentlichenSchema.safeParse({ wann: 'jetzt' }).success).toBe(true)
    expect(veroeffentlichenSchema.safeParse({ wann: 'termin', datum: '2026-10-17', uhrzeit: '09:00' }).success).toBe(true)
    expect(veroeffentlichenSchema.safeParse({ wann: 'termin', datum: '17.10.2026', uhrzeit: '09:00' }).success).toBe(false)
    expect(veroeffentlichenSchema.safeParse({ wann: 'termin', datum: '2026-10-17', uhrzeit: '24:00' }).success).toBe(false)
    expect(veroeffentlichenSchema.safeParse({ wann: 'jetzt', liveAb: '2020-01-01' }).success).toBe(false)
  })

  it('übernimmt eine Fassung oder ohne Fassung die Standard-Reihenfolge', () => {
    expect(entwurfUebernehmenSchema.safeParse({ id: 'f1' }).success).toBe(true)
    expect(entwurfUebernehmenSchema.safeParse({ id: null }).success).toBe(true)
    expect(entwurfUebernehmenSchema.safeParse({}).success).toBe(false)
  })
})

describe('Live und geplant', () => {
  const f = (id: string, liveAb: string, createdAt = '2026-10-01T10:00:00.000Z') => ({ id, liveAb, createdAt })

  it('ordnet in geplant, live und früher — die jüngste erreichte ist live', () => {
    const liste = [
      f('alt', '2026-10-01T10:00:00.000Z'),
      f('live', '2026-10-15T18:00:00.000Z'),
      f('morgen', '2026-10-17T07:00:00.000Z'),
      f('mitte', '2026-10-06T05:00:00.000Z'),
      f('weihnachten', '2026-12-19T23:00:00.000Z'),
    ]
    const { geplant, live, frueher } = ordneFassungen(liste, JETZT)
    expect(geplant.map((x) => x.id)).toEqual(['morgen', 'weihnachten'])
    expect(live?.id).toBe('live')
    expect(frueher.map((x) => [x.id, x.bis])).toEqual([
      ['mitte', '2026-10-15T18:00:00.000Z'],
      ['alt', '2026-10-06T05:00:00.000Z'],
    ])
  })

  it('nimmt bei gleicher Zeit die später angelegte; ohne erreichte Fassung ist nichts live', () => {
    const gleich = [f('zuerst', '2026-10-15T18:00:00.000Z', '2026-10-15T10:00:00.000Z'), f('danach', '2026-10-15T18:00:00.000Z', '2026-10-15T11:00:00.000Z')]
    expect(ordneFassungen(gleich, JETZT).live?.id).toBe('danach')
    expect(ordneFassungen([f('morgen', '2026-10-17T07:00:00.000Z')], JETZT)).toMatchObject({ live: null, frueher: [] })
  })

  it('liest am Cache vorbei genau ab dem Termin der nächsten Planung', () => {
    const termin = '2026-10-15T18:30:00.000Z'
    expect(mussFrischLesen(null, JETZT)).toBe(false)
    expect(mussFrischLesen(termin, new Date(JETZT.getTime() - 1))).toBe(false)
    expect(mussFrischLesen(termin, JETZT)).toBe(true)
  })
})

describe('Marken je Zeile', () => {
  it('zeigt neu mit Zeitraum grün, verschoben und ausgeblendet orange — eine Marke je Zeile', () => {
    const entwurf = mitBlock()
    const so = entwurf.zeilen.findIndex((z) => z.art === 'SO_FUNKTIONIERTS')
    ;[entwurf.zeilen[so], entwurf.zeilen[so + 1]] = [entwurf.zeilen[so + 1], entwurf.zeilen[so]]
    // „Fragen“ ausgeblendet UND nach oben verschoben: die Marke sagt „ausgeblendet“.
    const fragen = entwurf.zeilen.findIndex((z) => z.art === 'FRAGEN')
    entwurf.zeilen.splice(fragen, 1)
    entwurf.zeilen.splice(3, 0, { art: 'FRAGEN', sichtbar: false })

    const marken = zeilenMarken(vergleicheMitLive(standardFassung(), entwurf))
    expect(marken.get('block:b-kuerbis')).toEqual({ text: 'neu · 18.–31. Okt', ton: 'laeuft' })
    expect(marken.get('FRAGEN')).toEqual({ text: 'ausgeblendet', ton: 'tun' })
    expect(marken.get('FUER_HOEFE')).toEqual({ text: 'verschoben', ton: 'tun' })
    expect(marken.has('KOPF')).toBe(false)
  })
})

describe('Vorschau des Entwurfs (Nacharbeit 99, Register N16 Nr. 106)', () => {
  it('nennt im Band die Quelle und den Tag', () => {
    const tag = new Date('2026-10-16T10:00:00.000Z')
    expect(standText(tag)).toMatch(/^Fr, 16\.\sOkt 2026$/)
    expect(vorschauBandText('entwurf', tag)).toBe(`Vorschau · Entwurf · Stand am ${standText(tag)}`)
    expect(vorschauBandText('live', tag)).toBe(`Vorschau · Live · Stand am ${standText(tag)}`)
    expect(vorschauBandText('fassung:f-1', tag)).toBe(`Vorschau · Fassung · Stand am ${standText(tag)}`)
  })

  it('lässt den sichtbaren Rahmen stehen, bis der neue geladen ist — nie leer, höchstens zwei', () => {
    expect(vorschauRahmen(null, null)).toEqual({ rahmen: [], laedt: false })
    expect(vorschauRahmen(null, '/a')).toEqual({ rahmen: ['/a'], laedt: true })
    expect(vorschauRahmen('/a', '/a')).toEqual({ rahmen: ['/a'], laedt: false })
    expect(vorschauRahmen('/a', '/b')).toEqual({ rahmen: ['/a', '/b'], laedt: true })
    // Eine noch neuere Adresse ersetzt die ladende, nicht die sichtbare.
    expect(vorschauRahmen('/a', '/c')).toEqual({ rahmen: ['/a', '/c'], laedt: true })
    // Scheitert der Link, bleibt das alte Bild.
    expect(vorschauRahmen('/a', null)).toEqual({ rahmen: ['/a'], laedt: false })
  })
})

describe('Zusatz-Abschnitt „Neu bei den Höfen“ (Nr. 129, N16)', () => {
  /** Eine Fassung, wie sie vor diesem Lauf gespeichert wurde (JSON aus StartseiteFassung.inhalt): Block, ein Abschnitt aus, einer verschoben. */
  const GESPEICHERT_HEUTE = {
    v: 1,
    zeilen: [
      { art: 'KOPF', sichtbar: true },
      { art: 'BLOCK', sichtbar: true, block: { id: 'b-ostern', vorlage: 'HINWEISBAND', titel: 'Winterpause bis Februar', farmIds: [], liveAb: '2026-10-01T04:00:00.000Z' } },
      { art: 'HOEFE', sichtbar: true },
      { art: 'FUER_HOEFE', sichtbar: true },
      { art: 'FUTTER', sichtbar: true },
      { art: 'BRENNMATERIAL', sichtbar: false },
      { art: 'SO_FUNKTIONIERTS', sichtbar: true },
      { art: 'FRAGEN', sichtbar: true },
      { art: 'FUSS', sichtbar: true },
    ],
  }

  it('eine gespeicherte Fassung von heute bleibt gültig und rendert wie vorher', () => {
    const inhalt = fassungInhaltSchema.parse(JSON.parse(JSON.stringify(GESPEICHERT_HEUTE)))
    const gerendert = zuRendern(zeilenAusFassung(inhalt, new Map()), JETZT, { brennmaterialSaison: true })
    expect(gerendert.map((e) => (e.art === 'BLOCK' ? `BLOCK:${e.block.id}` : e.art))).toEqual([
      'KOPF',
      'BLOCK:b-ostern',
      'HOEFE',
      'FUER_HOEFE',
      'FUTTER',
      'SO_FUNKTIONIERTS',
      'FRAGEN',
      'FUSS',
    ])
  })

  it('der Entwurf aus den acht Zeilen der Migration bleibt gültig und rendert gleich — mit und ohne Block', () => {
    const ohne = STANDARD_REIHENFOLGE.map((art) => ({ art, sichtbar: true, block: null }))
    const blockZeile = {
      art: 'BLOCK' as const,
      sichtbar: true,
      block: {
        id: 'b-entwurf',
        vorlage: 'SAISONKARTE' as const,
        ueberzeile: null,
        titel: 'Kürbis, Äpfel und Most',
        text: null,
        bildUrl: null,
        linkUrl: null,
        linkText: null,
        farmIds: [],
        kategorie: null,
        liveAb: '2026-10-01T04:00:00.000Z',
        liveBis: null,
      },
    }
    const mit = [ohne[0], ohne[1], blockZeile, ...ohne.slice(2)]
    // Wie GESPEICHERT_HEUTE: gültig UND derselbe Weg bis zur Seite — Entwurf → Fassung → Zeilen → gerendert.
    const gerendert = (entwurf: typeof mit) => {
      const inhalt = fassungInhaltSchema.parse(JSON.parse(JSON.stringify(fassungAusEntwurf(entwurf))))
      return zuRendern(zeilenAusFassung(inhalt, new Map()), JETZT, { brennmaterialSaison: true }).map((e) => (e.art === 'BLOCK' ? `BLOCK:${e.block.id}` : e.art))
    }
    const standard = ['KOPF', 'HOEFE', 'FUTTER', 'BRENNMATERIAL', 'SO_FUNKTIONIERTS', 'FUER_HOEFE', 'FRAGEN', 'FUSS']
    expect(gerendert(ohne)).toEqual(standard)
    expect(gerendert(mit)).toEqual(['KOPF', 'HOEFE', 'BLOCK:b-entwurf', ...standard.slice(2)])
    expect(fassungInhaltSchema.safeParse(mitBlock()).success).toBe(true)
  })

  it('mit dem Zusatz nach den Höfen gültig und an seiner Stelle gerendert — ausgeblendet nicht', () => {
    const [kopf, hoefe, ...rest] = standardFassung().zeilen
    const mit: FassungInhalt = { v: 1, zeilen: [kopf, hoefe, { art: 'NEUIGKEITEN', sichtbar: true }, ...rest] }
    expect(fassungInhaltSchema.safeParse(mit).success).toBe(true)
    const arten = (f: FassungInhalt) => zuRendern(zeilenAusFassung(f, new Map()), JETZT, { brennmaterialSaison: false }).map((e) => e.art)
    expect(arten(mit)).toEqual(['KOPF', 'HOEFE', 'NEUIGKEITEN', 'FUTTER', 'SO_FUNKTIONIERTS', 'FUER_HOEFE', 'FRAGEN', 'FUSS'])
    const aus: FassungInhalt = { v: 1, zeilen: [kopf, hoefe, { art: 'NEUIGKEITEN', sichtbar: false }, ...rest] }
    expect(arten(aus)).toEqual(['KOPF', 'HOEFE', 'FUTTER', 'SO_FUNKTIONIERTS', 'FUER_HOEFE', 'FRAGEN', 'FUSS'])
  })

  it('der Zusatz doppelt oder vor den Höfen ist kein gültiger Inhalt — die Seite fiele auf den Standard zurück', () => {
    const [kopf, hoefe, ...rest] = standardFassung().zeilen
    const neu = { art: 'NEUIGKEITEN' as const, sichtbar: true }
    expect(fassungInhaltSchema.safeParse({ v: 1, zeilen: [kopf, hoefe, neu, neu, ...rest] }).success).toBe(false)
    expect(fassungInhaltSchema.safeParse({ v: 1, zeilen: [kopf, neu, hoefe, ...rest] }).success).toBe(false)
  })
})

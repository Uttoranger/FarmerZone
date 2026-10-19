/**
 * Tests für das Teilen-Bild (Gate 7 Aufgabe 1; S9).
 *
 * Beweist:
 *  - Ausverkaufte, ausgeblendete und gesperrte Produkte (Sperre je Gebinde,
 *    Nr. 20) kommen nie ins Bild — auch nicht, wenn das Teilen-Fenster sie
 *    ausdrücklich wählt; ein pausierter Hof zeigt keine Produkte.
 *  - Höchstens drei Einträge; eine Familie ist EIN Eintrag mit „ab €".
 *  - Hof- und Produktnamen sind Fremdtext: Steuer- und Richtungszeichen
 *    fallen weg, im gerenderten Bild bleibt ein `<script>` Text (escaped).
 *  - Die Prüfsumme ändert sich mit dem Inhalt (Zwischenspeicher, S9).
 *  - Der QR-Code ist ein reiner Pfad aus Rechtecken, gleich für gleiche Adresse.
 *  - Die Route liefert nur für öffentliche Höfe ein Bild (sonst 404) und
 *    fragt mit derselben Sichtbarkeits-Bedingung wie die Hofseite.
 *  - Beitrag-Modus (Register T6, Nr. 69): nur ein veröffentlichter, sichtbarer,
 *    nicht abgelaufener Beitrag DIESES Hofs, sonst 404; die verknüpften
 *    Produkte kommen ins Bild; die Prüfsumme nimmt Beitrag und Fotos auf.
 *  - Der QR-Code steht nur in der Story, nie im 1:1.
 *  - Abzeichen (Register K2, Nr. 116): Ein Gründungshof trägt das Etikett
 *    über dem Namen, in beiden Formaten und Varianten; der Lader gibt nur
 *    Ja/Nein weiter, nie die Nummer; die Prüfsumme ändert sich mit dem Schalter.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findFirst: vi.fn() },
    product: { findMany: vi.fn(async () => []) },
    statusPost: { findFirst: vi.fn(async () => null) },
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
// Fotos, Illustrationen und Schriften lädt der Lader (eigene Tests in
// tests/teilen-bild-quellen.test.ts); hier zählt, was die Route entscheidet.
vi.mock('@/lib/teilen-bild-quellen', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/teilen-bild-quellen')>()),
  ladeTeilenBildBilder: vi.fn(async () => ({ produkte: {}, held: null, ersatz: false })),
  ladeTeilenBildSchriften: vi.fn(async () => []),
}))
// Satori/resvg brauchen wir hier nicht: Die Aussage ist, was die Route mit dem Bild macht (Kopf, Fehler).
vi.mock('next/og', () => ({
  ImageResponse: vi.fn(function (this: unknown, _el: unknown, optionen: { headers?: Record<string, string> }) {
    // Ein echtes PNG (ein Bildpunkt): Die Route wandelt es in JPEG um (Register T7); Text als Körper wäre ein 503.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQI12P4/fMTAAXZAudwTgkGAAAAAElFTkSuQmCC', 'base64')
    return new Response(png, { headers: { 'content-type': 'image/png', ...optionen.headers } })
  }),
}))

import { prisma } from '@/lib/prisma'
import * as Sentry from '@sentry/nextjs'
import { ImageResponse } from 'next/og'
import { Decimal } from '@prisma/client/runtime/index-browser'
import {
  beitragDarfInsBild,
  beitragKurztext,
  bildProdukte,
  teilenAuswahl,
  teilenBildAuswahl,
  teilenBildDaten,
  teilenBildVersion,
  teilenTextVorschlag,
  teilenVorschauText,
  type TeilenBildHof,
  type TeilenBildProdukt,
} from '@/lib/teilen-bild'
import { teilenBildPfad } from '@/lib/teilen-kanal'
import { qrPfad } from '@/lib/qr-code'
import { teilenBildSucheSchema } from '@/schemas/teilen'
import { ladeTeilenBildBilder, type GeladeneBilder } from '@/lib/teilen-bild-quellen'
import { TEILEN_BILD_FARBE, TeilenBildGrafik } from '@/components/teilen/teilen-bild-grafik'
import { GET as bildRoute } from '@/app/(public)/[farmSlug]/opengraph-image/route'
import { ladeTeilenBildQuelle, ladeTeilenVorschau } from '@/server/queries/teilen-bild'
import { ABZEICHEN_TEXT } from '@/lib/gruendungshof'

const findFirst = vi.mocked(prisma.farm.findFirst)
const beitragLesen = vi.mocked(prisma.statusPost.findFirst)
const OHNE_BILDER: GeladeneBilder = { produkte: {}, held: null, ersatz: false }
/** Die Bildmarke, wie die Route sie hereinreicht (hier eine Attrappe statt der Datei). */
const MARKE_BILD = 'data:image/svg+xml;base64,TUFSS0U='

const HOF: TeilenBildHof = {
  name: 'Hof Test',
  slug: 'hof-test',
  city: 'Teststadt',
  isPaused: false,
  betriebsnummer: null,
  betriebsstatus: null,
}

function produkt(id: string, abweichend: Partial<TeilenBildProdukt> = {}): TeilenBildProdukt {
  return {
    id,
    name: `Produkt ${id}`,
    preisCents: 450,
    isAvailable: true,
    stock: 5,
    familieId: null,
    category: 'EIER',
    verpackung: null,
    ...abweichend,
  }
}

const JETZT = new Date('2026-10-07T08:00:00Z') // Mittwoch, 10 Uhr in Wien
/** Eine erfundene Beitragskennung in der Form einer cuid. */
const BEITRAG_ID = 'cm9beitrag0000000000000001'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('welche Produkte ins Bild dürfen', () => {
  it('ausverkauft, ausgeblendet und gesperrt nie — nur kaufbare', () => {
    const produkte = [
      produkt('ausverkauft', { stock: 0 }),
      produkt('aus', { isAvailable: false }),
      // Abgepacktes Heimtierfutter ohne BAES-Meldung: gesperrt (E10, Nr. 20).
      produkt('gesperrt', { category: 'HEU_STROH', verpackung: 'ABGEPACKT_ETIKETT' }),
      produkt('eier', { name: 'Freilandeier' }),
    ]
    expect(bildProdukte(produkte, HOF, null).map((e) => e.id)).toEqual(['eier'])
  })

  it('auch die ausdrückliche Auswahl holt kein ausverkauftes oder gesperrtes Produkt herein', () => {
    const produkte = [
      produkt('ausverkauft', { stock: 0 }),
      produkt('gesperrt', { category: 'HEU_STROH', verpackung: 'ABGEPACKT_ETIKETT' }),
      produkt('brot'),
    ]
    expect(bildProdukte(produkte, HOF, ['ausverkauft', 'gesperrt', 'brot']).map((e) => e.id)).toEqual(['brot'])
  })

  it('Gegenprobe: mit BAES-Meldung ist das Heimtierfutter nicht gesperrt', () => {
    const gemeldet = { ...HOF, betriebsnummer: 'AT 123', betriebsstatus: 'REGISTRIERT' as const }
    const futter = produkt('futter', { category: 'HEU_STROH', verpackung: 'ABGEPACKT_ETIKETT' })
    expect(bildProdukte([futter], gemeldet, null).map((e) => e.id)).toEqual(['futter'])
  })

  it('höchstens drei, in der Reihenfolge des Hofs', () => {
    const produkte = ['a', 'b', 'c', 'd', 'e'].map((id) => produkt(id))
    expect(bildProdukte(produkte, HOF, null).map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('eine Familie ist ein Eintrag: gemeinsamer Name, „ab" kleinster Preis', () => {
    const produkte = [
      produkt('heu-1', { name: 'Bergwiesen-Heu 1 kg-Sackerl', familieId: 'heu', preisCents: 250 }),
      produkt('heu-2', { name: 'Bergwiesen-Heu Rundballen', familieId: 'heu', preisCents: 4500 }),
      produkt('heu-3', { name: 'Bergwiesen-Heu Kleinballen', familieId: 'heu', preisCents: 900, stock: 0 }),
      produkt('eier', { name: 'Freilandeier' }),
    ]
    expect(bildProdukte(produkte, HOF, null)).toEqual([
      { id: 'heu-1', name: 'Bergwiesen-Heu', preis: 'ab € 2,50' },
      { id: 'eier', name: 'Freilandeier', preis: '€ 4,50' },
    ])
  })

  it('pausierter Hof: keine Produkte und keine Abholung', () => {
    const daten = teilenBildDaten({
      hof: { ...HOF, isPaused: true },
      produkte: [produkt('eier')],
      slots: [{ dayOfWeek: 3, startTime: '15:00', endTime: '18:00' }],
      auswahl: null,
      adresse: 'agrilo.at/hof-test',
      jetzt: JETZT,
    })
    expect(daten.produkte).toEqual([])
    expect(daten.abholung).toBeNull()
  })

  it('Auswahl im Teilen-Fenster: ausverkauft steht da, ist aber aus; gesperrt fehlt ganz', () => {
    const auswahl = teilenAuswahl(
      [
        produkt('eier', { name: 'Freilandeier' }),
        produkt('honig', { name: 'Blütenhonig', stock: 0 }),
        produkt('gesperrt', { category: 'HEU_STROH', verpackung: 'ABGEPACKT_ETIKETT' }),
        produkt('aus', { isAvailable: false }),
      ],
      HOF
    )
    expect(auswahl.map((e) => [e.id, e.ausverkauft])).toEqual([
      ['eier', false],
      ['honig', true],
    ])
  })
})

describe('Fremdtext im Bild', () => {
  const boese = '<script>alert(1)</script>‮ Hof​'

  it('Steuer- und Richtungszeichen fallen weg, der Rest bleibt Text', () => {
    const daten = teilenBildDaten({
      hof: { ...HOF, name: boese },
      produkte: [produkt('x', { name: '"><img src=x onerror=alert(1)>' })],
      slots: [],
      auswahl: null,
      adresse: 'agrilo.at/hof-test',
      jetzt: JETZT,
    })
    expect(daten.hofName).toBe('<script>alert(1)</script> Hof')
    expect(daten.hofName).not.toMatch(/[‮​]/)
  })

  it('gerendert ist der Name escaped — kein Element, nur Buchstaben', () => {
    const daten = teilenBildDaten({
      hof: { ...HOF, name: boese },
      produkte: [produkt('x', { name: '"><img src=x onerror=alert(1)>' })],
      slots: [],
      auswahl: null,
      adresse: 'agrilo.at/hof-test',
      jetzt: JETZT,
    })
    const html = renderToStaticMarkup(createElement(TeilenBildGrafik, { daten, format: 'quadrat', qr: qrPfad('https://x.at/hof-test?k=qr'), bilder: OHNE_BILDER, marke: MARKE_BILD }))
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script')
    // Das einzige Bild ist die Bildmarke — der eingeschleuste <img> ist nur Text.
    expect(html.match(/<img\b/g)).toHaveLength(1)
    expect(html).toContain(`src="${MARKE_BILD}"`)
    expect(html).toContain('&quot;&gt;&lt;img')
  })

  it('lange Namen: höchstens zwei Zeilen im Bild (lineClamp), nie über den Rand', () => {
    const daten = teilenBildDaten({
      hof: { ...HOF, name: 'H'.repeat(80) },
      produkte: [],
      slots: [],
      auswahl: null,
      adresse: 'agrilo.at/hof-test',
      jetzt: JETZT,
    })
    const html = renderToStaticMarkup(createElement(TeilenBildGrafik, { daten, format: 'story', qr: qrPfad('https://x.at'), bilder: OHNE_BILDER, marke: MARKE_BILD }))
    expect(html).toContain('line-clamp:2')
    expect(html).toContain('Direkt vom Hof')
  })
})

describe('Daten, Text und Prüfsumme', () => {
  it('nächste Abholung als Satz, Ort und Adresse', () => {
    const daten = teilenBildDaten({
      hof: HOF,
      produkte: [produkt('eier', { name: 'Freilandeier' })],
      slots: [{ dayOfWeek: 6, startTime: '09:00', endTime: '12:00' }],
      auswahl: null,
      adresse: 'agrilo.at/hof-test',
      jetzt: JETZT,
    })
    expect(daten).toMatchObject({ hofName: 'Hof Test', ort: 'Teststadt', abholung: 'Abholung Samstag, 9–12 Uhr' })
    // Im Abhol-Streifen mit Datum: Ein geteiltes Bild wird Tage später noch gesehen.
    expect(daten.abholTermin).toBe('Sa, 10.\u00a0Okt · 9–12 Uhr')
    expect(daten).not.toHaveProperty('beitrag')
  })

  it('die Prüfsumme ändert sich, wenn ein Produkt ausverkauft ist', () => {
    const eingabe = {
      hof: HOF,
      produkte: [produkt('a'), produkt('b')],
      slots: [],
      auswahl: null,
      adresse: 'agrilo.at/hof-test',
      jetzt: JETZT,
    }
    const vorher = teilenBildVersion(teilenBildDaten(eingabe))
    const nachher = teilenBildVersion(teilenBildDaten({ ...eingabe, produkte: [produkt('a'), produkt('b', { stock: 0 })] }))
    expect(vorher).not.toBe(nachher)
    expect(teilenBildVersion(teilenBildDaten(eingabe))).toBe(vorher)
  })

  it('Vorschlag für den Teilen-Text und die Vorschau im Chat', () => {
    expect(teilenTextVorschlag(['Eier', 'Erdäpfel', 'Heu'], 'Abholung Samstag, 9–12 Uhr')).toBe(
      'Frisch bei uns diese Woche: Eier, Erdäpfel und Heu. Online bestellen, Abholung Samstag, 9–12 Uhr.'
    )
    expect(teilenTextVorschlag([], null)).toBe('Frisch bei uns diese Woche. Jetzt online bestellen.')
    const daten = {
      hofName: 'Hof Test',
      ort: 'Teststadt',
      produkte: [{ id: 'a', name: 'Eier', preis: '€ 1' }],
      abholung: 'Abholung Samstag, 9–12 Uhr',
      abholTermin: 'Sa, 10.\u00a0Okt · 9–12 Uhr',
      adresse: 'x',
    }
    expect(teilenVorschauText('Hof Test', 'Über uns', daten)).toEqual({
      title: 'Hof Test – frisch vom Hof in Teststadt',
      description: 'Eier · Abholung Samstag, 9–12 Uhr',
    })
    expect(teilenVorschauText('Hof Test', 'Über uns', null)).toEqual({ title: 'Hof Test', description: 'Über uns' })
  })

  it('Bildadresse und Suchparameter', () => {
    expect(teilenBildPfad('hof-test')).toBe('/hof-test/opengraph-image')
    expect(teilenBildPfad('hof-test', { format: 'story', auswahl: ['a', 'b'], version: 'v1' })).toBe(
      '/hof-test/opengraph-image?format=story&p=a%2Cb&v=v1'
    )
    expect(teilenBildSucheSchema.parse({ format: 'riesig', p: 'a,b,<x>' })).toEqual({ format: 'quadrat', p: ['a', 'b'] })
    expect(teilenBildSucheSchema.parse({})).toEqual({ format: 'quadrat', p: undefined })
    expect(teilenBildPfad('hof-test', { format: 'story', beitrag: BEITRAG_ID })).toBe(`/hof-test/opengraph-image?format=story&b=${BEITRAG_ID}`)
  })

  it('b nur in der Form einer cuid — eine andere Form lässt die Prüfung scheitern statt still wegzufallen', () => {
    expect(teilenBildSucheSchema.parse({ b: BEITRAG_ID }).b).toBe(BEITRAG_ID)
    expect(teilenBildSucheSchema.safeParse({ b: 'x y' }).success).toBe(false)
    expect(teilenBildSucheSchema.safeParse({ b: '../anderer' }).success).toBe(false)
    expect(teilenBildSucheSchema.parse({ format: 'story' }).b).toBeUndefined()
  })
})

describe('QR-Code', () => {
  it('ein Pfad aus Rechtecken, gleich für gleiche Adresse', () => {
    const a = qrPfad('https://agrilo.at/hof-test?k=qr')
    expect(a.groesse).toBeGreaterThanOrEqual(21)
    expect(a.pfad).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/)
    expect(qrPfad('https://agrilo.at/hof-test?k=qr')).toEqual(a)
    expect(qrPfad('https://agrilo.at/anderer-hof?k=qr').pfad).not.toBe(a.pfad)
  })
})

describe('GET /[farmSlug]/opengraph-image', () => {
  const aufruf = (slug: string, suche = '') =>
    bildRoute(new NextRequest(`http://localhost/${slug}/opengraph-image${suche}`), { params: Promise.resolve({ farmSlug: slug }) })

  it('kein öffentlicher Hof: 404, gefragt mit der Sichtbarkeits-Bedingung der Hofseite', async () => {
    findFirst.mockResolvedValue(null)
    const res = await aufruf('hof-test')
    expect(res.status).toBe(404)
    expect(findFirst.mock.calls[0][0]?.where).toMatchObject({ slug: 'hof-test', isActive: true, archivedAt: null, approvedAt: { not: null } })
  })

  it('ungültiger Slug: 404 ohne Datenbank und ohne Zwischenspeicher', async () => {
    const res = await aufruf('Hof%20Test')
    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(findFirst).not.toHaveBeenCalled()
  })
})

describe('GET /[farmSlug]/opengraph-image — Zwischenspeicher, Bremse, Fehler (Nachbesserung Runde 1)', () => {
  const ROH = {
    id: 'farm-1',
    name: 'Hof Test',
    slug: 'hof-test',
    city: 'Teststadt',
    isPaused: false,
    betriebsnummer: null,
    betriebsstatus: null,
    products: [
      { id: 'eier', name: 'Freilandeier', price: new Decimal('4.50'), isAvailable: true, stock: 3, familieId: null, category: 'EIER', verpackung: null },
    ],
    // Ohne Abholfenster hängt der Inhalt nicht an der Uhr.
    pickupSlots: [],
  }
  // Die Prüfsumme der Metadaten der Hofseite (ladeTeilenVorschau), nie eine im Test nachgebaute Rechnung (Regelvorschlag 67).
  const aktuelleVersion = async () => (await ladeTeilenVorschau('hof-test', JETZT))?.version
  const aufruf = (suche = '', kopf: Record<string, string> = {}) =>
    bildRoute(new NextRequest(`http://localhost/hof-test/opengraph-image${suche}`, { headers: kopf }), {
      params: Promise.resolve({ farmSlug: 'hof-test' }),
    })

  beforeEach(() => {
    findFirst.mockResolvedValue(ROH as never)
  })

  it('lang zwischengespeichert nur mit der Prüfsumme des aktuellen Inhalts', async () => {
    const passend = await aufruf(`?v=${await aktuelleVersion()}`)
    expect(passend.status).toBe(200)
    expect(passend.headers.get('cache-control')).toContain('s-maxage=86400')
  })

  it('ein beliebiges v bekommt nur den kurzen Zwischenspeicher (Gegenprobe)', async () => {
    const fremd = await aufruf('?v=erfunden123')
    expect(fremd.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=60')
    const ohne = await aufruf()
    expect(ohne.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=60')
  })

  it('p nur mit erlaubten Werten: höchstens drei Kennungen im Schema', () => {
    expect(teilenBildSucheSchema.parse({ p: 'a,b,c,d,e' }).p).toEqual(['a', 'b', 'c'])
  })

  it('scheitert das Bild, kommt 503 ohne Zwischenspeicher, Sentry nur mit Hof-Kennung', async () => {
    vi.mocked(ImageResponse).mockImplementationOnce(function () {
      throw new Error('Satori kaputt')
    })
    const res = await aufruf()
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const [, kontext] = vi.mocked(Sentry.captureException).mock.calls[0]
    expect(kontext).toEqual({ tags: { bereich: 'teilen-bild', farmId: 'farm-1', slug: 'hof-test' } })
  })

  it('scheitert das Zeichnen erst beim Lesen des Bilds, kommt trotzdem 503 statt 200 mit kaputtem Body (Runde 2)', async () => {
    // So verhält sich next/og wirklich: Der Konstruktor baut nur einen Stream,
    // Satori/resvg laufen beim Lesen.
    vi.mocked(ImageResponse).mockImplementationOnce(function () {
      const kaputt = new ReadableStream({
        start(controller) {
          controller.error(new Error('Satori kaputt beim Zeichnen'))
        },
      })
      return new Response(kaputt, { headers: { 'content-type': 'image/png' } })
    })
    const res = await aufruf(`?v=${await aktuelleVersion()}`)
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalled()
  })

  describe('Auswahl p gegen die volle Auswahl des Teilen-Fensters (Runde 2)', () => {
    const roh = (id: string, name: string, stock = 3) => ({
      id,
      name,
      price: new Decimal('2.00'),
      isAvailable: true,
      stock,
      familieId: null,
      category: 'GEMUESE',
      verpackung: null,
    })
    const VIELE = {
      ...ROH,
      products: [roh('a', 'Karotten'), roh('b', 'Erdäpfel'), roh('c', 'Zwiebeln'), roh('d', 'Kürbis'), roh('leer', 'Lauch', 0)],
    }
    const imBild = () => {
      const element = vi.mocked(ImageResponse).mock.calls.at(-1)?.[0] as { props: { daten: { produkte: { id: string }[] } } }
      return element.props.daten.produkte.map((e) => e.id)
    }

    beforeEach(() => {
      findFirst.mockResolvedValue(VIELE as never)
    })

    it('das vierte Produkt lässt sich wählen und steht im Bild', async () => {
      const res = await aufruf('?p=d')
      expect(res.status).toBe(200)
      expect(imBild()).toEqual(['d'])
    })

    it('ausverkauft gewählt: fällt weg, es gilt die Standardauswahl', async () => {
      await aufruf('?p=leer')
      expect(imBild()).not.toContain('leer')
      expect(imBild()).toHaveLength(3)
    })

    it('fremde Kennung: fällt weg, es gilt die Standardauswahl', async () => {
      await aufruf('?p=fremd-1')
      expect(imBild()).not.toContain('fremd-1')
      expect(imBild()).toHaveLength(3)
    })

    it('gemischt: nur die erlaubten Kennungen bleiben', async () => {
      await aufruf('?p=leer,d,fremd-1')
      expect(imBild()).toEqual(['d'])
    })
  })

  it('gebremst wie jede öffentliche Route (in Produktion)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      const kopf = { 'x-forwarded-for': '198.51.100.21' }
      const antworten = []
      for (let i = 0; i < 21; i++) antworten.push((await aufruf('', kopf)).status)
      expect(antworten.at(-1)).toBe(429)
      expect(antworten.slice(0, 20).every((s) => s === 200)).toBe(true)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('Farben des Teilen-Bilds kommen aus den Tokens (Satori-Ausnahme, eine Stelle)', () => {
  const doku = readFileSync(join(process.cwd(), 'docs/ai/DESIGN_SYSTEM.md'), 'utf8')
  const token = (name: string, spalte: 'dunkel' | 'hell'): string => {
    const zeile = new RegExp(`^\\|\\s*--${name}[^|]*\\|\\s*(#[0-9A-Fa-f]{6})\\s*\\|\\s*(#[0-9A-Fa-f]{6})`, 'm').exec(doku)
    if (!zeile) throw new Error(`Token --${name} fehlt in der Tabelle`)
    return (spalte === 'dunkel' ? zeile[1] : zeile[2]).toLowerCase()
  }

  it('Grund, Schrift, Grün und Linien sind genau die Token-Werte (helles Theme wie das Mockup)', () => {
    expect(TEILEN_BILD_FARBE.grund).toBe(token('surface', 'hell'))
    expect(TEILEN_BILD_FARBE.tinte).toBe(token('text', 'hell'))
    expect(TEILEN_BILD_FARBE.leise).toBe(token('text-muted', 'hell'))
    expect(TEILEN_BILD_FARBE.gruen).toBe(token('accent', 'hell'))
    expect(TEILEN_BILD_FARBE.aufGruen).toBe(token('on-accent', 'hell'))
    expect(TEILEN_BILD_FARBE.linie).toBe(token('border', 'hell'))
    expect(TEILEN_BILD_FARBE.fotoLeise).toBe(token('status-fertig', 'dunkel'))
  })

  it('die abgeleiteten Werte bauen auf den Tokens auf (Deckkraft über --accent, --surface und --bg)', () => {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',')
    expect(TEILEN_BILD_FARBE.markeKreis).toContain(`rgba(${rgb(token('accent', 'hell'))},`)
    for (const wert of [TEILEN_BILD_FARBE.cremeAufFoto, TEILEN_BILD_FARBE.linieFoto]) {
      expect(wert).toContain(`rgba(${rgb(token('surface', 'hell'))},`)
    }
    for (const verlauf of [TEILEN_BILD_FARBE.schleier, TEILEN_BILD_FARBE.schleierStory, TEILEN_BILD_FARBE.titelSchatten]) {
      expect(verlauf.match(/rgba\(([\d,]+),[\d.]+\)/g)?.every((w) => w.startsWith(`rgba(${rgb(token('bg', 'dunkel'))},`))).toBe(true)
    }
    // Der Abhol-Streifen liegt zwischen --bg (hell) und --border (hell), eine Stufe unter dem Grund.
    const [bg, rand, streifen] = [token('bg', 'hell'), token('border', 'hell'), TEILEN_BILD_FARBE.streifen].map((h) => rgb(h).split(',').map(Number))
    expect(streifen.every((kanal, i) => kanal <= bg[i] && kanal >= rand[i])).toBe(true)
  })

  it('Farbwerte gibt es im Teilen-Bild nur im Objekt TEILEN_BILD_FARBE', () => {
    const text = readFileSync(join(process.cwd(), 'src/components/teilen/teilen-bild-grafik.tsx'), 'utf8')
    const ausserhalb = text.slice(text.indexOf('} as const'))
    expect(ausserhalb).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })
})

describe('Beitrag im Bild (Register T6, Nr. 69)', () => {
  const GUELTIG = {
    farmId: 'farm-1',
    publishedAt: new Date('2026-10-06T08:00:00Z'),
    expiresAt: new Date('2026-10-14T08:00:00Z'),
    showOnFarmPage: true,
  }

  it('nur veröffentlicht, auf der Hofseite, nicht abgelaufen und vom selben Hof', () => {
    expect(beitragDarfInsBild(GUELTIG, 'farm-1', JETZT)).toBe(true)
    expect(beitragDarfInsBild({ ...GUELTIG, expiresAt: null }, 'farm-1', JETZT)).toBe(true)
    expect(beitragDarfInsBild(GUELTIG, 'farm-2', JETZT)).toBe(false)
    expect(beitragDarfInsBild({ ...GUELTIG, publishedAt: null }, 'farm-1', JETZT)).toBe(false)
    expect(beitragDarfInsBild({ ...GUELTIG, showOnFarmPage: false }, 'farm-1', JETZT)).toBe(false)
  })

  it('Grenzen: veröffentlicht genau jetzt zählt, eine Millisekunde später nicht; abgelaufen genau jetzt zählt nicht', () => {
    const ms = (d: Date, n: number) => new Date(d.getTime() + n)
    expect(beitragDarfInsBild({ ...GUELTIG, publishedAt: JETZT }, 'farm-1', JETZT)).toBe(true)
    expect(beitragDarfInsBild({ ...GUELTIG, publishedAt: ms(JETZT, 1) }, 'farm-1', JETZT)).toBe(false)
    expect(beitragDarfInsBild({ ...GUELTIG, expiresAt: JETZT }, 'farm-1', JETZT)).toBe(false)
    expect(beitragDarfInsBild({ ...GUELTIG, expiresAt: ms(JETZT, 1) }, 'farm-1', JETZT)).toBe(true)
  })

  it('Text: höchstens zwei Sätze, ohne {Vorname} und Steuerzeichen, gekürzt', () => {
    expect(beitragKurztext('Hallo {Vorname}, frischer Honig ist da! Aus eigener Imkerei.\n\nBis bald.')).toBe(
      'Hallo, frischer Honig ist da! Aus eigener Imkerei.'
    )
    expect(beitragKurztext('‮Ein Satz ohne Ende')).toBe('Ein Satz ohne Ende')
    expect(beitragKurztext('A'.repeat(400)).length).toBeLessThanOrEqual(160)
  })

  it('Anlass als Wort, Titel und Text gereinigt in den Daten; ohne Beitrag fehlt das Feld', () => {
    const eingabe = { hof: HOF, produkte: [produkt('eier')], slots: [], auswahl: null, adresse: 'agrilo.at/hof-test', jetzt: JETZT }
    const daten = teilenBildDaten({ ...eingabe, beitrag: { anlass: 'NEW_SEASON', title: '<b>Spargel</b>​ ist da', body: 'Ab heute. Täglich frisch. Bis Juni.' } })
    expect(daten.beitrag).toEqual({ anlass: 'Neue Saison', titel: '<b>Spargel</b> ist da', text: 'Ab heute. Täglich frisch.' })
    expect(teilenBildDaten({ ...eingabe, beitrag: null })).not.toHaveProperty('beitrag')
  })

  it('Auswahl: verknüpfte Produkte, soweit kaufbar (eine Familie über jede ihrer Größen), sonst p, sonst Standard', () => {
    const produkte = [
      produkt('eier'),
      produkt('honig', { stock: 0 }),
      produkt('heu-1', { familieId: 'heu', name: 'Heu Sackerl' }),
      produkt('heu-2', { familieId: 'heu', name: 'Heu Ballen' }),
    ]
    expect(teilenBildAuswahl(produkte, HOF, [['heu-2'], ['eier']])).toEqual(['heu-2'])
    expect(bildProdukte(produkte, HOF, ['heu-2']).map((e) => e.id)).toEqual(['heu-1'])
    expect(teilenBildAuswahl(produkte, HOF, [['honig'], ['eier']])).toEqual(['eier'])
    expect(teilenBildAuswahl(produkte, HOF, [['honig'], undefined])).toBeNull()
    expect(teilenBildAuswahl(produkte, HOF, [[], null])).toBeNull()
  })

  it('die Prüfsumme nimmt Beitrag und Fotos auf; ohne beides bleibt sie die der Metadaten der Hofseite', () => {
    const eingabe = { hof: HOF, produkte: [produkt('eier')], slots: [], auswahl: null, adresse: 'agrilo.at/hof-test', jetzt: JETZT }
    const ohne = teilenBildVersion(teilenBildDaten(eingabe))
    expect(teilenBildVersion(teilenBildDaten({ ...eingabe, beitrag: null }), [])).toBe(ohne)
    const mit = teilenBildVersion(teilenBildDaten({ ...eingabe, beitrag: { anlass: 'PROMOTION', title: 'Aktion', body: 'Text.' } }))
    expect(mit).not.toBe(ohne)
    expect(teilenBildVersion(teilenBildDaten({ ...eingabe, beitrag: { anlass: 'PROMOTION', title: 'Aktion!', body: 'Text.' } }))).not.toBe(mit)
    expect(teilenBildVersion(teilenBildDaten(eingabe), ['https://speicher.public.blob.vercel-storage.com/farms/farm-1/product/1.webp'])).not.toBe(ohne)
  })
})

describe('Grafik: QR nur in der Story, Foto-Held mit Foto (Register T6)', () => {
  const daten = teilenBildDaten({
    hof: HOF,
    produkte: [produkt('eier', { name: 'Freilandeier' })],
    slots: [{ dayOfWeek: 6, startTime: '09:00', endTime: '12:00' }],
    auswahl: null,
    adresse: 'agrilo.at/hof-test',
    jetzt: JETZT,
  })
  const qr = qrPfad('https://agrilo.at/hof-test?k=qr')
  const MIT_FOTO: GeladeneBilder = { produkte: { eier: 'data:image/jpeg;base64,RUND' }, held: 'data:image/jpeg;base64,HELD', ersatz: false }
  const zeichne = (format: 'quadrat' | 'story', bilder: GeladeneBilder) =>
    renderToStaticMarkup(createElement(TeilenBildGrafik, { daten, format, qr, bilder, marke: MARKE_BILD }))

  it('im 1:1 nie ein QR-Code, in der Story immer (mit und ohne Foto)', () => {
    for (const bilder of [OHNE_BILDER, MIT_FOTO]) {
      const quadrat = zeichne('quadrat', bilder)
      expect(quadrat).not.toContain(qr.pfad)
      expect(quadrat).not.toContain('Code scannen')
      // Gegenprobe: Dieselbe Grafik zeichnet beide Merkmale in der Story.
      const story = zeichne('story', bilder)
      expect(story).toContain(qr.pfad)
      expect(story).toContain('Code scannen oder agrilo.at/hof-test')
    }
  })

  it('die Bildmarke ist ein Bild aus der Quelle, kein gezeichnetes Blatt: 50 px im 1:1, 59 px in der Story, 22 % gerundet — in A und B', () => {
    for (const bilder of [OHNE_BILDER, MIT_FOTO]) {
      const bild = (html: string) => html.match(new RegExp(`<img src="${MARKE_BILD.replace('+', '\\+')}"[^>]*>`))?.[0] ?? ''
      const quadrat = bild(zeichne('quadrat', bilder))
      expect(quadrat).toContain('width="50" height="50"')
      expect(quadrat).toContain('border-radius:11px')
      const story = bild(zeichne('story', bilder))
      expect(story).toContain('width="59" height="59"')
      expect(story).toContain('border-radius:13px')
      expect(zeichne('quadrat', bilder)).not.toContain('<path d="M8 1C3 5')
    }
  })

  it('mit Foto Variante B (Foto als Grund, rundes Produktbild), ohne Foto Variante A mit Abhol-Streifen', () => {
    const b = zeichne('quadrat', MIT_FOTO)
    expect(b).toContain('data:image/jpeg;base64,HELD')
    expect(b).toContain('data:image/jpeg;base64,RUND')
    expect(b).toContain('Abholung Sa, 10. Okt · 9–12 Uhr')
    const a = zeichne('quadrat', OHNE_BILDER)
    expect(a).not.toContain('data:image/jpeg;base64,HELD')
    expect(a).toContain('Abholung am Hof')
    expect(a).toContain('Sa, 10. Okt · 9–12 Uhr')
  })
})

describe('GET /[farmSlug]/opengraph-image — Beitrag-Modus (Register T6)', () => {
  const roh = (id: string, name: string, stock = 3) => ({
    id,
    name,
    price: new Decimal('3.00'),
    isAvailable: true,
    stock,
    familieId: null,
    category: 'EIER',
    verpackung: null,
  })
  const HOF_ROH = {
    id: 'farm-1',
    name: 'Hof Test',
    slug: 'hof-test',
    city: 'Teststadt',
    isPaused: false,
    betriebsnummer: null,
    betriebsstatus: null,
    products: [roh('eier', 'Freilandeier'), roh('honig', 'Blütenhonig'), roh('brot', 'Brot'), roh('heu', 'Heu')],
    pickupSlots: [],
  }
  const beitrag = (abweichend: Record<string, unknown> = {}) => ({
    farmId: 'farm-1',
    anlass: 'FRESH_PRODUCT',
    title: 'Frischer Honig ab Freitag',
    body: 'Aus eigener Imkerei. Die Menge ist begrenzt. Bis bald!',
    photoUrl: null,
    linkedProductIds: ['honig'],
    publishedAt: new Date('2026-10-06T08:00:00Z'),
    expiresAt: null,
    showOnFarmPage: true,
    ...abweichend,
  })
  const aufruf = (suche: string) =>
    bildRoute(new NextRequest(`http://localhost/hof-test/opengraph-image${suche}`), { params: Promise.resolve({ farmSlug: 'hof-test' }) })
  const imBild = () =>
    (vi.mocked(ImageResponse).mock.calls.at(-1)?.[0] as { props: { daten: { produkte: { id: string }[]; beitrag?: unknown } } }).props.daten

  beforeEach(() => {
    // Die Route nimmt ihre eigene Uhr: Nur Date steht still, Zeitgeber laufen echt.
    vi.useFakeTimers({ toFake: ['Date'], now: JETZT })
    findFirst.mockResolvedValue(HOF_ROH as never)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['es den Beitrag nicht gibt', null],
    ['er zu einem anderen Hof gehört', beitrag({ farmId: 'farm-2' })],
    ['er ein Entwurf ist', beitrag({ publishedAt: null })],
    ['er abgelaufen ist', beitrag({ expiresAt: new Date(JETZT.getTime() - 1) })],
    ['er nicht auf der Hofseite steht', beitrag({ showOnFarmPage: false })],
  ])('404, wenn %s — nie das Bild ohne Beitrag unter seiner Adresse', async (_fall, gelesen) => {
    beitragLesen.mockResolvedValueOnce(gelesen as never)
    const res = await aufruf(`?b=${BEITRAG_ID}`)
    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(ImageResponse).not.toHaveBeenCalled()
  })

  it('eine Kennung, die keine cuid sein kann: 404 ohne Datenbank', async () => {
    const res = await aufruf('?b=..%2Fx%20y')
    expect(res.status).toBe(404)
    expect(findFirst).not.toHaveBeenCalled()
  })

  it('gültiger Beitrag: Anlass, Titel, zwei Sätze und die verknüpften Produkte im Bild', async () => {
    beitragLesen.mockResolvedValueOnce(beitrag() as never)
    const res = await aufruf(`?b=${BEITRAG_ID}&format=story`)
    expect(res.status).toBe(200)
    // Besitz in der Abfrage (Nr. 75): nur zusammen mit dem Hof; beitragDarfInsBild prüft dazu.
    expect(beitragLesen.mock.calls[0][0]?.where).toEqual({ id: BEITRAG_ID, farmId: 'farm-1' })
    expect(imBild().beitrag).toEqual({ anlass: 'Frisches Produkt', titel: 'Frischer Honig ab Freitag', text: 'Aus eigener Imkerei. Die Menge ist begrenzt.' })
    expect(imBild().produkte.map((e) => e.id)).toEqual(['honig'])
  })

  // Nachbesserung Runde 1 (Nr. 67): Das Fenster zeigt die Auswahl „Im Bild" und belegt sie mit den
  // verknüpften Produkten vor — das geteilte Bild muss ihr folgen, sonst teilt der Hof abgewählte Produkte.
  it.each([
    ['p schlägt die verknüpften Produkte (Auswahl im Fenster)', '&p=eier,brot', ['honig'], ['eier', 'brot']],
    ['ohne p die verknüpften Produkte (geteilte Bildadresse)', '', ['honig'], ['honig']],
    ['ohne p und ohne kaufbares verknüpftes Produkt der Standard', '', ['gibt-es-nicht'], ['eier', 'honig', 'brot']],
  ])('Beitrag-Modus: %s', async (_fall, p, verknuepft, erwartet) => {
    beitragLesen.mockResolvedValueOnce(beitrag({ linkedProductIds: verknuepft }) as never)
    const res = await aufruf(`?b=${BEITRAG_ID}${p}`)
    expect(res.status).toBe(200)
    expect(imBild().produkte.map((e) => e.id)).toEqual(erwartet)
  })

  it('Fotos nur aus dem eigenen Speicher und dem Pfad dieses Hofs; sonst Illustration und kein Foto-Held', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_testspeicher_geheim')
    try {
      // Die Fotos kommen mit dem Hof aus EINER Abfrage (ladeTeilenBildQuelle, Nr. 75).
      findFirst.mockResolvedValueOnce({
        ...HOF_ROH,
        products: [
          { ...roh('eier', 'Freilandeier'), imageUrl: 'https://testspeicher.public.blob.vercel-storage.com/farms/farm-1/product/1.webp' },
          { ...roh('honig', 'Blütenhonig'), imageUrl: 'https://fremd.public.blob.vercel-storage.com/farms/farm-1/product/2.webp' },
          roh('brot', 'Brot'),
          roh('heu', 'Heu'),
        ],
      } as never)
      beitragLesen.mockResolvedValueOnce(
        beitrag({ linkedProductIds: ['eier', 'honig'], photoUrl: 'https://testspeicher.public.blob.vercel-storage.com/farms/farm-2/status/1.webp' }) as never
      )
      await aufruf(`?b=${BEITRAG_ID}`)
      const eingabe = vi.mocked(ladeTeilenBildBilder).mock.calls.at(-1)?.[0]
      expect(eingabe?.eintraege.map((e) => [e.id, e.quelle.art])).toEqual([
        ['eier', 'foto'],
        ['honig', 'illustration'],
      ])
      expect(eingabe?.beitragFoto).toBeNull()
      expect(prisma.product.findMany).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('fehlt ein Foto (Ersatz im Bild), kommt nur der kurze Zwischenspeicher — auch mit passender Prüfsumme', async () => {
    vi.mocked(ladeTeilenBildBilder).mockResolvedValueOnce({ produkte: {}, held: null, ersatz: true })
    // Die passende Prüfsumme liefert die echte Quelle der Metadaten (Regelvorschlag 67).
    const res = await aufruf(`?v=${(await ladeTeilenVorschau('hof-test', JETZT))?.version}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=60')
  })
})

describe('Abzeichen im Teilen-Bild (Register K2, Nr. 116)', () => {
  const ROH = {
    id: 'farm-1',
    name: 'Sonnhof',
    slug: 'hof-test',
    city: 'Teststadt',
    isPaused: false,
    betriebsnummer: null,
    betriebsstatus: null,
    approvedAt: new Date('2026-10-01T08:00:00Z'),
    gruendungPlatz: 7,
    gruendungAusgenommen: false,
    gruendungAbzeichenZeigen: true,
    products: [],
    pickupSlots: [],
  }

  it('der Lader liest den Platz, gibt aber nur Ja/Nein weiter — ausgeblendet und ausgenommen ohne Etikett', async () => {
    findFirst.mockResolvedValue(ROH as never)
    const quelle = await ladeTeilenBildQuelle({ slug: 'hof-test' })
    expect(quelle?.hof.gruendungshof).toBe(true)
    expect(findFirst.mock.calls[0][0]?.select).toMatchObject({ gruendungPlatz: true, gruendungAusgenommen: true, gruendungAbzeichenZeigen: true })
    expect(JSON.stringify(quelle)).not.toContain('gruendungPlatz')

    findFirst.mockResolvedValue({ ...ROH, gruendungAbzeichenZeigen: false } as never)
    expect((await ladeTeilenBildQuelle({ slug: 'hof-test' }))?.hof.gruendungshof).toBe(false)
    findFirst.mockResolvedValue({ ...ROH, gruendungAusgenommen: true } as never)
    expect((await ladeTeilenBildQuelle({ slug: 'hof-test' }))?.hof.gruendungshof).toBe(false)
    findFirst.mockResolvedValue({ ...ROH, gruendungPlatz: null } as never)
    expect((await ladeTeilenBildQuelle({ slug: 'hof-test' }))?.hof.gruendungshof).toBe(false)
  })

  it('die Prüfsumme ändert sich mit dem Schalter; ohne Abzeichen bleibt sie wie bisher', () => {
    const eingabe = { hof: HOF, produkte: [produkt('eier')], slots: [], auswahl: null, adresse: 'x.at/hof-test', jetzt: JETZT }
    const bisher = teilenBildVersion(teilenBildDaten(eingabe))
    const ohne = teilenBildDaten({ ...eingabe, hof: { ...HOF, gruendungshof: false } })
    expect('gruendungshof' in ohne).toBe(false)
    expect(teilenBildVersion(ohne)).toBe(bisher)
    const mit = teilenBildDaten({ ...eingabe, hof: { ...HOF, gruendungshof: true } })
    expect(mit.gruendungshof).toBe(true)
    expect(teilenBildVersion(mit)).not.toBe(bisher)
  })

  it('die Grafik zeichnet das Etikett über dem Namen — 1:1 und Story, mit und ohne Foto, auch im Beitrag; nie eine Nummer', () => {
    const qr = qrPfad('https://x.at/hof-test?k=qr')
    const MIT_FOTO: GeladeneBilder = { produkte: {}, held: 'data:image/jpeg;base64,HELD', ersatz: false }
    const beitrag = { anlass: 'PROMOTION' as const, title: 'Kürbisse sind da', body: 'Ab Samstag am Hof.' }
    for (const mitBeitrag of [false, true]) {
      const eingabe = { produkte: [produkt('eier')], slots: [], auswahl: null, adresse: 'x.at/hof-test', jetzt: JETZT, beitrag: mitBeitrag ? beitrag : null }
      const mit = teilenBildDaten({ ...eingabe, hof: { ...HOF, name: 'Sonnhof', gruendungshof: true } })
      const ohne = teilenBildDaten({ ...eingabe, hof: { ...HOF, name: 'Sonnhof', gruendungshof: false } })
      for (const format of ['quadrat', 'story'] as const) {
        for (const bilder of [OHNE_BILDER, MIT_FOTO]) {
          const html = renderToStaticMarkup(createElement(TeilenBildGrafik, { daten: mit, format, qr, bilder, marke: MARKE_BILD }))
          const etikett = html.indexOf(`>${ABZEICHEN_TEXT.wort}<`)
          expect(etikett).toBeGreaterThan(-1)
          expect(etikett).toBeLessThan(html.indexOf('Sonnhof'))
          // Großbuchstaben nur per CSS am Etikett selbst (kein Element dazwischen geschlossen), das Wort bleibt im Text.
          const stil = html.slice(0, etikett).lastIndexOf('text-transform:uppercase')
          expect(stil).toBeGreaterThan(-1)
          expect(html.slice(stil, etikett)).not.toContain('</div>')
          expect(html).not.toMatch(/Nr\.\s?\d/)
          // Gegenprobe: ohne Abzeichen kein Etikett.
          const ohneHtml = renderToStaticMarkup(createElement(TeilenBildGrafik, { daten: ohne, format, qr, bilder, marke: MARKE_BILD }))
          expect(ohneHtml).not.toContain(`>${ABZEICHEN_TEXT.wort}<`)
        }
      }
    }
  })
})

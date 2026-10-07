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
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findFirst: vi.fn() } } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
// Satori/resvg brauchen wir hier nicht: Die Aussage ist, was die Route mit dem Bild macht (Kopf, Fehler).
vi.mock('next/og', () => ({
  ImageResponse: vi.fn(function (this: unknown, _el: unknown, optionen: { headers?: Record<string, string> }) {
    return new Response('png', { headers: { 'content-type': 'image/png', ...optionen.headers } })
  }),
}))

import { prisma } from '@/lib/prisma'
import * as Sentry from '@sentry/nextjs'
import { ImageResponse } from 'next/og'
import { hofAdresse } from '@/lib/mein-hof'
import { Decimal } from '@prisma/client/runtime/index-browser'
import { APP_URL } from '@/lib/umgebung-server'
import {
  bildProdukte,
  teilenAuswahl,
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
import { TEILEN_BILD_FARBE, TeilenBildGrafik } from '@/components/teilen/teilen-bild-grafik'
import { GET as bildRoute } from '@/app/(public)/[farmSlug]/opengraph-image/route'

const findFirst = vi.mocked(prisma.farm.findFirst)

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
      adresse: 'farmerzone.at/hof-test',
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
      adresse: 'farmerzone.at/hof-test',
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
      adresse: 'farmerzone.at/hof-test',
      jetzt: JETZT,
    })
    const html = renderToStaticMarkup(createElement(TeilenBildGrafik, { daten, format: 'quadrat', qr: qrPfad('https://x.at/hof-test?k=qr') }))
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).toContain('&quot;&gt;&lt;img')
  })

  it('lange Namen: höchstens zwei Zeilen im Bild (lineClamp), nie über den Rand', () => {
    const daten = teilenBildDaten({
      hof: { ...HOF, name: 'H'.repeat(80) },
      produkte: [],
      slots: [],
      auswahl: null,
      adresse: 'farmerzone.at/hof-test',
      jetzt: JETZT,
    })
    const html = renderToStaticMarkup(createElement(TeilenBildGrafik, { daten, format: 'story', qr: qrPfad('https://x.at') }))
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
      adresse: 'farmerzone.at/hof-test',
      jetzt: JETZT,
    })
    expect(daten).toMatchObject({ hofName: 'Hof Test', ort: 'Teststadt', abholung: 'Abholung Samstag, 9–12 Uhr' })
  })

  it('die Prüfsumme ändert sich, wenn ein Produkt ausverkauft ist', () => {
    const eingabe = {
      hof: HOF,
      produkte: [produkt('a'), produkt('b')],
      slots: [],
      auswahl: null,
      adresse: 'farmerzone.at/hof-test',
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
    const daten = { hofName: 'Hof Test', ort: 'Teststadt', produkte: [{ id: 'a', name: 'Eier', preis: '€ 1' }], abholung: 'Abholung Samstag, 9–12 Uhr', adresse: 'x' }
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
  })
})

describe('QR-Code', () => {
  it('ein Pfad aus Rechtecken, gleich für gleiche Adresse', () => {
    const a = qrPfad('https://farmerzone.at/hof-test?k=qr')
    expect(a.groesse).toBeGreaterThanOrEqual(21)
    expect(a.pfad).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/)
    expect(qrPfad('https://farmerzone.at/hof-test?k=qr')).toEqual(a)
    expect(qrPfad('https://farmerzone.at/anderer-hof?k=qr').pfad).not.toBe(a.pfad)
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

  it('ungültiger Slug: 404 ohne Datenbank', async () => {
    const res = await aufruf('Hof%20Test')
    expect(res.status).toBe(404)
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
  const aktuelleVersion = () =>
    teilenBildVersion(
      teilenBildDaten({
        hof: HOF,
        produkte: [produkt('eier', { name: 'Freilandeier', stock: 3 })],
        slots: [],
        auswahl: null,
        adresse: hofAdresse(APP_URL, 'hof-test').anzeige,
        jetzt: JETZT,
      })
    )
  const aufruf = (suche = '', kopf: Record<string, string> = {}) =>
    bildRoute(new NextRequest(`http://localhost/hof-test/opengraph-image${suche}`, { headers: kopf }), {
      params: Promise.resolve({ farmSlug: 'hof-test' }),
    })

  beforeEach(() => {
    findFirst.mockResolvedValue(ROH as never)
  })

  it('lang zwischengespeichert nur mit der Prüfsumme des aktuellen Inhalts', async () => {
    const passend = await aufruf(`?v=${aktuelleVersion()}`)
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

  it('Schrift, QR-Grund und QR-Module sind genau die Token-Werte, der Verlauf hat das Akzent-Grün in der Mitte', () => {
    expect(TEILEN_BILD_FARBE.text).toBe(token('text', 'dunkel'))
    expect(TEILEN_BILD_FARBE.qrGrund).toBe(token('surface', 'hell'))
    expect(TEILEN_BILD_FARBE.qrModul).toBe(token('text', 'hell'))
    expect(TEILEN_BILD_FARBE.grund).toContain(`${token('accent', 'dunkel')} 55%`)
  })

  it('Farbwerte gibt es im Teilen-Bild nur im Objekt TEILEN_BILD_FARBE', () => {
    const text = readFileSync(join(process.cwd(), 'src/components/teilen/teilen-bild-grafik.tsx'), 'utf8')
    const ausserhalb = text.slice(text.indexOf('} as const'))
    expect(ausserhalb).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })
})

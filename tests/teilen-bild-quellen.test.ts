/**
 * Tests für die Bildquellen des Teilen-Bilds (Register T6, Nr. 69).
 *
 * Beweist:
 *  - Kette je Produktzeile: eigenes Foto → Illustration der Kategorie →
 *    „Sonstiges"; ein Foto aus einem fremden Speicher, von einem fremden Host
 *    oder aus dem Pfad eines anderen Hofs wird nie geholt.
 *  - Der Lader holt Fotos nur mit Zeit- und Größenlimit und erkennt Bilder an
 *    den ersten Bytes; scheitert ein Foto, steht die Illustration da und das
 *    Ergebnis meldet „Ersatz" (die Route speichert dann nur kurz zwischen).
 *    Variante B: das Beitragsfoto, sonst das erste Produktfoto, das lädt.
 *  - Schriften (mit Lizenz) und Illustrationen liegen da, wo die Route sie
 *    liest, und next.config.ts trägt sie für die Route ein.
 *
 * Satori selbst rendert hier nichts (es zeichnet erst in der Route).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { istEigeneBildUrl } from '@/lib/upload-pfade'
import { KATEGORIE_BILD_SLUG, kategorieBildPfad, type ProductCategoryValue } from '@/lib/taxonomie'
import {
  FOTO_FRIST_MS,
  FOTO_MAX_BYTES,
  SCHRIFT_ORDNER,
  SONSTIGES_PFAD,
  TEILEN_BILD_SCHRIFTEN,
  heldKandidaten,
  illustrationPfad,
  ladeTeilenBildBilder,
  ladeTeilenBildSchriften,
  produktBildQuelle,
  type BildQuelle,
  type BildWerkzeuge,
} from '@/lib/teilen-bild-quellen'

const SPEICHER = 'testspeicher'
const blob = (pfad: string) => `https://${SPEICHER}.public.blob.vercel-storage.com/${pfad}`
const FOTO_EIER = blob('farms/farm-1/product/1.webp')
const FOTO_HONIG = blob('farms/farm-1/product/2.webp')
const FOTO_BEITRAG = blob('farms/farm-1/status/1.webp')
const istEigen = (url: string) => istEigeneBildUrl(url, 'farm-1', SPEICHER)

/** Die ersten Bytes einer WebP-Datei (RIFF … WEBP) und etwas Inhalt. */
const WEBP = new Uint8Array([...'RIFF\0\0\0\0WEBPVP8 '].map((z) => z.charCodeAt(0)))
const QUADRAT = { width: 1080, height: 1080 }

/** Attrappen für Netz, Dateisystem und sharp: „wandeln" sagt, was es bekam. */
function werkzeuge(antworten: Record<string, () => Promise<Response>>, lesen?: BildWerkzeuge['lesen']) {
  const geholt: string[] = []
  const gelesen: string[] = []
  const w: BildWerkzeuge = {
    holen: async (url) => {
      geholt.push(url)
      const antwort = antworten[url]
      if (!antwort) throw new Error('unerwarteter Abruf')
      return antwort()
    },
    lesen:
      lesen ??
      (async (pfad) => {
        gelesen.push(pfad)
        return new TextEncoder().encode(pfad)
      }),
    wandeln: async (bytes, breite, hoehe) => {
      // Fotos tragen ihre Länge im Namen — so ist sichtbar, WELCHES Foto ankam.
      const text = new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' ? `foto${bytes.length}` : new TextDecoder().decode(bytes)
      return `${text}@${breite}x${hoehe}`
    },
    illustrationen: new Map(),
  }
  return { w, geholt, gelesen }
}

const ok = (bytes: Uint8Array<ArrayBuffer>, kopf: Record<string, string> = {}) => async () => new Response(bytes, { headers: kopf })
const zeile = (id: string, quelle: BildQuelle) => ({ id, quelle })

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('Bildquelle je Produktzeile', () => {
  it('ein eigenes Foto geht vor, die Illustration der Kategorie bleibt als Ersatz', () => {
    expect(produktBildQuelle({ imageUrl: FOTO_HONIG, category: 'HONIG' }, istEigen)).toEqual({
      art: 'foto',
      url: FOTO_HONIG,
      ersatz: kategorieBildPfad('HONIG'),
    })
  })

  it('ohne Foto die Illustration der Kategorie, ohne Kategorie „Sonstiges"', () => {
    expect(produktBildQuelle({ imageUrl: null, category: 'HONIG' }, istEigen)).toEqual({ art: 'illustration', pfad: kategorieBildPfad('HONIG') })
    expect(produktBildQuelle({ imageUrl: null, category: null }, istEigen)).toEqual({ art: 'illustration', pfad: SONSTIGES_PFAD })
    expect(SONSTIGES_PFAD).toBe(kategorieBildPfad('SONSTIGES'))
  })

  it.each([
    ['fremder Speicher', 'https://fremd.public.blob.vercel-storage.com/farms/farm-1/product/1.webp'],
    ['fremder Host', 'https://bilder.example.com/farms/farm-1/product/1.webp'],
    ['Pfad eines anderen Hofs', blob('farms/farm-2/product/1.webp')],
    ['ohne https', FOTO_EIER.replace('https:', 'http:')],
  ])('%s: Illustration statt Foto — die Adresse wird nie geholt', (_fall, url) => {
    expect(produktBildQuelle({ imageUrl: url, category: 'EIER' }, istEigen)).toEqual({ art: 'illustration', pfad: kategorieBildPfad('EIER') })
  })

  it('Variante B versucht das Beitragsfoto zuerst, dann die Produktfotos in der Reihenfolge der Zeilen', () => {
    const quellen: BildQuelle[] = [
      { art: 'illustration', pfad: SONSTIGES_PFAD },
      { art: 'foto', url: FOTO_HONIG, ersatz: SONSTIGES_PFAD },
      { art: 'foto', url: FOTO_EIER, ersatz: SONSTIGES_PFAD },
    ]
    expect(heldKandidaten(FOTO_BEITRAG, quellen)).toEqual([FOTO_BEITRAG, FOTO_HONIG, FOTO_EIER])
    expect(heldKandidaten(null, quellen)).toEqual([FOTO_HONIG, FOTO_EIER])
    expect(heldKandidaten(null, [{ art: 'illustration', pfad: SONSTIGES_PFAD }])).toEqual([])
  })
})

describe('Lader: Fotos mit Zeit- und Größenlimit, sonst Illustration', () => {
  it('ein eigenes Foto kommt rund in die Zeile und trägt Variante B', async () => {
    const { w, geholt } = werkzeuge({ [FOTO_EIER]: ok(WEBP) })
    const bilder = await ladeTeilenBildBilder({ eintraege: [zeile('eier', produktBildQuelle({ imageUrl: FOTO_EIER, category: 'EIER' }, istEigen))], beitragFoto: null, held: QUADRAT }, w)
    expect(bilder).toEqual({ produkte: { eier: 'foto16@192x192' }, held: 'foto16@1080x1080', ersatz: false })
    // Einmal geholt, zweimal gewandelt (Kreis und Grund).
    expect(geholt).toEqual([FOTO_EIER])
  })

  it('ohne Foto: Illustrationen, kein Foto-Held, kein Abruf', async () => {
    const { w, geholt } = werkzeuge({})
    const bilder = await ladeTeilenBildBilder({ eintraege: [zeile('eier', { art: 'illustration', pfad: '/categories/eier.webp' })], beitragFoto: null, held: QUADRAT }, w)
    expect(bilder).toEqual({ produkte: { eier: '/categories/eier.webp@192x192' }, held: null, ersatz: false })
    expect(geholt).toEqual([])
  })

  it.each([
    ['zu groß laut Content-Length', ok(WEBP, { 'content-length': String(FOTO_MAX_BYTES + 1) })],
    ['zu groß ohne Angabe (der Strom wird abgebrochen)', ok(new Uint8Array(FOTO_MAX_BYTES + 1).fill(1).map((b, i) => (i < WEBP.length ? WEBP[i] : b)))],
    ['kein Bild (an den ersten Bytes erkannt, nicht am Content-Type)', ok(new TextEncoder().encode('<html>'), { 'content-type': 'image/webp' })],
    ['Fehlerseite', async () => new Response('weg', { status: 404 })],
    ['Netzabbruch', async () => Promise.reject(new TypeError('fetch failed'))],
  ])('%s: Illustration der Kategorie und „Ersatz"', async (_fall, antwort) => {
    const { w } = werkzeuge({ [FOTO_EIER]: antwort })
    const quelle = produktBildQuelle({ imageUrl: FOTO_EIER, category: 'EIER' }, istEigen)
    const bilder = await ladeTeilenBildBilder({ eintraege: [zeile('eier', quelle)], beitragFoto: null, held: QUADRAT }, w)
    expect(bilder).toEqual({ produkte: { eier: `${kategorieBildPfad('EIER')}@192x192` }, held: null, ersatz: true })
  })

  it('hängt der Abruf, steht nach FOTO_FRIST_MS die Illustration da — das Bild wartet nicht länger', async () => {
    vi.useFakeTimers()
    const { w } = werkzeuge({ [FOTO_EIER]: () => new Promise<Response>(() => {}) })
    const quelle = produktBildQuelle({ imageUrl: FOTO_EIER, category: 'EIER' }, istEigen)
    const laden = ladeTeilenBildBilder({ eintraege: [zeile('eier', quelle)], beitragFoto: null, held: QUADRAT }, w)
    await vi.advanceTimersByTimeAsync(FOTO_FRIST_MS)
    await expect(laden).resolves.toEqual({ produkte: { eier: `${kategorieBildPfad('EIER')}@192x192` }, held: null, ersatz: true })
  })

  it('Variante B: das Beitragsfoto; kommt es nicht, das erste Produktfoto, das lädt', async () => {
    const eintraege = [zeile('eier', produktBildQuelle({ imageUrl: FOTO_EIER, category: 'EIER' }, istEigen))]
    const mitBeitrag = werkzeuge({ [FOTO_BEITRAG]: ok(new Uint8Array([...WEBP, 2])), [FOTO_EIER]: ok(WEBP) })
    expect((await ladeTeilenBildBilder({ eintraege, beitragFoto: FOTO_BEITRAG, held: QUADRAT }, mitBeitrag.w)).held).toBe('foto17@1080x1080')
    expect(mitBeitrag.geholt.sort()).toEqual([FOTO_BEITRAG, FOTO_EIER].sort())

    const beitragKaputt = werkzeuge({ [FOTO_BEITRAG]: async () => new Response('x', { status: 500 }), [FOTO_EIER]: ok(WEBP) })
    const bilder = await ladeTeilenBildBilder({ eintraege, beitragFoto: FOTO_BEITRAG, held: QUADRAT }, beitragKaputt.w)
    expect(bilder.held).toBe('foto16@1080x1080')
    expect(bilder.ersatz).toBe(true)
  })

  it('fehlt eine Illustration, steht „Sonstiges" da und es geht einmal eine Meldung hinaus', async () => {
    const { w } = werkzeuge({}, async (pfad) => {
      if (pfad !== SONSTIGES_PFAD) throw new Error('ENOENT')
      return new TextEncoder().encode(pfad)
    })
    const eintrag = zeile('honig', { art: 'illustration', pfad: kategorieBildPfad('HONIG') ?? '' })
    const erst = await ladeTeilenBildBilder({ eintraege: [eintrag], beitragFoto: null, held: QUADRAT }, w)
    const dann = await ladeTeilenBildBilder({ eintraege: [eintrag], beitragFoto: null, held: QUADRAT }, w)
    expect(erst.produkte.honig).toBe(`${SONSTIGES_PFAD}@192x192`)
    expect(dann.produkte.honig).toBe(`${SONSTIGES_PFAD}@192x192`)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })
})

describe('Schriften und Illustrationen liegen, wo die Route sie liest', () => {
  it('jede Schrift ist eine TrueType-Datei mit der OFL-Lizenz daneben', () => {
    for (const schrift of TEILEN_BILD_SCHRIFTEN) {
      const datei = join(process.cwd(), SCHRIFT_ORDNER, schrift.datei)
      expect([...readFileSync(datei).subarray(0, 4)]).toEqual([0, 1, 0, 0])
      expect(readFileSync(join(datei, '..', 'OFL.txt'), 'utf8')).toContain('SIL Open Font License')
    }
  })

  it('lädt Fraunces 600 und Instrument Sans 400/600 für ImageResponse', async () => {
    const schriften = await ladeTeilenBildSchriften()
    expect(schriften.map((s) => [s.name, s.weight])).toEqual([
      ['Fraunces', 600],
      ['Instrument Sans', 400],
      ['Instrument Sans', 600],
    ])
  })

  it('der echte Lader macht aus der WebP-Illustration ein JPEG — Satori zeichnet kein WebP', async () => {
    const bilder = await ladeTeilenBildBilder({ eintraege: [zeile('eier', { art: 'illustration', pfad: illustrationPfad('EIER') })], beitragFoto: null, held: QUADRAT })
    expect(readFileSync(join(process.cwd(), 'public', illustrationPfad('EIER'))).subarray(8, 12).toString()).toBe('WEBP')
    expect(bilder.produkte.eier).toMatch(/^data:image\/jpeg;base64,\/9j\//)
  })

  it('jede Kategorie hat ihre Illustration unter public/categories', () => {
    for (const kategorie of Object.keys(KATEGORIE_BILD_SLUG) as ProductCategoryValue[]) {
      expect(existsSync(join(process.cwd(), 'public', illustrationPfad(kategorie))), kategorie).toBe(true)
    }
  })

  it('next.config.ts trägt Schriften, Illustrationen und sharp für die Route ein (der Tracer sieht fs-Zugriffe nicht)', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
    const ab = config.indexOf("/opengraph-image': [")
    expect(ab).toBeGreaterThan(-1)
    const liste = config.slice(ab, config.indexOf('],', ab))
    expect(liste).toContain(`'./${SCHRIFT_ORDNER}/**/*.ttf'`)
    expect(liste).toContain("'./public/categories/*.webp'")
    expect(liste).toContain('@img/sharp-linux-x64/**/*')
    expect(liste).toContain('@img/sharp-libvips-linux-x64/**/*')
  })
})

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
 *    Variante B: das Beitragsfoto, sonst das erste Produktfoto, das lädt —
 *    alle zugleich, jedes unter eigener Frist (Nr. 75); die Ersatz-Illustration
 *    lädt mit dem Foto. Eine fehlende Illustration: „Sonstiges" und „Ersatz".
 *  - Gewandelte Fotos liegen im Zwischenspeicher, Schlüssel ist sha256 der
 *    Adresse, höchstens FOTO_CACHE_MAX Einträge; sharp dekodiert höchstens
 *    6 MP (ein Upload in voller Größe passt, mehr nicht).
 *  - Schriften (mit Lizenz) und Illustrationen liegen da, wo die Route sie
 *    liest, und next.config.ts trägt sie für die Route ein.
 *
 * Satori selbst rendert hier nichts (es zeichnet erst in der Route).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import sharp from 'sharp'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { istEigeneBildUrl } from '@/lib/upload-pfade'
import { KATEGORIE_BILD_SLUG, SONSTIGES_BILD_PFAD, illustrationPfad, kategorieBildPfad, type ProductCategoryValue } from '@/lib/taxonomie'
import {
  FOTO_CACHE_MAX,
  FOTO_FRIST_MS,
  FOTO_MAX_BYTES,
  SCHRIFT_ORDNER,
  TEILEN_BILD_SCHRIFTEN,
  heldKandidaten,
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
  const inits: RequestInit[] = []
  const gelesen: string[] = []
  const w: BildWerkzeuge = {
    holen: async (url, init) => {
      geholt.push(url)
      inits.push(init)
      const antwort = antworten[url]
      if (!antwort) throw new Error('unerwarteter Abruf')
      const gefunden = await antwort()
      const ziel = gefunden.headers.get('location')
      if (gefunden.status < 300 || gefunden.status >= 400 || !ziel) return gefunden
      // Wie fetch: Mit redirect „error" bricht der Abruf bei einer Umleitung ab, sonst folgt er ihr.
      if (init.redirect === 'error') throw new TypeError('redirect mode is set to error')
      return w.holen(ziel, init)
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
    fotos: new Map(),
  }
  return { w, geholt, gelesen, inits }
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
    expect(produktBildQuelle({ imageUrl: null, category: null }, istEigen)).toEqual({ art: 'illustration', pfad: SONSTIGES_BILD_PFAD })
    expect(SONSTIGES_BILD_PFAD).toBe(kategorieBildPfad('SONSTIGES'))
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
      { art: 'illustration', pfad: SONSTIGES_BILD_PFAD },
      { art: 'foto', url: FOTO_HONIG, ersatz: SONSTIGES_BILD_PFAD },
      { art: 'foto', url: FOTO_EIER, ersatz: SONSTIGES_BILD_PFAD },
    ]
    expect(heldKandidaten(FOTO_BEITRAG, quellen)).toEqual([FOTO_BEITRAG, FOTO_HONIG, FOTO_EIER])
    expect(heldKandidaten(null, quellen)).toEqual([FOTO_HONIG, FOTO_EIER])
    expect(heldKandidaten(null, [{ art: 'illustration', pfad: SONSTIGES_BILD_PFAD }])).toEqual([])
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

  it('jeder Abruf trägt ein Zeitlimit (signal) und folgt keiner Umleitung', async () => {
    const { w, inits } = werkzeuge({ [FOTO_BEITRAG]: ok(WEBP), [FOTO_EIER]: ok(WEBP) })
    const quelle = produktBildQuelle({ imageUrl: FOTO_EIER, category: 'EIER' }, istEigen)
    await ladeTeilenBildBilder({ eintraege: [zeile('eier', quelle)], beitragFoto: FOTO_BEITRAG, held: QUADRAT }, w)
    expect(inits).toHaveLength(2)
    for (const init of inits) {
      expect(init.redirect).toBe('error')
      expect(init.signal).toBeInstanceOf(AbortSignal)
      expect(init.signal?.aborted).toBe(false)
    }
  })

  it('eine Umleitung auf einen fremden Host wird nie gefolgt — es steht die Illustration da', async () => {
    const FREMD = 'https://fremd.example.com/bild.webp'
    const { w, geholt } = werkzeuge({
      [FOTO_EIER]: async () => new Response(null, { status: 302, headers: { location: FREMD } }),
      [FREMD]: ok(WEBP),
    })
    const quelle = produktBildQuelle({ imageUrl: FOTO_EIER, category: 'EIER' }, istEigen)
    const bilder = await ladeTeilenBildBilder({ eintraege: [zeile('eier', quelle)], beitragFoto: null, held: QUADRAT }, w)
    expect(geholt).toEqual([FOTO_EIER])
    expect(bilder).toEqual({ produkte: { eier: `${kategorieBildPfad('EIER')}@192x192` }, held: null, ersatz: true })
  })

  it('eine Fehlerseite wird nicht gelesen: ihr Strom wird abgebrochen, die Verbindung bleibt nicht offen', async () => {
    let abgebrochen = false
    const strom = new ReadableStream<Uint8Array>({ cancel: () => void (abgebrochen = true) })
    const { w } = werkzeuge({ [FOTO_EIER]: async () => new Response(strom, { status: 404 }) })
    const quelle = produktBildQuelle({ imageUrl: FOTO_EIER, category: 'EIER' }, istEigen)
    await ladeTeilenBildBilder({ eintraege: [zeile('eier', quelle)], beitragFoto: null, held: QUADRAT }, w)
    expect(abgebrochen).toBe(true)
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
      if (pfad !== SONSTIGES_BILD_PFAD) throw new Error('ENOENT')
      return new TextEncoder().encode(pfad)
    })
    const eintrag = zeile('honig', { art: 'illustration', pfad: kategorieBildPfad('HONIG') ?? '' })
    const erst = await ladeTeilenBildBilder({ eintraege: [eintrag], beitragFoto: null, held: QUADRAT }, w)
    const dann = await ladeTeilenBildBilder({ eintraege: [eintrag], beitragFoto: null, held: QUADRAT }, w)
    expect(erst.produkte.honig).toBe(`${SONSTIGES_BILD_PFAD}@192x192`)
    expect(dann.produkte.honig).toBe(`${SONSTIGES_BILD_PFAD}@192x192`)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    // Ersatz auch beim zweiten Mal (aus dem Zwischenspeicher): Das Bild liegt nur kurz im CDN (Nr. 75).
    expect(erst.ersatz).toBe(true)
    expect(dann.ersatz).toBe(true)
  })

  it('die Meldung trägt nie den Pfad der Datei: fester Text, Klasse als Name, bereinigte Nachricht — nicht der Rohfehler (aus der Prüfung von 69)', async () => {
    const roh = Object.assign(new Error("ENOENT: no such file or directory, open '/var/task/public/categories/honig.webp'"), { code: 'ENOENT' })
    const { w } = werkzeuge({}, async (pfad) => {
      if (pfad !== SONSTIGES_BILD_PFAD) throw roh
      return new TextEncoder().encode(pfad)
    })
    const eintrag = zeile('honig', { art: 'illustration', pfad: kategorieBildPfad('HONIG') ?? '' })
    await ladeTeilenBildBilder({ eintraege: [eintrag], beitragFoto: null, held: QUADRAT }, w)

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [gemeldet, kontext] = vi.mocked(Sentry.captureException).mock.calls[0]
    expect(gemeldet).not.toBe(roh)
    expect(gemeldet).toBeInstanceOf(Error)
    expect((gemeldet as Error).message).toBe('Teilen-Bild: Illustration nicht ladbar')
    expect((gemeldet as Error).name).toBe('Error')
    expect(kontext).toMatchObject({
      tags: { bereich: 'teilen-bild', teil: 'illustration' },
      extra: { fehlertext: expect.stringContaining('ENOENT') },
    })
    expect(JSON.stringify([gemeldet, kontext])).not.toContain('/var/task')
    // Nie der Rohfehler als Ursache: Sentry schickt verkettete Fehler mit, am Kontext vorbei.
    expect((gemeldet as Error).cause).toBeUndefined()
  })

  it('fehlt auch „Sonstiges", bleibt der Kreis leer — nur kurz zwischengespeichert, nie lang', async () => {
    const { w } = werkzeuge({}, async () => {
      throw new Error('ENOENT')
    })
    const bilder = await ladeTeilenBildBilder({ eintraege: [zeile('honig', { art: 'illustration', pfad: kategorieBildPfad('HONIG') ?? '' })], beitragFoto: null, held: QUADRAT }, w)
    expect(bilder).toEqual({ produkte: {}, held: null, ersatz: true })
  })

  it('Variante B: hängt das Beitragsfoto, trägt das geladene Produktfoto — alle Kandidaten zugleich, jeder unter eigener Frist', async () => {
    vi.useFakeTimers()
    const { w } = werkzeuge({ [FOTO_BEITRAG]: () => new Promise<Response>(() => {}), [FOTO_EIER]: ok(WEBP) })
    // Wandeln braucht Zeit (sharp): Wer erst nach der Frist des Beitragsfotos damit beginnt, kommt zu spät.
    const wandeln = w.wandeln
    w.wandeln = async (bytes, breite, hoehe) => {
      await new Promise((fertig) => setTimeout(fertig, 20))
      return wandeln(bytes, breite, hoehe)
    }
    const eintraege = [zeile('eier', produktBildQuelle({ imageUrl: FOTO_EIER, category: 'EIER' }, istEigen))]
    const laden = ladeTeilenBildBilder({ eintraege, beitragFoto: FOTO_BEITRAG, held: QUADRAT }, w)
    await vi.advanceTimersByTimeAsync(FOTO_FRIST_MS + 50)
    const bilder = await laden
    expect(bilder.held).toBe('foto16@1080x1080')
    expect(bilder.ersatz).toBe(true)
  })

  it('die Ersatz-Illustration lädt mit dem Foto, nicht erst nach seiner Frist — das Bild ist fertig, sobald die Frist abläuft', async () => {
    vi.useFakeTimers()
    const { w } = werkzeuge({ [FOTO_EIER]: () => new Promise<Response>(() => {}) }, async (pfad) => {
      await new Promise((fertig) => setTimeout(fertig, 200))
      return new TextEncoder().encode(pfad)
    })
    let fertig = false
    const quelle = produktBildQuelle({ imageUrl: FOTO_EIER, category: 'EIER' }, istEigen)
    const laden = ladeTeilenBildBilder({ eintraege: [zeile('eier', quelle)], beitragFoto: null, held: QUADRAT }, w).then((bilder) => {
      fertig = true
      return bilder
    })
    await vi.advanceTimersByTimeAsync(FOTO_FRIST_MS + 1)
    expect(fertig).toBe(true)
    await expect(laden).resolves.toEqual({ produkte: { eier: `${kategorieBildPfad('EIER')}@192x192` }, held: null, ersatz: true })
  })
})

describe('Zwischenspeicher der gewandelten Fotos und Grenze für sharp (Nr. 75)', () => {
  const lade = (url: string, w: BildWerkzeuge) =>
    ladeTeilenBildBilder({ eintraege: [zeile('eier', produktBildQuelle({ imageUrl: url, category: 'EIER' }, istEigen))], beitragFoto: null, held: QUADRAT }, w)

  it('ein Foto wird je Prozess einmal geholt und gewandelt — der Schlüssel ist sha256 der Adresse, nie die Adresse', async () => {
    const { w, geholt } = werkzeuge({ [FOTO_EIER]: ok(WEBP) })
    const erst = await lade(FOTO_EIER, w)
    const dann = await lade(FOTO_EIER, w)
    expect(dann).toEqual(erst)
    expect(geholt).toEqual([FOTO_EIER])
    const schluessel = [...w.fotos.keys()]
    expect(schluessel).toHaveLength(2) // rund und als Grund (Variante B)
    for (const eintrag of schluessel) {
      expect(eintrag).toMatch(/^[0-9a-f]{64}@\d+x\d+$/)
      expect(eintrag).not.toContain('farm-1')
    }
  })

  it(`höchstens ${FOTO_CACHE_MAX} Einträge — das am längsten nicht gebrauchte Foto fällt zuerst heraus`, async () => {
    const adressen = Array.from({ length: 30 }, (_, i) => blob(`farms/farm-1/product/viele-${i}.webp`))
    const { w, geholt } = werkzeuge(Object.fromEntries(adressen.map((url) => [url, ok(WEBP)])))
    for (const url of adressen) await lade(url, w)
    expect(w.fotos.size).toBe(FOTO_CACHE_MAX)

    geholt.length = 0
    await lade(adressen[29], w)
    expect(geholt).toEqual([])
    await lade(adressen[0], w)
    expect(geholt).toEqual([adressen[0]])
  })

  it('ein gebrauchtes Foto rückt nach hinten: Nicht das zuerst geholte fällt heraus, sondern das am längsten nicht gebrauchte (LRU, nicht FIFO)', async () => {
    // Je Foto zwei Einträge (rund und als Grund): genau so viele Fotos, dass der Speicher voll ist.
    const adressen = Array.from({ length: FOTO_CACHE_MAX / 2 + 1 }, (_, i) => blob(`farms/farm-1/product/lru-${i}.webp`))
    const { w, geholt } = werkzeuge(Object.fromEntries(adressen.map((url) => [url, ok(WEBP)])))
    for (const url of adressen.slice(0, -1)) await lade(url, w)
    expect(w.fotos.size).toBe(FOTO_CACHE_MAX)

    // Das zuerst geholte Foto wird gebraucht — es rückt nach hinten.
    await lade(adressen[0], w)
    // Ein neues Foto verdrängt jetzt das zweite, nicht das erste.
    await lade(adressen[adressen.length - 1], w)
    expect(w.fotos.size).toBe(FOTO_CACHE_MAX)

    geholt.length = 0
    await lade(adressen[0], w)
    expect(geholt).toEqual([])
    await lade(adressen[1], w)
    expect(geholt).toEqual([adressen[1]])
  })

  // Eigenes Limit: echtes sharp wandelt zwei große Fotos je zweimal (rund und als Grund).
  it('sharp dekodiert höchstens 6 MP: ein Upload in voller Größe (2400 px) kommt ins Bild, ein größeres Foto nicht', async () => {
    const foto = (breite: number, hoehe: number) =>
      sharp({ create: { width: breite, height: hoehe, channels: 3, background: { r: 200, g: 170, b: 90 } } }).jpeg({ quality: 60 }).toBuffer()
    const PASST = blob('farms/farm-1/product/gross-2400.jpg')
    const ZU_GROSS = blob('farms/farm-1/product/gross-3000.jpg')
    const bytes = new Map([
      [PASST, await foto(2400, 2400)],
      [ZU_GROSS, await foto(3000, 2001)],
    ])
    vi.stubGlobal('fetch', async (url: string) => new Response(new Uint8Array(bytes.get(url) ?? new Uint8Array())))
    try {
      const echt = (url: string) =>
        ladeTeilenBildBilder({ eintraege: [zeile('eier', produktBildQuelle({ imageUrl: url, category: 'EIER' }, istEigen))], beitragFoto: null, held: QUADRAT })
      const passt = await echt(PASST)
      expect(passt.ersatz).toBe(false)
      expect(passt.held).toMatch(/^data:image\/jpeg;base64,/)
      const zuGross = await echt(ZU_GROSS)
      expect(zuGross.ersatz).toBe(true)
      expect(zuGross.held).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  }, 15_000)

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
    // `**`: auch die Unterordner der Unterkategorien (categories/<kategorie>/<unterkategorie>.webp, Nr. 74).
    expect(liste).toContain("'./public/categories/**/*.webp'")
    expect(liste).toContain('@img/sharp-linux-x64/**/*')
    expect(liste).toContain('@img/sharp-libvips-linux-x64/**/*')
  })
})

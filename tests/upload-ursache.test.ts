/**
 * Der Fehler aus JAVASCRIPT-NEXTJS-2: Scheiterte der Transfer auch im zweiten
 * Anlauf, warf ladeFotoHoch IMMER „Verbindung unterbrochen" — auch wenn der
 * Bildspeicher das Foto abgelehnt hatte —, und der Originalfehler ging dabei
 * verloren, für den Bauern wie für Sentry. Das Issue zeigte nur: beide Anläufe
 * scheiterten rund zwei Sekunden nach gültiger Kennung, Ursache unbekannt.
 *
 * Geprüft wird der echte Ablauf in ladeFotoHoch. Gemockt ist nur die
 * Infrastruktur: der Blob-Client (das Netz zum Bildspeicher) und fetch (unsere
 * zwei Routen). Die Zeit läuft über fake timers — die Atempause vor dem
 * Zweitversuch und die Dauer je Anlauf sind damit exakt.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('@vercel/blob/client', () => ({ upload }))

import { ladeFotoHoch } from '@/components/shared/image-upload'
import {
  bildFehlerArtVon,
  IMAGE_NETWORK_ERROR,
  IMAGE_STORAGE_ERROR,
  IMAGE_UNKNOWN_ERROR,
} from '@/lib/upload-fehler'
import type { UploadDiagnose } from '@/lib/upload-diagnose'

/** Erfundene Hof-Kennung im cuid-Format — sie darf in keiner Diagnose landen. */
const HOF = 'cltesthofkennung000000001'
const DATEINAME = 'Hof Test Stall.jpg'
const ORIGINAL = `https://beispiel.public.blob.vercel-storage.com/originals/${HOF}/product/Hof_Test_Stall-x1Y2.jpg`
const ZIEL = `https://beispiel.public.blob.vercel-storage.com/farms/${HOF}/product/1.webp`

function foto(): File {
  return {
    name: DATEINAME,
    type: 'image/jpeg',
    size: 6_000_000,
    slice: () => ({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  } as unknown as File
}

function json(daten: unknown, status = 200): Response {
  return new Response(JSON.stringify(daten), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Ein Versprechen, das nach `ms` mit `wert` endet — wie eine Antwort übers Netz. */
function nach<T>(ms: number, wert: () => T): Promise<Awaited<T>> {
  return new Promise((erfuellen, ablehnen) =>
    setTimeout(() => {
      try {
        Promise.resolve(wert()).then(erfuellen, ablehnen)
      } catch (e) {
        ablehnen(e)
      }
    }, ms)
  )
}

type Route = () => Promise<Response>

/** Unsere zwei Routen: Kennung und Verarbeitung, im Normalfall nach 250 ms. */
function routen(abweichend: { kennung?: Route; verarbeiten?: Route } = {}) {
  return vi.fn((adresse: string) => {
    if (adresse === '/api/upload/token') {
      return abweichend.kennung?.() ?? nach(250, () => json({ farmId: HOF }))
    }
    if (adresse === '/api/upload/verarbeiten') {
      return abweichend.verarbeiten?.() ?? nach(250, () => json({ url: ZIEL }))
    }
    return Promise.reject(new Error('unerwartete Adresse'))
  })
}

/** Ein Transfer, der nach `ms` mit `fehler` scheitert. */
function scheitertNach(ms: number, fehler: Error) {
  return () =>
    nach(ms, () => {
      throw fehler
    })
}

/** Startet den Upload, lässt die Zeit laufen und sammelt Ausgang und Diagnose. */
async function lauf(laden: typeof ladeFotoHoch = ladeFotoHoch, zeitMs = 10_000) {
  let diagnose: UploadDiagnose | undefined
  const ausgang = laden(foto(), 'product', {
    onDiagnose: (d: UploadDiagnose) => {
      diagnose = d
    },
  }).then(
    (url) => ({ url, fehler: undefined }),
    (fehler: unknown) => ({ url: undefined, fehler: fehler as Error })
  )
  await vi.advanceTimersByTimeAsync(zeitMs)
  return { ...(await ausgang), diagnose }
}

beforeEach(() => {
  vi.useFakeTimers()
  upload.mockReset()
  vi.stubGlobal('fetch', routen())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Übertragung — was der Bauer liest', () => {
  it('sagt „Verbindung unterbrochen" bei einem echten Netzfehler — nach genau einem Zweitversuch', async () => {
    upload.mockImplementation(scheitertNach(1_900, new TypeError('Failed to fetch')))

    const { fehler } = await lauf()

    expect(fehler?.message).toBe(IMAGE_NETWORK_ERROR)
    expect(upload).toHaveBeenCalledTimes(2)
  })

  it('bleibt beim Abbruch durch unseren Stillstands-Wächter bei „Verbindung unterbrochen"', async () => {
    // Ein Transfer, der nie ein Lebenszeichen gibt: 45 s Stille, Pause,
    // wieder 45 s Stille.
    upload.mockImplementation(() => new Promise(() => {}))

    const { fehler } = await lauf(ladeFotoHoch, 100_000)

    expect(fehler?.message).toBe(IMAGE_NETWORK_ERROR)
    expect(upload).toHaveBeenCalledTimes(2)
  })

  it('meldet eine Ablehnung des Bildspeichers als solche — nicht als Verbindungsabbruch', async () => {
    upload.mockImplementation(
      scheitertNach(
        300,
        new Error('Vercel Blob: Access denied, please provide a valid token for this resource.')
      )
    )

    const { fehler } = await lauf()

    expect(fehler?.message).toContain(
      'Der Bildspeicher hat das Foto gerade nicht angenommen — bitte später nochmal.'
    )
    expect(fehler?.message).toBe(IMAGE_STORAGE_ERROR)
    expect(fehler?.message).not.toContain('Verbindung')
  })

  it('versucht eine 4xx-Ablehnung nicht ein zweites Mal — auch nicht die mit „not available" im Text', async () => {
    // client_token_not_allowed kommt vom Bildspeicher mit 4xx. Das alte
    // Textmerkmal „not available" hielt sie für einen Transfer-Unfall.
    upload.mockImplementation(
      scheitertNach(
        300,
        new Error(
          'Vercel Blob: This operation is not available when using a client token. Use a read–write or OIDC token on the server.'
        )
      )
    )

    const { fehler } = await lauf()

    expect(upload).toHaveBeenCalledTimes(1)
    expect(fehler?.message).toBe(IMAGE_STORAGE_ERROR)
  })

  it('wiederholt einen gerade nicht erreichbaren Bildspeicher einmal und sagt dann, was los ist', async () => {
    // 5xx — ein zweiter Anlauf kann helfen. Scheitert auch er, liegt es am
    // Bildspeicher, nicht an der Verbindung des Bauern.
    upload.mockImplementation(
      scheitertNach(
        300,
        new Error('Vercel Blob: The blob service is currently not available. Please try again.')
      )
    )

    const { fehler } = await lauf()

    expect(upload).toHaveBeenCalledTimes(2)
    expect(fehler?.message).toBe(IMAGE_STORAGE_ERROR)
  })

  it('nennt einen Fehler ohne erkennbare Ursache ehrlich unbestimmt', async () => {
    upload.mockImplementation(scheitertNach(300, new RangeError('Invalid array length')))

    const { fehler } = await lauf()

    expect(upload).toHaveBeenCalledTimes(2)
    expect(fehler?.message).toBe(IMAGE_UNKNOWN_ERROR)
    expect(fehler?.message).not.toContain('Verbindung')
  })
})

describe('Übertragung — was Sentry erfährt', () => {
  it('hält je Anlauf Klasse, Nachricht und Dauer fest', async () => {
    upload.mockImplementation(scheitertNach(1_900, new TypeError('Failed to fetch')))

    const { diagnose } = await lauf()

    expect(diagnose).toEqual({
      schritt: 'uebertragung',
      anlaeufe: [
        { klasse: 'TypeError', meldung: 'Failed to fetch', dauerMs: 1_900 },
        { klasse: 'TypeError', meldung: 'Failed to fetch', dauerMs: 1_900 },
      ],
    })
  })

  it('nennt bei @vercel/blob die Unterklasse, obwohl das SDK keinen Namen setzt', async () => {
    upload.mockImplementation(
      scheitertNach(
        300,
        new Error('Vercel Blob: Access denied, please provide a valid token for this resource.')
      )
    )

    const { diagnose } = await lauf()

    expect(diagnose).toEqual({
      schritt: 'uebertragung',
      anlaeufe: [
        {
          klasse: 'BlobAccessError',
          meldung: 'Vercel Blob: Access denied, please provide a valid token for this resource.',
          dauerMs: 300,
        },
      ],
    })
  })

  it('nennt den Abbruch durch unseren Wächter samt Dauer', async () => {
    upload.mockImplementation(() => new Promise(() => {}))

    const { diagnose } = await lauf(ladeFotoHoch, 100_000)

    expect(diagnose?.anlaeufe).toHaveLength(2)
    for (const anlauf of diagnose?.anlaeufe ?? []) {
      expect(anlauf.klasse).toBe('WaechterAbbruch')
      expect(anlauf.meldung).toContain('Stillstand')
      expect(anlauf.dauerMs).toBe(45_000)
    }
  })

  it('lässt weder Dateinamen noch Pfad oder Adresse mit Hof-Kennung in die Diagnose', async () => {
    // BlobPathnameMismatchError trägt den angefragten Pfad im Text — und
    // damit Hof-Kennung und Dateinamen.
    upload.mockImplementation(
      scheitertNach(
        300,
        new Error(
          `Vercel Blob: Pathname mismatch, "pathname" "originals/${HOF}/product/Hof_Test_Stall-x1Y2.jpg" ` +
            `does not match the token payload for ${DATEINAME} (${ORIGINAL}). Check the pathname used ` +
            'in upload() or put() matches the one from the client token.'
        )
      )
    )

    const { diagnose } = await lauf()
    const text = JSON.stringify(diagnose)

    expect(diagnose?.anlaeufe[0].klasse).toBe('BlobPathnameMismatchError')
    expect(text).not.toContain(HOF)
    expect(text).not.toContain('Hof Test Stall')
    expect(text).not.toContain('Hof_Test_Stall')
    expect(text).not.toContain('originals/')
    expect(text).not.toContain('https://')
  })

  it('meldet bei Erfolg keine Diagnose — auch nicht nach einem gescheiterten ersten Anlauf', async () => {
    upload
      .mockImplementationOnce(scheitertNach(300, new TypeError('Failed to fetch')))
      .mockImplementationOnce(() => nach(300, () => ({ url: ORIGINAL })))

    const { url, diagnose } = await lauf()

    expect(url).toBe(ZIEL)
    expect(diagnose).toBeUndefined()
  })
})

describe('Abschluss — die Verarbeitung behält ihre Ursache', () => {
  beforeEach(() => {
    upload.mockImplementation(() => nach(300, () => ({ url: ORIGINAL })))
  })

  it('hält den HTTP-Status fest, wenn die Verarbeitung ablehnt', async () => {
    vi.stubGlobal(
      'fetch',
      routen({ verarbeiten: () => nach(400, () => json({ error: 'x', art: 'server' }, 500)) })
    )

    const { fehler, diagnose } = await lauf()

    expect(bildFehlerArtVon(fehler)).toBe('server')
    expect(diagnose).toEqual({
      schritt: 'abschluss',
      anlaeufe: [{ klasse: 'HttpAntwort', meldung: 'Verarbeitung abgelehnt (server)', status: 500, dauerMs: 400 }],
    })
  })

  it('nennt den Netzfehler mit seiner Klasse', async () => {
    vi.stubGlobal(
      'fetch',
      routen({
        verarbeiten: () =>
          nach(700, () => {
            throw new TypeError('Load failed')
          }),
      })
    )

    const { fehler, diagnose } = await lauf()

    expect(fehler?.message).toBe(IMAGE_NETWORK_ERROR)
    expect(diagnose).toEqual({
      schritt: 'abschluss',
      anlaeufe: [{ klasse: 'TypeError', meldung: 'Load failed', dauerMs: 700 }],
    })
  })
})

describe('Kennung — auch dort bleibt die Ursache erhalten', () => {
  // Eigene Modul-Instanz: Die Kennung wird je Seite gemerkt. Jeder Fall hier
  // scheitert an ihr, das Gedächtnis dieser Instanz bleibt also leer — egal,
  // ob ein anderer Block die Kennung schon geholt hat.
  let ladeFrisch: typeof ladeFotoHoch

  beforeAll(async () => {
    vi.resetModules()
    ;({ ladeFotoHoch: ladeFrisch } = await import('@/components/shared/image-upload'))
  }, 30_000)

  it('hält den HTTP-Status fest, wenn die Route ablehnt', async () => {
    vi.stubGlobal('fetch', routen({ kennung: () => nach(250, () => json({ error: 'Kein Zugriff' }, 403)) }))

    const { fehler, diagnose } = await lauf(ladeFrisch)

    expect(fehler?.message).toBe('Kein Zugriff')
    expect(upload).not.toHaveBeenCalled()
    expect(diagnose).toEqual({
      schritt: 'kennung',
      anlaeufe: [{ klasse: 'HttpAntwort', meldung: 'Kennung abgelehnt', status: 403, dauerMs: 250 }],
    })
  })

  it('nennt den Netzfehler mit seiner Klasse', async () => {
    vi.stubGlobal(
      'fetch',
      routen({
        kennung: () =>
          nach(600, () => {
            throw new TypeError('Load failed')
          }),
      })
    )

    const { fehler, diagnose } = await lauf(ladeFrisch)

    expect(fehler?.message).toBe(IMAGE_NETWORK_ERROR)
    expect(diagnose).toEqual({
      schritt: 'kennung',
      anlaeufe: [{ klasse: 'TypeError', meldung: 'Load failed', dauerMs: 600 }],
    })
  })
})

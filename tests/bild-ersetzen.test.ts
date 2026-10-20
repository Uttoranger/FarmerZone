/**
 * Ein ersetztes Foto bleibt liegen (Register N17, Ergänzung; Nachtlauf Nr. 108).
 *
 * Bis Nr. 108 löschte die Verarbeitungs-Route das alte Bild (`altUrl`) gleich
 * nach dem Ablegen des neuen — VOR dem Speichern von Produkt bzw. Hof.
 * Scheiterte das Speichern danach (Prüfung am Server, Netz), zeigte das
 * Produkt ein gelöschtes Bild. Jetzt löscht die Route nur noch das Original;
 * das ersetzte Bild bleibt als „Bild ohne Verwendung“ liegen (N18).
 *
 * Beweist:
 *  - Die Route ignoriert ein mitgeschicktes `altUrl`: Gelöscht wird nur das
 *    Original, auch wenn die alte Adresse im Zielordner des eigenen Hofs liegt.
 *  - Der Weg des Produktdialogs (ladeFotoHoch → echte Route, Blob-Speicher als
 *    Attrappe): Nach dem Hochladen des neuen Fotos liegt das alte noch im
 *    Speicher — scheitert das Speichern des Produkts, zeigt es weiter ein
 *    erreichbares Bild.
 *  - Antwortet die Route mit 422 `BILD_ZU_KLEIN`, liest der Hof den Satz mit
 *    der Mindestkante aus `STARTSEITE_MIN_KANTE` (eine Quelle).
 *  - Antwortet sie mit 422 `BILD_ZU_GROSS` (Pixelgrenze, Sicherheitsupdate
 *    20.10.2026), liest er den Satz `BILD_ZU_GROSS_TEXT`, und eine Serie nennt
 *    den Kurzgrund `BILD_ZU_GROSS_KURZ` statt „Format nicht unterstützt".
 *  - Der Browser gibt dem Bildspeicher den Typ aus den ersten Bytes mit, nie
 *    den des Geräts oder der Dateiendung: Ein GIF scheiterte sonst schon am
 *    Speicher (Token-Liste) mit einer falschen Meldung, statt an der Route mit
 *    der Formatmeldung.
 *
 * Gemockt ist nur die Infrastruktur: Sitzung, Datenbank, Blob-Speicher (eine
 * Menge von Adressen), sharp und fetch. Die Guards der Route laufen echt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const s = vi.hoisted(() => {
  const kette = {
    metadata: vi.fn(),
    rotate: vi.fn(),
    resize: vi.fn(),
    webp: vi.fn(),
    toBuffer: vi.fn(async () => Buffer.from('webp')),
  }
  kette.rotate.mockReturnValue(kette)
  kette.resize.mockReturnValue(kette)
  kette.webp.mockReturnValue(kette)
  /** Der Blob-Speicher: welche Adressen gerade erreichbar sind. */
  const speicher = new Set<string>()
  return { kette, speicher, blob: 'https://speicher.public.blob.vercel-storage.com' }
})

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findUnique: vi.fn() }, user: { findUnique: vi.fn() } } }))
vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (pfad: string) => {
    const url = `${s.blob}/${pfad}`
    s.speicher.add(url)
    return { url }
  }),
  del: vi.fn(async (url: string) => {
    s.speicher.delete(url)
  }),
}))
vi.mock('@vercel/blob/client', () => ({
  upload: vi.fn(async (pfad: string) => {
    const url = `${s.blob}/${pfad}`
    s.speicher.add(url)
    return { url }
  }),
}))
// block/unblock: Die Route sperrt beim Laden die fremden Lader (Sicherheitsupdate 20.10.2026).
vi.mock('sharp', () => ({ default: Object.assign(vi.fn(() => s.kette), { block: vi.fn(), unblock: vi.fn() }) }))

import { NextRequest } from 'next/server'
import { del, put } from '@vercel/blob'
import { upload } from '@vercel/blob/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  BILD_ZU_GROSS_KURZ,
  BILD_ZU_GROSS_TEXT,
  BILD_ZU_KLEIN_TEXT,
  ERLAUBTE_UPLOAD_TYPEN,
  STARTSEITE_MIN_KANTE,
  uploadInhaltsTyp,
} from '@/lib/upload-pfade'
import { bildFehlerMeldung } from '@/lib/upload-fehler'
import { ladeFotoHoch } from '@/components/shared/image-upload'
import { POST as verarbeitenPOST } from '@/app/api/upload/verarbeiten/route'

/** Erfundene Hof-Kennung im cuid-Format. */
const HOF = 'cltesthofkennung000000001'
const ORIGINAL = `${s.blob}/originals/${HOF}/product/foto-abc.jpg`
/** Das bisherige Produktfoto — im Zielordner des eigenen Hofs, also früher löschbar. */
const ALT = `${s.blob}/farms/${HOF}/product/alt.webp`

function anfrage(daten: object): NextRequest {
  return new NextRequest('http://localhost/api/upload/verarbeiten', { method: 'POST', body: JSON.stringify(daten) })
}

/** Ein Foto, wie es der Produktdialog nach pruefeLesbarkeit hält (die Kopie). */
function kopie(inhalt: number[] = [0xff, 0xd8, 0xff, 0xe0], typ = 'image/jpeg', name = 'Hof Test Eier.jpg'): File {
  return new File([new Uint8Array(inhalt)], name, { type: typ })
}

/** Mit welchem Typ der Browser das Original an den Bildspeicher gab. */
function hochgeladenAls(): unknown {
  const aufruf = vi.mocked(upload).mock.calls.at(-1)
  return (aufruf?.[2] as { contentType?: string } | undefined)?.contentType
}

/** fetch im Browser: unsere zwei Routen — die Verarbeitung ist die echte — und das Original aus dem Speicher. */
function netz(verarbeiten: (init: RequestInit) => Promise<Response>) {
  return vi.fn(async (adresse: string, init: RequestInit = {}) => {
    if (adresse === '/api/upload/token') return Response.json({ farmId: HOF })
    if (adresse === '/api/upload/verarbeiten') return verarbeiten(init)
    // Ein JPEG-Kopf: Die Route prüft die ersten Bytes vor sharp (Sicherheitsupdate 20.10.2026).
    if (s.speicher.has(adresse)) return new Response(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))
    return new Response(null, { status: 404 })
  })
}

const echteRoute = (init: RequestInit): Promise<Response> =>
  verarbeitenPOST(new NextRequest('http://localhost/api/upload/verarbeiten', { method: 'POST', body: init.body as string }))

beforeEach(() => {
  vi.clearAllMocks()
  s.speicher.clear()
  s.speicher.add(ALT)
  s.kette.metadata.mockResolvedValue({ width: 2400, height: 1800 })
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'hof-1', role: 'FARMER' } } as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: HOF } as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: false, createdAt: new Date('2020-01-01'), emailVerified: true } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Verarbeitungs-Route — das ersetzte Bild bleibt liegen', () => {
  it('ignoriert ein mitgeschicktes altUrl: gelöscht wird nur das Original', async () => {
    s.speicher.add(ORIGINAL)
    vi.stubGlobal('fetch', netz(echteRoute))

    const antwort = await verarbeitenPOST(anfrage({ url: ORIGINAL, zweck: 'product', altUrl: ALT }))

    expect(antwort.status).toBe(200)
    expect(put).toHaveBeenCalledTimes(1)
    expect(vi.mocked(del).mock.calls.map((aufruf) => aufruf[0])).toEqual([ORIGINAL])
    expect(s.speicher.has(ALT)).toBe(true)
  })

  it('Gegenprobe: das Original fällt auch im Fehlerfall weg — die Löschung selbst ist verdrahtet', async () => {
    s.speicher.add(ORIGINAL)
    vi.stubGlobal('fetch', netz(echteRoute))
    s.kette.toBuffer.mockRejectedValueOnce(new Error('kein Bild'))

    const antwort = await verarbeitenPOST(anfrage({ url: ORIGINAL, zweck: 'product', altUrl: ALT }))

    expect(antwort.status).toBe(415)
    expect(s.speicher.has(ORIGINAL)).toBe(false)
    expect(s.speicher.has(ALT)).toBe(true)
  })
})

describe('Foto hochladen (ladeFotoHoch wie im Produktdialog) — das alte Foto bleibt liegen', () => {
  // Geprüft wird nur der Upload; das Speichern des Produkts, das danach scheitern könnte, ist hier nicht Teil des Tests.
  it('das alte Foto liegt nach dem Hochladen des neuen noch im Speicher — ein Speichern, das scheitert, zeigt weiter ein erreichbares Bild', async () => {
    vi.stubGlobal('fetch', netz(echteRoute))

    // Derselbe Aufruf wie im Dialog beim Absenden: Kopie aus der Auswahl, Zweck 'product'.
    const neu = await ladeFotoHoch(kopie(), 'product', { weg: 'galerie', bereitsKopiert: true })
    // Danach scheitert updateProduct (Prüfung am Server) — das Produkt behält imageUrl = ALT.

    expect(neu).toMatch(new RegExp(`^${s.blob}/farms/${HOF}/product/`))
    expect(s.speicher.has(ALT)).toBe(true)
    expect(s.speicher.has(neu)).toBe(true)
    // Nur das Original ist weg — kein anderes Löschen.
    expect([...s.speicher].some((url) => url.includes('/originals/'))).toBe(false)
    expect(del).toHaveBeenCalledTimes(1)
  })
})

describe('Satz für zu kleine Bilder (Startseite, 422 BILD_ZU_KLEIN)', () => {
  it('ladeFotoHoch wirft bei 422 BILD_ZU_KLEIN den Satz mit der Mindestkante aus der Konstante', async () => {
    vi.stubGlobal(
      'fetch',
      netz(async () => Response.json({ error: 'Bild zu klein', code: 'BILD_ZU_KLEIN', art: 'format' }, { status: 422 }))
    )

    const fehler = await ladeFotoHoch(kopie(), 'startseite', { bereitsKopiert: true }).catch((e: unknown) => e as Error)

    expect((fehler as Error).message).toBe(BILD_ZU_KLEIN_TEXT)
    expect(BILD_ZU_KLEIN_TEXT).toContain(`mindestens ${STARTSEITE_MIN_KANTE} Pixel`)
  })

  it('ladeFotoHoch wirft bei 422 BILD_ZU_GROSS den Satz für zu große Fotos (Sicherheitsupdate 20.10.2026)', async () => {
    vi.stubGlobal(
      'fetch',
      netz(async () => Response.json({ error: 'Bild zu groß', code: 'BILD_ZU_GROSS', art: 'format' }, { status: 422 }))
    )

    const fehler = await ladeFotoHoch(kopie(), 'product', { bereitsKopiert: true }).catch((e: unknown) => e as Error)

    expect((fehler as Error).message).toBe(BILD_ZU_GROSS_TEXT)
    // In einer Serie (Galerie) steht der Kurzgrund in der Sammelmeldung.
    expect(bildFehlerMeldung(fehler).kurz).toBe(BILD_ZU_GROSS_KURZ)
  })

  it('Gegenprobe: ein anderer Formatfehler (415) behält seinen eigenen Text', async () => {
    vi.stubGlobal('fetch', netz(async () => Response.json({ error: 'Format nicht lesbar', art: 'format' }, { status: 415 })))

    const fehler = await ladeFotoHoch(kopie(), 'product', { bereitsKopiert: true }).catch((e: unknown) => e as Error)

    expect(fehler).toBeInstanceOf(Error)
    expect((fehler as Error).message).not.toBe(BILD_ZU_KLEIN_TEXT)
    expect((fehler as Error).message).not.toBe(BILD_ZU_GROSS_TEXT)
    expect(bildFehlerMeldung(fehler).kurz).not.toBe(BILD_ZU_GROSS_KURZ)
  })
})

describe('Typ für den Bildspeicher aus den ersten Bytes (Sicherheitsupdate 20.10.2026)', () => {
  it('ein JPEG geht als image/jpeg, auch wenn das Gerät keinen oder einen schiefen Typ meldet', async () => {
    vi.stubGlobal('fetch', netz(echteRoute))
    await ladeFotoHoch(kopie([0xff, 0xd8, 0xff, 0xe0], ''), 'product', { bereitsKopiert: true })
    expect(hochgeladenAls()).toBe('image/jpeg')
    await ladeFotoHoch(kopie([0xff, 0xd8, 0xff, 0xe0], 'image/jpg'), 'product', { bereitsKopiert: true })
    expect(hochgeladenAls()).toBe('image/jpeg')
  })

  it('ein fremdes Format (GIF) geht als application/octet-stream — die Route lehnt es an den Bytes ab, nicht der Speicher', async () => {
    vi.stubGlobal('fetch', netz(echteRoute))
    await ladeFotoHoch(kopie([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 'image/gif', 'bild.gif'), 'product', { bereitsKopiert: true })
    expect(hochgeladenAls()).toBe('application/octet-stream')
  })

  it('jeder Typ, den der Browser angibt, steht auf der Liste des Tokens', () => {
    for (const format of ['jpeg', 'png', 'webp', 'heic', null] as const) {
      expect(ERLAUBTE_UPLOAD_TYPEN, String(format)).toContain(uploadInhaltsTyp(format))
    }
    expect(uploadInhaltsTyp('png')).toBe('image/png')
    expect(uploadInhaltsTyp('webp')).toBe('image/webp')
  })
})

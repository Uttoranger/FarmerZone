/**
 * Tests für den URL-Guard und die Zweck-Tabelle (src/lib/upload-pfade.ts).
 *
 * Der Guard ist die Sperre der Verarbeitungs-Route. Sie bekommt vom Client eine
 * Adresse und lädt sie herunter — ohne Guard wäre das ein Werkzeug, mit dem
 * sich beliebige fremde Adressen von unserem Server abrufen ließen, und ein
 * angemeldeter Bauer könnte die Originale eines anderen Hofes verarbeiten und
 * sich als eigenes Bild ablegen lassen.
 *
 * Reine Funktion, kein Netzzugriff — deshalb hier vollständig prüfbar. Sie
 * entscheidet, BEVOR irgendetwas geladen wird.
 *
 * Seit Nr. 294b (N7) zählt dazu der eigene Speicher: Das Host-Muster allein
 * trifft jeden Blob-Speicher bei Vercel, auch einen fremden, in dem jemand
 * den Pfad `originals/<unsereHofId>/…` frei wählen kann. Am Ende prüft je ein
 * Fall an der echten Route, dass eine solche Adresse nicht einmal geladen wird.
 */
import { adminSitzung } from './admin-sitzung'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
// Der Startseiten-Weg prüft über die echte Admin-Wache (Passkey der Sitzung) — Sitzung aus tests/admin-sitzung.ts.
vi.mock('@/lib/prisma', async () => ({
  prisma: { farm: { findUnique: vi.fn() }, user: { findUnique: vi.fn() }, session: { deleteMany: vi.fn() }, ...(await import('./admin-sitzung')).passkeyAttrappen() },
}))
vi.mock('@vercel/blob', () => ({ put: vi.fn(), del: vi.fn() }))

import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { POST as verarbeitenPOST } from '@/app/api/upload/verarbeiten/route'
import {
  MAX_LONG_SIDE,
  MAX_ORIGINAL_BYTES,
  UPLOAD_ZWECKE,
  WEBP_QUALITAET,
  darfGeloeschtWerden,
  darfStartseitenBildVerarbeitetWerden,
  darfVerarbeitetWerden,
  istUploadZweck,
  originalPfad,
  originalPrefix,
  zielPfad,
} from '@/lib/upload-pfade'

const HOF = 'farm_meiner'
const FREMD = 'farm_fremder'
const SPEICHER = 'abc123'
const BLOB = `https://${SPEICHER}.public.blob.vercel-storage.com`
// Ein anderer Blob-Speicher bei Vercel: passt aufs Host-Muster, ist aber nicht unserer.
const FREMDER_BLOB = 'https://fremd999.public.blob.vercel-storage.com'

describe('darfVerarbeitetWerden — fremde Hosts', () => {
  it('lehnt einen fremden Host ab', () => {
    expect(darfVerarbeitetWerden(`https://beispiel.at/originals/${HOF}/foto.jpg`, HOF, SPEICHER)).toBe(false)
    expect(darfVerarbeitetWerden(`https://localhost/originals/${HOF}/foto.jpg`, HOF, SPEICHER)).toBe(false)
  })

  it('lehnt einen Host ab, der unseren nur als Anhängsel trägt', () => {
    // Der klassische Trick: eigener Server, der wie unserer aussieht.
    expect(
      darfVerarbeitetWerden(`https://public.blob.vercel-storage.com.boese.at/originals/${HOF}/x.jpg`, HOF, SPEICHER)
    ).toBe(false)
    expect(
      darfVerarbeitetWerden(`https://boese.at/abc.public.blob.vercel-storage.com/originals/${HOF}/x.jpg`, HOF, SPEICHER)
    ).toBe(false)
  })

  it('lehnt alles ab, was nicht https ist', () => {
    expect(darfVerarbeitetWerden(`http://abc.public.blob.vercel-storage.com/originals/${HOF}/x.jpg`, HOF, SPEICHER)).toBe(false)
    // Kein Abruf lokaler Dateien über den Server
    expect(darfVerarbeitetWerden(`file:///etc/passwd`, HOF, SPEICHER)).toBe(false)
  })

  it('lehnt Müll und Leeres ab, statt zu werfen', () => {
    expect(darfVerarbeitetWerden('', HOF, SPEICHER)).toBe(false)
    expect(darfVerarbeitetWerden('kein-url', HOF, SPEICHER)).toBe(false)
    expect(darfVerarbeitetWerden('///', HOF, SPEICHER)).toBe(false)
  })
})

describe('darfVerarbeitetWerden — fremde Höfe', () => {
  it('lehnt den Originale-Ordner eines anderen Hofes ab', () => {
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${FREMD}/product/foto.jpg`, HOF, SPEICHER)).toBe(false)
  })

  it('lässt sich nicht durch einen untergeschobenen Pfad täuschen', () => {
    // Der eigene Präfix steht drin — aber nicht am Anfang. Ein `includes`
    // würde hier durchwinken und fremde Originale verarbeiten lassen.
    expect(
      darfVerarbeitetWerden(`${BLOB}/originals/${FREMD}/originals/${HOF}/foto.jpg`, HOF, SPEICHER)
    ).toBe(false)
  })

  it('lehnt einen Hof ab, dessen Kennung mit der eigenen beginnt', () => {
    // `farm_meiner` ist ein Präfix von `farm_meiner2` — ohne den Schrägstrich
    // im Präfix ginge der fremde Hof durch.
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${HOF}2/product/foto.jpg`, HOF, SPEICHER)).toBe(false)
  })

  it('lehnt den ZIEL-Ordner ab — verarbeitet wird nur, was im Originale-Ordner liegt', () => {
    expect(darfVerarbeitetWerden(`${BLOB}/farms/${HOF}/product/fertig.webp`, HOF, SPEICHER)).toBe(false)
  })
})

describe('darfVerarbeitetWerden — der eigene Pfad', () => {
  it('erlaubt den eigenen Originale-Ordner', () => {
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${HOF}/product/foto.jpg`, HOF, SPEICHER)).toBe(true)
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${HOF}/banner/foto-Ab12.jpg`, HOF, SPEICHER)).toBe(true)
  })

  it('erlaubt genau den Pfad, den originalPfad baut', () => {
    // Die beiden müssen zusammenpassen — sonst kann der Client hochladen, was
    // die Verarbeitung anschließend ablehnt.
    const pfad = originalPfad(HOF, 'banner', 'Bewegungsaufnahme 4.jpg')
    expect(darfVerarbeitetWerden(`${BLOB}/${pfad}`, HOF, SPEICHER)).toBe(true)
  })

  it('erlaubt auch einen prozentkodierten Pfad', () => {
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${HOF}/product/foto%20neu.jpg`, HOF, SPEICHER)).toBe(true)
  })
})

describe('darfGeloeschtWerden — das ersetzte Bild', () => {
  it('erlaubt nur den Zielordner des eigenen Hofes', () => {
    expect(darfGeloeschtWerden(`${BLOB}/farms/${HOF}/logo/1.webp`, HOF)).toBe(true)
    expect(darfGeloeschtWerden(`${BLOB}/farms/${FREMD}/logo/1.webp`, HOF)).toBe(false)
  })

  it('lehnt fremde Hosts ab — strenger als die alte Route, die nur den Host prüfte', () => {
    expect(darfGeloeschtWerden(`https://beispiel.at/farms/${HOF}/logo/1.webp`, HOF)).toBe(false)
  })
})

describe('Pfad-Schema', () => {
  it('legt Originale unter originals/{farmId}/{zweck}/ ab', () => {
    expect(originalPrefix(HOF)).toBe(`originals/${HOF}/`)
    expect(originalPfad(HOF, 'logo', 'bild.jpg')).toBe(`originals/${HOF}/logo/bild.jpg`)
  })

  it('entschärft den Dateinamen vom Gerät', () => {
    // Er stammt vom Telefon des Bauern und darf den Pfad nicht verlassen.
    const pfad = originalPfad(HOF, 'product', '../../../etc/passwd')
    expect(pfad.startsWith(originalPrefix(HOF))).toBe(true)
    expect(pfad).not.toContain('..')
    expect(darfVerarbeitetWerden(`${BLOB}/${pfad}`, HOF, SPEICHER)).toBe(true)
  })

  it('kommt mit einem leeren Dateinamen zurecht', () => {
    expect(originalPfad(HOF, 'status', '')).toBe(`originals/${HOF}/status/foto`)
  })

  it('behält das bisherige Zielschema farms/{farmId}/{zweck}/', () => {
    const ziel = zielPfad(HOF, 'gallery')
    expect(ziel.startsWith(`farms/${HOF}/gallery/`)).toBe(true)
    expect(ziel.endsWith('.webp')).toBe(true)
  })
})

describe('Zweck-Tabelle', () => {
  it('übernimmt die bisherigen Werte unverändert', () => {
    // Dieser Umbau verlagert die Verkleinerung auf den Server — er ändert
    // NICHT, wie groß die Bilder werden. Die Zahlen sind dieselben wie in der
    // bisherigen clientseitigen MAX_LONG_SIDE-Tabelle.
    expect(MAX_LONG_SIDE).toEqual({
      logo: 800,
      product: 2400,
      banner: 3200,
      gallery: 2400,
      status: 2400,
      // Sprint fehlerbriefkasten: Screenshots zu Meldungen — 1600px reichen,
      // um einen Bildschirm lesbar zu zeigen; die bisherigen Werte bleiben.
      meldung: 1600,
      // Nr. 96 (Register N16): Bilder der Startseite, quadratisch, lange Kante 1600.
      startseite: 1600,
    })
    expect(WEBP_QUALITAET).toBe(82)
  })

  it('hält das Titelbild über allen anderen Zwecken', () => {
    const andere = UPLOAD_ZWECKE.filter((z) => z !== 'banner').map((z) => MAX_LONG_SIDE[z])

    expect(Math.max(...andere)).toBeLessThan(MAX_LONG_SIDE.banner)
  })

  it('kennt für jeden Zweck eine Auflösung', () => {
    for (const zweck of UPLOAD_ZWECKE) {
      expect(typeof MAX_LONG_SIDE[zweck]).toBe('number')
    }
  })

  it('lässt das Original 25 MB groß sein — kein Verkleinern mehr davor', () => {
    expect(MAX_ORIGINAL_BYTES).toBe(25 * 1024 * 1024)
  })

  it('erkennt nur echte Zwecke', () => {
    expect(istUploadZweck('banner')).toBe(true)
    expect(istUploadZweck('gibts-nicht')).toBe(false)
    expect(istUploadZweck(null)).toBe(false)
    expect(istUploadZweck(42)).toBe(false)
  })
})

describe('darfVerarbeitetWerden — nur aus dem eigenen Speicher (Nr. 294b, N7)', () => {
  it('lehnt einen fremden Blob-Speicher ab, auch mit dem richtigen Pfad des eigenen Hofes', () => {
    expect(darfVerarbeitetWerden(`${FREMDER_BLOB}/originals/${HOF}/product/foto.jpg`, HOF, SPEICHER)).toBe(false)
  })

  it('erlaubt denselben Pfad im eigenen Speicher', () => {
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${HOF}/product/foto.jpg`, HOF, SPEICHER)).toBe(true)
  })

  it('lehnt ohne bekannten Speicher alles ab', () => {
    // Fail-closed: Ohne Schlüssel gibt es auch keinen Upload, also kein eigenes Original.
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${HOF}/product/foto.jpg`, HOF, null)).toBe(false)
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${HOF}/product/foto.jpg`, HOF, '')).toBe(false)
  })

  it('lehnt Abfrage, Anker und Anmeldedaten ab — nichts davon erzeugt unser Upload', () => {
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${HOF}/product/foto.jpg?x=1`, HOF, SPEICHER)).toBe(false)
    expect(darfVerarbeitetWerden(`${BLOB}/originals/${HOF}/product/foto.jpg#a`, HOF, SPEICHER)).toBe(false)
    expect(
      darfVerarbeitetWerden(`https://user@${SPEICHER}.public.blob.vercel-storage.com/originals/${HOF}/product/foto.jpg`, HOF, SPEICHER)
    ).toBe(false)
  })

  it('erlaubt den eigenen Speicher auch mit Großbuchstaben im Hostnamen', () => {
    expect(
      darfVerarbeitetWerden(`https://ABC123.Public.Blob.Vercel-Storage.com/originals/${HOF}/product/foto.jpg`, HOF, SPEICHER)
    ).toBe(true)
  })
})

describe('darfStartseitenBildVerarbeitetWerden — nur aus dem eigenen Speicher (Nr. 294b, N7)', () => {
  const PFAD = 'startseite/originale/foto.jpg'

  it('lehnt einen fremden Blob-Speicher ab, auch mit dem Ordner der Startseite', () => {
    expect(darfStartseitenBildVerarbeitetWerden(`${FREMDER_BLOB}/${PFAD}`, SPEICHER)).toBe(false)
  })

  it('erlaubt den Ordner der Startseite im eigenen Speicher', () => {
    expect(darfStartseitenBildVerarbeitetWerden(`${BLOB}/${PFAD}`, SPEICHER)).toBe(true)
  })

  it('lehnt ohne bekannten Speicher alles ab', () => {
    expect(darfStartseitenBildVerarbeitetWerden(`${BLOB}/${PFAD}`, null)).toBe(false)
    expect(darfStartseitenBildVerarbeitetWerden(`${BLOB}/${PFAD}`, '')).toBe(false)
  })

  it('lehnt Abfrage, Anker und Anmeldedaten ab', () => {
    expect(darfStartseitenBildVerarbeitetWerden(`${BLOB}/${PFAD}?x=1`, SPEICHER)).toBe(false)
    expect(darfStartseitenBildVerarbeitetWerden(`${BLOB}/${PFAD}#a`, SPEICHER)).toBe(false)
    expect(
      darfStartseitenBildVerarbeitetWerden(`https://user@${SPEICHER}.public.blob.vercel-storage.com/${PFAD}`, SPEICHER)
    ).toBe(false)
  })

  it('erlaubt den eigenen Speicher auch mit Großbuchstaben im Hostnamen', () => {
    expect(darfStartseitenBildVerarbeitetWerden(`https://ABC123.Public.Blob.Vercel-Storage.com/${PFAD}`, SPEICHER)).toBe(true)
  })

  it('lehnt im eigenen Speicher einen Hof-Ordner ab — wie bisher', () => {
    expect(darfStartseitenBildVerarbeitetWerden(`${BLOB}/originals/${HOF}/product/foto.jpg`, SPEICHER)).toBe(false)
  })
})

describe('Verarbeitungs-Route — ein Original aus fremdem Speicher wird nicht geladen (Nr. 294b, N7)', () => {
  const abruf = vi.fn(async () => new Response('fehlt', { status: 404 }))

  function anfrage(daten: object): NextRequest {
    return new NextRequest('http://localhost/api/upload/verarbeiten', { method: 'POST', body: JSON.stringify(daten) })
  }

  function alsHof(): void {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'hof-1', role: 'FARMER' } } as never)
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: HOF } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: false, createdAt: new Date('2020-01-01'), emailVerified: true } as never)
  }

  function alsAdminOhneHof(): void {
    vi.mocked(auth.api.getSession).mockResolvedValue(adminSitzung('admin-1', { role: 'CUSTOMER' }) as never)
    vi.mocked(prisma.farm.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: true, adminInhaber: true, createdAt: new Date('2020-01-01'), emailVerified: true } as never)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', abruf)
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', `vercel_blob_rw_${SPEICHER}_nurFuerTests`)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('lehnt ein Hof-Original aus fremdem Speicher ab, ohne es abzurufen', async () => {
    alsHof()

    const antwort = await verarbeitenPOST(anfrage({ url: `${FREMDER_BLOB}/originals/${HOF}/product/foto.jpg`, zweck: 'product' }))

    expect(antwort.status).toBe(403)
    expect(await antwort.json()).toEqual({ error: 'URL nicht erlaubt', art: 'server' })
    expect(abruf).not.toHaveBeenCalled()
  })

  it('ruft dasselbe Original aus dem eigenen Speicher ab (Gegenprobe)', async () => {
    alsHof()
    const url = `${BLOB}/originals/${HOF}/product/foto.jpg`

    await verarbeitenPOST(anfrage({ url, zweck: 'product' }))

    expect(abruf).toHaveBeenCalledTimes(1)
    expect(abruf).toHaveBeenCalledWith(url)
  })

  it('lehnt ohne Blob-Schlüssel auch den eigenen Speicher ab, ohne abzurufen', async () => {
    alsHof()
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')

    const antwort = await verarbeitenPOST(anfrage({ url: `${BLOB}/originals/${HOF}/product/foto.jpg`, zweck: 'product' }))

    expect(antwort.status).toBe(403)
    expect(abruf).not.toHaveBeenCalled()
  })

  it('lehnt ein Startseiten-Original aus fremdem Speicher ab, ohne es abzurufen', async () => {
    alsAdminOhneHof()

    const antwort = await verarbeitenPOST(anfrage({ url: `${FREMDER_BLOB}/startseite/originale/foto.jpg`, zweck: 'startseite' }))

    expect(antwort.status).toBe(403)
    expect(await antwort.json()).toEqual({ error: 'URL nicht erlaubt', art: 'server' })
    expect(abruf).not.toHaveBeenCalled()
  })

  it('ruft ein Startseiten-Original aus dem eigenen Speicher ab (Gegenprobe)', async () => {
    alsAdminOhneHof()
    const url = `${BLOB}/startseite/originale/foto.jpg`

    await verarbeitenPOST(anfrage({ url, zweck: 'startseite' }))

    expect(abruf).toHaveBeenCalledTimes(1)
    expect(abruf).toHaveBeenCalledWith(url)
  })
})

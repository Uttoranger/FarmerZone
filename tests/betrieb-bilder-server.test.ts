/**
 * Bilder ohne Verwendung an den Systemgrenzen (Register N18, Nr. 104) — mit
 * gemockter Datenbank und gemocktem `list()` von @vercel/blob.
 *
 * Beweist:
 *  - Die Messung zählt die Bilder ohne Verwendung aus DERSELBEN Auflistung
 *    (keine zweite Runde) und schreibt ihre Summen als BetriebMessung — nur
 *    in der Produktion; in der Vorschau keine Liste und keine Abfrage.
 *  - Je Feld eine Abfrage, nur die Adresse; Fassungen über jede `bildUrl`.
 *  - Scheitert eine Abfrage der Adressen, bleiben die Werte des Speichers
 *    (Sentry: fester Satz, nur die Klasse).
 *  - „Liste als CSV“: ohne Admin 403, außerhalb der Produktion 404 — beide
 *    ohne Auflistung; sonst nur die gezählten Arten, Pfad ohne Domain,
 *    no-store, als Datei, und die Auflistung zählt als Bild-Vorgang.
 *  - Scheitert die Auflistung (Nr. 113): 500 mit festem Satz, nach Sentry nur
 *    die Klasse unter einem festen Satz, ohne Anfrage-Daten (`ohneAnfrage`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  betriebMessung: { aggregate: vi.fn() },
  farm: { findMany: vi.fn() },
  product: { findMany: vi.fn() },
  statusPost: { findMany: vi.fn() },
  farmPhoto: { findMany: vi.fn() },
  meldung: { findMany: vi.fn() },
  startseiteBlock: { findMany: vi.fn() },
  startseiteFassung: { findMany: vi.fn() },
}))
const wache = vi.hoisted(() => ({ verlangeAdminAktion: vi.fn() }))
const umgebung = vi.hoisted(() => ({ vercelProduktion: true }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@vercel/blob', () => ({ list: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendBetriebWarnung: vi.fn() }))
vi.mock('@/server/queries/postfach', () => ({ ladeBetreiberEmpfaenger: vi.fn(async () => []) }))
vi.mock('@/server/admin-wache', () => wache)
vi.mock('@/lib/umgebung-server', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/lib/umgebung-server')>()
  return {
    ...echt,
    get UMGEBUNG() {
      return { ...echt.UMGEBUNG, vercelProduktion: umgebung.vercelProduktion }
    },
  }
})

import { list } from '@vercel/blob'
import * as Sentry from '@sentry/nextjs'
import { messeBetrieb } from '@/server/betrieb'
import { GET as bilderExport } from '@/app/admin/betrieb/bilder-export/route'
import { ohneAnfrage } from '@/lib/sentry-hygiene'

const JETZT = new Date('2026-10-16T04:05:00.000Z')
const SPEICHER = 'https://speicher.public.blob.vercel-storage.com'

function werteVon(aufruf: unknown[]): unknown[] {
  const [teile, ...werte] = aufruf as [TemplateStringsArray, ...unknown[]]
  return Prisma.sql(teile, ...werte).values
}

function blob(pathname: string, size: number, uploadedAt: string) {
  return { pathname, url: `${SPEICHER}/${pathname}`, downloadUrl: '', size, uploadedAt: new Date(uploadedAt), contentType: 'image/webp', contentDisposition: '', etag: '' }
}

/** Paare (Art, Wert) aus der Anweisung, die alle Messwerte schreibt. */
function geschriebeneWerte(): Map<unknown, unknown> {
  const aufruf = db.$executeRaw.mock.calls.find((c) => werteVon(c).includes('bilderBytes'))
  const werte = aufruf ? werteVon(aufruf) : []
  const paare = new Map<unknown, unknown>()
  for (let i = 0; i < werte.length; i += 4) paare.set(werte[i + 1], werte[i + 2])
  return paare
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  umgebung.vercelProduktion = true
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_platzhalter')
  wache.verlangeAdminAktion.mockResolvedValue({ ok: true, userId: 'admin_1' })
  db.$queryRaw.mockResolvedValue([{ bytes: BigInt(46_000_000) }])
  db.$executeRaw.mockResolvedValue(1)
  db.betriebMessung.aggregate.mockResolvedValue({ _sum: { wert: BigInt(2) } })
  db.farm.findMany.mockImplementation(async ({ select }: { select: Record<string, true> }) => {
    if (select.id) return [{ id: 'hofa' }]
    if (select.bannerValue) return [{ bannerValue: 'verlauf-wiese' }, { bannerValue: `${SPEICHER}/farms/hofa/banner/titel.webp` }]
    return []
  })
  db.product.findMany.mockResolvedValue([{ imageUrl: `${SPEICHER}/farms/hofa/product/benutzt.webp` }])
  db.statusPost.findMany.mockResolvedValue([])
  db.farmPhoto.findMany.mockResolvedValue([])
  db.meldung.findMany.mockResolvedValue([])
  db.startseiteBlock.findMany.mockResolvedValue([])
  db.startseiteFassung.findMany.mockResolvedValue([{ inhalt: { v: 1, abschnitte: [{ block: { bildUrl: `${SPEICHER}/startseite/bilder/f.webp` } }] } }])
  vi.mocked(list)
    .mockResolvedValueOnce({
      blobs: [
        blob('farms/hofa/product/benutzt.webp', 1_000, '2026-08-01T10:00:00Z'),
        blob('farms/hofa/product/alt.webp', 4_000, '2026-08-03T10:00:00Z'),
        blob('farms/hofa/banner/titel.webp', 2_000, '2026-08-01T10:00:00Z'),
      ],
      hasMore: true,
      cursor: 'seite-2',
    } as never)
    .mockResolvedValueOnce({
      blobs: [
        blob('farms/hofa/product/neu.webp', 8_000, '2026-10-12T10:00:00Z'),
        blob('farms/geloescht/logo/x.webp', 16_000, '2026-07-01T10:00:00Z'),
        blob('startseite/bilder/f.webp', 32_000, '2026-07-01T10:00:00Z'),
      ],
      hasMore: false,
    } as never)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('messeBetrieb und die Bilder ohne Verwendung', () => {
  it('in der Produktion: aus derselben Auflistung gezählt und als Summen geschrieben', async () => {
    const ergebnis = await messeBetrieb(JETZT, { produktion: true })

    expect(list).toHaveBeenCalledTimes(2)
    expect(ergebnis.fehler).toEqual([])
    const werte = geschriebeneWerte()
    expect(werte.get('bilderBytes')).toBe(BigInt(63_000))
    // Nur das 6 Tage alte „neu“ fehlt; benutzt (Produkt, bannerValue, Fassung) zählt nicht.
    expect(werte.get('ohneVerwendung:produktfotos:dateien')).toBe(BigInt(1))
    expect(werte.get('ohneVerwendung:produktfotos:bytes')).toBe(BigInt(4_000))
    expect(werte.get('ohneVerwendung:titelbilder:dateien')).toBe(BigInt(0))
    expect(werte.get('ohneVerwendung:unbekannterHof:bytes')).toBe(BigInt(16_000))
    expect(werte.get('ohneVerwendung:startseite:dateien')).toBe(BigInt(0))
    expect(werte.get('ohneVerwendung:aelteste')).toBe(BigInt(new Date('2026-08-03T10:00:00Z').getTime()))
  })

  it('je Feld eine Abfrage, nur die Adresse', async () => {
    await messeBetrieb(JETZT, { produktion: true })

    const felder = [
      ...db.farm.findMany.mock.calls.map(([a]) => Object.keys(a.select)),
      ...[db.product, db.statusPost, db.farmPhoto, db.meldung, db.startseiteBlock, db.startseiteFassung].map((t) => Object.keys(t.findMany.mock.calls[0][0].select)),
    ]
    expect(felder.sort()).toEqual([['bannerUrl'], ['bannerValue'], ['bildUrl'], ['id'], ['imageUrl'], ['inhalt'], ['logoUrl'], ['photoUrl'], ['screenshotUrl'], ['url']])
  })

  it('in der Vorschau: keine Liste und keine Abfrage der Adressen', async () => {
    await messeBetrieb(JETZT, { produktion: false })

    expect(db.farm.findMany).not.toHaveBeenCalled()
    expect(db.product.findMany).not.toHaveBeenCalled()
    expect([...geschriebeneWerte().keys()].some((art) => String(art).startsWith('ohneVerwendung:'))).toBe(false)
  })

  it('scheitert eine Abfrage der Adressen, bleiben die Werte des Speichers — Sentry nur mit der Klasse', async () => {
    db.product.findMany.mockRejectedValue(Object.assign(new Error('geheimer Text farms/hofa'), { name: 'PrismaClientKnownRequestError' }))

    const ergebnis = await messeBetrieb(JETZT, { produktion: true })

    expect(ergebnis.fehler).toEqual([])
    expect(geschriebeneWerte().get('bilderBytes')).toBe(BigInt(63_000))
    const [fehler] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error]
    expect([fehler.message, fehler.name]).toEqual(['Betrieb: Bilder ohne Verwendung nicht gezählt', 'PrismaClientKnownRequestError'])
  })
})

describe('„Liste als CSV“ (/admin/betrieb/bilder-export)', () => {
  it('ohne Admin-Recht: 403 ohne Inhalt und ohne Auflistung', async () => {
    wache.verlangeAdminAktion.mockResolvedValue({ error: 'Kein Zugriff.' })
    const antwort = await bilderExport()
    expect(antwort.status).toBe(403)
    expect(await antwort.text()).toBe('Kein Zugriff.')
    expect(list).not.toHaveBeenCalled()
  })

  it('außerhalb der Produktion: 404, keine Auflistung', async () => {
    umgebung.vercelProduktion = false
    const antwort = await bilderExport()
    expect(antwort.status).toBe(404)
    expect(antwort.headers.get('Cache-Control')).toBe('no-store')
    expect(list).not.toHaveBeenCalled()
  })

  it('in der Produktion: nur die gezählten Arten, Pfad ohne Domain, no-store, als Datei', async () => {
    const antwort = await bilderExport()

    expect(antwort.status).toBe(200)
    expect(antwort.headers.get('Cache-Control')).toBe('no-store')
    expect(antwort.headers.get('Content-Disposition')).toBe('attachment; filename="bilder-ohne-verwendung-2026-10-16.csv"')
    const text = await antwort.text()
    expect(text.replace(/^﻿/, '').trim().split('\r\n')).toEqual(['Art;Pfad;Größe (Bytes);hochgeladen', 'Produktfotos;farms/hofa/product/alt.webp;4000;2026-08-03'])
    expect(text).not.toContain(SPEICHER)
    // Die zwei Seiten der Auflistung zählen als Bild-Vorgänge.
    expect(werteVon(db.$executeRaw.mock.calls[0])).toEqual(['2026-10-16', 2, JETZT])
  })

  it('scheitert die Auflistung: 500 mit festem Satz, kein Inhalt — Sentry nur mit Klasse unter festem Satz, ohne Anfrage-Daten', async () => {
    vi.mocked(list)
      .mockReset()
      .mockRejectedValueOnce(Object.assign(new Error(`${SPEICHER}/farms/hofa/product/alt.webp nicht lesbar`), { name: 'BlobServiceNotAvailable' }))
    const antwort = await bilderExport()

    expect(antwort.status).toBe(500)
    expect(antwort.headers.get('Cache-Control')).toBe('no-store')
    expect(await antwort.text()).toBe('Die Liste ließ sich gerade nicht erstellen. Versuch es in ein paar Minuten noch einmal.')
    const [fehler, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] as unknown as [Error, (scope: unknown) => unknown]
    expect([fehler.name, fehler.message]).toEqual(['BlobServiceNotAvailable', 'Betrieb: Liste der Bilder ohne Verwendung gescheitert'])
    const scope = { setLevel: vi.fn(() => scope), setTags: vi.fn(() => scope), addEventProcessor: vi.fn(() => scope) }
    kontext(scope)
    expect(scope.setTags).toHaveBeenCalledWith({ bereich: 'betrieb', quelle: 'bilderExport' })
    expect(scope.addEventProcessor).toHaveBeenCalledWith(ohneAnfrage)
  })
})

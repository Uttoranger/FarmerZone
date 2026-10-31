/**
 * /api/status-image/[id] (Nr. 178): dieselbe Sichtbarkeit wie die Hofseite.
 *
 * Beweist (Datenbank und Bild gemockt — die Abfrage ist die Aussage):
 *  - Die Abfrage verlangt den öffentlich sichtbaren Hof (OEFFENTLICH_SICHTBAR:
 *    aktiv, freigeschaltet, nicht stillgelegt) und einen aktiven Beitrag
 *    (AKTIVER_BEITRAG: veröffentlicht, nicht abgelaufen, auf der Hofseite) —
 *    sonst kein Treffer und 404.
 *  - Ein Testhof (N21) nur für sein eigenes Konto: Fremde und Abgemeldete
 *    bekommen 404, der Hof selbst sein Bild.
 *  - Gegenprobe: ein sichtbarer Beitrag eines echten Hofs ergibt ein Bild,
 *    ohne nach der Sitzung zu fragen.
 *  - Nr. 203: Zusätzlich zur Bedingung liest die Route die Sichtbarkeit des
 *    gelesenen Hofs über `hofSichtbar` (N36) — ein geschlossener oder
 *    stillgelegter Hof gibt 404, auch für sein eigenes Konto; ein nicht
 *    freigeschalteter Hof trifft die Bedingung nicht (404).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/og', () => ({
  ImageResponse: class extends Response {
    constructor() {
      super('bild', { status: 200, headers: { 'content-type': 'image/png' } })
    }
  },
}))
vi.mock('@/lib/marke-bild', () => ({ MARKE_RUNDUNG_PROZENT: 22, ladeMarkeDataUrl: vi.fn(async () => 'data:image/png;base64,') }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { statusPost: { findFirst: vi.fn() } } }))

import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OEFFENTLICH_SICHTBAR } from '@/server/queries/farm'
import { GET } from '@/app/api/status-image/[id]/route'

const findFirst = vi.mocked(prisma.statusPost.findFirst)
const getSession = vi.mocked(auth.api.getSession)

const anfrage = (): NextRequest => new Request('http://localhost/api/status-image/beitrag_1') as unknown as NextRequest
const aufruf = () => GET(anfrage(), { params: Promise.resolve({ id: 'beitrag_1' }) })
const beitrag = (istTesthof: boolean, hof: { archivedAt?: Date | null; geschlossenAm?: Date | null } = {}) => ({
  title: 'Erdbeeren sind da',
  body: 'Frisch vom Feld.',
  anlass: 'FRESH_PRODUCT',
  farm: { name: 'Testhof A', istTesthof, ownerId: 'besitzer_1', archivedAt: null, geschlossenAm: null, ...hof },
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('status-image: Sichtbarkeit wie die Hofseite', () => {
  it('fragt nur sichtbare Höfe und aktive Beiträge — ohne Treffer 404', async () => {
    findFirst.mockResolvedValue(null)
    expect((await aufruf()).status).toBe(404)
    const wo = findFirst.mock.calls[0][0]!.where!
    expect(wo.id).toBe('beitrag_1')
    expect(wo.farm).toEqual(OEFFENTLICH_SICHTBAR)
    const aktiv = (wo.AND as Array<Record<string, unknown>>)[0]
    expect(aktiv).toMatchObject({ showOnFarmPage: true, publishedAt: { lte: expect.any(Date) } })
    expect(aktiv.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }])
  })

  it('Testhof: Fremde und Abgemeldete 404, das eigene Konto bekommt das Bild', async () => {
    findFirst.mockResolvedValue(beitrag(true) as never)
    getSession.mockResolvedValueOnce(null as never)
    expect((await aufruf()).status).toBe(404)
    getSession.mockResolvedValueOnce({ user: { id: 'fremd_1' } } as never)
    expect((await aufruf()).status).toBe(404)
    getSession.mockResolvedValueOnce({ user: { id: 'besitzer_1' } } as never)
    expect((await aufruf()).status).toBe(200)
  })

  it('Gegenprobe: ein sichtbarer Beitrag eines echten Hofs ergibt ein Bild, ohne Sitzung', async () => {
    findFirst.mockResolvedValue(beitrag(false) as never)
    const antwort = await aufruf()
    expect(antwort.status).toBe(200)
    expect(antwort.headers.get('content-type')).toBe('image/png')
    expect(getSession).not.toHaveBeenCalled()
  })
})

describe('status-image: geschlossen, stillgelegt, nicht freigeschaltet (Nr. 203)', () => {
  it('liest archivedAt und geschlossenAm des Hofs mit, die Bedingung verlangt die Freischaltung', async () => {
    findFirst.mockResolvedValue(null)
    expect((await aufruf()).status).toBe(404)
    const anfrage = findFirst.mock.calls[0][0]!
    expect(anfrage.where!.farm).toMatchObject({ approvedAt: { not: null }, archivedAt: null, geschlossenAm: null })
    expect(anfrage.select!.farm).toEqual({ select: expect.objectContaining({ archivedAt: true, geschlossenAm: true }) })
  })

  it.each([
    ['geschlossen', { geschlossenAm: new Date('2026-10-01T00:00:00Z') }],
    ['stillgelegt', { archivedAt: new Date('2026-10-01T00:00:00Z') }],
  ])('ein %ser Hof gibt 404 — auch für sein eigenes Konto', async (_art, hof) => {
    findFirst.mockResolvedValue(beitrag(false, hof) as never)
    expect((await aufruf()).status).toBe(404)
    findFirst.mockResolvedValue(beitrag(true, hof) as never)
    getSession.mockResolvedValue({ user: { id: 'besitzer_1' } } as never)
    expect((await aufruf()).status).toBe(404)
  })
})

/**
 * Die Cron-Routen hinter der Frist (src/lib/fristen.ts):
 * - /api/cron/verwaiste-bestellungen (neu) gibt einmal täglich für alle Höfe frei;
 * - /api/cron/cleanup-reservations räumt verfallene Reservierungen weg.
 *
 * Beide vergleichen das CRON_SECRET in konstanter Zeit (`cronBerechtigt`,
 * src/lib/geheimnis.ts) und sind ohne Secret gesperrt. Datenbank und
 * Freigabe sind gemockt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import path from 'node:path'

vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteBestellungenFrei: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { stockReservation: { deleteMany: vi.fn() } } }))

import { GET as verwaiste } from '@/app/api/cron/verwaiste-bestellungen/route'
import { GET as reservierungen } from '@/app/api/cron/cleanup-reservations/route'
import { gibVerwaisteBestellungenFrei } from '@/server/verwaiste-bestellungen'
import { prisma } from '@/lib/prisma'
import { cronBerechtigt } from '@/lib/geheimnis'

const freigeben = vi.mocked(gibVerwaisteBestellungenFrei)
const aufraeumen = vi.mocked(prisma.stockReservation.deleteMany)

function anfrage(pfad: string, auth?: string) {
  return new NextRequest(`http://localhost${pfad}`, { headers: auth ? { authorization: auth } : {} })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'geheim-123')
  freigeben.mockResolvedValue({ storniert: 2, uebersprungen: 1, fehler: 0 })
  aufraeumen.mockResolvedValue({ count: 3 })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('cronBerechtigt', () => {
  it('nur mit genau „Bearer <Secret>"', () => {
    expect(cronBerechtigt('Bearer geheim-123', 'geheim-123')).toBe(true)
    expect(cronBerechtigt('Bearer geheim-124', 'geheim-123')).toBe(false)
    expect(cronBerechtigt('Bearer geheim-12', 'geheim-123')).toBe(false)
    expect(cronBerechtigt('geheim-123', 'geheim-123')).toBe(false)
    expect(cronBerechtigt(null, 'geheim-123')).toBe(false)
  })

  it('fail-closed: ohne konfiguriertes Secret nie — auch nicht mit „Bearer "', () => {
    expect(cronBerechtigt('Bearer ', undefined)).toBe(false)
    expect(cronBerechtigt('Bearer ', '')).toBe(false)
    expect(cronBerechtigt('Bearer undefined', undefined)).toBe(false)
  })
})

describe.each([
  ['/api/cron/verwaiste-bestellungen', verwaiste],
  ['/api/cron/cleanup-reservations', reservierungen],
] as const)('%s — Zugang', (pfad, GET) => {
  it('ohne Header: 401, nichts passiert', async () => {
    const res = await GET(anfrage(pfad))
    expect(res.status).toBe(401)
    expect(freigeben).not.toHaveBeenCalled()
    expect(aufraeumen).not.toHaveBeenCalled()
  })

  it('falsches Secret: 401', async () => {
    const res = await GET(anfrage(pfad, 'Bearer falsch'))
    expect(res.status).toBe(401)
  })

  it('ohne konfiguriertes Secret: 401, auch mit „Bearer "', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const res = await GET(anfrage(pfad, 'Bearer '))
    expect(res.status).toBe(401)
  })
})

describe('/api/cron/verwaiste-bestellungen', () => {
  it('gibt für ALLE Höfe frei (ohne farmId) und meldet die Zahlen', async () => {
    const res = await verwaiste(anfrage('/api/cron/verwaiste-bestellungen', 'Bearer geheim-123'))

    expect(res.status).toBe(200)
    expect(freigeben).toHaveBeenCalledTimes(1)
    expect(freigeben.mock.calls[0]).toHaveLength(1)
    expect(freigeben.mock.calls[0][0]).toBeInstanceOf(Date)
    expect(await res.json()).toMatchObject({ storniert: 2, uebersprungen: 1, fehler: 0 })
  })

  it('steht täglich in vercel.json', () => {
    const konfig = JSON.parse(readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons: Array<{ path: string; schedule: string }>
    }
    const eintrag = konfig.crons.find((c) => c.path === '/api/cron/verwaiste-bestellungen')
    expect(eintrag).toBeDefined()
    // Hobby-Tarif: höchstens einmal täglich — Minute und Stunde fest, Rest „*".
    expect(eintrag!.schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/)
  })
})

describe('/api/cron/cleanup-reservations', () => {
  it('räumt mit gültigem Secret auf', async () => {
    const res = await reservierungen(anfrage('/api/cron/cleanup-reservations', 'Bearer geheim-123'))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ deleted: 3 })
  })
})

/**
 * Eine geplante Fassung der Startseite geht pünktlich live (Nr. 193; Notiz aus
 * der Vormerkung vom 24.10. und Bericht 183).
 *
 * Beweist: Der Mail-Cron (jede Minute) fragt vor dem Worker billig, ob eine
 * Fassung seit weniger als 2 Minuten fällig ist, und ruft dann
 * `revalidatePath('/')` genau einmal — auch bei zwei fälligen Fassungen;
 * sonst nie (Gegenprobe). Die Zählung fragt das Fenster (liveAb in den letzten
 * 2 Minuten, nicht zurückgezogen). Scheitert sie, läuft der Worker trotzdem.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({ startseiteFassung: { count: vi.fn() } }))
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn, updateTag: vi.fn() }))
const arbeite = vi.hoisted(() => vi.fn(async () => ({ gelaufen: true, seiten: 0, gesendet: 0 })))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('next/cache', () => cache)
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/server/mail-warteschlange', () => ({ arbeiteWarteschlange: arbeite }))
vi.mock('@/server/betrieb', () => ({
  mitHerzschlag: vi.fn(async (_name: string, lauf: () => Promise<unknown>) => lauf()),
  pruefeAblaeufe: vi.fn(async () => 0),
  pruefeMailWarnungen: vi.fn(async () => 0),
}))

import * as Sentry from '@sentry/nextjs'
import { GET } from '@/app/api/cron/mails/route'

const JETZT = new Date('2026-10-27T08:00:30Z')

function rufe(): Promise<Response> {
  return GET(new NextRequest('http://localhost/api/cron/mails', { headers: { authorization: 'Bearer cron-test-geheim' } }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(JETZT)
  vi.stubEnv('CRON_SECRET', 'cron-test-geheim')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Startseite pünktlich (Mail-Cron)', () => {
  it('eine Fassung fällig seit < 2 Minuten: revalidatePath("/") genau einmal, danach der Worker', async () => {
    db.startseiteFassung.count.mockResolvedValue(2)
    expect((await rufe()).status).toBe(200)
    expect(cache.revalidatePath).toHaveBeenCalledTimes(1)
    expect(cache.revalidatePath).toHaveBeenCalledWith('/')
    expect(db.startseiteFassung.count).toHaveBeenCalledWith({
      where: { liveAb: { gt: new Date(JETZT.getTime() - 2 * 60_000), lte: JETZT }, zurueckgezogenAm: null },
    })
    expect(arbeite).toHaveBeenCalledTimes(1)
  })

  it('Gegenprobe: nichts fällig — keine Revalidierung', async () => {
    db.startseiteFassung.count.mockResolvedValue(0)
    await rufe()
    expect(cache.revalidatePath).not.toHaveBeenCalled()
    expect(arbeite).toHaveBeenCalledTimes(1)
  })

  it('scheitert die Zählung, läuft der Worker trotzdem — Sentry mit festem Satz', async () => {
    db.startseiteFassung.count.mockRejectedValue(new Error('verbindung weg'))
    expect((await rufe()).status).toBe(200)
    expect(cache.revalidatePath).not.toHaveBeenCalled()
    expect(arbeite).toHaveBeenCalledTimes(1)
    const meldung = vi.mocked(Sentry.captureException).mock.calls[0]?.[0] as Error
    expect(meldung.message).toBe('Startseite: fällige Fassung nicht geprüft')
  })
})

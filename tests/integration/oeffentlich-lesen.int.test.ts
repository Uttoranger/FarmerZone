/**
 * Die öffentliche Hofliste bei einem Verbindungsabbruch (Nr. 47) gegen ein
 * echtes Postgres: Prisma 7, pg-Adapter und Datenbank sind echt, nur der
 * Pool von pg scheitert auf Wunsch so, wie der Verbindungs-Pooler in
 * Produktion scheiterte — FATAL, SQLSTATE 08006, „(EAUTHTIMEOUT)".
 *
 * Beweist (über `ladeOeffentlicheHoefe`, den Cache dabei durchgereicht):
 *  - Ein Abbruch, dann Erfolg: Die Liste kommt vollständig, ohne Meldung.
 *  - Zwei Abbrüche: genau eine Meldung, der Fehler geht weiter, kein dritter
 *    Versuch — und er gilt als gemeldet (die Seiten melden ihn nicht noch einmal).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import pg from 'pg'

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { ladeOeffentlicheHoefe } from '@/server/queries/oeffentliche-hoefe'
import { schonGemeldet } from '@/server/oeffentlich-lesen'
import { erstelleHof, raeumeAuf } from './setup/basis'

const originalPoolQuery = pg.Pool.prototype.query
const stoerung = { nochAbbrueche: 0, abgebrochen: 0 }

function poolerAbbruch(): Error {
  const fehler = new pg.DatabaseError('(EAUTHTIMEOUT) authentication timeout', 60, 'error')
  fehler.code = '08006'
  fehler.severity = 'FATAL'
  return fehler
}

beforeAll(() => {
  // Die nächsten `nochAbbrueche` Abfragen über den Pool scheitern, danach geht alles durch.
  pg.Pool.prototype.query = function (this: pg.Pool, ...args: unknown[]) {
    if (stoerung.nochAbbrueche > 0) {
      stoerung.nochAbbrueche -= 1
      stoerung.abgebrochen += 1
      return Promise.reject(poolerAbbruch())
    }
    return (originalPoolQuery as (...a: unknown[]) => unknown).apply(this, args)
  } as typeof pg.Pool.prototype.query
})

afterAll(() => {
  pg.Pool.prototype.query = originalPoolQuery
})

beforeEach(() => {
  vi.clearAllMocks()
  stoerung.nochAbbrueche = 0
  stoerung.abgebrochen = 0
})

afterEach(async () => {
  stoerung.nochAbbrueche = 0
  await raeumeAuf()
})

describe('öffentliche Hofliste: genau eine Wiederholung bei 08006', () => {
  it('ein Abbruch, dann Erfolg: die Liste kommt vollständig, Sentry erfährt nichts', async () => {
    const { farm } = await erstelleHof()
    stoerung.nochAbbrueche = 1

    const hoefe = await ladeOeffentlicheHoefe()

    expect(stoerung.abgebrochen).toBe(1)
    expect(hoefe.map((h) => h.slug)).toContain(farm.slug)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('zwei Abbrüche: eine Meldung ohne Personendaten, der Fehler geht weiter, kein dritter Versuch', async () => {
    await erstelleHof()
    stoerung.nochAbbrueche = 5

    let fehler: unknown
    await ladeOeffentlicheHoefe().catch((e: unknown) => {
      fehler = e
    })

    expect(stoerung.abgebrochen).toBe(2)
    expect((fehler as Error).name).toBe('DriverAdapterError')
    expect(schonGemeldet(fehler)).toBe(true)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error, Record<string, unknown>]
    expect(kontext).toMatchObject({ tags: { lesepfad: 'oeffentliche-hoefe', code: '08006', ursache: 'EAUTHTIMEOUT' } })
    expect(JSON.stringify(kontext)).not.toMatch(/@example\.com|postgres:\/\//)
  })

  it('Gegenprobe: ohne Störung kein Abbruch und keine Meldung', async () => {
    const { farm } = await erstelleHof()
    expect((await ladeOeffentlicheHoefe()).map((h) => h.slug)).toContain(farm.slug)
    expect(stoerung.abgebrochen).toBe(0)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})

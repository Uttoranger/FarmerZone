/**
 * STRIPE_LIVE_AB im Betrieb (Register Z4, Nachtlauf Nr. 55): Die Variable wird
 * an genau einer Stelle gelesen (src/lib/umgebung-server.ts, `STRIPE_LIVE_AB`),
 * einmal je Instanz. Ein ungültiger Wert gilt nicht und meldet sich in der
 * Produktion höchstens einmal je Instanz an Sentry — wie
 * NEXT_PUBLIC_TESTUMGEBUNG_URL (`meldeUmgebungsWarnungen`).
 *
 * Das Modul rechnet beim Laden; jede Variante lädt es deshalb frisch
 * (`vi.resetModules()`, TESTING_GUIDELINES §4). Unter Vitest fehlt VERCEL_ENV,
 * die Umgebung gilt also als Produktion (fail-closed, src/lib/umgebung.ts) —
 * genau der Fall, in dem Sentry gefragt wird.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

const sentry = vi.hoisted(() => ({ captureMessage: vi.fn() }))

async function ladeFrisch(wert: string | undefined) {
  vi.resetModules()
  vi.doMock('@sentry/nextjs', () => sentry)
  if (wert === undefined) vi.stubEnv('STRIPE_LIVE_AB', undefined)
  else vi.stubEnv('STRIPE_LIVE_AB', wert)
  return import('@/lib/umgebung-server')
}

afterEach(() => {
  vi.unstubAllEnvs()
  sentry.captureMessage.mockReset()
})

describe('STRIPE_LIVE_AB — gelesen in umgebung-server.ts', () => {
  it('ein gültiger Zeitpunkt wird zum Stichtag', async () => {
    const modul = await ladeFrisch('2026-11-02T21:00:00+01:00')
    expect(modul.STRIPE_LIVE_AB).toEqual(new Date('2026-11-02T20:00:00Z'))
    expect(modul.UMGEBUNG.warnungen.join(' ')).not.toContain('STRIPE_LIVE_AB')
  }, 30_000)

  it('ohne Variable kein Stichtag und keine Meldung dazu', async () => {
    const modul = await ladeFrisch(undefined)
    expect(modul.STRIPE_LIVE_AB).toBeNull()
    modul.meldeUmgebungsWarnungen()
    expect(sentry.captureMessage.mock.calls.flat().join(' ')).not.toContain('STRIPE_LIVE_AB')
  }, 30_000)

  it('ein Wert ohne Zeitzone gilt nicht und meldet sich höchstens einmal je Instanz, ohne den Wert', async () => {
    const modul = await ladeFrisch('2026-11-02T21:00:00')
    expect(modul.STRIPE_LIVE_AB).toBeNull()

    modul.meldeUmgebungsWarnungen()
    modul.meldeUmgebungsWarnungen()
    modul.meldeUmgebungsWarnungen()

    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    const [nachricht, stufe] = sentry.captureMessage.mock.calls[0]
    expect(stufe).toBe('warning')
    expect(nachricht).toContain('STRIPE_LIVE_AB hat keine Zeitzone')
    expect(nachricht).not.toContain('2026-11-02')
  }, 30_000)

  it('ein Stichtag weit in der Zukunft gilt, meldet sich aber zur Laufzeit höchstens einmal je Instanz, ohne den Wert', async () => {
    const modul = await ladeFrisch('2062-11-02T21:00:00+01:00')
    expect(modul.STRIPE_LIVE_AB).toEqual(new Date('2062-11-02T20:00:00Z'))
    const jetzt = new Date('2026-11-02T18:00:00Z')

    modul.meldeUmgebungsWarnungen(jetzt)
    modul.meldeUmgebungsWarnungen(jetzt)
    modul.meldeUmgebungsWarnungen(new Date('2026-11-03T18:00:00Z'))

    const zukunft = sentry.captureMessage.mock.calls.filter(([nachricht]) => String(nachricht).includes('in der Zukunft'))
    expect(zukunft).toHaveLength(1)
    expect(zukunft[0][1]).toBe('warning')
    expect(zukunft[0][0]).toContain('STRIPE_LIVE_AB liegt mehr als 24 Stunden in der Zukunft')
    expect(zukunft[0][0]).not.toContain('2062')
  }, 30_000)

  it('wenige Stunden voraus (Beginn des Redeploys) meldet sich nicht — erst, wenn es mehr als 24 Stunden sind', async () => {
    const modul = await ladeFrisch('2026-11-02T21:00:00+01:00')
    modul.meldeUmgebungsWarnungen(new Date('2026-11-01T20:00:01Z')) // 23:59:59 h davor
    expect(sentry.captureMessage.mock.calls.flat().join(' ')).not.toContain('in der Zukunft')
    modul.meldeUmgebungsWarnungen(new Date('2026-11-01T19:59:59Z')) // 24 h und 1 s davor
    expect(sentry.captureMessage.mock.calls.flat().join(' ')).toContain('in der Zukunft')
  }, 30_000)

  it('ein unlesbarer Wert gilt ebenso nicht', async () => {
    const modul = await ladeFrisch('nächsten Montag')
    expect(modul.STRIPE_LIVE_AB).toBeNull()
    modul.meldeUmgebungsWarnungen()
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(sentry.captureMessage.mock.calls[0][0]).toContain('STRIPE_LIVE_AB ist kein gültiger Zeitpunkt')
  }, 30_000)
})

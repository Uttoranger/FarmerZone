/**
 * STRIPE_LIVE_AB im Betrieb (Register Z4, Nachtlauf Nr. 55): Die Variable wird
 * an genau einer Stelle gelesen (src/lib/umgebung-server.ts, `STRIPE_LIVE_AB`),
 * einmal je Instanz. Ein ungültiger Wert gilt nicht und meldet sich in der
 * Produktion an Sentry — wie NEXT_PUBLIC_TESTUMGEBUNG_URL
 * (`meldeUmgebungsWarnungen`), seit Nr. 184 höchstens einmal je Tag und
 * Deploy (die Zeile in BetriebMessung ist hier ein Speicher im Test; die
 * echte Anweisung prüft tests/integration/betrieb.int.test.ts).
 *
 * Das Modul rechnet beim Laden; jede Variante lädt es deshalb frisch
 * (`vi.resetModules()`, TESTING_GUIDELINES §4). Unter Vitest fehlt VERCEL_ENV,
 * die Umgebung gilt also als Produktion (fail-closed, src/lib/umgebung.ts) —
 * genau der Fall, in dem Sentry gefragt wird.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

const sentry = vi.hoisted(() => ({ captureMessage: vi.fn() }))
// Die Zeilen „sentry:<zustand>:<deploy>“ je Tag — wie ON CONFLICT DO NOTHING: nur die erste Anfrage legt an.
const zeilen = vi.hoisted(() => new Set<string>())
const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(async (_sql: TemplateStringsArray, tag: string, art: string) => {
    const schluessel = `${tag}|${art}`
    if (zeilen.has(schluessel)) return []
    zeilen.add(schluessel)
    return [{ art }]
  }),
}))

/** Die Meldung läuft nach der Antwort (`nachDerAntwort`; im Test sofort, aber asynchron) — abwarten. */
async function fertig(): Promise<void> {
  await vi.dynamicImportSettled()
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}

async function ladeFrisch(wert: string | undefined) {
  vi.resetModules()
  vi.doMock('@sentry/nextjs', () => sentry)
  vi.doMock('@/lib/prisma', () => ({ prisma: db }))
  if (wert === undefined) vi.stubEnv('STRIPE_LIVE_AB', undefined)
  else vi.stubEnv('STRIPE_LIVE_AB', wert)
  return import('@/lib/umgebung-server')
}

afterEach(() => {
  vi.unstubAllEnvs()
  sentry.captureMessage.mockReset()
  db.$queryRaw.mockClear()
  zeilen.clear()
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
    await fertig()
    expect(sentry.captureMessage.mock.calls.flat().join(' ')).not.toContain('STRIPE_LIVE_AB')
  }, 30_000)

  it('ein Wert ohne Zeitzone gilt nicht und meldet sich höchstens einmal am Tag, ohne den Wert', async () => {
    const modul = await ladeFrisch('2026-11-02T21:00:00')
    expect(modul.STRIPE_LIVE_AB).toBeNull()

    modul.meldeUmgebungsWarnungen()
    modul.meldeUmgebungsWarnungen()
    modul.meldeUmgebungsWarnungen()
    await fertig()

    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    const [nachricht, stufe] = sentry.captureMessage.mock.calls[0]
    expect(stufe).toBe('warning')
    expect(nachricht).toContain('STRIPE_LIVE_AB hat keine Zeitzone')
    expect(nachricht).not.toContain('2026-11-02')
  }, 30_000)

  it('ein Stichtag weit in der Zukunft gilt, meldet sich aber zur Laufzeit höchstens einmal am Tag, ohne den Wert', async () => {
    const modul = await ladeFrisch('2062-11-02T21:00:00+01:00')
    expect(modul.STRIPE_LIVE_AB).toEqual(new Date('2062-11-02T20:00:00Z'))
    const jetzt = new Date('2026-11-02T18:00:00Z')

    modul.meldeUmgebungsWarnungen(jetzt)
    modul.meldeUmgebungsWarnungen(jetzt)
    modul.meldeUmgebungsWarnungen(new Date('2026-11-02T23:00:00Z'))
    await fertig()

    const zukunft = sentry.captureMessage.mock.calls.filter(([nachricht]) => String(nachricht).includes('in der Zukunft'))
    expect(zukunft).toHaveLength(1)
    expect(zukunft[0][1]).toBe('warning')
    expect(zukunft[0][0]).toContain('STRIPE_LIVE_AB liegt mehr als 24 Stunden in der Zukunft')
    expect(zukunft[0][0]).not.toContain('2062')
  }, 30_000)

  it('wenige Stunden voraus (Beginn des Redeploys) meldet sich nicht — erst, wenn es mehr als 24 Stunden sind', async () => {
    const modul = await ladeFrisch('2026-11-02T21:00:00+01:00')
    modul.meldeUmgebungsWarnungen(new Date('2026-11-01T20:00:01Z')) // 23:59:59 h davor
    await fertig()
    expect(sentry.captureMessage.mock.calls.flat().join(' ')).not.toContain('in der Zukunft')
    modul.meldeUmgebungsWarnungen(new Date('2026-11-01T19:59:59Z')) // 24 h und 1 s davor
    await fertig()
    expect(sentry.captureMessage.mock.calls.flat().join(' ')).toContain('in der Zukunft')
  }, 30_000)

  it('ein unlesbarer Wert gilt ebenso nicht', async () => {
    const modul = await ladeFrisch('nächsten Montag')
    expect(modul.STRIPE_LIVE_AB).toBeNull()
    modul.meldeUmgebungsWarnungen()
    await fertig()
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(sentry.captureMessage.mock.calls[0][0]).toContain('STRIPE_LIVE_AB ist kein gültiger Zeitpunkt')
  }, 30_000)

  it('bekannte Zustände (Nr. 184): einmal am Tag über alle Instanzen — eine neue Instanz am selben Tag meldet nicht, am nächsten Tag wieder (Gegenprobe)', async () => {
    const tag1 = new Date('2026-11-02T08:00:00Z')
    const erste = await ladeFrisch('nächsten Montag')
    for (let i = 0; i < 50; i++) erste.meldeUmgebungsWarnungen(tag1)
    await fertig()
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    // Je Instanz nur EIN Blick in die Datenbank am Tag, nicht je Seitenaufbau.
    expect(db.$queryRaw).toHaveBeenCalledTimes(1)

    // Kaltstart: neue Instanz, derselbe Tag und Deploy — die Zeile gibt es schon.
    const zweite = await ladeFrisch('nächsten Montag')
    zweite.meldeUmgebungsWarnungen(new Date('2026-11-02T21:00:00Z'))
    await fertig()
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)

    // Zweiter Tag: wieder genau eine Meldung.
    zweite.meldeUmgebungsWarnungen(new Date('2026-11-03T00:05:00Z'))
    zweite.meldeUmgebungsWarnungen(new Date('2026-11-03T12:00:00Z'))
    await fertig()
    expect(sentry.captureMessage).toHaveBeenCalledTimes(2)
    // Die Art nennt Zustand und Deploy, nie einen Wert.
    expect(db.$queryRaw.mock.calls.map((c) => c[2])).toEqual(['sentry:umgebung:lokal', 'sentry:umgebung:lokal', 'sentry:umgebung:lokal'])
  }, 30_000)

  it('bekannte Zustände (Nr. 184): ein neuer Deploy meldet am selben Tag neu; antwortet die Datenbank nicht, meldet niemand', async () => {
    const tag = new Date('2026-11-02T08:00:00Z')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    ;(await ladeFrisch('nächsten Montag')).meldeUmgebungsWarnungen(tag)
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    ;(await ladeFrisch('nächsten Montag')).meldeUmgebungsWarnungen(tag)
    await fertig()
    expect(sentry.captureMessage).toHaveBeenCalledTimes(2)
    expect(db.$queryRaw.mock.calls.map((c) => c[2])).toEqual(['sentry:umgebung:aaaaaaaaaaaa', 'sentry:umgebung:bbbbbbbbbbbb'])

    db.$queryRaw.mockRejectedValueOnce(new Error('weg'))
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'cccccccccccccccccccccccccccccccccccccccc')
    ;(await ladeFrisch('nächsten Montag')).meldeUmgebungsWarnungen(tag)
    await fertig()
    expect(sentry.captureMessage).toHaveBeenCalledTimes(2)
  }, 30_000)
})

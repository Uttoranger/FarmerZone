/**
 * Die Login-Bremse über alle Instanzen (Register R1, Ergänzung Nr. 125): der Speicher für
 * `rateLimit.customStorage` von Better Auth (src/server/auth-bremse.ts).
 *
 * Beweist (die Zählung in der Tabelle ist hier gemockt — `zaehleVersuche`; Nebenläufigkeit, zwei
 * Instanzen und Fensterwechsel gegen ein echtes Postgres prüft tests/integration/auth-bremse.int.test.ts):
 *  - consume zählt über `zaehleVersuche` mit dem Zweck „auth" und dem Schlüssel von Better Auth als
 *    Merkmal, im festen Fenster aus `rule.window`; erlaubt bis `max`, danach `retryAfter` = Sekunden bis
 *    zum Fensterende, aufgerundet.
 *  - Datenbankfehler und Zeitüberschreitung (1,5 s) führen zum Ersatz im Arbeitsspeicher — nie offen,
 *    dieselben festen Fenster wie in der Tabelle.
 *  - Sentry bekommt nur die Fehlerklasse und den Tag `bereich: 'auth-bremse'`, höchstens einmal je Minute
 *    und Instanz — nie Schlüssel, IP oder Pfad; ohne Client-IP einmal je Instanz eine Warnung.
 *  - Der Ersatz hält höchstens 10 000 Schlüssel, Abgelaufenes geht zuerst.
 *  - auth.ts setzt den Speicher im Block `rateLimit`, der Rest des Blocks bleibt.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sentry = vi.hoisted(() => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
const db = vi.hoisted(() => ({ zaehleVersuche: vi.fn() }))
vi.mock('@/server/bremse-datenbank', async (original) => ({
  ...(await original<typeof import('@/server/bremse-datenbank')>()),
  zaehleVersuche: db.zaehleVersuche,
}))

import {
  AUTH_BREMSE_ZWECK,
  ERSATZ_MAX_SCHLUESSEL,
  neuerAuthBremseZustand,
  verbrauche,
  zaehleImSpeicher,
} from '@/server/auth-bremse'

const IP = '203.0.113.7'
const SCHLUESSEL = `${IP}|/sign-in/email`
const REGEL = { window: 10, max: 3 }
/** 12:00:03,5 — 6,5 s bis zum Ende des 10-s-Fensters. */
const JETZT = new Date('2026-10-07T12:00:03.500Z')

/** Sentry-Aufrufe als Text — darin darf weder IP noch Pfad noch Schlüssel stehen. */
function sentryText(): string {
  const scope = { setLevel: () => scope, setTags: (t: unknown) => (gesehen.push(t), scope), addEventProcessor: () => scope }
  const gesehen: unknown[] = []
  for (const aufruf of [...sentry.captureException.mock.calls, ...sentry.captureMessage.mock.calls]) {
    const [erstes, kontext] = aufruf as [unknown, unknown]
    if (typeof kontext === 'function') kontext(scope)
    gesehen.push(erstes instanceof Error ? `${erstes.name}: ${erstes.message}` : erstes)
  }
  return JSON.stringify(gesehen)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('consume zählt in der Tabelle', () => {
  it('Zweck „auth", der Schlüssel von Better Auth als Merkmal, Fenster aus rule.window', async () => {
    db.zaehleVersuche.mockResolvedValueOnce([1])
    expect(await verbrauche(SCHLUESSEL, REGEL, JETZT, neuerAuthBremseZustand())).toEqual({ allowed: true, retryAfter: null })
    expect(db.zaehleVersuche).toHaveBeenCalledWith([{ bremse: { zweck: AUTH_BREMSE_ZWECK, max: 3, fensterMs: 10_000 }, merkmal: SCHLUESSEL }], JETZT)
    expect(AUTH_BREMSE_ZWECK).toBe('auth')
  })

  it('erlaubt bis max, danach nicht — retryAfter sind die Sekunden bis zum Fensterende, aufgerundet', async () => {
    const zustand = neuerAuthBremseZustand()
    db.zaehleVersuche.mockResolvedValueOnce([3]).mockResolvedValueOnce([4])
    expect((await verbrauche(SCHLUESSEL, REGEL, JETZT, zustand)).allowed).toBe(true)
    expect(await verbrauche(SCHLUESSEL, REGEL, JETZT, zustand)).toEqual({ allowed: false, retryAfter: 7 })
  })
})

describe('Ersatz im Arbeitsspeicher — nie offen', () => {
  it('ein Datenbankfehler zählt im Speicher der Instanz weiter: der vierte Versuch im Fenster ist gesperrt', async () => {
    db.zaehleVersuche.mockRejectedValue(new Error('Verbindung weg'))
    const zustand = neuerAuthBremseZustand()
    const ergebnisse = []
    for (let i = 0; i < 4; i += 1) ergebnisse.push(await verbrauche(SCHLUESSEL, REGEL, JETZT, zustand))
    expect(ergebnisse.map((e) => e.allowed)).toEqual([true, true, true, false])
    expect(ergebnisse[3].retryAfter).toBe(7)
  })

  it('eine Zeitüberschreitung (1,5 s) genauso — die Anmeldung wartet nicht länger', async () => {
    vi.useFakeTimers()
    db.zaehleVersuche.mockImplementation(() => new Promise(() => {}))
    const zustand = neuerAuthBremseZustand()
    zaehleImSpeicher(zustand.ersatz, SCHLUESSEL, 10_000, JETZT)
    zaehleImSpeicher(zustand.ersatz, SCHLUESSEL, 10_000, JETZT)
    zaehleImSpeicher(zustand.ersatz, SCHLUESSEL, 10_000, JETZT)
    const ergebnis = verbrauche(SCHLUESSEL, REGEL, JETZT, zustand)
    await vi.advanceTimersByTimeAsync(1499)
    let fertig = false
    void ergebnis.then(() => (fertig = true))
    await Promise.resolve()
    expect(fertig).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await ergebnis).toEqual({ allowed: false, retryAfter: 7 })
  })

  it('dieselben festen Fenster: im nächsten Fenster beginnt der Zähler neu', () => {
    const { ersatz } = neuerAuthBremseZustand()
    expect([1, 2, 3, 4].map(() => zaehleImSpeicher(ersatz, SCHLUESSEL, 10_000, JETZT))).toEqual([1, 2, 3, 4])
    expect(zaehleImSpeicher(ersatz, SCHLUESSEL, 10_000, new Date('2026-10-07T12:00:09.999Z'))).toBe(5)
    expect(zaehleImSpeicher(ersatz, SCHLUESSEL, 10_000, new Date('2026-10-07T12:00:10.000Z'))).toBe(1)
  })

  it('hält höchstens 10 000 Schlüssel — Abgelaufenes geht zuerst, dann das Älteste', () => {
    const { ersatz } = neuerAuthBremseZustand()
    zaehleImSpeicher(ersatz, 'abgelaufen', 1_000, new Date('2026-10-07T11:00:00.000Z'))
    zaehleImSpeicher(ersatz, 'aeltester-laufender', 3_600_000, JETZT)
    for (let i = 0; ersatz.size < ERSATZ_MAX_SCHLUESSEL; i += 1) zaehleImSpeicher(ersatz, `k${i}`, 10_000, JETZT)
    expect(ersatz.size).toBe(ERSATZ_MAX_SCHLUESSEL)

    zaehleImSpeicher(ersatz, 'neu-1', 10_000, JETZT)
    expect(ersatz.size).toBe(ERSATZ_MAX_SCHLUESSEL)
    expect(ersatz.has('abgelaufen')).toBe(false)
    expect(ersatz.has('aeltester-laufender')).toBe(true)

    zaehleImSpeicher(ersatz, 'neu-2', 10_000, JETZT)
    expect(ersatz.size).toBe(ERSATZ_MAX_SCHLUESSEL)
    expect(ersatz.has('aeltester-laufender')).toBe(false)
    expect(ersatz.has('neu-1')).toBe(true)
  })
})

describe('Meldungen an Sentry', () => {
  it('nur Fehlerklasse und Tag, höchstens einmal je Minute und Instanz — nie Schlüssel, IP oder Pfad', async () => {
    const fehler = new Error(`Abfrage für ${SCHLUESSEL} gescheitert`)
    fehler.name = 'PrismaClientKnownRequestError'
    db.zaehleVersuche.mockRejectedValue(fehler)
    const zustand = neuerAuthBremseZustand()
    await verbrauche(SCHLUESSEL, REGEL, JETZT, zustand)
    await verbrauche(SCHLUESSEL, REGEL, new Date(JETZT.getTime() + 59_999), zustand)
    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    await verbrauche(SCHLUESSEL, REGEL, new Date(JETZT.getTime() + 60_000), zustand)
    expect(sentry.captureException).toHaveBeenCalledTimes(2)

    const text = sentryText()
    expect(text).toContain('PrismaClientKnownRequestError')
    expect(text).toContain('"bereich":"auth-bremse"')
    for (const verboten of [IP, '/sign-in', SCHLUESSEL]) expect(text).not.toContain(verboten)
  })

  it('jede Instanz meldet für sich — ein frischer Zustand meldet sofort', async () => {
    db.zaehleVersuche.mockRejectedValue(new Error('weg'))
    await verbrauche(SCHLUESSEL, REGEL, JETZT, neuerAuthBremseZustand())
    await verbrauche(SCHLUESSEL, REGEL, JETZT, neuerAuthBremseZustand())
    expect(sentry.captureException).toHaveBeenCalledTimes(2)
  })

  it('ohne Client-IP kommt einmal je Instanz die Warnung „Keine Client-IP für die Login-Bremse"', async () => {
    db.zaehleVersuche.mockResolvedValue([1])
    const zustand = neuerAuthBremseZustand()
    await verbrauche('no-trusted-ip|/sign-in/email', REGEL, JETZT, zustand)
    await verbrauche('no-trusted-ip|/sign-up/email', REGEL, JETZT, zustand)
    await verbrauche(SCHLUESSEL, REGEL, JETZT, zustand)
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(sentry.captureMessage.mock.calls[0][0]).toBe('Keine Client-IP für die Login-Bremse')
    expect(sentryText()).not.toContain('/sign-')
  })
})

describe('Verdrahtung', () => {
  it('der Speicher des Moduls: consume über die Tabelle, get und set über den Ersatz', async () => {
    vi.resetModules()
    const modul = await import('@/server/auth-bremse')
    db.zaehleVersuche.mockResolvedValueOnce([1])
    expect(await modul.AUTH_BREMSE_SPEICHER.consume?.(SCHLUESSEL, REGEL)).toEqual({ allowed: true, retryAfter: null })
    expect(db.zaehleVersuche).toHaveBeenCalledTimes(1)

    await modul.AUTH_BREMSE_SPEICHER.set('k', { key: 'k', count: 2, lastRequest: JETZT.getTime() })
    expect(await modul.AUTH_BREMSE_SPEICHER.get('k')).toEqual({ key: 'k', count: 2, lastRequest: JETZT.getTime() })
    expect(await modul.AUTH_BREMSE_SPEICHER.get('unbekannt')).toBeNull()
  })

  it('auth.ts setzt den Speicher im Block rateLimit; enabled, window, max und „/get-session": false bleiben', () => {
    const quelle = readFileSync(join(process.cwd(), 'src', 'lib', 'auth.ts'), 'utf8')
    const block = quelle.slice(quelle.indexOf('  rateLimit: {'), quelle.indexOf('  emailAndPassword: {'))
    expect(block).toContain('customStorage: AUTH_BREMSE_SPEICHER,')
    expect(block).toContain("enabled: process.env.NODE_ENV === 'production',")
    expect(block).toContain('window: AUTH_RATE_LIMIT_WINDOW_SECONDS,')
    expect(block).toContain('max: AUTH_RATE_LIMIT_MAX,')
    expect(block).toContain("'/get-session': false,")
    expect(quelle).toContain("import { AUTH_BREMSE_SPEICHER } from '@/server/auth-bremse'")
  })
})

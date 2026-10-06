/**
 * Die Server Actions von „Bestellungen finden" (src/server/actions/
 * bestellungen-finden.ts) — Datenbankschicht und Request-Kontext gemockt, die
 * Regeln (Zod, Fehlertexte, Cookie-Signatur) echt.
 *
 * Beweist:
 *  - Anfordern antwortet für jede gültige Adresse gleich ({ ok: true }) und
 *    legt dafür einen Code an; die Mail geht erst nach der Antwort raus.
 *  - Ungültige Eingabe: Fehler am Feld, kein Code.
 *  - Rate-Limit (Produktion): je IP 3 je Minute fürs Anfordern und fürs
 *    Prüfen, je Adresse 5 Codes in 15 Minuten — danach kein Code mehr.
 *  - Richtiger Code: Cookie httpOnly, SameSite=Lax, nur /bestellungen,
 *    30 Minuten, in Produktion Secure — mit genau der bewiesenen Adresse.
 *  - Falscher Code: kein Cookie, Text ohne Fachwort.
 *  - Abmelden löscht den Cookie (gleicher Pfad).
 *  - Sentry-Hygiene: Scheitert der Versand, erfährt es Sentry ohne Adresse und
 *    ohne Code; der Code steht in Produktion in keinem Log.
 *  - Die Actions kennen Better Auth nicht (kein Konto, keine Sitzung).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('server-only', () => ({}))

const kontext = vi.hoisted(() => ({
  ip: '203.0.113.7',
  gesetzt: [] as Array<Record<string, unknown>>,
  nachlauf: [] as Array<() => Promise<void>>,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': kontext.ip })),
  cookies: vi.fn(async () => ({ set: (wert: Record<string, unknown>) => kontext.gesetzt.push(wert) })),
}))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => kontext.nachlauf.push(aufgabe),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendBestellCodeEmail: vi.fn(async () => ({ id: 'mail-1' })) }))
vi.mock('@/server/bestellungen-finden', () => ({
  legeBestellCodeAn: vi.fn(async () => '481234'),
  pruefeBestellCode: vi.fn(async () => ({ ok: true })),
}))

import * as Sentry from '@sentry/nextjs'
import { sendBestellCodeEmail } from '@/lib/email'
import { legeBestellCodeAn, pruefeBestellCode } from '@/server/bestellungen-finden'
import { leseBestellZugang } from '@/lib/bestellungen-zugang'

type Aktionen = typeof import('@/server/actions/bestellungen-finden')

/** Frische Instanz — die Bremsen leben auf Modulebene. */
async function ladeAktionen(): Promise<Aktionen> {
  vi.resetModules()
  return import('@/server/actions/bestellungen-finden')
}

/**
 * Produktion: Bremsen an, Cookie Secure. env.ts verlangt dann alle
 * Pflichtwerte — Platzhalter, es geht nirgends hin (alles Netz ist gemockt).
 */
function alsProduktion(): void {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('DATABASE_URL', 'postgresql://platzhalter@localhost:5432/keine')
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_platzhalter')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_platzhalter')
}

async function arbeiteNachlaufAb(): Promise<void> {
  while (kontext.nachlauf.length > 0) await kontext.nachlauf.shift()?.()
}

beforeEach(() => {
  vi.clearAllMocks()
  kontext.gesetzt = []
  kontext.nachlauf = []
  kontext.ip = '203.0.113.7'
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('fordereBestellCodeAn', () => {
  it('gleiche Antwort für jede gültige Adresse — mit oder ohne Bestellungen', async () => {
    const { fordereBestellCodeAn } = await ladeAktionen()
    expect(await fordereBestellCodeAn({ email: 'kundin@example.com' })).toEqual({ ok: true })
    expect(await fordereBestellCodeAn({ email: 'niemand-bestellt@example.org' })).toEqual({ ok: true })
    expect(await fordereBestellCodeAn({ email: 'bauer-01@example.com' })).toEqual({ ok: true })
    expect(legeBestellCodeAn).toHaveBeenCalledTimes(3)
  }, 30_000)

  it('die Adresse geht normalisiert weiter (ohne Ränder, klein)', async () => {
    const { fordereBestellCodeAn } = await ladeAktionen()
    await fordereBestellCodeAn({ email: '  Kundin@Example.COM ' })
    expect(legeBestellCodeAn).toHaveBeenCalledWith('kundin@example.com')
  })

  it('die Mail geht erst NACH der Antwort raus', async () => {
    const { fordereBestellCodeAn } = await ladeAktionen()
    await fordereBestellCodeAn({ email: 'kundin@example.com' })
    expect(sendBestellCodeEmail).not.toHaveBeenCalled()
    await arbeiteNachlaufAb()
    expect(sendBestellCodeEmail).toHaveBeenCalledWith('kundin@example.com', '481234')
  })

  it('ungültige Adresse: Fehler, kein Code', async () => {
    const { fordereBestellCodeAn } = await ladeAktionen()
    expect(await fordereBestellCodeAn({ email: 'keine-adresse' })).toMatchObject({ code: 'EINGABE' })
    expect(await fordereBestellCodeAn(null)).toMatchObject({ code: 'EINGABE' })
    expect(legeBestellCodeAn).not.toHaveBeenCalled()
  })

  it('Produktion: je IP höchstens 3 in der Minute — danach kein Code', async () => {
    alsProduktion()
    const { fordereBestellCodeAn } = await ladeAktionen()
    for (let i = 0; i < 3; i += 1) expect(await fordereBestellCodeAn({ email: `k${i}@example.com` })).toEqual({ ok: true })
    expect(await fordereBestellCodeAn({ email: 'k9@example.com' })).toMatchObject({ code: 'ZU_VIELE' })
    expect(legeBestellCodeAn).toHaveBeenCalledTimes(3)
    // Gegenprobe: eine andere IP kommt durch.
    kontext.ip = '198.51.100.1'
    expect(await fordereBestellCodeAn({ email: 'k9@example.com' })).toEqual({ ok: true })
  })

  it('Produktion: je Adresse höchstens 5 Codes — auch von vielen IPs aus', async () => {
    alsProduktion()
    const { fordereBestellCodeAn } = await ladeAktionen()
    for (let i = 0; i < 5; i += 1) {
      kontext.ip = `198.51.100.${i + 10}`
      expect(await fordereBestellCodeAn({ email: 'kundin@example.com' })).toEqual({ ok: true })
    }
    kontext.ip = '198.51.100.99'
    expect(await fordereBestellCodeAn({ email: 'Kundin@example.com' })).toMatchObject({ code: 'ZU_VIELE' })
    expect(legeBestellCodeAn).toHaveBeenCalledTimes(5)
  })

  it('außerhalb der Produktion bremst nichts (Entwicklung, Tests)', async () => {
    const { fordereBestellCodeAn } = await ladeAktionen()
    for (let i = 0; i < 8; i += 1) expect(await fordereBestellCodeAn({ email: 'kundin@example.com' })).toEqual({ ok: true })
  })
})

describe('Sentry-Hygiene beim Versand', () => {
  it('Resend-Fehler: Sentry erfährt es — ohne Adresse und ohne Code', async () => {
    vi.mocked(sendBestellCodeEmail).mockResolvedValueOnce({ error: 'kundin@example.com abgelehnt' })
    const { fordereBestellCodeAn } = await ladeAktionen()
    await fordereBestellCodeAn({ email: 'kundin@example.com' })
    await arbeiteNachlaufAb()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    const gemeldet = JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)
    expect(gemeldet).not.toContain('kundin@example.com')
    expect(gemeldet).not.toContain('481234')
  })

  it('Ausnahme im Nachlauf: gemeldet ohne Fehlertext (er könnte die Adresse tragen)', async () => {
    vi.mocked(sendBestellCodeEmail).mockRejectedValueOnce(new TypeError('kundin@example.com: 481234'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { fordereBestellCodeAn } = await ladeAktionen()
    await fordereBestellCodeAn({ email: 'kundin@example.com' })
    await arbeiteNachlaufAb()
    const [fehler] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error]
    expect(fehler.name).toBe('TypeError')
    expect(fehler.message).not.toContain('kundin')
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('481234')
  })

  it('Gegenprobe: Mail geht raus → Sentry bleibt still', async () => {
    const { fordereBestellCodeAn } = await ladeAktionen()
    await fordereBestellCodeAn({ email: 'kundin@example.com' })
    await arbeiteNachlaufAb()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('in Produktion steht der Code in keinem Log, auch ohne Versand', async () => {
    alsProduktion()
    vi.mocked(sendBestellCodeEmail).mockResolvedValueOnce({})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { fordereBestellCodeAn } = await ladeAktionen()
    await fordereBestellCodeAn({ email: 'kundin@example.com' })
    await arbeiteNachlaufAb()
    expect(JSON.stringify(log.mock.calls)).not.toContain('481234')
  })
})

describe('zeigeBestellungen', () => {
  it('richtiger Code: Cookie mit der bewiesenen Adresse — httpOnly, Lax, nur /bestellungen, 30 Minuten', async () => {
    const { zeigeBestellungen } = await ladeAktionen()
    expect(await zeigeBestellungen({ email: 'Kundin@Example.com', code: '481234' })).toEqual({ ok: true })
    expect(pruefeBestellCode).toHaveBeenCalledWith('kundin@example.com', '481234', expect.any(Date))
    expect(kontext.gesetzt).toHaveLength(1)
    const keks = kontext.gesetzt[0]
    expect(keks).toMatchObject({ name: 'fz-bestellungen', path: '/bestellungen', httpOnly: true, sameSite: 'lax', maxAge: 1800, secure: false })
    expect(leseBestellZugang(String(keks.value), new Date())).toEqual({ art: 'gueltig', email: 'kundin@example.com' })
  })

  it('in Produktion ist der Cookie Secure', async () => {
    alsProduktion()
    const { zeigeBestellungen } = await ladeAktionen()
    await zeigeBestellungen({ email: 'kundin@example.com', code: '481234' })
    expect(kontext.gesetzt[0]).toMatchObject({ secure: true })
  })

  it.each([
    ['INVALID_OTP', /Code stimmt nicht/],
    ['OTP_EXPIRED', /abgelaufen/],
    ['TOO_MANY_ATTEMPTS', /zu oft/],
  ] as const)('%s: kein Cookie, ein Satz für die Kundin', async (fehler, text) => {
    vi.mocked(pruefeBestellCode).mockResolvedValueOnce({ ok: false, fehler })
    const { zeigeBestellungen } = await ladeAktionen()
    const antwort = await zeigeBestellungen({ email: 'kundin@example.com', code: '000000' })
    expect(antwort).toMatchObject({ code: fehler })
    expect('error' in antwort && antwort.error).toMatch(text)
    expect(kontext.gesetzt).toEqual([])
  })

  it('ungültige Eingabe: weder Prüfung noch Cookie', async () => {
    const { zeigeBestellungen } = await ladeAktionen()
    expect(await zeigeBestellungen({ email: 'kundin@example.com', code: '12' })).toMatchObject({ code: 'EINGABE' })
    expect(pruefeBestellCode).not.toHaveBeenCalled()
    expect(kontext.gesetzt).toEqual([])
  })

  it('Produktion: je IP höchstens 3 Prüfungen in der Minute', async () => {
    alsProduktion()
    vi.mocked(pruefeBestellCode).mockResolvedValue({ ok: false, fehler: 'INVALID_OTP' })
    const { zeigeBestellungen } = await ladeAktionen()
    for (let i = 0; i < 3; i += 1) await zeigeBestellungen({ email: 'kundin@example.com', code: '000000' })
    expect(await zeigeBestellungen({ email: 'kundin@example.com', code: '000000' })).toMatchObject({ code: 'ZU_VIELE' })
    expect(pruefeBestellCode).toHaveBeenCalledTimes(3)
    vi.mocked(pruefeBestellCode).mockReset()
  })
})

describe('beendeBestellAnsicht', () => {
  it('löscht den Cookie auf demselben Pfad', async () => {
    const { beendeBestellAnsicht } = await ladeAktionen()
    await beendeBestellAnsicht()
    expect(kontext.gesetzt).toEqual([expect.objectContaining({ name: 'fz-bestellungen', value: '', maxAge: 0, path: '/bestellungen' })])
  })
})

describe('kein Konto, keine Sitzung', () => {
  it('Actions und Datenbankschicht binden Better Auth nicht ein (Gegenprobe: auth.ts tut es)', () => {
    const wurzel = join(__dirname, '..')
    for (const datei of ['src/server/actions/bestellungen-finden.ts', 'src/server/bestellungen-finden.ts', 'src/lib/bestellungen-zugang.ts']) {
      const text = readFileSync(join(wurzel, datei), 'utf8')
      expect(text, datei).not.toMatch(/from '@\/lib\/auth'|better-auth|auth\.api|prisma\.(user|session|account)\./)
    }
    expect(readFileSync(join(wurzel, 'src/lib/auth.ts'), 'utf8')).toMatch(/better-auth/)
  })
})

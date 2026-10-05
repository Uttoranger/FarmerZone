/**
 * Anmeldecode gegen ein ECHTES Postgres (E7, S4, Nr. 08): Better Auth mit dem
 * emailOTP-Plugin aus src/lib/auth.ts, die Verification-Tabelle ist die
 * Aussage.
 *
 * Beweist:
 *  - Ein angeforderter Code liegt nur gehasht in der Datenbank, mit Zähler 0
 *    und 10 Minuten Laufzeit.
 *  - Falsche Versuche werden IN DER DATENBANK gezählt — eine zweite, frisch
 *    geladene Auth-Instanz (wie eine zweite Serverless-Instanz) sieht
 *    dieselbe Zahl; nach 5 Fehlversuchen nimmt auch der richtige Code nicht
 *    mehr an.
 *  - Der richtige Code meldet an, genau einmal.
 *  - Ein abgelaufener Code nimmt nicht an (Frist beim Lesen, nicht per Cron).
 *  - Ein Hof bekommt keinen Code (E7: Höfe bleiben bei Passwort).
 *  - Nur der Typ „sign-in" darf angefordert werden.
 *  - HTTP: Magic Links lassen sich nicht mehr anfordern, alte Links prüft
 *    der Endpunkt noch (Übergang); die ungenutzten Code-Pfade sind zu.
 *
 * Gegenprobe zur Zählung: Vor dem fünften Fehlversuch nimmt der richtige
 * Code noch an (eigener Test).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { intKennung, raeumeAuf } from './setup/basis'

const versand = vi.hoisted(() => ({ codes: [] as Array<{ email: string; code: string }> }))

vi.mock('@/lib/email', () => ({
  sendAnmeldeCodeEmail: vi.fn(async (email: string, code: string) => {
    versand.codes.push({ email, code })
    return { id: 'int-mail' }
  }),
  sendMagicLinkEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

type Auth = (typeof import('@/lib/auth'))['auth']

let instanzA: Auth
let instanzB: Auth

beforeAll(async () => {
  instanzA = (await import('@/lib/auth')).auth
  // Eine zweite, frisch geladene Instanz: eigener Speicher für Rate-Limits und
  // alles andere im Prozess — gemeinsam ist nur die Datenbank.
  vi.resetModules()
  instanzB = (await import('@/lib/auth')).auth
})

afterEach(async () => {
  versand.codes.length = 0
  await prisma.verification.deleteMany({ where: { identifier: { contains: 'otp-int-' } } })
  await raeumeAuf()
})

function neueAdresse(): string {
  return `${intKennung('kundin')}@example.com`
}

async function fordereCodeAn(auth: Auth, email: string): Promise<string> {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const gesendet = versand.codes.findLast((c) => c.email === email)
  if (!gesendet) throw new Error('Kein Code verschickt')
  return gesendet.code
}

function falscherCode(richtig: string): string {
  return richtig === '000000' ? '111111' : '000000'
}

async function versuche(auth: Auth, email: string, otp: string): Promise<{ ok: true } | { ok: false; code: string }> {
  try {
    await auth.api.signInEmailOTP({ body: { email, otp } })
    return { ok: true }
  } catch (e) {
    const fehler = e as { body?: { code?: string } }
    return { ok: false, code: fehler.body?.code ?? 'UNBEKANNT' }
  }
}

async function zeile(email: string): Promise<{ value: string; expiresAt: Date }> {
  const gefunden = await prisma.verification.findFirst({ where: { identifier: `sign-in-otp-${email}` } })
  if (!gefunden) throw new Error('Keine Code-Zeile in der Datenbank')
  return gefunden
}

describe('Anmeldecode in der Datenbank', () => {
  it('liegt gehasht, mit Zähler 0 und 10 Minuten Laufzeit', async () => {
    const email = neueAdresse()
    const vorher = Date.now()
    const code = await fordereCodeAn(instanzA, email)

    const z = await zeile(email)
    expect(code).toMatch(/^\d{6}$/)
    expect(z.value).not.toContain(code)
    expect(z.value.endsWith(':0')).toBe(true)
    const laufzeit = z.expiresAt.getTime() - vorher
    expect(laufzeit).toBeGreaterThan(9 * 60_000)
    expect(laufzeit).toBeLessThanOrEqual(10 * 60_000 + 5_000)
  })

  it('zählt Fehlversuche über zwei Instanzen hinweg und sperrt nach dem fünften', async () => {
    const email = neueAdresse()
    const code = await fordereCodeAn(instanzA, email)
    const falsch = falscherCode(code)

    for (let i = 0; i < 3; i++) expect(await versuche(instanzA, email, falsch)).toEqual({ ok: false, code: 'INVALID_OTP' })
    for (let i = 0; i < 2; i++) expect(await versuche(instanzB, email, falsch)).toEqual({ ok: false, code: 'INVALID_OTP' })

    expect((await zeile(email)).value.endsWith(':5')).toBe(true)
    expect(await versuche(instanzB, email, code)).toEqual({ ok: false, code: 'TOO_MANY_ATTEMPTS' })
    expect(await prisma.session.count({ where: { user: { email } } })).toBe(0)
  })

  it('Gegenprobe: nach vier Fehlversuchen nimmt der richtige Code noch an — genau einmal', async () => {
    const email = neueAdresse()
    const code = await fordereCodeAn(instanzA, email)
    const falsch = falscherCode(code)
    for (let i = 0; i < 4; i++) await versuche(i % 2 ? instanzB : instanzA, email, falsch)

    expect(await versuche(instanzB, email, code)).toEqual({ ok: true })
    expect(await prisma.session.count({ where: { user: { email } } })).toBe(1)
    const kundin = await prisma.user.findUnique({ where: { email } })
    expect(kundin?.role).toBe('CUSTOMER')
    expect(kundin?.emailVerified).toBe(true)

    expect(await versuche(instanzA, email, code)).toEqual({ ok: false, code: 'INVALID_OTP' })
  })

  it('ein abgelaufener Code nimmt nicht an', async () => {
    const email = neueAdresse()
    const code = await fordereCodeAn(instanzA, email)
    await prisma.verification.updateMany({
      where: { identifier: `sign-in-otp-${email}` },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    })

    expect(await versuche(instanzA, email, code)).toEqual({ ok: false, code: 'OTP_EXPIRED' })
    expect(await prisma.session.count({ where: { user: { email } } })).toBe(0)
  })

  it('ein Hof bekommt keinen Code', async () => {
    const email = neueAdresse()
    await prisma.user.create({
      data: { id: intKennung('hof-nutzer'), email, name: 'Max Mustermann', role: 'FARMER', emailVerified: true },
    })

    await instanzA.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })

    expect(versand.codes.filter((c) => c.email === email)).toHaveLength(0)
  })

  it('nur „sign-in" darf angefordert werden — kein Passwort-Zurücksetzen per Code', async () => {
    const email = neueAdresse()
    await expect(
      instanzA.api.sendVerificationOTP({ body: { email, type: 'forget-password' } })
    ).rejects.toMatchObject({ status: 'BAD_REQUEST' })
    expect(versand.codes).toHaveLength(0)
  })
})

describe('HTTP-Pfade', () => {
  const basis = 'http://localhost:3000/api/auth'
  const post = (pfad: string, body: object) =>
    instanzA.handler(
      new Request(`${basis}${pfad}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify(body),
      })
    )

  it('Magic Links lassen sich nicht mehr anfordern', async () => {
    const antwort = await post('/sign-in/magic-link', { email: neueAdresse() })
    expect(antwort.status).toBe(404)
  })

  it('alte Magic Links prüft der Endpunkt noch (Übergang), ungültige leiten mit Fehler weiter', async () => {
    const antwort = await instanzA.handler(
      new Request(`${basis}/magic-link/verify?token=int-ungueltig&callbackURL=%2Faccount%2Fprofile`)
    )
    expect(antwort.status).not.toBe(404)
  })

  it('ungenutzte Code-Pfade sind zu', async () => {
    for (const pfad of ['/email-otp/reset-password', '/forget-password/email-otp', '/email-otp/verify-email']) {
      expect((await post(pfad, { email: neueAdresse(), otp: '000000', password: 'x'.repeat(12) })).status, pfad).toBe(404)
    }
  })

  it('Gegenprobe: Code anfordern über HTTP geht', async () => {
    const email = neueAdresse()
    const antwort = await post('/email-otp/send-verification-otp', { email, type: 'sign-in' })
    expect(antwort.status).toBe(200)
    expect(versand.codes.some((c) => c.email === email)).toBe(true)
  })
})

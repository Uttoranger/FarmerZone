/**
 * Registrierung mit vergebener Adresse gegen ein ECHTES Postgres und echtes
 * Better Auth (Register F6 „19b", Nachtlauf Nr. 27).
 *
 * Beweist:
 *  - Eine vergebene Adresse bekommt dieselbe Antwort wie eine neue
 *    ({ ok: true }). Am bestehenden Konto ändert sich nichts: kein zweites
 *    Konto, keine andere Rolle, das alte Passwort gilt weiter, das neue nicht,
 *    keine Bestätigungs-Mail, keine Sitzung (Pre-Hijacking aus 17b bleibt zu).
 *  - Das bestehende Konto bekommt NACH der Antwort einen Hinweis — höchstens
 *    einen je 24 Stunden, auch bei zwei gleichzeitigen Versuchen. Ein Hof mit
 *    Passwort-Weg, eine Kundin mit Code-Weg.
 *  - Ein gescheiterter Hinweis rollt nichts zurück und geht ohne Adresse
 *    nach Sentry.
 *  - Gegenprobe neue Adresse: Konto FARMER, Bestätigungs-Mail, kein Hinweis,
 *    keine Sitzung (das Formular meldet nicht mehr selbst an).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { registrierungsHinweisKennung } from '@/lib/registrierung-hinweis'
import { versandKennung } from '@/lib/email-bestaetigung'
import { intKennung, raeumeAuf } from './setup/basis'

const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
const versand = vi.hoisted(() => ({
  hinweise: [] as Array<{ email: string; weg: string }>,
  bestaetigungen: [] as string[],
  hinweisScheitert: false,
}))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
// Die Zeitschranke der Registrierung (drei Sekunden) prüft register-spam.test.ts.
vi.mock('@/lib/form-token', async (original) => ({
  ...(await original<typeof import('@/lib/form-token')>()),
  checkFormToken: () => 'ok',
}))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@/lib/email', () => ({
  sendRegistrierungsHinweis: vi.fn(async (email: string, ziele: { weg: string }) => {
    if (versand.hinweisScheitert) throw new Error(`Resend kaputt für ${email}`)
    versand.hinweise.push({ email, weg: ziele.weg })
    return { id: 'int-mail' }
  }),
  sendEmailBestaetigung: vi.fn(async (email: string) => {
    versand.bestaetigungen.push(email)
    return { id: 'int-mail' }
  }),
  sendAnmeldeCodeEmail: vi.fn(async () => ({ id: 'int-mail' })),
  sendMagicLinkEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

async function arbeiteNachlaufAb(): Promise<void> {
  while (nachlauf.aufgaben.length > 0) await nachlauf.aufgaben.shift()?.()
}

type Auth = (typeof import('@/lib/auth'))['auth']
let auth: Auth
let registerFarmer: (typeof import('@/server/actions/register'))['registerFarmer']

beforeAll(async () => {
  auth = (await import('@/lib/auth')).auth
  registerFarmer = (await import('@/server/actions/register')).registerFarmer
}, 30_000)

afterEach(async () => {
  nachlauf.aufgaben.length = 0
  versand.hinweise.length = 0
  versand.bestaetigungen.length = 0
  versand.hinweisScheitert = false
  const konten = await prisma.user.findMany({ where: { email: { startsWith: 'int-' } }, select: { id: true } })
  await prisma.verification.deleteMany({
    where: {
      identifier: { in: konten.flatMap((k) => [registrierungsHinweisKennung(k.id), versandKennung(k.id)]) },
    },
  })
  await raeumeAuf()
})

const ALTES_PASSWORT = 'Test-Passwort-1234'
const NEUES_PASSWORT = 'Anderes-Passwort-5678'

function registriere(email: string, password: string = NEUES_PASSWORT) {
  return registerFarmer({ firstName: 'Fremder', lastName: 'Name', email, password, website: '', formToken: 'egal' })
}

/** Ein bestehender Hof, wie registerFarmer ihn anlegt. */
async function bestehenderHof(): Promise<{ id: string; email: string }> {
  const email = `${intKennung('hof')}@example.com`
  expect(await registriere(email, ALTES_PASSWORT)).toEqual({ ok: true })
  await arbeiteNachlaufAb()
  versand.bestaetigungen.length = 0
  const konto = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })
  return { id: konto.id, email }
}

async function passwortGilt(email: string, password: string): Promise<boolean> {
  try {
    await auth.api.signInEmail({ body: { email, password } })
    return true
  } catch {
    return false
  }
}

describe('vergebene Adresse eines Hofs', () => {
  it('dieselbe Antwort wie bei Erfolg; am Konto ändert sich nichts', async () => {
    const { id, email } = await bestehenderHof()
    const vorher = await prisma.user.findUniqueOrThrow({ where: { id } })

    const antwort = await registriere(email)
    await arbeiteNachlaufAb()

    expect(antwort).toEqual({ ok: true })
    expect(await prisma.user.count({ where: { email } })).toBe(1)
    const danach = await prisma.user.findUniqueOrThrow({ where: { id } })
    expect(danach.role).toBe('FARMER')
    expect(danach.name).toBe(vorher.name)
    expect(danach.emailVerified).toBe(vorher.emailVerified)
    expect(await prisma.session.count({ where: { userId: id } })).toBe(0)
    expect(await passwortGilt(email, NEUES_PASSWORT)).toBe(false)
    expect(await passwortGilt(email, ALTES_PASSWORT)).toBe(true)
    expect(versand.bestaetigungen).toEqual([])
  })

  it('der Hof bekommt nach der Antwort genau einen Hinweis mit dem Passwort-Weg', async () => {
    const { email } = await bestehenderHof()

    await registriere(email)
    expect(versand.hinweise).toEqual([]) // erst nach der Antwort
    await arbeiteNachlaufAb()

    expect(versand.hinweise).toEqual([{ email, weg: 'passwort' }])
  })

  it('ein zweiter Versuch im Fenster schickt keine zweite Mail — die Antwort bleibt gleich', async () => {
    const { email } = await bestehenderHof()

    expect(await registriere(email)).toEqual({ ok: true })
    await arbeiteNachlaufAb()
    expect(await registriere(email)).toEqual({ ok: true })
    await arbeiteNachlaufAb()

    expect(versand.hinweise).toHaveLength(1)
  })

  it('zwei gleichzeitige Versuche: genau eine Mail', async () => {
    const { email } = await bestehenderHof()

    await Promise.all([registriere(email), registriere(email)])
    await Promise.all(nachlauf.aufgaben.splice(0).map((aufgabe) => aufgabe()))

    expect(versand.hinweise).toHaveLength(1)
  })

  it('scheitert der Hinweis: nichts zurückgerollt, Sentry ohne Adresse', async () => {
    const { id, email } = await bestehenderHof()
    versand.hinweisScheitert = true
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await registriere(email)).toEqual({ ok: true })
    await arbeiteNachlaufAb()

    expect(await prisma.user.findUnique({ where: { id } })).not.toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const gemeldet = JSON.stringify(vi.mocked(Sentry.captureException).mock.calls)
    expect(gemeldet).not.toContain(email)
    expect(gemeldet).not.toContain('@example.com')
  })
})

describe('vergebene Adresse einer Kundin (Code-Anmeldung)', () => {
  it('dieselbe Antwort; kein Passwort am Kundinnen-Konto, Rolle bleibt; Hinweis mit Code-Weg', async () => {
    const email = `${intKennung('kundin')}@example.com`
    const konto = await prisma.user.create({
      data: { id: intKennung('konto'), email, name: '', role: 'CUSTOMER', emailVerified: true },
    })

    expect(await registriere(email)).toEqual({ ok: true })
    await arbeiteNachlaufAb()

    const danach = await prisma.user.findUniqueOrThrow({ where: { id: konto.id } })
    expect(danach.role).toBe('CUSTOMER')
    expect(await prisma.account.count({ where: { userId: konto.id } })).toBe(0)
    expect(versand.hinweise).toEqual([{ email, weg: 'code' }])
    expect(versand.bestaetigungen).toEqual([])
  })
})

describe('Gegenprobe: neue Adresse', () => {
  it('legt den Hof an, schickt die Bestätigungs-Mail, keinen Hinweis — und meldet niemanden an', async () => {
    const email = `${intKennung('neu')}@example.com`

    expect(await registriere(email)).toEqual({ ok: true })
    await arbeiteNachlaufAb()

    const konto = await prisma.user.findUniqueOrThrow({ where: { email } })
    expect(konto.role).toBe('FARMER')
    expect(await prisma.session.count({ where: { userId: konto.id } })).toBe(0)
    expect(versand.bestaetigungen).toEqual([email])
    expect(versand.hinweise).toEqual([])
    expect(await passwortGilt(email, NEUES_PASSWORT)).toBe(true)
  })
})

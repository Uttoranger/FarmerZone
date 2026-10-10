/**
 * /account nach der Code-Anmeldung eines ruhenden Altkontos — echtes Postgres,
 * echtes Better Auth (Nachtlauf Nr. 17a, Nachbesserung Runde 1).
 *
 * Ruhende Konten aus dem Checkout (bis Nr. 17a) sind unbestätigt. Meldet sich
 * die Kundin mit Code an, setzt Better Auth `emailVerified` in der Datenbank,
 * legt aber den ALTEN Stand (`emailVerified: false`) für fünf Minuten in den
 * Cookie-Cache der Sitzung (email-otp/routes.mjs: erst updateUser, dann
 * setSessionCookie mit dem vorher gelesenen Nutzer). Beweist:
 *  - Das Sitzungsobjekt ist tatsächlich veraltet (Ursache festgehalten).
 *  - Trotzdem zeigt /account/profile sofort die Abos der Adresse, „Abo
 *    ändern" wirkt, und „Konto löschen" nimmt Konto UND Abos mit — entschieden
 *    wird nach dem frischen Stand in der Datenbank.
 *  - Gegenprobe: Ein Passwort-Konto ohne Bestätigung sieht keine Abos und
 *    kann sie weder ändern noch mit dem Konto löschen.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

const anfrage = vi.hoisted(() => ({ headers: new Headers() }))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => anfrage.headers) }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT ${ziel}`)
  }),
}))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendAnmeldeCodeEmail: vi.fn(), sendMagicLinkEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({ KundeShellMitSitzung: () => null }))
vi.mock('@/app/account/profile/profile-client', () => ({ ProfileClient: () => null }))

import { prisma } from '@/lib/prisma'
import { erstelleHof, intKennung, raeumeAuf } from './setup/basis'

type Auth = (typeof import('@/lib/auth'))['auth']
let auth: Auth
let AccountProfilePage: (typeof import('@/app/account/profile/page'))['default']
let aktionen: typeof import('@/server/actions/subscriptions')

beforeAll(async () => {
  auth = (await import('@/lib/auth')).auth
  AccountProfilePage = (await import('@/app/account/profile/page')).default
  aktionen = await import('@/server/actions/subscriptions')
}, 30_000)

afterEach(async () => {
  anfrage.headers = new Headers()
  await prisma.verification.deleteMany({ where: { identifier: { contains: 'otp-int-' } } })
  await raeumeAuf()
})

/** Meldet die Adresse mit Code an und nimmt das Sitzungs-Cookie in die Anfrage. */
async function meldeMitCodeAn(email: string): Promise<void> {
  const otp = await auth.api.createVerificationOTP({ body: { email, type: 'sign-in' } })
  const { headers } = await auth.api.signInEmailOTP({ body: { email, otp }, returnHeaders: true })
  const cookie = headers.getSetCookie().map((zeile) => zeile.split(';')[0]).join('; ')
  anfrage.headers = new Headers({ cookie })
}

async function abosAufDerSeite(): Promise<unknown[]> {
  const seite = (await AccountProfilePage()) as ReactElement<{ children: ReactElement<{ subscriptions: unknown[] }> }>
  return seite.props.children.props.subscriptions
}

async function ruhendesKontoMitAbo(): Promise<{ id: string; email: string; farmId: string }> {
  const { farm } = await erstelleHof()
  const email = `${intKennung('kundin')}@example.com`
  const konto = await prisma.user.create({
    data: { id: intKennung('konto'), email, name: 'Erika Mustermann', role: 'CUSTOMER', emailVerified: false },
  })
  await prisma.customerFarmSubscription.create({
    data: { customerEmail: email, farmId: farm.id, optInEmail: true, customerPhone: '+43 660 0000000' },
  })
  return { id: konto.id, email, farmId: farm.id }
}

describe('/account nach der Code-Anmeldung eines ruhenden Altkontos', () => {
  it('das Sitzungsobjekt ist veraltet — die Datenbank sagt bestätigt (Ursache)', async () => {
    const { id, email } = await ruhendesKontoMitAbo()

    await meldeMitCodeAn(email)

    const sitzung = await auth.api.getSession({ headers: anfrage.headers })
    expect(sitzung?.user.id).toBe(id)
    expect(sitzung?.user.emailVerified).toBe(false)
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).emailVerified).toBe(true)
  })

  it('zeigt die Abos sofort', async () => {
    const { email } = await ruhendesKontoMitAbo()
    await meldeMitCodeAn(email)

    expect(await abosAufDerSeite()).toHaveLength(1)
  })

  it('„Abo ändern" wirkt sofort', async () => {
    const { email, farmId } = await ruhendesKontoMitAbo()
    await meldeMitCodeAn(email)

    expect(await aktionen.updateSubscription(farmId, false, false)).toEqual({ email: 'aus' })
    const abo = await prisma.customerFarmSubscription.findUniqueOrThrow({
      where: { customerEmail_farmId: { customerEmail: email, farmId } },
    })
    expect(abo.optInEmail).toBe(false)
  })

  it('„Konto löschen" nimmt Konto und Abos mit — keine Abos bleiben verwaist stehen', async () => {
    const { id, email } = await ruhendesKontoMitAbo()
    await meldeMitCodeAn(email)

    expect(await aktionen.deleteCustomerAccount()).toEqual({})
    expect(await prisma.user.findUnique({ where: { id } })).toBeNull()
    expect(await prisma.customerFarmSubscription.count({ where: { customerEmail: email } })).toBe(0)
  })
})

describe('Gegenprobe: Passwort-Konto ohne bestätigte Adresse', () => {
  async function passwortKontoMitFremdemAbo(): Promise<{ email: string; farmId: string }> {
    const { farm } = await erstelleHof()
    const email = `${intKennung('fremd')}@example.com`
    await auth.api.signUpEmail({ body: { email, password: 'test-passwort-1', name: 'Fremder Name' } })
    // Das Abo gehört der Gast-Kundin, die unter dieser Adresse bestellt hat.
    await prisma.customerFarmSubscription.create({
      data: { customerEmail: email, farmId: farm.id, optInEmail: true, customerPhone: '+43 660 0000000' },
    })
    const { headers } = await auth.api.signInEmail({ body: { email, password: 'test-passwort-1' }, returnHeaders: true })
    anfrage.headers = new Headers({ cookie: headers.getSetCookie().map((z) => z.split(';')[0]).join('; ') })
    return { email, farmId: farm.id }
  }

  it('sieht keine Abos, kann sie nicht ändern und nicht mit dem Konto löschen', async () => {
    const { email, farmId } = await passwortKontoMitFremdemAbo()

    expect(await abosAufDerSeite()).toEqual([])
    expect((await aktionen.updateSubscription(farmId, false, false)).error).toBeTruthy()
    expect((await aktionen.deleteCustomerAccount()).error).toBeTruthy()
    const abo = await prisma.customerFarmSubscription.findUniqueOrThrow({
      where: { customerEmail_farmId: { customerEmail: email, farmId } },
    })
    expect(abo.optInEmail).toBe(true)
    expect(await prisma.user.count({ where: { email } })).toBe(1)
  })
})

describe('Erster Code-Login leert Name und Telefon einer fremden Alt-Registrierung (Register B3, Nr. 27)', () => {
  /**
   * Jemand hat die Adresse einer Gast-Kundin früher mit Passwort registriert
   * (vor Nr. 17b ging das) und Name und Telefon hinterlassen. Better Auth
   * entfernt beim ersten Code der echten Kundin Passwort und Sitzungen — am
   * Entfernen des Passworts erkennen wir die fremde Registrierung.
   */
  async function fremdeAltRegistrierung(): Promise<{ id: string; email: string }> {
    const email = `${intKennung('fremd')}@example.com`
    await auth.api.signUpEmail({ body: { email, password: 'test-passwort-1', name: 'Fremder Name' } })
    const konto = await prisma.user.update({ where: { email }, data: { phone: '+43 660 0000000' }, select: { id: true } })
    return { id: konto.id, email }
  }

  it('leert Name und Telefon, bestätigt die Adresse und nimmt das fremde Passwort', async () => {
    const { id, email } = await fremdeAltRegistrierung()

    await meldeMitCodeAn(email)

    const konto = await prisma.user.findUniqueOrThrow({ where: { id } })
    expect(konto.emailVerified).toBe(true)
    expect(konto.name ?? '').toBe('')
    expect(konto.phone).toBeNull()
    expect(konto.role).toBe('CUSTOMER')
    expect(await prisma.account.count({ where: { userId: id, providerId: 'credential' } })).toBe(0)
  })

  it('ein ruhendes Konto aus dem alten Checkout (ohne Passwort) bleibt unverändert — es ist keine fremde Registrierung', async () => {
    const { id, email } = await ruhendesKontoMitAbo()
    await prisma.user.update({ where: { id }, data: { phone: '+43 660 0000000' } })

    await meldeMitCodeAn(email)

    const konto = await prisma.user.findUniqueOrThrow({ where: { id } })
    expect(konto.emailVerified).toBe(true)
    expect(konto.name).toBe('Erika Mustermann')
    expect(konto.phone).toBe('+43 660 0000000')
  })

  it('Gegenprobe: ein Hof mit Passwort bekommt keinen Code — Name und Telefon bleiben', async () => {
    const email = `${intKennung('hof')}@example.com`
    await auth.api.signUpEmail({ body: { email, password: 'test-passwort-1', name: 'Max Mustermann' } })
    const hof = await prisma.user.update({ where: { email }, data: { role: 'FARMER', phone: '+43 660 0000000' }, select: { id: true } })

    await expect(meldeMitCodeAn(email)).rejects.toThrow()

    const danach = await prisma.user.findUniqueOrThrow({ where: { id: hof.id } })
    expect(danach.name).toBe('Max Mustermann')
    expect(danach.phone).toBe('+43 660 0000000')
    expect(await prisma.account.count({ where: { userId: hof.id, providerId: 'credential' } })).toBe(1)
  })

  it('Gegenprobe: ein schon bestätigtes Kundinnen-Konto behält beim nächsten Code Name und Telefon', async () => {
    const email = `${intKennung('kundin')}@example.com`
    const konto = await prisma.user.create({
      data: { id: intKennung('konto'), email, name: 'Erika Mustermann', phone: '+43 660 0000000', role: 'CUSTOMER', emailVerified: true },
    })

    await meldeMitCodeAn(email)

    const danach = await prisma.user.findUniqueOrThrow({ where: { id: konto.id } })
    expect(danach.name).toBe('Erika Mustermann')
    expect(danach.phone).toBe('+43 660 0000000')
  })

  it('Gegenprobe: die Bestätigung eines Hofs per Link leert nichts', async () => {
    const email = `${intKennung('hof')}@example.com`
    await auth.api.signUpEmail({ body: { email, password: 'test-passwort-1', name: 'Max Mustermann' } })
    const hof = await prisma.user.update({ where: { email }, data: { role: 'FARMER', phone: '+43 660 0000000' }, select: { id: true } })
    // Better Auth erzeugt den Token selbst — hier über denselben Weg wie die Mail.
    const { createEmailVerificationToken } = await import('better-auth/api')
    const token = await createEmailVerificationToken(process.env.BETTER_AUTH_SECRET ?? '', email)

    await auth.api.verifyEmail({ query: { token } })

    const danach = await prisma.user.findUniqueOrThrow({ where: { id: hof.id } })
    expect(danach.emailVerified).toBe(true)
    expect(danach.name).toBe('Max Mustermann')
    expect(danach.phone).toBe('+43 660 0000000')
  })
})

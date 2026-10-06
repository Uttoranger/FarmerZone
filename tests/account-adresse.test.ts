/**
 * /account zeigt und ändert Daten zur Adresse nur für die bestätigte,
 * angemeldete Adresse (E8, Nachtlauf Nr. 17a).
 *
 * Seit der Checkout kein Konto mehr anlegt, kann eine Adresse mit
 * Bestellungen und Abos ohne Konto sein — und wer sie kennt, könnte sie mit
 * Passwort registrieren (`requireEmailVerification: false`). Bewiesen ist eine
 * Adresse nur durch die Code-Anmeldung (Better Auth setzt dabei
 * `emailVerified`). Beweist am echten Code (Seite und Server Actions; Auth,
 * Prisma und die Darstellung gemockt):
 *  - Bestätigte Adresse: Die Abos werden genau nach DIESER Adresse gelesen
 *    (klein geschrieben), nach nichts anderem — keine Kunden-ID, kein Konto.
 *  - Unbestätigte Adresse: keine Abfrage, keine Abos; Ändern und Löschen der
 *    Abos wirken nicht. Das eigene Konto löschen bleibt möglich.
 *  - Ohne Sitzung: weiter zur Anmeldung.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT ${ziel}`)
  }),
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    customerFarmSubscription: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    user: { delete: vi.fn() },
  },
}))
// Die Darstellung hat eigene Wege (Browser-Prüfung); hier zählt, was die Seite ihr übergibt.
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({ KundeShellMitSitzung: () => null }))
vi.mock('@/app/account/profile/profile-client', () => ({ ProfileClient: () => null }))

import AccountProfilePage from '@/app/account/profile/page'
import { updateSubscription, deleteCustomerAccount } from '@/server/actions/subscriptions'
import { adresseBestaetigt } from '@/lib/anmeldecode'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const getSession = vi.mocked(auth.api.getSession)
const aboFindMany = vi.mocked(prisma.customerFarmSubscription.findMany)
const aboUpsert = vi.mocked(prisma.customerFarmSubscription.upsert)
const aboDeleteMany = vi.mocked(prisma.customerFarmSubscription.deleteMany)
const userDelete = vi.mocked(prisma.user.delete)

const ABO = {
  farmId: 'farm_1',
  farm: { id: 'farm_1', name: 'Hof Test', slug: 'hof-test' },
  optInEmail: true,
  optInWhatsApp: false,
  customerPhone: null,
}

function sitzung(emailVerified: boolean): void {
  getSession.mockResolvedValue({
    user: { id: 'user_1', name: 'Erika Mustermann', email: 'Erika.Mustermann@Example.org', emailVerified, role: 'CUSTOMER' },
  } as never)
}

/** Die Abos, die die Seite an ProfileClient übergibt. */
async function aboAnzeige(): Promise<unknown[]> {
  const seite = (await AccountProfilePage()) as ReactElement<{ children: ReactElement<{ subscriptions: unknown[] }> }>
  return seite.props.children.props.subscriptions
}

beforeEach(() => {
  vi.clearAllMocks()
  aboFindMany.mockResolvedValue([ABO] as never)
  aboUpsert.mockResolvedValue({} as never)
  aboDeleteMany.mockResolvedValue({ count: 1 } as never)
  userDelete.mockResolvedValue({} as never)
})

describe('adresseBestaetigt', () => {
  it('nur eine bestätigte Adresse zählt', () => {
    expect(adresseBestaetigt({ emailVerified: true })).toBe(true)
    expect(adresseBestaetigt({ emailVerified: false })).toBe(false)
    expect(adresseBestaetigt({ emailVerified: null })).toBe(false)
    expect(adresseBestaetigt({})).toBe(false)
    expect(adresseBestaetigt(null)).toBe(false)
    expect(adresseBestaetigt(undefined)).toBe(false)
  })
})

describe('/account/profile — nur die eigene, bestätigte Adresse', () => {
  it('nach der Code-Anmeldung: Abos genau dieser Adresse, klein geschrieben, nach nichts anderem', async () => {
    sitzung(true)

    const abos = await aboAnzeige()

    expect(aboFindMany).toHaveBeenCalledOnce()
    expect(aboFindMany.mock.calls[0][0]?.where).toEqual({ customerEmail: 'erika.mustermann@example.org' })
    expect(abos).toHaveLength(1)
  })

  it('unbestätigte Adresse (Passwort-Konto): keine Abfrage, keine Abos', async () => {
    sitzung(false)

    const abos = await aboAnzeige()

    expect(aboFindMany).not.toHaveBeenCalled()
    expect(abos).toEqual([])
  })

  it('ohne Sitzung: weiter zur Anmeldung, nichts gelesen', async () => {
    getSession.mockResolvedValue(null as never)

    await expect(AccountProfilePage()).rejects.toThrow('REDIRECT /account/login')
    expect(aboFindMany).not.toHaveBeenCalled()
  })
})

describe('Abos ändern und löschen — nur mit bestätigter Adresse', () => {
  it('unbestätigt: Ändern wirkt nicht und sagt, wie es geht', async () => {
    sitzung(false)

    const ergebnis = await updateSubscription('farm_1', false, false)

    expect(ergebnis.error).toBeTruthy()
    expect(aboUpsert).not.toHaveBeenCalled()
  })

  it('Gegenprobe: bestätigt ändert das Abo dieser Adresse', async () => {
    sitzung(true)

    const ergebnis = await updateSubscription('farm_1', false, false)

    expect(ergebnis).toEqual({})
    expect(aboUpsert.mock.calls[0][0].where).toEqual({
      customerEmail_farmId: { customerEmail: 'erika.mustermann@example.org', farmId: 'farm_1' },
    })
  })

  it('unbestätigt: Konto löschen lässt fremde Abos zur Adresse stehen, das eigene Konto geht', async () => {
    sitzung(false)

    const ergebnis = await deleteCustomerAccount()

    expect(ergebnis).toEqual({})
    expect(aboDeleteMany).not.toHaveBeenCalled()
    expect(userDelete).toHaveBeenCalledWith({ where: { id: 'user_1' } })
  })

  it('Gegenprobe: bestätigt löscht die Abos dieser Adresse mit', async () => {
    sitzung(true)

    await deleteCustomerAccount()

    expect(aboDeleteMany).toHaveBeenCalledWith({ where: { customerEmail: 'erika.mustermann@example.org' } })
  })
})

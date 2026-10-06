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
 *  - Entschieden wird nach dem FRISCHEN Stand des Kontos in der Datenbank,
 *    nie nach dem Sitzungsobjekt: Better Auth legt nach der Code-Anmeldung
 *    eines vorher unbestätigten Kontos den alten Stand (`emailVerified:
 *    false`) für fünf Minuten in den Cookie-Cache (Nachbesserung Runde 1).
 *  - Bestätigte Adresse: Die Abos werden genau nach DIESER Adresse gelesen
 *    (klein geschrieben), nach nichts anderem — keine Kunden-ID, kein Konto.
 *  - Unbestätigte Adresse: keine Abfrage, keine Abos; Ändern und Löschen der
 *    Abos wirken nicht; Konto löschen wird ebenfalls abgelehnt, statt das
 *    Konto zu löschen und die Abos zur Adresse stehen zu lassen.
 *  - Ein neues Abo übernimmt keine Telefonnummer aus dem Konto (die kann von
 *    einer unbewiesenen Registrierung stammen); die Seite gibt den Kontonamen
 *    nicht an den Browser.
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
    user: { delete: vi.fn(), findUnique: vi.fn() },
    // Löschen läuft seit Nr. 17b in einer Transaktion: Abos und Konto zusammen.
    $transaction: vi.fn(async (schritte: Promise<unknown>[]) => Promise.all(schritte)),
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
const userFindUnique = vi.mocked(prisma.user.findUnique)

const ABO = {
  farmId: 'farm_1',
  farm: { id: 'farm_1', name: 'Hof Test', slug: 'hof-test' },
  optInEmail: true,
  optInWhatsApp: false,
  customerPhone: null,
}

/**
 * Sitzung und Datenbank getrennt: `inDb` ist der frische Stand des Kontos,
 * `imCookie` der zwischengespeicherte im Sitzungsobjekt (Standard: gleich).
 */
function sitzung(
  inDb: boolean,
  imCookie: boolean = inDb,
  konto: { role: string; isAdmin: boolean } = { role: 'CUSTOMER', isAdmin: false }
): void {
  getSession.mockResolvedValue({
    user: {
      id: 'user_1',
      name: 'Fremder Name',
      email: 'Erika.Mustermann@Example.org',
      emailVerified: imCookie,
      role: 'CUSTOMER',
      phone: '+43 660 0000001',
    },
  } as never)
  userFindUnique.mockResolvedValue({ email: 'erika.mustermann@example.org', emailVerified: inDb, ...konto } as never)
}

type ProfilProps = { subscriptions: unknown[]; user: Record<string, unknown> }

/** Was die Seite an ProfileClient übergibt. */
async function profilProps(): Promise<ProfilProps> {
  const seite = (await AccountProfilePage()) as ReactElement<{ children: ReactElement<ProfilProps> }>
  return seite.props.children.props
}

async function aboAnzeige(): Promise<unknown[]> {
  return (await profilProps()).subscriptions
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

  it('veraltete Sitzung nach der Code-Anmeldung (Cookie unbestätigt, Datenbank bestätigt): Abos sichtbar', async () => {
    sitzung(true, false)

    const abos = await aboAnzeige()

    expect(userFindUnique).toHaveBeenCalledWith({ where: { id: 'user_1' }, select: { email: true, emailVerified: true } })
    expect(abos).toHaveLength(1)
  })

  it('umgekehrt (Cookie bestätigt, Datenbank nicht): keine Abos', async () => {
    sitzung(false, true)

    expect(await aboAnzeige()).toEqual([])
    expect(aboFindMany).not.toHaveBeenCalled()
  })

  it('das Konto gibt es nicht mehr: keine Abos', async () => {
    sitzung(true)
    userFindUnique.mockResolvedValue(null)

    expect(await aboAnzeige()).toEqual([])
    expect(aboFindMany).not.toHaveBeenCalled()
  })

  it('gibt den Kontonamen nicht an den Browser (er kann aus einer unbewiesenen Registrierung stammen)', async () => {
    sitzung(true)

    const { user } = await profilProps()

    expect(user).toEqual({ id: 'user_1', email: 'Erika.Mustermann@Example.org' })
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

  it('veraltete Sitzung (Cookie unbestätigt, Datenbank bestätigt): Ändern wirkt', async () => {
    sitzung(true, false)

    expect(await updateSubscription('farm_1', true, false)).toEqual({})
    expect(aboUpsert).toHaveBeenCalledOnce()
  })

  it('umgekehrt (Cookie bestätigt, Datenbank nicht): Ändern wirkt nicht', async () => {
    sitzung(false, true)

    expect((await updateSubscription('farm_1', true, false)).error).toBeTruthy()
    expect(aboUpsert).not.toHaveBeenCalled()
  })

  it('ein neues Abo übernimmt keine Telefonnummer aus dem Konto', async () => {
    sitzung(true)

    await updateSubscription('farm_1', true, true)

    expect(aboUpsert.mock.calls[0][0].create).toMatchObject({ customerPhone: null })
    expect(aboUpsert.mock.calls[0][0].update).toEqual({ optInEmail: true, optInWhatsApp: true })
  })

  it('unbestätigt: Konto löschen wird abgelehnt — weder Konto noch Abos verschwinden', async () => {
    sitzung(false)

    const ergebnis = await deleteCustomerAccount()

    expect(ergebnis.error).toBeTruthy()
    expect(aboDeleteMany).not.toHaveBeenCalled()
    expect(userDelete).not.toHaveBeenCalled()
  })

  it('veraltete Sitzung (Cookie unbestätigt, Datenbank bestätigt): löscht Abos UND Konto', async () => {
    sitzung(true, false)

    expect(await deleteCustomerAccount()).toEqual({})
    expect(aboDeleteMany).toHaveBeenCalledWith({ where: { customerEmail: 'erika.mustermann@example.org' } })
    expect(userDelete).toHaveBeenCalledWith({ where: { id: 'user_1' } })
  })

  it('Gegenprobe: bestätigt löscht die Abos dieser Adresse mit', async () => {
    sitzung(true)

    await deleteCustomerAccount()

    expect(aboDeleteMany).toHaveBeenCalledWith({ where: { customerEmail: 'erika.mustermann@example.org' } })
    expect(userDelete).toHaveBeenCalledWith({ where: { id: 'user_1' } })
  })

  it('ein bestätigter Hof löscht über „Konto löschen" weder Abos noch Konto (Nr. 17b)', async () => {
    // Seit 17b sind neue Höfe bestätigt — vorher schützte nur, dass Hof-Konten
    // unbestätigt waren. Ohne Rollenprüfung verschwänden die Abos zur Adresse,
    // und das Löschen des Kontos scheiterte danach an Farm.ownerId.
    sitzung(true, true, { role: 'FARMER', isAdmin: false })

    expect((await deleteCustomerAccount()).error).toBeTruthy()
    expect(aboDeleteMany).not.toHaveBeenCalled()
    expect(userDelete).not.toHaveBeenCalled()
  })

  it('ein Betreiber-Konto (isAdmin, Rolle CUSTOMER) löscht sich so nicht', async () => {
    sitzung(true, true, { role: 'CUSTOMER', isAdmin: true })

    expect((await deleteCustomerAccount()).error).toBeTruthy()
    expect(aboDeleteMany).not.toHaveBeenCalled()
    expect(userDelete).not.toHaveBeenCalled()
  })

  it('Abos und Konto gehen in EINER Transaktion', async () => {
    sitzung(true)

    expect(await deleteCustomerAccount()).toEqual({})
    expect(prisma.$transaction).toHaveBeenCalledOnce()
  })
})

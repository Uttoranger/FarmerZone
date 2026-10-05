/**
 * Obergrenzen an den Server Actions, die Hofname, Namen und E-Mail schreiben
 * (Fix „Namen und Freitexte ohne Obergrenze").
 *
 * Beweist am echten Code:
 *  - createFarm (Onboarding) — hier entsteht der Hofname zum ersten Mal; die
 *    Aktion schrieb ohne jedes Schema in die Datenbank.
 *  - registerFarmer — Name höchstens 80 Zeichen, Better Auth bekommt die
 *    bereinigte Adresse (vorher scheiterte schon ein Leerzeichen am Rand).
 *  - updateProfile — neue Werte halten die Grenze ein; ein Altwert, der vor
 *    der Grenze länger gespeichert wurde, sperrt den Hof NICHT: Bleibt er
 *    unverändert, lässt sich das Profil weiter speichern
 *    (CODING_STANDARDS §8, „Bestandsdaten müssen speicherbar bleiben").
 *
 * Prisma, Better Auth, Mail und next/* sind gemockt — keine Datenbank.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn(), signUpEmail: vi.fn() } },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    user: { update: vi.fn() },
  },
}))
vi.mock('@/lib/email', () => ({ sendNewFarmNotification: vi.fn() }))

import { createFarm } from '@/server/actions/onboarding'
import { registerFarmer } from '@/server/actions/register'
import { updateProfile } from '@/server/actions/farm'
import { generateFormToken } from '@/lib/form-token'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const getSession = vi.mocked(auth.api.getSession)
const signUpEmail = vi.mocked(auth.api.signUpEmail)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const farmCreate = vi.mocked(prisma.farm.create)
const farmUpdate = vi.mocked(prisma.farm.update)
const userUpdate = vi.mocked(prisma.user.update)

/** Ein Text mit genau `laenge` Zeichen. */
const text = (laenge: number, zeichen = 'x'): string => zeichen.repeat(laenge)

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1', email: 'max@example.org' } } as never)
  farmCreate.mockImplementation((({ data }: { data: { slug: string; name: string } }) =>
    Promise.resolve({ id: 'farm_neu', slug: data.slug, name: data.name })) as never)
  farmUpdate.mockResolvedValue({} as never)
  signUpEmail.mockResolvedValue({ user: { id: 'user_neu' } } as never)
  userUpdate.mockResolvedValue({} as never)
})

afterEach(() => {
  vi.useRealTimers()
})

// ── createFarm (Onboarding) ─────────────────────────────────────────────────

describe('createFarm — Obergrenzen beim Anlegen', () => {
  const ANLAGE = {
    name: 'Hof Test',
    ownerName: 'Max Mustermann',
    description: '',
    address: 'Dorfstraße 12',
    postalCode: '3400',
    city: 'Klosterneuburg',
    phone: '+43 660 0000000',
    email: 'hof@example.org',
  }

  beforeEach(() => {
    // Kein Hof für diesen Nutzer, jeder Slug frei.
    farmFindUnique.mockResolvedValue(null)
  })

  it('legt einen Hof mit einem Hofnamen von genau 80 Zeichen an', async () => {
    const res = await createFarm({ ...ANLAGE, name: text(80) })

    expect(res).not.toHaveProperty('error')
    expect(farmCreate).toHaveBeenCalledTimes(1)
  })

  it('lehnt einen Hofnamen mit 81 Zeichen ab und legt keinen Hof an', async () => {
    const res = await createFarm({ ...ANLAGE, name: text(81) })

    expect(res).toHaveProperty('error')
    expect(farmCreate).not.toHaveBeenCalled()
  })

  it('lehnt einen Betreibernamen mit 81 Zeichen ab', async () => {
    const res = await createFarm({ ...ANLAGE, ownerName: text(81) })

    expect(res).toHaveProperty('error')
    expect(farmCreate).not.toHaveBeenCalled()
  })

  it('lehnt eine Telefonnummer mit 31 Zeichen ab', async () => {
    const res = await createFarm({ ...ANLAGE, phone: text(31, '1') })

    expect(res).toHaveProperty('error')
    expect(farmCreate).not.toHaveBeenCalled()
  })

  it('speichert die Hof-E-Mail ohne Ränder und klein geschrieben', async () => {
    await createFarm({ ...ANLAGE, email: ' Hof@Example.ORG ' })

    const daten = (farmCreate.mock.calls[0][0] as { data: { email: string } }).data
    expect(daten.email).toBe('hof@example.org')
  })

  it('belegt die Servicegebühr eines neuen Hofes mit 5 % / mind. 50 Cent vor — gebührenfrei bis zum Datum (E4)', async () => {
    // Der Spalten-Default im Schema steht noch auf 4,9; ohne ausdrücklichen
    // Wert bekäme jeder neue Hof den alten Satz (DEVELOPMENT.md, Servicegebühr E4).
    await createFarm(ANLAGE)

    const daten = (farmCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(daten.serviceFeePercent).toBe(5)
    expect(daten.serviceFeeMinCents).toBe(50)
    // „gilt ab" setzt nur der Betreiber im Admin — bis dahin bleibt der Hof gebührenfrei.
    expect(daten).not.toHaveProperty('serviceFeeActiveFrom')
  })
})

// ── registerFarmer ──────────────────────────────────────────────────────────

describe('registerFarmer — Name und E-Mail', () => {
  /** Ein Mensch: Honigtopf leer, Formular zehn Sekunden lang ausgefüllt. */
  function anmeldung(overrides: Partial<Parameters<typeof registerFarmer>[0]> = {}) {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T10:00:00.000Z'))
    const formToken = generateFormToken()
    vi.setSystemTime(new Date('2026-10-01T10:00:10.000Z'))
    return {
      firstName: 'Max',
      lastName: 'Mustermann',
      email: 'max@example.org',
      password: 'Hofladen1',
      website: '',
      formToken,
      ...overrides,
    }
  }

  it('legt das Konto mit der bereinigten, klein geschriebenen Adresse an', async () => {
    const res = await registerFarmer(anmeldung({ email: ' Max.Mustermann@Example.ORG ' }))

    expect(res).toEqual({ ok: true })
    expect(signUpEmail).toHaveBeenCalledWith({
      body: expect.objectContaining({ email: 'max.mustermann@example.org' }),
    })
  })

  it('nimmt einen Namen mit genau 80 Zeichen an — Vorname, Leerzeichen, Nachname', async () => {
    const res = await registerFarmer(anmeldung({ firstName: text(40, 'a'), lastName: text(39, 'b') }))

    expect(res).toEqual({ ok: true })
    expect(signUpEmail).toHaveBeenCalledTimes(1)
  })

  it('lehnt einen Namen mit 81 Zeichen ab, ohne ein Konto anzulegen', async () => {
    const res = await registerFarmer(anmeldung({ firstName: text(40, 'a'), lastName: text(40, 'b') }))

    expect(res).toHaveProperty('error')
    expect(signUpEmail).not.toHaveBeenCalled()
  })
})

// ── updateProfile ───────────────────────────────────────────────────────────

describe('updateProfile — Grenzen und Altbestand', () => {
  const PROFIL = {
    name: 'Hof Test',
    ownerName: 'Max Mustermann',
    description: 'Wir bauen seit 1920 Gemüse an.',
    address: 'Dorfstraße 12',
    postalCode: '3400',
    city: 'Klosterneuburg',
    phone: '+43 660 0000000',
    email: 'hof@example.org',
    country: 'AT' as const,
    latitude: null,
    longitude: null,
    betriebsnummer: null,
    betriebsstatus: null,
  }

  /** Ein Hofname, der vor der Grenze gespeichert wurde — 95 Zeichen. */
  const ALTER_NAME = text(95, 'h')
  /** Eine Telefonnummer mit Zusatz, wie sie vor der Grenze gespeichert wurde — 45 Zeichen. */
  const ALTE_TELEFONNUMMER = '+43 660 0000000 (nur abends, sonst Festnetz)'.padEnd(45, '.')

  beforeEach(() => {
    farmFindUnique.mockResolvedValue({
      id: 'farm_1',
      slug: 'hof-test',
      ...PROFIL,
      name: ALTER_NAME,
      phone: ALTE_TELEFONNUMMER,
    } as never)
  })

  it('speichert das Profil, wenn ein zu langer Altwert unverändert bleibt', async () => {
    const res = await updateProfile({
      ...PROFIL,
      name: ALTER_NAME,
      phone: ALTE_TELEFONNUMMER,
      city: 'Tulln',
    })

    expect(res.error).toBeUndefined()
    expect(farmUpdate).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: expect.objectContaining({ name: ALTER_NAME, city: 'Tulln' }),
    })
  })

  it('lehnt einen geänderten Hofnamen ab, der noch immer über 80 Zeichen hat', async () => {
    const res = await updateProfile({ ...PROFIL, name: text(90, 'h'), phone: ALTE_TELEFONNUMMER })

    expect(res.error).toBeTruthy()
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('nimmt einen gekürzten Hofnamen mit genau 80 Zeichen an', async () => {
    const res = await updateProfile({ ...PROFIL, name: text(80, 'h'), phone: ALTE_TELEFONNUMMER })

    expect(res.error).toBeUndefined()
    expect(farmUpdate).toHaveBeenCalledTimes(1)
  })

  it('lehnt eine neue Telefonnummer mit 31 Zeichen ab', async () => {
    const res = await updateProfile({ ...PROFIL, name: ALTER_NAME, phone: text(31, '1') })

    expect(res.error).toBeTruthy()
    expect(farmUpdate).not.toHaveBeenCalled()
  })
})

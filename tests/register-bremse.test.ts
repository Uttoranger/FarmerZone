/**
 * Die Bremse der Registrierung (Register R1, Nr. 40) — am echten
 * registerFarmer, Better Auth, Prisma und die zweite Stufe gemockt.
 *
 * Beweist:
 *  - In Produktion je IP zweistufig: erst der Speicher dieser Instanz
 *    (10 je Minute), dann die Datenbank über alle Instanzen.
 *  - Bremst eine der beiden Stufen, entsteht kein Konto, und die Antwort ist
 *    ein Satz ohne Fachwort.
 *  - Hält schon die Instanz an, wird die Datenbank nicht gefragt.
 *  - Bot-Abwehr und ungültige Eingaben zählen nicht (die Bremse sitzt vor
 *    dem teuren Teil, nach der Prüfung).
 *  - Außerhalb der Produktion bremst nichts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const kontext = vi.hoisted(() => ({ ip: '203.0.113.7' }))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers({ 'x-forwarded-for': kontext.ip })) }))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn(), signUpEmail: vi.fn(), sendVerificationEmail: vi.fn() } },
}))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { update: vi.fn() } } }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/server/bremse-datenbank', () => ({ bremseUeberAlleInstanzen: vi.fn(async () => true) }))

import { auth } from '@/lib/auth'
import { generateFormToken } from '@/lib/form-token'
import { DB_BREMSEN, REGISTRIERUNG_JE_IP, REGISTRIERUNG_ZU_VIELE } from '@/lib/bremse-datenbank'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'

const signUpEmail = vi.mocked(auth.api.signUpEmail)
const ueberAlle = vi.mocked(bremseUeberAlleInstanzen)

type Aktion = typeof import('@/server/actions/register')

/** Frische Instanz — die erste Stufe lebt auf Modulebene. */
async function ladeAktion(): Promise<Aktion['registerFarmer']> {
  vi.resetModules()
  return (await import('@/server/actions/register')).registerFarmer
}

/** Ein Mensch: Honigtopf leer, Formular zehn Sekunden lang ausgefüllt. */
function anmeldung(abweichend: Record<string, string> = {}) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-07T10:00:00.000Z'))
  const formToken = generateFormToken()
  vi.setSystemTime(new Date('2026-10-07T10:00:10.000Z'))
  return {
    firstName: 'Franz',
    lastName: 'Muster',
    email: 'franz@example.com',
    password: 'Hofladen1',
    website: '',
    formToken,
    ...abweichend,
  }
}

function alsProduktion(): void {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('DATABASE_URL', 'postgresql://platzhalter@localhost:5432/keine')
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_platzhalter')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_platzhalter')
}

beforeEach(() => {
  vi.clearAllMocks()
  kontext.ip = '203.0.113.7'
  signUpEmail.mockResolvedValue({ user: { id: 'user_neu' } } as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('registerFarmer — Bremse je IP, zweistufig', () => {
  it('Produktion: fragt nach der Instanz die Datenbank je IP und legt dann an', async () => {
    alsProduktion()
    const registerFarmer = await ladeAktion()
    expect(await registerFarmer(anmeldung())).toEqual({ ok: true })
    expect(ueberAlle).toHaveBeenCalledWith([{ bremse: DB_BREMSEN.registrierungIp, merkmal: '203.0.113.7' }])
    expect(signUpEmail).toHaveBeenCalledTimes(1)
  })

  it('Produktion: die Datenbank bremst — kein Konto, ein Satz ohne Fachwort', async () => {
    alsProduktion()
    ueberAlle.mockResolvedValueOnce(false)
    const registerFarmer = await ladeAktion()
    expect(await registerFarmer(anmeldung())).toEqual({ error: REGISTRIERUNG_ZU_VIELE })
    expect(signUpEmail).not.toHaveBeenCalled()
    expect(REGISTRIERUNG_ZU_VIELE).not.toMatch(/rate|limit|429/i)
  })

  it('Produktion: je Instanz höchstens 10 je Minute — danach fragt niemand mehr die Datenbank', async () => {
    alsProduktion()
    const registerFarmer = await ladeAktion()
    for (let i = 0; i < REGISTRIERUNG_JE_IP.max; i += 1) {
      expect(await registerFarmer(anmeldung({ email: `hof${i}@example.com` }))).toEqual({ ok: true })
    }
    expect(ueberAlle).toHaveBeenCalledTimes(REGISTRIERUNG_JE_IP.max)
    expect(await registerFarmer(anmeldung({ email: 'hof99@example.com' }))).toEqual({ error: REGISTRIERUNG_ZU_VIELE })
    expect(ueberAlle).toHaveBeenCalledTimes(REGISTRIERUNG_JE_IP.max)
    expect(signUpEmail).toHaveBeenCalledTimes(REGISTRIERUNG_JE_IP.max)
    // Gegenprobe: eine andere IP kommt durch.
    kontext.ip = '198.51.100.1'
    expect(await registerFarmer(anmeldung({ email: 'hof99@example.com' }))).toEqual({ ok: true })
  })

  it('Bot-Abwehr und ungültige Eingaben zählen nicht', async () => {
    alsProduktion()
    const registerFarmer = await ladeAktion()
    await registerFarmer(anmeldung({ website: 'https://spam.example' }))
    await registerFarmer(anmeldung({ email: 'keine-adresse' }))
    expect(ueberAlle).not.toHaveBeenCalled()
  })

  it('außerhalb der Produktion bremst nichts', async () => {
    const registerFarmer = await ladeAktion()
    for (let i = 0; i < REGISTRIERUNG_JE_IP.max + 2; i += 1) {
      expect(await registerFarmer(anmeldung({ email: `hof${i}@example.com` }))).toEqual({ ok: true })
    }
    expect(ueberAlle).not.toHaveBeenCalled()
  })
})

/**
 * „Das war ich nicht" ohne Anmeldung (Register E7, Ergänzung; Nr. 114) — die
 * öffentliche Action `meldeAllesAbNichtIch` an ihrer Grenze. Was sie in der
 * Datenbank tut, prüft tests/integration/geraete.int.test.ts.
 *
 * Beweist:
 *  - Ein Token in fremder Form erreicht die Datenbank nicht.
 *  - In Produktion bremst sie je IP nach NICHT_ICH_JE_MINUTE Versuchen
 *    (ARCHITECTURE §3 „Öffentliche Server Action"), ohne einzulösen.
 *  - Einlösen und Abmelden laufen über DENSELBEN Transaktions-Client: Scheitert
 *    das Löschen, wirft die Action und schickt keine Passwort-Mail (dass der
 *    Link dann gültig bleibt, beweist die Integrationsschicht).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(), requestPasswordReset: vi.fn() } } }))
const tx = vi.hoisted(() => ({ session: { deleteMany: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    session: { deleteMany: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(async (schritte: (t: typeof tx) => Promise<unknown>) => schritte(tx)),
  },
}))
vi.mock('@/server/geraete', () => ({ loeseEinmalLinkEin: vi.fn(async () => null) }))

import { auth } from '@/lib/auth'
import { EINMAL_LINK_ART, NICHT_ICH_JE_MINUTE } from '@/lib/geraete'
import { loeseEinmalLinkEin } from '@/server/geraete'
import { meldeAllesAbNichtIch } from '@/server/actions/geraete'

const TOKEN = 'A'.repeat(43)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('meldeAllesAbNichtIch', () => {
  it('ein Token in fremder Form erreicht die Datenbank nicht', async () => {
    for (const eingabe of [undefined, {}, { token: 'kurz' }, { token: `${TOKEN}=` }, { token: 42 }]) {
      expect(await meldeAllesAbNichtIch(eingabe)).toEqual({ error: 'ungueltig' })
    }
    expect(loeseEinmalLinkEin).not.toHaveBeenCalled()
  })

  it('in Produktion je IP höchstens NICHT_ICH_JE_MINUTE Versuche — danach „zu viele", ohne einzulösen', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    for (let i = 0; i < NICHT_ICH_JE_MINUTE; i++) {
      expect(await meldeAllesAbNichtIch({ token: TOKEN })).toEqual({ error: 'ungueltig' })
    }
    expect(await meldeAllesAbNichtIch({ token: TOKEN })).toEqual({ error: 'zu-viele' })
    expect(loeseEinmalLinkEin).toHaveBeenCalledTimes(NICHT_ICH_JE_MINUTE)
  })

  it('scheitert das Abmelden, wirft sie — eingelöst wurde im selben Transaktions-Client, keine Passwort-Mail', async () => {
    vi.mocked(loeseEinmalLinkEin).mockResolvedValueOnce({ userId: 'u1', zweck: 'nicht-ich:g1' })
    tx.session.deleteMany.mockRejectedValueOnce(new Error('Verbindung weg'))

    await expect(meldeAllesAbNichtIch({ token: TOKEN })).rejects.toThrow('Verbindung weg')

    expect(loeseEinmalLinkEin).toHaveBeenCalledWith(TOKEN, EINMAL_LINK_ART.nichtIch, expect.any(Date), tx)
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } })
    expect(auth.api.requestPasswordReset).not.toHaveBeenCalled()
  })
})

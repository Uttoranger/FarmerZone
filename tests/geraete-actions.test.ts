/**
 * „Das war ich nicht" ohne Anmeldung (Register E7, Ergänzung; Nr. 114) — die
 * öffentliche Action `meldeAllesAbNichtIch` an ihrer Grenze. Was sie in der
 * Datenbank tut, prüft tests/integration/geraete.int.test.ts.
 *
 * Beweist:
 *  - Ein Token in fremder Form erreicht die Datenbank nicht.
 *  - In Produktion bremst sie je IP nach NICHT_ICH_JE_MINUTE Versuchen
 *    (ARCHITECTURE §3 „Öffentliche Server Action"), ohne einzulösen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(), requestPasswordReset: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { session: { deleteMany: vi.fn() }, user: { findUnique: vi.fn() } } }))
vi.mock('@/server/geraete', () => ({ loeseEinmalLinkEin: vi.fn(async () => null) }))

import { NICHT_ICH_JE_MINUTE } from '@/lib/geraete'
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
})

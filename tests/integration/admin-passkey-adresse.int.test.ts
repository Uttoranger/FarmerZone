/**
 * Ohne lesbare App-Adresse (Register N20; Nr. 115): rpID und Herkunft der
 * Passkeys werden geschützt bestimmt — fehlt die Adresse, lädt src/lib/auth.ts
 * trotzdem (kein Wurf), alle /passkey/*-Wege und die Anmeldung mit Ersatzcode
 * antworten mit 503, die Anmeldung mit Passwort läuft weiter. Better Auth
 * echt gegen die Test-Datenbank; die App-Adresse ist hier leer gestellt.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
vi.mock('@/lib/umgebung-server', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/lib/umgebung-server')>()
  return { ...echt, UMGEBUNG: { ...echt.UMGEBUNG, appUrl: null } }
})

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { DB_BREMSEN, adressMerkmal, bremsSchluessel } from '@/lib/bremse-datenbank'
import { intKennung, raeumeAuf } from './setup/basis'

const HERKUNFT = 'http://localhost:3000'
const PASSWORT = 'test-passwort-1234'
const adressen: string[] = []

afterEach(async () => {
  await prisma.rateLimitZaehler.deleteMany({
    where: { schluessel: { in: adressen.map((a) => bremsSchluessel(env.BETTER_AUTH_SECRET, DB_BREMSEN.passwortFehler.zweck, adressMerkmal(a))) } },
  })
  adressen.length = 0
  await raeumeAuf()
})

async function http(pfad: string, body?: unknown): Promise<Response> {
  return auth.handler(
    new Request(`${HERKUNFT}/api/auth${pfad}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', origin: HERKUNFT },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  )
}

describe('ohne App-Adresse: Passkeys aus, alles andere an', () => {
  it('Passkey-Wege und Ersatzcode antworten mit 503 und einem Satz ohne Technik', async () => {
    for (const antwort of [
      await http('/passkey/generate-authenticate-options'),
      await http('/passkey/verify-authentication', { response: { id: 'int-unbekannt' } }),
      await http('/passkey/generate-register-options'),
      await http('/admin-ersatzcode/anmelden', { email: 'int-niemand@example.com', code: 'AAAA-AAAA' }),
    ]) {
      expect(antwort.status).toBe(503)
      expect(((await antwort.json()) as { code?: string }).code).toBe('PASSKEY_NICHT_VERFUEGBAR')
    }
  })

  it('die Anmeldung mit Passwort läuft weiter', async () => {
    const email = `${intKennung('kunde')}@example.com`
    adressen.push(email)
    await auth.api.signUpEmail({ body: { email, password: PASSWORT, name: 'Max Mustermann' } })

    const antwort = await http('/sign-in/email', { email, password: PASSWORT })

    expect(antwort.status).toBe(200)
  })
})

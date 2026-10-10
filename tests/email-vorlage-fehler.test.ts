/**
 * Die Versandfunktionen mit Ergebnis werfen nie — auch nicht, wenn schon das
 * Laden der Vorlage scheitert (Nachbesserung Nr. 31). Seit die Vorlagen per
 * `await import()` kommen, kann das erst im Aufruf passieren; vorher wäre das
 * ganze Modul beim Start gescheitert. auth.ts und „Bestellungen finden"
 * verlassen sich auf `{ error }` (ohne ID schreibt auth.ts den Code ins Log).
 *
 * Echtes src/lib/email.ts; gemockt sind nur das Resend-SDK und die zwei
 * Vorlagen, deren Laden hier scheitert.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))
vi.mock('@/emails/anmeldecode', () => {
  throw new Error('Vorlage kaputt')
})
vi.mock('@/emails/email-bestaetigung', () => {
  throw new Error('Vorlage kaputt')
})

let mail: typeof import('@/lib/email')

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mail = await import('@/lib/email')
}, 30_000)

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('Vorlage lässt sich nicht laden → { error } statt Wurf, kein Versand', () => {
  it('Anmeldecode', async () => {
    const ergebnis = await mail.sendAnmeldeCodeEmail('kundin@example.com', '123456')
    expect(ergebnis.id).toBeUndefined()
    expect(ergebnis.error).toBeTruthy()
  })

  it('Code für „Bestellungen finden"', async () => {
    const ergebnis = await mail.sendBestellCodeEmail('kundin@example.com', '123456')
    expect(ergebnis.id).toBeUndefined()
    expect(ergebnis.error).toBeTruthy()
  })

  it('E-Mail bestätigen', async () => {
    const ergebnis = await mail.sendEmailBestaetigung('hof@example.com', 'http://localhost:3000/verify?t=x')
    expect(ergebnis.id).toBeUndefined()
    expect(ergebnis.error).toBeTruthy()
  })

  it('Resend wurde dabei nie gefragt', () => {
    expect(sendMock).not.toHaveBeenCalled()
  })
})

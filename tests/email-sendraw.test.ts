/**
 * Tests für den E-Mail-Versand-Kontrakt (src/lib/email.ts, echtes Modul).
 *
 * Beweist am ECHTEN sendRaw: E-Mail-Fehler werden intern gefangen und als
 * { error } zurückgegeben — sie werfen nie. Darauf verlässt sich der
 * Webhook-Handler (E-Mail-Fehler dürfen keinen 500/Stripe-Retry auslösen).
 *
 * Nur das Resend-SDK ist gemockt — kein Netzwerk.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

async function importEmail() {
  // email.ts liest RESEND_API_KEY auf Modulebene → pro Test frisch importieren
  vi.resetModules()
  return import('@/lib/email')
}

beforeEach(() => {
  sendMock.mockReset()
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sendRaw wirft nie', () => {
  it('gibt { id } zurück, wenn Resend erfolgreich sendet', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
    const { sendRaw } = await importEmail()

    const result = await sendRaw('kunde@example.com', 'Test', '<p>Hallo</p>')

    expect(result).toEqual({ id: 'email_1' })
  })

  it('fängt eine Exception des Resend-SDK und gibt { error } zurück statt zu werfen', async () => {
    sendMock.mockRejectedValue(new Error('ECONNRESET'))
    const { sendRaw } = await importEmail()

    await expect(sendRaw('kunde@example.com', 'Test', '<p>Hallo</p>')).resolves.toEqual({
      error: 'ECONNRESET',
    })
  })

  it('gibt { error } zurück, wenn Resend einen API-Fehler liefert', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'domain not verified' } })
    const { sendRaw } = await importEmail()

    const result = await sendRaw('kunde@example.com', 'Test', '<p>Hallo</p>')

    expect(result.error).toContain('domain not verified')
    expect(result.id).toBeUndefined()
  })

  it('läuft ohne RESEND_API_KEY im Log-Modus (kein Throw, kein Versand)', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const { sendRaw } = await importEmail()

    const result = await sendRaw('kunde@example.com', 'Test', '<p>Hallo</p>')

    expect(result.error).toContain('RESEND_API_KEY')
    expect(sendMock).not.toHaveBeenCalled()
  })
})

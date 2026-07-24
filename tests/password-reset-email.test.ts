/**
 * Tests für die Passwort-Reset-Mail (src/lib/email.ts, echtes Modul).
 *
 * Beweist: sendPasswordResetEmail übergibt Empfänger, deutschen Betreff und
 * die Reset-URL an den Versand. Nur das Resend-SDK ist gemockt — kein Netzwerk.
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

describe('sendPasswordResetEmail', () => {
  it('übergibt Empfänger, deutschen Betreff und die Reset-URL an den Versand', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
    const { sendPasswordResetEmail } = await importEmail()

    const url = 'http://localhost:3000/reset-password?token=abc123'
    await sendPasswordResetEmail('bauer@hof-mueller.at', url)

    expect(sendMock).toHaveBeenCalledOnce()
    const call = sendMock.mock.calls[0][0]
    expect(call.to).toBe('bauer@hof-mueller.at')
    expect(call.subject).toBe('Passwort zurücksetzen · FarmerZone')
    expect(call.html).toContain(url)
  })

  it('nennt die Gültigkeit (1 Stunde) und den Ignorieren-Hinweis im Body', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_2' }, error: null })
    const { sendPasswordResetEmail } = await importEmail()

    await sendPasswordResetEmail('bauer@hof-mueller.at', 'http://localhost:3000/reset-password?token=t')

    const call = sendMock.mock.calls[0][0]
    expect(call.html).toContain('1 Stunde')
    expect(call.html).toContain('ignoriere diese E-Mail')
  })
})

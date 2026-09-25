/**
 * Tests für die Passwort-Reset-Mail (src/lib/email.ts, echtes Modul).
 *
 * Beweist: sendPasswordResetEmail übergibt Empfänger, deutschen Betreff und
 * die Reset-URL an den Versand. Nur das Resend-SDK ist gemockt — kein Netzwerk.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

// Der kalte Import von email.ts zieht React, @react-email/render und alle
// Vorlagen nach. Unter Last (parallele Suiten) dauert das länger als das
// 5-s-Testlimit — deshalb einmal pro Datei mit eigenem Timeout statt in jedem Test.
const IMPORT_TIMEOUT = 30_000

let email: typeof import('@/lib/email')

beforeAll(async () => {
  // email.ts liest RESEND_API_KEY auf Modulebene → vor dem Import setzen
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  email = await import('@/lib/email')
}, IMPORT_TIMEOUT)

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  sendMock.mockReset()
})

describe('sendPasswordResetEmail', () => {
  it('übergibt Empfänger, deutschen Betreff und die Reset-URL an den Versand', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
    const { sendPasswordResetEmail } = email

    const url = 'http://localhost:3000/reset-password?token=abc123'
    await sendPasswordResetEmail('bauer@example.com', url)

    expect(sendMock).toHaveBeenCalledOnce()
    const call = sendMock.mock.calls[0][0]
    expect(call.to).toBe('bauer@example.com')
    expect(call.subject).toBe('Passwort zurücksetzen · FarmerZone')
    expect(call.html).toContain(url)
  })

  it('nennt die Gültigkeit (1 Stunde) und den Ignorieren-Hinweis im Body', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_2' }, error: null })
    const { sendPasswordResetEmail } = email

    await sendPasswordResetEmail('bauer@example.com', 'http://localhost:3000/reset-password?token=t')

    const call = sendMock.mock.calls[0][0]
    expect(call.html).toContain('1 Stunde')
    expect(call.html).toContain('ignoriere diese E-Mail')
  })
})

/**
 * Die Mail „Admin-Sicherheit" (Register N20; Nr. 115) — src/emails/admin-
 * sicherheit.tsx über sendAdminSicherheitEmail in src/lib/email.ts, echtes
 * Modul; nur das Resend-SDK ist gemockt.
 *
 * Beweist:
 *  - Passkey hinzugefügt, Passkey entfernt, Ersatzcode benutzt: Betreff, Gerät
 *    und Uhrzeit in Wiener Zeit — und KEIN Link (keine Mail führt zum Anmelden).
 *  - Der E-Mail-Code der Einrichtung steht nur im Text, nie im Betreff.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MARKE } from '@/lib/marke'
import { ADMIN_SICHERHEIT_MAIL } from '@/lib/admin-anmeldung'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

let email: typeof import('@/lib/email')

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  email = await import('@/lib/email')
}, 30_000)

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
})

// 20.10.2026, 12:05 in Wien (UTC+2)
const ZEITPUNKT = new Date('2026-10-20T10:05:00.000Z')

describe('sendAdminSicherheitEmail', () => {
  for (const anlass of ['passkey-hinzugefuegt', 'passkey-entfernt', 'ersatzcode-benutzt'] as const) {
    it(`${anlass}: Betreff, Gerät, Uhrzeit in Wien — kein Link`, async () => {
      await email.sendAdminSicherheitEmail('admin@example.com', anlass, { geraet: 'Windows · Chrome', zeitpunkt: ZEITPUNKT })
      const aufruf = sendMock.mock.calls[0][0] as { to: string; subject: string; html: string }

      expect(aufruf.to).toBe('admin@example.com')
      expect(aufruf.subject).toBe(`${ADMIN_SICHERHEIT_MAIL.betreff[anlass]} · ${MARKE}`)
      expect(aufruf.html).toContain('Windows · Chrome')
      expect(aufruf.html).toContain('20.10. um 12:05')
      expect(aufruf.html).not.toMatch(/<a\s/i)
    })
  }

  it('Ersatzcode benutzt: sagt, dass ein neuer Passkey Pflicht ist', async () => {
    await email.sendAdminSicherheitEmail('admin@example.com', 'ersatzcode-benutzt', { geraet: 'iPhone · Safari', zeitpunkt: ZEITPUNKT })
    expect((sendMock.mock.calls[0][0] as { html: string }).html).toContain(ADMIN_SICHERHEIT_MAIL.ersatzcodeFolge)
  })

  it('E-Mail-Code der Einrichtung: der Code im Text, nie im Betreff; kein Link', async () => {
    await email.sendAdminSicherheitEmail('admin@example.com', 'einrichtungscode', { geraet: 'Windows · Chrome', zeitpunkt: ZEITPUNKT, code: 'QXJZKW' })
    const aufruf = sendMock.mock.calls[0][0] as { subject: string; html: string }

    expect(aufruf.html).toContain('QXJZKW')
    expect(aufruf.subject).not.toContain('QXJZKW')
    expect(aufruf.html).not.toMatch(/<a\s/i)
  })
})

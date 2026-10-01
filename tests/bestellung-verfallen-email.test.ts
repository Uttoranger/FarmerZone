/**
 * Die Mail „Deine Bestellung ist verfallen, weil sie nicht bestätigt wurde"
 * (src/lib/email.ts, echtes Modul, echte Vorlage). Sie geht raus, wenn eine
 * Vor-Ort-Bestellung ihre Bestätigungsfrist verpasst hat
 * (src/server/verwaiste-bestellungen.ts).
 *
 * Nur das Resend-SDK ist gemockt — kein Netzwerk.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

// Der kalte Import zieht React und alle Vorlagen nach — eigener Timeout
// (wie tests/password-reset-email.test.ts).
const IMPORT_TIMEOUT = 30_000

let email: typeof import('@/lib/email')

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  email = await import('@/lib/email')
}, IMPORT_TIMEOUT)

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('sendBestellungVerfallen', () => {
  it('sagt der Kundin, dass die Bestellung verfallen ist und nichts kostet', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })

    await email.sendBestellungVerfallen({
      customerName: 'Erika Mustermann',
      customerEmail: 'kundin@example.com',
      orderNumber: 'TST-0101-AAAA',
      farm: { name: 'Hof Test' },
    })

    expect(sendMock).toHaveBeenCalledOnce()
    const call = sendMock.mock.calls[0][0]
    expect(call.to).toBe('kundin@example.com')
    expect(call.subject).toBe('Deine Bestellung ist verfallen, weil sie nicht bestätigt wurde')
    expect(call.html).toContain('TST-0101-AAAA')
    expect(call.html).toContain('Hof Test')
    expect(call.html).toContain('keine Kosten')
  })
})

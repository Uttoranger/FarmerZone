/**
 * Die Mail „Zahlung kam zu spät, Geld ist zurück" (src/lib/email.ts, echtes
 * Modul, echte Vorlage). Sie geht raus, wenn der Webhook eine Zahlung auf eine
 * schon stornierte Bestellung voll erstattet hat.
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

describe('sendZahlungZuSpaet', () => {
  it('sagt der Kundin, dass die Zahlung zu spät kam und wie viel zurückgeht', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })

    await email.sendZahlungZuSpaet(
      {
        customerName: 'Erika Mustermann',
        customerEmail: 'kundin@example.com',
        orderNumber: 'TST-0101-AAAA',
        farm: { name: 'Hof Test' },
      },
      2137
    )

    expect(sendMock).toHaveBeenCalledOnce()
    const call = sendMock.mock.calls[0][0]
    expect(call.to).toBe('kundin@example.com')
    expect(call.subject).toBe('Deine Zahlung kam zu spät – das Geld ist zurück')
    expect(call.html).toContain('Zahlung kam zu spät')
    expect(call.html).toContain('TST-0101-AAAA')
    expect(call.html).toContain('Hof Test')
    // Cent → Euro an der Grenze, deutsch formatiert.
    expect(call.html).toContain('21,37')
    expect(call.html).toContain('bleibt storniert')
  })
})

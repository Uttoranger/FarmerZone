/**
 * Die Mail „Zu viele falsche Codes" bzw. „… Passwörter" (Register E7,
 * Ergänzung; Nr. 112) — src/emails/zu-viele-versuche.tsx über
 * sendZuVieleVersucheEmail in src/lib/email.ts, echtes Modul; nur das
 * Resend-SDK ist gemockt.
 *
 * Beweist:
 *  - Betreff und Text aus src/lib/anmeldecode.ts, die Pause mit Tag und
 *    Uhrzeit in Wiener Zeit.
 *  - Kein Link (auch kein Link zum Anmelden) und keine sechs Ziffern am Stück.
 *  - Ohne Schlüssel steht im Log nur die Zeile von sendRaw (Betreff,
 *    Empfänger wie bei jeder Mail) — kein Code, kein Link.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MARKE } from '@/lib/marke'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
// Das Mail-Protokoll (Nr. 158) bindet Prisma; hier geht es nur um die Mail selbst.
vi.mock('@/server/mail-warteschlange', () => ({ protokolliereSofortMail: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

let email: typeof import('@/lib/email')
let ohneSchluessel: typeof import('@/lib/email')

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  email = await import('@/lib/email')
  vi.resetModules()
  vi.stubEnv('RESEND_API_KEY', '')
  ohneSchluessel = await import('@/lib/email')
}, 30_000)

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
})

const BIS = new Date('2026-10-19T13:00:00.000Z')

async function versende(art: 'code' | 'passwort') {
  const ergebnis = await email.sendZuVieleVersucheEmail('kundin@example.com', art, BIS)
  return { ergebnis, aufruf: sendMock.mock.calls[0][0] as { to: string; subject: string; html: string } }
}

describe('sendZuVieleVersucheEmail', () => {
  it('Code: Betreff und Text, Pause mit Tag und Uhrzeit, ohne Link und ohne Code', async () => {
    const { aufruf, ergebnis } = await versende('code')
    expect(ergebnis.id).toBe('email_1')
    expect(aufruf.to).toBe('kundin@example.com')
    expect(aufruf.subject).toBe(`Zu viele falsche Codes · ${MARKE}`)
    expect(aufruf.html).toContain('Montag, 19. Oktober, 15:00 Uhr')
    expect(aufruf.html).toContain('keinen Code mehr an')
    expect(aufruf.html).not.toMatch(/<a\s|href=/)
    expect(aufruf.html.replace(/<[^>]+>/g, ' ')).not.toMatch(/\d{6}/)
  })

  it('Passwort: eigener Betreff, Ausweg „Passwort vergessen", ohne Link', async () => {
    const { aufruf } = await versende('passwort')
    expect(aufruf.subject).toBe(`Zu viele falsche Passwörter · ${MARKE}`)
    expect(aufruf.html).toContain('Passwort vergessen')
    expect(aufruf.html).not.toMatch(/<a\s|href=/)
  })

  it('ohne Schlüssel: kein Versand, im Log nur der Betreff — kein Code, kein Link', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const ergebnis = await ohneSchluessel.sendZuVieleVersucheEmail('kundin@example.com', 'code', BIS)
    const zeilen = log.mock.calls.map((c) => c.join(' ')).join('\n')
    log.mockRestore()

    expect(ergebnis.id).toBeUndefined()
    expect(sendMock).not.toHaveBeenCalled()
    expect(zeilen).toContain('Zu viele falsche Codes')
    expect(zeilen).not.toMatch(/\d{6}|https?:\/\//)
  })
})

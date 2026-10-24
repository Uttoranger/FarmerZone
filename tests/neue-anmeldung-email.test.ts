/**
 * Die Mail „Neue Anmeldung" (Register E7, Ergänzung; Nr. 114) —
 * src/emails/neue-anmeldung.tsx über sendNeueAnmeldungEmail in
 * src/lib/email.ts, echtes Modul; nur das Resend-SDK ist gemockt.
 *
 * Beweist:
 *  - Betreff je Konto (Hof bzw. ohne Hof), Anrede, Gerät, Uhrzeit in Wiener
 *    Zeit und der Knopf „Das war ich nicht" mit genau dem Link.
 *  - Kein Ort, keine IP-Adresse.
 *  - Ohne Schlüssel steht im Log nur die Zeile von sendRaw — nie der Link
 *    oder der Token.
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

// Erfundener Token in der Form, die wir erzeugen (43 Zeichen base64url).
const TOKEN = 'TestTokenNurFuerDenTest_abcdefghijklmnopqrs'
const LINK = `https://example.com/sicherheit/nicht-ich?t=${TOKEN}`
const DATEN = {
  hof: true,
  name: 'Testhof A',
  geraet: 'Windows · Chrome',
  // 19.10.2026, 14:32 in Wien (UTC+2)
  zeitpunkt: new Date('2026-10-19T12:32:00.000Z'),
  link: LINK,
}

describe('sendNeueAnmeldungEmail', () => {
  it('Hof-Konto: Betreff, Anrede, Gerät, Uhrzeit in Wien und der Knopf mit dem Link', async () => {
    const ergebnis = await email.sendNeueAnmeldungEmail('hof@example.com', DATEN)
    const aufruf = sendMock.mock.calls[0][0] as { to: string; subject: string; html: string }

    expect(ergebnis.id).toBe('email_1')
    expect(aufruf.to).toBe('hof@example.com')
    expect(aufruf.subject).toBe(`Neue Anmeldung bei deinem Hof-Konto · ${MARKE}`)
    expect(aufruf.html).toContain('Hallo Testhof A,')
    expect(aufruf.html).toContain('19.10. um 14:32')
    expect(aufruf.html).toContain('Windows · Chrome')
    expect(aufruf.html).toContain('ein Gerät, das wir bei dir noch nicht kannten')
    expect(aufruf.html).toMatch(new RegExp(`href="${LINK.replace(/[.?]/g, '\\$&')}"[^>]*>Das war ich nicht<`))
    expect(aufruf.html).toContain('Der Link gilt 7 Tage und einmal')
    // Kein Ort, keine IP-Adresse.
    expect(aufruf.html.replace(/<[^>]+>/g, ' ')).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b|IP-Adresse|Standort/)
  })

  it('Konto ohne Hof (Betrieb): eigener Betreff, Anrede ohne Namen', async () => {
    await email.sendNeueAnmeldungEmail('betrieb@example.com', { ...DATEN, hof: false, name: null })
    const aufruf = sendMock.mock.calls[0][0] as { subject: string; html: string }
    expect(aufruf.subject).toBe(`Neue Anmeldung bei deinem Konto · ${MARKE}`)
    expect(aufruf.html).toContain('Hallo,')
  })

  it('ohne Schlüssel: kein Versand, im Log nur der Betreff — kein Link, kein Token', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const ergebnis = await ohneSchluessel.sendNeueAnmeldungEmail('hof@example.com', DATEN)
    const zeilen = log.mock.calls.map((c) => c.join(' ')).join('\n')
    log.mockRestore()

    expect(ergebnis.id).toBeUndefined()
    expect(sendMock).not.toHaveBeenCalled()
    expect(zeilen).toContain('Neue Anmeldung bei deinem Hof-Konto')
    expect(zeilen).not.toContain(TOKEN)
    expect(zeilen).not.toMatch(/https?:\/\//)
  })
})

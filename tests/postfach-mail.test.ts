/**
 * Postfach per E-Mail (Register N12, Nr. 87): sendPostfachMail aus
 * src/lib/email.ts mit den Vorlagen postfach-rundschreiben.tsx und
 * postfach-antwort.tsx — echt gerendert, nur das Resend-SDK ist eine Attrappe.
 *
 * Beweist:
 *  - Rundschreiben: Betreff = Titel; Titel, Text, Link in die App (eigener
 *    Ursprung), Weg in den Faden, Absender aus MARKE_TEAM, „Antworten geht in
 *    der App".
 *  - Antwort des Teams: Betreff „Antwort vom …: <Titel>", der Text in der Mail.
 *  - Fremdtext bleibt Text: Markup im Text kommt maskiert an.
 *  - Die Post-Sperre (Z3) greift: außerhalb der Produktion geht nichts an eine
 *    Adresse, die nicht freigegeben ist (Gegenprobe mit @example.com).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

import { MARKE_TEAM } from '@/lib/marke'

type EmailModul = typeof import('@/lib/email')
let email: EmailModul

const FADEN = 'cuntaaaaaaaaaaaaaaaaaaaa1'

beforeAll(async () => {
  vi.resetModules()
  vi.stubEnv('VERCEL_ENV', 'preview')
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  vi.stubEnv('TEST_EMPFAENGER', '')
  email = await import('@/lib/email')
}, 30_000)

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

function gesendet(): { to: string; subject: string; html: string } {
  expect(sendMock).toHaveBeenCalledTimes(1)
  return sendMock.mock.calls[0][0] as { to: string; subject: string; html: string }
}

describe('sendPostfachMail', () => {
  it('Rundschreiben: Titel als Betreff, Text, Link in die App, Weg in den Faden, Absender aus MARKE_TEAM', async () => {
    const ergebnis = await email.sendPostfachMail({
      art: 'rundschreiben',
      an: 'hof@example.com',
      titel: 'Bitte die Abholzeiten prüfen',
      text: 'Erfundener Text <b>fett</b> für den Test.',
      link: '/products?bereich=futter',
      unterhaltungId: FADEN,
    })
    expect(ergebnis).toEqual({ id: 'email_1' })
    const mail = gesendet()
    expect(mail.to).toBe('hof@example.com')
    expect(mail.subject).toBe('Bitte die Abholzeiten prüfen')
    expect(mail.html).toContain('Bitte die Abholzeiten prüfen')
    expect(mail.html).toContain('Erfundener Text &lt;b&gt;fett&lt;/b&gt; für den Test.')
    expect(mail.html).not.toContain('<b>fett</b>')
    expect(mail.html).toMatch(/href="https?:\/\/[^"]+\/products\?bereich=futter"/)
    expect(mail.html).toMatch(new RegExp(`href="https?://[^"]+/postfach/${FADEN}"`))
    expect(mail.html).toContain(MARKE_TEAM)
    expect(mail.html).toContain('Antworten geht in der App')
  })

  it('Antwort des Teams: eigener Betreff, der Text steht in der Mail; ohne Link kein Link-Knopf', async () => {
    await email.sendPostfachMail({ art: 'antwort', an: 'hof@example.com', titel: 'Neue Abholzeiten', text: 'Passt, danke dir!', link: null, unterhaltungId: FADEN })
    const mail = gesendet()
    expect(mail.subject).toBe(`Antwort vom ${MARKE_TEAM}: Neue Abholzeiten`)
    expect(mail.html).toContain('Passt, danke dir!')
    expect(mail.html).not.toContain('>Ansehen<')
  })

  it('die Post-Sperre greift: außerhalb der Produktion nichts an eine nicht freigegebene Adresse', async () => {
    const ergebnis = await email.sendPostfachMail({ art: 'antwort', an: 'hof@example.org', titel: 'Erfunden', text: 'Erfunden.', link: null, unterhaltungId: FADEN })
    expect(ergebnis).toEqual({ gesperrt: true })
    expect(sendMock).not.toHaveBeenCalled()
  })
})

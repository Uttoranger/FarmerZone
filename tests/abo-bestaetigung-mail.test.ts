/**
 * Mails des Double-Opt-in (Register S11, Nachtlauf Nr. 38), gerendert über
 * das echte src/lib/email.ts (nur das Resend-SDK gemockt), erfundene Daten:
 *  - Die Bestätigungsmail nennt den Hof, führt mit dem Knopf auf die Seite mit
 *    dem Knopf, nennt die Gültigkeit und den Satz „ignorier diese Mail" — und
 *    enthält keine Werbung und keinen Abmeldelink (sie ist keine Werbemail).
 *  - Jede werbliche Mail (Beitrag per Mail) trägt den Abmeldelink, im Text und
 *    unten unter „Benachrichtigungen verwalten".
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

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

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
})

function gesendet(): { to: string; subject: string; html: string } {
  expect(sendMock).toHaveBeenCalledOnce()
  return sendMock.mock.calls[0]![0] as { to: string; subject: string; html: string }
}

const LINK = 'https://farmerzone.example/account/neuigkeiten-bestaetigen?token=abc.def'
const ABMELDEN = 'https://farmerzone.example/account/unsubscribe?token=xyz.123'

describe('Bestätigungsmail', () => {
  it('nennt den Hof, führt auf die Seite mit dem Knopf und nennt 7 Tage', async () => {
    expect(await email.sendAboBestaetigung('erika@example.org', { hofName: 'Hof Test', url: LINK })).toEqual({ id: 'email_1' })

    const mail = gesendet()
    expect(mail.to).toBe('erika@example.org')
    expect(mail.html).toContain('Hof Test')
    expect(mail.html).toContain(`href="${LINK.replace(/&/g, '&amp;')}"`)
    expect(mail.html).toContain('Anmeldung bestätigen')
    expect(mail.html).toMatch(/7(<!-- -->)?\s*Tage/)
    expect(mail.html).toContain('Wenn du dich nicht angemeldet hast, ignorier diese Mail.')
  })

  it('ist keine Werbemail: kein Abmeldelink, kein „Benachrichtigungen verwalten", Betreff ohne Hofname', async () => {
    await email.sendAboBestaetigung('erika@example.org', { hofName: 'Hof Test', url: LINK })

    const mail = gesendet()
    expect(mail.html).not.toContain('unsubscribe')
    expect(mail.html).not.toContain('Benachrichtigungen verwalten')
    expect(mail.subject).toBe('Bitte bestätige deine Anmeldung · FarmerZone')
  })

  it('Gegenprobe: ein Hofname mit HTML wird nicht als HTML eingesetzt', async () => {
    await email.sendAboBestaetigung('erika@example.org', { hofName: '<b>Hof</b>', url: LINK })
    expect(gesendet().html).not.toContain('<b>Hof</b>')
  })
})

describe('Werbliche Mail (Beitrag per Mail)', () => {
  it('trägt den Abmeldelink — im Text und unten unter „Benachrichtigungen verwalten"', async () => {
    await email.sendStatusUpdateEmail({
      to: 'erika@example.org',
      farmName: 'Hof Test',
      farmSlug: 'hof-test',
      title: 'Frische Eier',
      body: 'Heute frisch gelegt.',
      anlass: 'FRESH_PRODUCT',
      unsubscribeUrl: ABMELDEN,
    })

    const html = gesendet().html
    expect(html.split(`href="${ABMELDEN}"`).length - 1).toBe(2)
    expect(html).toContain('Abmelden')
    expect(html).toContain('Benachrichtigungen verwalten')
  })
})

/**
 * Mails des Double-Opt-in (Register S11, Nachtlauf Nr. 38), gerendert über
 * das echte src/lib/email.ts (nur das Resend-SDK gemockt), erfundene Daten:
 *  - Die Bestätigungsmail nennt den Hof, führt mit dem Knopf auf die Seite mit
 *    dem Knopf, nennt die Gültigkeit und den Satz „ignorier diese Mail" — und
 *    enthält keine Werbung und keinen Abmeldelink (sie ist keine Werbemail).
 *  - Jede werbliche Mail (Beitrag per Mail) trägt den Abmeldelink, im Text und
 *    unten unter „Benachrichtigungen verwalten".
 *  - Seit Nr. 47 trägt sie dazu die Kopfzeilen List-Unsubscribe und
 *    List-Unsubscribe-Post (Ein-Klick, RFC 8058) — und NUR sie: keine
 *    Transaktionsmail (Bestätigung, Anmeldecode, Bestellung) bekommt sie.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { MARKE } from '@/lib/marke'
import { BEITRAG_ANLAESSE, BEITRAG_ANLASS } from '@/lib/beitrag-anlass'

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
let appUrl: string

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  // Inhalt der Mails wie im Produktions-Deployment: Nur dort ist die Post frei
  // (Register Z3). Ohne VERCEL_ENV kämen die Testadressen unter example.org nicht an.
  vi.stubEnv('VERCEL_ENV', 'production')
  email = await import('@/lib/email')
  appUrl = (await import('@/lib/umgebung-server')).APP_URL
}, 30_000)

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
})

function gesendet(): { to: string; subject: string; html: string; headers?: Record<string, string> } {
  expect(sendMock).toHaveBeenCalledOnce()
  return sendMock.mock.calls[0]![0] as { to: string; subject: string; html: string; headers?: Record<string, string> }
}

/** Eine gebaute Mail der Warteschlange in der Form, die Resend bekäme. */
function alsMail(m: import('@/lib/email').StapelMail): { to: string; subject: string; html: string; headers?: Record<string, string> } {
  return { to: m.an, subject: m.betreff, html: m.html, headers: m.headers }
}

const LINK = 'https://plattform.example/account/neuigkeiten-bestaetigen?token=abc.def'
const ABMELDE_TOKEN = 'xyz.123'

describe('Bestätigungsmail', () => {
  it('nennt den Hof, führt auf die Seite mit dem Knopf und nennt 7 Tage', async () => {
    const mail = alsMail(await email.baueAboBestaetigung('erika@example.org', { hofName: 'Hof Test', url: LINK }))
    expect(mail.to).toBe('erika@example.org')
    expect(mail.html).toContain('Hof Test')
    expect(mail.html).toContain(`href="${LINK.replace(/&/g, '&amp;')}"`)
    expect(mail.html).toContain('Anmeldung bestätigen')
    expect(mail.html).toMatch(/7(<!-- -->)?\s*Tage/)
    expect(mail.html).toContain('Wenn du dich nicht angemeldet hast, ignorier diese Mail.')
  })

  it('ist keine Werbemail: kein Abmeldelink, kein „Benachrichtigungen verwalten", Betreff ohne Hofname', async () => {
    const mail = alsMail(await email.baueAboBestaetigung('erika@example.org', { hofName: 'Hof Test', url: LINK }))
    expect(mail.html).not.toContain('unsubscribe')
    expect(mail.html).not.toContain('Benachrichtigungen verwalten')
    expect(mail.subject).toBe(`Bitte bestätige deine Anmeldung · ${MARKE}`)
  })

  it('Gegenprobe: ein Hofname mit HTML wird nicht als HTML eingesetzt', async () => {
    const mail = await email.baueAboBestaetigung('erika@example.org', { hofName: '<b>Hof</b>', url: LINK })
    expect(mail.html).not.toContain('<b>Hof</b>')
  })
})

const BEITRAG = {
  to: 'erika@example.org',
  farmName: 'Hof Test',
  farmSlug: 'hof-test',
  title: 'Frische Eier',
  body: 'Heute frisch gelegt.',
  anlass: 'FRESH_PRODUCT',
  abmeldeToken: ABMELDE_TOKEN,
}

describe('Werbliche Mail (Beitrag per Mail)', () => {
  it('trägt den Abmeldelink — im Text und unten unter „Benachrichtigungen verwalten"', async () => {
    const html = (await email.baueBeitragMail(BEITRAG)).html
    const seite = `${appUrl}/account/unsubscribe?token=${ABMELDE_TOKEN}`
    expect(html.split(`href="${seite}"`).length - 1).toBe(2)
    expect(html).toContain('Abmelden')
    expect(html).toContain('Benachrichtigungen verwalten')
  })

  it('trägt List-Unsubscribe mit der Ein-Klick-Adresse und List-Unsubscribe-Post (RFC 8058)', async () => {
    expect((await email.baueBeitragMail(BEITRAG)).headers).toEqual({
      'List-Unsubscribe': `<${appUrl}/api/abmelden?token=${ABMELDE_TOKEN}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
  })
})

describe('Werbliche Mail: der Knopf führt zum Beitrag (Register T5, Ergänzung Nr. 128)', () => {
  it('mit Kennung zur Übersicht mit genau diesem Beitrag oben (?beitrag=<id>)', async () => {
    expect((await email.baueBeitragMail({ ...BEITRAG, beitragId: 'cbeitragaaaa' })).html).toContain(`href="${appUrl}/hof-test?beitrag=cbeitragaaaa"`)
  })

  it('Gegenprobe: ohne Kennung (Beitrag nicht auf der Hofseite) zur Hofseite selbst', async () => {
    const html = (await email.baueBeitragMail(BEITRAG)).html
    expect(html).toContain(`href="${appUrl}/hof-test"`)
    expect(html).not.toContain('beitrag=')
  })
})

describe('Werbliche Mail: das Anlass-Wort kommt aus BEITRAG_ANLASS (Nr. 134)', () => {
  it('jeder Anlass steht mit seinem Wort in der Mail', async () => {
    for (const anlass of BEITRAG_ANLAESSE) {
      expect((await email.baueBeitragMail({ ...BEITRAG, anlass })).html, anlass).toContain(BEITRAG_ANLASS[anlass].wort)
    }
  })

  it('Gegenprobe: ein unbekannter Anlass gilt als Mitteilung', async () => {
    expect((await email.baueBeitragMail({ ...BEITRAG, anlass: 'UNBEKANNT' })).html).toContain(BEITRAG_ANLASS.ANNOUNCEMENT.wort)
  })
})

describe('Transaktionsmails tragen keine Abmelde-Kopfzeilen', () => {
  it('Bestätigung der Anmeldung, Anmeldecode und Code für „Bestellungen finden"', async () => {
    // Die Bestätigung baut der Renderer der Warteschlange (Nr. 159): gebaut ohne Kopfzeilen.
    expect((await email.baueAboBestaetigung('erika@example.org', { hofName: 'Hof Test', url: LINK })).headers).toBeUndefined()
    const versand = [
      () => email.sendAnmeldeCodeEmail('erika@example.org', '123456'),
      () => email.sendBestellCodeEmail('erika@example.org', '654321'),
    ]
    for (const senden of versand) {
      sendMock.mockClear()
      await senden()
      const mail = gesendet()
      expect(mail.headers).toBeUndefined()
      expect(JSON.stringify(mail)).not.toContain('List-Unsubscribe')
    }
  })

  it('Wache: die Kopfzeilen setzt in email.ts nur die werbliche Versandfunktion', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const quelle = readFileSync(join(process.cwd(), 'src/lib/email.ts'), 'utf8')
    const stellen = [...quelle.matchAll(/listUnsubscribeKoepfe\(/g)].map((t) => quelle.lastIndexOf('export async function', t.index))
    expect(stellen).toHaveLength(1)
    // Gebaut wird die werbliche Mail in baueBeitragMail (Nr. 158) — seit Nr. 159 nur noch für den Renderer „beitrag“.
    expect(quelle.slice(stellen[0], stellen[0] + 60)).toContain('export async function baueBeitragMail(')
  })
})

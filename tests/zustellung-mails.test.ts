/**
 * Die Betreiber-Mails der Zustellung (Register N14, Nr. 95) über das echte
 * src/lib/email.ts — nur das Resend-SDK gemockt, Inhalt wie im
 * Produktions-Deployment (VERCEL_ENV=production, Post-Sperre Z3 offen).
 *
 * Beweist: Jede Betreiber-Mail wird für eine Adresse gebaut (je Adresse ein
 * Auftrag, Nr. 159) und verschickt nicht selbst. Die Bestätigungsmail trägt den Link
 * auf die Bestätigungsseite und keinen Hofnamen; die Antwort-Mail zeigt den
 * Fremdtext nur escaped und führt in den Eingang.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
// Das Mail-Protokoll (Nr. 158) bindet Prisma; hier geht es nur um die Mail selbst.
vi.mock('@/server/mail-warteschlange', () => ({ protokolliereSofortMail: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

import { SUPPORT_EMAIL } from '@/lib/support'
import { ZUSTELLUNG_MAIL_TEXT } from '@/lib/zustellung'
import { EINGANG_TEXT, offenSatz } from '@/lib/postfach'

let email: typeof import('@/lib/email')

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  vi.stubEnv('VERCEL_ENV', 'production')
  email = await import('@/lib/email')
}, 30_000)

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
})

const NUR_AUFGABE = { antworten: 0, meldungen: 0, hoefe: 1, erstattungen: 0 }

const ERSTATTUNG = {
  was: 'Erfundener Fall für den Test.',
  bestellId: 'bestellung-1',
  bestellnummer: 'HT-1510-TEST',
  hofName: 'Hof Beispiel',
  betraege: [{ label: 'An die Kundin erstatten', cents: 2340 }],
  handanweisung: 'Überweisung zurückbuchen und Plattformgebühr erstatten',
  stripeKennung: null,
}

const MELDUNG = {
  id: 'meldung-1',
  kurznummer: 'meldung1',
  text: 'Erfunden.',
  seiteUrl: '/dashboard',
  userAgent: 'Test',
  viewport: '390x844',
  diagKennung: null,
  farmName: 'Hof Beispiel',
  screenshotUrl: null,
  createdAt: new Date('2026-10-15T08:00:00Z'),
}

/*
 * Seit Nr. 159 baut email.ts jede Betreiber-Mail für EINE Adresse; je Adresse
 * der Liste stellt der Aufrufer einen Auftrag ein (betreiberAuftraege,
 * tests/mail-auftraege.test.ts), der Worker verschickt.
 */
describe('Betreiber-Mails an eine Adresse der Liste', () => {
  it('„Erstattung offen": an die Adresse, Betreff mit der Bestellnummer', async () => {
    const mail = await email.baueErstattungOffen(ERSTATTUNG, SUPPORT_EMAIL)
    expect(mail.an).toBe(SUPPORT_EMAIL)
    expect(mail.betreff).toBe('Erstattung offen – Bestellung HT-1510-TEST')
    expect(mail.html).toContain('An die Kundin erstatten')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('neuer Hof: Hofname und Zeitpunkt der Anmeldung, nicht des Versands', async () => {
    const mail = await email.baueNewFarmNotification(
      { id: 'hof-1', name: 'Hof Beispiel', slug: 'hof-beispiel', ownerEmail: 'hof@example.com', createdAt: new Date('2026-10-15T08:00:00Z') },
      'team@example.com'
    )
    expect(mail.betreff).toBe('Neuer Hof wartet auf Freischaltung: Hof Beispiel')
    expect(mail.html).toContain('15.10.2026')
  })

  it('die Fehlermeldung führt in den Eingang (Filter Meldung), nicht mehr auf /admin/meldungen', async () => {
    const { html } = await email.baueMeldungNotification(MELDUNG, 'team@example.com')
    expect(html).toContain('/admin/postfach?art=meldung&amp;meldung=meldung-1')
    expect(html).not.toContain('/admin/meldungen/')
  })

  it('der Wochenbericht nennt in einer Zeile, was im Eingang offen ist, und führt zu „Offen"', async () => {
    const { betreff, html } = await email.baueBriefkastenZusammenfassung(
      { neu: 0, liegenGeblieben: 0, offen: 0, neueste: [], geloescht: 0, eingang: NUR_AUFGABE },
      'team@example.com'
    )
    expect(betreff).toBe(ZUSTELLUNG_MAIL_TEXT.wochenberichtBetreff(offenSatz(NUR_AUFGABE)))
    expect(html).toContain(`${EINGANG_TEXT.offenTitel}: ${offenSatz(NUR_AUFGABE)}`)
    expect(offenSatz(NUR_AUFGABE)).toBe('0 Antworten · 0 Meldungen · 1 Aufgabe')
    // Der Meldungsteil bleibt.
    expect(html).toContain('0 neue Meldungen')
    expect(html).toContain('/admin/postfach"')
  })

  it('die Testmail führt in den Eingang', async () => {
    const mail = await email.baueBetreiberTestmail('team@example.com')
    expect(mail.betreff).toBe(ZUSTELLUNG_MAIL_TEXT.testBetreff)
    expect(mail.html).toContain('/admin/postfach')
  })
})

describe('Bestätigungsmail (Double-Opt-in)', () => {
  it('trägt den Link auf die Bestätigungsseite, ohne Hofnamen und ohne Meldungstext', async () => {
    const token = 'A'.repeat(43)
    const ergebnis = await email.sendBetreiberBestaetigung('neu@example.com', token)
    expect(ergebnis.id).toBe('email_1')
    const mail = sendMock.mock.calls[0]?.[0] as { to: string; subject: string; html: string }
    expect(mail.to).toBe('neu@example.com')
    expect(mail.subject).toBe(ZUSTELLUNG_MAIL_TEXT.bestaetigungBetreff)
    expect(mail.html).toContain(`/admin/postfach/zustellung/bestaetigen?token=${token}`)
    expect(mail.html).toContain('48 Stunden')
    expect(mail.html).not.toContain('Hof Beispiel')
  })
})

describe('Antwort eines Hofs an das Team', () => {
  it('zeigt Hof, Titel und den Text escaped und führt in den Faden im Eingang', async () => {
    const mail = await email.baueHofAntwortAnTeam('team@example.com', {
      hofName: 'Hof Beispiel',
      titel: 'Abrechnung',
      text: 'Erfunden <b>fett</b>',
      unterhaltungId: 'ckfaden000000000000000000',
    })
    expect(mail.betreff).toBe('Antwort von Hof Beispiel: Abrechnung')
    expect(mail.html).toContain('Erfunden &lt;b&gt;fett&lt;/b&gt;')
    expect(mail.html).toContain('/admin/postfach?art=antwort&amp;id=antwort-ckfaden000000000000000000')
  })
})

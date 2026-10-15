/**
 * Die Betreiber-Mails der Zustellung (Register N14, Nr. 95) über das echte
 * src/lib/email.ts — nur das Resend-SDK gemockt, Inhalt wie im
 * Produktions-Deployment (VERCEL_ENV=production, Post-Sperre Z3 offen).
 *
 * Beweist: Jede Betreiber-Mail geht an jede Adresse der Liste, die der
 * Aufrufer aus empfaengerFuer hereinreicht — eine leere Liste (Regel aus)
 * heißt: keine Mail, auch kein Rendern. Die Bestätigungsmail trägt den Link
 * auf die Bestätigungsseite und keinen Hofnamen; die Antwort-Mail zeigt den
 * Fremdtext nur escaped und führt in den Eingang.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

import { SUPPORT_EMAIL } from '@/lib/support'
import { ZUSTELLUNG_MAIL_TEXT } from '@/lib/zustellung'

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

const LISTE = [SUPPORT_EMAIL, 'team@example.com']

function empfaenger(): string[] {
  return sendMock.mock.calls.map(([m]) => (m as { to: string }).to)
}

const ERSTATTUNG = {
  was: 'Erfundener Fall für den Test.',
  bestellId: 'bestellung-1',
  bestellnummer: 'HT-1510-TEST',
  hofName: 'Hof Beispiel',
  betraege: [{ label: 'An die Kundin erstatten', cents: 2340 }],
  handanweisung: 'Überweisung zurückbuchen und Plattformgebühr erstatten',
  stripeKennung: null,
}

describe('Betreiber-Mails an die Liste', () => {
  it('„Erstattung offen" geht an jede Adresse der Liste, nacheinander', async () => {
    await email.sendErstattungOffen(ERSTATTUNG, LISTE)
    expect(empfaenger()).toEqual(LISTE)
    expect((sendMock.mock.calls[0]?.[0] as { subject: string }).subject).toBe('Erstattung offen – Bestellung HT-1510-TEST')
  })

  it('leere Liste (Regel aus): keine Mail', async () => {
    await email.sendNewFarmNotification({ id: 'hof-1', name: 'Hof Beispiel', slug: 'hof-beispiel', ownerEmail: 'hof@example.com' }, [])
    await email.sendMeldungNotification(
      {
        id: 'meldung-1',
        kurznummer: 'meldung1',
        text: 'Erfunden.',
        seiteUrl: '/dashboard',
        userAgent: 'Test',
        viewport: '390x844',
        diagKennung: null,
        farmName: null,
        screenshotUrl: null,
        createdAt: new Date('2026-10-15T08:00:00Z'),
      },
      []
    )
    await email.sendBriefkastenZusammenfassung({ neu: 1, liegenGeblieben: 0, offen: 1, neueste: [], geloescht: 0 }, [])
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('die Fehlermeldung führt in den Eingang (Filter Meldung), nicht mehr auf /admin/meldungen', async () => {
    await email.sendMeldungNotification(
      {
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
      },
      ['team@example.com']
    )
    const html = (sendMock.mock.calls[0]?.[0] as { html: string }).html
    expect(html).toContain('/admin/postfach?art=meldung&amp;meldung=meldung-1')
    expect(html).not.toContain('/admin/meldungen/')
  })

  it('ein Fehler bei einer Adresse hält die übrigen nicht auf', async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { message: 'kaputt' } })
    const ergebnis = await email.sendBetreiberTestmail(LISTE)
    expect(empfaenger()).toEqual(LISTE)
    expect(ergebnis).toEqual({ gesendet: 1, gescheitert: 1 })
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
    const ergebnis = await email.sendHofAntwortAnTeam(['team@example.com'], {
      hofName: 'Hof Beispiel',
      titel: 'Abrechnung',
      text: 'Erfunden <b>fett</b>',
      unterhaltungId: 'ckfaden000000000000000000',
    })
    expect(ergebnis).toEqual({ gesendet: 1, gescheitert: 0 })
    const mail = sendMock.mock.calls[0]?.[0] as { subject: string; html: string }
    expect(mail.subject).toBe('Antwort von Hof Beispiel: Abrechnung')
    expect(mail.html).toContain('Erfunden &lt;b&gt;fett&lt;/b&gt;')
    expect(mail.html).toContain('/admin/postfach?art=antwort&amp;id=antwort-ckfaden000000000000000000')
  })

  it('ohne Empfänger (Regel „nur Zähler") keine Mail', async () => {
    expect(await email.sendHofAntwortAnTeam([], { hofName: 'Hof', titel: 'T', text: 'x', unterhaltungId: 'u' })).toEqual({ gesendet: 0, gescheitert: 0 })
    expect(sendMock).not.toHaveBeenCalled()
  })
})

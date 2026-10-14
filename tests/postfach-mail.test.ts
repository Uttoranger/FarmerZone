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
 *  - Der Fuß beider Mails nennt das Team (POSTFACH_MAIL_TEXT.fuss), nie „im
 *    Auftrag eines Hofes" — Gegenprobe: ohne `fusszeile` schreibt das Layout
 *    weiter den Satz der Mails im Namen eines Hofs.
 *  - Fremdtext bleibt Text: Markup im Text kommt maskiert an.
 *  - Die Post-Sperre (Z3) greift: außerhalb der Produktion geht nichts an eine
 *    Adresse, die nicht freigegeben ist (Gegenprobe mit @example.com).
 *  - Antwort des Teams (antworteAlsTeam): Die Stunde zu belegen
 *    (Unterhaltung.letzteMailAm) ist Nachlauf — scheitert es, bleibt die
 *    gespeicherte Antwort ein Erfolg ohne Mail, gemeldet nur mit Fehlerklasse;
 *    Gegenprobe: belegt es die Stunde, geht die Mail in den Nachlauf.
 *    Datenbank, Sitzung und Admin-Prüfung sind dafür Attrappen; die echte
 *    Drossel prüft tests/integration/postfach.int.test.ts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { sendMock, captureException, db, nachDerAntwort } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  captureException: vi.fn(),
  db: { transaction: vi.fn(), updateMany: vi.fn() },
  nachDerAntwort: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException }))
// Nur für antworteAlsTeam: die Grenzen der Action als Attrappen.
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: db.transaction, unterhaltung: { updateMany: db.updateMany } } }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort }))
vi.mock('@/server/admin-wache', () => ({ verlangeAdminAktion: vi.fn(async () => ({ ok: true, userId: 'cadminaaaaaaaaaaaaaaaaaa1' })) }))
vi.mock('@/server/bremse-datenbank', () => ({ bremseUeberAlleInstanzen: vi.fn() }))
vi.mock('@/server/queries/postfach', () => ({ ladeEmpfaengerHoefe: vi.fn(), ladeMailEmpfaenger: vi.fn() }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

import { createElement, type ComponentType, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MARKE, MARKE_TEAM } from '@/lib/marke'
import { POSTFACH_MAIL_TEXT } from '@/lib/postfach'
import { EmailLayout } from '@/emails/_layout'

/** Der Fuß der Mails, die ein Hof verschickt (Bestellungen) — bei Mails des Teams falsch. */
const HOF_FUSS = 'im Auftrag eines Hofes'

type EmailModul = typeof import('@/lib/email')
let email: EmailModul
let aktionen: typeof import('@/server/actions/postfach')

const FADEN = 'cuntaaaaaaaaaaaaaaaaaaaa1'

beforeAll(async () => {
  vi.resetModules()
  vi.stubEnv('VERCEL_ENV', 'preview')
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  vi.stubEnv('TEST_EMPFAENGER', '')
  email = await import('@/lib/email')
  aktionen = await import('@/server/actions/postfach')
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
    expect(mail.html).toContain(POSTFACH_MAIL_TEXT.fuss)
    expect(mail.html).not.toContain(HOF_FUSS)
  })

  it('Antwort des Teams: eigener Betreff, der Text steht in der Mail; ohne Link kein Link-Knopf', async () => {
    await email.sendPostfachMail({ art: 'antwort', an: 'hof@example.com', titel: 'Neue Abholzeiten', text: 'Passt, danke dir!', link: null, unterhaltungId: FADEN })
    const mail = gesendet()
    expect(mail.subject).toBe(`Antwort vom ${MARKE_TEAM}: Neue Abholzeiten`)
    expect(mail.html).toContain('Passt, danke dir!')
    expect(mail.html).not.toContain('>Ansehen<')
    expect(mail.html).toContain(POSTFACH_MAIL_TEXT.fuss)
    expect(mail.html).not.toContain(HOF_FUSS)
  })

  it('Gegenprobe: ohne eigenen Fuß schreibt das Layout weiter den Satz der Mails im Namen eines Hofs', () => {
    // Der Inhalt als weiteres Argument von createElement — ohne dass TypeScript `children` in den Props verlangt.
    const layout = EmailLayout as ComponentType<{ previewText: string; children?: ReactNode }>
    const html = renderToStaticMarkup(createElement(layout, { previewText: 'Erfunden' }, 'Erfundener Inhalt.'))
    expect(html).toContain(`Versandt von ${MARKE} ${HOF_FUSS}.`)
    expect(html).not.toContain(POSTFACH_MAIL_TEXT.fuss)
  })

  it('die Post-Sperre greift: außerhalb der Produktion nichts an eine nicht freigegebene Adresse', async () => {
    const ergebnis = await email.sendPostfachMail({ art: 'antwort', an: 'hof@example.org', titel: 'Erfunden', text: 'Erfunden.', link: null, unterhaltungId: FADEN })
    expect(ergebnis).toEqual({ gesperrt: true })
    expect(sendMock).not.toHaveBeenCalled()
  })
})

describe('antworteAlsTeam — die Stunde zu belegen ist Nachlauf', () => {
  const eingabe = { unterhaltungId: FADEN, text: 'Erfundene Antwort vom Team.', wichtig: false, link: null, perMail: true }

  beforeEach(() => {
    captureException.mockReset()
    nachDerAntwort.mockReset()
    db.updateMany.mockReset()
    // Die Transaktion findet den Faden und speichert die Antwort.
    const tx = {
      unterhaltung: { updateMany: async () => ({ count: 1 }) },
      nachricht: { create: async () => ({}) },
      unterhaltungStand: { createMany: async () => ({ count: 1 }), updateMany: async () => ({ count: 0 }) },
    }
    db.transaction.mockReset()
    db.transaction.mockImplementation(async (arbeit: (t: typeof tx) => Promise<unknown>) => arbeit(tx))
  })

  it('scheitert das Belegen, bleibt die gespeicherte Antwort ein Erfolg — ohne Mail, gemeldet nur mit der Fehlerklasse', async () => {
    class DatenbankWeg extends Error {
      name = 'DatenbankWeg'
    }
    db.updateMany.mockRejectedValue(new DatenbankWeg(`Verbindung verloren: ${eingabe.text}`))

    const ergebnis = await aktionen.antworteAlsTeam(eingabe)

    expect(ergebnis).toEqual({ ok: true, mail: 'aus' })
    expect(nachDerAntwort).not.toHaveBeenCalled()
    expect(captureException).toHaveBeenCalledTimes(1)
    const [fehler, kontext] = captureException.mock.calls[0] as [Error, unknown]
    expect(fehler.name).toBe('DatenbankWeg')
    expect(fehler.message).not.toContain(eingabe.text)
    expect(JSON.stringify(kontext)).not.toContain(eingabe.text)
  })

  it('Gegenprobe: belegt es die Stunde, geht die Mail in den Nachlauf — ohne Meldung', async () => {
    db.updateMany.mockResolvedValue({ count: 1 })

    expect(await aktionen.antworteAlsTeam(eingabe)).toEqual({ ok: true, mail: 'unterwegs' })
    expect(nachDerAntwort).toHaveBeenCalledTimes(1)
    expect(captureException).not.toHaveBeenCalled()
  })
})

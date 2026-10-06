/**
 * Die Server Actions der E-Mail-Bestätigung (S3, Nachtlauf Nr. 17b) —
 * Better Auth, Datenbankschicht und Request-Kontext gemockt, Regeln echt.
 *
 * Beweist:
 *  - „Erneut senden" verlangt eine Sitzung und entscheidet nach dem FRISCHEN
 *    Stand aus der Datenbank, nie nach `session.user.emailVerified`
 *    (Cookie-Cache): schon bestätigt → keine Mail, vor dem Stichtag → keine
 *    Mail, Bremse greift → keine Mail und die Wartezeit kommt mit.
 *  - Erlaubt → Better Auth verschickt an die Adresse aus der Datenbank.
 *  - Bestätigen nimmt nur den signierten Token, ruft Better Auth auf dem
 *    Server auf (POST, kein GET aus der Mail) und übersetzt abgelaufene und
 *    ungültige Links in Sätze ohne Fachwort.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers({ cookie: 'sitzung=1' })) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn(), sendVerificationEmail: vi.fn(), verifyEmail: vi.fn() } },
}))
vi.mock('@/server/email-bestaetigung', () => ({
  ladeBestaetigungsStand: vi.fn(),
  reserviereBestaetigungsVersand: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { ladeBestaetigungsStand, reserviereBestaetigungsVersand } from '@/server/email-bestaetigung'
import { bestaetigeEmail, sendeBestaetigungErneut } from '@/server/actions/email-bestaetigung'

const getSession = vi.mocked(auth.api.getSession)
const senden = vi.mocked(auth.api.sendVerificationEmail)
const pruefen = vi.mocked(auth.api.verifyEmail)
const stand = vi.mocked(ladeBestaetigungsStand)
const reservieren = vi.mocked(reserviereBestaetigungsVersand)

/** Die Sitzung behauptet „unbestätigt" — veralteter Cookie-Cache ist der Normalfall. */
const SITZUNG = { user: { id: 'user-1', email: 'alt@example.com', emailVerified: false } }

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(SITZUNG as never)
  stand.mockResolvedValue({ email: 'bauer@example.com', emailVerified: false, pflichtig: true, offen: true })
  reservieren.mockResolvedValue({ ok: true })
  senden.mockResolvedValue({ status: true } as never)
})

describe('sendeBestaetigungErneut', () => {
  it('ohne Sitzung: Fehler, keine Mail', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await sendeBestaetigungErneut()).toMatchObject({ error: expect.any(String) })
    expect(senden).not.toHaveBeenCalled()
  })

  it('schickt die Mail an die Adresse aus der Datenbank, mit der Sitzung der Anfrage', async () => {
    expect(await sendeBestaetigungErneut()).toEqual({ ok: true })
    expect(reservieren).toHaveBeenCalledWith('user-1')
    expect(senden).toHaveBeenCalledTimes(1)
    const aufruf = senden.mock.calls[0]?.[0] as { body: { email: string }; headers: Headers }
    expect(aufruf.body.email).toBe('bauer@example.com')
    expect(aufruf.headers.get('cookie')).toBe('sitzung=1')
  })

  it('schon bestätigt laut Datenbank (Sitzung sagt noch nein): keine Mail', async () => {
    stand.mockResolvedValue({ email: 'bauer@example.com', emailVerified: true, pflichtig: true, offen: false })
    expect(await sendeBestaetigungErneut()).toEqual({ ok: true, schonBestaetigt: true })
    expect(reservieren).not.toHaveBeenCalled()
    expect(senden).not.toHaveBeenCalled()
  })

  it('Konto vor dem Stichtag: keine Mail, nichts zu tun', async () => {
    stand.mockResolvedValue({ email: 'bauer@example.com', emailVerified: false, pflichtig: false, offen: false })
    expect(await sendeBestaetigungErneut()).toMatchObject({ error: expect.any(String) })
    expect(senden).not.toHaveBeenCalled()
  })

  it('Bremse greift: keine Mail, die Wartezeit kommt mit', async () => {
    reservieren.mockResolvedValue({ ok: false, warteSekunden: 42 })
    const antwort = await sendeBestaetigungErneut()
    expect(antwort).toMatchObject({ warteSekunden: 42 })
    expect('error' in antwort && antwort.error).toContain('42 Sekunden')
    expect(senden).not.toHaveBeenCalled()
  })

  it('Konto verschwunden: Fehler, keine Mail', async () => {
    stand.mockResolvedValue(null)
    expect(await sendeBestaetigungErneut()).toMatchObject({ error: expect.any(String) })
    expect(senden).not.toHaveBeenCalled()
  })

  it('Better Auth scheitert: Satz für den Bauern statt eines Fehlers', async () => {
    senden.mockRejectedValue(new Error('kaputt'))
    expect(await sendeBestaetigungErneut()).toEqual({ error: 'Wir konnten dir gerade keine E-Mail schicken. Probier es gleich noch einmal.' })
  })
})

describe('bestaetigeEmail', () => {
  it('nimmt nur einen Token — ohne Eingabe kein Aufruf', async () => {
    expect(await bestaetigeEmail({})).toMatchObject({ code: 'UNGUELTIG' })
    expect(await bestaetigeEmail({ token: '' })).toMatchObject({ code: 'UNGUELTIG' })
    expect(await bestaetigeEmail(null)).toMatchObject({ code: 'UNGUELTIG' })
    expect(await bestaetigeEmail({ token: 'x'.repeat(5000) })).toMatchObject({ code: 'UNGUELTIG' })
    expect(pruefen).not.toHaveBeenCalled()
  })

  it('bestätigt über Better Auth auf dem Server — ohne Sitzung, ohne Weiterleitung', async () => {
    pruefen.mockResolvedValue({ status: true, user: null } as never)
    expect(await bestaetigeEmail({ token: 'kopf.inhalt.signatur' })).toEqual({ ok: true })
    expect(pruefen).toHaveBeenCalledWith({ query: { token: 'kopf.inhalt.signatur' } })
  })

  it('abgelaufener Link: eigener Satz mit Ausweg', async () => {
    pruefen.mockRejectedValue(Object.assign(new Error('Token expired'), { body: { code: 'TOKEN_EXPIRED' } }))
    const antwort = await bestaetigeEmail({ token: 'abgelaufen' })
    expect(antwort).toMatchObject({ code: 'ABGELAUFEN' })
    expect('error' in antwort && antwort.error).toContain('neuen')
  })

  it('ungültiger Link: kein Fachwort, kein Fehlertext von Better Auth', async () => {
    pruefen.mockRejectedValue(Object.assign(new Error('Invalid token'), { body: { code: 'INVALID_TOKEN' } }))
    const antwort = await bestaetigeEmail({ token: 'gefaelscht' })
    expect(antwort).toMatchObject({ code: 'UNGUELTIG' })
    expect('error' in antwort && antwort.error).not.toMatch(/token|invalid/i)
  })
})

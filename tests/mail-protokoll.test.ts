/**
 * Das Protokoll der direkten Mails am ECHTEN sendRaw (Register N26, Nr. 158):
 * nach jedem Versuch eine Zeile mit Art, Stand, Resend-ID bzw. Fehlercode,
 * Bestellung und dem Fingerabdruck der Adresse — nie die Adresse selbst, nie
 * der Text von Resend. Fail-open: Ein Fehler im Protokoll hält die Mail nicht
 * auf. Gemockt sind nur das Resend-SDK, der Zähler und der Schreiber der Zeile.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

const { sendMock, protokolliereSofortMail } = vi.hoisted(() => ({ sendMock: vi.fn(), protokolliereSofortMail: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))
vi.mock('@/server/betrieb-zaehler', () => ({ zaehleMail: vi.fn() }))
vi.mock('@/server/mail-warteschlange', () => ({ protokolliereSofortMail }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { empfaengerFingerabdruck } from '@/lib/mail-empfaenger'

const IMPORT_TIMEOUT = 30_000
let mitKey: typeof import('@/lib/email')
let ohneKey: typeof import('@/lib/email')

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_platzhalter')
  mitKey = await import('@/lib/email')
  vi.resetModules()
  vi.stubEnv('RESEND_API_KEY', '')
  ohneKey = await import('@/lib/email')
}, IMPORT_TIMEOUT)

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  vi.clearAllMocks()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
  protokolliereSofortMail.mockResolvedValue(undefined)
})

const ADRESSE = 'Kundin@Example.com'

describe('sendRaw schreibt jede Mail ins Protokoll', () => {
  it('gesendet: Art, Bestellung, Resend-ID und Fingerabdruck — die Adresse steht nirgends', async () => {
    expect(await mitKey.sendRaw(ADRESSE, 'Deine Bestellung', '<p>Hallo</p>', { art: 'bar-bestaetigungslink', bestellungId: 'o1' })).toEqual({ id: 'email_1' })
    expect(protokolliereSofortMail).toHaveBeenCalledTimes(1)
    const zeile = protokolliereSofortMail.mock.calls[0][0]
    expect(zeile).toEqual({ art: 'bar-bestaetigungslink', bestellungId: 'o1', empfaengerHash: empfaengerFingerabdruck(' kundin@example.com '), status: 'gesendet', resendId: 'email_1' })
    expect(zeile.empfaengerHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(zeile).toLowerCase()).not.toContain('kundin@example.com')
  })

  it('Fehler von Resend: gescheitert mit dem kurzen Code, nie dem Text', async () => {
    sendMock.mockResolvedValue({ data: null, error: { name: 'validation_error', statusCode: 422, message: 'Invalid `to` field: kundin@example.com' } })
    await mitKey.sendRaw(ADRESSE, 'Test', '<p>Hallo</p>', { art: 'testmail' })
    const zeile = protokolliereSofortMail.mock.calls[0][0]
    expect(zeile).toMatchObject({ art: 'testmail', status: 'gescheitert', fehlerCode: 'validation_error' })
    expect(JSON.stringify(zeile)).not.toContain('Invalid')
  })

  it('Post-Sperre (Z3) → gesperrt; ohne Schlüssel → ohne_schluessel — beide ohne Versand', async () => {
    await mitKey.sendRaw('kundin@example.org', 'Test', '<p>Hallo</p>', { art: 'anmeldecode' })
    await ohneKey.sendRaw(ADRESSE, 'Test', '<p>Hallo</p>', { art: 'anmeldecode' })
    expect(sendMock).not.toHaveBeenCalled()
    expect(protokolliereSofortMail.mock.calls.map(([z]) => z.status)).toEqual(['gesperrt', 'ohne_schluessel'])
  })

  it('ein Fehler im Protokoll bricht den Versand nicht — nach Sentry nur die Klasse unter festem Satz', async () => {
    protokolliereSofortMail.mockRejectedValue(Object.assign(new Error('kundin@example.com'), { name: 'PrismaClientKnownRequestError' }))
    expect(await mitKey.sendRaw(ADRESSE, 'Test', '<p>Hallo</p>', { art: 'testmail' })).toEqual({ id: 'email_1' })
    expect(sendMock).toHaveBeenCalledTimes(1)
    const [fehler] = vi.mocked(Sentry.captureException).mock.calls[0]
    expect((fehler as Error).message).toBe('Mail-Protokoll: Zeile nicht geschrieben')
    expect((fehler as Error).name).toBe('PrismaClientKnownRequestError')
  })

  it('ohne art kompiliert sendRaw nicht (der Typ erzwingt die Art)', () => {
    // Nie aufgerufen: Die Aussage prüft `pnpm typecheck` über @ts-expect-error.
    const ohneArt = () =>
      // @ts-expect-error — `art` fehlt
      mitKey.sendRaw(ADRESSE, 'Test', '<p>Hallo</p>')
    const ohneArtMitKopf = () =>
      // @ts-expect-error — Optionen ohne `art`
      mitKey.sendRaw(ADRESSE, 'Test', '<p>Hallo</p>', { headers: {} })
    expect(typeof ohneArt).toBe('function')
    expect(typeof ohneArtMitKopf).toBe('function')
  })
})

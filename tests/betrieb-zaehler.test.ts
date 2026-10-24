/**
 * Der Mail-Zähler von Admin › Betrieb am ECHTEN sendRaw (src/lib/email.ts,
 * Register N18, Nr. 103). Gemockt sind nur das Resend-SDK und der Zähler
 * selbst (src/server/betrieb-zaehler.ts — seine eine Anweisung prüft
 * tests/integration/betrieb.int.test.ts an echtem Postgres).
 *
 * Beweist: eine verschickte Mail zählt genau einmal; ein Fehler beim Zählen
 * stoppt die Mail nicht und wirft nicht (nach Sentry nur die Klasse unter
 * festem Satz, nie Adresse oder Betreff); der Log-Modus ohne RESEND_API_KEY,
 * die gesperrte Post (Register Z3) und ein Fehler von Resend zählen nicht.
 * Dass email.ts den Zähler nur dynamisch einbindet, hält tests/betrieb.test.ts.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

const { sendMock, zaehleMail } = vi.hoisted(() => ({ sendMock: vi.fn(), zaehleMail: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))
vi.mock('@/server/betrieb-zaehler', () => ({ zaehleMail }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

import * as Sentry from '@sentry/nextjs'

// Schweres Modul (React, alle Vorlagen): einmal je Variante, mit eigenem Timeout (TESTING_GUIDELINES §4).
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
  zaehleMail.mockResolvedValue(undefined)
})

describe('sendRaw zählt verschickte Mails', () => {
  it('eine verschickte Mail zählt genau einmal — nach dem Versand', async () => {
    const reihenfolge: string[] = []
    sendMock.mockImplementation(async () => {
      reihenfolge.push('versand')
      return { data: { id: 'email_1' }, error: null }
    })
    zaehleMail.mockImplementation(async () => {
      reihenfolge.push('zaehlen')
    })

    expect(await mitKey.sendRaw('kunde@example.com', 'Betreff', '<p>Hallo</p>', { art: 'testmail' })).toEqual({ id: 'email_1' })
    expect(reihenfolge).toEqual(['versand', 'zaehlen'])
  })

  it('ein Fehler beim Zählen stoppt die Mail nicht und wirft nicht — Sentry bekommt nur die Klasse', async () => {
    zaehleMail.mockRejectedValue(Object.assign(new Error('Verbindung zu kunde@example.com weg'), { name: 'PrismaClientInitializationError' }))

    expect(await mitKey.sendRaw('kunde@example.com', 'Deine Bestellung', '<p>Hallo</p>', { art: 'testmail' })).toEqual({ id: 'email_1' })
    const [gemeldet, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error, Record<string, unknown>]
    expect([gemeldet.name, gemeldet.message]).toEqual(['PrismaClientInitializationError', 'Betrieb: Mail nicht gezählt'])
    expect(JSON.stringify(kontext)).not.toMatch(/example\.com|Bestellung/)
  })

  it('der Log-Modus ohne RESEND_API_KEY zählt nicht', async () => {
    await ohneKey.sendRaw('kunde@example.com', 'Betreff', '<p>Hallo</p>', { art: 'testmail' })
    await vi.dynamicImportSettled()
    expect(sendMock).not.toHaveBeenCalled()
    expect(zaehleMail).not.toHaveBeenCalled()
  })

  it('gesperrte Post (Register Z3, außerhalb der Produktion an eine fremde Adresse) zählt nicht', async () => {
    expect(await mitKey.sendRaw('kunde@example.org', 'Betreff', '<p>Hallo</p>', { art: 'testmail' })).toEqual({ gesperrt: true })
    await vi.dynamicImportSettled()
    expect(zaehleMail).not.toHaveBeenCalled()
  })

  it('ein Fehler von Resend zählt nicht', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'domain not verified' } })
    await mitKey.sendRaw('kunde@example.com', 'Betreff', '<p>Hallo</p>', { art: 'testmail' })
    await vi.dynamicImportSettled()
    expect(zaehleMail).not.toHaveBeenCalled()
  })
})

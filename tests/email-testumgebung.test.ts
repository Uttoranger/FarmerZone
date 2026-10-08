/**
 * Post-Sperre außerhalb der Produktion am ECHTEN sendRaw (src/lib/email.ts,
 * Register Z3, Nachtlauf Nr. 43). Nur das Resend-SDK ist gemockt — kein Netz.
 *
 * Beweist:
 *  - In der Vorschau gehen Mails nur an TEST_EMPFAENGER und @example.com;
 *    alles andere verschickt sendRaw nicht, sondern zählt es — im Log steht
 *    keine Adresse.
 *  - Frei ist nur das Produktions-Deployment bei Vercel (VERCEL_ENV=production,
 *    Gegenprobe aus demselben Modul). Gebaut wie die Produktion, aber ohne
 *    VERCEL_ENV (lokaler Build, CI, Skripte), gilt die Sperre — und Sentry
 *    erfährt es höchstens einmal je Instanz, ohne Adresse und Betreff.
 *  - Ohne RESEND_API_KEY bleibt der Log-Modus, wie er war.
 *
 * Die Umgebung entsteht wie im Betrieb aus VERCEL_ENV (umgebung-server.ts,
 * auf Modulebene) — deshalb je Variante eine eigene Instanz, einmal in beforeAll
 * (Vorbild tests/email-sendraw.test.ts).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

const { sendMock, captureMessage } = vi.hoisted(() => ({ sendMock: vi.fn(), captureMessage: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage, captureException: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

// Kalter Import von email.ts zieht React und alle Vorlagen nach — eigenes Limit,
// einmal je Datei (TESTING_GUIDELINES §4).
const IMPORT_TIMEOUT = 30_000

type EmailModul = typeof import('@/lib/email')
let vorschau: EmailModul
let produktion: EmailModul
let produktionOhneVercel: EmailModul
let vorschauOhneKey: EmailModul

async function ladeMit(werte: Record<string, string>): Promise<EmailModul> {
  vi.resetModules()
  for (const [name, wert] of Object.entries(werte)) vi.stubEnv(name, wert)
  return import('@/lib/email')
}

beforeAll(async () => {
  vorschau = await ladeMit({
    VERCEL_ENV: 'preview',
    RESEND_API_KEY: 're_test_dummy',
    TEST_EMPFAENGER: 'tester@example.org, Zweite@Example.net',
  })
  produktion = await ladeMit({ VERCEL_ENV: 'production', RESEND_API_KEY: 're_test_dummy', TEST_EMPFAENGER: '' })
  // Wie ein lokaler Produktions-Build: NODE_ENV ist nicht development, VERCEL_ENV fehlt.
  produktionOhneVercel = await ladeMit({ VERCEL_ENV: '', RESEND_API_KEY: 're_test_dummy', TEST_EMPFAENGER: '' })
  vorschauOhneKey = await ladeMit({ VERCEL_ENV: 'preview', RESEND_API_KEY: '', TEST_EMPFAENGER: '' })
}, IMPORT_TIMEOUT * 4)

afterAll(() => {
  vi.unstubAllEnvs()
})

let log: MockInstance<typeof console.log>

beforeEach(() => {
  captureMessage.mockReset()
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
  log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
  log.mockRestore()
})

/** Alles, was sendRaw ins Log geschrieben hat, als ein Text. */
const geloggt = (): string => log.mock.calls.map((aufruf: unknown[]) => aufruf.join(' ')).join('\n')

describe('Vorschau: Post nur an freigegebene Adressen', () => {
  it('verschickt an eine Adresse aus TEST_EMPFAENGER', async () => {
    const ergebnis = await vorschau.sendRaw('tester@example.org', 'Test', '<p>Hallo</p>')

    expect(ergebnis).toEqual({ id: 'email_1' })
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'tester@example.org' }))
  })

  it('vergleicht ohne Rücksicht auf Groß-/Kleinschreibung und Ränder', async () => {
    await vorschau.sendRaw('  ZWEITE@example.NET ', 'Test', '<p>Hallo</p>')

    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('verschickt an jede Adresse von example.com (Seed- und Testkonten)', async () => {
    await vorschau.sendRaw('bauer-01@example.com', 'Test', '<p>Hallo</p>')

    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('verschickt NICHT an eine fremde Adresse und sagt das im Ergebnis', async () => {
    const ergebnis = await vorschau.sendRaw('kundin@example.org', 'Test', '<p>Hallo</p>')

    expect(ergebnis).toEqual({ gesperrt: true })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('zählt gesperrte Mails mit — und schreibt dabei keine Adresse und keinen Betreff ins Log', async () => {
    await vorschau.sendRaw('kundin@example.org', 'Deine Bestellung 4711', '<p>Hallo</p>')
    const erster = geloggt()
    await vorschau.sendRaw('andere-kundin@example.org', 'Deine Bestellung 4712', '<p>Hallo</p>')
    const beide = geloggt()

    expect(erster).toMatch(/Nicht verschickt/)
    expect(beide).toMatch(/Nicht verschickt[\s\S]*Nicht verschickt/)
    // Der Zähler steigt von Mail zu Mail.
    const zahlen = [...beide.matchAll(/Bisher (\d+)/g)].map((treffer) => Number(treffer[1]))
    expect(zahlen).toHaveLength(2)
    expect(zahlen[1]).toBe(zahlen[0] + 1)
    expect(beide).not.toContain('kundin@example.org')
    expect(beide).not.toContain('Bestellung 47')
  })

  it('lässt mehrere Adressen in einem Feld nie durch — auch nicht mit einer von example.com dahinter', async () => {
    const ergebnis = await vorschau.sendRaw('kundin@example.org, test@example.com', 'Test', '<p>Hallo</p>')

    expect(ergebnis).toEqual({ gesperrt: true })
    expect(sendMock).not.toHaveBeenCalled()
  })
})

describe('Wie die Produktion gebaut, aber ohne VERCEL_ENV=production (fail-closed)', () => {
  it('verschickt nicht an eine fremde Adresse — wie außerhalb der Produktion', async () => {
    const ergebnis = await produktionOhneVercel.sendRaw('kundin@example.org', 'Test', '<p>Hallo</p>')

    expect(ergebnis).toEqual({ gesperrt: true })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('verschickt weiter an Testkonten von example.com', async () => {
    await produktionOhneVercel.sendRaw('bauer-01@example.com', 'Test', '<p>Hallo</p>')

    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('meldet die Sperre höchstens einmal je Instanz an Sentry — fester Satz, ohne Adresse und Betreff', async () => {
    // Eigene Instanz: Das „schon gemeldet" lebt auf Modulebene.
    const frisch = await ladeMit({ VERCEL_ENV: '', RESEND_API_KEY: 're_test_dummy', TEST_EMPFAENGER: '' })
    captureMessage.mockReset()

    await frisch.sendRaw('kundin@example.org', 'Deine Bestellung 4711', '<p>Hallo</p>')
    await frisch.sendRaw('andere-kundin@example.org', 'Deine Bestellung 4712', '<p>Hallo</p>')

    expect(captureMessage).toHaveBeenCalledTimes(1)
    const gemeldet = JSON.stringify(captureMessage.mock.calls)
    expect(gemeldet).toMatch(/VERCEL_ENV/)
    expect(gemeldet).not.toMatch(/kundin@|example\.org|Bestellung/)
  }, IMPORT_TIMEOUT)
})

describe('Gegenproben', () => {
  it('Produktions-Deployment bei Vercel: verschickt an jede Adresse, ohne Meldung', async () => {
    const ergebnis = await produktion.sendRaw('kundin@example.org', 'Test', '<p>Hallo</p>')

    expect(ergebnis).toEqual({ id: 'email_1' })
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'kundin@example.org' }))
    expect(geloggt()).not.toMatch(/Nicht verschickt/)
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('Vorschau: die gewollte Sperre meldet nichts an Sentry', async () => {
    await vorschau.sendRaw('kundin@example.org', 'Test', '<p>Hallo</p>')

    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('ohne RESEND_API_KEY bleibt der Log-Modus, wie er war — auch in der Vorschau', async () => {
    const ergebnis = await vorschauOhneKey.sendRaw('kundin@example.org', 'Test', '<p>Hallo</p>')

    expect(ergebnis.error).toContain('RESEND_API_KEY')
    expect(ergebnis.gesperrt).toBeUndefined()
    expect(sendMock).not.toHaveBeenCalled()
    expect(geloggt()).toMatch(/KEIN API-KEY/)
  })
})

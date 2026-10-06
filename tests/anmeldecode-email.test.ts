/**
 * Die Mail mit dem Anmeldecode (src/emails/anmeldecode.tsx über
 * sendAnmeldeCodeEmail in src/lib/email.ts, echtes Modul).
 *
 * Beweist:
 *  - Der Code steht groß im Text, dazu „10 Minuten gültig" und der
 *    Ignorieren-Hinweis.
 *  - Der Code steht NICHT im Betreff und nicht im Vorschautext: sendRaw
 *    schreibt den Betreff auch in Produktion ins Log (Vercel), und
 *    Sperrbildschirme zeigen Betreff und Vorschau jedem, der danebensteht.
 *  - Die Mail enthält überhaupt keinen Link: Ein Link aus einer Mail ändert
 *    nie einen Zustand (ARCHITECTURE §5) — angemeldet wird nur mit dem Code.
 *  - Ohne Schlüssel kommt ein Ergebnis ohne ID zurück (auth.ts schreibt den
 *    Code dann lokal ins Log, nie in Produktion).
 * Nur das Resend-SDK ist gemockt — kein Netzwerk.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

const IMPORT_TIMEOUT = 30_000

let email: typeof import('@/lib/email')
let ohneSchluessel: typeof import('@/lib/email')

// email.ts liest RESEND_API_KEY auf Modulebene — eine Instanz je Variante
// (TESTING_GUIDELINES §4, Vorbild tests/email-sendraw.test.ts).
beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  email = await import('@/lib/email')
  vi.resetModules()
  vi.stubEnv('RESEND_API_KEY', '')
  ohneSchluessel = await import('@/lib/email')
}, IMPORT_TIMEOUT)

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
})

async function versende(code = '481234') {
  const ergebnis = await email.sendAnmeldeCodeEmail('kundin@example.com', code)
  return { ergebnis, aufruf: sendMock.mock.calls[0][0] as { to: string; subject: string; html: string } }
}

describe('sendAnmeldeCodeEmail', () => {
  it('schickt an die Adresse, mit deutschem Betreff ohne Code', async () => {
    const { aufruf, ergebnis } = await versende()
    expect(aufruf.to).toBe('kundin@example.com')
    expect(aufruf.subject).toBe('Dein Anmeldecode für FarmerZone')
    expect(aufruf.subject).not.toMatch(/\d{6}/)
    expect(ergebnis.id).toBe('email_1')
  })

  it('der Code steht im Text, dazu Gültigkeit und Ignorieren-Hinweis', async () => {
    const { aufruf } = await versende('905173')
    expect(aufruf.html).toContain('905173')
    expect(aufruf.html).toContain('10 Minuten')
    expect(aufruf.html).toContain('ignorieren')
  })

  it('der Vorschautext verrät den Code nicht', async () => {
    const { aufruf } = await versende('905173')
    // Der Vorschautext steht als erstes verstecktes div im Body.
    const vorschau = aufruf.html.slice(0, aufruf.html.indexOf('905173'))
    expect(vorschau).toContain('10 Minuten gültig')
    expect(aufruf.html.indexOf('905173')).toBe(aufruf.html.lastIndexOf('905173'))
  })

  it('kein Link, der anmeldet — der Code ist der einzige Weg', async () => {
    const { aufruf } = await versende()
    expect(aufruf.html).not.toContain('/api/auth')
    expect(aufruf.html).not.toMatch(/<a [^>]*href=/)
  })

  it('ohne Schlüssel: kein Versand, Ergebnis ohne ID', async () => {
    const ergebnis = await ohneSchluessel.sendAnmeldeCodeEmail('kundin@example.com', '481234')
    expect(ergebnis.id).toBeUndefined()
    expect(sendMock).not.toHaveBeenCalled()
  })
})

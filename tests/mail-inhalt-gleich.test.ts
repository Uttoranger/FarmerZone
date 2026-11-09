/**
 * Inhalts-Funktionen der Sofort-Mails (Register N48, Nr. 270; src/lib/email.ts).
 *
 * Nr. 270 löst aus jeder `send…`-Funktion ohne eigene Inhalts-Funktion eine
 * `<art>Inhalt(daten) → { betreff, html }` heraus; die `send…`-Funktion ruft
 * sie und dann sendRaw. Text und Ablauf bleiben gleich.
 *
 * Beweist je Art, am ECHTEN email.ts (gemockt sind nur das Resend-SDK, das
 * Protokoll und der Zähler — kein Netz, keine Datenbank):
 *  - Betreff und HTML, die der Versand an sendRaw gibt (gefangen an der
 *    Attrappe von Resend), sind byteweise dieselben wie das Ergebnis der
 *    Inhalts-Funktion mit denselben Daten;
 *  - sendRaw läuft genau einmal: ein Aufruf bei Resend mit Empfänger, Betreff
 *    und HTML, eine Zeile im Protokoll mit genau der Art der Funktion;
 *  - die Inhalts-Funktion loggt nie (auch nicht im Fehler) und verschickt nie;
 *  - Fehlerweg wie vor Nr. 270 (Vorlage wirft): die Funktionen mit Ergebnis
 *    geben `{ error: <Nachricht> }` zurück und schreiben denselben Satz ins
 *    Log, sendPasswordResetEmail und sendRegistrierungsHinweis werfen den
 *    Fehler der Vorlage selbst, sendBetriebWarnung zählt jede Adresse als
 *    gescheitert; in keinem Fall ruft der Versand Resend.
 * Der Vergleich mit dem Stand vor Nr. 270 (30a60625) lief einmal beim Bau
 * (Bericht docs/nachtlauf/berichte/270.md); dieser Test hält fest, dass der
 * Versand weiter genau die Inhalts-Funktion verschickt.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

const { sendMock, protokoll, kaputt } = vi.hoisted(() => {
  // email.ts liest den Schlüssel beim Laden; ohne ihn stünde nur der Log-Modus.
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  return { sendMock: vi.fn(), protokoll: vi.fn(), kaputt: { an: false } }
})

vi.mock('server-only', () => ({}))
vi.mock('@/server/mail-warteschlange', () => ({ protokolliereSofortMail: protokoll }))
vi.mock('@/server/betrieb-zaehler', () => ({ zaehleMail: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))
// „Vorlage wirft“: das Rendern jeder Vorlage scheitert, solange der Schalter an ist.
vi.mock('@react-email/render', async (original) => {
  const echt = await original<typeof import('@react-email/render')>()
  return {
    ...echt,
    render: (...args: Parameters<typeof echt.render>) => {
      if (kaputt.an) throw new Error('Vorlage kaputt')
      return echt.render(...args)
    },
  }
})

type Email = typeof import('@/lib/email')
let email: Email

beforeAll(async () => {
  email = await import('@/lib/email')
}, 30_000)

// Erfunden; @example.com lässt die Post-Sperre (Z3) unter Vitest durch.
const AN = 'kundin@example.com'
const ZEIT = new Date('2027-03-02T20:14:00Z')

type Fehlerweg = 'ergebnis' | 'wirft' | 'liste'
type Fall = { name: string; art: string; fehlerweg: Fehlerweg; senden: (e: Email) => Promise<unknown>; inhalt: (e: Email) => Promise<{ betreff: string; html: string }> }

const FAELLE: Fall[] = [
  { name: 'Anmeldecode', art: 'anmeldecode', fehlerweg: 'ergebnis', senden: (e) => e.sendAnmeldeCodeEmail(AN, 'ABCDEF'), inhalt: (e) => e.anmeldecodeInhalt({ code: 'ABCDEF' }) },
  { name: 'Bestellcode', art: 'bestellcode', fehlerweg: 'ergebnis', senden: (e) => e.sendBestellCodeEmail(AN, 'ABCDEF'), inhalt: (e) => e.bestellcodeInhalt({ code: 'ABCDEF' }) },
  {
    name: 'E-Mail bestätigen',
    art: 'email-bestaetigung',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendEmailBestaetigung(AN, 'https://hof.example.com/verify?token=abcdefghijklmnop'),
    inhalt: (e) => e.emailBestaetigungInhalt({ url: 'https://hof.example.com/verify?token=abcdefghijklmnop' }),
  },
  {
    name: 'Registrierungs-Hinweis',
    art: 'registrierungs-hinweis',
    fehlerweg: 'wirft',
    senden: (e) => e.sendRegistrierungsHinweis(AN, { weg: 'code', anmelden: 'https://hof.example.com/login', passwortZuruecksetzen: null }),
    inhalt: (e) => e.registrierungsHinweisInhalt({ weg: 'code', anmelden: 'https://hof.example.com/login', passwortZuruecksetzen: null }),
  },
  {
    name: 'Passwort zurücksetzen',
    art: 'passwort-link',
    fehlerweg: 'wirft',
    senden: (e) => e.sendPasswordResetEmail(AN, 'https://hof.example.com/reset-password?token=abcdefghijklmnop'),
    inhalt: (e) => e.passwortLinkInhalt({ url: 'https://hof.example.com/reset-password?token=abcdefghijklmnop' }),
  },
  { name: 'Zu viele Codes', art: 'zu-viele-versuche', fehlerweg: 'ergebnis', senden: (e) => e.sendZuVieleVersucheEmail(AN, 'code', ZEIT), inhalt: (e) => e.zuVieleVersucheInhalt({ art: 'code', bis: ZEIT }) },
  { name: 'Zu viele Passwörter', art: 'zu-viele-versuche', fehlerweg: 'ergebnis', senden: (e) => e.sendZuVieleVersucheEmail(AN, 'passwort', ZEIT), inhalt: (e) => e.zuVieleVersucheInhalt({ art: 'passwort', bis: ZEIT }) },
  {
    name: 'Neue Anmeldung',
    art: 'neue-anmeldung',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendNeueAnmeldungEmail(AN, { hof: true, name: 'Franz Müller', geraet: 'Windows · Edge', zeitpunkt: ZEIT, link: 'https://hof.example.com/sicherheit?t=abcdefghijklmnop' }),
    inhalt: (e) => e.neueAnmeldungInhalt({ hof: true, name: 'Franz Müller', geraet: 'Windows · Edge', zeitpunkt: ZEIT, link: 'https://hof.example.com/sicherheit?t=abcdefghijklmnop' }),
  },
  {
    name: 'Admin-Sicherheit mit Code',
    art: 'admin-sicherheit',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendAdminSicherheitEmail(AN, 'einrichtungscode', { geraet: 'Laptop · Chrome', zeitpunkt: ZEIT, code: 'ABCDEF' }),
    inhalt: (e) => e.adminSicherheitInhalt({ anlass: 'einrichtungscode', geraet: 'Laptop · Chrome', zeitpunkt: ZEIT, code: 'ABCDEF' }),
  },
  {
    name: 'Admin-Sicherheit Passkey',
    art: 'admin-sicherheit',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendAdminSicherheitEmail(AN, 'passkey-entfernt', { geraet: 'Laptop · Chrome', zeitpunkt: ZEIT }),
    inhalt: (e) => e.adminSicherheitInhalt({ anlass: 'passkey-entfernt', geraet: 'Laptop · Chrome', zeitpunkt: ZEIT }),
  },
  {
    name: 'Neue Anmelde-Adresse',
    art: 'email-aendern-link',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendEmailAendernLink(AN, { hof: 'Hof Test', link: 'https://hof.example.com/konto?t=abcdefghijklmnop' }),
    inhalt: (e) => e.emailAendernLinkInhalt({ hof: 'Hof Test', link: 'https://hof.example.com/konto?t=abcdefghijklmnop' }),
  },
  {
    name: 'Anmelde-Adresse geändert',
    art: 'email-geaendert-hinweis',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendEmailGeaendertHinweis(AN, { hof: null, zeitpunkt: ZEIT, link: 'https://hof.example.com/sicherheit?t=abcdefghijklmnop' }),
    inhalt: (e) => e.emailGeaendertHinweisInhalt({ hof: null, zeitpunkt: ZEIT, link: 'https://hof.example.com/sicherheit?t=abcdefghijklmnop' }),
  },
  {
    name: 'Team-Recht geändert',
    art: 'team-recht-geaendert',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendTeamRechtGeaendert(AN, { anlass: 'rechte', name: 'Max Mustermann', rechte: ['Startseite'] }),
    inhalt: (e) => e.teamRechtGeaendertInhalt({ anlass: 'rechte', name: 'Max Mustermann', rechte: ['Startseite'] }),
  },
  { name: 'Empfänger bestätigen', art: 'betreiber-bestaetigung', fehlerweg: 'ergebnis', senden: (e) => e.sendBetreiberBestaetigung(AN, 'abcdefghijklmnop'), inhalt: (e) => e.betreiberBestaetigungInhalt({ token: 'abcdefghijklmnop' }) },
  {
    name: 'Betrieb-Warnung',
    art: 'betrieb-warnung',
    fehlerweg: 'liste',
    senden: (e) => e.sendBetriebWarnung({ art: 'grenze', wert: 'datenbank', anteil: 82, stand: '410 MB von 500 MB', trend: null, ohneVerwendungBytes: null }, [AN]),
    inhalt: (e) => e.betriebWarnungInhalt({ art: 'grenze', wert: 'datenbank', anteil: 82, stand: '410 MB von 500 MB', trend: null, ohneVerwendungBytes: null }),
  },
]

let konsole: Record<'log' | 'error' | 'warn', MockInstance>

beforeEach(() => {
  vi.clearAllMocks()
  kaputt.an = false
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
  konsole = { log: vi.spyOn(console, 'log').mockImplementation(() => {}), error: vi.spyOn(console, 'error').mockImplementation(() => {}), warn: vi.spyOn(console, 'warn').mockImplementation(() => {}) }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Inhalts-Funktion und Versand verschicken dieselbe Mail', () => {
  it.each(FAELLE)('$name: Betreff und HTML an sendRaw sind byteweise das Ergebnis der Inhalts-Funktion, sendRaw genau einmal mit der Art', async (fall) => {
    // Arrange – Act: erst der Versand (gefangen an Resend), dann die Inhalts-Funktion allein.
    await fall.senden(email)
    const gesendet = sendMock.mock.calls.map((c) => c[0] as { to: string; subject: string; html: string })
    const protokollZeilen = protokoll.mock.calls.map((c) => (c[0] as { art: string }).art)
    sendMock.mockClear()
    konsole.log.mockClear()
    konsole.error.mockClear()
    const inhalt = await fall.inhalt(email)

    // Assert
    expect(gesendet).toHaveLength(1)
    expect(gesendet[0].to).toBe(AN)
    expect(Buffer.from(gesendet[0].subject).equals(Buffer.from(inhalt.betreff))).toBe(true)
    expect(Buffer.from(gesendet[0].html).equals(Buffer.from(inhalt.html))).toBe(true)
    expect(protokollZeilen).toEqual([fall.art])
    // Die Inhalts-Funktion allein: kein Versand, kein Log, keine Adresse im Ergebnis.
    expect(sendMock).not.toHaveBeenCalled()
    expect(konsole.log).not.toHaveBeenCalled()
    expect(konsole.error).not.toHaveBeenCalled()
    expect(Object.keys(inhalt).sort()).toEqual(['betreff', 'html'])
  })
})

describe('Fehlerweg wie vor Nr. 270: die Vorlage wirft', () => {
  it.each(FAELLE)('$name: derselbe Ausgang, kein Versand, und die Inhalts-Funktion wirft ohne Log', async (fall) => {
    kaputt.an = true

    if (fall.fehlerweg === 'ergebnis') {
      await expect(fall.senden(email)).resolves.toEqual({ error: 'Vorlage kaputt' })
      expect(konsole.error).toHaveBeenCalledWith('[E-Mail] Vorlage nicht erzeugt: Vorlage kaputt')
    } else if (fall.fehlerweg === 'liste') {
      await expect(fall.senden(email)).resolves.toEqual({ gesendet: 0, gescheitert: 1 })
      expect(konsole.error).toHaveBeenCalledWith('[E-Mail] Vorlage nicht erzeugt: Vorlage kaputt')
    } else {
      // Wirft wie vorher den Fehler der Vorlage selbst — keine Hülle, kein Log.
      const fehler = await fall.senden(email).then(
        () => null,
        (e: unknown) => e
      )
      expect(fehler).toBeInstanceOf(Error)
      expect((fehler as Error).name).toBe('Error')
      expect((fehler as Error).message).toBe('Vorlage kaputt')
      expect(konsole.error).not.toHaveBeenCalled()
    }
    expect(sendMock).not.toHaveBeenCalled()
    expect(protokoll).not.toHaveBeenCalled()

    konsole.error.mockClear()
    await expect(fall.inhalt(email)).rejects.toThrow('Vorlage kaputt')
    expect(konsole.error).not.toHaveBeenCalled()
    expect(konsole.log).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ohne kaputte Vorlage geht dieselbe Mail hinaus — der Schalter ist die Ursache', async () => {
    await expect(email.sendAnmeldeCodeEmail(AN, 'ABCDEF')).resolves.toEqual({ id: 'email_1' })
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('eine leere Liste der Betrieb-Warnung baut gar nichts (wie vorher, vor der Vorlage)', async () => {
    kaputt.an = true
    await expect(email.sendBetriebWarnung({ art: 'grenze', wert: 'datenbank', anteil: 82, stand: '410 MB von 500 MB', trend: null, ohneVerwendungBytes: null }, [])).resolves.toEqual({ gesendet: 0, gescheitert: 0 })
    expect(konsole.error).not.toHaveBeenCalled()
  })
})

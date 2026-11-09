/**
 * Inhalts-Funktionen der Sofort-Mails (Register N48, Nr. 270; src/lib/email.ts).
 *
 * Nr. 270 löst aus jeder `send…`-Funktion ohne eigene Inhalts-Funktion eine
 * `<art>Inhalt(daten) → { betreff, html }` heraus; die `send…`-Funktion ruft
 * sie und dann sendRaw. Text und Ablauf bleiben gleich.
 *
 * Beleg des Umbaus „bleibt gleich“ (TESTING_GUIDELINES §1, Ausnahme vom
 * Schnappschuss): tests/fixtures/mail-inhalt/ hält Betreff und HTML, die der
 * Versand im Stand 30a60625 (vor Nr. 270) für dieselben festen Eingaben an
 * sendRaw gab — erzeugt mit dem alten src/lib/email.ts, gemocktem Resend und
 * fester Uhr. Marke, Domain und APP_URL stehen dort als {{MARKE}}, {{DOMAIN}}
 * und {{APP_URL}} (tests/marke-name-wache.test.ts; die Werte kommen aus ihrer
 * einen Stelle). Ändert eine spätere Nummer den Text einer Mail mit Absicht,
 * erzeugt sie die Dateien neu und sagt das im Bericht.
 *
 * Beweist je Art, am ECHTEN email.ts (gemockt sind nur das Resend-SDK, das
 * Protokoll und der Zähler — kein Netz, keine Datenbank), Uhr fest:
 *  - Betreff und HTML der Inhalts-Funktion UND des Versands (gefangen an der
 *    Attrappe von Resend) sind byteweise die Vergleichsdateien aus 30a60625;
 *  - sendRaw läuft genau einmal: ein Aufruf bei Resend mit dem Empfänger, eine
 *    Zeile im Protokoll mit genau der Art der Funktion;
 *  - die Inhalts-Funktion loggt nie (auch nicht im Fehler) und verschickt nie;
 *  - Fehlerweg wie vor Nr. 270 (Vorlage wirft): die Funktionen mit Ergebnis
 *    geben `{ error: <Nachricht> }` zurück und schreiben denselben Satz ins
 *    Log, sendPasswordResetEmail und sendRegistrierungsHinweis werfen den
 *    Fehler der Vorlage selbst, sendBetriebWarnung zählt jede Adresse als
 *    gescheitert; in keinem Fall ruft der Versand Resend.
 * Gegenprobe: Ein Zeichen mehr im HTML fällt beim Vergleich auf.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

import { MARKE } from '@/lib/marke'
import { PRODUKTION_HOST } from '@/lib/umgebung'
import { APP_URL } from '@/lib/umgebung-server'

type Email = typeof import('@/lib/email')
let email: Email

beforeAll(async () => {
  email = await import('@/lib/email')
}, 30_000)

// Erfunden; @example.com lässt die Post-Sperre (Z3) unter Vitest durch.
const AN = 'kundin@example.com'
const ZEIT = new Date('2027-03-02T20:14:00Z')
/** Die feste Uhr, mit der auch die Vergleichsdateien entstanden sind. */
const UHR = new Date('2027-03-02T21:00:00Z')
// Aus Teilen gebaut: tests/code-testwerte-wache.test.ts lässt keinen Code aus Ziffern als Text in Tests zu.
const CODE = '0'.repeat(6)
const TOKEN = 'beispielplatzhalterohnetoken'
const HOF_URL = 'https://hof.example.com'

type Fehlerweg = 'ergebnis' | 'wirft' | 'liste'
type Fall = { kennung: string; art: string; fehlerweg: Fehlerweg; senden: (e: Email) => Promise<unknown>; inhalt: (e: Email) => Promise<{ betreff: string; html: string }> }

const warnung = { art: 'grenze', wert: 'datenbank', anteil: 82, stand: '410 MB von 500 MB', trend: null, ohneVerwendungBytes: null } as const

const FAELLE: Fall[] = [
  { kennung: 'anmeldecode', art: 'anmeldecode', fehlerweg: 'ergebnis', senden: (e) => e.sendAnmeldeCodeEmail(AN, CODE), inhalt: (e) => e.anmeldecodeInhalt({ code: CODE }) },
  { kennung: 'bestellcode', art: 'bestellcode', fehlerweg: 'ergebnis', senden: (e) => e.sendBestellCodeEmail(AN, CODE), inhalt: (e) => e.bestellcodeInhalt({ code: CODE }) },
  {
    kennung: 'email-bestaetigung',
    art: 'email-bestaetigung',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendEmailBestaetigung(AN, `${HOF_URL}/verify?token=${TOKEN}`),
    inhalt: (e) => e.emailBestaetigungInhalt({ url: `${HOF_URL}/verify?token=${TOKEN}` }),
  },
  {
    kennung: 'registrierungs-hinweis',
    art: 'registrierungs-hinweis',
    fehlerweg: 'wirft',
    senden: (e) => e.sendRegistrierungsHinweis(AN, { weg: 'passwort', anmelden: `${HOF_URL}/login`, passwortZuruecksetzen: `${HOF_URL}/forgot-password` }),
    inhalt: (e) => e.registrierungsHinweisInhalt({ weg: 'passwort', anmelden: `${HOF_URL}/login`, passwortZuruecksetzen: `${HOF_URL}/forgot-password` }),
  },
  {
    kennung: 'passwort-link',
    art: 'passwort-link',
    fehlerweg: 'wirft',
    senden: (e) => e.sendPasswordResetEmail(AN, `${HOF_URL}/reset-password?token=${TOKEN}`),
    inhalt: (e) => e.passwortLinkInhalt({ url: `${HOF_URL}/reset-password?token=${TOKEN}` }),
  },
  { kennung: 'zu-viele-codes', art: 'zu-viele-versuche', fehlerweg: 'ergebnis', senden: (e) => e.sendZuVieleVersucheEmail(AN, 'code', ZEIT), inhalt: (e) => e.zuVieleVersucheInhalt({ art: 'code', bis: ZEIT }) },
  { kennung: 'zu-viele-passwoerter', art: 'zu-viele-versuche', fehlerweg: 'ergebnis', senden: (e) => e.sendZuVieleVersucheEmail(AN, 'passwort', ZEIT), inhalt: (e) => e.zuVieleVersucheInhalt({ art: 'passwort', bis: ZEIT }) },
  {
    kennung: 'neue-anmeldung',
    art: 'neue-anmeldung',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendNeueAnmeldungEmail(AN, { hof: true, name: 'Franz Müller', geraet: 'Windows · Edge', zeitpunkt: ZEIT, link: `${HOF_URL}/sicherheit?token=${TOKEN}` }),
    inhalt: (e) => e.neueAnmeldungInhalt({ hof: true, name: 'Franz Müller', geraet: 'Windows · Edge', zeitpunkt: ZEIT, link: `${HOF_URL}/sicherheit?token=${TOKEN}` }),
  },
  {
    kennung: 'admin-einrichtungscode',
    art: 'admin-sicherheit',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendAdminSicherheitEmail(AN, 'einrichtungscode', { geraet: 'Laptop · Chrome', zeitpunkt: ZEIT, code: CODE }),
    inhalt: (e) => e.adminSicherheitInhalt({ anlass: 'einrichtungscode', geraet: 'Laptop · Chrome', zeitpunkt: ZEIT, code: CODE }),
  },
  {
    kennung: 'admin-passkey-entfernt',
    art: 'admin-sicherheit',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendAdminSicherheitEmail(AN, 'passkey-entfernt', { geraet: 'Laptop · Chrome', zeitpunkt: ZEIT }),
    inhalt: (e) => e.adminSicherheitInhalt({ anlass: 'passkey-entfernt', geraet: 'Laptop · Chrome', zeitpunkt: ZEIT }),
  },
  {
    kennung: 'email-aendern-link',
    art: 'email-aendern-link',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendEmailAendernLink(AN, { hof: 'Hof Müller', link: `${HOF_URL}/konto/email?token=${TOKEN}` }),
    inhalt: (e) => e.emailAendernLinkInhalt({ hof: 'Hof Müller', link: `${HOF_URL}/konto/email?token=${TOKEN}` }),
  },
  {
    kennung: 'email-geaendert-hinweis',
    art: 'email-geaendert-hinweis',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendEmailGeaendertHinweis(AN, { hof: null, zeitpunkt: ZEIT, link: `${HOF_URL}/sicherheit?token=${TOKEN}` }),
    inhalt: (e) => e.emailGeaendertHinweisInhalt({ hof: null, zeitpunkt: ZEIT, link: `${HOF_URL}/sicherheit?token=${TOKEN}` }),
  },
  {
    kennung: 'team-recht-geaendert',
    art: 'team-recht-geaendert',
    fehlerweg: 'ergebnis',
    senden: (e) => e.sendTeamRechtGeaendert(AN, { anlass: 'eingeladen', name: 'Jonas Pichler', rechte: ['Höfe freischalten und betreuen', 'Startseite'] }),
    inhalt: (e) => e.teamRechtGeaendertInhalt({ anlass: 'eingeladen', name: 'Jonas Pichler', rechte: ['Höfe freischalten und betreuen', 'Startseite'] }),
  },
  { kennung: 'betreiber-bestaetigung', art: 'betreiber-bestaetigung', fehlerweg: 'ergebnis', senden: (e) => e.sendBetreiberBestaetigung(AN, TOKEN), inhalt: (e) => e.betreiberBestaetigungInhalt({ token: TOKEN }) },
  { kennung: 'betrieb-warnung', art: 'betrieb-warnung', fehlerweg: 'liste', senden: (e) => e.sendBetriebWarnung(warnung, [AN]), inhalt: (e) => e.betriebWarnungInhalt(warnung) },
]

const ORDNER = join(process.cwd(), 'tests/fixtures/mail-inhalt')

/** Die Vergleichsdatei mit den Werten von heute: Platzhalter zurück zu APP_URL, Domain und Marke. */
function vergleich(kennung: string): { betreff: string; html: string } {
  const ein = (t: string): string => t.replaceAll('{{APP_URL}}', APP_URL).replaceAll('{{DOMAIN}}', PRODUKTION_HOST).replaceAll('{{MARKE}}', MARKE)
  return { betreff: ein(readFileSync(join(ORDNER, `${kennung}.betreff.txt`), 'utf8')), html: ein(readFileSync(join(ORDNER, `${kennung}.html`), 'utf8')) }
}

const gleich = (a: string, b: string): boolean => Buffer.from(a, 'utf8').equals(Buffer.from(b, 'utf8'))

let konsole: Record<'log' | 'error' | 'warn', MockInstance>

beforeEach(() => {
  vi.clearAllMocks()
  kaputt.an = false
  // Nur Date: Die Promises der Vorlagen laufen weiter wie sonst.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(UHR)
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
  konsole = { log: vi.spyOn(console, 'log').mockImplementation(() => {}), error: vi.spyOn(console, 'error').mockImplementation(() => {}), warn: vi.spyOn(console, 'warn').mockImplementation(() => {}) }
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Byteweise wie vor Nr. 270 (Vergleichsdateien aus 30a60625)', () => {
  it.each(FAELLE)('$kennung: die Inhalts-Funktion liefert Betreff und HTML der Vergleichsdatei — ohne Log, ohne Versand', async (fall) => {
    const erwartet = vergleich(fall.kennung)

    const inhalt = await fall.inhalt(email)

    expect(gleich(inhalt.betreff, erwartet.betreff)).toBe(true)
    expect(gleich(inhalt.html, erwartet.html)).toBe(true)
    expect(Object.keys(inhalt).sort()).toEqual(['betreff', 'html'])
    expect(sendMock).not.toHaveBeenCalled()
    expect(konsole.log).not.toHaveBeenCalled()
    expect(konsole.error).not.toHaveBeenCalled()
  })

  it.each(FAELLE)('$kennung: der Versand gibt sendRaw genau einmal Betreff und HTML der Vergleichsdatei, mit Empfänger und Art', async (fall) => {
    const erwartet = vergleich(fall.kennung)

    await fall.senden(email)

    expect(sendMock).toHaveBeenCalledTimes(1)
    const gesendet = sendMock.mock.calls[0][0] as { to: string; subject: string; html: string }
    expect(gesendet.to).toBe(AN)
    expect(gleich(gesendet.subject, erwartet.betreff)).toBe(true)
    expect(gleich(gesendet.html, erwartet.html)).toBe(true)
    expect(protokoll.mock.calls.map((c) => (c[0] as { art: string }).art)).toEqual([fall.art])
  })

  it('Gegenprobe: ein Zeichen mehr im HTML fällt auf', async () => {
    const erwartet = vergleich('anmeldecode')
    const inhalt = await email.anmeldecodeInhalt({ code: CODE })
    expect(gleich(inhalt.html, erwartet.html)).toBe(true)
    expect(gleich(`${inhalt.html} `, erwartet.html)).toBe(false)
    expect(gleich(inhalt.betreff.replace(MARKE, 'X'), erwartet.betreff)).toBe(false)
  })
})

describe('Fehlerweg wie vor Nr. 270: die Vorlage wirft', () => {
  it.each(FAELLE)('$kennung: derselbe Ausgang, kein Versand, und die Inhalts-Funktion wirft ohne Log', async (fall) => {
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
    await expect(email.sendAnmeldeCodeEmail(AN, CODE)).resolves.toEqual({ id: 'email_1' })
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('eine leere Liste der Betrieb-Warnung baut gar nichts (wie vorher, vor der Vorlage)', async () => {
    kaputt.an = true
    await expect(email.sendBetriebWarnung(warnung, [])).resolves.toEqual({ gesendet: 0, gescheitert: 0 })
    expect(konsole.error).not.toHaveBeenCalled()
  })
})

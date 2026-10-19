/**
 * Code- und Passwort-Raten bremsen (Register E7, Ergänzung; Nr. 112) — die
 * Regeln aus src/lib/anmeldecode.ts und src/lib/bremse-datenbank.ts echt, die
 * Datenbank hinter src/server/bremse-datenbank.ts als kleiner Speicher im
 * Test (zählt wie das INSERT … ON CONFLICT, gibt zurück wie updateMany). Die echte
 * Bremse gegen Postgres samt Better-Auth-Hooks prüft
 * tests/integration/code-bremse.int.test.ts.
 *
 * Beweist:
 *  - 9 falsche Codes → noch erlaubt; der 10. pausiert bis zum Ende der
 *    Stunde, mit Uhrzeit in Wiener Zeit; im nächsten Fenster wieder frei.
 *  - Gezählt wird vorab (Nachbesserung Runde 2): Ein richtiger Versuch gibt
 *    zurück, eine Ablehnung wegen Pause auch — sie füllt das Tagesfenster nicht.
 *  - 30 falsche Codes am Tag pausieren bis zum Ende des Tagesfensters.
 *  - Eine Adresse, die es nicht gibt, zählt und pausiert genauso — nur ohne Mail.
 *  - Eine Mail je Pause (genau beim Vollwerden), beim Passwort höchstens eine am Tag.
 *  - FAIL-CLOSED: Fehler und Zeitlimit der Datenbank pausieren die zwei
 *    Code-Bremsen und `passwort-fehler`; die übrigen Bremsen lassen weiter durch.
 *  - Zurücksetzen löscht nur `passwort-fehler` dieser Adresse.
 *  - Quelltext: Prüfen vor der Rollenprüfung, die Ablehnung eines Hofs zählt,
 *    gezählt wird in hooks.after, `sendResetPassword` über nachDerAntwort.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const db = vi.hoisted(() => ({
  /** `${schluessel}|${fensterStart}` → Zähler */
  zeilen: new Map<string, number>(),
  kaputt: false as false | 'fehler' | 'haengt',
  konten: new Set<string>(),
}))
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))

/** Die Parameter des Tagged-Template-Aufrufs ($queryRaw`…${x}…`), flach. */
function sqlWerte(args: unknown[]): unknown[] {
  const flach: unknown[] = []
  const sammle = (wert: unknown): void => {
    if (wert && typeof wert === 'object' && 'values' in wert && Array.isArray((wert as { values: unknown[] }).values)) {
      for (const w of (wert as { values: unknown[] }).values) sammle(w)
    } else flach.push(wert)
  }
  for (const a of args.slice(1)) sammle(a)
  return flach
}

function stoerung(): Promise<never> | null {
  if (db.kaputt === 'fehler') return Promise.reject(new Error('Verbindung weg'))
  if (db.kaputt === 'haengt') return new Promise<never>(() => {})
  return null
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(async (...args: unknown[]) => {
      const fehler = stoerung()
      if (fehler) return fehler
      const werte = sqlWerte(args)
      const zeilen: Array<{ schluessel: string; zaehler: number }> = []
      for (let i = 0; i < werte.length; i++) {
        const w = werte[i]
        if (typeof w !== 'string') continue
        const start = werte[i + 1] as Date
        const id = `${w}|${start.getTime()}`
        const neu = (db.zeilen.get(id) ?? 0) + 1
        db.zeilen.set(id, neu)
        zeilen.push({ schluessel: w, zaehler: neu })
      }
      return zeilen
    }),
    rateLimitZaehler: {
      updateMany: vi.fn(
        async ({ where }: { where: { OR: Array<{ schluessel: string; fensterStart: Date }>; zaehler: { gte: number } } }) => {
          const fehler = stoerung()
          if (fehler) return fehler
          let count = 0
          for (const { schluessel, fensterStart } of where.OR) {
            const id = `${schluessel}|${fensterStart.getTime()}`
            const zaehler = db.zeilen.get(id)
            if (zaehler === undefined || zaehler < where.zaehler.gte) continue
            db.zeilen.set(id, zaehler - 1)
            count += 1
          }
          return { count }
        }
      ),
      deleteMany: vi.fn(async ({ where }: { where: { schluessel: string } }) => {
        let count = 0
        for (const id of [...db.zeilen.keys()]) {
          if (id.startsWith(`${where.schluessel}|`)) {
            db.zeilen.delete(id)
            count += 1
          }
        }
        return { count }
      }),
    },
    user: {
      findFirst: vi.fn(async ({ where }: { where: { email: { equals: string } } }) =>
        db.konten.has(where.email.equals) ? { email: where.email.equals } : null
      ),
    },
  },
}))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@/lib/email', () => ({ sendZuVieleVersucheEmail: vi.fn(async () => ({ id: 'mail-1' })) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { sendZuVieleVersucheEmail } from '@/lib/email'
import {
  FALSCHE_CODES_JE_STUNDE,
  FALSCHE_CODES_JE_TAG,
  FALSCHE_PASSWOERTER_JE_STUNDE,
  ZU_VIELE_FALSCHE_CODES,
  ZU_VIELE_FALSCHE_PASSWOERTER,
  anmeldeFehlerText,
  anmeldeFehlerVon,
  istFehlversuch,
  passwortZuVieleText,
  zuVieleFehlversucheAntwort,
} from '@/lib/anmeldecode'
import {
  DB_BREMSEN,
  DB_BREMSE_ZEITLIMIT_MS,
  FEHLVERSUCH_BREMSEN,
  bremsSchluessel,
  fehlversuchSperreBis,
  pauseBeginntBis,
} from '@/lib/bremse-datenbank'
import {
  bremseUeberAlleInstanzen,
  gibVersuchZurueck,
  loeschePasswortFehlversuche,
  neueBremsMeldungen,
  neuigkeitenGebremst,
  zaehleAlsFehlversuch,
  zaehleVersuchVorab,
  type FehlversuchVorab,
} from '@/server/bremse-datenbank'

const KUNDIN = 'kundin-112@example.com'
const UNBEKANNT = 'niemand-112@example.com'
// 14:20 in Wien (Sommerzeit endet erst am 25.10.) — mitten in der Stunde 12–13 UTC.
const JETZT = new Date('2026-10-19T12:20:00.000Z')
const STUNDE_MS = 60 * 60_000

async function arbeiteNachlaufAb(): Promise<void> {
  while (nachlauf.aufgaben.length > 0) await nachlauf.aufgaben.shift()!()
}

/** Gescheiterte Versuche, wie die Hooks sie abwickeln: vorab zählen, stehen lassen. */
async function falsch(art: 'code' | 'passwort', email: string, mal: number): Promise<void> {
  for (let i = 0; i < mal; i++) {
    const vorab = await zaehleVersuchVorab(art, email, new Date(), neueBremsMeldungen())
    if (!vorab.gesperrt) zaehleAlsFehlversuch(vorab.versuch)
  }
}

/** Ein Versuch, der stimmt: vorab zählen, zurückgeben — sagt, ob die Adresse pausiert war. */
async function pausiert(art: 'code' | 'passwort', email: string): Promise<{ gesperrt: false } | Extract<FehlversuchVorab, { gesperrt: true }>> {
  const vorab = await zaehleVersuchVorab(art, email, new Date(), neueBremsMeldungen())
  if (vorab.gesperrt) return vorab
  await gibVersuchZurueck(vorab.versuch)
  return { gesperrt: false }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(JETZT)
  db.zeilen.clear()
  db.kaputt = false
  db.konten = new Set([KUNDIN])
  nachlauf.aufgaben.length = 0
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Grenzen (Register E7, Ergänzung)', () => {
  it('Codes 10 je Stunde und 30 je Tag, Passwörter 10 je Stunde — je Adresse', () => {
    expect(DB_BREMSEN.codeFehlerStunde).toEqual({ zweck: 'code-fehler-stunde', max: 10, fensterMs: STUNDE_MS })
    expect(DB_BREMSEN.codeFehlerTag).toEqual({ zweck: 'code-fehler-tag', max: 30, fensterMs: 24 * STUNDE_MS })
    expect(DB_BREMSEN.passwortFehler).toEqual({ zweck: 'passwort-fehler', max: 10, fensterMs: STUNDE_MS })
    expect([FALSCHE_CODES_JE_STUNDE, FALSCHE_CODES_JE_TAG, FALSCHE_PASSWOERTER_JE_STUNDE]).toEqual([10, 30, 10])
    expect(FEHLVERSUCH_BREMSEN.code).toEqual([DB_BREMSEN.codeFehlerStunde, DB_BREMSEN.codeFehlerTag])
  })

  it('jeder gescheiterte Code zählt, beim Passwort nur „E-Mail oder Passwort falsch" — eine ungültige Adresse nicht', () => {
    for (const code of ['INVALID_OTP', 'OTP_EXPIRED', 'TOO_MANY_ATTEMPTS']) expect(istFehlversuch('code', code)).toBe(true)
    expect(istFehlversuch('passwort', 'INVALID_EMAIL_OR_PASSWORD')).toBe(true)
    expect(istFehlversuch('code', 'INVALID_EMAIL')).toBe(false)
    expect(istFehlversuch('passwort', 'INVALID_OTP')).toBe(false)
    expect(istFehlversuch('code', undefined)).toBe(false)
  })
})

describe('fehlversuchSperreBis / pauseBeginntBis — rein', () => {
  const [stunde, tag] = FEHLVERSUCH_BREMSEN.code

  it('9 → frei; 10 → bis zum Ende der Stunde; 30 am Tag → bis zum Ende des Tagesfensters', () => {
    expect(fehlversuchSperreBis([stunde, tag], [9, 9], JETZT)).toBeNull()
    expect(fehlversuchSperreBis([stunde, tag], [10, 10], JETZT)).toEqual(new Date('2026-10-19T13:00:00.000Z'))
    expect(fehlversuchSperreBis([stunde, tag], [3, 30], JETZT)).toEqual(new Date('2026-10-20T00:00:00.000Z'))
    // Beide voll: das spätere Ende.
    expect(fehlversuchSperreBis([stunde, tag], [10, 30], JETZT)).toEqual(new Date('2026-10-20T00:00:00.000Z'))
  })

  it('die Pause beginnt genau beim Vollwerden — davor und danach nicht (eine Mail je Pause)', () => {
    expect(pauseBeginntBis([stunde, tag], [9, 9], JETZT)).toBeNull()
    expect(pauseBeginntBis([stunde, tag], [10, 10], JETZT)).toEqual(new Date('2026-10-19T13:00:00.000Z'))
    expect(pauseBeginntBis([stunde, tag], [11, 11], JETZT)).toBeNull()
    expect(pauseBeginntBis([stunde, tag], [10, 30], JETZT)).toEqual(new Date('2026-10-20T00:00:00.000Z'))
  })
})

describe('Texte (Mockup system-h1, Schritt 7)', () => {
  it('Code: der Satz aus dem Mockup mit der Uhrzeit in Wiener Zeit', () => {
    const antwort = zuVieleFehlversucheAntwort('code', new Date('2026-10-19T13:40:00.000Z'), JETZT)
    expect(antwort).toEqual({
      code: ZU_VIELE_FALSCHE_CODES,
      pauseBis: '15:40',
      message:
        'Zu viele falsche Codes. Die Anmeldung mit Code ist für diese Adresse bis 15:40 pausiert. Wir haben dir eine E-Mail geschickt.',
    })
  })

  it('Code: endet die Pause erst morgen, steht der Tag dabei', () => {
    expect(zuVieleFehlversucheAntwort('code', new Date('2026-10-20T00:00:00.000Z'), JETZT).pauseBis).toBe('morgen um 02:00')
  })

  it('Passwort: der Satz aus der Freigabe, mit Ausweg „Passwort zurücksetzen"', () => {
    const antwort = zuVieleFehlversucheAntwort('passwort', new Date('2026-10-19T13:00:00.000Z'), JETZT)
    expect(antwort.code).toBe(ZU_VIELE_FALSCHE_PASSWOERTER)
    expect(antwort.message).toBe('Zu viele Versuche – versuch es nach 15:00 wieder oder setz dein Passwort zurück.')
  })

  it('das Formular baut aus Code und Uhrzeit denselben Satz; ohne Uhrzeit (fail-closed) der Satz ohne Uhrzeit', () => {
    const fehler = anmeldeFehlerVon({ code: ZU_VIELE_FALSCHE_CODES, status: 429, pauseBis: '15:40' })
    expect(anmeldeFehlerText(fehler, 'pruefen')).toContain('bis 15:40 pausiert')
    expect(anmeldeFehlerText(anmeldeFehlerVon({ status: 429 }), 'pruefen')).toMatch(/^Das waren gerade zu viele Versuche/)
    expect(anmeldeFehlerVon({ code: ZU_VIELE_FALSCHE_CODES, pauseBis: 42 }).pauseBis).toBeUndefined()
    expect(passwortZuVieleText({ code: ZU_VIELE_FALSCHE_PASSWOERTER, status: 429, pauseBis: '15:00' })).toContain('nach 15:00')
    expect(passwortZuVieleText({ status: 429 })).toMatch(/zu viele Versuche/)
    expect(passwortZuVieleText({ code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 })).toBeNull()
  })
})

describe('falsche Codes je Adresse — zählen und pausieren', () => {
  it('9 falsche Codes → noch erlaubt, der 10. → pausiert bis zum Ende der Stunde', async () => {
    await falsch('code', KUNDIN, 9)
    expect(await pausiert('code', KUNDIN)).toEqual({ gesperrt: false })

    await falsch('code', KUNDIN, 1)
    expect(await pausiert('code', KUNDIN)).toEqual({ gesperrt: true, bis: new Date('2026-10-19T13:00:00.000Z') })

    // Ab der nächsten Stunde wieder frei (festes Fenster).
    vi.setSystemTime(new Date('2026-10-19T13:00:00.000Z'))
    expect(await pausiert('code', KUNDIN)).toEqual({ gesperrt: false })
  })

  it('30 falsche Codes am Tag → pausiert bis zum Ende des Tagesfensters, auch in einer neuen Stunde', async () => {
    for (const stunde of ['09', '10', '11']) {
      vi.setSystemTime(new Date(`2026-10-19T${stunde}:30:00.000Z`))
      await falsch('code', KUNDIN, 10)
    }
    vi.setSystemTime(new Date('2026-10-19T12:05:00.000Z'))
    expect(await pausiert('code', KUNDIN)).toEqual({ gesperrt: true, bis: new Date('2026-10-20T00:00:00.000Z') })
  })

  it('eine Adresse, die es nicht gibt, zählt und pausiert genauso — nur ohne Mail', async () => {
    await falsch('code', UNBEKANNT, 10)
    await falsch('code', KUNDIN, 10)
    expect(await pausiert('code', UNBEKANNT)).toEqual(await pausiert('code', KUNDIN))

    await arbeiteNachlaufAb()
    expect(vi.mocked(sendZuVieleVersucheEmail).mock.calls).toEqual([
      [KUNDIN, 'code', new Date('2026-10-19T13:00:00.000Z')],
    ])
  })

  it('zählt ohne Rand und klein — „ Kundin-112@…" ist dieselbe Adresse', async () => {
    await falsch('code', KUNDIN, 9)
    await falsch('code', ' Kundin-112@Example.com', 1)
    expect((await pausiert('code', KUNDIN)).gesperrt).toBe(true)
  })

  it('eine Mail je Pause: weitere Fehlversuche in derselben Stunde schicken keine zweite, die nächste Pause wieder eine', async () => {
    await falsch('code', KUNDIN, 12)
    await arbeiteNachlaufAb()
    expect(sendZuVieleVersucheEmail).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-10-19T13:10:00.000Z'))
    await falsch('code', KUNDIN, 10)
    await arbeiteNachlaufAb()
    expect(sendZuVieleVersucheEmail).toHaveBeenCalledTimes(2)
  })

  it('ein richtiger Versuch gibt zurück: 9 falsch, richtig, noch 1 falsch — erst dann pausiert', async () => {
    await falsch('code', KUNDIN, 9)
    expect(await pausiert('code', KUNDIN)).toEqual({ gesperrt: false })
    expect(await pausiert('code', KUNDIN)).toEqual({ gesperrt: false })
    await falsch('code', KUNDIN, 1)
    expect((await pausiert('code', KUNDIN)).gesperrt).toBe(true)
  })

  it('eine Ablehnung wegen Pause gibt ihren Versuch zurück — sie füllt das Tagesfenster nicht', async () => {
    await falsch('code', KUNDIN, 10 + 25)
    vi.setSystemTime(new Date('2026-10-19T13:10:00.000Z'))
    // Zählten die 25 Ablehnungen mit, stünde das Tagesfenster bei 35.
    expect(await pausiert('code', KUNDIN)).toEqual({ gesperrt: false })
  })

  it('die Mail liegt nicht im Antwortpfad: Zählen stellt sie nur in den Nachlauf', async () => {
    await falsch('code', KUNDIN, 10)
    expect(sendZuVieleVersucheEmail).not.toHaveBeenCalled()
    expect(nachlauf.aufgaben).toHaveLength(1)
  })
})

describe('falsche Passwörter je Adresse', () => {
  it('10 → pausiert bis zum Ende der Stunde; Mail höchstens eine am Tag', async () => {
    await falsch('passwort', KUNDIN, 10)
    expect(await pausiert('passwort', KUNDIN)).toEqual({ gesperrt: true, bis: new Date('2026-10-19T13:00:00.000Z') })
    // Codes zählen getrennt.
    expect(await pausiert('code', KUNDIN)).toEqual({ gesperrt: false })

    vi.setSystemTime(new Date('2026-10-19T13:30:00.000Z'))
    await falsch('passwort', KUNDIN, 10)
    await arbeiteNachlaufAb()
    expect(vi.mocked(sendZuVieleVersucheEmail).mock.calls).toEqual([
      [KUNDIN, 'passwort', new Date('2026-10-19T13:00:00.000Z')],
    ])
  })

  it('erfolgreiches Zurücksetzen löscht nur `passwort-fehler` dieser Adresse', async () => {
    await falsch('passwort', KUNDIN, 10)
    await falsch('passwort', UNBEKANNT, 10)
    await falsch('code', KUNDIN, 10)

    await loeschePasswortFehlversuche(KUNDIN)

    expect(await pausiert('passwort', KUNDIN)).toEqual({ gesperrt: false })
    expect((await pausiert('passwort', UNBEKANNT)).gesperrt).toBe(true)
    expect((await pausiert('code', KUNDIN)).gesperrt).toBe(true)
  })
})

describe('FAIL-CLOSED nur für die neuen Bremsen', () => {
  it('Datenbankfehler: Code und Passwort pausiert (ohne Uhrzeit), die übrigen Bremsen lassen durch', async () => {
    db.kaputt = 'fehler'
    const meldungen = neueBremsMeldungen()

    expect(await zaehleVersuchVorab('code', KUNDIN, new Date(), meldungen)).toEqual({ gesperrt: true, bis: null })
    expect(await zaehleVersuchVorab('passwort', KUNDIN, new Date(), meldungen)).toEqual({ gesperrt: true, bis: null })
    // Bestehende Bremsen: fail-open wie bisher.
    expect(await bremseUeberAlleInstanzen([{ bremse: DB_BREMSEN.meldungIp, merkmal: '203.0.113.7' }], new Date(), meldungen)).toBe(true)
    expect(await neuigkeitenGebremst('bestellung-1')).toBe(false)
  })

  it('Zeitlimit: eine hängende Datenbank pausiert, statt ungezählt raten zu lassen', async () => {
    db.kaputt = 'haengt'
    const ergebnis = zaehleVersuchVorab('passwort', KUNDIN, new Date(), neueBremsMeldungen())
    await vi.advanceTimersByTimeAsync(DB_BREMSE_ZEITLIMIT_MS)
    expect(await ergebnis).toEqual({ gesperrt: true, bis: null })
  })

  it('Sentry erfährt es gedrosselt, ohne Adresse oder Schlüssel', async () => {
    db.kaputt = 'fehler'
    const meldungen = neueBremsMeldungen()
    await zaehleVersuchVorab('code', KUNDIN, new Date(), meldungen)
    await zaehleVersuchVorab('passwort', KUNDIN, new Date(), meldungen)

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const gesendet = JSON.stringify(vi.mocked(Sentry.captureException).mock.calls)
    expect(gesendet).toContain('code-fehler-stunde')
    expect(gesendet).not.toContain('kundin')
    expect(gesendet).not.toContain(bremsSchluessel(process.env.BETTER_AUTH_SECRET!, 'code-fehler-stunde', KUNDIN))
  })

  it('Zählen scheitert: pausiert, keine Mail', async () => {
    db.kaputt = 'fehler'
    await falsch('code', KUNDIN, 10)
    expect(nachlauf.aufgaben).toHaveLength(0)
  })

  it('Zurückgeben scheitert: wirft nicht — der Versuch bleibt gezählt, zur sicheren Seite', async () => {
    const vorab = await zaehleVersuchVorab('passwort', KUNDIN, new Date(), neueBremsMeldungen())
    if (vorab.gesperrt) throw new Error('unerwartet pausiert')
    db.kaputt = 'fehler'
    await expect(gibVersuchZurueck(vorab.versuch, neueBremsMeldungen())).resolves.toBeUndefined()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })
})

describe('Quelltext: Hooks in auth.ts', () => {
  const auth = readFileSync(join(process.cwd(), 'src', 'lib', 'auth.ts'), 'utf8')
  const vorher = auth.slice(auth.indexOf('before: createAuthMiddleware'), auth.indexOf('after: createAuthMiddleware'))
  const nachher = auth.slice(auth.indexOf('after: createAuthMiddleware'))
  /** Der before-Abschnitt eines Pfads bis zum nächsten `if (ctx.path`. */
  function abschnitt(pfad: string): string {
    const start = vorher.indexOf(`if (ctx.path === '${pfad}')`)
    if (start < 0) return ''
    const ende = vorher.indexOf('if (ctx.path', start + 1)
    return vorher.slice(start, ende < 0 ? undefined : ende)
  }
  function inReihenfolge(text: string, stellen: string[]): boolean {
    let ab = 0
    for (const stelle of stellen) {
      const i = text.indexOf(stelle, ab)
      if (i < 0) return false
      ab = i + stelle.length
    }
    return true
  }

  it('Code: erst pausiert?, dann die Rolle — die Ablehnung eines Hofs zählt wie ein falscher Code', () => {
    expect(
      inReihenfolge(abschnitt('/sign-in/email-otp'), [
        "await zaehleVersuchVorab('code', body.email)",
        "throw zuVieleFehlversucheFehler('code'",
        'rolleZurAdresse(adresseWieDasPlugin(body.email))',
        'zaehleAlsFehlversuch(vorab.versuch)',
        'throw falscherCodeFehler()',
        'vorabGezaehlt.set(ctx.context, vorab.versuch)',
      ])
    ).toBe(true)
  })

  it('Gegenprobe: vertauscht fällt es auf', () => {
    expect(inReihenfolge(abschnitt('/sign-in/email-otp'), ['rolleZurAdresse(', "zaehleVersuchVorab('code'"])).toBe(false)
  })

  it('Passwort: vorab gezählt vor dem Endpunkt; hooks.after lässt den Fehlversuch stehen oder gibt zurück', () => {
    expect(
      inReihenfolge(abschnitt('/sign-in/email'), [
        "await zaehleVersuchVorab('passwort', body.email)",
        "throw zuVieleFehlversucheFehler('passwort'",
        'vorabGezaehlt.set(ctx.context, vorab.versuch)',
      ])
    ).toBe(true)
    expect(abschnitt('/reset-password')).toContain('adresseBeimZuruecksetzen.set(ctx.context')
    expect(
      inReihenfolge(nachher, [
        'vorabGezaehlt.get(ctx.context)',
        'istFehlversuch(versuch.art, antwort.body?.code)',
        'await gibVersuchZurueck(versuch)',
        'zaehleAlsFehlversuch(versuch)',
      ])
    ).toBe(true)
    expect(nachher).toContain('await loeschePasswortFehlversuche(email)')
  })

  it('sendResetPassword verschickt über nachDerAntwort — gleiche Antwortzeit für bekannte und unbekannte Adressen', () => {
    const block = auth.slice(auth.indexOf('sendResetPassword:'), auth.indexOf('emailVerification:'))
    expect(block).toContain('nachDerAntwort(async () => {')
    expect(block.indexOf('nachDerAntwort(')).toBeLessThan(block.indexOf('sendPasswordResetEmail('))
    // Gegenprobe: die Suche schlägt an
    expect(auth.indexOf('sendResetPassword:')).toBeGreaterThan(0)
  })
})

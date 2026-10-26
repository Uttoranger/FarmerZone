/**
 * Code- und Passwort-Raten bremsen (Register E7, Ergänzung; Nr. 112) gegen ein
 * ECHTES Postgres: Better Auth mit den Hooks aus src/lib/auth.ts, die Tabelle
 * `RateLimitZaehler` ist die Aussage. Die Bremse ist die echte — sie gilt in
 * jeder Umgebung (Merkmal Adresse, keine IP), es gibt keinen Schalter.
 *
 * Beweist:
 *  - 9 falsche Codes über drei Codes → der 10. Versuch wird noch geprüft; danach
 *    429 mit dem Satz und der Uhrzeit, auch für den richtigen Code; EINE Mail
 *    „Zu viele falsche Codes", erst nach der Antwort, ohne Code.
 *  - Eine Adresse, die es nicht gibt, und eine Hof-Adresse antworten genauso
 *    (Antwort, Status, Zählung) — nur ohne Mail bzw. mit Mail an den Hof.
 *  - Hof, Kundin und unbekannte Adresse fordern je einen Code an: Über HTTP
 *    ist die Antwortfolge gleich (Status, Körper), auch für einen zu oft
 *    probierten und einen abgelaufenen Code — sonst verriete der 6. Versuch,
 *    welche Adresse ein Hof ist (ein Hof bekommt nie einen Code).
 *  - Anmeldung und „Bestellungen finden" zählen zusammen; ein richtiger Code
 *    bzw. ein richtiges Passwort zählt nicht.
 *  - Gleichzeitig: Von 20 falschen Codes bzw. Passwörtern werden genau 10
 *    geprüft — gezählt wird VOR dem Prüfen (Nachbesserung Runde 2). Der
 *    Zählerstand danach ist mindestens 10; „genau 10“ gilt nur nacheinander.
 *    Ein Wackler (einmal 11 im ganzen Lauf) ist OFFEN, siehe den Fall selbst.
 *  - 30 falsche Codes am Tag pausieren bis zum Ende des Tagesfensters.
 *  - Passwort: 10 falsch → 429 mit Satz; „Passwort vergessen" geht weiter, ein
 *    erfolgreiches Zurücksetzen löscht den Zähler, das neue Passwort meldet an.
 *  - In der Tabelle steht keine Adresse, nur Zweck + HMAC.
 *
 * Feste Uhr (nur `Date`): Die Fenster sind fest — über eine Stundengrenze
 * hinweg zählte ein Test sonst in zwei Fenster. Sie steht auf einem festen Tag
 * in der Vergangenheit (14.10.2026) und rückt nur in festen Schritten
 * (`vi.advanceTimersByTime`): Better Auth räumt beim Lesen abgelaufene
 * Verification-Zeilen weg, nach seiner Uhr — eine Uhr in der Zukunft löschte
 * in der geteilten Test-Datenbank Codes, die noch gelten. Dieselben Tage jeden
 * Lauf, nichts hängt mehr an der echten Uhr (Wache `integration-uhr-wache`).
 * Aufräumen: Zählerzeilen über ihre Schlüssel, Codes
 * über `otp-int-`, Konten über `raeumeAuf`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { DB_BREMSEN, bremsSchluessel } from '@/lib/bremse-datenbank'
import { ZU_VIELE_FALSCHE_CODES, ZU_VIELE_FALSCHE_PASSWOERTER } from '@/lib/anmeldecode'
import { uhrzeitInWien } from '@/lib/fristen'
import { zaehleAlsFehlversuch, zaehleVersuchVorab } from '@/server/bremse-datenbank'
import { legeBestellCodeAn, pruefeBestellCode } from '@/server/bestellungen-finden'
import { intKennung, raeumeAuf } from './setup/basis'

const post = vi.hoisted(() => ({
  codes: [] as Array<{ email: string; code: string }>,
  reset: [] as Array<{ email: string; url: string }>,
  warnungen: [] as Array<{ email: string; art: string; bis: Date }>,
}))
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendAnmeldeCodeEmail: vi.fn(async (email: string, code: string) => {
    post.codes.push({ email, code })
    return { id: 'int-mail' }
  }),
  sendPasswordResetEmail: vi.fn(async (email: string, url: string) => {
    post.reset.push({ email, url })
  }),
  sendZuVieleVersucheEmail: vi.fn(async (email: string, art: string, bis: Date) => {
    post.warnungen.push({ email, art, bis })
    return { id: 'int-mail' }
  }),
  sendMagicLinkEmail: vi.fn(),
}))

import { auth } from '@/lib/auth'

// Feste Zeitpunkte in der Vergangenheit (Nr. 127, Regelvorschlag 121; vorher „gestern“ aus der echten Uhr):
// mitten in der Stunde 09–10 UTC am 14.10.2026, vor dem Stichtag der Uhr-Wache. Das Tagesfenster endet am 15.10. um 0 Uhr UTC.
const TAG = '2026-10-14'
const FEST = new Date('2026-10-14T09:20:00.000Z')
const STUNDENENDE = new Date('2026-10-14T10:00:00.000Z')
const TAGESENDE = new Date('2026-10-15T00:00:00.000Z')
const BIS = uhrzeitInWien(STUNDENENDE)
const adressen: string[] = []

function neueAdresse(was = 'kundin'): string {
  const email = `${intKennung(was)}@example.com`
  adressen.push(email)
  return email
}

async function arbeiteNachlaufAb(): Promise<void> {
  while (nachlauf.aufgaben.length > 0) await nachlauf.aufgaben.shift()!()
}

type Ergebnis = { ok: true } | { ok: false; status: number; code?: string; pauseBis?: string; message?: string }

async function mitCode(email: string, otp: string): Promise<Ergebnis> {
  try {
    await auth.api.signInEmailOTP({ body: { email, otp } })
    return { ok: true }
  } catch (e) {
    const f = e as { statusCode: number; body?: { code?: string; pauseBis?: string; message?: string } }
    return { ok: false, status: f.statusCode, code: f.body?.code, pauseBis: f.body?.pauseBis, message: f.body?.message }
  }
}

async function mitPasswort(email: string, password: string): Promise<Ergebnis> {
  try {
    await auth.api.signInEmail({ body: { email, password } })
    return { ok: true }
  } catch (e) {
    const f = e as { statusCode: number; body?: { code?: string; pauseBis?: string; message?: string } }
    return { ok: false, status: f.statusCode, code: f.body?.code, pauseBis: f.body?.pauseBis, message: f.body?.message }
  }
}

/** Fordert einen Code an; `null`, wenn keiner hinausging (ein Hof bekommt nie einen). */
async function fordereAn(email: string): Promise<string | null> {
  // Die Uhr steht: Ohne Schritt trügen alter und neuer Code dieselbe
  // Anlagezeit, und Better Auth fände beim Prüfen womöglich den alten.
  // Ein fester Schritt von einer Sekunde (Wache: Zahl als Literal, nach einer festen Uhr in der Vergangenheit).
  vi.advanceTimersByTime(1_000)
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  await arbeiteNachlaufAb()
  return post.codes.findLast((c) => c.email === email)?.code ?? null
}

async function fordereCodeAn(email: string): Promise<string> {
  const code = await fordereAn(email)
  if (!code) throw new Error('Kein Code verschickt')
  return code
}

type HttpAntwort = { status: number; statusText: string; art: string | null; text: string }

/** Wie das Formular: über HTTP, also so, wie es von außen aussieht. */
async function mitCodeUeberHttp(email: string, otp: string): Promise<HttpAntwort> {
  const antwort = await auth.handler(
    new Request('http://localhost:3000/api/auth/sign-in/email-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ email, otp }),
    })
  )
  return { status: antwort.status, statusText: antwort.statusText, art: antwort.headers.get('content-type'), text: await antwort.text() }
}

const falscherCode = (richtig: string): string => (richtig === '000000' ? '111111' : '000000')

async function stand(zweck: string, email: string): Promise<number> {
  const zeilen = await prisma.rateLimitZaehler.findMany({ where: { schluessel: bremsSchluessel(env.BETTER_AUTH_SECRET, zweck, email) } })
  return zeilen.reduce((summe, z) => summe + z.zaehler, 0)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(FEST)
})

afterEach(async () => {
  vi.useRealTimers()
  post.codes.length = 0
  post.reset.length = 0
  post.warnungen.length = 0
  nachlauf.aufgaben.length = 0
  const zwecke = [
    DB_BREMSEN.codeFehlerStunde,
    DB_BREMSEN.codeFehlerTag,
    DB_BREMSEN.passwortFehler,
    DB_BREMSEN.codeFehlerMailStunde,
    DB_BREMSEN.codeFehlerMailTag,
    DB_BREMSEN.passwortFehlerMail,
  ].map((b) => b.zweck)
  await prisma.rateLimitZaehler.deleteMany({
    where: { schluessel: { in: adressen.flatMap((a) => zwecke.map((z) => bremsSchluessel(env.BETTER_AUTH_SECRET, z, a))) } },
  })
  adressen.length = 0
  await prisma.verification.deleteMany({ where: { identifier: { contains: 'otp-int-' } } })
  await raeumeAuf()
})

describe('falsche Codes je Adresse — über alle Codes', () => {
  it('9 falsche über drei Codes → der 10. wird noch geprüft; danach 429 mit Uhrzeit, auch für den richtigen Code; eine Mail', async () => {
    const email = neueAdresse()
    await prisma.user.create({ data: { id: intKennung('nutzer'), email, name: 'Max Mustermann', role: 'CUSTOMER', emailVerified: true } })

    for (let runde = 0; runde < 3; runde++) {
      const code = await fordereCodeAn(email)
      for (let i = 0; i < 3; i++) expect(await mitCode(email, falscherCode(code))).toMatchObject({ ok: false, code: 'INVALID_OTP' })
    }
    const letzter = await fordereCodeAn(email)
    expect(await mitCode(email, falscherCode(letzter))).toMatchObject({ ok: false, status: 400, code: 'INVALID_OTP' })
    expect(await stand(DB_BREMSEN.codeFehlerStunde.zweck, email)).toBe(10)

    // Ab dem 11. Versuch: pausiert, der Code wird nicht geprüft — auch der richtige nicht.
    expect(await mitCode(email, letzter)).toEqual({
      ok: false,
      status: 429,
      code: ZU_VIELE_FALSCHE_CODES,
      pauseBis: BIS,
      message: `Zu viele falsche Codes. Die Anmeldung mit Code ist für diese Adresse bis ${BIS} pausiert. Wir haben dir eine E-Mail geschickt.`,
    })
    expect(await prisma.session.count({ where: { user: { email } } })).toBe(0)
    expect(await stand(DB_BREMSEN.codeFehlerStunde.zweck, email)).toBe(10)

    // Die Mail erst nach der Antwort, genau eine, ohne Code.
    expect(post.warnungen).toHaveLength(0)
    await arbeiteNachlaufAb()
    expect(post.warnungen).toEqual([{ email, art: 'code', bis: STUNDENENDE }])

    // Nach dem Fenster: der Code (noch gültig) nimmt wieder an.
    vi.setSystemTime(STUNDENENDE)
    const neu = await fordereCodeAn(email)
    expect(await mitCode(email, neu)).toEqual({ ok: true })
  })

  it('ohne angeforderten Code: eine Adresse, die es nicht gibt, und eine Hof-Adresse antworten und zählen gleich', async () => {
    const unbekannt = neueAdresse('niemand')
    const hof = neueAdresse('hof')
    await prisma.user.create({ data: { id: intKennung('nutzer-farmer'), email: hof, name: 'Max Mustermann', role: 'FARMER', emailVerified: true } })

    const antworten: Record<string, Ergebnis[]> = { unbekannt: [], hof: [] }
    for (let i = 0; i < 11; i++) {
      antworten.unbekannt.push(await mitCode(unbekannt, '000000'))
      antworten.hof.push(await mitCode(hof, '000000'))
    }

    expect(antworten.hof).toEqual(antworten.unbekannt)
    expect(antworten.hof.slice(0, 10).every((a) => !a.ok && a.status === 400 && a.code === 'INVALID_OTP')).toBe(true)
    expect(antworten.hof[10]).toMatchObject({ ok: false, status: 429, code: ZU_VIELE_FALSCHE_CODES, pauseBis: BIS })
    expect(await stand(DB_BREMSEN.codeFehlerStunde.zweck, hof)).toBe(10)
    expect(await stand(DB_BREMSEN.codeFehlerStunde.zweck, unbekannt)).toBe(10)
    // Die abgelehnten Versuche füllen auch das Tagesfenster nicht (nacheinander gelingt jede Rückgabe – deterministisch).
    expect(await stand(DB_BREMSEN.codeFehlerTag.zweck, hof)).toBe(10)
    expect(await stand(DB_BREMSEN.codeFehlerTag.zweck, unbekannt)).toBe(10)

    // Mail nur an das Konto, das es gibt — nie an eine unbekannte Adresse.
    await arbeiteNachlaufAb()
    expect(post.warnungen.map((w) => w.email)).toEqual([hof])
  })

  it('mit angefordertem Code: Hof, Kundin und unbekannte Adresse — über HTTP dieselbe Antwortfolge, auch zu oft probiert und abgelaufen', async () => {
    const adressenJeRolle = { kundin: neueAdresse('kundin'), hof: neueAdresse('hof'), unbekannt: neueAdresse('niemand') }
    await prisma.user.create({ data: { id: intKennung('nutzer'), email: adressenJeRolle.kundin, name: 'Max Mustermann', role: 'CUSTOMER', emailVerified: true } })
    await prisma.user.create({ data: { id: intKennung('nutzer-farmer'), email: adressenJeRolle.hof, name: 'Max Mustermann', role: 'FARMER', emailVerified: true } })

    const folgen: Record<string, HttpAntwort[]> = {}
    for (const [rolle, email] of Object.entries(adressenJeRolle)) {
      vi.setSystemTime(FEST)
      const folge: HttpAntwort[] = []
      // 7 falsche auf denselben Code — das Plugin gibt einen Code nach 5 auf.
      const erster = await fordereAn(email)
      for (let i = 0; i < 7; i++) folge.push(await mitCodeUeberHttp(email, falscherCode(erster ?? '')))
      // Ein neuer Code, der abläuft (er gilt 10 Minuten).
      const zweiter = await fordereAn(email)
      vi.advanceTimersByTime(11 * 60_000)
      folge.push(await mitCodeUeberHttp(email, falscherCode(zweiter ?? '')))
      // Bis in die Pause: 10 gezählt, der 11. pausiert.
      for (let i = 0; i < 3; i++) folge.push(await mitCodeUeberHttp(email, '000000'))
      folgen[rolle] = folge
    }

    expect(folgen.hof).toEqual(folgen.kundin)
    expect(folgen.unbekannt).toEqual(folgen.kundin)
    expect(folgen.kundin.slice(0, 10).every((a) => a.status === 400 && JSON.parse(a.text).code === 'INVALID_OTP')).toBe(true)
    expect(folgen.kundin[10]).toMatchObject({ status: 429 })
    expect(JSON.parse(folgen.kundin[10].text)).toMatchObject({ code: ZU_VIELE_FALSCHE_CODES, pauseBis: BIS })
    for (const email of Object.values(adressenJeRolle)) expect(await stand(DB_BREMSEN.codeFehlerStunde.zweck, email)).toBe(10)
  })

  it('Anmeldung und „Bestellungen finden" zählen zusammen: 5 + 5 pausieren beide', async () => {
    const email = neueAdresse()
    // Ein richtiger Code zählt nicht.
    expect(await pruefeBestellCode(email, await legeBestellCodeAn(email))).toEqual({ ok: true })
    expect(await stand(DB_BREMSEN.codeFehlerStunde.zweck, email)).toBe(0)
    const bestellCode = await legeBestellCodeAn(email)
    for (let i = 0; i < 5; i++) expect(await pruefeBestellCode(email, falscherCode(bestellCode))).toMatchObject({ ok: false })
    for (let i = 0; i < 5; i++) expect(await mitCode(email, '000000')).toMatchObject({ ok: false, code: 'INVALID_OTP' })

    expect(await mitCode(email, '000000')).toMatchObject({ ok: false, status: 429, code: ZU_VIELE_FALSCHE_CODES })
    const frisch = await legeBestellCodeAn(email)
    expect(await pruefeBestellCode(email, frisch)).toEqual({ ok: false, fehler: 'ZU_VIELE', bis: STUNDENENDE })
  })

  it('30 falsche Codes am Tag pausieren bis zum Ende des Tagesfensters, auch in einer neuen Stunde', async () => {
    const email = neueAdresse()
    for (const stunde of ['06', '07', '08']) {
      const zeit = new Date(`${TAG}T${stunde}:30:00.000Z`)
      for (let i = 0; i < 10; i++) {
        const vorab = await zaehleVersuchVorab('code', email, zeit)
        if (!vorab.gesperrt) zaehleAlsFehlversuch(vorab.versuch)
      }
    }

    expect(await zaehleVersuchVorab('code', email, FEST)).toEqual({ gesperrt: true, bis: TAGESENDE })
    expect(await stand(DB_BREMSEN.codeFehlerTag.zweck, email)).toBe(30)
    expect(await mitCode(email, '000000')).toMatchObject({ status: 429, pauseBis: `morgen um ${uhrzeitInWien(TAGESENDE)}` })
  })

  it('gleichzeitig: von 20 falschen Codes werden genau 10 geprüft — der Rest wird abgelehnt', async () => {
    // Gezählt wird VOR dem Prüfen (Nachbesserung Runde 2): Getrennt gelesen und
    // erst danach gezählt, sahen alle gleichzeitigen Versuche noch Stand 0.
    const email = neueAdresse('niemand')
    const ergebnisse = await Promise.all(Array.from({ length: 20 }, () => mitCode(email, '000000')))
    const geprueft = ergebnisse.filter((e) => !e.ok && e.code === 'INVALID_OTP').length
    expect(geprueft).toBe(10)
    expect(ergebnisse.filter((e) => !e.ok && e.status === 429)).toHaveLength(20 - geprueft)
    // Zugesichert ist nur, was in ALLEN Verschränkungen gilt (TESTING_GUIDELINES §1): zehn geprüft, der Rest abgelehnt,
    // und das Tagesfenster zählt mindestens die zehn geprüften Versuche. Eine Obergrenze steht absichtlich nicht da: Mehr
    // als 20 Versuche gab es nie, `toBeLessThanOrEqual(20)` konnte nicht rot werden und täuschte eine Prüfung nur vor.
    // OFFEN (Nr. 127, Runde 1): Der Wackler dieser Datei ist damit NICHT behoben, nur ehrlich benannt. Mit festen Tagen
    // stand das Tagesfenster einmal auf 11 statt 10, im ganzen Lauf, einzeln nie. VERMUTUNG, ohne Beleg: Die Rückgabe
    // eines abgelehnten Versuchs (gibVersuchZurueck in src/server/bremse-datenbank.ts) ist ein eigener Schreibvorgang und
    // scheitert unter Last; der Versuch bleibt dann gezählt, zur sicheren Seite. Gemessen hat das niemand. „Genau 10“
    // zeigt nur die ruhige Folge oben (11 nacheinander → Stand 10).
    const tag = await stand(DB_BREMSEN.codeFehlerTag.zweck, email)
    expect(tag).toBeGreaterThanOrEqual(10)
  })

  it('eine Mail je Pause: zwei Fehlversuche, die beide Stand 10 sehen, schicken genau eine (Drossel in der Datenbank)', async () => {
    // So kommt es dazu: Ein gleichzeitiger richtiger Versuch gibt seinen Zähler
    // zurück, der nächste Fehlversuch sieht wieder genau 10 (Nachbesserung Runde 3).
    const email = neueAdresse()
    await prisma.user.create({ data: { id: intKennung('nutzer'), email, name: 'Max Mustermann', role: 'CUSTOMER', emailVerified: true } })
    const vollGemacht = { art: 'code' as const, merkmal: email, staende: [10, 10], jetzt: FEST }
    zaehleAlsFehlversuch(vollGemacht)
    zaehleAlsFehlversuch({ ...vollGemacht })
    await arbeiteNachlaufAb()
    expect(post.warnungen).toEqual([{ email, art: 'code', bis: STUNDENENDE }])
    expect(await stand(DB_BREMSEN.codeFehlerMailStunde.zweck, email)).toBe(2)
  })

  it('in der Tabelle steht keine Adresse — nur Zweck und HMAC', async () => {
    const email = neueAdresse()
    await mitCode(email, '000000')
    const zeilen = await prisma.rateLimitZaehler.findMany({
      where: { schluessel: { startsWith: `${DB_BREMSEN.codeFehlerStunde.zweck}:` } },
      select: { schluessel: true },
    })
    expect(zeilen.length).toBeGreaterThan(0)
    for (const { schluessel } of zeilen) expect(schluessel).toMatch(/^code-fehler-stunde:[0-9a-f]{32}$/)
  })
})

describe('falsche Passwörter je Adresse', () => {
  it('10 falsch → 429 mit Satz; „Passwort vergessen" geht weiter, Zurücksetzen löscht den Zähler', async () => {
    const email = neueAdresse('bauer')
    await auth.api.signUpEmail({ body: { email, password: 'test-passwort-1234', name: 'Max Mustermann' } })

    for (let i = 0; i < 10; i++) expect(await mitPasswort(email, 'falsch-falsch')).toMatchObject({ ok: false, status: 401 })
    expect(await mitPasswort(email, 'test-passwort-1234')).toEqual({
      ok: false,
      status: 429,
      code: ZU_VIELE_FALSCHE_PASSWOERTER,
      pauseBis: BIS,
      message: `Zu viele Versuche – versuch es nach ${BIS} wieder oder setz dein Passwort zurück.`,
    })
    await arbeiteNachlaufAb()
    expect(post.warnungen).toEqual([{ email, art: 'passwort', bis: STUNDENENDE }])

    // „Passwort vergessen" bleibt offen — die Mail erst nach der Antwort.
    expect(await auth.api.requestPasswordReset({ body: { email } })).toMatchObject({ status: true })
    expect(post.reset).toHaveLength(0)
    await arbeiteNachlaufAb()
    const token = post.reset[0]?.url.match(/\/reset-password\/([^?]+)/)?.[1]
    expect(token).toBeTruthy()

    // Ein abgelehntes Zurücksetzen (zu kurz) löscht nichts.
    await expect(auth.api.resetPassword({ body: { newPassword: 'kurz', token: token! } })).rejects.toThrow()
    expect(await stand(DB_BREMSEN.passwortFehler.zweck, email)).toBe(10)

    await auth.api.resetPassword({ body: { newPassword: 'Neues-Passwort-5678', token: token! } })
    expect(await stand(DB_BREMSEN.passwortFehler.zweck, email)).toBe(0)
    expect(await mitPasswort(email, 'Neues-Passwort-5678')).toEqual({ ok: true })
  })

  it('gleichzeitig: von 20 falschen Passwörtern werden genau 10 geprüft (gezählt wird vor dem Prüfen)', async () => {
    const email = neueAdresse('bauer')
    await auth.api.signUpEmail({ body: { email, password: 'test-passwort-1234', name: 'Max Mustermann' } })

    const ergebnisse = await Promise.all(Array.from({ length: 20 }, () => mitPasswort(email, 'falsch-falsch')))
    const geprueft = ergebnisse.filter((e) => !e.ok && e.status === 401).length
    expect(geprueft).toBe(10)
    expect(ergebnisse.filter((e) => !e.ok && e.status === 429)).toHaveLength(20 - geprueft)
    // Wie bei den Codes: mindestens die zehn geprüften, keine Obergrenze; der Wackler (11 statt 10) ist offen (s. o.).
    const stand10 = await stand(DB_BREMSEN.passwortFehler.zweck, email)
    expect(stand10).toBeGreaterThanOrEqual(10)
  })

  it('ein richtiges Passwort zählt nicht: 9 falsch, richtig, noch 1 falsch — erst dann pausiert', async () => {
    const email = neueAdresse('bauer')
    await auth.api.signUpEmail({ body: { email, password: 'test-passwort-1234', name: 'Max Mustermann' } })

    for (let i = 0; i < 9; i++) expect(await mitPasswort(email, 'falsch-falsch')).toMatchObject({ ok: false, status: 401 })
    expect(await mitPasswort(email, 'test-passwort-1234')).toEqual({ ok: true })
    expect(await stand(DB_BREMSEN.passwortFehler.zweck, email)).toBe(9)
    expect(await mitPasswort(email, 'falsch-falsch')).toMatchObject({ ok: false, status: 401 })
    expect(await mitPasswort(email, 'test-passwort-1234')).toMatchObject({ ok: false, status: 429 })
  })

  it('„Passwort vergessen" antwortet für eine unbekannte Adresse genauso — und schickt nichts', async () => {
    const bekannt = neueAdresse('bauer')
    const unbekannt = neueAdresse('niemand')
    await auth.api.signUpEmail({ body: { email: bekannt, password: 'test-passwort-1234', name: 'Max Mustermann' } })

    const a = await auth.api.requestPasswordReset({ body: { email: bekannt } })
    const b = await auth.api.requestPasswordReset({ body: { email: unbekannt } })
    expect(a).toEqual(b)
    await arbeiteNachlaufAb()
    expect(post.reset.map((r) => r.email)).toEqual([bekannt])
  })

  it('eine unbekannte Adresse pausiert nach 10 falschen Passwörtern genauso', async () => {
    const email = neueAdresse('niemand')
    for (let i = 0; i < 10; i++) expect(await mitPasswort(email, 'falsch-falsch')).toMatchObject({ ok: false, status: 401 })
    expect(await mitPasswort(email, 'falsch-falsch')).toMatchObject({ status: 429, code: ZU_VIELE_FALSCHE_PASSWOERTER })
    await arbeiteNachlaufAb()
    expect(post.warnungen).toHaveLength(0)
  })
})

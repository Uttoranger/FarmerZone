/**
 * Anmeldecode gegen ein ECHTES Postgres (E7, S4, Nr. 08): Better Auth mit dem
 * emailOTP-Plugin aus src/lib/auth.ts, die Verification-Tabelle ist die
 * Aussage.
 *
 * Beweist:
 *  - Ein angeforderter Code liegt nur gehasht in der Datenbank, mit Zähler 0
 *    und 10 Minuten Laufzeit.
 *  - Falsche Versuche werden IN DER DATENBANK gezählt — eine zweite, frisch
 *    geladene Auth-Instanz (wie eine zweite Serverless-Instanz) sieht
 *    dieselbe Zahl; nach 5 Fehlversuchen nimmt auch der richtige Code nicht
 *    mehr an.
 *  - Der richtige Code meldet an, genau einmal.
 *  - Ein abgelaufener Code nimmt nicht an (Frist beim Lesen, nicht per Cron).
 *  - Ein Hof oder Admin bekommt keinen Code: Es entsteht gar keine
 *    Code-Zeile, auch nicht bei anderer Groß-/Kleinschreibung der Adresse
 *    (E7: Höfe bleiben bei Passwort) — und die Antwort ist dieselbe wie bei
 *    einer Kundin.
 *  - Selbst mit einem gültigen Code (serverseitig angelegt, wie ein Code aus
 *    der Zeit vor der Nachbesserung) meldet /sign-in/email-otp keinen Hof und
 *    keinen Admin an — Antwort wie bei falschem Code, das Passwort bleibt.
 *  - Die Mail geht erst nach der Antwort raus (nachDerAntwort), damit die
 *    Antwortzeit nicht verrät, ob hinter einer Adresse ein Hof steht.
 *  - Nur der Typ „sign-in" darf angefordert werden.
 *  - HTTP: Magic Links lassen sich nicht mehr anfordern, alte Links prüft
 *    der Endpunkt noch (Übergang); die ungenutzten Code-Pfade sind zu.
 *  - Die Rollenprüfung beim Anmelden fragt mit genau der Adresse, die das
 *    Plugin benutzt (JS-toLowerCase) — auch beim Kelvin-Zeichen U+212A, das
 *    JS zu „k" macht, eine reine C-Collation aber nicht (Nachbesserung 2).
 *  - Scheitert die Code-Mail im Nachlauf (Resend-Fehler, Datenbankfehler),
 *    erfährt Sentry es — ohne Adresse und ohne Code, und ohne dass der
 *    Nachlauf eine unbehandelte Ablehnung hinterlässt (Nachbesserung 2).
 *  - „_" und „%" in einer Adresse sind keine Platzhalter: Ein Hof mit
 *    „max_hof@…" wird nicht für die Kundin „max-hof@…" gehalten (die ein
 *    Angreifer bis Nr. 17a per Checkout anlegen konnte), bekommt keinen Code und wird nicht
 *    per Code angemeldet; die Kundin selbst schon (Nachbesserung 3).
 *  - Mehrere Konten in verschiedener Schreibweise: Ist eines davon ein Hof,
 *    gibt es keinen Code — nicht „irgendein" Treffer entscheidet.
 *  - Das Betreiber-Recht (isAdmin) zählt wie die Rolle ADMIN — auch bei
 *    Rolle CUSTOMER kein Code.
 *
 * Gegenprobe zur Zählung: Vor dem fünften Fehlversuch nimmt der richtige
 * Code noch an (eigener Test).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { sendAnmeldeCodeEmail } from '@/lib/email'
import { intKennung, raeumeAuf } from './setup/basis'

const versand = vi.hoisted(() => ({ codes: [] as Array<{ email: string; code: string }> }))
// Was nach der Antwort laufen soll, sammelt der Test und startet es selbst —
// so ist beweisbar, dass die Mail NICHT im Antwortpfad liegt.
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))

vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))

async function arbeiteNachlaufAb(): Promise<void> {
  while (nachlauf.aufgaben.length > 0) await nachlauf.aufgaben.shift()!()
}

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

vi.mock('@/lib/email', () => ({
  sendAnmeldeCodeEmail: vi.fn(async (email: string, code: string) => {
    versand.codes.push({ email, code })
    return { id: 'int-mail' }
  }),
  sendMagicLinkEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

type Auth = (typeof import('@/lib/auth'))['auth']

let instanzA: Auth
let instanzB: Auth

beforeAll(async () => {
  instanzA = (await import('@/lib/auth')).auth
  // Eine zweite, frisch geladene Instanz: eigener Speicher für Rate-Limits und
  // alles andere im Prozess — gemeinsam ist nur die Datenbank.
  vi.resetModules()
  instanzB = (await import('@/lib/auth')).auth
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.mocked(Sentry.captureException).mockClear()
  vi.mocked(Sentry.captureMessage).mockClear()
  versand.codes.length = 0
  nachlauf.aufgaben.length = 0
  await prisma.verification.deleteMany({ where: { identifier: { contains: 'otp-int-' } } })
  await raeumeAuf()
})

function neueAdresse(): string {
  return `${intKennung('kundin')}@example.com`
}

async function fordereCodeAn(auth: Auth, email: string): Promise<string> {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  await arbeiteNachlaufAb()
  const gesendet = versand.codes.findLast((c) => c.email === email)
  if (!gesendet) throw new Error('Kein Code verschickt')
  return gesendet.code
}

function falscherCode(richtig: string): string {
  return richtig === '000000' ? '111111' : '000000'
}

async function versuche(auth: Auth, email: string, otp: string): Promise<{ ok: true } | { ok: false; code: string }> {
  try {
    await auth.api.signInEmailOTP({ body: { email, otp } })
    return { ok: true }
  } catch (e) {
    const fehler = e as { body?: { code?: string } }
    return { ok: false, code: fehler.body?.code ?? 'UNBEKANNT' }
  }
}

async function zeile(email: string): Promise<{ value: string; expiresAt: Date }> {
  const gefunden = await prisma.verification.findFirst({ where: { identifier: `sign-in-otp-${email}` } })
  if (!gefunden) throw new Error('Keine Code-Zeile in der Datenbank')
  return gefunden
}

describe('Anmeldecode in der Datenbank', () => {
  it('liegt gehasht, mit Zähler 0 und 10 Minuten Laufzeit', async () => {
    const email = neueAdresse()
    const vorher = Date.now()
    const code = await fordereCodeAn(instanzA, email)

    const z = await zeile(email)
    expect(code).toMatch(/^\d{6}$/)
    expect(z.value).not.toContain(code)
    expect(z.value.endsWith(':0')).toBe(true)
    const laufzeit = z.expiresAt.getTime() - vorher
    expect(laufzeit).toBeGreaterThan(9 * 60_000)
    expect(laufzeit).toBeLessThanOrEqual(10 * 60_000 + 5_000)
  })

  it('zählt Fehlversuche über zwei Instanzen hinweg und sperrt nach dem fünften', async () => {
    const email = neueAdresse()
    const code = await fordereCodeAn(instanzA, email)
    const falsch = falscherCode(code)

    for (let i = 0; i < 3; i++) expect(await versuche(instanzA, email, falsch)).toEqual({ ok: false, code: 'INVALID_OTP' })
    for (let i = 0; i < 2; i++) expect(await versuche(instanzB, email, falsch)).toEqual({ ok: false, code: 'INVALID_OTP' })

    expect((await zeile(email)).value.endsWith(':5')).toBe(true)
    expect(await versuche(instanzB, email, code)).toEqual({ ok: false, code: 'TOO_MANY_ATTEMPTS' })
    expect(await prisma.session.count({ where: { user: { email } } })).toBe(0)
  })

  it('Gegenprobe: nach vier Fehlversuchen nimmt der richtige Code noch an — genau einmal', async () => {
    const email = neueAdresse()
    const code = await fordereCodeAn(instanzA, email)
    const falsch = falscherCode(code)
    for (let i = 0; i < 4; i++) await versuche(i % 2 ? instanzB : instanzA, email, falsch)

    expect(await versuche(instanzB, email, code)).toEqual({ ok: true })
    expect(await prisma.session.count({ where: { user: { email } } })).toBe(1)
    const kundin = await prisma.user.findUnique({ where: { email } })
    expect(kundin?.role).toBe('CUSTOMER')
    expect(kundin?.emailVerified).toBe(true)

    expect(await versuche(instanzA, email, code)).toEqual({ ok: false, code: 'INVALID_OTP' })
  })

  it('ein abgelaufener Code nimmt nicht an', async () => {
    const email = neueAdresse()
    const code = await fordereCodeAn(instanzA, email)
    await prisma.verification.updateMany({
      where: { identifier: `sign-in-otp-${email}` },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    })

    expect(await versuche(instanzA, email, code)).toEqual({ ok: false, code: 'OTP_EXPIRED' })
    expect(await prisma.session.count({ where: { user: { email } } })).toBe(0)
  })

  it('die Mail geht erst nach der Antwort raus', async () => {
    const email = neueAdresse()
    const antwort = await instanzA.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })

    expect(antwort).toEqual({ success: true })
    expect(versand.codes).toHaveLength(0)
    expect(nachlauf.aufgaben).toHaveLength(1)
    await arbeiteNachlaufAb()
    expect(versand.codes.filter((c) => c.email === email)).toHaveLength(1)
  })
})

describe('Höfe und Admins bekommen keinen Code und werden nicht per Code angemeldet', () => {
  async function legeNutzerAn(
    rolle: 'FARMER' | 'ADMIN' | 'CUSTOMER',
    optionen: { email?: string; emailVerified?: boolean; passwort?: boolean } = {}
  ): Promise<{ id: string; email: string }> {
    const id = intKennung(`nutzer-${rolle.toLowerCase()}`)
    const email = optionen.email ?? `${id}@example.com`
    await prisma.user.create({
      data: { id, email, name: 'Max Mustermann', role: rolle, emailVerified: optionen.emailVerified ?? true },
    })
    if (optionen.passwort) {
      await prisma.account.create({
        data: { id: `${id}-konto`, userId: id, accountId: id, providerId: 'credential', password: 'int-kein-echter-hash' },
      })
    }
    return { id, email }
  }

  async function codeZeilen(email: string): Promise<number> {
    return prisma.verification.count({ where: { identifier: `sign-in-otp-${email.toLowerCase()}` } })
  }

  for (const rolle of ['FARMER', 'ADMIN'] as const) {
    it(`${rolle}: Anfordern legt KEINEN Code ab, verschickt nichts und antwortet wie bei einer Kundin`, async () => {
      const { email } = await legeNutzerAn(rolle)

      const antwort = await instanzA.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
      await arbeiteNachlaufAb()

      expect(antwort).toEqual({ success: true })
      expect(await codeZeilen(email)).toBe(0)
      expect(versand.codes).toHaveLength(0)
    })

    it(`${rolle}: auch ein gültiger Code meldet nicht an — Fehler wie bei falschem Code, Passwort bleibt`, async () => {
      // emailVerified=false: Ohne Sperre entzöge Better Auth beim Treffer
      // das Passwort (revokeUnprovenAccountAccess).
      const { id, email } = await legeNutzerAn(rolle, { emailVerified: false, passwort: true })
      const code = await instanzA.api.createVerificationOTP({ body: { email, type: 'sign-in' } })

      expect(await versuche(instanzA, email, code)).toEqual({ ok: false, code: 'INVALID_OTP' })
      expect(await prisma.session.count({ where: { userId: id } })).toBe(0)
      expect(await prisma.account.count({ where: { userId: id, providerId: 'credential' } })).toBe(1)
      expect((await prisma.user.findUnique({ where: { id } }))?.emailVerified).toBe(false)
    })
  }

  it('Gegenprobe: eine Kundin mit demselben Aufbau wird angemeldet', async () => {
    const { id, email } = await legeNutzerAn('CUSTOMER', { emailVerified: false })
    const code = await instanzA.api.createVerificationOTP({ body: { email, type: 'sign-in' } })

    expect(await versuche(instanzA, email, code)).toEqual({ ok: true })
    expect(await prisma.session.count({ where: { userId: id } })).toBe(1)
  })

  it('Gegenprobe: eine Kundin fordert an — Code-Zeile da, Mail im Nachlauf', async () => {
    const { email } = await legeNutzerAn('CUSTOMER')
    await fordereCodeAn(instanzA, email)
    expect(await codeZeilen(email)).toBe(1)
  })

  it('ein Hof mit Großbuchstaben in der gespeicherten Adresse gilt nicht als „unbekannt"', async () => {
    const kennung = intKennung('hof-gross')
    const gespeichert = `${kennung}@Example.COM`
    const getippt = `${kennung}@example.com`
    const { id } = await legeNutzerAn('FARMER', { email: gespeichert })

    await instanzA.api.sendVerificationOTP({ body: { email: getippt, type: 'sign-in' } })
    await arbeiteNachlaufAb()
    expect(await codeZeilen(getippt)).toBe(0)
    expect(versand.codes).toHaveLength(0)

    const code = await instanzA.api.createVerificationOTP({ body: { email: getippt, type: 'sign-in' } })
    expect(await versuche(instanzA, getippt, code)).toEqual({ ok: false, code: 'INVALID_OTP' })
    // Kein zweites Konto (CUSTOMER) neben dem Hof, keine Sitzung.
    expect(await prisma.user.count({ where: { email: { equals: getippt, mode: 'insensitive' } } })).toBe(1)
    expect(await prisma.session.count({ where: { userId: id } })).toBe(0)
  })

  it('Kelvin-Zeichen (U+212A): Anmelden prüft die Adresse so, wie das Plugin sie liest', async () => {
    // Gespeichert mit „k", getippt mit dem Kelvin-Zeichen: JS macht daraus
    // „k" — das Plugin fände also den Hof. Eine Datenbank mit reiner
    // C-Collation faltet U+212A nicht; fragte der Hook mit der getippten
    // Form, hielte er den Hof für unbekannt und das Plugin meldete ihn an.
    const kennung = intKennung('hof-kelvin')
    const gespeichert = `${kennung}@example.com`
    const getippt = gespeichert.replace('k', '\u212A')
    expect(getippt.toLowerCase()).toBe(gespeichert)
    const { id } = await legeNutzerAn('FARMER', { email: gespeichert, emailVerified: false, passwort: true })
    const code = await instanzA.api.createVerificationOTP({ body: { email: getippt, type: 'sign-in' } })

    const suche = vi.spyOn(prisma.user, 'findMany')
    expect(await versuche(instanzA, getippt, code)).toEqual({ ok: false, code: 'INVALID_OTP' })
    // Unabhängig von der Collation dieser Test-Datenbank: Der Hook fragt mit
    // der klein geschriebenen Form, nicht mit der getippten.
    const gefragt = suche.mock.calls.map(([argumente]) => JSON.stringify(argumente?.where))
    expect(gefragt.some((w) => w.includes(gespeichert))).toBe(true)
    expect(gefragt.some((w) => w.includes('\u212A'))).toBe(false)
    expect(await prisma.session.count({ where: { userId: id } })).toBe(0)
    expect(await prisma.account.count({ where: { userId: id, providerId: 'credential' } })).toBe(1)
  })

  it('ein Code aus der Zeit vor der Nachbesserung verschwindet, sobald der Hof erneut anfordert', async () => {
    const { email } = await legeNutzerAn('FARMER')
    await instanzA.api.createVerificationOTP({ body: { email, type: 'sign-in' } })
    expect(await codeZeilen(email)).toBe(1)

    await instanzA.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
    expect(await codeZeilen(email)).toBe(0)
  })

  it('nur „sign-in" darf angefordert werden — kein Passwort-Zurücksetzen per Code', async () => {
    const email = neueAdresse()
    await expect(
      instanzA.api.sendVerificationOTP({ body: { email, type: 'forget-password' } })
    ).rejects.toMatchObject({ status: 'BAD_REQUEST' })
    expect(versand.codes).toHaveLength(0)
  })
})

describe('Platzhalter und mehrere Schreibweisen (Nachbesserung 3)', () => {
  // Die Kundin entsteht ZUERST: Ein findFirst ohne Reihenfolge lieferte dann
  // in der Regel ihre Zeile — genau der Angriff, bei dem der Hook die
  // Hof-Adresse für eine Kundin hielt.
  async function legeAn(rolle: 'FARMER' | 'CUSTOMER', email: string, hofZugang = false): Promise<string> {
    const id = intKennung(`platzhalter-${rolle.toLowerCase()}`)
    await prisma.user.create({
      data: { id, email, name: 'Max Mustermann', role: rolle, emailVerified: !hofZugang },
    })
    if (hofZugang) {
      await prisma.account.create({
        data: { id: `${id}-konto`, userId: id, accountId: id, providerId: 'credential', password: 'int-kein-echter-hash' },
      })
    }
    return id
  }

  async function codeZeilen(email: string): Promise<number> {
    return prisma.verification.count({ where: { identifier: `sign-in-otp-${email}` } })
  }

  async function pruefeKeinCodeFuerHof(hofAdresse: string, hofId: string): Promise<void> {
    // Eine Adresse mit „%" lehnt das Plugin beim Anfordern selbst ab
    // („Invalid email"); dann genügt: kein Code, keine Mail.
    const antwort = await instanzA.api
      .sendVerificationOTP({ body: { email: hofAdresse, type: 'sign-in' } })
      .catch((e: { body?: { code?: string } }) => ({ abgelehnt: e.body?.code }))
    await arbeiteNachlaufAb()
    if (hofAdresse.includes('%')) expect([{ success: true }, { abgelehnt: 'INVALID_EMAIL' }]).toContainEqual(antwort)
    else expect(antwort).toEqual({ success: true })
    expect(await codeZeilen(hofAdresse)).toBe(0)
    expect(versand.codes).toHaveLength(0)

    // Auch ein serverseitig angelegter, gültiger Code meldet den Hof nicht an.
    const code = await instanzA.api.createVerificationOTP({ body: { email: hofAdresse, type: 'sign-in' } })
    expect(await versuche(instanzA, hofAdresse, code)).toEqual({ ok: false, code: 'INVALID_OTP' })
    expect(await prisma.session.count({ where: { userId: hofId } })).toBe(0)
    expect(await prisma.account.count({ where: { userId: hofId, providerId: 'credential' } })).toBe(1)
    expect((await prisma.user.findUnique({ where: { id: hofId } }))?.emailVerified).toBe(false)
  }

  it('„_" ist kein Platzhalter: Hof „…_hof" neben Kundin „…-hof" bekommt keinen Code und wird nicht angemeldet', async () => {
    const kennung = intKennung('unterstrich')
    await legeAn('CUSTOMER', `${kennung}-hof@example.com`)
    const hofAdresse = `${kennung}_hof@example.com`
    const hofId = await legeAn('FARMER', hofAdresse, true)

    await pruefeKeinCodeFuerHof(hofAdresse, hofId)
  })

  it('Gegenprobe: die Kundin „…-hof" neben dem Hof „…_hof" bekommt ihren Code und wird angemeldet', async () => {
    const kennung = intKennung('unterstrich-gegen')
    const kundinAdresse = `${kennung}-hof@example.com`
    const kundinId = await legeAn('CUSTOMER', kundinAdresse)
    await legeAn('FARMER', `${kennung}_hof@example.com`, true)

    const code = await fordereCodeAn(instanzA, kundinAdresse)
    expect(await codeZeilen(kundinAdresse)).toBe(1)
    expect(await versuche(instanzA, kundinAdresse, code)).toEqual({ ok: true })
    expect(await prisma.session.count({ where: { userId: kundinId } })).toBe(1)
  })

  it('„%" ist kein Platzhalter: Hof „…%hof" neben Kundin „…-mein-hof" bekommt keinen Code und wird nicht angemeldet', async () => {
    const kennung = intKennung('prozent')
    await legeAn('CUSTOMER', `${kennung}-mein-hof@example.com`)
    const hofAdresse = `${kennung}%hof@example.com`
    const hofId = await legeAn('FARMER', hofAdresse, true)

    await pruefeKeinCodeFuerHof(hofAdresse, hofId)
  })

  it('„%" in der getippten Adresse trifft kein fremdes Konto — ein Hof „…x" bleibt unberührt', async () => {
    const kennung = intKennung('prozent-fremd')
    const hofId = await legeAn('FARMER', `${kennung}x@example.com`, true)
    const suche = vi.spyOn(prisma.user, 'findMany')

    await instanzA.api.sendVerificationOTP({ body: { email: `${kennung}%@example.com`, type: 'sign-in' } }).catch(() => {})
    await arbeiteNachlaufAb()

    // Der Hook hat das Hof-Konto nicht gefunden (es gibt kein Konto mit
    // genau dieser Adresse) — was das Plugin dann mit der Adresse macht,
    // betrifft den Hof nicht.
    const ergebnisse = await Promise.all(suche.mock.results.map((r) => r.value as Promise<Array<{ role: string }>>))
    expect(ergebnisse.length).toBeGreaterThan(0)
    for (const treffer of ergebnisse) expect(treffer).toEqual([])
    expect(await prisma.session.count({ where: { userId: hofId } })).toBe(0)
    expect(await prisma.account.count({ where: { userId: hofId, providerId: 'credential' } })).toBe(1)
  })

  it('Betreiber-Recht (isAdmin) bei Rolle CUSTOMER: kein Code, keine Anmeldung per Code', async () => {
    // /admin prüft isAdmin, nicht die Rolle — ein Betreiber ohne Hof kann
    // Rolle CUSTOMER tragen. Ein Code wäre der Weg in den Admin-Bereich.
    const id = intKennung('betreiber')
    const email = `${id}@example.com`
    await prisma.user.create({
      data: { id, email, name: 'Max Mustermann', role: 'CUSTOMER', isAdmin: true, emailVerified: true },
    })

    await instanzA.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
    await arbeiteNachlaufAb()
    expect(await codeZeilen(email)).toBe(0)
    expect(versand.codes).toHaveLength(0)

    const code = await instanzA.api.createVerificationOTP({ body: { email, type: 'sign-in' } })
    expect(await versuche(instanzA, email, code)).toEqual({ ok: false, code: 'INVALID_OTP' })
    expect(await prisma.session.count({ where: { userId: id } })).toBe(0)
  })

  it('zwei Schreibweisen derselben Adresse, Kundin UND Hof: kein Code', async () => {
    const kennung = intKennung('zwei-schreibweisen')
    const klein = `${kennung}@example.com`
    await legeAn('CUSTOMER', klein)
    await legeAn('FARMER', `${kennung}@EXAMPLE.com`)

    const antwort = await instanzA.api.sendVerificationOTP({ body: { email: klein, type: 'sign-in' } })
    await arbeiteNachlaufAb()

    expect(antwort).toEqual({ success: true })
    expect(await codeZeilen(klein)).toBe(0)
    expect(versand.codes).toHaveLength(0)

    const code = await instanzA.api.createVerificationOTP({ body: { email: klein, type: 'sign-in' } })
    expect(await versuche(instanzA, klein, code)).toEqual({ ok: false, code: 'INVALID_OTP' })
  })
})

describe('Scheitert die Code-Mail, erfährt es Sentry — ohne Adresse und Code', () => {
  function sentryAufrufe(): string {
    return JSON.stringify([
      vi.mocked(Sentry.captureException).mock.calls,
      vi.mocked(Sentry.captureMessage).mock.calls,
    ])
  }

  it('Resend meldet einen Fehler (sendRaw wirft nicht, gibt { error } zurück)', async () => {
    const email = neueAdresse()
    vi.mocked(sendAnmeldeCodeEmail).mockImplementationOnce(async (an: string, code: string) => {
      versand.codes.push({ email: an, code })
      return { error: `{"message":"Invalid to: ${an}","code":${code}}` }
    })
    await instanzA.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
    await arbeiteNachlaufAb()

    const code = versand.codes.findLast((c) => c.email === email)!.code
    expect(vi.mocked(Sentry.captureMessage).mock.calls.length + vi.mocked(Sentry.captureException).mock.calls.length).toBe(1)
    expect(sentryAufrufe()).not.toContain(email)
    expect(sentryAufrufe()).not.toContain(code)
  })

  it('die Datenbank fällt im Nachlauf aus — gemeldet, keine unbehandelte Ablehnung', async () => {
    const email = neueAdresse()
    await instanzA.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
    vi.spyOn(prisma.user, 'findMany').mockRejectedValueOnce(new Error(`Verbindung weg bei ${email}`))

    await expect(arbeiteNachlaufAb()).resolves.toBeUndefined()

    expect(versand.codes).toHaveLength(0)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(sentryAufrufe()).not.toContain(email)
  })

  it('Gegenprobe: geht die Mail raus, bleibt Sentry still', async () => {
    await fordereCodeAn(instanzA, neueAdresse())
    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })
})

describe('HTTP-Pfade', () => {
  const basis = 'http://localhost:3000/api/auth'
  const post = (pfad: string, body: object) =>
    instanzA.handler(
      new Request(`${basis}${pfad}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify(body),
      })
    )

  it('Magic Links lassen sich nicht mehr anfordern', async () => {
    const antwort = await post('/sign-in/magic-link', { email: neueAdresse() })
    expect(antwort.status).toBe(404)
  })

  it('alte Magic Links prüft der Endpunkt noch (Übergang), ungültige leiten mit Fehler weiter', async () => {
    const antwort = await instanzA.handler(
      new Request(`${basis}/magic-link/verify?token=int-ungueltig&callbackURL=%2Faccount%2Fprofile`)
    )
    expect(antwort.status).not.toBe(404)
  })

  it('ungenutzte Code-Pfade sind zu', async () => {
    for (const pfad of ['/email-otp/reset-password', '/forget-password/email-otp', '/email-otp/verify-email']) {
      expect((await post(pfad, { email: neueAdresse(), otp: '000000', password: 'x'.repeat(12) })).status, pfad).toBe(404)
    }
  })

  it('Gegenprobe: Code anfordern über HTTP geht', async () => {
    const email = neueAdresse()
    const antwort = await post('/email-otp/send-verification-otp', { email, type: 'sign-in' })
    expect(antwort.status).toBe(200)
    await arbeiteNachlaufAb()
    expect(versand.codes.some((c) => c.email === email)).toBe(true)
  })

  it('Hof und Kundin bekommen über HTTP dieselbe Antwort — beim Anfordern und beim Anmelden', async () => {
    const hof = `${intKennung('hof-http')}@example.com`
    await prisma.user.create({
      data: { id: intKennung('hof-http-nutzer'), email: hof, name: 'Max Mustermann', role: 'FARMER', emailVerified: true },
    })
    const kundin = neueAdresse()

    const anfordernHof = await post('/email-otp/send-verification-otp', { email: hof, type: 'sign-in' })
    const anfordernKundin = await post('/email-otp/send-verification-otp', { email: kundin, type: 'sign-in' })
    expect(anfordernHof.status).toBe(anfordernKundin.status)
    expect(await anfordernHof.json()).toEqual(await anfordernKundin.json())

    const codeHof = await instanzA.api.createVerificationOTP({ body: { email: hof, type: 'sign-in' } })
    await arbeiteNachlaufAb()
    const codeKundin = versand.codes.findLast((c) => c.email === kundin)!.code
    const anmeldenHof = await post('/sign-in/email-otp', { email: hof, otp: codeHof })
    const anmeldenKundinFalsch = await post('/sign-in/email-otp', { email: kundin, otp: falscherCode(codeKundin) })
    expect(anmeldenHof.status).toBe(400)
    expect(anmeldenHof.status).toBe(anmeldenKundinFalsch.status)
    expect(await anmeldenHof.json()).toEqual(await anmeldenKundinFalsch.json())
    expect(anmeldenHof.headers.get('set-cookie')).toBeNull()
  })
})

/**
 * Sicherheit am Handy (Nr. 178; Register S18) gegen ein echtes Postgres — Better Auth echt, der Zustand danach
 * ist die Aussage. Gemockt sind nur die Mails (Prüfstellen), Sentry, der Nachlauf (gesammelt, selbst
 * abgearbeitet) und der Request-Kontext der Actions.
 *
 * Beweist:
 *  - Höchstdauer: Eine 31 Tage alte Sitzung gilt nicht mehr — getSession gibt null, die Zeile ist gelöscht, über
 *    HTTP räumt die Antwort das Cookie ab. 29 Tage gilt (Gegenprobe). Ein Konto mit der Rolle ADMIN endet nach
 *    12 Stunden. Auch ein anderer Better-Auth-Weg (Passwort ändern) sieht eine zu alte Sitzung nicht (401).
 *  - Geräte für Kundinnen: Eine fremde Sitzung trifft 0 Zeilen und bleibt gültig; „Überall abmelden" beendet alle
 *    eigenen Sitzungen (auch diese) und keine fremde.
 *  - Passwortregeln auf dem Server: Ändern und Zurücksetzen mit schwachem Passwort → 400 mit der Meldung der
 *    Registrierung, nichts geändert, der Link bleibt gültig; ein starkes geht (Gegenprobe).
 *  - „Passwort vergessen" je Adresse: 5 in 15 Minuten, die 6. Anfrage 429 — für eine unbekannte Adresse genauso;
 *    eine andere Adresse bleibt frei.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const post = vi.hoisted(() => ({ reset: [] as Array<{ email: string; url: string }> }))
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
const anfrage = vi.hoisted(() => ({ headers: new Headers() }))

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => anfrage.headers }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@/lib/email', () => ({
  sendNeueAnmeldungEmail: vi.fn(async () => ({ id: 'int-mail' })),
  sendPasswordResetEmail: vi.fn(async (email: string, url: string) => {
    post.reset.push({ email, url })
  }),
}))

import { prisma } from '@/lib/prisma'
import { auth, PASSWORT_VERGESSEN_JE_ADRESSE } from '@/lib/auth'
import { adressMerkmal, bremsSchluessel } from '@/lib/bremse-datenbank'
import { env } from '@/lib/env'
import { PASSWORD_SCHEMA_MESSAGE } from '@/lib/password-rules'
import { meldeGeraetAb, meldeUeberallAb } from '@/server/actions/geraete'
import { intKennung, raeumeAuf } from './setup/basis'

const PASSWORT = 'Test-Passwort-1234'
const TAG = 24 * 60 * 60 * 1000
const STUNDE = 60 * 60 * 1000
const basis = 'http://localhost:3000/api/auth'
const adressen: string[] = []

afterEach(async () => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  post.reset.length = 0
  anfrage.headers = new Headers()
  // Die Zähler der Bremse tragen kein Präfix (HMAC der Adresse) — über die Adressen dieser Datei.
  await prisma.rateLimitZaehler.deleteMany({
    where: { schluessel: { in: adressen.map((a) => bremsSchluessel(env.BETTER_AUTH_SECRET, PASSWORT_VERGESSEN_JE_ADRESSE.zweck, adressMerkmal(a))) } },
  })
  adressen.length = 0
  await raeumeAuf()
})

function neueAdresse(was: string): string {
  const email = `${intKennung(was)}@example.com`
  adressen.push(email)
  return email
}

async function erstelleKonto(rolle: 'FARMER' | 'CUSTOMER' | 'ADMIN'): Promise<{ id: string; email: string }> {
  const email = neueAdresse(rolle === 'CUSTOMER' ? 'kundin' : 'hof')
  await auth.api.signUpEmail({ body: { email, password: PASSWORT, name: 'Max Mustermann' } })
  const konto = await prisma.user.update({ where: { email }, data: { role: rolle, emailVerified: true }, select: { id: true } })
  return { id: konto.id, email }
}

type Anmeldung = { cookie: string; sitzungId: string }

async function meldeAn(email: string, passwort = PASSWORT): Promise<Anmeldung> {
  const antwort = await auth.api.signInEmail({ body: { email, password: passwort }, asResponse: true })
  expect(antwort.status).toBe(200)
  const cookie = antwort.headers.getSetCookie().map((k) => k.split(';')[0]).join('; ')
  const sitzung = await auth.api.getSession({ headers: new Headers({ cookie }) })
  if (!sitzung) throw new Error('Sitzung nicht lesbar')
  return { cookie, sitzungId: sitzung.session.id }
}

async function altere(sitzungId: string, um: number): Promise<void> {
  await prisma.session.update({ where: { id: sitzungId }, data: { createdAt: new Date(Date.now() - um) } })
}

const gibt = async (sitzungId: string): Promise<boolean> => (await prisma.session.count({ where: { id: sitzungId } })) === 1
const gilt = async (cookie: string): Promise<boolean> => (await auth.api.getSession({ headers: new Headers({ cookie }) })) !== null

async function fehlerVon(aufruf: Promise<unknown>): Promise<{ status: number; code?: string; message?: string }> {
  try {
    await aufruf
  } catch (e) {
    const f = e as { statusCode: number; body?: { code?: string; message?: string } }
    return { status: f.statusCode, code: f.body?.code, message: f.body?.message }
  }
  throw new Error('kein Fehler')
}

describe('Höchstdauer der Sitzung (S18)', () => {
  it('31 Tage alt: abgemeldet und gelöscht — 29 Tage gilt (Gegenprobe)', async () => {
    const hof = await erstelleKonto('FARMER')
    const alt = await meldeAn(hof.email)
    const jung = await meldeAn(hof.email)
    await altere(alt.sitzungId, 31 * TAG)
    await altere(jung.sitzungId, 29 * TAG)

    expect(await gilt(alt.cookie)).toBe(false)
    expect(await gibt(alt.sitzungId)).toBe(false)
    expect(await gilt(jung.cookie)).toBe(true)
    expect(await gibt(jung.sitzungId)).toBe(true)
  })

  it('über HTTP: Antwort „nicht angemeldet" und das Sitzungs-Cookie wird abgeräumt', async () => {
    const kundin = await erstelleKonto('CUSTOMER')
    const a = await meldeAn(kundin.email)
    await altere(a.sitzungId, 31 * TAG)

    const antwort = await auth.handler(new Request(`${basis}/get-session`, { headers: { cookie: a.cookie } }))
    expect(antwort.status).toBe(200)
    expect(await antwort.json()).toBeNull()
    const abgeraeumt = antwort.headers.getSetCookie().find((k) => k.includes('session_token='))
    expect(abgeraeumt?.toLowerCase()).toContain('max-age=0')
    expect(await gibt(a.sitzungId)).toBe(false)
  })

  it('Rolle ADMIN: nach 12 Stunden abgemeldet — ein Hof mit derselben Sitzungsdauer nicht', async () => {
    const admin = await erstelleKonto('ADMIN')
    const hof = await erstelleKonto('FARMER')
    const a = await meldeAn(admin.email)
    const h = await meldeAn(hof.email)
    await altere(a.sitzungId, 13 * STUNDE)
    await altere(h.sitzungId, 13 * STUNDE)

    expect(await gilt(a.cookie)).toBe(false)
    expect(await gilt(h.cookie)).toBe(true)
  })

  it('auch Passwort ändern sieht eine zu alte Sitzung nicht: 401, gelöscht, das Passwort bleibt', async () => {
    const hof = await erstelleKonto('FARMER')
    const a = await meldeAn(hof.email)
    await altere(a.sitzungId, 31 * TAG)

    const f = await fehlerVon(
      auth.api.changePassword({ body: { currentPassword: PASSWORT, newPassword: 'Neues-Passwort-5678' }, headers: new Headers({ cookie: a.cookie }) })
    )
    expect(f.status).toBe(401)
    expect(await gibt(a.sitzungId)).toBe(false)
    await meldeAn(hof.email)
  })
})

describe('Angemeldete Geräte für Kundinnen', () => {
  it('eine fremde Sitzung trifft 0 Zeilen und bleibt; „Überall abmelden" beendet alle eigenen, keine fremde', async () => {
    const kundin = await erstelleKonto('CUSTOMER')
    const hof = await erstelleKonto('FARMER')
    const k1 = await meldeAn(kundin.email)
    const k2 = await meldeAn(kundin.email)
    const fremd = await meldeAn(hof.email)

    anfrage.headers = new Headers({ cookie: k1.cookie })
    expect(await meldeGeraetAb({ sitzungId: fremd.sitzungId })).toEqual({ ok: true, abgemeldet: 0 })
    expect(await gilt(fremd.cookie)).toBe(true)

    expect(await meldeUeberallAb()).toEqual({ ok: true, abgemeldet: 2 })
    expect(await gilt(k1.cookie)).toBe(false)
    expect(await gilt(k2.cookie)).toBe(false)
    expect(await gilt(fremd.cookie)).toBe(true)
  })

  it('Gegenprobe: ein Hof kann nicht „überall" abmelden — seine Sitzungen bleiben', async () => {
    const hof = await erstelleKonto('FARMER')
    const a = await meldeAn(hof.email)
    anfrage.headers = new Headers({ cookie: a.cookie })
    expect(await meldeUeberallAb()).toHaveProperty('error')
    expect(await gilt(a.cookie)).toBe(true)
  })
})

describe('Passwortregeln auf dem Server', () => {
  it('Ändern: schwach → 400 mit der Meldung der Registrierung, nichts geändert; stark geht', async () => {
    const hof = await erstelleKonto('FARMER')
    const a = await meldeAn(hof.email)
    const kopf = new Headers({ cookie: a.cookie })

    const f = await fehlerVon(auth.api.changePassword({ body: { currentPassword: PASSWORT, newPassword: 'nurkleinbuchstaben1' }, headers: kopf }))
    expect(f).toEqual({ status: 400, code: 'PASSWORT_ZU_SCHWACH', message: PASSWORD_SCHEMA_MESSAGE })
    await meldeAn(hof.email)

    await auth.api.changePassword({ body: { currentPassword: PASSWORT, newPassword: 'Neues-Passwort-5678' }, headers: kopf })
    await meldeAn(hof.email, 'Neues-Passwort-5678')
  })

  it('Zurücksetzen: schwach → 400, der Link bleibt gültig; stark geht', async () => {
    const hof = await erstelleKonto('FARMER')
    await auth.api.requestPasswordReset({ body: { email: hof.email } })
    while (nachlauf.aufgaben.length > 0) await nachlauf.aufgaben.shift()!()
    const token = post.reset[0]?.url.match(/\/reset-password\/([^?]+)/)?.[1]
    expect(token).toBeTruthy()

    const f = await fehlerVon(auth.api.resetPassword({ body: { newPassword: 'kurz1A', token: token! } }))
    expect(f).toEqual({ status: 400, code: 'PASSWORT_ZU_SCHWACH', message: 'Mindestens 8 Zeichen' })

    await auth.api.resetPassword({ body: { newPassword: 'Neues-Passwort-5678', token: token! } })
    await meldeAn(hof.email, 'Neues-Passwort-5678')
  })
})

describe('„Passwort vergessen" je Adresse', () => {
  it('5 in 15 Minuten, die 6. Anfrage 429 — eine unbekannte Adresse genauso, eine andere bleibt frei', async () => {
    const hof = await erstelleKonto('FARMER')
    const unbekannt = neueAdresse('niemand')
    const andere = neueAdresse('andere')

    for (const email of [hof.email, unbekannt]) {
      for (let i = 0; i < 5; i++) expect(await auth.api.requestPasswordReset({ body: { email } })).toMatchObject({ status: true })
      expect(await fehlerVon(auth.api.requestPasswordReset({ body: { email } }))).toMatchObject({ status: 429, message: 'Zu viele Anfragen.' })
    }
    expect(await auth.api.requestPasswordReset({ body: { email: andere } })).toMatchObject({ status: true })
  })
})

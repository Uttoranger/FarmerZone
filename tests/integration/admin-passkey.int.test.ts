/**
 * Admin nur mit Passkey (Register N20, Ergänzung Lauf 18; Nr. 115) gegen ein
 * echtes Postgres — Better Auth, das Passkey-Plugin und @simplewebauthn/server
 * echt; die Antworten des Geräts baut ein Software-Authenticator in dieser
 * Datei (P-256, Attestation „none", mit oder ohne Nutzerprüfung). So prüft der
 * Test die echte Signatur statt einer Attrappe: Das Plugin lädt
 * @simplewebauthn/server außerhalb von Vite, ein vi.mock erreichte es nicht.
 * Gemockt sind nur Mails (Prüfstellen), Sentry, der Nachlauf (gesammelt),
 * next/headers, next/cache und next/navigation.
 *
 * Beweist:
 *  - Anmeldeart und passkeyAm entstehen mit der Sitzung (databaseHooks).
 *  - Registrierung nur in den Fällen a–c, auf BEIDEN Pfaden; ohne
 *    Nutzerprüfung kein Passkey; nach Ersatzcode genau einer (zwei Tabs).
 *  - Anmeldung mit Passkey ohne Nutzerprüfung abgewiesen; frische Bestätigung
 *    mit fremdem Passkey → 401, alte Sitzung bleibt, kein neues Cookie; mit
 *    eigenem → eine Sitzung mit passkeyAm, die alte ist weg.
 *  - Ersatzcode: einmal gültig, gleiche Antwort für unbekannte Adresse,
 *    gebremst; Ersatzcodes nur gehasht; „Neue erstellen" macht alte ungültig.
 *  - Sperren: Passwort wie falsches Passwort, „Passwort vergessen" ohne Mail;
 *    delete-/update-passkey per HTTP zu; /update-session setzt passkeyAm nicht.
 *  - Wache: 12 Stunden, Pflicht in jeder Admin-Seite, frische Bestätigung.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const post = vi.hoisted(() => ({
  sicherheit: [] as Array<{ email: string; anlass: string; code?: string }>,
  reset: [] as string[],
}))
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
const anfrage = vi.hoisted(() => ({ headers: new Headers() }))

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), withScope: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('next/headers', () => ({
  headers: async () => anfrage.headers,
  cookies: async () => ({ get: () => undefined }),
  draftMode: async () => ({ isEnabled: false }),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT:${ziel}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
  permanentRedirect: vi.fn((ziel: string) => {
    throw new Error(`PERMANENT:${ziel}`)
  }),
  unstable_rethrow: vi.fn(),
}))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@/lib/email', () => ({
  sendAdminSicherheitEmail: vi.fn(async (email: string, anlass: string, daten: { code?: string }) => {
    post.sicherheit.push({ email, anlass, code: daten.code })
    return { id: 'int-mail' }
  }),
  sendPasswordResetEmail: vi.fn(async (email: string) => {
    post.reset.push(email)
  }),
  sendNeueAnmeldungEmail: vi.fn(async () => ({ id: 'int-mail' })),
  sendZuVieleVersucheEmail: vi.fn(async () => ({ id: 'int-mail' })),
}))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { env } from '@/lib/env'
import { DB_BREMSEN, adressMerkmal, bremsSchluessel } from '@/lib/bremse-datenbank'
import { ADMIN_ANMELDEN_FEHLER, ADMIN_AKTION_FEHLER, EINRICHTUNGSCODE_ART, FRISCH_FEHLER } from '@/lib/admin-anmeldung'
import { ersatzcodeHash } from '@/lib/ersatzcodes'
import { einmalLinkZweck } from '@/lib/geraete'
import { adminPflichtOffen, verlangeAdminAktion, verlangeAdminSeite, verlangeFrischeBestaetigung } from '@/server/admin-wache'
import { ladeAdminbereich } from '@/server/adminbereich'
import { entfernePasskey, erstelleErsatzcodes, pruefeEinrichtungscode, schickeEinrichtungscode } from '@/server/actions/admin-anmeldung'
import { meldeAllesAbNichtIch } from '@/server/actions/geraete'
import { erzeugeEinmalLink } from '@/server/geraete'
import { intKennung, raeumeAuf } from './setup/basis'

const BASIS = 'http://localhost:3000/api/auth'
const HERKUNFT = 'http://localhost:3000'
const PASSWORT = 'test-passwort-1234'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const MINUTE = 60_000
const adressen: string[] = []
const konten: string[] = []

afterEach(async () => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  post.sicherheit.length = 0
  post.reset.length = 0
  anfrage.headers = new Headers()
  const schluessel = [
    ...adressen.flatMap((a) => [DB_BREMSEN.adminErsatzcode, DB_BREMSEN.passwortFehler].map((b) => bremsSchluessel(env.BETTER_AUTH_SECRET, b.zweck, adressMerkmal(a)))),
    ...konten.map((id) => bremsSchluessel(env.BETTER_AUTH_SECRET, DB_BREMSEN.adminEinrichtungscode.zweck, id)),
  ]
  await prisma.rateLimitZaehler.deleteMany({ where: { schluessel: { in: schluessel } } })
  await prisma.verification.deleteMany({ where: { value: { contains: 'int-' } } })
  adressen.length = 0
  konten.length = 0
  await raeumeAuf()
})

async function arbeiteNachlaufAb(): Promise<void> {
  while (nachlauf.aufgaben.length > 0) {
    const aufgabe = nachlauf.aufgaben.shift()
    if (aufgabe) await aufgabe()
  }
}

// ── Software-Authenticator ──────────────────────────────────────────────────

type Cbor = number | string | Uint8Array | Map<number | string, Cbor>

function cborKopf(art: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(art << 5) | n])
  if (n < 256) return Buffer.from([(art << 5) | 24, n])
  const b = Buffer.alloc(3)
  b[0] = (art << 5) | 25
  b.writeUInt16BE(n, 1)
  return b
}

function cbor(wert: Cbor): Buffer {
  if (typeof wert === 'number') return wert >= 0 ? cborKopf(0, wert) : cborKopf(1, -1 - wert)
  if (typeof wert === 'string') {
    const b = Buffer.from(wert, 'utf8')
    return Buffer.concat([cborKopf(3, b.length), b])
  }
  if (wert instanceof Uint8Array) return Buffer.concat([cborKopf(2, wert.length), Buffer.from(wert)])
  const teile = [cborKopf(5, wert.size)]
  for (const [k, v] of wert) teile.push(cbor(k), cbor(v))
  return Buffer.concat(teile)
}

const b64u = (b: Uint8Array): string => Buffer.from(b).toString('base64url')

/** Ein Gerät mit einem Passkey für rpID localhost — Flags UP, UV (wählbar), bei der Registrierung AT. */
class Testgeraet {
  private readonly paar = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  private readonly kennung = randomBytes(16)
  get id(): string {
    return b64u(this.kennung)
  }

  private authDaten(flags: number, mitSchluessel: boolean): Buffer {
    const rp = createHash('sha256').update('localhost').digest()
    const zaehler = Buffer.alloc(4)
    if (!mitSchluessel) return Buffer.concat([rp, Buffer.from([flags]), zaehler])
    const jwk = this.paar.publicKey.export({ format: 'jwk' })
    const cose = cbor(
      new Map<number, Cbor>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(String(jwk.x), 'base64url')],
        [-3, Buffer.from(String(jwk.y), 'base64url')],
      ])
    )
    const laenge = Buffer.alloc(2)
    laenge.writeUInt16BE(this.kennung.length)
    return Buffer.concat([rp, Buffer.from([flags]), zaehler, Buffer.alloc(16), laenge, this.kennung, cose])
  }

  registrierung(challenge: string, nutzerpruefung = true): Record<string, unknown> {
    const client = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge, origin: HERKUNFT, crossOrigin: false }))
    const daten = this.authDaten(0x01 | 0x40 | (nutzerpruefung ? 0x04 : 0), true)
    const attestation = cbor(new Map<string, Cbor>([['fmt', 'none'], ['attStmt', new Map()], ['authData', daten]]))
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: { clientDataJSON: b64u(client), attestationObject: b64u(attestation), transports: ['internal'] },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    }
  }

  anmeldung(challenge: string, nutzerpruefung = true): Record<string, unknown> {
    const client = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin: HERKUNFT, crossOrigin: false }))
    const daten = this.authDaten(0x01 | (nutzerpruefung ? 0x04 : 0), false)
    const signatur = sign('sha256', Buffer.concat([daten, createHash('sha256').update(client).digest()]), this.paar.privateKey)
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: { clientDataJSON: b64u(client), authenticatorData: b64u(daten), signature: b64u(signatur) },
      clientExtensionResults: {},
    }
  }
}

// ── HTTP wie ein Browser ────────────────────────────────────────────────────

type Dose = Map<string, string>
type Antwort = { status: number; text: string; daten: Record<string, unknown> | null; kekse: string[] }

function keksKopf(dose: Dose): string {
  return [...dose].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function http(dose: Dose, pfad: string, body?: unknown): Promise<Antwort> {
  const antwort = await auth.handler(
    new Request(`${BASIS}${pfad}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', origin: HERKUNFT, cookie: keksKopf(dose), 'user-agent': UA },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  )
  const kekse = antwort.headers.getSetCookie()
  for (const keks of kekse) {
    const [paar, ...attribute] = keks.split(';')
    const i = paar.indexOf('=')
    const name = paar.slice(0, i).trim()
    const wert = paar.slice(i + 1)
    if (wert === '' || attribute.some((a) => /^\s*max-age=0\s*$/i.test(a))) dose.delete(name)
    else dose.set(name, wert)
  }
  const text = await antwort.text()
  let daten: Record<string, unknown> | null = null
  try {
    daten = text ? (JSON.parse(text) as Record<string, unknown>) : null
  } catch {
    daten = null
  }
  return { status: antwort.status, text, daten, kekse }
}

const sitzungsKeks = (dose: Dose): string | undefined => [...dose.keys()].find((k) => k.endsWith('session_token'))

async function sitzungVon(dose: Dose): Promise<{ id: string; userId: string } | null> {
  const s = await auth.api.getSession({ headers: new Headers({ cookie: keksKopf(dose) }) })
  return s ? { id: s.session.id, userId: s.user.id } : null
}

function alsBrowser(dose: Dose): void {
  anfrage.headers = new Headers({ cookie: keksKopf(dose), 'user-agent': UA })
}

/** Was die Pflichtseite /admin/einrichten der Sitzung von alsBrowser zeigt — die Ansicht, die sie an die Schritte gibt. */
async function einrichtenAnsicht(): Promise<unknown> {
  const seite = (await import('@/app/admin/einrichten/page')) as { default: () => Promise<{ props: { children: unknown } }> }
  const kinder = [(await seite.default()).props.children].flat() as Array<{ props?: { ansicht?: unknown } }>
  const schritte = kinder.find((k) => k?.props?.ansicht !== undefined)
  if (!schritte) throw new Error('keine Schritte auf der Pflichtseite')
  return schritte.props?.ansicht
}

/** Ein Konto mit Passwort; Admin mit `adminSeit` (Standard: jetzt). */
async function erstelleKonto(admin: { adminSeit?: Date | null } | null): Promise<{ id: string; email: string }> {
  const email = `${intKennung('admin')}@example.com`
  await auth.api.signUpEmail({ body: { email, password: PASSWORT, name: 'Max Mustermann' } })
  const konto = await prisma.user.update({
    where: { email },
    data: admin ? { isAdmin: true, adminSeit: admin.adminSeit === undefined ? new Date() : admin.adminSeit } : {},
    select: { id: true },
  })
  adressen.push(email)
  konten.push(konto.id)
  return { id: konto.id, email }
}

async function mitPasswort(email: string): Promise<Dose> {
  const dose: Dose = new Map()
  const a = await http(dose, '/sign-in/email', { email, password: PASSWORT })
  expect(a.status).toBe(200)
  return dose
}

/** Der E-Mail-Code der Einrichtung gilt in dieser Sitzung als bestätigt (wie nach pruefeEinrichtungscode). */
async function codeBestaetigt(userId: string, sitzungId: string): Promise<void> {
  await prisma.einmalLink.create({
    data: { userId, zweck: einmalLinkZweck(EINRICHTUNGSCODE_ART, sitzungId), tokenHash: `int-${randomBytes(12).toString('hex')}`, ablaufAm: new Date(Date.now() + 10 * MINUTE), benutztAm: new Date() },
  })
}

async function registriere(dose: Dose, geraet: Testgeraet, nutzerpruefung = true): Promise<Antwort> {
  const optionen = await http(dose, '/passkey/generate-register-options')
  if (optionen.status !== 200) return optionen
  return http(dose, '/passkey/verify-registration', { response: geraet.registrierung(String(optionen.daten?.challenge), nutzerpruefung) })
}

async function meldeMitPasskeyAn(dose: Dose, geraet: Testgeraet, nutzerpruefung = true): Promise<Antwort> {
  const optionen = await http(dose, '/passkey/generate-authenticate-options')
  expect(optionen.status).toBe(200)
  return http(dose, '/passkey/verify-authentication', { response: geraet.anmeldung(String(optionen.daten?.challenge), nutzerpruefung) })
}

/** Ein Admin mit einem eingerichteten Passkey, angemeldet mit Passkey (frisch). */
async function adminMitPasskey(): Promise<{ id: string; email: string; geraet: Testgeraet; dose: Dose }> {
  const konto = await erstelleKonto({})
  const dose = await mitPasswort(konto.email)
  const sitzung = await sitzungVon(dose)
  if (!sitzung) throw new Error('keine Sitzung')
  await codeBestaetigt(konto.id, sitzung.id)
  const geraet = new Testgeraet()
  expect((await registriere(dose, geraet)).status).toBe(200)
  const angemeldet: Dose = new Map()
  expect((await meldeMitPasskeyAn(angemeldet, geraet)).status).toBe(200)
  // Die Mail „Passkey hinzugefügt" der Einrichtung gehört nicht zum Fall danach.
  await arbeiteNachlaufAb()
  post.sicherheit.length = 0
  return { ...konto, geraet, dose: angemeldet }
}

async function sitzungsZeile(dose: Dose) {
  const s = await sitzungVon(dose)
  return s ? prisma.session.findUnique({ where: { id: s.id }, select: { anmeldeart: true, passkeyAm: true, createdAt: true } }) : null
}

describe('Anmeldeart und passkeyAm entstehen mit der Sitzung', () => {
  it('Passwort → „passwort", ohne passkeyAm; Passkey → „passkey" mit passkeyAm', async () => {
    const admin = await adminMitPasskey()
    const zeile = await sitzungsZeile(admin.dose)
    expect(zeile?.anmeldeart).toBe('passkey')
    expect(zeile?.passkeyAm).toBeInstanceOf(Date)

    const kunde = await erstelleKonto(null)
    const passwort = await sitzungsZeile(await mitPasswort(kunde.email))
    expect(passwort).toMatchObject({ anmeldeart: 'passwort', passkeyAm: null })
  })

  it('/update-session nimmt passkeyAm und anmeldeart nicht an', async () => {
    const kunde = await erstelleKonto(null)
    const dose = await mitPasswort(kunde.email)
    await http(dose, '/update-session', { passkeyAm: new Date().toISOString(), anmeldeart: 'passkey' })
    expect(await sitzungsZeile(dose)).toMatchObject({ anmeldeart: 'passwort', passkeyAm: null })
  })
})

describe('Registrierung nur in den Fällen a–c', () => {
  it('(a) erster Passkey mit Passwort, frischem Code und adminSeit: angelegt, Sitzung frisch, Mail', async () => {
    const konto = await erstelleKonto({})
    const dose = await mitPasswort(konto.email)
    const sitzung = await sitzungVon(dose)
    await codeBestaetigt(konto.id, String(sitzung?.id))

    const antwort = await registriere(dose, new Testgeraet())

    expect(antwort.status).toBe(200)
    expect(await prisma.passkey.count({ where: { userId: konto.id } })).toBe(1)
    expect((await sitzungsZeile(dose))?.passkeyAm).toBeInstanceOf(Date)
    await arbeiteNachlaufAb()
    expect(post.sicherheit).toEqual([{ email: konto.email, anlass: 'passkey-hinzugefuegt', code: undefined }])
  })

  it('(a) ohne Code, nach 24 Stunden, ohne adminSeit, als Nicht-Admin oder nach 15 Minuten: 403, kein Passkey', async () => {
    const ohneCode = await erstelleKonto({})
    const faelle: Array<{ konto: { id: string; email: string }; vorbereiten?: (sitzungId: string) => Promise<void> }> = [
      { konto: ohneCode },
      { konto: await erstelleKonto({ adminSeit: new Date(Date.now() - 25 * 60 * MINUTE) }), vorbereiten: (s) => codeBestaetigt(konten[1], s) },
      { konto: await erstelleKonto({ adminSeit: null }), vorbereiten: (s) => codeBestaetigt(konten[2], s) },
      { konto: await erstelleKonto(null), vorbereiten: (s) => codeBestaetigt(konten[3], s) },
      {
        konto: await erstelleKonto({}),
        vorbereiten: async (s) => {
          await codeBestaetigt(konten[4], s)
          await prisma.session.update({ where: { id: s }, data: { createdAt: new Date(Date.now() - 16 * MINUTE) } })
        },
      },
    ]
    for (const fall of faelle) {
      const dose = await mitPasswort(fall.konto.email)
      const sitzung = await sitzungVon(dose)
      await fall.vorbereiten?.(String(sitzung?.id))
      const antwort = await http(dose, '/passkey/generate-register-options')
      expect(antwort.status, fall.konto.email).toBe(403)
      expect(antwort.daten?.code).toBe('PASSKEY_NICHT_ERLAUBT')
    }
    expect(await prisma.passkey.count({ where: { userId: { in: konten } } })).toBe(0)
  })

  it('prüft auch verify-registration: Recht zwischen den Schritten entzogen → 403, kein Passkey', async () => {
    const konto = await erstelleKonto({})
    const dose = await mitPasswort(konto.email)
    await codeBestaetigt(konto.id, String((await sitzungVon(dose))?.id))
    const optionen = await http(dose, '/passkey/generate-register-options')
    expect(optionen.status).toBe(200)

    await prisma.user.update({ where: { id: konto.id }, data: { isAdmin: false } })
    const antwort = await http(dose, '/passkey/verify-registration', { response: new Testgeraet().registrierung(String(optionen.daten?.challenge)) })

    expect(antwort.status).toBe(403)
    expect(await prisma.passkey.count({ where: { userId: konto.id } })).toBe(0)
  })

  it('ohne Nutzerprüfung (Fingerabdruck, Gesicht, PIN) entsteht kein Passkey', async () => {
    const konto = await erstelleKonto({})
    const dose = await mitPasswort(konto.email)
    await codeBestaetigt(konto.id, String((await sitzungVon(dose))?.id))

    const antwort = await registriere(dose, new Testgeraet(), false)

    expect(antwort.status).toBe(403)
    expect(antwort.daten?.code).toBe('NUTZERPRUEFUNG_FEHLT')
    expect(await prisma.passkey.count({ where: { userId: konto.id } })).toBe(0)
  })

  it('(c) weiterer Passkey nur frisch bestätigt: 6 Minuten nach der Anmeldung mit Passkey → 403', async () => {
    const admin = await adminMitPasskey()
    expect((await registriere(admin.dose, new Testgeraet())).status).toBe(200)

    const sitzung = await sitzungVon(admin.dose)
    await prisma.session.update({ where: { id: String(sitzung?.id) }, data: { passkeyAm: new Date(Date.now() - 6 * MINUTE) } })
    expect((await http(admin.dose, '/passkey/generate-register-options')).status).toBe(403)
    expect(await prisma.passkey.count({ where: { userId: admin.id } })).toBe(2)
  })
})

describe('Anmeldung mit Passkey und frische Bestätigung', () => {
  it('ohne Nutzerprüfung abgewiesen — keine Sitzung', async () => {
    const admin = await adminMitPasskey()
    const vorher = await prisma.session.count({ where: { userId: admin.id } })
    const dose: Dose = new Map()

    const antwort = await meldeMitPasskeyAn(dose, admin.geraet, false)

    expect(antwort.status).toBe(401)
    expect(antwort.daten?.code).toBe('NUTZERPRUEFUNG_FEHLT')
    expect(sitzungsKeks(dose)).toBeUndefined()
    expect(await prisma.session.count({ where: { userId: admin.id } })).toBe(vorher)
  })

  it('eigener Passkey: eine neue Sitzung mit passkeyAm, die alte ist weg', async () => {
    const admin = await adminMitPasskey()
    const alt = await sitzungVon(admin.dose)
    await prisma.session.update({ where: { id: String(alt?.id) }, data: { passkeyAm: new Date(Date.now() - 30 * MINUTE) } })

    const antwort = await meldeMitPasskeyAn(admin.dose, admin.geraet)

    expect(antwort.status).toBe(200)
    const neu = await sitzungVon(admin.dose)
    expect(neu?.id).not.toBe(alt?.id)
    expect(await prisma.session.findUnique({ where: { id: String(alt?.id) } })).toBeNull()
    expect((await sitzungsZeile(admin.dose))?.passkeyAm?.getTime()).toBeGreaterThan(Date.now() - MINUTE)
  })

  it('fremder Passkey: 401, die alte Sitzung bleibt, kein neues Sitzungs-Cookie, keine Sitzung für das fremde Konto', async () => {
    const a = await adminMitPasskey()
    const b = await adminMitPasskey()
    const sitzungA = await sitzungVon(a.dose)
    const sitzungenB = await prisma.session.count({ where: { userId: b.id } })

    const optionen = await http(a.dose, '/passkey/generate-authenticate-options')
    const antwort = await http(a.dose, '/passkey/verify-authentication', { response: b.geraet.anmeldung(String(optionen.daten?.challenge)) })

    expect(antwort.status).toBe(401)
    expect(antwort.daten?.message).toBe(ADMIN_ANMELDEN_FEHLER.fremdesKonto)
    expect(antwort.kekse.some((k) => k.includes('session_token'))).toBe(false)
    expect((await sitzungVon(a.dose))?.id).toBe(sitzungA?.id)
    expect(await prisma.session.count({ where: { userId: b.id } })).toBe(sitzungenB)
  })

  it('list-user-passkeys gibt nur die eigenen zurück; delete- und update-passkey sind über HTTP zu', async () => {
    const a = await adminMitPasskey()
    const b = await adminMitPasskey()
    const liste = await http(a.dose, '/passkey/list-user-passkeys')
    expect((liste.daten as unknown as Array<{ userId: string }>).map((p) => p.userId)).toEqual([a.id])
    const fremd = await prisma.passkey.findFirstOrThrow({ where: { userId: b.id } })

    expect((await http(a.dose, '/passkey/delete-passkey', { id: fremd.id })).status).toBe(404)
    expect((await http(b.dose, '/passkey/delete-passkey', { id: fremd.id })).status).toBe(404)
    expect((await http(b.dose, '/passkey/update-passkey', { id: fremd.id, name: 'int-neu' })).status).toBe(404)
    expect(await prisma.passkey.count({ where: { id: fremd.id, name: { not: 'int-neu' } } })).toBe(1)
  })
})

describe('Ersatzcode', () => {
  async function mitCodes(userId: string, codes: string[]): Promise<void> {
    for (const code of codes) await prisma.adminErsatzcode.create({ data: { userId, codeHash: await ersatzcodeHash(env.BETTER_AUTH_SECRET, userId, code) } })
  }

  it('meldet einmal an (Anmeldeart ersatzcode, Mail); derselbe Code und eine unbekannte Adresse antworten gleich', async () => {
    const admin = await adminMitPasskey()
    await mitCodes(admin.id, ['JMEA-QUFD'])
    const dose: Dose = new Map()

    const erst = await http(dose, '/admin-ersatzcode/anmelden', { email: admin.email.toUpperCase(), code: 'jmea qufd' })
    expect(erst.status).toBe(200)
    expect(await sitzungsZeile(dose)).toMatchObject({ anmeldeart: 'ersatzcode' })
    await arbeiteNachlaufAb()
    expect(post.sicherheit.map((m) => m.anlass)).toEqual(['ersatzcode-benutzt'])

    const nochmal = await http(new Map(), '/admin-ersatzcode/anmelden', { email: admin.email, code: 'JMEA-QUFD' })
    const unbekannt = await http(new Map(), '/admin-ersatzcode/anmelden', { email: 'int-niemand@example.com', code: 'JMEA-QUFD' })
    adressen.push('int-niemand@example.com')
    expect(nochmal.status).toBe(401)
    expect({ status: unbekannt.status, text: unbekannt.text }).toEqual({ status: nochmal.status, text: nochmal.text })
  })

  it('gebremst: nach 5 Versuchen je Adresse und Stunde 429 — auch mit dem richtigen Code', async () => {
    const admin = await adminMitPasskey()
    await mitCodes(admin.id, ['WPKG-EKHA'])
    for (let i = 0; i < 5; i++) expect((await http(new Map(), '/admin-ersatzcode/anmelden', { email: admin.email, code: 'AAAA-AAAA' })).status).toBe(401)

    const richtig = await http(new Map(), '/admin-ersatzcode/anmelden', { email: admin.email, code: 'WPKG-EKHA' })

    expect(richtig.status).toBe(429)
    expect(await prisma.adminErsatzcode.count({ where: { userId: admin.id, benutztAm: { not: null } } })).toBe(0)
  })

  it('danach genau EIN neuer Passkey — auch aus zwei Tabs gleichzeitig; die Pflicht fällt erst damit', async () => {
    const admin = await adminMitPasskey()
    await mitCodes(admin.id, ['KCDC-TAKV'])
    const dose: Dose = new Map()
    expect((await http(dose, '/admin-ersatzcode/anmelden', { email: admin.email, code: 'KCDC-TAKV' })).status).toBe(200)
    expect(await adminPflichtOffen(admin.id)).toBe(true)
    // Pflicht offen: Die Pflichtseite öffnet der Sitzung aus dem Ersatzcode (ohne passkeyAm).
    alsBrowser(dose)
    expect(await einrichtenAnsicht()).toMatchObject({ zustand: 'ersatzcode', mitErsatzcode: true })

    // Zwei Tabs: dieselbe Sitzung, je eine eigene Challenge.
    const tab1 = new Map(dose)
    const tab2 = new Map(dose)
    const o1 = await http(tab1, '/passkey/generate-register-options')
    const o2 = await http(tab2, '/passkey/generate-register-options')
    const [r1, r2] = await Promise.all([
      http(tab1, '/passkey/verify-registration', { response: new Testgeraet().registrierung(String(o1.daten?.challenge)) }),
      http(tab2, '/passkey/verify-registration', { response: new Testgeraet().registrierung(String(o2.daten?.challenge)) }),
    ])

    expect([r1.status, r2.status].sort()).toEqual([200, 403])
    expect(await prisma.passkey.count({ where: { userId: admin.id } })).toBe(2)
    expect(await sitzungsZeile(dose)).toMatchObject({ anmeldeart: 'ersatzcode-eingeloest' })
    expect(await adminPflichtOffen(admin.id)).toBe(false)
    expect((await registriere(new Map(dose), new Testgeraet())).status).toBe(403)
    // Die Pflichtseite bleibt offen (passkeyAm) und nennt den Weg der Anmeldung (sichter Runde 2, K1).
    alsBrowser(dose)
    expect(await einrichtenAnsicht()).toMatchObject({ zustand: 'eingerichtet', mitErsatzcode: true })
  })

  it('erstelleErsatzcodes: 10 Codes, nur gehasht gespeichert; „Neue erstellen" macht die alten ungültig', async () => {
    const admin = await adminMitPasskey()
    alsBrowser(admin.dose)

    const erste = await erstelleErsatzcodes()
    if (!('ok' in erste)) throw new Error(erste.error)
    expect(erste.codes).toHaveLength(10)
    const zeilen = await prisma.adminErsatzcode.findMany({ where: { userId: admin.id }, select: { codeHash: true } })
    expect(zeilen).toHaveLength(10)
    for (const code of erste.codes) expect(zeilen.some((z) => z.codeHash.includes(code) || z.codeHash.includes(code.replace('-', '')))).toBe(false)

    const zweite = await erstelleErsatzcodes()
    if (!('ok' in zweite)) throw new Error(zweite.error)
    expect(await prisma.adminErsatzcode.count({ where: { userId: admin.id } })).toBe(10)
    expect((await http(new Map(), '/admin-ersatzcode/anmelden', { email: admin.email, code: erste.codes[0] })).status).toBe(401)
    expect((await http(new Map(), '/admin-ersatzcode/anmelden', { email: admin.email, code: zweite.codes[0] })).status).toBe(200)
  })
})

describe('Sperren für einen Admin mit Passkey', () => {
  it('Passwort: dieselbe Antwort wie ein falsches Passwort — auch mit dem richtigen', async () => {
    const admin = await adminMitPasskey()
    const kunde = await erstelleKonto(null)

    const gesperrt = await http(new Map(), '/sign-in/email', { email: admin.email, password: PASSWORT })
    const falsch = await http(new Map(), '/sign-in/email', { email: kunde.email, password: 'falsch-passwort-1234' })

    expect(gesperrt.status).toBe(401)
    expect({ status: gesperrt.status, text: gesperrt.text }).toEqual({ status: falsch.status, text: falsch.text })
    expect(gesperrt.kekse.some((k) => k.includes('session_token'))).toBe(false)
  })

  it('„Passwort vergessen": gleiche Antwort wie bei einer unbekannten Adresse, keine Mail', async () => {
    const admin = await adminMitPasskey()
    const gesperrt = await http(new Map(), '/request-password-reset', { email: admin.email, redirectTo: '/reset-password' })
    const unbekannt = await http(new Map(), '/request-password-reset', { email: 'int-niemand-reset@example.com', redirectTo: '/reset-password' })
    await arbeiteNachlaufAb()

    expect(gesperrt.status).toBe(200)
    expect({ status: gesperrt.status, text: gesperrt.text }).toEqual({ status: unbekannt.status, text: unbekannt.text })
    expect(post.reset).toEqual([])
  })

  it('„Das war ich nicht": alle Geräte ab, kein Link für ein neues Passwort, eigener Satz', async () => {
    const admin = await adminMitPasskey()
    const token = await erzeugeEinmalLink({ userId: admin.id, zweck: 'nicht-ich:int-geraet', jetzt: new Date() })

    const antwort = await meldeAllesAbNichtIch({ token })
    await arbeiteNachlaufAb()

    expect(antwort).toEqual({ ok: true, passwortMail: false, passkey: true })
    expect(await prisma.session.count({ where: { userId: admin.id } })).toBe(0)
    expect(post.reset).toEqual([])
  })
})

describe('Wache: 12 Stunden, Pflicht, frische Bestätigung', () => {
  it('Sitzung älter als 12 Stunden: abgemeldet, die Aktion antwortet mit dem Satz', async () => {
    const admin = await adminMitPasskey()
    const sitzung = await sitzungVon(admin.dose)
    await prisma.session.update({ where: { id: String(sitzung?.id) }, data: { createdAt: new Date(Date.now() - 12 * 60 * MINUTE - MINUTE) } })
    alsBrowser(admin.dose)

    expect(await verlangeAdminAktion()).toEqual({ error: ADMIN_AKTION_FEHLER.abgelaufen })
    expect(await prisma.session.findUnique({ where: { id: String(sitzung?.id) } })).toBeNull()
  })

  it('frische Bestätigung: 5 Minuten ja, 6 Minuten → „frisch"', async () => {
    const admin = await adminMitPasskey()
    const sitzung = await sitzungVon(admin.dose)
    alsBrowser(admin.dose)
    await prisma.session.update({ where: { id: String(sitzung?.id) }, data: { passkeyAm: new Date(Date.now() - 4 * MINUTE) } })
    expect(await verlangeFrischeBestaetigung()).toMatchObject({ ok: true, userId: admin.id })
    await prisma.session.update({ where: { id: String(sitzung?.id) }, data: { passkeyAm: new Date(Date.now() - 6 * MINUTE) } })
    expect(await verlangeFrischeBestaetigung()).toEqual({ error: FRISCH_FEHLER })
  })

  it('ohne Passkey: Aktionen antworten mit der Pflicht, die der Pflichtseite gehen; die Shell kommt ohne Zähler', async () => {
    const konto = await erstelleKonto({})
    alsBrowser(await mitPasswort(konto.email))

    expect(await verlangeAdminAktion()).toEqual({ error: ADMIN_AKTION_FEHLER.pflicht })
    expect(await verlangeAdminAktion({ ohnePasskey: true })).toEqual({ ok: true, userId: konto.id })
    const bereich = await ladeAdminbereich()
    expect(bereich.zahlen).toBeUndefined()
    expect(bereich.betrieb).toBeNull()
  })

  it('Sitzung mit Passwort von vor dem ersten Passkey (anderes Gerät): Seite → /login/admin, Aktion → Satz, Shell ohne Zähler; die Sitzung der Einrichtung kommt durch', async () => {
    const konto = await erstelleKonto({})
    const geraetB = await mitPasswort(konto.email)
    const geraetA = await mitPasswort(konto.email)
    const sitzungA = await sitzungVon(geraetA)
    const sitzungB = await sitzungVon(geraetB)
    if (!sitzungA || !sitzungB) throw new Error('keine Sitzung')
    await codeBestaetigt(konto.id, sitzungA.id)
    expect((await registriere(geraetA, new Testgeraet())).status).toBe(200)
    expect(await adminPflichtOffen(konto.id)).toBe(false)

    alsBrowser(geraetB)
    const satz = { error: ADMIN_AKTION_FEHLER.ohnePasskey }
    expect(await verlangeAdminAktion()).toEqual(satz)
    expect(await verlangeFrischeBestaetigung()).toEqual(satz)
    const startseite = (await import('@/app/admin/page')) as { default: (props: unknown) => Promise<unknown> }
    await expect(startseite.default({ searchParams: Promise.resolve({}), params: Promise.resolve({}) })).rejects.toThrow('REDIRECT:/login/admin')
    expect((await ladeAdminbereich()).zahlen).toBeUndefined()
    // Auch die Pflichtseite nicht mehr (sichter Runde 2, S1): sonst zeigte sie „eingerichtet" samt Admin-Kopf.
    const pflichtseite = (await import('@/app/admin/einrichten/page')) as { default: () => Promise<unknown> }
    await expect(pflichtseite.default()).rejects.toThrow('REDIRECT:/login/admin')
    // Umgeleitet, nicht abgemeldet: Hof und Konto bleiben in dieser Sitzung erreichbar.
    expect(await prisma.session.findUnique({ where: { id: sitzungB.id } })).not.toBeNull()

    // Gegenprobe: die Sitzung, in der der Passkey eingerichtet wurde (passkeyAm gesetzt).
    alsBrowser(geraetA)
    expect(await verlangeAdminAktion()).toEqual({ ok: true, userId: konto.id })
    expect(await verlangeAdminSeite()).toBe(konto.id)
    expect((await ladeAdminbereich()).zahlen).toBeDefined()
    expect(await einrichtenAnsicht()).toMatchObject({ zustand: 'eingerichtet', mitErsatzcode: false })
  })

  it('ohne Passkey leitet jede Admin-Seite auf /admin/einrichten um, bevor sie Daten lädt — die Pflichtseite selbst nicht', async () => {
    const konto = await erstelleKonto({})
    alsBrowser(await mitPasswort(konto.email))
    const wurzel = join(process.cwd(), 'src/app/admin')
    const seiten: string[] = []
    const sammle = (ordner: string): void => {
      for (const name of readdirSync(ordner)) {
        const pfad = join(ordner, name)
        if (statSync(pfad).isDirectory()) sammle(pfad)
        else if (name === 'page.tsx') seiten.push(pfad)
      }
    }
    sammle(wurzel)
    expect(seiten.length).toBeGreaterThanOrEqual(9)

    for (const seite of seiten) {
      const name = relative(wurzel, seite)
      const modul = (await import(/* @vite-ignore */ seite)) as { default: (props: unknown) => Promise<unknown> }
      const props = { searchParams: Promise.resolve({}), params: Promise.resolve({}) }
      if (name === join('einrichten', 'page.tsx')) {
        await expect(modul.default(props), name).resolves.toBeTruthy()
      } else {
        await expect(modul.default(props), name).rejects.toThrow('REDIRECT:/admin/einrichten')
      }
    }
  }, 60_000)
})

describe('E-Mail-Code der Einrichtung', () => {
  it('geht per Mail, gilt einmal, falsche Codes sind gebremst (5 je Stunde)', async () => {
    const konto = await erstelleKonto({})
    alsBrowser(await mitPasswort(konto.email))

    expect(await schickeEinrichtungscode()).toEqual({ ok: true })
    await arbeiteNachlaufAb()
    const code = post.sicherheit.find((m) => m.anlass === 'einrichtungscode')?.code
    if (!code) throw new Error('kein Code verschickt')
    expect(await prisma.einmalLink.count({ where: { userId: konto.id, tokenHash: { contains: code } } })).toBe(0)

    // Falscher Code zur Laufzeit aus dem echten abgeleitet (letzte Ziffer +1) — kein Code im Quelltext.
    const falsch = code.replace(/\d$/, (z) => String((Number(z) + 1) % 10))
    expect(await pruefeEinrichtungscode({ code: falsch })).toHaveProperty('error')
    expect(await pruefeEinrichtungscode({ code })).toEqual({ ok: true })
    expect(await pruefeEinrichtungscode({ code })).toHaveProperty('error')
    expect(await pruefeEinrichtungscode({ code: falsch })).toHaveProperty('error')
    expect(await pruefeEinrichtungscode({ code: falsch })).toHaveProperty('error')
    expect(await pruefeEinrichtungscode({ code: falsch })).toEqual({ error: ADMIN_ANMELDEN_FEHLER.zuViele })
  })
})

describe('Passkey entfernen', () => {
  it('nie den letzten — auch nicht aus zwei Tabs gleichzeitig; danach eine Mail', async () => {
    const admin = await adminMitPasskey()
    expect((await registriere(admin.dose, new Testgeraet())).status).toBe(200)
    alsBrowser(admin.dose)
    const [p1, p2] = await prisma.passkey.findMany({ where: { userId: admin.id }, select: { id: true } })

    const ergebnisse = await Promise.all([entfernePasskey({ id: p1.id }), entfernePasskey({ id: p2.id })])

    expect(ergebnisse).toContainEqual({ ok: true })
    expect(ergebnisse).toContainEqual({ error: ADMIN_AKTION_FEHLER.letzterPasskey })
    expect(await prisma.passkey.count({ where: { userId: admin.id } })).toBe(1)
    await arbeiteNachlaufAb()
    expect(post.sicherheit.filter((m) => m.anlass === 'passkey-entfernt')).toHaveLength(1)
  })
})

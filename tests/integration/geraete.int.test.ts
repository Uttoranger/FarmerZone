/**
 * Angemeldete Geräte, frische Sitzung, Mail bei neuem Gerät und „Das war ich
 * nicht" (Register E7, Ergänzung Lauf 17; Nr. 114) gegen ein echtes Postgres —
 * Better Auth echt, der Zustand danach ist die Aussage. Gemockt sind nur die
 * Mails (Prüfstellen), Sentry, der Nachlauf (gesammelt, selbst abgearbeitet)
 * und der Request-Kontext der Actions.
 *
 * Beweist:
 *  - Cookie-Cache aus: Eine gelöschte Sitzung ist beim nächsten getSession weg;
 *    eine Prüfung kostet zwei Abfragen (Sitzung, dann Konto), gemessen an pg.
 *  - Neues Gerät: Ohne Cookie setzt die Anmeldung eines Hofs die Kennung
 *    (httpOnly, SameSite=Lax, 400 Tage) und merkt das Gerät nur gehasht; das
 *    erste Gerät still, ein bekanntes ohne Mail, ein weiteres neues mit Mail
 *    und Einmal-Link (nur gehasht). Kundschaft: kein Cookie, keine Zeile.
 *  - Actions: nur eigene Sitzungen — eine fremde Kennung trifft 0 Zeilen, „alle
 *    anderen" lässt die aktuelle stehen; das abgemeldete Gerät ist sofort weg.
 *  - Einmal-Link: Öffnen ändert nichts; der Knopf meldet ALLE Geräte des
 *    Kontos ab und schickt einen Link für ein neues Passwort — einmal; ein
 *    zweites Mal und ein abgelaufener Link: neutral, nichts passiert.
 *  - Aufräumen: abgelaufene und seit 7 Tagen benutzte Links fallen, offene bleiben.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import pg from 'pg'

const post = vi.hoisted(() => ({
  anmeldung: [] as Array<{ email: string; daten: { hof: boolean; name: string | null; geraet: string; zeitpunkt: Date; link: string } }>,
  reset: [] as string[],
}))
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
  sendNeueAnmeldungEmail: vi.fn(async (email: string, daten: (typeof post.anmeldung)[number]['daten']) => {
    post.anmeldung.push({ email, daten })
    return { id: 'int-mail' }
  }),
  sendPasswordResetEmail: vi.fn(async (email: string) => {
    post.reset.push(email)
  }),
}))

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { GERAETE_COOKIE, NICHT_ICH_PFAD } from '@/lib/geraete'
import { einmalTokenHash, erzeugeEinmalLink, geraeteKennungHash, ladeAngemeldeteGeraete, ladeNichtIch } from '@/server/geraete'
import { meldeAlleAnderenAb, meldeAllesAbNichtIch, meldeGeraetAb } from '@/server/actions/geraete'
import { raeumeAltesAuf } from '@/server/aufraeumen'
import { intKennung, raeumeAuf } from './setup/basis'

const PASSWORT = 'test-passwort-1234'
const UA = {
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
}
const TAG = 24 * 60 * 60 * 1000

afterEach(async () => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  post.anmeldung.length = 0
  post.reset.length = 0
  anfrage.headers = new Headers()
  await raeumeAuf()
})

async function arbeiteNachlaufAb(): Promise<void> {
  while (nachlauf.aufgaben.length > 0) await nachlauf.aufgaben.shift()!()
}

/** Ein Konto mit Passwort; als Hof mit „Testhof A". */
async function erstelleKonto(rolle: 'FARMER' | 'CUSTOMER'): Promise<{ id: string; email: string }> {
  const kennung = intKennung(rolle === 'FARMER' ? 'hof' : 'kundin')
  const email = `${kennung}@example.com`
  await auth.api.signUpEmail({ body: { email, password: PASSWORT, name: 'Max Mustermann' } })
  const konto = await prisma.user.update({ where: { email }, data: { role: rolle, emailVerified: true }, select: { id: true } })
  if (rolle === 'FARMER') {
    await prisma.farm.create({
      data: {
        slug: kennung,
        name: 'Testhof A',
        ownerName: 'Max Mustermann',
        description: 'Erfundener Hof für die Integrationsschicht.',
        address: 'Teststraße 1',
        postalCode: '8700',
        city: 'Teststadt',
        phone: '+43 660 0000000',
        email,
        ownerId: konto.id,
      },
    })
  }
  return { id: konto.id, email }
}

type Anmeldung = { cookie: string; sitzungId: string; geraeteKeks: string | null; kennung: string | null }

/** Anmelden wie ein Browser: mit Browserangabe und, wenn da, dem Geräte-Cookie. */
async function meldeAn(email: string, ua: string, kennung?: string): Promise<Anmeldung> {
  const kopf = new Headers({ 'user-agent': ua })
  if (kennung) kopf.set('cookie', `${GERAETE_COOKIE}=${kennung}`)
  const antwort = await auth.api.signInEmail({ body: { email, password: PASSWORT }, headers: kopf, asResponse: true })
  expect(antwort.status).toBe(200)
  const kekse = antwort.headers.getSetCookie()
  // Alle Cookies der Antwort, wie ein Browser sie zurückschickt — mit
  // Cookie-Cache wäre session_data dabei und getSession fragte die Datenbank nicht.
  const cookie = kekse.map((k) => k.split(';')[0]).join('; ')
  if (!cookie.includes('session_token')) throw new Error('Anmeldung lieferte kein Sitzungs-Cookie')
  const geraeteKeks = kekse.find((k) => k.startsWith(`${GERAETE_COOKIE}=`)) ?? null
  const sitzung = await auth.api.getSession({ headers: new Headers({ cookie }) })
  if (!sitzung) throw new Error('Sitzung nicht lesbar')
  return { cookie, sitzungId: sitzung.session.id, geraeteKeks, kennung: geraeteKeks ? geraeteKeks.split(';')[0].split('=')[1] : null }
}

async function sitzungGilt(cookie: string): Promise<boolean> {
  return (await auth.api.getSession({ headers: new Headers({ cookie }) })) !== null
}

function alsGeraet(anmeldung: Anmeldung): void {
  anfrage.headers = new Headers({ cookie: anmeldung.cookie })
}

describe('Sitzung frisch aus der Datenbank (kein Cookie-Cache)', () => {
  it('eine gelöschte Sitzung ist beim nächsten getSession weg — nicht erst nach 5 Minuten', async () => {
    const hof = await erstelleKonto('FARMER')
    const a = await meldeAn(hof.email, UA.windows)
    expect(await sitzungGilt(a.cookie)).toBe(true)

    await prisma.session.delete({ where: { id: a.sitzungId } })

    expect(await sitzungGilt(a.cookie)).toBe(false)
  })

  it('eine Prüfung kostet zwei Abfragen — Sitzung über den Token, dann das Konto (gemessen an pg)', async () => {
    const hof = await erstelleKonto('FARMER')
    const a = await meldeAn(hof.email, UA.windows)
    const original = pg.Client.prototype.query
    let abfragen = 0
    // Nur zählen, nichts ändern; danach sofort zurück.
    pg.Client.prototype.query = function (this: pg.Client, ...args: unknown[]) {
      abfragen += 1
      return (original as (...a: unknown[]) => unknown).apply(this, args)
    } as typeof pg.Client.prototype.query
    try {
      await sitzungGilt(a.cookie)
    } finally {
      pg.Client.prototype.query = original
    }

    // Better Auth fragt den Join ohne experimentelle Joins als zwei Abfragen.
    expect(abfragen).toBe(2)
  })
})

describe('Neues Gerät erkennen', () => {
  it('erste Anmeldung eines Hofs: Cookie gesetzt, Gerät nur gehasht gemerkt — still, ohne Mail', async () => {
    const hof = await erstelleKonto('FARMER')

    const a = await meldeAn(hof.email, UA.windows)
    await arbeiteNachlaufAb()

    expect(a.kennung).toMatch(/^[A-Za-z0-9_-]{22}$/)
    const attribute = a.geraeteKeks!.toLowerCase()
    expect(attribute).toContain('httponly')
    expect(attribute).toContain('samesite=lax')
    expect(attribute).toContain('max-age=34560000')
    expect(attribute).toContain('path=/')
    const geraete = await prisma.bekanntesGeraet.findMany({ where: { userId: hof.id } })
    expect(geraete).toHaveLength(1)
    expect(geraete[0].name).toBe('Windows · Chrome')
    expect(geraete[0].kennungHash).toBe(geraeteKennungHash(a.kennung!))
    expect(geraete[0].kennungHash).not.toContain(a.kennung!)
    expect(post.anmeldung).toEqual([])
    expect(await prisma.einmalLink.count({ where: { userId: hof.id } })).toBe(0)
  })

  it('bekanntes Gerät: keine Mail, keine neue Zeile — ein neues Gerät danach: Mail mit Einmal-Link, nur gehasht gespeichert', async () => {
    const hof = await erstelleKonto('FARMER')
    const a = await meldeAn(hof.email, UA.windows)
    await arbeiteNachlaufAb()

    await meldeAn(hof.email, UA.windows, a.kennung!)
    expect(nachlauf.aufgaben).toHaveLength(0)
    await arbeiteNachlaufAb()
    expect(post.anmeldung).toEqual([])
    expect(await prisma.bekanntesGeraet.count({ where: { userId: hof.id } })).toBe(1)

    const b = await meldeAn(hof.email, UA.iphone)
    // Die Mail liegt im Nachlauf, nicht im Antwortpfad.
    expect(post.anmeldung).toEqual([])
    await arbeiteNachlaufAb()

    expect(b.kennung).not.toBe(a.kennung)
    expect(post.anmeldung).toHaveLength(1)
    const mail = post.anmeldung[0]
    expect(mail.email).toBe(hof.email)
    expect(mail.daten).toMatchObject({ hof: true, name: 'Testhof A', geraet: 'iPhone · Safari' })
    const token = new URL(mail.daten.link).searchParams.get('t')!
    expect(new URL(mail.daten.link).pathname).toBe(NICHT_ICH_PFAD)
    const links = await prisma.einmalLink.findMany({ where: { userId: hof.id } })
    expect(links).toHaveLength(1)
    expect(links[0].tokenHash).toBe(einmalTokenHash(token))
    expect(links[0].tokenHash).not.toContain(token)
    const neu = await prisma.bekanntesGeraet.findFirstOrThrow({ where: { userId: hof.id, name: 'iPhone · Safari' } })
    expect(links[0].zweck).toBe(`nicht-ich:${neu.id}`)
    expect(links[0].ablaufAm.getTime() - neu.erstmalsAm.getTime()).toBe(7 * TAG)
  })

  it('Kundschaft: kein Cookie, keine Zeile, keine Mail', async () => {
    const kundin = await erstelleKonto('CUSTOMER')

    const a = await meldeAn(kundin.email, UA.windows)
    await meldeAn(kundin.email, UA.iphone)
    await arbeiteNachlaufAb()

    expect(a.geraeteKeks).toBeNull()
    expect(await prisma.bekanntesGeraet.count({ where: { userId: kundin.id } })).toBe(0)
    expect(post.anmeldung).toEqual([])
  })
})

describe('Angemeldete Geräte abmelden', () => {
  it('die Liste zeigt die eigenen Sitzungen — nur Kennung, Name und Texte, nie Token oder IP', async () => {
    const hof = await erstelleKonto('FARMER')
    const a = await meldeAn(hof.email, UA.windows)
    await meldeAn(hof.email, UA.iphone)

    const zeilen = await ladeAngemeldeteGeraete(hof.id, a.sitzungId, new Date())

    expect(zeilen.map((z) => [z.name, z.dieses])).toEqual([
      ['Windows · Chrome', true],
      ['iPhone · Safari', false],
    ])
    for (const z of zeilen) expect(Object.keys(z).sort()).toEqual(['art', 'dieses', 'id', 'name', 'unterzeile'])
  })

  it('ein Gerät abmelden: nur eine eigene Sitzung — eine fremde Kennung trifft 0 Zeilen; das abgemeldete Gerät ist sofort weg', async () => {
    const hof = await erstelleKonto('FARMER')
    const fremd = await erstelleKonto('FARMER')
    const a = await meldeAn(hof.email, UA.windows)
    const b = await meldeAn(hof.email, UA.iphone)
    const f = await meldeAn(fremd.email, UA.android)
    alsGeraet(a)

    const fremdeAntwort = await meldeGeraetAb({ sitzungId: f.sitzungId })
    const eigeneAntwort = await meldeGeraetAb({ sitzungId: b.sitzungId })

    expect(fremdeAntwort).toEqual({ ok: true, abgemeldet: 0 })
    expect(eigeneAntwort).toEqual({ ok: true, abgemeldet: 1 })
    expect(await sitzungGilt(f.cookie)).toBe(true)
    expect(await sitzungGilt(b.cookie)).toBe(false)
    expect(await sitzungGilt(a.cookie)).toBe(true)
  })

  it('alle anderen abmelden: die aktuelle bleibt, die anderen sind sofort weg — fremde Konten unberührt', async () => {
    const hof = await erstelleKonto('FARMER')
    const fremd = await erstelleKonto('FARMER')
    const a = await meldeAn(hof.email, UA.windows)
    const b = await meldeAn(hof.email, UA.iphone)
    const c = await meldeAn(hof.email, UA.android)
    const f = await meldeAn(fremd.email, UA.android)
    alsGeraet(a)

    const antwort = await meldeAlleAnderenAb()

    expect(antwort).toEqual({ ok: true, abgemeldet: 2 })
    expect(await sitzungGilt(a.cookie)).toBe(true)
    expect(await sitzungGilt(b.cookie)).toBe(false)
    expect(await sitzungGilt(c.cookie)).toBe(false)
    expect(await sitzungGilt(f.cookie)).toBe(true)
  })

  it('ohne gültige Sitzung: nichts wird gelöscht', async () => {
    const hof = await erstelleKonto('FARMER')
    const a = await meldeAn(hof.email, UA.windows)
    const b = await meldeAn(hof.email, UA.iphone)
    alsGeraet(a)
    await prisma.session.delete({ where: { id: a.sitzungId } })

    expect(await meldeAlleAnderenAb()).toEqual({ error: 'Bitte melde dich neu an.' })
    expect(await meldeGeraetAb({ sitzungId: b.sitzungId })).toEqual({ error: 'Bitte melde dich neu an.' })
    expect(await sitzungGilt(b.cookie)).toBe(true)
  })
})

describe('„Das war ich nicht"', () => {
  async function hofMitNeuemGeraet(): Promise<{ hof: { id: string; email: string }; a: Anmeldung; b: Anmeldung; token: string }> {
    const hof = await erstelleKonto('FARMER')
    const a = await meldeAn(hof.email, UA.windows)
    const b = await meldeAn(hof.email, UA.iphone)
    await arbeiteNachlaufAb()
    const token = new URL(post.anmeldung[0].daten.link).searchParams.get('t')!
    post.anmeldung.length = 0
    return { hof, a, b, token }
  }

  it('Öffnen des Links ändert nichts — die Seite zeigt nur Gerät und Zeitpunkt', async () => {
    const { hof, a, b, token } = await hofMitNeuemGeraet()

    const stand = await ladeNichtIch(token, new Date())
    const { default: NichtIchSeite } = await import('@/app/sicherheit/nicht-ich/page')
    await NichtIchSeite({ searchParams: Promise.resolve({ t: token }) })

    expect(stand).toMatchObject({ gueltig: true, geraet: { name: 'iPhone · Safari' } })
    expect(await prisma.einmalLink.findFirstOrThrow({ where: { userId: hof.id } })).toMatchObject({ benutztAm: null })
    expect(await sitzungGilt(a.cookie)).toBe(true)
    expect(await sitzungGilt(b.cookie)).toBe(true)
  })

  it('der Knopf meldet ALLE Geräte des Kontos ab und schickt einen Link für ein neues Passwort — fremde Konten bleiben', async () => {
    const { hof, a, b, token } = await hofMitNeuemGeraet()
    const fremd = await erstelleKonto('FARMER')
    const f = await meldeAn(fremd.email, UA.android)

    const antwort = await meldeAllesAbNichtIch({ token })
    await arbeiteNachlaufAb()

    expect(antwort).toEqual({ ok: true, passwortMail: true })
    expect(await prisma.session.count({ where: { userId: hof.id } })).toBe(0)
    expect(await sitzungGilt(a.cookie)).toBe(false)
    expect(await sitzungGilt(b.cookie)).toBe(false)
    expect(await sitzungGilt(f.cookie)).toBe(true)
    expect(post.reset).toEqual([hof.email])
    expect((await prisma.einmalLink.findFirstOrThrow({ where: { userId: hof.id } })).benutztAm).toBeInstanceOf(Date)
    // Kein Neuladen der Seite: Sie fände den Link verbraucht und zeigte
    // „gilt nicht mehr" statt „Alle Geräte sind abgemeldet" (bei den Bildern gefunden).
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('ein zweites Mal: neutral, nichts passiert — auch nicht mit einer neuen Anmeldung', async () => {
    const { hof, token } = await hofMitNeuemGeraet()
    await meldeAllesAbNichtIch({ token })
    await arbeiteNachlaufAb()
    post.reset.length = 0
    const neu = await meldeAn(hof.email, UA.windows)

    const zweite = await meldeAllesAbNichtIch({ token })
    await arbeiteNachlaufAb()

    expect(zweite).toEqual({ error: 'ungueltig' })
    expect(await sitzungGilt(neu.cookie)).toBe(true)
    expect(post.reset).toEqual([])
    expect(await ladeNichtIch(token, new Date())).toEqual({ gueltig: false })
  })

  it('zwei gleichzeitige Klicks: genau einer löst ein', async () => {
    const { token } = await hofMitNeuemGeraet()

    const antworten = await Promise.all([meldeAllesAbNichtIch({ token }), meldeAllesAbNichtIch({ token })])
    await arbeiteNachlaufAb()

    expect(antworten.filter((x) => 'ok' in x)).toHaveLength(1)
    expect(post.reset).toHaveLength(1)
  })

  it('ein abgelaufener oder falscher Link: neutral, nichts passiert', async () => {
    const hof = await erstelleKonto('FARMER')
    const a = await meldeAn(hof.email, UA.windows)
    const abgelaufen = await erzeugeEinmalLink({ userId: hof.id, zweck: 'nicht-ich:x', jetzt: new Date(Date.now() - 8 * TAG) })
    const falsch = 'A'.repeat(43)

    expect(await ladeNichtIch(abgelaufen, new Date())).toEqual({ gueltig: false })
    expect(await meldeAllesAbNichtIch({ token: abgelaufen })).toEqual({ error: 'ungueltig' })
    expect(await meldeAllesAbNichtIch({ token: falsch })).toEqual({ error: 'ungueltig' })
    expect(await meldeAllesAbNichtIch({ token: 'kurz' })).toEqual({ error: 'ungueltig' })
    await arbeiteNachlaufAb()
    expect(await sitzungGilt(a.cookie)).toBe(true)
    expect(post.reset).toEqual([])
  })

  it('ein Link für einen anderen Zweck gilt hier nicht', async () => {
    const hof = await erstelleKonto('FARMER')
    const a = await meldeAn(hof.email, UA.windows)
    const anderer = await erzeugeEinmalLink({ userId: hof.id, zweck: 'admin-einrichten:s1', jetzt: new Date() })

    expect(await meldeAllesAbNichtIch({ token: anderer })).toEqual({ error: 'ungueltig' })
    expect(await sitzungGilt(a.cookie)).toBe(true)
  })
})

describe('Aufräumen der Einmal-Links', () => {
  it('löscht abgelaufene und seit 7 Tagen benutzte — offene und frisch benutzte bleiben', async () => {
    const hof = await erstelleKonto('FARMER')
    const jetzt = new Date()
    const offen = await erzeugeEinmalLink({ userId: hof.id, zweck: 'nicht-ich:a', jetzt })
    const abgelaufen = await erzeugeEinmalLink({ userId: hof.id, zweck: 'nicht-ich:b', jetzt: new Date(jetzt.getTime() - 8 * TAG) })
    const altBenutzt = await erzeugeEinmalLink({ userId: hof.id, zweck: 'nicht-ich:c', jetzt })
    const frischBenutzt = await erzeugeEinmalLink({ userId: hof.id, zweck: 'nicht-ich:d', jetzt })
    await prisma.einmalLink.update({ where: { tokenHash: einmalTokenHash(altBenutzt) }, data: { benutztAm: new Date(jetzt.getTime() - 8 * TAG) } })
    await prisma.einmalLink.update({ where: { tokenHash: einmalTokenHash(frischBenutzt) }, data: { benutztAm: new Date(jetzt.getTime() - TAG) } })

    const ergebnis = await raeumeAltesAuf(jetzt)

    expect(ergebnis.einmalLinks).toBeGreaterThanOrEqual(2)
    const uebrig = await prisma.einmalLink.findMany({ where: { userId: hof.id }, select: { tokenHash: true } })
    expect(uebrig.map((z) => z.tokenHash).sort()).toEqual([einmalTokenHash(offen), einmalTokenHash(frischBenutzt)].sort())
    expect(uebrig.map((z) => z.tokenHash)).not.toContain(einmalTokenHash(abgelaufen))
  })
})

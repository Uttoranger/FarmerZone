/**
 * E-Mail-Bestätigung für neue Höfe gegen ein ECHTES Postgres und echtes
 * Better Auth (S3, Nachtlauf Nr. 17b).
 *
 * Beweist:
 *  - Registrieren mit Passwort schickt die Mail NACH der Antwort; der Link
 *    führt auf /verify mit einem signierten Token (keine ratbare ID) und meldet
 *    weiterhin an (Anmelden bleibt ohne Bestätigung möglich).
 *  - Der Knopf (bestaetigeEmail) setzt `emailVerified` in der Datenbank und
 *    legt keine Sitzung an; ein gefälschter Token ändert nichts.
 *  - Better Auths HTTP-Wege sind zu: GET /verify-email bestätigt nicht (ein
 *    Link-Scanner kann nichts auslösen), POST /send-verification-email
 *    schickt nichts.
 *  - „Erneut senden": Bremse in der Datenbank — zweimal hintereinander geht
 *    nur einmal, zwei gleichzeitige Klicks ergeben genau eine Mail.
 *  - Upload-Sperre und Freigabe lesen den FRISCHEN Stand: Nach dem Bestätigen
 *    gibt die Upload-Route die Hof-Kennung sofort heraus, obwohl die Sitzung
 *    (Cookie-Cache) noch „unbestätigt" sagt.
 *  - Ein bestätigter Hof bekommt trotzdem keinen Anmeldecode (E7 bleibt).
 *  - Konten vor dem Stichtag bleiben unberührt: kein „Erneut senden",
 *    Upload frei.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { EMAIL_BESTAETIGUNG_STICHTAG, versandKennung } from '@/lib/email-bestaetigung'
import { intKennung, raeumeAuf } from './setup/basis'

const anfrage = vi.hoisted(() => ({ headers: new Headers() }))
const versand = vi.hoisted(() => ({ links: [] as Array<{ email: string; link: string }> }))
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => anfrage.headers) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@/lib/email', () => ({
  sendEmailBestaetigung: vi.fn(async (email: string, link: string) => {
    versand.links.push({ email, link })
    return { id: 'int-mail' }
  }),
  sendAnmeldeCodeEmail: vi.fn(async () => ({ id: 'int-mail' })),
  sendMagicLinkEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

async function arbeiteNachlaufAb(): Promise<void> {
  while (nachlauf.aufgaben.length > 0) await nachlauf.aufgaben.shift()?.()
}

type Auth = (typeof import('@/lib/auth'))['auth']
let auth: Auth
let aktionen: typeof import('@/server/actions/email-bestaetigung')
let kennungGET: (typeof import('@/app/api/upload/token/route'))['GET']

beforeAll(async () => {
  auth = (await import('@/lib/auth')).auth
  aktionen = await import('@/server/actions/email-bestaetigung')
  kennungGET = (await import('@/app/api/upload/token/route')).GET
}, 30_000)

afterEach(async () => {
  anfrage.headers = new Headers()
  versand.links.length = 0
  nachlauf.aufgaben.length = 0
  // Better Auth vergibt die Konto-IDs selbst (ohne int-Präfix) — die Zeilen
  // der Bremse hängen an der ID, also über die Adressen der Testkonten.
  const konten = await prisma.user.findMany({ where: { email: { startsWith: 'int-' } }, select: { id: true } })
  await prisma.verification.deleteMany({
    where: { OR: [{ identifier: { contains: 'otp-int-' } }, { identifier: { in: konten.map((k) => versandKennung(k.id)) } }] },
  })
  await raeumeAuf()
})

const PASSWORT = 'test-passwort-1234'
const NACH_STICHTAG = new Date(EMAIL_BESTAETIGUNG_STICHTAG.getTime() + 60_000)
const VOR_STICHTAG = new Date(EMAIL_BESTAETIGUNG_STICHTAG.getTime() - 60_000)

/**
 * Ein neuer Hof wie aus registerFarmer: Konto mit Passwort, Rolle FARMER,
 * angemeldet (Cookie in der Anfrage). Die Adresse trägt das int-Präfix,
 * danach räumt raeumeAuf auf. `angelegt` setzt createdAt: Der Stichtag kann
 * in der Zukunft des Laufs liegen.
 */
async function neuerHof(angelegt: Date = NACH_STICHTAG, mitHof = false): Promise<{ id: string; email: string }> {
  const email = `${intKennung('neu')}@example.com`
  await auth.api.signUpEmail({ body: { email, password: PASSWORT, name: 'Max Mustermann' } })
  const konto = await prisma.user.update({ where: { email }, data: { role: 'FARMER', createdAt: angelegt }, select: { id: true } })
  // Anmelden NACH dem Setzen der Rolle — wie das Registrieren-Formular
  // (registerFarmer, dann signIn.email): Die Upload-Route liest die Rolle
  // aus der Sitzung.
  const { headers } = await auth.api.signInEmail({ body: { email, password: PASSWORT }, returnHeaders: true })
  anfrage.headers = new Headers({ cookie: headers.getSetCookie().map((z) => z.split(';')[0]).join('; ') })
  if (mitHof) {
    await prisma.farm.create({
      data: {
        slug: intKennung('hof'),
        name: 'Hof Test',
        ownerName: 'Max Mustermann',
        description: 'Erfundener Hof.',
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

function tokenAus(link: string): string {
  const url = new URL(link)
  expect(url.pathname).toBe('/verify')
  const token = url.searchParams.get('token')
  if (!token) throw new Error('Kein Token im Link')
  return token
}

describe('Registrieren und Bestätigen', () => {
  it('die Mail geht nach der Antwort raus, mit Link auf /verify und signiertem Token', async () => {
    const { email } = await neuerHof()
    expect(versand.links).toHaveLength(0)
    await arbeiteNachlaufAb()
    expect(versand.links).toHaveLength(1)
    const { link } = versand.links[0] ?? { link: '' }
    expect(versand.links[0]?.email).toBe(email)
    // Ein JWT (drei Teile), keine Konto-ID im Link.
    expect(tokenAus(link).split('.')).toHaveLength(3)
    expect(link).not.toContain('verify-email')
  })

  it('anmelden geht ohne Bestätigung', async () => {
    const { email } = await neuerHof()
    const antwort = await auth.api.signInEmail({ body: { email, password: PASSWORT } })
    expect(antwort.user.email).toBe(email)
    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(false)
  })

  it('der Knopf bestätigt in der Datenbank — ohne neue Sitzung', async () => {
    const { id } = await neuerHof()
    await arbeiteNachlaufAb()
    const token = tokenAus(versand.links[0]?.link ?? '')
    const sitzungenVorher = await prisma.session.count({ where: { userId: id } })

    expect(await aktionen.bestaetigeEmail({ token })).toEqual({ ok: true })

    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).emailVerified).toBe(true)
    expect(await prisma.session.count({ where: { userId: id } })).toBe(sitzungenVorher)
  })

  it('ein gefälschter Token ändert nichts', async () => {
    const { id } = await neuerHof()
    await arbeiteNachlaufAb()
    const echt = tokenAus(versand.links[0]?.link ?? '')
    const gefaelscht = `${echt.slice(0, -4)}AAAA`

    expect(await aktionen.bestaetigeEmail({ token: gefaelscht })).toMatchObject({ code: 'UNGUELTIG' })
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).emailVerified).toBe(false)
  })
})

describe('HTTP-Wege von Better Auth sind zu', () => {
  const basis = 'http://localhost:3000/api/auth'

  it('GET /verify-email mit gültigem Token bestätigt NICHT (Link-Scanner)', async () => {
    const { id } = await neuerHof()
    await arbeiteNachlaufAb()
    const token = tokenAus(versand.links[0]?.link ?? '')

    const antwort = await auth.handler(new Request(`${basis}/verify-email?token=${token}`))

    expect(antwort.status).toBe(404)
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).emailVerified).toBe(false)
  })

  it('POST /send-verification-email schickt nichts', async () => {
    const { email } = await neuerHof()
    await arbeiteNachlaufAb()
    versand.links.length = 0

    const antwort = await auth.handler(
      new Request(`${basis}/send-verification-email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ email }),
      })
    )
    await arbeiteNachlaufAb()

    expect(antwort.status).toBe(404)
    expect(versand.links).toHaveLength(0)
  })
})

describe('Erneut senden — Bremse in der Datenbank', () => {
  it('schickt einen neuen Link, ein zweiter Klick gleich danach wartet', async () => {
    const { email } = await neuerHof()
    await arbeiteNachlaufAb()
    versand.links.length = 0

    expect(await aktionen.sendeBestaetigungErneut()).toEqual({ ok: true })
    const zweiter = await aktionen.sendeBestaetigungErneut()
    await arbeiteNachlaufAb()

    expect(zweiter).toMatchObject({ warteSekunden: expect.any(Number) })
    expect(versand.links.map((v) => v.email)).toEqual([email])
  })

  it('gleichzeitige Klicks ergeben genau eine Mail', async () => {
    await neuerHof()
    await arbeiteNachlaufAb()
    versand.links.length = 0

    const antworten = await Promise.all(Array.from({ length: 5 }, () => aktionen.sendeBestaetigungErneut()))
    await arbeiteNachlaufAb()

    expect(antworten.filter((a) => 'ok' in a)).toHaveLength(1)
    expect(versand.links).toHaveLength(1)
  })

  it('nach dem Bestätigen: keine Mail mehr, auch wenn die Sitzung noch „unbestätigt" sagt', async () => {
    const { id } = await neuerHof()
    await arbeiteNachlaufAb()
    expect(await aktionen.bestaetigeEmail({ token: tokenAus(versand.links[0]?.link ?? '') })).toEqual({ ok: true })
    versand.links.length = 0

    expect((await auth.api.getSession({ headers: anfrage.headers }))?.user.emailVerified).toBe(false)
    expect(await aktionen.sendeBestaetigungErneut()).toEqual({ ok: true, schonBestaetigt: true })
    await arbeiteNachlaufAb()
    expect(versand.links).toHaveLength(0)
    expect(await prisma.verification.count({ where: { identifier: versandKennung(id) } })).toBe(0)
  })

  it('Konto vor dem Stichtag: keine Mail', async () => {
    await neuerHof(VOR_STICHTAG)
    await arbeiteNachlaufAb()
    versand.links.length = 0

    expect(await aktionen.sendeBestaetigungErneut()).toMatchObject({ error: expect.any(String) })
    await arbeiteNachlaufAb()
    expect(versand.links).toHaveLength(0)
  })
})

describe('Upload-Sperre nach frischem Stand', () => {
  it('vor dem Bestätigen keine Hof-Kennung, danach sofort — trotz veralteter Sitzung', async () => {
    await neuerHof(NACH_STICHTAG, true)
    await arbeiteNachlaufAb()

    expect((await kennungGET()).status).toBe(403)

    expect(await aktionen.bestaetigeEmail({ token: tokenAus(versand.links[0]?.link ?? '') })).toEqual({ ok: true })
    expect((await auth.api.getSession({ headers: anfrage.headers }))?.user.emailVerified).toBe(false)
    const antwort = await kennungGET()
    expect(antwort.status).toBe(200)
    expect(await antwort.json()).toMatchObject({ farmId: expect.any(String) })
  })

  it('Konto vor dem Stichtag lädt ohne Bestätigung hoch (bestehende Höfe unberührt)', async () => {
    await neuerHof(VOR_STICHTAG, true)
    expect((await kennungGET()).status).toBe(200)
  })
})

describe('E7 bleibt: ein bestätigter Hof bekommt keinen Anmeldecode', () => {
  it('kein Code wird angelegt — auch nach dem Bestätigen', async () => {
    const { email } = await neuerHof()
    await arbeiteNachlaufAb()
    expect(await aktionen.bestaetigeEmail({ token: tokenAus(versand.links[0]?.link ?? '') })).toEqual({ ok: true })

    await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
    await arbeiteNachlaufAb()

    expect(await prisma.verification.count({ where: { identifier: `sign-in-otp-${email}` } })).toBe(0)
  })
})

/**
 * Die Login-Bremse über alle Instanzen (Register R1, Ergänzung Nr. 125) gegen ein ECHTES Postgres —
 * die Tabelle `RateLimitZaehler` ist die Aussage.
 *
 * Beweist:
 *  - Zwei „Instanzen" (zwei getrennt geladene Module, jede mit eigenem Ersatz im Arbeitsspeicher)
 *    zählen über die Tabelle zusammen. Gegenprobe: Mit dem Arbeitsspeicher allein — dem Weg vor
 *    Nr. 125 — ließe dasselbe Spiel jede Instanz die volle Zahl durch, der Test wäre rot.
 *  - 20 gleichzeitige Versuche bei Grenze 3 ergeben genau 3 erlaubte, der Zähler steht auf 20.
 *  - Ein neues Fenster setzt zurück (neue Zeile, `ablauf` = Fensterende für den Cron).
 *  - In der Tabelle steht nur „auth:" + gekürzter HMAC — keine IP, kein Pfad.
 *  - Über Better Auth selbst (auth.handler, NODE_ENV=production): Zwei geladene auth-Module teilen
 *    sich die Grenze der Anmeldung; der vierte Versuch bekommt 429 mit X-Retry-After.
 *
 * Feste Uhr nur als Parameter auf einem Zeitpunkt in der Vergangenheit; der HTTP-Fall läuft auf der
 * Systemuhr und wartet dafür ein frisches Fenster ab. Aufräumen: genau die Schlüssel, die die Fälle
 * erzeugen (HMAC aus Zweck und Merkmal).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { DB_BREMSEN, adressMerkmal, bremsSchluessel } from '@/lib/bremse-datenbank'
import { intKennung, raeumeAuf } from './setup/basis'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: () => {} }))
vi.mock('@/lib/email', () => ({
  sendAnmeldeCodeEmail: vi.fn(async () => ({ id: 'int-mail' })),
  sendMagicLinkEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

const GEHEIMNIS = process.env.BETTER_AUTH_SECRET!
const REGEL = { window: 10, max: 3 }
/** Mitten in einem 10-s-Fenster, in der Vergangenheit (Wache der Integrationsuhr). */
const MITTE = new Date('2026-10-07T12:00:05.000Z')

const erzeugt: string[] = []
/** Der Schlüssel in der Tabelle für einen Schlüssel von Better Auth — und merken fürs Aufräumen. */
function tabellenSchluessel(betterAuthSchluessel: string): string {
  const s = bremsSchluessel(GEHEIMNIS, 'auth', betterAuthSchluessel)
  erzeugt.push(s)
  return s
}

afterEach(async () => {
  await prisma.rateLimitZaehler.deleteMany({ where: { schluessel: { in: erzeugt } } })
  erzeugt.length = 0
  vi.unstubAllEnvs()
  await raeumeAuf()
})

type Modul = typeof import('@/server/auth-bremse')

/** Zwei getrennt geladene Module — jede „Instanz" mit eigenem Modul-Zustand. */
async function zweiInstanzen(): Promise<[Modul, Modul]> {
  vi.resetModules()
  const a = await import('@/server/auth-bremse')
  vi.resetModules()
  const b = await import('@/server/auth-bremse')
  expect(a).not.toBe(b)
  return [a, b]
}

/** Das Spiel: A, A, B, B, A — was jede Instanz erlaubt. */
async function spiele(a: () => Promise<boolean>, b: () => Promise<boolean>): Promise<boolean[]> {
  const ergebnisse: boolean[] = []
  for (const zug of [a, a, b, b, a]) ergebnisse.push(await zug())
  return ergebnisse
}

describe('Zählen über alle Instanzen', () => {
  it('zwei Instanzen zählen über die Tabelle zusammen — Gegenprobe: mit dem Arbeitsspeicher allein wäre das rot', async () => {
    const schluessel = '203.0.113.21|/sign-in/email'
    tabellenSchluessel(schluessel)
    const [a, b] = await zweiInstanzen()

    const ueberTabelle = await spiele(
      async () => (await a.verbrauche(schluessel, REGEL, MITTE)).allowed,
      async () => (await b.verbrauche(schluessel, REGEL, MITTE)).allowed
    )
    expect(ueberTabelle).toEqual([true, true, true, false, false])
    const zeile = await prisma.rateLimitZaehler.findFirst({ where: { schluessel: tabellenSchluessel(schluessel) } })
    expect(zeile?.zaehler).toBe(5)

    // Gegenprobe: derselbe Ablauf, aber jede Instanz zählt nur in ihrem eigenen Speicher (wie vor Nr. 125).
    const speicherA = a.neuerAuthBremseZustand().ersatz
    const speicherB = b.neuerAuthBremseZustand().ersatz
    const nurSpeicher = await spiele(
      async () => a.zaehleImSpeicher(speicherA, schluessel, 10_000, MITTE) <= REGEL.max,
      async () => b.zaehleImSpeicher(speicherB, schluessel, 10_000, MITTE) <= REGEL.max
    )
    expect(nurSpeicher).not.toEqual(ueberTabelle)
    expect(nurSpeicher).toEqual([true, true, true, true, true])
  })

  it('20 gleichzeitige Versuche bei Grenze 3 ergeben genau 3 erlaubte — kein verlorenes Hochzählen', async () => {
    const schluessel = '203.0.113.22|/sign-in/email'
    const [a, b] = await zweiInstanzen()
    const ergebnisse = await Promise.all(
      Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? a : b).verbrauche(schluessel, REGEL, MITTE))
    )
    expect(ergebnisse.filter((e) => e.allowed)).toHaveLength(3)
    expect(ergebnisse.filter((e) => !e.allowed).every((e) => e.retryAfter === 5)).toBe(true)
    const zeile = await prisma.rateLimitZaehler.findFirst({ where: { schluessel: tabellenSchluessel(schluessel) } })
    expect(zeile?.zaehler).toBe(20)
  })

  it('ein neues Fenster setzt zurück: neue Zeile, Ablauf am Fensterende', async () => {
    const schluessel = '203.0.113.23|/sign-in/email'
    const [a] = await zweiInstanzen()
    for (let i = 0; i < 4; i += 1) await a.verbrauche(schluessel, REGEL, MITTE)
    expect((await a.verbrauche(schluessel, REGEL, MITTE)).allowed).toBe(false)

    const naechstes = new Date('2026-10-07T12:00:10.000Z')
    expect(await a.verbrauche(schluessel, REGEL, naechstes)).toEqual({ allowed: true, retryAfter: null })
    const zeilen = await prisma.rateLimitZaehler.findMany({
      where: { schluessel: tabellenSchluessel(schluessel) },
      orderBy: { fensterStart: 'asc' },
    })
    expect(zeilen.map((z) => [z.fensterStart.toISOString(), z.zaehler, z.ablauf.toISOString()])).toEqual([
      ['2026-10-07T12:00:00.000Z', 5, '2026-10-07T12:00:10.000Z'],
      ['2026-10-07T12:00:10.000Z', 1, '2026-10-07T12:00:20.000Z'],
    ])
  })

  it('in der Tabelle steht nur „auth:" und der gekürzte HMAC — keine IP, kein Pfad', async () => {
    const ip = '203.0.113.24'
    const schluessel = `${ip}|/email-otp/send-verification-otp`
    const erwartet = tabellenSchluessel(schluessel)
    const [a] = await zweiInstanzen()
    await a.verbrauche(schluessel, { window: 60, max: 3 }, MITTE)
    const zeilen = await prisma.rateLimitZaehler.findMany({ where: { schluessel: { startsWith: 'auth:' }, fensterStart: new Date('2026-10-07T12:00:00.000Z') } })
    expect(zeilen.map((z) => z.schluessel)).toContain(erwartet)
    for (const z of zeilen) {
      expect(z.schluessel).toMatch(/^auth:[0-9a-f]{32}$/)
      expect(z.schluessel).not.toContain('203.0.113')
      expect(z.schluessel).not.toContain('/email-otp')
    }
  })
})

describe('Über Better Auth in Produktion', () => {
  type Auth = (typeof import('@/lib/auth'))['auth']
  const basis = 'http://localhost:3000/api/auth'

  /** Bis zum Ende des 10-s-Fensters bleiben genug Sekunden für fünf Versuche — sonst aufs nächste warten. */
  async function frischesFenster(): Promise<void> {
    const rest = 10_000 - (Date.now() % 10_000)
    if (rest < 8_000) await new Promise((fertig) => setTimeout(fertig, rest + 50))
  }

  it('zwei geladene auth-Module teilen sich die Grenze der Anmeldung — der vierte Versuch bekommt 429 mit X-Retry-After', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const ip = '203.0.113.31'
    const email = `${intKennung('niemand')}@example.com`
    tabellenSchluessel(`${ip}|/sign-in/email`)
    // Was die Hooks der Anmeldung je Adresse und je IP zählen, kommt mit weg.
    for (const bremse of Object.values(DB_BREMSEN)) {
      erzeugt.push(bremsSchluessel(GEHEIMNIS, bremse.zweck, adressMerkmal(email)), bremsSchluessel(GEHEIMNIS, bremse.zweck, ip))
    }

    vi.resetModules()
    const authA: Auth = (await import('@/lib/auth')).auth
    vi.resetModules()
    const authB: Auth = (await import('@/lib/auth')).auth
    expect(authA).not.toBe(authB)

    const anmelden = (auth: Auth) =>
      auth.handler(
        new Request(`${basis}/sign-in/email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': ip },
          body: JSON.stringify({ email, password: 'falschesPasswortAbc' }),
        })
      )

    await frischesFenster()
    const antworten = []
    for (const auth of [authA, authA, authB, authB, authA]) antworten.push(await anmelden(auth))

    const status = antworten.map((a) => a.status)
    expect(status.slice(0, 3).every((s) => s !== 429), status.join(',')).toBe(true)
    expect(status.slice(3)).toEqual([429, 429])
    const warten = Number(antworten[3].headers.get('X-Retry-After'))
    expect(warten).toBeGreaterThanOrEqual(1)
    expect(warten).toBeLessThanOrEqual(10)
  }, 120_000)
})

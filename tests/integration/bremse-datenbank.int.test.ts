/**
 * Die Bremse über alle Instanzen (Register R1, Nr. 40) gegen ein ECHTES
 * Postgres — die Tabelle `RateLimitZaehler` ist die Aussage.
 *
 * Beweist:
 *  - Die Migration 20261007200000_rate_limit_db ist angewandt (global-setup
 *    fährt `migrate deploy`): Tabelle mit Schlüssel, Fenster, Zähler, Ablauf,
 *    zusammengesetztem Primärschlüssel, Index auf ablauf und RLS an; ein
 *    zweiter Lauf der Migration ändert nichts (wiederholbar).
 *  - Zwei „Instanzen" (zwei frisch geladene Module ohne gemeinsamen
 *    Speicher) zählen in dieselbe Zeile: Was die eine verbraucht hat, fehlt
 *    der anderen.
 *  - Nebenläufigkeit: 20 gleichzeitige Aufrufe bei Grenze 5 → genau 5
 *    erlaubt, Zähler 20 (atomar, kein verlorenes Hochzählen).
 *  - Fensterwechsel: Im nächsten Fenster ist wieder frei — eine neue Zeile.
 *  - In der Tabelle steht keine IP und keine Adresse, nur Zweck + HMAC.
 *  - Der bestehende Cron (api/cron/cleanup-reservations) räumt abgelaufene
 *    Zähler weg und lässt laufende stehen.
 *  - Anmeldecode über HTTP in Produktion: Der Hook zählt jede Anforderung in
 *    der Tabelle (HMAC der IP); hat eine andere Instanz die 3 Codes einer IP
 *    schon verbraucht, lehnt diese Instanz mit 429 ab und legt keinen Code
 *    an — eine frische IP kommt durch.
 *
 * Aufräumen: Zwecke dieser Tests beginnen mit `int-` (Präfix-Regel aus
 * basis.ts); die Zeilen des HTTP-Tests werden über ihren Schlüssel gelöscht.
 */
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bremsSchluessel, DB_BREMSEN, fensterBeginn, type DbBremse } from '@/lib/bremse-datenbank'
import { bremseUeberAlleInstanzen, zaehleVersuche } from '@/server/bremse-datenbank'
import { intKennung, raeumeAuf } from './setup/basis'

const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendAnmeldeCodeEmail: vi.fn(async () => ({ id: 'int-mail' })),
  sendMagicLinkEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

const MIGRATION = readFileSync(
  join(process.cwd(), 'prisma', 'migrations', '20261007200000_rate_limit_db', 'migration.sql'),
  'utf8'
)
const GEHEIMNIS = process.env.BETTER_AUTH_SECRET!

/** Eine Testbremse mit eigenem Zweck (Präfix `int-`, damit das Aufräumen sie findet). */
function testBremse(max: number, fensterMs = 60_000): DbBremse {
  return { zweck: intKennung('bremse'), max, fensterMs }
}

/** Ein fester Zeitpunkt mitten in einem Fenster — kein Fensterwechsel während des Tests. */
const MITTE = new Date('2026-10-07T12:00:30.000Z')

/** Die HTTP-Tests laufen auf der Systemuhr: Liegt das Ende des Fensters zu nah, aufs nächste warten. */
async function frischesFenster(fensterMs: number): Promise<void> {
  const rest = fensterMs - (Date.now() % fensterMs)
  if (rest < 15_000) await new Promise((fertig) => setTimeout(fertig, rest + 50))
}

const geloeschteSchluessel: string[] = []

afterEach(async () => {
  await prisma.rateLimitZaehler.deleteMany({
    where: { OR: [{ schluessel: { startsWith: 'int-' } }, { schluessel: { in: geloeschteSchluessel } }] },
  })
  geloeschteSchluessel.length = 0
  nachlauf.aufgaben.length = 0
  vi.unstubAllEnvs()
  await raeumeAuf()
})

afterAll(async () => {
  await prisma.verification.deleteMany({ where: { identifier: { contains: 'otp-int-' } } })
})

describe('Tabelle RateLimitZaehler', () => {
  it('existiert mit Schlüssel, Fenster, Zähler (Default 0) und Ablauf — alle NOT NULL', async () => {
    const spalten = await prisma.$queryRaw<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]>`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'RateLimitZaehler'
      ORDER BY ordinal_position`
    expect(spalten).toEqual([
      { column_name: 'schluessel', data_type: 'text', is_nullable: 'NO', column_default: null },
      { column_name: 'fensterStart', data_type: 'timestamp without time zone', is_nullable: 'NO', column_default: null },
      { column_name: 'zaehler', data_type: 'integer', is_nullable: 'NO', column_default: '0' },
      { column_name: 'ablauf', data_type: 'timestamp without time zone', is_nullable: 'NO', column_default: null },
    ])
  })

  it('RLS ist an, Primärschlüssel (schluessel, fensterStart) und Index auf ablauf stehen', async () => {
    const [tabelle] = await prisma.$queryRaw<{ relrowsecurity: boolean }[]>`
      SELECT relrowsecurity FROM pg_class WHERE oid = '"public"."RateLimitZaehler"'::regclass`
    expect(tabelle.relrowsecurity).toBe(true)
    const indizes = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'RateLimitZaehler' ORDER BY indexname`
    expect(indizes.map((i) => i.indexname)).toEqual(['RateLimitZaehler_ablauf_idx', 'RateLimitZaehler_pkey'])
    expect(indizes[1].indexdef).toMatch(/UNIQUE INDEX .*\(schluessel, "fensterStart"\)/)
  })

  it('ein zweiter Lauf der Migration ändert nichts (wiederholbar) — auch keine bestehende Zeile', async () => {
    const bremse = testBremse(5)
    await zaehleVersuche([{ bremse, merkmal: '192.0.2.1' }], MITTE)
    // Prisma fährt eine Migration nicht in einer Transaktion. Erst die
    // Kommentare weg (sie enthalten selbst Semikolons), dann je Anweisung.
    for (const anweisung of MIGRATION.replace(/--.*$/gm, '')
      .split(';')
      .map((teil) => teil.trim())
      .filter(Boolean)) {
      await prisma.$executeRawUnsafe(anweisung)
    }
    const zeilen = await prisma.rateLimitZaehler.findMany({ where: { schluessel: { startsWith: bremse.zweck } } })
    expect(zeilen.map((z) => z.zaehler)).toEqual([1])
  })
})

describe('Zählen über alle Instanzen', () => {
  it('zwei Instanzen ohne gemeinsamen Speicher teilen sich die Grenze', async () => {
    const bremse = testBremse(3)
    const versuch = [{ bremse, merkmal: '192.0.2.10' }]
    const instanzA = await import('@/server/bremse-datenbank')
    vi.resetModules()
    const instanzB = await import('@/server/bremse-datenbank')
    expect(instanzA).not.toBe(instanzB)

    expect(await instanzA.bremseUeberAlleInstanzen(versuch, MITTE)).toBe(true)
    expect(await instanzA.bremseUeberAlleInstanzen(versuch, MITTE)).toBe(true)
    expect(await instanzB.bremseUeberAlleInstanzen(versuch, MITTE)).toBe(true)
    expect(await instanzB.bremseUeberAlleInstanzen(versuch, MITTE)).toBe(false)
    expect(await instanzA.bremseUeberAlleInstanzen(versuch, MITTE)).toBe(false)
    // Gegenprobe: ein anderes Merkmal ist frei.
    expect(await instanzB.bremseUeberAlleInstanzen([{ bremse, merkmal: '192.0.2.11' }], MITTE)).toBe(true)
  })

  it('20 gleichzeitige Aufrufe bei Grenze 5: genau 5 erlaubt, der Zähler steht auf 20', async () => {
    const bremse = testBremse(5)
    const ergebnisse = await Promise.all(
      Array.from({ length: 20 }, () => bremseUeberAlleInstanzen([{ bremse, merkmal: '192.0.2.20' }], MITTE))
    )
    expect(ergebnisse.filter(Boolean)).toHaveLength(5)
    const zeilen = await prisma.rateLimitZaehler.findMany({ where: { schluessel: { startsWith: bremse.zweck } } })
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].zaehler).toBe(20)
  })

  it('mehrere Merkmale in einem Aufruf: jedes zählt, eines über der Grenze bremst', async () => {
    const eng = testBremse(1)
    const weit = testBremse(10)
    const versuche = [
      { bremse: weit, merkmal: '192.0.2.30' },
      { bremse: eng, merkmal: 'int-sitzung-30' },
    ]
    expect(await bremseUeberAlleInstanzen(versuche, MITTE)).toBe(true)
    expect(await bremseUeberAlleInstanzen(versuche, MITTE)).toBe(false)
    expect(await zaehleVersuche(versuche, MITTE)).toEqual([3, 3])
  })

  it('Fensterwechsel: im nächsten Fenster ist wieder frei — eine neue Zeile, die alte bleibt bis zum Cron', async () => {
    const bremse = testBremse(2)
    const versuch = [{ bremse, merkmal: '192.0.2.40' }]
    expect(await bremseUeberAlleInstanzen(versuch, MITTE)).toBe(true)
    expect(await bremseUeberAlleInstanzen(versuch, MITTE)).toBe(true)
    expect(await bremseUeberAlleInstanzen(versuch, MITTE)).toBe(false)

    const naechstesFenster = new Date(MITTE.getTime() + bremse.fensterMs)
    expect(await bremseUeberAlleInstanzen(versuch, naechstesFenster)).toBe(true)

    const zeilen = await prisma.rateLimitZaehler.findMany({
      where: { schluessel: { startsWith: bremse.zweck } },
      orderBy: { fensterStart: 'asc' },
    })
    expect(zeilen.map((z) => [z.fensterStart.toISOString(), z.ablauf.toISOString(), z.zaehler])).toEqual([
      ['2026-10-07T12:00:00.000Z', '2026-10-07T12:01:00.000Z', 3],
      ['2026-10-07T12:01:00.000Z', '2026-10-07T12:02:00.000Z', 1],
    ])
  })

  it('in der Tabelle steht weder IP noch Adresse — nur Zweck und HMAC', async () => {
    const bremse = testBremse(5)
    await zaehleVersuche(
      [
        { bremse, merkmal: '192.0.2.50' },
        { bremse: { ...bremse, zweck: `${bremse.zweck}-adresse` }, merkmal: 'int-kundin@example.com' },
      ],
      MITTE
    )
    const zeilen = await prisma.$queryRaw<{ zeile: string }[]>`
      SELECT row_to_json(r)::text AS zeile FROM "RateLimitZaehler" r WHERE r."schluessel" LIKE ${`${bremse.zweck}%`}`
    expect(zeilen).toHaveLength(2)
    for (const { zeile } of zeilen) {
      expect(zeile).not.toContain('192.0.2.50')
      expect(zeile).not.toContain('kundin@example.com')
      expect(zeile).toMatch(/"schluessel":"int-[a-z0-9-]+:[0-9a-f]{32}"/)
    }
    expect(zeilen.map((z) => JSON.parse(z.zeile).schluessel)).toContain(bremsSchluessel(GEHEIMNIS, bremse.zweck, '192.0.2.50'))
  })
})

describe('Aufräumen im bestehenden Cron', () => {
  it('cleanup-reservations löscht abgelaufene Zähler und lässt laufende stehen', async () => {
    vi.stubEnv('CRON_SECRET', 'int-cron-geheim')
    const bremse = testBremse(5)
    const gestern = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await zaehleVersuche([{ bremse, merkmal: '192.0.2.60' }], gestern)
    await zaehleVersuche([{ bremse, merkmal: '192.0.2.61' }], new Date())
    expect(await prisma.rateLimitZaehler.count({ where: { schluessel: { startsWith: bremse.zweck } } })).toBe(2)

    const { GET } = await import('@/app/api/cron/cleanup-reservations/route')
    const antwort = await GET(
      new NextRequest('http://localhost/api/cron/cleanup-reservations', {
        headers: { authorization: 'Bearer int-cron-geheim' },
      })
    )
    expect(antwort.status).toBe(200)
    const inhalt = (await antwort.json()) as { bremsZaehler: number }
    expect(inhalt.bremsZaehler).toBeGreaterThanOrEqual(1)

    const uebrig = await prisma.rateLimitZaehler.findMany({ where: { schluessel: { startsWith: bremse.zweck } } })
    expect(uebrig).toHaveLength(1)
    expect(uebrig[0].fensterStart.getTime()).toBe(fensterBeginn(new Date(), bremse.fensterMs).getTime())
    expect(uebrig[0].ablauf.getTime()).toBeGreaterThan(Date.now())
  })
})

describe('Anmeldecode über HTTP in Produktion', () => {
  type Auth = (typeof import('@/lib/auth'))['auth']
  const basis = 'http://localhost:3000/api/auth'

  const anfordern = (auth: Auth, ip: string, email: string) =>
    auth.handler(
      new Request(`${basis}/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': ip },
        body: JSON.stringify({ email, type: 'sign-in' }),
      })
    )

  /**
   * Better Auths eigene Bremse (erste Stufe) hält ihren Speicher in einem
   * Modul unter node_modules, das `vi.resetModules()` nicht neu lädt — zwei
   * „Instanzen" teilten ihn hier. Deshalb spielt die andere Instanz direkt
   * über die Tabelle mit: Ihre Versuche zählt `zaehleVersuche`, wie es ihr
   * Hook täte; diese Instanz hat die IP nie gesehen.
   */
  it('der Hook zählt in der Tabelle — und was andere Instanzen gezählt haben, bremst hier mit 429', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const bremse = DB_BREMSEN.anmeldecodeAnfordernIp
    const [ipA, ipB, ipC] = ['192.0.2.77', '192.0.2.78', '192.0.2.79']
    geloeschteSchluessel.push(...[ipA, ipB, ipC].map((ip) => bremsSchluessel(GEHEIMNIS, bremse.zweck, ip)))
    await prisma.rateLimitZaehler.deleteMany({ where: { schluessel: { in: geloeschteSchluessel } } })
    const adressen = Array.from({ length: 5 }, () => `${intKennung('kundin')}@example.com`)
    for (const email of adressen) {
      geloeschteSchluessel.push(bremsSchluessel(GEHEIMNIS, DB_BREMSEN.anmeldecodeAdresse.zweck, email))
    }

    await frischesFenster(bremse.fensterMs)
    vi.resetModules()
    const auth = (await import('@/lib/auth')).auth

    // 1. Drei Codes für ipA: angenommen und in der Tabelle gezählt (Schlüssel = HMAC der IP).
    for (const email of adressen.slice(0, 3)) {
      expect((await anfordern(auth, ipA, email)).status, email).toBe(200)
    }
    const zeileA = await prisma.rateLimitZaehler.findFirst({
      where: { schluessel: bremsSchluessel(GEHEIMNIS, bremse.zweck, ipA) },
    })
    expect(zeileA?.zaehler).toBe(3)

    // 2. ipB hat eine andere Instanz schon ausgeschöpft — hier kein Code.
    for (let i = 0; i < bremse.max; i += 1) await zaehleVersuche([{ bremse, merkmal: ipB }])
    expect((await anfordern(auth, ipB, adressen[3])).status).toBe(429)
    expect(await prisma.verification.count({ where: { identifier: `sign-in-otp-${adressen[3]}` } })).toBe(0)

    // 3. Gegenprobe: eine frische IP kommt durch.
    expect((await anfordern(auth, ipC, adressen[4])).status).toBe(200)
    expect(await prisma.verification.count({ where: { identifier: `sign-in-otp-${adressen[4]}` } })).toBe(1)
  }, 90_000)
})

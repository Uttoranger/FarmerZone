/**
 * Der Prüf-Seed (scripts/pruefung/pruef-seed.ts, freigabe.md §36, Nr. 243)
 * gegen ein echtes Postgres — als echter Ablauf auf einer eigenen
 * Wegwerf-DB neben der Integrations-DB (`<integrations-db>_pruefseed`,
 * Migrationsfolge, danach wieder gelöscht). Die Integrations-DB selbst
 * bleibt unberührt: Passkey, Stichtag und Admin-Rechte des Prüf-Seeds
 * gehören nicht in Grunddaten, die andere Dateien lesen.
 *
 * ZWEI ZWEIGE, je nachdem, was der Server über sich meldet
 * (`SELECT inet_server_addr()`), nie still übersprungen — genau einer läuft,
 * sein Name sagt welcher:
 *  - Loopback (lokal): erster Lauf seedet, zweiter Lauf bricht wegen der
 *    Passkey-Zeile ab, bevor er etwas schreibt.
 *  - Kein Loopback (CI: Postgres als Dienst-Container, der Server meldet
 *    seine Container-Adresse, obwohl die Verbindung über localhost läuft):
 *    Der Seed bricht an der Loopback-Prüfung ab und schreibt nichts. Das ist
 *    gewolltes Verhalten der Sperre, keine Lockerung.
 *
 * Die .env-Prüfung gilt einem leeren Temp-Ordner (`--wt`), nicht dem Klon —
 * ein Entwickler mit .env.test bekäme sonst einen roten Lauf; die Gegenprobe
 * mit .env-Datei läuft in beiden Zweigen.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { tokenKandidaten } from '@/lib/bar-bestaetigung'
import { istLoopbackServerAdresse } from '../../scripts/pruefung/sperre'
import { INTEGRATIONS_ENV } from './setup/integrations-umgebung'

const WURZEL = process.cwd()
const AUSGABE = '.nachtlauf/int-pruefung-seed'
const LINKS = join(WURZEL, AUSGABE, 'links.json')
const PASSKEY = join(WURZEL, AUSGABE, 'passkey.json')

// Die Konfiguration hat die Adresse schon durch die Sperre geschickt.
const TEST_URL = process.env['DATABASE_URL'] ?? ''
const testDbName = new URL(TEST_URL).pathname.slice(1)
const WEGWERF_NAME = `${testDbName}_pruefseed`
if (!/^[a-z0-9_]+$/.test(WEGWERF_NAME)) throw new Error('Name der Integrations-DB ungeeignet für eine Wegwerf-DB.')
const wegwerfUrl = (() => {
  const url = new URL(TEST_URL)
  url.pathname = `/${WEGWERF_NAME}`
  return url.toString()
})()

async function mitClient<T>(url: string, arbeit: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    return await arbeit(client)
  } finally {
    await client.end()
  }
}

const serverAdresse = await mitClient(TEST_URL, async (c) => (await c.query<{ a: string | null }>('SELECT inet_server_addr()::text AS a')).rows[0]?.a ?? null)
const LOOPBACK = istLoopbackServerAdresse(serverAdresse)

const leer = mkdtempSync(join(tmpdir(), 'pruef-seed-leer-'))

function pruefSeed(wt: string): { status: number | null; ausgabe: string; stderr: string } {
  const lauf = spawnSync(
    join(WURZEL, 'node_modules', '.bin', 'tsx'),
    ['scripts/pruefung/pruef-seed.ts', '--links', `${AUSGABE}/links.json`, '--passkey', `${AUSGABE}/passkey.json`, '--wt', wt],
    {
      cwd: WURZEL,
      encoding: 'utf8',
      // Wie `env -i` mit der Liste aus pruef-env.sh: kein RESEND, kein Sentry, kein VERCEL.
      env: {
        PATH: process.env['PATH'],
        HOME: process.env['HOME'],
        DATABASE_URL: wegwerfUrl,
        DIRECT_URL: wegwerfUrl,
        BETTER_AUTH_SECRET: INTEGRATIONS_ENV.BETTER_AUTH_SECRET,
        LINK_SECRET: randomBytes(32).toString('hex'),
        STRIPE_SECRET_KEY: INTEGRATIONS_ENV.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: INTEGRATIONS_ENV.STRIPE_WEBHOOK_SECRET,
        BETTER_AUTH_URL: 'http://localhost:3000',
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      } as Record<string, string | undefined> as NodeJS.ProcessEnv,
    }
  )
  return { status: lauf.status, ausgabe: lauf.stdout + lauf.stderr, stderr: lauf.stderr }
}

type Stand = { konten: number; passkeys: number; bestellungen: number; stichtag: string | null; adminSeit: string | null }

async function stand(): Promise<Stand> {
  return mitClient(wegwerfUrl, async (c) => {
    const zahl = async (sql: string) => Number((await c.query<{ n: string }>(sql)).rows[0]?.n ?? '0')
    const eins = async (sql: string) => (await c.query<{ w: string | null }>(sql)).rows[0]?.w ?? null
    return {
      konten: await zahl('SELECT count(*)::text AS n FROM "User"'),
      passkeys: await zahl('SELECT count(*)::text AS n FROM "Passkey"'),
      bestellungen: await zahl('SELECT count(*)::text AS n FROM "Order"'),
      stichtag: await eins(`SELECT "hofpreisModellAb"::text AS w FROM "PlattformEinstellung" WHERE id = 'plattform'`),
      adminSeit: await eins(`SELECT "adminSeit"::text AS w FROM "User" WHERE email = 'admin@example.com'`),
    }
  })
}

function keineDateien(): void {
  expect(existsSync(LINKS)).toBe(false)
  expect(existsSync(PASSKEY)).toBe(false)
}

beforeAll(async () => {
  await mitClient(TEST_URL, async (c) => {
    await c.query(`DROP DATABASE IF EXISTS "${WEGWERF_NAME}" WITH (FORCE)`)
    await c.query(`CREATE DATABASE "${WEGWERF_NAME}"`)
  })
  // Migrationsfolge, beide Adressen ausdrücklich auf die Wegwerf-DB.
  execFileSync(join(WURZEL, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    cwd: WURZEL,
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: wegwerfUrl, DIRECT_URL: wegwerfUrl },
  })
}, 120_000)

afterEach(() => {
  rmSync(join(WURZEL, AUSGABE), { recursive: true, force: true })
})

afterAll(async () => {
  rmSync(leer, { recursive: true, force: true })
  await mitClient(TEST_URL, (c) => c.query(`DROP DATABASE IF EXISTS "${WEGWERF_NAME}" WITH (FORCE)`))
})

describe('Prüf-Seed auf einer Wegwerf-DB', () => {
  if (LOOPBACK) {
    it('Server über Loopback: erster Lauf seedet, zweiter Lauf bricht wegen der Passkey-Zeile ab und schreibt nichts', async () => {
      const erster = pruefSeed(leer)
      expect(erster.status, erster.stderr).toBe(0)
      expect(statSync(PASSKEY).mode & 0o777).toBe(0o600)
      expect(statSync(LINKS).mode & 0o777).toBe(0o600)
      const nachErstem = await stand()
      expect(nachErstem.passkeys).toBe(1)
      expect(nachErstem.adminSeit).not.toBeNull()
      expect(nachErstem.stichtag).not.toBeNull()

      // Bar-Links: In der Spalte steht nur der Hash (S17); der Link findet
      // seine Bestellung über tokenKandidaten wie die Seite der App.
      const links = JSON.parse(readFileSync(LINKS, 'utf8')).links as Record<string, { pfad: string | null }>
      for (const [name, nummer] of [
        ['bar-bestaetigen-TP-BAR-1', 'TP-BAR-1'],
        ['bar-bestaetigen-TP-BAR-2', 'TP-BAR-2'],
        ['bar-bestaetigen-ungueltig', null],
      ] as const) {
        const token = decodeURIComponent(links[name]?.pfad?.split('/').pop() ?? '')
        const treffer = await mitClient(wegwerfUrl, async (c) =>
          (await c.query<{ n: string }>('SELECT "orderNumber" AS n FROM "Order" WHERE "confirmationToken" = ANY($1)', [tokenKandidaten(token)])).rows.map((z) => z.n)
        )
        expect(treffer, name).toEqual(nummer ? [nummer] : [])
      }
      const klartext = await mitClient(wegwerfUrl, async (c) =>
        Number((await c.query<{ n: string }>(`SELECT count(*)::text AS n FROM "Order" WHERE "orderNumber" LIKE 'TP-BAR-%' AND "confirmationToken" NOT LIKE 'h1:%'`)).rows[0]?.n)
      )
      expect(klartext).toBe(0)

      rmSync(join(WURZEL, AUSGABE), { recursive: true, force: true })
      const zweiter = pruefSeed(leer)
      expect(zweiter.status).toBe(1)
      expect(zweiter.stderr).toContain('Passkey-Zeile')
      expect(zweiter.ausgabe).not.toContain(wegwerfUrl)
      keineDateien()
      expect(await stand()).toEqual(nachErstem)
    }, 180_000)
  } else {
    it('Server ohne Loopback-Adresse (z. B. CI-Dienst-Container): Seed bricht an der Loopback-Prüfung ab und schreibt nichts', async () => {
      const vorher = await stand()
      const lauf = pruefSeed(leer)
      expect(lauf.status).toBe(1)
      expect(lauf.stderr).toContain('keine Loopback-Adresse')
      expect(lauf.ausgabe).not.toContain(wegwerfUrl)
      keineDateien()
      expect(await stand()).toEqual(vorher)
      expect(vorher.konten).toBe(0)
    }, 60_000)
  }

  it('Gegenprobe: .env-Datei im geprüften Ordner bricht ab, bevor verbunden wird', async () => {
    const mitEnv = mkdtempSync(join(tmpdir(), 'pruef-seed-env-'))
    try {
      writeFileSync(join(mitEnv, '.env.test'), 'X=1\n')
      const vorher = await stand()
      const lauf = pruefSeed(mitEnv)
      expect(lauf.status).toBe(1)
      expect(lauf.stderr).toContain('.env-Datei')
      keineDateien()
      expect(await stand()).toEqual(vorher)
    } finally {
      rmSync(mitEnv, { recursive: true, force: true })
    }
  }, 60_000)
})

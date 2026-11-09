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
 * Der Seed läuft aus einem Temp-Worktree (Kopie von scripts/pruefung/,
 * Verweise auf node_modules, src, prisma …; tests/pruefung-worktree.ts) mit
 * diesem als Arbeitsordner: Das Werkzeug prüft immer seinen eigenen Worktree
 * und den Arbeitsordner, ohne Ausnahme — so läuft der Test auch in einem Klon
 * mit .env.test. Die Gegenprobe mit .env-Datei läuft in beiden Zweigen.
 *
 * Seit Nr. 262 (Lauf 33, 6.1) prüft der erste Lauf auch die Ergänzungen
 * (mit `--gruendung-fest`), und der Snapshot einer Prüf-Bestellung wird mit
 * einer Bestellung über die Kasse verglichen — nur der Bar-Weg, der Stripe
 * nicht ruft. `bestellSnapshot` (scripts/pruefung/pruef-daten.ts) rechnet für
 * dieselben Eingaben dasselbe wie /api/checkout, und die Seed-Bestellung trägt
 * dieselben Felder.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() } } }))

import { execFileSync, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { tokenKandidaten } from '@/lib/bar-bestaetigung'
import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { HOF_FUER_GEBUEHR_LAGE, ladeGebuehrLage } from '@/server/queries/plattform-einstellung'
import { SNAPSHOT_FELDER_BESTELLUNG, SNAPSHOT_FELDER_POSITION, bestellSnapshot } from '../../scripts/pruefung/pruef-daten'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'
import { istLoopbackServerAdresse } from '../../scripts/pruefung/sperre'
import { tempWorktree, type TempWorktree } from '../pruefung-worktree'
import { INTEGRATIONS_ENV } from './setup/integrations-umgebung'

const WURZEL = process.cwd()
const AUSGABE = '.nachtlauf/int-pruefung-seed'
const WT = tempWorktree('pruef-seed-wt-')
const LINKS = join(WT.ordner, AUSGABE, 'links.json')
const PASSKEY = join(WT.ordner, AUSGABE, 'passkey.json')

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

function pruefSeed(wt: TempWorktree, zusatz: string[] = []): { status: number | null; ausgabe: string; stderr: string } {
  const lauf = spawnSync(
    join(wt.ordner, 'node_modules', '.bin', 'tsx'),
    [wt.skript('pruef-seed.ts'), '--links', `${AUSGABE}/links.json`, '--passkey', `${AUSGABE}/passkey.json`, ...zusatz],
    {
      cwd: wt.ordner,
      encoding: 'utf8',
      // Wie `env -i` mit der Liste aus pruef-env.sh: kein RESEND, kein Sentry, kein VERCEL.
      env: {
        PATH: process.env['PATH'],
        HOME: process.env['HOME'],
        DATABASE_URL: wegwerfUrl,
        DIRECT_URL: wegwerfUrl,
        BETTER_AUTH_SECRET: INTEGRATIONS_ENV.BETTER_AUTH_SECRET,
        LINK_SECRET: randomBytes(32).toString('hex'),
        // Platzhalter wie in pruef-env.sh — der Seed bricht bei jedem anderen Stripe-Wert ab (Nr. 262).
        STRIPE_SECRET_KEY: 'sk_test_pruefung',
        STRIPE_WEBHOOK_SECRET: 'whsec_pruefung',
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
  rmSync(join(WT.ordner, AUSGABE), { recursive: true, force: true })
})

/** Werte eines Snapshots als Text — Decimal, Zahl und null vergleichbar. */
function alsText(wert: unknown): string | null {
  return wert === null || wert === undefined ? null : String(Number.isNaN(Number(wert)) ? wert : Number(wert))
}

/**
 * Eine Bestellung über die Kasse (Bar-Weg) im Hofpreis-Modell in der
 * Integrations-DB, dazu der Snapshot, den der Prüf-Seed für dieselben
 * Eingaben schriebe. Der Stichtag wird danach zurückgesetzt.
 */
async function kassenBestellung() {
  const vorher = await prisma.plattformEinstellung.findUnique({ where: { id: 'plattform' }, select: { hofpreisModellAb: true } })
  const ab = new Date('2026-10-01T00:00:00.000Z')
  await prisma.plattformEinstellung.upsert({ where: { id: 'plattform' }, create: { id: 'plattform', hofpreisModellAb: ab }, update: { hofpreisModellAb: ab } })
  try {
    // Einzug erst 2099: bar ist „erlassen“, ein Mandat braucht es nicht.
    const { farm } = await erstelleHof({ serviceFeePercent: 5, serviceFeeMinCents: 50, serviceFeeActiveFrom: new Date('2026-09-01T00:00:00.000Z'), einzugAb: new Date('2099-01-01T00:00:00.000Z') })
    const eier = await erstelleProdukt(farm.id, { stock: 10, price: 3.6, name: 'Eier' })
    const milch = await erstelleProdukt(farm.id, { stock: 10, price: 1.4, name: 'Milch' })
    const sitzung = intKennung('sitzung')
    await setzeHalt(eier.id, sitzung, 3)
    await setzeHalt(milch.id, sitzung, 2)
    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        paymentMethod: 'ONSITE_CASH',
        positionen: [
          { productId: eier.id, name: 'Eier', quantity: 3, unitPrice: 3.6 },
          { productId: milch.id, name: 'Milch', quantity: 2, unitPrice: 1.4 },
        ],
      })
    )
    expect(antwort.status).toBe(200)
    nachlauf.aufgaben.length = 0
    const kasse = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id }, include: { items: { orderBy: { productName: 'asc' } } } })
    const hof = await prisma.farm.findUniqueOrThrow({ where: { id: farm.id }, select: { ...HOF_FUER_GEBUEHR_LAGE, serviceFeePercent: true, serviceFeeMinCents: true, serviceFeeActiveFrom: true, platformFeePercent: true } })
    const lage = await ladeGebuehrLage(hof, kasse.createdAt)
    const positionen = [eier, milch].map((p, i) => ({ productId: p.id, name: p.name, unitPrice: p.price, quantity: i === 0 ? 3 : 2, vatRate: p.vatRate }))
    const seed = bestellSnapshot(lage, hof, positionen, 'ONSITE_CASH', kasse.createdAt)
    if ('grund' in seed) throw new Error(seed.grund)
    return { kasse, seed }
  } finally {
    await prisma.plattformEinstellung.update({ where: { id: 'plattform' }, data: { hofpreisModellAb: vorher?.hofpreisModellAb ?? null } })
  }
}

afterAll(async () => {
  await raeumeAuf()
  WT.weg()
  await mitClient(TEST_URL, (c) => c.query(`DROP DATABASE IF EXISTS "${WEGWERF_NAME}" WITH (FORCE)`))
})

describe('Prüf-Seed auf einer Wegwerf-DB', () => {
  if (LOOPBACK) {
    it('Server über Loopback: erster Lauf seedet, zweiter Lauf bricht wegen der Passkey-Zeile ab und schreibt nichts', async () => {
      const erster = pruefSeed(WT, ['--gruendung-fest'])
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

      // Ergänzungen aus Nr. 262 (6.1 a–l), gelesen mit rohem SQL aus der Wegwerf-DB.
      const ergaenzt = await mitClient(wegwerfUrl, async (c) => {
        const zeilen = async <T extends object>(sql: string) => (await c.query<T & pg.QueryResultRow>(sql)).rows
        return {
          familie: await zeilen<{ stock: number; verpackung: string }>(`SELECT stock, verpackung::text FROM "Product" WHERE "familieId" = 'familie-pruef-wiesenheu' ORDER BY price`),
          raummeter: await zeilen<{ stock: number; holzart: string | null }>(`SELECT p.stock, b.holzart FROM "Product" p LEFT JOIN "BrennmaterialAngaben" b ON b."productId" = p.id WHERE p.unit = 'RAUMMETER' ORDER BY p.price DESC`),
          ungelesen: await zeilen<{ n: string }>(`SELECT count(*)::text AS n FROM "Nachricht" n JOIN "UnterhaltungStand" s ON s."unterhaltungId" = n."unterhaltungId" AND s.seite = 'HOF' WHERE n."vonFarmId" IS NULL AND n."createdAt" > s."gelesenBis"`),
          rundschreiben: await zeilen<{ n: string }>(`SELECT count(*)::text AS n FROM "Rundschreiben"`),
          whatsapp: await zeilen<{ telefon: string }>(`SELECT "customerPhone" AS telefon FROM "CustomerFarmSubscription" WHERE "optInWhatsApp"`),
          wartet: await zeilen<{ produkte: string }>(`SELECT (SELECT count(*) FROM "Product" p WHERE p."farmId" = f.id)::text AS produkte FROM "Farm" f WHERE f.slug = 'hof-am-bach' AND f."approvedAt" IS NULL`),
          einstellung: await zeilen<{ plaetze: number; fest: boolean }>(`SELECT "gruendungPlaetze" AS plaetze, "gruendungFestAm" IS NOT NULL AS fest FROM "PlattformEinstellung"`),
          zusagen: await zeilen<{ n: string }>(`SELECT count(*)::text AS n FROM "Farm" WHERE "gruendungPlatz" IS NOT NULL`),
          heute: await zeilen<{ n: string }>(`SELECT count(*)::text AS n FROM "Order" WHERE "orderNumber" LIKE 'TP-HEUTE-%'`),
          fehlt: await zeilen<{ n: string }>(`SELECT count(*)::text AS n FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" WHERE o."orderNumber" = 'TP-FEHLT' AND i."fehltSeit" IS NOT NULL`),
          auftraege: await zeilen<{ n: string }>(`SELECT count(*)::text AS n FROM "MailAuftrag" a JOIN "Order" o ON o.id = a."bestellungId" WHERE o."orderNumber" LIKE 'TP-%'`),
        }
      })
      expect(ergaenzt.familie.length).toBeGreaterThanOrEqual(3)
      expect(ergaenzt.familie.filter((p) => p.stock === 0)).toHaveLength(1)
      expect(ergaenzt.familie.every((p) => p.verpackung === 'LOSE_BALLEN')).toBe(true)
      expect(ergaenzt.raummeter.map((p) => p.stock === 0)).toEqual([false, true])
      expect(ergaenzt.raummeter.every((p) => p.holzart !== null)).toBe(true)
      expect(ergaenzt.ungelesen[0]?.n).toBe('1')
      expect(ergaenzt.rundschreiben[0]?.n).toBe('1')
      expect(ergaenzt.whatsapp.map((z) => z.telefon)).toEqual([expect.stringMatching(/^\+43 660 000\d{4}$/)])
      expect(ergaenzt.wartet).toEqual([{ produkte: '0' }])
      expect(ergaenzt.einstellung).toEqual([{ plaetze: 100, fest: true }])
      expect(Number(ergaenzt.zusagen[0]?.n)).toBeGreaterThan(0)
      expect(ergaenzt.heute[0]?.n).toBe('4')
      expect(ergaenzt.fehlt[0]?.n).toBe('1')
      expect(Number(ergaenzt.auftraege[0]?.n)).toBeGreaterThan(0)
      for (const name of ['bar-bestaetigen-TP-HP-BAR', 'bestaetigung-TP-HP-ONLINE', 'widerruf-TD-0001', 'widerruf-TD-0003']) expect(links[name]?.pfad, name).toBeTruthy()

      // Snapshot: dieselben Felder wie eine Bestellung über die Kasse.
      const { kasse } = await kassenBestellung()
      const seedBar = await mitClient(wegwerfUrl, async (c) => (await c.query<Record<string, unknown>>(`SELECT * FROM "Order" WHERE "orderNumber" = 'TP-HP-BAR'`)).rows[0])
      const seedPositionen = await mitClient(wegwerfUrl, async (c) => (await c.query<Record<string, unknown>>(`SELECT i.* FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" WHERE o."orderNumber" = 'TP-HP-BAR'`)).rows)
      const belegt = (zeile: Record<string, unknown> | undefined, felder: readonly string[]) => felder.filter((f) => zeile?.[f] !== null && zeile?.[f] !== undefined)
      expect(belegt(seedBar, SNAPSHOT_FELDER_BESTELLUNG)).toEqual(belegt(kasse as unknown as Record<string, unknown>, SNAPSHOT_FELDER_BESTELLUNG))
      for (const f of ['gebuehrModell', 'gebuehrEinzug', 'serviceFeePercentApplied', 'serviceFeeMinCentsApplied', 'kaeuferArt'] as const) {
        expect(alsText(seedBar?.[f]), f).toBe(alsText(kasse[f]))
      }
      expect(belegt(seedPositionen[0], SNAPSHOT_FELDER_POSITION)).toEqual(belegt(kasse.items[0] as unknown as Record<string, unknown>, SNAPSHOT_FELDER_POSITION))
      expect(seedPositionen.reduce((s, p) => s + Number(p['gebuehrCents']), 0)).toBe(Number(seedBar?.['serviceFeeCents']))

      rmSync(join(WT.ordner, AUSGABE), { recursive: true, force: true })
      const zweiter = pruefSeed(WT)
      expect(zweiter.status).toBe(1)
      expect(zweiter.stderr).toContain('Passkey-Zeile')
      expect(zweiter.ausgabe).not.toContain(wegwerfUrl)
      keineDateien()
      expect(await stand()).toEqual(nachErstem)
    }, 180_000)
  } else {
    it('Server ohne Loopback-Adresse (z. B. CI-Dienst-Container): Seed bricht an der Loopback-Prüfung ab und schreibt nichts', async () => {
      const vorher = await stand()
      const lauf = pruefSeed(WT)
      expect(lauf.status).toBe(1)
      expect(lauf.stderr).toContain('keine Loopback-Adresse')
      expect(lauf.ausgabe).not.toContain(wegwerfUrl)
      keineDateien()
      expect(await stand()).toEqual(vorher)
      expect(vorher.konten).toBe(0)
    }, 60_000)
  }

  it('bestellSnapshot rechnet für dieselben Eingaben genau den Snapshot, den die Kasse (bar) speichert', async () => {
    const { kasse, seed } = await kassenBestellung()
    const { items, ...felder } = seed
    for (const f of SNAPSHOT_FELDER_BESTELLUNG) expect(alsText(kasse[f]), f).toBe(alsText(felder[f]))
    const seedJeProdukt = new Map(items.map((i) => [i.productId, i]))
    expect(kasse.items).toHaveLength(items.length)
    for (const position of kasse.items) {
      const erwartet = seedJeProdukt.get(position.productId)
      for (const f of SNAPSHOT_FELDER_POSITION) expect(alsText(position[f]), f).toBe(alsText(erwartet?.[f]))
    }
    expect(kasse.gebuehrModell).toBe('hofpreis')
  })

  it('Gegenprobe: .env.test im Worktree des Seeds bricht ab, bevor verbunden wird', async () => {
    const mitEnv = tempWorktree('pruef-seed-env-')
    try {
      writeFileSync(join(mitEnv.ordner, '.env.test'), 'X=1\n')
      const vorher = await stand()
      const lauf = pruefSeed(mitEnv)
      expect(lauf.status).toBe(1)
      expect(lauf.stderr).toContain('.env-Datei')
      expect(existsSync(join(mitEnv.ordner, AUSGABE))).toBe(false)
      expect(await stand()).toEqual(vorher)
    } finally {
      mitEnv.weg()
    }
  }, 60_000)
})

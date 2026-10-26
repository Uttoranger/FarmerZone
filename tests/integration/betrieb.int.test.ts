/**
 * Admin › Betrieb gegen ein ECHTES Postgres (Register N18, Nr. 103) — die
 * Tabellen BetriebMessung, AblaufLauf und BetriebWarnung sind die Aussage.
 *
 * Beweist:
 *  - Die Migration 20261016130000_betrieb ist angewandt: drei Tabellen mit
 *    Primärschlüssel und RLS an.
 *  - messeBetrieb schreibt je Art EINE Zeile für den UTC-Tag; ein zweiter Lauf
 *    am selben Tag überschreibt (upsert), nur die eigenen Auflistungen zählen
 *    weiter hoch.
 *  - zaehleMail zählt atomar: zweimal → 2, zwanzig gleichzeitig → 22; seit
 *    Nr. 170 mit `menge` in einem Schritt (5, dann 1 und 3 → 9).
 *  - Die Warnstufe wird bedingt gesetzt: zwei gleichzeitige Prüfungen → EINE
 *    Mail; 85 % danach keine, 95 % eine, 74 % die Entwarnung — `stufe = 0`,
 *    die Zeile bleibt (gelöscht wird nichts). Geführt an der Datenbank
 *    (Supabase Free, feste Grenze): Bilder haben seit Nr. 113 (Vercel Pro)
 *    keine Grenze und keine Warnstufe — das prüfen tests/betrieb.test.ts
 *    („Vercel Pro — Bilder ohne feste Grenze") und tests/betrieb-server.test.ts
 *    („Bilder ohne feste Grenze").
 *  - mitHerzschlag schreibt AblaufLauf (ok, Dauer, nur die Fehlerklasse).
 *  - Seit Nr. 184: schlageVonAussen schreibt den Herzschlag „von-aussen“
 *    höchstens einmal je Minute (zehn gleichzeitige Aufrufe → einer schreibt;
 *    nach 59 s keiner, nach 60 s wieder); erstmalsHeute (umgebung-server.ts)
 *    legt die Zeile eines bekannten Zustands je Tag und Deploy genau einmal
 *    an — am nächsten Tag wieder (Gegenprobe).
 *
 * Daten: Messungen an Tagen im Jahr 2001 (fern von jedem echten Tag),
 * Abläufe mit `int-`-Namen. Die Arten der Warnungen sind fest (keine
 * int-Kennung möglich): Der Test hält fest, ob es sie vorher gab, und stellt
 * den Stand danach wieder her. Resend ist gemockt — die Mail ist eine
 * Prüfstelle (TESTING_GUIDELINES §3).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { GRENZE, type AblaufName } from '@/lib/betrieb'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendBetriebWarnung: vi.fn(async () => ({ gesendet: 1, gescheitert: 0 })) }))
vi.mock('@vercel/blob', () => ({ list: vi.fn() }))

import { list } from '@vercel/blob'
import { sendBetriebWarnung } from '@/lib/email'
import { messeBetrieb, mitHerzschlag, pruefeGrenzen, schlageVonAussen } from '@/server/betrieb'
import { erstmalsHeute } from '@/lib/umgebung-server'
import { zaehleMail } from '@/server/betrieb-zaehler'
import { intKennung } from './setup/basis'

const GRENZ_ARTEN = ['bilder', 'datenbank', 'mailsMonat', 'bildVorgaenge', 'mailsTag']
const TEST_JAHR_BIS = new Date('2002-01-01T00:00:00.000Z')
let warnungenVorher: Array<{ art: string; stufe: number; seit: Date; gemeldetAm: Date }> = []

function tagDatum(tag: string): Date {
  return new Date(`${tag}T00:00:00.000Z`)
}

/** Belegt die Datenbank am Tag mit `prozent` % ihrer Grenze im Tarif von heute. */
async function setzeDatenbankAnteil(tag: string, prozent: number): Promise<void> {
  const wert = BigInt(Math.round((GRENZE.datenbankBytes * prozent) / 100))
  await prisma.betriebMessung.upsert({
    where: { tag_art: { tag: tagDatum(tag), art: 'datenbankBytes' } },
    create: { tag: tagDatum(tag), art: 'datenbankBytes', wert },
    update: { wert },
  })
}

async function stufeVon(art: string): Promise<number | null> {
  return (await prisma.betriebWarnung.findUnique({ where: { art } }))?.stufe ?? null
}

beforeAll(async () => {
  warnungenVorher = await prisma.betriebWarnung.findMany({ where: { art: { in: GRENZ_ARTEN } } })
  await prisma.betriebWarnung.deleteMany({ where: { art: { in: GRENZ_ARTEN } } })
})

afterEach(async () => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  await prisma.betriebMessung.deleteMany({ where: { tag: { lt: TEST_JAHR_BIS } } })
  await prisma.betriebWarnung.deleteMany({ where: { art: { in: GRENZ_ARTEN } } })
  await prisma.ablaufLauf.deleteMany({ where: { name: { startsWith: 'int-' } } })
})

afterAll(async () => {
  if (warnungenVorher.length > 0) await prisma.betriebWarnung.createMany({ data: warnungenVorher })
})

describe('Migration 20261016130000_betrieb', () => {
  it('drei Tabellen mit Primärschlüssel und RLS an', async () => {
    const zeilen = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean; pkey: boolean }>>`
      SELECT c.relname, c.relrowsecurity,
             EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'p') AS pkey
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('BetriebMessung', 'AblaufLauf', 'BetriebWarnung')
      ORDER BY c.relname`
    expect(zeilen).toEqual([
      { relname: 'AblaufLauf', relrowsecurity: true, pkey: true },
      { relname: 'BetriebMessung', relrowsecurity: true, pkey: true },
      { relname: 'BetriebWarnung', relrowsecurity: true, pkey: true },
    ])
  })
})

describe('messeBetrieb', () => {
  const blob = (size: number, uploadedAt: string) => ({ pathname: 'hoefe/int/x.webp', url: 'https://bilder.example/x.webp', size, uploadedAt: new Date(uploadedAt) })

  it('je Art eine Zeile; ein zweiter Lauf am selben UTC-Tag überschreibt, die Auflistungen zählen weiter', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_platzhalter')
    vi.mocked(list)
      .mockResolvedValueOnce({ blobs: [blob(300_000, '2001-03-02T10:00:00Z')], hasMore: true, cursor: 'c2' } as never)
      .mockResolvedValueOnce({ blobs: [blob(200_000, '2001-02-20T10:00:00Z')], hasMore: false } as never)
    await messeBetrieb(new Date('2001-03-15T04:05:00.000Z'))

    vi.mocked(list).mockResolvedValueOnce({ blobs: [blob(900_000, '2001-03-14T10:00:00Z')], hasMore: false } as never)
    await messeBetrieb(new Date('2001-03-15T09:00:00.000Z'))

    const zeilen = await prisma.betriebMessung.findMany({ where: { tag: tagDatum('2001-03-15') }, orderBy: { art: 'asc' } })
    const werte = Object.fromEntries(zeilen.map((z) => [z.art, Number(z.wert)]))
    expect(werte).toMatchObject({ bilderBytes: 900_000, bilderDateien: 1, bilderUploadsMonat: 1, bilderAuflistungen: 3 })
    // 2 × 1 Upload + 3 eigene Auflistungen im Monat.
    expect(werte.bildVorgaengeMonat).toBe(5)
    expect(werte.datenbankBytes).toBeGreaterThan(0)
    // Seit Nr. 163 auch die Hofliste aus der echten Abfrage: Bytes und Höfe.
    expect(werte.hoflisteBytes).toBeGreaterThan(0)
    expect(werte.hoflisteHoefe).toBeGreaterThanOrEqual(0)
    expect(zeilen).toHaveLength(8)
  })
})

describe('zaehleMail', () => {
  it('zweimal → 2; zwanzig gleichzeitig kommen alle an (eine Anweisung, atomar)', async () => {
    const jetzt = new Date('2001-04-10T12:00:00.000Z')
    await zaehleMail(jetzt)
    await zaehleMail(jetzt)
    const zaehlerstand = async (): Promise<number> =>
      Number((await prisma.betriebMessung.findUnique({ where: { tag_art: { tag: tagDatum('2001-04-10'), art: 'mails' } } }))?.wert)
    expect(await zaehlerstand()).toBe(2)

    await Promise.all(Array.from({ length: 20 }, () => zaehleMail(jetzt)))
    expect(await zaehlerstand()).toBe(22)
  })

  it('Nr. 170: menge zählt in einem Schritt — 5 auf leeren Tag gibt 5, danach 1 und 3 gibt 9', async () => {
    const jetzt = new Date('2001-04-10T12:00:00.000Z')
    await zaehleMail(jetzt, 5)
    const zaehlerstand = async (): Promise<number> =>
      Number((await prisma.betriebMessung.findUnique({ where: { tag_art: { tag: tagDatum('2001-04-10'), art: 'mails' } } }))?.wert)
    expect(await zaehlerstand()).toBe(5)
    await zaehleMail(jetzt)
    await zaehleMail(jetzt, 3)
    expect(await zaehlerstand()).toBe(9)
  })

  it('zählt in den UTC-Tag: 23:30 Uhr UTC ist noch derselbe Tag, 0:30 Uhr UTC der nächste', async () => {
    await zaehleMail(new Date('2001-04-10T23:30:00.000Z'))
    await zaehleMail(new Date('2001-04-11T00:30:00.000Z'))
    const tage = await prisma.betriebMessung.findMany({ where: { art: 'mails', tag: { lt: TEST_JAHR_BIS } }, orderBy: { tag: 'asc' }, select: { tag: true, wert: true } })
    expect(tage.map((t) => [t.tag.toISOString().slice(0, 10), Number(t.wert)])).toEqual([
      ['2001-04-10', 1],
      ['2001-04-11', 1],
    ])
  })
})

describe('Warnstufe — bedingt gesetzt, erst dann die Mail', () => {
  const tag = '2001-05-20'
  const jetzt = new Date(`${tag}T04:05:00.000Z`)

  it('zwei gleichzeitige Prüfungen bei 82 % → genau eine Mail, Stufe 1', async () => {
    await setzeDatenbankAnteil(tag, 82)
    const ergebnisse = await Promise.all([pruefeGrenzen(jetzt, { produktion: true }), pruefeGrenzen(jetzt, { produktion: true })])

    expect(ergebnisse.reduce((a, b) => a + b, 0)).toBe(1)
    expect(sendBetriebWarnung).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendBetriebWarnung).mock.calls[0][0]).toMatchObject({ art: 'grenze', wert: 'datenbank' })
    expect(Array.isArray(vi.mocked(sendBetriebWarnung).mock.calls[0][1])).toBe(true)
    expect(await stufeVon('datenbank')).toBe(1)
  })

  it('85 % → keine Mail, 95 % → eine Mail (Stufe 2), 74 % → Entwarnung: Stufe 0, die Zeile bleibt', async () => {
    await setzeDatenbankAnteil(tag, 82)
    await pruefeGrenzen(jetzt, { produktion: true })
    vi.mocked(sendBetriebWarnung).mockClear()

    await setzeDatenbankAnteil(tag, 85)
    expect(await pruefeGrenzen(jetzt, { produktion: true })).toBe(0)
    expect(await stufeVon('datenbank')).toBe(1)

    await setzeDatenbankAnteil(tag, 95)
    expect(await pruefeGrenzen(jetzt, { produktion: true })).toBe(1)
    expect(await stufeVon('datenbank')).toBe(2)

    await setzeDatenbankAnteil(tag, 78)
    expect(await pruefeGrenzen(jetzt, { produktion: true })).toBe(0)

    await setzeDatenbankAnteil(tag, 74)
    expect(await pruefeGrenzen(jetzt, { produktion: true })).toBe(1)
    expect(vi.mocked(sendBetriebWarnung).mock.calls.map(([anlass]) => anlass.art)).toEqual(['grenze', 'entwarnung'])
    expect(await stufeVon('datenbank')).toBe(0)
  })

  it('außerhalb der Produktion: nichts gesetzt, keine Mail', async () => {
    await setzeDatenbankAnteil(tag, 99)
    expect(await pruefeGrenzen(jetzt, { produktion: false })).toBe(0)
    expect(await stufeVon('datenbank')).toBeNull()
    expect(sendBetriebWarnung).not.toHaveBeenCalled()
  })
})

describe('mitHerzschlag', () => {
  // Der Name trägt das int-Präfix (Aufräumen); im Betrieb kommt er aus ABLAEUFE.
  const name = (): AblaufName => intKennung('ablauf') as AblaufName
  const nichtsDanach = async (): Promise<number> => 0

  it('ein guter Lauf: gestartet, beendet, ok, Dauer — das Ergebnis kommt unverändert zurück', async () => {
    const n = name()
    expect(await mitHerzschlag(n, async () => ({ deleted: 2 }), nichtsDanach)).toEqual({ deleted: 2 })
    const zeile = await prisma.ablaufLauf.findUnique({ where: { name: n } })
    expect(zeile).toMatchObject({ ok: true, fehlerKlasse: null })
    expect(zeile?.beendetAm).not.toBeNull()
    expect(zeile?.dauerMs).toBeGreaterThanOrEqual(0)
  })

  it('ein gescheiterter Lauf: ok false, nur die Fehlerklasse; der nächste gute Lauf überschreibt dieselbe Zeile', async () => {
    const n = name()
    await expect(mitHerzschlag(n, async () => Promise.reject(new RangeError('Inhalt bleibt draußen')), nichtsDanach)).rejects.toThrow(RangeError)
    expect(await prisma.ablaufLauf.findUnique({ where: { name: n } })).toMatchObject({ ok: false, fehlerKlasse: 'RangeError' })

    await mitHerzschlag(n, async () => null, nichtsDanach)
    expect(await prisma.ablaufLauf.findMany({ where: { name: n } })).toEqual([expect.objectContaining({ ok: true, fehlerKlasse: null })])
  })
})

describe('schlageVonAussen (Nr. 184)', () => {
  // Der Name ist fest („von-aussen“, keine int-Kennung möglich): Stand vorher merken, danach wiederherstellen.
  let vorher: Awaited<ReturnType<typeof prisma.ablaufLauf.findUnique>> = null
  beforeAll(async () => {
    vorher = await prisma.ablaufLauf.findUnique({ where: { name: 'von-aussen' } })
    await prisma.ablaufLauf.deleteMany({ where: { name: 'von-aussen' } })
  })
  afterAll(async () => {
    await prisma.ablaufLauf.deleteMany({ where: { name: 'von-aussen' } })
    if (vorher) await prisma.ablaufLauf.create({ data: vorher })
  })

  it('zehn gleichzeitige Aufrufe → genau einer schreibt; nach 59 s keiner, nach 60 s wieder', async () => {
    const t0 = new Date('2001-03-01T10:00:00.000Z')
    const ergebnisse = await Promise.all(Array.from({ length: 10 }, () => schlageVonAussen(t0)))
    expect(ergebnisse.filter(Boolean)).toHaveLength(1)
    expect(await prisma.ablaufLauf.findUnique({ where: { name: 'von-aussen' } })).toMatchObject({ gestartetAm: t0, beendetAm: t0, ok: true, fehlerKlasse: null, dauerMs: 0 })

    expect(await schlageVonAussen(new Date(t0.getTime() + 59_000))).toBe(false)
    expect((await prisma.ablaufLauf.findUnique({ where: { name: 'von-aussen' } }))?.gestartetAm).toEqual(t0)

    const t1 = new Date(t0.getTime() + 60_000)
    expect(await schlageVonAussen(t1)).toBe(true)
    expect((await prisma.ablaufLauf.findUnique({ where: { name: 'von-aussen' } }))?.gestartetAm).toEqual(t1)
  })
})

describe('erstmalsHeute — bekannte Zustände einmal je Tag und Deploy (Nr. 184)', () => {
  it('fünf gleichzeitige Anfragen → eine legt an; am selben Tag keine mehr, am nächsten Tag wieder', async () => {
    const tag1 = new Date('2001-04-02T08:00:00.000Z')
    const ergebnisse = await Promise.all(Array.from({ length: 5 }, () => erstmalsHeute('umgebung', tag1)))
    expect(ergebnisse.filter(Boolean)).toHaveLength(1)
    expect(await erstmalsHeute('umgebung', new Date('2001-04-02T23:59:00.000Z'))).toBe(false)
    // Ein anderer Zustand hat seine eigene Zeile.
    expect(await erstmalsHeute('stichtag', tag1)).toBe(true)
    // Gegenprobe zweiter Tag.
    expect(await erstmalsHeute('umgebung', new Date('2001-04-03T00:01:00.000Z'))).toBe(true)
    const zeilen = await prisma.betriebMessung.findMany({ where: { art: { startsWith: 'sentry:' }, tag: { lt: TEST_JAHR_BIS } }, select: { art: true } })
    expect(zeilen.map((z) => z.art).sort()).toEqual(['sentry:stichtag:lokal', 'sentry:umgebung:lokal', 'sentry:umgebung:lokal'])
  })
})

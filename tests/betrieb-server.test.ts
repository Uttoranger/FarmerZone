/**
 * Admin › Betrieb im Hintergrund (src/server/betrieb.ts, Register N18, Nr. 103).
 *
 * Beweist mit gemockter Datenbank und gemocktem `list()` von @vercel/blob:
 *  - messeBetrieb liest den Bild-Speicher seitenweise (Cursor), zählt Bytes,
 *    Dateien und Uploads des Monats, schreibt je Art eine Zeile für den
 *    UTC-Tag; scheitert eine Quelle, läuft die andere weiter, und nach Sentry
 *    geht nur die Klasse unter einem festen Satz.
 *  - seit Nr. 163 misst sie die Hofliste (`getOeffentlicheHoefe` ohne Cache):
 *    Bytes des JSON (UTF-8) und Zahl der Höfe; scheitert das, laufen die
 *    anderen Werte weiter. Ab 80 % von 2 MB warnt die Prüfung (Regel speicher).
 *  - mitHerzschlag gibt das Ergebnis unverändert zurück bzw. wirft den Fehler
 *    des Laufs weiter, schreibt Start und Ende (ok, Fehlerklasse) und hält den
 *    Lauf nicht auf, wenn der Herzschlag selbst scheitert.
 *  - Außerhalb der Produktion keine Prüfung und keine Warn-Mail; in der
 *    Produktion geht die Mail nur, wenn das bedingte Setzen eine Zeile traf.
 * Die Nebenläufigkeit selbst (zwei Prüfungen → eine Mail) prüft
 * tests/integration/betrieb.int.test.ts an echtem Postgres.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  ablaufLauf: { upsert: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  betriebMessung: { aggregate: vi.fn(), findMany: vi.fn() },
  betriebWarnung: { findMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@vercel/blob', () => ({ list: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendBetriebWarnung: vi.fn(async () => ({ gesendet: 1, gescheitert: 0 })) }))
vi.mock('@/server/queries/postfach', () => ({ ladeBetreiberEmpfaenger: vi.fn(async () => ['team@example.com']) }))
vi.mock('@/server/queries/farm', () => ({ getOeffentlicheHoefe: vi.fn() }))
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn((aufgabe: () => Promise<void>) => nachlauf.aufgaben.push(aufgabe)) }))

import { list } from '@vercel/blob'
import * as Sentry from '@sentry/nextjs'
import { sendBetriebWarnung } from '@/lib/email'
import { ladeBetreiberEmpfaenger } from '@/server/queries/postfach'
import { getOeffentlicheHoefe } from '@/server/queries/farm'
import { beginneMessung, messeBetrieb, mitHerzschlag, pruefeAblaeufe, pruefeGrenzen, schlageVonAussen } from '@/server/betrieb'

const JETZT = new Date('2026-10-16T04:05:00.000Z')

/** Zwei erfundene Höfe; „ü“ zählt in UTF-8 zwei Bytes — gemessen werden Bytes, nicht Zeichen. */
const LISTE = [{ name: 'Hof Grünwiese' }, { name: 'Hof Test' }]
const LISTE_BYTES = JSON.stringify(LISTE).length + 1

/** Die Werte einer Rohabfrage, flach — so, wie Postgres sie als Parameter bekommt. */
function werteVon(aufruf: unknown[]): unknown[] {
  const [teile, ...werte] = aufruf as [TemplateStringsArray, ...unknown[]]
  return Prisma.sql(teile, ...werte).values
}

function blob(pathname: string, size: number, uploadedAt: string) {
  return { pathname, url: `https://bilder.example/${pathname}`, downloadUrl: '', size, uploadedAt: new Date(uploadedAt), contentType: 'image/webp', contentDisposition: '', etag: '' }
}

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben = []
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_platzhalter')
  db.$queryRaw.mockResolvedValue([{ bytes: BigInt(46_000_000) }])
  db.$executeRaw.mockResolvedValue(1)
  db.betriebMessung.aggregate.mockResolvedValue({ _sum: { wert: BigInt(3) } })
  vi.mocked(getOeffentlicheHoefe).mockResolvedValue(LISTE as never)
  vi.mocked(list)
    .mockResolvedValue({ blobs: [], hasMore: false } as never)
    .mockResolvedValueOnce({ blobs: [blob('hoefe/a/1.webp', 400_000, '2026-10-02T10:00:00Z'), blob('hoefe/a/2.webp', 600_000, '2026-09-20T10:00:00Z')], hasMore: true, cursor: 'seite-2' } as never)
    .mockResolvedValueOnce({ blobs: [blob('hoefe/b/3.webp', 1_000_000, '2026-10-15T10:00:00Z')], hasMore: false } as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('messeBetrieb', () => {
  it('liest den Bild-Speicher seitenweise und schreibt je Art eine Zahl für den UTC-Tag', async () => {
    const ergebnis = await messeBetrieb(JETZT)

    expect(vi.mocked(list).mock.calls.map(([o]) => [o?.limit, o?.cursor])).toEqual([
      [1000, undefined],
      [1000, 'seite-2'],
    ])
    expect(ergebnis).toEqual({
      gemessen: ['datenbankBytes', 'bilderBytes', 'bilderDateien', 'bilderUploadsMonat', 'bildVorgaengeMonat', 'hoflisteBytes', 'hoflisteHoefe'],
      fehler: [],
    })
    // Erst die eigenen Auflistungen (2 Seiten), dann alle Werte in EINER Anweisung.
    expect(werteVon(db.$executeRaw.mock.calls[0])).toEqual(['2026-10-16', 2, JETZT])
    expect(werteVon(db.$executeRaw.mock.calls[1])).toEqual([
      ...['2026-10-16', 'datenbankBytes', BigInt(46_000_000), JETZT],
      ...['2026-10-16', 'bilderBytes', BigInt(2_000_000), JETZT],
      ...['2026-10-16', 'bilderDateien', BigInt(3), JETZT],
      ...['2026-10-16', 'bilderUploadsMonat', BigInt(2), JETZT],
      // 2 × 2 Uploads + 3 eigene Auflistungen im Monat (Summe aus der Datenbank).
      ...['2026-10-16', 'bildVorgaengeMonat', BigInt(7), JETZT],
      // Die Hofliste ohne Cache (Nr. 163): Bytes des JSON und die Zahl der Höfe.
      ...['2026-10-16', 'hoflisteBytes', BigInt(LISTE_BYTES), JETZT],
      ...['2026-10-16', 'hoflisteHoefe', BigInt(2), JETZT],
    ])
    expect(getOeffentlicheHoefe).toHaveBeenCalledTimes(1)
  })

  it('scheitert die Hofliste, laufen die anderen Werte weiter — nach Sentry nur Klasse und fester Satz', async () => {
    vi.mocked(getOeffentlicheHoefe).mockRejectedValueOnce(Object.assign(new Error('Hof Grünwiese kaputt'), { name: 'PrismaClientKnownRequestError' }))
    const ergebnis = await messeBetrieb(JETZT)
    expect(ergebnis.fehler).toEqual(['hofliste'])
    expect(ergebnis.gemessen).toEqual(['datenbankBytes', 'bilderBytes', 'bilderDateien', 'bilderUploadsMonat', 'bildVorgaengeMonat'])
    const [fehler, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error, { tags: Record<string, string> }]
    expect([fehler.name, fehler.message]).toEqual(['PrismaClientKnownRequestError', 'Betrieb: Hofliste nicht gemessen'])
    expect(kontext.tags).toEqual({ bereich: 'betrieb', quelle: 'hofliste' })
  })

  it('zwischen 0 und 2 Uhr Wiener Zeit gilt der UTC-Tag — nie der Vortag', async () => {
    await messeBetrieb(new Date('2026-10-15T22:30:00.000Z'))
    expect(werteVon(db.$executeRaw.mock.calls[1])[0]).toBe('2026-10-15')
    await messeBetrieb(new Date('2026-10-16T00:30:00.000Z'))
    expect(werteVon(db.$executeRaw.mock.calls[3])[0]).toBe('2026-10-16')
  })

  it('die Abfrage der Datenbankgröße hat keinen Parameter', async () => {
    await messeBetrieb(JETZT)
    expect(werteVon(db.$queryRaw.mock.calls[0])).toEqual([])
  })

  it('ohne Schlüssel zum Bild-Speicher (lokal): Datenbank gemessen, Bilder als Fehlerklasse ohne Inhalt', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
    const ergebnis = await messeBetrieb(JETZT)
    expect(ergebnis).toEqual({ gemessen: ['datenbankBytes', 'hoflisteBytes', 'hoflisteHoefe'], fehler: ['bilder'] })
    expect(list).not.toHaveBeenCalled()
    const [fehler, kontext] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error, { tags: Record<string, string> }]
    expect([fehler.name, fehler.message]).toEqual(['BildSpeicherOhneZugang', 'Betrieb: Bild-Speicher nicht gemessen'])
    expect(kontext.tags).toEqual({ bereich: 'betrieb', quelle: 'bilder' })
  })

  it('scheitert die Datenbank-Abfrage, werden die Bilder trotzdem geschrieben — ohne den Fehlertext', async () => {
    db.$queryRaw.mockRejectedValueOnce(Object.assign(new Error('Verbindung zu db.example weg'), { name: 'PrismaClientKnownRequestError' }))
    const ergebnis = await messeBetrieb(JETZT)
    expect(ergebnis.fehler).toEqual(['datenbank'])
    expect(ergebnis.gemessen).toContain('bilderBytes')
    const [fehler] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error]
    expect(fehler.message).toBe('Betrieb: Datenbank nicht gemessen')
    expect(fehler.name).toBe('PrismaClientKnownRequestError')
  })
})

describe('mitHerzschlag', () => {
  const nichtsDanach = vi.fn(async () => 0)

  it('gibt das Ergebnis des Laufs unverändert zurück und schreibt Start und Ende (ok, Dauer)', async () => {
    const ergebnis = { deleted: 3 }
    const zurueck = await mitHerzschlag('aufraeumen', async () => ergebnis, nichtsDanach)

    expect(zurueck).toBe(ergebnis)
    expect(db.ablaufLauf.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { name: 'aufraeumen' }, create: expect.objectContaining({ ok: false }) }))
    const [ende] = db.ablaufLauf.updateMany.mock.calls[0] as [{ where: { name: string }; data: { ok: boolean; fehlerKlasse: string | null; dauerMs: number } }]
    expect(ende.where.name).toBe('aufraeumen')
    expect(ende.data).toMatchObject({ ok: true, fehlerKlasse: null })
    expect(ende.data.dauerMs).toBeGreaterThanOrEqual(0)
    expect(nichtsDanach).toHaveBeenCalledTimes(1)
  })

  it('wirft den Fehler des Laufs weiter, schreibt nur die Fehlerklasse und prüft trotzdem die anderen', async () => {
    const fehler = new TypeError('Inhalt, der nie in die Datenbank darf')
    await expect(mitHerzschlag('briefkasten', async () => Promise.reject(fehler), nichtsDanach)).rejects.toBe(fehler)
    const [ende] = db.ablaufLauf.updateMany.mock.calls[0] as [{ data: Record<string, unknown> }]
    expect(ende.data).toMatchObject({ ok: false, fehlerKlasse: 'TypeError' })
    expect(JSON.stringify(ende.data)).not.toContain('Inhalt')
    expect(nichtsDanach).toHaveBeenCalledTimes(1)
  })

  it('scheitert der Herzschlag selbst, läuft der Lauf trotzdem und sein Ergebnis bleibt', async () => {
    db.ablaufLauf.upsert.mockRejectedValueOnce(new Error('Tabelle fehlt'))
    db.ablaufLauf.updateMany.mockRejectedValueOnce(new Error('Tabelle fehlt'))
    const danach = vi.fn(async () => Promise.reject(new Error('Prüfung kaputt')))
    await expect(mitHerzschlag('verwaisteBestellungen', async () => ({ storniert: 1 }), danach)).resolves.toEqual({ storniert: 1 })
    expect(vi.mocked(Sentry.captureException).mock.calls.map(([e]) => (e as Error).message)).toEqual([
      'Betrieb: Herzschlag nicht geschrieben',
      'Betrieb: Herzschlag nicht geschrieben',
      'Betrieb: Abläufe nicht geprüft',
    ])
  })
})

describe('Warnen — nur in der Produktion, nur nach getroffener Zeile', () => {
  it('außerhalb der Produktion: keine Prüfung, keine Abfrage, keine Mail', async () => {
    expect(await pruefeGrenzen(JETZT, { produktion: false })).toBe(0)
    expect(await pruefeAblaeufe(JETZT, { produktion: false })).toBe(0)
    await vi.dynamicImportSettled()
    expect(db.betriebWarnung.findMany).not.toHaveBeenCalled()
    expect(db.ablaufLauf.findMany).not.toHaveBeenCalled()
    expect(sendBetriebWarnung).not.toHaveBeenCalled()
  })

  it('ohne Angabe gilt die Umgebung — unter Vitest keine Produktion', async () => {
    expect(await pruefeAblaeufe(JETZT)).toBe(0)
    expect(db.ablaufLauf.findMany).not.toHaveBeenCalled()
  })

  it('überfälliger Ablauf: eine Mail an die Empfänger der Art „Betrieb“, wenn das bedingte Setzen eine Zeile traf', async () => {
    db.ablaufLauf.findMany.mockResolvedValue([{ name: 'betrieb', gestartetAm: new Date('2026-10-14T04:00:00Z'), beendetAm: new Date('2026-10-14T04:00:05Z'), ok: true, fehlerKlasse: null, dauerMs: 5000 }])
    db.betriebWarnung.findMany.mockResolvedValue([])
    db.$queryRaw.mockResolvedValueOnce([{ art: 'ablauf:betrieb' }])

    expect(await pruefeAblaeufe(JETZT, { produktion: true })).toBe(1)
    expect(werteVon(db.$queryRaw.mock.calls[0]).slice(0, 2)).toEqual(['ablauf:betrieb', 1])
    expect(ladeBetreiberEmpfaenger).toHaveBeenCalledWith('betrieb')
    expect(sendBetriebWarnung).toHaveBeenCalledWith(expect.objectContaining({ art: 'ablauf', name: 'betrieb', stand: 'ueberfaellig', stundenSeit: 48 }), ['team@example.com'])
  })

  it('traf das Setzen keine Zeile (eine andere Prüfung war schneller), geht keine Mail', async () => {
    db.ablaufLauf.findMany.mockResolvedValue([{ name: 'betrieb', gestartetAm: new Date('2026-10-14T04:00:00Z'), beendetAm: null, ok: false, fehlerKlasse: null, dauerMs: null }])
    db.betriebWarnung.findMany.mockResolvedValue([])
    db.$queryRaw.mockResolvedValueOnce([])

    expect(await pruefeAblaeufe(JETZT, { produktion: true })).toBe(0)
    await vi.dynamicImportSettled()
    expect(sendBetriebWarnung).not.toHaveBeenCalled()
  })

  it('„noch kein Lauf“ warnt nie — auch nicht in der Produktion', async () => {
    db.ablaufLauf.findMany.mockResolvedValue([])
    db.betriebWarnung.findMany.mockResolvedValue([])
    expect(await pruefeAblaeufe(JETZT, { produktion: true })).toBe(0)
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })
})

describe('Herzschlag von außen (Nr. 184)', () => {
  it('EINE Anweisung: anlegen oder überschreiben nur, wenn der letzte Herzschlag mindestens eine Minute alt ist', async () => {
    db.$queryRaw.mockResolvedValueOnce([{ name: 'von-aussen' }])
    expect(await schlageVonAussen(JETZT)).toBe(true)
    const [teile] = db.$queryRaw.mock.calls[0] as [TemplateStringsArray]
    expect(teile.join('?')).toMatch(/INSERT INTO "AblaufLauf"[\s\S]*ON CONFLICT \("name"\) DO UPDATE[\s\S]*WHERE "AblaufLauf"\."gestartetAm" <= [\s\S]*RETURNING/)
    expect(werteVon(db.$queryRaw.mock.calls[0])).toEqual(['von-aussen', JETZT, JETZT, new Date(JETZT.getTime() - 60_000)])
  })

  it('keine Zeile zurück (vor weniger als einer Minute schon geschrieben): false', async () => {
    db.$queryRaw.mockResolvedValueOnce([])
    expect(await schlageVonAussen(JETZT)).toBe(false)
  })

  it('still länger als 30 Minuten → Warnung „ablauf:von-aussen“ und eine Mail; nie gerufen → nichts', async () => {
    db.betriebWarnung.findMany.mockResolvedValue([])
    db.ablaufLauf.findMany.mockResolvedValue([])
    expect(await pruefeAblaeufe(JETZT, { produktion: true })).toBe(0)
    expect(db.$queryRaw).not.toHaveBeenCalled()

    db.ablaufLauf.findMany.mockResolvedValue([{ name: 'von-aussen', gestartetAm: new Date(JETZT.getTime() - 31 * 60_000), beendetAm: new Date(JETZT.getTime() - 31 * 60_000), ok: true, fehlerKlasse: null, dauerMs: 0 }])
    db.$queryRaw.mockResolvedValueOnce([{ art: 'ablauf:von-aussen' }])
    expect(await pruefeAblaeufe(JETZT, { produktion: true })).toBe(1)
    expect(werteVon(db.$queryRaw.mock.calls[0]).slice(0, 2)).toEqual(['ablauf:von-aussen', 1])
    expect(sendBetriebWarnung).toHaveBeenCalledWith(expect.objectContaining({ art: 'ablauf', name: 'von-aussen', stand: 'ueberfaellig', wann: 'alle 5 Minuten, von außen' }), ['team@example.com'])
  })
})

describe('„Jetzt messen“ belegt den Beginn in EINER Anweisung (Nr. 113)', () => {
  it('Merker des UTC-Tags, Bedingung „seit 10 Minuten keine Messung und kein Beginn“ in derselben Anweisung — getroffen heißt messen', async () => {
    db.$queryRaw.mockResolvedValueOnce([{ art: 'messBeginn' }])
    expect(await beginneMessung(JETZT)).toBe(true)

    const [teile] = db.$queryRaw.mock.calls[0] as [TemplateStringsArray]
    const sql = teile.join('?')
    expect(sql).toMatch(/INSERT INTO "BetriebMessung"[\s\S]*WHERE NOT EXISTS[\s\S]*ON CONFLICT \("tag", "art"\) DO UPDATE[\s\S]*WHERE "BetriebMessung"\."gemessenAm" <= [\s\S]*RETURNING/)
    const vor10 = new Date(JETZT.getTime() - 10 * 60 * 1000)
    expect(werteVon(db.$queryRaw.mock.calls[0])).toEqual([
      '2026-10-16',
      'messBeginn',
      JETZT,
      ...['bilderBytes', 'bilderDateien', 'bilderUploadsMonat', 'bildVorgaengeMonat', 'datenbankBytes', 'hoflisteBytes', 'hoflisteHoefe', 'messBeginn'],
      vor10,
      vor10,
    ])
  })

  it('keine Zeile zurück (eine Messung begann vor weniger als 10 Minuten oder ein gleichzeitiger Klick war schneller): nicht messen', async () => {
    db.$queryRaw.mockResolvedValueOnce([])
    expect(await beginneMessung(JETZT)).toBe(false)
  })
})

describe('Grenzen: Vercel Pro und Mail nach der Antwort (Nr. 113)', () => {
  const zeile = (art: string, wert: number) => ({ tag: new Date('2026-10-16T00:00:00.000Z'), art, wert: BigInt(wert), gemessenAm: JETZT })

  beforeEach(() => {
    db.betriebMessung.findMany.mockResolvedValue([zeile('datenbankBytes', 6_560_000_000), zeile('bilderBytes', 5_000_000_000)])
    db.betriebMessung.aggregate.mockResolvedValue({ _sum: { wert: null } })
    db.betriebWarnung.findMany.mockResolvedValue([{ art: 'bilder', stufe: 1, seit: new Date('2026-10-01T04:00:00Z'), gemeldetAm: new Date('2026-10-01T04:00:00Z') }])
    db.$queryRaw.mockImplementation(async (teile: TemplateStringsArray, ...werte: unknown[]) => [{ art: String(werte[0]) }])
  })

  it('Bilder ohne feste Grenze: keine Warnung, die alte Stufe still auf 0 — ohne Mail; die Datenbank (82 %) warnt weiter', async () => {
    expect(await pruefeGrenzen(JETZT, { produktion: true })).toBe(1)
    const anweisungen = db.$queryRaw.mock.calls.map((c) => ({ sql: (c[0] as TemplateStringsArray).join('?'), werte: werteVon(c) }))
    expect(anweisungen.filter((a) => a.sql.includes('INSERT INTO "BetriebWarnung"')).map((a) => a.werte.slice(0, 2))).toEqual([['datenbank', 1]])
    expect(anweisungen.filter((a) => a.sql.includes('SET "stufe" = 0')).map((a) => a.werte)).toEqual([['bilder']])
    expect(sendBetriebWarnung).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendBetriebWarnung).mock.calls[0][0]).toMatchObject({ art: 'grenze', wert: 'datenbank', ohneVerwendungBytes: null })
  })

  it('Hofliste ab 80 % von 2 MB: Stufe 1 und eine Mail mit Stand und Trend; darunter keine (Nr. 163)', async () => {
    db.betriebMessung.findMany.mockResolvedValue([zeile('hoflisteBytes', 1_700_000)])
    db.betriebWarnung.findMany.mockResolvedValue([])
    expect(await pruefeGrenzen(JETZT, { produktion: true })).toBe(1)
    expect(vi.mocked(sendBetriebWarnung).mock.calls[0][0]).toMatchObject({ art: 'grenze', wert: 'hofliste', anteil: 85, stand: '1,7 MB von 2 MB sind belegt' })

    vi.mocked(sendBetriebWarnung).mockClear()
    db.betriebMessung.findMany.mockResolvedValue([zeile('hoflisteBytes', 1_500_000)])
    expect(await pruefeGrenzen(JETZT, { produktion: true })).toBe(0)
    expect(sendBetriebWarnung).not.toHaveBeenCalled()
  })

  it('mit `nachher` („Jetzt messen“): Stufe sofort gesetzt, die Mail erst im Nachlauf', async () => {
    expect(await pruefeGrenzen(JETZT, { produktion: true, nachher: true })).toBe(1)
    await vi.dynamicImportSettled()
    expect(sendBetriebWarnung).not.toHaveBeenCalled()
    expect(nachlauf.aufgaben).toHaveLength(1)

    for (const aufgabe of nachlauf.aufgaben.splice(0)) await aufgabe()
    expect(sendBetriebWarnung).toHaveBeenCalledTimes(1)
  })
})

describe('Monatsfenster der E-Mails: Abrechnungszeitraum von Resend (Nr. 162)', () => {
  const zeile = (art: string, wert: number) => ({ tag: new Date('2026-10-16T00:00:00.000Z'), art, wert: BigInt(wert), gemessenAm: JETZT })

  beforeEach(() => {
    db.betriebMessung.findMany.mockResolvedValue([zeile('datenbankBytes', 15_000_000)])
    // 2.600 von 3.000 E-Mails im Zeitraum = 86 % → Stufe 1.
    db.betriebMessung.aggregate.mockResolvedValue({ _sum: { wert: BigInt(2_600) } })
    db.betriebWarnung.findMany.mockResolvedValue([{ art: 'mailsMonat', stufe: 1, seit: new Date('2026-10-02T04:00:00Z'), gemeldetAm: new Date('2026-10-02T04:00:00Z') }])
    db.$queryRaw.mockImplementation(async (teile: TemplateStringsArray, ...werte: unknown[]) => [{ art: String(werte[0]) }])
  })

  it('am 16.: die Summe ab dem 17. des Vormonats; eine Warnung vom 2. zählt im selben Zeitraum — keine zweite Mail', async () => {
    expect(await pruefeGrenzen(JETZT, { produktion: true })).toBe(0)
    expect(db.betriebMessung.aggregate).toHaveBeenCalledWith({ where: { art: 'mails', tag: { gte: new Date('2026-09-17T00:00:00.000Z') } }, _sum: { wert: true } })
    expect(sendBetriebWarnung).not.toHaveBeenCalled()
  })

  it('am 17.: neuer Zeitraum — dieselbe Stufe warnt neu, das bedingte Setzen vergleicht mit dem 17. (Gegenprobe Kalendermonat: 1.)', async () => {
    const am17 = new Date('2026-10-17T04:05:00.000Z')
    db.betriebMessung.findMany.mockResolvedValue([{ ...zeile('datenbankBytes', 15_000_000), tag: new Date('2026-10-17T00:00:00.000Z') }])
    expect(await pruefeGrenzen(am17, { produktion: true })).toBe(1)
    expect(db.betriebMessung.aggregate).toHaveBeenCalledWith({ where: { art: 'mails', tag: { gte: new Date('2026-10-17T00:00:00.000Z') } }, _sum: { wert: true } })
    const setzen = db.$queryRaw.mock.calls.map((c) => werteVon(c)).filter((w) => w[0] === 'mailsMonat')
    expect(setzen).toHaveLength(1)
    expect(setzen[0]).toContainEqual(new Date('2026-10-17T00:00:00.000Z'))
    expect(setzen[0]).not.toContainEqual(new Date('2026-10-01T00:00:00.000Z'))
    expect(vi.mocked(sendBetriebWarnung).mock.calls[0][0]).toMatchObject({ art: 'grenze', wert: 'mailsMonat' })
  })
})

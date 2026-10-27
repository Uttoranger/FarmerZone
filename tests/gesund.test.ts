/**
 * GET /api/gesund (Register N18, Ergänzung 26.10.2026; Nr. 184) — die
 * Prüfung der Seite durch einen externen Uptime-Dienst.
 *
 * Beweist mit gemockter Datenbank und fester Uhr:
 *  - 200 `ok`, wenn die Datenbank antwortet und die Mail-Warteschlange vor
 *    höchstens 10 Minuten lief; sonst 503 `gestoert` — bei DB-Fehler, bei
 *    altem oder fehlendem Mail-Herzschlag und wenn die Datenbank länger als
 *    1 Sekunde braucht. Der Text nennt nie ein Detail, immer `no-store`.
 *  - Das Ergebnis gilt 30 Sekunden je Instanz (keine Abfrage dazwischen).
 *  - Jeder Aufruf ist ein Herzschlag „von außen“, höchstens einmal je Minute
 *    je Instanz (über alle Instanzen sorgt die bedingte Anweisung dafür,
 *    tests/integration/betrieb.int.test.ts); scheitert er, bleibt die Antwort.
 *  - Die Bremse je IP greift in der Produktion (21. Aufruf in der Minute → 429).
 *
 * Die Route hält ihren Zustand im Modul; jeder Fall lädt sie frisch
 * (`vi.resetModules()`), wie eine neue Instanz.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({ $queryRaw: vi.fn(), ablaufLauf: { findUnique: vi.fn() } }))
const betrieb = vi.hoisted(() => ({ schlageVonAussen: vi.fn(async () => true), VON_AUSSEN_ABSTAND_MS: 60_000 }))

const JETZT = new Date('2026-10-26T09:40:00.000Z')

async function ladeRoute(): Promise<typeof import('@/app/api/gesund/route')> {
  vi.resetModules()
  vi.doMock('@/lib/prisma', () => ({ prisma: db }))
  vi.doMock('@/server/betrieb', () => betrieb)
  return import('@/app/api/gesund/route')
}

function anfrage(ip = '203.0.113.7'): NextRequest {
  return new NextRequest('http://localhost/api/gesund', { headers: { 'x-forwarded-for': ip } })
}

function mailsVor(minuten: number) {
  return { gestartetAm: new Date(JETZT.getTime() - minuten * 60_000) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(JETZT)
  db.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
  db.ablaufLauf.findUnique.mockResolvedValue(mailsVor(2))
  betrieb.schlageVonAussen.mockResolvedValue(true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

async function erwarte(antwort: Response, status: number, text: string): Promise<void> {
  expect(antwort.status).toBe(status)
  expect(await antwort.text()).toBe(text)
  expect(antwort.headers.get('cache-control')).toBe('no-store')
}

describe('/api/gesund — Antwort', () => {
  it('Datenbank antwortet, Mails vor 2 Minuten: 200 „ok“, no-store', async () => {
    const { GET } = await ladeRoute()
    await erwarte(await GET(anfrage()), 200, 'ok')
    expect(db.ablaufLauf.findUnique).toHaveBeenCalledWith({ where: { name: 'mails' }, select: { gestartetAm: true } })
  })

  it('Datenbank-Fehler: 503 „gestoert“ — ohne Detail', async () => {
    db.$queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:5432'))
    const { GET } = await ladeRoute()
    const antwort = await GET(anfrage())
    expect(antwort.status).toBe(503)
    const text = await antwort.text()
    expect(text).toBe('gestoert')
    expect(text).not.toMatch(/ECONN|5432|Error/)
    expect(antwort.headers.get('cache-control')).toBe('no-store')
  })

  it('Mail-Herzschlag 11 Minuten alt: 503; genau 10 Minuten: noch 200 (Gegenprobe)', async () => {
    db.ablaufLauf.findUnique.mockResolvedValue(mailsVor(11))
    await erwarte(await (await ladeRoute()).GET(anfrage()), 503, 'gestoert')
    db.ablaufLauf.findUnique.mockResolvedValue(mailsVor(10))
    await erwarte(await (await ladeRoute()).GET(anfrage()), 200, 'ok')
  })

  it('Mail-Warteschlange lief nie (keine Zeile): 503', async () => {
    db.ablaufLauf.findUnique.mockResolvedValue(null)
    await erwarte(await (await ladeRoute()).GET(anfrage()), 503, 'gestoert')
  })

  it('Datenbank braucht länger als 1 Sekunde: 503', async () => {
    db.$queryRaw.mockReturnValue(new Promise(() => {}))
    const { GET } = await ladeRoute()
    const laeuft = GET(anfrage())
    await vi.advanceTimersByTimeAsync(1_001)
    await erwarte(await laeuft, 503, 'gestoert')
  })
})

describe('/api/gesund — 30 Sekunden im Speicher der Instanz', () => {
  it('innerhalb von 30 s keine neue Abfrage, danach wieder', async () => {
    const { GET } = await ladeRoute()
    await erwarte(await GET(anfrage()), 200, 'ok')
    db.$queryRaw.mockRejectedValue(new Error('weg'))
    vi.setSystemTime(new Date(JETZT.getTime() + 29_000))
    await erwarte(await GET(anfrage()), 200, 'ok')
    expect(db.$queryRaw).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date(JETZT.getTime() + 30_000))
    await erwarte(await GET(anfrage()), 503, 'gestoert')
    expect(db.$queryRaw).toHaveBeenCalledTimes(2)
  })
})

describe('/api/gesund — Herzschlag „von außen“', () => {
  it('höchstens einmal je Minute: drei Aufrufe in 59 s → einer; nach 60 s der nächste', async () => {
    const { GET } = await ladeRoute()
    await GET(anfrage())
    vi.setSystemTime(new Date(JETZT.getTime() + 20_000))
    await GET(anfrage())
    vi.setSystemTime(new Date(JETZT.getTime() + 59_000))
    await GET(anfrage())
    expect(betrieb.schlageVonAussen).toHaveBeenCalledTimes(1)
    expect(betrieb.schlageVonAussen).toHaveBeenCalledWith(JETZT)
    vi.setSystemTime(new Date(JETZT.getTime() + 60_000))
    await GET(anfrage())
    expect(betrieb.schlageVonAussen).toHaveBeenCalledTimes(2)
  })

  it('auch bei gestörter Seite schlägt das Herz (der Dienst hat gerufen); ein Fehler beim Schreiben ändert die Antwort nicht', async () => {
    db.$queryRaw.mockRejectedValue(new Error('weg'))
    betrieb.schlageVonAussen.mockRejectedValue(new Error('auch weg'))
    const { GET } = await ladeRoute()
    await erwarte(await GET(anfrage()), 503, 'gestoert')
    expect(betrieb.schlageVonAussen).toHaveBeenCalledTimes(1)
  })
})

describe('/api/gesund — Bremse je IP', () => {
  it('in der Produktion: 20 Aufrufe je Minute und IP, der 21. bekommt 429 — eine andere IP nicht', async () => {
    const { GET } = await ladeRoute()
    // Erst nach dem Laden: env.ts prüfte sonst beim Import die Variablen der Produktion.
    vi.stubEnv('NODE_ENV', 'production')
    for (let i = 0; i < 20; i++) expect((await GET(anfrage())).status).toBe(200)
    expect((await GET(anfrage())).status).toBe(429)
    expect((await GET(anfrage('198.51.100.9'))).status).toBe(200)
  })
})

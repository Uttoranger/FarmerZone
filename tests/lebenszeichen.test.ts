/**
 * Das Lebenszeichen (Register N18, Nr. 113): GET /api/lebenszeichen, täglich
 * von außen aufgerufen (.github/workflows/lebenszeichen.yml).
 *
 * Beweist mit gemockter Datenbank und fester Uhr:
 *  - fail-closed: ohne LEBENSZEICHEN_TOKEN 503 (nie 200), ohne oder mit
 *    falschem Bearer-Token 401 — beides ohne Abfrage der Abläufe;
 *  - 200 `{ ok: true }` nur, wenn jeder tägliche Ablauf in den letzten 26
 *    Stunden, der wöchentliche in den letzten 8 Tagen und die
 *    Mail-Warteschlange in den letzten 10 Minuten ok lief;
 *  - sonst 503 mit den NAMEN der fehlenden Abläufe — nichts sonst (keine
 *    Zeit, keine Fehlerklasse); ein täglicher Ablauf ohne Zeile fehlt
 *    (fail-closed), nur der wöchentliche hat ohne Zeile Schonfrist;
 *  - seit Nr. 161 auch 503 mit `mailWartet: true`, wenn eine wichtige Mail
 *    länger als 15 Minuten wartet — ohne Art, Zeit oder Bezug; 15 Minuten
 *    genau sind noch 200 (Gegenprobe).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({ ablaufLauf: { findMany: vi.fn() }, mailAuftrag: { findFirst: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { GET } from '@/app/api/lebenszeichen/route'

const TOKEN = 'lebenszeichen-testwert-abcdefghij'
const JETZT = new Date('2026-10-20T07:17:00.000Z')

function anfrage(authorization?: string): NextRequest {
  return new NextRequest('http://localhost/api/lebenszeichen', { headers: authorization === undefined ? {} : { authorization } })
}

/** Ein Lauf, der vor `stunden` Stunden begann und gut (oder mit Fehler) endete. */
function lauf(name: string, stunden: number, ok = true) {
  const gestartetAm = new Date(JETZT.getTime() - stunden * 3_600_000)
  return { name, gestartetAm, beendetAm: new Date(gestartetAm.getTime() + 2_000), ok, fehlerKlasse: ok ? null : 'TypeError', dauerMs: 2_000 }
}

/** Die Mail-Warteschlange läuft jede Minute (N26, Nr. 158): vor 3 Minuten ist pünktlich. */
const MAILS = lauf('mails', 0.05)
/** Der Geld-Abgleich (Nr. 191) läuft täglich um 06:30 UTC. */
const GELD = lauf('geld-abgleich', 1)
// Nr. 198: die Monatsabrechnung läuft täglich wie der Geld-Abgleich.
const MONAT = lauf('monatsabrechnung', 2)
const ALLE_PUENKTLICH = [lauf('aufraeumen', 4), lauf('verwaisteBestellungen', 3.5), lauf('betrieb', 3), lauf('briefkasten', 24), MAILS, GELD, MONAT]

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(JETZT)
  vi.stubEnv('LEBENSZEICHEN_TOKEN', TOKEN)
  db.ablaufLauf.findMany.mockResolvedValue(ALLE_PUENKTLICH)
  db.mailAuftrag.findFirst.mockResolvedValue(null)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Lebenszeichen — Zugang (fail-closed)', () => {
  it('ohne Token: 401, keine Abfrage', async () => {
    const antwort = await GET(anfrage())
    expect(antwort.status).toBe(401)
    expect(db.ablaufLauf.findMany).not.toHaveBeenCalled()
  })

  it('falsches Token — gleich lang, anders lang, ohne „Bearer“: 401, keine Abfrage', async () => {
    for (const kopf of [`Bearer ${TOKEN.slice(0, -1)}${TOKEN.endsWith('X') ? 'Y' : 'X'}`, `Bearer ${TOKEN}0`, TOKEN, 'Bearer ']) {
      expect((await GET(anfrage(kopf))).status, kopf).toBe(401)
    }
    expect(db.ablaufLauf.findMany).not.toHaveBeenCalled()
  })

  it('ohne Variable (auch leer): 503, nie 200 — auch mit einem Token, das sonst passen würde', async () => {
    vi.stubEnv('LEBENSZEICHEN_TOKEN', '')
    const antwort = await GET(anfrage('Bearer '))
    expect(antwort.status).toBe(503)
    expect(db.ablaufLauf.findMany).not.toHaveBeenCalled()
  })
})

describe('Lebenszeichen — Abläufe', () => {
  it('alle pünktlich: 200 und genau { ok: true }, nicht zwischengespeichert', async () => {
    const antwort = await GET(anfrage(`Bearer ${TOKEN}`))
    expect(antwort.status).toBe(200)
    expect(await antwort.json()).toEqual({ ok: true })
    expect(antwort.headers.get('cache-control')).toBe('no-store')
  })

  it('ein täglicher Ablauf überfällig (27 Stunden): 503 mit seinem Namen — nichts sonst', async () => {
    db.ablaufLauf.findMany.mockResolvedValue([lauf('aufraeumen', 4), lauf('verwaisteBestellungen', 3.5), lauf('betrieb', 27), lauf('briefkasten', 24), MAILS, GELD, MONAT])
    const antwort = await GET(anfrage(`Bearer ${TOKEN}`))
    expect(antwort.status).toBe(503)
    expect(await antwort.json()).toEqual({ fehlen: ['betrieb'] })
  })

  it('der Wochenlauf 7 Tage alt: 200; 8 Tage und eine Stunde: 503 mit seinem Namen', async () => {
    const mitWoche = (stunden: number) => [...ALLE_PUENKTLICH.slice(0, 3), lauf('briefkasten', stunden), MAILS, GELD, MONAT]
    db.ablaufLauf.findMany.mockResolvedValue(mitWoche(7 * 24))
    expect((await GET(anfrage(`Bearer ${TOKEN}`))).status).toBe(200)
    db.ablaufLauf.findMany.mockResolvedValue(mitWoche(8 * 24 + 1))
    const antwort = await GET(anfrage(`Bearer ${TOKEN}`))
    expect(antwort.status).toBe(503)
    expect(await antwort.json()).toEqual({ fehlen: ['briefkasten'] })
  })

  it('ein gescheiterter Lauf fehlt ebenfalls — ohne Fehlerklasse in der Antwort', async () => {
    db.ablaufLauf.findMany.mockResolvedValue([lauf('aufraeumen', 4, false), ...ALLE_PUENKTLICH.slice(1)])
    const antwort = await GET(anfrage(`Bearer ${TOKEN}`))
    expect(antwort.status).toBe(503)
    const text = await antwort.text()
    expect(JSON.parse(text)).toEqual({ fehlen: ['aufraeumen'] })
    expect(text).not.toContain('TypeError')
  })

  it('ein täglicher Ablauf ganz ohne Zeile fehlt (fail-closed): 503 mit seinem Namen', async () => {
    db.ablaufLauf.findMany.mockResolvedValue([lauf('aufraeumen', 4), lauf('verwaisteBestellungen', 3.5), lauf('briefkasten', 24), MAILS, GELD, MONAT])
    const antwort = await GET(anfrage(`Bearer ${TOKEN}`))
    expect(antwort.status).toBe(503)
    expect(await antwort.json()).toEqual({ fehlen: ['betrieb'] })
  })

  it('gar keine Zeile (Tabelle leer): 503 mit den drei täglichen Abläufen und der Mail-Warteschlange — der wöchentliche hat Schonfrist', async () => {
    db.ablaufLauf.findMany.mockResolvedValue([])
    const antwort = await GET(anfrage(`Bearer ${TOKEN}`))
    expect(antwort.status).toBe(503)
    expect(await antwort.json()).toEqual({ fehlen: ['aufraeumen', 'verwaisteBestellungen', 'betrieb', 'mails', 'monatsabrechnung', 'geld-abgleich'] })
  })

  it('die Mail-Warteschlange vor 9 Minuten: 200; vor 11 Minuten oder ohne Zeile: 503 mit ihrem Namen (N26)', async () => {
    const ohneMails = [...ALLE_PUENKTLICH.slice(0, 4), GELD, MONAT]
    db.ablaufLauf.findMany.mockResolvedValue([...ohneMails, lauf('mails', 9 / 60)])
    expect((await GET(anfrage(`Bearer ${TOKEN}`))).status).toBe(200)
    db.ablaufLauf.findMany.mockResolvedValue([...ohneMails, lauf('mails', 11 / 60)])
    const alt = await GET(anfrage(`Bearer ${TOKEN}`))
    expect(alt.status).toBe(503)
    expect(await alt.json()).toEqual({ fehlen: ['mails'] })
    db.ablaufLauf.findMany.mockResolvedValue(ohneMails)
    expect(await (await GET(anfrage(`Bearer ${TOKEN}`))).json()).toEqual({ fehlen: ['mails'] })
  })

  it('Gegenprobe: nur der wöchentliche Ablauf ohne Zeile fehlt nicht (nach dem Deploy bis Montag): 200', async () => {
    db.ablaufLauf.findMany.mockResolvedValue([...ALLE_PUENKTLICH.slice(0, 3), MAILS, GELD, MONAT])
    expect((await GET(anfrage(`Bearer ${TOKEN}`))).status).toBe(200)
  })
})

describe('Lebenszeichen — wartende wichtige Mail (Nr. 161)', () => {
  const wartetSeit = (minuten: number) => ({ erstelltAm: new Date(JETZT.getTime() - minuten * 60_000), bestellungId: 'bestellung_1' })

  it('eine wichtige Mail wartet 16 Minuten: 503 mit mailWartet — ohne Art, Zeit oder Kennung', async () => {
    db.mailAuftrag.findFirst.mockResolvedValue(wartetSeit(16))
    const antwort = await GET(anfrage(`Bearer ${TOKEN}`))
    expect(antwort.status).toBe(503)
    expect(await antwort.json()).toEqual({ fehlen: [], mailWartet: true })
    // Gefragt wird nur nach wartenden wichtigen Mails, die älteste zuerst.
    expect(db.mailAuftrag.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ['offen', 'in_arbeit'] }, vorrang: 1 }, orderBy: { erstelltAm: 'asc' } })
    )
  })

  it('Gegenprobe: 15 Minuten genau sind noch 200; ein fehlender Ablauf steht weiter mit Namen da', async () => {
    db.mailAuftrag.findFirst.mockResolvedValue(wartetSeit(15))
    expect((await GET(anfrage(`Bearer ${TOKEN}`))).status).toBe(200)
    db.mailAuftrag.findFirst.mockResolvedValue(wartetSeit(30))
    db.ablaufLauf.findMany.mockResolvedValue([...ALLE_PUENKTLICH.slice(0, 4), GELD, MONAT])
    expect(await (await GET(anfrage(`Bearer ${TOKEN}`))).json()).toEqual({ fehlen: ['mails'], mailWartet: true })
  })
})

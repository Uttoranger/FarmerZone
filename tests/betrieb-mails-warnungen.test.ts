/**
 * Die Warnungen der Mail-Warteschlange im Ablauf „E-Mails“ (Nr. 161,
 * Register N18, Ergänzung 24.10.2026; `pruefeMailWarnungen` in
 * src/server/betrieb.ts).
 *
 * Beweist mit gemockter Datenbank, je mit Gegenprobe:
 *  - eigene Drossel: Trifft der Merker keine Zeile (letzte Prüfung jünger als
 *    10 Minuten), prüft sie nichts; außerhalb der Produktion nie;
 *  - jede Warnung (wartet, hängt, abgelehnt, Spam) setzt erst die Stufe
 *    bedingt (Regel „ablauf“: einmal am Tag) und schickt NUR nach getroffener
 *    Zeile die Warn-Mail an die Empfänger der Art „Betrieb“ — direkt;
 *  - gilt sie nicht mehr, geht die Stufe still auf 0 (keine Mail);
 *  - das Kontingent des Abrechnungszeitraums: 80 % → Warnung „mailsMonat“
 *    nach der Monatsregel (dieselbe Zeile wie der Mess-Lauf).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  betriebWarnung: { findMany: vi.fn() },
}))
const mails = vi.hoisted(() => ({ ladeMailZaehler: vi.fn(), ladeQuoten: vi.fn(), ladeWarteschlange: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@vercel/blob', () => ({ list: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendBetriebWarnung: vi.fn(async () => ({ gesendet: 1, gescheitert: 0 })) }))
vi.mock('@/server/queries/postfach', () => ({ ladeBetreiberEmpfaenger: vi.fn(async () => ['team@example.com']) }))
vi.mock('@/server/queries/farm', () => ({ getOeffentlicheHoefe: vi.fn() }))
vi.mock('@/server/queries/mails', () => mails)

import { sendBetriebWarnung } from '@/lib/email'
import { beginneMailPruefung, pruefeMailWarnungen } from '@/server/betrieb'

const JETZT = new Date('2026-10-24T07:42:00.000Z')
const minuten = (n: number): Date => new Date(JETZT.getTime() - n * 60_000)
const RUHIG = { wichtig: 0, kannWarten: 0, aeltesteWichtigeAm: null, aeltesteWichtige: null, faelligSeit: null, kannWartenPausiert: false }

function sqlVon(aufruf: unknown[]): { text: string; werte: unknown[] } {
  const [teile, ...werte] = aufruf as [TemplateStringsArray, ...unknown[]]
  const sql = Prisma.sql(teile, ...werte)
  return { text: sql.sql, werte: sql.values }
}

/** Die Rohabfragen in Reihenfolge: zuerst der Merker, dann je gesetzter Stufe eine Zeile. */
function rohAntworten(merker: boolean, stufen: boolean): void {
  db.$queryRaw.mockImplementation(async (teile: TemplateStringsArray) => {
    const text = teile.join('?')
    if (text.includes('"BetriebMessung"')) return merker ? [{ art: 'mailPruefung' }] : []
    if (text.includes('INSERT INTO "BetriebWarnung"')) return stufen ? [{ art: 'x' }] : []
    if (text.includes('UPDATE "BetriebWarnung"')) return [{ art: 'x' }]
    return []
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  db.betriebWarnung.findMany.mockResolvedValue([])
  mails.ladeMailZaehler.mockResolvedValue({ heute: 10, imZeitraum: 100 })
  mails.ladeQuoten.mockResolvedValue({ gesendet: 0, abgelehnt: 0, spam: 0 })
  mails.ladeWarteschlange.mockResolvedValue(RUHIG)
  rohAntworten(true, true)
})

describe('Drossel', () => {
  it('der Merker belegt EINE Zeile je UTC-Tag, nur wenn die letzte Prüfung 10 Minuten zurückliegt', async () => {
    expect(await beginneMailPruefung(JETZT)).toBe(true)
    const { text, werte } = sqlVon(db.$queryRaw.mock.calls[0])
    expect(text).toContain('ON CONFLICT ("tag", "art") DO UPDATE')
    expect(text).toContain('WHERE "BetriebMessung"."gemessenAm" <=')
    expect(werte).toEqual(['2026-10-24', 'mailPruefung', JETZT, minuten(10)])
  })

  it('jüngere Prüfung: nichts gelesen, nichts gesetzt, keine Mail', async () => {
    rohAntworten(false, true)
    mails.ladeWarteschlange.mockResolvedValue({ ...RUHIG, aeltesteWichtigeAm: minuten(30) })
    expect(await pruefeMailWarnungen(JETZT, { produktion: true })).toBe(0)
    expect(mails.ladeWarteschlange).not.toHaveBeenCalled()
    expect(sendBetriebWarnung).not.toHaveBeenCalled()
  })

  it('außerhalb der Produktion: nie', async () => {
    expect(await pruefeMailWarnungen(JETZT, { produktion: false })).toBe(0)
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })
})

describe('Warnungen', () => {
  it('eine wichtige Mail wartet 7 Minuten: Stufe bedingt, dann EINE Warn-Mail an „Betrieb“', async () => {
    mails.ladeWarteschlange.mockResolvedValue({ ...RUHIG, wichtig: 1, aeltesteWichtigeAm: minuten(7) })
    expect(await pruefeMailWarnungen(JETZT, { produktion: true })).toBe(1)
    const setzen = db.$queryRaw.mock.calls.map(sqlVon).filter((q) => q.text.includes('INSERT INTO "BetriebWarnung"'))
    expect(setzen).toHaveLength(1)
    expect(setzen[0].werte[0]).toBe('mail:wartet')
    // Regel „ablauf“: Stufe 0 oder vor heute gemeldet.
    expect(setzen[0].text).toContain('"BetriebWarnung"."stufe" = 0 OR "BetriebWarnung"."gemeldetAm" <')
    expect(sendBetriebWarnung).toHaveBeenCalledWith({ art: 'mails', warnung: 'mail:wartet', wert: '7 Minuten' }, ['team@example.com'])
  })

  it('Gegenprobe: traf das Setzen keine Zeile (heute schon gemeldet), geht keine Mail', async () => {
    rohAntworten(true, false)
    mails.ladeWarteschlange.mockResolvedValue({ ...RUHIG, wichtig: 1, aeltesteWichtigeAm: minuten(7) })
    expect(await pruefeMailWarnungen(JETZT, { produktion: true })).toBe(0)
    expect(sendBetriebWarnung).not.toHaveBeenCalled()
  })

  it('hängt, abgelehnt und Spam: je eine Mail mit ihrem Wert', async () => {
    mails.ladeWarteschlange.mockResolvedValue({ ...RUHIG, faelligSeit: minuten(20) })
    mails.ladeQuoten.mockResolvedValue({ gesendet: 1_000, abgelehnt: 30, spam: 1 })
    expect(await pruefeMailWarnungen(JETZT, { produktion: true })).toBe(3)
    expect(vi.mocked(sendBetriebWarnung).mock.calls.map(([a]) => a)).toEqual([
      { art: 'mails', warnung: 'mail:haengt', wert: '20 Minuten' },
      { art: 'mails', warnung: 'mail:abgelehnt', wert: '3,0 %' },
      { art: 'mails', warnung: 'mail:spam', wert: '0,10 %' },
    ])
  })

  it('gilt eine offene Warnung nicht mehr: still auf 0, keine Mail', async () => {
    db.betriebWarnung.findMany.mockResolvedValue([{ art: 'mail:wartet', stufe: 1, seit: minuten(30), gemeldetAm: minuten(30) }])
    expect(await pruefeMailWarnungen(JETZT, { produktion: true })).toBe(0)
    const nullen = db.$queryRaw.mock.calls.map(sqlVon).filter((q) => q.text.includes('UPDATE "BetriebWarnung" SET "stufe" = 0'))
    expect(nullen.map((q) => q.werte[0])).toEqual(['mail:wartet'])
    expect(sendBetriebWarnung).not.toHaveBeenCalled()
  })

  it('Kontingent 80 % im Abrechnungszeitraum: Warnung „mailsMonat“ nach der Monatsregel', async () => {
    mails.ladeMailZaehler.mockResolvedValue({ heute: 10, imZeitraum: 2_400 })
    expect(await pruefeMailWarnungen(JETZT, { produktion: true })).toBe(1)
    const setzen = db.$queryRaw.mock.calls.map(sqlVon).filter((q) => q.text.includes('INSERT INTO "BetriebWarnung"'))
    expect(setzen.map((q) => q.werte[0])).toEqual(['mailsMonat'])
    // Der Monat beginnt am 17. (Abrechnungszeitraum von Resend).
    expect(setzen[0].werte).toContainEqual(new Date('2026-10-17T00:00:00.000Z'))
    expect(vi.mocked(sendBetriebWarnung).mock.calls[0][0]).toMatchObject({ art: 'grenze', wert: 'mailsMonat', anteil: 80 })
  })

  it('Gegenprobe: unter 80 % keine Kontingent-Warnung', async () => {
    mails.ladeMailZaehler.mockResolvedValue({ heute: 10, imZeitraum: 2_399 })
    expect(await pruefeMailWarnungen(JETZT, { produktion: true })).toBe(0)
  })
})

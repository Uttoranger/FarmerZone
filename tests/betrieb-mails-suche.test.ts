/**
 * Admin › Betrieb › E-Mails — die Suche (Nr. 161 Punkt 5; Register N26, N27).
 *
 * Beweist, je mit Gegenprobe:
 *  - das EINE Feld entscheidet ohne Datenbank: Muster einer Bestellnummer →
 *    Bestellung, ganze Adresse → Adresse (klein, getrimmt), Teiladresse oder
 *    Unsinn → ungültig;
 *  - Bestellnummer: die Bestellung (gleich der Nummer, 90 Tage) und alle
 *    Aufträge mit ihrer `bestellungId`;
 *  - Adresse: exakt — Bestellungen mit `customerEmail` GLEICH der Eingabe,
 *    Aufträge mit dem Fingerabdruck der Eingabe; andere Groß/Kleinschreibung
 *    trifft, eine Teiladresse nie;
 *  - `empfaengerFingerabdruck`: gleiche Adresse → gleicher Wert (auch in
 *    anderer Schreibweise), anderer Zweck → anderer Wert;
 *  - Wache: in src/server/queries/mails.ts kein LIKE, kein `contains`,
 *    `startsWith`, `endsWith`, `search` und kein `mode: 'insensitive'`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const db = vi.hoisted(() => ({
  order: { findFirst: vi.fn(), findMany: vi.fn() },
  mailAuftrag: { findMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { mailSucheAus } from '@/schemas/betrieb-mails'
import { bestellnummerSchema } from '@/schemas/bestellnummer'
import { empfaengerFingerabdruck } from '@/lib/mail-empfaenger'
import { sucheMails } from '@/server/queries/mails'

const JETZT = new Date('2026-10-24T07:42:00.000Z')
const VOR_90_TAGEN = new Date(JETZT.getTime() - 90 * 86_400_000)

const BESTELLUNG = {
  id: 'bestellung_1',
  orderNumber: 'HM-2611-A4F2',
  pickupDate: JETZT,
  paymentMethod: 'ONLINE',
  paymentStatus: 'PAID',
  status: 'PAID',
  customerEmail: 'kundin.erfunden@example.at',
  farm: { name: 'Testhof A' },
}

beforeEach(() => {
  vi.clearAllMocks()
  db.order.findFirst.mockResolvedValue(null)
  db.order.findMany.mockResolvedValue([])
  db.mailAuftrag.findMany.mockResolvedValue([])
})

describe('Das Feld entscheidet ohne Datenbank', () => {
  it.each([
    ['HM-2611-A4F2', { art: 'bestellung', nummer: 'HM-2611-A4F2' }],
    ['  hm-2611-a4f2 ', { art: 'bestellung', nummer: 'HM-2611-A4F2' }],
    ['TD-0001', { art: 'bestellung', nummer: 'TD-0001' }],
    ['Kundin.Erfunden@Example.AT', { art: 'adresse', adresse: 'kundin.erfunden@example.at' }],
    [' kundin.erfunden@example.at ', { art: 'adresse', adresse: 'kundin.erfunden@example.at' }],
  ])('%s → %o', (eingabe, erwartet) => {
    expect(mailSucheAus(eingabe)).toEqual(erwartet)
  })

  it.each(['kundin.erfunden@', '@example.at', 'kundin', 'HM 2611', 'k%@example.at %', 'x'.repeat(300), 'HM-2611-A4F2-ZU-LANG-X'])('Teiladresse oder Unsinn „%s“ → ungültig', (eingabe) => {
    expect(mailSucheAus(eingabe)).toEqual({ art: 'ungueltig' })
  })

  it('leer, fehlend oder mehrfach in der Adresse → leer (kein Fehler)', () => {
    expect(mailSucheAus(undefined)).toEqual({ art: 'leer' })
    expect(mailSucheAus('   ')).toEqual({ art: 'leer' })
    expect(mailSucheAus(['a', 'b'])).toEqual({ art: 'leer' })
  })

  it('eine Bestellnummer ist nie eine Adresse und umgekehrt', () => {
    expect(bestellnummerSchema.safeParse('kundin@example.at').success).toBe(false)
    expect(bestellnummerSchema.safeParse('HM-2611-A4F2').success).toBe(true)
  })
})

describe('sucheMails', () => {
  it('Bestellnummer: die Bestellung der letzten 90 Tage und alle Aufträge mit ihrer bestellungId', async () => {
    db.order.findFirst.mockResolvedValue(BESTELLUNG)
    db.mailAuftrag.findMany.mockResolvedValue([{ id: 'm1', art: 'abholbereit' }])
    const ergebnis = await sucheMails({ art: 'bestellung', nummer: 'HM-2611-A4F2' }, JETZT)

    expect(db.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { orderNumber: 'HM-2611-A4F2', createdAt: { gte: VOR_90_TAGEN } } }))
    expect(db.mailAuftrag.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { bestellungId: 'bestellung_1' } }))
    expect(ergebnis.bestellungen.map((b) => [b.orderNumber, b.hofName])).toEqual([['HM-2611-A4F2', 'Testhof A']])
    expect(ergebnis.mails).toHaveLength(1)
    // Gelesen werden nie Bezug oder Fingerabdruck.
    const felder = Object.keys(db.mailAuftrag.findMany.mock.calls[0][0].select)
    expect(felder).not.toContain('bezug')
    expect(felder).not.toContain('empfaengerHash')
  })

  it('Gegenprobe: unbekannte Nummer → keine Bestellung, keine Abfrage der Aufträge', async () => {
    expect(await sucheMails({ art: 'bestellung', nummer: 'XX-0000-0000' }, JETZT)).toEqual({ bestellungen: [], mails: [] })
    expect(db.mailAuftrag.findMany).not.toHaveBeenCalled()
  })

  it('Adresse: GLEICH der Eingabe und gleich ihrem Fingerabdruck — auch ohne Bestellung', async () => {
    const eingabe = mailSucheAus('Kundin.Erfunden@Example.AT')
    if (eingabe.art !== 'adresse') throw new Error('Adresse erwartet')
    db.mailAuftrag.findMany.mockResolvedValue([{ id: 'm3', art: 'anmeldecode', bestellungId: null }])
    const ergebnis = await sucheMails(eingabe, JETZT)

    expect(db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { customerEmail: 'kundin.erfunden@example.at', createdAt: { gte: VOR_90_TAGEN } } }))
    expect(db.mailAuftrag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empfaengerHash: empfaengerFingerabdruck('kundin.erfunden@example.at'), erstelltAm: { gte: VOR_90_TAGEN } } })
    )
    expect(ergebnis.mails).toHaveLength(1)
  })

  it('Adresse: Aufträge zu einer Bestellung ohne diese Adresse laden ihre Bestellung dazu (Mail an den Hof)', async () => {
    db.mailAuftrag.findMany.mockResolvedValue([{ id: 'm4', art: 'bestellung-bezahlt-hof', bestellungId: 'bestellung_1' }])
    db.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([BESTELLUNG])
    const ergebnis = await sucheMails({ art: 'adresse', adresse: 'hof.erfunden@example.at' }, JETZT)
    expect(db.order.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: { in: ['bestellung_1'] } } }))
    expect(ergebnis.bestellungen).toHaveLength(1)
  })
})

describe('empfaengerFingerabdruck', () => {
  it('gleiche Adresse → gleicher Wert, auch in anderer Schreibweise; andere Adresse → anderer Wert', () => {
    expect(empfaengerFingerabdruck('Kundin@Example.at ')).toBe(empfaengerFingerabdruck('kundin@example.at'))
    expect(empfaengerFingerabdruck('kundin@example.at')).not.toBe(empfaengerFingerabdruck('kundin2@example.at'))
  })

  it('anderer Zweck → anderer Wert (das Präfix trennt die Suche von den Signaturen mit demselben Geheimnis)', () => {
    const geheim = process.env.BETTER_AUTH_SECRET ?? ''
    const ohneZweck = createHmac('sha256', geheim).update('kundin@example.at').digest('hex')
    const andererZweck = createHmac('sha256', geheim).update('unsubscribe:kundin@example.at').digest('hex')
    const gleicherZweck = createHmac('sha256', geheim).update('mail-empfaenger:kundin@example.at').digest('hex')
    expect(empfaengerFingerabdruck('kundin@example.at')).toBe(gleicherZweck)
    expect([ohneZweck, andererZweck]).not.toContain(empfaengerFingerabdruck('kundin@example.at'))
  })
})

describe('Wache: keine Teilsuche auf Adressen', () => {
  const VERBOTEN = [/\bLIKE\b/i, /\bcontains\s*:/, /\bstartsWith\s*:/, /\bendsWith\s*:/, /\bsearch\s*:/, /mode\s*:\s*['"]insensitive['"]/]
  const funde = (quelltext: string): string[] => VERBOTEN.filter((r) => r.test(quelltext)).map((r) => r.source)
  // Kommentare zählen nicht: Der Kopf der Datei erklärt, warum es kein LIKE gibt.
  const ohneKommentare = (q: string): string => q.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('src/server/queries/mails.ts sucht Adressen nur mit Gleichheit', () => {
    expect(funde(ohneKommentare(readFileSync(join(process.cwd(), 'src/server/queries/mails.ts'), 'utf8')))).toEqual([])
  })

  it('Gegenprobe: die Wache schlägt an LIKE, contains und mode insensitive an', () => {
    expect(funde("prisma.order.findMany({ where: { customerEmail: { contains: a, mode: 'insensitive' } } })")).toHaveLength(2)
    expect(funde('SELECT * FROM "Order" WHERE "customerEmail" LIKE $1')).toHaveLength(1)
    expect(funde(ohneKommentare('/* kein LIKE */\nconst a = 1'))).toEqual([])
  })
})

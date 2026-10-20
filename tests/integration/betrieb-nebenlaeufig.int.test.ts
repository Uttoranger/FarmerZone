/**
 * Zwei gleichzeitige Aufrufe im Betrieb gegen ein ECHTES Postgres (Register
 * N18, Nr. 113; die Prüfung kam mit Nr. 121 nach, Morgenbericht 17 §9). Beide
 * Wege tun ihre Arbeit in EINER Anweisung statt Lesen-dann-Schreiben — der
 * Zustand in der Datenbank ist die Aussage, nicht der Weg, den ein Aufruf nahm.
 *
 * Beweist:
 *  - beginneMessung („Jetzt messen“): Zwei (auch acht) gleichzeitige Aufrufe →
 *    genau EIN Beginn, eine Zeile des Merkers; innerhalb von 10 Minuten
 *    beginnt keine zweite Messung, nach genau 10 Minuten wieder eine.
 *  - verbucheVercelAusgaben (Webhook von Spend Management): Zwei gleichzeitige
 *    Meldungen derselben Stufe → genau EINE Mail (nach der Antwort), die Stufe
 *    steht auf 1, Ausgaben und Limit je als eine Zeile; dieselbe Stufe noch
 *    einmal bringt keine Mail, die nächste Stufe eine.
 *
 * Daten: Der Merker des Beginns prüft alle Tage (Messungen der letzten 10
 * Minuten, egal welcher Tag). Der Test rechnet darum mit einem Zeitpunkt weit
 * nach allen echten Zeilen (2040) und räumt diesen Merker selbst weg; die
 * Meldungen des Webhooks stehen an einem Tag im Jahr 2001 (wie
 * betrieb.int.test.ts). Die Warnstufe der Vercel-Ausgaben hat eine feste Art:
 * Der Test hält fest, ob es sie vorher gab, und stellt den Stand danach wieder
 * her. Resend ist gemockt — die Mail ist eine Prüfstelle.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { MESS_BEGINN_ART, NEU_MESSEN_AB_MS, VERCEL_WARN_ART } from '@/lib/betrieb'

const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void> | void> }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void> | void) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendBetriebWarnung: vi.fn(async () => ({ gesendet: 1, gescheitert: 0 })) }))
vi.mock('@vercel/blob', () => ({ list: vi.fn() }))

import { sendBetriebWarnung } from '@/lib/email'
import { beginneMessung, verbucheVercelAusgaben } from '@/server/betrieb'

/** Weit nach allen echten Zeilen: Der Merker prüft „in den letzten 10 Minuten“ über alle Tage. */
const BEGINN = new Date('2040-06-01T10:00:00.000Z')
const BEGINN_TAG_VON = new Date('2040-01-01T00:00:00.000Z')
const BEGINN_TAG_BIS = new Date('2041-01-01T00:00:00.000Z')
/** Ein Tag nach dem 19. (Beginn des Abrechnungszeitraums), im Jahr 2001. */
const WEBHOOK = new Date('2001-03-20T10:00:00.000Z')
const TEST_JAHR_BIS = new Date('2002-01-01T00:00:00.000Z')

let warnungVorher: { art: string; stufe: number; seit: Date; gemeldetAm: Date } | null = null

async function arbeiteNachlaufAb(): Promise<void> {
  for (const aufgabe of nachlauf.aufgaben.splice(0)) await aufgabe()
}

const merkerZeilen = (): Promise<number> =>
  prisma.betriebMessung.count({ where: { art: MESS_BEGINN_ART, tag: { gte: BEGINN_TAG_VON, lt: BEGINN_TAG_BIS } } })

async function raeumeAuf(): Promise<void> {
  await prisma.betriebMessung.deleteMany({ where: { art: MESS_BEGINN_ART, tag: { gte: BEGINN_TAG_VON, lt: BEGINN_TAG_BIS } } })
  await prisma.betriebMessung.deleteMany({ where: { tag: { lt: TEST_JAHR_BIS } } })
  await prisma.betriebWarnung.deleteMany({ where: { art: VERCEL_WARN_ART } })
}

beforeAll(async () => {
  warnungVorher = await prisma.betriebWarnung.findUnique({ where: { art: VERCEL_WARN_ART } })
  await raeumeAuf()
})

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
})

afterEach(raeumeAuf)

afterAll(async () => {
  if (warnungVorher) await prisma.betriebWarnung.create({ data: warnungVorher })
})

describe('beginneMessung — der Merker „eine Messung hat begonnen“', () => {
  it.each([2, 8])('%i gleichzeitige Aufrufe: genau einer beginnt, der Merker steht einmal da', async (anzahl) => {
    const antworten = await Promise.all(Array.from({ length: anzahl }, () => beginneMessung(BEGINN)))

    expect(antworten.filter(Boolean)).toHaveLength(1)
    expect(await merkerZeilen()).toBe(1)
  })

  it('innerhalb von 10 Minuten beginnt keine zweite Messung, nach genau 10 Minuten wieder eine', async () => {
    expect(await beginneMessung(BEGINN)).toBe(true)
    expect(await beginneMessung(new Date(BEGINN.getTime() + 5 * 60_000))).toBe(false)
    // Eine Millisekunde vor Ablauf gilt die Messung noch als jung, genau nach 10 Minuten darf die nächste beginnen.
    expect(await beginneMessung(new Date(BEGINN.getTime() + NEU_MESSEN_AB_MS - 1))).toBe(false)
    expect(await beginneMessung(new Date(BEGINN.getTime() + NEU_MESSEN_AB_MS))).toBe(true)
    expect(await merkerZeilen()).toBe(1)
  })
})

describe('verbucheVercelAusgaben — eine Stufe, eine Mail', () => {
  const stufe50 = { ausgabenCent: 2510, limitCent: 5000, schwelleProzent: 50 }

  it('zwei gleichzeitige Meldungen derselben Stufe: genau eine Mail, nach der Antwort; Stufe 1; je Wert eine Zeile', async () => {
    const mails = await Promise.all([
      verbucheVercelAusgaben(stufe50, WEBHOOK, { produktion: true }),
      verbucheVercelAusgaben(stufe50, WEBHOOK, { produktion: true }),
    ])

    expect([...mails].sort()).toEqual([0, 1])
    // Niemand wartet auf den Versand: Die Mail liegt im Nachlauf.
    expect(sendBetriebWarnung).not.toHaveBeenCalled()
    await arbeiteNachlaufAb()
    expect(sendBetriebWarnung).toHaveBeenCalledTimes(1)
    expect((await prisma.betriebWarnung.findUnique({ where: { art: VERCEL_WARN_ART } }))?.stufe).toBe(1)
    const zeilen = await prisma.betriebMessung.findMany({ where: { tag: { lt: TEST_JAHR_BIS } }, orderBy: { art: 'asc' } })
    expect(zeilen.map((z) => [z.art, Number(z.wert)])).toEqual([
      ['vercelAusgaben', 2510],
      ['vercelLimit', 5000],
    ])
  })

  it('dieselbe Stufe noch einmal: keine Mail; die nächste Stufe (75 %): eine', async () => {
    expect(await verbucheVercelAusgaben(stufe50, WEBHOOK, { produktion: true })).toBe(1)
    await arbeiteNachlaufAb()
    vi.mocked(sendBetriebWarnung).mockClear()

    expect(await verbucheVercelAusgaben({ ...stufe50, ausgabenCent: 2600 }, WEBHOOK, { produktion: true })).toBe(0)
    await arbeiteNachlaufAb()
    expect(sendBetriebWarnung).not.toHaveBeenCalled()

    expect(await verbucheVercelAusgaben({ ausgabenCent: 3800, limitCent: 5000, schwelleProzent: 75 }, WEBHOOK, { produktion: true })).toBe(1)
    await arbeiteNachlaufAb()
    expect(sendBetriebWarnung).toHaveBeenCalledTimes(1)
    expect((await prisma.betriebWarnung.findUnique({ where: { art: VERCEL_WARN_ART } }))?.stufe).toBe(2)
  })
})

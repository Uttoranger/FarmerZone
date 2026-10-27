/**
 * Der Geld-Abgleich mit Stripe (Register N37, Nr. 191). Stripe ist eine
 * Attrappe — kein Live-Aufruf, und gelesen wird nur (list/retrieve).
 * Beweist:
 *  - Vergleich in ganzen Cent: gleich, Betrag anders, Gebühr anders,
 *    Erstattung fehlt, Bestellung ohne Zahlung bei Stripe — und die Wege, auf
 *    denen die Datenbank eine Zahlung anders schreibt (Artikel fehlt,
 *    Vollstorno, Reststorno, Gebühr entfallen, unbezahlt) ohne Fehlalarm.
 *  - Stripe-Gebühren je UTC-Tag aus den Buchungen im Saldo.
 *  - Der Lauf: liest erst alles, schreibt dann; neue Abweichung mit dem Tag
 *    des Funds, geklärte gelöscht, bestehende behalten ihren Tag; offene
 *    werden einzeln nachgeladen.
 *  - Stripe-Fehler → Warnung an Sentry (ohne Betrag, ohne Kennung), nichts
 *    geschrieben, Fehler an den Herzschlag; die Route antwortet 502.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const stripeAttrappe = vi.hoisted(() => ({
  paymentIntents: { list: vi.fn(), retrieve: vi.fn() },
  refunds: { list: vi.fn() },
  balanceTransactions: { list: vi.fn() },
}))
vi.mock('@/lib/stripe', () => ({ stripe: stripeAttrappe }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    betriebMessung: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
    order: { findMany: vi.fn() },
  },
}))
vi.mock('@/server/betrieb', () => ({ mitHerzschlag: vi.fn(async (_name: string, lauf: () => Promise<unknown>) => lauf()) }))

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { mitHerzschlag } from '@/server/betrieb'
import { GeldAbgleichStripeFehler, LISTE_HOECHSTENS, gleicheGeldAb } from '@/server/geld-abgleich'
import { GET } from '@/app/api/cron/geld-abgleich/route'
import {
  abweichungArt,
  erwartetLautDatenbank,
  gleicheAb,
  leseAbweichungArt,
  stripeGebuehrenJeTag,
  vergleicheBestellung,
  type BestellungFuerAbgleich,
  type StripeZahlung,
} from '@/lib/geld-abgleich'

// ─── Beispiele (erfunden) ────────────────────────────────────────────────────

/** Ware 24,50 €, Servicegebühr 1,23 € → bezahlt 25,73 €, application_fee 1,23 €. */
const BESTELLUNG: BestellungFuerAbgleich = {
  id: 'bestellung-1',
  orderNumber: 'HM-2610-A1B2',
  paymentIntentId: 'pi_1',
  paymentStatus: 'PAID',
  warenCents: 2450,
  warenOriginalCents: 2450,
  serviceFeeCents: 123,
  provisionCents: 0,
  erstattetCents: 0,
  gebuehrEntfallen: false,
  gebuehrModell: null,
  gebuehrPositionenCents: 0,
}
const ZAHLUNG: StripeZahlung = { paymentIntentId: 'pi_1', betragCents: 2573, gebuehrCents: 123, erstattetCents: 0 }

describe('Vergleich in Cent', () => {
  it('gleich: keine Abweichung', () => {
    expect(vergleicheBestellung(BESTELLUNG, ZAHLUNG)).toEqual([])
  })

  it('Betrag anders: Datenbank und Stripe in Cent', () => {
    expect(vergleicheBestellung(BESTELLUNG, { ...ZAHLUNG, betragCents: 2453 })).toEqual([
      { orderId: 'bestellung-1', orderNumber: 'HM-2610-A1B2', feld: 'betrag', datenbankCents: 2573, stripeCents: 2453 },
    ])
  })

  it('Gebühr anders', () => {
    expect(vergleicheBestellung(BESTELLUNG, { ...ZAHLUNG, gebuehrCents: 100 })).toEqual([
      expect.objectContaining({ feld: 'gebuehr', datenbankCents: 123, stripeCents: 100 }),
    ])
  })

  it('Erstattung fehlt in der Datenbank (Stripe erstattete 5,00 €)', () => {
    expect(vergleicheBestellung(BESTELLUNG, { ...ZAHLUNG, erstattetCents: 500 })).toEqual([
      expect.objectContaining({ feld: 'erstattung', datenbankCents: 0, stripeCents: 500 }),
    ])
  })

  it('Bestellung ohne Zahlung bei Stripe: „zahlung“ mit dem Betrag der Datenbank; unbezahlt dagegen nichts', () => {
    expect(vergleicheBestellung(BESTELLUNG, null)).toEqual([expect.objectContaining({ feld: 'zahlung', datenbankCents: 2573, stripeCents: 0 })])
    expect(vergleicheBestellung({ ...BESTELLUNG, paymentStatus: 'PENDING' }, null)).toEqual([])
  })

  it('unbezahlt: Stripe 0 € ist gleich; die Gebühr des PaymentIntents zählt nicht — bezahlt bei Stripe aber nicht in der Datenbank ist eine Abweichung', () => {
    const offen = { ...BESTELLUNG, paymentStatus: 'PENDING' }
    expect(vergleicheBestellung(offen, { ...ZAHLUNG, betragCents: 0 })).toEqual([])
    expect(vergleicheBestellung(offen, ZAHLUNG)).toEqual([expect.objectContaining({ feld: 'betrag', datenbankCents: 0, stripeCents: 2573 })])
  })

  it('Artikel fehlt (E14): Ware und Gebühr gesenkt, erstattet gestiegen — bezahlt und die ursprüngliche Gebühr stimmen, kein Fehlalarm', () => {
    // Position 4,00 € fehlt; neue Gebühr 1,03 € → Kundin bekommt 4,20 € zurück.
    const nachher = { ...BESTELLUNG, warenCents: 2050, serviceFeeCents: 103, erstattetCents: 420 }
    expect(erwartetLautDatenbank(nachher)).toEqual({ bezahlt: true, betragCents: 2573, gebuehrCents: 123, erstattetCents: 420 })
    expect(vergleicheBestellung(nachher, { ...ZAHLUNG, erstattetCents: 420 })).toEqual([])
  })

  it('Vollstorno (REFUNDED, erstattetCents 0): erwartet ist alles erstattet', () => {
    const storno = { ...BESTELLUNG, paymentStatus: 'REFUNDED' }
    expect(vergleicheBestellung(storno, { ...ZAHLUNG, erstattetCents: 2573 })).toEqual([])
    expect(vergleicheBestellung(storno, ZAHLUNG)).toEqual([expect.objectContaining({ feld: 'erstattung', datenbankCents: 2573, stripeCents: 0 })])
  })

  it('Reststorno nach Artikel fehlt: erstattetCents ist alles, also der bezahlte Betrag', () => {
    const rest = { ...BESTELLUNG, paymentStatus: 'REFUNDED', warenCents: 2050, serviceFeeCents: 103, erstattetCents: 2573 }
    expect(vergleicheBestellung(rest, { ...ZAHLUNG, erstattetCents: 2573 })).toEqual([])
  })

  it('Gebühr entfallen nach „nicht abgeholt“: die Servicegebühr ging als eigene Erstattung zurück', () => {
    const entfallen = { ...BESTELLUNG, gebuehrEntfallen: true }
    expect(vergleicheBestellung(entfallen, { ...ZAHLUNG, erstattetCents: 123 })).toEqual([])
  })

  it('alle Werte sind ganze Cent — nie ein Bruchteil', () => {
    for (const b of [BESTELLUNG, { ...BESTELLUNG, warenCents: 2050, serviceFeeCents: 103, erstattetCents: 420 }]) {
      for (const wert of Object.values(erwartetLautDatenbank(b))) if (typeof wert === 'number') expect(Number.isInteger(wert)).toBe(true)
    }
  })

  it('gleicheAb: nicht gelesene Zahlungen bleiben außen vor, „nicht bei Stripe“ wird verglichen', () => {
    const zweite = { ...BESTELLUNG, id: 'bestellung-2', orderNumber: 'HM-2610-C3D4', paymentIntentId: 'pi_2' }
    const dritte = { ...BESTELLUNG, id: 'bestellung-3', orderNumber: 'HM-2610-E5F6', paymentIntentId: 'pi_3' }
    const { verglichen, abweichungen } = gleicheAb([BESTELLUNG, zweite, dritte], new Map([['pi_1', ZAHLUNG]]), new Set(['pi_2']))
    expect(verglichen).toEqual(['bestellung-1', 'bestellung-2'])
    expect(abweichungen.map((a) => [a.orderId, a.feld])).toEqual([['bestellung-2', 'zahlung']])
  })
})

describe('Modell hofpreis (N38, Nr. 198): eigene Zeile für Betrag und Gebühr', () => {
  // Erfunden: 2 × 4,00 € (Gebühr je Stück 0,24 €) und 1 × 4,00 € → Ware 12,00 €, Gebühr 0,72 €, Kundin zahlt 12,72 €.
  // Stripe: amount 1272, application_fee 72 (Summe gebuehrCents), der Hof bekommt 1200 (100 % der Ware).
  const HOFPREIS: BestellungFuerAbgleich = {
    ...BESTELLUNG,
    id: 'bestellung-h',
    orderNumber: 'HM-2610-H1P1',
    paymentIntentId: 'pi_h',
    warenCents: 1200,
    warenOriginalCents: 1200,
    serviceFeeCents: 72,
    gebuehrModell: 'hofpreis',
    gebuehrPositionenCents: 72,
  }
  const ZAHLUNG_H: StripeZahlung = { paymentIntentId: 'pi_h', betragCents: 1272, gebuehrCents: 72, erstattetCents: 0 }

  it('gleich bei Stripe: keine Abweichung; erwartet Ware + Summe gebuehrCents und application_fee = Summe gebuehrCents', () => {
    expect(erwartetLautDatenbank(HOFPREIS)).toEqual({ bezahlt: true, betragCents: 1272, gebuehrCents: 72, erstattetCents: 0 })
    expect(vergleicheBestellung(HOFPREIS, ZAHLUNG_H)).toEqual([])
  })

  it('Gegenprobe: eine andere Gebühr bei Stripe (etwa Prozent auf die Summe, 0,48 €) ist eine Abweichung', () => {
    expect(vergleicheBestellung(HOFPREIS, { ...ZAHLUNG_H, gebuehrCents: 48 })).toEqual([
      expect.objectContaining({ feld: 'gebuehr', datenbankCents: 72, stripeCents: 48 }),
    ])
    expect(vergleicheBestellung(HOFPREIS, { ...ZAHLUNG_H, betragCents: 1200 })).toEqual([
      expect.objectContaining({ feld: 'betrag', datenbankCents: 1272, stripeCents: 1200 }),
    ])
  })

  it('Teilstorno „Artikel fehlt“: Position 4,00 € + 0,24 € fehlt → Ware 8,00, Gebühr 0,48, erstattet 4,24 — keine Abweichung', () => {
    const nachher = { ...HOFPREIS, warenCents: 800, serviceFeeCents: 48, erstattetCents: 424 }
    expect(erwartetLautDatenbank(nachher)).toEqual({ bezahlt: true, betragCents: 1272, gebuehrCents: 72, erstattetCents: 424 })
    expect(vergleicheBestellung(nachher, { ...ZAHLUNG_H, erstattetCents: 424 })).toEqual([])
    // Gegenprobe: Stripe hat nichts erstattet → Abweichung „erstattung“.
    expect(vergleicheBestellung(nachher, ZAHLUNG_H)).toEqual([expect.objectContaining({ feld: 'erstattung', datenbankCents: 424, stripeCents: 0 })])
  })

  it('mit Provision (im Pilot 0): application_fee = Provision + Summe gebuehrCents, wie intentParameter', () => {
    expect(erwartetLautDatenbank({ ...HOFPREIS, provisionCents: 30 }).gebuehrCents).toBe(102)
  })
})

describe('Art der Zeile und Stripe-Gebühren', () => {
  it('Art hin und zurück; fremde Zeilen sind null', () => {
    expect(leseAbweichungArt(abweichungArt('bestellung-1', 'gebuehr'))).toEqual({ orderId: 'bestellung-1', feld: 'gebuehr' })
    for (const fremd of ['geldAbweichung:x', 'geldAbweichung:x:unsinn', 'mails', 'geldAbweichung:a b:betrag', 'anders:x:betrag']) expect(leseAbweichungArt(fremd), fremd).toBeNull()
  })

  it('Gebühren je UTC-Tag: fee jeder Buchung, dazu Stripe-Gebühren als eigene Buchung; Tage ohne Gebühr fehlen', () => {
    const tag = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)
    const jeTag = stripeGebuehrenJeTag([
      { created: tag('2026-10-25T08:00:00Z'), fee: 52, type: 'charge', amount: 2573 },
      { created: tag('2026-10-25T23:59:59Z'), fee: 48, type: 'charge', amount: 2000 },
      { created: tag('2026-10-26T00:00:00Z'), fee: 0, type: 'stripe_fee', amount: -200 },
      { created: tag('2026-10-26T10:00:00Z'), fee: 0, type: 'transfer', amount: -2450 },
      { created: tag('2026-10-27T10:00:00Z'), fee: 0, type: 'payout', amount: -9000 },
    ])
    expect([...jeTag]).toEqual([
      ['2026-10-25', 100],
      ['2026-10-26', 200],
    ])
  })
})

// ─── Der Lauf ────────────────────────────────────────────────────────────────

const JETZT = new Date('2026-10-27T06:30:00Z')
const db = vi.mocked(prisma, true)

function liste<T>(eintraege: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      yield* eintraege
    },
  }
}
function kaputt(): AsyncIterable<never> {
  return {
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        throw Object.assign(new Error('Netz weg'), { name: 'StripeConnectionError' })
      },
    }),
  }
}

const pi = (id: string, betrag: number, gebuehr: number, erstattet = 0) => ({ id, amount_received: betrag, application_fee_amount: gebuehr, latest_charge: { amount_refunded: erstattet } })
const zeile = (id: string, piId: string, ueber: Record<string, unknown> = {}) => ({
  id,
  orderNumber: `HM-2610-${id.slice(-4).toUpperCase()}`,
  stripePaymentIntentId: piId,
  paymentStatus: 'PAID',
  totalAmount: '24.50',
  serviceFeeCents: 123,
  platformFeeAmount: '0',
  erstattetCents: 0,
  serviceFeeRefundedAt: null,
  items: [{ totalPrice: '24.50', gebuehrCents: 0 }],
  gebuehrModell: null,
  ...ueber,
})

beforeEach(() => {
  vi.clearAllMocks()
  stripeAttrappe.paymentIntents.list.mockReturnValue(liste([pi('pi_1', 2573, 123), pi('pi_2', 2573, 100)]))
  stripeAttrappe.refunds.list.mockReturnValue(liste([]))
  stripeAttrappe.balanceTransactions.list.mockReturnValue(liste([{ created: Math.floor(Date.parse('2026-10-26T09:00:00Z') / 1000), fee: 52, type: 'charge', amount: 2573 }]))
  db.betriebMessung.findMany.mockResolvedValue([])
  db.order.findMany.mockResolvedValue([zeile('bestellung-aaaa', 'pi_1'), zeile('bestellung-bbbb', 'pi_2')] as never)
})

describe('gleicheGeldAb', () => {
  it('liest nur (list/retrieve), 48 Stunden zurück, mit expand; schreibt die neue Abweichung mit dem Tag des Funds und die Gebühren je Tag', async () => {
    const ergebnis = await gleicheGeldAb(JETZT)
    expect(ergebnis).toMatchObject({ verglichen: 2, abweichungen: 1, neu: 1, geklaert: 0, stripeGebuehrTage: 1 })
    const ab = Math.floor((JETZT.getTime() - 48 * 3_600_000) / 1000)
    expect(stripeAttrappe.paymentIntents.list).toHaveBeenCalledWith({ created: { gte: ab }, limit: 100, expand: ['data.latest_charge'] })
    expect(stripeAttrappe.refunds.list).toHaveBeenCalledWith({ created: { gte: ab }, limit: 100, expand: ['data.payment_intent.latest_charge'] })
    expect(stripeAttrappe.balanceTransactions.list).toHaveBeenCalledWith({ created: { gte: Math.floor(Date.parse('2026-10-25T00:00:00Z') / 1000) }, limit: 100 })
    expect(db.betriebMessung.createMany).toHaveBeenCalledWith({
      data: [{ tag: new Date('2026-10-27T00:00:00Z'), art: 'geldAbweichung:bestellung-bbbb:gebuehr', wert: BigInt(23) }],
      skipDuplicates: true,
    })
    expect(db.betriebMessung.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tag_art: { tag: new Date('2026-10-26T00:00:00Z'), art: 'stripeGebuehrCents' } }, create: expect.objectContaining({ wert: BigInt(52) }) })
    )
    expect(db.betriebMessung.deleteMany).not.toHaveBeenCalled()
  })

  it('abgeschnittene Saldo-Liste: keine Tagesgebühr geschrieben (sie wäre zu klein), Warnung an Sentry; genau voll ist nicht abgeschnitten', async () => {
    const buchung = { created: Math.floor(Date.parse('2026-10-26T09:00:00Z') / 1000), fee: 1, type: 'charge', amount: 100 }
    stripeAttrappe.balanceTransactions.list.mockReturnValue(liste(Array.from({ length: LISTE_HOECHSTENS + 1 }, () => buchung)))
    expect(await gleicheGeldAb(JETZT)).toMatchObject({ stripeGebuehrTage: 0 })
    expect(db.betriebMessung.upsert).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('abgeschnitten'), expect.objectContaining({ level: 'warning' }))

    // Gegenprobe: genau LISTE_HOECHSTENS Buchungen sind vollständig gelesen und werden geschrieben.
    vi.clearAllMocks()
    stripeAttrappe.paymentIntents.list.mockReturnValue(liste([]))
    stripeAttrappe.refunds.list.mockReturnValue(liste([]))
    db.betriebMessung.findMany.mockResolvedValue([])
    db.order.findMany.mockResolvedValue([] as never)
    stripeAttrappe.balanceTransactions.list.mockReturnValue(liste(Array.from({ length: LISTE_HOECHSTENS }, () => buchung)))
    expect(await gleicheGeldAb(JETZT)).toMatchObject({ stripeGebuehrTage: 1 })
    expect(db.betriebMessung.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ wert: BigInt(LISTE_HOECHSTENS) }) }))
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('eine offene Abweichung, die jetzt stimmt, wird gelöscht; eine weiter offene behält ihren ersten Tag', async () => {
    db.betriebMessung.findMany.mockResolvedValue([
      { tag: new Date('2026-10-20T00:00:00Z'), art: 'geldAbweichung:bestellung-aaaa:betrag', wert: BigInt(5) },
      { tag: new Date('2026-10-21T00:00:00Z'), art: 'geldAbweichung:bestellung-bbbb:gebuehr', wert: BigInt(23) },
    ] as never)
    const ergebnis = await gleicheGeldAb(JETZT)
    expect(ergebnis).toMatchObject({ neu: 0, geklaert: 1 })
    expect(db.betriebMessung.deleteMany).toHaveBeenCalledWith({ where: { art: { in: ['geldAbweichung:bestellung-aaaa:betrag'] } } })
    expect(db.betriebMessung.createMany).not.toHaveBeenCalled()
    expect(db.betriebMessung.updateMany).toHaveBeenCalledWith({
      where: { tag: new Date('2026-10-21T00:00:00Z'), art: 'geldAbweichung:bestellung-bbbb:gebuehr' },
      data: { wert: BigInt(23), gemessenAm: JETZT },
    })
  })

  it('eine Zahlung, die die Listen nicht brachten, wird einzeln nachgeladen; kennt Stripe sie nicht, ist das „zahlung“', async () => {
    stripeAttrappe.paymentIntents.list.mockReturnValue(liste([pi('pi_1', 2573, 123)]))
    db.order.findMany.mockResolvedValue([zeile('bestellung-aaaa', 'pi_1'), zeile('bestellung-cccc', 'pi_alt')] as never)
    stripeAttrappe.paymentIntents.retrieve.mockRejectedValue(Object.assign(new Error('No such payment_intent'), { code: 'resource_missing', statusCode: 404 }))
    await gleicheGeldAb(JETZT)
    expect(stripeAttrappe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_alt', { expand: ['latest_charge'] })
    expect(db.betriebMessung.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ art: 'geldAbweichung:bestellung-cccc:zahlung', wert: BigInt(2573) })], skipDuplicates: true })
  })

  it('Stripe-Fehler: Warnung an Sentry ohne Betrag und Kennung, nichts geschrieben, Fehler für den Herzschlag', async () => {
    stripeAttrappe.refunds.list.mockReturnValue(kaputt())
    await expect(gleicheGeldAb(JETZT)).rejects.toBeInstanceOf(GeldAbgleichStripeFehler)
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ name: 'StripeConnectionError' }), {
      level: 'warning',
      tags: { aufgabe: 'geld-abgleich', schritt: 'liste' },
    })
    for (const schreiben of [db.betriebMessung.createMany, db.betriebMessung.deleteMany, db.betriebMessung.updateMany, db.betriebMessung.upsert]) expect(schreiben).not.toHaveBeenCalled()
    expect(db.order.findMany).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ein anderer Fehler beim Nachladen als „nicht gefunden“ bricht ebenso ohne Schreiben ab', async () => {
    stripeAttrappe.paymentIntents.list.mockReturnValue(liste([]))
    stripeAttrappe.paymentIntents.retrieve.mockRejectedValue(Object.assign(new Error('rate'), { name: 'StripeRateLimitError', statusCode: 429 }))
    await expect(gleicheGeldAb(JETZT)).rejects.toBeInstanceOf(GeldAbgleichStripeFehler)
    expect(db.betriebMessung.createMany).not.toHaveBeenCalled()
    expect(db.betriebMessung.deleteMany).not.toHaveBeenCalled()
  })
})

describe('/api/cron/geld-abgleich', () => {
  const anfrage = (authorization?: string) => new NextRequest('http://localhost/api/cron/geld-abgleich', { headers: authorization ? { authorization } : {} })

  beforeEach(() => vi.stubEnv('CRON_SECRET', 'geheim-fuer-tests'))

  it('ohne CRON_SECRET-Bearer 401 und kein Stripe-Aufruf', async () => {
    expect((await GET(anfrage())).status).toBe(401)
    expect((await GET(anfrage('Bearer falsch'))).status).toBe(401)
    expect(stripeAttrappe.paymentIntents.list).not.toHaveBeenCalled()
  })

  it('läuft im Herzschlag „geld-abgleich“ und antwortet mit Zahlen, nie mit Kennungen', async () => {
    const antwort = await GET(anfrage('Bearer geheim-fuer-tests'))
    expect(antwort.status).toBe(200)
    expect(vi.mocked(mitHerzschlag).mock.calls[0]?.[0]).toBe('geld-abgleich')
    const text = await antwort.text()
    expect(JSON.parse(text)).toMatchObject({ verglichen: 2, abweichungen: 1 })
    expect(text).not.toContain('bestellung-')
  })

  it('Stripe-Fehler: 502 ohne Einzelheiten', async () => {
    stripeAttrappe.paymentIntents.list.mockReturnValue(kaputt())
    const antwort = await GET(anfrage('Bearer geheim-fuer-tests'))
    expect(antwort.status).toBe(502)
    expect(await antwort.json()).toEqual({ error: 'Stripe nicht gelesen' })
  })
})

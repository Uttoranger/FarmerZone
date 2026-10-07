/**
 * Erstattungen mit festen Beträgen (src/server/teilerstattung.ts) — Zeitgrenze,
 * „nie zweimal" und „im Zweifel nicht buchen" am echten Code, Stripe gemockt.
 *
 * Die Fehler (Nachbesserung Nr. 19): Ohne Request-Optionen wiederholte das
 * Stripe-SDK jeden Aufruf zweimal mit langer Zeitgrenze — die Transaktion lief
 * ab, während Stripe noch buchte. Listen wurden nur zur ersten Seite gelesen,
 * Erstattungen ohne eigene Merkmale übersehen und eine gescheiterte Erstattung
 * hätte als erstattet gezählt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: { retrieve: vi.fn() },
    refunds: { create: vi.fn(), list: vi.fn() },
    transfers: { createReversal: vi.fn(), listReversals: vi.fn() },
  },
}))

import { stripe } from '@/lib/stripe'
import {
  STRIPE_AUFRUFE_HOECHSTENS,
  STRIPE_OPTIONEN,
  StripeStandUnklar,
  bucheVomHofZurueck,
  erstatteKundin,
  hatErstattungen,
  ladeStripeStand,
  ordneZu,
  vollstornoMerkmal,
} from '@/server/teilerstattung'
import { TRANSAKTION_MS, VERBINDUNG_WARTEN_MS } from '@/server/artikel-fehlt'
import { restNachTeilerstattung, zuruecknahmeNachGescheiterterErstattung, zuruecknahmeNachGescheiterterVollerstattung } from '@/lib/storno'

const ERSTATTUNG = { paymentIntentId: 'pi_1', orderId: 'order_1', anlass: 'reststorno' as const, positionId: null, betragCents: 500, schluessel: 'storno-order_1' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({ latest_charge: { transfer: 'tr_1' } } as never)
  vi.mocked(stripe.refunds.list).mockResolvedValue({ data: [], has_more: false } as never)
  vi.mocked(stripe.transfers.listReversals).mockResolvedValue({ data: [], has_more: false } as never)
  vi.mocked(stripe.refunds.create).mockResolvedValue({ amount: 500, status: 'succeeded' } as never)
  vi.mocked(stripe.transfers.createReversal).mockResolvedValue({ amount: 450 } as never)
})

describe('Zeitgrenze in der Sperre', () => {
  it('Stripe-Aufrufe ohne SDK-Wiederholung, Summe der Zeitgrenzen sicher unter der Transaktion', () => {
    expect(STRIPE_OPTIONEN.maxNetworkRetries).toBe(0)
    expect(STRIPE_AUFRUFE_HOECHSTENS * STRIPE_OPTIONEN.timeout).toBeLessThanOrEqual(TRANSAKTION_MS - 10_000)
  })

  it('die Bestellseiten (wo die Aktionen laufen) lassen der Funktion mehr Zeit als Warten + Transaktion', () => {
    for (const datei of ['src/app/(hof)/orders/page.tsx', 'src/app/(hof)/orders/[orderId]/page.tsx']) {
      const treffer = /export const maxDuration = (\d+)/.exec(readFileSync(join(process.cwd(), datei), 'utf8'))
      expect(treffer, datei).not.toBeNull()
      expect(Number(treffer![1]) * 1000, datei).toBeGreaterThan(VERBINDUNG_WARTEN_MS + TRANSAKTION_MS)
    }
  })

  it('jeder Aufruf trägt die Optionen, Buchungen dazu ihren Schlüssel und ihre Merkmale', async () => {
    const stand = await ladeStripeStand('pi_1', 'order_1')
    await erstatteKundin(stand, ERSTATTUNG)
    await bucheVomHofZurueck(stand, { orderId: 'order_1', anlass: 'reststorno', positionId: null, betragCents: 450, schluessel: 'storno-hof-order_1', onFehler: vi.fn() })

    expect(vi.mocked(stripe.paymentIntents.retrieve).mock.calls[0]![2]).toEqual(STRIPE_OPTIONEN)
    expect(vi.mocked(stripe.refunds.list).mock.calls[0]![1]).toEqual(STRIPE_OPTIONEN)
    expect(vi.mocked(stripe.transfers.listReversals).mock.calls[0]![2]).toEqual(STRIPE_OPTIONEN)
    const [werte, optionen] = vi.mocked(stripe.refunds.create).mock.calls[0]!
    expect(optionen).toEqual({ ...STRIPE_OPTIONEN, idempotencyKey: 'storno-order_1' })
    expect(werte).toMatchObject({ amount: 500, metadata: { orderId: 'order_1', anlass: 'reststorno', art: 'kunde' } })
    expect(werte).not.toHaveProperty('reverse_transfer')
    expect(vi.mocked(stripe.transfers.createReversal).mock.calls[0]![2]).toEqual({ ...STRIPE_OPTIONEN, idempotencyKey: 'storno-hof-order_1' })
  })
})

describe('nie zweimal', () => {
  it('eine schon gebuchte Erstattung und Rückbuchung (früherer Versuch) werden übernommen, nicht neu gebucht', async () => {
    vi.mocked(stripe.refunds.list).mockResolvedValue({
      has_more: false,
      data: [
        { amount: 480, status: 'succeeded', metadata: { orderId: 'order_1', anlass: 'reststorno', art: 'kunde' } },
        // Eine gescheiterte Erstattung hat kein Geld bewegt — sie zählt nicht und stört nicht.
        { amount: 999, status: 'failed', metadata: {} },
      ],
    } as never)
    vi.mocked(stripe.transfers.listReversals).mockResolvedValue({
      has_more: false,
      data: [{ amount: 450, metadata: { orderId: 'order_1', anlass: 'reststorno', art: 'hof' } }],
    } as never)

    const stand = await ladeStripeStand('pi_1', 'order_1')
    expect(await erstatteKundin(stand, ERSTATTUNG)).toEqual({ erstattetCents: 480, nachgetragen: true })
    expect(await bucheVomHofZurueck(stand, { orderId: 'order_1', anlass: 'reststorno', positionId: null, betragCents: 450, schluessel: 'x', onFehler: vi.fn() })).toBe(false)
    expect(stripe.refunds.create).not.toHaveBeenCalled()
    expect(stripe.transfers.createReversal).not.toHaveBeenCalled()
  })

  it('eine gescheiterte Erstattung aus refunds.create (auch über denselben Schlüssel) zählt nie als erstattet', async () => {
    vi.mocked(stripe.refunds.create).mockResolvedValue({ amount: 500, status: 'failed' } as never)
    const stand = await ladeStripeStand('pi_1', 'order_1')

    await expect(erstatteKundin(stand, ERSTATTUNG)).rejects.toMatchObject({ grund: 'erstattung_gescheitert' })
    expect(stand.erstattungen).toEqual([])
  })

  it('„pending" zählt — das Geld ist unterwegs, eine zweite Erstattung wäre doppelt', async () => {
    vi.mocked(stripe.refunds.create).mockResolvedValue({ amount: 500, status: 'pending' } as never)
    const stand = await ladeStripeStand('pi_1', 'order_1')
    expect(await erstatteKundin(stand, ERSTATTUNG)).toEqual({ erstattetCents: 500, nachgetragen: false })
  })
})

describe('im Zweifel nicht buchen', () => {
  it('mehr als eine Seite Erstattungen oder Rückbuchungen: unklar', async () => {
    vi.mocked(stripe.refunds.list).mockResolvedValue({ data: [], has_more: true } as never)
    await expect(ladeStripeStand('pi_1', 'order_1')).rejects.toMatchObject({ grund: 'mehr_als_eine_seite' })

    vi.mocked(stripe.refunds.list).mockResolvedValue({ data: [], has_more: false } as never)
    vi.mocked(stripe.transfers.listReversals).mockResolvedValue({ data: [], has_more: true } as never)
    await expect(ladeStripeStand('pi_1', 'order_1')).rejects.toBeInstanceOf(StripeStandUnklar)
  })

  it('eine Erstattung ohne eigene Merkmale (von Hand im Dashboard): unklar', async () => {
    vi.mocked(stripe.refunds.list).mockResolvedValue({ has_more: false, data: [{ amount: 300, status: 'succeeded', metadata: {} }] } as never)
    await expect(ladeStripeStand('pi_1', 'order_1')).rejects.toMatchObject({ grund: 'ohne_zuordnung' })
  })

  it('eine Rückbuchung ohne eigene Merkmale: unklar', async () => {
    vi.mocked(stripe.transfers.listReversals).mockResolvedValue({ has_more: false, data: [{ amount: 300, metadata: {} }] } as never)
    await expect(ladeStripeStand('pi_1', 'order_1')).rejects.toMatchObject({ grund: 'ohne_zuordnung' })
  })

  it('Zuordnung: neues Format, Rest-Storno im alten Format; Teilstorno im alten Format (ohne Position) und Fremdes nicht', () => {
    expect(ordneZu('o1', { orderId: 'o1', anlass: 'teilstorno', positionId: 'p1' }, 5)).toEqual({ anlass: 'teilstorno', positionId: 'p1', betrag: 5 })
    expect(ordneZu('o1', { orderId: 'o1', grund: 'storno_nach_teilerstattung' }, 5)).toEqual({ anlass: 'reststorno', positionId: null, betrag: 5 })
    expect(ordneZu('o1', { orderId: 'o1', grund: 'artikel_fehlt' }, 5)).toBeNull()
    expect(ordneZu('o1', { orderId: 'o1', anlass: 'teilstorno' }, 5)).toBeNull()
    expect(ordneZu('o1', { orderId: 'o1', grund: 'servicegebuehr_nicht_abgeholt' }, 5)).toBeNull()
    expect(ordneZu('o1', { orderId: 'o2', anlass: 'reststorno' }, 5)).toBeNull()
    expect(ordneZu('o1', null, 5)).toBeNull()
  })

  it('hatErstattungen: nur Geld, das geflossen ist; mehr als eine Seite gilt als „ja"', async () => {
    vi.mocked(stripe.refunds.list).mockResolvedValue({ has_more: false, data: [{ status: 'failed' }] } as never)
    expect(await hatErstattungen('pi_1')).toBe(false)
    vi.mocked(stripe.refunds.list).mockResolvedValue({ has_more: false, data: [{ status: 'succeeded' }] } as never)
    expect(await hatErstattungen('pi_1')).toBe(true)
    vi.mocked(stripe.refunds.list).mockResolvedValue({ has_more: true, data: [] } as never)
    expect(await hatErstattungen('pi_1')).toBe(true)
  })
})

describe('restNachTeilerstattung — aus dem, was Stripe gebucht hat', () => {
  // Eier € 4,50 + Brot € 5,80, Gebühr € 0,52 → bezahlt € 10,82. Nach „Brot
  // fehlt" steht in der Datenbank Warenpreis 450 + Gebühr 50 + erstattet 582.
  const NACH_BROT = { bezahltStripeCents: 1082, bezahltDatenbankCents: 450 + 50 + 582, warenOriginalCents: 1030 }

  it('nach „Brot fehlt" (582 erstattet, 580 zurückgebucht): Kundin 500, Hof 450', () => {
    expect(restNachTeilerstattung({ ...NACH_BROT, provisionCents: 0, teilErstattetCents: 582, teilZurueckgebuchtCents: 580 })).toEqual({
      erstattungCents: 500,
      vomHofCents: 450,
    })
  })

  it('Rückbuchung damals gescheitert: der Rest holt sie nach (Hof gibt insgesamt genau den Warenpreis)', () => {
    expect(restNachTeilerstattung({ ...NACH_BROT, provisionCents: 0, teilErstattetCents: 582, teilZurueckgebuchtCents: 0 })).toEqual({
      erstattungCents: 500,
      vomHofCents: 1030,
    })
  })

  it('mit Provision (€ 1,00): der Hof gibt insgesamt Warenpreis − Provision zurück, die Kundin bekommt alles, was sie zahlte', () => {
    const rest = restNachTeilerstattung({ ...NACH_BROT, provisionCents: 100, teilErstattetCents: 582, teilZurueckgebuchtCents: 580 })

    expect(rest).toEqual({ erstattungCents: 500, vomHofCents: 350 })
    // Teilstorno + Rest = Vollstorno am Anfang: Kundin 1082, Hof 1030 − 100.
    expect(582 + rest!.erstattungCents).toBe(1082)
    expect(580 + rest!.vomHofCents).toBe(1030 - 100)
  })

  it('mit Provision, Rückbuchung damals gescheitert: der Hof gibt Warenpreis − Provision, nicht mehr', () => {
    expect(restNachTeilerstattung({ ...NACH_BROT, provisionCents: 100, teilErstattetCents: 582, teilZurueckgebuchtCents: 0 })).toEqual({
      erstattungCents: 500,
      vomHofCents: 930,
    })
  })

  it('bezahlt laut Stripe weicht von der Datenbank ab: kein Rest (nichts buchen)', () => {
    // Ein Nachtrag mit abweichendem Betrag oder eine zurückgenommene Erstattung:
    // Die Kundin bekäme still zu wenig oder zu viel.
    expect(restNachTeilerstattung({ ...NACH_BROT, bezahltDatenbankCents: 1080, provisionCents: 0, teilErstattetCents: 582, teilZurueckgebuchtCents: 580 })).toBeNull()
    expect(restNachTeilerstattung({ ...NACH_BROT, bezahltStripeCents: 1100, provisionCents: 0, teilErstattetCents: 582, teilZurueckgebuchtCents: 580 })).toBeNull()
  })

  it('Stripe nennt keinen bezahlten Betrag: kein Rest', () => {
    expect(restNachTeilerstattung({ ...NACH_BROT, bezahltStripeCents: null, provisionCents: 0, teilErstattetCents: 582, teilZurueckgebuchtCents: 580 })).toBeNull()
  })

  it('nie negativ', () => {
    expect(
      restNachTeilerstattung({ bezahltStripeCents: 500, bezahltDatenbankCents: 500, warenOriginalCents: 100, provisionCents: 0, teilErstattetCents: 600, teilZurueckgebuchtCents: 200 })
    ).toEqual({ erstattungCents: 0, vomHofCents: 0 })
  })
})

describe('ladeStripeStand — bezahlter Betrag', () => {
  it('kommt aus der Zahlung (latest_charge.amount), nie aus der Datenbank', async () => {
    vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({ latest_charge: { transfer: 'tr_1', amount: 1082 } } as never)
    expect((await ladeStripeStand('pi_1', 'order_1')).bezahltCents).toBe(1082)
  })

  it('Zahlung ohne Überweisung: unklar (nichts buchen, melden), kein einfacher Fehler', async () => {
    vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({ latest_charge: { transfer: null, amount: 1082 } } as never)
    await expect(ladeStripeStand('pi_1', 'order_1')).rejects.toMatchObject({ grund: 'ohne_ueberweisung' })
  })

  it('die als gescheitert gemeldete Erstattung zählt nie mit, auch wenn die Liste sie noch als pending führt', async () => {
    vi.mocked(stripe.refunds.list).mockResolvedValue({
      has_more: false,
      data: [
        { id: 're_a', amount: 582, status: 'pending', metadata: { orderId: 'order_1', anlass: 'teilstorno', positionId: 'p1' } },
        { id: 're_b', amount: 500, status: 'succeeded', metadata: { orderId: 'order_1', anlass: 'reststorno' } },
      ],
    } as never)
    expect((await ladeStripeStand('pi_1', 'order_1', { gescheitert: 're_a' })).erstattungen).toEqual([{ anlass: 'reststorno', positionId: null, betrag: 500 }])
    expect((await ladeStripeStand('pi_1', 'order_1')).erstattungen).toHaveLength(2)
  })

  it('ohne Betrag an der Zahlung: unbekannt (null), nicht 0', async () => {
    expect((await ladeStripeStand('pi_1', 'order_1')).bezahltCents).toBeNull()
  })
})

describe('zuruecknahmeNachGescheiterterErstattung — gescheiterte Erstattung genau einmal zurücknehmen', () => {
  it('die Datenbank zählt die gescheiterte noch mit: auf Stripes Summe zurück', () => {
    expect(zuruecknahmeNachGescheiterterErstattung({ erstattetCentsDatenbank: 1082, erstattetCentsStripe: 500, gescheitertCents: 582 })).toEqual({
      art: 'zuruecknehmen',
      erstattetCentsNeu: 500,
    })
  })

  it('schon zurückgenommen (zweite Zustellung, zweites Ereignis derselben Erstattung): nichts mehr', () => {
    expect(zuruecknahmeNachGescheiterterErstattung({ erstattetCentsDatenbank: 500, erstattetCentsStripe: 500, gescheitertCents: 582 })).toEqual({ art: 'schon_erledigt' })
  })

  it('passt weder das eine noch das andere: unklar, nichts ändern', () => {
    expect(zuruecknahmeNachGescheiterterErstattung({ erstattetCentsDatenbank: 900, erstattetCentsStripe: 500, gescheitertCents: 582 })).toEqual({ art: 'unklar' })
    expect(zuruecknahmeNachGescheiterterErstattung({ erstattetCentsDatenbank: 0, erstattetCentsStripe: 500, gescheitertCents: 582 })).toEqual({ art: 'unklar' })
  })

  it('ein Betrag von 0 oder weniger ist nie zurückzunehmen', () => {
    expect(zuruecknahmeNachGescheiterterErstattung({ erstattetCentsDatenbank: 500, erstattetCentsStripe: 500, gescheitertCents: 0 })).toEqual({ art: 'unklar' })
  })
})

describe('Vollerstattung mit Merkmalen (Nr. 27)', () => {
  it('trägt dasselbe Muster wie die Teilerstattung: Bestellung, Anlass vollstorno, Art kunde', () => {
    expect(vollstornoMerkmal('order_1')).toEqual({ orderId: 'order_1', anlass: 'vollstorno', art: 'kunde' })
  })

  it('zählt nie als Teil- oder Rest-Storno — ladeStripeStand sieht sie weiter als nicht zuzuordnen (im Zweifel nichts buchen)', () => {
    expect(ordneZu('order_1', vollstornoMerkmal('order_1'), 1082)).toBeNull()
  })
})

describe('zuruecknahmeNachGescheiterterVollerstattung — gescheiterte Vollerstattung genau einmal zurücknehmen', () => {
  const STORNIERT_ERSTATTET = {
    status: 'CANCELLED',
    paymentStatus: 'REFUNDED',
    erstattetCentsDatenbank: 0,
    bezahltDatenbankCents: 1082,
    gescheitertCents: 1082,
    andereZaehlendeErstattungen: false,
  }

  it('storniert und als erstattet vermerkt: Zahlung wieder offen', () => {
    expect(zuruecknahmeNachGescheiterterVollerstattung(STORNIERT_ERSTATTET)).toEqual({ art: 'zuruecknehmen' })
  })

  it('schon wieder offen (zweite Zustellung, zweites Ereignis): nichts mehr', () => {
    expect(zuruecknahmeNachGescheiterterVollerstattung({ ...STORNIERT_ERSTATTET, paymentStatus: 'PAID' })).toEqual({ art: 'schon_erledigt' })
  })

  it('Stripe kennt eine weitere zählende Erstattung (z. B. von Hand nachgeholt): unklar, nichts ändern', () => {
    expect(zuruecknahmeNachGescheiterterVollerstattung({ ...STORNIERT_ERSTATTET, andereZaehlendeErstattungen: true })).toEqual({ art: 'unklar' })
  })

  it('Betrag passt nicht zum bezahlten Betrag der Bestellung: unklar', () => {
    expect(zuruecknahmeNachGescheiterterVollerstattung({ ...STORNIERT_ERSTATTET, gescheitertCents: 1000 })).toEqual({ art: 'unklar' })
  })

  it('vorher schon teilweise erstattet (dann gäbe es keine Vollerstattung): unklar', () => {
    expect(zuruecknahmeNachGescheiterterVollerstattung({ ...STORNIERT_ERSTATTET, erstattetCentsDatenbank: 582 })).toEqual({ art: 'unklar' })
  })

  it('Bestellung nicht storniert oder Zahlstand fremd: unklar', () => {
    expect(zuruecknahmeNachGescheiterterVollerstattung({ ...STORNIERT_ERSTATTET, status: 'PAID' })).toEqual({ art: 'unklar' })
    expect(zuruecknahmeNachGescheiterterVollerstattung({ ...STORNIERT_ERSTATTET, paymentStatus: 'PENDING' })).toEqual({ art: 'unklar' })
  })

  it('ein Betrag von 0 ist nie zurückzunehmen', () => {
    expect(
      zuruecknahmeNachGescheiterterVollerstattung({ ...STORNIERT_ERSTATTET, gescheitertCents: 0, bezahltDatenbankCents: 0 })
    ).toEqual({ art: 'unklar' })
  })
})

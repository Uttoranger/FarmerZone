/**
 * Integrationstest — die Zählregel der Geld-Kachel in Admin › Heute und der
 * Zahl „Woche: n“ (Register N32, Ergänzung N46, 6.11.2026; Nr. 258 — ersetzt
 * die Zählweise nach Nr. 240, die nur abgeholte Bestellungen zählte).
 *
 * Die Regel: alle Bestellungen, die in der Woche eingegangen sind (`createdAt`,
 * Montag Wien bis jetzt), außer storniert bzw. abgelaufen (CANCELLED); online
 * nur bezahlt (paymentStatus PAID — REFUNDED zählt nicht, auch ohne Storno),
 * vor Ort (bar, Altbestand Karte) ab Eingang, auch unbestätigt; ohne
 * Testzahlungen. Warenwert und Gebühr ohne entfallene Gebühr. „Woche: n“ und
 * die Vorwoche (bis zum selben Zeitpunkt) nach derselben Regel. Die
 * Umsatzregel der Höfe (abgeholt, nach Abholzeitpunkt) bleibt, wie sie ist.
 *
 * Alle Bestellungen liegen im März 2083 (wie tests/integration/testzahlungen):
 * Der Seed legt seine Bestellungen relativ zur echten Uhr an, und die Woche
 * zählt alle Höfe — ein Fenster nahe heute liefe in die Seed-Bestellungen.
 * `jetzt` und der Stichtag sind Parameter; die Abfrage hängt an keiner Uhr.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import type { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { umsatzBestellungWhere, umsatzfenster } from '@/lib/umsatz'
import { centAusDecimal } from '@/server/queries/umsatz'
import { ladeHeute } from '@/server/queries/admin-heute'
import { erstelleHof, intKennung, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

// Donnerstag, 18. März 2083, 10:00 in Wien; die Woche beginnt Montag, 15. März.
// Die Vorwoche zählt bis Donnerstag, 11. März, 10:00.
const JETZT = new Date('2083-03-18T10:00:00+01:00')
// Erfundener Stichtag der Live-Schaltung: Mittwoch, 17. März, 12:00. Online-Bestellungen davor sind Testzahlungen.
const STICHTAG = new Date('2083-03-17T12:00:00+01:00')

type Bestellung = {
  createdAt: Date
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  /** Abholtag; ohne Angabe der Tag der Bestellung. */
  pickupDate?: Date
  pickedUpAt?: Date
  warenpreis: number
  gebuehrCents: number
  gebuehrEntfallen?: boolean
}

/** Die Woche aus der echten Seiten-Abfrage, ohne Betrieb (wie außerhalb der Produktion). */
async function ladeWoche(jetzt: Date, stripeLiveAb: Date | null): Promise<Awaited<ReturnType<typeof ladeHeute>>['woche']> {
  return (await ladeHeute(jetzt, { mitBetrieb: false }, stripeLiveAb)).woche
}

async function bestelle(farmId: string, b: Bestellung): Promise<void> {
  await prisma.order.create({
    data: {
      orderNumber: intKennung('geld').toUpperCase(),
      farmId,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Mustermann',
      customerPhone: '+43 660 0000000',
      status: b.status,
      totalAmount: b.warenpreis,
      pickupDate: b.pickupDate ?? b.createdAt,
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: b.paymentMethod,
      paymentStatus: b.paymentStatus,
      stripePaymentIntentId: b.paymentMethod === 'ONLINE' ? intKennung('pi') : null,
      serviceFeeCents: b.gebuehrCents,
      serviceFeePercentApplied: b.gebuehrCents > 0 ? 5 : null,
      serviceFeeRefundedAt: b.gebuehrEntfallen ? b.createdAt : null,
      pickedUpAt: b.pickedUpAt ?? null,
      createdAt: b.createdAt,
    },
  })
}

/** Ein Zeitpunkt in Wien (MEZ, März 2083). */
const wien = (iso: string): Date => new Date(`${iso}+01:00`)

// ── Fälle aus dem Auftrag (Nr. 258); was zählt, hat einen kleinen Betrag, was nicht zählt, einen großen ──

/** A · bar, bestellt Dienstag, bereit, Abholung erst Montag der nächsten Woche (W → W+1): zählt in W. */
const A: Bestellung = { createdAt: wien('2083-03-16T09:00:00'), pickupDate: wien('2083-03-22T00:00:00'), status: 'READY', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', warenpreis: 20, gebuehrCents: 100 }
/** G · online bezahlt nach dem Stichtag. */
const G: Bestellung = { createdAt: wien('2083-03-17T15:00:00'), status: 'PAID', paymentMethod: 'ONLINE', paymentStatus: 'PAID', warenpreis: 3, gebuehrCents: 15 }
/** I · bar unbestätigt (PENDING_CONFIRMATION): zählt ab Eingang. */
const I: Bestellung = { createdAt: wien('2083-03-18T08:00:00'), status: 'PENDING_CONFIRMATION', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', warenpreis: 5, gebuehrCents: 30 }
/** J · Karte bei Abholung (Altbestand), bestätigt. */
const J: Bestellung = { createdAt: wien('2083-03-16T11:00:00'), status: 'CONFIRMED', paymentMethod: 'ONSITE_CARD', paymentStatus: 'PENDING', warenpreis: 7, gebuehrCents: 40 }
/** K · online bezahlt, nicht abgeholt (NOT_PICKED_UP), Gebühr entfallen: Warenwert zählt, Gebühr nicht. */
const K: Bestellung = { createdAt: wien('2083-03-17T13:00:00'), status: 'NOT_PICKED_UP', paymentMethod: 'ONLINE', paymentStatus: 'PAID', warenpreis: 11, gebuehrCents: 70, gebuehrEntfallen: true }

/** B · bestellt Freitag der Vorwoche (nach dem Vergleichszeitpunkt), abgeholt Dienstag: weder in W noch in der Vorwoche. */
const B: Bestellung = { createdAt: wien('2083-03-12T09:00:00'), pickupDate: wien('2083-03-16T00:00:00'), pickedUpAt: wien('2083-03-16T16:00:00'), status: 'PICKED_UP', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PAID', warenpreis: 40, gebuehrCents: 200 }
/** C · Testzahlung: online bezahlt und abgeholt, aber vor dem Stichtag. */
const C: Bestellung = { createdAt: wien('2083-03-17T08:00:00'), pickedUpAt: wien('2083-03-17T16:00:00'), status: 'PICKED_UP', paymentMethod: 'ONLINE', paymentStatus: 'PAID', warenpreis: 10, gebuehrCents: 50 }
/** D · storniert. */
const D: Bestellung = { createdAt: wien('2083-03-16T10:00:00'), status: 'CANCELLED', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', warenpreis: 80, gebuehrCents: 400, gebuehrEntfallen: true }
/** E · verfallen: unbestätigte Barbestellung nach der Frist (wird CANCELLED, Gebühr entfällt). */
const E: Bestellung = { createdAt: wien('2083-03-15T08:00:00'), status: 'CANCELLED', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', warenpreis: 160, gebuehrCents: 800, gebuehrEntfallen: true }
/** F · online unbezahlt: vor der Zahlung (PENDING_CONFIRMATION, paymentStatus PENDING). */
const F: Bestellung = { createdAt: wien('2083-03-17T14:00:00'), status: 'PENDING_CONFIRMATION', paymentMethod: 'ONLINE', paymentStatus: 'PENDING', warenpreis: 320, gebuehrCents: 1600 }
/** H · online erstattet (REFUNDED), ohne Storno. */
const H: Bestellung = { createdAt: wien('2083-03-17T16:00:00'), status: 'PAID', paymentMethod: 'ONLINE', paymentStatus: 'REFUNDED', warenpreis: 640, gebuehrCents: 3200 }

/** V1 · bar unbestätigt am Dienstag der Vorwoche: zählt in der Vorwoche. */
const V1: Bestellung = { createdAt: wien('2083-03-09T08:00:00'), status: 'PENDING_CONFIRMATION', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', warenpreis: 9, gebuehrCents: 45 }
/** V2 · storniert am Mittwoch der Vorwoche: zählt nicht. */
const V2: Bestellung = { createdAt: wien('2083-03-10T08:00:00'), status: 'CANCELLED', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', warenpreis: 9, gebuehrCents: 45 }

async function legeWocheAn(farmId: string): Promise<void> {
  for (const b of [A, G, I, J, K, B, C, D, E, F, H, V1, V2]) await bestelle(farmId, b)
}

describe('Zählregel der Geld-Kachel in Admin › Heute (Nr. 258, N46)', () => {
  it('zählt die in der Woche eingegangenen Bestellungen: vor Ort ab Eingang, online nur bezahlt, ohne Storno, Verfall, Erstattung und Testzahlung', async () => {
    const { farm } = await erstelleHof()
    await legeWocheAn(farm.id)

    const woche = await ladeWoche(JETZT, STICHTAG)

    // A 20 + G 3 + I 5 + J 7 + K 11 = 46 €.
    expect(woche.umsatzCents).toBe(4600)
    // A 100 + G 15 + I 30 + J 40; K hat die Gebühr entfallen.
    expect(woche.gebuehrCents).toBe(185)
  })

  it('„Woche: n“ zählt dieselben Bestellungen wie die Kachel, die Vorwoche bis zum selben Zeitpunkt nach derselben Regel', async () => {
    const { farm } = await erstelleHof()
    await legeWocheAn(farm.id)

    const woche = await ladeWoche(JETZT, STICHTAG)

    // A, G, I, J, K — genau die fünf Bestellungen der Summe.
    expect(woche.anzahl).toBe(5)
    // Nur V1: V2 storniert, B nach dem Vergleichszeitpunkt bestellt.
    expect(woche.anzahlVorwoche).toBe(1)
  })

  it('jeder Fall allein: trägt genau seinen Warenwert und eine Bestellung bei oder nichts', async () => {
    const faelle: { name: string; b: Bestellung; zaehlt: boolean }[] = [
      { name: 'A bestellt in W, Abholung in W+1', b: A, zaehlt: true },
      { name: 'G online bezahlt', b: G, zaehlt: true },
      { name: 'I bar unbestätigt', b: I, zaehlt: true },
      { name: 'J Karte bei Abholung', b: J, zaehlt: true },
      { name: 'K nicht abgeholt, online bezahlt', b: K, zaehlt: true },
      { name: 'B bestellt in der Vorwoche, abgeholt in W', b: B, zaehlt: false },
      { name: 'C Testzahlung', b: C, zaehlt: false },
      { name: 'D storniert', b: D, zaehlt: false },
      { name: 'E verfallen', b: E, zaehlt: false },
      { name: 'F online unbezahlt', b: F, zaehlt: false },
      { name: 'H online REFUNDED ohne CANCELLED', b: H, zaehlt: false },
    ]
    for (const fall of faelle) {
      const { farm } = await erstelleHof()
      await bestelle(farm.id, fall.b)
      const woche = await ladeWoche(JETZT, STICHTAG)
      expect({ fall: fall.name, cent: woche.umsatzCents, anzahl: woche.anzahl }).toEqual({
        fall: fall.name,
        cent: fall.zaehlt ? fall.b.warenpreis * 100 : 0,
        anzahl: fall.zaehlt ? 1 : 0,
      })
      await raeumeAuf()
    }
  })

  it('ohne Stichtag zählt die bezahlte Online-Bestellung vor dem Stichtag mit (Testzahlungs-Regel unverändert)', async () => {
    const { farm } = await erstelleHof()
    await legeWocheAn(farm.id)

    const woche = await ladeWoche(JETZT, null)

    // Dazu C (10 €, 50 Cent); F unbezahlt und H erstattet bleiben draußen.
    expect(woche.umsatzCents).toBe(5600)
    expect(woche.gebuehrCents).toBe(235)
    expect(woche.anzahl).toBe(6)
  })

  it('Gegenprobe: die Umsatzregel der Höfe bleibt — abgeholt, nach dem Abholzeitpunkt, ohne Testzahlungen', async () => {
    const { farm } = await erstelleHof()
    await legeWocheAn(farm.id)

    const nachAbholung = umsatzBestellungWhere(farm.id, umsatzfenster('woche', JETZT).aktuell, STICHTAG)
    const summe = await prisma.order.aggregate({ where: nachAbholung, _sum: { totalAmount: true } })

    // Nur B (40 €): in dieser Woche abgeholt; C ist Testzahlung. Die Kachel zählt B nicht.
    expect(centAusDecimal(summe._sum.totalAmount)).toBe(4000)
    expect((await ladeWoche(JETZT, STICHTAG)).umsatzCents).toBe(4600)
  })
})

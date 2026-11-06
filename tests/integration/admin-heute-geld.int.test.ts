/**
 * Integrationstest — die Geld-Kachel in Admin › Heute zählt nach dem
 * Bestelldatum (Register N32, Ergänzung 5.11.2026, zweite Fassung; Nr. 240).
 *
 * Aussagen über die Woche, die `ladeHeute` aus Postgres liest:
 *  - Bestellt in dieser Woche: zählt im Geld, wann immer der Abholzeitpunkt
 *    liegt — das Fenster hängt nicht an `pickedUpAt` (Fall A setzt ihn bewusst
 *    nach `JETZT`; echt kommt das nicht vor). Eine Bestellung, die erst nach
 *    dem Wochenende abgeholt wird, steht in keiner laufenden Woche (Bericht 240).
 *  - Bestellt in der Vorwoche, abgeholt in dieser Woche: zählt im Geld nicht
 *    (Gegenprobe: die Umsatzregel nach Abholung hätte genau sie gezählt).
 *  - Status und Testzahlungen wie bisher: Storno zählt nicht, eine
 *    Testzahlung nur ohne Stichtag; entfallene Gebühr zählt nur beim Warenwert.
 *  - Die Zahl der Kachel „Bestellungen heute“ zählt weiter nach Abholung,
 *    gegen die Vorwoche bis zum selben Zeitpunkt.
 *
 * Alle Bestellungen liegen im März 2083 (wie tests/integration/testzahlungen):
 * Der Seed legt seine Bestellungen relativ zur echten Uhr an, und die Woche
 * zählt alle Höfe — ein Fenster nahe heute liefe in die Seed-Bestellungen.
 * `jetzt` und der Stichtag sind Parameter; die Abfrage hängt an keiner Uhr.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import type { OrderStatus, PaymentMethod } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { umsatzBestellungWhere, umsatzfenster } from '@/lib/umsatz'
import { centAusDecimal } from '@/server/queries/umsatz'
import { ladeHeute } from '@/server/queries/admin-heute'
import { erstelleHof, intKennung, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

// Donnerstag, 18. März 2083, 10:00 in Wien; die Woche beginnt Montag, 15. März.
const JETZT = new Date('2083-03-18T10:00:00+01:00')
// Erfundener Stichtag der Live-Schaltung: Mittwoch, 17. März, 12:00.
const STICHTAG = new Date('2083-03-17T12:00:00+01:00')

type Bestellung = {
  createdAt: Date
  pickedUpAt: Date | null
  status?: OrderStatus
  paymentMethod?: PaymentMethod
  warenpreis: number
  gebuehrCents: number
  gebuehrEntfallen?: boolean
}

/** Die Woche aus der echten Seiten-Abfrage, ohne Betrieb (wie außerhalb der Produktion). */
async function ladeWoche(jetzt: Date, stripeLiveAb: Date | null): Promise<Awaited<ReturnType<typeof ladeHeute>>['woche']> {
  return (await ladeHeute(jetzt, { mitBetrieb: false }, stripeLiveAb)).woche
}

async function bestelle(farmId: string, b: Bestellung): Promise<void> {
  const paymentMethod = b.paymentMethod ?? 'ONSITE_CASH'
  await prisma.order.create({
    data: {
      orderNumber: intKennung('geld').toUpperCase(),
      farmId,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Mustermann',
      customerPhone: '+43 660 0000000',
      status: b.status ?? 'PICKED_UP',
      totalAmount: b.warenpreis,
      pickupDate: b.pickedUpAt ?? b.createdAt,
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod,
      paymentStatus: 'PAID',
      stripePaymentIntentId: paymentMethod === 'ONLINE' ? intKennung('pi') : null,
      serviceFeeCents: b.gebuehrCents,
      serviceFeePercentApplied: b.gebuehrCents > 0 ? 5 : null,
      serviceFeeRefundedAt: b.gebuehrEntfallen ? b.createdAt : null,
      pickedUpAt: b.pickedUpAt,
      createdAt: b.createdAt,
    },
  })
}

/** Die Bestände des Beispiels: je Fall eine Bestellung mit eigenem Betrag, damit jede Summe zeigt, wer mitzählt. */
async function legeWocheAn(farmId: string): Promise<void> {
  // A · bestellt Dienstag, Abholzeitpunkt nach JETZT (künstlich): zählt im Geld, weil das Fenster nicht an pickedUpAt hängt.
  await bestelle(farmId, { createdAt: new Date('2083-03-16T09:00:00+01:00'), pickedUpAt: new Date('2083-03-22T16:00:00+01:00'), warenpreis: 20, gebuehrCents: 100 })
  // B · bestellt Freitag der Vorwoche (nach dem Vergleichszeitpunkt), abgeholt Dienstag: zählt im Geld nicht.
  await bestelle(farmId, { createdAt: new Date('2083-03-12T09:00:00+01:00'), pickedUpAt: new Date('2083-03-16T16:00:00+01:00'), warenpreis: 40, gebuehrCents: 200 })
  // C · Testzahlung: online vor dem Stichtag, in der Woche bestellt und abgeholt.
  await bestelle(farmId, { createdAt: new Date('2083-03-17T08:00:00+01:00'), pickedUpAt: new Date('2083-03-17T16:00:00+01:00'), paymentMethod: 'ONLINE', warenpreis: 10, gebuehrCents: 50 })
  // D · storniert, in der Woche bestellt.
  await bestelle(farmId, { createdAt: new Date('2083-03-16T10:00:00+01:00'), pickedUpAt: null, status: 'CANCELLED', warenpreis: 80, gebuehrCents: 400 })
  // E · in der Woche bestellt und abgeholt, Gebühr entfallen: nur der Warenwert zählt.
  await bestelle(farmId, { createdAt: new Date('2083-03-15T08:00:00+01:00'), pickedUpAt: new Date('2083-03-15T16:00:00+01:00'), warenpreis: 15, gebuehrCents: 75, gebuehrEntfallen: true })
  // F · Vorwoche, bestellt und abgeholt vor dem Vergleichszeitpunkt (Donnerstag 10:00).
  await bestelle(farmId, { createdAt: new Date('2083-03-09T08:00:00+01:00'), pickedUpAt: new Date('2083-03-10T16:00:00+01:00'), warenpreis: 5, gebuehrCents: 50 })
}

describe('Geld-Kachel in Admin › Heute nach dem Bestelldatum (Nr. 240)', () => {
  it('zählt die in der Woche bestellten, abgeholten Bestellungen — auch mit Abholung in der nächsten Woche, nicht die aus der Vorwoche', async () => {
    const { farm } = await erstelleHof()
    await legeWocheAn(farm.id)

    const woche = await ladeWoche(JETZT, STICHTAG)

    // A (20 €) + E (15 €); B aus der Vorwoche, C Testzahlung und D Storno nicht.
    expect(woche.umsatzCents).toBe(3500)
    // Nur A: E hat die Gebühr entfallen.
    expect(woche.gebuehrCents).toBe(100)
    // Die Zahl der Bestellungen-Kachel bleibt nach Abholung: B und E diese Woche, F in der Vorwoche.
    expect(woche.anzahl).toBe(2)
    expect(woche.anzahlVorwoche).toBe(1)
  })

  it('Gegenprobe: die Umsatzregel nach Abholung hätte B gezählt und A nicht', async () => {
    const { farm } = await erstelleHof()
    await legeWocheAn(farm.id)

    const nachAbholung = umsatzBestellungWhere(farm.id, umsatzfenster('woche', JETZT).aktuell, STICHTAG)
    const summe = await prisma.order.aggregate({ where: nachAbholung, _sum: { totalAmount: true } })

    // B (40 €) + E (15 €) — genau das Bild, das die Kachel bis Nr. 240 zeigte.
    expect(centAusDecimal(summe._sum.totalAmount)).toBe(5500)
    expect((await ladeWoche(JETZT, STICHTAG)).umsatzCents).not.toBe(5500)
  })

  it('ohne Stichtag zählt die Online-Bestellung wie vor der Live-Schaltung mit (Testzahlungs-Regel unverändert)', async () => {
    const { farm } = await erstelleHof()
    await legeWocheAn(farm.id)

    const woche = await ladeWoche(JETZT, null)

    // A + C + E.
    expect(woche.umsatzCents).toBe(4500)
    expect(woche.gebuehrCents).toBe(150)
    expect(woche.anzahl).toBe(3)
  })
})

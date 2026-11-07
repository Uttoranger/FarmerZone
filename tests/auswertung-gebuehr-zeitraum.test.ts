/**
 * Gebühr für den gewählten Zeitraum der Auswertung (Nr. 251, Liste Lauf 32
 * auswertung „Woche zeigt die Gebühr des Monats“): reine Anzeige-Abfrage
 * `getServicegebuehrenZeitraum`. Sie liest dieselbe Regel wie die
 * Monatskarte und die Abrechnung (`servicegebuehrenImMonat` →
 * `topfVonBestellung`, gespeicherte `serviceFeeCents`) und ändert sie nicht:
 * Für den ganzen Monat liefert sie dieselbe Zahl wie `getServicegebuehrenMonat`,
 * über eine Monatsgrenze zählt jede Bestellung genau einmal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { order: { findMany: vi.fn() } } }))
vi.mock('@/lib/umgebung-server', () => ({ STRIPE_LIVE_AB: null }))

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getServicegebuehrenMonat, getServicegebuehrenZeitraum } from '@/server/queries/auswertung'
import { gebuehrenKarteFuerZeitraum } from '@/components/auswertung/gebuehr-titel'
import { PLATTFORMGEBUEHR_KARTE_BAR, PLATTFORMGEBUEHR_KARTE_ERKLAERUNG, SERVICEGEBUEHREN_ERKLAERUNG } from '@/lib/auswertung'
import { BAR_OHNE_GEBUEHR_SATZ } from '@/lib/konditionen'
import { umsatzfenster } from '@/lib/umsatz'

const findMany = vi.mocked(prisma.order.findMany)

type Zeile = {
  createdAt: Date
  status: string
  paymentMethod: string
  paymentStatus: string
  serviceFeeCents: number
  serviceFeeRefundedAt: Date | null
  platformFeeAmount: Prisma.Decimal
}

function bestellung(abweichend: Partial<Zeile> = {}): Zeile {
  return {
    createdAt: new Date('2026-10-15T10:00:00Z'),
    status: 'PICKED_UP',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    serviceFeeCents: 100,
    serviceFeeRefundedAt: null,
    platformFeeAmount: new Prisma.Decimal('0'),
    ...abweichend,
  }
}

const OKTOBER = [
  bestellung({ serviceFeeCents: 53 }),
  bestellung({ serviceFeeCents: 61, createdAt: new Date('2026-10-02T08:00:00Z') }),
  // Storniert und erstattet zählt nicht — dieselbe Regel wie die Abrechnung.
  bestellung({ status: 'CANCELLED', serviceFeeCents: 70 }),
  bestellung({ serviceFeeRefundedAt: new Date('2026-10-16T08:00:00Z'), serviceFeeCents: 80 }),
]

beforeEach(() => findMany.mockReset())

describe('getServicegebuehrenZeitraum — Gebühr des gewählten Zeitraums, nur Anzeige', () => {
  it('fragt nur die eigenen Bestellungen, die im Fenster eingegangen sind', async () => {
    findMany.mockResolvedValue([] as never)
    const von = new Date('2026-10-05T00:00:00Z')
    const bis = new Date('2026-10-11T21:59:59Z')
    await getServicegebuehrenZeitraum('hof-1', { von, bis }, null)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { farmId: 'hof-1', createdAt: { gte: von, lte: bis } } }))
  })

  it('ganzer Monat: dieselbe Zahl wie die Monatskarte (getServicegebuehrenMonat)', async () => {
    findMany.mockResolvedValue(OKTOBER as never)
    const zeitraum = await getServicegebuehrenZeitraum(
      'hof-1',
      { von: new Date('2026-09-30T22:00:00Z'), bis: new Date('2026-10-31T22:59:59Z') },
      null
    )
    const monat = await getServicegebuehrenMonat('hof-1', new Date('2026-10-20T10:00:00Z'), null)
    expect(monat).toMatchObject(zeitraum)
    expect(zeitraum).toEqual({ onlineCents: 114, onlineAnzahl: 2, vorOrtCents: 0, vorOrtAnzahl: 0, summeCents: 114 })
  })

  it('Woche über die Monatsgrenze: jede Bestellung zählt genau einmal, vor Ort abgeholt als „vor Ort“', async () => {
    findMany.mockResolvedValue([
      bestellung({ serviceFeeCents: 40, createdAt: new Date('2026-10-30T10:00:00Z') }),
      bestellung({ serviceFeeCents: 45, createdAt: new Date('2026-11-02T10:00:00Z') }),
      bestellung({
        serviceFeeCents: 30,
        createdAt: new Date('2027-03-02T10:00:00Z'),
        paymentMethod: 'ONSITE_CASH',
        paymentStatus: 'PENDING',
      }),
    ] as never)
    const summe = await getServicegebuehrenZeitraum('hof-1', { von: new Date('2026-10-25T23:00:00Z'), bis: new Date('2027-03-08T22:59:59Z') }, null)
    expect(summe.onlineCents).toBe(85)
    expect(summe.onlineAnzahl).toBe(2)
    // Bar abgeholt nach dem Bar-Stichtag: geschuldet, zählt als „vor Ort“.
    expect(summe.vorOrtCents).toBe(30)
    expect(summe.vorOrtAnzahl).toBe(1)
    expect(summe.summeCents).toBe(115)
  })

  it('mit Stripe-Live-Stichtag: eine Testzahlung davor zählt nicht, dieselbe Zahlung danach schon', async () => {
    const liveAb = new Date('2026-10-10T00:00:00Z')
    findMany.mockResolvedValue([
      bestellung({ serviceFeeCents: 50, createdAt: new Date('2026-10-05T10:00:00Z') }),
      bestellung({ serviceFeeCents: 60, createdAt: new Date('2026-10-12T10:00:00Z') }),
    ] as never)
    const fenster = { von: new Date('2026-09-30T22:00:00Z'), bis: new Date('2026-10-31T22:59:59Z') }
    expect(await getServicegebuehrenZeitraum('hof-1', fenster, liveAb)).toEqual({
      onlineCents: 60,
      onlineAnzahl: 1,
      vorOrtCents: 0,
      vorOrtAnzahl: 0,
      summeCents: 60,
    })
    // Gegenprobe ohne Stichtag: beide zählen.
    expect((await getServicegebuehrenZeitraum('hof-1', fenster, null)).summeCents).toBe(110)
  })

  it('ohne Bestellung: alles null', async () => {
    findMany.mockResolvedValue([] as never)
    expect(await getServicegebuehrenZeitraum('hof-1', { von: new Date(), bis: new Date() }, null)).toEqual({
      onlineCents: 0,
      onlineAnzahl: 0,
      vorOrtCents: 0,
      vorOrtAnzahl: 0,
      summeCents: 0,
    })
  })
})

/*
 * Runde 1 (Nr. 251): Titel, Betrag UND Sätze der Karte gelten für den gewählten Zeitraum — nie
 * für das Modell von heute. Stichtag „Hofpreis-Modell ab“ = 1. Februar 2027 (wie der Bar-Stichtag).
 */
describe('gebuehrenKarteFuerZeitraum — Sätze nach dem gewählten Zeitraum, nicht nach heute', () => {
  const stichtag = { hofpreisModellAb: new Date('2027-02-01T00:00:00+01:00') }
  const maerz = new Date('2027-03-03T10:00:00+01:00')

  it('Zeitraum vor dem Stichtag, heute danach: Servicegebühr-Sätze mit Bar-Ausnahme, keine Bar-Zeile', () => {
    const karte = gebuehrenKarteFuerZeitraum(umsatzfenster('monat', maerz, 2), stichtag)
    expect(karte.titel).toBe('Servicegebühr im Jänner')
    expect(karte.erklaerung).toBe(SERVICEGEBUEHREN_ERKLAERUNG)
    expect(karte.bar).toBe(BAR_OHNE_GEBUEHR_SATZ)
    expect(karte.barZeile).toBe(false)
    // Gegenprobe: heute gälte das Hofpreis-Modell — dessen Sätze stehen hier nicht.
    expect(karte.erklaerung).not.toBe(PLATTFORMGEBUEHR_KARTE_ERKLAERUNG)
  })

  it('Zeitraum nach dem Stichtag (laufend und eine Woche zurück): Plattformgebühr-Sätze mit Bar-Zeile', () => {
    for (const pf of [umsatzfenster('monat', maerz), umsatzfenster('woche', maerz, 1)]) {
      const karte = gebuehrenKarteFuerZeitraum(pf, stichtag)
      expect(karte.titel).toMatch(/^Plattformgebühr /)
      expect(karte.erklaerung).toBe(PLATTFORMGEBUEHR_KARTE_ERKLAERUNG)
      expect(karte.bar).toBe(PLATTFORMGEBUEHR_KARTE_BAR)
      expect(karte.barZeile).toBe(true)
    }
  })

  it('heute vor dem Stichtag, laufender Monat: bisherige Sätze; ein Zeitraum ganz davor ebenso', () => {
    const spaeterStichtag = { hofpreisModellAb: new Date('2027-04-01T00:00:00+02:00') }
    const karte = gebuehrenKarteFuerZeitraum(umsatzfenster('monat', maerz), spaeterStichtag)
    expect(karte.titel).toBe('Servicegebühr im März')
    expect(karte.erklaerung).toBe(SERVICEGEBUEHREN_ERKLAERUNG)
    // Nach dem Bar-Stichtag (B1) trägt bar eine Gebühr: Bar-Zeile da, kein „ohne Servicegebühr“.
    expect(karte.barZeile).toBe(true)
    expect(karte.bar).not.toBe(BAR_OHNE_GEBUEHR_SATZ)
  })

  it('Zeitraum über den Stichtag: „Gebühren“, Sätze des Modells am Ende des Zeitraums', () => {
    const mitte = { hofpreisModellAb: new Date('2027-02-15T00:00:00+01:00') }
    const februar = gebuehrenKarteFuerZeitraum(umsatzfenster('monat', maerz, 1), mitte)
    expect(februar.titel).toBe('Gebühren im Februar')
    expect(februar.erklaerung).toBe(PLATTFORMGEBUEHR_KARTE_ERKLAERUNG)
    // Laufend über den Stichtag, heute noch davor: die Sätze von jetzt (gezählt ist nur bis jetzt).
    const laufend = gebuehrenKarteFuerZeitraum(umsatzfenster('monat', new Date('2027-02-10T10:00:00+01:00')), mitte)
    expect(laufend.titel).toBe('Gebühren im Februar')
    expect(laufend.erklaerung).toBe(SERVICEGEBUEHREN_ERKLAERUNG)
  })
})

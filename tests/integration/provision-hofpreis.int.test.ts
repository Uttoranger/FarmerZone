/**
 * Integrationstest — Register N38, Ergänzung E-023 (Nr. 286): Im
 * Hofpreis-Modell ist die Provision (`Farm.platformFeePercent`) immer 0; die
 * Gebühr der Plattform ist allein die Plattformgebühr.
 *
 * Aussage über den ZUSTAND danach, in der echten Datenbank: Eine
 * Online-Bestellung bei einem Hof mit 5 % Provision speichert
 * `platformFeeAmount` 0 (Decimal aus der Spalte), und Stripe (Attrappe, nie
 * live) bekommt amount = Warenpreis + Plattformgebühr und
 * application_fee_amount = nur die Plattformgebühr — gerechnet aus dem
 * gespeicherten Snapshot. Gegenprobe im Modell `bisher`: dort steht die
 * Provision wie vor Nr. 286 im Snapshot und in application_fee_amount.
 *
 * Stichtag wie tests/integration/bargebuehr.int.test.ts: Die Admin-Einstellung
 * „Hofpreis-Modell ab“ wird je Fall gesetzt und zurückgesetzt, `Date` (nur
 * `Date`) steht nach dem Stichtag — so läuft der Fall auch nach Februar 2027.
 * Die Datei berührt Better Auth nicht (Uhr-Wache).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
// Der Nachlauf (Mail) gehört nicht zur Aussage — gesammelt und nie gestartet.
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn(), sendBestellungVerfallen: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() } },
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { BAR_SERVICEGEBUEHR_AB } from '@/lib/konditionen'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

const anlegen = vi.mocked(stripe.paymentIntents.create)
const TAG_MS = 24 * 60 * 60 * 1000

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
})

afterEach(async () => {
  vi.useRealTimers()
  await raeumeAuf()
})

function uhrAuf(zeitpunkt: Date): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(zeitpunkt)
}

/** Den Stichtag „Hofpreis-Modell ab“ für einen Fall setzen und danach zurücksetzen — die Dateien laufen nacheinander. */
async function mitHofpreisStichtag(ab: Date, test: () => Promise<void>): Promise<void> {
  const vorher = await prisma.plattformEinstellung.findUnique({ where: { id: 'plattform' }, select: { hofpreisModellAb: true } })
  await prisma.plattformEinstellung.upsert({ where: { id: 'plattform' }, create: { id: 'plattform', hofpreisModellAb: ab }, update: { hofpreisModellAb: ab } })
  try {
    await test()
  } finally {
    await prisma.plattformEinstellung.update({ where: { id: 'plattform' }, data: { hofpreisModellAb: vorher?.hofpreisModellAb ?? null } })
  }
}

/** Hof mit 5 % Provision, Servicegebühr des alten Modells und fertiger Online-Zahlung; 2 × 10 € im Korb. */
async function onlineBestellungMitProvision() {
  const { farm } = await erstelleHof({
    platformFeePercent: 5,
    serviceFeePercent: 5,
    serviceFeeMinCents: 50,
    serviceFeeActiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    acceptsOnline: true,
    stripeAccountReady: true,
    stripeAccountId: intKennung('acct'),
    einzugAb: BAR_SERVICEGEBUEHR_AB,
  })
  const produkt = await erstelleProdukt(farm.id, { stock: 10, price: 10 })
  const sitzung = intKennung('sitzung')
  await setzeHalt(produkt.id, sitzung, 2)
  anlegen.mockResolvedValue({ id: intKennung('pi'), client_secret: 'cs_test' } as never)

  const antwort = await checkout(
    checkoutAnfrage({
      farm,
      sessionId: sitzung,
      paymentMethod: 'ONLINE',
      positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 2, unitPrice: 10 }],
    })
  )
  return { farm, antwort }
}

describe('Provision im Hofpreis-Modell — echte Datenbank', () => {
  it('online, Hof mit 5 %: platformFeeAmount 0, Stripe bekommt nur die Plattformgebühr als application_fee', () =>
    mitHofpreisStichtag(BAR_SERVICEGEBUEHR_AB, async () => {
      uhrAuf(new Date(BAR_SERVICEGEBUEHR_AB.getTime() + 2 * TAG_MS))
      const { farm, antwort } = await onlineBestellungMitProvision()

      expect(antwort.status).toBe(200)
      const bestellt = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })
      // 10 € × 6 % = 60 Cent je Stück, 2 Stück = 120 Cent; die Provision fällt weg.
      expect(bestellt.gebuehrModell).toBe('hofpreis')
      expect(bestellt.totalAmount.toFixed(2)).toBe('20.00')
      expect(bestellt.platformFeeAmount.toFixed(2)).toBe('0.00')
      expect(bestellt.serviceFeeCents).toBe(120)
      expect(anlegen).toHaveBeenCalledOnce()
      expect(anlegen.mock.calls[0]?.[0]).toMatchObject({ amount: 2120, application_fee_amount: 120 })
    }))

  it('Gegenprobe Modell bisher: die Provision steht wie vor Nr. 286 im Snapshot und in application_fee', () =>
    mitHofpreisStichtag(new Date('2099-01-01T00:00:00.000Z'), async () => {
      uhrAuf(new Date(BAR_SERVICEGEBUEHR_AB.getTime() + 2 * TAG_MS))
      const { farm, antwort } = await onlineBestellungMitProvision()

      expect(antwort.status).toBe(200)
      const bestellt = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })
      // 20 € × 5 % = 1,00 € Provision; Servicegebühr 20 € × 5 % = 100 Cent (E4).
      expect(bestellt.gebuehrModell).toBeNull()
      expect(bestellt.platformFeeAmount.toFixed(2)).toBe('1.00')
      expect(bestellt.serviceFeeCents).toBe(100)
      expect(anlegen.mock.calls[0]?.[0]).toMatchObject({ amount: 2100, application_fee_amount: 200 })
    }))
})

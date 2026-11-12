/**
 * Integrationstest — Nr. 287, Register N10: Die Kundin zahlt nie einen Betrag,
 * den sie nicht gesehen hat. Die Kasse schickt den Gesamtbetrag mit
 * (`gesamtCents`); weicht er von Warenpreis + Gebühr des Servers ab, entsteht
 * keine Bestellung (409 GESAMT_GEAENDERT mit dem neuen Betrag), es wird kein
 * Vorrat gebucht und Stripe nicht gefragt. Der zweite Versuch mit dem neuen
 * Betrag geht durch; ohne Feld (alter Tab) bleibt alles wie vorher.
 *
 * Beide Modelle: „bisher“ (Servicegebühr des Hofs) und „hofpreis“
 * (Plattformgebühr je Stück, N38). Stichtag und Uhr wie
 * tests/integration/provision-hofpreis.int.test.ts — nur `Date` steht fest;
 * die Datei berührt Better Auth nicht (Uhr-Wache).
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
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() } },
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { BAR_SERVICEGEBUEHR_AB } from '@/lib/konditionen'
import type { Prisma } from '@prisma/client'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

const anlegen = vi.mocked(stripe.paymentIntents.create)
const TAG_MS = 24 * 60 * 60 * 1000
const GESAMT_GEAENDERT_SATZ = 'Der Gesamtbetrag hat sich geändert. Bitte prüf ihn und bestell dann noch einmal.'

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  anlegen.mockImplementation((async () => ({ id: intKennung('pi'), client_secret: 'cs_test' })) as never)
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

/** Hof mit fertiger Online-Zahlung und 5 % Servicegebühr (Modell bisher), 2 × 10 € im Korb. */
async function hofMitKorb() {
  const { farm } = await erstelleHof({
    serviceFeePercent: 5,
    serviceFeeMinCents: 50,
    serviceFeeActiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    acceptsOnline: true,
    stripeAccountReady: true,
    stripeAccountId: intKennung('acct'),
    einzugAb: BAR_SERVICEGEBUEHR_AB,
  })
  const produkt = await erstelleProdukt(farm.id, { stock: 10, price: 10 })
  return { farm, produkt }
}

/** Eine Online-Bestellung mit eigener Sitzung; `gesamtCents` nur, wenn angegeben (sonst: alter Tab). */
async function bestellen(farm: { id: string; slug: string }, produktId: string, gesamtCents?: number) {
  const sitzung = intKennung('sitzung')
  await setzeHalt(produktId, sitzung, 2)
  return checkout(
    checkoutAnfrage({
      farm,
      sessionId: sitzung,
      paymentMethod: 'ONLINE',
      positionen: [{ productId: produktId, name: 'Testprodukt', quantity: 2, unitPrice: 10 }],
      zusatz: gesamtCents === undefined ? {} : { gesamtCents },
    })
  )
}

const vorrat = async (id: string): Promise<number> => (await prisma.product.findUniqueOrThrow({ where: { id }, select: { stock: true } })).stock

/**
 * Der gemeinsame Ablauf beider Modelle: Die Kasse sah `gesehen`, dann ändert der Hof seinen Satz
 * (`aendern`), der Server rechnet `neu` mit `neueGebuehr`.
 */
async function satzGeaendert(gesehen: number, aendern: Prisma.FarmUpdateInput, neu: number, neueGebuehr: number): Promise<void> {
  const { farm, produkt } = await hofMitKorb()
  await prisma.farm.update({ where: { id: farm.id }, data: aendern })

  const alt = await bestellen(farm, produkt.id, gesehen)

  expect(alt.status).toBe(409)
  expect(await alt.json()).toEqual({
    error: GESAMT_GEAENDERT_SATZ,
    code: 'GESAMT_GEAENDERT',
    amountCents: neu,
    serviceFeeCents: neueGebuehr,
  })
  expect(await vorrat(produkt.id)).toBe(10)
  expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(0)
  expect(anlegen).not.toHaveBeenCalled()

  // Der nächste Klick schickt den Betrag des Servers — er geht durch, und Stripe bekommt genau ihn.
  const zweiter = await bestellen(farm, produkt.id, neu)

  expect(zweiter.status).toBe(200)
  expect(await vorrat(produkt.id)).toBe(8)
  expect(anlegen.mock.calls[0]?.[0]).toMatchObject({ amount: neu })
}

describe('Abgleich des Gesamtbetrags (N10, Nr. 287) — echte Datenbank', () => {
  it('Modell bisher: Servicegebühr zwischen Anzeige und Kasse geändert → 409 mit dem neuen Betrag, dann 200', () =>
    mitHofpreisStichtag(new Date('2099-01-01T00:00:00.000Z'), async () => {
      uhrAuf(new Date(BAR_SERVICEGEBUEHR_AB.getTime() + 2 * TAG_MS))
      // Gesehen: 20 € + 5 % = 21,00 €; der Hof stellt auf 7 % → 21,40 €.
      await satzGeaendert(2100, { serviceFeePercent: 7 }, 2140, 140)
    }))

  it('Modell hofpreis: Plattformgebühr zwischen Anzeige und Kasse geändert → 409 mit dem neuen Betrag, dann 200', () =>
    mitHofpreisStichtag(BAR_SERVICEGEBUEHR_AB, async () => {
      uhrAuf(new Date(BAR_SERVICEGEBUEHR_AB.getTime() + 2 * TAG_MS))
      // Gesehen: 2 × (10 € + 6 %) = 21,20 €; der Satz des Hofs steigt auf 8 % → 21,60 €.
      await satzGeaendert(2120, { plattformgebuehrProzent: 8 }, 2160, 160)
    }))

  it('Modell bisher: ohne Feld (alter Tab) geht die Bestellung durch wie vorher', () =>
    mitHofpreisStichtag(new Date('2099-01-01T00:00:00.000Z'), async () => {
      uhrAuf(new Date(BAR_SERVICEGEBUEHR_AB.getTime() + 2 * TAG_MS))
      const { farm, produkt } = await hofMitKorb()

      const antwort = await bestellen(farm, produkt.id)

      expect(antwort.status).toBe(200)
      expect(anlegen.mock.calls[0]?.[0]).toMatchObject({ amount: 2100 })
    }))

  it('Modell hofpreis: ohne Feld (alter Tab) geht die Bestellung durch wie vorher', () =>
    mitHofpreisStichtag(BAR_SERVICEGEBUEHR_AB, async () => {
      uhrAuf(new Date(BAR_SERVICEGEBUEHR_AB.getTime() + 2 * TAG_MS))
      const { farm, produkt } = await hofMitKorb()

      const antwort = await bestellen(farm, produkt.id)

      expect(antwort.status).toBe(200)
      expect(anlegen.mock.calls[0]?.[0]).toMatchObject({ amount: 2120 })
    }))

  it('der gesehene Betrag stimmt: 200 ohne Umweg', () =>
    mitHofpreisStichtag(BAR_SERVICEGEBUEHR_AB, async () => {
      uhrAuf(new Date(BAR_SERVICEGEBUEHR_AB.getTime() + 2 * TAG_MS))
      const { farm, produkt } = await hofMitKorb()

      const antwort = await bestellen(farm, produkt.id, 2120)

      expect(antwort.status).toBe(200)
      expect(await vorrat(produkt.id)).toBe(8)
    }))
})

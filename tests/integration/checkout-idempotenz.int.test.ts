/**
 * Integrationstest 2 — Idempotenz des Checkouts.
 *
 * Die Aussage: Derselbe Idempotenz-Schlüssel erzeugt genau EINE Bestellung und
 * bucht den Bestand genau EINMAL ab — auch wenn die zweite Anfrage gleichzeitig
 * eintrifft.
 *
 * Warum hier und nicht in der schnellen Suite: Die Durchsetzung ist der
 * eindeutige Index auf `Order.idempotencyKey` (prisma/schema.prisma). Die
 * Vorprüfung in Schritt 0 des Handlers deckt nur den Fall ab, dass die erste
 * Bestellung schon fertig ist. Kommen beide Anfragen gleichzeitig, läuft die
 * zweite in den Index und nimmt den Weg über den catch-Zweig
 * (src/app/api/checkout/route.ts, Schritt 9) — das entscheidet Postgres, nicht
 * der Code, und ein Mock kann es nicht beweisen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { sendOnsiteConfirmation } from '@/lib/email'
import { CODE_RESERVIERUNG_ABGELAUFEN } from '@/lib/reservierung'
import {
  checkoutAnfrage,
  erstelleHof,
  erstelleProdukt,
  intKennung,
  raeumeAuf,
  setzeHalt,
} from './setup/basis'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await raeumeAuf()
})

async function vorbereiten() {
  const { farm } = await erstelleHof()
  const produkt = await erstelleProdukt(farm.id, { stock: 5 })
  const sitzung = intKennung('sitzung')
  await setzeHalt(produkt.id, sitzung, 1)
  const kundin = `${intKennung('kundin')}@example.com`
  await prisma.user.create({
    data: { id: intKennung('user'), email: kundin, name: 'Erika Mustermann', role: 'CUSTOMER' },
  })
  const schluessel = intKennung('idem')

  const anfrage = () =>
    checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        customerEmail: kundin,
        idempotencyKey: schluessel,
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
      })
    )

  return { farm, produkt, anfrage }
}

describe('POST /api/checkout — Idempotenz in der echten Datenbank', () => {
  it('gibt beim zweiten Absenden mit demselben Schlüssel dieselbe Bestellung zurück und bucht nur einmal ab', async () => {
    const { farm, produkt, anfrage } = await vorbereiten()

    const erste = await anfrage()
    const zweite = await anfrage()

    expect(erste.status).toBe(200)
    expect(zweite.status).toBe(200)

    const a = await erste.json()
    const b = await zweite.json()
    expect(b.orderId).toBe(a.orderId)
    expect(b.wiederholt).toBe(true)

    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(1)
    expect(await prisma.orderItem.count({ where: { order: { farmId: farm.id } } })).toBe(1)
    // 5 − 1: genau einmal abgebucht, nicht zweimal.
    expect(await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).toMatchObject({
      stock: 4,
    })

    // Prüfstelle: Die Kundin bekommt EINE Bestätigung, nicht zwei.
    await vi.waitFor(() => expect(sendOnsiteConfirmation).toHaveBeenCalledTimes(1))
  })

  it('erzeugt bei zwei gleichzeitigen Anfragen mit demselben Schlüssel nie eine zweite Bestellung', async () => {
    // WAS DIESER TEST BEHAUPTET UND WAS NICHT — die CI hat das erst
    // richtiggestellt (er behauptete zuerst „beide antworten 200"):
    //
    // Von außen ist der WEG der zweiten Anfrage nicht feststellbar. Je nach
    // Verschränkung findet sie die Bestellung in Schritt 0, läuft in Schritt 9
    // in den eindeutigen Index — oder sie kommt erst an, nachdem die Gewinnerin
    // in Schritt 10 die Halte der Sitzung gelöscht hat, und wird dann mit
    // „Reservierung abgelaufen" abgewiesen. Alle drei sind gültige Ausgänge, und
    // welcher eintritt, entscheidet die Maschine, nicht der Code.
    //
    // Die Aussage ist deshalb der ZUSTAND, der in jeder Verschränkung gelten
    // muss: eine Bestellung, eine Position, einmal abgebucht. Genau das schützt
    // das Geld; welcher Weg dorthin führte, tut es nicht.
    const { farm, produkt, anfrage } = await vorbereiten()

    const antworten = await Promise.all([anfrage(), anfrage()])

    // Mindestens eine muss durchkommen — beide abzulehnen wäre ein Fehler.
    const erfolge = antworten.filter((r) => r.status === 200)
    expect(erfolge.length).toBeGreaterThanOrEqual(1)

    // Wird eine abgelehnt, dann NUR wegen der gelöschten Halte. Ein
    // Bestandsfehler wäre hier keiner: 5 auf Lager, 1 bestellt.
    for (const abgelehnt of antworten.filter((r) => r.status !== 200)) {
      expect(abgelehnt.status).toBe(409)
      expect(await abgelehnt.json()).toMatchObject({ code: CODE_RESERVIERUNG_ABGELAUFEN })
    }

    const bestellungen = await prisma.order.findMany({
      where: { farmId: farm.id },
      include: { items: true },
    })
    expect(bestellungen).toHaveLength(1)
    expect(bestellungen[0]!.items).toHaveLength(1)

    // Einmal abgebucht, nicht zweimal. Lief die Verliererin über den Index,
    // hatte sie vorher gebucht und wieder gutgeschrieben — ohne diesen
    // Ausgleich stünde hier 3.
    expect(await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).toMatchObject({
      stock: 4,
    })

    // Kommen beide durch, ist es dieselbe Bestellung, und genau eine Antwort
    // trägt `wiederholt` — die Gewinnerin kennt das Feld nicht.
    if (erfolge.length === 2) {
      const [a, b] = await Promise.all(erfolge.map((r) => r.json()))
      expect(a.orderId).toBe(b.orderId)
      expect([a.wiederholt, b.wiederholt].filter(Boolean)).toHaveLength(1)
    }
  })

  it('erzeugt ohne Schlüssel zwei Bestellungen — die Idempotenz hängt am Schlüssel, nicht am Zufall', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 1)
    const kundin = `${intKennung('kundin')}@example.com`
    await prisma.user.create({
      data: { id: intKennung('user'), email: kundin, name: 'Erika Mustermann', role: 'CUSTOMER' },
    })

    const ohneSchluessel = () =>
      checkout(
        checkoutAnfrage({
          farm,
          sessionId: sitzung,
          customerEmail: kundin,
          positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
        })
      )

    expect((await ohneSchluessel()).status).toBe(200)
    // Der Checkout löscht die Halte der Sitzung (Schritt 10). Für die zweite
    // Bestellung braucht es einen neuen — wie im Browser, wo der Warenkorb ihn
    // beim nächsten Laden erneuert. Ohne Halt wäre die Antwort 409
    // RESERVIERUNG_ABGELAUFEN und der Test bewiese etwas anderes.
    await setzeHalt(produkt.id, sitzung, 1)
    expect((await ohneSchluessel()).status).toBe(200)

    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(2)
    expect(await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).toMatchObject({
      stock: 3,
    })
  })
})

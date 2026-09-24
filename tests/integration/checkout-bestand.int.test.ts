/**
 * Integrationstest 1 — Bestandsabzug unter Nebenläufigkeit.
 *
 * Die Aussage: `updateMany` mit `stock >= Menge` (src/app/api/checkout/route.ts,
 * Schritt 8) hält, wenn zwei Anfragen gleichzeitig auf dieselbe Zeile greifen.
 * Ein blindes `decrement` hätte den Bestand ins Minus gezogen — genau das ist
 * mit gemocktem Prisma NICHT prüfbar: Die Entscheidung fällt in Postgres, beim
 * erneuten Auswerten der WHERE-Bedingung nach der Zeilensperre.
 *
 * Geprüft wird deshalb nicht der Aufruf, sondern der ZUSTAND danach.
 *
 * DER ECHTE FALL: zwei gleichzeitige Anfragen DERSELBEN Sitzung ohne
 * Idempotenz-Schlüssel — Doppelklick, erneut gesendetes Formular, Wiederholung
 * auf wackeligem Netz. Zwei verschiedene Sitzungen bremst bereits die weiche
 * Reservierung (fremde Halte mindern, was eine Sitzung sieht); die harte Sperre
 * dahinter ist die, die hier bewiesen wird.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { sendOnsiteConfirmation } from '@/lib/email'
import { stripe } from '@/lib/stripe'
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

describe('POST /api/checkout — Bestandsabzug in der echten Datenbank', () => {
  it('lässt von zwei gleichzeitigen Bestellungen genau eine durch und zieht den Bestand nie ins Minus', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 1 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 1)

    // Wiederkehrende Kundin: Das Konto gibt es schon. Sonst legten beide
    // Anfragen gleichzeitig denselben Nutzer an — ein anderer Wettlauf, nicht
    // der, um den es hier geht.
    const kundin = `${intKennung('kundin')}@example.com`
    await prisma.user.create({
      data: { id: intKennung('user'), email: kundin, name: 'Erika Mustermann', role: 'CUSTOMER' },
    })

    const anfrage = () =>
      checkout(
        checkoutAnfrage({
          farm,
          sessionId: sitzung,
          customerEmail: kundin,
          positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
        })
      )

    const [a, b] = await Promise.all([anfrage(), anfrage()])
    const antworten = [a, b]

    const erfolge = antworten.filter((r) => r.status === 200)
    const abgelehnt = antworten.filter((r) => r.status === 409)
    expect(erfolge).toHaveLength(1)
    expect(abgelehnt).toHaveLength(1)

    // DEN PFAD FESTNAGELN. `WARENKORB_GEAENDERT` entsteht an zwei Stellen: in der
    // Vorprüfung (Schritt 3) und in der bedingten Buchung (Schritt 8). Nur der
    // Code zu prüfen ließe den Test auch grün, wenn Schritt 8 nie erreicht wurde
    // — dann bewiese er nicht, was er behauptet. Schritt 8 antwortet mit dem
    // Produktnamen und OHNE berichtigten Warenkorb; Schritt 3 schickt `items`
    // und `positionen` mit.
    const koerper = await abgelehnt[0]!.json()
    expect(koerper.code).toBe('WARENKORB_GEAENDERT')
    expect(koerper.error).toContain('wurde gerade von jemand anderem gekauft')
    expect(koerper.items).toBeUndefined()
    expect(koerper.positionen).toBeUndefined()

    // Nie ins Minus: genau eine Buchung, nicht zwei.
    const danach = await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })
    expect(danach.stock).toBe(0)

    const bestellungen = await prisma.order.findMany({
      where: { farmId: farm.id },
      include: { items: true },
    })
    expect(bestellungen).toHaveLength(1)
    expect(bestellungen[0]!.items).toHaveLength(1)
    expect(bestellungen[0]!.items[0]!.quantity).toBe(1)

    // Mail als Prüfstelle: genau eine Bestellung, genau eine Bestätigung. Der
    // Nachlauf läuft außerhalb des Requests (nach-der-antwort.ts) — deshalb
    // abwarten, statt sofort zu behaupten.
    await vi.waitFor(() => expect(sendOnsiteConfirmation).toHaveBeenCalledTimes(1))
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  it('bucht bei mehr gleichzeitigen Bestellungen als Ware exakt bis null ab', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 2 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 2)

    const kundin = `${intKennung('kundin')}@example.com`
    await prisma.user.create({
      data: { id: intKennung('user'), email: kundin, name: 'Erika Mustermann', role: 'CUSTOMER' },
    })

    const antworten = await Promise.all(
      Array.from({ length: 5 }, () =>
        checkout(
          checkoutAnfrage({
            farm,
            sessionId: sitzung,
            customerEmail: kundin,
            positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
          })
        )
      )
    )

    expect(antworten.filter((r) => r.status === 200)).toHaveLength(2)
    expect(antworten.filter((r) => r.status === 409)).toHaveLength(3)

    const danach = await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })
    expect(danach.stock).toBe(0)

    const bestellungen = await prisma.order.count({ where: { farmId: farm.id } })
    expect(bestellungen).toBe(2)

    // Zwei Bestellungen, zwei Bestätigungen — und abwarten, damit der Nachlauf
    // nicht noch liest, während afterEach aufräumt.
    await vi.waitFor(() => expect(sendOnsiteConfirmation).toHaveBeenCalledTimes(2))
  })

  it('gibt die schon gebuchte erste Position zurück, wenn die zweite im Wettlauf verloren geht', async () => {
    // Der Ausgleichsweg (gibBestandZurueck). Er ist nur unter echter
    // Nebenläufigkeit erreichbar: Die Warenkorbprüfung davor lässt beide
    // Anfragen passieren, danach gewinnt beim knappen Produkt genau eine. Die
    // Verliererin hat das reichliche Produkt bereits abgebucht — bliebe es
    // abgebucht, wäre Ware verschwunden, die nie verkauft wurde.
    const { farm } = await erstelleHof()
    const reichlich = await erstelleProdukt(farm.id, { stock: 10, name: 'Reichlich' })
    const knapp = await erstelleProdukt(farm.id, { stock: 1, name: 'Knapp' })
    const sitzung = intKennung('sitzung')
    await setzeHalt(reichlich.id, sitzung, 1)
    await setzeHalt(knapp.id, sitzung, 1)

    const kundin = `${intKennung('kundin')}@example.com`
    await prisma.user.create({
      data: { id: intKennung('user'), email: kundin, name: 'Erika Mustermann', role: 'CUSTOMER' },
    })

    const anfrage = () =>
      checkout(
        checkoutAnfrage({
          farm,
          sessionId: sitzung,
          customerEmail: kundin,
          positionen: [
            { productId: reichlich.id, name: 'Reichlich', quantity: 1, unitPrice: 10 },
            { productId: knapp.id, name: 'Knapp', quantity: 1, unitPrice: 10 },
          ],
        })
      )

    const antworten = await Promise.all([anfrage(), anfrage()])
    expect(antworten.filter((r) => r.status === 200)).toHaveLength(1)
    const abgelehnt = antworten.filter((r) => r.status === 409)
    expect(abgelehnt).toHaveLength(1)

    // Auch hier den Pfad festnageln: Die Verliererin muss an der BEDINGTEN
    // BUCHUNG der zweiten Position gescheitert sein — nur dann hat sie die erste
    // überhaupt gebucht und der Ausgleich ist das, was `stock: 9` erklärt.
    // Scheiterte sie schon in der Vorprüfung, stünde 9 auch ohne Ausgleich da.
    const koerper = await abgelehnt[0]!.json()
    expect(koerper.error).toContain('"Knapp" wurde gerade von jemand anderem gekauft')
    expect(koerper.positionen).toBeUndefined()

    // 10 − 1 verkauft = 9. Ohne Ausgleich stünde hier 8.
    expect(await prisma.product.findUniqueOrThrow({ where: { id: reichlich.id } })).toMatchObject({
      stock: 9,
    })
    expect(await prisma.product.findUniqueOrThrow({ where: { id: knapp.id } })).toMatchObject({
      stock: 0,
    })
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(1)
  })
})

/**
 * Integrationstest — Nr. 287: Vorrat und Bestellung in EINER Transaktion.
 *
 * Die Aussagen, in der echten Datenbank (Stripe und Mail gemockt):
 *  - Unteilbar: Solange die Bestellung an der Sperre ihres Abholfensters
 *    wartet, ist kein Vorrat gebucht und keine Bestellung da. Vor Nr. 287 war
 *    der Vorrat in diesem Augenblick schon abgebucht — bräche der Prozess dort
 *    ab, fehlte Ware ohne Bestellung, und kein Abgleich fände das.
 *  - Scheitert das Anlegen (gleiche Bestellnummer), bleibt der Vorrat aller
 *    Positionen unverändert — die Rückabwicklung macht die Datenbank.
 *  - Zwei Körbe mit denselben Produkten in umgekehrter Reihenfolge laufen nie
 *    in eine Verklemmung (feste Sperr-Reihenfolge nach `productId`).
 *  - Höchstzahl 1, zwei gleichzeitig: eine Bestellung, der Vorrat der
 *    Verliererin bleibt unverändert.
 *  - Bar: Der Token-Hash steht schon im Anlegen — ein drittes Schreiben gibt
 *    es nicht mehr, der Link aus der Mail bestätigt, „Erneut senden“ findet sie.
 *
 * Geprüft wird der ZUSTAND danach (TESTING_GUIDELINES §1). Der Nachlauf (Mail)
 * wird gesammelt und nur dort abgearbeitet, wo der Fall den Token braucht.
 * Die Datei berührt Better Auth nicht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
vi.mock('@/lib/email', () => ({
  sendOnsiteConfirmation: vi.fn(),
  sendOrderConfirmation: vi.fn(),
  sendOrderConfirmedToFarmer: vi.fn(),
}))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() } },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT:${ziel}`)
  }),
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { sendOnsiteConfirmation } from '@/lib/email'
import { bestellSignatur } from '@/lib/bestell-link'
import { BAR_LINK_ERNEUT_ANTWORT, barTokenHash } from '@/lib/bar-bestaetigung'
import { CODE_ABHOLFENSTER_VOLL } from '@/lib/abholfenster'
import { bestaetigeBarBestellung, sendeBarLinkErneut } from '@/server/actions/bar-bestaetigung'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt, type CheckoutPosition } from './setup/basis'

const mail = vi.mocked(sendOnsiteConfirmation)

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
})

afterEach(async () => {
  vi.restoreAllMocks()
  await raeumeAuf()
})

/** Den gesammelten Nachlauf nacheinander abarbeiten — ohne Pause, ohne Zeitgrenze (TESTING_GUIDELINES §3). */
async function arbeiteNachlaufAb(): Promise<void> {
  while (nachlauf.aufgaben.length > 0) await nachlauf.aufgaben.shift()?.()
}

/** Eine Bestellung mit eigener Sitzung und gültigen Halten für jede Position. */
async function anfrage(farm: { id: string; slug: string }, positionen: CheckoutPosition[], paymentMethod: 'ONSITE_CASH' | 'ONLINE' = 'ONSITE_CASH') {
  const sitzung = intKennung('sitzung')
  for (const p of positionen) await setzeHalt(p.productId, sitzung, p.quantity)
  return checkoutAnfrage({ farm, sessionId: sitzung, positionen, paymentMethod })
}

const position = (productId: string, quantity = 1): CheckoutPosition => ({ productId, name: 'Testprodukt', quantity, unitPrice: 10 })
const vorrat = async (id: string): Promise<number> => (await prisma.product.findUniqueOrThrow({ where: { id }, select: { stock: true } })).stock

/**
 * Wartet, bis eine Anfrage dieser Datenbank an einer Zeilensperre auf
 * „PickupSlot“ hängt — so weiß der Test, dass die Bestellung an der Sperre
 * steht und nicht noch davor rechnet.
 */
async function wartetAnSperre(): Promise<void> {
  const bis = Date.now() + 10_000
  while (Date.now() < bis) {
    const [{ n }] = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%PickupSlot%FOR UPDATE%'`
    if (n > 0) return
    await new Promise((weiter) => setTimeout(weiter, 25))
  }
  throw new Error('Die Bestellung kam nie an der Sperre des Abholfensters an')
}

describe('Kasse: Vorrat und Bestellung unteilbar (Nr. 287)', () => {
  it('solange die Bestellung an der Sperre des Fensters wartet, ist weder Vorrat gebucht noch eine Bestellung da', async () => {
    const { farm } = await erstelleHof()
    await prisma.pickupSlot.updateMany({ where: { farmId: farm.id }, data: { maxOrders: 5 } })
    const produkt = await erstelleProdukt(farm.id, { stock: 4 })
    const bestellung = await anfrage(farm, [position(produkt.id, 1)])

    let antwort: Promise<Response> | null = null
    // Die Sperre hält eine eigene Transaktion; gelesen wird über eine zweite Verbindung (prisma, nicht tx).
    const waehrendDerSperre = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "PickupSlot" WHERE "farmId" = ${farm.id} FOR UPDATE`
        antwort = checkout(bestellung)
        await wartetAnSperre()
        return { vorrat: await vorrat(produkt.id), bestellungen: await prisma.order.count({ where: { farmId: farm.id } }) }
      },
      { timeout: 20_000 }
    )
    const fertig = await antwort!  // Das ! ist sicher: Die Transaktion oben setzt `antwort`, bevor sie zurückkehrt.

    expect(waehrendDerSperre).toEqual({ vorrat: 4, bestellungen: 0 })
    expect(fertig.status).toBe(200)
    expect(await vorrat(produkt.id)).toBe(3)
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(1)
  }, 30_000)

  it('scheitert das Anlegen (dieselbe Bestellnummer), bleibt der Vorrat aller Positionen unverändert — 500, keine neue Bestellung', async () => {
    const { farm } = await erstelleHof()
    const a = await erstelleProdukt(farm.id, { stock: 5, name: 'A' })
    const b = await erstelleProdukt(farm.id, { stock: 5, name: 'B' })
    const erste = await anfrage(farm, [position(a.id, 1)])
    const zweite = await anfrage(farm, [position(a.id, 2), position(b.id, 3)])

    // Fester Zufall: Beide Bestellungen bekommen dieselbe Nummer, auch nach dem Neuwürfeln bei einer Kollision.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const ersteAntwort = await checkout(erste)
    const zweiteAntwort = await checkout(zweite)
    vi.mocked(Math.random).mockRestore()

    expect(ersteAntwort.status).toBe(200)
    expect(zweiteAntwort.status).toBe(500)
    expect(await vorrat(a.id)).toBe(4)
    expect(await vorrat(b.id)).toBe(5)
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(1)
  })

  it('zwei Körbe mit denselben Produkten in umgekehrter Reihenfolge: nie 500, der Vorrat stimmt mit den Bestellungen überein', async () => {
    const { farm } = await erstelleHof()
    const p1 = await erstelleProdukt(farm.id, { stock: 20, name: 'Eins' })
    const p2 = await erstelleProdukt(farm.id, { stock: 20, name: 'Zwei' })
    const anfragen = await Promise.all(
      Array.from({ length: 6 }, (_, i) => anfrage(farm, i % 2 === 0 ? [position(p1.id), position(p2.id)] : [position(p2.id), position(p1.id)]))
    )

    const antworten = await Promise.all(anfragen.map((a) => checkout(a)))

    const status = antworten.map((r) => r.status)
    expect(status.every((s) => s === 200 || s === 409), status.join(',')).toBe(true)
    const erfolge = status.filter((s) => s === 200).length
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(erfolge)
    expect(await vorrat(p1.id)).toBe(20 - erfolge)
    expect(await vorrat(p2.id)).toBe(20 - erfolge)
  }, 30_000)

  it('Fenster mit Höchstzahl 1, zwei gleichzeitig: eine Bestellung, der Vorrat der Verliererin bleibt unverändert', async () => {
    const { farm } = await erstelleHof()
    await prisma.pickupSlot.updateMany({ where: { farmId: farm.id }, data: { maxOrders: 1 } })
    const pa = await erstelleProdukt(farm.id, { stock: 5, name: 'Für A' })
    const pb = await erstelleProdukt(farm.id, { stock: 5, name: 'Für B' })
    const [anfrageA, anfrageB] = await Promise.all([anfrage(farm, [position(pa.id, 2)]), anfrage(farm, [position(pb.id, 3)])])

    const [a, b] = await Promise.all([checkout(anfrageA), checkout(anfrageB)])

    expect([a.status, b.status].sort()).toEqual([200, 409])
    const verliererin = a.status === 409 ? a : b
    expect((await verliererin.json()).code).toBe(CODE_ABHOLFENSTER_VOLL)
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(1)
    // Genau die Ware der Gewinnerin ist weg, die der Verliererin vollständig da.
    expect([await vorrat(pa.id), await vorrat(pb.id)]).toEqual(a.status === 200 ? [3, 5] : [5, 2])
  })
})

describe('Kasse: Bar-Token im Anlegen (Nr. 287)', () => {
  it('die neue Barbestellung trägt sofort den Token-Hash — ohne weiteres Schreiben; der Link bestätigt, „Erneut senden“ findet sie', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    const bestellung = await anfrage(farm, [position(produkt.id, 1)])
    // Ein nachträgliches order.update scheiterte früher mit 500 — Bestellung ohne Token und ohne Mail.
    const nachtraeglich = vi.spyOn(prisma.order, 'update').mockRejectedValue(new Error('update gesperrt'))

    const antwort = await checkout(bestellung)
    nachtraeglich.mockRestore()

    expect(antwort.status).toBe(200)
    expect(nachtraeglich).not.toHaveBeenCalled()
    const { orderId } = (await antwort.json()) as { orderId: string }
    const gespeichert = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { confirmationToken: true } })
    await arbeiteNachlaufAb()
    expect(mail).toHaveBeenCalledTimes(1)
    const token = mail.mock.calls[0]![1]  // Das ! ist sicher: genau ein Aufruf, oben geprüft.
    expect(gespeichert.confirmationToken).toBe(barTokenHash(token))

    // „Erneut senden“ findet sie (verlangt einen Token) und schickt einen neuen Link.
    const erneut = new FormData()
    erneut.set('orderId', orderId)
    erneut.set('sig', bestellSignatur(orderId))
    expect(await sendeBarLinkErneut({}, erneut)).toEqual({ antwort: BAR_LINK_ERNEUT_ANTWORT })
    await arbeiteNachlaufAb()
    expect(mail).toHaveBeenCalledTimes(2)
    const neu = mail.mock.calls[1]![1]  // Das ! ist sicher: zwei Aufrufe, oben geprüft.

    const formular = new FormData()
    formular.set('token', neu)
    await expect(bestaetigeBarBestellung({}, formular)).rejects.toThrow(/REDIRECT:.*\/confirm\//)
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } })).toEqual({ status: 'CONFIRMED' })
  })
})

/**
 * Vorrat direkt ändern (Nachtlauf Nr. 18) gegen ein ECHTES Postgres.
 *
 * Die Aussage: setzeVorrat setzt nur, wenn die Zeile noch den Vorrat hält,
 * den der Hof gesehen hat. Ein Setzen überschreibt nie eine Buchung des
 * Checkouts (verlorenes Update) — mit gemocktem Prisma nicht prüfbar, die
 * Entscheidung fällt in Postgres beim erneuten Auswerten der WHERE-Bedingung
 * nach der Zeilensperre. Geprüft wird der ZUSTAND danach, in jeder
 * Verschränkung (TESTING_GUIDELINES §1).
 *
 * Dazu: fremder Hof und ungültige Werte ändern nichts; der Bearbeiten-Dialog
 * (updateProduct) speichert mit veraltetem Vorrat nichts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))

import { headers } from 'next/headers'
import { setzeVorrat, updateProduct } from '@/server/actions/products'
import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { checkoutAnfrage, erstelleHof, erstelleHofMitAnmeldung, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

async function angemeldeterHof() {
  // Mit Abholfenster an jedem Tag (wie erstelleHof) — sonst lehnt der Checkout ab, bevor es um Bestand geht.
  const { farm, cookie } = await erstelleHofMitAnmeldung({
    pickupSlots: { create: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '15:00', endTime: '18:00' })) },
  })
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return farm
}

/**
 * Die Reihenfolge erzwingen: Eine Transaktion bucht 2 ab wie der Checkout
 * (`updateMany` mit `stock >= 2`) und hält die Zeilensperre. Erst wenn das
 * Schreiben von `zweites` nachweislich auf diese Sperre wartet (pg_locks,
 * nicht gewährt), wird committet. `wartete` belegt, dass es vor dem Commit
 * noch nicht fertig war.
 */
async function mitOffenerBuchung<T>(productId: string, zweites: () => Promise<T>): Promise<{ gesetzt: Promise<T>; wartete: boolean }> {
  let gesetzt: Promise<T> | null = null
  let fertig = false
  await prisma.$transaction(
    async (tx) => {
      const { count } = await tx.product.updateMany({ where: { id: productId, stock: { gte: 2 } }, data: { stock: { decrement: 2 } } })
      if (count !== 1) throw new Error('Buchung in der Transaktion fehlgeschlagen')
      gesetzt = zweites().finally(() => {
        fertig = true
      })
      for (let i = 0; i < 100; i++) {
        const [{ wartend }] = await prisma.$queryRaw<{ wartend: bigint }[]>`select count(*) as wartend from pg_locks where not granted`
        if (Number(wartend) > 0) break
        await new Promise((r) => setTimeout(r, 50))
      }
    },
    { timeout: 15_000 }
  )
  const wartete = !fertig
  if (!gesetzt) throw new Error('zweiter Schritt nicht gestartet')
  return { gesetzt, wartete }
}

const vorrat = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id }, select: { stock: true } })).stock

describe('setzeVorrat — bedingt in der echten Datenbank', () => {
  it('setzt, wenn der Vorrat noch stimmt, und meldet 0 → mehr als „wieder da"', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 0 })

    expect(await setzeVorrat({ productId: produkt.id, vorher: 0, neu: 12 })).toEqual({ ok: true, vorrat: 12, wiederDa: true })
    expect(await vorrat(produkt.id)).toBe(12)
  })

  it('ein veralteter Stand schreibt nichts und liefert den aktuellen', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 4 })

    const ergebnis = await setzeVorrat({ productId: produkt.id, vorher: 7, neu: 20 })

    expect(ergebnis).toMatchObject({ code: 'GEAENDERT', vorrat: 4 })
    expect(await vorrat(produkt.id)).toBe(4)
  })

  it('gleichzeitig mit einer Bestellung: die Bestellung geht nie verloren', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5, price: 4.5 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 2)

    // Der Hof hat 5 gesehen und setzt 8 — zur selben Zeit kauft eine Kundin 2.
    const [gesetzt, antwort] = await Promise.all([
      setzeVorrat({ productId: produkt.id, vorher: 5, neu: 8 }),
      checkout(
        checkoutAnfrage({
          farm,
          sessionId: sitzung,
          positionen: [{ productId: produkt.id, name: produkt.name, quantity: 2, unitPrice: 4.5 }],
        })
      ),
    ])

    expect(antwort.status, JSON.stringify(await antwort.clone().json())).toBe(200)
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(1)
    const danach = await vorrat(produkt.id)
    // Zwei gültige Ausgänge, nie 8 (das hieße: die 2 verkauften stünden wieder im Shop).
    if ('ok' in gesetzt) {
      expect(danach).toBe(6)
    } else {
      expect(gesetzt).toMatchObject({ code: 'GEAENDERT', vorrat: 3 })
      expect(danach).toBe(3)
    }
  })

  it('Reihenfolge erzwungen: Buchung hält die Zeile, setzeVorrat wartet und setzt danach NICHT', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })

    const { gesetzt, wartete } = await mitOffenerBuchung(produkt.id, () => setzeVorrat({ productId: produkt.id, vorher: 5, neu: 8 }))

    expect(wartete).toBe(true)
    expect(await gesetzt).toMatchObject({ code: 'GEAENDERT', vorrat: 3 })
    expect(await vorrat(produkt.id)).toBe(3)
  })

  it('Gegenprobe: dieselbe Abfolge mit blindem Setzen (lesen, dann schreiben) verliert die Buchung', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })

    // So arbeitete das alte updateStock: Stand lesen, neuen Wert ohne Bedingung schreiben.
    const gelesen = await vorrat(produkt.id)
    const { gesetzt, wartete } = await mitOffenerBuchung(produkt.id, () =>
      prisma.product.update({ where: { id: produkt.id }, data: { stock: gelesen + 3 } })
    )
    await gesetzt

    expect(wartete).toBe(true)
    // 8 statt 6: Die 2 verkauften stehen wieder im Shop — genau das verhindert setzeVorrat.
    expect(await vorrat(produkt.id)).toBe(8)
  })

  it('zwei gleichzeitige Änderungen mit demselben Stand: genau eine gewinnt', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 3 })

    const ergebnisse = await Promise.all([
      setzeVorrat({ productId: produkt.id, vorher: 3, neu: 10 }),
      setzeVorrat({ productId: produkt.id, vorher: 3, neu: 1 }),
    ])

    const gewonnen = ergebnisse.filter((e) => 'ok' in e)
    expect(gewonnen).toHaveLength(1)
    expect(await vorrat(produkt.id)).toBe('ok' in ergebnisse[0] ? 10 : 1)
  })

  it('das Produkt eines fremden Hofs bleibt unberührt und ohne Auskunft', async () => {
    await angemeldeterHof()
    const { farm: fremd } = await erstelleHof()
    const produkt = await erstelleProdukt(fremd.id, { stock: 9 })

    expect(await setzeVorrat({ productId: produkt.id, vorher: 9, neu: 0 })).toEqual({ error: 'Produkt nicht gefunden.' })
    expect(await vorrat(produkt.id)).toBe(9)
  })

  it('negative und gebrochene Werte ändern nichts', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 9 })

    for (const neu of [-1, 2.5]) {
      expect('error' in (await setzeVorrat({ productId: produkt.id, vorher: 9, neu }))).toBe(true)
    }
    expect(await vorrat(produkt.id)).toBe(9)
  })
})

describe('updateProduct — der Dialog überschreibt keine Bestellung', () => {
  const formular = (stock: number) => ({ name: 'Neuer Name', price: 10, unit: 'STUECK', category: 'EIER', subcategory: null, labels: [], stock })

  it('unveränderter Vorrat bleibt, wie die Datenbank ihn hat (auch nach einer Bestellung)', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    // Während der Dialog offen ist, bucht eine Bestellung 2 ab.
    await prisma.product.update({ where: { id: produkt.id }, data: { stock: 3 } })

    expect(await updateProduct(produkt.id, formular(5) as never, 5)).toEqual({ ok: true })
    const danach = await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })
    expect(danach.name).toBe('Neuer Name')
    expect(danach.stock).toBe(3)
  })

  it('geänderter Vorrat auf veraltetem Stand: nichts gespeichert, Meldung mit dem aktuellen Stand', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5, name: 'Alter Name' })
    await prisma.product.update({ where: { id: produkt.id }, data: { stock: 3 } })

    const ergebnis = await updateProduct(produkt.id, formular(12) as never, 5)

    expect('error' in ergebnis && ergebnis.error).toContain('3')
    const danach = await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })
    expect(danach).toMatchObject({ name: 'Alter Name', stock: 3 })
  })
})

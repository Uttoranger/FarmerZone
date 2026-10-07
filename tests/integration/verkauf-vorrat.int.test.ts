/**
 * Direktverkauf senkt den Vorrat (Register D1, Nachtlauf Nr. 39) gegen ein
 * ECHTES Postgres.
 *
 * Die Aussage: „Verkauf eintragen" mit Produkt und Schalter „Vorrat abziehen"
 * senkt den Vorrat bedingt — nie unter 0, auch wenn zwei Buchungen
 * gleichzeitig kommen (die Entscheidung fällt in Postgres beim erneuten
 * Auswerten der WHERE-Bedingung nach der Zeilensperre; mit gemocktem Prisma
 * nicht prüfbar). Reicht der Vorrat nicht, ist der Verkauf trotzdem gebucht
 * und der Vorrat steht auf 0. Geprüft wird der Zustand danach.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { headers } from 'next/headers'
import { createManualSale } from '@/server/actions/manual-sales'
import { prisma } from '@/lib/prisma'
import { wienKalendertag } from '@/lib/kalender'
import { VORRAT_ZU_KLEIN } from '@/lib/verkauf-eintragen'
import { erstelleHofMitAnmeldung, erstelleProdukt, raeumeAuf, INT_PRAEFIX } from './setup/basis'

afterEach(async () => {
  await prisma.manualSale.deleteMany({ where: { farm: { slug: { startsWith: INT_PRAEFIX } } } })
  await raeumeAuf()
})

async function angemeldeterHof() {
  const { farm, cookie } = await erstelleHofMitAnmeldung()
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return farm
}

const heute = () => wienKalendertag(new Date())
const verkauf = (productId: string, teil: object = {}) => ({ totalAmount: 9, channel: 'MARKT', saleDate: heute(), productId, vorratAbziehen: true, ...teil })
const vorrat = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id }, select: { stock: true } })).stock

describe('Verkauf eintragen zieht den Vorrat ab — echte Datenbank', () => {
  it('genug Vorrat: abgezogen, Verkauf gespeichert, neuer Stand im Hinweis', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 7 })

    const antwort = await createManualSale(verkauf(produkt.id, { quantity: 3 }))

    expect(antwort).toEqual({ ok: true, vorrat: { text: 'Verkauf eingetragen. Vorrat jetzt: 4 Stück.', knapp: false } })
    expect(await vorrat(produkt.id)).toBe(4)
    expect(await prisma.manualSale.count({ where: { farmId: farm.id, productId: produkt.id } })).toBe(1)
  })

  it('gebrochene Menge zieht aufgerundet ab — der Vorrat zählt ganze Gebinde', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 7 })
    await createManualSale(verkauf(produkt.id, { quantity: 2.5 }))
    expect(await vorrat(produkt.id)).toBe(4)
  })

  it('zu wenig Vorrat: Verkauf gebucht, Vorrat auf 0, nie darunter, Hinweis', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 2 })

    const antwort = await createManualSale(verkauf(produkt.id, { quantity: 5 }))

    expect(antwort).toEqual({ ok: true, vorrat: { text: VORRAT_ZU_KLEIN, knapp: true } })
    expect(await vorrat(produkt.id)).toBe(0)
    const [gebucht] = await prisma.manualSale.findMany({ where: { farmId: farm.id } })
    expect(gebucht.quantity.toString()).toBe('5')
    expect(gebucht.totalAmount.toString()).toBe('9')
  })

  it('Schalter aus: Verkauf gebucht, Vorrat unverändert', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 7 })

    expect(await createManualSale(verkauf(produkt.id, { quantity: 3, vorratAbziehen: false }))).toEqual({ ok: true })
    expect(await vorrat(produkt.id)).toBe(7)
    expect(await prisma.manualSale.count({ where: { farmId: farm.id } })).toBe(1)
  })

  it('fremdes Produkt: abgelehnt, kein Verkauf, fremder Vorrat unberührt', async () => {
    const fremderHof = await angemeldeterHof()
    const fremdesProdukt = await erstelleProdukt(fremderHof.id, { stock: 7 })
    const eigener = await angemeldeterHof() // ab jetzt ist dieser Hof angemeldet

    expect(await createManualSale(verkauf(fremdesProdukt.id, { quantity: 3 }))).toHaveProperty('error')
    expect(await vorrat(fremdesProdukt.id)).toBe(7)
    expect(await prisma.manualSale.count({ where: { farmId: { in: [eigener.id, fremderHof.id] } } })).toBe(0)
  })

  it('zwei Buchungen gleichzeitig: beide gebucht, Vorrat nie negativ', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })

    const antworten = await Promise.all([
      createManualSale(verkauf(produkt.id, { quantity: 3 })),
      createManualSale(verkauf(produkt.id, { quantity: 3 })),
    ])

    expect(antworten.every((a) => 'ok' in a)).toBe(true)
    expect(await vorrat(produkt.id)).toBe(0)
    expect(await prisma.manualSale.count({ where: { farmId: farm.id } })).toBe(2)
    // Genau eine der beiden fand genug Vorrat, die andere meldet den Hinweis.
    const knapp = antworten.filter((a) => 'vorrat' in a && a.vorrat?.knapp)
    expect(knapp).toHaveLength(1)
  })

  it('erzwungene Verschränkung: eine Bestellung hält die Zeile, der Verkauf wartet und sieht danach den neuen Stand', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })

    // Wie der Checkout: bedingt 2 abbuchen und die Zeilensperre halten, bis
    // der Verkauf nachweislich darauf wartet (pg_locks, nicht gewährt).
    let gebucht: ReturnType<typeof createManualSale> | null = null
    let fertig = false
    await prisma.$transaction(
      async (tx) => {
        const { count } = await tx.product.updateMany({ where: { id: produkt.id, stock: { gte: 2 } }, data: { stock: { decrement: 2 } } })
        if (count !== 1) throw new Error('Buchung in der Transaktion fehlgeschlagen')
        gebucht = createManualSale(verkauf(produkt.id, { quantity: 4 })).finally(() => {
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
    expect(fertig).toBe(false)
    if (!gebucht) throw new Error('Verkauf nicht gestartet')

    // Vor der Sperre 5 (hätte gereicht), danach 3 (reicht nicht): auf 0, nicht -1.
    expect(await gebucht).toEqual({ ok: true, vorrat: { text: VORRAT_ZU_KLEIN, knapp: true } })
    expect(await vorrat(produkt.id)).toBe(0)
  })

  it('viele Buchungen gleichzeitig: Vorrat nie negativ, jede Buchung gespeichert', async () => {
    const farm = await angemeldeterHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 10 })

    const antworten = await Promise.all(Array.from({ length: 6 }, () => createManualSale(verkauf(produkt.id, { quantity: 2 }))))

    expect(antworten.every((a) => 'ok' in a)).toBe(true)
    expect(await vorrat(produkt.id)).toBe(0)
    expect(await prisma.manualSale.count({ where: { farmId: farm.id } })).toBe(6)
    // 10 reicht für fünf Buchungen zu 2 — die sechste findet 0.
    expect(antworten.filter((a) => 'vorrat' in a && a.vorrat?.knapp)).toHaveLength(1)
  })
})

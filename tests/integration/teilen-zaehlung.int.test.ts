/**
 * Integrationstest — Teilen-Zählung (Gate 7, Nr. 21; S8) in der echten Datenbank.
 *
 * Die Aussage ist der ZUSTAND danach:
 *  - Eine Bestellung mit gültigem Kürzel trägt den Kanal (`Order.teilenKanal`)
 *    und zählt als Bestellung im Aggregat des Tages — als Nachlauf.
 *  - Ein ungültiges oder fehlendes Kürzel lässt die Bestellung NIE scheitern:
 *    Sie steht, der Kanal ist null, gezählt wird nichts.
 *  - Gleichzeitige Besuche zählen atomar: 25 parallele Aufrufe = 25 Besuche
 *    in EINER Zeile (eindeutiger Index Hof/Kanal/Tag).
 *  - Besuche zählen nur bei öffentlichen Höfen.
 *  - Die Abfrage für die Auswertung (22c) liefert nur Summen dieses Hofs im
 *    Zeitraum.
 * Mail und Stripe sind gemockt; bar bei Abholung braucht Stripe nicht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { teilenTag } from '@/lib/teilen-kanal'
import { zaehleBesuchFuerSlug, zaehleTeilenBesuch } from '@/server/teilen-zaehlung'
import { getTeilenWirkung } from '@/server/queries/teilen-wirkung'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await raeumeAuf()
})

async function bestelle(farm: { id: string; slug: string }, produktId: string, zusatz: Record<string, unknown>): Promise<Response> {
  const sitzung = intKennung('sitzung')
  await setzeHalt(produktId, sitzung, 1)
  return checkout(
    checkoutAnfrage({
      farm,
      sessionId: sitzung,
      positionen: [{ productId: produktId, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
      zusatz,
    })
  )
}

/** Der Nachlauf läuft im Test ohne Request-Kontext sofort an, aber nicht synchron — kurz warten. */
async function warteAuf<T>(lies: () => Promise<T>, fertig: (wert: T) => boolean): Promise<T> {
  let wert = await lies()
  for (let i = 0; i < 50 && !fertig(wert); i++) {
    await new Promise((r) => setTimeout(r, 20))
    wert = await lies()
  }
  return wert
}

describe('Checkout mit Teilen-Kanal', () => {
  it('gültiges Kürzel: Bestellung trägt den Kanal und zählt im Aggregat des Tages', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })

    const res = await bestelle(farm, produkt.id, { teilenKanal: 'wa' })

    expect(res.status).toBe(200)
    const bestellung = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })
    expect(bestellung.teilenKanal).toBe('WHATSAPP')
    const zeile = await warteAuf(
      () => prisma.teilenAufruf.findFirst({ where: { farmId: farm.id } }),
      (z) => z !== null
    )
    expect(zeile).toMatchObject({ kanal: 'WHATSAPP', besuche: 0, bestellungen: 1 })
    expect(zeile?.tag.toISOString()).toBe(teilenTag(bestellung.createdAt).toISOString())
  })

  it.each([
    ['unbekanntes Kürzel', { teilenKanal: 'tiktok' }],
    ['falscher Typ', { teilenKanal: 42 }],
    ['Großschreibung', { teilenKanal: 'WA' }],
    ['ohne Kürzel', {}],
  ])('%s: Bestellung steht trotzdem, Kanal null, nichts gezählt', async (_fall, zusatz) => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })

    const res = await bestelle(farm, produkt.id, zusatz)

    expect(res.status).toBe(200)
    const bestellung = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })
    expect(bestellung.teilenKanal).toBeNull()
    await new Promise((r) => setTimeout(r, 100))
    expect(await prisma.teilenAufruf.count({ where: { farmId: farm.id } })).toBe(0)
  })
})

describe('Besuche zählen', () => {
  it('25 gleichzeitige Besuche ergeben 25 in EINER Zeile', async () => {
    const { farm } = await erstelleHof()
    const jetzt = new Date()

    await Promise.all(Array.from({ length: 25 }, () => zaehleTeilenBesuch(farm.id, 'QR', jetzt)))

    const zeilen = await prisma.teilenAufruf.findMany({ where: { farmId: farm.id } })
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0]).toMatchObject({ kanal: 'QR', besuche: 25, bestellungen: 0 })
  })

  it('nur öffentliche Höfe: nicht freigeschaltet oder stillgelegt zählt nicht', async () => {
    const { farm: offen } = await erstelleHof()
    const { farm: wartet } = await erstelleHof({ approvedAt: null })
    const { farm: still } = await erstelleHof({ archivedAt: new Date() })

    expect(await zaehleBesuchFuerSlug(offen.slug, 'LINK')).toBe(true)
    expect(await zaehleBesuchFuerSlug(wartet.slug, 'LINK')).toBe(false)
    expect(await zaehleBesuchFuerSlug(still.slug, 'LINK')).toBe(false)
    expect(await zaehleBesuchFuerSlug('int-gibt-es-nicht', 'LINK')).toBe(false)

    expect(await prisma.teilenAufruf.count({ where: { farmId: offen.id } })).toBe(1)
    expect(await prisma.teilenAufruf.count({ where: { farmId: { in: [wartet.id, still.id] } } })).toBe(0)
  })
})

describe('getTeilenWirkung — die Abfrage für die Auswertung (22c)', () => {
  it('summiert je Kanal nur diesen Hof und nur Tage im Zeitraum', async () => {
    const { farm } = await erstelleHof()
    const { farm: fremd } = await erstelleHof()
    const tag = (t: string) => new Date(`${t}T00:00:00.000Z`)
    await prisma.teilenAufruf.createMany({
      data: [
        { farmId: farm.id, kanal: 'WHATSAPP', tag: tag('2026-10-01'), besuche: 10, bestellungen: 2 },
        { farmId: farm.id, kanal: 'WHATSAPP', tag: tag('2026-10-05'), besuche: 4, bestellungen: 1 },
        { farmId: farm.id, kanal: 'QR', tag: tag('2026-10-07'), besuche: 3, bestellungen: 0 },
        // Außerhalb des Zeitraums:
        { farmId: farm.id, kanal: 'FACEBOOK', tag: tag('2026-09-30'), besuche: 99, bestellungen: 9 },
        // Fremder Hof:
        { farmId: fremd.id, kanal: 'WHATSAPP', tag: tag('2026-10-03'), besuche: 50, bestellungen: 5 },
      ],
    })

    const wirkung = await getTeilenWirkung(farm.id, { von: '2026-10-01', bis: '2026-10-07' })

    expect(wirkung.besuche).toBe(17)
    expect(wirkung.bestellungen).toBe(3)
    expect(wirkung.kanaele).toEqual([
      { kanal: 'WHATSAPP', name: 'WhatsApp', besuche: 14, bestellungen: 3 },
      { kanal: 'QR', name: 'Plakat (QR-Code)', besuche: 3, bestellungen: 0 },
    ])
  })

  it('ohne Zeilen: alles null, keine Kanäle', async () => {
    const { farm } = await erstelleHof()
    expect(await getTeilenWirkung(farm.id, { von: '2026-10-01', bis: '2026-10-31' })).toEqual({
      besuche: 0,
      bestellungen: 0,
      kanaele: [],
    })
  })
})

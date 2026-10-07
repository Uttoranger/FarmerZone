/**
 * Integrationstest — Teilen-Zählung (Gate 7, Nr. 21; S8) in der echten Datenbank.
 *
 * Die Aussage ist der ZUSTAND danach:
 *  - Seit Nr. 25 (Register T1) bekommt keine Bestellung einen Kanal: Auch ein
 *    Checkout aus einem alten Tab, der noch ein Kürzel mitschickt, steht,
 *    `Order.teilenKanal` bleibt null, und im Aggregat zählt nichts. Die
 *    Spalten bleiben (Expand/Contract), werden aber nicht mehr beschrieben.
 *  - Ein Besuch über den Link zählt genau einmal (Route POST /api/teilen/besuch).
 *  - Gleichzeitige Besuche zählen atomar: 25 parallele Aufrufe = 25 Besuche
 *    in EINER Zeile (eindeutiger Index Hof/Kanal/Tag).
 *  - Besuche zählen nur bei öffentlichen Höfen.
 *  - Die Abfrage für die Auswertung (22c) liefert nur Besuche dieses Hofs im
 *    Zeitraum — Bestellzahlen alter Zeilen kommen nicht mehr heraus.
 * Mail und Stripe sind gemockt; bar bei Abholung braucht Stripe nicht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))

import { NextRequest } from 'next/server'
import { POST as checkout } from '@/app/api/checkout/route'
import { POST as besuch } from '@/app/api/teilen/besuch/route'
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

describe('Checkout ohne Teilen-Kanal (T1)', () => {
  it.each([
    ['gültiges Kürzel aus einem alten Tab', { teilenKanal: 'wa' }],
    ['unbekanntes Kürzel', { teilenKanal: 'tiktok' }],
    ['falscher Typ', { teilenKanal: 42 }],
    ['ohne Kürzel', {}],
  ])('%s: Bestellung steht, Kanal null, nichts gezählt', async (_fall, zusatz) => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })

    const res = await bestelle(farm, produkt.id, zusatz)

    expect(res.status).toBe(200)
    const bestellung = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })
    expect(bestellung.teilenKanal).toBeNull()
    // Der Bestand ist gebucht wie bei jeder Bestellung — der Geldpfad ist unberührt.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).stock).toBe(4)
    // Früher zählte ein Nachlauf die Bestellung — kurz warten, damit ein
    // verirrter Nachlauf auffiele.
    await new Promise((r) => setTimeout(r, 100))
    expect(await prisma.teilenAufruf.count({ where: { farmId: farm.id } })).toBe(0)
  })
})

describe('Besuch über die Route', () => {
  it('ein Aufruf über ?k=wa zählt genau einen Besuch, keine Bestellung', async () => {
    const { farm } = await erstelleHof()
    const anfrage = new NextRequest('http://localhost/api/teilen/besuch', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1',
      },
      body: JSON.stringify({ farmSlug: farm.slug, kanal: 'wa' }),
    })

    expect((await besuch(anfrage)).status).toBe(200)

    const zeilen = await prisma.teilenAufruf.findMany({ where: { farmId: farm.id } })
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0]).toMatchObject({ kanal: 'WHATSAPP', besuche: 1, bestellungen: 0 })
    expect(zeilen[0].tag.toISOString()).toBe(teilenTag(new Date()).toISOString())
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
  it('summiert Besuche je Kanal nur dieses Hofs und nur Tage im Zeitraum; alte Bestellzahlen bleiben draußen', async () => {
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

    expect(wirkung).toEqual({
      besuche: 17,
      kanaele: [
        { kanal: 'WHATSAPP', name: 'WhatsApp', besuche: 14 },
        { kanal: 'QR', name: 'Plakat (QR-Code)', besuche: 3 },
      ],
    })
  })

  it('ohne Zeilen: alles null, keine Kanäle', async () => {
    const { farm } = await erstelleHof()
    expect(await getTeilenWirkung(farm.id, { von: '2026-10-01', bis: '2026-10-31' })).toEqual({
      besuche: 0,
      kanaele: [],
    })
  })
})

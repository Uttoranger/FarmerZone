/**
 * /api/warenkorb/pruefen mit der Prüfkette der Höfe (Nr. 165, Register N24
 * Ergänzung 24.10.2026) gegen ein ECHTES Postgres — die Halte in
 * `StockReservation` sind die Aussage.
 *
 * Beweist:
 *  - Ein Korb aus der Zeit vor der Pause: Nach dem Pausieren erneuert die Route
 *    keinen Halt mehr, löscht den Halt der Sitzung bei diesem Hof und nennt die
 *    Pause in der Meldung. Gegenprobe: derselbe Korb vor dem Pausieren behält
 *    seinen Halt mit neuer Frist.
 *  - Gemischter Korb: Der Halt beim bestellbaren Hof bleibt und wird erneuert,
 *    nur der beim stillgelegten Hof fällt; fremde Sitzungen bleiben unberührt.
 *  - Halt bei einem gesperrten Hof ohne mitgeschickte Position: Hält die Sitzung
 *    dort noch ein Produkt, das der Korb nicht mehr mitschickt, fällt auch
 *    dieser Halt (N24: „die Halte der Sitzung bei diesem Hof“). Gegenprobe: ein
 *    solcher Halt bei einem bestellbaren Hof bleibt.
 *
 * Alles trägt das Präfix int- (raeumeAuf). Die Uhr bleibt echt (geteilte
 * Test-DB); jeder Hof bietet an jedem Tag ein Fenster an (erstelleHof).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/warenkorb/pruefen/route'
import { SHOP_PAUSED_MESSAGE } from '@/lib/shop-pause'
import { FARM_ARCHIVED_MESSAGE } from '@/lib/farm-archive'
import { erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

function pruefen(sessionId: string, items: { productId: string; quantity: number }[]): Promise<Response> {
  return POST(
    new NextRequest('http://localhost/api/warenkorb/pruefen', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, items }),
    })
  )
}

function halteVon(sessionId: string) {
  return prisma.stockReservation.findMany({ where: { sessionId }, orderBy: { productId: 'asc' } })
}

describe('/api/warenkorb/pruefen — Prüfkette der Höfe gegen echte Halte', () => {
  it('pausierter Hof: kein Halt erneuert, der Halt der Sitzung gelöscht, Pause in der Meldung', async () => {
    const { farm } = await erstelleHof()
    const eier = await erstelleProdukt(farm.id, { stock: 10 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(eier.id, sitzung, 2)

    // Gegenprobe vorher: bestellbar — der Halt bleibt und bekommt eine neue Frist.
    const vorher = await (await pruefen(sitzung, [{ productId: eier.id, quantity: 2 }])).json()
    expect(vorher.meldung).toBeNull()
    expect(vorher.reserviertBis).not.toBeNull()
    expect(await halteVon(sitzung)).toHaveLength(1)

    await prisma.farm.update({ where: { id: farm.id }, data: { isPaused: true } })

    const res = await pruefen(sitzung, [{ productId: eier.id, quantity: 2 }])
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.meldung).toContain(SHOP_PAUSED_MESSAGE)
    expect(body.items).toEqual([])
    expect(body.reserviertBis).toBeNull()
    expect(await halteVon(sitzung)).toEqual([])
  })

  it('gemischter Korb: nur der Halt beim stillgelegten Hof fällt, fremde Sitzungen bleiben', async () => {
    const { farm: offen } = await erstelleHof()
    const { farm: still } = await erstelleHof({ archivedAt: new Date() })
    const milch = await erstelleProdukt(offen.id, { stock: 10 })
    const eier = await erstelleProdukt(still.id, { stock: 10 })
    const sitzung = intKennung('sitzung')
    const fremd = intKennung('sitzung')
    await setzeHalt(milch.id, sitzung, 1)
    await setzeHalt(eier.id, sitzung, 2)
    await setzeHalt(eier.id, fremd, 1)

    const body = await (
      await pruefen(sitzung, [
        { productId: milch.id, quantity: 1 },
        { productId: eier.id, quantity: 2 },
      ])
    ).json()

    expect(body.meldung).toContain(FARM_ARCHIVED_MESSAGE)
    expect(body.items).toEqual([{ productId: milch.id, quantity: 1 }])
    const eigene = await halteVon(sitzung)
    expect(eigene.map((h) => h.productId)).toEqual([milch.id])
    expect(eigene[0].expiresAt.getTime()).toBe(new Date(body.reserviertBis).getTime())
    // Die Route fasst keine fremde Sitzung an — auch nicht beim gesperrten Hof.
    expect(await halteVon(fremd)).toHaveLength(1)
  })

  it('gesperrter Hof: auch der Halt ohne mitgeschickte Position fällt', async () => {
    const { farm } = await erstelleHof({ isPaused: true })
    const eier = await erstelleProdukt(farm.id, { stock: 10 })
    const kaese = await erstelleProdukt(farm.id, { stock: 10 })
    const sitzung = intKennung('sitzung')
    const fremd = intKennung('sitzung')
    await setzeHalt(eier.id, sitzung, 2)
    // Käse steht nicht mehr im mitgeschickten Korb, der Halt der Sitzung hält ihn aber noch.
    await setzeHalt(kaese.id, sitzung, 1)
    await setzeHalt(kaese.id, fremd, 1)

    const body = await (await pruefen(sitzung, [{ productId: eier.id, quantity: 2 }])).json()

    expect(body.meldung).toContain(SHOP_PAUSED_MESSAGE)
    expect(await halteVon(sitzung)).toEqual([])
    expect(await halteVon(fremd)).toHaveLength(1)
  })

  it('Gegenprobe: bei einem bestellbaren Hof bleibt der Halt ohne mitgeschickte Position', async () => {
    const { farm } = await erstelleHof()
    const eier = await erstelleProdukt(farm.id, { stock: 10 })
    const kaese = await erstelleProdukt(farm.id, { stock: 10 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(eier.id, sitzung, 2)
    await setzeHalt(kaese.id, sitzung, 1)

    const body = await (await pruefen(sitzung, [{ productId: eier.id, quantity: 2 }])).json()

    expect(body.meldung).toBeNull()
    expect((await halteVon(sitzung)).map((h) => h.productId).sort()).toEqual([eier.id, kaese.id].sort())
  })
})

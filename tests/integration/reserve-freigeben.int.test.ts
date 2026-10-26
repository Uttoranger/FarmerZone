/**
 * DELETE /api/reserve gegen ein ECHTES Postgres (Register N28, Nr. 169): Wer ein Produkt aus dem Korb nimmt, gibt
 * seinen Halt sofort frei — und nur seinen.
 *
 * Beweist:
 *  - Der Halt der Sitzung für dieses Produkt ist weg; der Halt einer fremden Sitzung am selben Produkt bleibt, ebenso
 *    der Halt derselben Sitzung an einem anderen Produkt.
 *  - Danach ist die freigegebene Menge für eine andere Sitzung sofort reservierbar (POST), vorher nicht.
 *  - Ohne Halt dieselbe Antwort 200 { ok: true }.
 *
 * Alles trägt das Präfix int- (raeumeAuf). Jeder Hof bietet an jedem Tag ein Fenster an (erstelleHof).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { DELETE, POST } from '@/app/api/reserve/route'
import { erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

function anfrage(method: 'DELETE' | 'POST', body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/reserve', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function halteAn(productId: string) {
  return prisma.stockReservation.findMany({ where: { productId }, orderBy: { sessionId: 'asc' } })
}

describe('DELETE /api/reserve — gibt nur den eigenen Halt frei', () => {
  it('der eigene Halt fällt, der einer fremden Sitzung und am anderen Produkt bleibt', async () => {
    const { farm } = await erstelleHof()
    const eier = await erstelleProdukt(farm.id, { stock: 10 })
    const mehl = await erstelleProdukt(farm.id, { stock: 10 })
    const meine = intKennung('sitzung')
    const fremde = intKennung('sitzung')
    await setzeHalt(eier.id, meine, 4)
    await setzeHalt(eier.id, fremde, 3)
    await setzeHalt(mehl.id, meine, 1)

    const res = await DELETE(anfrage('DELETE', { productId: eier.id, sessionId: meine }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const eierHalte = await halteAn(eier.id)
    expect(eierHalte.map((h) => [h.sessionId, h.quantity])).toEqual([[fremde, 3]])
    expect((await halteAn(mehl.id)).map((h) => h.sessionId)).toEqual([meine])
  })

  it('danach ist die Menge für eine andere Sitzung sofort reservierbar — vorher nicht (Gegenprobe)', async () => {
    const { farm } = await erstelleHof()
    const eier = await erstelleProdukt(farm.id, { stock: 5 })
    const meine = intKennung('sitzung')
    const andere = intKennung('sitzung')
    await setzeHalt(eier.id, meine, 5)

    const vorher = await POST(anfrage('POST', { productId: eier.id, quantity: 5, sessionId: andere }))
    expect(vorher.status).toBe(409)

    await DELETE(anfrage('DELETE', { productId: eier.id, sessionId: meine }))

    const nachher = await POST(anfrage('POST', { productId: eier.id, quantity: 5, sessionId: andere }))
    expect(nachher.status).toBe(200)
    expect((await halteAn(eier.id)).map((h) => [h.sessionId, h.quantity])).toEqual([[andere, 5]])
  })

  it('ohne Halt dieselbe Antwort', async () => {
    const { farm } = await erstelleHof()
    const eier = await erstelleProdukt(farm.id, { stock: 5 })

    const res = await DELETE(anfrage('DELETE', { productId: eier.id, sessionId: intKennung('sitzung') }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

/**
 * Zähler „Bestellungen“ (Register N41 e, Nr. 222): Der Chip „Noch offen · n“ auf
 * /orders und die Zahl an „Bestellungen“ in Unterleiste und Seitenleiste
 * (getOpenOrdersCount) liefern dieselbe Zahl — beide aus OPEN_STATUSES
 * (src/server/queries/orders.ts). Die Liste in src/lib/hof-bestellungen.ts hat
 * genau deren Typ (sonst scheitert der Typecheck); hier zählt die Zahl.
 *
 * Prisma ist gemockt: `order.count` wertet die Bedingung der Abfrage an
 * denselben Zeilen aus, die der Chip zählt — so prüft der Test die Bedingung,
 * die die Navigation wirklich stellt, nicht eine nachgebaute.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OrderStatus } from '@prisma/client'

const m = vi.hoisted(() => ({ zeilen: [] as { farmId: string; status: string; pickupDate: Date }[] }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      count: async ({ where }: { where: { farmId: string; status: { in: string[] } } }) =>
        m.zeilen.filter((z) => z.farmId === where.farmId && where.status.in.includes(z.status)).length,
    },
  },
}))

import { OPEN_STATUSES, getOpenOrdersCount } from '@/server/queries/orders'
import { OFFEN_STATUS, filterChips } from '@/lib/hof-bestellungen'

const JETZT = new Date('2026-10-06T08:00:00Z')
const TAGE = [new Date('2026-10-05T10:00:00Z'), new Date('2026-10-06T10:00:00Z'), new Date('2026-10-10T10:00:00Z')]

/** Jeder Status an jedem Tag einmal — auch „Bestätigung offen“ und Überfälliges von gestern. */
function alleZeilen(): { farmId: string; status: string; pickupDate: Date }[] {
  return Object.values(OrderStatus).flatMap((status) => TAGE.map((pickupDate) => ({ farmId: 'hof-1', status, pickupDate })))
}

function chipZahl(zeilen: readonly { status: string; pickupDate: Date }[]): number {
  const chip = filterChips(zeilen, JETZT).find((c) => c.filter === 'offen')
  return Number(chip?.text.split(' · ')[1])
}

beforeEach(() => {
  m.zeilen = alleZeilen()
})

describe('Chip „Noch offen · n“ und Navigation zählen dasselbe (N41 e)', () => {
  it('dieselbe Zahl für einen Hof mit Bestellungen in jedem Status', async () => {
    const navigation = await getOpenOrdersCount('hof-1')
    expect(chipZahl(m.zeilen)).toBe(navigation)
    // „Bestätigung offen“ zählt mit: fünf offene Status an drei Tagen.
    expect(navigation).toBe(OPEN_STATUSES.length * TAGE.length)
    expect(OPEN_STATUSES).toContain('PENDING_CONFIRMATION')
  })

  it('die Liste der Seite ist die Liste der Navigation, Wert für Wert', () => {
    expect([...OFFEN_STATUS]).toEqual([...OPEN_STATUSES])
  })

  it('auch ohne Bestellung: 0 und 0', async () => {
    m.zeilen = []
    expect(chipZahl([])).toBe(0)
    expect(await getOpenOrdersCount('hof-1')).toBe(0)
  })

  it('Gegenprobe: eine zweite Liste ohne „Bestätigung offen“ zählte anders — der Vergleich schlägt an', async () => {
    const zweiteListe = OPEN_STATUSES.filter((s) => s !== 'PENDING_CONFIRMATION') as readonly string[]
    const ohne = m.zeilen.filter((z) => zweiteListe.includes(z.status)).length
    expect(ohne).not.toBe(await getOpenOrdersCount('hof-1'))
  })
})

/**
 * Zähler „Bestellungen“ (Register N41 e, Nr. 222): Der Chip „Noch offen · n“ auf
 * /orders und die Zahl an „Bestellungen“ in Unterleiste und Seitenleiste
 * (getOpenOrdersCount) liefern dieselbe Zahl — beide aus OPEN_STATUSES
 * (src/lib/bestellstatus-offen.ts; src/server/queries/orders.ts reicht die Liste
 * weiter, src/lib/hof-bestellungen.ts nimmt sie als OFFEN_STATUS).
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
import { OPEN_STATUSES as QUELLE } from '@/lib/bestellstatus-offen'

const JETZT = new Date('2026-10-06T08:00:00Z')
const TAGE = [new Date('2026-10-05T10:00:00Z'), new Date('2026-10-06T10:00:00Z'), new Date('2026-10-10T10:00:00Z')]

/** Jeder Status an jedem Tag einmal — auch „Bestätigung offen“ und Überfälliges von gestern. */
function alleZeilen(): { farmId: string; status: string; pickupDate: Date }[] {
  return Object.values(OrderStatus).flatMap((status) => TAGE.map((pickupDate) => ({ farmId: 'hof-1', status, pickupDate })))
}

// Liest die Zahl am Chip „Noch offen“. Fehlt der Chip oder steht keine Zahl da, schlägt der Test hier an —
// sonst bestünde jede Gegenprobe mit „not.toBe“ still über NaN.
function chipZahl(zeilen: readonly { status: string; pickupDate: Date }[], chips: typeof filterChips = filterChips): number {
  const chip = chips(zeilen, JETZT).find((c) => c.filter === 'offen')
  expect(chip).toBeDefined()
  const zahl = Number(chip?.text.split(' · ')[1])
  expect(Number.isFinite(zahl)).toBe(true)
  return zahl
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

  it('die Liste der Seite ist die Liste der Navigation — dasselbe Objekt, keine Abschrift', () => {
    expect(OFFEN_STATUS).toBe(OPEN_STATUSES)
    expect(OPEN_STATUSES).toBe(QUELLE)
  })

  it('auch ohne Bestellung: 0 und 0', async () => {
    m.zeilen = []
    expect(chipZahl([])).toBe(0)
    expect(await getOpenOrdersCount('hof-1')).toBe(0)
  })

  it('folgt jeder Änderung der Zeilen: Ein offener Status mehr oder weniger ändert Chip und Navigation gleich', async () => {
    // Eine „Bestätigung offen“ wird abgeholt, eine stornierte wieder offen (bezahlt) — die Zahl bleibt, beide zählen mit.
    const wartend = m.zeilen.findIndex((z) => z.status === 'PENDING_CONFIRMATION')
    const storniert = m.zeilen.findIndex((z) => z.status === 'CANCELLED')
    m.zeilen[wartend] = { ...m.zeilen[wartend], status: 'PICKED_UP' }
    expect(chipZahl(m.zeilen)).toBe(await getOpenOrdersCount('hof-1'))
    m.zeilen[storniert] = { ...m.zeilen[storniert], status: 'PAID' }
    expect(chipZahl(m.zeilen)).toBe(await getOpenOrdersCount('hof-1'))
    // Die übrigen zwei „Bestätigung offen“ weg (eine ist oben schon abgeholt): beide zählen zwei weniger.
    const vorher = await getOpenOrdersCount('hof-1')
    m.zeilen = m.zeilen.filter((z) => z.status !== 'PENDING_CONFIRMATION')
    expect(chipZahl(m.zeilen)).toBe(vorher - 2)
    expect(await getOpenOrdersCount('hof-1')).toBe(vorher - 2)
  })

  it('Gegenprobe: Sieht der Chip die Zeilen „Bestätigung offen“ nicht, schlägt der Vergleich an', async () => {
    const ohneWartende = m.zeilen.filter((z) => z.status !== 'PENDING_CONFIRMATION')
    expect(chipZahl(ohneWartende)).not.toBe(await getOpenOrdersCount('hof-1'))
  })

  it('Gegenprobe: Führte der Chip eine eigene Liste ohne „Bestätigung offen“, zählte er anders als die Navigation', async () => {
    // Die Navigation behält die echte Liste (schon geladen); nur hof-bestellungen.ts wird mit einer
    // zweiten Liste frisch geladen — genau der Fehler, den die eine Quelle verhindert.
    vi.resetModules()
    vi.doMock('@/lib/bestellstatus-offen', () => ({
      OPEN_STATUSES: ['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'],
    }))
    try {
      const { filterChips: chipsMitZweiterListe } = await import('@/lib/hof-bestellungen')
      expect(chipZahl(m.zeilen, chipsMitZweiterListe)).not.toBe(await getOpenOrdersCount('hof-1'))
      expect(chipZahl(m.zeilen)).toBe(await getOpenOrdersCount('hof-1'))
    } finally {
      vi.doUnmock('@/lib/bestellstatus-offen')
      vi.resetModules()
    }
  })
})

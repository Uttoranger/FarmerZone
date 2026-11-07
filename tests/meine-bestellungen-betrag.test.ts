/**
 * Nr. 253 (Morgenbericht 32 A, „Offen“): „Meine Bestellungen“ (/bestellungen) zeigte bei stornierten, nicht
 * abgeholten und verfallenen Bar-Bestellungen noch Warenpreis + Gebühr, die verlinkte Bestätigung schon den
 * Warenpreis (Nr. 244). Der Lesepfad holt jetzt `serviceFeeRefundedAt`, den Betrag bildet `bestellEintrag` mit
 * `anzeigeGesamtCents` — nur Anzeige; Snapshot, Kassieren und Erstattung bleiben unberührt.
 *
 * Vorher rot: Ohne `serviceFeeRefundedAt` im Lesepfad stand „€ 10,40“ statt „€ 9,80“.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findMany: vi.fn() } } }))
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: vi.fn(async () => undefined) }))
vi.mock('@/server/bremse-datenbank', () => ({
  gibVersuchZurueck: vi.fn(),
  zaehleAlsFehlversuch: vi.fn(),
  zaehleVersuchVorab: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { ladeBestellungenZurAdresse } from '@/server/bestellungen-finden'
import { bestellEintrag } from '@/lib/bestellungen-finden'

const findMany = vi.mocked(prisma.order.findMany)
const JETZT = new Date('2026-11-07T09:00:00.000Z')
const ENTFALLEN_AM = new Date('2026-11-05T10:00:00.000Z')

type Zeile = { status: string; paymentMethod: string; paymentStatus: string; serviceFeeRefundedAt: Date | null }

function zeile(teil: Zeile, i: number): Record<string, unknown> {
  return {
    id: `bestellung-${i}`,
    orderNumber: `HM-0000-000${i}`,
    pickupDate: new Date('2026-11-03T00:00:00.000Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    createdAt: new Date('2026-11-02T10:00:00.000Z'),
    // Decimal-ähnlich wie aus Prisma: nur toString().
    totalAmount: { toString: () => '9.80' },
    serviceFeeCents: 60,
    farm: { name: 'Hof Test', slug: 'hof-test' },
    _count: { items: 2 },
    ...teil,
  }
}

async function betraege(zeilen: Zeile[]): Promise<string[]> {
  findMany.mockResolvedValueOnce([] as never) // offene Höfe (Frist beim Lesen)
  findMany.mockResolvedValueOnce(zeilen.map(zeile) as never)
  const liste = await ladeBestellungenZurAdresse('kundin@example.com', JETZT)
  return liste.map((b) => bestellEintrag(b, JETZT, false).betrag.replace(/ /g, ' '))
}

beforeEach(() => {
  findMany.mockReset()
})

describe('Meine Bestellungen: Betrag ohne entfallene Gebühr', () => {
  it.each([
    ['storniert, bar', { status: 'CANCELLED', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeRefundedAt: ENTFALLEN_AM }],
    ['nicht abgeholt, bar', { status: 'NOT_PICKED_UP', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeRefundedAt: ENTFALLEN_AM }],
    // Verfallen = von gibVerwaisteFreiOhneRisiko storniert, Gebühr entfallen.
    ['verfallen, bar', { status: 'CANCELLED', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeRefundedAt: ENTFALLEN_AM }],
    ['storniert, online erstattet', { status: 'CANCELLED', paymentMethod: 'ONLINE', paymentStatus: 'REFUNDED', serviceFeeRefundedAt: ENTFALLEN_AM }],
  ])('%s: „€ 9,80“ (Warenpreis), wie die verlinkte Bestätigung', async (_name, z) => {
    expect(await betraege([z])).toEqual(['€ 9,80'])
  })

  it('Gegenprobe: gilt die Gebühr noch, steht Warenpreis + Gebühr', async () => {
    expect(
      await betraege([{ status: 'CONFIRMED', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeRefundedAt: null }])
    ).toEqual(['€ 10,40'])
  })

  it('der Lesepfad fragt serviceFeeRefundedAt ab', async () => {
    await betraege([])
    const abfrage = findMany.mock.calls[1]?.[0] as { select?: Record<string, unknown> } | undefined
    expect(abfrage?.select?.serviceFeeRefundedAt).toBe(true)
  })
})

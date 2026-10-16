/**
 * Der EINE Lader für das wirksame Gründungs-Enddatum (Nr. 62, Register K2):
 * ladeGruendungBis (src/server/queries/admin.ts) und die Stellen, die ihn
 * nehmen — ladeTarifStand (Tarif-Zeile) und ladeKonditionenHof („Dein Stand").
 * Prisma gemockt; dass die Abfragen in einer echten Datenbank tragen, prüft
 * tests/integration/gruendung-bis.int.test.ts (dort auch die Übersicht und
 * ladeTarifZeile).
 *
 * Beweist: Die Anzeige bekommt das WIRKSAME Datum, nie die rohe Spalte — null
 * wird zum Standard, ohne Gründungsplatz gibt es keins; die Abfrage ist
 * schmal (keine Namen, keine E-Mail) und zählt nur freigeschaltete, nicht
 * stillgelegte Höfe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const db = vi.hoisted(() => ({ farm: { findUnique: vi.fn(), findMany: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { ladeGruendungBis } from '@/server/queries/admin'
import { ladeKonditionenHof, ladeTarifStand } from '@/server/queries/einstellungen'
import { GRUENDUNG_BIS_STANDARD } from '@/lib/gruendungshof'

const TAG = (kalendertag: string) => new Date(`${kalendertag}T00:00:00.000Z`)

/** n freigeschaltete Höfe in Freigabe-Reihenfolge; hof_1 hat Platz 1. */
function hoefe(n: number, spalte: Record<string, Date> = {}) {
  return Array.from({ length: n }, (_, i) => ({
    id: `hof_${i + 1}`,
    ownerId: `nutzer_${i + 1}`,
    approvedAt: new Date(Date.UTC(2026, 0, i + 1)),
    createdAt: new Date(Date.UTC(2026, 0, i + 1)),
    archivedAt: null,
    gruendungBis: spalte[`hof_${i + 1}`] ?? null,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ladeGruendungBis', () => {
  it('Gründungshof ohne eigenes Datum: der Standard', async () => {
    db.farm.findMany.mockResolvedValue(hoefe(3))
    expect(await ladeGruendungBis({ id: 'hof_2' })).toEqual(GRUENDUNG_BIS_STANDARD)
  })

  it('Gründungshof mit eigenem Datum: dieses — auch über den Inhaber gefunden', async () => {
    db.farm.findMany.mockResolvedValue(hoefe(3, { hof_3: TAG('2028-06-30') }))
    expect(await ladeGruendungBis({ id: 'hof_3' })).toEqual(TAG('2028-06-30'))
    expect(await ladeGruendungBis({ ownerId: 'nutzer_3' })).toEqual(TAG('2028-06-30'))
  })

  it('Platz 13 oder nicht in der Liste (wartet, stillgelegt): kein Datum', async () => {
    db.farm.findMany.mockResolvedValue(hoefe(13, { hof_13: TAG('2028-06-30') }))
    expect(await ladeGruendungBis({ id: 'hof_13' })).toBeNull()
    expect(await ladeGruendungBis({ ownerId: 'nutzer_wartet' })).toBeNull()
  })

  it('eine schmale Abfrage: nur freigeschaltete, nicht stillgelegte Höfe, ohne Namen und E-Mail', async () => {
    db.farm.findMany.mockResolvedValue([])
    await ladeGruendungBis({ id: 'hof_1' })
    expect(db.farm.findMany).toHaveBeenCalledTimes(1)
    const abfrage = db.farm.findMany.mock.calls[0]?.[0]
    expect(abfrage.where).toEqual({ approvedAt: { not: null }, archivedAt: null })
    expect(Object.keys(abfrage.select).sort()).toEqual(['approvedAt', 'archivedAt', 'createdAt', 'gruendungAusgenommen', 'gruendungBis', 'id', 'ownerId'])
  })
})

describe('die Stellen nehmen das wirksame Datum', () => {
  it('ladeTarifStand (Tarif-Zeile): Gründungshof ohne Spalte bekommt den Standard', async () => {
    db.farm.findUnique.mockResolvedValue({ tarif: null, _count: { products: 2 } })
    db.farm.findMany.mockResolvedValue(hoefe(2))
    expect(await ladeTarifStand('hof_1')).toEqual({ tarif: null, produkteImShop: 2, gruendungBis: GRUENDUNG_BIS_STANDARD })
  })

  it('ladeTarifStand: ohne Gründungsplatz null — die rohe Spalte zählt nicht', async () => {
    db.farm.findUnique.mockResolvedValue({ tarif: 'HOFLADEN', _count: { products: 0 } })
    db.farm.findMany.mockResolvedValue(hoefe(13, { hof_13: TAG('2028-06-30') }))
    expect((await ladeTarifStand('hof_13')).gruendungBis).toBeNull()
  })

  it('ladeKonditionenHof („Dein Stand"): das eigene Datum des Hofs, gefunden über den Inhaber', async () => {
    db.farm.findUnique.mockResolvedValue({
      tarif: null,
      serviceFeePercent: { toString: () => '5.00' },
      serviceFeeMinCents: 50,
      serviceFeeActiveFrom: null,
      platformFeePercent: { toString: () => '0.00' },
      _count: { products: 1, pickupSlots: 1 },
    })
    db.farm.findMany.mockResolvedValue(hoefe(2, { hof_1: TAG('2028-06-30') }))
    expect((await ladeKonditionenHof('nutzer_1'))?.gruendungBis).toEqual(TAG('2028-06-30'))
  })
})

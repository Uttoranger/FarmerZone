/**
 * Tests für rejectFarmAction (src/server/actions/admin.ts) — „Ablehnen & löschen".
 *
 * Beweist am echten Code:
 *  - Ohne isAdmin wirkt nichts, auch nicht mit gültiger Session.
 *  - Ein freigeschalteter Hof wird nicht gelöscht.
 *  - Ein wartender Hof ohne Geschäftsdaten verschwindet samt Inhaber-Konto,
 *    und zwar in der von den Fremdschlüsseln erzwungenen Reihenfolge:
 *    erst der Hof, dann der User (Farm.ownerId steht auf ON DELETE RESTRICT).
 *  - Die vier Guards greifen einzeln: Freigabe, Betreiber-Konto, Bestellungen
 *    und Verkäufe am Hof, Bestellungen am Inhaber-Konto.
 *
 * Die Guards sind kein Zierrat: ohne sie bräche das Löschen entweder an einem
 * RESTRICT-Fremdschlüssel ab oder kappte per SET NULL still die Kundenzuordnung
 * fremder Bestellungen (prisma/migrations/0_init/migration.sql:440, :449, :443).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), delete: vi.fn() },
    order: { count: vi.fn() },
    orderItem: { count: vi.fn() },
    stockReservation: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { rejectFarmAction } from '@/server/actions/admin'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  FARM_REJECT_APPROVED_MESSAGE,
  FARM_REJECT_HAS_DATA_MESSAGE,
  FARM_REJECT_OWNER_HAS_ORDERS_MESSAGE,
  FARM_REJECT_OWNER_IS_ADMIN_MESSAGE,
} from '@/lib/farm-approval'

const getSession = vi.mocked(auth.api.getSession)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const farmDelete = vi.mocked(prisma.farm.delete)
const userDelete = vi.mocked(prisma.user.delete)
const orderCount = vi.mocked(prisma.order.count)
const orderItemCount = vi.mocked(prisma.orderItem.count)
const reservationDeleteMany = vi.mocked(prisma.stockReservation.deleteMany)
const transaction = vi.mocked(prisma.$transaction)

/** Der Regelfall: wartender Hof, ein Produkt, keinerlei Geschäftsdaten. */
const WARTENDER_HOF = {
  slug: 'bot-hof',
  approvedAt: null,
  ownerId: 'user_bot',
  owner: { isAdmin: false },
  products: [{ id: 'prod_1' }],
  _count: { orders: 0, manualSales: 0 },
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'admin_1' } } as never)
  userFindUnique.mockResolvedValue({ isAdmin: true } as never)
  farmFindUnique.mockResolvedValue(WARTENDER_HOF as never)
  orderCount.mockResolvedValue(0 as never)
  orderItemCount.mockResolvedValue(0 as never)
  farmDelete.mockResolvedValue({} as never)
  userDelete.mockResolvedValue({} as never)
  reservationDeleteMany.mockResolvedValue({ count: 0 } as never)
  transaction.mockResolvedValue([] as never)
})

describe('rejectFarmAction — Zugriff', () => {
  it('lehnt ohne Session ab und löscht nichts', async () => {
    getSession.mockResolvedValue(null as never)

    const result = await rejectFarmAction('farm_1')

    expect(result.error).toBe('Nicht angemeldet.')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('lehnt ohne isAdmin ab, obwohl eine gültige Session besteht', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)

    const result = await rejectFarmAction('farm_1')

    expect(result.error).toBe('Kein Zugriff.')
    expect(farmFindUnique).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('liest das Admin-Recht aus der Datenbank, nicht aus der Session', async () => {
    getSession.mockResolvedValue({ user: { id: 'user_1', isAdmin: true } } as never)
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)

    const result = await rejectFarmAction('farm_1')

    expect(result.error).toBe('Kein Zugriff.')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('meldet einen unbekannten Hof, statt stillschweigend nichts zu tun', async () => {
    farmFindUnique.mockResolvedValue(null)

    const result = await rejectFarmAction('farm_weg')

    expect(result.error).toBe('Hof nicht gefunden.')
    expect(transaction).not.toHaveBeenCalled()
  })
})

describe('rejectFarmAction — Guards', () => {
  it('löscht keinen freigeschalteten Hof', async () => {
    farmFindUnique.mockResolvedValue({
      ...WARTENDER_HOF,
      approvedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as never)

    const result = await rejectFarmAction('farm_1')

    expect(result.error).toBe(FARM_REJECT_APPROVED_MESSAGE)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('löscht kein Betreiber-Konto', async () => {
    farmFindUnique.mockResolvedValue({ ...WARTENDER_HOF, owner: { isAdmin: true } } as never)

    const result = await rejectFarmAction('farm_1')

    expect(result.error).toBe(FARM_REJECT_OWNER_IS_ADMIN_MESSAGE)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('löscht keinen Hof mit Bestellungen — auch wenn er gerade auf Freigabe wartet', async () => {
    // Der Fall entsteht real: eine zurückgenommene Freigabe setzt approvedAt
    // wieder auf null, die Bestellungen aus der freigeschalteten Zeit bleiben.
    farmFindUnique.mockResolvedValue({
      ...WARTENDER_HOF,
      _count: { orders: 3, manualSales: 0 },
    } as never)

    const result = await rejectFarmAction('farm_1')

    expect(result.error).toBe(FARM_REJECT_HAS_DATA_MESSAGE)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('löscht keinen Hof mit Direktverkäufen', async () => {
    farmFindUnique.mockResolvedValue({
      ...WARTENDER_HOF,
      _count: { orders: 0, manualSales: 2 },
    } as never)

    const result = await rejectFarmAction('farm_1')

    expect(result.error).toBe(FARM_REJECT_HAS_DATA_MESSAGE)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('löscht keinen Hof, dessen Produkte in Bestellpositionen stecken', async () => {
    orderItemCount.mockResolvedValue(1 as never)

    const result = await rejectFarmAction('farm_1')

    expect(result.error).toBe(FARM_REJECT_HAS_DATA_MESSAGE)
    expect(orderItemCount).toHaveBeenCalledWith({ where: { productId: { in: ['prod_1'] } } })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('löscht kein Inhaber-Konto, an dem eigene Bestellungen hängen', async () => {
    orderCount.mockResolvedValue(1 as never)

    const result = await rejectFarmAction('farm_1')

    expect(result.error).toBe(FARM_REJECT_OWNER_HAS_ORDERS_MESSAGE)
    expect(orderCount).toHaveBeenCalledWith({ where: { customerId: 'user_bot' } })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('fragt bei einem Hof ohne Produkte gar nicht erst nach Bestellpositionen', async () => {
    farmFindUnique.mockResolvedValue({ ...WARTENDER_HOF, products: [] } as never)

    const result = await rejectFarmAction('farm_1')

    expect(result.error).toBeUndefined()
    expect(orderItemCount).not.toHaveBeenCalled()
  })
})

describe('rejectFarmAction — Löschvorgang', () => {
  it('löscht wartenden Hof und Inhaber-Konto in einer Transaktion', async () => {
    const result = await rejectFarmAction('farm_1')

    expect(result.error).toBeUndefined()
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(farmDelete).toHaveBeenCalledWith({ where: { id: 'farm_1' } })
    expect(userDelete).toHaveBeenCalledWith({ where: { id: 'user_bot' } })
  })

  it('löscht den Hof VOR dem User — Farm.ownerId steht auf ON DELETE RESTRICT', async () => {
    const reihenfolge: string[] = []
    farmDelete.mockImplementation((() => {
      reihenfolge.push('farm')
      return {}
    }) as never)
    userDelete.mockImplementation((() => {
      reihenfolge.push('user')
      return {}
    }) as never)

    await rejectFarmAction('farm_1')

    expect(reihenfolge).toEqual(['farm', 'user'])
  })

  it('räumt die Reservierungen der Produkte mit ab — sie haben keinen Fremdschlüssel', async () => {
    await rejectFarmAction('farm_1')

    expect(reservationDeleteMany).toHaveBeenCalledWith({
      where: { productId: { in: ['prod_1'] } },
    })
  })
})

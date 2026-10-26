/**
 * Ein Produkt mit Bestellungen wird ausgeblendet statt gelöscht (Nr. 195, Audit A5).
 *
 * Ursache: Die Positionen vergangener Bestellungen verweisen auf das Produkt
 * (Fremdschlüssel ohne Kaskade). Das Löschen scheiterte mit einem
 * Datenbankfehler und dem allgemeinen Satz „Wir konnten das Produkt nicht
 * löschen". Jetzt: ohne Bestellungen gelöscht, mit Bestellungen `isAvailable =
 * false` — beides mit dem Hof in der WHERE. Ohne Migration.
 *
 * Gegenproben: ohne Bestellungen wird nichts ausgeblendet; ein fremdes Produkt
 * wird weder gelöscht noch ausgeblendet; ein anderer Datenbankfehler wirft weiter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => ({ user: { id: 'nutzer-1' } })) } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn(async () => ({ id: 'hof-1', slug: 'hof-eins' })) }))

const db = vi.hoisted(() => ({
  product: { findFirst: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  orderItem: { count: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { deleteProduct } from '@/server/actions/products'
import { PRODUKT_LOESCHEN_TEXT, produktLoeschenHinweis } from '@/lib/produkte-hof'

beforeEach(() => {
  vi.clearAllMocks()
  db.product.findFirst.mockResolvedValue({ id: 'p-1' })
  db.orderItem.count.mockResolvedValue(0)
  db.product.deleteMany.mockResolvedValue({ count: 1 })
  db.product.updateMany.mockResolvedValue({ count: 1 })
})

describe('deleteProduct', () => {
  it('ohne Bestellungen: gelöscht, mit dem Hof in der WHERE, nichts ausgeblendet', async () => {
    expect(await deleteProduct('p-1')).toEqual({ archiviert: false })
    expect(db.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p-1', farmId: 'hof-1' } }))
    expect(db.product.deleteMany).toHaveBeenCalledWith({ where: { id: 'p-1', farmId: 'hof-1' } })
    expect(db.product.updateMany).not.toHaveBeenCalled()
  })

  it('mit Bestellungen: ausgeblendet statt gelöscht — nie ein delete', async () => {
    db.orderItem.count.mockResolvedValue(3)
    expect(await deleteProduct('p-1')).toEqual({ archiviert: true })
    expect(db.orderItem.count).toHaveBeenCalledWith({ where: { productId: 'p-1' } })
    expect(db.product.deleteMany).not.toHaveBeenCalled()
    expect(db.product.updateMany).toHaveBeenCalledWith({ where: { id: 'p-1', farmId: 'hof-1' }, data: { isAvailable: false } })
  })

  it('kommt zwischen Zählen und Löschen eine Bestellung dazu (Fremdschlüssel P2003): ausgeblendet', async () => {
    db.product.deleteMany.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Foreign key', { code: 'P2003', clientVersion: 'test' }))
    expect(await deleteProduct('p-1')).toEqual({ archiviert: true })
    expect(db.product.updateMany).toHaveBeenCalledWith({ where: { id: 'p-1', farmId: 'hof-1' }, data: { isAvailable: false } })
  })

  it('Gegenprobe: ein anderer Datenbankfehler wirft weiter, nichts wird ausgeblendet', async () => {
    db.product.deleteMany.mockRejectedValue(new Error('DB weg'))
    await expect(deleteProduct('p-1')).rejects.toThrow('DB weg')
    expect(db.product.updateMany).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ein fremdes oder unbekanntes Produkt wirft, nichts wird gezählt oder geschrieben', async () => {
    db.product.findFirst.mockResolvedValue(null)
    await expect(deleteProduct('fremd')).rejects.toThrow('Produkt nicht gefunden')
    expect(db.orderItem.count).not.toHaveBeenCalled()
    expect(db.product.deleteMany).not.toHaveBeenCalled()
    expect(db.product.updateMany).not.toHaveBeenCalled()
  })
})

describe('Sätze zum Löschen', () => {
  it('der Hinweis danach sagt, was geschah', () => {
    expect(produktLoeschenHinweis({ archiviert: false })).toBe('Produkt gelöscht')
    expect(produktLoeschenHinweis({ archiviert: true })).toBe(PRODUKT_LOESCHEN_TEXT.ausgeblendet)
    expect(PRODUKT_LOESCHEN_TEXT.ausgeblendet).toContain('bleibt deshalb erhalten')
  })

  it('der Dialog sagt vorher, dass Produkte mit Bestellungen nur ausgeblendet werden', () => {
    expect(PRODUKT_LOESCHEN_TEXT.dialogSatz).toContain('Hat es schon Bestellungen, bleibt es erhalten und wird nur ausgeblendet')
  })
})

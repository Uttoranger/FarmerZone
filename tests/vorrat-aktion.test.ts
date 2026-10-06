/**
 * Vorrat direkt ändern (Nachtlauf Nr. 18): setzeVorrat und der Bestand im
 * Bearbeiten-Dialog (updateProduct).
 *
 * Beweist (Prisma, Auth und Next gemockt — den Wettlauf selbst prüft
 * tests/integration/vorrat-setzen.int.test.ts gegen Postgres):
 *  - Gesetzt wird BEDINGT: Die WHERE-Klausel nennt Produkt, Hof UND den
 *    erwarteten alten Vorrat; nie ein blindes increment/decrement.
 *  - Hat sich der Vorrat inzwischen geändert (Bestellung), schreibt die Aktion
 *    nichts und meldet den aktuellen Stand mit Code GEAENDERT.
 *  - Ein fremdes oder unbekanntes Produkt: nichts geschrieben, keine Auskunft.
 *  - Negative, gebrochene, zu große Werte und fehlende Anmeldung: nichts.
 *  - „wieder da" nur bei 0 → mehr als 0.
 *  - updateProduct schreibt den Vorrat nur bedingt und lässt ihn sonst
 *    unberührt — der Dialog überschreibt keine Bestellung mehr, die während
 *    des Bearbeitens kam.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))

const tx = vi.hoisted(() => ({
  product: { updateMany: vi.fn(), findFirst: vi.fn() },
  futterKennzeichnung: { upsert: vi.fn(), deleteMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { updateMany: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}))

import { setzeVorrat, updateProduct } from '@/server/actions/products'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { revalidatePath } from 'next/cache'
import { VORRAT_MAX } from '@/lib/eingabegrenzen'

const getSession = vi.mocked(auth.api.getSession)
const farmForUser = vi.mocked(getFarmForUser)
const updateMany = vi.mocked(prisma.product.updateMany)
const findFirst = vi.mocked(prisma.product.findFirst)

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmForUser.mockResolvedValue({ id: 'farm_1', slug: 'testhof', name: 'Hof Test' } as never)
  updateMany.mockResolvedValue({ count: 1 } as never)
  findFirst.mockResolvedValue(null as never)
  tx.product.updateMany.mockResolvedValue({ count: 1 })
  tx.product.findFirst.mockResolvedValue(null)
})

describe('setzeVorrat — bedingt auf den erwarteten alten Vorrat', () => {
  it('setzt mit Besitz und altem Vorrat in der WHERE-Klausel, ohne increment/decrement', async () => {
    const ergebnis = await setzeVorrat({ productId: 'p_1', vorher: 3, neu: 5 })

    expect(ergebnis).toEqual({ ok: true, vorrat: 5, wiederDa: false })
    const aufruf = updateMany.mock.calls[0][0] as { where: unknown; data: unknown }
    expect(aufruf.where).toEqual({ id: 'p_1', farmId: 'farm_1', stock: 3 })
    expect(aufruf.data).toEqual({ stock: 5 })
    expect(JSON.stringify(aufruf.data)).not.toMatch(/increment|decrement/)
    expect(revalidatePath).toHaveBeenCalledWith('/products')
    expect(revalidatePath).toHaveBeenCalledWith('/testhof')
  })

  it('0 → mehr als 0 meldet „wieder da"', async () => {
    expect(await setzeVorrat({ productId: 'p_1', vorher: 0, neu: 12 })).toEqual({ ok: true, vorrat: 12, wiederDa: true })
    expect(await setzeVorrat({ productId: 'p_1', vorher: 4, neu: 12 })).toEqual({ ok: true, vorrat: 12, wiederDa: false })
  })

  it('inzwischen geändert (Bestellung dazwischen): nichts geschrieben, aktueller Stand zurück', async () => {
    updateMany.mockResolvedValue({ count: 0 } as never)
    findFirst.mockResolvedValue({ stock: 2 } as never)

    const ergebnis = await setzeVorrat({ productId: 'p_1', vorher: 3, neu: 5 })

    expect(ergebnis).toMatchObject({ code: 'GEAENDERT', vorrat: 2 })
    expect('error' in ergebnis && ergebnis.error).toContain('2')
    // Die Nachfrage nennt den Hof ebenfalls — ein fremdes Produkt bleibt unsichtbar.
    expect((findFirst.mock.calls[0][0] as { where: unknown }).where).toEqual({ id: 'p_1', farmId: 'farm_1' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('ein fremdes Produkt trifft nichts und verrät nichts', async () => {
    updateMany.mockResolvedValue({ count: 0 } as never)
    findFirst.mockResolvedValue(null as never)

    const ergebnis = await setzeVorrat({ productId: 'p_fremd', vorher: 3, neu: 5 })

    expect(ergebnis).toEqual({ error: 'Produkt nicht gefunden.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('lehnt negative, gebrochene und zu große Werte ab, bevor die Datenbank gefragt wird', async () => {
    for (const neu of [-1, 2.5, VORRAT_MAX + 1]) {
      const ergebnis = await setzeVorrat({ productId: 'p_1', vorher: 3, neu })
      expect('error' in ergebnis).toBe(true)
    }
    expect(await setzeVorrat('Unsinn')).toMatchObject({ error: expect.any(String) })
    expect(updateMany).not.toHaveBeenCalled()
    expect(getSession).not.toHaveBeenCalled()
  })

  it('ohne Anmeldung oder ohne Hof passiert nichts', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await setzeVorrat({ productId: 'p_1', vorher: 3, neu: 5 })).toEqual({ error: 'Bitte melde dich neu an.' })
    getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
    farmForUser.mockResolvedValue(null as never)
    expect(await setzeVorrat({ productId: 'p_1', vorher: 3, neu: 5 })).toEqual({ error: 'Kein Hof gefunden.' })
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('gleicher Wert: nichts zu schreiben, trotzdem bestätigt', async () => {
    expect(await setzeVorrat({ productId: 'p_1', vorher: 5, neu: 5 })).toEqual({ ok: true, vorrat: 5, wiederDa: false })
    expect(updateMany).not.toHaveBeenCalled()
  })
})

describe('updateProduct — der Vorrat im Dialog überschreibt keine Bestellung', () => {
  const basis = {
    name: 'Freilandeier',
    price: 4.5,
    unit: 'STUECK' as const,
    category: 'EIER',
    subcategory: null,
    labels: [],
    stock: 10,
  }

  it('unveränderter Vorrat: wird gar nicht geschrieben', async () => {
    const ergebnis = await updateProduct('p_1', basis as never, 10)

    expect(ergebnis).toEqual({ ok: true })
    const aufruf = tx.product.updateMany.mock.calls[0][0] as { where: unknown; data: Record<string, unknown> }
    expect(aufruf.where).toEqual({ id: 'p_1', farmId: 'farm_1' })
    expect('stock' in aufruf.data).toBe(false)
  })

  it('ohne erwarteten Vorrat: der Vorrat bleibt unberührt', async () => {
    await updateProduct('p_1', basis as never)
    const aufruf = tx.product.updateMany.mock.calls[0][0] as { data: Record<string, unknown> }
    expect('stock' in aufruf.data).toBe(false)
  })

  it('geänderter Vorrat: bedingt auf den Stand beim Öffnen', async () => {
    await updateProduct('p_1', { ...basis, stock: 15 } as never, 10)
    const aufruf = tx.product.updateMany.mock.calls[0][0] as { where: unknown; data: Record<string, unknown> }
    expect(aufruf.where).toEqual({ id: 'p_1', farmId: 'farm_1', stock: 10 })
    expect(aufruf.data.stock).toBe(15)
  })

  it('kam inzwischen eine Bestellung: nichts gespeichert, der Hof erfährt den neuen Stand', async () => {
    tx.product.updateMany.mockResolvedValue({ count: 0 })
    tx.product.findFirst.mockResolvedValue({ stock: 9 })

    const ergebnis = await updateProduct('p_1', { ...basis, stock: 15 } as never, 10)

    expect('error' in ergebnis && ergebnis.error).toContain('9')
    expect(ergebnis).toMatchObject({ code: 'GEAENDERT', vorrat: 9 })
    expect(tx.futterKennzeichnung.upsert).not.toHaveBeenCalled()
    expect(tx.futterKennzeichnung.deleteMany).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('fremdes Produkt bleibt „nicht gefunden"', async () => {
    tx.product.updateMany.mockResolvedValue({ count: 0 })
    tx.product.findFirst.mockResolvedValue(null)
    expect(await updateProduct('p_fremd', { ...basis, stock: 15 } as never, 10)).toEqual({ error: 'Produkt nicht gefunden.' })
  })

  it('ein ungültiger erwarteter Vorrat wird abgelehnt', async () => {
    expect(await updateProduct('p_1', { ...basis, stock: 15 } as never, -3)).toMatchObject({ error: expect.any(String) })
    expect(tx.product.updateMany).not.toHaveBeenCalled()
  })
})

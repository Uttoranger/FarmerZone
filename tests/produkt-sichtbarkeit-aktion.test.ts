/**
 * Tests der Server-Aktion produktSichtbarkeitSetzen (Sprint Sichtbarkeits-Schalter).
 *
 * Beweist: Der Besitz steht in der WHERE-Klausel, ein fremdes Produkt wird
 * nicht angefasst und meldet auch keinen Erfolg, ohne Anmeldung passiert
 * nichts, ungültige Eingaben kommen als { error } zurück — und der Grund für
 * die Nichtverfügbarkeit bleibt beim Umschalten unberührt.
 *
 * Prisma, Auth und Next sind gemockt — kein Datenbankzugriff.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { product: { updateMany: vi.fn() } },
}))

import { produktSichtbarkeitSetzen } from '@/server/actions/products'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { revalidatePath, updateTag } from 'next/cache'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'

const getSession = vi.mocked(auth.api.getSession)
const farmForUser = vi.mocked(getFarmForUser)
const updateMany = vi.mocked(prisma.product.updateMany)

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmForUser.mockResolvedValue({ id: 'farm_1', slug: 'testhof', name: 'Hof Test' } as never)
  updateMany.mockResolvedValue({ count: 1 } as never)
})

describe('produktSichtbarkeitSetzen', () => {
  it('blendet ein eigenes Produkt aus und nennt den Hof in der WHERE-Klausel', async () => {
    const ergebnis = await produktSichtbarkeitSetzen({ productId: 'p_1', imShop: false })

    expect(ergebnis).toEqual({ ok: true })
    const aufruf = updateMany.mock.calls[0][0] as { where: unknown; data: unknown }
    expect(aufruf.where).toEqual({ id: 'p_1', farmId: 'farm_1' })
    expect(aufruf.data).toEqual({ isAvailable: false })
  })

  it('blendet es genauso wieder ein', async () => {
    await produktSichtbarkeitSetzen({ productId: 'p_1', imShop: true })

    const aufruf = updateMany.mock.calls[0][0] as { data: unknown }
    expect(aufruf.data).toEqual({ isAvailable: true })
  })

  it('lässt den Grund für die Nichtverfügbarkeit unberührt', async () => {
    // Der Hof soll seine Notiz („Saison vorbei") behalten, wenn er kurz
    // abschaltet und wieder einschaltet.
    await produktSichtbarkeitSetzen({ productId: 'p_1', imShop: true })

    const daten = (updateMany.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect('unavailableReason' in daten).toBe(false)
    expect(Object.keys(daten)).toEqual(['isAvailable'])
  })

  it('ein fremdes Produkt trifft nichts und meldet keinen Erfolg', async () => {
    updateMany.mockResolvedValue({ count: 0 } as never)

    const ergebnis = await produktSichtbarkeitSetzen({ productId: 'p_fremd', imShop: false })

    expect(ergebnis).toEqual({ error: 'Produkt nicht gefunden.' })
    // Kein Cache wird entwertet, wenn nichts geschrieben wurde.
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('verrät nicht, ob das Produkt fehlt oder einem anderen Hof gehört', async () => {
    updateMany.mockResolvedValue({ count: 0 } as never)

    const ergebnis = await produktSichtbarkeitSetzen({ productId: 'p_fremd', imShop: false })

    expect(ergebnis).toEqual({ error: 'Produkt nicht gefunden.' })
  })

  it('schreibt ohne Anmeldung nichts', async () => {
    getSession.mockResolvedValue(null as never)

    const ergebnis = await produktSichtbarkeitSetzen({ productId: 'p_1', imShop: false })

    expect(ergebnis).toEqual({ error: 'Bitte melde dich neu an.' })
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('schreibt ohne Hof nichts', async () => {
    farmForUser.mockResolvedValue(null as never)

    const ergebnis = await produktSichtbarkeitSetzen({ productId: 'p_1', imShop: false })

    expect(ergebnis).toEqual({ error: 'Kein Hof gefunden.' })
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('weist ungültige Eingaben ab, bevor die Sitzung geprüft wird', async () => {
    for (const eingabe of [
      {},
      { productId: '', imShop: false },
      { productId: 'p_1' },
      { productId: 'p_1', imShop: 'nein' },
      { productId: 'p_1', imShop: false, isAvailable: true },
      null,
      'p_1',
    ]) {
      const ergebnis = await produktSichtbarkeitSetzen(eingabe)
      expect(ergebnis).toEqual({ error: 'Das hat nicht geklappt. Bitte nochmal.' })
    }
    expect(updateMany).not.toHaveBeenCalled()
    expect(getSession).not.toHaveBeenCalled()
  })

  it('entwertet nach dem Umschalten alle betroffenen Caches, auch den der Hofübersicht', async () => {
    await produktSichtbarkeitSetzen({ productId: 'p_1', imShop: false })

    expect(revalidatePath).toHaveBeenCalledWith('/products')
    expect(revalidatePath).toHaveBeenCalledWith('/testhof')
    expect(revalidatePath).toHaveBeenCalledWith('/farm-page')
    expect(updateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG)
  })
})

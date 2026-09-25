/**
 * Tests für setzeKategorie (src/server/actions/products.ts, Sprint
 * Produktformular Nachschliff) — der Chip „… übernehmen" in der Produktliste.
 *
 * Beweist: Es werden NUR Kategorie, Unterkategorie und ggf. die MwSt-Vorbelegung
 * geschrieben, nie der Bestand; Besitz und „Kategorie noch leer" stehen in der
 * WHERE-Klausel; Futtermittel und unpassende Unterkategorien werden abgelehnt;
 * ohne Anmeldung passiert nichts.
 *
 * Prisma, Auth und Next sind gemockt — kein Datenbankzugriff.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { product: { updateMany: vi.fn() } } }))

import { setzeKategorie } from '@/server/actions/products'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { revalidatePath } from 'next/cache'

const getSession = vi.mocked(auth.api.getSession)
const farmForUser = vi.mocked(getFarmForUser)
const updateMany = vi.mocked(prisma.product.updateMany)

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmForUser.mockResolvedValue({ id: 'farm_1', slug: 'testhof', name: 'Hof Test' } as never)
  updateMany.mockResolvedValue({ count: 1 })
})

describe('setzeKategorie', () => {
  it('schreibt Kategorie, Unterkategorie und MwSt-Vorschlag — nur für das eigene, noch leere Produkt', async () => {
    const ergebnis = await setzeKategorie({ productId: 'p1', category: 'FLEISCH', subcategory: 'LAMM' })

    expect(ergebnis).toEqual({ ok: true })
    expect(updateMany).toHaveBeenCalledTimes(1)
    const aufruf = updateMany.mock.calls[0][0]
    expect(aufruf.where).toEqual({ id: 'p1', farmId: 'farm_1', category: null, vatRate: 10 })
    expect(aufruf.data).toEqual({ category: 'FLEISCH', subcategory: 'LAMM', vatRate: 10 })
    expect(revalidatePath).toHaveBeenCalledWith('/products')
  })

  it('fasst einen selbst gesetzten MwSt-Satz nicht an', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 })

    const ergebnis = await setzeKategorie({ productId: 'p1', category: 'EIER', subcategory: null })

    expect(ergebnis).toEqual({ ok: true })
    const zweiter = updateMany.mock.calls[1][0]
    expect(zweiter.where).toEqual({ id: 'p1', farmId: 'farm_1', category: null })
    expect(zweiter.data).toEqual({ category: 'EIER', subcategory: null })
  })

  it('schreibt nie den Bestand oder andere Felder — nur Kategorie, Unterkategorie, MwSt-Vorbelegung', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 })

    await setzeKategorie({ productId: 'p1', category: 'FLEISCH', subcategory: 'LAMM' })

    const [mitMwst, ohneMwst] = updateMany.mock.calls.map(([aufruf]) => Object.keys(aufruf.data as object).sort())
    expect(mitMwst).toEqual(['category', 'subcategory', 'vatRate'])
    expect(ohneMwst).toEqual(['category', 'subcategory'])
  })

  it('hat das Produkt schon eine Kategorie (oder gehört es fremd), kommt ein Fehler', async () => {
    updateMany.mockResolvedValue({ count: 0 })

    const ergebnis = await setzeKategorie({ productId: 'fremd', category: 'FLEISCH', subcategory: 'LAMM' })

    expect(ergebnis).toEqual({ error: 'Das Produkt hat schon eine Kategorie. Lade die Seite neu.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('lehnt Futtermittel ab, ohne zu schreiben', async () => {
    const ergebnis = await setzeKategorie({ productId: 'p1', category: 'HEU_STROH', subcategory: 'WIESENHEU' })

    expect(ergebnis).toHaveProperty('error')
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('lehnt eine unpassende Unterkategorie ab', async () => {
    const ergebnis = await setzeKategorie({ productId: 'p1', category: 'MILCH', subcategory: 'LAMM' })

    expect(ergebnis).toHaveProperty('error')
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('ohne Anmeldung passiert nichts', async () => {
    getSession.mockResolvedValue(null as never)

    const ergebnis = await setzeKategorie({ productId: 'p1', category: 'FLEISCH', subcategory: 'LAMM' })

    expect(ergebnis).toEqual({ error: 'Bitte melde dich neu an.' })
    expect(updateMany).not.toHaveBeenCalled()
  })
})

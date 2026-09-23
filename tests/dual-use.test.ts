/**
 * Tests für den Dual-Use-Hinweis (Sprint Bereiche 1, Konzept 2.5 und 6.1).
 *
 * Beweist: gleicher Name im selben Bereich → kein Hinweis; im anderen Bereich
 * → Hinweis mit dem Wortlaut aus dem Konzept; ein anderer Hof → kein Hinweis,
 * weil die Abfrage nur den eigenen Hof sieht. Groß- und Kleinschreibung und
 * Ränder zählen nicht. Die Action ist nur lesend und verlangt eine Session.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { product: { findMany: vi.fn() } } }))

import { dualUseHinweis } from '@/lib/dual-use'
import { pruefeDualUse } from '@/server/actions/products'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'

const HINWEIS_MAIS =
  'Du hast schon ein Produkt namens Mais im Bereich Lebensmittel. Das hier wird ein zweites, eigenes Produkt mit eigenem Bestand.'

describe('dualUseHinweis (rein)', () => {
  it('gleicher Name im selben Bereich: kein Hinweis', () => {
    expect(dualUseHinweis({ name: 'Hafer', category: 'GETREIDE_KOERNER' }, [{ name: 'Hafer', category: 'MISCHFUTTER' }])).toBeNull()
  })

  it('gleicher Name im anderen Bereich: Hinweis mit dem Wortlaut aus dem Konzept', () => {
    expect(dualUseHinweis({ name: 'Mais', category: 'GETREIDE_KOERNER' }, [{ name: 'Mais', category: 'GEMUESE' }])).toBe(
      HINWEIS_MAIS
    )
  })

  it('Groß- und Kleinschreibung und Leerzeichen am Rand zählen nicht', () => {
    expect(dualUseHinweis({ name: '  mais ', category: 'GETREIDE_KOERNER' }, [{ name: 'Mais', category: 'GEMUESE' }])).toBe(
      HINWEIS_MAIS
    )
  })

  it('ein ähnlicher, aber anderer Name: kein Hinweis', () => {
    expect(dualUseHinweis({ name: 'Maiskolben', category: 'GETREIDE_KOERNER' }, [{ name: 'Mais', category: 'GEMUESE' }])).toBeNull()
  })

  it('ohne Kategorie noch kein Hinweis — es gibt keinen Bereich zum Vergleichen', () => {
    expect(dualUseHinweis({ name: 'Mais', category: null }, [{ name: 'Mais', category: 'GEMUESE' }])).toBeNull()
  })

  it('nennt den Bereich des VORHANDENEN Produkts', () => {
    expect(dualUseHinweis({ name: 'Mais', category: 'GEMUESE' }, [{ name: 'Mais', category: 'GETREIDE_KOERNER' }])).toContain(
      'im Bereich Futtermittel'
    )
  })
})

describe('pruefeDualUse (Server Action)', () => {
  // Zwei Höfe in der „Datenbank" — die Abfrage muss sich auf den eigenen beschränken.
  const TABELLE = [
    { farmId: 'farm_1', id: 'p_mais_gemuese', name: 'Mais', category: 'GEMUESE' },
    { farmId: 'farm_2', id: 'p_fremd', name: 'Hafer', category: 'GEMUESE' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user_1' } } as never)
    vi.mocked(getFarmForUser).mockResolvedValue({ id: 'farm_1', slug: 'hof-test' } as never)
    vi.mocked(prisma.product.findMany).mockImplementation(((a: {
      where: { farmId: string; name: { equals: string }; id?: { not: string } }
    }) =>
      Promise.resolve(
        TABELLE.filter(
          (p) =>
            p.farmId === a.where.farmId &&
            p.name.toLowerCase() === a.where.name.equals.toLowerCase() &&
            p.id !== a.where.id?.not
        ).map(({ name, category }) => ({ name, category }))
      )) as never)
  })

  it('im anderen Bereich des eigenen Hofs: Hinweis', async () => {
    expect(await pruefeDualUse({ name: 'Mais', category: 'GETREIDE_KOERNER' })).toEqual({ hinweis: HINWEIS_MAIS })
  })

  it('gleichnamiges Produkt eines anderen Hofs: kein Hinweis', async () => {
    expect(await pruefeDualUse({ name: 'Hafer', category: 'GETREIDE_KOERNER' })).toEqual({ hinweis: null })
  })

  it('beim Bearbeiten ist das Produkt selbst kein Zwilling', async () => {
    expect(
      await pruefeDualUse({ name: 'Mais', category: 'GETREIDE_KOERNER', productId: 'p_mais_gemuese' })
    ).toEqual({ hinweis: null })
  })

  it('zu kurzer Name oder keine Kategorie: keine Abfrage', async () => {
    expect(await pruefeDualUse({ name: 'M', category: 'GETREIDE_KOERNER' })).toEqual({ hinweis: null })
    expect(await pruefeDualUse({ name: 'Mais', category: null })).toEqual({ hinweis: null })
    expect(prisma.product.findMany).not.toHaveBeenCalled()
  })

  it('ohne Session: Fehler, keine Abfrage', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    expect(await pruefeDualUse({ name: 'Mais', category: 'GETREIDE_KOERNER' })).toEqual({
      error: 'Bitte melde dich neu an.',
    })
    expect(prisma.product.findMany).not.toHaveBeenCalled()
  })

  it('ungültige Eingabe: Fehler', async () => {
    expect(await pruefeDualUse({ name: 42 })).toEqual({ error: 'Ungültige Eingabe.' })
  })
})

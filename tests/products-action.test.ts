/**
 * Tests für createProduct / updateProduct (Sprint Taxonomie 1).
 *
 * Beweist: Siegel und Unterkategorie werden geschrieben, isOrganic NIE mehr;
 * ein Futtermittel bekommt seine Kennzeichnung (mit bestaetigtAm = jetzt);
 * ein Kategoriewechsel weg von Futtermittel LÖSCHT die Kennzeichnung in
 * derselben Transaktion; ein fremdes Produkt wird nicht angefasst (Besitz in
 * der WHERE-Klausel); ungültige Eingaben kommen als { error } zurück.
 *
 * Prisma, Auth und Next sind gemockt — kein Datenbankzugriff.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    product: { updateMany: vi.fn() },
    futterKennzeichnung: { upsert: vi.fn(), deleteMany: vi.fn() },
  }
  return {
    prisma: {
      product: { create: vi.fn() },
      // Interaktive Transaktion: der Callback bekommt den Mock-Client.
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      __tx: tx,
    },
  }
})

import { createProduct, updateProduct } from '@/server/actions/products'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { revalidatePath } from 'next/cache'

type Tx = {
  product: { updateMany: ReturnType<typeof vi.fn> }
  futterKennzeichnung: { upsert: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> }
}
const tx = (prisma as unknown as { __tx: Tx }).__tx
const getSession = vi.mocked(auth.api.getSession)
const farmForUser = vi.mocked(getFarmForUser)
const productCreate = vi.mocked(prisma.product.create)

const JETZT = new Date('2026-09-21T10:00:00.000Z')

const basis = {
  name: 'Rindfleisch-Paket',
  price: 89,
  unit: 'KG' as const,
  category: 'FLEISCH',
  subcategory: 'RIND',
  labels: ['BIO', 'GENTECHNIKFREI'],
}

const heu = {
  name: 'Heu',
  price: 6.5,
  unit: 'PAKET' as const,
  category: 'FUTTERMITTEL',
  subcategory: 'EINZELFUTTERMITTEL',
  labels: [],
  futter: {
    zielTierarten: ['PFERD', 'RIND'],
    zusammensetzung: 'Heu vom ersten Schnitt',
    analytischeBestandteile: 'Rohprotein 9 %, Rohfaser 28 %',
    zusatzstoffe: '',
    registrierungsnummer: 'AT 1234567',
    gebrauchshinweis: '',
    bestaetigt: true,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(JETZT)
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmForUser.mockResolvedValue({ id: 'farm_1', slug: 'testhof', name: 'Hof Test' } as never)
  productCreate.mockResolvedValue({ id: 'p_neu' } as never)
  tx.product.updateMany.mockResolvedValue({ count: 1 })
  tx.futterKennzeichnung.upsert.mockResolvedValue({})
  tx.futterKennzeichnung.deleteMany.mockResolvedValue({ count: 0 })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createProduct', () => {
  it('schreibt Unterkategorie und Siegel — und isOrganic nie mehr', async () => {
    const ergebnis = await createProduct(basis as never)

    expect(ergebnis).toEqual({ ok: true })
    const data = productCreate.mock.calls[0][0].data as Record<string, unknown>
    expect(data.farmId).toBe('farm_1')
    expect(data.subcategory).toBe('RIND')
    expect(data.labels).toEqual(['BIO', 'GENTECHNIKFREI'])
    expect('isOrganic' in data).toBe(false)
    expect('futter' in data).toBe(false)
    expect(revalidatePath).toHaveBeenCalledWith('/products')
    expect(revalidatePath).toHaveBeenCalledWith('/testhof')
  })

  it('legt bei Futtermitteln die Kennzeichnung mit bestaetigtAm = jetzt an', async () => {
    await createProduct(heu as never)

    const data = productCreate.mock.calls[0][0].data as { futter?: { create: Record<string, unknown> } }
    expect(data.futter?.create).toMatchObject({
      zielTierarten: ['PFERD', 'RIND'],
      zusammensetzung: 'Heu vom ersten Schnitt',
      registrierungsnummer: 'AT 1234567',
      zusatzstoffe: null,
      gebrauchshinweis: null,
      bestaetigtAm: JETZT,
    })
    expect('bestaetigt' in (data.futter?.create ?? {})).toBe(false)
  })

  it('gibt bei ungültiger Eingabe { error } zurück und schreibt nichts', async () => {
    const ergebnis = await createProduct({ ...basis, subcategory: 'KAESE' } as never)

    expect(ergebnis).toEqual({ error: 'Bitte prüfe deine Eingaben.' })
    expect(productCreate).not.toHaveBeenCalled()
  })

  it('verweigert ohne Session', async () => {
    getSession.mockResolvedValue(null as never)
    await expect(createProduct(basis as never)).rejects.toThrow()
    expect(productCreate).not.toHaveBeenCalled()
  })
})

describe('updateProduct', () => {
  it('prüft den Besitz in der WHERE-Klausel und schreibt Siegel statt isOrganic', async () => {
    const ergebnis = await updateProduct('p_1', basis as never)

    expect(ergebnis).toEqual({ ok: true })
    const aufruf = tx.product.updateMany.mock.calls[0][0] as { where: unknown; data: Record<string, unknown> }
    expect(aufruf.where).toEqual({ id: 'p_1', farmId: 'farm_1' })
    expect(aufruf.data.labels).toEqual(['BIO', 'GENTECHNIKFREI'])
    expect('isOrganic' in aufruf.data).toBe(false)
  })

  it('ein fremdes oder fehlendes Produkt: kein Treffer, kein weiterer Schreibzugriff', async () => {
    tx.product.updateMany.mockResolvedValue({ count: 0 })

    const ergebnis = await updateProduct('p_fremd', basis as never)

    expect(ergebnis).toEqual({ error: 'Produkt nicht gefunden.' })
    expect(tx.futterKennzeichnung.upsert).not.toHaveBeenCalled()
    expect(tx.futterKennzeichnung.deleteMany).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('bei Futtermitteln wird die Kennzeichnung angelegt oder aktualisiert', async () => {
    await updateProduct('p_heu', heu as never)

    expect(tx.futterKennzeichnung.upsert).toHaveBeenCalledTimes(1)
    const aufruf = tx.futterKennzeichnung.upsert.mock.calls[0][0] as {
      where: unknown
      create: Record<string, unknown>
      update: Record<string, unknown>
    }
    expect(aufruf.where).toEqual({ productId: 'p_heu' })
    expect(aufruf.create.productId).toBe('p_heu')
    expect(aufruf.update.bestaetigtAm).toEqual(JETZT)
    expect(tx.futterKennzeichnung.deleteMany).not.toHaveBeenCalled()
  })

  it('Kategoriewechsel weg von Futtermittel löscht die Kennzeichnung in derselben Transaktion', async () => {
    // Das Produkt war ein Futtermittel; jetzt speichert der Hof es als Sonstiges.
    const ergebnis = await updateProduct('p_heu', {
      ...heu,
      category: 'SONSTIGES',
      subcategory: null,
      futter: undefined,
    } as never)

    expect(ergebnis).toEqual({ ok: true })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.futterKennzeichnung.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p_heu' } })
    expect(tx.futterKennzeichnung.upsert).not.toHaveBeenCalled()
    const aufruf = tx.product.updateMany.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(aufruf.data.category).toBe('SONSTIGES')
    expect(aufruf.data.subcategory).toBeNull()
  })

  it('eine Kennzeichnung an einer Nicht-Futter-Kategorie wird vom Schema abgewiesen', async () => {
    const ergebnis = await updateProduct('p_1', { ...basis, futter: heu.futter } as never)

    expect(ergebnis).toEqual({ error: 'Bitte prüfe deine Eingaben.' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

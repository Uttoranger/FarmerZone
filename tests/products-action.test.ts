/**
 * Tests für createProduct / updateProduct (Sprint Taxonomie 1).
 *
 * Beweist: Siegel und Unterkategorie werden geschrieben, isOrganic NIE mehr;
 * ein Futtermittel bekommt seine Kennzeichnung (mit bestaetigtAm = jetzt);
 * ein Kategoriewechsel weg von Futtermittel LÖSCHT die Kennzeichnung in
 * derselben Transaktion; ein fremdes Produkt wird nicht angefasst (Besitz in
 * der WHERE-Klausel); ungültige Eingaben kommen als { error } zurück.
 * Seit Sprint Bereiche 1: Futtermittelart, Nettomenge, Rohwerte und Abgabe
 * werden geschrieben, die Registrierungsnummer NICHT mehr (Rückfrage F6).
 *
 * Prisma, Auth und Next sind gemockt — kein Datenbankzugriff.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    product: { updateMany: vi.fn() },
    futterKennzeichnung: { upsert: vi.fn(), deleteMany: vi.fn() },
  }
  return {
    prisma: {
      // findFirst/farm.findUnique seit Nr. 20: Sperre je Gebinde beim Bearbeiten (S7).
      product: { create: vi.fn(), findFirst: vi.fn() },
      farm: { findUnique: vi.fn() },
      // Interaktive Transaktion: der Callback bekommt den Mock-Client.
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      __tx: tx,
    },
  }
})

import { createProduct, updateProduct } from '@/server/actions/products'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { FUTTER_NUR_UEBER_FORMULAR, SPERR_GRUND } from '@/lib/futter-registrierung'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { revalidatePath, updateTag } from 'next/cache'

type Tx = {
  product: { updateMany: ReturnType<typeof vi.fn> }
  futterKennzeichnung: { upsert: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> }
}
const tx = (prisma as unknown as { __tx: Tx }).__tx
const getSession = vi.mocked(auth.api.getSession)
const farmForUser = vi.mocked(getFarmForUser)
const productCreate = vi.mocked(prisma.product.create)
const productFindFirst = vi.mocked(prisma.product.findFirst)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)

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
  price: 45,
  unit: 'BALLEN' as const,
  category: 'HEU_STROH',
  subcategory: 'WIESENHEU',
  labels: [],
  abgabe: 'NUR_BETRIEBE',
  futter: {
    futtermittelart: 'EINZELFUTTERMITTEL',
    zielTierarten: ['PFERD', 'RIND'],
    zusammensetzung: 'Heu vom ersten Schnitt',
    analytischeBestandteile: 'Rohprotein 9 %, Rohfaser 28 %',
    nettoMenge: '300',
    nettoEinheit: 'KG',
    rohprotein: '9,5',
    rohfaser: '',
    rohfett: '',
    rohasche: '',
    zusatzstoffe: '',
    // Altlast: schickt ein alter Tab die Nummer noch mit, wird sie verworfen.
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
  // Futter-Altbestand ohne Verpackung: keine Sperre (src/lib/futter-registrierung.ts).
  productFindFirst.mockResolvedValue({ category: 'HEU_STROH', verpackung: null } as never)
  farmFindUnique.mockResolvedValue({ betriebsnummer: null, betriebsstatus: null } as never)
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

  // Geändert in Nr. 20 (Gate 6, S7): Neue Futtermittel entstehen nur noch im
  // Futter-Formular mit Verkaufsgrößen — dort wird je Größe die Verpackung
  // gesetzt, an der die Sperre hängt. Wie die Kennzeichnung beim Anlegen
  // geschrieben wird (bestaetigtAm = jetzt, keine Registrierungsnummer,
  // Abgabe), prüft jetzt tests/produktfamilie-aktion.test.ts.
  it('legt kein neues Futtermittel an und verweist auf das Futter-Formular', async () => {
    const ergebnis = await createProduct(heu as never)

    expect(ergebnis).toEqual({ error: FUTTER_NUR_UEBER_FORMULAR })
    expect(productCreate).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
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

describe('Cache-Entwertung', () => {
  it('entwertet mit jeder erfolgreichen Änderung auch den Cache der Hofübersicht', async () => {
    // Die Hofübersicht hängt an einem eigenen Fünf-Minuten-Cache, den kein
    // revalidatePath erreicht. Ohne diese Entwertung stand ein ausgeblendetes
    // oder ausverkauftes Produkt dort bis zu fünf Minuten weiter.
    await updateProduct('p_1', basis as never)

    expect(revalidatePath).toHaveBeenCalledWith('/products')
    expect(revalidatePath).toHaveBeenCalledWith('/testhof')
    expect(revalidatePath).toHaveBeenCalledWith('/farm-page')
    expect(updateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG)
  })

  it('entwertet nichts, wenn nichts geschrieben wurde', async () => {
    tx.product.updateMany.mockResolvedValue({ count: 0 })

    await updateProduct('p_fremd', basis as never)

    expect(updateTag).not.toHaveBeenCalled()
  })

  it('ruft updateTag mit genau einem Argument — revalidateTag bräuchte in Next 16 ein zweites', async () => {
    // Festgehalten, weil es eine Versionsfalle ist: revalidateTag(tag) allein
    // warnt in Next 16 zur Laufzeit und ist typseitig unvollständig. updateTag
    // nimmt nur das Etikett, gilt aber ausschließlich in Server Actions.
    await updateProduct('p_1', basis as never)

    expect(vi.mocked(updateTag).mock.calls[0]).toHaveLength(1)
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
      // Das Formular setzt die Abgabe beim Wechsel weg von Futter zurück (P11).
      abgabe: 'ALLE',
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

describe('updateProduct — Sperre je Gebinde (S7, Nr. 20)', () => {
  it('ein gesperrtes Sackerl wird gespeichert, aber als Entwurf — mit dem Grund', async () => {
    productFindFirst.mockResolvedValue({ category: 'HEU_STROH', verpackung: 'ABGEPACKT_ETIKETT' } as never)
    farmFindUnique.mockResolvedValue({ betriebsnummer: 'AT 1234567', betriebsstatus: 'PRIMAERPRODUKTION' } as never)

    const ergebnis = await updateProduct('p_sack', { ...heu, unit: 'STUECK', isAvailable: true } as never)

    expect(ergebnis).toEqual({ ok: true, hinweis: `Als Entwurf gespeichert. ${SPERR_GRUND.heimtierfutter}.` })
    const aufruf = tx.product.updateMany.mock.calls[0][0] as { where: unknown; data: Record<string, unknown> }
    expect(aufruf.where).toEqual({ id: 'p_sack', farmId: 'farm_1' })
    expect(aufruf.data.isAvailable).toBe(false)
    // Die Verpackung kommt aus der Datenbank, nie aus dem Formular — der Hof steht in der WHERE-Klausel.
    expect(productFindFirst).toHaveBeenCalledWith({ where: { id: 'p_sack', farmId: 'farm_1' }, select: { category: true, verpackung: true } })
  })

  it('mit BAES-Meldung geht dasselbe Sackerl online', async () => {
    productFindFirst.mockResolvedValue({ category: 'HEU_STROH', verpackung: 'ABGEPACKT_ETIKETT' } as never)
    farmFindUnique.mockResolvedValue({ betriebsnummer: 'AT 1234567', betriebsstatus: 'REGISTRIERT' } as never)

    const ergebnis = await updateProduct('p_sack', { ...heu, unit: 'STUECK', isAvailable: true } as never)

    expect(ergebnis).toEqual({ ok: true })
    const aufruf = tx.product.updateMany.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(aufruf.data.isAvailable).toBe(true)
  })

  it('ein Bestandsfuttermittel ohne Verpackung bleibt, wie es war', async () => {
    const ergebnis = await updateProduct('p_heu', { ...heu, isAvailable: true } as never)

    expect(ergebnis).toEqual({ ok: true })
    const aufruf = tx.product.updateMany.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(aufruf.data.isAvailable).toBe(true)
    expect(farmFindUnique).not.toHaveBeenCalled()
  })

  it('kein Futter: keine Abfrage; ausgeblendetes Futter: die Kategorie wird gelesen, der Hof nicht', async () => {
    await updateProduct('p_1', basis as never)
    expect(productFindFirst).not.toHaveBeenCalled()

    await updateProduct('p_heu', { ...heu, isAvailable: false } as never)
    expect(productFindFirst).toHaveBeenCalledTimes(1)
    expect(farmFindUnique).not.toHaveBeenCalled()
  })
})

describe('updateProduct — Futter nur über das Futter-Formular (S7, Nachbesserung Nr. 20)', () => {
  it('ein Nicht-Futter-Produkt lässt sich nicht auf eine Futter-Kategorie umstellen — nichts geschrieben', async () => {
    productFindFirst.mockResolvedValue({ category: 'FLEISCH', verpackung: null } as never)

    const ergebnis = await updateProduct('p_1', { ...heu, category: 'MISCHFUTTER', subcategory: null, futter: { ...heu.futter, futtermittelart: 'ALLEINFUTTERMITTEL' } } as never)

    expect(ergebnis).toEqual({ error: FUTTER_NUR_UEBER_FORMULAR })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(tx.futterKennzeichnung.upsert).not.toHaveBeenCalled()
  })

  it('auch ausgeblendet nicht — sonst ginge es über den Schalter „Sichtbar" an der Sperre vorbei', async () => {
    productFindFirst.mockResolvedValue({ category: null, verpackung: null } as never)

    const ergebnis = await updateProduct('p_1', { ...heu, isAvailable: false } as never)

    expect(ergebnis).toEqual({ error: FUTTER_NUR_UEBER_FORMULAR })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('ein Futtermittel bleibt als Futtermittel bearbeitbar (auch Altbestand ohne Verpackung)', async () => {
    productFindFirst.mockResolvedValue({ category: 'HEU_STROH', verpackung: null } as never)

    const ergebnis = await updateProduct('p_heu', { ...heu, isAvailable: true } as never)

    expect(ergebnis).toEqual({ ok: true })
    expect(tx.futterKennzeichnung.upsert).toHaveBeenCalledTimes(1)
  })

  it('der Besitz steht in der Abfrage; ein fremdes Produkt bekommt „nicht gefunden"', async () => {
    productFindFirst.mockResolvedValue(null as never)

    const ergebnis = await updateProduct('p_fremd', heu as never)

    expect(ergebnis).toEqual({ error: 'Produkt nicht gefunden.' })
    expect(productFindFirst).toHaveBeenCalledWith({ where: { id: 'p_fremd', farmId: 'farm_1' }, select: { category: true, verpackung: true } })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

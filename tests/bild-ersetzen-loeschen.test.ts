/**
 * Ersetzte und gelöschte Bilder verlassen den Bild-Speicher (Audit A8, Nachtlauf Nr. 206).
 *
 * Ursache: Logo, Titelbild und Produktbild wurden beim Ersetzen nur in der Datenbank
 * umgehängt, ein gelöschtes Produkt nur als Zeile entfernt — die Dateien blieben als
 * Datenreste im Speicher (seit Nr. 108 löscht der Upload das ersetzte Bild bewusst nicht
 * mehr, weil das Speichern danach noch scheitern kann).
 *
 * Beweist (Aktionen mit Attrappen für Prisma, Bild-Speicher und Sentry):
 *  - Ersetzen löscht das alte Bild — erst NACH dem erfolgreichen Schreiben in der
 *    Datenbank, und nur, wenn keine andere Zeile mehr auf die Datei zeigt.
 *  - Ein fremder Pfad (anderer Hof, fremder Speicher, fremder Server) wird nie gelöscht.
 *  - Scheitert das Löschen: Die Aktion gilt trotzdem, Sentry bekommt genau eine Meldung
 *    ohne Adresse.
 *  - Ein archiviertes Produkt (mit Bestellungen, ausgeblendet) behält sein Bild.
 *  - Gegenproben: unverändertes Bild, gescheitertes Schreiben, Bild noch in Verwendung → kein Löschen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@vercel/blob', () => ({ del: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))

const db = vi.hoisted(() => {
  const tx = {
    product: { updateMany: vi.fn() },
    futterKennzeichnung: { upsert: vi.fn(), deleteMany: vi.fn() },
  }
  return {
    tx,
    farm: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    farmValue: { deleteMany: vi.fn(), createMany: vi.fn() },
    product: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    orderItem: { count: vi.fn() },
    farmPhoto: { count: vi.fn() },
    statusPost: { count: vi.fn() },
    meldung: { count: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (t: typeof tx) => Promise<unknown>)(tx) : Promise.all(arg as unknown[])
    ),
  }
})
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { del } from '@vercel/blob'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { saveAppearanceAction, updateFarmBannerAction, updateFarmLogoAction } from '@/server/actions/appearance'
import { deleteProduct, updateProduct, updateProductImageAction } from '@/server/actions/products'
import type { ProductFormData } from '@/schemas/product'

const HOF = 'farm_meiner'
const SPEICHER = 'abc123'
const SCHLUESSEL = 'vercel_blob_rw_ABC123_geheimnisNurFuerTests'
const bild = (pfad: string) => `https://${SPEICHER}.public.blob.vercel-storage.com/farms/${HOF}/${pfad}`
const ALT = bild('logo/1.webp')
const NEU = bild('logo/2.webp')

const FREMDE = [
  ['Bild eines anderen Hofes', `https://${SPEICHER}.public.blob.vercel-storage.com/farms/farm_fremder/logo/1.webp`],
  ['fremder Blob-Speicher mit unserem Pfad', `https://boese99.public.blob.vercel-storage.com/farms/${HOF}/logo/1.webp`],
  ['fremder Server', `https://beispiel.at/farms/${HOF}/logo/1.webp`],
  ['Startseiten-Ordner', `https://${SPEICHER}.public.blob.vercel-storage.com/startseite/bilder/1.webp`],
] as const

const delMock = vi.mocked(del)
const meldung = vi.mocked(Sentry.captureMessage)

/** Reihenfolge der Aufrufe: das Schreiben in der Datenbank muss vor dem Löschen stehen. */
const reihenfolge: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  reihenfolge.length = 0
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', SCHLUESSEL)
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'nutzer_1' } } as never)
  vi.mocked(getFarmForUser).mockResolvedValue({ id: HOF, slug: 'mein-hof' } as never)
  for (const zaehler of [db.farm.count, db.product.count, db.farmPhoto.count, db.statusPost.count, db.meldung.count]) {
    zaehler.mockResolvedValue(0)
  }
  db.farm.update.mockImplementation(async () => {
    reihenfolge.push('db')
    return {}
  })
  db.product.update.mockImplementation(async () => {
    reihenfolge.push('db')
    return {}
  })
  db.tx.product.updateMany.mockImplementation(async () => {
    reihenfolge.push('db')
    return { count: 1 }
  })
  db.product.deleteMany.mockImplementation(async () => {
    reihenfolge.push('db')
    return { count: 1 }
  })
  db.product.updateMany.mockResolvedValue({ count: 1 })
  db.orderItem.count.mockResolvedValue(0)
  delMock.mockImplementation(async () => {
    reihenfolge.push('del')
  })
})

function hofMit(felder: { logoUrl?: string | null; bannerUrl?: string | null; bannerValue?: string | null }) {
  db.farm.findUnique.mockResolvedValue({ id: HOF, slug: 'mein-hof', logoUrl: null, bannerUrl: null, bannerValue: null, ...felder })
}

/** Ein gültiges Produktformular (wie tests/products-action.test.ts) mit dem gewünschten Bild. */
function formular(imageUrl: string): ProductFormData {
  return { name: 'Bergkäse', price: 5, unit: 'KG', category: 'MILCH', labels: [], imageUrl } as unknown as ProductFormData
}

describe('Ersetzen löscht das alte Bild — nach dem Schreiben', () => {
  it('Logo: altes Logo gelöscht, nach dem Update, mit dem Schlüssel des Speichers', async () => {
    hofMit({ logoUrl: ALT })
    expect(await updateFarmLogoAction(NEU)).toEqual({})
    expect(delMock).toHaveBeenCalledTimes(1)
    expect(delMock).toHaveBeenCalledWith(ALT, { token: SCHLUESSEL })
    expect(reihenfolge).toEqual(['db', 'del'])
  })

  it('Logo entfernt (null): das alte Logo hängt an nichts mehr und geht ebenfalls', async () => {
    hofMit({ logoUrl: ALT })
    expect(await updateFarmLogoAction(null)).toEqual({})
    expect(delMock).toHaveBeenCalledWith(ALT, { token: SCHLUESSEL })
  })

  it('Titelbild: altes Titelbild gelöscht', async () => {
    const alt = bild('banner/1.webp')
    hofMit({ bannerUrl: alt })
    expect(await updateFarmBannerAction('PHOTO', bild('banner/2.webp'))).toEqual({})
    expect(delMock).toHaveBeenCalledWith(alt, { token: SCHLUESSEL })
    expect(reihenfolge).toEqual(['db', 'del'])
  })

  it('Auftritt speichern: Logo und Titelbild ersetzt → beide alten gelöscht, nach der Transaktion', async () => {
    const altBanner = bild('banner/1.webp')
    hofMit({ logoUrl: ALT, bannerUrl: altBanner })
    expect(await saveAppearanceAction({ logoUrl: NEU, bannerUrl: bild('banner/2.webp'), bannerType: 'PHOTO' } as never)).toEqual({})
    expect(delMock.mock.calls.map((c) => c[0]).sort()).toEqual([ALT, altBanner].sort())
    expect(reihenfolge).toEqual(['db', 'del', 'del'])
  })

  it('Auftritt speichern ohne Bildfelder: nichts gelöscht (ein fehlendes Feld bleibt, wie es ist)', async () => {
    hofMit({ logoUrl: ALT, bannerUrl: bild('banner/1.webp') })
    expect(await saveAppearanceAction({ tagline: 'Vom Hof' } as never)).toEqual({})
    expect(delMock).not.toHaveBeenCalled()
  })

  it('Produktbild (Hofseite): altes Bild gelöscht, nach dem Update', async () => {
    const alt = bild('product/1.webp')
    db.product.findFirst.mockResolvedValue({ id: 'p_1', imageUrl: alt })
    expect(await updateProductImageAction('p_1', bild('product/2.webp'))).toEqual({})
    expect(delMock).toHaveBeenCalledWith(alt, { token: SCHLUESSEL })
    expect(reihenfolge).toEqual(['db', 'del'])
  })

  it('Produkt bearbeiten mit neuem Bild: altes Bild gelöscht, nach dem Schreiben', async () => {
    const alt = bild('product/1.webp')
    db.product.findFirst.mockResolvedValue({ imageUrl: alt })
    expect(await updateProduct('p_1', formular(bild('product/2.webp')))).toEqual({ ok: true })
    expect(delMock).toHaveBeenCalledWith(alt, { token: SCHLUESSEL })
    expect(reihenfolge).toEqual(['db', 'del'])
  })

  it('Produkt löschen (ohne Bestellungen): Bild gelöscht, nach dem Löschen der Zeile', async () => {
    const alt = bild('product/1.webp')
    db.product.findFirst.mockResolvedValue({ id: 'p_1', imageUrl: alt })
    expect(await deleteProduct('p_1')).toEqual({ archiviert: false })
    expect(delMock).toHaveBeenCalledWith(alt, { token: SCHLUESSEL })
    expect(reihenfolge).toEqual(['db', 'del'])
  })
})

describe('fremder Pfad wird nie gelöscht', () => {
  it.each(FREMDE)('Logo: %s', async (_name, fremd) => {
    hofMit({ logoUrl: fremd })
    expect(await updateFarmLogoAction(NEU)).toEqual({})
    expect(delMock).not.toHaveBeenCalled()
  })

  it.each(FREMDE)('Produkt löschen: %s', async (_name, fremd) => {
    db.product.findFirst.mockResolvedValue({ id: 'p_1', imageUrl: fremd })
    expect(await deleteProduct('p_1')).toEqual({ archiviert: false })
    expect(delMock).not.toHaveBeenCalled()
  })
})

describe('Löschen scheitert → Aktion gilt, Sentry einmal', () => {
  it('Logo: Ergebnis wie ohne Fehler, genau eine Meldung, ohne Adresse', async () => {
    hofMit({ logoUrl: ALT })
    delMock.mockRejectedValue(new Error(`kaputt ${ALT}`))
    expect(await updateFarmLogoAction(NEU)).toEqual({})
    expect(meldung).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(meldung.mock.calls[0])).not.toContain(HOF)
    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled()
  })

  it('Produkt löschen: gelöscht bleibt gelöscht, genau eine Meldung', async () => {
    db.product.findFirst.mockResolvedValue({ id: 'p_1', imageUrl: bild('product/1.webp') })
    delMock.mockRejectedValue(new Error('Speicher weg'))
    expect(await deleteProduct('p_1')).toEqual({ archiviert: false })
    expect(meldung).toHaveBeenCalledTimes(1)
  })

  it('Prüfung „noch in Verwendung“ scheitert: kein Löschen, Aktion gilt, eine Meldung', async () => {
    hofMit({ logoUrl: ALT })
    db.farmPhoto.count.mockRejectedValue(new Error('DB weg'))
    expect(await updateFarmLogoAction(NEU)).toEqual({})
    expect(delMock).not.toHaveBeenCalled()
    expect(meldung).toHaveBeenCalledTimes(1)
  })
})

describe('archiviertes Produkt behält sein Bild', () => {
  it('mit Bestellungen: ausgeblendet, kein Löschen', async () => {
    db.product.findFirst.mockResolvedValue({ id: 'p_1', imageUrl: bild('product/1.webp') })
    db.orderItem.count.mockResolvedValue(2)
    expect(await deleteProduct('p_1')).toEqual({ archiviert: true })
    expect(delMock).not.toHaveBeenCalled()
  })

  it('Bestellung kam zwischen Zählen und Löschen (P2003): ausgeblendet, kein Löschen', async () => {
    db.product.findFirst.mockResolvedValue({ id: 'p_1', imageUrl: bild('product/1.webp') })
    db.product.deleteMany.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Foreign key', { code: 'P2003', clientVersion: 'test' }))
    expect(await deleteProduct('p_1')).toEqual({ archiviert: true })
    expect(delMock).not.toHaveBeenCalled()
  })
})

describe('Gegenproben: kein Löschen', () => {
  it('unverändertes Bild', async () => {
    hofMit({ logoUrl: ALT })
    await updateFarmLogoAction(ALT)
    db.product.findFirst.mockResolvedValue({ imageUrl: ALT })
    await updateProduct('p_1', formular(ALT))
    expect(delMock).not.toHaveBeenCalled()
  })

  it('Schreiben in der Datenbank scheitert: das alte Bild bleibt', async () => {
    hofMit({ logoUrl: ALT })
    db.farm.update.mockRejectedValue(new Error('DB weg'))
    await expect(updateFarmLogoAction(NEU)).rejects.toThrow()
    expect(delMock).not.toHaveBeenCalled()
  })

  it('Produkt nicht gefunden beim Speichern: das alte Bild bleibt', async () => {
    db.product.findFirst.mockResolvedValue({ imageUrl: bild('product/1.webp') })
    db.tx.product.updateMany.mockResolvedValue({ count: 0 })
    expect(await updateProduct('p_1', formular(bild('product/2.webp')))).toEqual({ error: 'Produkt nicht gefunden.' })
    expect(delMock).not.toHaveBeenCalled()
  })

  it.each([
    ['ein anderes Feld des Hofs', () => db.farm.count],
    ['ein anderes Produkt', () => db.product.count],
    ['ein Galeriefoto', () => db.farmPhoto.count],
    ['ein Beitrag', () => db.statusPost.count],
    ['eine Meldung', () => db.meldung.count],
  ])('Bild hängt noch an %s', async (_name, zaehler) => {
    zaehler().mockResolvedValue(1)
    hofMit({ logoUrl: ALT })
    expect(await updateFarmLogoAction(NEU)).toEqual({})
    expect(delMock).not.toHaveBeenCalled()
    expect(meldung).not.toHaveBeenCalled()
  })

  it('die Verwendung wird mit der genauen Adresse gesucht', async () => {
    hofMit({ logoUrl: ALT })
    await updateFarmLogoAction(NEU)
    expect(db.product.count).toHaveBeenCalledWith({ where: { imageUrl: ALT } })
    expect(db.farm.count).toHaveBeenCalledWith({ where: { OR: [{ logoUrl: ALT }, { bannerUrl: ALT }, { bannerValue: ALT }] } })
  })
})

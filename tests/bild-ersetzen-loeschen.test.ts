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
import { readFileSync } from 'node:fs'
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
    startseiteBlock: { count: vi.fn() },
    startseiteFassung: { findMany: vi.fn() },
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
  for (const zaehler of [db.farm.count, db.product.count, db.farmPhoto.count, db.statusPost.count, db.meldung.count, db.startseiteBlock.count]) {
    zaehler.mockResolvedValue(0)
  }
  db.startseiteFassung.findMany.mockResolvedValue([])
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

  it('Logo entfernt (null): das alte Logo hängt an nichts mehr und geht ebenfalls, nach dem Update', async () => {
    hofMit({ logoUrl: ALT })
    expect(await updateFarmLogoAction(null)).toEqual({})
    expect(delMock).toHaveBeenCalledWith(ALT, { token: SCHLUESSEL })
    expect(reihenfolge).toEqual(['db', 'del'])
  })

  it('Altbestand: Foto-Adresse in bannerValue durch einen Verlauf ersetzt → altes Foto gelöscht, nach der Transaktion', async () => {
    const alt = bild('banner/1.webp')
    hofMit({ bannerValue: alt })
    expect(await saveAppearanceAction({ bannerType: 'GRADIENT', bannerValue: 'verlauf-wiese' } as never)).toEqual({})
    expect(delMock).toHaveBeenCalledTimes(1)
    expect(delMock).toHaveBeenCalledWith(alt, { token: SCHLUESSEL })
    expect(reihenfolge).toEqual(['db', 'del'])
  })

  it('Altbestand: dieselbe Adresse zieht von bannerValue nach bannerUrl um → bleibt (die Zeile zeigt noch darauf)', async () => {
    const alt = bild('banner/1.webp')
    hofMit({ bannerValue: alt })
    // Nach dem Schreiben trägt der Hof die Adresse in bannerUrl: die Zählung findet ihn.
    db.farm.count.mockImplementation((async (arg: { where: { OR: Array<Record<string, string>> } }) =>
      arg.where.OR.some((feld) => feld.bannerUrl === alt) ? 1 : 0) as never)
    expect(await saveAppearanceAction({ bannerType: 'PHOTO', bannerUrl: alt, bannerValue: null } as never)).toEqual({})
    expect(db.farm.count).toHaveBeenCalled()
    expect(delMock).not.toHaveBeenCalled()
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

  it.each(FREMDE)('Produktbild (Hofseite): %s', async (_name, fremd) => {
    db.product.findFirst.mockResolvedValue({ id: 'p_1', imageUrl: fremd })
    expect(await updateProductImageAction('p_1', bild('product/2.webp'))).toEqual({})
    expect(delMock).not.toHaveBeenCalled()
  })

  it.each(FREMDE)('Produkt bearbeiten: %s', async (_name, fremd) => {
    db.product.findFirst.mockResolvedValue({ imageUrl: fremd })
    expect(await updateProduct('p_1', formular(bild('product/2.webp')))).toEqual({ ok: true })
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
    ['ein Block der Startseite', () => db.startseiteBlock.count],
  ])('Bild hängt noch an %s', async (_name, zaehler) => {
    zaehler().mockResolvedValue(1)
    hofMit({ logoUrl: ALT })
    expect(await updateFarmLogoAction(NEU)).toEqual({})
    expect(delMock).not.toHaveBeenCalled()
    expect(meldung).not.toHaveBeenCalled()
  })

  it('Bild steht noch in einer Fassung der Startseite (verschachtelt): bleibt — Logo und Produkt', async () => {
    db.startseiteFassung.findMany.mockResolvedValue([
      { inhalt: { bloecke: [{ art: 'hof', felder: { bildUrl: bild('product/1.webp') } }] } },
      { inhalt: [{ bildUrl: ALT }] },
    ])
    hofMit({ logoUrl: ALT })
    expect(await updateFarmLogoAction(NEU)).toEqual({})
    db.product.findFirst.mockResolvedValue({ id: 'p_1', imageUrl: bild('product/1.webp') })
    expect(await deleteProduct('p_1')).toEqual({ archiviert: false })
    expect(delMock).not.toHaveBeenCalled()
    expect(meldung).not.toHaveBeenCalled()
  })

  it('Fassungen mit anderen Bildern halten das alte Bild nicht fest', async () => {
    db.startseiteFassung.findMany.mockResolvedValue([{ inhalt: { bloecke: [{ bildUrl: NEU }, { bildUrl: bild('logo/9.webp') }] } }])
    hofMit({ logoUrl: ALT })
    expect(await updateFarmLogoAction(NEU)).toEqual({})
    expect(delMock).toHaveBeenCalledWith(ALT, { token: SCHLUESSEL })
  })

  it('die Verwendung wird mit der genauen Adresse gesucht', async () => {
    hofMit({ logoUrl: ALT })
    await updateFarmLogoAction(NEU)
    expect(db.product.count).toHaveBeenCalledWith({ where: { imageUrl: ALT } })
    expect(db.farm.count).toHaveBeenCalledWith({ where: { OR: [{ logoUrl: ALT }, { bannerUrl: ALT }, { bannerValue: ALT }] } })
    expect(db.startseiteBlock.count).toHaveBeenCalledWith({ where: { bildUrl: ALT } })
  })
})

/*
 * Wache: Die Prüfung „noch in Verwendung“ steht seit Nr. 213.4 EINMAL in
 * src/server/bild-loeschen.ts (keine 'use server'-Datei, also kein öffentlicher
 * Endpunkt); beide Aktionen importieren sie und haben keine eigene Kopie mehr.
 * Maßgeblich ist ladeBildVerwendung (src/server/betrieb-bilder.ts): Jede Tabelle und
 * jedes Feld, das dort gelesen wird, muss auch im Helfer stehen — sonst würde ein
 * neues Bildfeld still übersehen und sein Bild endgültig gelöscht.
 */
describe('Wache: Prüfung „noch in Verwendung“ deckt ladeBildVerwendung ab', () => {
  const quelle = readFileSync('src/server/betrieb-bilder.ts', 'utf8')
  const rumpf = quelle.slice(quelle.indexOf('export async function ladeBildVerwendung'), quelle.indexOf('export async function findeBilderOhneVerwendung'))
  const tabellen = [...new Set([...rumpf.matchAll(/prisma\.(\w+)\.findMany/g)].map((m) => m[1]))]
  const felder = [...new Set([...rumpf.matchAll(/select: \{ (\w+): true \}/g)].map((m) => m[1]))].filter((f) => f !== 'id')

  it('die Liste aus ladeBildVerwendung ist nicht leer (sonst prüft die Wache nichts)', () => {
    expect(tabellen.length).toBeGreaterThanOrEqual(7)
    expect(felder).toContain('bildUrl')
  })

  it('src/server/bild-loeschen.ts', () => {
    const text = readFileSync('src/server/bild-loeschen.ts', 'utf8')
    expect(text.startsWith("'use server'")).toBe(false)
    const rumpfHelfer = text.slice(text.indexOf('export async function entferneAltesBild'), text.indexOf('await del('))
    expect(rumpfHelfer.length).toBeGreaterThan(0)
    for (const tabelle of tabellen) expect(rumpfHelfer, tabelle).toContain(`prisma.${tabelle}`)
    for (const feld of felder) expect(rumpfHelfer, feld).toMatch(new RegExp(`\\b${feld}\\b`))
  })

  it.each(['src/server/actions/appearance.ts', 'src/server/actions/products.ts'])('%s importiert den Helfer und hat keine eigene Kopie (Nr. 213.4)', (datei) => {
    const text = readFileSync(datei, 'utf8')
    expect(text).toMatch(/import \{ entferneAltesBild \} from '@\/server\/bild-loeschen'/)
    expect(text).not.toContain('function entferneAltesBild')
    expect(text).not.toContain('await del(')
  })
})

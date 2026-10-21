/**
 * Abholhinweise (Register N23, Nr. 123) gegen ein ECHTES Postgres — die
 * Spalte `Product.abholhinweise` aus der Migration 20261021100000_abholhinweise
 * (Aufzählung als Liste, NOT NULL mit leerer Liste als Standard).
 *
 * Die Aussagen, die nur die Datenbank beantwortet:
 *   1. Anlegen über das Futter-Formular (legeFutterFamilieAn): Jede Größe der
 *      neuen Familie übernimmt die Hinweise — geordnet wie die Auswahl.
 *   2. Ändern über den Produktdialog (updateProduct): eine neue Wahl mit
 *      Haken wird geschrieben; ohne Haken abgelehnt und nichts geändert (E10a).
 *   3. Ein Produkt aus dem Hofladen hat die leere Liste — auch neu angelegt
 *      über den Bestand, der die Spalte nicht kennt (Standard der Migration).
 *   4. Lesen: die Produktliste des Hofs, die Produktseite (getPublicFarm) und
 *      „Futter kaufen" (getFutterKaufen) liefern die gespeicherten Hinweise.
 * Geprüft wird der Zustand danach (TESTING_GUIDELINES §1).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { headers } from 'next/headers'
import { legeFutterFamilieAn } from '@/server/actions/produktfamilie'
import { createProduct, updateProduct } from '@/server/actions/products'
import { getProductsForFarm } from '@/server/queries/products'
import { getPublicFarm } from '@/server/queries/farm'
import { getFutterKaufen } from '@/server/queries/futter-kaufen'
import { prisma } from '@/lib/prisma'
import { erstelleHof, erstelleHofMitAnmeldung, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

const STANDORT = { latitude: 47.31, longitude: 13.21 }

/** Ein angemeldeter, sichtbarer Hof mit LFBIS-Nummer, Standort und Abholfenster. */
async function lfbisHof() {
  const { farm, cookie } = await erstelleHofMitAnmeldung({
    ...STANDORT,
    betriebsnummer: 'LFBIS 1234567',
    betriebsstatus: 'PRIMAERPRODUKTION',
    pickupSlots: { create: [{ dayOfWeek: 6, startTime: '08:00', endTime: '12:00' }] },
  })
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return farm
}

const HEU = {
  name: 'Bergwiesen-Heu',
  description: '',
  category: 'HEU_STROH',
  subcategory: 'WIESENHEU',
  bio: false,
  abgabe: 'ALLE',
  abholhinweise: ['NACH_ABSPRACHE', 'ANHAENGER_NOETIG'],
  kennzeichnung: {
    futtermittelart: 'EINZELFUTTERMITTEL',
    zielTierarten: ['PFERD'],
    zusammensetzung: 'Wiesenheu, erster Schnitt',
    analytischeBestandteile: 'Rohprotein 9 %, Rohfaser 28 %',
    rohprotein: null,
    rohfaser: null,
    rohfett: null,
    rohasche: null,
    zusatzstoffe: '',
    gebrauchshinweis: '',
    bestaetigt: true,
  },
  groessen: [
    { bezeichnung: 'Kleinballen', verpackung: 'LOSE_BALLEN', unit: 'BALLEN', nettoMenge: 15, price: 4.5, stock: 40 },
    { bezeichnung: 'Rundballen', verpackung: 'LOSE_BALLEN', unit: 'BALLEN', nettoMenge: 250, price: 45, stock: 8 },
  ],
}

/** Die Formularwerte des Produktdialogs für ein gespeichertes Futter — wie toFormDefaults sie belegt. */
async function dialogWerte(productId: string, farmId: string) {
  const p = (await getProductsForFarm(farmId)).find((x) => x.id === productId)
  if (!p?.futter) throw new Error('Futter fehlt')
  return {
    name: p.name,
    description: p.description ?? '',
    imageUrl: p.imageUrl ?? '',
    category: p.category,
    subcategory: p.subcategory,
    labels: p.labels,
    futter: { ...p.futter, zusatzstoffe: p.futter.zusatzstoffe ?? '', gebrauchshinweis: p.futter.gebrauchshinweis ?? '', bestaetigt: false },
    abgabe: p.abgabe,
    abholhinweise: p.abholhinweise,
    countsTowardLimit: p.countsTowardLimit,
    price: p.price,
    vatRate: p.vatRate,
    unit: p.unit,
    unitSize: p.unitSize,
    stock: p.stock,
    isAvailable: p.isAvailable,
    allergens: p.allergens,
    requiresCool: p.requiresCool,
    requiresFreezer: p.requiresFreezer,
    seasonStart: p.seasonStart,
    seasonEnd: p.seasonEnd,
    unavailableReason: p.unavailableReason ?? '',
  }
}

describe('Abholhinweise — echte Datenbank', () => {
  it('anlegen: jede Größe der neuen Familie übernimmt die Hinweise, geordnet wie die Auswahl', async () => {
    const farm = await lfbisHof()

    expect(await legeFutterFamilieAn(HEU)).toMatchObject({ ok: true, online: 2 })

    const groessen = await prisma.product.findMany({ where: { farmId: farm.id }, orderBy: { price: 'asc' }, select: { name: true, abholhinweise: true, familieId: true } })
    expect(groessen.map((g) => [g.name, g.abholhinweise])).toEqual([
      ['Bergwiesen-Heu Kleinballen', ['ANHAENGER_NOETIG', 'NACH_ABSPRACHE']],
      ['Bergwiesen-Heu Rundballen', ['ANHAENGER_NOETIG', 'NACH_ABSPRACHE']],
    ])
    expect(new Set(groessen.map((g) => g.familieId)).size).toBe(1)
  })

  it('ändern: mit Haken geschrieben, ohne Haken abgelehnt und nichts geändert (E10a)', async () => {
    const farm = await lfbisHof()
    await legeFutterFamilieAn(HEU)
    const rund = await prisma.product.findFirstOrThrow({ where: { farmId: farm.id, name: { endsWith: 'Rundballen' } } })
    const werte = await dialogWerte(rund.id, farm.id)

    const ohneHaken = await updateProduct(rund.id, { ...werte, abholhinweise: ['FRONTLADER'] } as never, werte.stock)
    expect(ohneHaken).toMatchObject({ code: 'BESTAETIGUNG' })
    expect((await prisma.product.findUniqueOrThrow({ where: { id: rund.id } })).abholhinweise).toEqual(['ANHAENGER_NOETIG', 'NACH_ABSPRACHE'])

    const mitHaken = await updateProduct(rund.id, { ...werte, abholhinweise: ['FRONTLADER', 'ANHAENGER_NOETIG'], futter: { ...werte.futter, bestaetigt: true } } as never, werte.stock)
    expect(mitHaken).toEqual({ ok: true })
    expect((await prisma.product.findUniqueOrThrow({ where: { id: rund.id } })).abholhinweise).toEqual(['ANHAENGER_NOETIG', 'FRONTLADER'])
    // Die andere Größe derselben Familie bleibt, wie sie war.
    const klein = await prisma.product.findFirstOrThrow({ where: { farmId: farm.id, name: { endsWith: 'Kleinballen' } } })
    expect(klein.abholhinweise).toEqual(['ANHAENGER_NOETIG', 'NACH_ABSPRACHE'])
  })

  it('ein Produkt aus dem Hofladen hat die leere Liste — über die Aktion und über den Standard der Spalte', async () => {
    const farm = await lfbisHof()

    expect(await createProduct({ name: 'Freilandeier', price: 4.2, unit: 'STUECK', category: 'EIER', stock: 10, abholhinweise: ['FRONTLADER'] } as never)).toMatchObject({ ok: true })
    // Ein Schreibweg, der die Spalte nicht kennt (alter Code im Deploy-Fenster): Standard der Migration.
    const alt = await prisma.product.create({ data: { farmId: farm.id, name: 'Honig', price: '8.00', unit: 'STUECK', stock: 3 } })

    const eier = await prisma.product.findFirstOrThrow({ where: { farmId: farm.id, name: 'Freilandeier' } })
    expect(eier.abholhinweise).toEqual([])
    expect(alt.abholhinweise).toEqual([])
    const roh = await prisma.$queryRaw<{ leer: boolean }[]>`SELECT "abholhinweise" = ARRAY[]::"Abholhinweis"[] AS leer FROM "Product" WHERE id = ${alt.id}`
    expect(roh).toEqual([{ leer: true }])
  })

  it('lesen: Produktliste, Produktseite und „Futter kaufen" liefern die gespeicherten Hinweise', async () => {
    const farm = await lfbisHof()
    await legeFutterFamilieAn(HEU)
    const { farm: nachbar } = await erstelleHof({ latitude: 47.33, longitude: 13.23, betriebsnummer: null })

    const liste = await getProductsForFarm(farm.id)
    expect(liste.map((p) => p.abholhinweise)).toEqual([
      ['ANHAENGER_NOETIG', 'NACH_ABSPRACHE'],
      ['ANHAENGER_NOETIG', 'NACH_ABSPRACHE'],
    ])
    const seite = await getPublicFarm(farm.slug)
    expect(seite?.products.map((p) => p.abholhinweise)).toEqual([
      ['ANHAENGER_NOETIG', 'NACH_ABSPRACHE'],
      ['ANHAENGER_NOETIG', 'NACH_ABSPRACHE'],
    ])
    const futter = await getFutterKaufen(nachbar.id, new Date('2026-10-19T08:00:00Z'))
    if (!futter?.eigenerStandort) throw new Error('Futter kaufen ohne Standort')
    expect(futter.produkte.filter((p) => p.farmId === farm.id).map((p) => p.abholhinweise)).toEqual([
      ['ANHAENGER_NOETIG', 'NACH_ABSPRACHE'],
      ['ANHAENGER_NOETIG', 'NACH_ABSPRACHE'],
    ])
  })
})

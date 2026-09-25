/**
 * Die Produktabbildung der Hofseite (src/server/queries/farm.ts,
 * alsOeffentlichesProdukt) seit Bereiche 2: Was von der Futter-Kennzeichnung
 * an den Browser geht.
 *
 * Beweist: Decimal und Date sind gewandelt; die Altlast-Spalte
 * registrierungsnummer verlässt den Server nicht; die Betriebsnummer ist
 * aufgelöst — die des Hofs vor der Altlast; die Hof-Nummer selbst steht nicht
 * im Hof-Objekt. Für Kundenansicht UND Hof-Vorschau.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findUnique: vi.fn() } } }))

import { getOwnerFarm, getPublicFarm } from '@/server/queries/farm'
import { prisma } from '@/lib/prisma'

const findUnique = vi.mocked(prisma.farm.findUnique)

/** Schlanke Decimal-Attrappe: Die Abbildung ruft nur Number()/toString().
 *  Bewusst nicht Prisma.Decimal — der Import der Client-Laufzeit bremst die
 *  parallele Suite spürbar (und die E-Mail-Tests laufen dann ins Zeitlimit). */
const dezimal = (wert: string) => ({ toString: () => wert, valueOf: () => Number(wert) })

function futter(teil: Record<string, unknown> = {}) {
  return {
    futtermittelart: 'EINZELFUTTERMITTEL',
    zielTierarten: ['PFERD'],
    zusammensetzung: 'Wiesenheu',
    analytischeBestandteile: 'Rohprotein 9 %',
    zusatzstoffe: null,
    gebrauchshinweis: null,
    nettoMenge: dezimal('300.000'),
    nettoEinheit: 'KG',
    rohprotein: dezimal('9.50'),
    rohfaser: null,
    rohfett: null,
    rohasche: null,
    registrierungsnummer: 'ALT-12345',
    bestaetigtAm: new Date('2026-09-20T08:00:00Z'),
    ...teil,
  }
}

function rohHof(betriebsnummer: string | null, produktFutter: unknown) {
  return {
    id: 'farm_1',
    slug: 'hof-test',
    name: 'Hof Test',
    ownerName: 'Max Mustermann',
    description: '',
    address: 'Teststraße 1',
    postalCode: '4910',
    city: 'Testdorf',
    phone: '+43 660 0000000',
    email: 'hof@example.com',
    logoUrl: null,
    bannerUrl: null,
    tagline: null,
    foundedYear: null,
    aboutText: null,
    bannerType: 'GRADIENT',
    bannerValue: null,
    bannerFocusY: 50,
    sectionsConfig: [],
    acceptsOnline: true,
    acceptsOnsite: true,
    stripeAccountReady: false,
    isPaused: false,
    pauseMessage: null,
    serviceFeePercent: dezimal('0'),
    serviceFeeMinCents: 0,
    serviceFeeActiveFrom: null,
    betriebsnummer,
    farmValues: [],
    farmPhotos: [],
    pickupSlots: [],
    products: [
      {
        id: 'heu',
        name: 'Heu',
        description: 'Erster Schnitt',
        imageUrl: null,
        category: 'HEU_STROH',
        subcategory: 'WIESENHEU',
        price: dezimal('45.00'),
        unit: 'BALLEN',
        unitSize: null,
        stock: 3,
        isAvailable: true,
        allergens: [],
        labels: ['BIO'],
        abgabe: 'NUR_BETRIEBE',
        requiresCool: false,
        requiresFreezer: false,
        seasonStart: null,
        seasonEnd: null,
        unavailableReason: null,
        futter: produktFutter,
      },
    ],
  }
}

describe.each([
  ['getPublicFarm', () => getPublicFarm('hof-test')],
  ['getOwnerFarm', () => getOwnerFarm('user_1')],
])('%s — Futter-Kennzeichnung für den Browser', (_name, laden) => {
  beforeEach(() => vi.clearAllMocks())

  it('wandelt Decimal und Date und lässt die Altlast-Spalte weg', async () => {
    findUnique.mockResolvedValue(rohHof('LFBIS-1234567', futter()) as never)

    const farm = await laden()
    const f = farm!.products[0]!.futter!

    expect(f.nettoMenge).toBe(300)
    expect(f.rohprotein).toBe(9.5)
    expect(f.rohfaser).toBeNull()
    expect(f.bestaetigtAm).toBe('2026-09-20T08:00:00.000Z')
    expect('registrierungsnummer' in f).toBe(false)
    expect(farm!.products[0]).toMatchObject({ subcategory: 'WIESENHEU', labels: ['BIO'], abgabe: 'NUR_BETRIEBE', isOrganic: true })
  })

  it('die Betriebsnummer des Hofs gewinnt; die Hof-Spalte selbst geht nicht mit', async () => {
    findUnique.mockResolvedValue(rohHof('LFBIS-1234567', futter()) as never)

    const farm = await laden()

    expect(farm!.products[0]!.futter!.betriebsnummer).toBe('LFBIS-1234567')
    expect('betriebsnummer' in farm!).toBe(false)
  })

  it('ohne Hof-Nummer greift die Altlast als Rückfall, ohne beides null', async () => {
    findUnique.mockResolvedValue(rohHof(null, futter()) as never)
    expect((await laden())!.products[0]!.futter!.betriebsnummer).toBe('ALT-12345')

    findUnique.mockResolvedValue(rohHof('  ', futter({ registrierungsnummer: null })) as never)
    expect((await laden())!.products[0]!.futter!.betriebsnummer).toBeNull()
  })

  it('ein Produkt ohne Kennzeichnung hat futter: null', async () => {
    findUnique.mockResolvedValue(rohHof(null, null) as never)
    expect((await laden())!.products[0]!.futter).toBeNull()
  })
})

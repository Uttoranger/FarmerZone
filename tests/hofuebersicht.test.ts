/**
 * Tests für die öffentliche Hofübersicht: die reine Datenlogik
 * (src/lib/hofuebersicht.ts — Kategorien, nächster Abholtermin, Filter,
 * Wien-Zeit) und die Query getOeffentlicheHoefe (src/server/queries/farm.ts)
 * mit gemocktem Prisma (Muster wie tests/profile-update.test.ts): Geprüft
 * wird, dass die Query EXAKT den öffentlichen Filter der Einzelseite trägt —
 * ein wartender (approvedAt null) und ein stillgelegter (archivedAt gesetzt)
 * Hof können sie nicht passieren — und dass die Ableitungen an den
 * Rohdaten hängen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  baueFotostreifen,
  filtereHoefe,
  formatiereAbholung,
  naechsteAbholung,
  sammleKategorien,
  wienJetzt,
} from '@/lib/hofuebersicht'
import { PRODUCT_CATEGORY_VALUES } from '@/schemas/product'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findMany: vi.fn(), findUnique: vi.fn() },
    // Kategorien UND Produktfotos kommen seit der Produktvorschau aus einer
    // schmalen Zeilen-Abfrage — sonst verlöre ein Hof mit vielen Produkten
    // die Kategorien und Fotos seiner hinteren Produkte (siehe
    // Kommentar in queries/farm.ts).
    product: { findMany: vi.fn() },
  },
}))

import {
  getOeffentlicheHoefe,
  OEFFENTLICH_SICHTBAR,
  VORSCHAU_LADE_DECKEL,
} from '@/server/queries/farm'
import { PRODUCT_ORDER_BY } from '@/server/queries/products'
import { RESERVED_SLUGS } from '@/lib/slug'
import { prisma } from '@/lib/prisma'

const farmFindMany = vi.mocked(prisma.farm.findMany)
const produktZeilen = vi.mocked(prisma.product.findMany)

/** Eine Produktzeile, wie die Query sie bekommt (Decimal kommt als Objekt
 *  mit toString/valueOf; für den Mapper genügt eine Zahl). */
function produkt(teil: Record<string, unknown> = {}) {
  return {
    id: 'prod_1',
    name: 'Bergkäse',
    price: 9.9,
    unit: 'KG',
    unitSize: null,
    stock: 5,
    reservedStock: 0,
    category: 'MILCH',
    imageUrl: null,
    ...teil,
  }
}

/** Ein Roh-Hof, wie ihn die Query aus der Datenbank bekommt. */
function rohHof(teil: Record<string, unknown> = {}) {
  return {
    id: 'farm_1',
    approvedAt: new Date('2026-08-01T10:00:00Z'),
    createdAt: new Date('2026-07-01T10:00:00Z'),
    slug: 'hof-mueller',
    name: 'Hof Müller',
    // Absichtlich in der Fixtur, obwohl die echte Query es nie selektiert:
    // Nur so kann der Straßen-Stolperdraht unten wirklich auslösen, falls
    // je jemand address in select UND Mapper aufnimmt.
    address: 'Dorfstraße 12',
    postalCode: '4910',
    city: 'Ried im Innkreis',
    logoUrl: null,
    latitude: 48.21,
    longitude: 13.49,
    isPaused: false,
    bannerUrl: null,
    bannerType: 'GRADIENT',
    farmPhotos: [],
    products: [],
    _count: { products: 0 },
    pickupSlots: [],
    ...teil,
  }
}

describe('sammleKategorien', () => {
  it('entdoppelt und lässt Produkte ohne Kategorie weg', () => {
    const kategorien = sammleKategorien(
      [
        { category: 'EIER' },
        { category: 'MILCH' },
        { category: 'EIER' },
        { category: null },
        { category: 'MILCH' },
      ],
      PRODUCT_CATEGORY_VALUES
    )

    expect(kategorien).toEqual(['MILCH', 'EIER'])
  })

  it('hält die feste Schema-Reihenfolge ein, egal wie die Produkte kommen', () => {
    const kategorien = sammleKategorien(
      [{ category: 'SONSTIGES' }, { category: 'GEMUESE' }, { category: 'BROT' }],
      PRODUCT_CATEGORY_VALUES
    )

    expect(kategorien).toEqual(['GEMUESE', 'BROT', 'SONSTIGES'])
  })

  it('ohne Produkte: leere Liste', () => {
    expect(sammleKategorien([], PRODUCT_CATEGORY_VALUES)).toEqual([])
  })
})

describe('naechsteAbholung', () => {
  // Mittwoch, 12:00 Ortszeit.
  const MITTWOCH_MITTAG = { wochentag: 3, uhrzeit: '12:00' }

  it('nimmt das nächste anstehende Fenster der Woche', () => {
    const a = naechsteAbholung(
      [
        { dayOfWeek: 5, startTime: '14:00', endTime: '16:00' }, // Freitag
        { dayOfWeek: 1, startTime: '09:00', endTime: '11:00' }, // Montag (nächste Woche)
      ],
      MITTWOCH_MITTAG
    )

    expect(a).toMatchObject({ dayOfWeek: 5, tageVoraus: 2 })
  })

  it('überspringt ein heute schon vergangenes Fenster — es zählt erst nächste Woche', () => {
    const a = naechsteAbholung(
      [
        { dayOfWeek: 3, startTime: '08:00', endTime: '10:00' }, // heute, vorbei
        { dayOfWeek: 4, startTime: '15:00', endTime: '17:00' }, // morgen
      ],
      MITTWOCH_MITTAG
    )

    expect(a).toMatchObject({ dayOfWeek: 4, tageVoraus: 1 })
  })

  it('ein noch laufendes Fenster zählt heute noch', () => {
    const a = naechsteAbholung(
      [{ dayOfWeek: 3, startTime: '11:00', endTime: '13:00' }],
      MITTWOCH_MITTAG
    )

    expect(a).toMatchObject({ dayOfWeek: 3, tageVoraus: 0 })
  })

  it('gibt es nur das vergangene Fenster, kommt es mit sieben Tagen wieder', () => {
    const a = naechsteAbholung(
      [{ dayOfWeek: 3, startTime: '08:00', endTime: '10:00' }],
      MITTWOCH_MITTAG
    )

    expect(a).toMatchObject({ dayOfWeek: 3, tageVoraus: 7 })
  })

  it('über den Wochenwechsel: Samstag sieht das Sonntags-Fenster als morgen', () => {
    const a = naechsteAbholung(
      [{ dayOfWeek: 0, startTime: '09:00', endTime: '11:00' }],
      { wochentag: 6, uhrzeit: '18:00' }
    )

    expect(a).toMatchObject({ dayOfWeek: 0, tageVoraus: 1 })
  })

  it('am selben Tag gewinnt das frühere Fenster', () => {
    const a = naechsteAbholung(
      [
        { dayOfWeek: 5, startTime: '16:00', endTime: '18:00' },
        { dayOfWeek: 5, startTime: '09:00', endTime: '11:00' },
      ],
      MITTWOCH_MITTAG
    )

    expect(a).toMatchObject({ startTime: '09:00' })
  })

  it('ohne Fenster bleibt es leer', () => {
    expect(naechsteAbholung([], MITTWOCH_MITTAG)).toBeNull()
  })
})

describe('formatiereAbholung', () => {
  it('sagt Heute, Morgen, sonst den Wochentag', () => {
    expect(
      formatiereAbholung({ dayOfWeek: 3, startTime: '14:00', endTime: '16:00', tageVoraus: 0 })
    ).toBe('Heute 14:00–16:00')
    expect(
      formatiereAbholung({ dayOfWeek: 4, startTime: '09:00', endTime: '11:00', tageVoraus: 1 })
    ).toBe('Morgen 09:00–11:00')
    expect(
      formatiereAbholung({ dayOfWeek: 5, startTime: '14:00', endTime: '16:00', tageVoraus: 2 })
    ).toBe('Freitag 14:00–16:00')
  })

  it('sagt beim vergangenen heutigen Fenster ausdrücklich „in einer Woche" — nie den nackten heutigen Wochentag', () => {
    expect(
      formatiereAbholung({ dayOfWeek: 3, startTime: '08:00', endTime: '10:00', tageVoraus: 7 })
    ).toBe('Mittwoch in einer Woche, 08:00–10:00')
  })
})

describe('wienJetzt', () => {
  it('löst einen UTC-Moment nach österreichischer Ortszeit auf', () => {
    // Freitag 23:30 UTC im Sommer = Samstag 01:30 in Wien.
    expect(wienJetzt(new Date('2026-08-28T23:30:00Z'))).toEqual({
      wochentag: 6,
      uhrzeit: '01:30',
    })
  })

  it('auch im Winter (UTC+1) und exakt um Mitternacht — nie „24:xx"', () => {
    // Donnerstag 23:30 UTC im Januar = Freitag 00:30 in Wien.
    expect(wienJetzt(new Date('2026-01-15T23:30:00Z'))).toEqual({
      wochentag: 5,
      uhrzeit: '00:30',
    })
    // Mitternacht Wien: hourCycle h23 liefert 00, nicht 24 (h24-Falle).
    expect(wienJetzt(new Date('2026-08-25T22:00:00Z'))).toEqual({
      wochentag: 3,
      uhrzeit: '00:00',
    })
  })
})

describe('filtereHoefe', () => {
  const HOEFE = [
    { slug: 'a', kategorien: ['MILCH', 'EIER'] },
    { slug: 'b', kategorien: ['GEMUESE'] },
    { slug: 'c', kategorien: [] },
  ] as Array<{ slug: string; kategorien: ('MILCH' | 'EIER' | 'GEMUESE')[] }>

  it('leere Auswahl zeigt alle', () => {
    expect(filtereHoefe(HOEFE, [])).toHaveLength(3)
  })

  it('Mehrfachauswahl ist ein ODER: eine passende Kategorie genügt', () => {
    expect(filtereHoefe(HOEFE, ['EIER', 'GEMUESE']).map((h) => h.slug)).toEqual(['a', 'b'])
  })

  it('ein Hof ohne passende Kategorie fällt heraus', () => {
    expect(filtereHoefe(HOEFE, ['MILCH']).map((h) => h.slug)).toEqual(['a'])
  })
})

describe('baueFotostreifen', () => {
  const GALERIE = ['g1.jpg', 'g2.jpg']
  const PRODUKTE = ['p1.jpg']

  it('Titelbild zuerst, dann Galerie, dann Produktfotos', () => {
    expect(
      baueFotostreifen({
        bannerUrl: 'titel.jpg',
        bannerType: 'PHOTO',
        galerie: GALERIE,
        produktFotos: PRODUKTE,
      })
    ).toEqual(['titel.jpg', 'g1.jpg', 'g2.jpg', 'p1.jpg'])
  })

  it('ein Gradient-Titelbild ist Farbe, kein Foto — es wird übersprungen', () => {
    expect(
      baueFotostreifen({
        bannerUrl: 'titel.jpg',
        bannerType: 'GRADIENT',
        galerie: GALERIE,
        produktFotos: [],
      })
    ).toEqual(['g1.jpg', 'g2.jpg'])
  })

  it('PHOTO ohne hinterlegte URL (null oder leer) liefert kein Titelbild', () => {
    expect(
      baueFotostreifen({ bannerUrl: null, bannerType: 'PHOTO', galerie: GALERIE, produktFotos: [] })
    ).toEqual(['g1.jpg', 'g2.jpg'])
    expect(
      baueFotostreifen({ bannerUrl: '', bannerType: 'PHOTO', galerie: GALERIE, produktFotos: [] })
    ).toEqual(['g1.jpg', 'g2.jpg'])
  })

  it('entfernt Duplikate — dasselbe Foto als Titelbild UND in der Galerie zählt einmal', () => {
    expect(
      baueFotostreifen({
        bannerUrl: 'g1.jpg',
        bannerType: 'PHOTO',
        galerie: GALERIE,
        produktFotos: ['g2.jpg', 'p1.jpg'],
      })
    ).toEqual(['g1.jpg', 'g2.jpg', 'p1.jpg'])
  })

  it('Duplikat UND Deckel zusammen: das Duplikat frisst keinen Platz', () => {
    // Das Titelbild steht auch in der Galerie — erst entdoppeln, DANN
    // deckeln: p1 bekommt den fünften Platz.
    expect(
      baueFotostreifen({
        bannerUrl: 'g1.jpg',
        bannerType: 'PHOTO',
        galerie: ['g1.jpg', 'g2.jpg', 'g3.jpg', 'g4.jpg'],
        produktFotos: ['p1.jpg', 'p2.jpg', 'p3.jpg'],
      })
    ).toEqual(['g1.jpg', 'g2.jpg', 'g3.jpg', 'g4.jpg', 'p1.jpg'])
  })

  it('deckelt bei fünf Fotos', () => {
    const streifen = baueFotostreifen({
      bannerUrl: 'titel.jpg',
      bannerType: 'PHOTO',
      galerie: ['g1.jpg', 'g2.jpg', 'g3.jpg', 'g4.jpg'],
      produktFotos: ['p1.jpg', 'p2.jpg', 'p3.jpg'],
    })

    expect(streifen).toHaveLength(5)
    expect(streifen).toEqual(['titel.jpg', 'g1.jpg', 'g2.jpg', 'g3.jpg', 'g4.jpg'])
  })

  it('ein Hof ohne Fotos bekommt die leere Liste', () => {
    expect(
      baueFotostreifen({ bannerUrl: null, bannerType: 'GRADIENT', galerie: [], produktFotos: [] })
    ).toEqual([])
  })
})

describe('getOeffentlicheHoefe — die Query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    produktZeilen.mockResolvedValue([] as never)
  })

  it('fragt EXAKT mit dem öffentlichen Filter der Einzelseite an — wartende und stillgelegte Höfe können ihn nicht passieren', async () => {
    farmFindMany.mockResolvedValue([] as never)

    await getOeffentlicheHoefe({ wochentag: 3, uhrzeit: '12:00' })

    expect(farmFindMany).toHaveBeenCalledTimes(1)
    const args = farmFindMany.mock.calls[0]![0]!
    // Die GETEILTE Konstante ist die Parität mit getPublicFarm: Beide Queries
    // bauen ihr where daraus — hier wird ihr Inhalt festgenagelt.
    expect(args.where).toBe(OEFFENTLICH_SICHTBAR)
    expect(OEFFENTLICH_SICHTBAR).toEqual({ isActive: true, archivedAt: null, approvedAt: { not: null } })
    // Nur VERFÜGBARE Produkte (Kategorien UND Produktfotos speisen sich
    // daraus), Termine nur aus aktiven Fenstern, höchstens vier
    // Galerie-Fotos in Sortierreihenfolge.
    expect(args.select).toMatchObject({
      pickupSlots: { where: { isActive: true } },
      farmPhotos: { orderBy: { sortOrder: 'asc' }, take: 4 },
      bannerUrl: true,
      bannerType: true,
    })
    // Die products-Einbindung EXAKT, nicht als Teilmenge — an ihr hängen drei
    // Ableitungen auf einmal:
    //   - ein wieder eingeführtes category-not-null im where verschlucke
    //     Produktfotos kategorieloser Produkte still,
    //   - ein fehlendes Feld im select nähme der Vorschau lautlos Preis,
    //     Einheit oder die Ausverkauft-Rechnung (unit/unitSize/reservedStock).
    const products = (args.select as { products: Record<string, unknown> }).products
    expect(products).toEqual({
      where: { isAvailable: true },
      orderBy: PRODUCT_ORDER_BY,
      take: VORSCHAU_LADE_DECKEL,
      select: {
        id: true,
        name: true,
        price: true,
        unit: true,
        unitSize: true,
        stock: true,
        reservedStock: true,
        category: true,
        imageUrl: true,
      },
    })
    // „+ n weitere" zählt ALLE verfügbaren Produkte — ein ungefiltertes
    // _count zählte auch die abgeschalteten mit und verspräche zu viel.
    expect((args.select as { _count: unknown })._count).toEqual({
      select: { products: { where: { isAvailable: true } } },
    })

    // Die schmale Zeilen-Abfrage: dieselbe öffentliche Sichtbarkeit wie die
    // Hof-Abfrage, dieselbe Reihenfolge wie die Hofseite — und WIRKLICH nur
    // drei Felder (sie läuft über ALLE Produkte ALLER Höfe, ungedeckelt).
    expect(produktZeilen).toHaveBeenCalledTimes(1)
    expect(produktZeilen.mock.calls[0]![0]).toEqual({
      where: { isAvailable: true, farm: OEFFENTLICH_SICHTBAR },
      orderBy: PRODUCT_ORDER_BY,
      select: { farmId: true, category: true, imageUrl: true },
    })
  })

  it('leitet Kategorien, Termin und Fotostreifen je Hof ab; ohne Fenster/Fotos bleibt beides leer', async () => {
    farmFindMany.mockResolvedValue([
      rohHof({
        bannerUrl: 'titel.jpg',
        bannerType: 'PHOTO',
        farmPhotos: [{ url: 'g1.jpg' }],
        // Die Vorschau-Zeilen tragen hier ABSICHTLICH keine Bilder und nur
        // eine Kategorie: So kann der Streifen seine Fotos nur aus der
        // schmalen Abfrage haben — der Deckel-Regress wäre sichtbar.
        products: [
          produkt({ id: 'v1', category: 'EIER', imageUrl: null }),
          produkt({ id: 'v2', category: 'EIER', imageUrl: null }),
        ],
        pickupSlots: [{ dayOfWeek: 5, startTime: '14:00', endTime: '16:00' }],
      }),
      rohHof({ slug: 'hof-leer', id: 'farm_leer', latitude: null, longitude: null }),
    ] as never)
    // Kategorien UND Produktfotos kommen aus der schmalen Zeilen-Abfrage —
    // NICHT aus den (gedeckelten) Vorschau-Zeilen. Deshalb steht hier auch
    // ein Foto, das in den Vorschau-Zeilen gar nicht vorkommt: Genau so
    // behält ein Hof mit vielen Produkten seinen Fotostreifen.
    produktZeilen.mockResolvedValue([
      { farmId: 'farm_1', category: 'EIER', imageUrl: 'p1.jpg' },
      { farmId: 'farm_1', category: 'MILCH', imageUrl: 'p2.jpg' },
      { farmId: 'farm_1', category: null, imageUrl: 'p3.jpg' },
      { farmId: 'farm_1', category: null, imageUrl: 'p4.jpg' },
    ] as never)

    const hoefe = await getOeffentlicheHoefe({ wochentag: 3, uhrzeit: '12:00' })

    expect(hoefe[0]).toMatchObject({
      slug: 'hof-mueller',
      kategorien: ['MILCH', 'EIER'],
      naechsteAbholung: { dayOfWeek: 5, tageVoraus: 2 },
      // Titelbild, Galerie, dann HÖCHSTENS DREI Produktfotos (p4 fällt).
      fotos: ['titel.jpg', 'g1.jpg', 'p1.jpg', 'p2.jpg', 'p3.jpg'],
    })
    expect(hoefe[1]).toMatchObject({
      slug: 'hof-leer',
      latitude: null,
      kategorien: [],
      naechsteAbholung: null,
      fotos: [],
      // Ohne Produkte bleibt das Schaufenster leer — die Karte lässt den
      // Block dann ganz weg.
      produkte: [],
      produkteGesamt: 0,
    })
    // Die Übersicht trägt PLZ und Ort, aber KEINE Straße — die Fixtur
    // ENTHÄLT eine, der Stolperdraht kann also wirklich auslösen.
    expect(JSON.stringify(hoefe)).not.toMatch(/address|Dorfstraße/i)
  })

  it('reicht die Produktvorschau samt Preis, Einheit und Verfügbarkeit durch — Decimal wird zur Zahl, „+ n weitere" zählt aus dem _count', async () => {
    farmFindMany.mockResolvedValue([
      rohHof({
        products: [
          // Decimal kommt als Objekt aus Prisma — die Vorschau braucht eine
          // echte Zahl, sonst rechnete und formatierte sie auf einem Objekt.
          produkt({
            id: 'p_kaese',
            name: 'Bergkäse',
            price: { valueOf: () => '12.50' },
            unit: 'GRAMM',
            unitSize: { valueOf: () => '250' },
            stock: 4,
            reservedStock: 0,
            category: 'MILCH',
            imageUrl: 'kaese.jpg',
          }),
          // Bestand da, aber vollständig reserviert → „derzeit aus".
          produkt({ id: 'p_eier', name: 'Eier', stock: 6, reservedStock: 6, category: 'EIER' }),
          // Restbestand über der Reservierung → verfügbar.
          produkt({ id: 'p_brot', name: 'Brot', stock: 6, reservedStock: 5, category: 'BROT' }),
        ],
        // Der Hof führt mehr, als die Query lädt (VORSCHAU_LADE_DECKEL).
        _count: { products: 11 },
      }),
    ] as never)

    const [hof] = await getOeffentlicheHoefe({ wochentag: 3, uhrzeit: '12:00' })

    expect(hof!.produkte).toEqual([
      {
        id: 'p_kaese',
        name: 'Bergkäse',
        price: 12.5,
        unit: 'GRAMM',
        unitSize: 250,
        imageUrl: 'kaese.jpg',
        category: 'MILCH',
        verfuegbar: true,
      },
      {
        id: 'p_eier',
        name: 'Eier',
        price: 9.9,
        unit: 'KG',
        unitSize: null,
        imageUrl: null,
        category: 'EIER',
        verfuegbar: false,
      },
      {
        id: 'p_brot',
        name: 'Brot',
        price: 9.9,
        unit: 'KG',
        unitSize: null,
        imageUrl: null,
        category: 'BROT',
        verfuegbar: true,
      },
    ])
    // NICHT die Länge der geladenen Zeilen: Sonst stünde bei einem Hof mit
    // elf Produkten „+ 0 weitere", sobald der Deckel greift.
    expect(hof!.produkteGesamt).toBe(11)
  })

  it('der Routen-Slug hoefe ist für Hofnamen gesperrt — sonst beschattete ein Hof „Höfe" die Übersicht', () => {
    expect(RESERVED_SLUGS.has('hoefe')).toBe(true)
  })
})

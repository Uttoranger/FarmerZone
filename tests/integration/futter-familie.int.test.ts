/**
 * Futter und Brennmaterial mit Verkaufsgrößen (Gate 6, Nachtlauf Nr. 20)
 * gegen ein ECHTES Postgres.
 *
 * Die Aussagen, die nur die Datenbank beantwortet:
 *   1. Abnahme „Heu mit vier Größen, davon zwei ohne Meldung gesperrt": vier
 *      Produkte mit derselben familieId, eigener Kennzeichnung (Nettomenge je
 *      Gebinde) und eigenem Vorrat; Sackerl und Sack als Entwurf.
 *   2. Der Schalter „Sichtbar" lässt eine gesperrte Größe nicht in den Shop —
 *      mit BAES-Meldung am Hof schon (S7, beim Veröffentlichen).
 *   3. Der Checkout lässt eine gesperrte Größe nicht durch, auch wenn sie noch
 *      sichtbar ist (S7, beim Checkout): keine Bestellung, Bestand unverändert.
 *      Gegenprobe: Kauf als Betrieb mit Nummer geht (NUR_BETRIEBE).
 *   4. Abnahme „Brennholz mit drei Größen": drei Produkte, je Größe eigene
 *      Brennmaterial-Angaben.
 *   5. Pflicht-Bestätigung beim Bearbeiten (E10a, Nr. 23) mit den echten
 *      Spaltentypen (Decimal, Listen): nur Preis geändert → ohne Haken
 *      gespeichert, bestaetigtAm bleibt; Kennzeichnung geändert → ohne Haken
 *      abgelehnt und nichts geschrieben, mit Haken bestaetigtAm = jetzt.
 * Geprüft wird der Zustand danach (TESTING_GUIDELINES §1).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))

import { headers } from 'next/headers'
import { legeBrennmaterialFamilieAn, legeFutterFamilieAn } from '@/server/actions/produktfamilie'
import { produktSichtbarkeitSetzen, updateProduct } from '@/server/actions/products'
import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { sendOnsiteConfirmation } from '@/lib/email'
import { checkoutAnfrage, erstelleHofMitAnmeldung, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

/** Ein angemeldeter Hof mit LFBIS-Nummer und Abholfenster an jedem Tag (sonst lehnt der Checkout vorher ab). */
async function lfbisHof() {
  const { farm, cookie } = await erstelleHofMitAnmeldung({
    betriebsnummer: 'LFBIS 1234567',
    betriebsstatus: 'PRIMAERPRODUKTION',
    pickupSlots: { create: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '15:00', endTime: '18:00' })) },
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
  abgabe: 'NUR_BETRIEBE',
  kennzeichnung: {
    futtermittelart: 'EINZELFUTTERMITTEL',
    zielTierarten: ['PFERD', 'HEIMTIER'],
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
    { bezeichnung: '1 kg-Sackerl', verpackung: 'ABGEPACKT_ETIKETT', unit: 'STUECK', nettoMenge: 1, price: 2.5, stock: 20 },
    { bezeichnung: '5 kg-Sack', verpackung: 'ABGEPACKT_ETIKETT', unit: 'STUECK', nettoMenge: 5, price: 8, stock: 10 },
    { bezeichnung: 'Kleinballen', verpackung: 'LOSE_BALLEN', unit: 'BALLEN', nettoMenge: 15, price: 4.5, stock: 40 },
    { bezeichnung: 'Rundballen', verpackung: 'LOSE_BALLEN', unit: 'BALLEN', nettoMenge: 250, price: 45, stock: 8 },
  ],
}

async function familie(farmId: string) {
  return prisma.product.findMany({
    where: { farmId },
    orderBy: { price: 'asc' },
    include: { futter: true, brennmaterial: true },
  })
}

describe('Futter mit Verkaufsgrößen — echte Datenbank', () => {
  it('Heu mit vier Größen: eine Familie, je Größe Kennzeichnung und Vorrat; ohne Meldung Sackerl und Sack als Entwurf', async () => {
    const farm = await lfbisHof()

    const ergebnis = await legeFutterFamilieAn(HEU)

    expect(ergebnis).toMatchObject({ ok: true, online: 2 })
    const produkte = await familie(farm.id)
    expect(produkte).toHaveLength(4)
    expect(new Set(produkte.map((p) => p.familieId)).size).toBe(1)
    expect(produkte[0].familieId).not.toBeNull()
    expect(produkte.map((p) => [p.name, p.isAvailable, p.stock, p.verpackung, Number(p.futter?.nettoMenge)])).toEqual([
      ['Bergwiesen-Heu 1 kg-Sackerl', false, 20, 'ABGEPACKT_ETIKETT', 1],
      ['Bergwiesen-Heu Kleinballen', true, 40, 'LOSE_BALLEN', 15],
      ['Bergwiesen-Heu 5 kg-Sack', false, 10, 'ABGEPACKT_ETIKETT', 5],
      ['Bergwiesen-Heu Rundballen', true, 8, 'LOSE_BALLEN', 250],
    ])
    expect(produkte.every((p) => p.abgabe === 'NUR_BETRIEBE' && p.futter?.registrierungsnummer === null)).toBe(true)
  })

  it('der Schalter „Sichtbar" lässt das Sackerl ohne BAES-Meldung nicht in den Shop — mit Meldung schon', async () => {
    const farm = await lfbisHof()
    await legeFutterFamilieAn(HEU)
    const sackerl = await prisma.product.findFirstOrThrow({ where: { farmId: farm.id, name: { endsWith: 'Sackerl' } } })

    expect(await produktSichtbarkeitSetzen({ productId: sackerl.id, imShop: true })).toMatchObject({ code: 'GESPERRT' })
    expect((await prisma.product.findUniqueOrThrow({ where: { id: sackerl.id } })).isAvailable).toBe(false)

    await prisma.farm.update({ where: { id: farm.id }, data: { betriebsstatus: 'REGISTRIERT' } })
    expect(await produktSichtbarkeitSetzen({ productId: sackerl.id, imShop: true })).toEqual({ ok: true })
    expect((await prisma.product.findUniqueOrThrow({ where: { id: sackerl.id } })).isAvailable).toBe(true)
  })

  it('der Checkout lässt eine gesperrte Größe nicht durch, auch wenn sie noch sichtbar ist — nichts angelegt, nichts gebucht', async () => {
    const farm = await lfbisHof()
    await legeFutterFamilieAn(HEU)
    const sackerl = await prisma.product.findFirstOrThrow({ where: { farmId: farm.id, name: { endsWith: 'Sackerl' } } })
    // Der Zustand nach einem Statuswechsel an der Profil-Aktion vorbei: sichtbar, aber gesperrt.
    await prisma.product.update({ where: { id: sackerl.id }, data: { isAvailable: true } })
    const sitzung = intKennung('sitzung')
    await setzeHalt(sackerl.id, sitzung, 1)

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        kaeuferArt: 'BETRIEB',
        betriebsnummer: 'LFBIS 7654321',
        positionen: [{ productId: sackerl.id, name: sackerl.name, quantity: 1, unitPrice: 2.5 }],
      })
    )

    expect(antwort.status).toBe(409)
    expect(await antwort.json()).toMatchObject({ code: 'WARENKORB_GEAENDERT' })
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(0)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: sackerl.id } })).stock).toBe(20)
    expect(sendOnsiteConfirmation).not.toHaveBeenCalled()
  })

  it('Gegenprobe: Kauf als Betrieb mit Nummer — der Rundballen geht durch, die Nummer steht in der Bestellung', async () => {
    const farm = await lfbisHof()
    await legeFutterFamilieAn(HEU)
    const rundballen = await prisma.product.findFirstOrThrow({ where: { farmId: farm.id, name: { endsWith: 'Rundballen' } } })
    const sitzung = intKennung('sitzung')
    await setzeHalt(rundballen.id, sitzung, 1)

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        kaeuferArt: 'BETRIEB',
        betriebsnummer: 'LFBIS 7654321',
        positionen: [{ productId: rundballen.id, name: rundballen.name, quantity: 1, unitPrice: 45 }],
      })
    )

    expect(antwort.status).toBe(200)
    expect(await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })).toMatchObject({
      kaeuferArt: 'BETRIEB',
      betriebsnummer: 'LFBIS 7654321',
    })
    expect((await prisma.product.findUniqueOrThrow({ where: { id: rundballen.id } })).stock).toBe(7)
  })
})

describe('Brennmaterial mit Verkaufsgrößen — echte Datenbank', () => {
  it('Brennholz mit drei Größen: drei Produkte einer Familie, je Größe eigene Angaben, alle online', async () => {
    const farm = await lfbisHof()

    const ergebnis = await legeBrennmaterialFamilieAn({
      name: 'Buche, ofenfertig',
      description: '',
      art: 'BRENNHOLZ_SCHEIT',
      holzart: 'Buche',
      scheitlaengeCm: 33,
      trocknung: 'OFENFERTIG',
      wassergehalt: null,
      koernung: null,
      gelagertJahre: 2,
      ueberdacht: true,
      groessen: [
        { bezeichnung: 'Sack ca. 15 kg', unit: 'STUECK', price: 8.9, stock: 30 },
        { bezeichnung: 'Schüttraummeter', unit: 'SCHUETTRAUMMETER', price: 99, stock: 12 },
        { bezeichnung: 'Raummeter', unit: 'RAUMMETER', price: 129, stock: 4 },
      ],
    })

    expect(ergebnis).toEqual({ ok: true, online: 3, wartend: [] })
    const produkte = await familie(farm.id)
    expect(produkte.map((p) => [p.unit, p.isAvailable, p.category, p.subcategory])).toEqual([
      ['STUECK', true, 'BRENNHOLZ', 'BRENNHOLZ_SCHEIT'],
      ['SCHUETTRAUMMETER', true, 'BRENNHOLZ', 'BRENNHOLZ_SCHEIT'],
      ['RAUMMETER', true, 'BRENNHOLZ', 'BRENNHOLZ_SCHEIT'],
    ])
    expect(new Set(produkte.map((p) => p.familieId)).size).toBe(1)
    expect(new Set(produkte.map((p) => p.brennmaterial?.id)).size).toBe(3)
    expect(produkte[0].brennmaterial).toMatchObject({ holzart: 'Buche', scheitlaengeCm: 33, restfeuchteMax: 20, ueberdacht: true })
    expect(produkte[0].brennmaterial?.gelagertSeit).toBeInstanceOf(Date)
  })
})

describe('Pflicht-Bestätigung beim Bearbeiten (E10a, Nr. 23) — echte Datenbank', () => {
  const ALT = new Date('2026-09-01T08:00:00.000Z')

  /** Der Rundballen so, wie der Produktdialog ihn zum Bearbeiten vorbelegt (toFormDefaults), Haken leer. */
  async function rundballenImDialog(farmId: string) {
    await legeFutterFamilieAn(HEU)
    const p = await prisma.product.findFirstOrThrow({ where: { farmId, name: { endsWith: 'Rundballen' } }, include: { futter: true } })
    await prisma.futterKennzeichnung.update({ where: { productId: p.id }, data: { bestaetigtAm: ALT } })
    const f = p.futter
    if (!f) throw new Error('Kennzeichnung fehlt')
    const formular = {
      name: p.name,
      description: p.description ?? '',
      imageUrl: p.imageUrl ?? '',
      category: p.category,
      subcategory: p.subcategory,
      labels: p.labels,
      abgabe: p.abgabe,
      countsTowardLimit: p.countsTowardLimit,
      price: p.price.toNumber(),
      vatRate: p.vatRate.toNumber(),
      unit: p.unit,
      unitSize: p.unitSize?.toNumber() ?? null,
      stock: p.stock,
      isAvailable: p.isAvailable,
      allergens: p.allergens,
      requiresCool: p.requiresCool,
      requiresFreezer: p.requiresFreezer,
      seasonStart: p.seasonStart,
      seasonEnd: p.seasonEnd,
      unavailableReason: p.unavailableReason ?? '',
      futter: {
        futtermittelart: f.futtermittelart,
        zielTierarten: [...f.zielTierarten].reverse(),
        zusammensetzung: f.zusammensetzung,
        analytischeBestandteile: f.analytischeBestandteile,
        nettoMenge: f.nettoMenge.toNumber(),
        nettoEinheit: f.nettoEinheit,
        rohprotein: f.rohprotein?.toNumber() ?? null,
        rohfaser: f.rohfaser?.toNumber() ?? null,
        rohfett: f.rohfett?.toNumber() ?? null,
        rohasche: f.rohasche?.toNumber() ?? null,
        zusatzstoffe: f.zusatzstoffe ?? '',
        gebrauchshinweis: f.gebrauchshinweis ?? '',
        bestaetigt: false,
      },
    }
    return { id: p.id, stock: p.stock, formular }
  }

  async function kennzeichnung(productId: string) {
    return prisma.futterKennzeichnung.findUniqueOrThrow({ where: { productId } })
  }

  it('nur der Preis geändert: ohne Haken gespeichert, die alte Bestätigung bleibt', async () => {
    const farm = await lfbisHof()
    const { id, stock, formular } = await rundballenImDialog(farm.id)

    const ergebnis = await updateProduct(id, { ...formular, price: 49.9 } as never, stock)

    expect(ergebnis).toEqual({ ok: true })
    expect((await prisma.product.findUniqueOrThrow({ where: { id } })).price.toString()).toBe('49.9')
    expect((await kennzeichnung(id)).bestaetigtAm).toEqual(ALT)
  })

  it('Kennzeichnung geändert ohne Haken: abgelehnt, nichts geschrieben; mit Haken: gespeichert, bestaetigtAm neu', async () => {
    const farm = await lfbisHof()
    const { id, stock, formular } = await rundballenImDialog(farm.id)
    const geaendert = { ...formular, price: 49.9, futter: { ...formular.futter, zusammensetzung: 'Wiesenheu, zweiter Schnitt' } }

    expect(await updateProduct(id, geaendert as never, stock)).toMatchObject({ code: 'BESTAETIGUNG' })
    expect((await prisma.product.findUniqueOrThrow({ where: { id } })).price.toString()).toBe('45')
    expect(await kennzeichnung(id)).toMatchObject({ zusammensetzung: 'Wiesenheu, erster Schnitt', bestaetigtAm: ALT })

    const vorher = Date.now()
    expect(await updateProduct(id, { ...geaendert, futter: { ...geaendert.futter, bestaetigt: true } } as never, stock)).toEqual({ ok: true })
    const danach = await kennzeichnung(id)
    expect(danach.zusammensetzung).toBe('Wiesenheu, zweiter Schnitt')
    // Systemuhr in der Integrationsschicht: großzügig, nie auf die Millisekunde (TESTING_GUIDELINES §1).
    expect(danach.bestaetigtAm.getTime()).toBeGreaterThanOrEqual(vorher - 60_000)
  })
})

/**
 * Server Actions der Formulare mit Verkaufsgrößen (src/server/actions/
 * produktfamilie.ts, Nachtlauf Nr. 20; Register E3, E9, E10, E11; S7).
 *
 * Beweist: je Größe ein Produkt mit derselben familieId, eigenem Preis,
 * Vorrat und eigener Kennzeichnung (Nettomenge je Gebinde, bestätigt jetzt,
 * ohne Registrierungsnummer); die Sperre je Gebinde entscheidet der Server mit
 * dem Stand des Hofs aus der Datenbank — gesperrte Größen entstehen als
 * Entwurf, der Rest geht online; NUR_BETRIEBE steht an jeder Größe;
 * Brennmaterial bekommt seine Angaben je Größe und geht ganz online. Ohne
 * Anmeldung oder mit ungültiger Eingabe wird nichts geschrieben.
 *
 * Prisma, Auth und Next sind gemockt — die Datenbank-Seite prüft
 * tests/integration/futter-familie.int.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { create: vi.fn(async (argumente: unknown) => argumente) },
    farm: { findUnique: vi.fn() },
    // Batch-Transaktion: alle Größen oder keine.
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}))

import { legeBrennmaterialFamilieAn, legeFutterFamilieAn } from '@/server/actions/produktfamilie'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFarmForUser } from '@/server/queries/dashboard'
import { revalidatePath, updateTag } from 'next/cache'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { FUTTER_BESTAETIGUNG_FEHLT, SPERR_GRUND } from '@/lib/futter-registrierung'

const getSession = vi.mocked(auth.api.getSession)
const farmForUser = vi.mocked(getFarmForUser)
const productCreate = vi.mocked(prisma.product.create)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)

const JETZT = new Date('2026-10-07T10:00:00.000Z')

const HEU = {
  name: 'Bergwiesen-Heu',
  description: 'Erster Schnitt.',
  category: 'HEU_STROH',
  subcategory: 'WIESENHEU',
  bio: true,
  abgabe: 'ALLE',
  kennzeichnung: {
    futtermittelart: 'EINZELFUTTERMITTEL',
    zielTierarten: ['PFERD', 'HEIMTIER'],
    zusammensetzung: 'Wiesenheu',
    analytischeBestandteile: 'Rohprotein 9 %',
    rohprotein: null,
    rohfaser: null,
    rohfett: null,
    rohasche: null,
    zusatzstoffe: '',
    gebrauchshinweis: '',
    bestaetigt: true,
    // Altlast: ein alter Client schickt die Nummer noch mit — sie wird verworfen (F6).
    registrierungsnummer: 'AT 1234567',
  },
  groessen: [
    { bezeichnung: '1 kg-Sackerl', verpackung: 'ABGEPACKT_ETIKETT', unit: 'STUECK', nettoMenge: 1, price: 2.5, stock: 20 },
    { bezeichnung: '5 kg-Sack', verpackung: 'ABGEPACKT_ETIKETT', unit: 'STUECK', nettoMenge: 5, price: 8, stock: 10 },
    { bezeichnung: 'Kleinballen', verpackung: 'LOSE_BALLEN', unit: 'BALLEN', nettoMenge: 15, price: 4.5, stock: 40 },
    { bezeichnung: 'Rundballen', verpackung: 'LOSE_BALLEN', unit: 'BALLEN', nettoMenge: 250, price: 45, stock: 8 },
  ],
}

type Angelegt = { data: Record<string, unknown> & { futter?: { create: Record<string, unknown> } } }
const angelegt = (): Angelegt['data'][] => productCreate.mock.calls.map((c) => (c[0] as Angelegt).data)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(JETZT)
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmForUser.mockResolvedValue({ id: 'farm_1', slug: 'testhof', name: 'Hof Test' } as never)
  farmFindUnique.mockResolvedValue({ betriebsnummer: 'AT 1234567', betriebsstatus: 'PRIMAERPRODUKTION' } as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('legeFutterFamilieAn', () => {
  it('Heu mit vier Größen, ohne BAES-Meldung: Ballen online, Sackerl und Sack als Entwurf', async () => {
    const ergebnis = await legeFutterFamilieAn(HEU)

    expect(ergebnis).toEqual({
      ok: true,
      familieId: expect.any(String),
      kaufbar: true,
      online: 2,
      wartend: [
        { bezeichnung: '1 kg-Sackerl', grund: SPERR_GRUND.heimtierfutter },
        { bezeichnung: '5 kg-Sack', grund: SPERR_GRUND.heimtierfutter },
      ],
    })
    expect(angelegt().map((p) => [p.name, p.isAvailable])).toEqual([
      ['Bergwiesen-Heu 1 kg-Sackerl', false],
      ['Bergwiesen-Heu 5 kg-Sack', false],
      ['Bergwiesen-Heu Kleinballen', true],
      ['Bergwiesen-Heu Rundballen', true],
    ])
    // Alle in EINER Transaktion.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('mit BAES-Meldung gehen alle vier online — entschieden mit dem Stand aus der Datenbank', async () => {
    farmFindUnique.mockResolvedValue({ betriebsnummer: 'AT 1234567', betriebsstatus: 'REGISTRIERT' } as never)

    const ergebnis = await legeFutterFamilieAn(HEU)

    expect(ergebnis).toEqual({ ok: true, familieId: expect.any(String), kaufbar: true, online: 4, wartend: [] })
    expect(farmFindUnique).toHaveBeenCalledWith({ where: { id: 'farm_1' }, select: { betriebsnummer: true, betriebsstatus: true } })
  })

  // Nachbesserung Nr. 30: Vorrat nur in gesperrten Größen, die freien leer → nicht kaufbar.
  it('Moment-Anlass: nur gesperrte Größen haben Vorrat → nicht kaufbar; der Toast-Zähler online bleibt 2', async () => {
    const ergebnis = await legeFutterFamilieAn({
      ...HEU,
      groessen: HEU.groessen.map((g) => (g.verpackung === 'LOSE_BALLEN' ? { ...g, stock: 0 } : g)),
    })
    expect(ergebnis).toMatchObject({ ok: true, kaufbar: false, online: 2 })
  })

  it('je Größe ein Produkt derselben Familie, mit eigenem Preis, Vorrat, Verpackung und Kennzeichnung', async () => {
    const ergebnis = await legeFutterFamilieAn(HEU)

    const produkte = angelegt()
    const familien = new Set(produkte.map((p) => p.familieId))
    expect(familien.size).toBe(1)
    expect(typeof produkte[0].familieId).toBe('string')
    // Nr. 30: Die Antwort nennt genau diese Familie — Anlass des Moments „gespeichert".
    expect('familieId' in ergebnis && ergebnis.familieId).toBe(produkte[0].familieId)
    expect(produkte.map((p) => [p.price, p.stock, p.unit, p.verpackung])).toEqual([
      [2.5, 20, 'STUECK', 'ABGEPACKT_ETIKETT'],
      [8, 10, 'STUECK', 'ABGEPACKT_ETIKETT'],
      [4.5, 40, 'BALLEN', 'LOSE_BALLEN'],
      [45, 8, 'BALLEN', 'LOSE_BALLEN'],
    ])
    expect(produkte.map((p) => p.futter?.create.nettoMenge)).toEqual([1, 5, 15, 250])
    for (const p of produkte) {
      expect(p).toMatchObject({
        farmId: 'farm_1',
        category: 'HEU_STROH',
        subcategory: 'WIESENHEU',
        labels: ['BIO'],
        abgabe: 'ALLE',
        unitSize: null,
        vatRate: 10,
        description: 'Erster Schnitt.',
      })
      expect(p.futter?.create).toMatchObject({
        futtermittelart: 'EINZELFUTTERMITTEL',
        zielTierarten: ['PFERD', 'HEIMTIER'],
        nettoEinheit: 'KG',
        zusatzstoffe: null,
        bestaetigtAm: JETZT,
      })
      expect('registrierungsnummer' in (p.futter?.create ?? {})).toBe(false)
      expect('bestaetigt' in (p.futter?.create ?? {})).toBe(false)
    }
  })

  it('NUR_BETRIEBE steht an jeder Größe', async () => {
    await legeFutterFamilieAn({ ...HEU, abgabe: 'NUR_BETRIEBE' })

    expect(angelegt().map((p) => p.abgabe)).toEqual(['NUR_BETRIEBE', 'NUR_BETRIEBE', 'NUR_BETRIEBE', 'NUR_BETRIEBE'])
  })

  it('ohne Nummer geht keine Größe online', async () => {
    farmFindUnique.mockResolvedValue({ betriebsnummer: null, betriebsstatus: null } as never)

    const ergebnis = await legeFutterFamilieAn(HEU)

    expect(ergebnis).toMatchObject({ ok: true, online: 0 })
    expect(angelegt().every((p) => p.isAvailable === false)).toBe(true)
  })

  it('ein mitgeschicktes isAvailable oder eine fremde farmId ändert nichts — entschieden wird auf dem Server', async () => {
    await legeFutterFamilieAn({
      ...HEU,
      farmId: 'farm_fremd',
      groessen: HEU.groessen.map((g) => ({ ...g, isAvailable: true, farmId: 'farm_fremd' })),
    })

    const produkte = angelegt()
    expect(produkte.every((p) => p.farmId === 'farm_1')).toBe(true)
    expect(produkte[0].isAvailable).toBe(false)
  })

  it('entwertet Produkte, Hofseite und den Cache der Hofübersicht', async () => {
    await legeFutterFamilieAn(HEU)

    expect(revalidatePath).toHaveBeenCalledWith('/products')
    expect(revalidatePath).toHaveBeenCalledWith('/testhof')
    expect(updateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG)
  })

  it('ungültige Eingabe: { error }, nichts geschrieben, Sitzung nicht gefragt', async () => {
    const ergebnis = await legeFutterFamilieAn({ ...HEU, groessen: [] })

    expect(ergebnis).toEqual({ error: 'Bitte prüfe deine Eingaben.' })
    expect(productCreate).not.toHaveBeenCalled()
    expect(getSession).not.toHaveBeenCalled()
  })

  it('ohne Anmeldung oder ohne Hof wird nichts geschrieben', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await legeFutterFamilieAn(HEU)).toEqual({ error: 'Bitte melde dich neu an.' })
    getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
    farmForUser.mockResolvedValue(null as never)
    expect(await legeFutterFamilieAn(HEU)).toEqual({ error: 'Kein Hof gefunden.' })
    expect(productCreate).not.toHaveBeenCalled()
  })
})

const BUCHE = {
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
}

describe('legeFutterFamilieAn — Pflicht-Bestätigung (E10a, Nr. 23)', () => {
  it('ohne Haken: abgelehnt mit dem Satz zum Haken, nichts angelegt', async () => {
    const ergebnis = await legeFutterFamilieAn({ ...HEU, kennzeichnung: { ...HEU.kennzeichnung, bestaetigt: false } })

    expect(ergebnis).toEqual({ error: FUTTER_BESTAETIGUNG_FEHLT })
    expect(productCreate).not.toHaveBeenCalled()
  })

  it('ohne Haken UND mit weiterem Fehler: der allgemeine Satz (das Formular zeigt die Felder)', async () => {
    const ergebnis = await legeFutterFamilieAn({ ...HEU, name: '', kennzeichnung: { ...HEU.kennzeichnung, bestaetigt: false } })

    expect(ergebnis).toEqual({ error: 'Bitte prüfe deine Eingaben.' })
    expect(productCreate).not.toHaveBeenCalled()
  })

  it('mit Haken: jede Größe trägt bestaetigtAm = jetzt', async () => {
    await legeFutterFamilieAn(HEU)

    expect(angelegt().every((p) => (p.futter?.create.bestaetigtAm as Date).getTime() === JETZT.getTime())).toBe(true)
  })
})

describe('legeBrennmaterialFamilieAn', () => {
  it('Brennholz mit drei Größen: alle online, Kategorie Brennholz, Art als Unterkategorie', async () => {
    const ergebnis = await legeBrennmaterialFamilieAn(BUCHE)

    expect(ergebnis).toEqual({ ok: true, familieId: expect.any(String), kaufbar: true, online: 3, wartend: [] })
    const produkte = angelegt()
    expect(new Set(produkte.map((p) => p.familieId)).size).toBe(1)
    // Nr. 30: Die Antwort nennt genau die Familie, die angelegt wurde — Anlass des Moments „gespeichert".
    expect('familieId' in ergebnis && ergebnis.familieId).toBe(produkte[0].familieId)
    expect(produkte.map((p) => [p.name, p.unit, p.price, p.stock, p.isAvailable])).toEqual([
      ['Buche, ofenfertig Sack ca. 15 kg', 'STUECK', 8.9, 30, true],
      ['Buche, ofenfertig Schüttraummeter', 'SCHUETTRAUMMETER', 99, 12, true],
      ['Buche, ofenfertig Raummeter', 'RAUMMETER', 129, 4, true],
    ])
    for (const p of produkte) {
      expect(p).toMatchObject({ category: 'BRENNHOLZ', subcategory: 'BRENNHOLZ_SCHEIT', unitSize: null })
      expect('futter' in p).toBe(false)
      expect('verpackung' in p).toBe(false)
    }
    // Für Holz keine Futtermittel-Registrierung — der Hof wird gar nicht gefragt.
    expect(farmFindUnique).not.toHaveBeenCalled()
  })

  it('die Angaben je Größe: Holzart, Scheitlänge, Trocknung mit Restfeuchte, gelagert seit (Wiener Tag), überdacht', async () => {
    await legeBrennmaterialFamilieAn(BUCHE)

    const angaben = (angelegt()[0].brennmaterial as { create: Record<string, unknown> }).create
    expect(angaben).toEqual({
      holzart: 'Buche',
      scheitlaengeCm: 33,
      trocknung: 'OFENFERTIG',
      restfeuchteMax: 20,
      wassergehalt: null,
      koernung: null,
      gelagertSeit: new Date('2024-10-07T00:00:00.000Z'),
      ueberdacht: true,
    })
  })

  it('Hackschnitzel pro Schüttraummeter mit W/P, ohne Scheitlänge; frisch ohne Restfeuchte', async () => {
    await legeBrennmaterialFamilieAn({
      ...BUCHE,
      art: 'HACKSCHNITZEL',
      trocknung: 'FRISCH',
      wassergehalt: 35,
      koernung: 31,
      gelagertJahre: null,
      groessen: [{ bezeichnung: 'Schüttraummeter', unit: 'SCHUETTRAUMMETER', price: 35, stock: 50 }],
    })

    const p = angelegt()[0]
    expect(p.subcategory).toBe('HACKSCHNITZEL')
    expect((p.brennmaterial as { create: Record<string, unknown> }).create).toMatchObject({
      scheitlaengeCm: null,
      wassergehalt: 35,
      koernung: 31,
      restfeuchteMax: null,
      gelagertSeit: null,
    })
  })

  // Nachbesserung Nr. 30: Für den Moment zählt nur eine Größe, die Kunden kaufen können.
  it('Moment-Anlass: alle Größen ohne Vorrat → nicht kaufbar; der Toast-Zähler online bleibt', async () => {
    const ergebnis = await legeBrennmaterialFamilieAn({ ...BUCHE, groessen: BUCHE.groessen.map((g) => ({ ...g, stock: 0 })) })
    expect(ergebnis).toMatchObject({ ok: true, kaufbar: false, online: 3 })
    const eine = await legeBrennmaterialFamilieAn({ ...BUCHE, groessen: BUCHE.groessen.map((g, i) => ({ ...g, stock: i === 2 ? 1 : 0 })) })
    expect(eine).toMatchObject({ ok: true, kaufbar: true })
  })

  it('ungültige Eingabe oder ohne Anmeldung: nichts geschrieben', async () => {
    expect(await legeBrennmaterialFamilieAn({ ...BUCHE, scheitlaengeCm: null })).toEqual({ error: 'Bitte prüfe deine Eingaben.' })
    getSession.mockResolvedValue(null as never)
    expect(await legeBrennmaterialFamilieAn(BUCHE)).toEqual({ error: 'Bitte melde dich neu an.' })
    expect(productCreate).not.toHaveBeenCalled()
  })
})

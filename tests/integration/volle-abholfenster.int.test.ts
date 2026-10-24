/**
 * Integrationstest — volle Abholfenster in Kasse, Hofliste und Hofseite
 * (Register N19, Ergänzung 21.10.2026, Nr. 131).
 *
 * Die Aussagen, die nur die Datenbank beantwortet:
 * - `ausgebuchteTage` zählt viele Höfe mit ZWEI Abfragen (Abholzeiten mit
 *   Höchstzahl, ein groupBy) — und mit einer, wenn keiner eine Höchstzahl hat.
 * - Ein Storno macht das Fenster wieder frei.
 * - Kasse, Liste und Hofseite nennen am selben Bestand dieselben vollen Fenster —
 *   auch bei mehreren Terminen; die Kasse in der Reihenfolge wie bisher.
 * - Ein Testhof (N21): Die Kasse zeigt „ausgebucht“, die Liste zeigt ihn nicht.
 * - Ein Wurf beim Erneuern der Hofliste lässt die Bestellung bestehen.
 * - Seit Nr. 163 (Register N19, Ergänzung 24.10.2026) erneuert nur, wer das
 *   Fenster voll macht oder ein volles wieder frei — gezählt an der echten
 *   Datenbank wie in der Kasse.
 *
 * Bestellt wird über die echte Route (/api/checkout) für morgen 15–18 Uhr
 * (`checkoutAnfrage`). Der Nachlauf wird gesammelt und selbst abgearbeitet
 * (TESTING_GUIDELINES §3): So ist auch belegt, dass das Erneuern nicht im
 * Antwortpfad liegt. `next/cache` ist ersetzt — keine Sicherheitsfunktion.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import pg from 'pg'

vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn(), sendBestellungVerfallen: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))

const cache = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock('next/cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/cache')>()),
  revalidateTag: cache.revalidateTag,
}))

const nachlauf = vi.hoisted(() => ({ aufgaben: [] as Array<() => Promise<void>> }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { tagVersetzt, wochentagVon } from '@/lib/kalender'
import { ausgebuchteAbholfenster, ausgebuchteTage, fensterSchluessel } from '@/server/abholfenster'
import { storniereUnbezahlteBestellung } from '@/server/unbezahlte-bestellung'
import { getOeffentlicheHoefe } from '@/server/queries/farm'
import { ladeHofseite } from '@/server/hofseite-vorschau'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, morgenInWien, raeumeAuf, setzeHalt } from './setup/basis'

const zaehler = { an: false, abfragen: 0 }
const originalQuery = pg.Client.prototype.query

beforeAll(() => {
  // Nur zählen, nichts ändern (Vorbild tests/integration/kasse-lesepfad.int.test.ts).
  pg.Client.prototype.query = function (this: pg.Client, ...args: unknown[]) {
    if (zaehler.an) zaehler.abfragen += 1
    return (originalQuery as (...a: unknown[]) => unknown).apply(this, args)
  } as typeof pg.Client.prototype.query
})

afterAll(() => {
  pg.Client.prototype.query = originalQuery
})

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
})

afterEach(async () => {
  await raeumeAuf()
})

async function arbeiteNachlaufAb(): Promise<void> {
  const aufgaben = nachlauf.aufgaben.splice(0)
  for (const aufgabe of aufgaben) await aufgabe()
}

/** Ein Hof mit täglich 15–18 Uhr; `max` ist die Höchstzahl jedes Fensters (null = ohne). */
async function hof(max: number | null, abweichend: { istTesthof?: boolean } = {}) {
  const { farm } = await erstelleHof(abweichend)
  if (max !== null) await prisma.pickupSlot.updateMany({ where: { farmId: farm.id }, data: { maxOrders: max } })
  const produkt = await erstelleProdukt(farm.id, { stock: 10 })
  return { farm, produkt }
}

type Termin = { datum: string; start: string; ende: string }

/** Eine Barbestellung über die echte Route (ohne `termin`: morgen 15–18 Uhr); liefert die Bestellung. */
async function bestelle(farm: { id: string; slug: string }, produktId: string, termin?: Termin) {
  const sitzung = intKennung('sitzung')
  await setzeHalt(produktId, sitzung, 1)
  const antwort = await checkout(
    checkoutAnfrage({
      farm,
      sessionId: sitzung,
      positionen: [{ productId: produktId, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
      ...(termin ? { pickupDate: termin.datum, zusatz: { pickupTimeStart: termin.start, pickupTimeEnd: termin.ende } } : {}),
    })
  )
  expect(antwort.status).toBe(200)
  return prisma.order.findFirstOrThrow({ where: { farmId: farm.id }, orderBy: { createdAt: 'desc' } })
}

const MORGEN_FENSTER = () => ({ dayOfWeek: wochentagVon(morgenInWien()), startTime: '15:00', endTime: '18:00' })

/** Die vollen Termine eines Eintrags bzw. der Hofseite als Schlüssel wie in der Kasse, sortiert. */
const alsSchluessel = (fenster: ReadonlyArray<{ startTime: string; endTime: string; ausgebuchtAm?: readonly string[] }>) =>
  fenster.flatMap((f) => (f.ausgebuchtAm ?? []).map((tag) => `${tag}|${f.startTime}|${f.endTime}`)).sort()

describe('ausgebuchteTage — die eine Zählung für viele Höfe', () => {
  it('zählt mehrere Höfe mit zwei Abfragen, ohne Höchstzahl mit einer', async () => {
    const voll = await hof(1)
    const frei = await hof(2)
    const ohne = await hof(null)
    await bestelle(voll.farm, voll.produkt.id)
    await bestelle(frei.farm, frei.produkt.id)

    zaehler.abfragen = 0
    zaehler.an = true
    const tage = await ausgebuchteTage([voll.farm.id, frei.farm.id, ohne.farm.id], new Date())
    zaehler.an = false

    expect(zaehler.abfragen).toBe(2)
    expect([...tage.keys()]).toEqual([voll.farm.id])
    expect(tage.get(voll.farm.id)?.get(fensterSchluessel(MORGEN_FENSTER()))).toEqual({
      ...MORGEN_FENSTER(),
      ausgebuchtAm: [morgenInWien()],
    })

    zaehler.abfragen = 0
    zaehler.an = true
    const keine = await ausgebuchteTage([ohne.farm.id], new Date())
    zaehler.an = false
    expect(zaehler.abfragen).toBe(1)
    expect(keine.size).toBe(0)
  })

  it('ein Storno macht das Fenster wieder frei — und erneuert die Hofliste nach dem Commit', async () => {
    const { farm, produkt } = await hof(1)
    const bestellung = await bestelle(farm, produkt.id)
    expect(await ausgebuchteAbholfenster(farm.id, new Date())).toHaveLength(1)
    await arbeiteNachlaufAb()
    cache.revalidateTag.mockClear()

    expect(await storniereUnbezahlteBestellung(bestellung.id, 'Test')).toBe(true)

    expect((await ausgebuchteTage([farm.id], new Date())).size).toBe(0)
    expect(await ausgebuchteAbholfenster(farm.id, new Date())).toEqual([])
    // Erneuert wird erst im Nachlauf, nicht im Storno selbst.
    expect(cache.revalidateTag).not.toHaveBeenCalled()
    await arbeiteNachlaufAb()
    expect(cache.revalidateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG, { expire: 0 })
  })

  it('ein Storno in einem Fenster, das nicht voll war, erneuert nicht (Nr. 163)', async () => {
    const { farm, produkt } = await hof(2)
    const bestellung = await bestelle(farm, produkt.id)
    await arbeiteNachlaufAb()
    expect(cache.revalidateTag).not.toHaveBeenCalled()

    expect(await storniereUnbezahlteBestellung(bestellung.id, 'Test')).toBe(true)
    await arbeiteNachlaufAb()
    expect(cache.revalidateTag).not.toHaveBeenCalled()
  })
})

describe('Kasse, Liste und Hofseite — dieselben vollen Fenster', () => {
  it('nennen am selben Bestand dieselben vollen Fenster', async () => {
    const { farm, produkt } = await hof(1)
    await bestelle(farm, produkt.id)
    const jetzt = new Date()

    const kasse = await ausgebuchteAbholfenster(farm.id, jetzt)
    const eintrag = (await getOeffentlicheHoefe()).find((h) => h.slug === farm.slug)
    const { farm: hofseite } = await ladeHofseite(farm.slug, {})

    expect(kasse).toEqual([`${morgenInWien()}|15:00|18:00`])
    expect(alsSchluessel(eintrag?.abholfenster ?? [])).toEqual(kasse)
    expect(alsSchluessel(hofseite?.pickupSlots ?? [])).toEqual(kasse)
    // Die anderen sechs Abholzeiten tragen das Feld gar nicht (der Zwischenspeicher wächst nicht).
    expect(eintrag?.abholfenster.filter((f) => 'ausgebuchtAm' in f)).toHaveLength(1)
  })

  it('nennen auch vier volle Termine gleich — die Kasse Zeichen für Zeichen wie bisher (Tag, dann Beginn)', async () => {
    const morgen = morgenInWien()
    const uebermorgen = tagVersetzt(morgen, 1)
    const inAchtTagen = tagVersetzt(morgen, 7)
    const { farm } = await erstelleHof({ pickupSlots: { create: [] } })
    // Absichtlich in umgekehrter Reihenfolge angelegt: erst übermorgen, dann
    // morgen der spätere Beginn vor dem früheren.
    for (const slot of [
      { dayOfWeek: wochentagVon(uebermorgen), startTime: '08:00', endTime: '10:00' },
      { dayOfWeek: wochentagVon(morgen), startTime: '14:00', endTime: '16:00' },
      { dayOfWeek: wochentagVon(morgen), startTime: '09:00', endTime: '11:00' },
    ]) {
      await prisma.pickupSlot.create({ data: { ...slot, farmId: farm.id, maxOrders: 1 } })
    }
    const produkt = await erstelleProdukt(farm.id, { stock: 10 })
    // Das Fenster um 09:00 ist morgen UND in acht Tagen voll: In der Map steht es
    // mit beiden Tagen vor den anderen zwei — erst die Sortierung der Kasse
    // ordnet die Termine nach Tag, dann Beginn.
    for (const termin of [
      { datum: inAchtTagen, start: '09:00', ende: '11:00' },
      { datum: uebermorgen, start: '08:00', ende: '10:00' },
      { datum: morgen, start: '14:00', ende: '16:00' },
      { datum: morgen, start: '09:00', ende: '11:00' },
    ]) {
      await bestelle(farm, produkt.id, termin)
    }
    const jetzt = new Date()

    const kasse = await ausgebuchteAbholfenster(farm.id, jetzt)
    const eintrag = (await getOeffentlicheHoefe()).find((h) => h.slug === farm.slug)
    const { farm: hofseite } = await ladeHofseite(farm.slug, {})

    expect(kasse).toEqual([
      `${morgen}|09:00|11:00`,
      `${morgen}|14:00|16:00`,
      `${uebermorgen}|08:00|10:00`,
      `${inAchtTagen}|09:00|11:00`,
    ])
    expect(alsSchluessel(eintrag?.abholfenster ?? [])).toEqual(kasse)
    expect(alsSchluessel(hofseite?.pickupSlots ?? [])).toEqual(kasse)
    expect(eintrag?.abholfenster.filter((f) => 'ausgebuchtAm' in f)).toHaveLength(3)
  })

  it('ein Testhof mit vollem Fenster: Die Kasse zeigt „ausgebucht“, die Liste zeigt ihn nicht', async () => {
    const { farm, produkt } = await hof(1, { istTesthof: true })
    await bestelle(farm, produkt.id)

    expect(await ausgebuchteAbholfenster(farm.id, new Date())).toEqual([`${morgenInWien()}|15:00|18:00`])
    expect((await getOeffentlicheHoefe()).some((h) => h.slug === farm.slug)).toBe(false)
  })
})

describe('Erneuern der Hofliste nach dem Anlegen', () => {
  it('ein Platz bleibt → erneuert nicht; die Bestellung, die das Fenster voll macht, erneuert (Nr. 163)', async () => {
    const { farm, produkt } = await hof(2)
    await bestelle(farm, produkt.id)
    await arbeiteNachlaufAb()
    expect(cache.revalidateTag).not.toHaveBeenCalled()

    await bestelle(farm, produkt.id)
    await arbeiteNachlaufAb()
    expect(cache.revalidateTag).toHaveBeenCalledTimes(1)
    expect(cache.revalidateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG, { expire: 0 })
  })

  it('erneuert, wenn das Fenster voll wird; ein Wurf dabei lässt die Bestellung bestehen', async () => {
    cache.revalidateTag.mockImplementation(() => {
      throw new Error('Erneuern gescheitert')
    })
    const { farm, produkt } = await hof(1)

    const bestellung = await bestelle(farm, produkt.id)
    await arbeiteNachlaufAb()

    expect(cache.revalidateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG, { expire: 0 })
    const danach = await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id } })
    expect(danach.status).toBe('PENDING_CONFIRMATION')
  })

  it('ohne Höchstzahl erneuert nichts', async () => {
    const { farm, produkt } = await hof(null)
    await bestelle(farm, produkt.id)
    await arbeiteNachlaufAb()
    expect(cache.revalidateTag).not.toHaveBeenCalled()
  })
})

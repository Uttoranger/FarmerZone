/**
 * Integrationstest — volle Abholfenster in Kasse, Hofliste und Hofseite
 * (Register N19, Ergänzung 21.10.2026, Nr. 131).
 *
 * Die Aussagen, die nur die Datenbank beantwortet:
 * - `ausgebuchteTage` zählt viele Höfe mit ZWEI Abfragen (Abholzeiten mit
 *   Höchstzahl, ein groupBy) — und mit einer, wenn keiner eine Höchstzahl hat.
 * - Ein Storno macht das Fenster wieder frei.
 * - Kasse, Liste und Hofseite nennen am selben Bestand dieselben vollen Fenster.
 * - Ein Testhof (N21): Die Kasse zeigt „ausgebucht“, die Liste zeigt ihn nicht.
 * - Ein Wurf beim Erneuern der Hofliste lässt die Bestellung bestehen.
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
import { wochentagVon } from '@/lib/kalender'
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

/** Eine Barbestellung für morgen 15–18 Uhr über die echte Route; liefert die Bestellung. */
async function bestelle(farm: { id: string; slug: string }, produktId: string) {
  const sitzung = intKennung('sitzung')
  await setzeHalt(produktId, sitzung, 1)
  const antwort = await checkout(
    checkoutAnfrage({ farm, sessionId: sitzung, positionen: [{ productId: produktId, name: 'Testprodukt', quantity: 1, unitPrice: 10 }] })
  )
  expect(antwort.status).toBe(200)
  return prisma.order.findFirstOrThrow({ where: { farmId: farm.id }, orderBy: { createdAt: 'desc' } })
}

const MORGEN_FENSTER = () => ({ dayOfWeek: wochentagVon(morgenInWien()), startTime: '15:00', endTime: '18:00' })

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
})

describe('Kasse, Liste und Hofseite — dieselben vollen Fenster', () => {
  it('nennen am selben Bestand dieselben vollen Fenster', async () => {
    const { farm, produkt } = await hof(1)
    await bestelle(farm, produkt.id)
    const jetzt = new Date()

    const kasse = await ausgebuchteAbholfenster(farm.id, jetzt)
    const eintrag = (await getOeffentlicheHoefe()).find((h) => h.slug === farm.slug)
    const { farm: hofseite } = await ladeHofseite(farm.slug, {})

    const alsSchluessel = (fenster: ReadonlyArray<{ startTime: string; endTime: string; ausgebuchtAm?: readonly string[] }>) =>
      fenster.flatMap((f) => (f.ausgebuchtAm ?? []).map((tag) => `${tag}|${f.startTime}|${f.endTime}`)).sort()
    expect(kasse).toEqual([`${morgenInWien()}|15:00|18:00`])
    expect(alsSchluessel(eintrag?.abholfenster ?? [])).toEqual(kasse)
    expect(alsSchluessel(hofseite?.pickupSlots ?? [])).toEqual(kasse)
    // Die anderen sechs Abholzeiten tragen das Feld gar nicht (der Zwischenspeicher wächst nicht).
    expect(eintrag?.abholfenster.filter((f) => 'ausgebuchtAm' in f)).toHaveLength(1)
  })

  it('ein Testhof mit vollem Fenster: Die Kasse zeigt „ausgebucht“, die Liste zeigt ihn nicht', async () => {
    const { farm, produkt } = await hof(1, { istTesthof: true })
    await bestelle(farm, produkt.id)

    expect(await ausgebuchteAbholfenster(farm.id, new Date())).toEqual([`${morgenInWien()}|15:00|18:00`])
    expect((await getOeffentlicheHoefe()).some((h) => h.slug === farm.slug)).toBe(false)
  })
})

describe('Erneuern der Hofliste nach dem Anlegen', () => {
  it('erneuert bei einem Fenster mit Höchstzahl; ein Wurf dabei lässt die Bestellung bestehen', async () => {
    cache.revalidateTag.mockImplementation(() => {
      throw new Error('Erneuern gescheitert')
    })
    const { farm, produkt } = await hof(3)

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

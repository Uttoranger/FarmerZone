/**
 * Preise vergleichen (Register N23, Nr. 124) gegen echtes Postgres: die
 * Leitplanke „Testhöfe, pausierte Höfe und der eigene Hof fehlen in Zählung,
 * Streifen und Karte" an echten Zeilen — je Fall ein Test —, dazu die
 * Reihenfolge der Hofseite in der Karte am Pin und die Zählung je Stufe aus
 * EINEM Laden bis 50 km.
 *
 * Alles trägt das Präfix int- (raeumeAuf). Der Standort liegt weit weg von den
 * Seed-Höfen (alle nördlich von 47,8°), damit nur die eigenen Zeilen zählen.
 * Die Uhr bleibt echt; geprüft werden Zustände.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { baueUmfeld, baueUmfeldKarte, type UmfeldKm } from '@/lib/umfeld'
import { getUmfeld } from '@/server/queries/umfeld'
import { erstelleHof, erstelleProdukt, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

const STANDORT = { latitude: 47.25, longitude: 11.4 }
/** Ein Punkt rund `km` nördlich des Standorts (1° Breite ≈ 111,2 km). */
const noerdlich = (km: number) => ({ latitude: STANDORT.latitude + km / 111.2, longitude: STANDORT.longitude })

/** Ein kaufbarer Blütenhonig je Kilo — der Preis in Euro. */
async function honig(farmId: string, preis: number, teil: { name?: string; sortOrder?: number; stock?: number } = {}) {
  const produkt = await erstelleProdukt(farmId, { price: preis, name: teil.name ?? 'Blütenhonig', stock: teil.stock ?? 5 })
  await prisma.product.update({
    where: { id: produkt.id },
    data: { category: 'HONIG', subcategory: 'BLUETENHONIG', unit: 'KG', sortOrder: teil.sortOrder ?? 0 },
  })
  return produkt
}

async function ansicht(farmId: string, km: UmfeldKm = 25) {
  const daten = await getUmfeld(farmId)
  if (!daten?.eigenerStandort) throw new Error('Umfeld ohne Standort')
  const eingabe = { ...daten, bereich: 'LEBENSMITTEL' as const, km }
  const { zeilen, zahlen } = baueUmfeld(eingabe)
  const karte = baueUmfeldKarte({ ...eingabe, eigenerStandort: daten.standort })
  const honigZeile = zeilen.find((z) => z.titel === 'Blütenhonig')
  return { zahlen, streifen: honigZeile?.preise[0]?.streifen ?? null, zeile: honigZeile, pins: karte.pins }
}

/** Zwei sichtbare Nachbarn mit Honig zu € 10 und € 12 — ihr Streifen ist [1000, 1200]. */
async function zweiNachbarn() {
  const { farm: a } = await erstelleHof({ name: 'Testhof A', ...noerdlich(5) })
  const { farm: b } = await erstelleHof({ name: 'Testhof B', ...noerdlich(15) })
  await honig(a.id, 10)
  await honig(b.id, 12)
  return [a.slug, b.slug]
}

describe('Preise vergleichen — Testhof, pausierter und eigener Hof fehlen in Zählung, Streifen und Karte', () => {
  it('ein Testhof mit auffälligem Preis zählt nirgends mit', async () => {
    const { farm: eigen } = await erstelleHof(STANDORT)
    const nachbarn = await zweiNachbarn()
    const { farm: testhof } = await erstelleHof({ name: 'Sonnhof', istTesthof: true, ...noerdlich(3) })
    await honig(testhof.id, 99)

    const { zahlen, streifen, pins } = await ansicht(eigen.id)

    expect(zahlen).toEqual({ 10: 1, 25: 2, 50: 2 })
    expect(streifen?.werte).toEqual([1000, 1200])
    expect(pins.map((p) => p.slug)).toEqual(nachbarn)
  })

  it('ein pausierter Hof zählt nirgends mit', async () => {
    const { farm: eigen } = await erstelleHof(STANDORT)
    const nachbarn = await zweiNachbarn()
    const { farm: pausiert } = await erstelleHof({ name: 'Sonnhof', isPaused: true, ...noerdlich(4) })
    await honig(pausiert.id, 99)

    const { zahlen, streifen, pins } = await ansicht(eigen.id)

    expect(zahlen).toEqual({ 10: 1, 25: 2, 50: 2 })
    expect(streifen?.werte).toEqual([1000, 1200])
    expect(pins.map((p) => p.slug)).toEqual(nachbarn)
  })

  it('der eigene Hof steht nur als „Deins" da — nie als Punkt, Pin oder in der Zahl', async () => {
    const { farm: eigen } = await erstelleHof(STANDORT)
    const nachbarn = await zweiNachbarn()
    await honig(eigen.id, 11.5)

    const { zahlen, streifen, pins, zeile } = await ansicht(eigen.id)

    expect(zahlen).toEqual({ 10: 1, 25: 2, 50: 2 })
    expect(streifen).toMatchObject({ werte: [1000, 1200], deins: 1150 })
    expect(zeile?.hoefe.map((h) => h.slug)).toEqual(nachbarn)
    expect(pins.map((p) => p.slug)).not.toContain(eigen.slug)
  })
})

describe('Preise vergleichen — ein Laden bis 50 km, Karte am Pin in der Reihenfolge der Hofseite', () => {
  it('zählt je Stufe aus einem Laden; der Hof in 30 km steht erst bei 50 km in Liste und Karte', async () => {
    const { farm: eigen } = await erstelleHof(STANDORT)
    const nachbarn = await zweiNachbarn()
    const { farm: weit } = await erstelleHof({ name: 'Testhof C', ...noerdlich(30) })
    await honig(weit.id, 14)

    const bei25 = await ansicht(eigen.id, 25)
    const bei50 = await ansicht(eigen.id, 50)

    expect(bei25.zahlen).toEqual({ 10: 1, 25: 2, 50: 3 })
    expect(bei50.zahlen).toEqual(bei25.zahlen)
    expect(bei25.pins.map((p) => p.slug)).toEqual(nachbarn)
    expect(bei50.pins.map((p) => p.slug)).toEqual([...nachbarn, weit.slug])
    expect(bei50.streifen?.werte).toEqual([1000, 1200, 1400])
  })

  it('die Karte am Pin zeigt die ersten zwei kaufbaren Produkte nach sortOrder — nicht nach Preis, ohne ausverkaufte', async () => {
    const { farm: eigen } = await erstelleHof(STANDORT)
    const { farm: nachbar } = await erstelleHof({ name: 'Testhof A', ...noerdlich(5) })
    await honig(nachbar.id, 3, { name: 'Dritter', sortOrder: 3 })
    await honig(nachbar.id, 9, { name: 'Erster', sortOrder: 1 })
    await honig(nachbar.id, 1, { name: 'Ausverkauft', sortOrder: 0, stock: 0 })
    await honig(nachbar.id, 6, { name: 'Zweiter', sortOrder: 2 })

    const { pins } = await ansicht(eigen.id)

    expect(pins).toHaveLength(1)
    expect(pins[0].produkte.map((p) => p.name)).toEqual(['Erster', 'Zweiter'])
    // Kein Bestand, keine Hof-ID in den Daten der Karte — nur, was die Hofseite zeigt.
    const text = JSON.stringify(pins)
    expect(text).not.toContain(nachbar.id)
    expect(text).not.toMatch(/stock|reservedStock|€/)
  })
})

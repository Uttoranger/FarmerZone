/**
 * Das Teilen-Bild baut aus der Abfrage der Hofseite (Nr. 196, Rest aus Nr. 180).
 *
 * Beweist mit nachgebauter Datenbankzeile:
 *  - Die Rohdaten des Teilen-Bilds sind dieselben wie vor Nr. 196 (Schnappschuss
 *    der Daten, nicht des Bilds): Hof, Produkte, Fotos, Abholzeiten.
 *  - Der Preis kommt als Cent aus dem Decimal derselben Zeile, nie über
 *    `price: number` (1,005 € → 101 Cent; über die Fließkommazahl wären es 100).
 *  - Verpackung und Betriebsnummer bleiben auf dem Server: Der Hof für den
 *    Browser (getPublicFarm) trägt sie nicht.
 *  - Eine Abfrage für Hof und Teilen-Bild: findUnique einmal, kein findFirst.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Decimal } from '@prisma/client/runtime/index-browser'

vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findUnique: vi.fn(), findFirst: vi.fn() } } }))

import { prisma } from '@/lib/prisma'
import { hofseitenZeile } from './hofseiten-zeile'
import { getPublicFarm, getPublicFarmMitTeilen } from '@/server/queries/farm'
import { ladeTeilenBildQuelle, teilenBildQuelleAus } from '@/server/queries/teilen-bild'

const ZEILE = {
  id: 'farm-1',
  name: 'Hof Test',
  slug: 'hof-test',
  city: 'Teststadt',
  isPaused: false,
  betriebsnummer: '1234567',
  betriebsstatus: 'PRIMAERPRODUKTION',
  approvedAt: new Date('2026-10-01T08:00:00Z'),
  gruendungPlatz: 3,
  gruendungAusgenommen: false,
  gruendungAbzeichenZeigen: true,
  products: [
    {
      id: 'eier',
      name: 'Freilandeier',
      price: new Decimal('1.005'),
      isAvailable: true,
      stock: 3,
      familieId: null,
      category: 'EIER',
      verpackung: null,
      imageUrl: 'https://testspeicher.public.blob.vercel-storage.com/farms/farm-1/product/1.webp',
    },
    { id: 'heu-gross', name: 'Heu', price: new Decimal('45.00'), isAvailable: true, stock: 2, familieId: 'fam-heu', category: 'HEU_STROH', verpackung: 'LOSE_BALLEN', imageUrl: null },
    { id: 'honig', name: 'Blütenhonig', price: new Decimal('8.90'), isAvailable: false, stock: 0, familieId: null, category: 'HONIG', verpackung: null, imageUrl: null },
  ],
  pickupSlots: [
    { dayOfWeek: 3, startTime: '15:00', endTime: '18:00' },
    { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' },
  ],
}

const findUnique = vi.mocked(prisma.farm.findUnique)

beforeEach(() => {
  vi.clearAllMocks()
  findUnique.mockResolvedValue(hofseitenZeile(ZEILE) as never)
})

describe('Teilen-Bild aus der Abfrage der Hofseite', () => {
  it('dieselben Rohdaten wie vor Nr. 196 (Schnappschuss der Daten)', async () => {
    const quelle = await ladeTeilenBildQuelle({ slug: 'hof-test' })
    expect(quelle).toEqual({
      farmId: 'farm-1',
      hof: {
        name: 'Hof Test',
        slug: 'hof-test',
        city: 'Teststadt',
        isPaused: false,
        betriebsnummer: '1234567',
        betriebsstatus: 'PRIMAERPRODUKTION',
        gruendungshof: true,
      },
      produkte: [
        { id: 'eier', name: 'Freilandeier', preisCents: 101, isAvailable: true, stock: 3, familieId: null, category: 'EIER', verpackung: null },
        { id: 'heu-gross', name: 'Heu', preisCents: 4500, isAvailable: true, stock: 2, familieId: 'fam-heu', category: 'HEU_STROH', verpackung: 'LOSE_BALLEN' },
        { id: 'honig', name: 'Blütenhonig', preisCents: 890, isAvailable: false, stock: 0, familieId: null, category: 'HONIG', verpackung: null },
      ],
      fotos: new Map([['eier', 'https://testspeicher.public.blob.vercel-storage.com/farms/farm-1/product/1.webp']]),
      slots: [
        { dayOfWeek: 3, startTime: '15:00', endTime: '18:00' },
        { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' },
      ],
    })
  })

  it('eine Abfrage mit der Sichtbarkeitsregel der Hofseite, nach Slug und nach Kennung', async () => {
    await ladeTeilenBildQuelle({ slug: 'hof-test' })
    await ladeTeilenBildQuelle({ id: 'farm-1' })
    expect(findUnique).toHaveBeenCalledTimes(2)
    expect(prisma.farm.findFirst).not.toHaveBeenCalled()
    expect(findUnique.mock.calls[0][0]?.where).toMatchObject({ slug: 'hof-test', isActive: true, archivedAt: null, approvedAt: { not: null } })
    expect(findUnique.mock.calls[1][0]?.where).toMatchObject({ id: 'farm-1', isActive: true, archivedAt: null, approvedAt: { not: null } })
    // Gegenprobe: kein öffentlicher Hof, kein Bild.
    findUnique.mockResolvedValueOnce(null)
    expect(await ladeTeilenBildQuelle({ slug: 'hof-test' })).toBeNull()
  })

  it('der Preis ist Cent aus dem Decimal, nicht aus der Zahl der Kundenansicht', async () => {
    const hof = await getPublicFarmMitTeilen({ slug: 'hof-test' })
    if (!hof) throw new Error('erwartet einen öffentlichen Hof')
    expect(hof.farm.products[0].price).toBe(1.005)
    // Gegenprobe: über die Zahl gerechnet wäre es ein Cent weniger.
    expect(Math.round(hof.farm.products[0].price * 100)).toBe(100)
    expect(teilenBildQuelleAus(hof).produkte[0].preisCents).toBe(101)
  })

  it('Verpackung und Betriebsnummer gehen nicht an den Browser', async () => {
    const farm = await getPublicFarm('hof-test')
    expect(farm).not.toBeNull()
    expect(JSON.stringify(farm)).not.toContain('1234567')
    expect(farm?.products.every((p) => !('verpackung' in p))).toBe(true)
    // Gegenprobe: die Abfrage liest beides, die Rohwerte des Teilen-Bilds tragen es.
    const select = findUnique.mock.calls[0][0]?.select as { betriebsnummer?: unknown; products: { select: Record<string, unknown> } }
    expect(select.betriebsnummer).toBe(true)
    expect(select.products.select.verpackung).toBe(true)
    expect((await getPublicFarmMitTeilen({ slug: 'hof-test' }))?.teilen.produkte.get('heu-gross')?.verpackung).toBe('LOSE_BALLEN')
  })
})

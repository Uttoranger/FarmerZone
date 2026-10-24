/**
 * Land des Hofs bis ins JSON-LD (Nr. 164, Nachbesserung Runde 1): Der Weg der Hofseite ist
 * `getPublicFarm` (liest `country`) -> `hofJsonLd` -> `addressCountry`. Ein Test nur der
 * Funktion hatte übersehen, dass die Abfrage die Spalte gar nicht las und jeder Hof als AT stand.
 *
 * Beweist: Die Abfrage wählt `country`; ein DE-Hof steht als DE im Block, ein AT-Hof als AT
 * (Gegenprobe); die Hofseite übergibt den Hof aus `getPublicFarm` an `hofJsonLd`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findUnique: vi.fn() } } }))

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '@/lib/prisma'
import { getPublicFarm } from '@/server/queries/farm'
import { hofJsonLd } from '@/lib/json-ld'

function zeile(country: string) {
  return {
    id: 'hof_1', slug: 'sonnhof', name: 'Sonnhof', ownerName: 'Erika Muster', description: '', address: 'Teststraße 1',
    postalCode: '84359', city: 'Teststadt', country, phone: '+43 660 0000000', email: 'hof@example.com',
    logoUrl: null, bannerUrl: null, tagline: null, foundedYear: null, aboutText: null, bannerType: 'GRADIENT', bannerValue: null,
    bannerFocusY: 50, bannerAusschnitt: null, logoAusschnitt: null, sectionsConfig: null, acceptsOnline: true, acceptsOnsite: true,
    stripeAccountReady: true, isPaused: false, pauseMessage: null, serviceFeePercent: 0, serviceFeeMinCents: 0, serviceFeeActiveFrom: null,
    farmValues: [], farmPhotos: [], betriebsnummer: null, betriebsstatus: null, products: [], pickupSlots: [],
    approvedAt: new Date('2026-10-05T10:00:00Z'), gruendungPlatz: null, gruendungAusgenommen: false, gruendungAbzeichenZeigen: false,
  }
}

async function landImBlock(country: string): Promise<unknown> {
  vi.mocked(prisma.farm.findUnique).mockResolvedValue(zeile(country) as never)
  const hof = await getPublicFarm('sonnhof')
  expect(hof).not.toBeNull()
  return (hofJsonLd(hof!, null, undefined).address as { addressCountry: string }).addressCountry
}

beforeEach(() => vi.clearAllMocks())

describe('Hofseite: addressCountry aus dem Land des Hofs', () => {
  it('ein DE-Hof steht als DE im Block, ein AT-Hof als AT', async () => {
    expect(await landImBlock('DE')).toBe('DE')
    expect(await landImBlock('AT')).toBe('AT')
  })

  it('die Abfrage wählt die Spalte country (sonst stünde jeder Hof als AT da)', async () => {
    await landImBlock('DE')
    const arg = vi.mocked(prisma.farm.findUnique).mock.calls[0]![0] as { select: Record<string, unknown> }
    expect(arg.select.country).toBe(true)
  })

  it('die Hofseite gibt den Hof aus der Abfrage an hofJsonLd', () => {
    const seite = readFileSync(join(process.cwd(), 'src/app/(public)/[farmSlug]/page.tsx'), 'utf8')
    expect(seite).toContain('hofJsonLd(farm, geo,')
  })
})

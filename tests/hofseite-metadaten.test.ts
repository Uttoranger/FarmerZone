/**
 * Die Beschreibung der Hofseite für Suchmaschinen und Teilen-Vorschau
 * (generateMetadata in src/app/(public)/[farmSlug]/page.tsx, Nachbesserung
 * Nr. 49): dieselbe Regel wie „Über uns" auf der Seite (ueberUnsText). Das
 * Formular „Auftritt" speichert einen geleerten Über-uns-Text als '' — dann
 * steht dort die Kurzbeschreibung, wie auf der Hofseite, nie eine leere Zeile.
 *
 * Geladen wird über dieselbe Abfrage wie die Seite (ladeHofseiteGeteilt), hier
 * ersetzt; ohne Teilen-Bild bleibt die Beschreibung auch die der Vorschau.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/server/hofseite-vorschau', () => ({ ladeHofseiteGeteilt: vi.fn() }))
vi.mock('@/server/queries/teilen-bild', () => ({ ladeTeilenVorschau: vi.fn(async () => null) }))
// Die Seite bindet die Hofseite mit Stiften ein; deren Speicherwege bleiben hier ohne Wirkung.
vi.mock('@/server/actions/appearance', () => ({ updateFarmBannerAction: vi.fn() }))
vi.mock('@/server/actions/farm-photos', () => ({ addFarmPhotoAction: vi.fn(), reorderPhotosAction: vi.fn() }))
vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))

import { generateMetadata } from '@/app/(public)/[farmSlug]/page'
import { ladeHofseiteGeteilt } from '@/server/hofseite-vorschau'
import type { PublicFarm } from '@/server/queries/farm'

const lade = vi.mocked(ladeHofseiteGeteilt)
const KURZ = 'Gemüse und Eier aus Musterdorf'

/** Beschreibung der Metadaten und der Teilen-Vorschau für einen Hof mit diesen beiden Texten. */
async function beschreibungen(aboutText: string | null, description = KURZ): Promise<{ meta: unknown; vorschau: unknown }> {
  const farm = { name: 'Hof Test', slug: 'hof-test', aboutText, description } as PublicFarm
  lade.mockResolvedValue({ farm, ansicht: { art: 'kundin', noindex: false, kaufen: true } })
  const meta = await generateMetadata({ params: Promise.resolve({ farmSlug: 'hof-test' }), searchParams: Promise.resolve({}) })
  return { meta: meta.description, vorschau: (meta.openGraph as { description?: string } | undefined)?.description }
}

describe('Metadaten der Hofseite: Beschreibung wie „Über uns" (ueberUnsText)', () => {
  it('geleerter Über-uns-Text (\'\') und eine Kurzbeschreibung: die Kurzbeschreibung', async () => {
    expect(await beschreibungen('')).toEqual({ meta: KURZ, vorschau: KURZ })
  })

  it('nur Leerzeichen und kein eigener Text (null) zählen genauso wenig', async () => {
    expect(await beschreibungen('  \n ')).toEqual({ meta: KURZ, vorschau: KURZ })
    expect(await beschreibungen(null)).toEqual({ meta: KURZ, vorschau: KURZ })
  })

  it('Gegenprobe: ein eigener Text steht da, ohne Ränder', async () => {
    expect(await beschreibungen('  Seit drei Generationen am Hang.  ')).toEqual({
      meta: 'Seit drei Generationen am Hang.',
      vorschau: 'Seit drei Generationen am Hang.',
    })
  })

  it('höchstens 155 Zeichen; ohne beide Texte bleibt die Beschreibung leer', async () => {
    expect(((await beschreibungen('x'.repeat(400))).meta as string).length).toBe(155)
    expect(await beschreibungen(null, '')).toEqual({ meta: '', vorschau: '' })
  })
})

/**
 * Verknüpfte Produkte eines Beitrags (Nr. 35, Morgenbericht Lauf 6 §6) gegen
 * ein ECHTES Postgres: publishStatusPost nimmt nur Produkte des eigenen Hofs.
 * Die Prüfung ist eine Abfrage mit `{ id: { in }, farmId }` — ob sie fremde
 * Produkte wirklich aussortiert, zeigt erst die echte Datenbank.
 *
 * Beweist: eigene Produkte werden gespeichert; ein Produkt eines anderen Hofs
 * oder eine unbekannte Kennung lehnt den Beitrag ab, und es entsteht keiner.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendStatusUpdateEmail: vi.fn() }))

import { headers } from 'next/headers'
import { publishStatusPost } from '@/server/actions/status-posts'
import { BEITRAG_PRODUKT_FREMD } from '@/schemas/status-post'
import { prisma } from '@/lib/prisma'
import { erstelleHof, erstelleHofMitAnmeldung, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

async function angemeldeterHof() {
  const { farm, cookie } = await erstelleHofMitAnmeldung()
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return farm
}

const beitrag = (linkedProductIds: string[]) => ({
  title: 'Neue Eier',
  body: 'Frisch gelegt.',
  anlass: 'FRESH_PRODUCT' as const,
  showOnFarmPage: true,
  sendEmail: false,
  sendWhatsApp: false,
  linkedProductIds,
})

const beitraegeVon = (farmId: string) => prisma.statusPost.findMany({ where: { farmId }, select: { linkedProductIds: true } })

describe('publishStatusPost — verknüpfte Produkte in der echten Datenbank', () => {
  it('eigene Produkte werden gespeichert', async () => {
    const farm = await angemeldeterHof()
    const a = await erstelleProdukt(farm.id)
    const b = await erstelleProdukt(farm.id)

    const antwort = await publishStatusPost(beitrag([a.id, b.id]))

    expect(antwort.error).toBeUndefined()
    expect(antwort.postId).toBeTruthy()
    const [gespeichert] = await beitraegeVon(farm.id)
    expect([...(gespeichert?.linkedProductIds ?? [])].sort()).toEqual([a.id, b.id].sort())
  })

  it('ein Produkt eines anderen Hofs: abgelehnt, kein Beitrag', async () => {
    const farm = await angemeldeterHof()
    const eigenes = await erstelleProdukt(farm.id)
    const { farm: anderer } = await erstelleHof()
    const fremdes = await erstelleProdukt(anderer.id)

    const antwort = await publishStatusPost(beitrag([eigenes.id, fremdes.id]))

    expect(antwort.error).toBe(BEITRAG_PRODUKT_FREMD)
    expect(await beitraegeVon(farm.id)).toEqual([])
  })

  it('eine unbekannte Kennung: abgelehnt, kein Beitrag', async () => {
    const farm = await angemeldeterHof()
    const eigenes = await erstelleProdukt(farm.id)

    const antwort = await publishStatusPost(beitrag([eigenes.id, intKennung('gibt-es-nicht')]))

    expect(antwort.error).toBe(BEITRAG_PRODUKT_FREMD)
    expect(await beitraegeVon(farm.id)).toEqual([])
  })
})

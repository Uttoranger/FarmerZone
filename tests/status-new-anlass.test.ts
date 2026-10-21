/**
 * „Neuer Beitrag“ mit vorgewähltem Anlass (Register E12, Ergänzung Nr. 129):
 * Der Anstoß in Heute verlinkt `/status/new?anlass=<ANLASS>`. Die Adresse ist
 * Fremddaten — nur ein Anlass aus src/lib/beitrag-anlass.ts kommt an, alles
 * andere wird verworfen; `from` (Vorlage) behält seine Bedeutung, kommen beide,
 * gelten beide.
 *
 * Die Seite läuft echt (Zod an der Grenze); Sitzung, Datenbank und der
 * Assistent sind Attrappen — geprüft wird, was beim Assistenten ankommt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => ({ user: { id: 'user-a' } })) } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn(async () => ({ id: 'farm-a', slug: 'testhof-a', name: 'Testhof A' })) }))
vi.mock('@/server/queries/status-posts', () => ({ getStatusTemplate: vi.fn(async () => null) }))
vi.mock('@/server/abo-anmeldung', () => ({ WERBEMAIL_EMPFAENGER: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn(async () => []) },
    customerFarmSubscription: { count: vi.fn(async () => 0) },
    statusPost: { findFirst: vi.fn(async () => null) },
  },
}))
vi.mock('@/components/hofbereich/unterseiten-kopf', () => ({ UnterseitenKopf: () => null }))
vi.mock('@/app/(hof)/status/new/status-new-client', () => ({ StatusNewClient: vi.fn(() => null) }))

import StatusNewPage from '@/app/(hof)/status/new/page'
import { StatusNewClient } from '@/app/(hof)/status/new/status-new-client'
import { getStatusTemplate } from '@/server/queries/status-posts'
import { findeElement } from './element-suche'

async function propsMit(suche: Record<string, string | string[]>): Promise<Record<string, unknown>> {
  const seite = await StatusNewPage({ searchParams: Promise.resolve(suche) })
  const client = findeElement(seite, StatusNewClient)
  if (!client) throw new Error('Assistent nicht gefunden')
  return client.props
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/status/new?anlass=', () => {
  it.each(['FRESH_PRODUCT', 'NEW_SEASON', 'PROMOTION', 'ANNOUNCEMENT'])('ein gültiger Anlass (%s) kommt vorgewählt an', async (anlass) => {
    expect((await propsMit({ anlass })).anlass).toBe(anlass)
  })

  it.each([['WERBUNG'], ['new_season'], [''], [['NEW_SEASON', 'PROMOTION']]])('ungültig (%j) wird verworfen — kein Anlass, kein Fehler', async (anlass) => {
    expect((await propsMit({ anlass })).anlass).toBeNull()
  })

  it('ohne Parameter kein Anlass — der Assistent nimmt wie bisher den ersten', async () => {
    expect((await propsMit({})).anlass).toBeNull()
  })

  it('kommen `from` und `anlass`, gelten beide: Vorlage geladen und Anlass vorgewählt', async () => {
    const vorlage = { anlass: 'ANNOUNCEMENT' as const, title: 'Erfundener Titel', body: 'Erfundener Text.', photoUrl: null }
    vi.mocked(getStatusTemplate).mockResolvedValueOnce(vorlage)
    const props = await propsMit({ from: 'cvorlage', anlass: 'PROMOTION' })
    expect(getStatusTemplate).toHaveBeenCalledWith('farm-a', 'cvorlage')
    expect(props.prefill).toEqual(vorlage)
    expect(props.anlass).toBe('PROMOTION')
  })
})

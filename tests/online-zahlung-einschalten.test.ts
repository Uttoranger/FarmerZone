/**
 * Kein Bestandshof bleibt in „nur bar" stecken (Register Z1, Nachbesserung
 * Nr. 24 Runde 1).
 *
 * Höfe aus der Zeit vor Z1 können `acceptsOnline = false` tragen. Der
 * Checkout bietet ihnen dann online nicht an — auch mit fertigem Stripe. Es
 * gibt deshalb zwei Wege zurück, beide nur für den eigenen Hof und nur auf
 * true:
 *  - Wer Stripe einrichtet (`createConnectAccount`, `createOnboardingLink`),
 *    schaltet Online im selben Zug ein.
 *  - Wessen Stripe schon fertig ist, schaltet es mit
 *    `schalteOnlineZahlungEin` ein (Zahlungs-Einstellungen).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sitzung = vi.hoisted(() => ({ wert: { user: { id: 'user_1' } } as { user: { id: string } } | null }))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => sitzung.wert) } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: { farm: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() } },
}))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    accounts: { create: vi.fn(async () => ({ id: 'acct_test_platzhalter' })) },
    accountLinks: { create: vi.fn(async () => ({ url: 'https://connect.stripe.test/platzhalter' })) },
  },
}))

import { prisma } from '@/lib/prisma'
import { createConnectAccount, createOnboardingLink, schalteOnlineZahlungEin } from '@/server/actions/stripe-connect'

const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const farmUpdate = vi.mocked(prisma.farm.update)
const farmUpdateMany = vi.mocked(prisma.farm.updateMany)

const HOF = {
  id: 'farm_1',
  name: 'Hof Test',
  slug: 'hof-test',
  email: 'hof@example.com',
  stripeAccountId: null as string | null,
  stripeAccountReady: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  sitzung.wert = { user: { id: 'user_1' } }
  farmFindUnique.mockResolvedValue(HOF as never)
  farmUpdate.mockResolvedValue({} as never)
  farmUpdateMany.mockResolvedValue({ count: 1 } as never)
})

describe('Stripe einrichten schaltet Online-Zahlung mit ein', () => {
  it('createConnectAccount setzt acceptsOnline im selben Update wie die Konto-Kennung — für den eigenen Hof', async () => {
    expect(await createConnectAccount()).toEqual({})

    expect(farmUpdate).toHaveBeenCalledTimes(1)
    expect(farmUpdate.mock.calls[0][0]).toEqual({
      where: { id: 'farm_1' },
      data: { stripeAccountId: 'acct_test_platzhalter', acceptsOnline: true },
    })
  })

  it('createOnboardingLink (Einrichtung fortsetzen) setzt acceptsOnline für den eigenen Hof', async () => {
    farmFindUnique.mockResolvedValue({ ...HOF, stripeAccountId: 'acct_test_platzhalter' } as never)

    const antwort = await createOnboardingLink()

    expect(antwort.url).toBeTruthy()
    expect(farmUpdateMany).toHaveBeenCalledWith({ where: { id: 'farm_1' }, data: { acceptsOnline: true } })
  })

  it('Gegenprobe: ohne Konto schreibt createOnboardingLink nichts', async () => {
    expect((await createOnboardingLink()).error).toBeTruthy()
    expect(farmUpdateMany).not.toHaveBeenCalled()
  })
})

describe('schalteOnlineZahlungEin', () => {
  it('setzt nur acceptsOnline auf true, nur für den Hof aus der Sitzung (Besitz in der WHERE-Klausel)', async () => {
    expect(await schalteOnlineZahlungEin({ einschalten: true })).toEqual({ ok: true })

    expect(farmUpdateMany).toHaveBeenCalledTimes(1)
    expect(farmUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: 'farm_1', ownerId: 'user_1' },
      data: { acceptsOnline: true },
    })
  })

  it('ohne Sitzung: Meldung, nichts geschrieben', async () => {
    sitzung.wert = null

    expect(await schalteOnlineZahlungEin({ einschalten: true })).toHaveProperty('error')
    expect(farmUpdateMany).not.toHaveBeenCalled()
  })

  it.each([[undefined], [{}], [{ einschalten: false }], [{ einschalten: 'ja' }], [{ einschalten: true, acceptsOnline: false }]])(
    'lehnt ungültige Eingabe ab (%j) — kein Weg, Online auszuschalten',
    async (eingabe) => {
      expect(await schalteOnlineZahlungEin(eingabe)).toHaveProperty('error')
      expect(farmUpdateMany).not.toHaveBeenCalled()
    }
  )

  it('ohne eigenen Hof: Meldung', async () => {
    farmFindUnique.mockResolvedValue(null as never)

    expect(await schalteOnlineZahlungEin({ einschalten: true })).toHaveProperty('error')
    expect(farmUpdateMany).not.toHaveBeenCalled()
  })

  it('trifft das Schreiben nichts (Hof inzwischen weg), kommt eine Meldung statt „ok"', async () => {
    farmUpdateMany.mockResolvedValueOnce({ count: 0 } as never)

    expect(await schalteOnlineZahlungEin({ einschalten: true })).toHaveProperty('error')
  })
})

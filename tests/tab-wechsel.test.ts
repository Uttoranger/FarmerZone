/**
 * Tab-Wechsel im Hofbereich (Nachtlauf Nr. 31): Was beim Laden einer
 * Hof-Seite unabhängig ist, läuft nebeneinander — und die Freigabe verwaister
 * Bestellungen hält nur auf, was von ihr abhängt.
 *
 * Heute (/dashboard): Die Freigabe bleibt VOR der Antwort (Frist gilt beim
 * Lesen, ARCHITECTURE §5) — Packliste, „überfällig", „ausverkauft" und das
 * Angebot der Teilen-Karte zeigten sonst eine verfallene Bestellung samt
 * gebundener Ware. getHeute startet diese Abfragen erst nach ihr; Umsatz,
 * Hof, Produktzahl, Produkte ohne Kategorie und der letzte Beitrag laufen
 * daneben, weil die Freigabe sie nie ändert (sie storniert nur
 * PENDING_CONFIRMATION und bucht Vorrat zurück).
 *
 * Gemockt sind nur Prisma und die Umsatz-Abfrage (Infrastruktur); die
 * Aussage ist die Reihenfolge, in der die Abfragen starten.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    product: { findMany: vi.fn(), count: vi.fn() },
    statusPost: { findFirst: vi.fn() },
    farm: { findUnique: vi.fn() },
  },
}))
vi.mock('@/server/queries/umsatz', () => ({ umsatzBuchungen: vi.fn() }))

// Für ladeHofbereich: Zugang und die vier Zahlen des Layouts.
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`redirect:${ziel}`)
  }),
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn() }))
vi.mock('@/server/queries/orders', () => ({ getOpenOrdersCount: vi.fn() }))
vi.mock('@/server/queries/farm', () => ({ getFarmBannerState: vi.fn() }))
vi.mock('@/server/queries/admin', () => ({ isAdminUser: vi.fn() }))
vi.mock('@/server/queries/meldung', () => ({ zaehleZuEntscheiden: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { umsatzBuchungen } from '@/server/queries/umsatz'
import { getHeute } from '@/server/queries/heute'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getOpenOrdersCount } from '@/server/queries/orders'
import { getFarmBannerState } from '@/server/queries/farm'
import { isAdminUser } from '@/server/queries/admin'
import { zaehleZuEntscheiden } from '@/server/queries/meldung'
import { ladeHofbereich } from '@/server/hofbereich'

const JETZT = new Date('2026-10-07T08:00:00Z')

/** Ein Versprechen, das der Test selbst einlöst. */
function aufgeschoben<T>(): { versprechen: Promise<T>; loese: (wert: T) => void } {
  let loese!: (wert: T) => void
  const versprechen = new Promise<T>((r) => {
    loese = r
  })
  return { versprechen, loese }
}

/** Lässt alle schon angestoßenen Schritte laufen (Mikro- und Makroaufgaben). */
const ruhe = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

/** Die Produktabfragen, die vom Vorrat abhängen (stock in der Bedingung). */
function vorratsAbfragen(): number {
  return vi
    .mocked(prisma.product.findMany)
    .mock.calls.filter(([arg]) => (arg as { where?: { stock?: unknown } } | undefined)?.where?.stock !== undefined).length
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.order.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.order.findFirst).mockResolvedValue(null as never)
  vi.mocked(prisma.order.count).mockResolvedValue(0 as never)
  vi.mocked(prisma.product.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.product.count).mockResolvedValue(0 as never)
  vi.mocked(prisma.statusPost.findFirst).mockResolvedValue(null as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue(null as never)
  vi.mocked(umsatzBuchungen).mockResolvedValue([])
})

describe('getHeute — wartet nur mit dem auf die Freigabe, was sie ändern kann', () => {
  it('startet Umsatz, Hof, Produktzahl, Produkte ohne Kategorie und den letzten Beitrag sofort', async () => {
    const freigabe = aufgeschoben<void>()
    const laeuft = getHeute('hof-1', JETZT, freigabe.versprechen)
    await ruhe()

    expect(umsatzBuchungen).toHaveBeenCalledTimes(1)
    expect(prisma.farm.findUnique).toHaveBeenCalledTimes(1)
    expect(prisma.product.count).toHaveBeenCalledTimes(1)
    expect(prisma.statusPost.findFirst).toHaveBeenCalledTimes(1)
    expect(prisma.product.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ category: null }) })
    )

    freigabe.loese()
    await laeuft
  })

  it('fragt offene Bestellungen und Vorrat erst NACH der Freigabe ab', async () => {
    const freigabe = aufgeschoben<void>()
    const laeuft = getHeute('hof-1', JETZT, freigabe.versprechen)
    await ruhe()

    // Solange die Freigabe läuft: keine Bestellung, kein Vorrat.
    expect(prisma.order.findMany).not.toHaveBeenCalled()
    expect(prisma.order.findFirst).not.toHaveBeenCalled()
    expect(prisma.order.count).not.toHaveBeenCalled()
    expect(vorratsAbfragen()).toBe(0)

    freigabe.loese()
    await laeuft

    // Packliste und „überfällig" (zwei findMany), nächster Abholtag, Zahl überfällig.
    expect(prisma.order.findMany).toHaveBeenCalledTimes(2)
    expect(prisma.order.findFirst).toHaveBeenCalledTimes(1)
    expect(prisma.order.count).toHaveBeenCalledTimes(1)
    // „ausverkauft" (stock ≤ 0) und das Angebot der Teilen-Karte (stock > 0).
    expect(vorratsAbfragen()).toBe(2)
  })

  it('ohne Freigabe (Aufruf wie bisher) läuft alles sofort und liefert dasselbe', async () => {
    const mitFreigabe = await getHeute('hof-1', JETZT, Promise.resolve())
    const ohne = await getHeute('hof-1', JETZT)
    expect(ohne).toEqual(mitFreigabe)
  })

  it('/dashboard reicht die laufende Freigabe hinein und wartet nicht vorher darauf', () => {
    const seite = readFileSync(join(process.cwd(), 'src/app/(hof)/dashboard/page.tsx'), 'utf8')
    expect(seite).toContain('getHeute(farm.id, jetzt, gibVerwaisteFreiOhneRisiko(farm.id, jetzt))')
    // Kein vorgeschaltetes await mehr, und kein after(): Die Anzeige braucht die Freigabe.
    expect(seite).not.toMatch(/await gibVerwaisteFreiOhneRisiko\(/)
    expect(seite).not.toMatch(/import \{[^}]*\bafter\b[^}]*\} from 'next\/server'/)
    expect(seite).not.toContain('nachDerAntwort')
  })
})

describe('ladeHofbereich — die Zahlen des Layouts nebeneinander', () => {
  function angemeldet(): void {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'nutzer-1', name: 'Erfundene Person', role: 'FARMER' },
    } as never)
    vi.mocked(getFarmForUser).mockResolvedValue({ id: 'hof-1', name: 'Testhof', slug: 'testhof', logoUrl: null } as never)
  }

  it('startet offene Bestellungen, Balken und Admin-Recht gleichzeitig', async () => {
    angemeldet()
    const offen = aufgeschoben<number>()
    const balken = aufgeschoben<null>()
    const admin = aufgeschoben<boolean>()
    vi.mocked(getOpenOrdersCount).mockReturnValue(offen.versprechen)
    vi.mocked(getFarmBannerState).mockReturnValue(balken.versprechen as never)
    vi.mocked(isAdminUser).mockReturnValue(admin.versprechen)

    const laeuft = ladeHofbereich()
    await ruhe()

    // Keine der drei ist eingelöst — trotzdem sind alle gestartet.
    expect(getOpenOrdersCount).toHaveBeenCalledWith('hof-1')
    expect(getFarmBannerState).toHaveBeenCalledWith('nutzer-1')
    expect(isAdminUser).toHaveBeenCalledWith('nutzer-1')

    offen.loese(3)
    balken.loese(null)
    admin.loese(false)
    const ergebnis = await laeuft
    expect(ergebnis).toMatchObject({ offeneBestellungen: 3, balken: null, isAdmin: false, zuEntscheiden: 0 })
    // Ein Hof bezahlt nie für die Zählabfrage des Betreibers.
    expect(zaehleZuEntscheiden).not.toHaveBeenCalled()
  })

  it('zählt die offenen Meldungen nur für den Betreiber', async () => {
    angemeldet()
    vi.mocked(getOpenOrdersCount).mockResolvedValue(0)
    vi.mocked(getFarmBannerState).mockResolvedValue(null as never)
    vi.mocked(isAdminUser).mockResolvedValue(true)
    vi.mocked(zaehleZuEntscheiden).mockResolvedValue(4)

    await expect(ladeHofbereich()).resolves.toMatchObject({ isAdmin: true, zuEntscheiden: 4 })
  })
})

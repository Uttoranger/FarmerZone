/**
 * Tests für das Speichern des Titelbild-Ausschnitts (speichereBildAusschnittAction,
 * Register N13/N17, Nachtlauf Nr. 97). Den Altweg updateBannerFocusAction gibt
 * es seit Nr. 108 nicht mehr (ohne Aufrufer; Nacharbeit 97) — mit ihm seine
 * zwei Tests.
 *
 * Beweist:
 *  - Ein gültiger Ausschnitt landet beim eigenen Hof (Hof aus der Sitzung über
 *    ownerId, Besitz in der WHERE-Klausel) — mit bannerFocusY = fokusY für alten
 *    Code im Deploy-Fenster —, und Hofseite wie Mein Hof werden neu gebaut.
 *  - Werte außerhalb der Grenzen, ein unbekannter Filter, eine unbekannte Wahl
 *    und eine mitgeschickte Hof-Kennung werden abgewiesen; nichts geschrieben.
 *  - Ohne Sitzung und ohne eigenen Hof wird nichts geschrieben.
 *  - Logo, Produkt, Foto und Beitrag prüft seit Nr. 98 tests/bild-ausschnitt-ziele.test.ts.
 *
 * Gemockt ist nur die Infrastruktur (Prisma, Sitzung, Cache); das Schema prüft echt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    product: { updateMany: vi.fn() },
    farmPhoto: { updateMany: vi.fn() },
    statusPost: { updateMany: vi.fn() },
    farmValue: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { revalidatePath } from 'next/cache'
import { speichereBildAusschnittAction } from '@/server/actions/bild-ausschnitt'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const getSession = vi.mocked(auth.api.getSession)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const farmUpdateMany = vi.mocked(prisma.farm.updateMany)
const schreibende = [farmUpdateMany, prisma.farm.update, prisma.product.updateMany, prisma.farmPhoto.updateMany, prisma.statusPost.updateMany].map((f) =>
  vi.mocked(f)
)

const WERT = { fokusX: 30, fokusY: 64, zoom: 115, filter: 'WARM', darstellung: 'FUELLEN' } as const

function nichtsGeschrieben(): void {
  for (const schreiben of schreibende) expect(schreiben).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmFindUnique.mockResolvedValue({ id: 'farm_1', slug: 'testhof' } as never)
  farmUpdateMany.mockResolvedValue({ count: 1 })
})

describe('speichereBildAusschnittAction — Titelbild', () => {
  it('speichert den Ausschnitt beim eigenen Hof, schreibt bannerFocusY mit und baut Hofseite und Mein Hof neu', async () => {
    const ergebnis = await speichereBildAusschnittAction({ ziel: 'banner', wert: WERT })

    expect(ergebnis).toEqual({ ok: true })
    expect(farmFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'user_1' } }))
    expect(farmUpdateMany).toHaveBeenCalledTimes(1)
    expect(farmUpdateMany).toHaveBeenCalledWith({
      where: { id: 'farm_1', ownerId: 'user_1' },
      data: { bannerAusschnitt: WERT, bannerFocusY: 64 },
    })
    expect(vi.mocked(revalidatePath).mock.calls.map(([pfad]) => pfad)).toEqual(['/testhof', '/farm-page'])
  })

  it.each([
    ['Fokus über 100', { ...WERT, fokusX: 150 }],
    ['Fokus unter 0', { ...WERT, fokusY: -5 }],
    ['Zoom über 250', { ...WERT, zoom: 300 }],
    ['Fokus mit Komma', { ...WERT, fokusY: 37.6 }],
    ['unbekannter Filter', { ...WERT, filter: 'NEON' }],
    ['unbekannte Wahl', { ...WERT, darstellung: 'STRECKEN' }],
  ])('weist %s ab und schreibt nichts', async (_name, wert) => {
    const ergebnis = await speichereBildAusschnittAction({ ziel: 'banner', wert })

    expect(ergebnis).toEqual({ error: expect.stringContaining('Ausschnitt') })
    nichtsGeschrieben()
  })

  it('weist eine mitgeschickte Hof-Kennung ab — der Hof kommt nur aus der Sitzung', async () => {
    const ergebnis = await speichereBildAusschnittAction({ ziel: 'banner', wert: WERT, farmId: 'farm_fremd' })

    expect('error' in ergebnis).toBe(true)
    nichtsGeschrieben()
  })

  it('schreibt ohne Sitzung nichts', async () => {
    getSession.mockResolvedValue(null as never)

    const ergebnis = await speichereBildAusschnittAction({ ziel: 'banner', wert: WERT })

    expect(ergebnis).toEqual({ error: 'Bitte melde dich neu an.' })
    nichtsGeschrieben()
  })

  it('schreibt nichts, wenn dem Nutzer kein Hof gehört — kein fremder Hof über eine Kennung', async () => {
    farmFindUnique.mockResolvedValue(null)

    const ergebnis = await speichereBildAusschnittAction({ ziel: 'banner', wert: WERT })

    expect('error' in ergebnis).toBe(true)
    nichtsGeschrieben()
  })

  it('meldet einen Fehler, wenn die Zeile zwischen Lesen und Schreiben nicht mehr dem Nutzer gehört (0 Zeilen)', async () => {
    farmUpdateMany.mockResolvedValue({ count: 0 })

    const ergebnis = await speichereBildAusschnittAction({ ziel: 'banner', wert: WERT })

    expect('error' in ergebnis).toBe(true)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

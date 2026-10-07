/**
 * Direktverkauf senkt den Vorrat (Register D1, Nachtlauf Nr. 39).
 *
 * Beweist (Prisma, Auth und Next gemockt — den Wettlauf zweier Buchungen
 * prüft tests/integration/verkauf-vorrat.int.test.ts gegen Postgres):
 *  - Mit Schalter „Vorrat abziehen" und einem Produkt des eigenen Hofs bucht
 *    die Action in DERSELBEN Transaktion wie der Verkauf bedingt ab:
 *    `updateMany` mit Hof und `stock >= Menge` in der WHERE-Klausel, nie ein
 *    blindes decrement.
 *  - Reicht der Vorrat nicht: Der Verkauf bleibt gebucht, der Vorrat steht
 *    danach auf 0 (bedingt `stock < Menge`), und die Antwort trägt den Hinweis.
 *  - Schalter aus, ohne Produkt, beim Ändern: keine Bestandsbuchung.
 *  - Ein fremdes Produkt: nichts gebucht, kein Verkauf.
 *  - Der Vorrat zählt ganze Gebinde: 2,5 zieht 3 ab, ohne Menge 1.
 *  - Texte aus einer Quelle (src/lib/verkauf-eintragen.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => ({ user: { id: 'nutzer-1' } })) } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn(async () => ({ id: 'hof-1', slug: 'hof-eins' })) }))

const db = vi.hoisted(() => {
  const d = {
    manualSale: { create: vi.fn(), updateMany: vi.fn() },
    product: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  }
  // Die Transaktion reicht denselben Mock als `tx` durch — so sieht der Test jeden Schreibvorgang darin.
  d.$transaction.mockImplementation(async (fn: (tx: typeof d) => unknown) => fn(d))
  return d
})
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { createManualSale, updateManualSale } from '@/server/actions/manual-sales'
import { revalidatePath } from 'next/cache'
import {
  VORRAT_ABZIEHEN,
  VORRAT_ZU_KLEIN,
  gebindeZumAbziehen,
  mengenEinheit,
  vorratHinweis,
  vorratSchalterText,
} from '@/lib/verkauf-eintragen'
import { manualSaleFormSchema } from '@/schemas/manual-sale'
import { wienKalendertag } from '@/lib/kalender'

const PRODUKT = { id: 'p-1', name: 'Eier', unit: 'STUECK', unitSize: null }
const heute = () => wienKalendertag(new Date())
const eingabe = (teil: object = {}) => ({ totalAmount: 6, channel: 'HOFLADEN', saleDate: heute(), productId: 'p-1', quantity: 3, vorratAbziehen: true, ...teil })

type UpdateAufruf = { where: Record<string, unknown>; data: Record<string, unknown> }
const produktUpdates = () => db.product.updateMany.mock.calls.map((c) => c[0] as UpdateAufruf)

beforeEach(() => {
  vi.clearAllMocks()
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db))
  db.product.findFirst.mockResolvedValue(PRODUKT)
  db.manualSale.create.mockImplementation(async ({ data }: { data: { quantity: number } }) => ({ quantity: new Prisma.Decimal(data.quantity) }))
  db.product.updateMany.mockResolvedValue({ count: 1 })
})

describe('Regeln und Texte (rein)', () => {
  it('der Vorrat zählt ganze Gebinde: gebrochene Mengen aufgerundet, ohne Menge 1', () => {
    expect(gebindeZumAbziehen(3)).toBe(3)
    expect(gebindeZumAbziehen(2.5)).toBe(3)
    expect(gebindeZumAbziehen(0.001)).toBe(1)
    // Drei Stellen wie die Spalte — Gleitkomma-Rest macht aus 2 nicht 3.
    expect(gebindeZumAbziehen(2.0000000001)).toBe(2)
    expect(gebindeZumAbziehen(0.1 + 0.2 + 2.7)).toBe(3)
    expect(gebindeZumAbziehen(null)).toBe(1)
    expect(gebindeZumAbziehen(undefined)).toBe(1)
  })

  it('Hinweis nach dem Speichern: neuer Vorrat, zu wenig, nicht geändert', () => {
    expect(vorratHinweis({ art: 'abgezogen', vorrat: 4 }, { unit: 'STUECK', unitSize: null })).toEqual({
      text: 'Verkauf eingetragen. Vorrat jetzt: 4 Stück.',
      knapp: false,
    })
    expect(vorratHinweis({ art: 'abgezogen', vorrat: 2 }, { unit: 'KG', unitSize: 0.5 }).text).toBe('Verkauf eingetragen. Vorrat jetzt: 2 × 0,5 kg.')
    expect(vorratHinweis({ art: 'auf-null' }, { unit: 'KG', unitSize: null })).toEqual({ text: VORRAT_ZU_KLEIN, knapp: true })
    expect(VORRAT_ZU_KLEIN).toBe('Gebucht. Dein Vorrat war kleiner als die Menge – er steht jetzt auf 0.')
    const unveraendert = vorratHinweis({ art: 'unveraendert' }, { unit: 'KG', unitSize: null })
    expect(unveraendert.knapp).toBe(true)
    expect(unveraendert.text).toMatch(/^Gebucht\./)
  })

  it('der Satz unter dem Schalter sagt, was passiert', () => {
    expect(VORRAT_ABZIEHEN).toBe('Vorrat abziehen')
    const p = { stock: 12, unit: 'KG', unitSize: null }
    expect(vorratSchalterText(true, p, 2.5)).toBe('Im Vorrat: 12 kg. Wir ziehen 3 kg ab.')
    expect(vorratSchalterText(true, p, null)).toBe('Im Vorrat: 12 kg. Wir ziehen 1 kg ab.')
    expect(vorratSchalterText(true, { ...p, stock: 2 }, 5)).toBe('Im Vorrat: 2 kg. Das reicht nicht – danach steht er auf 0.')
    expect(vorratSchalterText(false, p, 2)).toBe('Aus – dein Vorrat bleibt, wie er ist.')
  })

  it('die Menge zählt Gebinde: bei einer Gebindegröße nennt das Feld sie', () => {
    expect(mengenEinheit('KG', null)).toBe('kg')
    expect(mengenEinheit('KG', 1)).toBe('kg')
    expect(mengenEinheit('KG', 0.5)).toBe('× 0,5 kg')
    expect(mengenEinheit('LITER', 2)).toBe('× 2 L')
  })

  it('das Schema kennt den Schalter, freiwillig', () => {
    const basis = { totalAmount: 6, channel: 'HOFLADEN', saleDate: '2026-10-01' }
    expect(manualSaleFormSchema.parse({ ...basis, vorratAbziehen: true }).vorratAbziehen).toBe(true)
    expect(manualSaleFormSchema.parse(basis).vorratAbziehen).toBeUndefined()
    expect(manualSaleFormSchema.safeParse({ ...basis, vorratAbziehen: 'ja' }).success).toBe(false)
  })
})

describe('createManualSale mit „Vorrat abziehen"', () => {
  it('genug Vorrat: in der Transaktion bedingt abgezogen, Besitz in der WHERE-Klausel, neuer Stand im Hinweis', async () => {
    db.product.findFirst.mockResolvedValueOnce(PRODUKT).mockResolvedValueOnce({ stock: 4 })

    const antwort = await createManualSale(eingabe())

    expect(antwort).toEqual({ ok: true, vorrat: { text: 'Verkauf eingetragen. Vorrat jetzt: 4 Stück.', knapp: false } })
    expect(db.$transaction).toHaveBeenCalledOnce()
    expect(db.manualSale.create).toHaveBeenCalledOnce()
    expect(produktUpdates()).toEqual([{ where: { id: 'p-1', farmId: 'hof-1', stock: { gte: 3 } }, data: { stock: { decrement: 3 } } }])
    // Der Vorrat ändert sich auch auf der Hofseite und in Produkte.
    expect(revalidatePath).toHaveBeenCalledWith('/products')
    expect(revalidatePath).toHaveBeenCalledWith('/hof-eins')
    expect(revalidatePath).toHaveBeenCalledWith('/sales')
  })

  it('zu wenig Vorrat: Verkauf gebucht, Vorrat bedingt auf 0, Hinweis', async () => {
    db.product.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 })

    const antwort = await createManualSale(eingabe({ quantity: 5 }))

    expect(antwort).toEqual({ ok: true, vorrat: { text: VORRAT_ZU_KLEIN, knapp: true } })
    expect(db.manualSale.create).toHaveBeenCalledOnce()
    expect(produktUpdates()).toEqual([
      { where: { id: 'p-1', farmId: 'hof-1', stock: { gte: 5 } }, data: { stock: { decrement: 5 } } },
      { where: { id: 'p-1', farmId: 'hof-1', stock: { lt: 5 } }, data: { stock: 0 } },
    ])
  })

  it('gebrochene Menge zieht aufgerundet ab, ohne Menge 1', async () => {
    await createManualSale(eingabe({ quantity: 2.5 }))
    expect(produktUpdates()[0].where.stock).toEqual({ gte: 3 })
    vi.clearAllMocks()
    db.product.findFirst.mockResolvedValue(PRODUKT)
    db.product.updateMany.mockResolvedValue({ count: 1 })
    await createManualSale(eingabe({ quantity: null }))
    expect(produktUpdates()[0]).toEqual({ where: { id: 'p-1', farmId: 'hof-1', stock: { gte: 1 } }, data: { stock: { decrement: 1 } } })
  })

  it('ändert sich der Vorrat zwischen den Schritten immer wieder: Verkauf gebucht, Vorrat unberührt, Hinweis — kein Absturz', async () => {
    db.product.updateMany.mockResolvedValue({ count: 0 })
    const antwort = await createManualSale(eingabe())
    expect(antwort).toMatchObject({ ok: true, vorrat: { knapp: true } })
    expect(db.manualSale.create).toHaveBeenCalledOnce()
    // Begrenzt — keine Endlosschleife.
    expect(db.product.updateMany.mock.calls.length).toBeLessThanOrEqual(6)
  })

  it('jedes decrement trägt die Bedingung stock >= Menge', async () => {
    db.product.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 }).mockResolvedValue({ count: 1 })
    await createManualSale(eingabe({ quantity: 7 }))
    for (const aufruf of produktUpdates()) {
      if (JSON.stringify(aufruf.data).includes('decrement')) expect(aufruf.where.stock).toEqual({ gte: 7 })
      expect(aufruf.where.farmId).toBe('hof-1')
    }
    expect(db.product.update).not.toHaveBeenCalled()
  })

  it('Schalter aus: Verkauf gebucht, keine Bestandsbuchung, kein Hinweis', async () => {
    expect(await createManualSale(eingabe({ vorratAbziehen: false }))).toEqual({ ok: true })
    expect(db.product.updateMany).not.toHaveBeenCalled()
    expect(await createManualSale(eingabe({ vorratAbziehen: undefined }))).toEqual({ ok: true })
    expect(db.product.updateMany).not.toHaveBeenCalled()
  })

  it('ohne Produkt aus dem Sortiment: nichts abzuziehen', async () => {
    expect(await createManualSale(eingabe({ productId: null, productName: 'Kürbis' }))).toEqual({ ok: true })
    expect(db.product.updateMany).not.toHaveBeenCalled()
  })

  it('fremdes Produkt: abgelehnt, weder Verkauf noch Bestandsbuchung', async () => {
    db.product.findFirst.mockResolvedValue(null)
    const antwort = await createManualSale(eingabe({ productId: 'fremd' }))
    expect(antwort).toHaveProperty('error')
    expect(db.product.findFirst.mock.calls[0][0].where).toEqual({ id: 'fremd', farmId: 'hof-1' })
    expect(db.manualSale.create).not.toHaveBeenCalled()
    expect(db.product.updateMany).not.toHaveBeenCalled()
  })

  it('ändern eines Verkaufs bucht keinen Vorrat — D1 gilt nur fürs Eintragen', async () => {
    db.manualSale.updateMany.mockResolvedValue({ count: 1 })
    expect(await updateManualSale('v-1', eingabe())).toEqual({ ok: true })
    expect(db.product.updateMany).not.toHaveBeenCalled()
  })
})

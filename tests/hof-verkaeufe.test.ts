/**
 * Verkäufe (/sales) und „Verkauf eintragen" in der HofShell (Gate 8 „Code
 * ohne Mockup", Nachtlauf Nr. 22b, Register E13). Kein Mockup — gebaut nach
 * docs/ai/DESIGN_SYSTEM.md, keine neuen Funktionen.
 *
 * Beweist:
 *  - Die Route liegt in (hof) mit Ladeansicht, (farmer) hat sie nicht mehr;
 *    die alten Bestandskomponenten sind weg; das Neu-Menü führt direkt in
 *    den Dialog (/sales?neu=1).
 *  - Zeilen der Liste: Datum nach Wiener Tag, Betrag in ganzen Cent, Marke
 *    Online/Bar/Weg; nur serialisierbare Werte gehen an den Browser.
 *  - Abfrage: nur der eigene Hof (farmId in jeder WHERE-Klausel), Geld nie
 *    über Number(Decimal).
 *  - Schema: Grenzen aus eingabegrenzen.ts, nur echte Kalendertage.
 *  - Actions: Anlegen, Ändern, Löschen nur am eigenen Hof (farmId in der
 *    WHERE-Klausel), kein Tag in der Zukunft, ohne Schalter „Vorrat abziehen"
 *    keine Bestandsbuchung (mit Schalter: tests/verkauf-vorrat.test.ts),
 *    ohne Anmeldung ein Satz statt eines Absturzes.
 *  - Darstellung: vier Zustände, lange Namen mit title, Knöpfe mit Namen,
 *    Symbole aria-hidden, keine Farbwerte.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Prisma } from '@prisma/client'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/sales',
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; [k: string]: unknown }) => {
    const attribute = { ...rest }
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/actions/stripe-connect', () => ({ createStripeDashboardLinkAction: vi.fn() }))

const sitzung = vi.hoisted(() => ({ wert: { user: { id: 'nutzer-1' } } as { user: { id: string } } | null }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => sitzung.wert) } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn(async () => ({ id: 'hof-1', slug: 'hof-eins' })) }))

const db = vi.hoisted(() => {
  const d = {
    order: { findMany: vi.fn() },
    orderItem: { findMany: vi.fn() },
    manualSale: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
    product: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    // Anlegen läuft seit Nr. 39 in einer Transaktion (Verkauf + Vorrat) — `tx` ist derselbe Mock.
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(d)),
  }
  return d
})
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { HOF_NEU } from '@/lib/bauern-navigation'
import { JAHRESSUMME_TEXT, verkaufsZeilen, wiederholVorlagen, type FeedVerkauf, type VerkaufDaten } from '@/lib/hof-verkaeufe'
import { mergeSalesFeed, type SalesFeedOrder } from '@/lib/sales-summary'
import { manualSaleFormSchema } from '@/schemas/manual-sale'
import { NOTIZ_MAX, PRODUKTNAME_MAX, VERKAUF_BETRAG_MAX, VERKAUF_MENGE_MAX, ZU_LANG } from '@/lib/eingabegrenzen'
import { formatEuro } from '@/lib/format'
import { getSalesOverview, type SalesOverview } from '@/server/queries/manual-sales'
import { createManualSale, deleteManualSale, updateManualSale } from '@/server/actions/manual-sales'
import { VerkaeufeAnsicht } from '@/components/hof-verkaeufe/verkaeufe-ansicht'
import { VerkaufFormular } from '@/components/hof-verkaeufe/verkauf-dialog'
import { VerkaeufeFehler } from '@/components/hof-verkaeufe/verkaeufe-fehler'

function quelle(pfad: string): string {
  return readFileSync(join(process.cwd(), pfad), 'utf8')
}

const JETZT = new Date('2026-10-06T10:00:00Z')
const LANG = 'Bio-Bergkäse vom Hochalm-Sennereibetrieb, zwölf Monate gereift, im Ganzen gewogen und verpackt'

function daten(teil: Partial<VerkaufDaten> = {}): VerkaufDaten {
  return {
    id: 'v1',
    productId: null,
    productName: 'Eier',
    quantity: 10,
    unit: 'STUECK',
    totalAmount: 4.5,
    channel: 'MARKT',
    saleTag: '2026-10-06',
    note: null,
    ...teil,
  }
}

function feedVerkauf(teil: Partial<VerkaufDaten> = {}, saleDate = new Date('2026-10-06T12:00:00Z')): FeedVerkauf {
  const d = daten(teil)
  return { id: d.id, totalAmount: Math.round(d.totalAmount * 100), saleDate, daten: d }
}

function feedBestellung(teil: Partial<SalesFeedOrder> = {}): SalesFeedOrder {
  return {
    id: 'o1',
    orderNumber: 'FZ-1001',
    customerName: 'Erika Mustermann',
    status: 'PICKED_UP',
    totalAmount: 1999,
    stripePaymentIntentId: 'pi_test',
    pickedUpAt: new Date('2026-10-05T23:30:00Z'),
    itemsLabel: '2 × Eier',
    ...teil,
  }
}

// ─── Route ──────────────────────────────────────────────────────────────────

describe('Route in der HofShell', () => {
  it('/sales liegt in (hof) mit Ladeansicht, nicht mehr in (farmer)', () => {
    expect(existsSync(join(process.cwd(), 'src/app/(hof)/sales/page.tsx'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'src/app/(hof)/sales/loading.tsx'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'src/app/(farmer)/sales'))).toBe(false)
  })

  it('die alten Bestandskomponenten sind weg, die Seite bindet keine eigene Shell ein', () => {
    for (const alt of ['sales-client.tsx', 'sale-dialog.tsx', 'sales-feed-list.tsx', 'sale-list.tsx']) {
      expect(existsSync(join(process.cwd(), 'src/components/sales', alt)), alt).toBe(false)
    }
    const seite = quelle('src/app/(hof)/sales/page.tsx')
    expect(seite).not.toMatch(/from '@\/components\/shells\//)
    expect(seite).not.toMatch(/farmer\/page-header/)
    expect(quelle('eslint.config.mjs')).not.toContain('src/components/sales/sales-client.tsx')
  })

  it('„Verkauf eintragen" im Neu-Menü führt direkt in den Dialog (E13)', () => {
    expect(HOF_NEU.find((p) => p.id === 'verkauf-eintragen')?.href).toBe('/sales?neu=1')
    expect(quelle('src/components/hof-verkaeufe/verkaeufe-ansicht.tsx')).toMatch(
      /useUrlAuftrag\(\(auftrag\) => \{\s*if \(auftrag\.art === 'neu'\) neuerVerkauf\(\)/
    )
  })
})

// ─── Zeilen ─────────────────────────────────────────────────────────────────

describe('verkaufsZeilen', () => {
  it('Bestellung online: Link in die Bestellung, grüne Marke, Betrag in Cent, Wiener Tag', () => {
    const [zeile] = verkaufsZeilen(mergeSalesFeed([feedBestellung()], [], 10), JETZT)
    expect(zeile).toMatchObject({
      art: 'bestellung',
      href: '/orders/o1',
      titel: 'Erika Mustermann',
      nummer: 'FZ-1001',
      unterzeile: '2 × Eier',
      betragCent: 1999,
      marke: { text: 'Online', ton: 'fertig' },
      // 23:30 UTC am 5. ist 01:30 in Wien am 6. — „Heute", nicht „Gestern".
      datum: 'Heute',
    })
  })

  it('Bestellung bar: neutrale Marke „Bar · Abholung"', () => {
    const [zeile] = verkaufsZeilen(mergeSalesFeed([feedBestellung({ stripePaymentIntentId: null })], [], 10), JETZT)
    expect(zeile.marke).toEqual({ text: 'Bar · Abholung', ton: 'neutral' })
  })

  it('Direktverkauf: Weg als Marke, Daten zum Bearbeiten, gestern und früher mit Datum', () => {
    const zeilen = verkaufsZeilen(
      mergeSalesFeed([], [feedVerkauf({ saleTag: '2026-10-05' }, new Date('2026-10-05T12:00:00Z')), feedVerkauf({ id: 'v2', channel: 'HOFLADEN', saleTag: '2026-09-25' }, new Date('2026-09-25T12:00:00Z'))], 10),
      JETZT
    )
    expect(zeilen[0]).toMatchObject({ art: 'verkauf', titel: 'Eier', unterzeile: 'Direktverkauf', kanal: 'MARKT', marke: { text: 'Markt', ton: 'neutral' }, betragCent: 450, datum: 'Gestern' })
    expect(zeilen[1]).toMatchObject({ datum: 'Fr, 25. Sep', marke: { text: 'Hofladen' } })
    expect(zeilen[0].art === 'verkauf' && zeilen[0].verkauf.id).toBe('v1')
  })

  it('nur Text und Zahlen — nichts, was beim Weg zum Browser verloren ginge', () => {
    const zeilen = verkaufsZeilen(mergeSalesFeed([feedBestellung()], [feedVerkauf()], 10), JETZT)
    expect(JSON.parse(JSON.stringify(zeilen))).toEqual(zeilen)
  })

  it('wiederholVorlagen: die letzten vier Direktverkäufe, keine Bestellungen', () => {
    const verkaeufe = [1, 2, 3, 4, 5].map((i) => feedVerkauf({ id: `v${i}` }, new Date(JETZT.getTime() - i * 3600_000)))
    const zeilen = verkaufsZeilen(mergeSalesFeed([feedBestellung({ pickedUpAt: JETZT })], verkaeufe, 10), JETZT)
    expect(wiederholVorlagen(zeilen).map((v) => v.id)).toEqual(['v1', 'v2', 'v3', 'v4'])
  })
})

// ─── Abfrage ────────────────────────────────────────────────────────────────

describe('getSalesOverview — eigener Hof, Geld in Cent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.order.findMany.mockResolvedValue([
      {
        id: 'o1',
        orderNumber: 'FZ-1001',
        customerName: 'Erika Mustermann',
        status: 'PICKED_UP',
        totalAmount: new Prisma.Decimal('19.99'),
        stripePaymentIntentId: null,
        pickedUpAt: new Date('2026-10-06T08:00:00Z'),
        items: [{ quantity: 1, productName: 'Eier', totalPrice: new Prisma.Decimal('19.99'), product: { unit: 'STUECK', unitSize: null, countsTowardLimit: true } }],
      },
    ])
    db.manualSale.findMany.mockResolvedValue([
      { id: 'v1', productId: null, productName: 'Eier', quantity: new Prisma.Decimal('1'), unit: null, totalAmount: new Prisma.Decimal('0.10'), channel: 'MARKT', saleDate: new Date('2026-10-06T12:00:00Z'), note: null, product: null },
      { id: 'v2', productId: null, productName: 'Honig', quantity: new Prisma.Decimal('1'), unit: null, totalAmount: new Prisma.Decimal('0.20'), channel: 'HOFLADEN', saleDate: new Date('2026-10-06T12:00:00Z'), note: null, product: null },
    ])
  })

  it('jede Abfrage fragt mit der farmId des Hofs', async () => {
    await getSalesOverview('hof-1', JETZT)
    const aufrufe = [...db.order.findMany.mock.calls, ...db.manualSale.findMany.mock.calls]
    expect(aufrufe.length).toBeGreaterThanOrEqual(4)
    for (const [args] of aufrufe) expect(args.where.farmId).toBe('hof-1')
  })

  it('Summen in Cent (0,10 + 0,20 = 0,30 genau), Zeilen serialisierbar mit Cent und Wiener Tag', async () => {
    const uebersicht = await getSalesOverview('hof-1', JETZT)
    expect(uebersicht.weekBar).toBe(20.29)
    expect(uebersicht.weekOnline).toBe(0)
    expect(uebersicht.weekTotal).toBe(20.29)
    expect(JSON.parse(JSON.stringify(uebersicht))).toEqual(uebersicht)
    const verkauf = uebersicht.zeilen.find((z) => z.art === 'verkauf')
    expect(verkauf && verkauf.art === 'verkauf' && verkauf.verkauf).toMatchObject({ totalAmount: 0.1, saleTag: '2026-10-06', quantity: 1 })
    expect(uebersicht.zeilen.find((z) => z.art === 'bestellung')?.betragCent).toBe(1999)
  })

  it('kein Number(…) auf Geld in der Abfrage', () => {
    const q = quelle('src/server/queries/manual-sales.ts')
    expect(q).not.toMatch(/Number\([a-z]+\.totalAmount\)/)
  })
})

// ─── Schema ─────────────────────────────────────────────────────────────────

describe('manualSaleFormSchema — Grenzen und Kalendertag', () => {
  const basis = { totalAmount: 24.5, channel: 'HOFLADEN', saleDate: '2026-09-29' }
  const meldung = (eingabe: object) => manualSaleFormSchema.safeParse({ ...basis, ...eingabe }).error?.issues[0]?.message

  it('nur echte Kalendertage', () => {
    expect(manualSaleFormSchema.safeParse({ ...basis, saleDate: '2026-02-28' }).success).toBe(true)
    expect(meldung({ saleDate: '2026-02-31' })).toBe('Bitte wähl oben ein Datum aus.')
    expect(meldung({ saleDate: '2026-13-01' })).toBe('Bitte wähl oben ein Datum aus.')
  })

  it('Name und Notiz nach eingabegrenzen.ts, mit Ausweg', () => {
    expect(manualSaleFormSchema.safeParse({ ...basis, productName: 'a'.repeat(PRODUKTNAME_MAX) }).success).toBe(true)
    expect(meldung({ productName: 'a'.repeat(PRODUKTNAME_MAX + 1) })).toBe(ZU_LANG.produktname)
    expect(meldung({ note: 'a'.repeat(NOTIZ_MAX + 1) })).toBe(ZU_LANG.notiz)
  })

  it('Menge und Betrag haben eine Obergrenze unter der der Spalte', () => {
    // Decimal(10,3) bzw. Decimal(10,2): darüber schlüge das Speichern mit einem Datenbankfehler fehl.
    expect(VERKAUF_MENGE_MAX).toBeLessThan(10_000_000)
    expect(VERKAUF_BETRAG_MAX).toBeLessThan(100_000_000)
    expect(meldung({ quantity: VERKAUF_MENGE_MAX + 1 })).toBeDefined()
    expect(meldung({ totalAmount: VERKAUF_BETRAG_MAX + 1 })).toBe('Dieser Betrag ist zu hoch.')
  })
})

// ─── Actions ────────────────────────────────────────────────────────────────

describe('Verkauf anlegen, ändern, löschen — nur am eigenen Hof, ohne Schalter keine Bestandsbuchung', () => {
  const eingabe = { totalAmount: 24.555, channel: 'HOFLADEN', saleDate: '2026-10-06' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(JETZT)
    sitzung.wert = { user: { id: 'nutzer-1' } }
    db.manualSale.create.mockResolvedValue({})
    db.manualSale.updateMany.mockResolvedValue({ count: 1 })
    db.manualSale.deleteMany.mockResolvedValue({ count: 1 })
  })
  afterEach(() => {
    vi.useRealTimers()
    // Ohne Schalter „Vorrat abziehen" bucht keine Aktion Bestand (D1, Nr. 39).
    expect(db.product.update).not.toHaveBeenCalled()
    expect(db.product.updateMany).not.toHaveBeenCalled()
  })

  it('anlegen: am eigenen Hof, Betrag als Decimal auf zwei Stellen, 12 Uhr UTC des Wiener Tages', async () => {
    expect(await createManualSale(eingabe)).toEqual({ ok: true })
    const { data } = db.manualSale.create.mock.calls[0][0]
    expect(data.farmId).toBe('hof-1')
    expect(data.totalAmount.toString()).toBe('24.56')
    expect(data.saleDate.toISOString()).toBe('2026-10-06T12:00:00.000Z')
  })

  it('ein Tag in der Zukunft wird abgelehnt — der Server prüft, nicht nur das Feld', async () => {
    const antwort = await createManualSale({ ...eingabe, saleDate: '2026-10-07' })
    expect(antwort).toEqual({ error: expect.stringContaining('Zukunft') })
    expect(db.manualSale.create).not.toHaveBeenCalled()
  })

  it('die Zukunft zählt nach dem Wiener Tag, nicht nach UTC — kurz vor Mitternacht (Sommer- und Winterzeit)', async () => {
    // 22:30 UTC am 06.10. ist in Wien schon der 07.10. (MESZ): der 07. ist heute, der 08. Zukunft.
    vi.setSystemTime(new Date('2026-10-06T22:30:00Z'))
    expect(await createManualSale({ ...eingabe, saleDate: '2026-10-07' })).toEqual({ ok: true })
    expect(await createManualSale({ ...eingabe, saleDate: '2026-10-08' })).toEqual({ error: expect.stringContaining('Zukunft') })
    // 23:30 UTC am 06.12. ist in Wien schon der 07.12. (MEZ).
    vi.setSystemTime(new Date('2026-12-06T23:30:00Z'))
    expect(await createManualSale({ ...eingabe, saleDate: '2026-12-07' })).toEqual({ ok: true })
    expect(await createManualSale({ ...eingabe, saleDate: '2026-12-08' })).toEqual({ error: expect.stringContaining('Zukunft') })
    vi.setSystemTime(JETZT)
  })

  it('ein Produkt eines anderen Hofs wird nicht verknüpft', async () => {
    db.product.findFirst.mockResolvedValue(null)
    const antwort = await createManualSale({ ...eingabe, productId: 'fremd' })
    expect(db.product.findFirst.mock.calls[0][0].where).toEqual({ id: 'fremd', farmId: 'hof-1' })
    expect(antwort).toHaveProperty('error')
    expect(db.manualSale.create).not.toHaveBeenCalled()
  })

  it('ändern: Besitz in der WHERE-Klausel; fremd oder weg = Satz', async () => {
    expect(await updateManualSale('v1', eingabe)).toEqual({ ok: true })
    expect(db.manualSale.updateMany.mock.calls[0][0].where).toEqual({ id: 'v1', farmId: 'hof-1' })
    db.manualSale.updateMany.mockResolvedValue({ count: 0 })
    expect(await updateManualSale('fremd', eingabe)).toHaveProperty('error')
  })

  it('löschen: Besitz in der WHERE-Klausel, nie nach ID allein; fremd = Satz statt Absturz', async () => {
    expect(await deleteManualSale('v1')).toEqual({ ok: true })
    expect(db.manualSale.deleteMany.mock.calls[0][0].where).toEqual({ id: 'v1', farmId: 'hof-1' })
    expect(db.manualSale.delete).not.toHaveBeenCalled()
    db.manualSale.deleteMany.mockResolvedValue({ count: 0 })
    expect(await deleteManualSale('fremd')).toEqual({ error: expect.any(String) })
  })

  it('ungültige Kennung: nichts geschrieben', async () => {
    expect(await deleteManualSale('')).toHaveProperty('error')
    expect(await updateManualSale('x'.repeat(200), eingabe)).toHaveProperty('error')
    expect(db.manualSale.deleteMany).not.toHaveBeenCalled()
    expect(db.manualSale.updateMany).not.toHaveBeenCalled()
  })

  it('ohne Anmeldung ein Satz statt eines Absturzes', async () => {
    sitzung.wert = null
    expect(await createManualSale(eingabe)).toHaveProperty('error')
    expect(await deleteManualSale('v1')).toHaveProperty('error')
    expect(db.manualSale.create).not.toHaveBeenCalled()
  })
})

// ─── Darstellung ────────────────────────────────────────────────────────────

function uebersicht(teil: Partial<SalesOverview> = {}): SalesOverview {
  return {
    weekTotal: 64.29,
    weekOnline: 19.99,
    weekBar: 44.3,
    ytdTotal: 1234.5,
    zeilen: verkaufsZeilen(
      mergeSalesFeed([feedBestellung({ pickedUpAt: new Date('2026-10-06T09:00:00Z') })], [feedVerkauf({ productName: LANG }), feedVerkauf({ id: 'v2', productName: 'Honig', channel: 'WHATSAPP' }, new Date('2026-10-04T12:00:00Z'))], 10),
      JETZT
    ),
    ...teil,
  }
}

const props = (teil: Partial<SalesOverview> = {}, stripeReady = true) => ({
  overview: uebersicht(teil),
  produkte: [{ id: 'p1', name: 'Eier', unit: 'STUECK', unitSize: null, stock: 12 }],
  topProduktIds: ['p1'],
  stripeReady,
})

/** Jedes Symbol ist Schmuck: Der Text daneben oder das aria-label trägt die Bedeutung. */
function symboleVersteckt(html: string): boolean {
  return [...html.matchAll(/<svg[^>]*>/g)].every(([tag]) => tag.includes('aria-hidden="true"'))
}

describe('Ansicht /sales — vier Zustände, lange Namen, Tokens', () => {
  it('gefüllt: Kopf, ein oranger Knopf, Kennzahlen, Wiederholen, Liste mit Link und Knöpfen', () => {
    const html = renderToStaticMarkup(createElement(VerkaeufeAnsicht, props()))
    expect(html).toContain('<h1')
    expect(html).toContain('Verkäufe')
    expect(html).toContain('Verkauf eintragen')
    expect(html).toContain('€ 64,29')
    expect(html).toContain('€ 19,99')
    expect(html).toContain('€ 44,30')
    expect(html).toContain(formatEuro(1234.5))
    expect(html).toContain('Wiederholen')
    expect(html).toContain('href="/orders/o1"')
    expect(html).toContain('Online')
    expect(html).toContain(`title="${LANG}"`)
    expect(html).toContain(`aria-label="${LANG} bearbeiten"`)
    expect(html).toContain(`aria-label="${LANG} löschen"`)
    expect(html).toContain('Noch einmal eintragen:')
    expect(html).toContain('Auszahlungen bei Stripe ansehen')
    expect(symboleVersteckt(html)).toBe(true)
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|green-|amber-|red-|app-ink/)
  })

  it('F6 (22b): unter der Wochenzahl „Dieses Jahr (für die Umsatzgrenze)" statt „Gesamt"', () => {
    const html = renderToStaticMarkup(createElement(VerkaeufeAnsicht, props()))
    expect(JAHRESSUMME_TEXT).toBe('Dieses Jahr (für die Umsatzgrenze)')
    expect(html).toContain(`${JAHRESSUMME_TEXT}: ${formatEuro(1234.5)}`)
    expect(html).not.toContain('Gesamt')
  })

  it('F6 (22b): „Verkauf eintragen" steht in allen Breiten als Knopf im Kopf, auch am Handy', () => {
    const html = renderToStaticMarkup(createElement(VerkaeufeAnsicht, props()))
    const kopf = html.slice(html.indexOf('<header'), html.indexOf('</header>'))
    const knopf = kopf.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Verkauf eintragen<\/button>/)
    expect(knopf, 'Knopf im Kopf').not.toBeNull()
    // Keine Klasse, die ihn unter einer Breite versteckt (wie „+ Neues Produkt" erst ab 768 px).
    expect(knopf![0]).not.toMatch(/(?:^|[\s"])(?:hidden|sr-only|max-md:hidden|max-sm:hidden)(?=[\s"])/)
    expect(knopf![0]).toContain('bg-primary')
    // Gegenprobe: Die Suche fände ein verstecktes Element.
    expect('<button class="hidden md:inline-flex">').toMatch(/(?:^|[\s"])(?:hidden|sr-only|max-md:hidden|max-sm:hidden)(?=[\s"])/)
  })

  it('ohne Stripe kein Auszahlungs-Link', () => {
    expect(renderToStaticMarkup(createElement(VerkaeufeAnsicht, props({}, false)))).not.toContain('Stripe')
  })

  it('leer: EmptyState mit Ausweg, kein Wiederholen', () => {
    const html = renderToStaticMarkup(createElement(VerkaeufeAnsicht, props({ zeilen: [], weekTotal: 0, weekOnline: 0, weekBar: 0, ytdTotal: 0 })))
    expect(html).toContain('Noch keine Verkäufe')
    expect(html.match(/Verkauf eintragen/g)?.length).toBe(2)
    expect(html).not.toContain('Wiederholen')
  })

  it('Fehler: orange Hinweiskarte mit „Noch einmal versuchen" statt 500', () => {
    const html = renderToStaticMarkup(createElement(VerkaeufeFehler))
    expect(html).toContain('Wir konnten deine Verkäufe gerade nicht laden.')
    expect(html).toContain('href="/sales"')
  })

  it('Laden: Skelett mit aria-busy', () => {
    expect(quelle('src/components/hof-verkaeufe/verkaeufe-laden.tsx')).toContain('aria-busy="true"')
    expect(quelle('src/app/(hof)/sales/loading.tsx')).toContain('VerkaeufeLaden')
  })
})

describe('Formular „Verkauf eintragen" im neuen Design', () => {
  const formular = (teil: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      createElement(VerkaufFormular, {
        verkauf: null,
        vorlage: null,
        produkte: [{ id: 'p1', name: LANG, unit: 'KG', unitSize: null, stock: 12 }],
        topProduktIds: ['p1'],
        titel: (text: string) => createElement('h2', null, text),
        onFertig: () => {},
        onAbbrechen: () => {},
        breit: true,
        ...teil,
      })
    )

  it('neu: Betrag zuerst, vier Wege und „Anderer Weg", Produkt-Chips mit langem Namen, Knopf grau ohne Betrag', () => {
    const html = formular()
    expect(html).toContain('<h2>Verkauf eintragen</h2>')
    expect(html).toContain('Betrag in Euro')
    expect(html).toContain('Wo verkauft?')
    for (const weg of ['Hofladen', 'Markt', 'WhatsApp', 'Betrieb', 'Anderer Weg']) expect(html).toContain(weg)
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1)
    expect(html).toContain(`title="${LANG}"`)
    expect(html).toContain('Menge oder Notiz ergänzen')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Eintragen</)
    expect(html).toContain('Abbrechen')
    expect(html).not.toContain('maxlength')
    expect(symboleVersteckt(html)).toBe(true)
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|green-|amber-|red-/)
  })

  it('D1 (Nr. 39): ohne Produkt kein Schalter „Vorrat abziehen"', () => {
    expect(formular()).not.toContain('Vorrat abziehen')
    expect(formular()).not.toContain('role="switch"')
  })

  it('D1 (Nr. 39): mit Produkt aus dem Sortiment der Schalter, Standard ein, mit Satz zum Vorrat', () => {
    // Wiederholen = neuer Verkauf mit gewähltem Produkt.
    const html = formular({ vorlage: daten({ productId: 'p1', productName: LANG, unit: 'KG', quantity: 2.5 }) })
    const schalter = html.match(/<button[^>]*role="switch"[^>]*>/)?.[0] ?? ''
    expect(schalter).toContain('aria-checked="true"')
    expect(schalter).toContain('aria-label="Vorrat abziehen"')
    expect(schalter).toMatch(/aria-describedby="[^"]+"/)
    // 44 px Tippfläche und der Fokusrahmen des Design-Systems.
    expect(schalter).toContain('min-h-11')
    expect(schalter).toContain('outline-solid')
    expect(html).toContain('Im Vorrat: 12 kg. Wir ziehen 3 kg ab.')
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|green-|amber-|red-/)
  })

  it('D1 (Nr. 39): beim Bearbeiten kein Schalter — der Vorrat bleibt beim Ändern unberührt', () => {
    expect(formular({ verkauf: daten({ productId: 'p1', productName: LANG, unit: 'KG' }) })).not.toContain('Vorrat abziehen')
  })

  it('D1 (Nr. 39): Gebindegröße steht hinter der Menge — die Menge zählt Gebinde wie der Vorrat', () => {
    const html = formular({
      produkte: [{ id: 'p1', name: 'Mehl', unit: 'KG', unitSize: 0.5, stock: 8 }],
      vorlage: daten({ productId: 'p1', productName: 'Mehl', unit: 'KG', quantity: 2 }),
    })
    expect(html).toContain('× 0,5 kg')
    expect(html).toContain('Im Vorrat: 8 × 0,5 kg. Wir ziehen 2 × 0,5 kg ab.')
  })

  it('bearbeiten: Titel, Betrag im Knopf, Notiz aufgeklappt', () => {
    const html = formular({ verkauf: daten({ note: 'Stammkundin', totalAmount: 24.5 }) })
    expect(html).toContain('<h2>Verkauf bearbeiten</h2>')
    expect(html).toContain('€ 24,50 speichern')
    expect(html).toContain('Stammkundin')
    expect(html).toContain('aria-expanded="true"')
  })
})

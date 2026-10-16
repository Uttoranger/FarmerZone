/**
 * GET /admin/finanzen/export?jahr=… (Register N15, Ergänzung Nr. 100) — die CSV
 * für die Steuerberatung, am echten Handler über die echten Abfragen (nur
 * Prisma und die Admin-Wache ersetzt). Beweist:
 *  - Nur Admin: ohne Anmeldung oder ohne Admin-Recht 403 ohne Inhalt, und die
 *    Datenbank wird gar nicht erst gefragt.
 *  - Mit Admin: 200, `no-store`, `attachment` mit dem Jahr im Dateinamen, UTF-8 mit BOM,
 *    Semikolon, Euro mit Komma, zwei Kopfzeilen.
 *  - Gegenprobe: Die Zahlen der CSV sind die der Jahresansicht (die Summenzeile
 *    gleicht den Kennzahlen der Seite).
 *  - Das Jahr aus der Adresse ist Fremdtext: Unsinn ist das laufende Jahr.
 *  - Keine Personendaten, nur GET.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const wache = vi.hoisted(() => ({ verlangeAdminAktion: vi.fn(), verlangeAdminSeite: vi.fn(async () => 'admin_1') }))
vi.mock('@/server/admin-wache', () => wache)
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('./finanzen-jahr-daten')).prismaAttrappe }))
vi.mock('@/lib/umgebung-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/umgebung-server')>()),
  STRIPE_LIVE_AB: new Date('2025-06-01T00:00:00Z'),
}))
// Für die Gegenprobe wird die Seite mitgerendert.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => {
    const attribute = Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'onNavigate' && k !== 'prefetch'))
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/admin/finanzen' }))
vi.mock('@/server/actions/finanzen', () => ({
  kostenpostenAnlegen: vi.fn(),
  kostenpostenAendern: vi.fn(),
  kostenpostenBeenden: vi.fn(),
  kostenpostenLoeschen: vi.fn(),
}))
vi.mock('@/server/queries/admin', () => ({ ladeHoefeFuerGruendung: vi.fn(async () => []) }))

import * as route from '@/app/admin/finanzen/export/route'
import AdminFinanzenPage from '@/app/admin/finanzen/page'
import { getFinanzenJahr } from '@/server/queries/finanzen'
import { ergebnisText } from '@/lib/finanzen'
import { centsAlsEuro, formatEuro } from '@/lib/format'
import { JETZT, STICHTAG, prismaAttrappe } from './finanzen-jahr-daten'

function anfrage(abfrage = '?jahr=2026'): NextRequest {
  return new NextRequest(`http://localhost/admin/finanzen/export${abfrage}`)
}

async function ruf(abfrage?: string): Promise<Response> {
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  try {
    return await route.GET(anfrage(abfrage))
  } finally {
    vi.useRealTimers()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  wache.verlangeAdminAktion.mockResolvedValue({ ok: true, userId: 'admin_1' })
})

describe('nur Admin', () => {
  it.each([
    ['nicht angemeldet', { error: 'Nicht angemeldet.' }],
    ['angemeldet ohne Admin-Recht', { error: 'Kein Zugriff.' }],
  ])('%s: 403 ohne CSV, ohne Zwischenspeicher — und die Datenbank wird nicht gefragt', async (_fall, antwort) => {
    wache.verlangeAdminAktion.mockResolvedValue(antwort)
    const res = await ruf()
    expect(res.status).toBe(403)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-disposition')).toBeNull()
    expect(res.headers.get('content-type')).not.toContain('csv')
    const text = await res.text()
    expect(text).not.toContain(';')
    expect(text).not.toContain('Summe')
    expect(prismaAttrappe.kostenposten.findMany).not.toHaveBeenCalled()
    expect(prismaAttrappe.order.findMany).not.toHaveBeenCalled()
  })

  it('es gibt nur GET — nichts, das schreibt', () => {
    expect(Object.keys(route).sort()).toEqual(['GET'])
  })
})

describe('mit Admin', () => {
  it('200, no-store, als Datei zum Speichern mit dem Jahr im Namen, UTF-8 mit BOM, Semikolon, zwei Kopfzeilen', async () => {
    const res = await ruf('?jahr=2026')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="finanzen-2026.csv"')
    const bytes = new Uint8Array(await res.arrayBuffer())
    // UTF-8-BOM: EF BB BF — damit Excel in Österreich die Umlaute richtig liest.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const zeilen = new TextDecoder('utf-8', { ignoreBOM: false }).decode(bytes).split('\r\n')
    expect(zeilen[0]).toBe('Monat;Servicegebühren (€);Kosten (€);Ergebnis (€);Bestellungen')
    expect(zeilen).toContain('Kostenposten;Rhythmus;Betrag (€);Monate im Jahr;Im Jahr (€)')
    expect(zeilen.find((z) => z.startsWith('Mai 2026'))).toMatch(/^Mai 2026;\d+,\d{2};\d+,\d{2};-?\d+,\d{2};\d+$/)
  })

  it('Gegenprobe: die Summenzeile der CSV gleicht den Kennzahlen der Jahresansicht', async () => {
    const csv = await (await ruf('?jahr=2026')).text()
    const summe = csv.split('\r\n').find((z) => z.startsWith('Summe 2026;') && z.split(';')[4] !== '')?.split(';')
    expect(summe).toBeDefined()
    const cents = (text: string) => Math.round(Number(text.replace(',', '.')) * 100)
    const { rechnung } = await getFinanzenJahr(2026, JETZT, STICHTAG)
    expect(cents(summe![1]!)).toBe(rechnung.servicegebuehrenCents)
    expect(cents(summe![2]!)).toBe(rechnung.kostenCents)
    expect(cents(summe![3]!)).toBe(rechnung.ergebnisCents)
    expect(Number(summe![4])).toBe(rechnung.bestellungen)

    // Dieselben Zahlen stehen auf der Seite — aus dem Text der CSV zurückgerechnet, nicht aus der Rechnung.
    vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
    let html: string
    try {
      html = renderToStaticMarkup(await AdminFinanzenPage({ searchParams: Promise.resolve({ zeitraum: 'jahr', jahr: '2026' }) }))
    } finally {
      vi.useRealTimers()
    }
    expect(html).toContain(formatEuro(centsAlsEuro(cents(summe![1]!))))
    expect(html).toContain(formatEuro(centsAlsEuro(cents(summe![2]!))))
    expect(html).toContain(ergebnisText(cents(summe![3]!)))
    expect(html).toContain(`${summe![4]} Bestellungen`)
  })

  it('das Jahr aus der Adresse: ein gültiges früheres Jahr, sonst das laufende', async () => {
    expect((await ruf('?jahr=2025')).headers.get('content-disposition')).toContain('finanzen-2025.csv')
    for (const abfrage of ['', '?jahr=', '?jahr=abc', '?jahr=2099', '?jahr=26', '?jahr=2019', '?jahr=2026&jahr=2025x']) {
      expect((await ruf(abfrage)).headers.get('content-disposition'), abfrage).toContain('finanzen-2026.csv')
    }
  })

  it('keine Personendaten: von den Bestellungen nur Zahlen, von den Kostenposten nur Namen und Beträge', async () => {
    const csv = await (await ruf('?jahr=2026')).text()
    expect(csv).not.toMatch(/@|https?:|\bcm[a-z0-9]{20,}\b/i)
    // Die Abfrage liest von den Bestellungen nur die Felder der Finanzregel.
    const auswahl = (prismaAttrappe.order.findMany.mock.calls[0] as unknown as [{ select: Record<string, boolean> }])[0].select
    expect(Object.keys(auswahl).sort()).toEqual(
      ['createdAt', 'paymentMethod', 'paymentStatus', 'platformFeeAmount', 'serviceFeeCents', 'serviceFeeRefundedAt', 'status'].sort()
    )
  })
})

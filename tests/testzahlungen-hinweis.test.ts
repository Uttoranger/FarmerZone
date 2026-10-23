/**
 * Die leise Zeile „Testzahlungen vor dem … sind nicht mitgezählt."
 * (Register Z4, Nachtlauf Nr. 55) auf Auswertung und Admin-Finanzen — die
 * Verkäufe prüft tests/hof-verkaeufe.test.ts an der Ansicht.
 *
 * Die Seiten werden echt gerendert, die Abfragen sind ersetzt: Die Zeile
 * steht genau dann im Kopf, wenn der Server sie schickt — und nur dort, als
 * leiser Text. Ob der Server sie schickt (Stichtag gesetzt UND betrifft
 * Bestellungen), prüfen tests/hof-verkaeufe.test.ts, tests/finanzen.test.ts
 * und tests/integration/testzahlungen.int.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const SATZ = 'Testzahlungen vor dem 2. November 2026, 21:00 Uhr sind nicht mitgezählt.'
const zustand = vi.hoisted(() => ({ hinweis: null as string | null }))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; [k: string]: unknown }) => {
    const attribute = { ...rest }
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
  // Der Ladepunkt (Nr. 105/121) fragt den Zustand des Links — beim Rendern auf dem Server lädt nichts.
  useLinkStatus: () => ({ pending: false }),
}))
vi.mock('next/navigation', () => ({
  redirect: (ziel: string) => {
    throw new Error(`redirect:${ziel}`)
  },
  usePathname: () => '/analytics',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => ({ user: { id: 'nutzer-1' } })) } } }))
// Die Wache selbst prüft tests/hof-ruecksprung.test.ts (Nr. 156); hier nur die Seite.
vi.mock('@/server/hofbereich', () => ({ verlangeHofDerSitzung: vi.fn(async () => ({ userId: 'nutzer-1', farmId: 'hof-1' })) }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn(async () => ({ id: 'hof-1', slug: 'hof-eins' })) }))
vi.mock('@/server/admin-wache', () => ({ verlangeAdminSeite: vi.fn(async () => undefined), verlangeFrischeBestaetigung: vi.fn(async () => ({ ok: true, userId: 'admin_1', sitzungId: 'sitzung-admin_1' })), frischOderBestaetigen: vi.fn(async () => null), adminPflichtOffen: vi.fn(async () => false) }))

vi.mock('@/server/queries/analytics', () => ({
  getUmsatzAuswertung: vi.fn(async () => ({
    periode: 'woche',
    zurueck: 0,
    laufend: true,
    zeitraum: 'Diese Woche',
    vergleichLabel: 'Woche davor',
    summeCent: 2450,
    vergleich: { richtung: 'keiner', text: 'Noch keine Vorwoche zum Vergleich' },
    balken: [],
    kanaele: [],
    einsicht: null,
    topProdukte: [],
  })),
  getYtdRevenue: vi.fn(async () => 24.5),
}))
vi.mock('@/server/queries/auswertung', () => ({
  getKennzahlen: vi.fn(async () => ({ bestellungen: 1, online: 0, vorOrt: 1, warenCents: 2450, durchschnittCents: 2450, nichtAbgeholt: 0 })),
  getServicegebuehrenMonat: vi.fn(async () => ({
    monat: '2026-11',
    onlineCents: 0,
    onlineAnzahl: 0,
    vorOrtCents: 0,
    vorOrtAnzahl: 0,
    summeCents: 0,
    bezeichnung: 'November 2026',
  })),
}))
vi.mock('@/server/queries/teilen-wirkung', () => ({ getTeilenWirkung: vi.fn(async () => ({ besuche: 0, kanaele: [] })) }))
vi.mock('@/server/queries/testzahlungen', () => ({ testzahlungenHinweisFuerHof: vi.fn(async () => zustand.hinweis) }))

// Die Zahl der Gründungshöfe für die Kachel „Grundgebühren“ (Nr. 94) — ohne Bezug zur Zeile.
vi.mock('@/server/queries/admin', () => ({ ladeHoefeFuerGruendung: vi.fn(async () => []) }))
vi.mock('@/server/queries/finanzen', () => ({
  aktuellerFinanzMonat: () => '2026-11',
  getFinanzen: vi.fn(async () => ({
    monat: '2026-11',
    bezeichnung: 'November 2026',
    vorigerMonat: null,
    naechsterMonat: null,
    einnahmen: {
      eingezogenCents: 61,
      geschuldetCents: 0,
      erwartetCents: 0,
      provisionCents: 0,
      bestellungen: 1,
      offeneBestellungen: 0,
      gezaehltCents: 61,
    },
    kosten: { cents: 0, anzahl: 0 },
    posten: [],
    verlauf: [],
    schnittCents: 61,
    brauchtBestellungen: 0,
    testzahlungenHinweis: zustand.hinweis,
  })),
}))
// Diagramm und Kostenliste sind Client-Teile ohne Bezug zur Zeile.
vi.mock('@/app/admin/finanzen/finanzen-diagramm', () => ({ FinanzenDiagramm: () => null, DiagrammLegende: () => null }))
vi.mock('@/app/admin/finanzen/kosten-liste', () => ({ KostenListe: () => null }))

import AnalyticsPage from '@/app/(hof)/analytics/page'
import AdminFinanzenPage from '@/app/admin/finanzen/page'
import { testzahlungenHinweisFuerHof } from '@/server/queries/testzahlungen'

async function auswertung(): Promise<string> {
  return renderToStaticMarkup(await AnalyticsPage({ searchParams: Promise.resolve({}) }))
}

async function finanzen(): Promise<string> {
  return renderToStaticMarkup(await AdminFinanzenPage({ searchParams: Promise.resolve({}) }))
}

function kopf(html: string): string {
  return html.slice(html.indexOf('<header'), html.indexOf('</header>'))
}

beforeEach(() => {
  zustand.hinweis = null
})

describe('Auswertung — Hinweiszeile im Kopf', () => {
  it('steht leise unter dem Titel, wenn der Server sie schickt', async () => {
    zustand.hinweis = SATZ
    const html = await auswertung()
    expect(kopf(html)).toContain(SATZ)
    expect(kopf(html)).toMatch(/<p class="[^"]*text-muted-foreground[^"]*">Testzahlungen vor dem/)
    expect(html.split('Testzahlungen vor dem')).toHaveLength(2)
  })

  it('fehlt ohne Stichtag oder ohne betroffene Bestellung', async () => {
    expect(await auswertung()).not.toContain('Testzahlungen')
  })

  it('fragt mit den Summen der Seite (zwei Umsatzfenster, Monat der Servicegebühren) und der farmId der Sitzung', async () => {
    await auswertung()
    const [farmId, summen] = vi.mocked(testzahlungenHinweisFuerHof).mock.calls.at(-1) ?? []
    expect(farmId).toBe('hof-1')
    expect(summen?.umsatz).toHaveLength(2)
    expect(summen?.gebuehrenMonat?.von).toBeInstanceOf(Date)
  })
})

describe('Admin-Finanzen — Hinweiszeile im Kopf', () => {
  it('steht leise unter dem Titel, wenn der Server sie schickt', async () => {
    zustand.hinweis = SATZ
    const html = await finanzen()
    expect(kopf(html)).toContain(SATZ)
    expect(kopf(html)).toMatch(/<p class="[^"]*text-muted-foreground[^"]*">Testzahlungen vor dem/)
    expect(html.split('Testzahlungen vor dem')).toHaveLength(2)
  })

  it('fehlt ohne Stichtag oder ohne betroffene Bestellung', async () => {
    expect(await finanzen()).not.toContain('Testzahlungen')
  })
})

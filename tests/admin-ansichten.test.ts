/**
 * Die Admin-Ansichten im neuen Design (Nachtlauf Nr. 22f) — gerendert ohne
 * Browser (renderToStaticMarkup).
 *
 *  - Ein wartender Hof ohne Stripe: „Freischalten" gesperrt, der Grund steht da.
 *  - Mit E-Mail und Stripe: „Freischalten" bedienbar.
 *  - Die Betriebsnummer steht als Nummer da, ohne Prüfvermerk (E9).
 *  - Lange Namen tragen den vollen Text im `title`.
 *  - Leer-Zustände mit Ausweg; Meldungstext mit Markup bleibt Text.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock('next/link', () => ({
  // onNavigate und prefetch kennt ein <a> nicht — sie fallen weg, der Rest bleibt.
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => {
    const attribute = Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'onNavigate' && k !== 'prefetch'))
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('@/server/actions/admin', () => ({
  approveFarmAction: vi.fn(),
  revokeFarmApprovalAction: vi.fn(),
  rejectFarmAction: vi.fn(),
  setServiceFeeAction: vi.fn(),
  triageMeldungAction: vi.fn(),
}))

import { HoefeAnsicht, type AdminHof } from '@/components/admin/hoefe-ansicht'
import { MeldungListe } from '@/components/admin/briefkasten-teile'
import { adminHofZeile, FREISCHALTUNG_STRIPE_OFFEN_TEXT, type HofRohdaten } from '@/lib/admin-hoefe'

const JETZT = new Date('2026-10-07T10:00:00+02:00')
const LEER = { produkte: 0, fotos: 0, abholzeiten: 0, hatBeschreibung: false, hatLogo: false }

function hof(ueber: Partial<HofRohdaten>, platz: number | null = null): AdminHof {
  const roh: HofRohdaten = {
    id: 'farm_1',
    name: 'Hof Test',
    slug: 'hof-test',
    ownerEmail: 'max@example.com',
    emailBestaetigt: true,
    emailBestaetigungOffen: false,
    createdAt: new Date('2026-10-06T09:00:00+02:00'),
    approvedAt: null,
    archivedAt: null,
    land: 'AT',
    serviceFeePercent: 5,
    serviceFeeMinCents: 50,
    serviceFeeActiveFrom: null,
    monat: { bestellungen: 0, gebuehrOnlineCents: 0, gebuehrBarCents: 0, gebuehrEntfallenCents: 0 },
    monatBezeichnung: 'Oktober 2026',
    stripeBereit: false,
    isPaused: false,
    betriebsnummer: null,
    sepaErteilt: false,
    ...ueber,
  }
  return { ...adminHofZeile(roh, { gruendungsplatz: platz, maxPlaetze: 12 }, JETZT), aktivitaet: { ...LEER, produkte: 2 } }
}

function render(hoefe: AdminHof[]): string {
  return renderToStaticMarkup(createElement(HoefeAnsicht, { hoefe, vergebenePlaetze: 1, maxPlaetze: 12, neueMeldungen: [] }))
}

/** Der <button>, der genau diesen Text trägt. */
function knopf(html: string, text: string): string {
  const ende = html.indexOf(`>${text}</button>`)
  expect(ende, text).toBeGreaterThan(-1)
  return html.slice(html.lastIndexOf('<button', ende), ende)
}

describe('Höfe und Freischaltung', () => {
  it('ohne Stripe: Freischalten gesperrt, der Grund steht sichtbar da', () => {
    const html = render([hof({ name: 'Waldhof' })])
    expect(knopf(html, 'Freischalten')).toContain('disabled=""')
    expect(html).toContain(FREISCHALTUNG_STRIPE_OFFEN_TEXT)
  })

  it('mit Stripe und bestätigter E-Mail: Freischalten bedienbar', () => {
    const html = render([hof({ name: 'Sonnhof', stripeBereit: true })])
    expect(knopf(html, 'Freischalten')).not.toContain('disabled=""')
    expect(html).toContain('Stripe eingerichtet')
  })

  it('die Betriebsnummer steht als Nummer in der Tabelle — ohne Prüfvermerk (E9)', () => {
    const html = render([hof({ approvedAt: JETZT, stripeBereit: true, betriebsnummer: '1234567' }, 1)])
    expect(html).toContain('1234567')
    expect(html).not.toMatch(/gepr(ü|ue)ft/i)
  })

  it('ein Name mit 80 Zeichen steht vollständig im title', () => {
    const lang = 'Hof '.padEnd(80, 'x')
    const html = render([hof({ name: lang, approvedAt: JETZT, stripeBereit: true }, 1)])
    expect(html).toContain(`title="${lang}"`)
  })

  it('kein Hof freigeschaltet: Leer-Zustand, kein Hof wartet: ein Satz', () => {
    const html = render([])
    expect(html).toContain('Kein Hof wartet auf Freischaltung.')
    expect(html).toContain('Noch kein Hof freigeschaltet')
  })

  it('der Satz zur Servicegebühr steht unter der Liste', () => {
    expect(render([])).toContain('Gilt nur für neue Bestellungen')
  })
})

describe('Briefkasten', () => {
  it('Meldungstext mit Markup bleibt Text', () => {
    const html = renderToStaticMarkup(
      createElement(MeldungListe, {
        zeilen: [
          { id: 'm1', art: 'Fehler', artTon: 'offen', titel: '<script>alert(1)</script>', herkunft: 'Hof Test', datum: 'Heute', status: 'Neu', statusTon: 'offen' },
        ],
        leer: { titel: '', satz: '' },
      })
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('leer: mit Ausweg', () => {
    const html = renderToStaticMarkup(
      createElement(MeldungListe, { zeilen: [], leer: { titel: 'Nichts zu entscheiden', satz: 'x', ausweg: { text: 'Offene Meldungen zeigen', href: '/admin/meldungen?status=NEU' } } })
    )
    expect(html).toContain('Nichts zu entscheiden')
    expect(html).toContain('Offene Meldungen zeigen')
  })
})

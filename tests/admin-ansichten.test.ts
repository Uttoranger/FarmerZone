/**
 * Die Admin-Ansichten im neuen Design (Nachtlauf Nr. 22f) — gerendert ohne
 * Browser (renderToStaticMarkup).
 *
 *  - Ein wartender Hof ohne Stripe: „Freischalten" gesperrt, der Grund steht da.
 *  - Mit E-Mail und Stripe: „Freischalten" bedienbar.
 *  - Die Betriebsnummer steht als Nummer da, ohne Prüfvermerk (E9).
 *  - Lange Namen tragen den vollen Text im `title`.
 *  - Leer-Zustände mit Ausweg; Meldungstext mit Markup bleibt Text.
 *  - Gründungshof bis (Nr. 62): Tabelle und Karte zeigen das wirksame Ende mit
 *    „Standard" bzw. „abweichend", der Dialog den Stand, der Freischalt-Dialog
 *    die Zusage K2 mit dem Standard. Dialoge ohne Portal (BestellDialog
 *    ersetzt): offen steht der Inhalt im HTML, geschlossen fehlt er.
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
  setzeGruendungBisAction: vi.fn(),
  triageMeldungAction: vi.fn(),
}))
vi.mock('@/components/hof-bestellungen/bestell-dialog', () => ({
  BestellDialog: ({ offen, titel, unterzeile, children }: { offen: boolean; titel: string; unterzeile?: string; children?: ReactNode }) =>
    offen ? createElement('section', { 'aria-label': titel }, createElement('h2', null, titel), unterzeile, children) : null,
  DialogFehler: ({ text }: { text: string | null }) => (text ? createElement('p', null, text) : null),
}))

import { HoefeAnsicht, type AdminHof } from '@/components/admin/hoefe-ansicht'
import { MeldungListe } from '@/components/admin/briefkasten-teile'
import { HofAktionDialog } from '@/components/admin/hof-aktion-dialog'
import { GruendungBisDialog } from '@/components/admin/gruendung-bis-dialog'
import { adminHofZeile, FREISCHALTUNG_STRIPE_OFFEN_TEXT, type HofRohdaten } from '@/lib/admin-hoefe'
import { GRUENDUNG_BIS_STANDARD, gruendungsKonditionenText, type GruendungAnzeige } from '@/lib/gruendungshof'

const JETZT = new Date('2026-10-07T10:00:00+02:00')
const LEER = { produkte: 0, fotos: 0, abholzeiten: 0, hatBeschreibung: false, hatLogo: false }

function hof(ueber: Partial<HofRohdaten>, platz: number | null = null, gruendung: GruendungAnzeige | null = null): AdminHof {
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
    onlineAn: true,
    isPaused: false,
    betriebsnummer: null,
    sepaErteilt: false,
    ...ueber,
  }
  return { ...adminHofZeile(roh, { gruendungsplatz: platz, maxPlaetze: 12 }, JETZT), aktivitaet: { ...LEER, produkte: 2 }, gruendung }
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

  it('freigeschaltet ohne Stripe: „Stripe fehlt" in der Liste und als Filter — kein „Nur bar" (Z1)', () => {
    const html = render([hof({ name: 'Waldhof', approvedAt: JETZT }, 1), hof({ id: 'farm_2', name: 'Sonnhof', approvedAt: JETZT, stripeBereit: true }, 2)])
    // Marke in Tabelle und Karte, dazu der Filter-Chip mit Zahl.
    expect(html.match(/>Stripe fehlt</g)?.length).toBeGreaterThanOrEqual(3)
    expect(html).toContain('filter=stripe-fehlt')
    expect(html).not.toMatch(/nur bar/i)
  })

  it('Stripe fertig, Online aus: Marke und Filter „Online-Zahlung aus" — der Betreiber findet den Hof', () => {
    const html = render([hof({ name: 'Moorhof', approvedAt: JETZT, stripeBereit: true, onlineAn: false }, 1)])
    expect(html.match(/>Online-Zahlung aus</g)?.length).toBeGreaterThanOrEqual(3)
    expect(html).toContain('filter=online-aus')
  })

  it('Gegenprobe: ohne solche Höfe kein Filter „Online-Zahlung aus"', () => {
    const html = render([hof({ name: 'Sonnhof', approvedAt: JETZT, stripeBereit: true }, 1)])
    expect(html).not.toContain('filter=online-aus')
  })

  it('Gegenprobe: mit Stripe steht kein „Stripe fehlt" in der Liste', () => {
    const html = render([hof({ name: 'Sonnhof', approvedAt: JETZT, stripeBereit: true }, 1)])
    expect(html).not.toContain('>Stripe fehlt</span>')
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

describe('Gründungshof bis (Nr. 62, Register K2)', () => {
  const STANDARD: GruendungAnzeige = { bisTag: '2027-12-31', bisText: '31.\u00a0Dezember 2027', abweichend: false }
  const EIGENES: GruendungAnzeige = { bisTag: '2028-06-30', bisText: '30.\u00a0Juni 2028', abweichend: true }
  const online = { approvedAt: JETZT, stripeBereit: true }

  it('Tabelle und Karte zeigen das wirksame Ende mit „Standard" bzw. „abweichend"', () => {
    const html = render([hof({ ...online, name: 'Sonnhof' }, 1, STANDARD), hof({ ...online, id: 'farm_2', name: 'Moorhof' }, 2, EIGENES)])
    expect(html).toContain('>Gründungshof bis</th>')
    // Je einmal in der Tabelle und einmal in der Karte.
    expect(html.match(/31\.\u00a0Dezember 2027/g)).toHaveLength(2)
    expect(html.match(/Standard<\/span>/g)).toHaveLength(2)
    expect(html.match(/30\.\u00a0Juni 2028/g)).toHaveLength(2)
    expect(html.match(/abweichend<\/span>/g)).toHaveLength(2)
    expect(html).toContain('Gründungshof bis Moorhof')
  })

  it('Gegenprobe: ohne Gründungsplatz kein Datum, keine Marke und nichts zu ändern', () => {
    const html = render([hof({ ...online, name: 'Sonnhof' }, 13)])
    expect(html).not.toMatch(/Standard<\/span>|abweichend<\/span>|Gründungshof bis Sonnhof/)
    expect(html).toContain('kein Gründungsplatz')
  })

  it('der Freischalt-Dialog nennt die Zusage K2 mit dem Standard-Ende — ohne „dauerhaft" und ohne Prozent', () => {
    const html = renderToStaticMarkup(
      createElement(HofAktionDialog, { aktion: { hof: hof({ stripeBereit: true }), art: 'approve' }, vergebenePlaetze: 3, onClose: () => {} })
    )
    expect(html).toContain('Gründungshof Nr. 4')
    expect(html).toContain(gruendungsKonditionenText(GRUENDUNG_BIS_STANDARD))
    expect(html).toContain('31.\u00a0Dezember 2027')
    expect(html).not.toMatch(/dauerhaft|\d\s?%/)
  })

  it('Gegenprobe: alle Plätze vergeben — keine Zusage im Freischalt-Dialog', () => {
    const html = renderToStaticMarkup(
      createElement(HofAktionDialog, { aktion: { hof: hof({ stripeBereit: true }), art: 'approve' }, vergebenePlaetze: 12, onClose: () => {} })
    )
    expect(html).toContain('Alle 12 Gründungsplätze sind vergeben')
    expect(html).not.toContain(gruendungsKonditionenText(GRUENDUNG_BIS_STANDARD))
  })

  it('der Dialog zeigt den Stand: eigenes Datum vorbelegt, mit „Auf Standard zurücksetzen"', () => {
    const html = renderToStaticMarkup(createElement(GruendungBisDialog, { hof: { id: 'farm_2', name: 'Moorhof', gruendung: EIGENES }, onClose: () => {} }))
    expect(html).toContain('Moorhof')
    expect(html).toContain('30.\u00a0Juni 2028')
    expect(html).toContain('value="2028-06-30"')
    expect(html).toContain('Auf Standard zurücksetzen')
    expect(html).toContain('Leer = Standard (31.\u00a0Dezember 2027)')
    // Die Rückfrage K1 erscheint erst bei einem früheren Tag.
    expect(html).not.toContain('Nur mit Zustimmung des Hofs (K1)')
  })

  it('Gegenprobe: beim Standard bleibt das Feld leer und es gibt nichts zurückzusetzen', () => {
    const html = renderToStaticMarkup(createElement(GruendungBisDialog, { hof: { id: 'farm_1', name: 'Sonnhof', gruendung: STANDARD }, onClose: () => {} }))
    expect(html).toContain('value=""')
    expect(html).not.toContain('Auf Standard zurücksetzen')
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

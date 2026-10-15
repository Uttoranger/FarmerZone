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
 *  - Seitenmuster (Nr. 94, Register N15): Kennzahlen und Unterreiter; der Reiter
 *    steht in der Adresse und schaltet den Inhalt um (Warteliste mit der Zeile
 *    zum Gründungsplatz · Liste mit der Spalte Gründungshof · nur Gründungshöfe).
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Die Adresse, die useSearchParams liefert — jeder Test setzt sie selbst (vorher leer).
const adresse = vi.hoisted(() => ({ parameter: '' }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(adresse.parameter),
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

beforeEach(() => {
  adresse.parameter = ''
})

function hof(ueber: Partial<HofRohdaten>, platz: number | null = null, gruendung: GruendungAnzeige | null = null, platzBeiFreischaltung: number | null = null): AdminHof {
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
  return { ...adminHofZeile(roh, { gruendungsplatz: platz, maxPlaetze: 12 }, JETZT), aktivitaet: { ...LEER, produkte: 2 }, gruendung, platzBeiFreischaltung }
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

  it('kein Hof freigeschaltet: Leer-Zustand; kein Hof wartet: ein Satz im Reiter „Warten“', () => {
    // Ohne Wartende zeigt die Seite „Alle Höfe“ — dort der Leer-Zustand.
    expect(render([])).toContain('Noch kein Hof freigeschaltet')
    adresse.parameter = 'reiter=warten'
    expect(render([])).toContain('Kein Hof wartet auf Freischaltung.')
  })

  it('der Satz zur Servicegebühr steht als Regel-Zeile unter jedem Reiter', () => {
    for (const reiter of ['warten', 'alle', 'gruendung']) {
      adresse.parameter = `reiter=${reiter}`
      expect(render([]), reiter).toContain('Gilt nur für neue Bestellungen')
    }
  })
})

describe('Gründungshof bis (Nr. 62, Register K2)', () => {
  const STANDARD: GruendungAnzeige = { bisTag: '2027-12-31', bisText: '31.\u00a0Dezember 2027', abweichend: false }
  const EIGENES: GruendungAnzeige = { bisTag: '2028-06-30', bisText: '30.\u00a0Juni 2028', abweichend: true }
  const online = { approvedAt: JETZT, stripeBereit: true }

  it('Tabelle und Karte zeigen das wirksame Ende mit „Standard" bzw. „abweichend"', () => {
    const html = render([hof({ ...online, name: 'Sonnhof' }, 1, STANDARD), hof({ ...online, id: 'farm_2', name: 'Moorhof' }, 2, EIGENES)])
    // Seit Nr. 94 eine Spalte „Gründungshof“: „Nr. 1 · bis 31.12.2027“ (Register N15), die Karte schreibt das Datum lang.
    expect(html).toContain('>Gründungshof</th>')
    expect(html).not.toContain('>Gründungshof bis</th>')
    expect(html).toContain('Nr. 1 · bis 31.12.2027')
    expect(html).toContain('Nr. 2 · bis 30.06.2028')
    expect(html.match(/31\.\u00a0Dezember 2027/g)).toHaveLength(1)
    expect(html.match(/30\.\u00a0Juni 2028/g)).toHaveLength(1)
    // Je einmal in der Tabelle und einmal in der Karte.
    expect(html.match(/Standard<\/span>/g)).toHaveLength(2)
    expect(html.match(/abweichend<\/span>/g)).toHaveLength(2)
    expect(html).toContain('Gründungshof bis Moorhof')
  })

  it('Gegenprobe: ohne Gründungsplatz kein Datum, keine Marke und nichts zu ändern', () => {
    const html = render([hof({ ...online, name: 'Sonnhof' }, 13)])
    expect(html).not.toMatch(/Standard<\/span>|abweichend<\/span>|Gründungshof bis Sonnhof/)
    expect(html).toContain('kein Gründungshof')
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

describe('Seitenmuster der Höfe (Nr. 94, Register N15)', () => {
  const online = { approvedAt: JETZT, stripeBereit: true }
  const STANDARD: GruendungAnzeige = { bisTag: '2027-12-31', bisText: '31.\u00a0Dezember 2027', abweichend: false }
  const EIGENES: GruendungAnzeige = { bisTag: '2027-06-30', bisText: '30.\u00a0Juni 2027', abweichend: true }

  /** Wie im Mockup: zwei online (Platz 1 und 2), einer pausiert (Platz 3, eigenes Ende), einer ohne Stripe (kein Platz), zwei wartend. */
  function bestand(wartenderPlatz: number | null = 4): AdminHof[] {
    return [
      hof({ ...online, id: 'a', name: 'Hof Müller' }, 1, STANDARD),
      hof({ ...online, id: 'b', name: 'Bergbauernhof' }, 2, STANDARD),
      hof({ ...online, id: 'c', name: 'Imkerei am Waldrand', isPaused: true }, 3, EIGENES),
      hof({ approvedAt: JETZT, id: 'd', name: 'Lindenhof', stripeBereit: false }, null, null),
      hof({ id: 'w1', name: 'Sonnhof Ranshofen', stripeBereit: true }, null, null, wartenderPlatz),
      hof({ id: 'w2', name: 'Waldbauer Mattighofen', stripeBereit: false }, null, null, wartenderPlatz),
    ]
  }
  const stand = (hoefe: AdminHof[], vergeben = 3): string =>
    renderToStaticMarkup(createElement(HoefeAnsicht, { hoefe, vergebenePlaetze: vergeben, maxPlaetze: 12, neueMeldungen: [] }))

  it('Seitenkopf mit Satz und Suche, Kennzahlen mit den Zahlen aus den Zeilen', () => {
    const html = stand(bestand())
    expect(html).toMatch(/<h1[^>]*>Höfe<\/h1>/)
    expect(html).toContain('Freischalten, Gründungsplätze und Konditionen je Hof.')
    expect(html).toContain('aria-label="Höfe in Zahlen"')
    expect(html).toMatch(/<dt[^>]*>Warten<\/dt><dd[^>]*>2<\/dd>/)
    expect(html).toMatch(/Gründungsplätze<\/span><\/dt><dd[^>]*>9 frei<\/dd><dd[^>]*>3 von 12 vergeben<\/dd>/)
    expect(html).toContain('type="search"')
  })

  it('drei Unterreiter als Links mit reiter; ohne Wahl gilt „Warten“, solange jemand wartet', () => {
    const html = stand(bestand())
    const nav = html.slice(html.indexOf('<nav aria-label="Ansicht der Höfe"'), html.indexOf('</nav>', html.indexOf('<nav aria-label="Ansicht der Höfe"')))
    expect([...nav.matchAll(/<a href="([^"]+)"/g)].map((t) => t[1])).toEqual(['/admin?reiter=warten', '/admin?reiter=alle', '/admin?reiter=gruendung'])
    expect(nav.match(/aria-current="page"/g)).toHaveLength(1)
    expect(nav).toMatch(/href="\/admin\?reiter=warten"[^>]*aria-current="page"/)
    expect(nav).toContain('>3 / 12<')
  })

  it('Gegenprobe: niemand wartet — ohne Wahl gilt „Alle Höfe“', () => {
    const html = stand(bestand().slice(0, 4))
    expect(html).toMatch(/href="\/admin\?reiter=alle"[^>]*aria-current="page"/)
    expect(html).not.toMatch(/href="\/admin\?reiter=warten"[^>]*aria-current/)
  })

  it('Warten: die Karten der Wartenden, die Tabelle nicht', () => {
    const html = stand(bestand())
    expect(html).toContain('Sonnhof Ranshofen')
    expect(html).toContain('Waldbauer Mattighofen')
    expect(html).not.toContain('<table')
    expect(html).not.toContain('Hof Müller')
  })

  it('Warteliste: mit Stripe „bekäme Gründungsplatz Nr. k“, ohne Stripe „Gründungsplatz erst mit Freischaltung“', () => {
    const html = stand(bestand(4))
    expect(html).toContain('bekäme Gründungsplatz Nr. 4')
    expect(html).toContain('Gründungsplatz erst mit Freischaltung')
    // Die Platzzeile trägt ein Symbol, das für Screenreader verborgen ist.
    expect(html).toMatch(/lucide-star[^>]*aria-hidden="true"/)
    // Gegenprobe: Der Hinweis ohne Stripe steht nur einmal (bei dem Hof ohne Stripe), der Platz nur einmal (mit Stripe).
    expect(html.match(/bekäme Gründungsplatz/g)).toHaveLength(1)
    expect(html.match(/Gründungsplatz erst mit Freischaltung/g)).toHaveLength(1)
  })

  it('Gegenprobe: sind alle Plätze vergeben, steht bei keinem Wartenden eine Platz-Zeile', () => {
    const html = stand(bestand(null), 12)
    expect(html).not.toContain('bekäme Gründungsplatz')
    expect(html).not.toContain('Gründungsplatz erst mit Freischaltung')
    expect(html).toContain('Sonnhof Ranshofen')
  })

  it('Alle Höfe: die Tabelle mit der Spalte Gründungshof — „Nr. 3 · bis 30.06.2027 abweichend“ und „kein Gründungshof“', () => {
    adresse.parameter = 'reiter=alle'
    const html = stand(bestand())
    expect(html).toContain('>Gründungshof</th>')
    expect(html).toContain('Nr. 1 · bis 31.12.2027')
    expect(html).toContain('Nr. 3 · bis 30.06.2027')
    expect(html).toMatch(/Nr\. 3 · bis 30\.06\.2027<\/span><span[^>]*>abweichend</)
    // Der Hof ohne Platz: in Tabelle und Karte „kein Gründungshof“; die Wartenden stehen hier nicht.
    expect(html.match(/kein Gründungshof/g)).toHaveLength(2)
    expect(html).not.toContain('Sonnhof Ranshofen')
    // Die Filter-Chips gehören zu diesem Reiter und tragen reiter=alle in der Adresse.
    expect(html).toContain('/admin?reiter=alle&amp;filter=pausiert')
  })

  it('Gründungshöfe: nur die Höfe mit Platz, nach Platz — der Hof ohne Platz fehlt', () => {
    adresse.parameter = 'reiter=gruendung'
    const html = stand(bestand())
    expect(html).toContain('Hof Müller')
    expect(html).toContain('Imkerei am Waldrand')
    expect(html).not.toContain('Lindenhof')
    expect(html.indexOf('Hof Müller')).toBeLessThan(html.indexOf('Bergbauernhof'))
    expect(html.indexOf('Bergbauernhof')).toBeLessThan(html.indexOf('Imkerei am Waldrand'))
    // Keine Filter-Chips in diesem Reiter.
    expect(html).not.toContain('aria-label="Höfe filtern"')
  })

  it('ein unbekannter Reiter in der Adresse fällt auf den Standard', () => {
    adresse.parameter = 'reiter=unsinn'
    expect(stand(bestand())).toContain('bekäme Gründungsplatz Nr. 4')
  })

  it('die Suche gilt im gewählten Reiter und geht beim Wechsel mit', () => {
    adresse.parameter = 'reiter=alle&suche=imkerei'
    const html = stand(bestand())
    expect(html).toContain('Imkerei am Waldrand')
    expect(html).not.toContain('Bergbauernhof')
    expect(html).toContain('href="/admin?reiter=warten&amp;suche=imkerei"')
  })

  it('die Regel-Zeile nennt die Reihenfolge der Freischaltung', () => {
    expect(stand(bestand())).toContain('Gründungsplätze zählen in der Reihenfolge der Freischaltung.')
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

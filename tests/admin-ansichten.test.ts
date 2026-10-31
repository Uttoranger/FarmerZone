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
 *  - Seit Nr. 187: Freischalten, Gründung, Testhof und Kartenpunkt stehen in der
 *    Akte; die Liste im Regelbetrieb filtert „Braucht Blick“ (Standard), zeigt
 *    eine echte Tabelle und je Hof „Prüfen“ bzw. „Akte“.
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
vi.mock('@/server/actions/gruendung', () => ({ nimmAusGruendung: vi.fn(), nimmWiederAuf: vi.fn(), markiereAlsTesthof: vi.fn(), nimmTesthofZurueck: vi.fn() }))
vi.mock('@/server/actions/admin-hof', () => ({ sperreHof: vi.fn(), hebeHofSperreAuf: vi.fn() }))
vi.mock('@/components/hof-bestellungen/bestell-dialog', () => ({
  BestellDialog: ({ offen, titel, unterzeile, children }: { offen: boolean; titel: string; unterzeile?: string; children?: ReactNode }) =>
    offen ? createElement('section', { 'aria-label': titel }, createElement('h2', null, titel), unterzeile, children) : null,
  DialogFehler: ({ text }: { text: string | null }) => (text ? createElement('p', null, text) : null),
}))

import { HoefeAnsicht, type AdminHof } from '@/components/admin/hoefe-ansicht'
import { HofAkteAnsicht } from '@/components/admin/hof-akte-ansicht'
import { hoefeListenZeile, type HofZustand, type HoefeListenRoh, type HoefeListenZeile } from '@/lib/admin-hoefe-liste'
import type { HofAkteAnsicht as HofAkteAnsichtDaten } from '@/lib/admin-hof-akte'
import { HofAktionDialog } from '@/components/admin/hof-aktion-dialog'
import { GruendungBisDialog } from '@/components/admin/gruendung-bis-dialog'
import { GruendungAusnehmenDialog } from '@/components/admin/gruendung-ausnehmen-dialog'
import { GRUENDUNG_AUSNEHMEN_TEXT, gruendungAenderung } from '@/lib/admin-hoefe-seite'
import { adminHofZeile, FREISCHALTUNG_STRIPE_OFFEN_TEXT, KEIN_KARTENPUNKT_TEXT, type HofRohdaten } from '@/lib/admin-hoefe'
import { hofRohdaten } from './fabrik/hof-rohdaten'
import { GRUENDUNG_BIS_STANDARD, GRUENDUNG_EINSTELLUNG_STANDARD, freischaltHinweis, gruendungsKonditionenText, type GruendungAnzeige } from '@/lib/gruendungshof'

const JETZT = new Date('2026-10-07T10:00:00+02:00')
const LEER = { produkte: 0, fotos: 0, abholzeiten: 0, hatBeschreibung: false, hatLogo: false }

beforeEach(() => {
  adresse.parameter = ''
})

function hof(ueber: Partial<HofRohdaten>, platz: number | null = null, gruendung: GruendungAnzeige | null = null, platzBeiFreischaltung: number | null = null): AdminHof {
  const roh = hofRohdaten(ueber)
  return { ...adminHofZeile(roh, { gruendungsplatz: platz, maxPlaetze: 12 }, JETZT), aktivitaet: { ...LEER, produkte: 2 }, gruendung, platzBeiFreischaltung, gruendungAenderung: null, gruendungZuletzt: null, testhofAenderung: null }
}

const ZUSTAND: Record<'wartet' | 'verkauft' | 'testhof', HofZustand> = {
  wartet: { id: 'wartet', text: 'Wartet', ton: 'offen' },
  verkauft: { id: 'verkauft', text: 'Verkauft', ton: 'fertig' },
  testhof: { id: 'testhof', text: 'Testhof', ton: 'neutral' },
}

const AKTE: HofAkteAnsichtDaten = {
  kontakt: { telefon: '–', anmeldung: 'h•••@example.com', emailBestaetigt: 'ja', hofEmail: 'wie Anmeldung', ort: '1234 Musterort · Österreich', agb: 'noch nicht zugestimmt' },
  aktivitaet: { bestellungen: 0, bestellungenZeile: '0 storniert · 0 nicht abgeholt', umsatzCents: 0, servicegebuehrCents: 0, zuletztAngemeldet: 'noch nie', anmeldung: null, antwortzeit: 'noch keine Antwort' },
  zustand: [],
  sperre: { gesperrt: false, grund: null, seit: null },
  protokoll: [],
}

/** Die Akte eines Hofs (Nr. 187) — Freischalten, Gründung, Testhof und Servicegebühr stehen seitdem hier. */
function akte(h: AdminHof, zustand: HofZustand = ZUSTAND.wartet): string {
  return renderToStaticMarkup(createElement(HofAkteAnsicht, { hof: h, zustand, akte: AKTE }))
}

function liste(zeilen: HoefeListenZeile[]): string {
  return renderToStaticMarkup(createElement(HoefeAnsicht, { zeilen }))
}

/** Der <button>, der genau diesen Text trägt. */
function knopf(html: string, text: string): string {
  const ende = html.indexOf(`>${text}</button>`)
  expect(ende, text).toBeGreaterThan(-1)
  return html.slice(html.lastIndexOf('<button', ende), ende)
}

describe('Akte: Freischalten und Kontakt (Nr. 187, vorher Liste Nr. 22f)', () => {
  it('ohne Stripe: Freischalten gesperrt, der Grund steht sichtbar da', () => {
    const html = akte(hof({ name: 'Waldhof' }))
    expect(knopf(html, 'Freischalten')).toContain('disabled=""')
    expect(html).toContain(FREISCHALTUNG_STRIPE_OFFEN_TEXT)
  })

  it('mit Stripe und bestätigter E-Mail: Freischalten bedienbar', () => {
    const html = akte(hof({ name: 'Sonnhof', stripeBereit: true }))
    expect(knopf(html, 'Freischalten')).not.toContain('disabled=""')
    expect(html).toContain('Stripe eingerichtet')
  })

  it('freigeschaltet ohne Stripe: „Stripe fehlt“ im Kopf, Freigabe zurücknehmen statt Freischalten — kein „Nur bar“ (Z1)', () => {
    const html = akte(hof({ name: 'Waldhof', approvedAt: JETZT }, 1), ZUSTAND.verkauft)
    expect(html).toContain('>Stripe fehlt<')
    expect(html).toContain('>Freigabe zurücknehmen</button>')
    expect(html).not.toContain('>Freischalten</button>')
    expect(html).not.toMatch(/nur bar/i)
  })

  it('die Betriebsnummer steht als Nummer da — laut Angabe des Hofs, ohne Prüfvermerk (E9)', () => {
    const html = akte(hof({ approvedAt: JETZT, stripeBereit: true, betriebsnummer: '1234567' }, 1), ZUSTAND.verkauft)
    expect(html).toContain('1234567')
    expect(html).toContain('laut Angabe des Hofs')
    expect(html).not.toMatch(/gepr(ü|ue)ft/i)
  })

  it('der Satz zur Servicegebühr steht unter „Eingreifen“', () => {
    expect(akte(hof({ approvedAt: JETZT, stripeBereit: true }, 1), ZUSTAND.verkauft)).toContain('Gilt nur für neue Bestellungen')
  })

  it('ein ausgenommener Hof trägt die Marke „ausgenommen“, ein Testhof nur „Testhof“ (Register K2, N21)', () => {
    const aus = akte(hof({ approvedAt: JETZT, stripeBereit: true, gruendungAusgenommen: true }, null), ZUSTAND.verkauft)
    expect(aus).toMatch(/>ausgenommen<\/span>/)
    const test = akte(hof({ approvedAt: JETZT, stripeBereit: true, gruendungAusgenommen: true, istTesthof: true }, null), ZUSTAND.testhof)
    expect(test).toMatch(/>Testhof<\/span>/)
    expect(test).not.toMatch(/>ausgenommen<\/span>/)
  })

  it('ohne Kartenpunkt: leise unter dem Ort, Freischalten bleibt bedienbar (Nr. 119)', () => {
    const html = akte(hof({ name: 'Sonnhof', stripeBereit: true, hatKartenpunkt: false }))
    expect(html).toContain(KEIN_KARTENPUNKT_TEXT)
    expect(knopf(html, 'Freischalten')).not.toContain('disabled=""')
    const zeile = html.slice(html.lastIndexOf('<span class=', html.indexOf(KEIN_KARTENPUNKT_TEXT)), html.indexOf(KEIN_KARTENPUNKT_TEXT))
    expect(zeile).toContain('text-muted-foreground')
    expect(zeile).not.toContain('text-status-offen')
    expect(akte(hof({ name: 'Sonnhof', stripeBereit: true }))).not.toContain(KEIN_KARTENPUNKT_TEXT)
  })
})

describe('Gründungshof bis (Nr. 62, Register K2)', () => {
  const STANDARD: GruendungAnzeige = { bisTag: '2027-12-31', bisText: '31.\u00a0Dezember 2027', abweichend: false, standardTag: '2027-12-31' }
  const EIGENES: GruendungAnzeige = { bisTag: '2028-06-30', bisText: '30.\u00a0Juni 2028', abweichend: true, standardTag: '2027-12-31' }
  const online = { approvedAt: JETZT, stripeBereit: true }

  it('die Akte zeigt das wirksame Ende mit „Standard“ bzw. „abweichend“ und „Gründungshof bis …“', () => {
    const std = akte(hof({ ...online, name: 'Sonnhof' }, 1, STANDARD), ZUSTAND.verkauft)
    expect(std).toContain('Gründungshof · Platz 1')
    expect(std).toContain('Gründungshof bis 31.\u00a0Dezember 2027')
    expect(std).toContain('· Standard')
    expect(std).toContain('>Gründungshof bis …</button>')
    const eigen = akte(hof({ ...online, id: 'farm_2', name: 'Moorhof' }, 2, EIGENES), ZUSTAND.verkauft)
    expect(eigen).toContain('30.\u00a0Juni 2028')
    expect(eigen).toContain('· abweichend')
  })

  it('Gegenprobe: ohne Gründungsplatz kein Datum, keine Marke und nichts zu ändern', () => {
    const html = akte(hof({ ...online, name: 'Sonnhof' }, 13), ZUSTAND.verkauft)
    expect(html).not.toMatch(/· Standard|· abweichend|Gründungshof bis …|Gründungshof · Platz/)
  })

  /** n freigeschaltete Höfe der Platzvergabe — der Hinweis im Dialog kommt seit Nr. 116 fertig vom Server (freischaltHinweis). */
  const imRennen = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `h_${i}`, approvedAt: new Date(Date.UTC(2026, 0, 1 + i)), createdAt: new Date(Date.UTC(2025, 0, 1)), archivedAt: null, gruendungAusgenommen: false }))
  const wartend = { id: 'neu', gruendungPlatz: null, gruendungBis: null, gruendungAusgenommen: false }

  it('der Freischalt-Dialog nennt die Zusage K2 mit dem Standard-Ende — ohne „dauerhaft" und ohne Prozent', () => {
    const hinweis = freischaltHinweis(wartend, imRennen(3), GRUENDUNG_EINSTELLUNG_STANDARD, JETZT)
    const html = renderToStaticMarkup(
      createElement(HofAktionDialog, { aktion: { hof: hof({ stripeBereit: true, approvedAt: null, freischaltHinweis: hinweis }), art: 'approve' }, onClose: () => {} })
    )
    expect(html).toContain('Gründungshof Nr. 4')
    expect(html).toContain(gruendungsKonditionenText(GRUENDUNG_BIS_STANDARD))
    expect(html).toContain('31.\u00a0Dezember 2027')
    expect(html).not.toMatch(/dauerhaft|\d\s?%/)
  })

  it('Gegenprobe: alle Plätze vergeben — keine Zusage im Freischalt-Dialog', () => {
    const hinweis = freischaltHinweis(wartend, imRennen(12), GRUENDUNG_EINSTELLUNG_STANDARD, JETZT)
    const html = renderToStaticMarkup(
      createElement(HofAktionDialog, { aktion: { hof: hof({ stripeBereit: true, approvedAt: null, freischaltHinweis: hinweis }), art: 'approve' }, onClose: () => {} })
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
describe('Liste im Regelbetrieb (Nr. 187, Mockup admin-hoefe-neu)', () => {
  const online = { approvedAt: new Date('2026-08-01T00:00:00Z'), stripeBereit: true }
  const zeile = (ueber: Partial<HofRohdaten> & Partial<HoefeListenRoh>): HoefeListenZeile =>
    hoefeListenZeile({ ...hofRohdaten(ueber), geschlossenAm: null, adminGesperrtAm: null, ort: 'Musterort', bestellungen30: 3, letzteBestellungAm: JETZT, zuletztAktivAm: null, ...ueber }, JETZT)
  const bestand = (): HoefeListenZeile[] => [
    zeile({ ...online, id: 'a', name: 'Hof Müller' }),
    zeile({ ...online, id: 'b', name: 'Bergbauernhof', stripeBereit: false }),
    zeile({ ...online, id: 'c', name: 'Imkerei am Waldrand', isPaused: true }),
    zeile({ ...online, id: 't', name: 'Probehof', istTesthof: true, stripeBereit: false }),
    zeile({ id: 'w1', name: 'Sonnhof', stripeBereit: true }),
  ]

  it('Seitenkopf mit Satz und Suche, acht Filter mit Zahl — keine Kacheln „Höfe in Zahlen“, kein „Neue Meldungen“', () => {
    const html = liste(bestand())
    expect(html).toMatch(/<h1[^>]*>Höfe<\/h1>/)
    expect(html).toContain('type="search"')
    for (const f of ['Braucht Blick', 'Wartet', 'Verkauft', 'Pausiert', 'Gesperrt', 'Geschlossen', 'Testhöfe', 'Alle']) expect(html).toContain(`>${f}<`)
    expect(html).not.toContain('Höfe in Zahlen')
    expect(html).not.toContain('Neu im Postfach')
  })

  it('„Braucht Blick“ (Standard) zeigt nur Höfe mit Signal — der Testhof nur unter „Testhöfe“', () => {
    const html = liste(bestand())
    expect(html).toContain('Bergbauernhof')
    expect(html).toContain('Sonnhof')
    expect(html).not.toContain('Hof Müller')
    expect(html).not.toContain('Imkerei am Waldrand')
    expect(html).not.toContain('Probehof')
    adresse.parameter = 'filter=testhoefe'
    expect(liste(bestand())).toContain('Probehof')
  })

  it('echte Tabelle mit Zustand, Signal, Bestellungen 30 Tage und zuletzt aktiv; „Prüfen“ bzw. „Akte“ mit Hofname für Screenreader', () => {
    adresse.parameter = 'filter=alle'
    const html = liste(bestand())
    for (const kopf of ['Hof', 'Zustand', 'Signal', 'Best. 30 T', 'Zuletzt aktiv']) expect(html).toContain(`>${kopf}</th>`)
    expect(html).toContain('href="/admin/hoefe/w1"')
    expect(html).toMatch(/Prüfen<span class="sr-only"> Sonnhof<\/span>/)
    expect(html).toMatch(/Akte<span class="sr-only"> Hof Müller<\/span>/)
    expect(html).toContain('>Verkauft<')
    expect(html).toContain('>Pausiert<')
  })

  it('ein Name mit 80 Zeichen steht vollständig im title', () => {
    const lang = 'Hof '.padEnd(80, 'x')
    adresse.parameter = 'filter=alle'
    expect(liste([zeile({ ...online, name: lang })])).toContain(`title="${lang}"`)
  })

  it('Leer-Zustände: ohne Höfe ein Satz, ohne Signal „Gerade braucht kein Hof deinen Blick.“ mit Ausweg', () => {
    expect(liste([])).toContain('Noch kein Hof angemeldet')
    const ruhig = liste([zeile({ ...online, id: 'a', name: 'Hof Müller' })])
    expect(ruhig).toContain('Gerade braucht kein Hof deinen Blick.')
    expect(ruhig).toContain('Alle Höfe zeigen')
  })
})

describe('Bestätigung „Nicht als / Wieder als Gründungshof zählen“ (Register K2, Nr. 109)', () => {
  const T = (tag: number) => new Date(Date.UTC(2026, 0, tag))
  const platzHof = (n: number, gruendungAusgenommen = false) => ({
    id: `hof_${n}`,
    name: `Testhof ${String.fromCharCode(64 + n)}`,
    approvedAt: T(n),
    createdAt: T(1),
    archivedAt: null,
    gruendungAusgenommen,
    istTesthof: false,
    gruendungBis: null,
  })
  const render = (n: number, hoefe: ReturnType<typeof platzHof>[], plaetze = 12): string => {
    const h = hoefe[n - 1] as ReturnType<typeof platzHof>
    const aenderung = gruendungAenderung(h, hoefe, plaetze, GRUENDUNG_BIS_STANDARD)
    return renderToStaticMarkup(createElement(GruendungAusnehmenDialog, { hof: { id: h.id, name: h.name, aenderung }, onClose: () => {} }))
  }

  it('Hof mit Platz: die Folgen in Zahlen, die Hinweise und der Haken', () => {
    const html = render(2, [platzHof(1), platzHof(2), platzHof(3)])
    expect(html).toContain('Testhof B nicht als Gründungshof zählen?')
    expect(html).toContain('Testhof B verliert Platz Nr. 2')
    expect(html).toContain('Testhof C rückt auf Nr. 2.')
    expect(html).toContain(GRUENDUNG_AUSNEHMEN_TEXT.keineNachricht)
    expect(html).toContain('type="checkbox"')
    expect(html).toContain(GRUENDUNG_AUSNEHMEN_TEXT.haken)
  })

  it('Gegenprobe: ohne Platz und bei der Wiederaufnahme kein Haken', () => {
    expect(render(3, [platzHof(1), platzHof(2), platzHof(3)], 2)).not.toContain('type="checkbox"')
    const wieder = render(1, [platzHof(1, true), platzHof(2)])
    expect(wieder).toContain('Testhof A wieder als Gründungshof zählen?')
    expect(wieder).toContain('Testhof B: Nr. 1 → Nr. 2 – die Zusage bleibt.')
    expect(wieder).not.toContain('type="checkbox"')
  })
})

// MeldungListe ist seit Nr. 101 entfernt (ohne Aufrufer seit Nr. 95); dass Meldungstext Text bleibt, prüft tests/meldungen-fremdtext-wache.test.ts am Reiter „Meldungen“.

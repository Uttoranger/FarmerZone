/**
 * Admin › Geld (Register N32, N37; Nr. 191; Mockup admin-geld) — die Seite
 * gerendert wie auf dem Server, mit gemockten Abfragen. Geld wird nur
 * angezeigt: Jede Summe kommt aus src/lib/finanzen.ts. Beweist:
 *  - Kopf „Geld“ mit Monatswahl auf /admin/geld, fünf Kacheln (Umsatz der
 *    Höfe, Servicegebühr, Erstattungen, Kosten = Stripe + Betrieb, Ergebnis).
 *  - Abgleich: „stimmt“ ohne Abweichung, sonst die Zahl als Wort; ohne Lauf
 *    „noch kein Lauf“ — nie ein „stimmt“, das nicht geprüft ist.
 *  - Monatsabschluss: Prüfliste mit Wort je Punkt; der Knopf gesperrt mit
 *    Grund, solange etwas offen ist oder der Monat läuft; abgeschlossen mit Datum.
 *  - Kosten: die Zeile „Stripe-Gebühren“ über den Posten, Summe beider.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Die Plattformgebühr auf Geld (Nr. 198) hat eigene Tests (tests/plattformgebuehr-abrechnung.test.ts).
const plattformgebuehrGeld = vi.hoisted(() => vi.fn(async (): Promise<unknown> => null))
vi.mock('@/server/queries/plattformgebuehr', () => ({ ladePlattformgebuehrGeld: plattformgebuehrGeld }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => {
    const attribute = Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'onNavigate' && k !== 'prefetch'))
    return createElement('a', { href, ...attribute }, children)
  },
  useLinkStatus: () => ({ pending: false }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/geld',
}))
vi.mock('@/server/admin-wache', () => ({ verlangeAdminSeite: vi.fn(async () => 'admin_1'), verlangeFrischeBestaetigung: vi.fn(), frischOderBestaetigen: vi.fn(async () => null), adminPflichtOffen: vi.fn(async () => false) }))
vi.mock('@/server/actions/finanzen', () => ({
  kostenpostenAnlegen: vi.fn(),
  kostenpostenAendern: vi.fn(),
  kostenpostenBeenden: vi.fn(),
  kostenpostenLoeschen: vi.fn(),
  monatAbschliessen: vi.fn(),
}))
const abfragen = vi.hoisted(() => ({ getFinanzen: vi.fn(), ladeGeldMonat: vi.fn(), ladeAbgeschlosseneMonate: vi.fn() }))
vi.mock('@/server/queries/finanzen', () => ({ getFinanzen: abfragen.getFinanzen, aktuellerFinanzMonat: () => '2026-10' }))
vi.mock('@/server/queries/geld', () => ({ ladeGeldMonat: abfragen.ladeGeldMonat, ladeAbgeschlosseneMonate: abfragen.ladeAbgeschlosseneMonate }))

import AdminGeldPage from '@/app/admin/geld/page'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { formatEuro } from '@/lib/format'
import { ergebnisText } from '@/lib/finanzen'
import { GELD_TEXT } from '@/app/admin/geld/texte'
import type { FinanzenDaten } from '@/server/queries/finanzen'
import type { GeldMonat } from '@/server/queries/geld'

const JETZT = new Date('2026-10-15T10:00:00+02:00')
const NACH_MONATSENDE = new Date('2026-10-02T06:30:00Z')

function daten(ueber: Partial<FinanzenDaten> = {}): FinanzenDaten {
  return {
    monat: '2026-09',
    bezeichnung: 'September 2026',
    vorigerMonat: '2026-08',
    naechsterMonat: '2026-10',
    einnahmen: { eingezogenCents: 7240, geschuldetCents: 6120, erwartetCents: 500, provisionCents: 0, bestellungen: 40, offeneBestellungen: 2, gezaehltCents: 13360 },
    kosten: { cents: 4650, anzahl: 3 },
    posten: [{ id: 'p1', name: 'Hosting Beispiel', kategorie: 'HOSTING', betragCents: 2500, rhythmus: 'MONATLICH', ab: '2026-01', bis: null, notiz: null, imMonatCents: 2500 }],
    verlauf: [],
    schnittCents: 334,
    brauchtBestellungen: 41,
    testzahlungenHinweis: null,
    ...ueber,
  }
}

function geld(ueber: Partial<GeldMonat> = {}): GeldMonat {
  return {
    umsatz: { cents: 642_000, anzahl: 418, bar: 22 },
    erstattungen: { cents: 6420, anzahl: 5, offen: 0 },
    stripeGebuehrCents: 18_900,
    abweichungen: [],
    abweichungenGesamt: 0,
    lauf: { gestartetAm: NACH_MONATSENDE, beendetAm: NACH_MONATSENDE, ok: true, fehlerKlasse: null, dauerMs: 900 },
    abgeschlossenAm: null,
    abgleichNachMonatsende: true,
    csvGeladen: true,
    ...ueber,
  }
}

async function seite(suche: Record<string, string> = { monat: '2026-09' }): Promise<string> {
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  try {
    return renderToStaticMarkup(await AdminGeldPage({ searchParams: Promise.resolve(suche) }))
  } finally {
    vi.useRealTimers()
  }
}

/** Der Knopf „… abschließen …“ als Start-Tag. */
const knopf = (html: string): string => {
  const stelle = html.indexOf('September abschließen …')
  return stelle < 0 ? '' : html.slice(html.lastIndexOf('<button', stelle), stelle)
}

beforeEach(() => {
  abfragen.getFinanzen.mockResolvedValue(daten())
  abfragen.ladeGeldMonat.mockResolvedValue(geld())
  abfragen.ladeAbgeschlosseneMonate.mockResolvedValue(new Map())
})

describe('Admin › Geld', () => {
  it('Kopf „Geld“ mit dem Recht „Geld“, Monatswahl auf /admin/geld, Jahr als Umschalter', async () => {
    const html = await seite()
    expect(verlangeAdminSeite).toHaveBeenCalledWith({ recht: 'geld' })
    expect(html).toMatch(/<h1[^>]*>Geld<\/h1>/)
    expect(html).toContain('September 2026')
    expect(html).toContain('href="/admin/geld?monat=2026-08"')
    expect(html).toContain('href="/admin/geld?zeitraum=jahr&amp;jahr=2026"')
  })

  it('fünf Kacheln: Umsatz der Höfe, Servicegebühr, Erstattungen, Kosten (Stripe + Betrieb), Ergebnis — Beträge aus den Abfragen', async () => {
    const html = await seite()
    for (const titel of ['Umsatz der Höfe', 'Servicegebühr', 'Erstattungen', 'Kosten', 'Ergebnis']) expect(html).toContain(titel)
    expect(html).toContain(formatEuro(6420, 0))
    expect(html).toContain('418 Bestellungen · 22 bar')
    expect(html).toContain(formatEuro(133.6))
    // Kosten = 189,00 Stripe + 46,50 Betrieb = 235,50; Ergebnis 133,60 − 235,50 = −101,90.
    expect(html).toContain(formatEuro(235.5))
    expect(html).toContain(`Stripe-Gebühren ${formatEuro(189)} · Betrieb ${formatEuro(46.5)}`)
    expect(html).toContain(ergebnisText(-10_190))
    expect(html).toContain('noch nicht gedeckt')
  })

  it('Abgleich ohne Abweichung: „stimmt“ und „ok“; Stripe-Gebühren „gebucht“, trägt die Plattform', async () => {
    const html = await seite()
    expect(html).toContain('Abgleich mit Stripe')
    expect(html).toContain('Betrag, Servicegebühr und Erstattung gleich')
    expect(html).toContain('>stimmt<')
    expect(html).toContain(GELD_TEXT.stripeGebuehrTraeger)
  })

  it('Gegenprobe: mit Abweichung kein „stimmt“, sondern die Zahl; ohne Lauf „noch kein Lauf“', async () => {
    abfragen.ladeGeldMonat.mockResolvedValueOnce(
      geld({ abweichungen: [{ orderId: 'b1', orderNumber: 'HM-2609-A1B2', feld: 'betrag', differenzCents: 120, seit: NACH_MONATSENDE }], abgleichNachMonatsende: true })
    )
    const mit = await seite()
    expect(mit).toContain('1 Abweichung – steht in Heute')
    expect(mit).not.toContain('>stimmt<')
    abfragen.ladeGeldMonat.mockResolvedValueOnce(geld({ lauf: null, abgleichNachMonatsende: false }))
    const ohne = await seite()
    expect(ohne).toContain('noch kein Lauf')
    expect(ohne).toContain('Der Abgleich ist noch nicht gelaufen.')
    expect(ohne).not.toContain('>stimmt<')
  })

  it('Monatsabschluss: alles erledigt → Knopf frei, 4 von 4', async () => {
    const html = await seite()
    expect(html).toContain('Monatsabschluss September 2026')
    expect(html).toContain('4 von 4 erledigt')
    expect(knopf(html)).not.toContain('disabled=""')
    expect(html).toContain('CSV 2026 laden')
  })

  it('Gegenprobe: offene Erstattung und keine CSV → gesperrt mit Grund, die Punkte als Wort „offen“', async () => {
    abfragen.ladeGeldMonat.mockResolvedValueOnce(geld({ erstattungen: { cents: 6420, anzahl: 5, offen: 1 }, csvGeladen: false }))
    const html = await seite()
    expect(html).toContain('2 von 4 erledigt')
    expect(knopf(html)).toContain('disabled=""')
    expect(html).toContain('Geht erst, wenn alles erledigt ist: 1 Erstattung offen, die CSV ist nach dem Monatsende noch nicht geladen.')
    expect(html.match(/>offen</g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('der laufende Monat lässt sich nicht abschließen', async () => {
    abfragen.getFinanzen.mockResolvedValueOnce(daten({ monat: '2026-10', bezeichnung: 'Oktober 2026', naechsterMonat: null }))
    const html = await seite({})
    const stelle = html.indexOf('Oktober abschließen …')
    expect(html.slice(html.lastIndexOf('<button', stelle), stelle)).toContain('disabled=""')
    expect(html).toContain('Geht erst nach dem Monatsende.')
  })

  it('abgeschlossen: Datum statt Knopf, „nur mit Grund“; das Blatt fragt für abgeschlossene Monate nach dem Grund', async () => {
    abfragen.ladeGeldMonat.mockResolvedValueOnce(geld({ abgeschlossenAm: new Date('2026-10-03T09:00:00+02:00') }))
    const html = await seite()
    expect(html).toMatch(/abgeschlossen am Sa,\s3\.\sOkt/)
    expect(knopf(html)).toBe('')
    expect(html).toContain('Danach sind Kosten des Monats nur mit Grund änderbar.')
  })

  it('Kosten: die Zeile „Stripe-Gebühren“ aus dem Abgleich über den Posten, Summe beider', async () => {
    const html = await seite()
    expect(html).toContain('kommt automatisch aus dem Abgleich')
    expect(html).toContain('Hosting Beispiel')
    const summe = html.indexOf('Summe im Monat')
    expect(html.slice(summe, summe + 300)).toContain(formatEuro(235.5))
  })

  it('Plattformgebühr (Nr. 198): bar und online des Monats, offene, gescheiterte und zurückgebuchte Einzüge als Wort', async () => {
    plattformgebuehrGeld.mockResolvedValueOnce({ barCents: 342, onlineCents: 120, offen: 2, gescheitert: 1, zurueckgebucht: 0 })
    const h = (await seite()).replaceAll('\u00a0', ' ')
    expect(h).toContain('Plattformgebühr · Monatsabrechnung')
    expect(h).toContain('€ 3,42')
    expect(h).toContain('€ 1,20')
    expect(h).toContain('2 offen · 1 gescheitert · 0 zurückgebucht')
    // Gegenprobe: ohne Daten kein Abschnitt.
    expect(await seite()).not.toContain('Plattformgebühr · Monatsabrechnung')
  })

  it('Gegenprobe: scheitert eine Abfrage, steht der Ladefehler da', async () => {
    abfragen.ladeGeldMonat.mockRejectedValueOnce(new Error('Datenbank nicht erreichbar'))
    const html = await seite()
    expect(html).toContain('Wir konnten Geld gerade nicht laden.')
    expect(html).not.toContain('Geld in Zahlen')
  })
})

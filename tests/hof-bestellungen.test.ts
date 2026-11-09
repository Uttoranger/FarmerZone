/**
 * Bestellungen des Hofs (/orders, Nachtlauf Nr. 19) — Filter, Gruppen je
 * Abholfenster, Kopfzeile, Marken und angebotene Knöpfe (src/lib/hof-bestellungen.ts).
 * Zeit immer als Parameter, Tage in Wiener Zeit.
 *
 * Seit Nr. 45 (freigabe.md §12) genau drei Filter: „Heute abholen" (dieselben
 * Bestellungen wie die Packliste auf Heute), „Noch offen", „Erledigt".
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; [k: string]: unknown }) => {
    const attribute = { ...rest }
    delete attribute.prefetch
    delete attribute.onNavigate
    return createElement('a', { href, ...attribute }, children)
  },
  // Der Ladepunkt (Nr. 105/121) fragt den Zustand des Links — beim Rendern auf dem Server lädt nichts.
  useLinkStatus: () => ({ pending: false }),
}))
// Die Bestellung im Detail trägt den Kopf mit dem Rückweg (der Werkzeug-Kopf liest den Pfad).
vi.mock('next/navigation', () => ({
  usePathname: () => '/orders/order-1',
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  useSearchParams: () => new URLSearchParams(),
}))
// Die Liste bindet die Bestellung samt Dialogen ein; deren Aktionen schreiben — hier nie aufgerufen.
vi.mock('@/server/actions/orders', () => ({
  cancelOrder: vi.fn(),
  meldeArtikelFehlt: vi.fn(),
  markAsNotPickedUp: vi.fn(),
  markAsPickedUp: vi.fn(),
  markAsPickedUpAndPaid: vi.fn(),
  markAsReady: vi.fn(),
  revertOrderStatus: vi.fn(),
  revertPickedUp: vi.fn(),
  revertReady: vi.fn(),
}))

import {
  OFFEN_STATUS,
  abholTag,
  abholungKurz,
  bestellAktionen,
  bestellKopfzeile,
  bestellListeHref,
  bestellMarke,
  papierMarke,
  filterChips,
  fensterZeit,
  gruppiereNachAbholfenster,
  passtZumFilter,
  positionenText,
  vorname,
  zahlartText,
} from '@/lib/hof-bestellungen'
import { ABHOLUNG_ERLEDIGT, HEUTE_ABHOLEN, HEUTE_NIEMAND, hofWartetAufFreigabe } from '@/lib/heute'
import { HOF_BESTELL_FILTER_WERTE, hofBestellFilterAus } from '@/schemas/hof-bestellungen'
import { BESTELLUNGEN_LEER, BestellungenAnsicht } from '@/components/hof-bestellungen/bestellungen-ansicht'
import type { BestellungenSeite, HofBestellDetail } from '@/server/queries/orders'

// Dienstag, 6. Oktober 2026, 10:00 in Wien (UTC+2)
const JETZT = new Date('2026-10-06T08:00:00Z')
const HEUTE_MITTAG = new Date('2026-10-06T10:00:00Z')
const MORGEN_MITTAG = new Date('2026-10-07T10:00:00Z')
const SAMSTAG_MITTAG = new Date('2026-10-10T10:00:00Z')
const GESTERN_MITTAG = new Date('2026-10-05T10:00:00Z')

function b(id: string, status: string, pickupDate: Date, start = '15:00', ende = '18:00') {
  return { id, status, pickupDate, pickupTimeStart: start, pickupTimeEnd: ende }
}

const LISTE = [
  b('anna', 'CONFIRMED', HEUTE_MITTAG),
  b('thomas', 'READY', HEUTE_MITTAG),
  b('lena', 'PENDING_CONFIRMATION', HEUTE_MITTAG),
  b('markus', 'PAID', SAMSTAG_MITTAG, '09:00', '12:00'),
  b('eva', 'PICKED_UP', GESTERN_MITTAG),
  b('otto', 'CANCELLED', MORGEN_MITTAG),
]

const ALLE_STATUS = [
  'PENDING_CONFIRMATION',
  'PAID',
  'CONFIRMED',
  'IN_PREPARATION',
  'READY',
  'PICKED_UP',
  'CANCELLED',
  'NOT_PICKED_UP',
] as const

describe('passtZumFilter — genau drei Filter (freigabe.md §12 Nr. 45)', () => {
  const ids = (liste: typeof LISTE, f: 'heute' | 'offen' | 'erledigt') => liste.filter((x) => passtZumFilter(x, f, JETZT)).map((x) => x.id)

  it('„Heute abholen": Abholtag heute in Wien und noch nicht erledigt — auch „wartet auf Kunde", wie die Packliste', () => {
    const heute = [
      ...LISTE,
      b('paul', 'PICKED_UP', HEUTE_MITTAG),
      b('rita', 'CANCELLED', HEUTE_MITTAG),
      b('sepp', 'NOT_PICKED_UP', HEUTE_MITTAG),
    ]
    expect(ids(heute, 'heute')).toEqual(['anna', 'thomas', 'lena'])
  })

  it('„Heute abholen" um 0:30 Uhr Wiener Zeit ist schon der neue Tag — gerechnet beim Lesen, nicht vom Cron', () => {
    const kurzNachMitternacht = new Date('2026-10-06T22:30:00Z') // 7. Oktober, 0:30 in Wien
    expect(passtZumFilter(b('x', 'PAID', MORGEN_MITTAG), 'heute', kurzNachMitternacht)).toBe(true)
    expect(passtZumFilter(b('y', 'PAID', HEUTE_MITTAG), 'heute', kurzNachMitternacht)).toBe(false)
  })

  it('„Noch offen": alles, was noch nicht übergeben, storniert oder als nicht abgeholt markiert ist — jeder Tag, auch überfällige', () => {
    const mitUeberfaellig = [...LISTE, b('ueber', 'READY', GESTERN_MITTAG)]
    expect(ids(mitUeberfaellig, 'offen')).toEqual(['anna', 'thomas', 'lena', 'markus', 'ueber'])
  })

  it('„Erledigt": abgeholt, storniert, nicht abgeholt', () => {
    expect(ids(LISTE, 'erledigt')).toEqual(['eva', 'otto'])
  })

  it('jeder Status ist genau „noch offen" oder „erledigt"; „Heute abholen" ist dieselbe Bedingung wie die Packliste (abholWhere)', () => {
    for (const status of ALLE_STATUS) {
      const heute = b('x', status, HEUTE_MITTAG)
      expect(Number(passtZumFilter(heute, 'offen', JETZT)) + Number(passtZumFilter(heute, 'erledigt', JETZT)), status).toBe(1)
      expect(passtZumFilter(heute, 'heute', JETZT), status).toBe(!(ABHOLUNG_ERLEDIGT as readonly string[]).includes(status))
      expect(passtZumFilter(b('y', status, MORGEN_MITTAG), 'heute', JETZT), status).toBe(false)
    }
    expect([...OFFEN_STATUS].sort()).toEqual(ALLE_STATUS.filter((s) => !(ABHOLUNG_ERLEDIGT as readonly string[]).includes(s)).sort())
  })
})

describe('filterChips und Kopfzeile', () => {
  it('genau drei Filter in fester Reihenfolge, gezählt, wo es bei der Arbeit hilft', () => {
    expect(HOF_BESTELL_FILTER_WERTE).toEqual(['heute', 'offen', 'erledigt'])
    expect(filterChips(LISTE, JETZT)).toEqual([
      { filter: 'heute', text: 'Heute abholen · 3' },
      { filter: 'offen', text: 'Noch offen · 4' },
      { filter: 'erledigt', text: 'Erledigt' },
    ])
    // Dasselbe Wort wie die Kennzahl auf Heute.
    expect(filterChips(LISTE, JETZT)[0].text.startsWith(HEUTE_ABHOLEN)).toBe(true)
  })

  it('Adressen: der Standard „Noch offen" ohne Parameter, die anderen mit', () => {
    expect(bestellListeHref('offen')).toBe('/orders')
    expect(bestellListeHref('heute')).toBe('/orders?filter=heute')
    expect(bestellListeHref('erledigt')).toBe('/orders?filter=erledigt')
  })

  it('„4 offen, davon 1 gepackt" (Board s1-bestellungen) — ohne Gepacktes nur „n offen"', () => {
    expect(bestellKopfzeile(LISTE)).toBe('4 offen, davon 1 gepackt')
    expect(bestellKopfzeile(LISTE.filter((x) => x.status !== 'READY'))).toBe('3 offen')
  })
})

describe('gruppiereNachAbholfenster', () => {
  it('offen: je Tag und Fenster, früh nach spät, mit Zahl', () => {
    const gruppen = gruppiereNachAbholfenster(LISTE, 'offen', JETZT)
    expect(gruppen.map((g) => [g.titel, g.bestellungen.map((x) => x.id)])).toEqual([
      // Im selben Fenster fest nach Kennung — eine Zeile springt nicht nach jedem Speichern.
      // Tag mit Wochentag und Datum (V9), die Zahl ohne Wort (Board s1-bestellungen).
      ['Heute, Di 6.\u00a0Okt, 15–18 Uhr · 3', ['anna', 'lena', 'thomas']],
      ['Sa, 10.\u00a0Okt, 9–12 Uhr · 1', ['markus']],
    ])
  })

  it('zwei Fenster am selben Tag sind zwei Gruppen', () => {
    const gruppen = gruppiereNachAbholfenster(
      [b('a', 'PAID', HEUTE_MITTAG, '15:00', '18:00'), b('b', 'PAID', HEUTE_MITTAG, '09:30', '12:00')],
      'offen',
      JETZT
    )
    expect(gruppen.map((g) => g.titel)).toEqual(['Heute, Di 6.\u00a0Okt, 9:30–12 Uhr · 1', 'Heute, Di 6.\u00a0Okt, 15–18 Uhr · 1'])
  })

  it('erledigt: neu nach alt', () => {
    const gruppen = gruppiereNachAbholfenster(LISTE, 'erledigt', JETZT)
    expect(gruppen.map((g) => g.titel)).toEqual(['Morgen, Mi 7.\u00a0Okt, 15–18 Uhr · 1', 'Gestern, Mo 5.\u00a0Okt, 15–18 Uhr · 1'])
  })

  it('leer bleibt leer', () => {
    expect(gruppiereNachAbholfenster([], 'offen', JETZT)).toEqual([])
  })
})

describe('Kleinigkeiten der Anzeige', () => {
  it('fensterZeit in der Schreibweise der Hofseite', () => {
    expect(fensterZeit('15:00', '18:00')).toBe('15–18 Uhr')
    expect(fensterZeit('09:30', '12:00')).toBe('9:30–12 Uhr')
  })

  it('abholTag: Heute, Morgen, Gestern, Wochentag', () => {
    expect(abholTag(HEUTE_MITTAG, JETZT)).toBe('Heute')
    expect(abholTag(MORGEN_MITTAG, JETZT)).toBe('Morgen')
    expect(abholTag(GESTERN_MITTAG, JETZT)).toBe('Gestern')
    expect(abholTag(SAMSTAG_MITTAG, JETZT)).toBe('Samstag')
  })

  it('abholungKurz: mit Wochentag und Datum (V9), „heute" klein, Wochentage groß', () => {
    expect(abholungKurz(HEUTE_MITTAG, '15:00', '18:00', JETZT)).toBe('heute, Di 6.\u00a0Okt, 15–18 Uhr')
    expect(abholungKurz(MORGEN_MITTAG, '15:00', '18:00', JETZT)).toBe('morgen, Mi 7.\u00a0Okt, 15–18 Uhr')
    expect(abholungKurz(SAMSTAG_MITTAG, '09:00', '12:00', JETZT)).toBe('Sa, 10.\u00a0Okt, 9–12 Uhr')
  })

  it('Marken (Register G5): zum Packen tun, gepackt läuft, wartend und abgeschlossen erledigt, storniert abgebrochen', () => {
    expect(bestellMarke('CONFIRMED')).toEqual({ text: 'Zum Packen', art: 'tun' })
    expect(bestellMarke('READY')).toEqual({ text: 'Gepackt', art: 'laeuft' })
    // V22: am Bildschirm „Bestätigung offen" (orange), auf Packliste und Papier „Wartet auf Kunde".
    expect(bestellMarke('PENDING_CONFIRMATION')).toEqual({ text: 'Bestätigung offen', art: 'tun' })
    expect(papierMarke('PENDING_CONFIRMATION')).toEqual({ text: 'Wartet auf Kunde', art: 'erledigt' })
    expect(papierMarke('CONFIRMED')).toEqual({ text: 'Zum Packen', art: 'tun' })
    expect(papierMarke('PICKED_UP')).toEqual({ text: 'Abgeholt', art: 'erledigt' })
    expect(bestellMarke('PICKED_UP')).toEqual({ text: 'Abgeholt', art: 'erledigt' })
    // Freigabe Lauf 13 (Nr. 85): Storniert rot, Nicht abgeholt erledigt — vorher beide grau (neutral).
    expect(bestellMarke('CANCELLED')).toEqual({ text: 'Storniert', art: 'abgebrochen' })
    expect(bestellMarke('NOT_PICKED_UP')).toEqual({ text: 'Nicht abgeholt', art: 'erledigt' })
  })

  it('zahlartText sagt nie pauschal „bezahlt"', () => {
    expect(zahlartText('ONLINE', 'PAID')).toBe('Online bezahlt')
    expect(zahlartText('ONLINE', 'PENDING')).toBe('Online, noch offen')
    expect(zahlartText('ONLINE', 'REFUNDED')).toBe('Online, erstattet')
    expect(zahlartText('ONSITE_CASH', 'PENDING')).toBe('Bar bei Abholung')
    expect(zahlartText('ONSITE_CARD', 'PENDING')).toBe('Karte bei Abholung')
  })

  it('positionenText trennt mit Punkt (Namen tragen Kommas), der Rest als Zahl', () => {
    const items = [
      { productName: 'Eier, 10 Stück', quantity: 1 },
      { productName: 'Brot', quantity: 2 },
      { productName: 'Honig', quantity: 1 },
      { productName: 'Käse', quantity: 1 },
    ]
    expect(positionenText(items)).toBe('1× Eier, 10 Stück · 2× Brot · 1× Honig +1')
    expect(positionenText([])).toBe('')
  })

  it('vorname: erster Teil, sonst „Die Kundin"', () => {
    expect(vorname('Anna Beispiel')).toBe('Anna')
    expect(vorname('   ')).toBe('Die Kundin')
    expect(vorname('A'.repeat(80))).toBe('Die Kundin')
  })

  it('ein unbekannter oder alter Filter in der Adresse fällt still auf „Noch offen"', () => {
    expect(hofBestellFilterAus(undefined)).toBe('offen')
    expect(hofBestellFilterAus('quatsch')).toBe('offen')
    // Lesezeichen von vor Nr. 45: Zum Packen, Gepackt und Alle gibt es nicht mehr.
    for (const alt of ['packen', 'gepackt', 'alle']) expect(hofBestellFilterAus(alt)).toBe('offen')
    expect(hofBestellFilterAus(['erledigt', 'heute'])).toBe('erledigt')
  })
})

describe('bestellAktionen — dieselben Status wie die Sperren der Aktionen', () => {
  const mit = (status: string, paymentMethod = 'ONSITE_CASH', offenePositionen = 2) =>
    bestellAktionen({ status, paymentMethod, offenePositionen })

  it('zum Packen: packen, Artikel fehlt, nicht abgeholt, stornieren', () => {
    expect(mit('CONFIRMED')).toEqual({
      packen: true,
      abgeholt: false,
      abgeholtBezahlt: false,
      artikelFehlt: true,
      nichtAbgeholt: true,
      stornieren: true,
      dochNichtGepackt: false,
      abholungZurueck: false,
    })
  })

  it('gepackt: online „Abgeholt", vor Ort „Abgeholt und bezahlt", dazu „Doch nicht gepackt"', () => {
    expect(mit('READY', 'ONLINE')).toMatchObject({ packen: false, abgeholt: true, abgeholtBezahlt: false, dochNichtGepackt: true })
    expect(mit('READY')).toMatchObject({ abgeholt: false, abgeholtBezahlt: true })
  })

  it('wartet auf Kunde: nur stornieren', () => {
    expect(mit('PENDING_CONFIRMATION')).toMatchObject({ packen: false, artikelFehlt: false, nichtAbgeholt: false, stornieren: true })
  })

  it('abgeholt: nur „Abholung rückgängig"; storniert und nicht abgeholt: nichts', () => {
    expect(Object.entries(mit('PICKED_UP')).filter(([, v]) => v).map(([k]) => k)).toEqual(['abholungZurueck'])
    expect(Object.values(mit('CANCELLED')).some(Boolean)).toBe(false)
    expect(Object.values(mit('NOT_PICKED_UP')).some(Boolean)).toBe(false)
  })

  it('ohne offene Positionen kein „Artikel fehlt"', () => {
    expect(mit('CONFIRMED', 'ONSITE_CASH', 0).artikelFehlt).toBe(false)
  })
})

// ─── Ansicht ────────────────────────────────────────────────────────────────

describe('Ansicht /orders — die Filterreihe', () => {
  const seite = (teil: Partial<BestellungenSeite> = {}): BestellungenSeite => ({
    kopfzeile: '4 offen · 1 gepackt',
    chips: filterChips(LISTE, JETZT),
    gruppen: [],
    hatBestellungen: true,
    ...teil,
  })
  const filterLinks = (html: string) => {
    const reihe = html.slice(html.indexOf('Bestellungen filtern'))
    return [...reihe.slice(0, reihe.indexOf('</ul>')).matchAll(/<a href="([^"]*)"/g)].map((t) => t[1])
  }

  it('zeigt genau die drei Filter als Links, der gewählte trägt aria-current', () => {
    const html = renderToStaticMarkup(createElement(BestellungenAnsicht, { seite: seite(), filter: 'heute', detail: null, modus: 'liste', hofName: 'Hof Test' }))
    expect(filterLinks(html)).toEqual(['/orders?filter=heute', '/orders', '/orders?filter=erledigt'])
    expect(html).toMatch(/<a href="\/orders\?filter=heute"[^>]*aria-current="page"/)
    for (const alt of ['Zum Packen ·', 'Gepackt ·', '>Alle<']) expect(html).not.toContain(alt)
  })

  it('leer bei „Heute abholen": derselbe Satz wie die Packliste, Ausweg zu den noch offenen', () => {
    const html = renderToStaticMarkup(createElement(BestellungenAnsicht, { seite: seite(), filter: 'heute', detail: null, modus: 'liste', hofName: 'Hof Test' }))
    expect(html).toContain(HEUTE_NIEMAND)
    expect(html).toMatch(/<a href="\/orders"[^>]*>Noch offene ansehen</)
  })

  it('leer bei „Heute abholen" mit Abholzeit: die Karte der Packliste mit der nächsten Abholung samt Zahl, ohne Knopf (Board s1-bestellungen, Bild 2)', () => {
    const satz = 'Nächste Abholung: Sa, 10.\u00a0Okt, 9–12 Uhr · 2 Bestellungen'
    const html = renderToStaticMarkup(
      createElement(BestellungenAnsicht, { seite: seite(), filter: 'heute', detail: null, modus: 'liste', hofName: 'Hof Test', naechsteAbholung: satz })
    )
    expect(html).toContain(HEUTE_NIEMAND)
    expect(html).toContain(satz)
    expect(html).not.toContain('Noch offene ansehen')
  })

  it('ohne Bestellungen steht der Hofname unter der Überschrift, kein Druckknopf (Board s1-bestellungen, Bild 3)', () => {
    const html = renderToStaticMarkup(
      createElement(BestellungenAnsicht, { seite: seite({ hatBestellungen: false, kopfzeile: '0 offen' }), filter: 'offen', detail: null, modus: 'liste', hofName: 'Hof Test' })
    )
    expect(html).toContain('Hof Test')
    expect(html).not.toContain('0 offen')
    expect(html).not.toContain('Packliste für heute drucken')
    // Gegenprobe: mit Bestellungen die Kopfzeile und der Druckknopf.
    const voll = renderToStaticMarkup(createElement(BestellungenAnsicht, { seite: seite(), filter: 'offen', detail: null, modus: 'liste', hofName: 'Hof Test' }))
    expect(voll).toContain('4 offen · 1 gepackt')
    expect(voll).toContain('Packliste für heute drucken')
  })

  it('noch nie eine Bestellung: der Satz je Stand — wartend der Textlink „Was bis zur Freischaltung noch fehlt →“ (Board s1-bestellungen Bild 3)', () => {
    const leer = seite({ hatBestellungen: false, kopfzeile: '0 offen' })
    const wartet = renderToStaticMarkup(createElement(BestellungenAnsicht, { seite: leer, filter: 'offen', detail: null, modus: 'liste', hofName: 'Hof Test', wartetAufFreigabe: true }))
    expect(wartet).toContain(BESTELLUNGEN_LEER.wartet.satz)
    expect(wartet).toMatch(/<a href="\/onboarding"[^>]*>Was bis zur Freischaltung noch fehlt →<\/a>/)
    expect(wartet).not.toContain('Zu Mein Hof')
    // Gegenprobe: freigeschaltet der Weg zu Mein Hof.
    const frei = renderToStaticMarkup(createElement(BestellungenAnsicht, { seite: leer, filter: 'offen', detail: null, modus: 'liste', hofName: 'Hof Test' }))
    expect(frei).toContain(BESTELLUNGEN_LEER.frei.satz)
    expect(frei).toContain('href="/farm-page"')
    // Der Kopf ist der Werkzeug-Kopf (G1): der Balken (G3) steht darunter.
    expect(frei).toContain('data-werkzeug-kopf')
  })

  it('wartet auf Freigabe nur ein nicht freigeschalteter, nicht stillgelegter Hof', () => {
    const zeit = new Date('2026-01-01T00:00:00Z')
    expect(hofWartetAufFreigabe({ approvedAt: null, archivedAt: null })).toBe(true)
    expect(hofWartetAufFreigabe({ approvedAt: zeit, archivedAt: null })).toBe(false)
    // Gegenprobe stillgelegt: kein „Sobald dein Hof freigeschaltet ist …“.
    expect(hofWartetAufFreigabe({ approvedAt: null, archivedAt: zeit })).toBe(false)
    expect(hofWartetAufFreigabe(null)).toBe(false)
  })

  it('leer bei „Noch offen": „Alles erledigt" mit Weg zu den erledigten; nie ein Link auf ?filter=alle', () => {
    const html = renderToStaticMarkup(createElement(BestellungenAnsicht, { seite: seite(), filter: 'offen', detail: null, modus: 'liste', hofName: 'Hof Test' }))
    expect(html).toContain('Alles erledigt')
    expect(html).toContain('href="/orders?filter=erledigt"')
    const erledigt = renderToStaticMarkup(createElement(BestellungenAnsicht, { seite: seite(), filter: 'erledigt', detail: null, modus: 'liste', hofName: 'Hof Test' }))
    expect(erledigt).toContain('Noch nichts erledigt')
    expect(html + erledigt).not.toContain('filter=alle')
  })
})

// ─── Die Nummer der Kundin (Nr. 81, N8) ─────────────────────────────────────

describe('Bestellung im Detail: die Nummer der Kundin', () => {
  const bestellung = (telefon: string): HofBestellDetail => ({
    id: 'order-1',
    nummer: 'HT-0210-A4F2',
    status: 'CONFIRMED',
    marke: { text: 'Bestätigt', art: 'tun' },
    abholung: 'heute, 15–18 Uhr',
    bestelltAm: '6. Okt, 9:00',
    kunde: { name: 'Erika Beispiel', vorname: 'Erika', email: 'erika@example.com', telefon, notiz: null },
    zahlart: 'Bar bei Abholung',
    vorOrt: true,
    bezahltAm: null,
    betrag: { warenCents: 1000, gebuehrCents: 0, gesamtCents: 1000, erstattetCents: 0, gebuehrEntfallen: false, gebuehrErstattungOffen: false, gebuehrFuerAbrechnung: false, hofpreis: false },
    positionen: [],
    storno: null,
    stornoGrund: null,
    aktionen: bestellAktionen({ status: 'CONFIRMED', paymentMethod: 'ONSITE_CASH', offenePositionen: 0 }),
    erinnernUrl: null,
  })
  const ansicht = (telefon: string): string =>
    renderToStaticMarkup(
      createElement(BestellungenAnsicht, {
        seite: { kopfzeile: '1 offen', chips: filterChips(LISTE, JETZT), gruppen: [], hatBestellungen: true },
        filter: 'offen',
        detail: bestellung(telefon),
        modus: 'detail',
        hofName: 'Hof Test',
      })
    )

  it('der Anrufen-Knopf im Kopf wählt die Nummer mit +43; die Karte „Kundin“ zeigt sie einheitlich und verlinkt sie ebenso', () => {
    const html = ansicht('0660 0000000')
    expect(html).toContain('aria-label="Erika Beispiel anrufen"')
    expect(html).toContain('href="tel:+436600000000"')
    const karte = html.slice(html.indexOf('id="kundin-order-1"'))
    expect(karte).toContain('+43 660 000 0000')
    expect(karte).toContain('href="tel:+436600000000"')
    expect(html).not.toContain('0660 0000000')
  })

  it('Liste Lauf 32 (bestellung): Werkzeug-Kopf mit Unterzeile, Mengen fett voran (G14), „· bar, bezahlt wird bei Abholung“, Geldsatz statt betragSatz', () => {
    const detail: HofBestellDetail = {
      ...bestellung('0660 0000000'),
      zahlungBeiAbholung: 'bar, bezahlt wird bei Abholung',
      positionen: [
        {
          id: 'p1',
          zeile: 'Heumilch frisch · 1 L',
          teile: { anzahl: '4', name: 'Heumilch frisch', gebinde: '1 L', text: '4 × Heumilch frisch (1 L)' },
          betragCents: 596,
          fehlt: false,
          fehltVorschau: { art: 'fehlt' } as unknown as HofBestellDetail['positionen'][number]['fehltVorschau'],
        },
      ],
    }
    const html = renderToStaticMarkup(
      createElement(BestellungenAnsicht, {
        seite: null,
        filter: 'offen',
        detail,
        modus: 'detail',
        hofName: 'Hof Test',
        geldsatz: 'Du bekommst die vollen € 10,00 – bis 31. Jänner 2028 zahlst du auf Barverkäufe keine Plattformgebühr.',
      })
    ).replaceAll('<!-- -->', '')
    expect(html).toContain('data-werkzeug-kopf')
    expect(html).toMatch(/<h1[^>]*>Bestellung HT-0210-A4F2<\/h1>/)
    expect(html).toContain('>Bestellungen</p>')
    expect(html).toContain('<span class="font-bold">4</span> × Heumilch frisch (1 L)')
    expect(html).toContain(' · bar, bezahlt wird bei Abholung')
    expect(html).toContain('bis 31. Jänner 2028 zahlst du auf Barverkäufe keine Plattformgebühr.')
    expect(html).not.toContain('auf diese Barbestellung zahlst du')
    // Nr. 249b: linksbündig neben der Seitenleiste 896 px Inhalt plus Rand — bei 1440 px endet er wie im Board
    // bei x ≈ 1200 (max-w 1200 mit mx-auto wirkte neben der 264-px-Leiste nicht); die feste Leiste ebenso.
    expect(html.match(/max-w-\[976px\]/g)?.length).toBe(2)
    expect(html).not.toContain('mx-auto w-full max-w-[976px]')
  })

  it('abgeholt: „· abgeholt um 16:05“, „Packliste · n von n“ und „Abholung rückgängig“ als Textknopf, nicht orange gefüllt', () => {
    const abgeholt: HofBestellDetail = {
      ...bestellung('0660 0000000'),
      status: 'PICKED_UP',
      marke: { text: 'Abgeholt', art: 'laeuft' },
      abgeholtUm: '16:05',
      positionen: [
        { id: 'p1', zeile: 'Eier', betragCents: 300, fehlt: false, fehltVorschau: {} as HofBestellDetail['positionen'][number]['fehltVorschau'] },
        { id: 'p2', zeile: 'Milch', betragCents: 200, fehlt: false, fehltVorschau: {} as HofBestellDetail['positionen'][number]['fehltVorschau'] },
      ],
      aktionen: bestellAktionen({ status: 'PICKED_UP', paymentMethod: 'ONSITE_CASH', offenePositionen: 2 }),
    }
    const html = renderToStaticMarkup(createElement(BestellungenAnsicht, { seite: null, filter: 'offen', detail: abgeholt, modus: 'detail', hofName: 'Hof Test' })).replaceAll(
      '<!-- -->',
      ''
    )
    expect(html).toContain(' · abgeholt um 16:05')
    expect(html).toContain('· 2 von 2')
    const knopf = html.match(/<button[^>]*>Abholung rückgängig<\/button>/)?.[0] ?? ''
    expect(knopf).not.toBe('')
    // Nr. 249b: in Textfarbe wie im Board w1-bestellung Bild 4, nicht orange.
    expect(knopf).toContain('text-foreground')
    expect(knopf).not.toContain('text-status-offen')
    expect(knopf).not.toContain('bg-primary')
    expect(html).toContain('data-art="laeuft"')
  })

  it('eine Nummer, die sich nicht lesen lässt, steht als Text da: kein Anrufen-Link, die Eingabe der Kundin bleibt für den Hof zu lesen (N8)', () => {
    // Das Checkout-Schema lässt jeden Text von 4 bis TELEFON_MAX Zeichen zu — auch zwei Nummern oder „keine Angabe“.
    for (const eingabe of ['0660 0000000 / 0664 0000000', '0660 0000000 ab 18 Uhr', 'keine Angabe']) {
      const html = ansicht(eingabe)
      expect(html, eingabe).not.toContain('href="tel:')
      expect(html, eingabe).not.toContain('anrufen"')
      expect(html.slice(html.indexOf('id="kundin-order-1"')), eingabe).toContain(eingabe)
    }
  })
})

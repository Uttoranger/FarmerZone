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
  filterChips,
  fensterZeit,
  gruppiereNachAbholfenster,
  passtZumFilter,
  positionenText,
  vorname,
  zahlartText,
} from '@/lib/hof-bestellungen'
import { ABHOLUNG_ERLEDIGT, HEUTE_ABHOLEN, HEUTE_NIEMAND } from '@/lib/heute'
import { HOF_BESTELL_FILTER_WERTE, hofBestellFilterAus } from '@/schemas/hof-bestellungen'
import { BestellungenAnsicht } from '@/components/hof-bestellungen/bestellungen-ansicht'
import type { BestellungenSeite } from '@/server/queries/orders'

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

  it('„4 offen · 1 gepackt"', () => {
    expect(bestellKopfzeile(LISTE)).toBe('4 offen · 1 gepackt')
  })
})

describe('gruppiereNachAbholfenster', () => {
  it('offen: je Tag und Fenster, früh nach spät, mit Zahl', () => {
    const gruppen = gruppiereNachAbholfenster(LISTE, 'offen', JETZT)
    expect(gruppen.map((g) => [g.titel, g.bestellungen.map((x) => x.id)])).toEqual([
      // Im selben Fenster fest nach Kennung — eine Zeile springt nicht nach jedem Speichern.
      ['Heute, 15–18 Uhr · 3 Bestellungen', ['anna', 'lena', 'thomas']],
      ['Samstag, 9–12 Uhr · 1 Bestellung', ['markus']],
    ])
  })

  it('zwei Fenster am selben Tag sind zwei Gruppen', () => {
    const gruppen = gruppiereNachAbholfenster(
      [b('a', 'PAID', HEUTE_MITTAG, '15:00', '18:00'), b('b', 'PAID', HEUTE_MITTAG, '09:30', '12:00')],
      'offen',
      JETZT
    )
    expect(gruppen.map((g) => g.titel)).toEqual(['Heute, 9:30–12 Uhr · 1 Bestellung', 'Heute, 15–18 Uhr · 1 Bestellung'])
  })

  it('erledigt: neu nach alt', () => {
    const gruppen = gruppiereNachAbholfenster(LISTE, 'erledigt', JETZT)
    expect(gruppen.map((g) => g.titel)).toEqual(['Morgen, 15–18 Uhr · 1 Bestellung', 'Gestern, 15–18 Uhr · 1 Bestellung'])
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

  it('abholungKurz: „heute" klein, Wochentage groß', () => {
    expect(abholungKurz(HEUTE_MITTAG, '15:00', '18:00', JETZT)).toBe('heute, 15–18 Uhr')
    expect(abholungKurz(SAMSTAG_MITTAG, '09:00', '12:00', JETZT)).toBe('Samstag, 9–12 Uhr')
  })

  it('Marken: zum Packen orange, gepackt grün, wartet und Erledigtes neutral', () => {
    expect(bestellMarke('CONFIRMED')).toEqual({ text: 'Zum Packen', ton: 'offen' })
    expect(bestellMarke('READY')).toEqual({ text: 'Gepackt', ton: 'fertig' })
    expect(bestellMarke('PENDING_CONFIRMATION')).toEqual({ text: 'Wartet auf Kunde', ton: 'neutral' })
    expect(bestellMarke('PICKED_UP')).toEqual({ text: 'Abgeholt', ton: 'neutral' })
    expect(bestellMarke('CANCELLED')).toEqual({ text: 'Storniert', ton: 'neutral' })
    expect(bestellMarke('NOT_PICKED_UP')).toEqual({ text: 'Nicht abgeholt', ton: 'neutral' })
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
    const html = renderToStaticMarkup(createElement(BestellungenAnsicht, { seite: seite(), filter: 'heute', detail: null, modus: 'liste' }))
    expect(filterLinks(html)).toEqual(['/orders?filter=heute', '/orders', '/orders?filter=erledigt'])
    expect(html).toMatch(/<a href="\/orders\?filter=heute"[^>]*aria-current="page"/)
    for (const alt of ['Zum Packen ·', 'Gepackt ·', '>Alle<']) expect(html).not.toContain(alt)
  })

  it('leer bei „Heute abholen": derselbe Satz wie die Packliste, Ausweg zu den noch offenen', () => {
    const html = renderToStaticMarkup(createElement(BestellungenAnsicht, { seite: seite(), filter: 'heute', detail: null, modus: 'liste' }))
    expect(html).toContain(HEUTE_NIEMAND)
    expect(html).toMatch(/<a href="\/orders"[^>]*>Noch offene ansehen</)
  })

  it('leer bei „Noch offen": „Alles erledigt" mit Weg zu den erledigten; nie ein Link auf ?filter=alle', () => {
    const html = renderToStaticMarkup(createElement(BestellungenAnsicht, { seite: seite(), filter: 'offen', detail: null, modus: 'liste' }))
    expect(html).toContain('Alles erledigt')
    expect(html).toContain('href="/orders?filter=erledigt"')
    const erledigt = renderToStaticMarkup(createElement(BestellungenAnsicht, { seite: seite(), filter: 'erledigt', detail: null, modus: 'liste' }))
    expect(erledigt).toContain('Noch nichts erledigt')
    expect(html + erledigt).not.toContain('filter=alle')
  })
})

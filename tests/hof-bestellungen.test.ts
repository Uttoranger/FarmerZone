/**
 * Bestellungen des Hofs (/orders, Nachtlauf Nr. 19) — Filter, Gruppen je
 * Abholfenster, Kopfzeile, Marken und angebotene Knöpfe (src/lib/hof-bestellungen.ts).
 * Zeit immer als Parameter, Tage in Wiener Zeit.
 */
import { describe, it, expect } from 'vitest'
import {
  abholTag,
  abholungKurz,
  bestellAktionen,
  bestellKopfzeile,
  bestellMarke,
  filterChips,
  fensterZeit,
  gruppiereNachAbholfenster,
  passtZumFilter,
  positionenText,
  vorname,
  zahlartText,
} from '@/lib/hof-bestellungen'
import { hofBestellFilterAus } from '@/schemas/hof-bestellungen'

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

describe('passtZumFilter', () => {
  it('offen: alles, was noch nicht übergeben oder storniert ist — auch „wartet auf Kunde"', () => {
    expect(LISTE.filter((x) => passtZumFilter(x, 'offen', JETZT)).map((x) => x.id)).toEqual(['anna', 'thomas', 'lena', 'markus'])
  })

  it('heute: der Wiener Kalendertag, egal in welchem Status', () => {
    expect(LISTE.filter((x) => passtZumFilter(x, 'heute', JETZT)).map((x) => x.id)).toEqual(['anna', 'thomas', 'lena'])
  })

  it('heute um 0:30 Uhr Wiener Zeit ist schon der neue Tag', () => {
    const kurzNachMitternacht = new Date('2026-10-06T22:30:00Z') // 7. Oktober, 0:30 in Wien
    expect(passtZumFilter(b('x', 'PAID', MORGEN_MITTAG), 'heute', kurzNachMitternacht)).toBe(true)
  })

  it('zum Packen, gepackt, erledigt', () => {
    const ids = (f: 'packen' | 'gepackt' | 'erledigt') => LISTE.filter((x) => passtZumFilter(x, f, JETZT)).map((x) => x.id)
    expect(ids('packen')).toEqual(['anna', 'markus'])
    expect(ids('gepackt')).toEqual(['thomas'])
    expect(ids('erledigt')).toEqual(['eva', 'otto'])
  })
})

describe('filterChips und Kopfzeile', () => {
  it('zählt, was bei der Arbeit hilft', () => {
    expect(filterChips(LISTE, JETZT)).toEqual([
      { filter: 'offen', text: 'Offen · 4' },
      { filter: 'heute', text: 'Heute · 3' },
      { filter: 'packen', text: 'Zum Packen · 2' },
      { filter: 'gepackt', text: 'Gepackt · 1' },
      { filter: 'erledigt', text: 'Erledigt' },
      { filter: 'alle', text: 'Alle' },
    ])
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

  it('ein unbekannter Filter in der Adresse fällt still auf „offen"', () => {
    expect(hofBestellFilterAus(undefined)).toBe('offen')
    expect(hofBestellFilterAus('quatsch')).toBe('offen')
    expect(hofBestellFilterAus(['gepackt', 'alle'])).toBe('gepackt')
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

/**
 * Admin › Höfe im Regelbetrieb (Register N32; Nachtlauf Nr. 187) — die reinen
 * Regeln der Liste.
 *
 * Beweist:
 *  - der Zustand in einem Wort, mit der Reihenfolge Geschlossen › Stillgelegt ›
 *    Testhof › Wartet › Gesperrt › Pausiert › Verkauft;
 *  - die Signale (wartet, Stripe fehlt, ohne Abholzeit, 14 Tage ohne
 *    Bestellung) mit Gegenproben; Testhöfe, Pausierte und Gesperrte haben keine;
 *  - „Braucht Blick“ zeigt nur Höfe mit Signal (Freigabe 187, Test 1), die
 *    Zahlen je Filter, Suche über Name, Adresse und Ort;
 *  - Sortierung: Wartende zuerst (am längsten wartend oben), dann mit Signal;
 *  - die Adresse ohne Standard und das Lesen aus der Adresse (Fremddaten).
 */
import { describe, it, expect } from 'vitest'
import {
  HOEFE_LISTE_FILTER,
  OHNE_BESTELLUNG_TAGE,
  filtereHoefeListe,
  hoefeListeAdresse,
  hoefeListenZeile,
  hofSignale,
  hofZustand,
  sortiereHoefeListe,
  wartetSeitText,
  zaehleHoefeListe,
  type HoefeListenRoh,
} from '@/lib/admin-hoefe-liste'
import { hoefeListeAus } from '@/schemas/admin-hoefe'

const JETZT = new Date('2026-10-26T10:00:00.000Z')
const TAG = 86_400_000
const vor = (tage: number) => new Date(JETZT.getTime() - tage * TAG)

function roh(ueber: Partial<HoefeListenRoh> = {}): HoefeListenRoh {
  return {
    id: 'h1',
    name: 'Hof am Bach',
    slug: 'hof-am-bach',
    ort: 'Musterort',
    createdAt: vor(60),
    approvedAt: vor(50),
    archivedAt: null,
    geschlossenAm: null,
    istTesthof: false,
    adminGesperrtAm: null,
    isPaused: false,
    emailBestaetigungOffen: false,
    stripeBereit: true,
    produktImShop: true,
    abholzeitAktiv: true,
    letzteBestellungAm: vor(2),
    bestellungen30: 7,
    zuletztAktivAm: null,
    ...ueber,
  }
}

describe('hofZustand', () => {
  it.each([
    ['Geschlossen', { geschlossenAm: vor(1), archivedAt: vor(1), istTesthof: true }],
    ['Stillgelegt', { archivedAt: vor(1), istTesthof: true }],
    ['Testhof', { istTesthof: true, approvedAt: null }],
    ['Wartet', { approvedAt: null, adminGesperrtAm: vor(1) }],
    ['Gesperrt', { adminGesperrtAm: vor(1), isPaused: true }],
    ['Pausiert', { isPaused: true }],
    ['Verkauft', {}],
  ] as const)('%s', (text, ueber) => {
    expect(hofZustand(roh(ueber)).text).toBe(text)
  })
})

describe('hofSignale — EINE Regel für Liste und Aufgaben', () => {
  it('ein laufender Hof hat kein Signal', () => {
    expect(hofSignale(roh(), JETZT)).toEqual([])
  })

  it('wartend: genau ein Signal mit dem, was zum Freischalten fehlt', () => {
    expect(hofSignale(roh({ approvedAt: null, abholzeitAktiv: false }), JETZT)).toEqual([{ id: 'wartet', text: 'Abholzeit fehlt' }])
    expect(hofSignale(roh({ approvedAt: null, stripeBereit: false }), JETZT)).toEqual([{ id: 'wartet', text: 'Stripe fehlt' }])
    expect(hofSignale(roh({ approvedAt: null }), JETZT)).toEqual([{ id: 'wartet', text: 'bereit zum Prüfen' }])
  })

  it('verkauft: Stripe fehlt, ohne Abholzeit, lange ohne Bestellung', () => {
    expect(hofSignale(roh({ stripeBereit: false, abholzeitAktiv: false, letzteBestellungAm: vor(20) }), JETZT).map((s) => s.id)).toEqual([
      'stripe-fehlt',
      'ohne-abholzeit',
      'ohne-bestellung',
    ])
    expect(hofSignale(roh({ letzteBestellungAm: null }), JETZT)[0]?.text).toBe(`seit ${OHNE_BESTELLUNG_TAGE} Tagen ohne Bestellung`)
  })

  it('Gegenproben: Bestellung vor 13 Tagen, frisch freigeschaltet ohne Bestellung — kein Signal', () => {
    expect(hofSignale(roh({ letzteBestellungAm: vor(13) }), JETZT)).toEqual([])
    expect(hofSignale(roh({ approvedAt: vor(3), letzteBestellungAm: null }), JETZT)).toEqual([])
  })

  it('Testhof, pausiert, gesperrt, geschlossen: keine Signale', () => {
    const still = { stripeBereit: false, letzteBestellungAm: null }
    for (const ueber of [{ istTesthof: true }, { isPaused: true }, { adminGesperrtAm: vor(1) }, { geschlossenAm: vor(1) }, { archivedAt: vor(1) }]) {
      expect(hofSignale(roh({ ...still, ...ueber }), JETZT)).toEqual([])
    }
  })
})

describe('Liste', () => {
  const zeilen = () =>
    [
      roh({ id: 'lauf', name: 'Lindenhof' }),
      roh({ id: 'still', name: 'Hof Lärchenhang', letzteBestellungAm: vor(30), ort: 'Bergdorf' }),
      roh({ id: 'w-alt', name: 'Biohof Sonnleiten', approvedAt: null, createdAt: vor(3) }),
      roh({ id: 'w-neu', name: 'Hof Wiesengrund', approvedAt: null, createdAt: vor(0.1), abholzeitAktiv: false }),
      roh({ id: 'pause', name: 'Imkerei', isPaused: true }),
      roh({ id: 'sperre', name: 'Moorhof', adminGesperrtAm: vor(1) }),
      roh({ id: 'test', name: 'Probehof', istTesthof: true, stripeBereit: false }),
      roh({ id: 'zu', name: 'Althof', geschlossenAm: vor(5) }),
    ].map((r) => hoefeListenZeile(r, JETZT))

  it('„Braucht Blick“ zeigt nur Höfe mit Signal — nie den Testhof', () => {
    expect(filtereHoefeListe(zeilen(), { filter: 'braucht-blick', suche: '' }).map((z) => z.id).sort()).toEqual(['still', 'w-alt', 'w-neu'])
  })

  it('Zahlen je Filter; Alle zählt jeden Hof', () => {
    expect(zaehleHoefeListe(zeilen())).toEqual({
      'braucht-blick': 3,
      wartet: 2,
      verkauft: 2,
      pausiert: 1,
      gesperrt: 1,
      geschlossen: 1,
      testhoefe: 1,
      alle: 8,
    })
    expect(HOEFE_LISTE_FILTER[0]).toBe('braucht-blick')
  })

  it('Suche über Name, Adresse der Hofseite und Ort, ohne Groß/klein', () => {
    expect(filtereHoefeListe(zeilen(), { filter: 'alle', suche: '  BERGDORF ' }).map((z) => z.id)).toEqual(['still'])
    expect(filtereHoefeListe(zeilen(), { filter: 'gesperrt', suche: 'linden' })).toEqual([])
  })

  it('Sortierung: Wartende zuerst (am längsten wartend oben), dann mit Signal, dann der Rest', () => {
    // Die Abfrage liefert „jüngste zuerst“.
    const vomServer = zeilen().sort((a, b) => (a.id === 'w-neu' ? -1 : b.id === 'w-neu' ? 1 : 0))
    const sortiert = sortiereHoefeListe(vomServer).map((z) => z.id)
    expect(sortiert.slice(0, 3)).toEqual(['w-alt', 'w-neu', 'still'])
  })

  it('wartend: „seit … h“ bzw. „seit … Tagen“, kein Date im Ergebnis', () => {
    const z = zeilen().find((x) => x.id === 'w-neu')
    expect(z?.seit).toBe('seit 2 h')
    expect(wartetSeitText(vor(3), JETZT)).toBe('seit 3 Tagen')
    expect(JSON.stringify(zeilen())).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
  })
})

describe('Adresse', () => {
  it('ohne Standardwerte; Filter und Suche als Parameter', () => {
    expect(hoefeListeAdresse({ filter: 'braucht-blick', suche: ' ' })).toBe('/admin/hoefe')
    expect(hoefeListeAdresse({ filter: 'gesperrt', suche: 'berg hof' })).toBe('/admin/hoefe?filter=gesperrt&suche=berg+hof')
  })

  it('liest Filter und Suche; Unbekanntes fällt auf „Braucht Blick“', () => {
    expect(hoefeListeAus(new URLSearchParams('filter=testhoefe&suche=bach'))).toEqual({ filter: 'testhoefe', suche: 'bach' })
    expect(hoefeListeAus(new URLSearchParams('filter=stripe-fehlt'))).toEqual({ filter: 'braucht-blick', suche: '' })
    expect(hoefeListeAus(new URLSearchParams(`suche=${'x'.repeat(500)}`)).suche).toBe('')
  })
})

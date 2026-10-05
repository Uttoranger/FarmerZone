/**
 * Tests für die Hofseite im neuen Design (Nachtlauf Nr. 10, Gate 4 — Mockups
 * web-k2-hofseite, web-k2-alle-produkte-nach-kategorie, mobil-k2-*).
 *
 * Beweist, rein und ohne Browser:
 *  - Kategorie-Abschnitte statt Umschalter (E1): Hofladen-Kategorien in der
 *    Reihenfolge des Hofs, Sonstiges zuletzt, dann EIN Abschnitt Futtermittel
 *    und EIN Abschnitt Brennmaterial; der Futter-Abschnitt hat einen festen
 *    Anker — das Ziel von ?bereich=futter.
 *  - Reiter Übersicht · Produkte · Beiträge: Beiträge nur mit Beitrag;
 *    ?reiter= aus der Adresse wird geprüft, Unsinn fällt still auf die
 *    Übersicht; ?bereich=futter öffnet die Produkte.
 *  - Zustände der Produktkarte aus dem echten Bestand (knapp, ausverkauft,
 *    pausiert) — deckungsgleich mit dem Kaufknopf; „Merken" gibt es nicht.
 *  - Zahlung (E5): online und bar bei Abholung, nie „Karte bei Abholung".
 *  - Gebührenhinweis (E4) aus der Hofeinstellung über berechneServicegebuehr.
 *  - Der Warenkorb-Anker öffnet den Korb nur auf der eigenen Hofseite.
 *  - Abholzeiten je Wochentag, Montag zuerst.
 */
import { describe, it, expect } from 'vitest'
import {
  BRENNMATERIAL_ABSCHNITT_ANKER,
  FUTTER_ABSCHNITT_ANKER,
  kartenZustand,
  kategorieAbschnitte,
  knappText,
  zeigeKaufknopf,
} from '@/lib/bereiche-anzeige'
import {
  aktiverReiter,
  gebuehrHinweis,
  hofseiteReiter,
  oeffnetKorbHier,
  reiterAdresse,
  uebersichtProdukte,
  verfuegbarText,
  zahlungsarten,
} from '@/lib/hofseite-kunde'
import { abholzeitenJeWochentag } from '@/lib/pickup-days'
import { servicegebuehrSatz } from '@/lib/servicegebuehr'
import type { ProductCategoryValue } from '@/lib/taxonomie'

const p = (name: string, category: ProductCategoryValue | null) => ({ name, category })

describe('kategorieAbschnitte — E1: eine Seite mit Abschnitten statt Umschalter', () => {
  it('Hofladen in der Reihenfolge des Hofs, dann Futtermittel, dann Brennmaterial', () => {
    const abschnitte = kategorieAbschnitte([
      p('Holz', 'BRENNHOLZ'),
      p('Heu', 'HEU_STROH'),
      p('Brot', 'BROT'),
      p('Eier', 'EIER'),
      p('Hafer', 'GETREIDE_KOERNER'),
      p('Karotten', 'GEMUESE'),
      p('Semmeln', 'BROT'),
    ])
    expect(abschnitte.map((a) => a.titel)).toEqual(['Brot & Gebäck', 'Eier', 'Gemüse', 'Futtermittel', 'Brennmaterial'])
    // Innerhalb des Abschnitts bleibt die Reihenfolge des Hofs.
    expect(abschnitte[0].produkte.map((x) => x.name)).toEqual(['Brot', 'Semmeln'])
  })

  it('alle Futter-Kategorien landen in EINEM Abschnitt mit festem Anker', () => {
    const abschnitte = kategorieAbschnitte([p('Heu', 'HEU_STROH'), p('Mais', 'GETREIDE_KOERNER'), p('Altlast', 'FUTTERMITTEL')])
    expect(abschnitte).toHaveLength(1)
    expect(abschnitte[0]).toMatchObject({ art: 'futter', anker: FUTTER_ABSCHNITT_ANKER, titel: 'Futtermittel' })
    expect(abschnitte[0].produkte.map((x) => x.name)).toEqual(['Heu', 'Mais', 'Altlast'])
  })

  it('Brennholz heißt Brennmaterial und steht ganz am Ende', () => {
    const abschnitte = kategorieAbschnitte([p('Holz', 'BRENNHOLZ'), p('Honig', 'HONIG'), p('Heu', 'HEU_STROH')])
    expect(abschnitte.map((a) => a.anker)).toEqual(['kategorie-honig', FUTTER_ABSCHNITT_ANKER, BRENNMATERIAL_ABSCHNITT_ANKER])
  })

  it('Sonstiges (auch ohne Kategorie) schließt den Hofladen ab, vor dem Futter', () => {
    const abschnitte = kategorieAbschnitte([p('Seife', null), p('Heu', 'HEU_STROH'), p('Milch', 'MILCH'), p('Kerze', 'SONSTIGES')])
    expect(abschnitte.map((a) => a.titel)).toEqual(['Milch & Molkerei', 'Sonstiges', 'Futtermittel'])
    expect(abschnitte[1].produkte.map((x) => x.name)).toEqual(['Seife', 'Kerze'])
  })

  it('ohne Produkte keine Abschnitte; die Anker sind eindeutig', () => {
    expect(kategorieAbschnitte([])).toEqual([])
    const anker = kategorieAbschnitte([p('a', 'EIER'), p('b', 'GEMUESE'), p('c', 'HEU_STROH'), p('d', 'BRENNHOLZ')]).map((a) => a.anker)
    expect(new Set(anker).size).toBe(anker.length)
  })
})

describe('Reiter — Übersicht · Produkte · Beiträge', () => {
  it('Beiträge nur, wenn der Hof gerade einen zeigt; Produkte mit Anzahl', () => {
    expect(hofseiteReiter({ produktAnzahl: 10, hatBeitrag: false })).toEqual([
      { id: 'uebersicht', label: 'Übersicht' },
      { id: 'produkte', label: 'Produkte · 10' },
    ])
    expect(hofseiteReiter({ produktAnzahl: 0, hatBeitrag: true }).map((r) => r.label)).toEqual(['Übersicht', 'Produkte', 'Beiträge'])
  })

  const MIT_BEITRAG = hofseiteReiter({ produktAnzahl: 3, hatBeitrag: true })
  const OHNE_BEITRAG = hofseiteReiter({ produktAnzahl: 3, hatBeitrag: false })

  it('ohne Angabe die Übersicht; ein gültiger Reiter aus der Adresse gilt', () => {
    expect(aktiverReiter({ reiter: null, bereich: null }, MIT_BEITRAG)).toBe('uebersicht')
    expect(aktiverReiter({ reiter: 'produkte', bereich: null }, MIT_BEITRAG)).toBe('produkte')
    expect(aktiverReiter({ reiter: 'beitraege', bereich: null }, MIT_BEITRAG)).toBe('beitraege')
  })

  it('Unsinn und Reiter, die es nicht gibt, fallen still auf die Übersicht', () => {
    expect(aktiverReiter({ reiter: 'admin', bereich: null }, MIT_BEITRAG)).toBe('uebersicht')
    expect(aktiverReiter({ reiter: 'beitraege', bereich: null }, OHNE_BEITRAG)).toBe('uebersicht')
  })

  it('?bereich=futter (Links von /hoefe und Umfeld) öffnet die Produkte — ein gewählter Reiter sticht', () => {
    expect(aktiverReiter({ reiter: null, bereich: 'futter' }, OHNE_BEITRAG)).toBe('produkte')
    expect(aktiverReiter({ reiter: 'uebersicht', bereich: 'futter' }, OHNE_BEITRAG)).toBe('uebersicht')
    expect(aktiverReiter({ reiter: null, bereich: 'quatsch' }, OHNE_BEITRAG)).toBe('uebersicht')
  })

  it('die Adresse eines Reiters behält die übrigen Parameter, die Übersicht trägt keinen', () => {
    expect(reiterAdresse('/hof-test', 'bereich=futter', 'produkte')).toBe('/hof-test?bereich=futter&reiter=produkte')
    expect(reiterAdresse('/hof-test', 'reiter=produkte&bereich=futter', 'uebersicht')).toBe('/hof-test?bereich=futter')
    expect(reiterAdresse('/hof-test', '', 'uebersicht')).toBe('/hof-test')
    expect(reiterAdresse('/hof-test', '?reiter=beitraege', 'produkte')).toBe('/hof-test?reiter=produkte')
  })
})

describe('uebersichtProdukte — das Schaufenster der Übersicht', () => {
  const ware = (name: string, stock: number) => ({ name, stock, isAvailable: true })

  it('zuerst Kaufbares in der Reihenfolge des Hofs, Ausverkauftes füllt nur auf', () => {
    const liste = [ware('a', 0), ware('b', 3), ware('c', 0), ware('d', 9), ware('e', 1)]
    expect(uebersichtProdukte(liste, false).map((x) => x.name)).toEqual(['b', 'd', 'e'])
    expect(uebersichtProdukte([ware('a', 0), ware('b', 3)], false).map((x) => x.name)).toEqual(['b', 'a'])
  })

  it('„N verfügbar" zählt, was man in den Korb legen kann — pausiert nichts', () => {
    expect(verfuegbarText([ware('a', 0), ware('b', 3), ware('c', 2)], false)).toBe('2 verfügbar')
    expect(verfuegbarText([ware('b', 3)], true)).toBeNull()
  })
})

describe('kartenZustand — knapp und ausverkauft aus dem echten Bestand', () => {
  const produkt = (stock: number, isAvailable = true) => ({ stock, isAvailable, unavailableReason: null })

  it('genug Bestand: kaufbar; bis fünf: knapp mit Bestand; null: ausverkauft', () => {
    expect(kartenZustand(produkt(12), false)).toEqual({ art: 'kaufbar' })
    expect(kartenZustand(produkt(5), false)).toEqual({ art: 'knapp', bestand: 5 })
    expect(kartenZustand(produkt(1), false)).toEqual({ art: 'knapp', bestand: 1 })
    expect(kartenZustand(produkt(0), false)).toEqual({ art: 'ausverkauft' })
  })

  it('pausiert sticht alles; nicht im Shop nennt den Grund des Hofs', () => {
    expect(kartenZustand(produkt(12), true)).toEqual({ art: 'pausiert' })
    expect(kartenZustand(produkt(0), true)).toEqual({ art: 'pausiert' })
    expect(kartenZustand({ stock: 4, isAvailable: false, unavailableReason: 'Ab Mai' }, false)).toEqual({
      art: 'nicht-verfuegbar',
      grund: 'Ab Mai',
    })
    expect(kartenZustand({ stock: 4, isAvailable: false, unavailableReason: null }, false)).toEqual({
      art: 'nicht-verfuegbar',
      grund: 'Nicht verfügbar',
    })
  })

  it('der Kaufknopf erscheint genau bei kaufbar und knapp — eine Regel mit zeigeKaufknopf', () => {
    for (const stock of [0, 1, 5, 6, 40]) {
      for (const isAvailable of [true, false]) {
        for (const isPaused of [true, false]) {
          const art = kartenZustand({ stock, isAvailable, unavailableReason: null }, isPaused).art
          expect(art === 'kaufbar' || art === 'knapp', `${stock}/${isAvailable}/${isPaused}`).toBe(
            zeigeKaufknopf({ stock, isAvailable }, isPaused)
          )
        }
      }
    }
  })

  it('„nur noch …" nennt die Menge in der Einheit des Bestands', () => {
    expect(knappText(3, 'STUECK', null)).toBe('Nur noch 3 Stück')
    expect(knappText(2, 'KG', 1)).toBe('Nur noch 2 kg')
    expect(knappText(3, 'KG', 2)).toBe('Nur noch 3 × 2 kg')
  })
})

describe('zahlungsarten — E5: online und bar bei Abholung', () => {
  const hof = (acceptsOnline: boolean, stripeAccountReady: boolean, acceptsOnsite: boolean) => ({
    acceptsOnline,
    stripeAccountReady,
    acceptsOnsite,
  })

  it('online nur mit fertigem Stripe-Konto — dieselbe Bedingung wie der Checkout', () => {
    expect(zahlungsarten(hof(true, true, true)).map((z) => z.art)).toEqual(['online', 'bar'])
    expect(zahlungsarten(hof(true, false, true)).map((z) => z.art)).toEqual(['bar'])
    expect(zahlungsarten(hof(false, true, false))).toEqual([])
  })

  it('nie „Karte bei Abholung" oder „vor Ort mit Karte"', () => {
    const texte = zahlungsarten(hof(true, true, true)).map((z) => z.text).join(' ')
    expect(texte).toContain('Bar bei Abholung')
    expect(texte).not.toMatch(/Karte bei Abholung|Vor Ort \(Bar & Karte\)|vor Ort mit Karte/i)
  })
})

describe('Servicegebühr — Satz und Hinweis aus der Hofeinstellung (E4)', () => {
  const JETZT = new Date('2026-10-05T10:00:00Z')
  const aktiv = { serviceFeePercent: 5, serviceFeeMinCents: 50, serviceFeeActiveFrom: new Date('2026-10-01T00:00:00Z') }

  it('der Satz kommt aus berechneServicegebuehr: Prozent und Mindestgebühr', () => {
    expect(servicegebuehrSatz(aktiv, JETZT)).toEqual({ prozent: 5, mindestCents: 50 })
    expect(servicegebuehrSatz({ ...aktiv, serviceFeePercent: '4.9' }, JETZT)).toEqual({ prozent: 4.9, mindestCents: 50 })
  })

  it('gebührenfrei (kein Datum, Datum in der Zukunft, nichts zu zahlen): kein Satz', () => {
    expect(servicegebuehrSatz({ ...aktiv, serviceFeeActiveFrom: null }, JETZT)).toBeNull()
    expect(servicegebuehrSatz({ ...aktiv, serviceFeeActiveFrom: new Date('2026-11-01T00:00:00Z') }, JETZT)).toBeNull()
    expect(servicegebuehrSatz({ ...aktiv, serviceFeePercent: 0, serviceFeeMinCents: 0 }, JETZT)).toBeNull()
  })

  it('der Hinweis nennt Satz und Mindestgebühr, einmal je Bestellung — ohne Satz kein Hinweis', () => {
    expect(gebuehrHinweis({ prozent: 5, mindestCents: 50 })).toEqual({
      kurz: 'Preise zzgl. 5 % Servicegebühr (mind. € 0,50) – im Warenkorb einzeln ausgewiesen. Der Hof bekommt den vollen Preis.',
      produkte: 'Preise zzgl. 5 % Servicegebühr (mind. € 0,50) – einmal pro Bestellung, egal wie viel du in den Korb legst.',
      korb: 'zzgl. Servicegebühr',
    })
    expect(gebuehrHinweis({ prozent: 4.9, mindestCents: 50 })?.kurz).toContain('4,9 %')
    expect(gebuehrHinweis(null)).toBeNull()
  })
})

describe('oeffnetKorbHier — der Warenkorb-Knopf der Shell auf der eigenen Hofseite', () => {
  it('derselbe Hof mit #warenkorb öffnet den Korb', () => {
    expect(oeffnetKorbHier('/hof-test#warenkorb', 'http://localhost:3000/hof-test')).toBe(true)
    expect(oeffnetKorbHier('/hof-test#warenkorb', 'http://localhost:3000/hof-test?reiter=produkte')).toBe(true)
  })

  it('ein anderer Hof, ein anderer Anker oder gar keiner nicht', () => {
    expect(oeffnetKorbHier('/anderer-hof#warenkorb', 'http://localhost:3000/hof-test')).toBe(false)
    expect(oeffnetKorbHier('/hof-test', 'http://localhost:3000/hof-test')).toBe(false)
    expect(oeffnetKorbHier('/hof-test#kategorie-eier', 'http://localhost:3000/hof-test')).toBe(false)
    expect(oeffnetKorbHier('https://boese.example/hof-test#warenkorb', 'http://localhost:3000/hof-test')).toBe(false)
  })
})

describe('abholzeitenJeWochentag — die Karte „Abholzeiten"', () => {
  it('Montag zuerst, mehrere Fenster eines Tages in einer Zeile', () => {
    expect(
      abholzeitenJeWochentag([
        { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 3, startTime: '15:00', endTime: '18:00' },
        { dayOfWeek: 0, startTime: '10:00', endTime: '11:30' },
        { dayOfWeek: 3, startTime: '08:00', endTime: '10:00' },
      ])
    ).toEqual(['Mittwoch, 8–10 · 15–18 Uhr', 'Samstag, 9–12 Uhr', 'Sonntag, 10–11:30 Uhr'])
    expect(abholzeitenJeWochentag([])).toEqual([])
  })
})

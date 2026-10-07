/**
 * Region › Futter kaufen (Nachtlauf Nr. 22c) — die reine Regel aus
 * src/lib/futter-kaufen.ts: nur registrierte Futtermittelbetriebe (Gate 8),
 * nur kaufbare, nicht gesperrte Größen (Nr. 20, S7), je Familie eine Karte
 * (E3), Schild im Wortlaut der Produktseite (E9, ohne Prüfvermerk), keine
 * Kontaktdaten. Ohne Datenbank.
 */
import { describe, it, expect } from 'vitest'
import {
  angeboteneGroessen,
  baueFutterKaufen,
  istRegistrierterBetrieb,
  type FutterHof,
  type FutterKaufenEingabe,
  type FutterProdukt,
} from '@/lib/futter-kaufen'
import type { FutterKaufenFilter } from '@/schemas/region'

const SAMSTAG_FRUEH = { wochentag: 6, uhrzeit: '07:00' }
const ALLES: FutterKaufenFilter = { km: 25, art: null, menge: null }

function hof(abweichend: Partial<FutterHof> = {}): FutterHof {
  return {
    id: 'hof-a',
    slug: 'bergbauernhof',
    name: 'Bergbauernhof',
    entfernungKm: 6,
    betriebsnummer: 'LFBIS 1234567',
    betriebsstatus: 'PRIMAERPRODUKTION',
    abholfenster: [{ dayOfWeek: 6, startTime: '08:00', endTime: '12:00' }],
    ...abweichend,
  }
}

function produkt(abweichend: Partial<FutterProdukt> = {}): FutterProdukt {
  return {
    id: 'p1',
    farmId: 'hof-a',
    name: 'Bergwiesen-Heu Rundballen',
    familieId: null,
    category: 'HEU_STROH',
    price: 45,
    isAvailable: true,
    stock: 3,
    reservedStock: 0,
    verpackung: 'LOSE_BALLEN',
    futter: { nettoMenge: 250, nettoEinheit: 'KG', betriebsnummer: '1234567' },
    ...abweichend,
  }
}

function eingabe(abweichend: Partial<FutterKaufenEingabe> = {}): FutterKaufenEingabe {
  return { hoefe: [hof()], produkte: [produkt()], ohneStandort: [], abgeschnitten: false, filter: ALLES, jetzt: SAMSTAG_FRUEH, ...abweichend }
}

describe('Wer erscheint — nur registrierte Futtermittelbetriebe', () => {
  it('eine eingetragene Nummer genügt (E9: ungeprüft), nur Leerzeichen nicht', () => {
    expect(istRegistrierterBetrieb({ betriebsnummer: 'LFBIS 1', betriebsstatus: 'PRIMAERPRODUKTION' })).toBe(true)
    expect(istRegistrierterBetrieb({ betriebsnummer: '1234', betriebsstatus: 'REGISTRIERT' })).toBe(true)
    expect(istRegistrierterBetrieb({ betriebsnummer: '   ', betriebsstatus: 'PRIMAERPRODUKTION' })).toBe(false)
    expect(istRegistrierterBetrieb({ betriebsnummer: null, betriebsstatus: null })).toBe(false)
  })

  it('ein Hof ohne Nummer erscheint nicht, auch wenn er Futter hat', () => {
    const ansicht = baueFutterKaufen(eingabe({ hoefe: [hof({ betriebsnummer: null })] }))
    expect(ansicht.angebote).toEqual([])
    expect(ansicht.leer?.satz).toContain('registrierter Futtermittelbetrieb')
  })
})

describe('Welche Größe erscheint — kaufbar, nicht gesperrt, Futtermittel', () => {
  it('ausverkauft, reserviert, ausgeblendet und kein Futter fallen weg', () => {
    const jeHof = angeboteneGroessen(
      [hof()],
      [
        produkt({ id: 'ok' }),
        produkt({ id: 'leer', stock: 0 }),
        produkt({ id: 'reserviert', stock: 2, reservedStock: 2 }),
        produkt({ id: 'aus', isAvailable: false }),
        produkt({ id: 'eier', category: 'EIER', verpackung: null, futter: null }),
      ]
    )
    expect(jeHof.get('hof-a')?.map((p) => p.id)).toEqual(['ok'])
  })

  it('S7: abgepacktes Heimtierfutter ohne BAES-Meldung ist gesperrt und erscheint nicht', () => {
    const sackerl = produkt({ id: 'sackerl', verpackung: 'ABGEPACKT_ETIKETT', name: 'Bergwiesen-Heu 1 kg-Sackerl', price: 2.5 })
    const ohneMeldung = baueFutterKaufen(eingabe({ produkte: [sackerl] }))
    expect(ohneMeldung.angebote).toEqual([])
    const mitMeldung = baueFutterKaufen(eingabe({ hoefe: [hof({ betriebsstatus: 'REGISTRIERT' })], produkte: [sackerl] }))
    expect(mitMeldung.angebote.map((a) => a.groessen.map((g) => g.id))).toEqual([['sackerl']])
  })

  it('Mischfutter ohne BAES-Meldung ist gesperrt (Mischen/Zukauf, E10)', () => {
    const misch = produkt({ id: 'misch', category: 'MISCHFUTTER', verpackung: 'LOSE_BALLEN' })
    expect(baueFutterKaufen(eingabe({ produkte: [misch] })).angebote).toEqual([])
  })

  it('Produkte fremder, nicht übergebener Höfe erscheinen nie', () => {
    expect(baueFutterKaufen(eingabe({ produkte: [produkt({ farmId: 'hof-fremd' })] })).angebote).toEqual([])
  })
})

describe('Karten — je Familie eine, Schild nach E9', () => {
  const familie = [
    produkt({ id: 'rund', familieId: 'f1', name: 'Bergwiesen-Heu Rundballen ~250 kg', price: 45, futter: { nettoMenge: 250, nettoEinheit: 'KG', betriebsnummer: '1234567' } }),
    produkt({ id: 'klein', familieId: 'f1', name: 'Bergwiesen-Heu Kleinballen ~15 kg', price: 4.5, futter: { nettoMenge: 15, nettoEinheit: 'KG', betriebsnummer: '1234567' } }),
  ]

  it('eine Karte mit gemeinsamem Namen, Größen nach Preis, „ab" beim Grundpreis', () => {
    const [karte] = baueFutterKaufen(eingabe({ produkte: familie })).angebote
    expect(karte).toMatchObject({
      name: 'Bergwiesen-Heu',
      hofName: 'Bergbauernhof',
      entfernung: '6,0 km',
      abholung: 'Abholung Heute 08:00–12:00',
      schild: 'Futtermittelbetrieb · LFBIS 1234567',
      grundpreis: 'ab € 0,18 / kg',
      bestellenHref: '/bergbauernhof/produkt/klein',
    })
    expect(karte.groessen).toEqual([
      { id: 'klein', name: 'Kleinballen ~15 kg', preis: '€ 4,50', href: '/bergbauernhof/produkt/klein' },
      { id: 'rund', name: 'Rundballen ~250 kg', preis: '€ 45,00', href: '/bergbauernhof/produkt/rund' },
    ])
  })

  it('das Schild trägt nie einen Prüfvermerk und fehlt bei anderen Status (Wortlaut nicht entschieden)', () => {
    const [karte] = baueFutterKaufen(eingabe()).angebote
    expect(karte.schild).toBe('Futtermittelbetrieb · LFBIS 1234567')
    expect(karte.schild).not.toMatch(/gepr|Registrierter/i)
    const [registriert] = baueFutterKaufen(eingabe({ hoefe: [hof({ betriebsstatus: 'REGISTRIERT' })] })).angebote
    expect(registriert.schild).toBeNull()
  })

  it('keine Kontaktdaten, keine Koordinaten, kein Bestand in der Ausgabe', () => {
    const text = JSON.stringify(baueFutterKaufen(eingabe({ produkte: familie })))
    expect(text).not.toMatch(/latitude|longitude|stock|reserved|@|telefon|phone|address/i)
  })

  it('Höfe nach Entfernung, ein langer Name bleibt ganz (die Karte kürzt sichtbar mit title)', () => {
    const lang = 'H'.repeat(80)
    const ansicht = baueFutterKaufen(
      eingabe({
        hoefe: [hof({ id: 'weit', slug: 'weit', name: lang, entfernungKm: 19 }), hof()],
        produkte: [produkt({ id: 'w', farmId: 'weit' }), produkt()],
      })
    )
    expect(ansicht.angebote.map((a) => a.hofName)).toEqual(['Bergbauernhof', lang])
  })
})

describe('Filter, Chips, Hinweise, Leerzustand', () => {
  const heu = produkt({ id: 'heu', futter: { nettoMenge: 250, nettoEinheit: 'KG', betriebsnummer: '1' } })
  const hafer = produkt({ id: 'hafer', category: 'GETREIDE_KOERNER', name: 'Hafer 25 kg', futter: { nettoMenge: 25, nettoEinheit: 'KG', betriebsnummer: '1' } })

  it('Art und Menge filtern je Größe; Chips zählen Karten bei der übrigen Auswahl', () => {
    const ansicht = baueFutterKaufen(eingabe({ produkte: [heu, hafer], filter: { km: 25, art: 'HEU_STROH', menge: null } }))
    expect(ansicht.angebote.map((a) => a.groessen[0].id)).toEqual(['heu'])
    expect(ansicht.artChips.map((c) => [c.label, c.anzahl, c.aktiv])).toEqual([
      ['Alle', 2, false],
      ['Heu & Stroh', 1, true],
      ['Getreide & Körner', 1, false],
    ])
    expect(ansicht.mengeChips.map((c) => [c.label, c.anzahl])).toEqual([
      ['Alle Mengen', 1],
      ['Ballen & mehr', 1],
    ])
    const klein = baueFutterKaufen(eingabe({ produkte: [heu, hafer], filter: { km: 25, art: null, menge: 'klein' } }))
    expect(klein.angebote.map((a) => a.groessen[0].id)).toEqual(['hafer'])
  })

  it('leer durch die Auswahl: Ausweg „zurücksetzen"; leer im Umkreis: nächste Stufe', () => {
    const auswahl = baueFutterKaufen(eingabe({ produkte: [heu], filter: { km: 25, art: 'MISCHFUTTER', menge: null } }))
    expect(auswahl.leer).toMatchObject({ auswahlZuruecksetzen: true, weiterUmkreis: null })
    expect(auswahl.artChips.find((c) => c.wert === 'MISCHFUTTER')).toMatchObject({ aktiv: true, anzahl: 0 })
    const umkreis = baueFutterKaufen(eingabe({ hoefe: [], produkte: [], filter: { km: 10, art: null, menge: null } }))
    expect(umkreis.leer).toMatchObject({ auswahlZuruecksetzen: false, weiterUmkreis: 25 })
    expect(baueFutterKaufen(eingabe({ hoefe: [], produkte: [], filter: { km: 50, art: null, menge: null } })).leer?.weiterUmkreis).toBeNull()
  })

  it('Höfe ohne Standort werden nur gezählt — und nur registrierte mit Angebot', () => {
    const ansicht = baueFutterKaufen(
      eingabe({
        ohneStandort: [
          { id: 'ohne-1', betriebsnummer: 'LFBIS 9', betriebsstatus: 'PRIMAERPRODUKTION' },
          { id: 'ohne-2', betriebsnummer: null, betriebsstatus: null },
        ],
        produkte: [produkt(), produkt({ id: 'x1', farmId: 'ohne-1' }), produkt({ id: 'x2', farmId: 'ohne-2' })],
      })
    )
    expect(ansicht.hinweise).toEqual(['1 Hof ohne Standort nicht berücksichtigt.'])
    expect(ansicht.angebote).toHaveLength(1)
  })
})

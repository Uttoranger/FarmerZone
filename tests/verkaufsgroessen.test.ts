/**
 * Verkaufsgrößen als Produktfamilie (Register E3, E11; Nachtlauf Nr. 20) —
 * src/lib/verkaufsgroessen.ts, rein und ohne Mock: Vorlagen, Name je Größe,
 * Grundpreis-Vorschau (centgenau über die eine Rundungsstelle), Brennmaterial-
 * Regeln und „gelagert seit" als Wiener Kalendertag.
 */
import { describe, it, expect } from 'vitest'
import {
  BRENN_VORLAGEN,
  BRENN_VORLAGEN_START,
  FUTTER_VORLAGEN,
  FUTTER_VORLAGEN_START,
  RAUMMASS_ERKLAERUNG,
  RESTFEUCHTE_JE_TROCKNUNG,
  brennMengeText,
  einheitPasstZurArt,
  fehlerJeFeld,
  gelagertSeitAus,
  gespeichertText,
  gewichtUngefaehr,
  groessenProduktname,
  grundpreisVorschau,
  namePasstFuerGroessen,
  raummassErklaeren,
} from '@/lib/verkaufsgroessen'
import { PRODUKTNAME_MAX } from '@/lib/eingabegrenzen'

describe('Futter-Vorlagen (Mockup web-h2-neues-futter)', () => {
  it('Sackerl und Sack sind abgepacktes Heimtierfutter, Ballen und Big Bag lose Ernte (E10)', () => {
    const verpackung = Object.fromEntries(FUTTER_VORLAGEN.map((v) => [v.bezeichnung, v.verpackung]))
    expect(verpackung).toEqual({
      '1 kg-Sackerl': 'ABGEPACKT_ETIKETT',
      '5 kg-Sack': 'ABGEPACKT_ETIKETT',
      Kleinballen: 'LOSE_BALLEN',
      Rundballen: 'LOSE_BALLEN',
      'Big Bag': 'LOSE_BALLEN',
    })
  })

  it('beim Öffnen sind vier gewählt — alle außer Big Bag', () => {
    expect(FUTTER_VORLAGEN.filter((v) => FUTTER_VORLAGEN_START.includes(v.id)).map((v) => v.bezeichnung)).toEqual([
      '1 kg-Sackerl',
      '5 kg-Sack',
      'Kleinballen',
      'Rundballen',
    ])
  })

  it('Ballen und Big Bags wiegen „ca.", Stück nicht', () => {
    expect(gewichtUngefaehr('BALLEN')).toBe(true)
    expect(gewichtUngefaehr('BIGBAG')).toBe(true)
    expect(gewichtUngefaehr('STUECK')).toBe(false)
  })
})

describe('Name je Größe', () => {
  it('Familienname und Größe, Ränder abgeschnitten', () => {
    expect(groessenProduktname(' Bergwiesen-Heu ', ' 5 kg-Sack')).toBe('Bergwiesen-Heu 5 kg-Sack')
  })

  it('passt genau bis zur Grenze des Produktnamens — ein Zeichen mehr nicht', () => {
    const groesse = 'Rundballen'
    const name = 'x'.repeat(PRODUKTNAME_MAX - groesse.length - 1)
    expect(namePasstFuerGroessen(name, [groesse])).toBe(true)
    expect(namePasstFuerGroessen(`${name}x`, [groesse])).toBe(false)
    // Entscheidend ist die längste Größe.
    expect(namePasstFuerGroessen(name, ['1 kg', `${groesse}!`])).toBe(false)
  })
})

describe('grundpreisVorschau — die Spalte „€ / kg"', () => {
  it('rechnet die Zahlen des Mockups', () => {
    expect(grundpreisVorschau(2.5, 1)).toBe('€ 2,50 / kg')
    expect(grundpreisVorschau(8, 5)).toBe('€ 1,60 / kg')
    expect(grundpreisVorschau(4.5, 15)).toBe('€ 0,30 / kg')
    expect(grundpreisVorschau(45, 250)).toBe('€ 0,18 / kg')
  })

  it('rundet centgenau über dieselbe Stelle wie Hof- und Produktseite: € 2,01 für 2 kg sind € 1,01', () => {
    expect(grundpreisVorschau(2.01, 2)).toBe('€ 1,01 / kg')
  })

  it('nimmt getippten Text mit Komma', () => {
    expect(grundpreisVorschau('4,50', '15')).toBe('€ 0,30 / kg')
  })

  it('nichts, solange Preis oder Gewicht fehlen oder unlesbar sind', () => {
    expect(grundpreisVorschau(null, 5)).toBeNull()
    expect(grundpreisVorschau(8, null)).toBeNull()
    expect(grundpreisVorschau('abc', 5)).toBeNull()
    expect(grundpreisVorschau(8, 0)).toBeNull()
  })
})

describe('Brennmaterial (E11)', () => {
  it('Vorlagen und Startwahl je Art: Brennholz drei Größen, Hackschnitzel je Schüttraummeter', () => {
    const name = (ids: readonly string[]) => BRENN_VORLAGEN.filter((v) => ids.includes(v.id)).map((v) => v.bezeichnung)
    expect(name(BRENN_VORLAGEN_START.BRENNHOLZ_SCHEIT)).toEqual(['Sack ca. 15 kg', 'Schüttraummeter', 'Raummeter'])
    expect(name(BRENN_VORLAGEN_START.HACKSCHNITZEL)).toEqual(['Schüttraummeter'])
    expect(name(BRENN_VORLAGEN_START.ANZUENDHOLZ)).toEqual(['Anzündholz-Sack'])
  })

  it('Hackschnitzel nie in Raummetern — gestapelt gehen sie nicht', () => {
    expect(einheitPasstZurArt('HACKSCHNITZEL', 'RAUMMETER')).toBe(false)
    expect(einheitPasstZurArt('HACKSCHNITZEL', 'SCHUETTRAUMMETER')).toBe(true)
    expect(einheitPasstZurArt('BRENNHOLZ_SCHEIT', 'RAUMMETER')).toBe(true)
  })

  it('Menge je Einheit wie im Mockup', () => {
    expect(brennMengeText('RAUMMETER')).toBe('1 rm gestapelt')
    expect(brennMengeText('SCHUETTRAUMMETER')).toBe('1 srm lose')
    expect(brennMengeText('STUECK')).toBe('je Stück')
  })

  it('die Erklärung rm/srm/fm kommt, sobald eine Größe in rm oder srm verkauft wird', () => {
    expect(raummassErklaeren(['STUECK', 'RAUMMETER'])).toBe(true)
    expect(raummassErklaeren(['SCHUETTRAUMMETER'])).toBe(true)
    expect(raummassErklaeren(['STUECK'])).toBe(false)
    expect(RAUMMASS_ERKLAERUNG.map((e) => e.kurz)).toEqual(['Raummeter (rm)', 'Schüttraummeter (srm)', 'Festmeter (fm)'])
  })

  it('Restfeuchte je Trocknungsgrad: ofenfertig 20, lufttrocken 25, frisch ohne', () => {
    expect(RESTFEUCHTE_JE_TROCKNUNG).toEqual({ OFENFERTIG: 20, LUFTTROCKEN: 25, FRISCH: null })
  })
})

describe('gelagertSeitAus — der Wiener Tag vor N Jahren', () => {
  it('zwei Jahre zurück', () => {
    expect(gelagertSeitAus(2, new Date('2026-10-07T10:00:00.000Z'))).toBe('2024-10-07')
  })

  it('zählt den Wiener Tag, nicht UTC: 31.12. 23:30 UTC ist in Wien schon der 1. Jänner', () => {
    expect(gelagertSeitAus(1, new Date('2026-12-31T23:30:00.000Z'))).toBe('2026-01-01')
  })

  it('0 Jahre ist heute; der 29. Februar wird in Nicht-Schaltjahren zum 28.', () => {
    expect(gelagertSeitAus(0, new Date('2028-02-29T10:00:00.000Z'))).toBe('2028-02-29')
    expect(gelagertSeitAus(1, new Date('2028-02-29T10:00:00.000Z'))).toBe('2027-02-28')
    expect(gelagertSeitAus(4, new Date('2028-02-29T10:00:00.000Z'))).toBe('2024-02-29')
  })
})

describe('Formular-Helfer', () => {
  it('fehlerJeFeld nimmt die erste Meldung je Pfad', () => {
    expect(
      fehlerJeFeld([
        { path: ['name'], message: 'eins' },
        { path: ['name'], message: 'zwei' },
        { path: ['groessen', 0, 'price'], message: 'Preis' },
      ])
    ).toEqual({ name: 'eins', 'groessen.0.price': 'Preis' })
  })

  it('gespeichertText sagt, was online ist und was wartet', () => {
    expect(gespeichertText('Heu', 4, 0)).toBe('Heu: 4 Größen online.')
    expect(gespeichertText('Heu', 2, 2)).toBe('Heu: 2 Größen online, 2 Größen warten auf deine Registrierung.')
    expect(gespeichertText('Heu', 0, 1)).toBe('Heu: gespeichert, aber nicht im Shop – 1 Größe wartet auf deine Registrierung.')
  })
})

/**
 * Geldsätze nach V1 (Lauf 32, Nr. 248; Entscheidungsliste 3.2, Register N38, B1, K2, N44, E4) —
 * `geldsaetzeFuer` in src/lib/plattformgebuehr.ts.
 *
 * Beweist:
 *  - Angebot nach dem Stichtag: „Du bekommst € … · die Kundin zahlt € …“ mit dem Satz des Hofs (Vorgabe 6 %,
 *    abweichend 6,5 %), dieselben Cent wie `bestellGebuehr`/`endpreisJeStueckCents` — keine neue Rechnung.
 *  - „Bar bis <Tag> ohne Gebühr für dich.“ nur beim Gründungshof (bzw. gesetztem `einzugAb`) und nur vor dem
 *    Einzugsbeginn (`einzugAbFuer`); ohne Gründungsplatz nie.
 *  - Vor dem Stichtag (Modell „bisher“) gibt es keinen Geldsatz, auch nicht beim Gründungshof.
 *  - Bestellung: nur der Snapshot (`totalAmount`, `serviceFeeCents`), je Weg ein Satz — online einbehalten, bar
 *    erlassen („die vollen € …“, Wort der Gebühr aus der Konstante), bar mit Monatsabrechnung; „bisher“ → null.
 *  - Entfallene Gebühr (`serviceFeeRefundedAt` gesetzt: erstattet bzw. nicht kassiert) → null, kein Satz mit dem
 *    Betrag samt Gebühr und keine Monatsabrechnung (N38, Auftrag: kein „inkl.“); Gegenprobe ohne Erstattung.
 *  - Erlassene Bestellung, deren Frist (heute aus den Hofdaten, auch `einzugAb` aus dem Admin) schon vorbei ist:
 *    Satz ohne Datum, nie „bis <vergangener Tag> zahlst du …“; Gegenprobe mit Frist in der Zukunft.
 *  - Prozent und Wort der Gebühr stehen nie als fester Text in der Hilfe (Gegenprobe am Schnipsel).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  bestellGebuehr,
  endpreisJeStueckCents,
  geldsaetzeFuer,
  satzHundertstel,
  type GebuehrEinzug,
  type GeldsatzHof,
} from '@/lib/plattformgebuehr'
import { PLATTFORMGEBUEHR_BEZEICHNUNG } from '@/lib/konditionen'

const NBSP = ' '
const STICHTAG = { hofpreisModellAb: new Date('2027-01-31T23:00:00Z') } // 1. Februar 2027, Mitternacht Wien
const NACH_STICHTAG = new Date('2027-03-03T10:00:00Z')
const VOR_STICHTAG = new Date('2027-01-15T10:00:00Z')
const GRUENDUNG_BIS = new Date('2028-01-31T00:00:00Z') // letzter Gründungstag, wie Farm.gruendungBis
const HOF: GeldsatzHof = { plattformgebuehrProzent: null, einzugAb: null }

const angebot = (preisCents: number, ab = false) => ({ art: 'angebot' as const, positionen: [{ preisCents, menge: 1 }], ab })

describe('Geldsatz eines Angebots', () => {
  it('nach dem Stichtag ohne Gründungsplatz: Du bekommst · die Kundin zahlt, ohne Bar-Satz', () => {
    const g = geldsaetzeFuer(angebot(750), HOF, STICHTAG, null, NACH_STICHTAG)

    expect(g).toEqual({
      hofCents: 750,
      kundinCents: 795,
      satz: `Du bekommst €${NBSP}7,50 · die Kundin zahlt €${NBSP}7,95`,
      barOhneGebuehr: null,
    })
  })

  it('rechnet über die bestehenden Funktionen: dieselben Cent wie endpreisJeStueckCents und bestellGebuehr', () => {
    for (const preis of [1, 99, 140, 450, 3800, 9999]) {
      const g = geldsaetzeFuer(angebot(preis), HOF, STICHTAG, null, NACH_STICHTAG)
      expect(g?.kundinCents).toBe(endpreisJeStueckCents(preis, satzHundertstel(HOF)))
    }
    const positionen = [
      { preisCents: 450, menge: 10 },
      { preisCents: 101, menge: 3 },
    ]
    const g = geldsaetzeFuer({ art: 'angebot', positionen }, HOF, STICHTAG, null, NACH_STICHTAG)
    const erwartet = bestellGebuehr(positionen, 600)
    expect(g?.hofCents).toBe(erwartet.warenCents)
    expect(g?.kundinCents).toBe(erwartet.gesamtCents)
  })

  it('nimmt den abweichenden Satz des Hofs (plattformgebuehrProzent 6,5 statt 6)', () => {
    const hof: GeldsatzHof = { plattformgebuehrProzent: '6.50', einzugAb: null }

    const g = geldsaetzeFuer(angebot(750), hof, STICHTAG, null, NACH_STICHTAG)

    // 7,50 × 6,5 % = 0,4875 → aufgerundet 0,49 (N38).
    expect(g?.kundinCents).toBe(799)
    expect(g?.satz).toBe(`Du bekommst €${NBSP}7,50 · die Kundin zahlt €${NBSP}7,99`)
    // Gegenprobe: mit der Vorgabe wären es 7,95.
    expect(geldsaetzeFuer(angebot(750), HOF, STICHTAG, null, NACH_STICHTAG)?.kundinCents).toBe(795)
  })

  it('„ab“ für eine Familie mit mehreren Größen', () => {
    const g = geldsaetzeFuer(angebot(250, true), HOF, STICHTAG, null, NACH_STICHTAG)
    expect(g?.satz).toBe(`Du bekommst ab €${NBSP}2,50 · die Kundin zahlt ab €${NBSP}2,65`)
  })

  it('Gründungshof vor dem Einzugsbeginn: Bar bis zum letzten Gründungstag ohne Gebühr', () => {
    const g = geldsaetzeFuer(angebot(750), HOF, STICHTAG, GRUENDUNG_BIS, NACH_STICHTAG)

    expect(g?.satz).toBe(`Du bekommst €${NBSP}7,50 · die Kundin zahlt €${NBSP}7,95`)
    expect(g?.barOhneGebuehr).toBe(`Bar bis 31.${NBSP}Jänner 2028 ohne Gebühr für dich.`)
  })

  it('Gründungshof ab dem Einzugsbeginn (Mitternacht Wien nach dem letzten Gründungstag): kein Bar-Satz mehr', () => {
    const letzteMinute = new Date('2028-01-31T22:59:00Z') // 31.1.2028, 23:59 Wien
    const einzug = new Date('2028-01-31T23:00:00Z') // 1.2.2028, 0:00 Wien

    expect(geldsaetzeFuer(angebot(750), HOF, STICHTAG, GRUENDUNG_BIS, letzteMinute)?.barOhneGebuehr).not.toBeNull()
    expect(geldsaetzeFuer(angebot(750), HOF, STICHTAG, GRUENDUNG_BIS, einzug)?.barOhneGebuehr).toBeNull()
  })

  it('ein im Admin gesetztes einzugAb gilt auch ohne Gründungsplatz', () => {
    const hof: GeldsatzHof = { plattformgebuehrProzent: null, einzugAb: new Date('2027-05-31T22:00:00Z') } // 1.6.2027 Wien

    const g = geldsaetzeFuer(angebot(750), hof, STICHTAG, null, NACH_STICHTAG)

    expect(g?.barOhneGebuehr).toBe(`Bar bis 31.${NBSP}Mai 2027 ohne Gebühr für dich.`)
  })

  it('vor dem Stichtag (Modell „bisher“): kein Geldsatz, auch nicht beim Gründungshof', () => {
    expect(geldsaetzeFuer(angebot(750), HOF, STICHTAG, null, VOR_STICHTAG)).toBeNull()
    expect(geldsaetzeFuer(angebot(750), HOF, STICHTAG, GRUENDUNG_BIS, VOR_STICHTAG)).toBeNull()
    // Genau am Stichtag gilt schon das Hofpreis-Modell.
    expect(geldsaetzeFuer(angebot(750), HOF, STICHTAG, null, STICHTAG.hofpreisModellAb)).not.toBeNull()
  })
})

describe('Geldsatz einer Bestellung (Snapshot)', () => {
  const bestellung = (
    paymentMethod: string,
    gebuehrEinzug: GebuehrEinzug | null,
    gebuehrModell: string | null = 'hofpreis',
    serviceFeeRefundedAt: Date | null = null
  ) => ({
    art: 'bestellung' as const,
    bestellung: { totalAmount: '18.00', serviceFeeCents: 112, paymentMethod, gebuehrModell, gebuehrEinzug, serviceFeeRefundedAt },
  })

  it('online: die Gebühr ist online einbehalten', () => {
    const g = geldsaetzeFuer(bestellung('ONLINE', 'stripe'), HOF, STICHTAG, null, NACH_STICHTAG)

    expect(g?.hofCents).toBe(1800)
    expect(g?.kundinCents).toBe(1912)
    expect(g?.satz).toBe(`Du bekommst €${NBSP}18,00 · die Kundin zahlt €${NBSP}19,12 – die Gebühr ist online einbehalten.`)
  })

  it('bar erlassen (Gründungshof): die vollen Euro bleiben beim Hof, Wort der Gebühr aus der Konstante', () => {
    const g = geldsaetzeFuer(bestellung('ONSITE_CASH', 'erlassen'), HOF, STICHTAG, GRUENDUNG_BIS, NACH_STICHTAG)

    expect(g?.hofCents).toBe(1912)
    expect(g?.satz).toBe(`Du bekommst die vollen €${NBSP}19,12 – bis 31.${NBSP}Jänner 2028 zahlst du auf Barverkäufe keine ${PLATTFORMGEBUEHR_BEZEICHNUNG}.`)
  })

  it('bar mit Einzug (kein Gründungshof): die Gebühr holt die Monatsabrechnung', () => {
    for (const einzug of ['sepa', 'ueberweisung'] as const) {
      const g = geldsaetzeFuer(bestellung('ONSITE_CASH', einzug), HOF, STICHTAG, null, NACH_STICHTAG)
      expect(g?.hofCents).toBe(1800)
      expect(g?.satz).toBe(`Du bekommst €${NBSP}18,00 · die Kundin zahlt €${NBSP}19,12 – die Gebühr holt die Monatsabrechnung.`)
    }
  })

  it('nimmt den Snapshot, nie den Satz des Hofs: ein anderer Satz ändert nichts', () => {
    const hof: GeldsatzHof = { plattformgebuehrProzent: '9', einzugAb: null }
    expect(geldsaetzeFuer(bestellung('ONLINE', 'stripe'), hof, STICHTAG, null, NACH_STICHTAG)?.kundinCents).toBe(1912)
  })

  it('entfallene Gebühr (erstattet bzw. nicht kassiert): kein Geldsatz — weder „die Kundin zahlt € 19,12“ noch die Monatsabrechnung', () => {
    const erstattet = new Date('2027-03-02T09:00:00Z')
    expect(geldsaetzeFuer(bestellung('ONLINE', 'stripe', 'hofpreis', erstattet), HOF, STICHTAG, null, NACH_STICHTAG)).toBeNull()
    for (const einzug of ['sepa', 'ueberweisung', 'erlassen'] as const) {
      expect(geldsaetzeFuer(bestellung('ONSITE_CASH', einzug, 'hofpreis', erstattet), HOF, STICHTAG, GRUENDUNG_BIS, NACH_STICHTAG)).toBeNull()
    }
    // Gegenprobe: dieselbe Bestellung ohne Erstattung hat ihren Satz.
    expect(geldsaetzeFuer(bestellung('ONLINE', 'stripe'), HOF, STICHTAG, null, NACH_STICHTAG)?.satz).toContain('19,12')
    expect(geldsaetzeFuer(bestellung('ONSITE_CASH', 'sepa'), HOF, STICHTAG, null, NACH_STICHTAG)?.satz).toContain('Monatsabrechnung')
  })

  it('Karte vor Ort zählt wie bar (istVorOrtZahlung): kein „online einbehalten“', () => {
    expect(geldsaetzeFuer(bestellung('ONSITE_CARD', 'sepa'), HOF, STICHTAG, null, NACH_STICHTAG)?.satz).toContain('Monatsabrechnung')
    expect(geldsaetzeFuer(bestellung('ONSITE_CARD', 'sepa'), HOF, STICHTAG, null, NACH_STICHTAG)?.satz).not.toContain('online')
  })

  it('erlassen, Frist schon vorbei (Gründungsende vorbei): Satz ohne Datum, nie „bis <vergangener Tag> zahlst du“', () => {
    const spaeter = new Date('2028-03-01T10:00:00Z') // nach dem 31. Jänner 2028
    const g = geldsaetzeFuer(bestellung('ONSITE_CASH', 'erlassen'), HOF, STICHTAG, GRUENDUNG_BIS, spaeter)

    expect(g?.hofCents).toBe(1912)
    expect(g?.satz).toBe(`Du bekommst die vollen €${NBSP}19,12 – für diesen Barverkauf zahlst du keine ${PLATTFORMGEBUEHR_BEZEICHNUNG}.`)
    expect(g?.satz).not.toContain(' bis ')
  })

  it('erlassen, einzugAb aus dem Admin: Datum aus den heutigen Hofdaten, vorbei → ohne Datum', () => {
    // Admin hat den Einzug auf den 1. März 2027 vorgezogen — der Tag ist am 3. März vorbei, obwohl gruendungBis 2028 wäre.
    const vorgezogen: GeldsatzHof = { plattformgebuehrProzent: null, einzugAb: new Date('2027-02-28T23:00:00Z') }
    const vorbei = geldsaetzeFuer(bestellung('ONSITE_CASH', 'erlassen'), vorgezogen, STICHTAG, GRUENDUNG_BIS, NACH_STICHTAG)
    expect(vorbei?.satz).toBe(`Du bekommst die vollen €${NBSP}19,12 – für diesen Barverkauf zahlst du keine ${PLATTFORMGEBUEHR_BEZEICHNUNG}.`)

    // Gegenprobe: einzugAb in der Zukunft (1. Mai 2027) → der letzte freie Tag davor im Satz.
    const kuenftig: GeldsatzHof = { plattformgebuehrProzent: null, einzugAb: new Date('2027-04-30T22:00:00Z') }
    const offen = geldsaetzeFuer(bestellung('ONSITE_CASH', 'erlassen'), kuenftig, STICHTAG, null, NACH_STICHTAG)
    expect(offen?.satz).toBe(`Du bekommst die vollen €${NBSP}19,12 – bis 30.${NBSP}April 2027 zahlst du auf Barverkäufe keine ${PLATTFORMGEBUEHR_BEZEICHNUNG}.`)
  })

  it('Bestellung im Modell „bisher“ (vor dem Stichtag bestellt): kein Geldsatz', () => {
    expect(geldsaetzeFuer(bestellung('ONLINE', null, null), HOF, STICHTAG, null, NACH_STICHTAG)).toBeNull()
    expect(geldsaetzeFuer(bestellung('ONSITE_CASH', null, null), HOF, STICHTAG, GRUENDUNG_BIS, NACH_STICHTAG)).toBeNull()
  })
})

describe('Wache: Prozent und Wort der Gebühr nie als fester Text in der Geldsatz-Hilfe', () => {
  const quelle = readFileSync(join(process.cwd(), 'src/lib/plattformgebuehr.ts'), 'utf8')
  const hilfe = quelle.slice(quelle.indexOf('export function geldsaetzeFuer'), quelle.indexOf('// ─── Mindestbestellwert-Satz'))
  const verboten = (text: string): string[] => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').match(/Plattformgebühr|Servicegebühr|\d+(?:,\d+)?\s?%/g) ?? []

  it('die Hilfe schreibt weder „Plattformgebühr“ noch einen Prozentsatz selbst', () => {
    expect(hilfe.length).toBeGreaterThan(200)
    expect(verboten(hilfe)).toEqual([])
  })

  it('Gegenprobe: ein fester Satz mit Wort und Prozent fällt auf, ein Kommentar nicht', () => {
    expect(verboten("satz: `keine Plattformgebühr (6 %)`")).toHaveLength(2)
    expect(verboten('// Plattformgebühr 6 %')).toEqual([])
  })
})

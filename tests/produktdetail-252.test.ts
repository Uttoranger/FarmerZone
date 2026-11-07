import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  raummassZeile,
  ausverkauftSatz,
  groessenAufsteigend,
  groessenVorrat,
  preisJeRaummass,
} from '@/components/produktdetail/groessen-anzeige'
import { RAUMMASS_ERKLAERUNG } from '@/lib/verkaufsgroessen'

/*
 * Produktseite nach der Abnahme Lauf 32 (Nr. 252, Liste lauf32-board-oder-code.md,
 * Abschnitt produkt): Reihenfolge der Größen, Vorrat in der Größenzeile (G5),
 * Raummaß ausgeschrieben, Satz der Ausverkauft-Karte, Varianten G5/G13 gesetzt
 * und die klebende Hofzeile mit Warenkorb (G9).
 */

const quelle = readFileSync('src/components/produktdetail/produktdetail-kunde.tsx', 'utf8')

describe('groessenAufsteigend', () => {
  it('ordnet klein nach groß über die Nettomenge (Big Bag → Sack → Lose wird Sack → Big Bag → Lose)', () => {
    const familie = [
      { id: 'bigbag', unitSize: null, futter: { nettoMenge: 500 } },
      { id: 'sack', unitSize: null, futter: { nettoMenge: 25 } },
      { id: 'lose', unitSize: null, futter: { nettoMenge: 1000 } },
    ]
    expect(groessenAufsteigend(familie).map((p) => p.id)).toEqual(['sack', 'bigbag', 'lose'])
  })

  it('nimmt ohne Futter die Gebindegröße, ohne Angabe ans Ende, und ist stabil bei Gleichstand', () => {
    const familie = [
      { id: 'ohne', unitSize: null, futter: null },
      { id: 'b', unitSize: 5, futter: null },
      { id: 'a', unitSize: 1, futter: null },
      { id: 'b2', unitSize: 5, futter: null },
    ]
    expect(groessenAufsteigend(familie).map((p) => p.id)).toEqual(['a', 'b', 'b2', 'ohne'])
  })

  it('ändert die übergebene Liste nicht', () => {
    const familie = [
      { id: 'x', unitSize: 2, futter: null },
      { id: 'y', unitSize: 1, futter: null },
    ]
    groessenAufsteigend(familie)
    expect(familie.map((p) => p.id)).toEqual(['x', 'y'])
  })
})

describe('groessenVorrat', () => {
  it('„14 da“, knapp „nur noch 3 da“, leer und ohne Vorrat nichts', () => {
    expect(groessenVorrat(14, 'normal', true)).toBe('14 da')
    expect(groessenVorrat(3, 'knapp', true)).toBe('nur noch 3 da')
    expect(groessenVorrat(0, 'ausverkauft', true)).toBeUndefined()
    expect(groessenVorrat(14, 'normal', false)).toBeUndefined()
  })
})

describe('preisJeRaummass', () => {
  it('schreibt Raummeter und Schüttraummeter aus, sonst null', () => {
    expect(preisJeRaummass(100.7, 'RAUMMETER', null)).toBe('€ 100,70 je Raummeter')
    expect(preisJeRaummass(80, 'SCHUETTRAUMMETER', 1)).toBe('€ 80,00 je Schüttraummeter')
    expect(preisJeRaummass(95, 'M3', null)).toBeNull()
    expect(preisJeRaummass(95, 'RAUMMETER', 2)).toBeNull()
  })

  it('die Erklärzeile kommt aus der einen Quelle RAUMMASS_ERKLAERUNG (wie im Brennmaterial-Formular)', () => {
    expect(raummassZeile(['KG', 'RAUMMETER'])).toBe(`${RAUMMASS_ERKLAERUNG[0].kurz} – ${RAUMMASS_ERKLAERUNG[0].text}`)
    expect(raummassZeile(['SCHUETTRAUMMETER'])).toBe(`${RAUMMASS_ERKLAERUNG[1].kurz} – ${RAUMMASS_ERKLAERUNG[1].text}`)
    // Gegenprobe: ohne Raummaß keine Zeile.
    expect(raummassZeile(['KG', 'STUECK'])).toBeNull()
  })
})

describe('ausverkauftSatz', () => {
  it('wörtlich nach der Liste', () => {
    expect(ausverkauftSatz('Hof Müller', 'Brennholz Buche')).toBe('Hof Müller hat gerade kein Brennholz Buche. Schau, was es sonst gibt.')
  })
})

describe('Produktseite (Quelle)', () => {
  it('setzt die Varianten G5 (zeile) und G13 (pille)', () => {
    expect(quelle).toMatch(/<GroessenWahl[^>]*form="zeile"/)
    expect(quelle).toMatch(/<Groessenkachel[\s\S]*?form="zeile"/)
    expect(quelle).toMatch(/<Stepper[\s\S]*?form="pille"/)
  })

  it('die Hofzeile klebt am Handy und trägt den Warenkorb (G9)', () => {
    expect(quelle).toContain('data-klebe-zeile=""')
    expect(quelle).toMatch(/sticky top-0[^"]*md:static/)
    expect(quelle).toContain('useWarenkorbKopf()')
    // Das Symbol hängt am Korb allein, nicht am Kaufen der Seite: Wer einen Korb hat, findet ihn nach dem Wegscrollen.
    expect(quelle).toMatch(/\{korbKopf && \(\s*<Link\s+href=\{korbKopf\.href\}/)
    expect(quelle).not.toMatch(/mitKorb && korbKopf/)
  })

  it('die Beschreibung steht nach den Größen, vor der Kennzeichnung', () => {
    const groessen = quelle.indexOf('Größe wählen')
    const beschreibung = quelle.indexOf('{beschreibung && <p')
    const kennzeichnung = quelle.indexOf('<Kennzeichnung')
    expect(groessen).toBeGreaterThan(0)
    expect(beschreibung).toBeGreaterThan(groessen)
    expect(kennzeichnung).toBeGreaterThan(beschreibung)
  })
})

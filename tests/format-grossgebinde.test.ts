/**
 * Tests für die Anzeige von Ballen und Big Bags (src/lib/format.ts, Sprint
 * Bereiche 1).
 *
 * Beweist: Das Bestandsfeld heißt „Bestand (Ballen)" bzw. „Bestand (Big
 * Bags)"; das Gewicht darunter ist stock × nettoMenge, nie fest codiert; der
 * Kilopreis wird aus Gebindepreis ÷ Nettomenge vorgerechnet.
 */
import { describe, it, expect } from 'vitest'
import {
  bestandLabel,
  einheitLabel,
  formatGrundpreisNetto,
  formatNettoBestand,
  formatZahl,
} from '@/lib/format'

describe('bestandLabel bei Großgebinden', () => {
  it('Ballen und Big Bags zählen Gebinde', () => {
    expect(bestandLabel('BALLEN')).toBe('Bestand (Ballen)')
    expect(bestandLabel('BIGBAG')).toBe('Bestand (Big Bags)')
  })

  it('die übrigen Einheiten bleiben wie bisher', () => {
    expect(bestandLabel('KG')).toBe('Bestand (kg)')
    expect(bestandLabel('KG', 2)).toBe('Bestand (Pakete)')
  })

  it('Einheitenkürzel mit Plural', () => {
    expect(einheitLabel('BALLEN', 3)).toBe('Ballen')
    expect(einheitLabel('BIGBAG')).toBe('Big Bag')
    expect(einheitLabel('BIGBAG', 2)).toBe('Big Bags')
  })
})

describe('formatNettoBestand', () => {
  it('10 Ballen à 300 kg ergeben 3.000 kg — gerechnet, nicht hinterlegt', () => {
    expect(formatNettoBestand(10, 300, 'KG')).toBe(`${formatZahl(3000)} kg`)
  })

  it('ändert sich mit der Nettomenge', () => {
    expect(formatNettoBestand(10, 250, 'KG')).toBe(`${formatZahl(2500)} kg`)
  })

  it('Liter und Decimal-artige Mengen', () => {
    expect(formatNettoBestand(2, { toString: () => '1000.000' }, 'LITER')).toBe(`${formatZahl(2000)} L`)
  })

  it('krumme Mengen ohne Float-Rest', () => {
    expect(formatNettoBestand(3, 0.1, 'KG')).toBe(`${formatZahl(0.3)} kg`)
  })

  it('ohne brauchbare Nettomenge oder Bestand: null', () => {
    expect(formatNettoBestand(10, null, 'KG')).toBeNull()
    expect(formatNettoBestand(10, Number.NaN, 'KG')).toBeNull()
    expect(formatNettoBestand(10, 0, 'KG')).toBeNull()
    expect(formatNettoBestand(Number.NaN, 300, 'KG')).toBeNull()
    expect(formatNettoBestand(-1, 300, 'KG')).toBeNull()
  })

  it('Bestand 0 ist „0 kg", nicht leer', () => {
    expect(formatNettoBestand(0, 300, 'KG')).toBe('0 kg')
  })
})

describe('formatGrundpreisNetto', () => {
  it('€ 45,00 für 300 kg → € 0,15 / kg', () => {
    expect(formatGrundpreisNetto(45, 300, 'KG')).toBe('€ 0,15 / kg')
  })

  it('Liter', () => {
    expect(formatGrundpreisNetto(12, 10, 'LITER')).toBe('€ 1,20 / L')
  })

  it('rundet auf den Cent', () => {
    expect(formatGrundpreisNetto(10, 3, 'KG')).toBe('€ 3,33 / kg')
  })

  it('ohne Preis oder Menge: null', () => {
    expect(formatGrundpreisNetto(Number.NaN, 300, 'KG')).toBeNull()
    expect(formatGrundpreisNetto(0, 300, 'KG')).toBeNull()
    expect(formatGrundpreisNetto(45, null, 'KG')).toBeNull()
    expect(formatGrundpreisNetto(45, Number.NaN, 'KG')).toBeNull()
  })
})

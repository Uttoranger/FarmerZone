/**
 * Die Brennmaterial-Saison der Startseite (src/lib/brennmaterial-saison.ts).
 *
 * Beweist:
 *  - Oktober bis März zeigt das Band, April bis September nicht — für jeden
 *    Monat geprüft.
 *  - Die Grenzen liegen um Mitternacht WIENER Zeit, nicht UTC: Sommerzeit
 *    (1. Oktober, UTC+2) und Winterzeit (1. April nach der Umstellung, UTC+2;
 *    Jahreswechsel UTC+1) — je eine Minute davor und danach.
 */
import { describe, it, expect } from 'vitest'
import { BRENNMATERIAL_SAISON_TEXT, istBrennmaterialSaison } from '@/lib/brennmaterial-saison'

/** Mitte eines Monats um 12:00 UTC — weit weg von jeder Grenze. */
const monatsmitte = (jahr: number, monat: number) => new Date(Date.UTC(jahr, monat - 1, 15, 12, 0))

describe('istBrennmaterialSaison', () => {
  it('zeigt das Band von Oktober bis März', () => {
    for (const monat of [10, 11, 12, 1, 2, 3]) {
      expect(istBrennmaterialSaison(monatsmitte(2026, monat)), `Monat ${monat}`).toBe(true)
    }
  })

  it('zeigt es von April bis September nicht', () => {
    for (const monat of [4, 5, 6, 7, 8, 9]) {
      expect(istBrennmaterialSaison(monatsmitte(2026, monat)), `Monat ${monat}`).toBe(false)
    }
  })

  it('beginnt am 1. Oktober um Mitternacht Wiener Zeit (Sommerzeit, UTC+2)', () => {
    // 30.09. 23:59 in Wien = 30.09. 21:59 UTC; 01.10. 00:00 in Wien = 30.09. 22:00 UTC.
    expect(istBrennmaterialSaison(new Date('2026-09-30T21:59:00Z'))).toBe(false)
    expect(istBrennmaterialSaison(new Date('2026-09-30T22:00:00Z'))).toBe(true)
  })

  it('endet am 1. April um Mitternacht Wiener Zeit (nach der Umstellung, UTC+2)', () => {
    // 31.03.2027 23:59 in Wien = 21:59 UTC; 01.04. 00:00 in Wien = 31.03. 22:00 UTC.
    expect(istBrennmaterialSaison(new Date('2027-03-31T21:59:00Z'))).toBe(true)
    expect(istBrennmaterialSaison(new Date('2027-03-31T22:00:00Z'))).toBe(false)
  })

  it('läuft über den Jahreswechsel weiter (Winterzeit, UTC+1)', () => {
    expect(istBrennmaterialSaison(new Date('2026-12-31T22:59:00Z'))).toBe(true)
    expect(istBrennmaterialSaison(new Date('2026-12-31T23:00:00Z'))).toBe(true)
  })

  it('der UTC-Monat entscheidet nicht: 01.10. 00:30 in Wien ist in UTC noch September', () => {
    const zeitpunkt = new Date('2026-09-30T22:30:00Z')
    expect(zeitpunkt.getUTCMonth() + 1).toBe(9)
    expect(istBrennmaterialSaison(zeitpunkt)).toBe(true)
  })

  it('die Marke nennt die Saison', () => {
    expect(BRENNMATERIAL_SAISON_TEXT).toBe('Saison Oktober bis März')
  })
})

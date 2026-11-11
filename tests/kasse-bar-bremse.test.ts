/**
 * Die Regeln der Bremse für Bar-Bestellungen (Nr. 287), rein und ohne
 * Datenbank — Zählung und Verdrahtung prüft
 * tests/integration/kasse-bar-bremse.int.test.ts.
 *
 * Beweist:
 *  - Grenzwerte: je Adresse 3 unbestätigte, je Hof 15, je IP 10 in der Stunde.
 *  - `barBremse` bremst ab der 4. (Adresse) bzw. 16. (Hof); genau an der Grenze nicht.
 *  - Ohne Hof-Grenze (Startsatz fehlt) zählt der Hof nie.
 *  - Der Satz verrät nichts über offene Bestellungen und zeigt nur dann auf
 *    online, wenn der Hof online annimmt.
 */
import { describe, expect, it } from 'vitest'
import {
  BAR_GEBREMST_SATZ,
  BAR_GEBREMST_SATZ_ONLINE,
  BAR_UNBESTAETIGT_JE_ADRESSE,
  BAR_UNBESTAETIGT_JE_HOF,
  CODE_BAR_GEBREMST,
  DB_BREMSEN,
  barBremse,
  barGebremstSatz,
} from '@/lib/bremse-datenbank'

describe('Grenzwerte der Bremse für Bar-Bestellungen', () => {
  it('je Adresse 3, je Hof 15 unbestätigte; je IP 10 neue in der Stunde', () => {
    expect(BAR_UNBESTAETIGT_JE_ADRESSE).toBe(3)
    expect(BAR_UNBESTAETIGT_JE_HOF).toBe(15)
    expect(DB_BREMSEN.barBestellungIp).toEqual({ zweck: 'bar-bestellung-ip', max: 10, fensterMs: 60 * 60 * 1000 })
    expect(CODE_BAR_GEBREMST).toBe('BAR_GEBREMST')
  })

  it('die Grenze der Kasse (20 je Minute) bleibt', () => {
    expect(DB_BREMSEN.checkoutIp).toMatchObject({ max: 20, fensterMs: 60_000 })
  })
})

describe('barBremse', () => {
  it('bremst ab der 4. unbestätigten Bar-Bestellung einer Adresse, an der Grenze nicht', () => {
    expect(barBremse({ unbestaetigtAdresse: 2, unbestaetigtHof: 0, mitHofGrenze: true })).toBeNull()
    expect(barBremse({ unbestaetigtAdresse: 3, unbestaetigtHof: 0, mitHofGrenze: true })).toBe('adresse')
    expect(barBremse({ unbestaetigtAdresse: 9, unbestaetigtHof: 0, mitHofGrenze: false })).toBe('adresse')
  })

  it('bremst ab der 16. unbestätigten am Hof, an der Grenze nicht', () => {
    expect(barBremse({ unbestaetigtAdresse: 0, unbestaetigtHof: 14, mitHofGrenze: true })).toBeNull()
    expect(barBremse({ unbestaetigtAdresse: 0, unbestaetigtHof: 15, mitHofGrenze: true })).toBe('hof')
  })

  it('ohne Hof-Grenze (Startsatz fehlt) zählt der Hof nie', () => {
    expect(barBremse({ unbestaetigtAdresse: 0, unbestaetigtHof: 500, mitHofGrenze: false })).toBeNull()
  })

  it('eine leere Zählung (0) bremst nie', () => {
    expect(barBremse({ unbestaetigtAdresse: 0, unbestaetigtHof: 0, mitHofGrenze: true })).toBeNull()
  })
})

describe('barGebremstSatz', () => {
  it('nimmt der Hof online an, zeigt der Satz auf online; sonst nur „später“', () => {
    expect(barGebremstSatz(true)).toBe(BAR_GEBREMST_SATZ_ONLINE)
    expect(barGebremstSatz(false)).toBe(BAR_GEBREMST_SATZ)
    expect(BAR_GEBREMST_SATZ).toBe('Bar bestellen geht gerade nicht. Bitte versuch es später noch einmal.')
    expect(BAR_GEBREMST_SATZ_ONLINE).toBe('Bar bestellen geht gerade nicht. Bezahl online oder versuch es später noch einmal.')
  })

  it('verrät nicht, dass zu einer Adresse offene Bestellungen bestehen, und bittet um keine Bestätigung', () => {
    for (const satz of [BAR_GEBREMST_SATZ, BAR_GEBREMST_SATZ_ONLINE]) {
      expect(satz).not.toMatch(/offen|bestätig|Adresse|E-Mail/i)
    }
  })
})

/**
 * Die Zustellung des Admin-Postfachs (Register N14, Nr. 95) — rein, ohne Mock:
 * Regeln aus der Json-Spalte (fehlt/kaputt → heutiges Verhalten), die EINE
 * Empfänger-Funktion (SUPPORT_EMAIL fest, nur bestätigte Adressen,
 * „Erstattung offen" ignoriert „aus"), die Frist des Links beim Lesen.
 */
import { describe, it, expect } from 'vitest'
import { SUPPORT_EMAIL } from '@/lib/support'
import {
  BESTAETIGUNG_GUELTIG_MS,
  TOKEN_MUSTER,
  ZUSTELL_ARTEN,
  ZUSTELL_REGEL_REIHENFOLGE,
  ZUSTELL_STANDARD,
  bestaetigenPfad,
  empfaengerFuer,
  empfaengerZustand,
  regelAn,
  tokenBisAb,
  zustellRegelnAus,
  type ZustellRegeln,
} from '@/lib/zustellung'

const ALLES_AUS: ZustellRegeln = { fehlermeldung: false, hofWartet: false, antwortHof: false, wochenbericht: false }

describe('zustellRegelnAus', () => {
  it('ohne gespeicherte Regeln gilt das heutige Verhalten: alles an', () => {
    expect(zustellRegelnAus(null)).toEqual(ZUSTELL_STANDARD)
    expect(zustellRegelnAus(undefined)).toEqual(ZUSTELL_STANDARD)
    expect(ZUSTELL_STANDARD).toEqual({ fehlermeldung: true, hofWartet: true, antwortHof: true, wochenbericht: true })
  })

  it('übernimmt gespeicherte Schalter und ergänzt fehlende mit dem Standard', () => {
    expect(zustellRegelnAus({ antwortHof: false })).toEqual({ ...ZUSTELL_STANDARD, antwortHof: false })
  })

  it('kaputte Werte stoppen keine Mail: falscher Typ, Text statt Objekt, Liste', () => {
    expect(zustellRegelnAus({ fehlermeldung: 'nein', wochenbericht: 0 })).toEqual(ZUSTELL_STANDARD)
    expect(zustellRegelnAus('aus')).toEqual(ZUSTELL_STANDARD)
    expect(zustellRegelnAus([false])).toEqual(ZUSTELL_STANDARD)
  })

  it('ein gespeichertes „Erstattung offen: aus" gibt es nicht — es fällt weg', () => {
    expect(zustellRegelnAus({ erstattungOffen: false, ...ALLES_AUS })).toEqual(ALLES_AUS)
  })
})

describe('empfaengerFuer', () => {
  const bestaetigte = ['team@example.com', 'Stall@Example.com ']

  it('Regel an: SUPPORT_EMAIL fest und zuerst, dazu die bestätigten Adressen klein geschrieben', () => {
    expect(empfaengerFuer('fehlermeldung', { regeln: ZUSTELL_STANDARD, bestaetigte })).toEqual([SUPPORT_EMAIL, 'team@example.com', 'stall@example.com'])
  })

  it('ohne weitere Adresse nur SUPPORT_EMAIL — so wie bisher', () => {
    expect(empfaengerFuer('hofWartet', { regeln: ZUSTELL_STANDARD, bestaetigte: [] })).toEqual([SUPPORT_EMAIL])
  })

  it('Regel aus: niemand bekommt eine Mail', () => {
    for (const art of ['fehlermeldung', 'hofWartet', 'antwortHof', 'wochenbericht'] as const) {
      expect(empfaengerFuer(art, { regeln: ALLES_AUS, bestaetigte })).toEqual([])
    }
  })

  it('„Erstattung offen" geht trotz Regel „aus" an die ganze Liste — Geld der Kundin', () => {
    expect(empfaengerFuer('erstattungOffen', { regeln: ALLES_AUS, bestaetigte })).toEqual([SUPPORT_EMAIL, 'team@example.com', 'stall@example.com'])
  })

  it('Wünsche und Fragen gehen nie sofort hinaus — sie bleiben im Eingang', () => {
    expect(empfaengerFuer('wunschFrage', { regeln: ZUSTELL_STANDARD, bestaetigte })).toEqual([])
  })

  it('jede Adresse höchstens einmal, auch wenn SUPPORT_EMAIL selbst bestätigt wäre', () => {
    expect(empfaengerFuer('hofWartet', { regeln: ZUSTELL_STANDARD, bestaetigte: [SUPPORT_EMAIL.toUpperCase(), 'a@example.com', 'a@example.com'] })).toEqual([
      SUPPORT_EMAIL,
      'a@example.com',
    ])
  })

  it('jede Art hat eine Regel und eine Zeile im Formular', () => {
    expect([...ZUSTELL_REGEL_REIHENFOLGE].sort()).toEqual([...ZUSTELL_ARTEN].sort())
    for (const art of ZUSTELL_ARTEN) expect(typeof regelAn(art, ZUSTELL_STANDARD)).toBe('boolean')
  })
})

describe('empfaengerZustand (Frist beim Lesen)', () => {
  const jetzt = new Date('2026-10-15T10:00:00Z')

  it('bestätigt bleibt bestätigt, auch mit altem Ablauf', () => {
    expect(empfaengerZustand({ bestaetigtAm: new Date('2026-10-01T00:00:00Z'), tokenBis: new Date('2026-10-03T00:00:00Z') }, jetzt)).toBe('bestaetigt')
  })

  it('der Link gilt genau 48 Stunden: eine Millisekunde davor ausstehend, genau am Ende abgelaufen', () => {
    const angelegt = new Date(jetzt.getTime() - BESTAETIGUNG_GUELTIG_MS)
    const bis = tokenBisAb(angelegt)
    expect(bis.getTime()).toBe(jetzt.getTime())
    expect(empfaengerZustand({ bestaetigtAm: null, tokenBis: new Date(jetzt.getTime() + 1) }, jetzt)).toBe('ausstehend')
    expect(empfaengerZustand({ bestaetigtAm: null, tokenBis: bis }, jetzt)).toBe('abgelaufen')
  })

  it('ohne Link (eingelöst oder nie gesetzt) und unbestätigt: abgelaufen', () => {
    expect(empfaengerZustand({ bestaetigtAm: null, tokenBis: null }, jetzt)).toBe('abgelaufen')
  })
})

describe('Link der Bestätigungsmail', () => {
  it('trägt den Token als Abfrage unter Postfach › Zustellung', () => {
    expect(bestaetigenPfad('a'.repeat(43))).toBe(`/admin/postfach/zustellung/bestaetigen?token=${'a'.repeat(43)}`)
  })

  it('das Muster nimmt genau 43 Zeichen base64url', () => {
    expect(TOKEN_MUSTER.test('A-_'.repeat(14) + 'x')).toBe(true)
    expect(TOKEN_MUSTER.test('a'.repeat(42))).toBe(false)
    expect(TOKEN_MUSTER.test('a'.repeat(44))).toBe(false)
    expect(TOKEN_MUSTER.test('a'.repeat(42) + '=')).toBe(false)
  })
})

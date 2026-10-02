/**
 * Tests für den Werte-Katalog (src/lib/hof-werte.ts).
 *
 * Beweist:
 *  - Ein gewählter Wert wird am Titel erkannt — auch ein älterer, der in
 *    `FarmValue.icon` noch ein Emoji trägt. Sonst stünde er im Editor als
 *    nicht gewählt da, und ein Tipp legte ihn doppelt an.
 *  - Neue Werte tragen einen Schlüssel, der in die Spalte passt (Zod: höchstens
 *    10 Zeichen, src/schemas/auftritt.ts).
 *  - Ein Wert außerhalb des Katalogs hat keinen Eintrag (die Komponente zeigt
 *    dann einen Haken).
 */
import { describe, it, expect } from 'vitest'
import { WERTE_KATALOG, istGewaehlt, katalogEintrag } from '@/lib/hof-werte'

const TIERWOHL = WERTE_KATALOG[0]

describe('Werte-Katalog', () => {
  it('erkennt einen älteren Wert mit Emoji im icon-Feld am Titel', () => {
    const gespeichert = [{ icon: '\u{1F404}', title: 'Tierwohl' }]
    expect(istGewaehlt(gespeichert, TIERWOHL)).toBe(true)
    expect(katalogEintrag(gespeichert[0])).toEqual(TIERWOHL)
  })

  it('erkennt einen neuen Wert mit Schlüssel im icon-Feld', () => {
    const neu = [{ icon: 'tierwohl', title: 'Tierwohl' }]
    expect(istGewaehlt(neu, TIERWOHL)).toBe(true)
  })

  it('ein anderer Titel ist nicht gewählt', () => {
    const anderer = [{ icon: 'bio', title: 'Bio-zertifiziert' }]
    expect(istGewaehlt(anderer, TIERWOHL)).toBe(false)
    expect(istGewaehlt([], TIERWOHL)).toBe(false)
  })

  it('ein Wert außerhalb des Katalogs hat keinen Eintrag', () => {
    expect(katalogEintrag({ title: 'Eigene Imkerei' })).toBeNull()
  })

  it('Schlüssel und Titel sind eindeutig, die Schlüssel passen in die Spalte', () => {
    const schluessel = WERTE_KATALOG.map((k) => k.schluessel)
    const titel = WERTE_KATALOG.map((k) => k.titel)
    expect(new Set(schluessel).size).toBe(schluessel.length)
    expect(new Set(titel).size).toBe(titel.length)
    for (const s of schluessel) expect(s.length, s).toBeLessThanOrEqual(10)
  })
})

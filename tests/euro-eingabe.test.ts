/**
 * `euroEingabeZuCent` (src/lib/format.ts, Nr. 32, Morgenbericht Lauf 5 §5):
 * Ein getippter Euro-Betrag („1,50", „1.5", „0,5") wird zu ganzen Cent —
 * über die Ziffern, nie über `Math.round(Number(text) * 100)`. Gedacht für die
 * Mindestgebühr im Servicegebühr-Dialog des Admins.
 *
 * Aussage: Komma und Punkt gelten, höchstens zwei Nachkommastellen, nichts
 * wird still gerundet; alles andere ist `null` (der Dialog sagt dann einen Satz).
 */
import { describe, it, expect } from 'vitest'
import { euroEingabeZuCent } from '@/lib/format'

describe('euroEingabeZuCent — gültige Beträge', () => {
  it.each([
    ['1,50', 150],
    ['1.5', 150],
    ['0,5', 50],
    ['0.50', 50],
    ['2', 200],
    ['0', 0],
    ['0,00', 0],
    [',5', 50],
    ['.05', 5],
    ['3,', 300],
    ['1000', 100_000],
    [' 1,50 ', 150],
  ])('„%s" → %i Cent', (eingabe, cent) => {
    expect(euroEingabeZuCent(eingabe)).toBe(cent)
  })

  it('ohne Gleitkomma-Fehler: 0,29 · 1,15 · 4,35 · 19,99 wären als Zahl krumm', () => {
    // Als Fließkomma: 0.29 * 100 = 28.999999999999996, 4.35 * 100 = 434.99999999999994
    expect(euroEingabeZuCent('0,29')).toBe(29)
    expect(euroEingabeZuCent('1,15')).toBe(115)
    expect(euroEingabeZuCent('4,35')).toBe(435)
    expect(euroEingabeZuCent('19,99')).toBe(1999)
  })

  it('Gegenprobe: der alte Weg über Number liegt ohne Rundung daneben', () => {
    expect(Number('0.29') * 100).not.toBe(29)
  })
})

describe('euroEingabeZuCent — abgelehnt (null)', () => {
  it.each([
    [''],
    ['   '],
    ['abc'],
    ['-1'],
    ['+1'],
    ['1,555'],
    ['1.000,50'],
    ['1,2,3'],
    ['1e2'],
    ['1 5'],
    ['€ 1,50'],
    ['Infinity'],
    ['NaN'],
    ['99999999999999999999'],
  ])('„%s"', (eingabe) => {
    expect(euroEingabeZuCent(eingabe)).toBeNull()
  })
})

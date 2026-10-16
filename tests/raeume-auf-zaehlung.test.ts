/**
 * Die Zählung in `raeumeAuf` (tests/integration/setup/basis.ts, Rechnung in `zaehlung.ts`).
 *
 * Ursache: Better Auth vergibt Kennungen ohne `int-`. Eine Zeile, die mit ON DELETE SET NULL an einem Konto
 * hängt, blieb nach dem Löschen des Kontos liegen — ein Rundschreiben stand in der Test-DB, und kein Test
 * merkte es. `raeumeAuf` zählt deshalb vor und nach dem Aufräumen die Zeilen aller Tabellen mit Fremdschlüssel
 * auf ein Konto oder einen Hof und bricht ab, wenn von denen, die vorher an Test-Konten oder -Höfen hingen,
 * nachher etwas steht.
 *
 * Beweist (reine Rechnung, ohne Datenbank): Die Zählung schlägt an, wenn Zeilen eines Test-Kontos stehen bleiben
 * — auch nur eine —, und nicht, wenn alle weg sind, wenn die Tabelle Zeilen fremder Konten behält oder wenn
 * sie vorher nichts an Test-Konten hängen hatte. Eine Ausnahme (`BLEIBT_LIEGEN`) nimmt nur ihre Tabelle aus.
 * Die Zählung gegen die echte Datenbank läuft mit jedem Aufruf von `raeumeAuf` in der Integrationsschicht.
 */
import { describe, expect, it } from 'vitest'
import { BLEIBT_LIEGEN, liegengebliebene, type Zaehlung } from './integration/setup/zaehlung'

const zaehlung = (eintraege: Record<string, [gesamt: number, haengt: number]>): Zaehlung =>
  new Map(Object.entries(eintraege).map(([tabelle, [gesamt, haengt]]) => [tabelle, { gesamt, haengt }]))

describe('Zählung in raeumeAuf — was nach dem Aufräumen liegen bleibt', () => {
  it('schlägt an, wenn Zeilen eines Test-Kontos stehen bleiben — das Rundschreiben ohne int-Kennung', () => {
    const vorher = zaehlung({ '"Rundschreiben"': [5, 1], '"Order"': [10, 2] })
    // Das Konto ist weg, das Rundschreiben (ON DELETE SET NULL) steht noch; die Bestellungen sind gelöscht.
    const nachher = zaehlung({ '"Rundschreiben"': [5, 0], '"Order"': [8, 0] })
    expect(liegengebliebene(vorher, nachher)).toEqual(['"Rundschreiben": 1'])
  })

  it('zählt jede liegen gebliebene Zeile und jede Tabelle', () => {
    const vorher = zaehlung({ a: [10, 4], b: [3, 3], c: [0, 0] })
    const nachher = zaehlung({ a: [8, 0], b: [2, 0], c: [0, 0] })
    expect(liegengebliebene(vorher, nachher)).toEqual(['a: 2', 'b: 2'])
  })

  it('lässt durch, wenn alles weg ist, was an Test-Konten hing — auch bei Zeilen fremder Konten daneben', () => {
    const vorher = zaehlung({ a: [10, 4], b: [3, 3], c: [7, 0] })
    expect(liegengebliebene(vorher, zaehlung({ a: [6, 0], b: [0, 0], c: [7, 0] }))).toEqual([])
    // Weniger als erwartet ist kein Fehler dieser Prüfung (ein anderer Lauf hat aufgeräumt).
    expect(liegengebliebene(vorher, zaehlung({ a: [5, 0], b: [0, 0], c: [6, 0] }))).toEqual([])
  })

  it('eine Tabelle ohne Bezug zu Test-Konten schlägt nie an, solange nichts Fremdes dazukommt', () => {
    expect(liegengebliebene(zaehlung({ a: [4, 0] }), zaehlung({ a: [4, 0] }))).toEqual([])
  })

  it('eine Ausnahme nimmt nur ihre Tabelle aus, und die Liste ist leer, solange es keinen begründeten Fall gibt', () => {
    const vorher = zaehlung({ a: [5, 1], b: [5, 1] })
    const nachher = zaehlung({ a: [5, 0], b: [5, 0] })
    expect(liegengebliebene(vorher, nachher, { a: 'bleibt aus gutem Grund liegen' })).toEqual(['b: 1'])
    expect(BLEIBT_LIEGEN).toEqual({})
  })
})

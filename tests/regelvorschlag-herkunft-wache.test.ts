/**
 * Wache: Jeder Regelvorschlag in docs/nachtlauf.md nennt sein Datum (Nr. 136, Punkt 1 „Herkunft (Nr., Datum
 * 21.10.2026)“; Nachbesserung Runde 1).
 *
 * Ursache: Die Sätze 122, 123, 124 und 129 standen ohne Datum in der Doku, obwohl die Freigabe „Herkunft mit
 * Datum“ verlangt; erst der pruefer fiel darüber. Ohne Datum lässt sich später nicht mehr sagen, aus welchem
 * Morgenbericht ein Satz stammt und ob er vor oder nach einer Änderung des Registers entstand.
 *
 * Beweist (Quelltext von docs/nachtlauf.md): Jede Klammer, die mit „Regelvorschlag“ beginnt, enthält ein Datum
 * der Form TT.MM.JJJJ. Wer eine Herkunft in dieser Klammer schreibt, schreibt auch das Datum.
 *
 * Gegenprobe: Eine Klammer ohne Datum wird mit Zeile gefunden; eine mit Datum, ein Wort „Regelvorschlag“
 * außerhalb einer Klammer und eine Klammer mit anderem Anfang werden nicht gefunden.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Ein Datum wie 21.10.2026 oder 5.1.2027. */
const DATUM = /\b\d{1,2}\.\d{1,2}\.\d{4}\b/

/** Klammern, die mit „Regelvorschlag“ beginnen und kein Datum tragen — mit Zeile und Text. */
function herkunftOhneDatum(text: string): Array<{ zeile: number; klammer: string }> {
  const funde: Array<{ zeile: number; klammer: string }> = []
  text.split('\n').forEach((zeile, i) => {
    for (const treffer of zeile.matchAll(/\(Regelvorschlag[^)]*\)/g)) {
      if (!DATUM.test(treffer[0])) funde.push({ zeile: i + 1, klammer: treffer[0] })
    }
  })
  return funde
}

describe('Regelvorschlag-Herkunft in docs/nachtlauf.md', () => {
  it('jede Klammer „(Regelvorschlag …)“ trägt ein Datum', () => {
    const text = readFileSync(join(process.cwd(), 'docs/nachtlauf.md'), 'utf8')
    expect(text).toContain('(Regelvorschlag ')
    expect(herkunftOhneDatum(text)).toEqual([])
  })

  it('Gegenprobe: findet eine Klammer ohne Datum und lässt die übrigen Fälle durch', () => {
    expect(herkunftOhneDatum('Erster Satz.\nDer Satz (Regelvorschlag 122) steht ohne Datum da.')).toEqual([
      { zeile: 2, klammer: '(Regelvorschlag 122)' },
    ])
    expect(herkunftOhneDatum('Der Satz (Regelvorschlag 127, 21.10.2026) trägt es.')).toEqual([])
    expect(herkunftOhneDatum('(Regelvorschlag 73 aus Lauf 11, freigegeben 13.10.2026)')).toEqual([])
    expect(herkunftOhneDatum('Jeder Regelvorschlag. Messtabellen nur, wo sie verlangt sind.')).toEqual([])
    expect(herkunftOhneDatum('(Dirigent, Morgenbericht 17, freigegeben 19.10.2026)')).toEqual([])
  })
})

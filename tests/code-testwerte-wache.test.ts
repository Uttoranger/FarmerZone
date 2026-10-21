/**
 * Testwerte für Codes (Freigabe Lauf 18 §2; Nr. 115, Nachbesserung Runde 1).
 *
 * Ursache: Ersatzcodes und der E-Mail-Code der Einrichtung standen als Testwerte
 * mit Ziffern in Tests (ein Ersatzcode mit Ziffer, sechs Ziffern als Mail-Code).
 * Regel: Kein Code und kein Ersatzcode in Tests, außer erfundenen Werten aus
 * Buchstaben. Braucht ein Test einen Code aus Ziffern, entsteht er erst zur
 * Laufzeit (erzeugt oder aus der Attrappe der Post abgeleitet).
 *
 * Beweist (Dateiarbeit, kein Netz): Keine Testdatei, die Ersatzcodes oder den
 * Code der Einrichtung berührt, schreibt einen Wert in Form eines Ersatzcodes
 * mit Ziffer oder sechs Ziffern in Anführungszeichen. Gegenprobe: eingeschmuggelte
 * Werte (die Ziffer kommt erst zur Laufzeit dazu) schlagen an, Werte aus
 * Buchstaben, Kennungen und Jahreszahlen nicht.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const WURZEL = process.cwd()
const DIESE_DATEI = 'tests/code-testwerte-wache.test.ts'
const THEMA = /ersatzcode|einrichtungscode/i
// Form eines Ersatzcodes in Anführungszeichen: XXXX-XXXX, getippt auch mit Leerzeichen;
// ohne Trenner nur in Großbuchstaben (sonst träfe es jede Kennung mit acht Zeichen).
const ERSATZ_FORM = /(['"`])\s*([A-Za-z0-9]{4}[- ][A-Za-z0-9]{4}|[A-Z0-9]{8})\s*\1/g
const SECHS_ZIFFERN = /(['"`])\d{6}\1/g

function funde(text: string): string[] {
  const treffer: string[] = []
  for (const m of text.matchAll(ERSATZ_FORM)) if (/\d/.test(m[2])) treffer.push(m[0])
  for (const m of text.matchAll(SECHS_ZIFFERN)) treffer.push(m[0])
  return treffer
}

function testdateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return testdateien(pfad)
    return pfad.endsWith('.ts') ? [pfad] : []
  })
}

describe('Testwerte für Codes', () => {
  it('keine Testdatei zu Ersatzcodes oder Einrichtungscode schreibt einen Code mit Ziffern', () => {
    const verstoesse: string[] = []
    let geprueft = 0
    for (const pfad of testdateien(join(WURZEL, 'tests'))) {
      const datei = relative(WURZEL, pfad).split(sep).join('/')
      if (datei === DIESE_DATEI) continue
      const text = readFileSync(pfad, 'utf8')
      if (!THEMA.test(text)) continue
      geprueft++
      for (const fund of funde(text)) verstoesse.push(`${datei}: ${fund}`)
    }
    // Die Dateien der Nr. 115 (Einheit, Mail, Integration) sind dabei — sonst prüfte die Wache nichts.
    expect(geprueft).toBeGreaterThanOrEqual(4)
    expect(verstoesse).toEqual([])
  }, 30_000)

  it('Gegenprobe: ein Code mit Ziffer schlägt an, Werte aus Buchstaben nicht', () => {
    const z = String(7)
    expect(funde(`f('JME${z}-QUFD')`)).toHaveLength(1)
    expect(funde(`f(' jme${z} qufd ')`)).toHaveLength(1)
    expect(funde(`f("JME${z}QUFD")`)).toHaveLength(1)
    expect(funde(`{ code: '${z.repeat(6)}' }`)).toHaveLength(1)
    expect(funde("f('JMEA-QUFD', ' jmea qufd ', 'AAAA-AAAA', 'konto-a', 'sitzung1', '2026', `x`)")).toEqual([])
  })
})

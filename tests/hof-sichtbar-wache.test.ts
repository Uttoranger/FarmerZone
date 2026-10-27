/**
 * Wache am Quelltext (Register N36, Nachtlauf Nr. 190): Jeder Leser der
 * Sichtbarkeit eines Hofs fragt EINE Quelle (src/lib/hof-sichtbar.ts) — ein
 * geschlossenes Konto (`geschlossenAm`) ist offline wie ein stillgelegter Hof
 * (`archivedAt`). Fragte ein Weg der Kundschaft nur `archivedAt`, wäre die
 * Hofseite eines geschlossenen Kontos dort weiter erreichbar.
 *
 * Beweist: In den Wegen der Kundschaft (öffentliche Seiten, API-Routen, die
 * Prüfkette, die Kasse, Mails an Höfe, die Bestätigungen und die
 * Sichtbarkeits-Bedingung der Hofseite) steht kein `.archivedAt` und keine
 * Bedingung `archivedAt: null` mehr — nur noch hofSichtbar bzw.
 * HOF_SICHTBAR_WO. Gegenprobe: die Muster finden einen Schnipsel.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const WURZEL = process.cwd()

function dateienUnter(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const pfad = join(ordner, n)
    return statSync(pfad).isDirectory() ? dateienUnter(pfad) : /\.tsx?$/.test(n) ? [pfad] : []
  })
}

/** Die Wege der Kundschaft — ganze Ordner und einzelne Dateien. */
const ORDNER = ['src/app/(public)', 'src/app/api', 'src/server/mail-arten']
const DATEIEN = [
  'src/server/warenkorb.ts',
  'src/server/queries/farm.ts',
  'src/server/actions/neuigkeiten.ts',
  'src/server/actions/bar-bestaetigung.ts',
  'src/lib/bar-bestaetigung.ts',
  'src/lib/betrieb-mails.ts',
]

const NUR_EIN_FELD = /\.archivedAt\b|\barchivedAt:\s*null\b/

function funde(texte: Array<[string, string]>): string[] {
  return texte.flatMap(([pfad, text]) =>
    text
      .split('\n')
      .map((zeile, i) => [zeile, i + 1] as const)
      // Kommentare zählen nicht.
      .filter(([zeile]) => !/^\s*(\*|\/\/)/.test(zeile) && NUR_EIN_FELD.test(zeile))
      .map(([, nr]) => `${pfad}:${nr}`)
  )
}

describe('Leser der Sichtbarkeit fragen hofSichtbar (N36)', () => {
  it('kein Weg der Kundschaft liest archivedAt allein', () => {
    const pfade = [...ORDNER.flatMap((o) => dateienUnter(join(WURZEL, o))), ...DATEIEN.map((d) => join(WURZEL, d))]
    const texte = pfade.map((p) => [relative(WURZEL, p).split(sep).join('/'), readFileSync(p, 'utf8')] as [string, string])
    expect(texte.length).toBeGreaterThan(20)
    expect(funde(texte)).toEqual([])
  }, 30_000)

  it('Gegenprobe: das Muster findet beides, Kommentare nicht', () => {
    expect(funde([['a.ts', 'if (farm.archivedAt) return']])).toEqual(['a.ts:1'])
    expect(funde([['b.ts', 'where: { archivedAt: null }']])).toEqual(['b.ts:1'])
    expect(funde([['c.ts', '  // farm.archivedAt war früher hier']])).toEqual([])
    expect(funde([['d.ts', 'if (!hofSichtbar(farm)) return']])).toEqual([])
  })
})

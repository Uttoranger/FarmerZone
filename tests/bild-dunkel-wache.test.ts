/**
 * Eine Quelle für Bilder im Dunkeln (F041, freigabe.md §37.1, Punkt 15.5.2; Register N48): Unter src/components
 * dämpft keine Datei außer `ui/bild-dunkel.ts` ein Bild mit eigenen Klassen `dark:brightness-…` bzw.
 * `dark:saturate-…`. Illustrationen nehmen ILLUSTRATION_HUELLE, Fotos FOTO_HUELLE — sonst laufen die Werte
 * wieder auseinander (vor Nr. 271 vier eigene Kopien mit 0,78 bzw. 0,85).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const WURZEL = process.cwd()
const QUELLE = ['src', 'components', 'ui', 'bild-dunkel.ts'].join(sep)
const MUSTER = /dark:(?:brightness|saturate)-/

function* dateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* dateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Die Dateien mit eigenem Dämpf-Literal, je mit der ersten Fundzeile. */
function funde(texte: readonly { pfad: string; text: string }[]): string[] {
  return texte
    .filter(({ pfad }) => pfad !== QUELLE)
    .flatMap(({ pfad, text }) => {
      const zeile = text.split('\n').findIndex((z) => MUSTER.test(z))
      return zeile === -1 ? [] : [`${pfad}:${zeile + 1}`]
    })
}

describe('Bilder im Dunkeln: Dämpfung nur aus ui/bild-dunkel.ts', () => {
  it('kein Literal dark:brightness- oder dark:saturate- unter src/components außerhalb von bild-dunkel.ts', () => {
    const texte = [...dateien(join(WURZEL, 'src/components'))].map((pfad) => ({
      pfad: relative(WURZEL, pfad),
      text: readFileSync(pfad, 'utf8'),
    }))
    expect(funde(texte)).toEqual([])
    // Die Quelle selbst trägt die Werte (sonst prüfte die Suche ins Leere).
    expect(MUSTER.test(readFileSync(join(WURZEL, QUELLE), 'utf8'))).toBe(true)
  })

  it('Gegenprobe: die alte Kopie aus kategorie-hinweis.tsx schlägt an, auch nur saturate', () => {
    const schnipsel = [
      { pfad: ['src', 'components', 'startseite', 'bloecke', 'kategorie-hinweis.tsx'].join(sep), text: 'className="object-cover dark:brightness-[0.78] dark:saturate-[0.9]"' },
      { pfad: ['src', 'components', 'x.tsx'].join(sep), text: "cn('a',\n  'dark:saturate-[0.9]')" },
      { pfad: QUELLE, text: "export const FOTO_HUELLE = 'dark:brightness-[0.85]'" },
    ]
    expect(funde(schnipsel)).toEqual([`${schnipsel[0].pfad}:1`, `${schnipsel[1].pfad}:2`])
  })
})

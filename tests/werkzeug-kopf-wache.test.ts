/**
 * Werkzeug-Kopf-Wache (Baustein G1, Nr. 245; Liste Lauf 32, Abschnitt 3.2).
 *
 * Ursache: `WerkzeugKopf` (src/components/ui/werkzeug-kopf.tsx) löst `UnterseitenKopf`
 * (src/components/hofbereich/unterseiten-kopf.tsx) ab. Umgestellt wird Route für Route mit den
 * Seiten-Nummern; bis dahin steht der alte Kopf in den Dateien der Bestandsliste
 * (tests/bestandslisten/unterseiten-kopf.ts). Ist sie leer, löscht der Dirigent den alten Kopf.
 *
 * Beweist (Quelltext von `src/`, Kommentare zählen nicht): `<UnterseitenKopf …>`, `<UnterseitenKopfLaden …>`
 * und der Import von unterseiten-kopf.tsx stehen nur in Dateien der Bestandsliste; eine Datei der Liste
 * ohne Treffer fällt als veraltet auf (die Liste schrumpft nur).
 *
 * Gegenprobe: Text-Attrappen — Aufruf, Ladeansicht und Import schlagen an, der neue Kopf, die Stil-Datei
 * des alten und ein Kommentar nicht; im echten Baum findet die Suche die Liste (seit Nr. 278 leer).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { UNTERSEITEN_KOPF_BESTAND } from './bestandslisten/unterseiten-kopf'

const WURZEL = process.cwd()

/** Die Dateien des alten Kopfs selbst — sie bleiben, bis die Liste leer ist. */
const ALTER_KOPF = ['src/components/hofbereich/unterseiten-kopf.tsx', 'src/components/hofbereich/unterseiten-kopf-stil.ts']

function* dateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* dateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Rendert oder importiert ein Text den alten Kopf? */
function nutztAltenKopf(text: string): boolean {
  const code = ohneKommentare(text)
  return /<UnterseitenKopf(?:Laden)?\b/.test(code) || /from\s+['"]@\/components\/hofbereich\/unterseiten-kopf['"]/.test(code)
}

const aufrufer = new Set<string>()
for (const pfad of dateien(join(WURZEL, 'src'))) {
  const datei = relative(WURZEL, pfad).split(sep).join('/')
  if (ALTER_KOPF.includes(datei)) continue
  if (nutztAltenKopf(readFileSync(pfad, 'utf8'))) aufrufer.add(datei)
}

describe('UnterseitenKopf nur noch im Bestand (G1)', () => {
  it('keine neue Seite nimmt den alten Kopf — neue Köpfe sind WerkzeugKopf', () => {
    const neu = [...aufrufer].filter((datei) => !UNTERSEITEN_KOPF_BESTAND.includes(datei))
    expect(neu, 'Statt UnterseitenKopf den WerkzeugKopf aus src/components/ui/werkzeug-kopf.tsx nehmen').toEqual([])
  })

  it('die Bestandsliste schrumpft nur — eine umgestellte Datei muss heraus', () => {
    const veraltet = UNTERSEITEN_KOPF_BESTAND.filter((datei) => !aufrufer.has(datei))
    expect(veraltet, 'Diese Dateien aus tests/bestandslisten/unterseiten-kopf.ts streichen').toEqual([])
  })

  it('die Beispiel-Route /settings und die Vorschau sind umgestellt', () => {
    for (const datei of ['src/components/hof-einstellungen/einstellungen-uebersicht.tsx', 'src/app/intern/bausteine/bausteine-vorschau.tsx']) {
      expect(aufrufer.has(datei), datei).toBe(false)
      expect(readFileSync(join(WURZEL, datei), 'utf8')).toContain('<WerkzeugKopf')
    }
  })

  it('Gegenprobe: Aufruf, Ladeansicht und Import schlagen an, der neue Kopf und Kommentare nicht', () => {
    expect(nutztAltenKopf('<UnterseitenKopf titel="Hofdaten" />')).toBe(true)
    expect(nutztAltenKopf('<UnterseitenKopfLaden mitTitel={false} />')).toBe(true)
    expect(nutztAltenKopf("import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'")).toBe(true)
    expect(nutztAltenKopf('<WerkzeugKopf titel="Hofdaten" />')).toBe(false)
    expect(nutztAltenKopf("import { LEISTE_HANDY } from '@/components/hofbereich/unterseiten-kopf-stil'")).toBe(false)
    expect(nutztAltenKopf('// früher <UnterseitenKopf /> hier')).toBe(false)
    // Seit Nr. 278 ist der Bestand leer: Die Suche findet genau so viele Aufrufer, wie die Liste nennt.
    expect(aufrufer.size).toBe(UNTERSEITEN_KOPF_BESTAND.length)
  })
})

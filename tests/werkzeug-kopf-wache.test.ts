/**
 * Werkzeug-Kopf-Wache (Baustein G1, Nr. 245; alter Kopf gelöscht in 26.1, Lauf 33).
 *
 * Ursache: `WerkzeugKopf` (src/components/ui/werkzeug-kopf.tsx) ist der EINE Kopf der Hof-Werkzeuge
 * und ihrer Unterseiten. Der alte Unterseiten-Kopf ist gelöscht; käme er zurück, gäbe es wieder zwei
 * Köpfe mit verschiedenen Maßen und Rückwegen.
 *
 * Beweist (Quelltext von `src/`, Kommentare zählen nicht): Keine Datei unter `src/` heißt
 * `unterseiten-kopf…`, keine rendert `<UnterseitenKopf …>` oder `<UnterseitenKopfLaden …>`, keine
 * importiert aus `@/components/hofbereich/unterseiten-kopf` oder `…/unterseiten-kopf-stil`.
 *
 * Gegenprobe: Text-Attrappen — Aufruf, Ladeansicht und beide Importe schlagen an, der neue Kopf und
 * ein Kommentar nicht; ein Dateiname `unterseiten-kopf.tsx` schlägt an.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()

function* dateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* dateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Rendert oder importiert ein Text den alten Kopf (samt seiner Maße)? */
function nutztAltenKopf(text: string): boolean {
  const code = ohneKommentare(text)
  return /<UnterseitenKopf(?:Laden)?\b/.test(code) || /from\s+['"]@\/components\/hofbereich\/unterseiten-kopf(?:-stil)?['"]/.test(code)
}

/** Heißt eine Datei wie der alte Kopf? */
const istAlterKopfName = (pfad: string): boolean => /^unterseiten-kopf/.test(basename(pfad))

const alteDateien: string[] = []
const aufrufer: string[] = []
for (const pfad of dateien(join(WURZEL, 'src'))) {
  const datei = relative(WURZEL, pfad).split(sep).join('/')
  if (istAlterKopfName(pfad)) alteDateien.push(datei)
  if (nutztAltenKopf(readFileSync(pfad, 'utf8'))) aufrufer.push(datei)
}

describe('Nur noch der Werkzeug-Kopf (G1)', () => {
  it('den alten Unterseiten-Kopf gibt es nicht mehr — keine Datei unterseiten-kopf unter src/', () => {
    expect(alteDateien, 'Statt UnterseitenKopf den WerkzeugKopf aus src/components/ui/werkzeug-kopf.tsx nehmen').toEqual([])
  })

  it('keine Seite rendert oder importiert den alten Kopf — neue Köpfe sind WerkzeugKopf', () => {
    expect(aufrufer, 'Statt UnterseitenKopf den WerkzeugKopf aus src/components/ui/werkzeug-kopf.tsx nehmen').toEqual([])
  })

  it('die Beispiel-Route /settings und die Vorschau tragen den Werkzeug-Kopf', () => {
    for (const datei of ['src/components/hof-einstellungen/einstellungen-uebersicht.tsx', 'src/app/intern/bausteine/bausteine-vorschau.tsx']) {
      expect(readFileSync(join(WURZEL, datei), 'utf8')).toContain('<WerkzeugKopf')
    }
  })

  it('Gegenprobe: Aufruf, Ladeansicht, beide Importe und der Dateiname schlagen an, der neue Kopf und Kommentare nicht', () => {
    expect(nutztAltenKopf('<UnterseitenKopf titel="Hofdaten" />')).toBe(true)
    expect(nutztAltenKopf('<UnterseitenKopfLaden mitTitel={false} />')).toBe(true)
    expect(nutztAltenKopf("import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'")).toBe(true)
    expect(nutztAltenKopf("import { LEISTE_HANDY } from '@/components/hofbereich/unterseiten-kopf-stil'")).toBe(true)
    expect(nutztAltenKopf('<WerkzeugKopf titel="Hofdaten" />')).toBe(false)
    expect(nutztAltenKopf("import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'")).toBe(false)
    expect(nutztAltenKopf('// früher <UnterseitenKopf /> hier')).toBe(false)
    expect(istAlterKopfName('src/components/hofbereich/unterseiten-kopf.tsx')).toBe(true)
    expect(istAlterKopfName('src/components/hofbereich/unterseiten-kopf-stil.ts')).toBe(true)
    expect(istAlterKopfName('src/components/ui/werkzeug-kopf.tsx')).toBe(false)
  })
})

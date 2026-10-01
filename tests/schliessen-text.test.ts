/**
 * Die Basiskomponenten sprechen Deutsch — auch für den Screenreader.
 *
 * Ursache des Fehlers: Die shadcn-Vorlagen von Dialog und Sheet kamen mit
 * englischem „Close" (als Screenreader-Text am Kreuz, sichtbar im Fuß des
 * Dialogs) und wurden beim Übernehmen nicht übersetzt.
 *
 * Beweist:
 *  - Nirgends unter src steht „Close" als Text oder als aria-label/title.
 *  - Das Kreuz von Dialog und Sheet heißt für den Screenreader „Schließen".
 *  - Die Toasts (sonner) melden sich als „Benachrichtigungen", ihr Kreuz heißt
 *    „Schließen" — sonner bringt „Notifications" und „Close toast" mit.
 *
 * Der Dialog lässt sich in Node nicht öffnen (das Portal hängt erst im
 * Browser ein) — deshalb die Prüfung am Quelltext, mit Gegenprobe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { Toaster } from '@/components/ui/sonner'

const WURZEL = process.cwd()

function* tsxDateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* tsxDateien(pfad)
    else if (name.endsWith('.tsx')) yield pfad
  }
}

const ENGLISCH = /\bClose\b/

/** Englisches „Close" als JSX-Text oder als aria-label/title. */
function englischesClose(quelltext: string, pfad = 'schnipsel.tsx'): string[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const funde: string[] = []
  const zeile = (k: ts.Node) => datei.getLineAndCharacterOfPosition(k.getStart(datei)).line + 1
  const besuche = (knoten: ts.Node): void => {
    if (ts.isJsxText(knoten) && ENGLISCH.test(knoten.text)) funde.push(`${pfad}:${zeile(knoten)}`)
    if (
      ts.isJsxAttribute(knoten) &&
      ['aria-label', 'title'].includes(knoten.name.getText(datei)) &&
      knoten.initializer &&
      ENGLISCH.test(knoten.initializer.getText(datei))
    ) {
      funde.push(`${pfad}:${zeile(knoten)}`)
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return funde
}

/** Der Screenreader-Text in der Schließen-Schaltfläche einer Komponente. */
function screenreaderTexte(quelltext: string): string[] {
  return [...quelltext.matchAll(/<span className="sr-only">([^<]*)<\/span>/g)].map((m) => m[1])
}

describe('Schließen statt Close', () => {
  it('Gegenprobe: die Suche findet Close als Text und als aria-label — nicht in Bezeichnern', () => {
    const schnipsel = `
      const a = <span className="sr-only">Close</span>
      const b = <button aria-label="Close dialog" />
      const c = <DialogPrimitive.Close render={<Button />}>Schließen</DialogPrimitive.Close>
    `
    expect(englischesClose(schnipsel)).toEqual(['schnipsel.tsx:2', 'schnipsel.tsx:3'])
  })

  it('nirgends unter src steht „Close" für Menschen', () => {
    const funde = [...tsxDateien(join(WURZEL, 'src'))].flatMap((pfad) =>
      englischesClose(readFileSync(pfad, 'utf8'), relative(WURZEL, pfad))
    )
    expect(funde).toEqual([])
  })

  it.each(['src/components/ui/dialog.tsx', 'src/components/ui/sheet.tsx'])(
    '%s: das Kreuz heißt für den Screenreader „Schließen"',
    (pfad) => {
      expect(screenreaderTexte(readFileSync(join(WURZEL, pfad), 'utf8'))).toEqual(['Schließen'])
    }
  )
})

describe('Toasts sprechen Deutsch', () => {
  it('die Region heißt „Benachrichtigungen" — gerendert aus der echten Komponente', () => {
    const html = renderToStaticMarkup(createElement(Toaster))
    // Gegenprobe: Die Region wird gerendert und trägt eine Beschriftung.
    expect(html).toMatch(/<section[^>]*aria-label="[^"]+"/)
    expect(html).toContain('aria-label="Benachrichtigungen alt+T"')
    expect(html).not.toContain('Notifications')
  })

  it('das Kreuz eines Toasts heißt „Schließen"', () => {
    const quelle = readFileSync(join(WURZEL, 'src/components/ui/sonner.tsx'), 'utf8')
    expect(quelle).toMatch(/closeButtonAriaLabel:\s*["']Schließen["']/)
  })
})

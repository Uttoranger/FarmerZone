/**
 * Hand-Zeiger an allem, was man anklicken kann.
 *
 * Ursache des Fehlers: Tailwind v4 setzt in seinem Preflight keinen
 * `cursor: pointer` mehr auf Knöpfe (v3 tat es), und die shadcn-Vorlage von
 * src/components/ui/button.tsx trägt ihn auch nicht. Jeder Knopf zeigte den
 * Pfeil — nur 23 Stellen setzten die Hand von Hand.
 *
 * Beweist:
 *  - buttonVariants trägt cursor-pointer in der Grundklasse, in jeder Variante
 *    und Größe; gesperrt bleibt pointer-events-none.
 *  - globals.css setzt in @layer base die Hand für native Knöpfe,
 *    [role="button"] und label[for] — jeweils nicht, wenn gesperrt. In
 *    @layer base, damit eine Utility wie cursor-not-allowed gewinnt.
 *  - An <Button>, <button> und <label htmlFor> steht kein eigenes
 *    cursor-pointer mehr — dort wäre es jetzt doppelt.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { buttonVariants } from '@/components/ui/button'

const WURZEL = process.cwd()

// ─── Button ─────────────────────────────────────────────────────────────────

const VARIANTEN = ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'] as const
const GROESSEN = ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'] as const

describe('Button', () => {
  it('jede Variante und Größe zeigt die Hand', () => {
    for (const variant of VARIANTEN) {
      for (const size of GROESSEN) {
        const klassen = buttonVariants({ variant, size }).split(/\s+/)
        expect(klassen, `${variant}/${size}`).toContain('cursor-pointer')
      }
    }
  })

  it('gesperrt bleibt pointer-events-none — der Knopf nimmt keine Klicks an', () => {
    const klassen = buttonVariants().split(/\s+/)
    expect(klassen).toContain('disabled:pointer-events-none')
    expect(klassen).toContain('disabled:opacity-50')
  })
})

// ─── globals.css ────────────────────────────────────────────────────────────

type Regel = { selektor: string; inhalt: string }

/** Der Inhalt aller `@layer <name> { … }`-Blöcke, Klammern gezählt. */
function ebenenInhalt(css: string, name: string): string {
  const teile: string[] = []
  const kopf = new RegExp(`@layer\\s+${name}\\s*\\{`, 'g')
  for (const treffer of css.matchAll(kopf)) {
    let tiefe = 1
    let i = (treffer.index ?? 0) + treffer[0].length
    const start = i
    for (; i < css.length && tiefe > 0; i++) {
      if (css[i] === '{') tiefe++
      else if (css[i] === '}') tiefe--
    }
    teile.push(css.slice(start, i - 1))
  }
  return teile.join('\n')
}

/** Regeln der obersten Ebene eines Blocks: Selektor und Inhalt, Kommentare entfernt. */
function regeln(block: string): Regel[] {
  const ohneKommentare = block.replace(/\/\*[\s\S]*?\*\//g, '')
  const ergebnis: Regel[] = []
  let tiefe = 0
  let selektor = ''
  let inhalt = ''
  for (const zeichen of ohneKommentare) {
    if (zeichen === '{') {
      tiefe++
      if (tiefe === 1) continue
    } else if (zeichen === '}') {
      tiefe--
      if (tiefe === 0) {
        ergebnis.push({ selektor: selektor.trim().replace(/\s+/g, ' '), inhalt: inhalt.trim() })
        selektor = ''
        inhalt = ''
        continue
      }
    }
    if (tiefe === 0) selektor += zeichen
    else inhalt += zeichen
  }
  return ergebnis
}

const GLOBALS = readFileSync(join(WURZEL, 'src/app/globals.css'), 'utf8')
const BASIS = regeln(ebenenInhalt(GLOBALS, 'base'))

describe('globals.css — Hand für Knöpfe ohne Button-Komponente', () => {
  it('Gegenprobe: der Leser findet die vorhandenen Regeln in @layer base', () => {
    const body = BASIS.find((r) => r.selektor === 'body')
    expect(body?.inhalt).toContain('@apply bg-background text-foreground')
  })

  it('native Knöpfe, [role="button"] und label[for] zeigen die Hand — gesperrte nicht', () => {
    const hand = BASIS.filter((r) => /cursor:\s*pointer/.test(r.inhalt))
    const selektoren = hand.flatMap((r) => r.selektor.split(',').map((s) => s.trim()))
    expect(selektoren).toContain('button:not(:disabled):not([aria-disabled="true"])')
    expect(selektoren).toContain('[role="button"]:not([aria-disabled="true"])')
    expect(selektoren).toContain('label[for]')
  })
})

// ─── Kein doppeltes cursor-pointer ──────────────────────────────────────────

function* tsxDateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* tsxDateien(pfad)
    else if (name.endsWith('.tsx')) yield pfad
  }
}

/**
 * Elemente, die die Hand jetzt von selbst haben, aber ein eigenes
 * cursor-pointer tragen: <Button>, <button>, <label htmlFor>.
 */
function doppelteZeiger(quelltext: string, pfad = 'schnipsel.tsx'): string[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const funde: string[] = []
  const besuche = (knoten: ts.Node): void => {
    if (ts.isJsxOpeningElement(knoten) || ts.isJsxSelfClosingElement(knoten)) {
      const tag = knoten.tagName.getText(datei)
      const attribute = knoten.attributes.properties.filter(ts.isJsxAttribute)
      const name = (a: ts.JsxAttribute) => a.name.getText(datei)
      const hatFor = attribute.some((a) => name(a) === 'htmlFor')
      const traegtHand = tag === 'Button' || tag === 'button' || (tag === 'label' && hatFor)
      const klasse = attribute.find((a) => name(a) === 'className')
      if (traegtHand && klasse?.initializer && /\bcursor-pointer\b/.test(klasse.initializer.getText(datei))) {
        const zeile = datei.getLineAndCharacterOfPosition(knoten.getStart(datei)).line + 1
        funde.push(`${pfad}:${zeile} <${tag}>`)
      }
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return funde
}

describe('kein doppeltes cursor-pointer', () => {
  it('Gegenprobe: die Suche schlägt an Button, button und label[for] an — nicht an einem Label ohne for', () => {
    const schnipsel = `
      const a = <Button className="h-10 cursor-pointer" />
      const b = <button type="button" className={cn('px-2', 'cursor-pointer')}>x</button>
      const c = <label htmlFor="feld" className="flex cursor-pointer">Name</label>
      const d = <label className="flex cursor-pointer"><input type="checkbox" /></label>
      const e = <tr className="cursor-pointer" onClick={() => {}} />
    `
    expect(doppelteZeiger(schnipsel)).toEqual(['schnipsel.tsx:2 <Button>', 'schnipsel.tsx:3 <button>', 'schnipsel.tsx:4 <label>'])
  })

  it('an Knöpfen und Labels mit for steht die Hand nicht mehr von Hand', () => {
    const funde = [...tsxDateien(join(WURZEL, 'src'))].flatMap((pfad) =>
      doppelteZeiger(readFileSync(pfad, 'utf8'), relative(WURZEL, pfad))
    )
    expect(funde).toEqual([])
  })
})

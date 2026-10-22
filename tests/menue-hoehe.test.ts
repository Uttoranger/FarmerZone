/**
 * Menüeinträge sind mindestens 44 px hoch (Tippflächen, DESIGN_SYSTEM) – im
 * Baustein, nie je Menü (Nr. 148, Punkt 1).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const WURZEL = process.cwd()
const lies = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8')

function dateien(ordner: string): string[] {
  return readdirSync(join(WURZEL, ordner)).flatMap((name) => {
    const pfad = `${ordner}/${name}`
    return statSync(join(WURZEL, pfad)).isDirectory() ? dateien(pfad) : /\.tsx?$/.test(name) ? [pfad] : []
  })
}

/** Die Zeile `const ITEM = …` samt Fortsetzung. */
function itemKlasse(quelle: string): string {
  const treffer = /const ITEM =\s*\n?\s*("[^"]*")/.exec(quelle)
  expect(treffer).not.toBeNull()
  return treffer![1]
}

/**
 * Alle Öffnungs-Tags von Menüeinträgen (Item, LinkItem) bis zum schließenden `>`
 * des Eintrags. Geschweifte Klammern und Anführungszeichen zählen mit: Das `/>`
 * eines Link in `render={<Link … />}` und das `=>` in `onClick` beenden den Tag nicht.
 */
function eintragTags(quelle: string): string[] {
  const tags: string[] = []
  for (const m of quelle.matchAll(/<DropdownMenu(?:Link)?Item\b/g)) {
    let tiefe = 0
    let anf: string | null = null
    let ende = m.index!
    for (let i = m.index! + m[0].length; i < quelle.length; i++) {
      const z = quelle[i]
      if (anf) {
        if (z === anf) anf = null
      } else if (z === '"' || z === "'" || z === '`') anf = z
      else if (z === '{') tiefe++
      else if (z === '}') tiefe--
      else if (z === '>' && tiefe === 0) {
        ende = i
        break
      }
    }
    tags.push(quelle.slice(m.index!, ende + 1))
  }
  return tags
}

/** Eintrag-Tags, deren Attribute min-h-11 tragen. */
const mitHoehe = (quelle: string) => eintragTags(quelle).filter((t) => /min-h-11/.test(t))

describe('Menüeinträge: 44 px im Baustein', () => {
  it('ITEM in dropdown-menu.tsx trägt min-h-11', () => {
    expect(itemKlasse(lies('src/components/ui/dropdown-menu.tsx'))).toContain('min-h-11')
  })

  it('Gegenprobe: ohne die Klasse wäre die Prüfung rot', () => {
    const ohne = lies('src/components/ui/dropdown-menu.tsx').replace('min-h-11 ', '')
    expect(itemKlasse(ohne)).not.toContain('min-h-11')
  })

  it('keine Datei unter src/ setzt min-h-11 örtlich auf Menüeinträge', () => {
    const funde: string[] = []
    for (const pfad of dateien('src')) {
      if (pfad === 'src/components/ui/dropdown-menu.tsx') continue
      const quelle = lies(pfad)
      if (/\[&_\[role=menuitem\]\]:min-h-/.test(quelle)) funde.push(`${pfad}: Regel am Menü`)
      // Ein Eintrag (Item oder LinkItem) mit eigener className, die min-h-11 trägt.
      for (const tag of mitHoehe(quelle)) funde.push(`${pfad}: ${tag.slice(0, 60)}`)
    }
    expect(funde).toEqual([])
  }, 30_000)

  it('Gegenprobe: der Quelltext vor der Änderung (LinkItem mit render-Prop, Item mit =>) wird gefunden', () => {
    const alt = `
      <DropdownMenuLinkItem render={<Link href={ADMIN_KONTO.href} />} className="min-h-11">
        Konto
      </DropdownMenuLinkItem>
      <DropdownMenuItem onClick={() => abmelden()} className="min-h-11">Abmelden</DropdownMenuItem>
      <DropdownMenuItem onClick={abmelden}>Ohne Höhe</DropdownMenuItem>`
    const funde = mitHoehe(alt)
    expect(funde).toHaveLength(2)
    expect(funde[0]).toContain('DropdownMenuLinkItem')
    expect(funde[1]).toContain('=>')
  })
})

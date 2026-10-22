/**
 * Menüeinträge sind mindestens 44 px hoch (Tippflächen, DESIGN_SYSTEM) – im
 * Baustein, nie je Menü. Dazu Nr. 148, Punkt 2 und 3: der Beitrag für WhatsApp
 * kommt aus einer Abfrage, der Link im Teilen-Fenster aus der einen Regel.
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
      for (const m of quelle.matchAll(/<DropdownMenu(?:Link)?Item\b[^>]*>/g)) {
        if (/min-h-11/.test(m[0])) funde.push(`${pfad}: ${m[0].slice(0, 60)}`)
      }
    }
    expect(funde).toEqual([])
  }, 30_000)
})

describe('Beitrag für WhatsApp aus einer Abfrage', () => {
  it('die Seite ruft prisma nicht mehr selbst auf', () => {
    const seite = lies('src/app/(hof)/status/[id]/send-whatsapp/page.tsx')
    expect(seite).not.toMatch(/prisma/)
    expect(seite).toContain('data.showOnFarmPage')
  })

  it('getStatusPostForWhatsApp liefert showOnFarmPage, Besitz bleibt in der WHERE-Klausel', () => {
    const quelle = lies('src/server/queries/status-posts.ts')
    const start = quelle.indexOf('export async function getStatusPostForWhatsApp')
    const funktion = quelle.slice(start, quelle.indexOf('const subscribers', start))
    expect(funktion).toContain('showOnFarmPage: true')
    expect(funktion).toContain('where: { id: postId, farmId }')
  })
})

describe('Link im Teilen-Fenster über die eine Regel', () => {
  it('ladeTeilenFensterBeitrag baut link und adresse über beitragIdImLink', () => {
    const quelle = lies('src/server/queries/teilen-bild.ts')
    const start = quelle.indexOf('export async function ladeTeilenFensterBeitrag')
    const funktion = quelle.slice(start, quelle.indexOf('\n}\n', start))
    expect(funktion).toContain('beitragIdImLink(beitrag)')
    expect(funktion).not.toMatch(/beitragLink\([^)]*beitrag\.id\)/)
  })
})

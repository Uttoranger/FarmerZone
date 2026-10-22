/**
 * Nr. 148, Punkt 2 und 3: der Beitrag für WhatsApp kommt aus einer Abfrage,
 * der Link im Teilen-Fenster aus der einen Regel.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

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

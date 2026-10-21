/**
 * Wache (Nr. 129, Nachrunde des Dirigenten): Wer den „neuesten“ aktiven Beitrag
 * nennt, ordnet mit NEUESTER_BEITRAG_ZUERST (src/server/queries/status-posts.ts).
 * Vorher entschied die Hofseite einen Gleichstand mit `id: 'desc'`, Heute, Mein
 * Hof, die Marke auf /hoefe und „Neu bei den Höfen“ mit `id: 'asc'` — bei gleicher
 * Veröffentlichungszeit nannten sie einen anderen Beitrag als den, der oben auf
 * der Hofseite steht. Den Fall selbst prüft tests/integration/dein-beitrag.int.test.ts.
 *
 * Geprüft wird jede Datei unter src/, die AKTIVER_BEITRAG nutzt: Ein eigenes
 * `orderBy` nach `publishedAt` darf dort nicht mehr stehen.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { NEUESTER_BEITRAG_ZUERST } from '@/server/queries/status-posts'

const SRC = path.resolve(__dirname, '..', 'src')

function alleDateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const voll = path.join(ordner, name)
    if (statSync(voll).isDirectory()) return alleDateien(voll)
    return /\.tsx?$/.test(name) ? [voll] : []
  })
}

/** Ein eigenes `orderBy` nach `publishedAt` statt der gemeinsamen Konstante. */
function eigeneReihenfolge(code: string): boolean {
  return /orderBy:\s*\[?\s*\{\s*publishedAt\s*:/.test(code)
}

const NUTZER = alleDateien(SRC).filter((datei) => /\bAKTIVER_BEITRAG\b/.test(readFileSync(datei, 'utf8')))

describe('NEUESTER_BEITRAG_ZUERST — eine Reihenfolge für den neuesten Beitrag', () => {
  it('der neueste zuerst, bei Gleichstand die größere Kennung (wie die Hofseite)', () => {
    expect(NEUESTER_BEITRAG_ZUERST).toEqual([{ publishedAt: 'desc' }, { id: 'desc' }])
  })

  it('findet die Nutzer von AKTIVER_BEITRAG (sonst prüfte die Wache nichts)', () => {
    const namen = NUTZER.map((datei) => path.relative(SRC, datei))
    expect(namen).toEqual(expect.arrayContaining([
      'server/queries/status-posts.ts',
      'server/queries/dashboard.ts',
      'server/queries/neuigkeiten.ts',
      'server/queries/farm.ts',
    ]))
  })

  it('keine Datei mit AKTIVER_BEITRAG ordnet selbst nach publishedAt', () => {
    const verstoesse = NUTZER.filter((datei) => eigeneReihenfolge(readFileSync(datei, 'utf8'))).map((datei) => path.relative(SRC, datei))
    expect(verstoesse).toEqual([])
  })

  it('Gegenprobe: die alte Fassung schlägt an, die Konstante nicht', () => {
    expect(eigeneReihenfolge("orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],")).toBe(true)
    expect(eigeneReihenfolge("orderBy: { publishedAt: 'desc' },")).toBe(true)
    expect(eigeneReihenfolge('orderBy: NEUESTER_BEITRAG_ZUERST,')).toBe(false)
  })
})

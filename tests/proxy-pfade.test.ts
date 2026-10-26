/**
 * Die geschützten Pfade sind vollständig: Jeder Ordner unter src/app/(druck)
 * und src/app/(hof) steht in FARMER_PATHS (src/lib/hof-pfade.ts, seit Nr. 156
 * die eine Liste für Proxy, robots.txt und Rücksprung) UND im matcher von
 * src/proxy.ts. Fehlt er im matcher, läuft der Proxy dort gar nicht erst — die
 * Liste allein hülfe nichts.
 *
 * Der matcher wird am Quelltext gelesen: Er muss ein statisches Literal
 * bleiben (Next liest ihn beim Bauen). Die Liste kommt über den Import.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { FARMER_PATHS } from '@/lib/hof-pfade'

const proxy = readFileSync(join(process.cwd(), 'src/proxy.ts'), 'utf8')
// Beide Routengruppen des Hofbereichs: HofShell (hof, seit Nr. 16) und Druckseiten (druck, seit Nr. 181; vorher (farmer)).
const ordner = ['src/app/(druck)', 'src/app/(hof)'].flatMap((gruppe) => {
  const wurzel = join(process.cwd(), gruppe)
  return readdirSync(wurzel).filter((n) => statSync(join(wurzel, n)).isDirectory())
})

function liste(muster: RegExp): string[] {
  const treffer = muster.exec(proxy)
  if (!treffer) throw new Error(`Nicht gefunden: ${muster}`)
  return [...treffer[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

describe('FARMER_PATHS und der matcher von src/proxy.ts', () => {
  const pfade: readonly string[] = FARMER_PATHS
  const matcher = liste(/matcher: \[([\s\S]*?)\]/)

  it('kennt jeden Ordner unter (druck) und (hof) — auch /status und /farm-page', () => {
    expect(ordner).toContain('status')
    expect(ordner).toContain('farm-page')
    for (const name of ordner) expect(pfade, name).toContain(`/${name}`)
  })

  it('der Proxy nimmt die Liste aus src/lib/hof-pfade.ts, keine eigene Kopie', () => {
    expect(proxy).toContain("from '@/lib/hof-pfade'")
    expect(proxy).not.toMatch(/const FARMER_PATHS/)
  })

  it('der matcher deckt dieselben Pfade ab', () => {
    expect(matcher.toSorted()).toEqual(pfade.map((p) => `${p}/:path*`).toSorted())
  })
})

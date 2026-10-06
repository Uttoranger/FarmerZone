/**
 * Die geschützten Pfade in src/proxy.ts sind vollständig: Jeder Ordner unter
 * src/app/(farmer) und src/app/(hof) steht in FARMER_PATHS UND im matcher. Fehlt er im matcher,
 * läuft der Proxy dort gar nicht erst — die Liste allein hülfe nichts.
 *
 * Am Quelltext geprüft: Der matcher muss ein statisches Literal bleiben
 * (Next liest ihn beim Bauen), und die Datei bindet next/server ein.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const proxy = readFileSync(join(process.cwd(), 'src/proxy.ts'), 'utf8')
// Beide Routengruppen des Hofbereichs: Bestand (farmer) und HofShell (hof, seit Nr. 16).
const ordner = ['src/app/(farmer)', 'src/app/(hof)'].flatMap((gruppe) => {
  const wurzel = join(process.cwd(), gruppe)
  return readdirSync(wurzel).filter((n) => statSync(join(wurzel, n)).isDirectory())
})

function liste(muster: RegExp): string[] {
  const treffer = muster.exec(proxy)
  if (!treffer) throw new Error(`Nicht gefunden: ${muster}`)
  return [...treffer[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

describe('src/proxy.ts', () => {
  const pfade = liste(/const FARMER_PATHS = \[([\s\S]*?)\]/)
  const matcher = liste(/matcher: \[([\s\S]*?)\]/)

  it('kennt jeden Ordner unter (farmer) und (hof) — auch /status und /farm-page', () => {
    expect(ordner).toContain('status')
    expect(ordner).toContain('farm-page')
    for (const name of ordner) expect(pfade, name).toContain(`/${name}`)
  })

  it('der matcher deckt dieselben Pfade ab', () => {
    expect(matcher.toSorted()).toEqual(pfade.map((p) => `${p}/:path*`).toSorted())
  })
})

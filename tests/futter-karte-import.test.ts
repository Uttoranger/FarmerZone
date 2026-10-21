/**
 * Die Karte von „Futter kaufen" (Nr. 123, N23) kommt erst beim Umschalten —
 * kein Leaflet im ersten Laden von /region.
 *
 * Ohne Browser lässt sich „wann wird ein Chunk geladen" nicht beobachten, wohl
 * aber seine Voraussetzung: Vom Reiter darf KEIN statischer Import zu Leaflet,
 * zur Kartenkomponente von /hoefe oder zur Futter-Karte führen — nur ein
 * dynamischer (`import(...)` in next/dynamic). Der Test läuft den statischen
 * Import-Graph der Projektdateien ab; Pakete sind Blätter. Dass er Leaflet
 * erkennt, prüft er an der Futter-Karte selbst (Gegenprobe). Eigene Datei,
 * damit tests/umfeld-karte.test.ts unverändert bleibt.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const WURZEL = path.resolve(__dirname, '..')
const ENDUNGEN = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

/** import … from '…', import '…', export … from '…' — ohne `import type` und ohne `import(…)`. */
const STATISCH = /^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm

function aufloesen(von: string, spezifikation: string): string | null {
  let basis: string
  if (spezifikation.startsWith('@/')) basis = path.join(WURZEL, 'src', spezifikation.slice(2))
  else if (spezifikation.startsWith('.')) basis = path.resolve(path.dirname(von), spezifikation)
  else return `paket:${spezifikation}`
  for (const endung of ENDUNGEN) {
    const kandidat = basis + endung
    if (fs.existsSync(kandidat) && fs.statSync(kandidat).isFile()) return kandidat
  }
  return null
}

function statischErreichbar(einstiege: string[]): string[] {
  const gesehen = new Set<string>()
  const offen = einstiege.map((e) => path.join(WURZEL, e))
  while (offen.length > 0) {
    const datei = offen.pop() as string
    if (gesehen.has(datei)) continue
    gesehen.add(datei)
    if (datei.startsWith('paket:') || !/\.tsx?$/.test(datei)) continue
    for (const treffer of fs.readFileSync(datei, 'utf8').matchAll(STATISCH)) {
      const ziel = aufloesen(datei, treffer[1])
      if (ziel && !gesehen.has(ziel)) offen.push(ziel)
    }
  }
  return [...gesehen].map((d) => (d.startsWith('paket:') ? d : path.relative(WURZEL, d).split(path.sep).join('/')))
}

describe('Futter-Karte — erst beim Umschalten geladen', () => {
  it('vom Reiter „Futter kaufen" führt kein statischer Import zu Leaflet oder zur Karte', () => {
    const erreicht = statischErreichbar(['src/app/(hof)/region/page.tsx', 'src/app/(hof)/region/futter-reiter.tsx'])
    expect(erreicht).toContain('src/components/region/futter-kaufen-ansicht.tsx')
    expect(erreicht).toContain('src/components/region/futter-karte.tsx')
    expect(erreicht.filter((d) => /^paket:(react-)?leaflet(\/|$)/.test(d))).toEqual([])
    expect(erreicht).not.toContain('src/components/hoefe/hoefe-karte.tsx')
    expect(erreicht).not.toContain('src/components/region/futter-karte-ansicht.tsx')
  })

  it('die Ansicht holt die Karte per dynamic import ohne Server-Rendern, nur in der Ansicht „Karte"', () => {
    const text = fs.readFileSync(path.join(WURZEL, 'src/components/region/futter-kaufen-ansicht.tsx'), 'utf8')
    expect(text).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/region\/futter-karte-ansicht'\)/)
    expect(text).toMatch(/ssr:\s*false/)
    expect(text).toMatch(/wahl === 'karte' \? \(\s*<FutterKarteAnsicht/)
    expect(text.match(/<FutterKarteAnsicht/g)).toHaveLength(1)
  })

  it('Gegenprobe: die Futter-Karte ist die Karte von /hoefe mit der Hofkarte am Pin — und der Test erkennt Leaflet dahinter', () => {
    const erreicht = statischErreichbar(['src/components/region/futter-karte-ansicht.tsx'])
    expect(erreicht).toContain('src/components/hoefe/hoefe-karte.tsx')
    expect(erreicht).toContain('src/components/hoefe/hof-kurzkarte.tsx')
    expect(erreicht).toContain('paket:leaflet')
  })
})

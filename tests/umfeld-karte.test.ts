/**
 * Die Karte des Umfelds kommt erst beim Umschalten — kein Leaflet im ersten
 * Laden der Auswertung.
 *
 * Ohne Browser lässt sich „wann wird ein Chunk geladen" nicht beobachten, wohl
 * aber seine Voraussetzung: Von den Seiten der Auswertung darf KEIN statischer
 * Import zu Leaflet oder zur Kartenkomponente führen — nur ein dynamischer
 * (`import(...)` in next/dynamic). Der Test läuft den statischen Import-Graph
 * der Projektdateien ab; Pakete sind Blätter. Dass er Leaflet überhaupt
 * erkennt, prüft er an der Karte selbst.
 *
 * Dazu, ebenfalls am Quelltext: Liste und Pin-Karte verlinken fremde Höfe nur
 * über den fertigen Link aus src/lib/umfeld.ts.
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

/** Alle Dateien und Pakete, die von den Einstiegen aus STATISCH erreicht werden. */
function statischErreichbar(einstiege: string[]): Set<string> {
  const gesehen = new Set<string>()
  const offen = einstiege.map((e) => path.join(WURZEL, e))
  while (offen.length > 0) {
    const datei = offen.pop() as string
    if (gesehen.has(datei)) continue
    gesehen.add(datei)
    if (datei.startsWith('paket:') || !/\.tsx?$/.test(datei)) continue
    const text = fs.readFileSync(datei, 'utf8')
    for (const treffer of text.matchAll(STATISCH)) {
      const ziel = aufloesen(datei, treffer[1])
      if (ziel && !gesehen.has(ziel)) offen.push(ziel)
    }
  }
  return gesehen
}

const relativ = (menge: Set<string>) => [...menge].map((d) => (d.startsWith('paket:') ? d : path.relative(WURZEL, d).split(path.sep).join('/')))

// Seit Nr. 22c liegt das Umfeld als „Preise vergleichen" auf /region, die
// Auswertung in der HofShell — beide Seiten samt Layout dürfen Leaflet nicht
// statisch erreichen.
const AUSWERTUNG = [
  'src/app/layout.tsx',
  'src/app/(hof)/layout.tsx',
  'src/app/(hof)/analytics/page.tsx',
  'src/app/(hof)/analytics/loading.tsx',
  'src/app/(hof)/analytics/umfeld/page.tsx',
  'src/app/(hof)/region/page.tsx',
  'src/app/(hof)/region/loading.tsx',
]

describe('Umfeld-Karte — erst beim Umschalten geladen', () => {
  it('von den Seiten der Auswertung führt kein statischer Import zu Leaflet oder zur Karte', () => {
    const erreicht = relativ(statischErreichbar(AUSWERTUNG))
    expect(erreicht).toContain('src/components/analytics/umfeld-anzeige.tsx')
    expect(erreicht.filter((d) => /^paket:(react-)?leaflet(\/|$)/.test(d))).toEqual([])
    expect(erreicht).not.toContain('src/components/hoefe/hoefe-karte.tsx')
    expect(erreicht).not.toContain('src/components/analytics/umfeld-karte.tsx')
  })

  it('die Anzeige holt die Karte per dynamic import, ohne Server-Rendern', () => {
    const text = fs.readFileSync(path.join(WURZEL, 'src/components/analytics/umfeld-anzeige.tsx'), 'utf8')
    expect(text).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/analytics\/umfeld-karte'\)/)
    expect(text).toMatch(/ssr:\s*false/)
    // Gerendert — und damit geladen — nur in der Ansicht „Karte".
    expect(text).toMatch(/wahl === 'karte' \? \(\s*<UmfeldKarteAnsicht/)
    expect(text.match(/<UmfeldKarteAnsicht/g)).toHaveLength(1)
  })

  it('die Umfeld-Karte ist die Karte von /hoefe — und der Test erkennt Leaflet dahinter', () => {
    const erreicht = relativ(statischErreichbar(['src/components/analytics/umfeld-karte.tsx']))
    expect(erreicht).toContain('src/components/hoefe/hoefe-karte.tsx')
    expect(erreicht).toContain('paket:leaflet')
  })
})

describe('Links auf fremde Hofseiten — Liste und Pin-Karte', () => {
  it('nehmen den fertigen Link aus src/lib/umfeld.ts und bauen keinen eigenen', () => {
    // Den Bereich-Parameter (bereich=futter) setzt hofseitenLink; welche Links
    // entstehen, prüft tests/umfeld.test.ts. Baute eine Komponente einen
    // Hof-Link selbst — als href oder für router.push —, fiele der Parameter
    // dort still weg.
    const lies = (datei: string) => fs.readFileSync(path.join(WURZEL, 'src/components/analytics', datei), 'utf8')
    const liste = lies('umfeld-liste.tsx')
    const karte = lies('umfeld-karte.tsx')
    expect(liste).toMatch(/href=\{hof\.link\}/)
    expect(karte).toMatch(/href=\{gewaehlt\.link\}/)
    for (const text of [liste, karte]) {
      expect(text).not.toMatch(/\$\{[^}]*slug[^}]*\}/)
      expect(text).not.toMatch(/hofseitenLink/)
    }
  })
})

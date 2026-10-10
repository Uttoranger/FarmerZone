/**
 * „Leg FarmerZone auf den Startbildschirm" — die kleine Karte ganz unten auf
 * Heute (Nachtlauf Nr. 41, Register N1).
 *
 * Beweist:
 *  - Titel und je zwei Sätze für iPhone und Android aus EINER Quelle
 *    (src/lib/startbildschirm.ts).
 *  - Als installierte App (display-mode: standalone, auf dem iPhone
 *    navigator.standalone) erscheint sie nicht, im Browser schon — die Regel
 *    rein, das Lesen im Browser mit nachgestellten Browser-Werten.
 *  - Hydration-sicher: Der Server rendert nichts, entschieden wird erst im
 *    Browser (useSyncExternalStore mit eigenem Server-Wert).
 *  - Ohne Speicher im Browser (Register T1): kein localStorage, kein
 *    sessionStorage, kein Cookie.
 *  - Heute bindet sie als letzten Teil der Seite ein; das Manifest bleibt,
 *    wie es ist.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { STARTBILDSCHIRM_KARTE, laeuftAlsApp } from '@/lib/startbildschirm'
import { StartbildschirmAnleitung, StartbildschirmKarte, anzeigeImBrowser } from '@/components/heute/startbildschirm-karte'
import manifest from '@/app/manifest'

const quelle = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')
/** Sätze zählen: Satzzeichen am Ende, außerhalb von Anführungszeichen. */
const saetze = (text: string): number => (text.replace(/„[^“]*“/g, 'X').match(/[.!?](\s|$)/g) ?? []).length

describe('Texte aus einer Quelle', () => {
  it('der Titel steht wie in der Freigabe', () => {
    expect(STARTBILDSCHIRM_KARTE.titel).toBe('Mit einem Tipp in deinem Hof: Leg FarmerZone auf den Startbildschirm')
  })

  it('iPhone und Android, je genau zwei Sätze', () => {
    expect(STARTBILDSCHIRM_KARTE.anleitungen.map((a) => a.geraet)).toEqual(['iPhone', 'Android'])
    for (const { geraet, saetze: teile } of STARTBILDSCHIRM_KARTE.anleitungen) {
      expect(teile, geraet).toHaveLength(2)
      for (const satz of teile) expect(saetze(satz), satz).toBe(1)
    }
  })

  it('die Anleitung zeigt Titel und beide Geräte mit ihren Sätzen', () => {
    const html = renderToStaticMarkup(createElement(StartbildschirmAnleitung))
    expect(html).toContain(STARTBILDSCHIRM_KARTE.titel)
    for (const { geraet, saetze: teile } of STARTBILDSCHIRM_KARTE.anleitungen) {
      expect(html).toContain(`>${geraet}<`)
      for (const satz of teile) expect(html).toContain(satz.replace(/&/g, '&amp;'))
    }
    // Eine Überschrift für den Abschnitt, das Symbol nur Schmuck.
    expect(html).toMatch(/<section aria-labelledby="heute-startbildschirm"/)
    expect(html).toMatch(/<h2 id="heute-startbildschirm"/)
    for (const svg of html.match(/<svg[^>]*>/g) ?? []) expect(svg).toContain('aria-hidden="true"')
  })
})

describe('nur im Browser, nicht in der installierten App', () => {
  it('Regel: standalone oder iPhone-Startbildschirm → App; sonst Browser', () => {
    expect(laeuftAlsApp({ standalone: true })).toBe(true)
    expect(laeuftAlsApp({ standalone: false, iosStandalone: true })).toBe(true)
    expect(laeuftAlsApp({ standalone: false, iosStandalone: false })).toBe(false)
    expect(laeuftAlsApp({ standalone: false })).toBe(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function browser({ standalone, iosStandalone }: { standalone: boolean; iosStandalone?: boolean }) {
    const abfragen: string[] = []
    vi.stubGlobal('window', {
      matchMedia: (abfrage: string) => {
        abfragen.push(abfrage)
        return { matches: standalone, addEventListener: vi.fn(), removeEventListener: vi.fn() }
      },
    })
    vi.stubGlobal('navigator', iosStandalone === undefined ? {} : { standalone: iosStandalone })
    return abfragen
  }

  it('in der installierten App (display-mode: standalone) verborgen', () => {
    const abfragen = browser({ standalone: true })
    expect(anzeigeImBrowser()).toBe('app')
    expect(abfragen).toEqual(['(display-mode: standalone)'])
  })

  it('vom iPhone-Startbildschirm geöffnet (navigator.standalone) verborgen', () => {
    browser({ standalone: false, iosStandalone: true })
    expect(anzeigeImBrowser()).toBe('app')
  })

  it('im Browser sichtbar — Gegenprobe zu beiden', () => {
    browser({ standalone: false })
    expect(anzeigeImBrowser()).toBe('browser')
    browser({ standalone: false, iosStandalone: false })
    expect(anzeigeImBrowser()).toBe('browser')
  })

  it('der Server rendert nichts — die Entscheidung fällt erst nach dem Mounten (keine Hydration-Abweichung)', () => {
    expect(renderToStaticMarkup(createElement(StartbildschirmKarte))).toBe('')
    const text = quelle('src/components/heute/startbildschirm-karte.tsx')
    expect(text).toMatch(/useSyncExternalStore\(\s*abonniere,\s*anzeigeImBrowser,\s*aufDemServer\s*\)/)
  })
})

describe('Register T1 und Manifest', () => {
  it('kein Speicher im Browser: weder localStorage noch sessionStorage noch Cookie', () => {
    for (const datei of ['src/components/heute/startbildschirm-karte.tsx', 'src/lib/startbildschirm.ts']) {
      const text = quelle(datei)
      expect(text, datei).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/)
    }
    // Gegenprobe: Dieselbe Suche schlägt beim Warenkorb an, der den localStorage nutzt.
    expect(quelle('src/lib/warenkorb-speicher.ts')).toMatch(/localStorage/)
  })

  it('das Manifest bleibt: installierbar als eigenständige App, Start auf Heute', () => {
    const m = manifest()
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/dashboard')
  })
})

describe('Heute bindet die Karte ganz unten ein', () => {
  const seite = quelle('src/app/(hof)/dashboard/page.tsx')

  it('genau einmal, nach allen anderen Teilen der Seite', () => {
    expect(seite.match(/<StartbildschirmKarte \/>/g)).toHaveLength(1)
    const stelle = seite.indexOf('<StartbildschirmKarte />')
    for (const teil of ['<HeuteKopf', '<Kennzahlen', 'zeige(aufbau.haupt)', 'zeige(aufbau.seite)', '<ErsteSchritteSchalter']) {
      expect(seite.indexOf(teil), teil).toBeGreaterThan(0)
      expect(seite.indexOf(teil), teil).toBeLessThan(stelle)
    }
  })
})

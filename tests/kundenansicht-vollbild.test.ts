/**
 * Die Kundenansicht von Mein Hof am Handy als Vollbild (Register N4,
 * Ergänzung Nr. 107; src/components/mein-hof/kundenansicht-vollbild.tsx).
 *
 * Beweist (Hook-Prüfstand, TESTING_GUIDELINES §1):
 *  - Öffnen legt GENAU einen Eintrag im Verlauf an — auch zwei Aufrufe aus
 *    demselben Render; die Adresse trägt ?ansicht=kundin, das Vollbild ist offen.
 *  - Die Zurück-Geste schließt es; „Fertig" nimmt den eigenen Eintrag mit
 *    history.back zurück — Mein Hof bleibt die Seite.
 *  - Direkt über die Adresse geöffnet gibt es keinen eigenen Eintrag: „Fertig"
 *    ersetzt nur die Adresse und führt nicht aus Mein Hof hinaus.
 *  - Ab der Grenze des Reiters öffnet nichts, auch nicht mit der Adresse.
 *  - Das Band: „Kundenansicht · So sieht dich die Kundschaft" und „Fertig"
 *    aus einer Quelle, Symbole aria-hidden.
 *
 * Next gleicht useSearchParams nach pushState, replaceState und popstate an
 * die Adresse an; der Prüfstand spielt das nach, indem useSearchParams die
 * gestellte Adresse liest. Fokus und Scroll-Stelle prüft der Bild-Durchgang.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const pruefstand = vi.hoisted(() => {
  type Effekt = { deps: readonly unknown[] | undefined; aufraeumen: void | (() => void) }
  let zellen: unknown[] = []
  let zeiger = 0
  let faellig: Array<() => void> = []
  const gleich = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) =>
    a !== undefined && b !== undefined && a.length === b.length && a.every((d, k) => Object.is(d, b[k]))
  return {
    neu(): void {
      zellen = []
    },
    /** Rendert einmal: Hooks je Aufrufstelle, Effekte danach, wenn sich ihre Abhängigkeiten geändert haben. */
    rendere<T>(komponente: () => T): T {
      zeiger = 0
      faellig = []
      const ergebnis = komponente()
      const laeufe = faellig
      faellig = []
      for (const lauf of laeufe) lauf()
      return ergebnis
    },
    useRef<T>(anfang: T): { current: T } {
      const i = zeiger++
      if (!(i in zellen)) zellen[i] = { current: anfang }
      return zellen[i] as { current: T }
    },
    useEffect(wirkung: () => void | (() => void), deps?: readonly unknown[]): void {
      const i = zeiger++
      const alt = zellen[i] as Effekt | undefined
      if (alt && gleich(alt.deps, deps)) return
      faellig.push(() => {
        if (typeof alt?.aufraeumen === 'function') alt.aufraeumen()
        zellen[i] = { deps, aufraeumen: wirkung() }
      })
    },
    useCallback<T>(rueckruf: T, deps: readonly unknown[]): T {
      const i = zeiger++
      const alt = zellen[i] as { deps: readonly unknown[]; rueckruf: T } | undefined
      if (alt && gleich(alt.deps, deps)) return alt.rueckruf
      zellen[i] = { deps, rueckruf }
      return rueckruf
    },
  }
})

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useRef: pruefstand.useRef,
  useEffect: pruefstand.useEffect,
  useCallback: pruefstand.useCallback,
}))

/** Der Verlauf des Browsers, wie der Hook ihn sieht: Einträge, die aktuelle Adresse, Zurück. */
const verlauf = vi.hoisted(() => {
  const zustand = { eintraege: ['/farm-page'], stelle: 0 }
  const adresse = () => new URL(zustand.eintraege[zustand.stelle], 'https://hof.example')
  return {
    zustand,
    adresse,
    setze(start: string): void {
      zustand.eintraege = [start]
      zustand.stelle = 0
    },
    history: {
      pushState: vi.fn((_daten: unknown, _titel: string, url: string) => {
        zustand.eintraege = [...zustand.eintraege.slice(0, zustand.stelle + 1), url]
        zustand.stelle += 1
      }),
      replaceState: vi.fn((_daten: unknown, _titel: string, url: string) => {
        zustand.eintraege[zustand.stelle] = url
      }),
      // Wie die Zurück-Geste: eine Stelle zurück (popstate; Next liest danach die Adresse).
      back: vi.fn(() => {
        zustand.stelle = Math.max(0, zustand.stelle - 1)
      }),
    },
  }
})

vi.mock('next/navigation', () => ({
  useSearchParams: () => verlauf.adresse().searchParams,
}))

import { KundenansichtBand, useKundenansicht } from '@/components/mein-hof/kundenansicht-vollbild'
import { MEIN_HOF_ANSICHT_TEXT } from '@/lib/mein-hof-ansicht'

function stelleFenster(): void {
  vi.stubGlobal('window', {
    get location() {
      const { pathname, search, hash } = verlauf.adresse()
      return { pathname, search, hash }
    },
    history: verlauf.history,
  })
}

const rendere = (erlaubt = true) => pruefstand.rendere(() => useKundenansicht(erlaubt))
const eintraege = () => verlauf.zustand.eintraege.slice(0, verlauf.zustand.stelle + 1)

beforeEach(() => {
  pruefstand.neu()
  verlauf.setze('/farm-page')
  vi.clearAllMocks()
  stelleFenster()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useKundenansicht — Zustand und Verlauf', () => {
  it('öffnen legt genau einen Eintrag an — auch zweimal aus demselben Render', () => {
    const zu = rendere()
    expect(zu.offen).toBe(false)
    zu.oeffne()
    zu.oeffne()
    expect(verlauf.history.pushState).toHaveBeenCalledOnce()
    expect(eintraege()).toEqual(['/farm-page', '/farm-page?ansicht=kundin'])
    expect(rendere().offen).toBe(true)
  })

  it('die Zurück-Geste schließt; danach öffnet ein neuer Tipp wieder genau einen Eintrag', () => {
    rendere().oeffne()
    expect(rendere().offen).toBe(true)
    verlauf.history.back() // die Geste, nicht „Fertig"
    expect(rendere().offen).toBe(false)
    rendere().oeffne()
    expect(eintraege()).toEqual(['/farm-page', '/farm-page?ansicht=kundin'])
  })

  it('„Fertig" nimmt den eigenen Eintrag zurück — Mein Hof bleibt die Seite', () => {
    rendere().oeffne()
    const offen = rendere()
    offen.schliesse()
    expect(verlauf.history.back).toHaveBeenCalledOnce()
    expect(verlauf.history.replaceState).not.toHaveBeenCalled()
    expect(eintraege()).toEqual(['/farm-page'])
    expect(rendere().offen).toBe(false)
  })

  it('die übrigen Parameter bleiben (Reiter Beiträge)', () => {
    verlauf.setze('/farm-page?reiter=beitraege')
    rendere().oeffne()
    expect(eintraege().at(-1)).toBe('/farm-page?reiter=beitraege&ansicht=kundin')
  })

  it('direkt über die Adresse geöffnet: „Fertig" ersetzt nur die Adresse und geht nicht zurück', () => {
    verlauf.setze('/farm-page?ansicht=kundin')
    const offen = rendere()
    expect(offen.offen).toBe(true)
    offen.schliesse()
    expect(verlauf.history.back).not.toHaveBeenCalled()
    expect(eintraege()).toEqual(['/farm-page'])
    expect(rendere().offen).toBe(false)
  })

  it('nach der Zurück-Geste gilt auch ein späterer Aufruf über die Adresse nicht als eigener Eintrag', () => {
    rendere().oeffne()
    rendere()
    verlauf.history.back()
    rendere()
    // Vorwärts wieder auf den Eintrag mit der Ansicht — er stammt nicht mehr aus diesem Öffnen.
    verlauf.zustand.stelle = 1
    const offen = rendere()
    expect(offen.offen).toBe(true)
    vi.clearAllMocks()
    offen.schliesse()
    expect(verlauf.history.back).not.toHaveBeenCalled()
    expect(verlauf.history.replaceState).toHaveBeenCalledOnce()
  })

  it('ab der Grenze des Reiters öffnet nichts, auch nicht mit der Adresse', () => {
    verlauf.setze('/farm-page?ansicht=kundin')
    expect(rendere(false).offen).toBe(false)
  })
})

describe('Band des Vollbilds', () => {
  const band = () => renderToStaticMarkup(createElement(KundenansichtBand, { onFertig: () => {} }))

  it('„Kundenansicht · So sieht dich die Kundschaft" und „Fertig" aus der einen Quelle', () => {
    const html = band()
    expect(html).toContain(`>${MEIN_HOF_ANSICHT_TEXT.kundenansicht}</h2>`)
    expect(html).toContain(`>${MEIN_HOF_ANSICHT_TEXT.kundschaft}</p>`)
    expect(html).toMatch(new RegExp(`<button type="button"[^>]*>${MEIN_HOF_ANSICHT_TEXT.fertig}</button>`))
  })

  it('das Auge ist aria-hidden; kein Hexwert', () => {
    const html = band()
    const symbole = html.match(/<svg[^>]*>/g) ?? []
    expect(symbole.length).toBeGreaterThan(0)
    for (const svg of symbole) expect(svg).toContain('aria-hidden="true"')
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

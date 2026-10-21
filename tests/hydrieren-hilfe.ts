/**
 * Hilfe für tests/hydrieren.test.ts (Nr. 135, G6-Ergänzung 21.10.2026): Rendert ein Teil wie Next es tut —
 * erst als HTML auf dem Server, dann im Browser über das fertige HTML (`hydrateRoot`) — und sammelt, was
 * React dabei meldet. Die Umgebung ist jsdom; nur diese Datei und ihr Test brauchen sie (TESTING_GUIDELINES §1).
 *
 * Der Server-Teil sieht KEINEN Browser: Für die Dauer von `renderToString` fehlen `window`, `document`,
 * `navigator`, `localStorage` und `matchMedia` ganz (nicht leer, nicht null). Sonst sähe der „Server“ den
 * Browser, beide Seiten rechneten dasselbe, und der Test bliebe immer grün. Danach stehen die Objekte wieder da.
 * Bleibt eines trotz Entfernen sichtbar, bricht die Hilfe ab, statt still zu prüfen.
 *
 * Gesammelt werden `onRecoverableError` (React fällt auf Client-Rendern zurück: Text- oder Elementabweichung)
 * und `console.error` (Abweichung in einem Attribut, Warnungen von React). Erwartung: keine Meldung.
 * Das Ergebnis nach dem Hydrieren (`container`) darf vom Server-HTML abweichen — das ist der gewollte
 * zweite Render mit Uhr, Breite oder Speicher des Browsers (useSyncExternalStore).
 */
import { act, type ReactElement } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { vi } from 'vitest'

// Ohne diese Marke meldet React jedes act() über console.error. Sie gilt für die ganze Datei — jede Testdatei läuft in
// einem eigenen Prozess (pool: 'forks'), die übrigen Tests bleiben unberührt.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** Was es auf dem Server nicht gibt. */
export const BROWSER_OBJEKTE = ['window', 'document', 'navigator', 'localStorage', 'matchMedia'] as const

export type HydrierErgebnis = {
  /** Das HTML des Servers, ohne Browser gerendert. */
  serverHtml: string
  /** Der Container nach dem Hydrieren und allen Folge-Renderings (act). */
  container: HTMLElement
  /** Meldungen von onRecoverableError und console.error; leer = Server und Browser stimmen überein. */
  meldungen: string[]
}

/** Führt `lauf` aus, während `window`, `document`, `navigator`, `localStorage` und `matchMedia` fehlen. */
export function ohneBrowser<T>(lauf: () => T): T {
  const merker = BROWSER_OBJEKTE.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
  try {
    for (const [name] of merker) Reflect.deleteProperty(globalThis, name)
    const da = BROWSER_OBJEKTE.filter((name) => typeof (globalThis as Record<string, unknown>)[name] !== 'undefined')
    if (da.length > 0) throw new Error(`Der Server-Teil sieht noch den Browser: ${da.join(', ')} lässt sich nicht entfernen.`)
    return lauf()
  } finally {
    for (const [name, beschreibung] of merker) if (beschreibung) Object.defineProperty(globalThis, name, beschreibung)
  }
}

const offen: { wurzel: Root; container: HTMLElement }[] = []

/** Räumt die hydrierten Bäume ab (`afterEach`): Hörer und Takte der Teile enden mit dem Abbau. */
export async function raeumeHydrierenAuf(): Promise<void> {
  for (const { wurzel, container } of offen.splice(0)) {
    await act(async () => wurzel.unmount())
    container.remove()
  }
}

function text(wert: unknown): string {
  return wert instanceof Error ? wert.message : String(wert)
}

/** Erste Zeile, gekürzt: React hängt den ganzen Unterschied beider Bäume an. */
function kurz(meldung: string): string {
  const zeile = meldung.split('\n')[0]
  return zeile.length > 240 ? `${zeile.slice(0, 240)}…` : zeile
}

export type HydrierOptionen = {
  /**
   * Läuft nach dem Server-Teil und vor dem Hydrieren: Der Browser lädt die Seite später als der Server sie
   * gebaut hat — hier rückt die Uhr vor, füllt sich der Speicher, ändert sich die Breite. Fehlt das, sähen
   * beide Seiten dieselbe Uhr, und ein Teil mit `new Date()` im Rendern fiele nicht auf.
   */
  imBrowser?: () => void
}

/** Server-HTML ohne Browser, dann hydrateRoot im Browser; gibt zurück, was React dabei gemeldet hat. */
export async function hydriere(element: ReactElement, optionen: HydrierOptionen = {}): Promise<HydrierErgebnis> {
  const meldungen: string[] = []
  const fehlerAbfangen = vi.spyOn(console, 'error').mockImplementation((...teile: unknown[]) => {
    meldungen.push(`console.error: ${kurz(teile.map(text).join(' '))}`)
  })
  try {
    const serverHtml = ohneBrowser(() => renderToString(element))
    optionen.imBrowser?.()
    const container = document.createElement('div')
    container.innerHTML = serverHtml
    document.body.appendChild(container)
    await act(async () => {
      const wurzel = hydrateRoot(container, element, {
        onRecoverableError: (fehler) => {
          meldungen.push(`onRecoverableError: ${kurz(text(fehler))}`)
        },
      })
      offen.push({ wurzel, container })
    })
    return { serverHtml, container, meldungen }
  } finally {
    fehlerAbfangen.mockRestore()
  }
}

/** Wie `hydriere`, wirft aber bei jeder Meldung von React — Server und Browser müssen dasselbe zeichnen. */
export async function pruefeHydrieren(element: ReactElement, optionen: HydrierOptionen = {}): Promise<HydrierErgebnis> {
  const ergebnis = await hydriere(element, optionen)
  if (ergebnis.meldungen.length > 0) {
    throw new Error(`Hydrieren meldet ${ergebnis.meldungen.length} Abweichung(en):\n- ${ergebnis.meldungen.join('\n- ')}`)
  }
  return ergebnis
}

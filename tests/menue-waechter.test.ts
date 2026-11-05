/**
 * Die Fokuswächter eines offenen Menüs sind nicht versteckt (Nr. 233, UI-Runde 3; Axe „aria-hidden-focus“, 6 Knoten
 * bei offenem Menü „Neu“ im Web).
 *
 * Ursache: Base UI legt um Knopf, Portal und Popup eines offenen Menüs je zwei Wächter, `<span tabindex="0"
 * aria-hidden="true" data-base-ui-focus-guard>` — fokussierbar und versteckt zugleich. Hinter dem Menü ist sonst
 * nichts versteckt. `DropdownMenuContent` (src/components/ui/dropdown-menu.tsx) nimmt den Wächtern neben Popup und
 * Knopf das `aria-hidden` (`waechterFreigeben`), solange das Popup steht; die Tab-Folge bleibt die von Base UI.
 * Offen ist ein Menü nur im Browser (TESTING_GUIDELINES §1: kein DOM) — hier die Regel an Attrappen und die
 * Verdrahtung im Quelltext; im Browser prüft Axe (Bericht 233).
 *
 * Beweist:
 *  - Nur Wächter verlieren `aria-hidden`; ein stummes Symbol am selben Ort behält es. Gezählt wird, was frei wurde.
 *  - Nur die übergebenen Orte: Wächter anderswo (etwa um einen Dialog) bleiben, wie sie sind (Gegenprobe).
 *  - Das Merkmal ist das von Base UI: Die Wächter-Datei des Pakets setzt genau dieses Attribut und `aria-hidden` —
 *    benennt ein Update es um, wird der Test rot statt die Regel still wirkungslos.
 *  - Quelltext: Das Popup trägt den Ref, der Beobachter hört auf neue Kinder (die Wächter des Portals kommen später).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FOKUS_WAECHTER, waechterFreigeben, type WaechterKind } from '@/components/ui/dropdown-menu'

/** Ein Kind mit Attributen — so viel, wie `waechterFreigeben` braucht. */
function kind(attribute: Record<string, string>): WaechterKind & { attribute: Record<string, string> } {
  return {
    attribute: { ...attribute },
    hasAttribute(name) {
      return name in this.attribute
    },
    removeAttribute(name) {
      delete this.attribute[name]
    },
  }
}

const waechter = () => kind({ [FOKUS_WAECHTER]: '', 'aria-hidden': 'true', tabindex: '0' })

describe('waechterFreigeben — die Wächter des offenen Menüs', () => {
  it('nimmt den Wächtern neben Popup und Knopf das aria-hidden, Tabindex bleibt', () => {
    const vorPopup = waechter()
    const nachPopup = waechter()
    const vorKnopf = waechter()
    const nachKnopf = waechter()
    const anzahl = waechterFreigeben([{ children: [vorPopup, kind({ role: 'menu' }), nachPopup] }, { children: [vorKnopf, kind({}), nachKnopf] }])
    expect(anzahl).toBe(4)
    for (const w of [vorPopup, nachPopup, vorKnopf, nachKnopf]) {
      expect(w.hasAttribute('aria-hidden')).toBe(false)
      // Fokussierbar bleiben sie: Sie reichen den Tab weiter wie bisher.
      expect(w.attribute.tabindex).toBe('0')
    }
  })

  it('ein stummes Symbol behält aria-hidden; ein schon freier Wächter zählt nicht; fehlende Orte schaden nicht', () => {
    const symbol = kind({ 'aria-hidden': 'true' })
    const frei = kind({ [FOKUS_WAECHTER]: '' })
    expect(waechterFreigeben([{ children: [symbol, frei] }, null, undefined])).toBe(0)
    expect(symbol.hasAttribute('aria-hidden')).toBe(true)
  })

  it('Gegenprobe: Wächter an einem Ort, der nicht übergeben wird (um einen Dialog), bleiben versteckt', () => {
    const imMenue = waechter()
    const amDialog = waechter()
    const dialogOrt = { children: [amDialog] }
    expect(waechterFreigeben([{ children: [imMenue] }])).toBe(1)
    expect(amDialog.hasAttribute('aria-hidden')).toBe(true)
    // … und die Prüfung sähe es, wenn er übergeben würde.
    expect(waechterFreigeben([dialogOrt])).toBe(1)
  })

  it('das Merkmal ist das der Wächter von Base UI (tabindex 0 und aria-hidden ohne Safari-Rolle)', () => {
    const paket = readFileSync(join(process.cwd(), 'node_modules/@base-ui/react/utils/FocusGuard.js'), 'utf8')
    expect(paket).toContain(`"${FOKUS_WAECHTER}": ""`)
    expect(paket).toMatch(/"aria-hidden": role \? undefined : true/)
    expect(paket).toMatch(/tabIndex: 0/)
  })
})

describe('Quelltext: DropdownMenuContent hält die Wächter frei', () => {
  const quelle = readFileSync(join(process.cwd(), 'src/components/ui/dropdown-menu.tsx'), 'utf8')

  it('das Popup trägt den Ref, der beim Einhängen freigibt und auf neue Kinder hört', () => {
    const popup = quelle.slice(quelle.indexOf('<MenuPrimitive.Popup'), quelle.indexOf('/>', quelle.indexOf('<MenuPrimitive.Popup')))
    expect(popup).toContain('ref={waechterFrei}')
    expect(quelle).toContain('const waechterFrei = useWaechterFrei()')
    expect(quelle).toMatch(/new MutationObserver\(freigeben\)/)
    expect(quelle).toMatch(/observe\(ort, \{ childList: true \}\)/)
    // Orte: der Positionierer (Eltern des Popups) und die Eltern des Knopfs, gefunden über aria-controls.
    expect(quelle).toMatch(/\[aria-controls="\$\{CSS\.escape\(popup\.id\)\}"\]/)
    expect(quelle).toContain('return [popup.parentElement, knopf?.parentElement ?? null]')
  })
})

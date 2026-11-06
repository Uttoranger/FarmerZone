/**
 * Bausteine der Nr. 246 (Lauf 32; Liste Abschnitt 3.2: G4, G6, G7) — gerendert wie auf dem Server.
 *
 * Beweist:
 *  - G4: EmptyState ist eine linksbündige Karte mit durchgezogenem Rand (12 px), Titel fett in der Grundschrift,
 *    ohne Symbol, ohne gestrichelten Rand; ein mitgegebenes `symbol` (Altlast) erscheint nicht (Gegenprobe).
 *  - G6: Feldfehler 14 px halbfett; Zusammenfassung in Einzahl/Mehrzahl; „Nochmal“ klein, linksbündig, in der
 *    Warnfarbe, nie `disabled` (auch nicht, solange es läuft — dann `aria-busy`); ohne Handler kein Knopf; der
 *    Speicherfehler zeichnet denselben Kasten.
 *  - G7: Der Toast steht unten mittig — auch wenn der Aufrufer „oben“ mitgibt (Quelltext, Gegenprobe); Schrift
 *    und „Rückgängig“ halten auf dem Balken in beiden Themes 4,5:1 (aus globals.css gerechnet).
 *  - Die Vorschau zeigt die vier Abschnitte.
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Store } from 'lucide-react'
import { kontrast, leseOklch, oklchZuHex } from '@/lib/farbraum'
import { NETZ_KNOPF, NETZ_SATZ } from '@/lib/netz'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import { EmptyState } from '@/components/ui/empty-state'
import { HinweiskarteFehler, NOCHMAL_KNOPF } from '@/components/ui/hinweiskarte'
import { FeldFehlerSatz, FormularPruefen, SpeicherFehler, formularPruefenSatz } from '@/components/shared/formular-meldungen'
import { TOAST_KLASSEN, TOAST_LAGE } from '@/components/ui/sonner'
import { Vorschau246 } from '@/app/intern/bausteine/vorschau-246'

const WURZEL = process.cwd()
const css = readFileSync(join(WURZEL, 'src/app/globals.css'), 'utf8')
const ausweg = createElement('a', { href: '/products?neu=1' }, 'Produkt anlegen')

function block(selektor: string): string {
  const start = css.indexOf(`${selektor} {`)
  expect(start, `Block „${selektor}" fehlt`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('\n}', start))
}

function farbe(selektor: string, token: string): string {
  const treffer = block(selektor).match(new RegExp(`\\n\\s*--${token}:\\s*([^;]+);`))
  expect(treffer, `${selektor} --${token}`).not.toBeNull()
  const oklch = leseOklch((treffer?.[1] ?? '').trim())
  expect(oklch, `${selektor} --${token} ist kein oklch`).not.toBeNull()
  return oklchZuHex(oklch ?? { l: 0, c: 0, h: 0 })
}

const HELL = ':root'
const DUNKEL = '[data-theme="dark"]'

describe('G4 — EmptyState ohne Symbol', () => {
  it('linksbündige Karte mit durchgezogenem Rand, 12 px, Titel fett in der Grundschrift, Ausweg über die volle Breite', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { titel: 'Noch nichts', satz: 'Ein Satz.', ausweg }))
    const klassen = html.match(/data-slot="empty-state" class="([^"]*)"/)?.[1] ?? ''
    expect(klassen.split(' ')).toEqual(expect.arrayContaining(['text-left', 'border', 'border-border', 'bg-card', 'rounded-[12px]']))
    expect(klassen).not.toMatch(/border-dashed|items-center|text-center|rounded-2xl/)
    expect(html).toMatch(/<p class="text-\[16px\] font-bold text-foreground">Noch nichts<\/p>/)
    expect(html).not.toContain('font-heading')
    expect(html).toContain('*:w-full')
    expect(html).not.toContain('<svg')
  })

  it('Gegenprobe: ein altes `symbol` am Aufruf erscheint nicht mehr — und der Typ lehnt es ab', () => {
    // @ts-expect-error — Prop `symbol` ist seit Nr. 246 entfallen (G4); der Typ muss es ablehnen.
    const html = renderToStaticMarkup(createElement(EmptyState, { symbol: Store, titel: 'T', ausweg }))
    expect(html).not.toContain('lucide-store')
    expect(html).toContain('>T</p>')
  })

  it('die Klassen des Aufrufers stehen hinter der Rundung (Leerzustand in einer Karte)', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { titel: 'T', ausweg, className: 'rounded-none border-0 py-8' }))
    expect(html).toContain('rounded-none')
    expect(html).not.toContain('rounded-[12px]')
  })
})

describe('G6 — Formularfehler und „Nochmal“', () => {
  it('der Feldfehler steht in Fließtextgröße halbfett, orange, mit role="alert"', () => {
    const html = renderToStaticMarkup(createElement(FeldFehlerSatz, { feldId: 'plz', text: 'Die Postleitzahl hat 4 Ziffern.' }))
    expect(html).toMatch(/<p id="plz-fehler" role="alert" class="[^"]*text-\[14px\][^"]*font-semibold[^"]*text-status-offen/)
    expect(html).not.toContain('text-xs')
  })

  it('die Zusammenfassung: ein Feld in der Einzahl, mehrere in der Mehrzahl, ohne Fehler nichts', () => {
    expect(formularPruefenSatz(1)).toBe('Bitte prüfe das markierte Feld.')
    expect(formularPruefenSatz(3)).toBe('Bitte prüfe die markierten Felder.')
    expect(renderToStaticMarkup(createElement(FormularPruefen, { anzahl: 0 }))).toBe('')
    const html = renderToStaticMarkup(createElement(FormularPruefen, { anzahl: 1 }))
    expect(html).toMatch(/<p role="alert" data-slot="formular-pruefen" class="[^"]*bg-zustand-tun-grund[^"]*text-zustand-tun[^"]*">Bitte prüfe das markierte Feld\.<\/p>/)
  })

  it('„Nochmal“ ist klein, linksbündig, in der Warnfarbe — und nie deaktiviert, auch nicht, solange es läuft', () => {
    const klassen = NOCHMAL_KNOPF.split(' ')
    expect(klassen).toEqual(expect.arrayContaining(['self-start', 'min-h-11', 'border-zustand-tun', 'text-zustand-tun']))
    expect(klassen).not.toContain('w-full')
    const laeuft = renderToStaticMarkup(createElement(HinweiskarteFehler, { nochmal: () => undefined, laeuft: true }, NETZ_SATZ))
    expect(laeuft).toMatch(new RegExp(`<button type="button"[^>]*aria-busy="true"[^>]*>${NETZ_KNOPF}</button>`))
    expect(laeuft).not.toMatch(/<button[^>]*disabled/)
  })

  it('Gegenprobe: ohne Handler kein Knopf; ohne Titel nur der Satz, halbfett', () => {
    const html = renderToStaticMarkup(createElement(HinweiskarteFehler, null, NETZ_SATZ))
    expect(html).not.toContain('<button')
    expect(html).not.toContain('text-[15px] font-bold')
    expect(html).toMatch(new RegExp(`<div class="text-\\[14px\\] leading-normal font-semibold">${NETZ_SATZ}</div>`))
  })

  it('der Speicherfehler zeichnet denselben Kasten — „Nochmal“ nur, wenn der Aufrufer es will', () => {
    const mit = renderToStaticMarkup(createElement(SpeicherFehler, { text: NETZ_SATZ, nochmal: true, onNochmal: () => undefined }))
    expect(mit).toContain('data-slot="hinweiskarte-fehler"')
    expect(mit).toContain('data-slot="nochmal"')
    const ohne = renderToStaticMarkup(createElement(SpeicherFehler, { text: NETZ_SATZ, nochmal: false, onNochmal: () => undefined }))
    expect(ohne).toContain('data-slot="hinweiskarte-fehler"')
    expect(ohne).not.toContain('data-slot="nochmal"')
  })
})

describe('G7 — Meldung (Toast)', () => {
  const quelle = readFileSync(join(WURZEL, 'src/components/ui/sonner.tsx'), 'utf8')

  it('steht unten mittig: Lage und Farbe stehen NACH dem Spread der Aufrufer-Props', () => {
    expect(TOAST_LAGE).toBe('bottom-center')
    const spread = quelle.indexOf('{...props}')
    expect(spread).toBeGreaterThan(-1)
    expect(quelle.indexOf('position={TOAST_LAGE}')).toBeGreaterThan(spread)
    expect(quelle.indexOf('richColors={false}')).toBeGreaterThan(spread)
  })

  it('Gegenprobe: die alte Lage „top-center“ im Layout stünde vor dem Baustein und gewönne nicht', () => {
    const layout = readFileSync(join(WURZEL, 'src/app/layout.tsx'), 'utf8')
    // Das Layout (außerhalb von Nr. 246) gibt noch „top-center“ mit — die Reihenfolge im Baustein entscheidet.
    expect(layout).toMatch(/<Toaster[^>]*position="top-center"/)
    const umgedreht = quelle.replace('{...props}', '').replace('richColors={false}', 'richColors={false}\n      {...props}')
    expect(umgedreht.indexOf('{...props}')).toBeGreaterThan(umgedreht.indexOf('position={TOAST_LAGE}'))
  })

  it('der Balken nimmt die Tokens: hell --fz-text, dunkel --fz-border, Schrift --fz-on-accent, „Rückgängig“ --fz-primary', () => {
    expect(TOAST_KLASSEN.toast).toContain('bg-[var(--fz-text)]!')
    expect(TOAST_KLASSEN.toast).toContain('dark:bg-[var(--fz-border)]!')
    expect(TOAST_KLASSEN.toast).toContain('text-[var(--fz-on-accent)]!')
    expect(TOAST_KLASSEN.actionButton).toContain('text-[var(--fz-primary)]!')
    expect(TOAST_KLASSEN.actionButton).toContain('bg-transparent!')
  })

  it('Schrift und „Rückgängig“ halten auf dem Balken in beiden Themes 4,5:1', () => {
    for (const [modus, grund] of [
      [HELL, 'fz-text'],
      [DUNKEL, 'fz-border'],
    ] as const) {
      const flaeche = farbe(modus, grund)
      expect(kontrast(farbe(modus, 'fz-on-accent'), flaeche), `${modus} Schrift`).toBeGreaterThanOrEqual(4.5)
      expect(kontrast(farbe(modus, 'fz-primary'), flaeche), `${modus} Rückgängig`).toBeGreaterThanOrEqual(4.5)
    }
    // Gegenprobe: dieselbe Rechnung schlägt bei der leisen Textfarbe auf dem dunklen Grund der Nacht an.
    expect(kontrast(farbe(DUNKEL, 'fz-text-muted'), farbe(DUNKEL, 'fz-text'))).toBeLessThan(4.5)
  })
})

describe('Vorschau der Nr. 246', () => {
  it('zeigt Leerzustand, Formularfehler, Meldung und Startfokus', () => {
    const html = renderToStaticMarkup(createElement(Vorschau246))
    for (const id of ['leerzustand-246', 'formularfehler-246', 'meldung-246', 'startfokus-246']) expect(html).toContain(`id="${id}-titel"`)
    expect(html).toContain('data-slot="empty-state"')
    expect(html).toContain('data-slot="formular-pruefen"')
    expect(html).not.toContain('<svg')
  })
})

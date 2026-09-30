/**
 * Tests für die Farbtokens des Design-Systems in src/app/globals.css
 * (Schritt 1 des Redesigns, docs/umsetzungsprompt.md).
 *
 * Beweist:
 *  - Jede Zeile der Tabelle in docs/ai/DESIGN_SYSTEM.md steht als --fz-Token in
 *    beiden Modi, und kein Token steht in der CSS, das die Tabelle nicht kennt.
 *  - Die oklch-Werte treffen die Hexwerte der Tabelle (höchstens 1 je Kanal).
 *  - Der Modus hängt an data-theme, nicht mehr an einer Klasse — mit derselben
 *    Spezifität wie vorher, damit hover: und aria-*: die dark:-Klasse nicht
 *    überstimmen.
 *  - Im Geltungsbereich data-design="neu" zeigen die shadcn-Variablen auf die
 *    Tokens, grüner Text und Fokusring auf die kontrastsichere Variante, und
 *    die Fließschrift wird Instrument Sans.
 *  - Text auf Grund und Fläche, Schrift auf Knöpfen, grüner Text und die
 *    Zustandsfarben erreichen in beiden Modi 4,5:1 (DESIGN_SYSTEM „Qualität").
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hexAbstand, kontrast, leseHex, leseOklch, oklchZuHex } from '@/lib/farbraum'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
const doku = readFileSync(join(process.cwd(), 'docs/ai/DESIGN_SYSTEM.md'), 'utf8')

const HELL = ':root'
const DUNKEL = '[data-theme="dark"]'
const NEU = ':root:is([data-design="neu"], :has([data-design="neu"]))'

/** Wirft mit Ortsangabe statt einer stummen Nicht-null-Behauptung. */
function sicher<T>(wert: T | null | undefined, was: string): T {
  if (wert === null || wert === undefined) throw new Error(`fehlt: ${was}`)
  return wert
}

/** Die Tabelle „Token | Dunkel | Hell" aus dem Design-System. */
function tabelle(): Map<string, { dunkel: string; hell: string }> {
  const zeilen = new Map<string, { dunkel: string; hell: string }>()
  for (const m of doku.matchAll(/^\|\s*--([a-z-]+)[^|]*\|\s*(#[0-9A-Fa-f]{6})\s*\|\s*(#[0-9A-Fa-f]{6})\s*\|/gm)) {
    zeilen.set(m[1], { dunkel: sicher(leseHex(m[2]), m[2]), hell: sicher(leseHex(m[3]), m[3]) })
  }
  return zeilen
}

const soll = tabelle()
const wert = (token: string, modus: 'hell' | 'dunkel'): string => sicher(soll.get(token), `Tabelle --${token}`)[modus]

/** Der CSS-Block zu einem Selektor — bis zur ersten schließenden Klammer am Zeilenanfang. */
function block(selektor: string): string {
  const start = css.indexOf(`${selektor} {`)
  expect(start, `Block „${selektor}" fehlt`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('\n}', start))
}

/** Alle --fz-Tokens eines Blocks mit ihrem Wert. */
function tokens(blockText: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of blockText.matchAll(/--fz-([a-z-]+):\s*([^;]+);/g)) map.set(m[1], m[2].trim())
  return map
}

/** Der Hexwert eines Tokens in einem Modus, aus dem oklch-Wert zurückgerechnet. */
function hexVon(modus: string, token: string): string {
  const roh = sicher(tokens(block(modus)).get(token), `${modus} --fz-${token}`)
  return oklchZuHex(sicher(leseOklch(roh), `${modus} --fz-${token} ist kein oklch: ${roh}`))
}

describe('Tabelle und CSS decken sich', () => {
  it('die Tabelle im Design-System hat elf Tokens', () => {
    expect([...soll.keys()].toSorted()).toEqual(
      ['accent', 'bg', 'border', 'on-accent', 'on-primary', 'primary', 'status-fertig', 'status-offen', 'surface', 'text', 'text-muted'].toSorted()
    )
  })

  it('jedes Token steht in beiden Modi — und keins mehr', () => {
    expect([...tokens(block(HELL)).keys()].toSorted()).toEqual([...soll.keys()].toSorted())
    expect([...tokens(block(DUNKEL)).keys()].toSorted()).toEqual([...soll.keys()].toSorted())
  })

  it('die oklch-Werte treffen die Hexwerte der Tabelle, hell und dunkel', () => {
    for (const [token, { hell, dunkel }] of soll) {
      expect(hexAbstand(hexVon(HELL, token), hell), `hell --fz-${token}`).toBeLessThanOrEqual(1)
      expect(hexAbstand(hexVon(DUNKEL, token), dunkel), `dunkel --fz-${token}`).toBeLessThanOrEqual(1)
    }
  })

  it('der Hexwert steht als Kommentar neben jedem Token (CODING_STANDARDS §7)', () => {
    for (const modus of [HELL, DUNKEL]) {
      for (const [token, roh] of tokens(block(modus))) {
        const zeile = sicher(block(modus).match(new RegExp(`--fz-${token}:[^\\n]*`)), `${modus} --fz-${token}`)[0]
        expect(zeile, `${modus} --fz-${token}`).toMatch(/\/\*\s*#[0-9A-F]{6}/)
        expect(roh).toMatch(/^oklch\(/)
      }
    }
  })
})

describe('Modus über data-theme', () => {
  it('die dark-Variante folgt dem Attribut mit :is — dieselbe Spezifität wie die frühere Klasse', () => {
    expect(css).toContain('@custom-variant dark (&:is([data-theme="dark"] *));')
    expect(css).not.toMatch(/\.dark\s*\{/)
    expect(css).not.toContain('.dark *')
    expect(css).not.toContain(':where([data-theme')
  })

  it('native Bedienteile folgen dem Modus', () => {
    expect(block(HELL)).toContain('color-scheme: light;')
    expect(block(DUNKEL)).toContain('color-scheme: dark;')
  })
})

describe('Geltungsbereich data-design="neu"', () => {
  const neu = block(NEU)

  it('die shadcn-Variablen zeigen auf die Tokens', () => {
    const zuordnung: Record<string, string> = {
      background: 'bg',
      foreground: 'text',
      card: 'surface',
      'card-foreground': 'text',
      popover: 'surface',
      'popover-foreground': 'text',
      primary: 'primary',
      'primary-foreground': 'on-primary',
      accent: 'accent',
      'accent-foreground': 'on-accent',
      'muted-foreground': 'text-muted',
      border: 'border',
      input: 'border',
    }
    for (const [variable, token] of Object.entries(zuordnung)) {
      expect(neu, variable).toContain(`--${variable}: var(--fz-${token});`)
    }
  })

  it('grüner Text und Fokusring nehmen die kontrastsichere Variante, nicht das Knopf-Grün', () => {
    for (const variable of ['brand-text', 'ring', 'sidebar-ring']) {
      expect(neu, variable).toContain(`--${variable}: var(--fz-status-fertig);`)
    }
    // Das Knopf-Grün hätte im Dunkeln nur 3:1 auf dem Grund — als Text zu wenig.
    expect(kontrast(wert('accent', 'dunkel'), wert('bg', 'dunkel'))).toBeLessThan(4.5)
    expect(kontrast(wert('status-fertig', 'dunkel'), wert('bg', 'dunkel'))).toBeGreaterThanOrEqual(4.5)
  })

  it('abgeleitete Werte sind als solche gekennzeichnet', () => {
    for (const variable of ['muted', 'secondary', 'accent-hover']) {
      expect(neu, variable).toMatch(new RegExp(`--${variable}: color-mix\\(in oklch,`))
    }
    expect(neu).toMatch(/abgeleitet/)
  })

  it('die Fließschrift wird Instrument Sans, außerhalb bleibt Geist; Überschriften Fraunces', () => {
    expect(neu).toContain('--font-sans-aktiv: var(--font-instrument-sans);')
    expect(block(HELL)).toContain('--font-sans-aktiv: var(--font-geist-sans);')
    expect(css).toContain('--font-sans: var(--font-sans-aktiv);')
    expect(css).toContain('--font-heading: var(--font-fraunces);')
  })

  it('die Zustandsfarben sind als Utilities erreichbar', () => {
    expect(css).toContain('--color-status-offen: var(--fz-status-offen);')
    expect(css).toContain('--color-status-fertig: var(--fz-status-fertig);')
  })

  it('der Geltungsbereich steht nach beiden Modusblöcken — er gewinnt ohnehin über die Spezifität (0,2,0), soll aber als Überlagerung lesbar bleiben', () => {
    expect(css.indexOf(`${NEU} {`)).toBeGreaterThan(css.indexOf(`${DUNKEL} {`))
  })
})

describe('Kontrast in beiden Modi (≥ 4,5:1)', () => {
  const paare: [string, string][] = [
    ['text', 'bg'],
    ['text', 'surface'],
    ['text-muted', 'bg'],
    ['text-muted', 'surface'],
    ['on-accent', 'accent'],
    ['on-primary', 'primary'],
    ['status-offen', 'bg'],
    ['status-offen', 'surface'],
    ['status-fertig', 'bg'],
    ['status-fertig', 'surface'],
  ]

  it.each(paare)('%s auf %s', (vorne, hinten) => {
    expect(kontrast(wert(vorne, 'hell'), wert(hinten, 'hell')), 'hell').toBeGreaterThanOrEqual(4.5)
    expect(kontrast(wert(vorne, 'dunkel'), wert(hinten, 'dunkel')), 'dunkel').toBeGreaterThanOrEqual(4.5)
  })

  it('die Zustandsfarbe des anderen Modus fiele durch — deshalb je Modus eigene Werte', () => {
    expect(kontrast(wert('status-offen', 'dunkel'), wert('bg', 'hell'))).toBeLessThan(4.5)
  })
})

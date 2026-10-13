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
 *  - Bedeutungsfarben (Register G5, Nr. 79): Jede Art der Marke hat Text und
 *    Fläche als Token in beiden Modi, als Utility erreichbar; Text auf eigener
 *    Fläche ≥ 4,5:1.
 *  - In src/components und src/lib steht kein Hexwert außer den benannten
 *    Ausnahmen (je mit Grund) und der Nacharbeit-Liste (Kommentare zählen nicht).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { hexAbstand, kontrast, leseHex, leseOklch, oklchZuHex } from '@/lib/farbraum'
import { MARKE_ARTEN } from '@/lib/marke-art'

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

/** Text- und Flächen-Token je Art der Marke (Register G5). */
const ZUSTAND_PAARE: [string, string][] = MARKE_ARTEN.map((art) => [`zustand-${art}`, `zustand-${art}-grund`])

describe('Tabelle und CSS decken sich', () => {
  it('die Tabelle im Design-System hat neunzehn Tokens — elf Grundfarben, acht Bedeutungsfarben', () => {
    expect([...soll.keys()].toSorted()).toEqual(
      [
        'accent', 'bg', 'border', 'on-accent', 'on-primary', 'primary', 'status-fertig', 'status-offen', 'surface', 'text', 'text-muted',
        ...ZUSTAND_PAARE.flat(),
      ].toSorted()
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

  it('die Bedeutungsfarben (G5) sind als Utilities erreichbar — Text und Fläche je Art der Marke', () => {
    for (const [text, flaeche] of ZUSTAND_PAARE) {
      expect(css).toContain(`--color-${text}: var(--fz-${text});`)
      expect(css).toContain(`--color-${flaeche}: var(--fz-${flaeche});`)
    }
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
    // Die Marke trägt ihre eigene Fläche — ihr Text zählt nur gegen diese.
    ...ZUSTAND_PAARE,
  ]

  it.each(paare)('%s auf %s', (vorne, hinten) => {
    expect(kontrast(wert(vorne, 'hell'), wert(hinten, 'hell')), 'hell').toBeGreaterThanOrEqual(4.5)
    expect(kontrast(wert(vorne, 'dunkel'), wert(hinten, 'dunkel')), 'dunkel').toBeGreaterThanOrEqual(4.5)
  })

  it('die Zustandsfarbe des anderen Modus fiele durch — deshalb je Modus eigene Werte', () => {
    expect(kontrast(wert('status-offen', 'dunkel'), wert('bg', 'hell'))).toBeLessThan(4.5)
  })

  it('die alten Hexwerte der Marken (tun, erledigt) fielen hell durch — deshalb dunklere Schrift', () => {
    expect(kontrast('#E8854A', '#FBEEE3')).toBeLessThan(4.5)
    expect(kontrast('#9AA08F', '#F0EDE5')).toBeLessThan(4.5)
  })
})

describe('Hexwerte im Code (Register G5)', () => {
  const HEXWERT = /#[0-9A-Fa-f]{6}/g

  /** Benannte Ausnahmen (G5): Dort greift kein Token — je ein Satz, warum. */
  const AUSNAHMEN: { pfad: RegExp; nurIn?: string; grund: string }[] = [
    { pfad: /\/teilen-bild[^/]*$/, grund: 'Das Teilen-Bild zeichnet Satori als Bild — dort gibt es keine CSS-Variablen.' },
    { pfad: /\/emails\//, grund: 'Mailprogramme kennen weder CSS-Variablen noch den Modus der Seite.' },
    { pfad: /\/qr[^/]*$/, grund: 'Ein QR-Code braucht festes Dunkel auf Hell, sonst liest ihn keine Kamera.' },
    { pfad: /\/umgebungs-banner\.tsx$/, grund: 'Das Absperrband der Testumgebung ist in beiden Modi gleich (DESIGN_SYSTEM „Farbtokens“).' },
    { pfad: /^src\/lib\/hoefe-anzeige\.ts$/, grund: 'Die Leaflet-Pins entstehen als HTML-Text auf Kartenkacheln, die dem Modus nicht folgen.' },
    { pfad: /^src\/lib\/mein-hof\.ts$/, nurIn: 'TITELBILD_VERLAEUFE', grund: 'Die Titelbild-Verläufe ersetzen ein Foto und folgen dem Modus nicht — nur diese Tabelle.' },
    { pfad: /^src\/lib\/farbraum\.ts$/, grund: 'Die Farbumrechnung liest und schreibt Hexwerte als Daten.' },
    { pfad: /^src\/components\/checkout\/stripe-payment\.tsx$/, grund: 'Stripe Elements zeichnen in einem fremden Rahmen und kennen die CSS-Variablen der Seite nicht.' },
    { pfad: /^src\/components\/shared\/wortmarke\.tsx$/, grund: 'Die Wortmarke ist das Logo und folgt dem Modus nicht.' },
  ]

  /**
   * Nacharbeit: Hexwerte außerhalb der Dateigrenzen von Nr. 79 und 85 (Nr. 85 hat
   * farm-page-view, product-grid und farmer-nav in Tokens überführt und hier
   * gestrichen). Je Datei nur genau diese Werte — ein neuer schlägt sofort an.
   */
  const NACHARBEIT: Record<string, string[]> = {
    // Die Plakette nimmt künftig --leiste-plakette/-ink wie farmer-nav.tsx (Nr. 85); #A9CFE3 braucht ein eigenes Token.
    'src/components/farmer/farm-identity-card.tsx': ['#F2E5D3', '#8B6B4F', '#A9CFE3'],
    // Der runde Knopf auf dem Titelbild nimmt künftig --foto-knopf-ink wie farm-page-view.tsx (Nr. 85).
    'src/components/shared/kunden-kopf.tsx': ['#2D5F3F'],
  }

  type Fund = { zeile: number; wert: string; konstante: string | null }

  /** Die Konstante, in deren Wert der Knoten steht — für „nur diese Tabelle“. */
  function konstanteVon(knoten: ts.Node): string | null {
    for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
      if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name)) return k.name.text
    }
    return null
  }

  /** Hexwerte in Zeichenketten, Vorlagen und JSX-Text — Kommentare zählen nicht (Syntaxbaum statt Zeilen-Grep). */
  function findeHexwerte(quelltext: string, pfad = 'schnipsel.tsx'): Fund[] {
    const art = pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, art)
    const funde: Fund[] = []
    const besuche = (knoten: ts.Node): void => {
      let text: string | null = null
      if (ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)) text = knoten.text
      else if (ts.isTemplateHead(knoten) || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten)) text = knoten.text
      else if (ts.isJsxText(knoten)) text = knoten.text
      for (const m of text?.matchAll(HEXWERT) ?? []) {
        const zeile = datei.getLineAndCharacterOfPosition(knoten.getStart(datei)).line + 1
        funde.push({ zeile, wert: m[0].toUpperCase(), konstante: konstanteVon(knoten) })
      }
      ts.forEachChild(knoten, besuche)
    }
    besuche(datei)
    return funde
  }

  function* quelldateien(ordner: string): Generator<string> {
    for (const name of readdirSync(ordner)) {
      const pfad = join(ordner, name)
      if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
      else if (/\.(ts|tsx)$/.test(name)) yield pfad
    }
  }

  it('Gegenprobe: findet Hexwerte in Zeichenkette, Klasse, Vorlage und JSX-Text — nicht im Kommentar', () => {
    const schnipsel = [
      '// #111111 im Kommentar zählt nicht',
      '/* #222222 auch nicht */',
      "const ORANGE = 'bg-[#FBEEE3] text-[#E8854A]'",
      `const verlauf = \`linear-gradient(#abcdef, \${rest})\``,
      'const marke = <span className="text-[#2D5F3F]">#333333</span>',
    ].join('\n')
    const funde = findeHexwerte(schnipsel)
    expect(funde.map((f) => f.wert)).toEqual(['#FBEEE3', '#E8854A', '#ABCDEF', '#2D5F3F', '#333333'])
    expect(funde.map((f) => f.konstante)).toEqual(['ORANGE', 'ORANGE', 'verlauf', 'marke', 'marke'])
  })

  it('kein Hexwert in src/components und src/lib außer den benannten Ausnahmen und der Nacharbeit', () => {
    const verstoesse: string[] = []
    for (const ordner of ['src/components', 'src/lib']) {
      for (const datei of quelldateien(join(process.cwd(), ordner))) {
        const text = readFileSync(datei, 'utf8')
        // Nur Dateien mit einem Treffer im Rohtext parsen; ob er im Kommentar steht, entscheidet der Syntaxbaum.
        if (!/#[0-9A-Fa-f]{6}/.test(text)) continue
        const pfad = relative(process.cwd(), datei).split(sep).join('/')
        const ausnahme = AUSNAHMEN.find((a) => a.pfad.test(pfad))
        for (const fund of findeHexwerte(text, pfad)) {
          if (ausnahme && (ausnahme.nurIn === undefined || ausnahme.nurIn === fund.konstante)) continue
          if (NACHARBEIT[pfad]?.includes(fund.wert)) continue
          verstoesse.push(`${pfad}:${fund.zeile} ${fund.wert}`)
        }
      }
    }
    expect(verstoesse).toEqual([])
  })

  it('Gegenprobe am Bestand: die Verläufe in mein-hof.ts stehen nur in ihrer Tabelle', () => {
    const pfad = 'src/lib/mein-hof.ts'
    const funde = findeHexwerte(readFileSync(join(process.cwd(), pfad), 'utf8'), pfad)
    expect(funde.length).toBeGreaterThan(0)
    expect(new Set(funde.map((f) => f.konstante))).toEqual(new Set(['TITELBILD_VERLAEUFE']))
  })
})

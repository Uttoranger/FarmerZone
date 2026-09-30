/**
 * Tests für Theme-Schalter, Schriften und Lint-Regel aus Schritt 1 des
 * Redesigns (docs/umsetzungsprompt.md, docs/ai/DESIGN_SYSTEM.md).
 *
 * Beweist:
 *  - Das Layout lässt next-themes data-theme setzen — per Inline-Skript vor der
 *    Hydration, Erstbesuch nach der Systemeinstellung, Wahl gespeichert.
 *  - Fraunces und Instrument Sans kommen über next/font; nirgends im Produkt
 *    wird eine Schrift von Google geladen; Instrument Sans wird nicht
 *    vorgeladen, solange keine Route sie nutzt.
 *  - ESLint weist Farbliterale (Hex, rgb, hsl, oklch) in allem Neuen unter src/
 *    ab und lässt Tokens durch; nur der gelistete Bestand ist ausgenommen.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ESLint } from 'eslint'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('Theme ohne Flash', () => {
  const layout = quelle('src/app/layout.tsx')

  it('data-theme am <html>, System als Erstwahl, Wahl bleibt (next-themes)', () => {
    const anfang = layout.indexOf('<ThemeProvider')
    const provider = layout.slice(anfang, layout.indexOf('>', anfang))
    expect(provider).toContain('attribute="data-theme"')
    expect(provider).toContain('defaultTheme="system"')
    expect(provider).toContain('enableSystem')
    expect(layout).toContain('suppressHydrationWarning')
    expect(layout).not.toContain('attribute="class"')
  })

  it('der Umschalter bleibt an next-themes — eine Quelle für den Modus', () => {
    const umschalter = quelle('src/components/shared/theme-umschalter.tsx')
    expect(umschalter).toContain("from 'next-themes'")
    expect(umschalter).not.toContain('data-theme')
    expect(umschalter).not.toContain('localStorage')
  })
})

describe('Schriften über next/font', () => {
  const layout = quelle('src/app/layout.tsx')

  it('Fraunces und Instrument Sans werden geladen und als Variablen gesetzt', () => {
    const importZeile = layout.match(/import \{([^}]*)\} from 'next\/font\/google'/)
    expect(importZeile).not.toBeNull()
    expect(importZeile?.[1]).toContain('Fraunces')
    expect(importZeile?.[1]).toContain('Instrument_Sans')
    expect(layout).toContain("variable: '--font-fraunces'")
    expect(layout).toContain("variable: '--font-instrument-sans'")
    expect(layout).toMatch(/className=\{`[^`]*\$\{fraunces\.variable\}[^`]*\$\{instrumentSans\.variable\}/)
  })

  it('Instrument Sans wird noch nicht vorgeladen — keine Route nutzt sie', () => {
    const anfang = layout.indexOf('Instrument_Sans({')
    const aufruf = layout.slice(anfang, layout.indexOf('})', anfang))
    expect(aufruf).toContain('preload: false')
  })

  it('kein Google-CDN im Produkt', () => {
    const dateien = readdirSync(join(process.cwd(), 'src'), { recursive: true, withFileTypes: true })
    for (const eintrag of dateien) {
      if (!eintrag.isFile() || !/\.(tsx?|css|mdx?)$/.test(eintrag.name)) continue
      const inhalt = readFileSync(join(eintrag.parentPath, eintrag.name), 'utf8')
      expect(inhalt, join(eintrag.parentPath, eintrag.name)).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
    }
  })
})

describe('Lint-Regel gegen Farbliterale', () => {
  const eslint = new ESLint({ cwd: process.cwd() })
  const farbmeldungen = async (code: string, pfad: string) => {
    const [ergebnis] = await eslint.lintText(code, { filePath: join(process.cwd(), pfad) })
    return ergebnis.messages.filter((m) => m.ruleId === 'no-restricted-syntax')
  }
  const LITERALE = [
    'export function Probe() {',
    '  const a = "#E07A4A"',
    '  const b = `rgba(0,0,0,0.5)`',
    '  const c = "oklch(0.5 0.1 40)"',
    '  return <div style={{ color: "#fff" }}>{a}{b}{c}</div>',
    '}',
    '',
  ].join('\n')

  it('weist Hex, rgba und oklch in den Basiskomponenten ab — auch in Vorlagen und JSX', async () => {
    const meldungen = await farbmeldungen(LITERALE, 'src/components/ui/probe.tsx')
    expect(meldungen).toHaveLength(4)
    expect(meldungen[0].message).toContain('DESIGN_SYSTEM')
    expect(meldungen[0].message).not.toContain('var(--fz')
  }, 60_000)

  it('gilt für jede neue Datei unter src, nicht nur für src/components/ui', async () => {
    expect(await farbmeldungen(LITERALE, 'src/components/shell/probe.tsx')).toHaveLength(4)
    expect(await farbmeldungen('export const farbe = "#2D5F3F"\n', 'src/lib/probe.ts')).toHaveLength(1)
  }, 60_000)

  it('lässt Tokens, Anker und Klassen durch', async () => {
    const code = [
      'export function Probe() {',
      '  const stil = { color: "var(--fz-text)", background: "var(--background)" }',
      '  return <a href="#fotos" className="bg-background text-foreground" style={stil}>x</a>',
      '}',
      '',
    ].join('\n')
    expect(await farbmeldungen(code, 'src/components/ui/probe.tsx')).toHaveLength(0)
  }, 60_000)

  it('der gelistete Bestand und die E-Mails bleiben ausgenommen, bis sie umziehen', async () => {
    const code = 'export const alt = "#2D5F3F"\n'
    expect(await farbmeldungen(code, 'src/components/farm/farm-page-view.tsx')).toHaveLength(0)
    expect(await farbmeldungen(code, 'src/emails/probe.tsx')).toHaveLength(0)
  }, 60_000)

  it('die Ausnahmeliste enthält nur Dateien, die es gibt — sie darf nur schrumpfen', () => {
    const konfiguration = quelle('eslint.config.mjs')
    const anfang = konfiguration.indexOf('FARBLITERAL_BESTAND = [')
    // Bis zur schließenden Klammer am Zeilenanfang — Pfade wie [id] tragen selbst eckige Klammern.
    const liste = konfiguration.slice(anfang, konfiguration.indexOf('\n]', anfang))
    const eintraege = [...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((p) => !p.endsWith('/**'))
    expect(eintraege.length).toBeGreaterThan(20)
    for (const pfad of eintraege) {
      // Glob-Zeichen im Pfad sind für ESLint maskiert (im Quelltext `\\[id\\]`), auf der Platte nicht.
      const echterPfad = pfad.replace(/\\+([[\]()])/g, '$1')
      expect(() => readFileSync(join(process.cwd(), echterPfad)), pfad).not.toThrow()
    }
  })
})

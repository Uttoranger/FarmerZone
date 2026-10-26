/**
 * Die Maße der KundeShell für den Kartenmodus (Nachtlauf Nr. 52): Er füllt
 * genau den Platz zwischen Kopfzeile und Unterleiste und rechnet dafür nur mit
 * den CSS-Variablen, die die Shell an ihren Rahmen setzt
 * (src/lib/kunde-shell-masse.ts) — nie mit eigenen Zahlen.
 *
 * Die Unterleiste (ui/bottom-nav.tsx, auch in der HofShell) trägt ihre Zahlen
 * selbst; dieser Test ist die Wache, die beide gleich hält. Geprüft am
 * Quelltext, weil sich Pixel nur im Browser messen lassen (die Messung steht
 * im Bericht 52): Die Zahlen der Variablen passen zu den Klassen von
 * Kopfzeile (kunde-shell.tsx) und Unterleiste, und die Shell setzt beides.
 * Mit Gegenprobe, dass die Suche anschlägt.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { KUNDE_KOPF_ZEILE, KUNDE_PLATZ_HOEHE, KUNDE_SHELL_MASSE } from '@/lib/kunde-shell-masse'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

/** Tailwind-Abstände: eine Stufe sind 4 px (h-14 = 56 px). */
const stufe = (klasse: string, praefix: string): number | null => {
  const treffer = klasse.match(new RegExp(`(?:^|\\s)${praefix}(\\d+)(?:\\s|$)`))
  return treffer ? Number(treffer[1]) * 4 : null
}

/** Der Wert einer CSS-Variablen in der Klassenliste, ohne bzw. mit Breakpoint. */
const variable = (klassen: string, name: string, breakpoint = ''): string | null => {
  const muster = new RegExp(`(?:^|\\s)${breakpoint ? `${breakpoint}:` : ''}\\[--${name}:([^\\]]+)\\]`)
  return klassen.match(muster)?.[1] ?? null
}

describe('Maße der KundeShell', () => {
  it('die Kopfzeile: 56 px, ab md 64 px — samt Linie 57 bzw. 65 px in --kunde-kopf', () => {
    expect(stufe(KUNDE_KOPF_ZEILE, 'h-')).toBe(56)
    expect(stufe(KUNDE_KOPF_ZEILE, 'md:h-')).toBe(64)
    expect(variable(KUNDE_SHELL_MASSE, 'kunde-kopf')).toBe(`${56 + 1}px`)
    expect(variable(KUNDE_SHELL_MASSE, 'kunde-kopf', 'md')).toBe(`${64 + 1}px`)
  })

  it('die Unterleiste: 68 px plus Linie plus Home-Indicator, ab md keine', () => {
    const leiste = quelle('src/components/ui/bottom-nav.tsx')
    // Die Höhe der Leiste und ihre Linie oben — von dort kommen die 69 px.
    expect(leiste).toMatch(/flex h-\[68px\] items-stretch/)
    expect(leiste).toMatch(/'fixed inset-x-0 bottom-0 border-t /)
    expect(leiste).toContain('pb-[env(safe-area-inset-bottom)]')
    expect(variable(KUNDE_SHELL_MASSE, 'kunde-unterleiste')).toBe('calc(69px+env(safe-area-inset-bottom))')
    expect(variable(KUNDE_SHELL_MASSE, 'kunde-unterleiste', 'md')).toBe('0px')
  })

  it('der Mittelknopf ragt 20 px über die Unterleiste (-mt-5), ab md gibt es ihn nicht', () => {
    const leiste = quelle('src/components/ui/bottom-nav.tsx')
    expect(leiste).toMatch(/'relative -mt-5 flex size-\[54px\]/)
    expect(variable(KUNDE_SHELL_MASSE, 'kunde-ueberstand')).toBe('20px')
    expect(variable(KUNDE_SHELL_MASSE, 'kunde-ueberstand', 'md')).toBe('0px')
  })

  it('die Shell setzt die Variablen an ihren Rahmen und baut die Kopfzeile aus derselben Konstante', () => {
    const shell = quelle('src/components/shells/kunde-shell.tsx')
    const kundeShell = shell.slice(shell.indexOf('export function KundeShell('), shell.indexOf('export type KundeFokusShellProps'))
    expect(kundeShell).toMatch(/<div data-design="neu" data-scroll-rand=\{[^}]*\} className=\{cn\('min-h-dvh bg-background text-foreground', KUNDE_SHELL_MASSE\)\}>/)
    expect(kundeShell).toMatch(/<header className="sticky top-0 z-40 border-b border-border/)
    expect(kundeShell).toContain('KUNDE_KOPF_ZEILE')
    // Keine zweite Höhe daneben: Die Kopfzeile nennt ihre Höhe nur über die Konstante.
    expect(kundeShell).not.toMatch(/\bh-14\b|md:h-16/)
  })

  it('der Platz zwischen Kopf und Unterleiste rechnet nur mit den Variablen', () => {
    expect(KUNDE_PLATZ_HOEHE).toBe('h-[calc(100dvh-var(--kunde-kopf)-var(--kunde-unterleiste))]')
  })

  it('der Kartenmodus auf /hoefe nimmt diese Höhe und keine eigene Zahl', () => {
    const client = quelle('src/components/hoefe/hoefe-client.tsx')
    expect(client).toContain('KUNDE_PLATZ_HOEHE')
    // Die alte Höhe aus dem Fensteranteil ist weg (Bericht 52: Karte endete 103 px unter der Unterleiste).
    expect(client).not.toMatch(/h-\[60vh\]/)
    // Karussell und Hinweis halten den Mittelknopf frei — über die Variable der Shell.
    expect(client + quelle('src/components/hoefe/hoefe-karussell.tsx')).toMatch(/var\(--kunde-ueberstand\)/)
  })

  it('unter md keine Mindesthöhe: Sie schöbe die Karte im Querformat hinter die Unterleiste (Runde 1)', () => {
    const client = quelle('src/components/hoefe/hoefe-client.tsx')
    expect(client).toContain("cn('flex flex-col md:min-h-[280px]', KUNDE_PLATZ_HOEHE)")
    expect(client).not.toMatch(/(?<!md:)min-h-\[280px\]/)
    // Gegenprobe: die alte Klasse fiele auf.
    expect("cn('flex min-h-[280px] flex-col', KUNDE_PLATZ_HOEHE)").toMatch(/(?<!md:)min-h-\[280px\]/)
  })

  it('Gegenprobe: die Suche erkennt abweichende Zahlen', () => {
    expect(stufe('h-12 md:h-16', 'h-')).toBe(48)
    expect(variable('[--kunde-kopf:60px] md:[--kunde-kopf:65px]', 'kunde-kopf')).toBe('60px')
    expect(variable('[--kunde-kopf:60px] md:[--kunde-kopf:70px]', 'kunde-kopf', 'md')).toBe('70px')
    expect(variable('[--kunde-kopf:60px]', 'kunde-unterleiste')).toBeNull()
  })
})

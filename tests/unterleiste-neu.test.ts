/**
 * Unterleiste der HofShell: das Wort „Neu" unter dem Plus (freigabe.md §12
 * Nr. 45) — gerendert wie auf dem Server.
 *
 * Beweist:
 *  - Das Wort steht IM Knopf des Plus, unter dem Symbol: Ein Tipp auf das Wort
 *    öffnet dasselbe Blatt wie ein Tipp auf den Kreis.
 *  - Die Trefferfläche wird nicht kleiner: Der Kreis bleibt 54 px, das Wort
 *    kommt dazu; der Knopf behält seinen Namen „Neu erstellen" (das sichtbare
 *    Wort steht am Anfang des Namens) — abgeleitet aus HOF_NEU_KNOPF, nie
 *    fest eingetippt (Runde 1).
 *  - Das Wort kommt aus der Navigations-Quelle (HOF_NEU_KNOPF), dieselbe wie
 *    der Neu-Knopf der Seitenleiste.
 *  - Gegenprobe: Die Kunden-Unterleiste (Warenkorb) bleibt ohne Wort.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ signOut: vi.fn() }))

import { HofShell } from '@/components/shells/hof-shell'
import { KundeShell } from '@/components/shells/kunde-shell'
import { HOF_LEISTE_KURZ, HOF_NEU_KNOPF, HOF_NEU_KNOPF_NAME } from '@/lib/bauern-navigation'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

function el<P extends { children?: ReactNode }>(typ: ComponentType<P>, props: Omit<P, 'children'>): ReactElement {
  return createElement(typ as unknown as ComponentType<Omit<P, 'children'>>, props, createElement('p', null, 'Inhalt'))
}

const hof = renderToStaticMarkup(
  el(HofShell, { hofName: 'Hof Beispiel', hofSlug: 'hof-beispiel', personName: 'Max Mustermann', isAdmin: false, zahlen: { bestellungen: 3, admin: 0 } })
)

/** Der Teil des HTML vom ersten `start` bis zum nächsten `ende`. */
function abschnitt(html: string, start: string, ende: string): string {
  const von = html.indexOf(start)
  expect(von, start).toBeGreaterThanOrEqual(0)
  return html.slice(von, html.indexOf(ende, von) + ende.length)
}

const leiste = abschnitt(hof, '<nav aria-label="Hauptnavigation" data-slot="bottom-nav"', '</nav>')
const knopf = abschnitt(leiste, '<button', '</button>')

describe('Unterleiste Hof: „Neu" unter dem Plus', () => {
  it('das Wort kommt aus der Navigations-Quelle', () => {
    expect(HOF_NEU_KNOPF).toBe('Neu')
  })

  it('steht im Knopf des Plus, nach dem Symbol — Wort und Kreis öffnen dasselbe Blatt', () => {
    expect(knopf).toContain(`aria-label="${HOF_NEU_KNOPF_NAME}"`)
    expect(HOF_NEU_KNOPF_NAME).toBe('Neu erstellen')
    const symbol = knopf.indexOf('<svg')
    const wort = knopf.indexOf(`>${HOF_NEU_KNOPF}<`)
    expect(symbol).toBeGreaterThan(-1)
    expect(wort).toBeGreaterThan(symbol)
    // Sichtbarer Text steht am Anfang des Namens (WCAG „Label in Name").
    expect(HOF_NEU_KNOPF_NAME.startsWith(HOF_NEU_KNOPF)).toBe(true)
  })

  it('der Name kommt aus der Quelle — in Shell und Bausteine-Vorschau nicht fest eingetippt (Runde 1)', () => {
    for (const datei of ['src/components/shells/hof-shell.tsx', 'src/app/intern/bausteine/bausteine-vorschau.tsx']) {
      const text = quelle(datei)
      expect(text, datei).toContain('aria-label={HOF_NEU_KNOPF_NAME}')
      expect(text, datei).not.toContain('aria-label="Neu erstellen"')
    }
  })

  it('die Trefferfläche wird nicht kleiner: der Kreis bleibt 54 px, das Wort kommt darunter dazu', () => {
    expect(knopf).toMatch(/<button[^>]*class="[^"]*flex-col[^"]*"/)
    expect(knopf).toMatch(/<span[^>]*class="[^"]*size-\[54px\][^"]*"/)
    expect(knopf).not.toMatch(/<button[^>]*class="[^"]*\bsize-(?:\d|\[)/)
  })

  it('der Neu-Knopf der Seitenleiste nennt dasselbe Wort', () => {
    const seitenleiste = abschnitt(hof, '<aside', '</aside>')
    expect(seitenleiste).toContain(`>${HOF_NEU_KNOPF}<`)
  })

  it('Gegenprobe: die Kunden-Unterleiste bleibt beim Warenkorb ohne Wort', () => {
    const kunde = renderToStaticMarkup(el(KundeShell, { sitzung: 'gast' }))
    const kundenLeiste = abschnitt(kunde, 'data-slot="bottom-nav"', '</nav>')
    expect(kundenLeiste).not.toContain(`>${HOF_NEU_KNOPF}<`)
  })
})

describe('Unterleiste Hof: 11 px unter 360 px Breite (Entscheidung 6, Nr. 195)', () => {
  const ELF = 'group-data-[eng]/leiste:max-[359px]:text-[11px]'

  it('nur die Leiste des Hofbereichs trägt das Merkmal; Einträge und „Neu" wechseln dort auf 11 px', () => {
    expect(leiste).toMatch(/<nav[^>]*data-eng=""/)
    expect(leiste).toMatch(/<nav[^>]*class="[^"]*\bgroup\/leiste\b/)
    // Jeder Eintrag (Link) und der Knopf mit Wort kennt die schmale Stufe; die Grundstufe bleibt 12 px.
    const eintraege = leiste.match(/<(?:a|button)\b[^>]*class="[^"]*"/g) ?? []
    expect(eintraege.length).toBeGreaterThanOrEqual(4)
    for (const e of eintraege) {
      expect(e).toContain(ELF)
      expect(e).toContain('text-[12px]')
    }
  })

  it('Gegenprobe: die Kunden-Unterleiste hat kein Merkmal und bleibt bei 12 px (auch bei 320 px)', () => {
    const kunde = renderToStaticMarkup(el(KundeShell, { sitzung: 'gast' }))
    const kundenLeiste = abschnitt(kunde, 'data-slot="bottom-nav"', '</nav>')
    expect(kundenLeiste).not.toContain('data-eng')
    expect(kundenLeiste).toContain('text-[12px]')
  })

  it('die Breitenstufe liegt unter 360, nicht darauf: max-[359px]', () => {
    expect(ELF).toContain('max-[359px]')
    expect(quelle('src/components/ui/bottom-nav.tsx')).toContain('engUnter360')
    expect(quelle('src/components/shells/hof-shell.tsx')).toContain('<BottomNav ueberSchleier={offen !== null} engUnter360>')
  })
})

describe('Unterleiste Hof: „Bestellungen“ bei 320 px nicht abgeschnitten (Nr. 205)', () => {
  it('unter 360 px steht die kürzere Fassung aus der Konstante, ab 360 px das volle Wort; der Name bleibt voll', () => {
    expect(HOF_LEISTE_KURZ.bestellungen).toBe('Bestellung')
    // Das sichtbare Kurzwort steckt im vollen Namen (Label im Namen).
    expect('Bestellungen').toContain(HOF_LEISTE_KURZ.bestellungen)
    expect(leiste).toContain('max-[359px]:hidden')
    expect(leiste).toMatch(new RegExp(`min-\\[360px\\]:hidden[^>]*>${HOF_LEISTE_KURZ.bestellungen}<`))
    expect(leiste).toContain('aria-label="Bestellungen"')
  })

  it('Gegenprobe: andere Einträge und die Kunden-Leiste haben keine Kurzfassung', () => {
    expect(leiste.match(/min-\[360px\]:hidden/g)?.length).toBe(1)
    const kunde = renderToStaticMarkup(el(KundeShell, { sitzung: 'gast' }))
    expect(abschnitt(kunde, 'data-slot="bottom-nav"', '</nav>')).not.toContain('min-[360px]:hidden')
  })
})

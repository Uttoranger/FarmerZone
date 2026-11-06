/**
 * Render-Tests der Bausteine aus Nr. 247 (Lauf 32, Liste „Board oder Code“ §3.2 G9–G11).
 *
 * Beweist:
 *  - G9: der Kopf der KundeShell zeigt in jeder Sitzung EINE Umriss-Pille rechts — „Anmelden“, „Mein Konto“,
 *    „Mein Hof“ — und kein Suchfeld; mit gefülltem Korb steht „Warenkorb · n“ daneben.
 *  - G10: das Wort „Warenkorb“ der Unterleiste ist halbfett wie seine Nachbarn; der Zähler am Mittelknopf ist
 *    grün mit hellem Ring statt orange.
 *  - G11: die Fußlinks sind auch am Handy unterstrichen; die Chip-Gruppe wählt genau eine Pille, nennt die Zahl
 *    mit „ · “ und füllt die gewählte (dunkel/hell), die anderen tragen den Feldrand.
 *  - Gegenprobe zu jeder Aussage.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ComponentType, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const pfad = { aktuell: '/hoefe' }
vi.mock('next/navigation', () => ({ usePathname: () => pfad.aktuell }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
// Der Korb liegt im Browser (localStorage); hier steht er fest — die Shell zeichnet nur, was der Hook sagt.
const korb: { aktuell: { anzahl: number; href: string } | null } = { aktuell: null }
vi.mock('@/lib/use-warenkorb-kopf', () => ({ useWarenkorbKopf: () => korb.aktuell }))

import { KundeShell, type KundeShellProps } from '@/components/shells/kunde-shell'
import { KundeFuss } from '@/components/shells/kunde-fuss'
import { WARENKORB_ZAEHLER } from '@/components/ui/bottom-nav'
import { ChipGruppe, chipGruppeText } from '@/components/ui/segment'
import type { KundenSitzung } from '@/lib/kunden-navigation'
import { MARKE } from '@/lib/marke'

function shell(sitzung: KundenSitzung, mitKorb: number | null = null): string {
  korb.aktuell = mitKorb === null ? null : { anzahl: mitKorb, href: '/hof-beispiel?korb=1' }
  // Der Inhalt als weiteres Argument — ohne dass TypeScript `children` in den Props verlangt (wie tests/shells.test.ts).
  const Shell = KundeShell as unknown as ComponentType<Omit<KundeShellProps, 'children'>>
  return renderToStaticMarkup(createElement(Shell, { sitzung }, createElement('p', null, 'Inhalt')))
}

function abschnitt(html: string, von: string, bis: string): string {
  const start = html.indexOf(von)
  expect(start, von).toBeGreaterThanOrEqual(0)
  return html.slice(start, html.indexOf(bis, start) + bis.length)
}

/** Die Klassen des öffnenden Tags vor einem Text (der nächste `class="…"` davor). */
function klassenVor(html: string, text: string): string {
  const ende = html.indexOf(text)
  expect(ende, text).toBeGreaterThanOrEqual(0)
  const davor = html.slice(0, ende)
  return /class="([^"]*)"[^<]*$/.exec(davor)?.[1] ?? ''
}

describe('G9 – Kopf der Kunden-Shell', () => {
  it.each([
    ['gast', '/login', 'Anmelden'],
    ['kunde', '/account/profile', 'Mein Konto'],
    ['hof', '/dashboard', 'Mein Hof'],
  ] as const)('Sitzung %s: genau eine Umriss-Pille auf %s („%s“), kein Suchfeld, kein Personen-Symbol', (sitzung, ziel, wort) => {
    const kopf = abschnitt(shell(sitzung), '<header', '</header>')
    const pillen = [...kopf.matchAll(/<a [^>]*class="[^"]*\brounded-full\b[^"]*\bborder-input\b[^"]*"[^>]*>([^<]*)<\/a>/g)].map((m) => m[1])
    expect(pillen).toEqual([wort])
    expect(kopf).toContain(`href="${ziel}"`)
    expect(kopf).not.toContain('<form')
    expect(kopf).not.toContain('type="search"')
  })

  it('mit gefülltem Korb steht „Warenkorb · n“ als Pille im Kopf; Gegenprobe: leer steht dort nichts (N41 c)', () => {
    expect(abschnitt(shell('kunde', 3), '<header', '</header>')).toMatch(/>Warenkorb · 3<span class="sr-only"> Artikel<\/span><\/a>/)
    expect(abschnitt(shell('kunde', null), '<header', '</header>')).not.toContain('Warenkorb')
  })
})

describe('G10 – Unterleiste der Kundschaft', () => {
  it('das Wort „Warenkorb“ ist halbfett wie „Bestellungen“ daneben; Gegenprobe: vorher fehlte die Stärke', () => {
    const leiste = abschnitt(shell('gast'), 'data-slot="bottom-nav"', '</nav>')
    // Kreis und Wort sind EIN Link — die Schrift des Worts kommt von ihm.
    const mittelknopf = /<a [^>]*aria-label="Warenkorb ist leer[^"]*"[^>]*class="([^"]*)"/.exec(leiste)?.[1].split(/\s+/) ?? []
    const bestellungen = /<a [^>]*href="\/bestellungen"[^>]*class="([^"]*)"/.exec(leiste)?.[1].split(/\s+/) ?? []
    expect(mittelknopf).toContain('font-semibold')
    expect(bestellungen).toContain('font-semibold')
    expect(mittelknopf).toContain('text-muted-foreground')
    expect(bestellungen).toContain('text-muted-foreground')
    expect(mittelknopf.filter((k) => k.startsWith('font-'))).toEqual(['font-semibold'])
  })

  it('der Zähler am Warenkorb ist grün mit hellem Ring, nicht orange; Gegenprobe: ohne Korb kein Zähler', () => {
    const leiste = abschnitt(shell('gast', 4), 'data-slot="bottom-nav"', '</nav>')
    const zaehler = /<span data-slot="zaehler" data-ton="([^"]*)" class="([^"]*)"/.exec(leiste)
    expect(zaehler?.[1]).toBe('gruen')
    const klassen = zaehler?.[2].split(/\s+/) ?? []
    for (const k of WARENKORB_ZAEHLER.split(/\s+/)) expect(klassen, k).toContain(k)
    expect(klassen).toContain('bg-card')
    expect(klassen).toContain('border-status-fertig')
    expect(klassen).not.toContain('bg-accent')
    expect(klassen).not.toContain('bg-status-offen')
    expect(abschnitt(shell('gast', null), 'data-slot="bottom-nav"', '</nav>')).not.toContain('data-slot="zaehler"')
  })
})

describe('G11 – Seitenfuß', () => {
  it('die Fußlinks sind in jeder Breite unterstrichen (nicht erst ab md)', () => {
    const fuss = renderToStaticMarkup(createElement(KundeFuss))
    const impressum = klassenVor(fuss, '>Impressum<').split(/\s+/)
    expect(impressum).toContain('underline')
    expect(impressum).not.toContain('md:underline')
  })

  it('im Browser ohne Wortmarke, die Wege nur ab md; Gegenprobe: die Rechtslinks stehen in jeder Breite', () => {
    const fuss = renderToStaticMarkup(createElement(KundeFuss))
    expect(fuss).not.toContain(`aria-label="${MARKE} – zur Startseite"`)
    expect(fuss).toMatch(/<nav aria-label="Mehr entdecken" class="hidden md:block">/)
    expect(fuss).toMatch(/<nav aria-label="Rechtliches" class="md:ml-auto">/)
  })
})

describe('G11 – Chip-Gruppe', () => {
  const UMKREIS = [
    { wert: '10', label: '10 km', zahl: 1 },
    { wert: '25', label: '25 km', zahl: 4 },
    { wert: '50', label: '50 km', zahl: 0 },
  ] as const

  it('die Zahl steht mit „ · “ hinter dem Namen, auch die Null; ohne Zahl nur der Name', () => {
    expect(chipGruppeText({ wert: 'a', label: '10 km', zahl: 4 })).toBe('10 km · 4')
    expect(chipGruppeText({ wert: 'a', label: '50 km', zahl: 0 })).toBe('50 km · 0')
    expect(chipGruppeText({ wert: 'a', label: 'Hofladen' })).toBe('Hofladen')
  })

  it('eine Gruppe aus Knöpfen mit aria-pressed: genau die gewählte gedrückt und gefüllt, die anderen mit Feldrand', () => {
    const html = renderToStaticMarkup(createElement(ChipGruppe, { beschriftung: 'Umkreis', optionen: UMKREIS, wert: '25' }))
    expect(html).toMatch(/^<div role="group" aria-label="Umkreis"/)
    const knoepfe = [...html.matchAll(/<button type="button" aria-pressed="(true|false)" class="([^"]*)">([^<]*)<\/button>/g)]
    expect(knoepfe.map((k) => [k[1], k[3]])).toEqual([
      ['false', '10 km · 1'],
      ['true', '25 km · 4'],
      ['false', '50 km · 0'],
    ])
    const [offen, gewaehlt] = [knoepfe[0][2].split(/\s+/), knoepfe[1][2].split(/\s+/)]
    expect(gewaehlt).toEqual(expect.arrayContaining(['bg-foreground', 'text-background', 'min-h-11', 'rounded-full']))
    expect(offen).toEqual(expect.arrayContaining(['border-input', 'bg-card', 'text-foreground']))
    expect(offen).not.toContain('bg-foreground')
  })

  it('ohne Wert von außen ist die erste Wahl gedrückt, mit standardWert diese; Gegenprobe: nie zwei gedrückt', () => {
    const ohne = renderToStaticMarkup(createElement(ChipGruppe, { beschriftung: 'Umkreis', optionen: UMKREIS }))
    expect(ohne.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(ohne).toMatch(/aria-pressed="true"[^>]*>10 km · 1</)
    const standard = renderToStaticMarkup(createElement(ChipGruppe, { beschriftung: 'Umkreis', optionen: UMKREIS, standardWert: '50' }))
    expect(standard.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(standard).toMatch(/aria-pressed="true"[^>]*>50 km · 0</)
  })
})

describe('Vorschau /intern/bausteine (Einhängepunkt vorschau-247.tsx)', () => {
  it('zeigt Kopf, Unterleiste, Seitenfuß und Chip-Gruppe — die Unterleiste in Ruhe, nicht fest am Fensterrand', async () => {
    const { Vorschau247 } = await import('@/app/intern/bausteine/vorschau-247')
    const html = renderToStaticMarkup(createElement(Vorschau247))
    for (const id of ['kunde-kopf', 'kunde-unterleiste', 'kunde-fuss', 'chip-gruppe']) expect(html, id).toContain(`id="${id}-titel"`)
    for (const ziel of ['/intern/bausteine/shell/kunde', '/intern/bausteine/shell/kunde-angemeldet', '/intern/bausteine/shell/kunde-hof']) {
      expect(html, ziel).toContain(`href="${ziel}"`)
    }
    expect(html).toContain('>25 km · 4</button>')
    expect(html).toContain('data-slot="seitenfuss"')
    // Gegenprobe: Die Leiste der Vorschau ist ein Bild, keine zweite feste Unterleiste.
    expect(html).not.toContain('data-slot="bottom-nav"')
    expect(html).toContain('data-slot="zaehler" data-ton="gruen"')
  })
})

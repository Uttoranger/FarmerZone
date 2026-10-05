/**
 * Die Bausteine aus Gate 2 (src/components/ui) — gerendert wie auf dem Server.
 *
 * Beweist:
 *  - Jeder Baustein rendert in beiden Themes (data-theme light/dark im
 *    Geltungsbereich data-design="neu") — mit seinem Merkmal (Text,
 *    aria-Name, Rolle) und mit demselben Markup: Die Farbe kommt nur aus
 *    Tokens, kein Baustein verzweigt nach dem Modus.
 *  - Kein Baustein schreibt Farbwerte (Hex, rgb, oklch) oder Farben der
 *    Tailwind-Palette (bg-white, text-gray-500 …) — mit Gegenprobe, dass die
 *    Suche anschlägt.
 *  - Navigation und Filter sind echte Links; der gewählte Filter trägt
 *    aria-current; Symbole neben Text sind aria-hidden.
 *  - Die Vorschau /intern/bausteine bindet jeden Baustein ein.
 *  - Das Blatt mit Griff ist eine zusätzliche Variante von sheet.tsx.
 *
 * Verhalten im Browser (Tastatur, Fokus) prüft die Abnahme mit agent-browser;
 * hier geht es um Gestalt und Semantik, die man am HTML sieht.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Package, Sprout, Truck } from 'lucide-react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import { Chip, FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { Stepper } from '@/components/ui/stepper'
import { Segment } from '@/components/ui/segment'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { ProgressBar } from '@/components/ui/progress-bar'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { GroessenWahl, Groessenkachel } from '@/components/ui/groessenkachel'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { BottomNav, BottomNavLink, BottomNavMitte, mittelknopfKlassen } from '@/components/ui/bottom-nav'
import { SidebarEintrag, SidebarGruppe } from '@/components/ui/sidebar-gruppe'
import { Zaehler } from '@/components/ui/zaehler'

/** createElement mit Kindern als weitere Argumente — ohne dass TypeScript `children` in den Props verlangt. */
function el<P extends { children?: ReactNode }>(typ: ComponentType<P>, props: Omit<P, 'children'>, ...kinder: ReactNode[]): ReactElement {
  return createElement(typ as unknown as ComponentType<Omit<P, 'children'>>, props, ...kinder)
}

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

/** Rendert im Geltungsbereich des neuen Designs mit dem Theme am Rahmen; zurück kommt nur der Baustein. */
function rendere(element: ReactElement, theme: 'light' | 'dark'): string {
  const html = renderToStaticMarkup(createElement('div', { 'data-design': 'neu', 'data-theme': theme }, element))
  return html.replace(/^<div data-design="neu" data-theme="(light|dark)">/, '').replace(/<\/div>$/, '')
}

/** useId zählt je Render hoch — für den Vergleich der Themes zählen nur Gestalt und Inhalt. */
const ohneIds = (html: string) => html.replace(/(id|for|aria-labelledby|aria-controls|aria-describedby)="[^"]*"/g, '$1=""')

const FARBLITERAL = /#[0-9a-fA-F]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch)\(/
const PALETTE =
  /\b(bg|text|border|ring|fill|stroke|from|to|via|outline|shadow|divide|decoration)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d{2,3})?\b/

type Fall = { name: string; datei: string; element: ReactElement; merkmale: (string | RegExp)[] }

const FAELLE: Fall[] = [
  {
    name: 'Chip',
    datei: 'chip',
    element: el(Chip, { title: 'Eier' }, 'Eier'),
    merkmale: ['data-slot="chip"', 'Eier'],
  },
  {
    name: 'FilterChip (Link, gewählt)',
    datei: 'chip',
    element: el(FilterChipReihe,
      { beschriftung: 'Kategorie' },
      el(FilterChip, { href: '/hoefe', aktiv: true }, 'Alle'),
      el(FilterChip, { href: '/hoefe?kategorie=eier' }, 'Eier')
    ),
    merkmale: [/<a href="\/hoefe" data-slot="filter-chip" aria-current="page"/, '<a href="/hoefe?kategorie=eier"', 'aria-label="Kategorie"'],
  },
  {
    name: 'Stepper',
    datei: 'stepper',
    element: createElement(Stepper, { beschriftung: 'Menge Freilandeier', standardWert: 2, min: 0, max: 5 }),
    merkmale: ['aria-label="Menge Freilandeier: eins weniger"', 'aria-label="Menge Freilandeier: eins mehr"', 'aria-label="Menge Freilandeier"', 'value="2"', 'lucide-minus', 'lucide-plus'],
  },
  {
    name: 'Segment',
    datei: 'segment',
    element: createElement(Segment, {
      beschriftung: 'Umkreis',
      optionen: [
        { wert: '10', label: '10 km' },
        { wert: '25', label: '25 km' },
      ],
      standardWert: '25',
    }),
    merkmale: ['aria-label="Umkreis"', '10 km', /aria-pressed="true"[^>]*>25 km/],
  },
  {
    name: 'ListRow',
    datei: 'list-row',
    element: el(ListGruppe,
      { beschriftung: 'Verkauf und Kunden' },
      createElement(ListRow, { titel: 'Kunden', href: '/customers', symbol: Package, aktuell: 'page' }),
      createElement(ListRow, { titel: 'Maria Beispiel', untertitel: 'Gemüsekiste klein', ende: '€ 11,60' })
    ),
    merkmale: ['<a href="/customers" aria-current="page"', 'Maria Beispiel', '€ 11,60', 'lucide-chevron-right', 'title="Kunden"'],
  },
  {
    name: 'ProgressBar',
    datei: 'progress-bar',
    element: createElement(ProgressBar, { beschriftung: 'Deine Hofseite', wert: 64 }),
    merkmale: ['role="progressbar"', 'aria-valuenow="64"', 'aria-valuetext="64 %"', 'Deine Hofseite'],
  },
  {
    name: 'EmptyState',
    datei: 'empty-state',
    element: createElement(EmptyState, {
      symbol: Sprout,
      titel: 'Noch keine Produkte',
      satz: 'Lege dein erstes an.',
      aktion: createElement('a', { href: '/products?neu=1' }, 'Produkt anlegen'),
    }),
    merkmale: ['Noch keine Produkte', 'Lege dein erstes an.', 'href="/products?neu=1"', 'lucide-sprout'],
  },
  {
    name: 'StatusBadge',
    datei: 'status-badge',
    element: createElement(
      'span',
      null,
      el(StatusBadge, { status: 'offen' }, 'Zum Packen'),
      el(StatusBadge, { status: 'fertig' }, 'Gepackt'),
      el(StatusBadge, { status: 'neutral' }, 'Pausiert')
    ),
    merkmale: ['data-status="offen"', 'text-status-offen', 'data-status="fertig"', 'text-status-fertig', 'data-status="neutral"', 'Gepackt'],
  },
  {
    name: 'Groessenkachel',
    datei: 'groessenkachel',
    element: el(GroessenWahl,
      { beschriftung: 'Größe wählen', standardWert: '5kg' },
      createElement(Groessenkachel, { wert: '5kg', name: '5 kg-Sack', hinweis: 'für Kleintiere', preis: '€ 8,00', grundpreis: '€ 1,60/kg', vorrat: 'noch 10' }),
      createElement(Groessenkachel, { wert: 'rund', name: 'Rundballen', preis: '€ 45,00', vorrat: 'nur noch 8', zustand: 'knapp' }),
      createElement(Groessenkachel, { wert: 'klein', name: 'Kleinballen', preis: '€ 4,50', vorrat: 'ausverkauft', zustand: 'ausverkauft' })
    ),
    merkmale: ['role="radiogroup"', 'aria-label="Größe wählen"', /role="radio"[^>]*aria-checked="true"/, 'data-zustand="knapp"', /aria-disabled="true"[^>]*data-zustand="ausverkauft"|data-zustand="ausverkauft"[^>]*aria-disabled="true"/, '€ 1,60/kg'],
  },
  {
    name: 'Hinweiskarte grün',
    datei: 'hinweiskarte',
    element: el(Hinweiskarte, { ton: 'gruen', symbol: Truck, titel: 'Abholung heute' }, 'Zwischen 15 und 18 Uhr.'),
    merkmale: ['data-ton="gruen"', 'border-accent/45', 'Abholung heute', 'aria-hidden="true"'],
  },
  {
    name: 'Hinweiskarte orange',
    datei: 'hinweiskarte',
    element: el(Hinweiskarte, { ton: 'orange', titel: 'Online-Zahlung pausiert' }),
    merkmale: ['data-ton="orange"', 'border-primary/45', 'Online-Zahlung pausiert'],
  },
  {
    name: 'BottomNav mit Mittelknopf',
    datei: 'bottom-nav',
    element: el(BottomNav,
      {},
      createElement(BottomNavLink, { href: '/dashboard', label: 'Heute', symbol: Package, aktuell: 'page' }),
      el(BottomNavMitte, {}, createElement('a', { href: '/neu', 'aria-label': 'Neu anlegen', className: mittelknopfKlassen('orange') }, '+')),
      createElement(BottomNavLink, { href: '/orders', label: 'Bestellungen', symbol: Package, zahl: 3, zahlWofuer: 'offene Bestellungen' })
    ),
    merkmale: ['<nav aria-label="Hauptnavigation"', '<a href="/dashboard" aria-current="page"', 'aria-label="Neu anlegen"', 'bg-primary', '3 offene Bestellungen', 'safe-area-inset-bottom'],
  },
  {
    name: 'Sidebar-Gruppe mit Zähler',
    datei: 'sidebar-gruppe',
    element: el(SidebarGruppe,
      { titel: 'Verkauf und Kunden' },
      createElement(SidebarEintrag, { href: '/customers', label: 'Kunden', symbol: Package, aktuell: 'page' }),
      createElement(SidebarEintrag, { href: '/admin', label: 'Admin', symbol: Package, zahl: 5, zahlWofuer: 'Meldungen zu entscheiden' })
    ),
    merkmale: ['Verkauf und Kunden', 'aria-label="Verkauf und Kunden"', '<a href="/customers" aria-current="page"', '5 Meldungen zu entscheiden'],
  },
  {
    name: 'Zähler',
    datei: 'zaehler',
    element: createElement(Zaehler, { anzahl: 120, wofuer: 'Artikel im Korb', ton: 'gruen' }),
    merkmale: ['99+', '120 Artikel im Korb', 'bg-accent'],
  },
]

describe.each(FAELLE)('$name', ({ element, merkmale }) => {
  it('rendert in beiden Themes mit seinem Merkmal', () => {
    for (const theme of ['light', 'dark'] as const) {
      const html = rendere(element, theme)
      for (const m of merkmale) {
        if (typeof m === 'string') expect(html, `${theme}: ${m}`).toContain(m)
        else expect(html, `${theme}: ${m}`).toMatch(m)
      }
    }
  })

  it('hat in hell und dunkel dasselbe Markup — die Farbe kommt aus den Tokens', () => {
    expect(ohneIds(rendere(element, 'light'))).toBe(ohneIds(rendere(element, 'dark')))
  })

  it('schreibt keine Farbwerte und keine Palettenfarben', () => {
    const html = rendere(element, 'dark')
    expect(html).not.toMatch(FARBLITERAL)
    expect(html).not.toMatch(PALETTE)
  })
})

describe('Gegenproben', () => {
  it('die Farbsuchen schlagen an', () => {
    expect('<span class="bg-white">').toMatch(PALETTE)
    expect('<span class="text-gray-500">').toMatch(PALETTE)
    expect('<span style="color:#2D5F3F">').toMatch(FARBLITERAL)
    expect('<span style="color:oklch(0.5 0.1 150)">').toMatch(FARBLITERAL)
    expect('<span class="bg-accent/12 text-status-offen">').not.toMatch(PALETTE)
  })

  it('die ProgressBar rechnet den Anteil aus Wert und Maximum — 3 von 8 sind 38 %, nicht 3 %', () => {
    const html = renderToStaticMarkup(createElement(ProgressBar, { beschriftung: 'Gepackt', wert: 3, max: 8 }))
    expect(html).toContain('aria-valuetext="38 %"')
    expect(html).toContain('>38 %<')
  })

  it('ein Zähler ohne Anzahl rendert nichts', () => {
    expect(renderToStaticMarkup(createElement(Zaehler, { anzahl: 0, wofuer: 'x' }))).toBe('')
    expect(renderToStaticMarkup(createElement(Zaehler, { anzahl: undefined, wofuer: 'x' }))).toBe('')
  })
})

describe('Quelltext der Bausteine', () => {
  const DATEIEN = [...new Set(FAELLE.map((f) => f.datei))]

  it('jede Datei steht in src/components/ui und kommt ohne Farbwerte und Palettenfarben aus', () => {
    for (const datei of DATEIEN) {
      const text = quelle(`src/components/ui/${datei}.tsx`)
      expect(text, datei).not.toMatch(FARBLITERAL)
      expect(text, datei).not.toMatch(PALETTE)
    }
  })

  it('jedes lucide-Symbol in den Bausteinen ist aria-hidden', () => {
    for (const datei of [...DATEIEN, 'sheet']) {
      const text = quelle(`src/components/ui/${datei}.tsx`)
      for (const treffer of text.matchAll(/<(Symbol|[A-Z][A-Za-z]+Icon|Minus|Plus|ChevronRight)\s[^>]*?\/>/g)) {
        expect(treffer[0], datei).toContain('aria-hidden="true"')
      }
    }
  })

  it('die Vorschau /intern/bausteine bindet jeden Baustein ein', () => {
    const seite = quelle('src/app/intern/bausteine/bausteine-vorschau.tsx')
    for (const datei of [...DATEIEN, 'sheet']) expect(seite, datei).toContain(`@/components/ui/${datei}'`)
    for (const name of ['Chip', 'FilterChip', 'Stepper', 'Segment', 'ListRow', 'ProgressBar', 'EmptyState', 'StatusBadge', 'Groessenkachel', 'Hinweiskarte', 'BottomNav', 'SidebarGruppe', 'SheetBlatt']) {
      expect(seite, name).toContain(`<${name}`)
    }
  })

  it('das Blatt mit Griff ist eine zusätzliche Variante: SheetContent bleibt, SheetBlatt trägt den Griff', () => {
    const sheet = quelle('src/components/ui/sheet.tsx')
    expect(sheet).toMatch(/function SheetContent\(/)
    expect(sheet).toMatch(/function SheetBlatt\(/)
    expect(sheet).toMatch(/data-slot="sheet-griff" aria-hidden="true"/)
    expect(sheet).toMatch(/showCloseButton = true/)
  })
})

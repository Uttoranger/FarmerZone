/**
 * Grundbausteine mit 44 px (Nr. 173, WCAG 2.5.8; DESIGN_SYSTEM „Qualität").
 *
 * Ursache: Die shadcn-Grundbausteine kamen mit Maßen für Maus und Desktop —
 * Button 32 px, Input 36 px, Select 32 px, das Kreuz in Dialog und Blatt 28 px,
 * das Auge im Passwortfeld 16 px und ohne Tastatur. Am Handy trafen Höfe
 * daneben; eine Änderung in src/components/ui heilt alle Nutzer zugleich.
 *
 * Beweist (gerendert wie auf dem Server, Umgebung node, kein DOM):
 *  - Jede Größe von Button ist mindestens 44 px hoch oder trägt die
 *    Trefferfläche über `before:` (TREFFER_44) — Gegenprobe mit den alten
 *    Werten.
 *  - Input, SelectTrigger und DezimalFeld sind 44 px hoch.
 *  - Das Kreuz in Dialog und Blatt ist ein 44-px-Knopf mit dem Kreis von
 *    28 px als Span, Name „Schließen".
 *  - PasswordInput: Knopf 44 px, per Tastatur erreichbar (kein tabIndex -1),
 *    `aria-pressed` und Name je Zustand; Registrierung und neues Passwort
 *    nutzen ihn statt einer eigenen Kopie.
 *  - Jede Stelle unter src/, die eine kleine Größe (xs, sm, icon-xs, icon-sm)
 *    nutzt, hat eine Fläche: eigene 44 px (h-11/min-h-11) oder die Fläche
 *    über `before:` nachgewiesen in FLAECHE_UEBER_BEFORE. Was keins hat, steht
 *    in BESTAND_OHNE_FLAECHE — die Liste darf nur schrumpfen.
 */
import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

/** Zustand des Passwort-Auges, von außen gesetzt — der Prüfstand für useState (TESTING_GUIDELINES §1, ohne DOM). */
const auge = vi.hoisted(() => ({ sichtbar: null as boolean | null, gesetzt: [] as unknown[] }))
vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return {
    ...echt,
    useState: ((start: unknown) => {
      if (auge.sichtbar === null) return echt.useState(start)
      return [auge.sichtbar, (w: unknown) => auge.gesetzt.push(w)]
    }) as typeof echt.useState,
  }
})
// Dialog und Blatt zeichnen auf dem Server nichts (Portal) — hier sichtbar geschaltet wie in tests/menue-ziel.test.ts.
vi.mock('@base-ui/react/dialog', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@base-ui/react/dialog')>()
  return {
    ...echt,
    Dialog: {
      ...echt.Dialog,
      Portal: ({ children }: { children?: ReactNode }) => children,
      Backdrop: () => null,
      Popup: ({ children }: { children?: ReactNode }) => createElement('div', { 'data-popup': '' }, children),
    },
  }
})

import { Button, TREFFER_44, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { PasswordInput } from '@/components/ui/password-input'
import { DezimalFeld } from '@/components/shared/dezimal-feld'

const WURZEL = process.cwd()
const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), 'utf8')

/** Die Klassen des ersten Elements mit diesem data-slot (bzw. des ersten Tags). */
function klassenVon(html: string, merkmal: RegExp): string[] {
  const tag = html.match(merkmal)?.[0]
  if (!tag) throw new Error(`nicht gefunden: ${merkmal}`)
  return (tag.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/)
}

/**
 * Hat ein Element mindestens 44 px Höhe — selbst (h-11, h-12, size-11 …,
 * auch als data-[size=default]:h-11) oder über ein ::before mit min-h-11
 * und min-w-11?
 */
function hatFlaeche(klassen: string[]): boolean {
  const px = (k: string): number | null => {
    const m = k.match(/^(?:data-\[size=[a-z]+\]:)?(?:min-h|h|size)-(\d+(?:\.\d+)?)$/) ?? k.match(/^(?:min-h|h|size)-\[(\d+)px\]$/)
    if (!m) return null
    return k.includes('[') && k.endsWith('px]') ? Number(m[1]) : Number(m[1]) * 4
  }
  if (klassen.some((k) => (px(k) ?? 0) >= 44)) return true
  return klassen.includes('before:min-h-11') && klassen.includes('before:min-w-11') && klassen.some((k) => k.startsWith('before:absolute'))
}

describe('Gegenprobe der Messung', () => {
  it('die alten Maße fallen durch, die neuen nicht', () => {
    expect(hatFlaeche(['h-8'])).toBe(false) // Button default bisher
    expect(hatFlaeche(['h-9'])).toBe(false) // Input bisher
    expect(hatFlaeche(['data-[size=default]:h-8'])).toBe(false) // SelectTrigger bisher
    expect(hatFlaeche(['size-7'])).toBe(false) // Kreuz bisher
    expect(hatFlaeche(['h-6', 'before:absolute'])).toBe(false) // ::before ohne Mindestmaß
    expect(hatFlaeche(['h-11'])).toBe(true)
    expect(hatFlaeche(['h-[46px]'])).toBe(true)
    expect(hatFlaeche(['h-6', ...TREFFER_44.split(' ')])).toBe(true)
  })
})

describe('Button: jede Größe 44 px oder Fläche über before:', () => {
  const GROESSEN = ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'] as const

  it.each(GROESSEN)('Größe %s', (size) => {
    const html = renderToStaticMarkup(createElement(Button, { size }, 'Knopf'))
    expect(hatFlaeche(klassenVon(html, /<button[^>]*>/)), html).toBe(true)
  })

  it('Standard 44, lg 48, icon 44 px — die kleinen tragen TREFFER_44', () => {
    expect(buttonVariants({ size: 'default' }).split(' ')).toContain('h-11')
    expect(buttonVariants({ size: 'lg' }).split(' ')).toContain('h-12')
    expect(buttonVariants({ size: 'icon' }).split(' ')).toContain('size-11')
    for (const size of ['xs', 'sm', 'icon-xs', 'icon-sm'] as const) {
      expect(buttonVariants({ size }), size).toContain(TREFFER_44)
    }
  })

  it('der Fokusring ist voll, ohne Transparenz, 2 px', () => {
    const klassen = buttonVariants({}).split(' ')
    expect(klassen).toContain('focus-visible:ring-2')
    expect(klassen).toContain('focus-visible:ring-ring')
    expect(klassen.some((k) => /^focus-visible:ring-ring\/\d+$/.test(k))).toBe(false)
  })
})

describe('Felder: 44 px', () => {
  it('Input', () => {
    const klassen = klassenVon(renderToStaticMarkup(createElement(Input, {})), /<input[^>]*>/)
    expect(hatFlaeche(klassen)).toBe(true)
    expect(klassen).toContain('focus-visible:ring-ring')
  })

  it('SelectTrigger', () => {
    const html = renderToStaticMarkup(createElement(Select, null, createElement(SelectTrigger, null, createElement(SelectValue, { placeholder: 'Wählen…' }))))
    const klassen = klassenVon(html, /<[a-z]+[^>]*data-slot="select-trigger"[^>]*>/)
    expect(klassen).toContain('data-[size=default]:h-11')
    expect(hatFlaeche(klassen.filter((k) => !k.startsWith('data-[size=sm]')))).toBe(true)
  })

  it('DezimalFeld folgt dem Input', () => {
    const html = renderToStaticMarkup(createElement(DezimalFeld, { value: 1.6, onChange: () => {}, suffix: '€' }))
    expect(hatFlaeche(klassenVon(html, /<input[^>]*>/))).toBe(true)
  })
})

describe('Kreuz in Dialog und Blatt', () => {
  it.each([
    ['DialogContent', () => createElement(Dialog, { open: true }, createElement(DialogContent, null, 'Inhalt'))],
    ['SheetContent', () => createElement(Sheet, { open: true }, createElement(SheetContent, null, 'Inhalt'))],
  ] as const)('%s: 44-px-Knopf, Kreis 28 px als Span, Name „Schließen"', (_name, baue) => {
    const html = renderToStaticMarkup(baue())
    const knopf = html.match(/<button[^>]*data-slot="(?:dialog|sheet)-close"[^>]*>([\s\S]*?)<\/button>/)
    expect(knopf, html).not.toBeNull()
    const klassen = klassenVon(knopf![0], /<button[^>]*>/)
    expect(klassen).toContain('size-11')
    expect(hatFlaeche(klassen)).toBe(true)
    expect(knopf![1]).toMatch(/<span[^>]*data-slot="schliessen-kreis"[^>]*class="[^"]*\bsize-7\b/)
    expect(knopf![1]).toContain('<span class="sr-only">Schließen</span>')
  })
})

describe('PasswordInput: ein Auge, 44 px, Tastatur, Zustand', () => {
  /** Das Element des Knopfs aus dem Baum, den die Komponente zurückgibt. */
  function knopf(baum: ReactElement): ReactElement<Record<string, unknown>> {
    const kinder = (baum.props as { children: ReactNode[] }).children
    const gefunden = kinder.find((k): k is ReactElement<Record<string, unknown>> => isValidElement(k) && k.type === 'button')
    if (!gefunden) throw new Error('kein Knopf')
    return gefunden
  }

  it('verborgen: „Passwort anzeigen", aria-pressed false, im Tab-Ablauf, 44 px', () => {
    const html = renderToStaticMarkup(createElement(PasswordInput, { id: 'pw' }))
    const tag = html.match(/<button[^>]*>/)![0]
    expect(tag).toContain('aria-label="Passwort anzeigen"')
    expect(tag).toContain('aria-pressed="false"')
    expect(tag).not.toMatch(/tabindex/i)
    expect(hatFlaeche(klassenVon(tag, /<button[^>]*>/))).toBe(true)
    expect(html).toMatch(/<input[^>]*type="password"/)
  })

  it('sichtbar: „Passwort verbergen", aria-pressed true, Feld als Text; der Klick kehrt um', () => {
    auge.sichtbar = true
    auge.gesetzt.length = 0
    try {
      const baum = PasswordInput({ id: 'pw' })
      const html = renderToStaticMarkup(baum)
      expect(html).toContain('aria-label="Passwort verbergen"')
      expect(html).toContain('aria-pressed="true"')
      expect(html).toMatch(/<input[^>]*type="text"/)
      ;(knopf(baum).props.onClick as () => void)()
      const umkehr = auge.gesetzt[0] as (vorher: boolean) => boolean
      expect(umkehr(true)).toBe(false)
      expect(umkehr(false)).toBe(true)
    } finally {
      auge.sichtbar = null
    }
  })

  it('mit eigener Feldform zeichnet ein schlichtes input mit dieser Form und Platz für das Auge', () => {
    const html = renderToStaticMarkup(createElement(PasswordInput, { feld: 'h-[46px] border-border', className: 'pr-10' }))
    const klassen = klassenVon(html, /<input[^>]*>/)
    expect(klassen).toContain('h-[46px]')
    expect(klassen).toContain('pr-12')
    expect(klassen).not.toContain('pr-10')
    expect(html).not.toContain('data-slot="input"')
  })

  it.each(['src/app/(auth)/register/register-form.tsx', 'src/app/(auth)/reset-password/neues-passwort-formular.tsx'])(
    '%s nutzt PasswordInput statt einer eigenen Kopie',
    (pfad) => {
      const text = lies(pfad)
      expect(text).toMatch(/from '@\/components\/ui\/password-input'/)
      expect(text).not.toMatch(/\bEye(Off)?\b/)
      expect(text).not.toMatch(/aria-pressed/)
    }
  )
})

describe('Kleine Größen nur mit Fläche (Bestandsliste)', () => {
  type Fund = { datei: string; zeile: number; text: string }
  const KLEIN = /size(?:=\{?|:\s*)['"](?:xs|sm|icon-xs|icon-sm)['"]/

  /** Stellen mit kleiner Größe, deren Fläche nur das ::before trägt — je mit Nachweis, dass nichts sie beschneidet. */
  const FLAECHE_UEBER_BEFORE: { datei: string; grund: string }[] = [
    {
      datei: 'src/components/products/product-dialog.tsx',
      grund: '„Foto ersetzen" (sm, 28 px) sitzt bottom-2 im Bildrahmen mit overflow-hidden: Das ::before ragt 8 px über und unter den Knopf — genau bis zum Rand, die 44 px bleiben ganz',
    },
  ]

  /** Stellen ohne Fläche — darf nur schrumpfen. */
  const BESTAND_OHNE_FLAECHE: { datei: string; grund: string }[] = []

  function* dateien(ordner: string): Generator<string> {
    for (const name of readdirSync(ordner)) {
      const pfad = join(ordner, name)
      if (statSync(pfad).isDirectory()) yield* dateien(pfad)
      else if (/\.tsx?$/.test(name)) yield pfad
    }
  }

  /** Funde ohne eigene 44 px in derselben oder einer der nächsten drei Zeilen (className steht oft darunter). */
  function funde(text: string, datei: string): Fund[] {
    const zeilen = text.split('\n')
    const ergebnis: Fund[] = []
    zeilen.forEach((z, i) => {
      if (!KLEIN.test(z)) return
      const umfeld = zeilen.slice(Math.max(0, i - 3), i + 4).join(' ')
      if (/\b(?:min-h|h)-1[12]\b/.test(umfeld)) return
      ergebnis.push({ datei, zeile: i + 1, text: z.trim() })
    })
    return ergebnis
  }

  const alle = (): Fund[] =>
    [...dateien(join(WURZEL, 'src'))]
      .map((p) => relative(WURZEL, p).split(sep).join('/'))
      .filter((p) => p !== 'src/components/ui/button.tsx')
      .flatMap((p) => funde(lies(p), p))

  it('Gegenprobe: eine kleine Größe ohne 44 px wird gefunden, mit min-h-11 nicht', () => {
    expect(funde('<Button size="sm">Weg</Button>', 'x.tsx')).toHaveLength(1)
    expect(funde("className={cn(buttonVariants({ size: 'xs' }), 'absolute')}", 'x.tsx')).toHaveLength(1)
    expect(funde("className={cn(buttonVariants({ size: 'sm' }), 'min-h-11')}", 'x.tsx')).toHaveLength(0)
    expect(funde('<Button size="default">Weg</Button>', 'x.tsx')).toHaveLength(0)
  })

  it('jede Stelle steht in einer der beiden Listen, keine Liste nennt eine Datei ohne Fund', () => {
    const gefunden = alle()
    const erlaubt = new Set([...FLAECHE_UEBER_BEFORE, ...BESTAND_OHNE_FLAECHE].map((e) => e.datei))
    expect(gefunden.filter((f) => !erlaubt.has(f.datei))).toEqual([])
    const mitFund = new Set(gefunden.map((f) => f.datei))
    expect([...erlaubt].filter((d) => !mitFund.has(d))).toEqual([])
  })

  it('die Bestandsliste ohne Fläche ist leer — und bleibt es', () => {
    expect(BESTAND_OHNE_FLAECHE).toHaveLength(0)
  })
})

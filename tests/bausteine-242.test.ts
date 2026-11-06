/**
 * Bausteine aus der Nacharbeit Nr. 242 (Lauf 31) — gerendert wie auf dem Server.
 *
 * Beweist:
 *  - EmptyState: die Karten-Form aus Nr. 242 ist seit Nr. 246 (G4) die einzige Form — links bündig, Titel fett ohne
 *    Serifen, Ausweg über die volle Breite, ohne Symbol, fester Rand (tests/bausteine-246.test.ts prüft den Rest).
 *  - DialogMitte mit `aktionen`: kein Schließen-Knopf im Kopf, die Aktionen stehen unten; ohne `aktionen` bleibt
 *    genau der eine Knopf im Kopf (Gegenprobe).
 *  - Die Dunkel-Klassen für Bilder haben EINE Quelle (ui/bild-dunkel.ts, ohne 'use client'); keine zweite Kopie unter
 *    src/components (Gegenprobe an einem Schnipsel).
 *  - Die Datei-Eingaben der Foto-Quellen stehen in einer `hidden`-Hülle und tragen je einen Namen.
 *  - Die 404 des Hauses beschriftet ihr Suchfeld sichtbar (kein sr-only am Label).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/navigation', () => ({ useParams: () => ({}) }))
// Dialog zeichnet auf dem Server nichts (Portal) — sichtbar geschaltet wie in tests/bausteine-lauf30.test.ts.
vi.mock('@base-ui/react/dialog', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@base-ui/react/dialog')>()
  return {
    ...echt,
    Dialog: {
      ...echt.Dialog,
      Portal: ({ children }: { children?: ReactNode }) => children,
      Backdrop: () => null,
      Popup: ({ children, className, ...rest }: { children?: ReactNode; className?: string } & Record<string, unknown>) =>
        createElement('div', { 'data-popup': '', className, 'data-slot': rest['data-slot'] }, children),
    },
  }
})

import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogMitte } from '@/components/ui/dialog'
import { FOTO_HUELLE, ILLUSTRATION_BILD, ILLUSTRATION_HUELLE } from '@/components/ui/bild-dunkel'
import { NichtGefundenAnsicht } from '@/components/shared/nicht-gefunden-ansicht'
import { FOTO_EINGABE_NAME } from '@/components/shared/foto-quellen'
import { SUCHE_TEXT } from '@/lib/fehlerseite'

const WURZEL = process.cwd()
const quelle = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8')
const zaehle = (html: string, muster: RegExp) => [...html.matchAll(new RegExp(muster.source, 'g'))].length

describe('EmptyState in der Karten-Form', () => {
  const ausweg = createElement('a', { href: '/hoefe' }, 'Höfe entdecken')

  it('steht links bündig ohne Symbol, der Titel fett ohne Serifen, der Ausweg über die volle Breite', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { titel: 'Noch nichts da', satz: 'Ein Satz.', ausweg }))
    expect(html).toContain('text-left')
    expect(html).toMatch(/<p class="text-\[16px\] font-bold text-foreground">Noch nichts da<\/p>/)
    expect(html).toContain('*:w-full')
    expect(html).toContain('href="/hoefe"')
    expect(html).not.toContain('lucide')
    expect(html).not.toContain('border-dashed')
  })
})

describe('DialogMitte mit Aktionen unten', () => {
  const offen = (props: Parameters<typeof DialogMitte>[0]) => renderToStaticMarkup(createElement(Dialog, { open: true }, createElement(DialogMitte, props)))
  const knoepfe = createElement('span', null, createElement('button', { type: 'button' }, 'Abbrechen'), createElement('button', { type: 'button' }, 'Konto löschen'))

  it('lässt den Knopf im Kopf weg und stellt die Aktionen ans Ende', () => {
    const html = offen({ titel: 'Konto wirklich löschen?', aktionen: knoepfe, children: createElement('p', null, 'Satz') })
    expect(zaehle(html, /data-slot="dialog-close"/)).toBe(0)
    expect(html).toContain('data-slot="dialog-mitte-aktionen"')
    expect(zaehle(html, />Abbrechen</)).toBe(1)
    // Reihenfolge: erst der Inhalt, dann die Aktionen.
    expect(html.indexOf('Satz')).toBeLessThan(html.indexOf('dialog-mitte-aktionen'))
  })

  it('Gegenprobe: ohne Aktionen genau ein Schließen-Knopf im Kopf, keine Aktionszeile', () => {
    const html = offen({ titel: 'T', schliessen: 'Abbrechen', children: 'x' })
    expect(zaehle(html, /data-slot="dialog-close"/)).toBe(1)
    expect(html).not.toContain('dialog-mitte-aktionen')
  })
})

describe('Dunkel-Klassen für Bilder: eine Quelle', () => {
  const MUSTER = /['"`]dark:(?:mix-blend-multiply|brightness-\[1\.6\])['"`]/

  function* dateien(ordner: string): Generator<string> {
    for (const name of readdirSync(ordner)) {
      const pfad = join(ordner, name)
      if (statSync(pfad).isDirectory()) yield* dateien(pfad)
      else if (/\.(ts|tsx)$/.test(name)) yield pfad
    }
  }

  it('liefert die Werte aus einem Modul ohne „use client“ — Server-Komponenten bekommen die Klassen selbst', () => {
    expect([ILLUSTRATION_HUELLE, ILLUSTRATION_BILD, FOTO_HUELLE]).toEqual(['dark:brightness-[1.6]', 'dark:mix-blend-multiply', 'dark:brightness-[0.85]'])
    expect(quelle('src/components/ui/bild-dunkel.ts')).not.toMatch(/^['"]use client['"]/m)
  })

  it('kein zweites Modul unter src/components schreibt die Werte als eigene Konstante', () => {
    const funde = [...dateien(join(WURZEL, 'src/components'))]
      .map((pfad) => relative(WURZEL, pfad))
      .filter((pfad) => pfad !== join('src', 'components', 'ui', 'bild-dunkel.ts') && MUSTER.test(quelle(pfad)))
    expect(funde).toEqual([])
    // Gegenprobe: die alte Kopie aus hoefe/hof-bildflaeche.tsx schlägt an.
    expect(MUSTER.test("const ILLUSTRATION_HUELLE_DUNKEL = 'dark:brightness-[1.6]'")).toBe(true)
  })
})

describe('Datei-Eingaben der Foto-Quellen', () => {
  it('stehen in einer hidden-Hülle und tragen je einen Namen', () => {
    const text = quelle('src/components/shared/foto-quellen.tsx')
    expect(text).toContain('<div hidden data-slot="foto-eingaben">')
    for (const weg of ['galerie', 'dateien', 'kamera'] as const) {
      expect(text).toContain(`aria-label={FOTO_EINGABE_NAME.${weg}}`)
      expect(FOTO_EINGABE_NAME[weg].length).toBeGreaterThan(0)
    }
    const huelle = text.slice(text.indexOf('<div hidden data-slot="foto-eingaben">'), text.indexOf('</div>', text.indexOf('data-slot="foto-eingaben"')))
    expect(zaehle(huelle, /type="file"/)).toBe(3)
    // Gegenprobe: außerhalb der Hülle steht keine Datei-Eingabe.
    expect(zaehle(text, /type="file"/)).toBe(3)
  })
})

describe('404 des Hauses', () => {
  const props = { titel: 'Seite nicht gefunden', text: 'Satz.', haupt: { href: '/', text: 'Zur Startseite' }, neben: { href: '/hoefe', text: 'Höfe entdecken' } }

  it('beschriftet das Suchfeld sichtbar', () => {
    const html = renderToStaticMarkup(createElement(NichtGefundenAnsicht, { ...props, suchfeldId: 'suche-404' }))
    const label = new RegExp(`<label for="suche-404" class="([^"]*)">${SUCHE_TEXT.beschriftung}</label>`).exec(html)
    expect(label).not.toBeNull()
    expect(label?.[1]).not.toContain('sr-only')
    expect(html).toContain('id="suche-404"')
  })

  it('Gegenprobe: ohne Kennung kein Suchfeld', () => {
    const html = renderToStaticMarkup(createElement(NichtGefundenAnsicht, props))
    expect(html).not.toContain('type="search"')
  })
})

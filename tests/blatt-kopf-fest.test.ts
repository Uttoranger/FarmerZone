/**
 * SheetBlatt mit festem Kopf (Prop `kopf`, Nr. 233 UI-Runde 4, Board s1-mehr-neu Bild 2): Griff und Kopf stehen,
 * nur der Körper darunter scrollt — beim Scrollen scheint nichts über dem Kopf durch. Ohne `kopf` bleibt das Blatt,
 * wie es war (es scrollt selbst).
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Das Blatt zeichnet auf dem Server nichts (Portal) — hier sichtbar geschaltet wie in tests/bausteine-lauf30.test.ts.
vi.mock('@base-ui/react/dialog', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@base-ui/react/dialog')>()
  return {
    ...echt,
    Dialog: {
      ...echt.Dialog,
      Portal: ({ children }: { children?: ReactNode }) => children,
      Backdrop: () => null,
      Popup: ({ children, className, ...rest }: { children?: ReactNode; className?: string } & Record<string, unknown>) =>
        createElement('div', { className, 'data-slot': rest['data-slot'] }, children),
    },
  }
})

import { Sheet, SheetBlatt } from '@/components/ui/sheet'

const offen = (kopf?: ReactNode) =>
  renderToStaticMarkup(createElement(Sheet, { open: true }, createElement(SheetBlatt, { kopf }, createElement('p', null, 'Zeile'))))

const klassenVon = (html: string, slot: string): string[] =>
  html.match(new RegExp(`data-slot="${slot}"[^>]*class="([^"]*)"|class="([^"]*)"[^>]*data-slot="${slot}"`))?.slice(1).find(Boolean)?.split(' ') ?? []

describe('SheetBlatt mit festem Kopf', () => {
  it('das Blatt scrollt nicht, nur der Körper unter Griff und Kopf', () => {
    const html = offen(createElement('h2', null, 'Kopf'))
    const blatt = klassenVon(html, 'sheet-blatt')
    expect(blatt).toContain('overflow-hidden')
    expect(blatt).not.toContain('overflow-y-auto')
    // Reihenfolge: Griff, Kopf, dann der scrollende Körper mit dem Inhalt.
    const griff = html.indexOf('data-slot="sheet-griff"')
    const kopf = html.indexOf('<h2>Kopf</h2>')
    const koerper = html.indexOf('data-slot="sheet-koerper"')
    expect(griff).toBeGreaterThan(-1)
    expect(kopf).toBeGreaterThan(griff)
    expect(koerper).toBeGreaterThan(kopf)
    expect(html.indexOf('<p>Zeile</p>')).toBeGreaterThan(koerper)
    // Der Körper schrumpft als Einziger und scrollt; seine Kinder behalten ihre Höhe.
    const koerperKlassen = klassenVon(html, 'sheet-koerper')
    for (const k of ['overflow-y-auto', 'min-h-0', 'shrink!', '*:shrink-0', 'gap-[inherit]']) expect(koerperKlassen, k).toContain(k)
  })

  it('Gegenprobe: ohne `kopf` scrollt das Blatt selbst, es gibt keinen Körper', () => {
    const html = offen()
    expect(klassenVon(html, 'sheet-blatt')).toContain('overflow-y-auto')
    expect(html).not.toContain('sheet-koerper')
    expect(html).toContain('<p>Zeile</p>')
  })
})

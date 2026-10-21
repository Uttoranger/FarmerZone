/**
 * Region › die Reiter-Links tragen Ansicht und Abholung mit (Nr. 133, Rest aus
 * 123, Register F10): `regionReiterLink` kann es seit 123, der Kopf der beiden
 * Reiter-Seiten hat die Werte aber nicht weitergereicht — wer in der Karte
 * stand, landete beim Wechsel wieder in der Liste.
 *
 * Gerendert werden die echten Seiten (PreiseReiter, FutterReiter); nur die
 * Abfragen sind Attrappen, die werfen — es genügt der Kopf samt Fehlerzustand.
 * Alle vier Wege: Preise → Futter und Futter → Preise, je mit Liste und mit Karte.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
  // Der Ladepunkt am Reiter fragt den Ladestand des Links — hier lädt nie etwas.
  useLinkStatus: () => ({ pending: false }),
}))
vi.mock('next/navigation', () => ({
  redirect: (ziel: string) => {
    throw new Error(`NEXT_REDIRECT:${ziel}`)
  },
  usePathname: () => '/region',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/server/queries/umfeld', () => ({
  getUmfeld: async () => {
    throw new Error('Abfrage nicht erreichbar')
  },
}))
vi.mock('@/server/queries/futter-kaufen', () => ({
  getFutterKaufen: async () => {
    throw new Error('Abfrage nicht erreichbar')
  },
}))

import { FutterReiter } from '@/app/(hof)/region/futter-reiter'
import { PreiseReiter } from '@/app/(hof)/region/preise-reiter'

const HOF = { id: 'hof-a', name: 'Testhof A' }

/** Die Ziele der beiden Reiter im Kopf, wie der Browser sie liest (&amp; → &). */
function reiterZiele(html: string): { preise: string; futter: string } {
  const nav = html.slice(html.indexOf('<nav aria-label="Region"'), html.indexOf('</nav>'))
  const ziel = (label: string): string => {
    const treffer = new RegExp(`<a href="([^"]+)"[^>]*>${label}`).exec(nav)
    if (!treffer) throw new Error(`Reiter „${label}“ fehlt im Kopf`)
    return treffer[1].replaceAll('&amp;', '&')
  }
  return { preise: ziel('Preise vergleichen'), futter: ziel('Futter kaufen') }
}

async function ausPreise(suche: Record<string, string>): Promise<{ preise: string; futter: string }> {
  return reiterZiele(renderToStaticMarkup(await PreiseReiter({ farm: HOF, suche })))
}

async function ausFutter(suche: Record<string, string>): Promise<{ preise: string; futter: string }> {
  return reiterZiele(renderToStaticMarkup(await FutterReiter({ farm: HOF, suche })))
}

describe('Region: der Wechsel zwischen den Reitern behält die Ansicht', () => {
  it('Preise → Futter mit Karte bleibt in der Karte, mit Liste in der Liste', async () => {
    expect((await ausPreise({ km: '10', ansicht: 'karte' })).futter).toBe('/region?reiter=futter&km=10&ansicht=karte')
    expect((await ausPreise({ km: '10' })).futter).toBe('/region?reiter=futter&km=10')
  })

  it('Futter → Preise mit Karte bleibt in der Karte, mit Liste in der Liste', async () => {
    expect((await ausFutter({ reiter: 'futter', km: '50', ansicht: 'karte' })).preise).toBe('/region?km=50&ansicht=karte')
    expect((await ausFutter({ reiter: 'futter', km: '50' })).preise).toBe('/region?km=50')
  })

  it('Futter kaufen behält dabei Abholung und Ansicht, Preise vergleichen kennt die Abholung nicht', async () => {
    const futter = await ausFutter({ reiter: 'futter', km: '25', abholung: 'morgen', ansicht: 'karte' })
    expect(futter.futter).toBe('/region?reiter=futter&km=25&abholung=morgen&ansicht=karte')
    expect(futter.preise).toBe('/region?km=25&ansicht=karte')
  })

  it('Unsinn in der Adresse fällt auf Liste und alle Tage zurück', async () => {
    const ziele = await ausFutter({ reiter: 'futter', km: '25', abholung: 'gestern', ansicht: '<script>' })
    expect(ziele).toEqual({ preise: '/region?km=25', futter: '/region?reiter=futter&km=25' })
  })
})

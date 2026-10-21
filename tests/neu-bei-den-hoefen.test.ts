/**
 * „Neu bei den Höfen“ auf der Startseite (Register N16, Ergänzung Nr. 129;
 * Board system-k2-beitraege-v2, Abschnitt 4) — die Komponente serverseitig
 * gerendert (useUhr liefert dabei den Zeitpunkt des Servers) und ihr Eintrag
 * in STARTSEITE_ABSCHNITTE mit gestellten Daten.
 *
 * Beweist: h2 und Satz, je Karte Anlass, Titel, „Hofname · vor …“ und EIN Link
 * auf den Beitrag der Hofseite (`?beitrag=`), „Zurück“/„Weiter“ mit Namen.
 * Leer rendert der Abschnitt nichts — auch, wenn alle Beiträge inzwischen
 * abgelaufen sind. Ein Ladefehler nimmt nur den Abschnitt weg und geht nach
 * Sentry; die Startseite bleibt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/server/queries/neuigkeiten', () => ({ ladeNeuigkeiten: vi.fn() }))
vi.mock('@/server/queries/plattform-einstellung', () => ({ gruendungFuerSeiten: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { NeuBeiDenHoefen } from '@/components/startseite/neu-bei-den-hoefen'
import { STARTSEITE_ABSCHNITTE } from '@/components/startseite/startseite-abschnitte'
import { ladeNeuigkeiten } from '@/server/queries/neuigkeiten'
import type { Neuigkeit } from '@/lib/startseite-gestalten'
import { inhaltHinterSuspense } from './element-suche'

const JETZT = '2026-10-20T10:00:00.000Z'
const STUNDE = 3_600_000
const vor = (ms: number): string => new Date(Date.parse(JETZT) - ms).toISOString()

const neuigkeit = (teil: Partial<Neuigkeit> = {}): Neuigkeit => ({
  id: 'ckuerbis',
  titel: 'Die ersten Kürbisse sind da',
  anlass: 'NEW_SEASON',
  foto: null,
  fotoAusschnitt: null,
  veroeffentlicht: vor(2 * STUNDE),
  endet: null,
  hof: { name: 'Testhof A', slug: 'testhof-a', kategorien: ['GEMUESE'] },
  ...teil,
})

const reihe = (liste: Neuigkeit[]) => renderToStaticMarkup(createElement(NeuBeiDenHoefen, { neuigkeiten: liste, jetzt: JETZT }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NeuBeiDenHoefen', () => {
  it('Titel, Satz, je Karte Anlass, Titel, Hof und Zeit — ein Link auf den Beitrag', () => {
    const html = reihe([neuigkeit(), neuigkeit({ id: 'cheu', titel: 'Heu-Aktion', anlass: 'PROMOTION', veroeffentlicht: vor(3 * 24 * STUNDE), hof: { name: 'Sonnhof', slug: 'sonnhof', kategorien: [] } })])
    expect(html).toContain('>Neu bei den Höfen</h2>')
    expect(html).toContain('Was die Höfe in den letzten 14 Tagen erzählt haben')
    expect(html).toContain('href="/testhof-a?beitrag=ckuerbis"')
    expect(html).toContain('href="/sonnhof?beitrag=cheu"')
    expect(html.match(/<a /g)).toHaveLength(2)
    expect(html).toContain('Neue Saison')
    expect(html).toContain('Aktion')
    expect(html).toContain('Testhof A · vor 2 Stunden')
    expect(html).toContain('Sonnhof · vor 3 Tagen')
    expect(html).toContain('aria-label="Zurück"')
    expect(html).toContain('aria-label="Weiter"')
  })

  it('leer rendert nichts', () => {
    expect(reihe([])).toBe('')
  })

  it('sind alle abgelaufen, rendert er auch nichts — der Browser rechnet mit seiner Uhr', () => {
    expect(reihe([neuigkeit({ endet: JETZT })])).toBe('')
  })
})

describe('Eintrag in STARTSEITE_ABSCHNITTE', () => {
  it('lädt aus dem Datencache und zeigt die Reihe', async () => {
    vi.mocked(ladeNeuigkeiten).mockResolvedValueOnce([neuigkeit()])
    const inhalt = await inhaltHinterSuspense(STARTSEITE_ABSCHNITTE.NEUIGKEITEN({ jetzt: new Date(JETZT) }))
    expect(renderToStaticMarkup(inhalt)).toContain('href="/testhof-a?beitrag=ckuerbis"')
  })

  it('ein Ladefehler nimmt nur den Abschnitt weg und geht nach Sentry', async () => {
    vi.mocked(ladeNeuigkeiten).mockRejectedValueOnce(new Error('Verbindung weg'))
    const inhalt = await inhaltHinterSuspense(STARTSEITE_ABSCHNITTE.NEUIGKEITEN({ jetzt: new Date(JETZT) }))
    expect(inhalt).toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), { tags: { bereich: 'startseite-neuigkeiten' } })
  })
})

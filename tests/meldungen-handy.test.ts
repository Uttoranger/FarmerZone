/**
 * Postfach › Meldungen am Handy (Register N14, Ergänzung; Nachtlauf Nr. 101;
 * Mockup mobil-admin-postfach-meldungen) — serverseitig gerendert, nur
 * Aussagen über Merkmale (TESTING_GUIDELINES §1).
 *
 * Beweist (Nachbesserung Runde 1):
 *  - Unter 1024 px gibt es die Filter Art und Von nicht — das Mockup zeigt
 *    zwischen Umschalter und Teil-Chips nichts; ab 1024 px stehen sie da.
 *  - Am Handy zählen Chip und Liste dieselbe Menge, auch wenn die Adresse
 *    einen Filter trägt (etwa ein Link vom Computer): die Zahl im Chip „Braucht
 *    dich" ist die Zahl der Karten darunter. Gegenprobe: ab 1024 px filtert
 *    der Ablauf weiter nach Art.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AblaufMeldung } from '@/lib/meldung'

vi.mock('next/link', () => ({
  // `scroll` ist eine Angabe für Next, kein Attribut des Links.
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement('a', { href, ...Object.fromEntries(Object.entries(rest).filter(([name]) => name !== 'scroll')) }, children),
  // Der Ladepunkt der Chips (Nr. 105) fragt den Zustand des Links — beim Rendern auf dem Server lädt nichts.
  useLinkStatus: () => ({ pending: false }),
}))
vi.mock('@/server/queries/meldung', async (original) => ({
  ...(await original<typeof import('@/server/queries/meldung')>()),
  ladeMeldungenAblauf: vi.fn(),
}))
// Die Klick-Inseln (Dialoge, KI-Knöpfe, Stand für alle) tragen hier nichts bei.
vi.mock('@/components/admin/meldungen-werkzeug', () => ({
  MeldungenWerkzeug: ({ children }: { children: ReactNode }) => children,
  KartenMenue: () => null,
  TrennenKnopf: () => null,
  WerkzeugKnopf: () => null,
}))
vi.mock('@/components/admin/meldungen-ki-vorschlag', () => ({ KiKnoepfe: () => null }))
vi.mock('@/components/admin/meldungen-stand-formular', () => ({ StandFormular: () => null }))

import { ladeMeldungenAblauf } from '@/server/queries/meldung'
import { MeldungenReiter, ladeMeldungenReiter } from '@/app/admin/postfach/meldungen-reiter'
import { MELDUNGEN_TEXT } from '@/lib/meldung'
import { meldungenAnsichtAus } from '@/schemas/meldung'

const JETZT = new Date('2026-10-15T10:00:00.000Z')

function meldung(id: string, abweichend: Partial<AblaufMeldung> = {}): AblaufMeldung {
  return {
    id,
    art: 'FEHLER',
    status: 'NEU',
    createdAt: new Date('2026-10-14T10:00:00.000Z'),
    triagedAt: null,
    ersteZeile: `Erfundene Meldung ${id}`,
    hofName: `Hof ${id}`,
    farmId: `farm-${id}`,
    customerEmail: null,
    clusterKey: null,
    sprintName: null,
    duplikatVonId: null,
    screenshot: false,
    diagKennung: null,
    triageNotiz: null,
    antwortAnMelder: null,
    ...abweichend,
  }
}

const LISTE: AblaufMeldung[] = [
  meldung('neu1'),
  meldung('neu2', { art: 'WUNSCH', farmId: null, hofName: null, customerEmail: 'kundin@example.com' }),
  meldung('ki1', { status: 'VERMUTLICH_WUNSCH' }),
  meldung('plan1', { status: 'GEPLANT', art: 'WUNSCH', triagedAt: new Date('2026-10-13T10:00:00.000Z') }),
]

async function render(adresse: Record<string, string>): Promise<string> {
  vi.mocked(ladeMeldungenAblauf).mockResolvedValue(LISTE)
  const daten = await ladeMeldungenReiter(meldungenAnsichtAus(adresse))
  return renderToStaticMarkup(createElement(MeldungenReiter, { daten, jetzt: JETZT }))
}

/** Die Klassen des Elements, das das Merkmal unmittelbar umschließt. */
function klassenUm(html: string, merkmal: string): string[] {
  const stelle = html.indexOf(merkmal)
  expect(stelle, merkmal).toBeGreaterThan(-1)
  const vorher = [...html.slice(0, stelle).matchAll(/<div class="([^"]*)">/g)]
  return (vorher.at(-1)?.[1] ?? '').split(' ')
}

/** Der Teil des Ablaufs, der nur am Handy steht (vor den Spalten ab 1024 px). */
function handyTeil(html: string): string {
  const start = html.indexOf('lg:hidden')
  const ende = html.indexOf('lg:grid lg:grid-cols-4')
  expect(start).toBeGreaterThan(-1)
  expect(ende).toBeGreaterThan(start)
  return html.slice(start, ende)
}

describe('Postfach › Meldungen am Handy', () => {
  it('unter 1024 px keine Filter Art und Von (Mockup mobil) — ab 1024 px stehen sie da', async () => {
    const html = await render({ reiter: 'meldungen' })
    const art = klassenUm(html, `<ul aria-label="${MELDUNGEN_TEXT.artBeschriftung}"`)
    expect(art).toContain('hidden')
    expect(art).toContain('lg:block')
    const von = klassenUm(html, `>${MELDUNGEN_TEXT.von}</span>`)
    expect(von).toContain('hidden')
    expect(von).toContain('lg:flex')
    // Gegenprobe: der Umschalter Ablauf | Wünsche gebündelt bleibt am Handy.
    expect(klassenUm(html, `<ul aria-label="${MELDUNGEN_TEXT.ansichtBeschriftung}"`)).not.toContain('hidden')
  })

  it('mit Filter in der Adresse zählen Chip und Liste dieselbe Menge; ab 1024 px filtert der Ablauf weiter', async () => {
    const html = await render({ reiter: 'meldungen', art: 'wunsch', von: 'kundschaft' })
    const handy = handyTeil(html)
    const chip = handy.match(/Braucht dich <span[^>]*>(\d+)<\/span>/)
    expect(chip?.[1]).toBe('3')
    expect(handy.match(/<h3 /g)).toHaveLength(3)
    for (const id of ['neu1', 'neu2', 'ki1']) expect(handy).toContain(`Erfundene Meldung ${id}`)

    const computer = html.slice(html.indexOf('lg:grid lg:grid-cols-4'))
    expect(computer).toContain('Erfundene Meldung neu2')
    expect(computer).not.toContain('Erfundene Meldung neu1')
    expect(computer).not.toContain('Erfundene Meldung ki1')
  })
})

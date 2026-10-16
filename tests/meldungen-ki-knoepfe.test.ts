/**
 * Die zwei Knöpfe zum Vorschlag der KI (Register N14, Ergänzung; Nachtlauf
 * Nr. 101; Mockups admin-postfach-meldungen-ablauf und
 * mobil-admin-postfach-meldungen) — serverseitig gerendert, nur Aussagen über
 * Merkmale (TESTING_GUIDELINES §1).
 *
 * Beweist (Nachbesserung Runde 2):
 *  - „Ja, ein Wunsch" ist der gefüllte grüne Knopf, „Nein, ein Fehler" der
 *    Knopf mit Rahmen — wie in beiden Mockups (die Gewichtung des alten
 *    KiVorschlag war umgekehrt: Rahmen und grüner Text).
 *  - Unter 1024 px sind beide gleich breit nebeneinander (Mockup mobil:
 *    flex 1), ab 1024 px in Inhaltsbreite.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MELDUNG_KLICK_TEXT, type TriageStand } from '@/lib/meldung'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/server/actions/admin', () => ({ triageMeldungAction: vi.fn() }))
vi.mock('@/components/admin/meldungen-werkzeug', () => ({ useMeldungenWerkzeug: () => null }))

import { KiKnoepfe } from '@/components/admin/meldungen-ki-vorschlag'

const STAND: TriageStand = {
  status: 'VERMUTLICH_WUNSCH',
  art: 'FEHLER',
  clusterKey: null,
  triageNotiz: null,
  duplikatVonId: null,
  sprintName: null,
  antwortAnMelder: null,
}

/** Die Klassen des Knopfs mit genau dieser Beschriftung. */
function knopfKlassen(html: string, beschriftung: string): string[] {
  const treffer = [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*>([^<]*)<\/button>/g)].find((t) => t[2] === beschriftung)
  expect(treffer, beschriftung).toBeDefined()
  return (treffer?.[1] ?? '').split(' ')
}

describe('KiKnoepfe', () => {
  const html = renderToStaticMarkup(createElement(KiKnoepfe, { meldungId: 'meldung-test', stand: STAND }))

  it('„Ja, ein Wunsch" grün gefüllt, „Nein, ein Fehler" mit Rahmen (Mockups Ablauf und mobil)', () => {
    const ja = knopfKlassen(html, MELDUNG_KLICK_TEXT.jaWunsch)
    expect(ja).toContain('bg-accent')
    expect(ja).toContain('text-accent-foreground')
    expect(ja).not.toContain('border')

    const nein = knopfKlassen(html, MELDUNG_KLICK_TEXT.neinFehler)
    expect(nein).toContain('border')
    expect(nein).toContain('text-foreground')
    expect(nein).not.toContain('bg-accent')
    expect(nein).not.toContain('text-status-fertig')
  })

  it('unter 1024 px beide gleich breit nebeneinander, ab 1024 px in Inhaltsbreite', () => {
    for (const beschriftung of [MELDUNG_KLICK_TEXT.jaWunsch, MELDUNG_KLICK_TEXT.neinFehler]) {
      const klassen = knopfKlassen(html, beschriftung)
      expect(klassen, beschriftung).toContain('flex-1')
      expect(klassen, beschriftung).toContain('lg:flex-none')
      expect(klassen, beschriftung).toContain('min-h-11')
    }
    // Nebeneinander: die Zeile bricht am Handy nicht um.
    const zeile = html.match(/<div class="([^"]*)"><button/)?.[1].split(' ') ?? []
    expect(zeile).toContain('flex')
    expect(zeile).not.toContain('flex-wrap')
  })
})

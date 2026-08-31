/**
 * Tests für die Server-Action der Umkreis-Ortssuche
 * (src/server/actions/hoefe.ts, loeseOrtAuf).
 *
 * Die Suite läuft ohne DOM, die Umkreis-Komponente ist also nicht prüfbar —
 * ihre DATENGRUNDLAGE aber sehr wohl, und genau die trägt Teil A-3: Die
 * Aktion entdoppelt die Nominatim-Treffer, beschriftet sie mit dem Land und
 * gibt ALLE zurück (nicht nur den besten). Ohne diese Tests überlebte jede
 * Rückabwicklung auf „ein Treffer, ohne Land" die ganze Suite.
 *
 * Gemockt wird ausschließlich `sucheOrtspunkt` — die Netzgrenze. Entdopplung
 * und Beschriftung laufen echt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StandortKandidat } from '@/lib/geokodierung'

vi.mock('@/lib/geokodierung', async (original) => ({
  ...(await original<typeof import('@/lib/geokodierung')>()),
  sucheOrtspunkt: vi.fn(),
}))

import { loeseOrtAuf } from '@/server/actions/hoefe'
import { sucheOrtspunkt } from '@/lib/geokodierung'

const suche = vi.mocked(sucheOrtspunkt)

function kandidat(
  lat: number,
  lon: number,
  anzeigeName: string,
  land?: string
): StandortKandidat {
  return { lat, lon, anzeigeName, ...(land ? { land } : {}) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loeseOrtAuf — die Datengrundlage der Ortsauswahl', () => {
  it('gibt ALLE unterscheidbaren Treffer zurück, nicht nur den besten', async () => {
    suche.mockResolvedValue([
      kandidat(48.267, 13.025, 'Simbach am Inn, Bayern, Deutschland', 'DE'),
      kandidat(48.256, 13.036, 'Braunau am Inn, Oberösterreich, Österreich', 'AT'),
    ])

    const treffer = await loeseOrtAuf('Simbach')

    expect(treffer).toHaveLength(2)
    expect(treffer[0]).toMatchObject({ lat: 48.267, lon: 13.025 })
  })

  it('jeder Treffer trägt das Land in der Beschriftung — sonst wäre er nicht zuzuordnen', async () => {
    suche.mockResolvedValue([
      kandidat(48.267, 13.025, 'Simbach', 'DE'),
      kandidat(48.256, 13.036, 'Braunau', 'AT'),
    ])

    const treffer = await loeseOrtAuf('Simbach')

    expect(treffer.map((t) => t.name)).toEqual(['Simbach (Deutschland)', 'Braunau (Österreich)'])
  })

  it('nennt der Nominatim-Name das Land schon, wird es nicht doppelt angehängt', async () => {
    suche.mockResolvedValue([
      kandidat(48.267, 13.025, 'Simbach am Inn, Bayern, Deutschland', 'DE'),
    ])

    const [treffer] = await loeseOrtAuf('Simbach')

    expect(treffer.name).toBe('Simbach am Inn, Bayern, Deutschland')
  })

  it('mehrere Zeilen desselben Ortes werden zu EINER — der häufige Weg bleibt einstufig', async () => {
    // Was Nominatim für „4910" liefert: Gemeinde, Ortschaft, Katastralgemeinde.
    suche.mockResolvedValue([
      kandidat(48.21, 13.49, '4910 Ried im Innkreis, Österreich', 'AT'),
      kandidat(48.212, 13.492, '4910 Ried im Innkreis, Österreich', 'AT'),
      kandidat(48.213, 13.487, 'Ried im Innkreis, Bezirk Ried im Innkreis, Österreich', 'AT'),
    ])

    const treffer = await loeseOrtAuf('4910')

    expect(treffer).toHaveLength(1)
  })

  it('ohne Treffer kommt eine leere Liste — die Seite lässt dann alles, wie es ist', async () => {
    suche.mockResolvedValue([])
    expect(await loeseOrtAuf('gibtesnicht')).toEqual([])
  })

  it('zu kurze Eingaben und Nicht-Zeichenketten fragen gar nicht erst an', async () => {
    expect(await loeseOrtAuf(' ')).toEqual([])
    expect(await loeseOrtAuf(1234 as never)).toEqual([])
    expect(suche).not.toHaveBeenCalled()
  })

  it('die Längenkappe greift vor der Anfrage — 60 Zeichen, wie bisher', async () => {
    suche.mockResolvedValue([])
    await loeseOrtAuf('x'.repeat(200))

    expect(suche).toHaveBeenCalledWith('x'.repeat(60))
  })
})

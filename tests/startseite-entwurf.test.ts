/**
 * Der Entwurf von Admin › Startseite im Browser (Register N16, Änderung Nr. 99)
 * — useStartseitenEntwurf aus src/components/admin/startseite-entwurf.tsx.
 *
 * Ohne DOM (TESTING_GUIDELINES §1) spielt ein Prüfstand die Hooks von React
 * nach (Vorbild tests/use-cart.test.ts): Zustand je Aufrufstelle, Refs,
 * Rendern nach einer Änderung von außen, Effekte. Die Uhr ist gestellt
 * (vi.useFakeTimers), die Action ist eine Attrappe.
 *
 * Beweist:
 *  - Auge umschalten ändert die Statusleiste auf „1 Änderung“ und speichert
 *    nach 800 ms Ruhe genau einmal — nicht nach 799 ms, nicht zweimal.
 *  - Schnelle Änderungen hintereinander ergeben EINE Speicherung mit dem
 *    letzten Stand; was während einer Speicherung dazukommt, geht danach
 *    hinaus — nie zwei gleichzeitig, der letzte gewinnt.
 *  - Ein neuer Block bekommt nach der ersten Speicherung seine Kennung; die
 *    nächste Speicherung schickt ihn als bestehenden Block.
 *  - Ein ungültiger Block bleibt draußen, die übrigen Änderungen gehen
 *    trotzdem, der Satz des Schemas steht als Fehlerzeile da.
 *  - `speicherungen` (danach lädt die Vorschau neu) zählt bei jeder Art, die
 *    den Entwurf ändert: Pfeil, Auge, Block-Formular, Löschen, Verwerfen —
 *    nicht beim bloßen Öffnen und Schließen, nicht bei einem Fehler (Nr. 106).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pruefstand = vi.hoisted(() => {
  type Setzer<T> = (wert: T | ((vorher: T) => T)) => void
  type Effekt = { deps: readonly unknown[] | undefined; aufraeumen: void | (() => void) }
  let zellen: unknown[] = []
  let faellig: Array<() => void> = []
  let zeiger = 0
  let rendernd = false
  let schmutzig = false
  let komponente: () => unknown = () => null

  function rendere(): void {
    for (let runde = 1; ; runde++) {
      if (runde > 25) throw new Error('Der Prüfstand rendert ohne Ende.')
      schmutzig = false
      faellig = []
      zeiger = 0
      rendernd = true
      try {
        komponente()
      } finally {
        rendernd = false
      }
      if (!schmutzig) break
    }
    const laeufe = faellig
    faellig = []
    for (const lauf of laeufe) lauf()
  }

  function gleich(a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean {
    return a !== undefined && b !== undefined && a.length === b.length && a.every((d, k) => Object.is(d, b[k]))
  }

  return {
    starte(neu: () => unknown): void {
      zellen = []
      komponente = neu
      rendere()
    },
    /** Eine Änderung von außen rendert hier sofort danach (der Test ruft es nach jeder Handlung). */
    rendere,
    useState<T>(anfang: T | (() => T)): [T, Setzer<T>] {
      const i = zeiger++
      if (!(i in zellen)) {
        const neu: { wert: T; setze: Setzer<T> } = {
          wert: typeof anfang === 'function' ? (anfang as () => T)() : anfang,
          setze: (wert) => {
            neu.wert = typeof wert === 'function' ? (wert as (vorher: T) => T)(neu.wert) : wert
            if (rendernd) schmutzig = true
          },
        }
        zellen[i] = neu
      }
      const zelle = zellen[i] as { wert: T; setze: Setzer<T> }
      return [zelle.wert, zelle.setze]
    },
    useRef<T>(anfang: T): { current: T } {
      const i = zeiger++
      if (!(i in zellen)) zellen[i] = { current: anfang }
      return zellen[i] as { current: T }
    },
    useEffect(wirkung: () => void | (() => void), deps?: readonly unknown[]): void {
      const i = zeiger++
      const alt = zellen[i] as Effekt | undefined
      if (alt && gleich(alt.deps, deps)) return
      faellig.push(() => {
        if (typeof alt?.aufraeumen === 'function') alt.aufraeumen()
        zellen[i] = { deps, aufraeumen: wirkung() }
      })
    },
  }
})

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: pruefstand.useState,
  useRef: pruefstand.useRef,
  useEffect: pruefstand.useEffect,
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))

import { NEUER_ABSCHNITT, STANDARD_REIHENFOLGE, verschiebe } from '@/lib/startseite-gestalten'
import { aenderungenText, standardFassung } from '@/lib/startseite-fassung'
import type { StartseiteSpeichernEingabe } from '@/schemas/startseite'
import { neueBlockWerte, useStartseitenEntwurf, type Zeile } from '@/components/admin/startseite-entwurf'

const JETZT = new Date('2026-10-15T18:30:00.000Z')
const ZEILEN: Zeile[] = STANDARD_REIHENFOLGE.map((art) => ({ id: `z-${art.toLowerCase()}`, art, sichtbar: true, block: null }))

type Ergebnis = ReturnType<typeof useStartseitenEntwurf>
type Antwort = Awaited<ReturnType<Parameters<typeof useStartseitenEntwurf>[0]['speichere']>>

let zuletzt: Ergebnis
const speichere = vi.fn<(eingabe: StartseiteSpeichernEingabe) => Promise<Antwort>>()

function gespeichert(teil: Partial<Extract<Antwort, { ok: true }>> = {}): Antwort {
  return { ok: true, blockId: null, zeilenId: null, neueAbschnitte: {}, gespeichertAm: '2026-10-15T18:41:00.000Z', ...teil }
}

/** Eine Handlung von außen, danach rendern wie React. */
function tue(handlung: (e: Ergebnis) => void): void {
  handlung(zuletzt)
  pruefstand.rendere()
}

async function warte(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
  pruefstand.rendere()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(JETZT)
  speichere.mockReset()
  speichere.mockResolvedValue(gespeichert())
  pruefstand.starte(() => {
    zuletzt = useStartseitenEntwurf({ start: ZEILEN, live: standardFassung(), speichere })
  })
})

afterEach(() => {
  vi.useRealTimers()
})

function augeAn(art: string, e: Ergebnis): Zeile[] {
  return e.zeilen.map((z) => (z.art === art ? { ...z, sichtbar: !z.sichtbar } : z))
}

describe('useStartseitenEntwurf', () => {
  it('Auge umschalten: Statusleiste „1 Änderung“, gespeichert nach 800 ms genau einmal', async () => {
    expect(zuletzt.aenderungen).toEqual([])

    tue((e) => e.aendereZeilen(augeAn('FRAGEN', e)))

    expect(aenderungenText(zuletzt.aenderungen.length)).toBe('1 Änderung')
    expect(zuletzt.aenderungen[0]).toMatchObject({ art: 'ausgeblendet', titel: 'Fragen' })
    expect(zuletzt.stand).toEqual({ art: 'speichert' })

    await warte(799)
    expect(speichere).not.toHaveBeenCalled()
    await warte(1)
    expect(speichere).toHaveBeenCalledTimes(1)
    expect(speichere.mock.calls[0]?.[0].reihenfolge.find((r) => r.id === 'z-fragen')).toEqual({ id: 'z-fragen', sichtbar: false })
    expect(speichere.mock.calls[0]?.[0].block).toBeNull()

    await warte(5_000)
    expect(speichere).toHaveBeenCalledTimes(1)
    expect(zuletzt.stand).toEqual({ art: 'gespeichert', um: '20:41' })
  })

  it('speichert schnelle Änderungen als EINE Speicherung mit dem letzten Stand', async () => {
    tue((e) => e.aendereZeilen(augeAn('FRAGEN', e)))
    await warte(500)
    tue((e) => e.aendereZeilen(augeAn('FUTTER', e)))
    await warte(500)
    expect(speichere).not.toHaveBeenCalled()
    await warte(300)
    expect(speichere).toHaveBeenCalledTimes(1)
    const reihenfolge = speichere.mock.calls[0]?.[0].reihenfolge ?? []
    expect(reihenfolge.filter((r) => !r.sichtbar).map((r) => r.id)).toEqual(['z-futter', 'z-fragen'])
  })

  it('schickt nie zwei gleichzeitig — was während einer Speicherung dazukommt, geht danach mit dem neuesten Stand', async () => {
    let fertig: (a: Antwort) => void = () => {}
    speichere.mockImplementationOnce(() => new Promise<Antwort>((r) => (fertig = r)))

    tue((e) => e.aendereZeilen(augeAn('FRAGEN', e)))
    await warte(800)
    expect(speichere).toHaveBeenCalledTimes(1)

    tue((e) => e.aendereZeilen(augeAn('FUTTER', e)))
    await warte(800)
    tue((e) => e.aendereZeilen(augeAn('BRENNMATERIAL', e)))
    await warte(800)
    // Die erste läuft noch: keine zweite daneben.
    expect(speichere).toHaveBeenCalledTimes(1)

    fertig(gespeichert())
    await warte(0)
    expect(speichere).toHaveBeenCalledTimes(2)
    const zweite = speichere.mock.calls[1]?.[0].reihenfolge ?? []
    expect(zweite.filter((r) => !r.sichtbar).map((r) => r.id)).toEqual(['z-futter', 'z-brennmaterial', 'z-fragen'])
    await warte(5_000)
    expect(speichere).toHaveBeenCalledTimes(2)
  })

  it('„Neu bei den Höfen“ hinzufügen (Nr. 129): geht mit der nächsten Speicherung hinaus und trägt danach die Kennung seiner Zeile', async () => {
    speichere.mockResolvedValueOnce(gespeichert({ neueAbschnitte: { [NEUER_ABSCHNITT.NEUIGKEITEN]: 'zeile-neuigkeiten' } }))
    const neu: Zeile = { id: NEUER_ABSCHNITT.NEUIGKEITEN, art: 'NEUIGKEITEN', sichtbar: true, block: null }
    tue((e) => e.aendereZeilen([e.zeilen[0], e.zeilen[1], neu, ...e.zeilen.slice(2)]))
    expect(zuletzt.aenderungen[0]).toMatchObject({ art: 'neu', titel: 'Neu bei den Höfen' })

    await warte(800)
    expect(speichere.mock.calls[0]?.[0].reihenfolge.map((r) => r.id)).toContain(NEUER_ABSCHNITT.NEUIGKEITEN)
    expect(zuletzt.zeilen[2]).toMatchObject({ id: 'zeile-neuigkeiten', art: 'NEUIGKEITEN' })

    // Die nächste Speicherung nennt die Zeile mit ihrer Kennung — der Server legte sonst keine zweite an, sondern wiese ab.
    tue((e) => e.aendereZeilen(augeAn('NEUIGKEITEN', e)))
    await warte(800)
    const zweite = speichere.mock.calls[1]?.[0].reihenfolge ?? []
    expect(zweite.map((r) => r.id)).not.toContain(NEUER_ABSCHNITT.NEUIGKEITEN)
    expect(zweite.find((r) => r.id === 'zeile-neuigkeiten')).toEqual({ id: 'zeile-neuigkeiten', sichtbar: false })
  })

  it('gibt einem neuen Block nach der ersten Speicherung seine Kennung', async () => {
    speichere.mockResolvedValueOnce(gespeichert({ blockId: 'block-neu', zeilenId: 'zeile-neu' }))
    const neu: Zeile = { id: 'neu', art: 'BLOCK', sichtbar: true, block: null }
    tue((e) => e.oeffneBlock(neueBlockWerte('HINWEISBAND', JETZT), [e.zeilen[0], e.zeilen[1], neu, ...e.zeilen.slice(2)]))
    expect(speichere).not.toHaveBeenCalled()

    tue((e) => e.block && e.aendereBlock({ ...e.block, titel: 'Winterpause' }))
    await warte(800)
    expect(speichere.mock.calls[0]?.[0]).toMatchObject({ block: { vorlage: 'HINWEISBAND', titel: 'Winterpause' } })
    expect(speichere.mock.calls[0]?.[0].block).not.toHaveProperty('id')
    expect(zuletzt.zeilen[2].id).toBe('zeile-neu')
    expect(zuletzt.block).toMatchObject({ id: 'block-neu', zeilenId: 'zeile-neu' })

    tue((e) => e.block && e.aendereBlock({ ...e.block, titel: 'Winterpause bis März' }))
    await warte(800)
    expect(speichere.mock.calls[1]?.[0]).toMatchObject({ block: { id: 'block-neu', titel: 'Winterpause bis März' } })
    expect(speichere.mock.calls[1]?.[0].reihenfolge.map((r) => r.id)).toContain('zeile-neu')
  })

  it('lässt einen ungültigen Block draußen, speichert den Rest und zeigt den Satz', async () => {
    const neu: Zeile = { id: 'neu', art: 'BLOCK', sichtbar: true, block: null }
    tue((e) => e.oeffneBlock(neueBlockWerte('SAISONKARTE', JETZT), [e.zeilen[0], e.zeilen[1], neu, ...e.zeilen.slice(2)]))
    tue((e) => e.aendereZeilen(augeAn('FRAGEN', e)))
    await warte(800)
    expect(speichere).toHaveBeenCalledTimes(1)
    const eingabe = speichere.mock.calls[0]?.[0]
    expect(eingabe?.block).toBeNull()
    expect(eingabe?.reihenfolge.map((r) => r.id)).not.toContain('neu')
    expect(zuletzt.stand).toEqual({ art: 'fehler', text: 'Bitte gib einen Titel ein.' })
  })
})

describe('useStartseitenEntwurf — nach „Fertig“ (Nr. 106)', () => {
  it('behält den Stand des Blocks in der Liste und zählt ihn weiter als Änderung', async () => {
    speichere.mockResolvedValueOnce(gespeichert({ blockId: 'block-neu', zeilenId: 'zeile-neu' }))
    const neu: Zeile = { id: 'neu', art: 'BLOCK', sichtbar: true, block: null }
    tue((e) => e.oeffneBlock(neueBlockWerte('HINWEISBAND', JETZT), [e.zeilen[0], e.zeilen[1], neu, ...e.zeilen.slice(2)]))
    tue((e) => e.block && e.aendereBlock({ ...e.block, titel: 'Winterpause' }))
    await warte(800)

    tue((e) => e.oeffneBlock(null))

    expect(zuletzt.block).toBeNull()
    expect(zuletzt.zeilen[2]).toMatchObject({ id: 'zeile-neu', block: { id: 'block-neu', titel: 'Winterpause' } })
    expect(zuletzt.aenderungen.map((a) => a.art)).toEqual(['neu'])
  })
})

describe('useStartseitenEntwurf — ein neuer Block, der nie gespeichert wurde', () => {
  it('lässt beim Schließen keine leere Zeile stehen — die nächste Speicherung geht durch', async () => {
    const neu: Zeile = { id: 'neu', art: 'BLOCK', sichtbar: true, block: null }
    tue((e) => e.oeffneBlock(neueBlockWerte('SAISONKARTE', JETZT), [e.zeilen[0], e.zeilen[1], neu, ...e.zeilen.slice(2)]))
    tue((e) => e.oeffneBlock(null))
    expect(zuletzt.zeilen.map((z) => z.id)).not.toContain('neu')

    tue((e) => e.aendereZeilen(augeAn('FRAGEN', e)))
    await warte(800)
    expect(speichere.mock.calls[0]?.[0].reihenfolge.map((r) => r.id)).toEqual(ZEILEN.map((z) => z.id))
  })
})

describe('useStartseitenEntwurf — die Vorschau lädt nach jeder Art von Änderung neu (Register N16, Nr. 106)', () => {
  it('zählt Pfeil, Auge, Block-Formular, Löschen und Verwerfen — Öffnen, Schließen und ein Fehler zählen nicht', async () => {
    expect(zuletzt.speicherungen).toBe(0)

    tue((e) => e.aendereZeilen(verschiebe(e.zeilen, e.zeilen.findIndex((z) => z.art === 'FUTTER'), 1)))
    await warte(800)
    expect(zuletzt.speicherungen).toBe(1)

    tue((e) => e.aendereZeilen(augeAn('FRAGEN', e)))
    await warte(800)
    expect(zuletzt.speicherungen).toBe(2)

    speichere.mockResolvedValueOnce(gespeichert({ blockId: 'block-neu', zeilenId: 'zeile-neu' }))
    const neu: Zeile = { id: 'neu', art: 'BLOCK', sichtbar: true, block: null }
    tue((e) => e.oeffneBlock(neueBlockWerte('HINWEISBAND', JETZT), [e.zeilen[0], e.zeilen[1], neu, ...e.zeilen.slice(2)]))
    await warte(800)
    expect(zuletzt.speicherungen).toBe(2)
    tue((e) => e.block && e.aendereBlock({ ...e.block, titel: 'Winterpause' }))
    await warte(800)
    expect(zuletzt.speicherungen).toBe(3)

    speichere.mockResolvedValueOnce({ error: 'Wir konnten den Entwurf nicht speichern.' })
    tue((e) => e.block && e.aendereBlock({ ...e.block, titel: 'Winterpause bis März' }))
    await warte(800)
    expect(zuletzt.stand).toEqual({ art: 'fehler', text: 'Wir konnten den Entwurf nicht speichern.' })
    expect(zuletzt.speicherungen).toBe(3)

    tue((e) => e.blockGeloescht('block-neu'))
    expect(zuletzt.block).toBeNull()
    expect(zuletzt.zeilen.map((z) => z.id)).not.toContain('zeile-neu')
    expect(zuletzt.speicherungen).toBe(4)

    tue((e) => e.setzeZurueck(ZEILEN))
    expect(zuletzt.speicherungen).toBe(5)
    expect(speichere).toHaveBeenCalledTimes(4)
  })
})

describe('useStartseitenEntwurf — neue Props → Liste bleibt', () => {
  // Der Entwurf speichert von selbst. Käme eine neue `start`-Liste nach dem ersten Rendern still in den Zustand
  // (etwa nach einem `revalidatePath` auf die eigene Seite), verschwänden Eingaben mitten im Speichern. Die Liste
  // ändert sich nur durch den Menschen und durch die Antwort der Action (neue Kennungen), nie durch Props.
  const ANDERE_ZEILEN: Zeile[] = ZEILEN.map((z) => ({ ...z, sichtbar: !z.sichtbar }))

  /** Rendert mit `ZEILEN`, reicht dann `ANDERE_ZEILEN` als neue Props nach und rendert wie React zweimal (Effekte setzen Zustand). */
  function listeNachNeuenProps(hook: (start: readonly Zeile[]) => Zeile[]): { vorher: Zeile[]; nachher: Zeile[] } {
    let start: readonly Zeile[] = ZEILEN
    let liste: Zeile[] = []
    pruefstand.starte(() => {
      liste = hook(start)
    })
    const vorher = liste
    start = ANDERE_ZEILEN
    pruefstand.rendere()
    pruefstand.rendere()
    return { vorher, nachher: liste }
  }

  it('der Entwurf behält seine Liste, auch wenn die Seite neue Props reicht', () => {
    const { vorher, nachher } = listeNachNeuenProps((start) => {
      zuletzt = useStartseitenEntwurf({ start, live: standardFassung(), speichere })
      return zuletzt.zeilen
    })
    expect(vorher.every((z) => z.sichtbar)).toBe(true)
    expect(nachher).toEqual(vorher)
    expect(nachher).not.toEqual(ANDERE_ZEILEN)
    expect(zuletzt.aenderungen).toEqual([])
    expect(speichere).not.toHaveBeenCalled()
  })

  it('eigene Änderungen überleben neue Props und gehen unverändert hinaus — die neuen Props kommen nie in den Stand', async () => {
    let start: readonly Zeile[] = ZEILEN
    pruefstand.starte(() => {
      zuletzt = useStartseitenEntwurf({ start, live: standardFassung(), speichere })
    })
    tue((e) => e.aendereZeilen(augeAn('FRAGEN', e)))
    start = ANDERE_ZEILEN
    pruefstand.rendere()
    pruefstand.rendere()
    expect(zuletzt.zeilen.find((z) => z.art === 'FRAGEN')?.sichtbar).toBe(false)
    expect(zuletzt.zeilen.find((z) => z.art === 'FUTTER')?.sichtbar).toBe(true)

    await warte(800)
    expect(speichere).toHaveBeenCalledTimes(1)
    const hinaus = speichere.mock.calls[0]?.[0].reihenfolge ?? []
    expect(hinaus.filter((r) => !r.sichtbar).map((r) => r.id)).toEqual(['z-fragen'])
  })

  it('Gegenprobe: ein Hook, der neue Props in den Zustand übernimmt, fällt durch dieselbe Prüfung', async () => {
    // Das Muster, das die Regel verbietet: Zustand aus `start`, nach jeder Änderung von `start` neu gesetzt.
    const { useEffect, useState } = await import('react')
    const { vorher, nachher } = listeNachNeuenProps((start) => {
      const [liste, setListe] = useState<Zeile[]>(() => [...start])
      useEffect(() => setListe([...start]), [start])
      return liste
    })
    expect(vorher.every((z) => z.sichtbar)).toBe(true)
    expect(nachher).toEqual(ANDERE_ZEILEN)
    expect(nachher).not.toEqual(vorher)
  })
})

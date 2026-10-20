/**
 * HofKurzkarte, Art „region" (Register N23, Freigabe §1 Abweichung 7) — das
 * Verhalten ohne DOM (TESTING_GUIDELINES §1, Hook-Prüfstand): `useRef` und
 * `useEffect` per vi.mock('react') ersetzt, die Komponente läuft als Funktion,
 * ihre Griffe (onKeyDown, onClick) werden direkt aufgerufen.
 *
 * Beweist:
 *  - Beim Öffnen geht der Fokus auf die Karte (ohne zu scrollen).
 *  - Escape und „Schließen" schließen (onSchliessen) und geben den Fokus an den
 *    Pin zurück, der die Karte geöffnet hat — bzw. an den neu gezeichneten Pin
 *    aus `findePin`; ein Pin, der nicht mehr im Dokument steht, bekommt nichts.
 *  - Escape geht nicht weiter an die Karte von /hoefe (stopPropagation); andere
 *    Tasten schließen nicht.
 *  - Der Effekt beim Öffnen hängt am Hof: Zeigt dieselbe Karte nach einem zweiten
 *    Pin einen anderen Hof, läuft er erneut (Fokus auf die Karte, „Schließen" geht
 *    an den neuen Pin); mit demselben Hof springt nichts, und steht der Fokus schon
 *    in der Karte (Strict Mode), bleibt der öffnende Pin gemerkt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactElement, ReactNode } from 'react'

const pruefstand = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  index: 0,
  effektAbhaengig: [] as Array<readonly unknown[] | undefined>,
  effektIndex: 0,
}))
vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return {
    ...echt,
    // Je Aufrufstelle ein fester Ref (die Reihenfolge der Hooks bleibt gleich); ein vorbelegter gilt.
    useRef: (start: unknown) => {
      const ref = (pruefstand.refs[pruefstand.index] ??= { current: start })
      pruefstand.index += 1
      return ref
    },
    // Effekte laufen sofort — wie bei React aber nur beim ersten Rendern und wenn sich
    // eine Abhängigkeit gegenüber dem vorigen Rendern geändert hat.
    useEffect: (wirkung: () => void, abhaengig?: readonly unknown[]) => {
      const i = pruefstand.effektIndex
      pruefstand.effektIndex += 1
      const vorher = pruefstand.effektAbhaengig[i]
      const geaendert = vorher === undefined || abhaengig === undefined || abhaengig.some((wert, k) => !Object.is(wert, vorher[k]))
      pruefstand.effektAbhaengig[i] = abhaengig
      if (geaendert) wirkung()
    },
  }
})
vi.mock('next/link', () => ({ default: () => null }))
vi.mock('next/image', () => ({ default: () => null }))

import { HofKurzkarte, type HofKurzkarteProps, type KurzkartenHof } from '@/components/hoefe/hof-kurzkarte'

class Element_ {
  focus = vi.fn()
  isConnected = true
  // Nur das Element selbst liegt „in" ihm — für die Karte reicht das.
  contains = (anderes: unknown) => anderes === this
}

const HOF: KurzkartenHof = {
  slug: 'testhof-a', name: 'Testhof A', postalCode: '1010', city: 'Wien', isPaused: false,
  kategorien: ['EIER'], abholfenster: [], angebot: [], fotos: [], entfernungKm: 6.2,
}

type Knoten = ReactElement<{ children?: ReactNode; type?: string; onClick?: () => void; onKeyDown?: (e: unknown) => void; role?: string; 'aria-label'?: string }>

/** Öffnet die Karte (Rendern als Funktion) — mit vorbelegtem Ref der Karte und dem Pin als aktivem Element. */
function oeffne(props: Partial<Extract<HofKurzkarteProps, { art: 'region' }>> = {}) {
  const karte = new Element_()
  const pin = new Element_()
  vi.stubGlobal('HTMLElement', Element_)
  vi.stubGlobal('document', { activeElement: pin })
  pruefstand.refs = [{ current: karte }]
  pruefstand.index = 0
  pruefstand.effektAbhaengig = []
  pruefstand.effektIndex = 0
  const onSchliessen = vi.fn()
  const aussen = HofKurzkarte({ art: 'region', hof: HOF, bereich: 'LEBENSMITTEL', id: 'karte-1', onSchliessen, children: null, ...props }) as Knoten
  // HofKurzkarte gibt an den Bereich ab — dessen Funktion läuft hier mit dem Prüfstand.
  const bereich = (aussen.type as unknown as (p: unknown) => Knoten)(aussen.props)
  return { karte, pin, onSchliessen, bereich }
}

/** Zeichnet dieselbe Karte neu (Refs und Effekte bleiben), mit `aktiv` als fokussiertem Element. */
function zeichneNeu(hof: KurzkartenHof, aktiv: unknown, onSchliessen: () => void) {
  vi.stubGlobal('document', { activeElement: aktiv })
  pruefstand.index = 0
  pruefstand.effektIndex = 0
  const aussen = HofKurzkarte({ art: 'region', hof, bereich: 'LEBENSMITTEL', id: 'karte-1', onSchliessen, children: null }) as Knoten
  return (aussen.type as unknown as (p: unknown) => Knoten)(aussen.props)
}

/** Der erste Knoten im Baum, der die Bedingung erfüllt. */
function finde(knoten: unknown, passt: (k: Knoten) => boolean): Knoten | null {
  if (knoten == null || typeof knoten !== 'object') return null
  if (Array.isArray(knoten)) {
    for (const kind of knoten) {
      const fund = finde(kind, passt)
      if (fund) return fund
    }
    return null
  }
  const k = knoten as Knoten
  if (!k.props) return null
  if (passt(k)) return k
  return finde(k.props.children, passt)
}

const taste = (key: string) => ({ key, preventDefault: vi.fn(), stopPropagation: vi.fn() })

describe('HofKurzkarte, Art „region" — Fokus und Schließen', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('beim Öffnen geht der Fokus auf die Karte, ein Bereich „Hof <Name>"', () => {
    const { karte, bereich } = oeffne()
    expect(karte.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(bereich.props.role).toBe('region')
    expect(bereich.props['aria-label']).toBe('Hof Testhof A')
  })

  it('Escape schließt, gibt den Fokus an den Pin zurück und läuft nicht weiter an die Karte', () => {
    const { pin, onSchliessen, bereich } = oeffne()
    const e = taste('Escape')
    bereich.props.onKeyDown?.(e)
    expect(onSchliessen).toHaveBeenCalledTimes(1)
    expect(pin.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(e.stopPropagation).toHaveBeenCalled()
  })

  it('andere Tasten schließen nicht (Gegenprobe zu Escape)', () => {
    const { pin, onSchliessen, bereich } = oeffne()
    bereich.props.onKeyDown?.(taste('Enter'))
    expect(onSchliessen).not.toHaveBeenCalled()
    expect(pin.focus).not.toHaveBeenCalled()
  })

  it('„Schließen" schließt und gibt den Fokus an den Pin zurück', () => {
    const { pin, onSchliessen, bereich } = oeffne()
    const knopf = finde(bereich, (k) => k.type === 'button')
    expect(knopf).not.toBeNull()
    knopf?.props.onClick?.()
    expect(onSchliessen).toHaveBeenCalledTimes(1)
    expect(pin.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('hat die Karte den Pin neu gezeichnet, geht der Fokus an den aus findePin', () => {
    const neu = new Element_()
    const { pin, bereich } = oeffne({ findePin: () => neu as unknown as HTMLElement })
    bereich.props.onKeyDown?.(taste('Escape'))
    expect(neu.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(pin.focus).not.toHaveBeenCalled()
  })

  it('ein zweiter Pin mit anderem Hof holt den Fokus erneut, „Schließen" geht an diesen Pin', () => {
    const { karte, pin, onSchliessen } = oeffne()
    const pinB = new Element_()
    const bereichB = zeichneNeu({ ...HOF, slug: 'testhof-b', name: 'Testhof B' }, pinB, onSchliessen)
    expect(karte.focus).toHaveBeenCalledTimes(2)
    bereichB.props.onKeyDown?.(taste('Escape'))
    expect(pinB.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(pin.focus).not.toHaveBeenCalled()
  })

  it('neu gezeichnet mit demselben Hof: kein zweiter Sprung auf die Karte', () => {
    const { karte, onSchliessen } = oeffne()
    zeichneNeu({ ...HOF }, karte, onSchliessen)
    expect(karte.focus).toHaveBeenCalledTimes(1)
  })

  it('läuft der Effekt mit dem Fokus schon in der Karte (Strict Mode), bleibt der öffnende Pin gemerkt', () => {
    const { karte, pin, onSchliessen } = oeffne()
    // Strict Mode hängt ein und gleich wieder ein: Der Effekt läuft ein zweites Mal, der Fokus steht dann in der Karte.
    pruefstand.effektAbhaengig = []
    const bereich = zeichneNeu(HOF, karte, onSchliessen)
    bereich.props.onKeyDown?.(taste('Escape'))
    expect(pin.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(karte.focus).toHaveBeenCalledTimes(2)
  })

  it('ein Pin, der nicht mehr im Dokument steht, bekommt keinen Fokus — geschlossen wird trotzdem', () => {
    const { pin, onSchliessen, bereich } = oeffne()
    pin.isConnected = false
    bereich.props.onKeyDown?.(taste('Escape'))
    expect(onSchliessen).toHaveBeenCalledTimes(1)
    expect(pin.focus).not.toHaveBeenCalled()
  })
})

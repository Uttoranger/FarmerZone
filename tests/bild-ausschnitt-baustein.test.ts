/**
 * Der Bild-Baustein (components/shared/bild-ausschnitt.tsx, Register N17,
 * Nachtlauf Nr. 97) — bedient wie im Browser, ohne DOM.
 *
 * Beweist:
 *  - Sechs Filterkacheln mit aria-pressed, genau die gewählte gedrückt; ein
 *    Tipp wählt um. Ohne Filter (Logo) gibt es keine Kacheln.
 *  - Pfeiltasten auf dem Rahmen verschieben den Ausschnitt um 2 %, mit Umschalt
 *    um 10 %; andere Tasten tun nichts (WCAG 2.1.1).
 *  - „Speichern“ schickt den Wert, den der Rahmen zeigt — samt Filter, Zoom und
 *    Wahl füllen/ganz; „Zurücksetzen“ stellt Mitte, 100 %, Natürlich.
 *  - Nur die Rahmen fangen Zeiger (touch-action: none) — die Bühne drumherum nicht.
 *
 * Prüfstand (TESTING_GUIDELINES §1, „Einen Hook samt Effekten prüfen“, Vorbild
 * tests/use-cart.test.ts): useState hat eine Zelle je Aufrufstelle, useRef und
 * useId ebenso; die Komponente läuft als Funktion, ihre Kinder ohne Hooks
 * werden ausgerollt. Next-Bild und Segment sind schlichte Ersatzteile.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactElement } from 'react'

const buehne = vi.hoisted(() => {
  type Setzer<T> = (wert: T | ((vorher: T) => T)) => void
  let zellen: unknown[] = []
  let zeiger = 0
  return {
    leere(): void {
      zellen = []
      zeiger = 0
    },
    beginneRender(): void {
      zeiger = 0
    },
    useState<T>(anfang: T | (() => T)): [T, Setzer<T>] {
      const i = zeiger++
      if (!(i in zellen)) {
        const neu: { wert: T; setze: Setzer<T> } = {
          wert: typeof anfang === 'function' ? (anfang as () => T)() : anfang,
          setze: (wert) => {
            neu.wert = typeof wert === 'function' ? (wert as (vorher: T) => T)(neu.wert) : wert
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
    useId(): string {
      zeiger++
      return 'zoom-id'
    },
  }
})

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: buehne.useState,
  useRef: buehne.useRef,
  useId: buehne.useId,
}))

vi.mock('next/image', () => ({
  default: (p: Record<string, unknown>) => createElement('img', { src: p.src, style: p.style, className: p.className }),
}))

// Das Segment hält eigenen Zustand — hier nur ein Platzhalter, dessen Wahl der Test selbst auslöst.
const SEGMENT = vi.hoisted(() => ({ typ: 'segment-ersatz' }))
vi.mock('@/components/ui/segment', () => ({
  Segment: (p: Record<string, unknown>) => ({ type: SEGMENT.typ, props: p, key: null }),
}))

import { BildAusschnitt } from '@/components/shared/bild-ausschnitt'
import type { BildAusschnitt as BildAusschnittWert } from '@/schemas/bild-ausschnitt'

type Knoten = { type: unknown; props: Record<string, unknown> }

/** Rollt Funktions-Komponenten aus (ihre Kinder haben keine Hooks) und lässt Symbole von lucide stehen. */
function entfalte(knoten: unknown): unknown {
  if (Array.isArray(knoten)) return knoten.map(entfalte)
  if (knoten === null || typeof knoten !== 'object' || !('props' in knoten)) return knoten
  const element = knoten as Knoten
  if (typeof element.type === 'function') return entfalte((element.type as (p: unknown) => unknown)(element.props))
  return { type: element.type, props: { ...element.props, children: entfalte(element.props.children) } }
}

function alle(knoten: unknown, passt: (k: Knoten) => boolean, funde: Knoten[] = []): Knoten[] {
  if (Array.isArray(knoten)) {
    for (const kind of knoten) alle(kind, passt, funde)
    return funde
  }
  if (knoten === null || typeof knoten !== 'object' || !('props' in knoten)) return funde
  const element = knoten as Knoten
  if (passt(element)) funde.push(element)
  return alle(element.props.children, passt, funde)
}

function text(knoten: unknown): string {
  if (Array.isArray(knoten)) return knoten.map(text).join('')
  if (typeof knoten === 'string' || typeof knoten === 'number') return String(knoten)
  if (knoten === null || typeof knoten !== 'object' || !('props' in knoten)) return ''
  return text((knoten as Knoten).props.children)
}

const ANFANG: BildAusschnittWert = { fokusX: 50, fokusY: 50, zoom: 100, filter: 'NATUERLICH' }

let onSpeichern = vi.fn()

function zeige(eigenschaften: Partial<Parameters<typeof BildAusschnitt>[0]> = {}): unknown {
  buehne.beginneRender()
  const element = BildAusschnitt({
    foto: '/foto.jpg',
    wert: ANFANG,
    rahmen: { name: 'Computer', verhaeltnis: 3.6 },
    onSpeichern,
    onAbbrechen: () => {},
    ...eigenschaften,
  }) as ReactElement
  return entfalte(element)
}

const filterKnoepfe = (baum: unknown) => alle(baum, (k) => k.type === 'button' && 'aria-pressed' in k.props)
const knopf = (baum: unknown, beschriftung: string) => {
  const fund = alle(baum, (k) => k.type === 'button' && text(k.props.children).trim() === beschriftung)[0]
  if (!fund) throw new Error(`Kein Knopf „${beschriftung}“`)
  return fund
}
const rahmen = (baum: unknown) => {
  const fund = alle(baum, (k) => k.props.role === 'group' && typeof k.props.onKeyDown === 'function')[0]
  if (!fund) throw new Error('Kein Rahmen mit Tastatur')
  return fund
}
const taste = (baum: unknown, key: string, shiftKey = false) => {
  const preventDefault = vi.fn()
  ;(rahmen(baum).props.onKeyDown as (e: unknown) => void)({ key, shiftKey, preventDefault })
  return preventDefault
}
const klick = (k: Knoten) => (k.props.onClick as () => void)()

beforeEach(() => {
  buehne.leere()
  onSpeichern = vi.fn()
})

describe('Filterkacheln', () => {
  it('sechs Kacheln mit aria-pressed, genau die gewählte gedrückt, in der Reihenfolge des Mockups', () => {
    const knoepfe = filterKnoepfe(zeige())
    expect(knoepfe.map((k) => text(k.props.children))).toEqual(['Natürlich', 'Klar', 'Warm', 'Kräftig', 'Sanft', 'Schwarzweiß'])
    expect(knoepfe.map((k) => k.props['aria-pressed'])).toEqual([true, false, false, false, false, false])
  })

  it('ein Tipp auf „Warm“ wählt um — und jede Kachel zeigt denselben Ausschnitt mit ihrem Filter', () => {
    klick(filterKnoepfe(zeige()).find((k) => text(k.props.children) === 'Warm') as Knoten)
    const nachher = zeige()
    expect(filterKnoepfe(nachher).map((k) => k.props['aria-pressed'])).toEqual([false, false, true, false, false, false])
    const warm = alle(filterKnoepfe(nachher)[2], (k) => k.type === 'img')[0]
    expect(warm.props.style).toMatchObject({ objectPosition: '50% 50%', filter: 'sepia(0.22) saturate(1.2)' })
  })

  it('ohne Filter (Logo) gibt es keine Kacheln', () => {
    expect(filterKnoepfe(zeige({ mitFilter: false }))).toHaveLength(0)
  })
})

describe('Tastatur auf dem Rahmen', () => {
  it('→ verschiebt um 2 %, Umschalt + ↑ um 10 % — und der Rahmen zeigt es sofort', () => {
    expect(taste(zeige(), 'ArrowRight')).toHaveBeenCalled()
    taste(zeige(), 'ArrowUp', true)
    const baum = zeige()
    const bild = alle(rahmen(baum), (k) => k.type === 'img')[0]
    expect(bild.props.style).toMatchObject({ objectPosition: '48% 60%' })
  })

  it('andere Tasten tun nichts und lassen den Browser gewähren (Tab bleibt Tab)', () => {
    const preventDefault = taste(zeige(), 'Tab')
    expect(preventDefault).not.toHaveBeenCalled()
    klick(knopf(zeige(), 'Speichern'))
    expect(onSpeichern).toHaveBeenCalledWith(ANFANG)
  })

  it('der Rahmen ist erreichbar und sagt, was man dort tun kann', () => {
    const r = rahmen(zeige())
    expect(r.props.tabIndex).toBe(0)
    expect(String(r.props['aria-label'])).toContain('Pfeiltasten')
  })
})

describe('Speichern, Zurücksetzen', () => {
  it('„Speichern“ schickt den Wert, den der Rahmen zeigt — Fokus, Zoom, Filter und Wahl', () => {
    taste(zeige(), 'ArrowLeft')
    klick(filterKnoepfe(zeige()).find((k) => text(k.props.children) === 'Kräftig') as Knoten)
    const zoom = alle(zeige(), (k) => k.type === 'input' && k.props.type === 'range')[0]
    ;(zoom.props.onChange as (e: unknown) => void)({ target: { value: '140' } })
    const segment = alle(zeige({ mitDarstellung: true }), (k) => k.type === SEGMENT.typ)[0]
    ;(segment.props.onWertChange as (w: string) => void)('GANZ')

    klick(knopf(zeige({ mitDarstellung: true }), 'Speichern'))

    expect(onSpeichern).toHaveBeenCalledWith({ fokusX: 52, fokusY: 50, zoom: 140, filter: 'KRAEFTIG', darstellung: 'GANZ' })
  })

  it('„Zurücksetzen“ stellt Mitte, 100 % und Natürlich (beim Titelbild ohne Wahl)', () => {
    const start: BildAusschnittWert = { fokusX: 10, fokusY: 90, zoom: 200, filter: 'SANFT', darstellung: 'FUELLEN' }
    klick(knopf(zeige({ wert: start, mitDarstellung: true }), 'Zurücksetzen'))
    klick(knopf(zeige({ wert: start, mitDarstellung: true }), 'Speichern'))
    expect(onSpeichern).toHaveBeenCalledWith({ fokusX: 50, fokusY: 50, zoom: 100, filter: 'NATUERLICH', darstellung: 'AUTO' })
  })

  it('ohne Wahl ist im Umschalter keine Stellung gedrückt (AUTO)', () => {
    const segment = alle(zeige({ mitDarstellung: true }), (k) => k.type === SEGMENT.typ)[0]
    expect(segment.props.wert).toBe('AUTO')
    // Gegenprobe: Ohne mitDarstellung gibt es den Umschalter nicht.
    expect(alle(zeige(), (k) => k.type === SEGMENT.typ)).toHaveLength(0)
  })
})

describe('Zeiger', () => {
  it('nur die Rahmen fangen Zeiger und sperren das Scrollen — Hauptrahmen und Vorschau, nicht die Bühne', () => {
    const baum = zeige({ vorschauen: [{ titel: 'So sieht es am Handy aus', verhaeltnis: 390 / 220, name: 'Handy', breite: 156 }] })
    const fangend = alle(baum, (k) => typeof k.props.onPointerDown === 'function')
    expect(fangend).toHaveLength(2)
    for (const k of fangend) expect(String(k.props.className)).toContain('touch-none')
    const gesperrt = alle(baum, (k) => typeof k.props.className === 'string' && k.props.className.split(' ').includes('touch-none'))
    expect(gesperrt).toHaveLength(2)
  })

  it('wo das Foto ganz steht (Titelbild „Ganz zeigen“), zieht man in der Vorschau nicht', () => {
    const baum = zeige({ vorschauen: [{ titel: 'So sieht es im Browser aus', verhaeltnis: 4, ganz: () => true }] })
    expect(alle(baum, (k) => typeof k.props.onPointerDown === 'function')).toHaveLength(1)
  })
})

// Nachtlauf Nr. 98, Runde 1: was die Mockups system-h1-bild-baustein und
// mobil-h2-produktfoto-ausschnitt für Logo, Produktfoto, Galerie und Beitrag
// verlangen — das Titelbild bleibt, wie es oben geprüft ist.
describe('Zwecke der Nr. 98 — runder Rahmen, Vorschau-Paar, „Passt so“', () => {
  const klassen = (k: Knoten) => String(k.props.className).split(' ')
  const pointerRahmen = (baum: unknown) => alle(baum, (k) => typeof k.props.onPointerDown === 'function')

  it('der Hauptrahmen des Logos ist rund, samt Kontur; ohne `rund` bleibt er eckig (Titelbild)', () => {
    const rund = rahmen(zeige({ rahmen: { name: 'Logo', verhaeltnis: 1, rund: true } }))
    expect(klassen(rund)).toContain('rounded-full')
    const kontur = alle(rund, (k) => k.type === 'span' && klassen(k).includes('ring-2'))[0]
    expect(klassen(kontur)).toContain('rounded-full')
    // Gegenprobe: dieselbe Suche am Rahmen des Titelbilds.
    expect(klassen(rahmen(zeige()))).not.toContain('rounded-full')
  })

  it('ein Vorschau-Paar steht unter EINEM Titel in einer Reihe — gezogen wird in beiden Rahmen', () => {
    const titel = 'So sieht es in der Liste aus'
    const baum = zeige({ vorschauen: [{ titel, verhaeltnis: 1, satz: 'Links am Handy, rechts am Computer.', daneben: [{ verhaeltnis: 260 / 140, breite: 150 }] }] })
    expect(text(baum).split(titel)).toHaveLength(2)
    expect(pointerRahmen(baum)).toHaveLength(3)
    const reihe = alle(baum, (k) => k.props['aria-hidden'] === 'true' && pointerRahmen(k).length === 2)
    expect(reihe).toHaveLength(1)
    // Gegenprobe: ohne Partner steht unter dem Titel ein Rahmen allein.
    expect(pointerRahmen(zeige({ vorschauen: [{ titel, verhaeltnis: 1 }] }))).toHaveLength(2)
  })

  it('nach dem Upload steht „Passt so“ statt „Abbrechen“ und speichert Mitte, 100 %, Natürlich (= null)', () => {
    const baum = zeige({ nachUpload: true })
    expect(() => knopf(baum, 'Abbrechen')).toThrow()
    klick(knopf(baum, 'Passt so'))
    expect(onSpeichern).toHaveBeenCalledWith({ fokusX: 50, fokusY: 50, zoom: 100, filter: 'NATUERLICH' })
  })

  it('wer nach dem Upload etwas ändert, bekommt „Abbrechen“ zurück — „Passt so“ verwürfe sonst die Wahl', () => {
    taste(zeige({ nachUpload: true }), 'ArrowLeft')
    const baum = zeige({ nachUpload: true })
    expect(() => knopf(baum, 'Passt so')).toThrow()
    klick(knopf(baum, 'Speichern'))
    expect(onSpeichern).toHaveBeenCalledWith({ ...ANFANG, fokusX: 52 })
  })

  it('ohne Upload („Ausschnitt anpassen“, Titelbild) gibt es kein „Passt so“', () => {
    const baum = zeige()
    expect(() => knopf(baum, 'Passt so')).toThrow()
    expect(knopf(baum, 'Abbrechen')).toBeTruthy()
  })
})

/**
 * „So sieht’s die Kundin“ lädt nach jedem gespeicherten Entwurf neu (Register
 * N16, Ergänzung Nr. 106) — StartseiteVorschau aus
 * src/components/admin/startseite-vorschau.tsx.
 *
 * Ohne DOM (TESTING_GUIDELINES §1) spielt ein Prüfstand die Hooks nach
 * (Vorbild tests/startseite-entwurf.test.ts), hier zusätzlich mit Aushängen:
 * Beim Entfernen laufen die Aufräum-Funktionen aller Effekte. Die Komponente
 * läuft als Funktion, den Rahmen rendert der Prüfstand nicht — seine Props
 * (Adressen, sichtbare Adresse, Rückruf nach dem Laden) liest der Test aus dem
 * Baum. Die Actions sind Attrappen, die Uhr ist gestellt.
 *
 * Beweist (die drei Prüfpunkte der Freigabe als Wache):
 *  - Jede neue Speicherung (neuLaden) holt eine neue Adresse; seit Nr. 182
 *    (eigene Route /startseite-vorschau, kein Draft Mode) ruft auch das
 *    Aushängen keine weitere Action.
 *  - Während die neue Adresse lädt, bleibt der alte Rahmen sichtbar; ist sie
 *    fertig, scrollt sie an die Stelle des alten (solange der alte noch die
 *    Vorschau-Route zeigt) und erst dann tauschen sie.
 *    Darunter steht „Vorschau aktualisiert · hh:mm“ in Wiener Zeit.
 *  - Ein Laden des sichtbaren Rahmens selbst oder einer überholten Adresse
 *    tauscht nichts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pruefstand = vi.hoisted(() => {
  type Setzer<T> = (wert: T | ((vorher: T) => T)) => void
  type Effekt = { deps: readonly unknown[] | undefined; aufraeumen: void | (() => void) }
  let zellen: unknown[] = []
  let effekte = new Map<number, Effekt>()
  let faellig: Array<() => void> = []
  let zeiger = 0
  let rendernd = false
  let schmutzig = false
  let komponente: () => unknown = () => null
  let baum: unknown = null

  function rendere(): void {
    for (let runde = 1; ; runde++) {
      if (runde > 25) throw new Error('Der Prüfstand rendert ohne Ende.')
      schmutzig = false
      faellig = []
      zeiger = 0
      rendernd = true
      try {
        baum = komponente()
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
      effekte = new Map()
      komponente = neu
      rendere()
    },
    /** Neue Props: die Komponente mit ihnen neu rendern. */
    setzeKomponente(neu: () => unknown): void {
      komponente = neu
      rendere()
    },
    rendere,
    baum: (): unknown => baum,
    /** Aushängen: alle Aufräum-Funktionen, wie React beim Entfernen. */
    entferne(): void {
      for (const effekt of effekte.values()) if (typeof effekt.aufraeumen === 'function') effekt.aufraeumen()
      effekte = new Map()
      // Ausgehängt rendert nichts mehr.
      komponente = () => null
    },
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
      const alt = effekte.get(i)
      if (alt && gleich(alt.deps, deps)) return
      faellig.push(() => {
        if (typeof alt?.aufraeumen === 'function') alt.aufraeumen()
        effekte.set(i, { deps, aufraeumen: wirkung() })
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

const aktionen = vi.hoisted(() => ({ erzeuge: vi.fn(), folge: [] as string[] }))
// Nur diese eine Action gibt es für die Vorschau; jede weitere wäre hier undefined und fiele auf.
vi.mock('@/server/actions/startseite', () => ({
  erzeugeStartseitenVorschau: aktionen.erzeuge,
}))

import { ADMIN_STARTSEITE_TEXT, STARTSEITE_VORSCHAU_HREF } from '@/lib/startseite-gestalten'
import { ENTWURF_TEXT, scrollNachNeuladen } from '@/lib/startseite-fassung'
import { StartseiteVorschau } from '@/components/admin/startseite-vorschau'

/** Freitag, 16. Oktober 2026, 21:04 in Wien. */
const JETZT = new Date('2026-10-16T19:04:00.000Z')

type RahmenProps = {
  rahmen: string[]
  sichtbar: string | null
  laedt: boolean
  titel: string
  band: string
  onGeladen: (pfad: string, neu: HTMLIFrameElement, alt: HTMLIFrameElement | undefined) => void
}

/** Das erste Element im Baum, das eine Prop trägt (der Rahmen ist nicht exportiert). */
function findeMitProp(knoten: unknown, prop: string): Record<string, unknown> | null {
  if (knoten == null || typeof knoten !== 'object') return null
  if (Array.isArray(knoten)) {
    for (const kind of knoten) {
      const fund = findeMitProp(kind, prop)
      if (fund) return fund
    }
    return null
  }
  const props = (knoten as { props?: Record<string, unknown> }).props
  if (!props) return null
  if (prop in props) return props
  return findeMitProp(props.children, prop)
}

/** Das Segment mit dieser Beschriftung (Gerät, Quelle, Stand): sein Rückruf wählt um. */
function findeSegment(knoten: unknown, beschriftung: string): { onWertChange: (wert: string) => void } | null {
  if (knoten == null || typeof knoten !== 'object') return null
  if (Array.isArray(knoten)) {
    for (const kind of knoten) {
      const fund = findeSegment(kind, beschriftung)
      if (fund) return fund
    }
    return null
  }
  const props = (knoten as { props?: Record<string, unknown> }).props
  if (!props) return null
  if (props.beschriftung === beschriftung && typeof props.onWertChange === 'function') return props as { onWertChange: (wert: string) => void }
  return findeSegment(props.children, beschriftung)
}

const rahmen = (): RahmenProps => findeMitProp(pruefstand.baum(), 'onGeladen') as unknown as RahmenProps
const statusZeile = (): unknown => {
  const props = findeMitProp(pruefstand.baum(), 'role')
  return props?.role === 'status' ? props.children : undefined
}

let ausgegeben = 0
function vorschau(neuLaden: number, blockEntwurfId: string | null = null): () => unknown {
  return () => StartseiteVorschau({ blockMoeglich: { entwurf: false, live: false }, termin: null, blockEntwurfId, neuLaden })
}

/** Ein Rahmen für den Rückruf: liest Pfad und Scroll-Lage, merkt sich, wohin gescrollt wurde. */
function fenster(lage: { pfadname: string; scrollY: number } | 'fremd' = { pfadname: STARTSEITE_VORSCHAU_HREF, scrollY: 0 }) {
  const scrollTo = vi.fn()
  const contentWindow = {
    scrollTo,
    get scrollY(): number {
      if (lage === 'fremd') throw new DOMException('Blocked a frame', 'SecurityError')
      return lage.scrollY
    },
    get location(): { pathname: string } {
      if (lage === 'fremd') throw new DOMException('Blocked a frame', 'SecurityError')
      return { pathname: lage.pfadname }
    },
  }
  return { element: { contentWindow } as unknown as HTMLIFrameElement, scrollTo }
}

async function erledigt(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
  pruefstand.rendere()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(JETZT)
  aktionen.folge = []
  ausgegeben = 0
  aktionen.erzeuge.mockReset()
  aktionen.erzeuge.mockImplementation(async () => {
    aktionen.folge.push('erzeuge')
    ausgegeben += 1
    return { ok: true, pfad: `${STARTSEITE_VORSCHAU_HREF}?vorschau=v${ausgegeben}&sig=s`, link: `${STARTSEITE_VORSCHAU_HREF}?vorschau=v${ausgegeben}&sig=s`, stand: 'Fr, 16. Okt 2026' }
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('StartseiteVorschau — neue Adresse je Speicherung', () => {
  it('holt nach jeder Speicherung eine neue Adresse — und ruft beim Aushängen nichts mehr auf', async () => {
    pruefstand.starte(vorschau(0))
    await erledigt()
    expect(rahmen().rahmen).toEqual(['/startseite-vorschau?vorschau=v1&sig=s'])

    // Pfeil, Auge, Block-Formular, Löschen: jede Speicherung zählt neuLaden hoch (tests/startseite-entwurf.test.ts).
    for (const n of [1, 2, 3]) {
      pruefstand.setzeKomponente(vorschau(n))
      await erledigt()
    }
    // Ein Block wird geöffnet bzw. bekommt nach der ersten Speicherung seine Kennung.
    pruefstand.setzeKomponente(vorschau(3, 'block-1'))
    await erledigt()

    expect(aktionen.erzeuge).toHaveBeenCalledTimes(5)
    expect(aktionen.erzeuge.mock.calls[4]?.[0]).toEqual({ stand: 'heute', quelle: 'entwurf', blockEntwurfId: 'block-1' })

    pruefstand.entferne()
    await erledigt()
    expect(aktionen.folge).toEqual(['erzeuge', 'erzeuge', 'erzeuge', 'erzeuge', 'erzeuge'])
  })
})

describe('StartseiteVorschau — der Block in Bearbeitung (Nr. 155)', () => {
  it('bei offenem Block geht blockEntwurfId an die Action, live nie', async () => {
    pruefstand.starte(vorschau(0, 'block-7'))
    await erledigt()
    expect(aktionen.erzeuge).toHaveBeenCalledTimes(1)
    expect(aktionen.erzeuge.mock.calls[0]?.[0]).toEqual({ stand: 'heute', quelle: 'entwurf', blockEntwurfId: 'block-7' })

    // Gegenprobe: Quelle „Live“ zeigt nur, was live ist — die Kennung geht nicht mit.
    findeSegment(pruefstand.baum(), ENTWURF_TEXT.quelleBeschriftung)?.onWertChange('live')
    await erledigt()
    expect(aktionen.erzeuge.mock.calls.at(-1)?.[0]).toEqual({ stand: 'heute', quelle: 'live', blockEntwurfId: null })
  })
})

describe('StartseiteVorschau — neu laden ohne leeren Rahmen, an derselben Stelle', () => {
  it('lässt den alten Rahmen stehen, bis der neue geladen ist, scrollt ihn an dieselbe Stelle und tauscht dann', async () => {
    pruefstand.starte(vorschau(0))
    await erledigt()
    // Erster Rahmen: lädt noch, nichts zu behalten — oben beginnen.
    expect(rahmen()).toMatchObject({ sichtbar: null, laedt: true })
    expect(statusZeile()).toBeFalsy()
    const erster = fenster()
    rahmen().onGeladen('/startseite-vorschau?vorschau=v1&sig=s', erster.element, undefined)
    pruefstand.rendere()
    expect(erster.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
    expect(rahmen()).toMatchObject({ rahmen: ['/startseite-vorschau?vorschau=v1&sig=s'], sichtbar: '/startseite-vorschau?vorschau=v1&sig=s', laedt: false, titel: 'Vorschau der Startseite · Entwurf' })
    expect(statusZeile()).toBe(ADMIN_STARTSEITE_TEXT.vorschauAktualisiert('21:04'))

    // Auge aus, gespeichert: die neue Adresse lädt neben der alten — die alte bleibt sichtbar.
    vi.setSystemTime(new Date('2026-10-16T19:06:00.000Z'))
    pruefstand.setzeKomponente(vorschau(1))
    await erledigt()
    expect(rahmen()).toMatchObject({ rahmen: ['/startseite-vorschau?vorschau=v1&sig=s', '/startseite-vorschau?vorschau=v2&sig=s'], sichtbar: '/startseite-vorschau?vorschau=v1&sig=s', laedt: true })
    expect(statusZeile()).toBe(ADMIN_STARTSEITE_TEXT.vorschauAktualisiert('21:04'))

    // Fertig geladen: dorthin, wo der alte stand (900 px), dann tauschen.
    const zweiter = fenster()
    rahmen().onGeladen('/startseite-vorschau?vorschau=v2&sig=s', zweiter.element, fenster({ pfadname: STARTSEITE_VORSCHAU_HREF, scrollY: 900.4 }).element)
    pruefstand.rendere()
    expect(zweiter.scrollTo).toHaveBeenCalledWith({ top: 900, behavior: 'instant' })
    expect(rahmen()).toMatchObject({ rahmen: ['/startseite-vorschau?vorschau=v2&sig=s'], sichtbar: '/startseite-vorschau?vorschau=v2&sig=s', laedt: false })
    expect(statusZeile()).toBe(ADMIN_STARTSEITE_TEXT.vorschauAktualisiert('21:06'))
  })

  it('beginnt oben, wenn im alten Rahmen eine andere Seite offen ist oder der Browser nicht hineinsehen lässt', async () => {
    pruefstand.starte(vorschau(0))
    await erledigt()
    rahmen().onGeladen('/startseite-vorschau?vorschau=v1&sig=s', fenster().element, undefined)
    pruefstand.rendere()

    pruefstand.setzeKomponente(vorschau(1))
    await erledigt()
    const nachHof = fenster()
    rahmen().onGeladen('/startseite-vorschau?vorschau=v2&sig=s', nachHof.element, fenster({ pfadname: '/hof/testhof-a', scrollY: 600 }).element)
    pruefstand.rendere()
    expect(nachHof.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })

    pruefstand.setzeKomponente(vorschau(2))
    await erledigt()
    const nachFremd = fenster()
    rahmen().onGeladen('/startseite-vorschau?vorschau=v3&sig=s', nachFremd.element, fenster('fremd').element)
    pruefstand.rendere()
    expect(nachFremd.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
    expect(rahmen().sichtbar).toBe('/startseite-vorschau?vorschau=v3&sig=s')
  })

  it('tauscht nichts, wenn der sichtbare Rahmen selbst neu lädt oder eine überholte Adresse fertig wird', async () => {
    pruefstand.starte(vorschau(0))
    await erledigt()
    rahmen().onGeladen('/startseite-vorschau?vorschau=v1&sig=s', fenster().element, undefined)
    pruefstand.rendere()

    // Zwei Speicherungen schnell hintereinander: v3 ersetzt das ladende v2.
    pruefstand.setzeKomponente(vorschau(1))
    await erledigt()
    pruefstand.setzeKomponente(vorschau(2))
    await erledigt()
    expect(rahmen().rahmen).toEqual(['/startseite-vorschau?vorschau=v1&sig=s', '/startseite-vorschau?vorschau=v3&sig=s'])

    const sichtbar = fenster()
    rahmen().onGeladen('/startseite-vorschau?vorschau=v1&sig=s', sichtbar.element, undefined)
    const ueberholt = fenster()
    rahmen().onGeladen('/startseite-vorschau?vorschau=v2&sig=s', ueberholt.element, undefined)
    pruefstand.rendere()

    expect(sichtbar.scrollTo).not.toHaveBeenCalled()
    expect(ueberholt.scrollTo).not.toHaveBeenCalled()
    expect(rahmen()).toMatchObject({ sichtbar: '/startseite-vorschau?vorschau=v1&sig=s', laedt: true })
  })
})

describe('StartseiteVorschau — Titel und Band des Rahmens wechseln mit dem neuen Stand (Nr. 121, Band seit Nr. 127)', () => {
  it('bleiben „Entwurf“, solange der Entwurf noch sichtbar ist, und werden „Live“ erst beim Tausch nach dem Laden', async () => {
    pruefstand.starte(vorschau(0))
    await erledigt()
    rahmen().onGeladen('/startseite-vorschau?vorschau=v1&sig=s', fenster().element, undefined)
    pruefstand.rendere()
    expect(rahmen().titel).toBe(`Vorschau der Startseite · ${ENTWURF_TEXT.entwurf}`)
    expect(rahmen().band).toBe('entwurf')

    // „Live“ gewählt: Die neue Adresse lädt, der Rahmen zeigt noch den Entwurf – und heißt auch so.
    findeSegment(pruefstand.baum(), ENTWURF_TEXT.quelleBeschriftung)?.onWertChange('live')
    pruefstand.rendere()
    await erledigt()
    expect(rahmen()).toMatchObject({ rahmen: ['/startseite-vorschau?vorschau=v1&sig=s', '/startseite-vorschau?vorschau=v2&sig=s'], sichtbar: '/startseite-vorschau?vorschau=v1&sig=s', laedt: true })
    expect(rahmen().titel).toBe(`Vorschau der Startseite · ${ENTWURF_TEXT.entwurf}`)
    // Das Band „Entwurf/Live“ über dem Rahmen sagt dasselbe wie der Titel: Es zeigt noch den Entwurf, also steht dort „Entwurf“.
    expect(rahmen().band).toBe('entwurf')
    expect(aktionen.erzeuge.mock.calls.at(-1)?.[0]).toMatchObject({ quelle: 'live' })

    // Fertig geladen und getauscht: jetzt steht der Rahmen für Live.
    rahmen().onGeladen('/startseite-vorschau?vorschau=v2&sig=s', fenster().element, fenster().element)
    pruefstand.rendere()
    expect(rahmen()).toMatchObject({ sichtbar: '/startseite-vorschau?vorschau=v2&sig=s', titel: `Vorschau der Startseite · ${ENTWURF_TEXT.live}`, band: 'live' })
  })
})

describe('scrollNachNeuladen — nur solange der alte Rahmen die Vorschau-Route zeigt (Nr. 182)', () => {
  it('behält die Lage auf /startseite-vorschau, beginnt sonst oben — auch auf der Startseite selbst', () => {
    expect(scrollNachNeuladen({ pfadname: STARTSEITE_VORSCHAU_HREF, scrollY: 412.6 })).toBe(413)
    // Gegenprobe: Die Startseite „/" ist nicht mehr die Vorschau — wer im Rahmen dorthin geklickt hat, beginnt oben.
    expect(scrollNachNeuladen({ pfadname: '/', scrollY: 412 })).toBe(0)
    expect(scrollNachNeuladen({ pfadname: '/hoefe', scrollY: 412 })).toBe(0)
    expect(scrollNachNeuladen(null)).toBe(0)
  })
})

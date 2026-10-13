/**
 * Der Bezugspunkt der Umkreissuche auf /hoefe (useOrtssuche, Nr. 84): Standort
 * mit Genauigkeit, Ortssuche und das Auflösen des Suchtexts beim Ankommen.
 *
 * Ohne DOM (TESTING_GUIDELINES §1) spielt ein kleiner Prüfstand die Hooks von
 * React nach, so weit es hier zählt: Zustand je Aufrufstelle, neues Rendern
 * nach einer Änderung von außen (danach, nicht mitten im Aufruf), Effekte nach
 * dem Rendern. Die Browser-Ortung ist eine Attrappe, deren Rückrufe der Test
 * selbst auslöst; die Ortsauflösung (`loeseOrtAuf`) ist gemockt, ihre Antworten
 * hält der Test in der Hand. Zeitgeber sind falsch (vi.useFakeTimers).
 *
 * Gegenprobe zur Grenze „der Standort bleibt im Browser": In keinem Standort-
 * Fall wird `loeseOrtAuf` gerufen — es gibt keinen Weg, auf dem eine gemessene
 * Position an den Server ginge.
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
  let geplant = false
  let komponente: () => unknown = () => null

  function geaendert(): void {
    schmutzig = true
    if (rendernd || geplant) return
    // Wie React: Eine Änderung von außen rendert danach, nicht mitten im Aufruf.
    geplant = true
    setTimeout(() => {
      geplant = false
      rendere()
    }, 0)
  }

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
      geplant = false
      komponente = neu
      rendere()
    },
    /** Rendert neu, ohne dass sich etwas geändert hat — wie ein Elternteil, der neu rendert. */
    erneut(): void {
      rendere()
    },
    useState<T>(anfang: T | (() => T)): [T, Setzer<T>] {
      const i = zeiger++
      if (!(i in zellen)) {
        const neu: { wert: T; setze: Setzer<T> } = {
          wert: typeof anfang === 'function' ? (anfang as () => T)() : anfang,
          setze: (wert) => {
            neu.wert = typeof wert === 'function' ? (wert as (vorher: T) => T)(neu.wert) : wert
            geaendert()
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
    useTransition(): [boolean, (rueckruf: () => void) => void] {
      return [false, (rueckruf) => rueckruf()]
    },
  }
})

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: pruefstand.useState,
  useRef: pruefstand.useRef,
  useEffect: pruefstand.useEffect,
  useTransition: pruefstand.useTransition,
}))

const { loeseOrtAuf } = vi.hoisted(() => ({ loeseOrtAuf: vi.fn() }))
vi.mock('@/server/actions/hoefe', () => ({ loeseOrtAuf }))

import { useOrtssuche, type Ortssuche } from '@/components/hoefe/use-ortssuche'
import { SUCHFELD_TEXT } from '@/lib/hoefe-entdecken'
import type { Bezugspunkt } from '@/lib/hofuebersicht'

type Rueckruf = (position: { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number }) => void
type Fehlerrueckruf = (fehler: { code: number; message: string }) => void
type Ortung = [Rueckruf, Fehlerrueckruf, { enableHighAccuracy?: boolean; timeout?: number } | undefined]

const getCurrentPosition = vi.fn<(...argumente: Ortung) => void>()

const position = (accuracy: number, latitude = 48.1, longitude = 13.15) => ({
  coords: { latitude, longitude, accuracy },
  timestamp: 0,
})

/** Das Gerät antwortet, wenn der Test es will: der n-te Ortungs-Aufruf. */
const ortung = (n: number): Ortung => {
  const aufruf = getCurrentPosition.mock.calls[n]
  if (!aufruf) throw new Error(`Es gab keinen ${n + 1}. Ortungs-Aufruf.`)
  return aufruf
}

/** Was der Hook zuletzt geliefert hat — aus dem letzten Rendern. */
let hook: Ortssuche
let beiStandort: ReturnType<typeof vi.fn<(punkt: Bezugspunkt) => void>>
let beiOrt: ReturnType<typeof vi.fn<(punkt: Bezugspunkt) => void>>
let beiZumFeld: ReturnType<typeof vi.fn<() => void>>
let beiAnkunftErledigt: ReturnType<typeof vi.fn<() => void>>

function starte(ankunftsText = '') {
  pruefstand.starte(() => {
    hook = useOrtssuche({
      onStandort: beiStandort,
      onOrt: beiOrt,
      onZumFeld: beiZumFeld,
      ankunftsText,
      onAnkunftErledigt: beiAnkunftErledigt,
    })
  })
}

/**
 * Lässt Antworten und das neue Rendern ablaufen. Die Zeitgeber sind falsch: Ein Zeitgeber, der
 * während eines Ablaufs entsteht (das neue Rendern nach einem Zustand), läuft erst eine
 * Millisekunde später — ein paar Millisekunden decken auch eine Kette davon ab, die zehn
 * Sekunden des Wächters rühren sie nicht an.
 */
const zuRuhe = () => vi.advanceTimersByTimeAsync(5)

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  beiStandort = vi.fn<(punkt: Bezugspunkt) => void>()
  beiOrt = vi.fn<(punkt: Bezugspunkt) => void>()
  beiZumFeld = vi.fn<() => void>()
  beiAnkunftErledigt = vi.fn<() => void>()
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Standort — die Genauigkeit entscheidet, ob er ohne Rückfrage gilt', () => {
  it('bis 2 000 m wie bisher: sofort übernommen, ohne Hinweis', async () => {
    starte()
    hook.standortErfragen()
    const [ok, , optionen] = ortung(0)
    expect(optionen).toEqual({ enableHighAccuracy: false, timeout: 8_000 })

    ok(position(2_000))
    await zuRuhe()

    expect(beiStandort).toHaveBeenCalledExactlyOnceWith({ lat: 48.1, lon: 13.15 })
    expect(hook.ungefaehr).toBeNull()
    expect(hook.ortet).toBe(false)
  })

  it('über 2 000 m: nichts wird übernommen, der Hinweis mit der Genauigkeit steht (Zustand 3)', async () => {
    starte()
    hook.standortErfragen()
    ortung(0)[0](position(15_000))
    await zuRuhe()

    expect(beiStandort).not.toHaveBeenCalled()
    expect(hook.ungefaehr?.satz).toBe('Dein Standort ist nur ungefähr bekannt (etwa 15 km).')
    expect(hook.ungefaehr?.genauerMisslang).toBe(false)
    expect(hook.ortet).toBe(false)
    // Die Position bleibt im Browser: Es gibt keinen Aufruf an den Server.
    expect(loeseOrtAuf).not.toHaveBeenCalled()
  })

  it('„Genauer bestimmen": zweiter Aufruf mit hoher Genauigkeit und 12 s — das Ergebnis wird übernommen', async () => {
    starte()
    hook.standortErfragen()
    ortung(0)[0](position(15_000, 48.0, 13.0))
    await zuRuhe()

    hook.genauerBestimmen()
    await zuRuhe()
    expect(getCurrentPosition).toHaveBeenCalledTimes(2)
    expect(ortung(1)[2]).toEqual({ enableHighAccuracy: true, timeout: 12_000 })
    expect(hook.ortet).toBe(true)

    ortung(1)[0](position(25, 48.1067, 13.15))
    await zuRuhe()

    expect(beiStandort).toHaveBeenCalledExactlyOnceWith({ lat: 48.1067, lon: 13.15 })
    expect(hook.ungefaehr).toBeNull()
    expect(hook.ortet).toBe(false)
    expect(loeseOrtAuf).not.toHaveBeenCalled()
  })

  it('„Genauer bestimmen" klappt nicht: der Hinweis bleibt und sagt es dazu — „So lassen" übernimmt dann den ersten Wert', async () => {
    starte()
    hook.standortErfragen()
    ortung(0)[0](position(15_000, 48.0, 13.0))
    await zuRuhe()
    hook.genauerBestimmen()
    await zuRuhe()

    ortung(1)[1]({ code: 3, message: 'Timeout expired' })
    await zuRuhe()

    expect(beiStandort).not.toHaveBeenCalled()
    expect(hook.ungefaehr?.genauerMisslang).toBe(true)
    expect(hook.ortet).toBe(false)

    hook.soLassen()
    await zuRuhe()
    expect(beiStandort).toHaveBeenCalledExactlyOnceWith({ lat: 48.0, lon: 13.0 })
    expect(hook.ungefaehr).toBeNull()
  })

  it('„So lassen" übernimmt den ungefähren Standort — auch mitten in der Nachfrage, deren späte Antwort dann nicht mehr zählt', async () => {
    starte()
    hook.standortErfragen()
    ortung(0)[0](position(15_000, 48.0, 13.0))
    await zuRuhe()
    hook.genauerBestimmen()
    await zuRuhe()

    hook.soLassen()
    await zuRuhe()
    expect(beiStandort).toHaveBeenCalledExactlyOnceWith({ lat: 48.0, lon: 13.0 })
    expect(hook.ortet).toBe(false)

    ortung(1)[0](position(10, 47.0, 12.0))
    await zuRuhe()
    expect(beiStandort).toHaveBeenCalledTimes(1)
  })

  it('„Ort ändern" räumt den Hinweis ab; eine späte Antwort des Geräts gilt dann nicht mehr', async () => {
    starte()
    hook.standortErfragen()
    const [ok] = ortung(0)
    hook.aufheben()
    ok(position(15_000))
    await zuRuhe()

    expect(hook.ungefaehr).toBeNull()
    expect(beiStandort).not.toHaveBeenCalled()
  })

  it('Ablehnung ist kein Fehler: der Satz zum Suchfeld, der Fokus geht dorthin', async () => {
    starte()
    hook.standortErfragen()
    ortung(0)[1]({ code: 1, message: 'User denied Geolocation' })
    await zuRuhe()

    expect(hook.hinweis).toBe(SUCHFELD_TEXT.ohneStandort)
    expect(beiZumFeld).toHaveBeenCalledTimes(1)
    expect(hook.ungefaehr).toBeNull()
  })

  it('wartet der Dialog des Browsers zu lange, endet das Warten nach 10 s — die Antwort danach zählt trotzdem', async () => {
    starte()
    hook.standortErfragen()
    await vi.advanceTimersByTimeAsync(10_000)
    await zuRuhe()
    expect(hook.ortet).toBe(false)
    expect(hook.hinweis).toBe(SUCHFELD_TEXT.dauert)

    ortung(0)[0](position(30))
    await zuRuhe()
    expect(beiStandort).toHaveBeenCalledTimes(1)
    expect(hook.hinweis).toBeNull()
  })

  it('zwei Aufrufe aus demselben Render: nur die Antwort des letzten zählt', async () => {
    starte()
    // Beide Aufrufe stammen aus demselben Render (der Zustand „ortet" ist darin noch falsch).
    const { standortErfragen } = hook
    standortErfragen()
    standortErfragen()
    expect(getCurrentPosition).toHaveBeenCalledTimes(2)

    ortung(0)[0](position(20, 1, 1))
    ortung(1)[0](position(20, 2, 2))
    await zuRuhe()

    expect(beiStandort).toHaveBeenCalledExactlyOnceWith({ lat: 2, lon: 2 })
  })
})

describe('Ortssuche — Enter und Eintrag', () => {
  const ORT = { lat: 48.1067, lon: 13.15, name: 'Mattighofen, Oberösterreich' }

  it('ein eindeutiger Treffer wird ohne Liste übernommen', async () => {
    loeseOrtAuf.mockResolvedValue([ORT])
    starte()
    hook.ortSuchen('5230 Mattighofen')
    await zuRuhe()

    expect(loeseOrtAuf).toHaveBeenCalledExactlyOnceWith('5230 Mattighofen')
    expect(beiOrt).toHaveBeenCalledExactlyOnceWith(ORT)
    expect(hook.kandidaten).toEqual([])
  })

  it('mehrere Treffer: die Liste (Zustand 2) mit der Anzahl im Satz — übernommen wird erst die Wahl', async () => {
    const orte = [
      { lat: 48.21, lon: 13.49, name: 'Ried im Innkreis, Oberösterreich' },
      { lat: 47.99, lon: 14.06, name: 'Ried im Traunkreis, Oberösterreich' },
      { lat: 48.29, lon: 10.95, name: 'Ried, Bayern' },
    ]
    loeseOrtAuf.mockResolvedValue(orte)
    starte()
    hook.ortSuchen('Ried')
    await zuRuhe()

    expect(beiOrt).not.toHaveBeenCalled()
    expect(hook.kandidaten).toEqual(orte)
    expect(hook.hinweis).toBe('Drei Orte passen — welchen meinst du?')

    hook.uebernimm(orte[1])
    await zuRuhe()
    expect(beiOrt).toHaveBeenCalledExactlyOnceWith(orte[1])
    expect(hook.kandidaten).toEqual([])
    expect(hook.hinweis).toBeNull()
  })

  it('kein Treffer: der Satz „Keinen Ort gefunden …", nichts wird übernommen — die Produktsuche läuft weiter', async () => {
    loeseOrtAuf.mockResolvedValue([])
    starte()
    hook.ortSuchen('Heu')
    await zuRuhe()

    expect(hook.hinweis).toBe('Keinen Ort gefunden – wir suchen nach Höfen und Produkten.')
    expect(beiOrt).not.toHaveBeenCalled()
    expect(hook.kandidaten).toEqual([])
  })

  it('Tippen räumt den Satz zum alten Text und die alte Auswahl ab', async () => {
    loeseOrtAuf.mockResolvedValue([])
    starte()
    hook.ortSuchen('Heu')
    await zuRuhe()
    expect(hook.hinweis).not.toBeNull()

    hook.textGeaendert()
    await zuRuhe()
    expect(hook.hinweis).toBeNull()
  })

  it('zwei Aufrufe aus demselben Render: die späte Antwort des ersten überfährt den zweiten nicht', async () => {
    let ersteAntwort: (orte: unknown[]) => void = () => {}
    loeseOrtAuf
      .mockImplementationOnce(() => new Promise((weiter) => (ersteAntwort = weiter)))
      .mockResolvedValueOnce([{ lat: 48.267, lon: 13.025, name: 'Simbach am Inn, Bayern' }])
    starte()
    const { ortSuchen } = hook
    ortSuchen('Ried')
    ortSuchen('Simbach')
    await zuRuhe()
    expect(beiOrt).toHaveBeenCalledExactlyOnceWith({ lat: 48.267, lon: 13.025, name: 'Simbach am Inn, Bayern' })

    // Die Antwort auf „Ried" kommt zuletzt — und zählt nicht mehr.
    ersteAntwort([
      { lat: 1, lon: 1, name: 'Ried A' },
      { lat: 2, lon: 2, name: 'Ried B' },
    ])
    await zuRuhe()
    expect(beiOrt).toHaveBeenCalledTimes(1)
    expect(hook.kandidaten).toEqual([])
  })
})

describe('Ankunft mit Suchtext — die Kundin hat abgesendet (Startseite, Kopfzeile, 404)', () => {
  it('löst den Text einmal auf, genau wie Enter — auch bei weiteren Renderings', async () => {
    loeseOrtAuf.mockResolvedValue([{ lat: 48.1067, lon: 13.15, name: 'Mattighofen, Oberösterreich' }])
    starte('5230 Mattighofen')
    await zuRuhe()

    expect(loeseOrtAuf).toHaveBeenCalledExactlyOnceWith('5230 Mattighofen')
    expect(beiOrt).toHaveBeenCalledTimes(1)
    expect(beiAnkunftErledigt).toHaveBeenCalledTimes(1)

    pruefstand.erneut()
    await zuRuhe()
    expect(loeseOrtAuf).toHaveBeenCalledTimes(1)
    expect(beiAnkunftErledigt).toHaveBeenCalledTimes(1)
  })

  it('findet sich kein Ort, steht der Satz — der Text bleibt als Produktsuche', async () => {
    loeseOrtAuf.mockResolvedValue([])
    starte('Heu')
    await zuRuhe()

    expect(hook.hinweis).toBe(SUCHFELD_TEXT.keinOrt)
    expect(beiOrt).not.toHaveBeenCalled()
  })

  it('Text, der kein Ort sein kann, geht gar nicht erst an die Ortssuche — er ist trotzdem erledigt', async () => {
    starte('Eier 10er')
    await zuRuhe()

    expect(loeseOrtAuf).not.toHaveBeenCalled()
    expect(hook.hinweis).toBeNull()
    expect(beiAnkunftErledigt).toHaveBeenCalledTimes(1)
  })

  it('ohne Suchtext passiert nichts: Tippen im Feld löst nie von selbst aus', async () => {
    starte('')
    await zuRuhe()
    starte('   ')
    await zuRuhe()

    expect(loeseOrtAuf).not.toHaveBeenCalled()
    expect(beiAnkunftErledigt).not.toHaveBeenCalled()
  })
})

/**
 * Vorrat setzen am Handy und in der Tabelle (Register N25, Nr. 144).
 *
 * Beweist:
 *  - Die Schleife des Sendens (rein, ohne React, mit nachgebautem setzeVorrat):
 *    eine zweite Änderung während einer Anfrage geht mit `vorher` = Ergebnis
 *    der ersten; bei einer Abweisung entfällt die wartende Änderung und es gilt
 *    der Stand des Servers; bei einem Fehler bleibt der Stand; gleicher Wert →
 *    keine Anfrage.
 *  - Das Vorrat-Blatt (seit Lauf 30, Boards s1/w1-produkte Bild 2, auch aus der
 *    Tabelle; das Feld `VorratFeld` der Tabelle gibt es nicht mehr): der Stepper
 *    ändert nur das Feld; „Speichern" ruft setzeVorrat mit `vorher` und dem neuen
 *    Wert; GEAENDERT lässt das Blatt offen; 0 speichert „Ausverkauft"; mit
 *    `wiederDa` kommt der Moment erst nach dem Schließen; solange gespeichert
 *    wird, schließt nichts; am Handy das Blatt, ab 768 px DialogMitte, beide mit
 *    genau einem „Abbrechen" oben.
 *
 * Ohne DOM (TESTING_GUIDELINES §1) spielt ein kleiner Prüfstand die Hooks von
 * React nach (Vorbild tests/use-cart.test.ts): Zustand je Aufrufstelle,
 * Rendern nach einer Änderung von außen, Effekte nach dem Rendern. Die
 * Komponente läuft als Funktion; ihre Knöpfe stehen als Elemente im Baum und
 * werden über ihren Text gefunden und gedrückt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VorratErgebnis } from '@/server/actions/products'

const pruefstand = vi.hoisted(() => {
  type Setzer<T> = (wert: T | ((vorher: T) => T)) => void
  type Effekt = { deps: readonly unknown[] | undefined }
  let zellen: unknown[] = []
  let faellig: Array<() => void> = []
  let zeiger = 0
  let rendernd = false
  let schmutzig = false
  let geplant = false
  let komponente: () => unknown = () => null
  let baum: unknown = null

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
      geplant = false
      komponente = neu
      rendere()
    },
    baum: () => baum,
    async zuRuhe(): Promise<void> {
      do {
        await new Promise((weiter) => setTimeout(weiter, 0))
      } while (geplant)
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
    useEffect(wirkung: () => void, deps?: readonly unknown[]): void {
      const i = zeiger++
      const alt = zellen[i] as Effekt | undefined
      if (alt && gleich(alt.deps, deps)) return
      faellig.push(() => {
        wirkung()
        zellen[i] = { deps }
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

const router = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

const setzeVorrat = vi.hoisted(() => vi.fn())
vi.mock('@/server/actions/products', () => ({ setzeVorrat }))

// Die Breite des Fensters: am Handy das Blatt, ab 768 px der Dialog (useMindestbreite liest matchMedia).
const fenster = vi.hoisted(() => ({ breit: false }))
vi.mock('@/lib/use-mindestbreite', () => ({ useMindestbreite: () => fenster.breit }))

import { SPEICHERN_GING_NICHT, erzeugeVorratSchleife, type VorratMeldungen } from '@/components/produkte/use-vorrat-setzen'
import { NETZ_SATZ } from '@/lib/netz'
import { VorratBlatt } from '@/components/produkte/vorrat-blatt'
import { Stepper } from '@/components/ui/stepper'
import { Sheet, SheetKopf } from '@/components/ui/sheet'
import { Dialog, DialogMitte } from '@/components/ui/dialog'
import { VORRAT_NULL_SATZ, vorratFrage, vorratTitel } from '@/lib/produkte-hof'
import type { ProductData } from '@/server/queries/products'

/** Eine Antwort, die der Test selbst auslöst — so liegt eine zweite Änderung sicher mitten in der Anfrage. */
function offeneAntwort(): { promise: Promise<VorratErgebnis>; gib: (e: VorratErgebnis) => void } {
  let gib: (e: VorratErgebnis) => void = () => {}
  const promise = new Promise<VorratErgebnis>((weiter) => {
    gib = weiter
  })
  return { promise, gib }
}

function meldungen(): VorratMeldungen & { log: string[] } {
  const log: string[] = []
  return {
    log,
    beginn: () => log.push('beginn'),
    ok: (v, w) => log.push(`ok ${v}${w ? ' wieder da' : ''}`),
    abgewiesen: (s, f, g) => log.push(`abgewiesen ${s} ${g ? 'GEAENDERT' : f}`),
    ende: () => log.push('ende'),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Schleife des Sendens — rein, mit nachgebautem setzeVorrat', () => {
  it('eine zweite Änderung während einer Anfrage geht mit vorher = Ergebnis der ersten', async () => {
    const erste = offeneAntwort()
    const setze = vi.fn().mockReturnValueOnce(erste.promise).mockResolvedValueOnce({ ok: true, vorrat: 9, wiederDa: false })
    const s = erzeugeVorratSchleife({ productId: 'p1', bestaetigt: 3, setze, melde: meldungen() })

    const lauf = s.senden(5)
    expect(await s.senden(9)).toEqual({ art: 'wartet' })
    erste.gib({ ok: true, vorrat: 5, wiederDa: false })

    expect(await lauf).toEqual({ art: 'ok', vorrat: 9 })
    expect(setze.mock.calls.map((c) => c[0])).toEqual([
      { productId: 'p1', vorher: 3, neu: 5 },
      // Nie zweimal dasselbe vorher — die zweite Anfrage baut auf der Antwort der ersten auf.
      { productId: 'p1', vorher: 5, neu: 9 },
    ])
  })

  it('bei einer Abweisung entfällt die wartende Änderung, es gilt der Stand des Servers', async () => {
    const erste = offeneAntwort()
    const setze = vi.fn().mockReturnValueOnce(erste.promise).mockResolvedValue({ ok: true, vorrat: 4, wiederDa: false })
    const m = meldungen()
    const s = erzeugeVorratSchleife({ productId: 'p1', bestaetigt: 3, setze, melde: m })

    const lauf = s.senden(5)
    void s.senden(9)
    erste.gib({ error: 'Inzwischen hat jemand bestellt.', code: 'GEAENDERT', vorrat: 1 })

    expect(await lauf).toEqual({ art: 'abgewiesen', stand: 1, fehler: 'Inzwischen hat jemand bestellt.' })
    expect(setze).toHaveBeenCalledTimes(1)
    expect(m.log).toEqual(['beginn', 'abgewiesen 1 GEAENDERT', 'ende'])
    // Der nächste Versuch baut auf dem Stand des Servers auf.
    await s.senden(4)
    expect(setze).toHaveBeenLastCalledWith({ productId: 'p1', vorher: 1, neu: 4 })
  })

  it('bei einem Fehler bleibt der bestätigte Stand, der Satz kommt aus einer Quelle', async () => {
    const setze = vi.fn().mockRejectedValueOnce(new Error('Netz weg')).mockResolvedValue({ ok: true, vorrat: 7, wiederDa: false })
    const s = erzeugeVorratSchleife({ productId: 'p1', bestaetigt: 3, setze, melde: meldungen() })

    expect(await s.senden(7)).toEqual({ art: 'abgewiesen', stand: 3, fehler: SPEICHERN_GING_NICHT })
    await s.senden(7)
    expect(setze).toHaveBeenLastCalledWith({ productId: 'p1', vorher: 3, neu: 7 })
  })

  it('am Netz gescheitert: der Netzsatz (Register N29, Nr. 175), der bestätigte Stand bleibt', async () => {
    const setze = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const s = erzeugeVorratSchleife({ productId: 'p1', bestaetigt: 3, setze, melde: meldungen() })

    expect(await s.senden(7)).toEqual({ art: 'abgewiesen', stand: 3, fehler: NETZ_SATZ })
  })

  it('gleicher Wert → keine Anfrage; ein Stand vom Server gilt nur, solange nichts läuft', async () => {
    const setze = vi.fn().mockResolvedValue({ ok: true, vorrat: 8, wiederDa: false })
    const s = erzeugeVorratSchleife({ productId: 'p1', bestaetigt: 3, setze, melde: meldungen() })

    expect(await s.senden(3)).toEqual({ art: 'unveraendert' })
    expect(setze).not.toHaveBeenCalled()
    s.nimmServerStand(6)
    await s.senden(8)
    expect(setze).toHaveBeenCalledWith({ productId: 'p1', vorher: 6, neu: 8 })
  })
})

// ─── Prüfstand: Feld der Tabelle und Vorrat-Blatt ───────────────────────────

type Knoten = { type?: unknown; props?: Record<string, unknown> }

function elemente(knoten: unknown, fund: Knoten[] = []): Knoten[] {
  if (Array.isArray(knoten)) {
    for (const kind of knoten) elemente(kind, fund)
  } else if (knoten && typeof knoten === 'object' && 'props' in knoten) {
    const element = knoten as Knoten
    fund.push(element)
    elemente(element.props?.children, fund)
  }
  return fund
}

function text(knoten: unknown): string {
  if (typeof knoten === 'string' || typeof knoten === 'number') return String(knoten)
  if (Array.isArray(knoten)) return knoten.map(text).join('')
  if (knoten && typeof knoten === 'object' && 'props' in knoten) return text((knoten as Knoten).props?.children)
  return ''
}

function element(typ: unknown): Record<string, unknown> {
  const fund = elemente(pruefstand.baum()).find((e) => e.type === typ)
  if (!fund?.props) throw new Error('Element nicht im Baum')
  return fund.props
}

function knopf(beschriftung: string): Record<string, unknown> {
  const fund = elemente(pruefstand.baum()).find((e) => typeof e.props?.onClick === 'function' && text(e) === beschriftung)
  if (!fund?.props) throw new Error(`Knopf „${beschriftung}" nicht im Baum`)
  return fund.props
}

const drueck = (beschriftung: string) => (knopf(beschriftung).onClick as () => void)()

function produkt(teil: Partial<ProductData> = {}): ProductData {
  return {
    id: 'p1',
    name: 'Karotten',
    description: null,
    imageUrl: null,
    bildAusschnitt: null,
    category: 'GEMUESE',
    subcategory: null,
    labels: [],
    futter: null,
    abgabe: 'ALLE',
    categoryImageUrl: null,
    countsTowardLimit: true,
    price: 2.2,
    vatRate: 10,
    unit: 'KG',
    unitSize: null,
    stock: 3,
    reservedStock: 0,
    isAvailable: true,
    allergens: [],
    isOrganic: false,
    requiresCool: false,
    requiresFreezer: false,
    seasonStart: null,
    seasonEnd: null,
    unavailableReason: null,
    familieId: null,
    verpackung: null,
    abholhinweise: [],
    keinRuecktritt: false,
    ruecksendekostenCents: null,
    sperre: null,
    ...teil,
  }
}

describe('Vorrat-Blatt', () => {
  beforeEach(() => {
    fenster.breit = false
  })

  function oeffne(teil: Partial<ProductData> = {}) {
    const onSchliessen = vi.fn()
    const onWiederDa = vi.fn()
    pruefstand.starte(() => VorratBlatt({ produkt: produkt(teil), offen: true, onSchliessen, onWiederDa, fokusZiel: () => null }))
    return { onSchliessen, onWiederDa }
  }
  const tippe = (wert: number) => (element(Stepper).onWertChange as (w: number) => void)(wert)

  it('der Stepper ändert nur das Feld; „Speichern" setzt den neuen Wert mit vorher und schließt', async () => {
    setzeVorrat.mockResolvedValueOnce({ ok: true, vorrat: 28, wiederDa: false })
    const { onSchliessen } = oeffne()
    expect(element(Stepper).wert).toBe(3)

    tippe(28)
    await pruefstand.zuRuhe()
    expect(element(Stepper).wert).toBe(28)
    expect(setzeVorrat).not.toHaveBeenCalled()

    drueck('Speichern')
    await pruefstand.zuRuhe()
    expect(setzeVorrat).toHaveBeenCalledExactlyOnceWith({ productId: 'p1', vorher: 3, neu: 28 })
    expect(onSchliessen).toHaveBeenCalledTimes(1)
  })

  it('nach dem Board: Frage in der Einheit des Vorrats und der Satz zu 0 — Gegenprobe: Gebinde zählt Pakete', () => {
    oeffne()
    expect(text(pruefstand.baum())).toContain(vorratFrage('KG', null))
    expect(text(pruefstand.baum())).toContain(VORRAT_NULL_SATZ)
    expect(vorratFrage('KG', null)).toBe('Wie viele kg hast du gerade?')
    expect(vorratFrage('STUECK', 10)).toBe('Wie viele Pakete à 10 Stück hast du gerade?')
    expect(vorratTitel('Freilandeier')).toBe('Vorrat: Freilandeier')
  })

  it('GEAENDERT lässt das Blatt offen und zeigt den Stand des Servers mit dem Satz', async () => {
    setzeVorrat.mockResolvedValueOnce({ error: 'Inzwischen hat jemand bestellt. Jetzt: 1 kg.', code: 'GEAENDERT', vorrat: 1 })
    const { onSchliessen } = oeffne()

    tippe(8)
    await pruefstand.zuRuhe()
    drueck('Speichern')
    await pruefstand.zuRuhe()

    expect(onSchliessen).not.toHaveBeenCalled()
    expect(element(Stepper).wert).toBe(1)
    expect(text(pruefstand.baum())).toContain('Inzwischen hat jemand bestellt. Jetzt: 1 kg.')
    expect(text(pruefstand.baum())).toContain('vorher 1 kg')
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })

  it('„Speichern" ist der orange Hauptknopf (N42 a), nicht grün; kein „Ausverkauft"-Knopf mehr', () => {
    oeffne()
    const speichern = knopf('Speichern')
    expect(speichern.variant).toBeUndefined()
    expect(String(speichern.className)).not.toContain('bg-accent')
    expect(() => knopf('Ausverkauft')).toThrow()
  })

  it('0 im Feld speichert „Ausverkauft"', async () => {
    setzeVorrat.mockResolvedValueOnce({ ok: true, vorrat: 0, wiederDa: false })
    const { onSchliessen } = oeffne({ stock: 12 })

    tippe(0)
    await pruefstand.zuRuhe()
    drueck('Speichern')
    await pruefstand.zuRuhe()

    expect(setzeVorrat).toHaveBeenCalledExactlyOnceWith({ productId: 'p1', vorher: 12, neu: 0 })
    expect(onSchliessen).toHaveBeenCalledTimes(1)
  })

  it('mit wiederDa kommt der Moment erst, wenn das Blatt zu ist', async () => {
    setzeVorrat.mockResolvedValueOnce({ ok: true, vorrat: 10, wiederDa: true })
    const { onSchliessen, onWiederDa } = oeffne({ stock: 0 })

    tippe(10)
    await pruefstand.zuRuhe()
    drueck('Speichern')
    await pruefstand.zuRuhe()
    expect(onSchliessen).toHaveBeenCalledTimes(1)
    expect(onWiederDa).not.toHaveBeenCalled()

    ;(element(Sheet).onOpenChangeComplete as (offen: boolean) => void)(false)
    expect(onWiederDa).toHaveBeenCalledExactlyOnceWith(10)
  })

  it('solange gespeichert wird, schließt „Abbrechen" bzw. Escape nicht; danach schon', async () => {
    const antwort = offeneAntwort()
    setzeVorrat.mockReturnValueOnce(antwort.promise)
    const { onSchliessen } = oeffne()

    tippe(8)
    await pruefstand.zuRuhe()
    drueck('Speichern')
    await pruefstand.zuRuhe()
    expect(text(pruefstand.baum())).toContain('Speichert …')
    expect(knopf('Speichert …').disabled).toBe(true)
    ;(element(Sheet).onOpenChange as (offen: boolean) => void)(false)
    expect(onSchliessen).not.toHaveBeenCalled()

    antwort.gib({ error: SPEICHERN_GING_NICHT })
    await pruefstand.zuRuhe()
    expect(text(pruefstand.baum())).toContain(SPEICHERN_GING_NICHT)
    ;(element(Sheet).onOpenChange as (offen: boolean) => void)(false)
    expect(onSchliessen).toHaveBeenCalledTimes(1)
  })

  it('zwei Tipps auf „Speichern" aus demselben Render schicken den Wert einmal (Hook nach await, §2)', async () => {
    const erste = offeneAntwort()
    setzeVorrat.mockReturnValueOnce(erste.promise)
    oeffne()
    tippe(5)
    await pruefstand.zuRuhe()

    const speichern = knopf('Speichern').onClick as () => void
    speichern()
    speichern()
    erste.gib({ ok: true, vorrat: 5, wiederDa: false })
    await pruefstand.zuRuhe()

    expect(setzeVorrat.mock.calls.map((c) => c[0])).toEqual([{ productId: 'p1', vorher: 3, neu: 5 }])
  })

  it('am Handy das Blatt mit Kopf „Vorrat: …" und genau einem „Abbrechen"; ab 768 px DialogMitte (N41 d)', () => {
    oeffne()
    expect(element(SheetKopf)).toMatchObject({ titel: 'Vorrat: Karotten', schliessen: 'Abbrechen' })
    expect(() => element(DialogMitte)).toThrow()

    fenster.breit = true
    oeffne()
    expect(element(DialogMitte)).toMatchObject({ titel: 'Vorrat: Karotten', schliessen: 'Abbrechen' })
    expect(typeof element(Dialog).onOpenChange).toBe('function')
    expect(() => element(SheetKopf)).toThrow()
  })
})

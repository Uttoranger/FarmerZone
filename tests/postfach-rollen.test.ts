/**
 * Postfach: Die eigene Antwort verschwindet nicht hinter Antwortfeld und
 * Unterleiste (Nachtlauf 34 Nr. 308, F052 Hürde 10).
 *
 * Am Handy klebt das Antwortfeld über der Unterleiste. Nach dem Senden erschien
 * die neue Nachricht am Ende des Fadens — dahinter. Jetzt steht unter dem Faden
 * ein Anker mit Rand (scroll-margin) in Höhe von Feld plus Leiste, und nach
 * einem erfolgreichen Senden rollt die Seite zu ihm (ohne Zeitschaltung, bei
 * „weniger Bewegung“ ohne Gleiten).
 *
 * Ohne DOM (TESTING_GUIDELINES §1): ein kleiner Prüfstand nach dem Vorbild von
 * tests/use-cart.test.ts spielt useState, useEffect und useTransition nach; die
 * Komponente läuft als Funktion, `document` und `matchMedia` sind Attrappen.
 * Die Seite rendert mit renderToStaticMarkup, Daten und Sitzung gemockt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type FormEvent, type ReactElement } from 'react'

const pruefstand = vi.hoisted(() => {
  type Setzer<T> = (wert: T | ((vorher: T) => T)) => void
  type Effekt = { deps: readonly unknown[] | undefined; aufraeumen: void | (() => void) }
  let zellen: unknown[] = []
  let faellig: Array<() => void> = []
  let zeiger = 0
  let aktiv = false
  let komponente: () => unknown = () => null
  let zuletzt: unknown = null
  let laufend: Promise<unknown> = Promise.resolve()

  function gleich(a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean {
    return a !== undefined && b !== undefined && a.length === b.length && a.every((d, k) => Object.is(d, b[k]))
  }

  function rendere(): void {
    faellig = []
    zeiger = 0
    zuletzt = komponente()
    const laeufe = faellig
    faellig = []
    for (const lauf of laeufe) lauf()
  }

  return {
    starte(neu: () => unknown): void {
      zellen = []
      komponente = neu
      aktiv = true
      rendere()
    },
    beende(): void {
      aktiv = false
    },
    get ausgabe(): unknown {
      return zuletzt
    },
    /** Rendert neu, wie React nach einer Zustandsänderung. */
    rendere,
    aktiv: (): boolean => aktiv,
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
    useEffect(wirkung: () => void | (() => void), deps?: readonly unknown[]): void {
      const i = zeiger++
      const alt = zellen[i] as Effekt | undefined
      if (alt && gleich(alt.deps, deps)) return
      faellig.push(() => {
        if (typeof alt?.aufraeumen === 'function') alt.aufraeumen()
        zellen[i] = { deps, aufraeumen: wirkung() }
      })
    },
    useTransition(): [boolean, (rueckruf: () => unknown) => void] {
      return [
        false,
        (rueckruf) => {
          laufend = Promise.resolve(rueckruf())
        },
      ]
    },
    /** Das Versprechen des zuletzt gestarteten Übergangs. */
    laufend: (): Promise<unknown> => laufend,
  }
})

// Nur im Prüfstand-Teil die nachgespielten Hooks; die Seite rendert mit echtem React.
vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return {
    ...echt,
    useState: ((anfang: unknown) => (pruefstand.aktiv() ? pruefstand.useState(anfang) : echt.useState(anfang))) as typeof echt.useState,
    useRef: ((a: unknown) => (pruefstand.aktiv() ? pruefstand.useRef(a) : echt.useRef(a))) as typeof echt.useRef,
    useEffect: ((w: () => void | (() => void), d?: readonly unknown[]) =>
      pruefstand.aktiv() ? pruefstand.useEffect(w, d) : echt.useEffect(w, d)) as typeof echt.useEffect,
    useTransition: (() => (pruefstand.aktiv() ? pruefstand.useTransition() : echt.useTransition())) as typeof echt.useTransition,
  }
})

const aktion = vi.hoisted(() => ({ antworteAlsHof: vi.fn(), markiereGelesen: vi.fn() }))
vi.mock('@/server/actions/postfach', () => aktion)

const daten = vi.hoisted(() => ({ faden: null as unknown }))
vi.mock('@/server/hofbereich', () => ({ verlangeHofDerSitzung: async () => ({ userId: 'nutzer-1' }) }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: async () => ({ id: 'hof-1' }) }))
vi.mock('@/server/queries/postfach', () => ({ ladeFadenHof: async () => daten.faden }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
  redirect: () => {
    throw new Error('redirect')
  },
  useRouter: () => ({ refresh: () => {}, back: () => {}, push: () => {} }),
  usePathname: () => '/postfach/cmwf1j4v80042nk7dpbb0l4r9',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import { FADEN_ENDE_ID, rollVerhalten } from '@/lib/postfach-rollen'
import { AntwortFormular } from '@/app/(hof)/postfach/[id]/antwort-formular'

describe('rollVerhalten', () => {
  it('rollt bei „weniger Bewegung“ sofort, sonst gleitend', () => {
    expect(rollVerhalten(true)).toBe('auto')
    expect(rollVerhalten(false)).toBe('smooth')
  })

  it('hat eine feste Kennung für den Anker am Fadenende', () => {
    expect(FADEN_ENDE_ID).toBe('postfach-faden-ende')
  })
})

describe('AntwortFormular rollt nach dem Senden zur neuen Nachricht', () => {
  const rollen = vi.fn()
  const gesucht: string[] = []
  let wenigerBewegung = false

  beforeEach(() => {
    rollen.mockReset()
    gesucht.length = 0
    wenigerBewegung = false
    aktion.antworteAlsHof.mockReset()
    vi.stubGlobal('document', {
      getElementById: (id: string) => {
        gesucht.push(id)
        return id === FADEN_ENDE_ID ? { scrollIntoView: rollen } : null
      },
    })
    vi.stubGlobal('window', {
      matchMedia: (abfrage: string) => ({ matches: abfrage === '(prefers-reduced-motion: reduce)' && wenigerBewegung }),
    })
    pruefstand.starte(() => AntwortFormular({ unterhaltungId: 'faden-1' }))
  })

  afterEach(() => {
    pruefstand.beende()
    vi.unstubAllGlobals()
  })

  async function sende(): Promise<void> {
    const form = pruefstand.ausgabe as ReactElement<{ onSubmit: (e: FormEvent<HTMLFormElement>) => void }>
    form.props.onSubmit({ preventDefault: () => {} } as FormEvent<HTMLFormElement>)
    await pruefstand.laufend()
    pruefstand.rendere()
  }

  it('rollt beim ersten Rendern nicht', () => {
    expect(rollen).not.toHaveBeenCalled()
  })

  it('rollt nach erfolgreichem Senden genau einmal zum Fadenende, gleitend', async () => {
    aktion.antworteAlsHof.mockResolvedValue({ success: true })
    await sende()
    expect(rollen).toHaveBeenCalledTimes(1)
    expect(gesucht).toEqual([FADEN_ENDE_ID])
    expect(rollen).toHaveBeenCalledWith({ block: 'end', behavior: 'smooth' })
    // Ein weiteres Rendern ohne neues Senden rollt nicht noch einmal.
    pruefstand.rendere()
    expect(rollen).toHaveBeenCalledTimes(1)
  })

  it('rollt bei „weniger Bewegung“ ohne Gleiten', async () => {
    wenigerBewegung = true
    aktion.antworteAlsHof.mockResolvedValue({ success: true })
    await sende()
    expect(rollen).toHaveBeenCalledWith({ block: 'end', behavior: 'auto' })
  })

  it('rollt nach einem Fehler nicht', async () => {
    aktion.antworteAlsHof.mockResolvedValue({ error: 'Wir konnten deine Antwort nicht senden.' })
    await sende()
    expect(rollen).not.toHaveBeenCalled()
  })

  it('rollt bei jedem weiteren erfolgreichen Senden wieder', async () => {
    aktion.antworteAlsHof.mockResolvedValue({ success: true })
    await sende()
    await sende()
    expect(rollen).toHaveBeenCalledTimes(2)
  })
})

describe('Fadenseite: Anker zwischen Faden und Antwortfeld', () => {
  it('steht nach der letzten Nachricht und vor dem Formular, mit Rand für Feld und Leiste', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { default: FadenPage } = await import('@/app/(hof)/postfach/[id]/page')
    const jetzt = new Date()
    daten.faden = {
      id: 'cmwf1j4v80042nk7dpbb0l4r9',
      titel: null,
      rundschreiben: null,
      gelesenBisAndere: null,
      gelesenBisEigene: null,
      nachrichten: [
        { id: 'n1', vonFarmId: null, text: 'Willkommen', art: 'NORMAL', linkUrl: null, createdAt: jetzt },
        { id: 'n2', vonFarmId: 'hof-1', text: 'Letzte eigene Antwort', art: 'NORMAL', linkUrl: null, createdAt: jetzt },
      ],
    }
    const seite = await FadenPage({ params: Promise.resolve({ id: 'cmwf1j4v80042nk7dpbb0l4r9' }) })
    const html = renderToStaticMarkup(seite)
    const nachricht = html.indexOf('Letzte eigene Antwort')
    const anker = html.indexOf(`id="${FADEN_ENDE_ID}"`)
    const formular = html.indexOf('<form')
    expect(nachricht).toBeGreaterThan(-1)
    expect(anker).toBeGreaterThan(nachricht)
    expect(formular).toBeGreaterThan(anker)
    expect(html).toMatch(new RegExp(`<div id="${FADEN_ENDE_ID}" aria-hidden="true" class="[^"]*scroll-mb-\\[calc\\(\\d+px\\+env\\(safe-area-inset-bottom\\)\\)\\][^"]*md:scroll-mb-\\[\\d+px\\]`))
  })
})

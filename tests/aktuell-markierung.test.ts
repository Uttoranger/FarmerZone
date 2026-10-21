/**
 * Die Markierung in der Vorschau für „Aktuell vom Hof“ (Register E12,
 * Ergänzung Nr. 129, Runde 2; Freigabe 129 Punkt 4).
 *
 * Beweist — auf dem EINEN Weg der übrigen Zeilen, keine zweite Fassung:
 *  - Die Aufzählung der Markierung kennt die Kennung `aktuell`, und die
 *    Hofseite liest sie als gültige Nachricht (leseMarkierung).
 *  - Die Zeile „Aktuell vom Hof“ im Editor ab lg schickt `aktuell` an die
 *    Vorschau, genau wie jede andere Zeile über `offen` → `markiert`; ein
 *    zweiter Tipp nimmt die Markierung wieder weg.
 *  - Die Hofseite im Rahmen markiert `[data-abschnitt="aktuell"]` — das Ziel,
 *    das Nr. 128 an den Abschnitt gelegt hat (AKTUELL_ANKER).
 *  - Gegenprobe ohne laufenden Beitrag: Es gibt den Abschnitt nicht — nichts
 *    wird markiert, nichts gescrollt, nichts bricht.
 *
 * Ohne DOM: Der Editor wird als Funktion aufgerufen (useState gestellt), der
 * Effekt von VorschauImRahmen läuft von Hand mit gestelltem Fenster
 * (wie tests/kunde-shell-vorschau.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'

const hooks = vi.hoisted(() => ({ werte: [] as unknown[], index: 0, effekte: [] as Array<() => void | (() => void)> }))
vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return {
    ...echt,
    // Zustand über Aufrufe hinweg — der Test ruft die Komponente nach einem Tipp noch einmal auf.
    useState: <T,>(start: T | (() => T)) => {
      const i = hooks.index++
      if (!(i in hooks.werte)) hooks.werte[i] = typeof start === 'function' ? (start as () => T)() : start
      const setze = (neu: T | ((alt: T) => T)) => {
        hooks.werte[i] = typeof neu === 'function' ? (neu as (alt: T) => T)(hooks.werte[i] as T) : neu
      }
      return [hooks.werte[i], setze]
    },
    useEffect: (wirkung: () => void | (() => void)) => {
      hooks.effekte.push(wirkung)
    },
  }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/lib/use-mindestbreite', () => ({ useMindestbreite: () => false }))
vi.mock('@/lib/use-element-groesse', () => ({ useElementGroesse: () => ({ ref: () => undefined, breite: 0, hoehe: 0 }) }))
vi.mock('@/components/mein-hof/abschnitt-inhalt', () => ({ AbschnittInhalt: () => null, SOFORT_GESPEICHERT: new Set<string>() }))
vi.mock('@/components/farmer/hofseite-vorschau-rahmen', () => ({ HofseiteVorschauRahmen: () => createElement('aside') }))

import { HofseiteEditor } from '@/components/farmer/hofseite-editor'
import { HofseiteVorschauRahmen } from '@/components/farmer/hofseite-vorschau-rahmen'
import { VorschauImRahmen } from '@/components/farm/vorschau-im-rahmen'
import { aktuellZeile, type AktuellZeile } from '@/lib/mein-hof-ansicht'
import { AKTUELL_ANKER } from '@/lib/hofseite-kunde'
import { ZIEL_ABSCHNITT, type HofseiteFortschritt } from '@/lib/hofseite-fortschritt'
import { leseMarkierung } from '@/lib/hofseite-vorschau'
import { MARKIERUNG_TYP, hofseiteZeileIdSchema } from '@/schemas/hofseite-vorschau'
import type { AbschnittHof } from '@/components/mein-hof/abschnitt-inhalt'
import type { FarmSettings } from '@/server/queries/farm'
import type { AppearanceData } from '@/server/queries/appearance'
import { findeElement } from './element-suche'

const URSPRUNG = 'https://hof.example'
const JETZT = new Date('2026-10-20T10:00:00.000Z')
const MIT_BEITRAG = aktuellZeile({ titel: 'Die ersten Kürbisse sind da', endet: '2026-10-26T10:01:00.000Z' }, JETZT)
const OHNE_BEITRAG = aktuellZeile(null, JETZT)

type Knoten = { type?: unknown; props?: Record<string, unknown> }

/** Das erste Element im Baum, auf das `passt` zutrifft — in Kindern und Listen, auf jeder Tiefe. */
function suche(knoten: unknown, passt: (k: Knoten) => boolean): Knoten | null {
  if (knoten == null || typeof knoten !== 'object') return null
  if (Array.isArray(knoten)) {
    for (const kind of knoten) {
      const fund = suche(kind, passt)
      if (fund) return fund
    }
    return null
  }
  const element = knoten as Knoten
  if (!element.props) return null
  if (passt(element)) return element
  return suche(element.props.children, passt)
}

const FORTSCHRITT: HofseiteFortschritt = { gruppen: [], erledigt: 0, gesamt: 0, prozent: 0, fehlend: [], satz: '' }

function editor(aktuell: AktuellZeile): unknown {
  hooks.index = 0
  return HofseiteEditor({ fortschritt: FORTSCHRITT, hof: {} as AbschnittHof, einstellungen: {} as FarmSettings, auftritt: {} as AppearanceData, aktuell })
}

/** Was der Editor gerade an die Vorschau gibt. */
const markiert = (baum: unknown) => findeElement(baum, HofseiteVorschauRahmen)?.props.markiert

/** Tippt auf die Zeile „Aktuell vom Hof“. */
function tippeAufAktuell(baum: unknown): void {
  const zeile = suche(baum, (k) => k.props?.['data-bearbeiten-zeile'] === 'aktuell')
  const knopf = suche(zeile?.props?.children, (k) => k.type === 'button')
  if (!knopf) throw new Error('Die Zeile „Aktuell vom Hof“ hat keinen Knopf, der die Vorschau markiert')
  ;(knopf.props?.onClick as () => void)()
}

beforeEach(() => {
  hooks.werte = []
  hooks.effekte = []
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Kennung `aktuell` in der Aufzählung der Markierung', () => {
  it('die Aufzählung kennt `aktuell`, und die Hofseite liest die Nachricht als gültig', () => {
    expect(hofseiteZeileIdSchema.options).toContain('aktuell')
    expect(leseMarkierung({ origin: URSPRUNG, data: { typ: MARKIERUNG_TYP, abschnitt: 'aktuell' } }, URSPRUNG)).toBe('aktuell')
    // Gegenprobe: Eine erfundene Kennung bleibt ungültig.
    expect(leseMarkierung({ origin: URSPRUNG, data: { typ: MARKIERUNG_TYP, abschnitt: 'beitraege' } }, URSPRUNG)).toBeNull()
  })

  it('das Ziel ist der Abschnitt, den Nr. 128 gelegt hat — eine Quelle für die Kennung', () => {
    expect(ZIEL_ABSCHNITT.aktuell).toBe(AKTUELL_ANKER)
    const abschnitt = readFileSync(join(process.cwd(), 'src/components/hofseite/aktuell-vom-hof.tsx'), 'utf8')
    expect(abschnitt).toContain('data-abschnitt={AKTUELL_ANKER}')
  })
})

describe('Editor ab lg: die Zeile schickt `aktuell` — derselbe Weg wie jede Zeile', () => {
  it('ein Tipp auf die Zeile markiert den Abschnitt in der Vorschau, ein zweiter nimmt die Markierung weg', () => {
    const vorher = editor(MIT_BEITRAG)
    expect(markiert(vorher)).toBeNull()
    tippeAufAktuell(vorher)
    const danach = editor(MIT_BEITRAG)
    expect(markiert(danach)).toBe('aktuell')
    tippeAufAktuell(danach)
    expect(markiert(editor(MIT_BEITRAG))).toBeNull()
  })

  it('der Link zu Mein Hof › Beiträge bleibt — die Markierung nimmt ihm nichts', () => {
    const zeile = suche(editor(MIT_BEITRAG), (k) => k.props?.['data-bearbeiten-zeile'] === 'aktuell')
    expect(suche(zeile?.props?.children, (k) => k.props?.href === MIT_BEITRAG.link.href)).not.toBeNull()
  })

  it('ohne laufenden Beitrag schickt die Zeile dieselbe Kennung — die Hofseite hat dann kein Ziel (unten)', () => {
    const vorher = editor(OHNE_BEITRAG)
    tippeAufAktuell(vorher)
    expect(markiert(editor(OHNE_BEITRAG))).toBe('aktuell')
  })
})

describe('Hofseite im Rahmen: markiert `[data-abschnitt="aktuell"]`', () => {
  /** Lässt die Vorschau anlaufen und gibt den Empfänger der Nachrichten zurück. */
  function hofseite(ziel: { style: Record<string, string>; getBoundingClientRect: () => { top: number; height: number } } | null) {
    const hoerer: Record<string, (ereignis: unknown) => void> = {}
    const fenster: Record<string, unknown> = {
      location: { origin: URSPRUNG, href: `${URSPRUNG}/hof-test` },
      innerHeight: 800,
      scrollY: 0,
      scrollTo: vi.fn(),
      addEventListener: (art: string, f: (ereignis: unknown) => void) => {
        hoerer[art] = f
      },
      removeEventListener: () => {},
    }
    fenster.parent = fenster
    const querySelector = vi.fn(() => ziel)
    vi.stubGlobal('window', fenster)
    vi.stubGlobal('document', { addEventListener: () => {}, removeEventListener: () => {}, querySelector })
    VorschauImRahmen()
    const aufraeumen = hooks.effekte.map((wirkung) => wirkung())
    const sende = (abschnitt: string) => hoerer.message({ origin: URSPRUNG, data: { typ: MARKIERUNG_TYP, abschnitt } })
    const ende = () => {
      for (const weg of aufraeumen) if (typeof weg === 'function') weg()
    }
    return { sende, querySelector, scrollTo: fenster.scrollTo as ReturnType<typeof vi.fn>, ende }
  }

  it('mit laufendem Beitrag: scrollt zum Abschnitt und umrandet ihn', () => {
    const abschnitt = { style: {} as Record<string, string>, getBoundingClientRect: () => ({ top: 600, height: 300 }) }
    const seite = hofseite(abschnitt)
    seite.sende('aktuell')
    expect(seite.querySelector).toHaveBeenCalledWith('[data-abschnitt="aktuell"]')
    expect(seite.scrollTo).toHaveBeenCalledTimes(1)
    expect(abschnitt.style.outline).toBe('3px solid var(--accent)')
    seite.ende()
  })

  it('Gegenprobe ohne Beitrag: kein Abschnitt, also keine Markierung und kein Scrollen — und kein Fehler', () => {
    const seite = hofseite(null)
    expect(() => seite.sende('aktuell')).not.toThrow()
    expect(seite.querySelector).toHaveBeenCalledWith('[data-abschnitt="aktuell"]')
    expect(seite.scrollTo).not.toHaveBeenCalled()
    seite.ende()
  })
})

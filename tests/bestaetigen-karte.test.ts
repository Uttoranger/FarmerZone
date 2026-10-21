/**
 * Der Hinweis zum Download auf /admin/bestaetigen (Register N20, Nr. 126).
 *
 * Nach der Bestätigung eines Exports lädt der Browser die Datei und die Seite
 * bleibt stehen. Bisher war der Knopf sofort wieder frei: Ein zweiter Klick
 * fing eine zweite Bestätigung und einen zweiten Download an, und nichts sagte,
 * dass etwas passiert.
 *
 * Beweist (Prüfstand für useState/useEffect, TESTING_GUIDELINES §1; Komponente
 * als Funktion, Kinder gerendert wie auf dem Server):
 *  - Nach geglückter Bestätigung geht es zum Export UND die Karte merkt sich,
 *    dass der Download startet;
 *  - Im Zustand „startet“ steht „Der Download startet …“ als role="status" und
 *    der Knopf ist gesperrt; davor ist der Statusbereich leer und der Knopf frei;
 *  - Nach 3 Sekunden — nicht vorher — ist alles wieder frei; die Sperre räumt
 *    ihren Zeitgeber beim Verlassen der Seite weg;
 *  - Scheitert die Bestätigung, gibt es keinen Download, keinen Hinweis und
 *    keine Sperre (der Satz zum Fehler steht da).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const pruefstand = vi.hoisted(() => ({
  /** Vorgabe je Aufrufstelle von useState (Reihenfolge im Quelltext); fehlt sie, gilt der Anfangswert. */
  vorgabe: new Map<number, unknown>(),
  gesetzt: [] as Array<{ stelle: number; wert: unknown }>,
  effekte: [] as Array<() => void | (() => void)>,
  stelle: 0,
}))
vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  return {
    ...echt,
    useState: <T,>(anfang: T): [T, (neu: T) => void] => {
      const stelle = pruefstand.stelle++
      const wert = (pruefstand.vorgabe.has(stelle) ? pruefstand.vorgabe.get(stelle) : anfang) as T
      return [wert, (neu: T) => void pruefstand.gesetzt.push({ stelle, wert: neu })]
    },
    useEffect: (effekt: () => void | (() => void)) => void pruefstand.effekte.push(effekt),
  }
})

const passkey = vi.hoisted(() => ({ bestaetigen: vi.fn() }))
vi.mock('@/lib/auth-client-passkey', () => ({ passkeySignIn: { passkey: () => passkey.bestaetigen() } }))

import { BestaetigenKarte } from '@/app/admin/bestaetigen/bestaetigen-karte'
import { DOWNLOAD_SPERRE_MS, FRISCH_TEXT } from '@/lib/admin-anmeldung'
import { findeElement } from './element-suche'

// Aufrufstellen von useState in der Karte: laeuft, fehler, gestartet.
const GESTARTET = 2
const WEITER = '/admin/finanzen/export?jahr=2026'
const assign = vi.fn()

function rendere(vorgabe: Record<number, unknown> = {}): string {
  pruefstand.vorgabe = new Map(Object.entries(vorgabe).map(([k, v]) => [Number(k), v]))
  pruefstand.stelle = 0
  pruefstand.effekte.length = 0
  return renderToStaticMarkup(createElement(BestaetigenKarte, { weiter: WEITER }))
}

/** Der Klick-Griff des Knopfes, so wie die Komponente ihn baut. */
function knopfKlick(): () => void {
  pruefstand.stelle = 0
  const baum = BestaetigenKarte({ weiter: WEITER })
  const knopf = findeElement(baum, 'button')
  expect(knopf, 'Knopf').not.toBeNull()
  return knopf?.props.onClick as () => void
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.stubGlobal('window', { location: { assign } })
  pruefstand.gesetzt.length = 0
  pruefstand.vorgabe = new Map()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Karte „Mit Passkey bestätigen“ — Hinweis zum Download', () => {
  it('geglückt: weiter zum Export, und die Karte merkt sich, dass der Download startet', async () => {
    passkey.bestaetigen.mockResolvedValue({ error: null })

    knopfKlick()()
    await vi.advanceTimersByTimeAsync(0)

    expect(assign).toHaveBeenCalledWith(WEITER)
    expect(pruefstand.gesetzt).toContainEqual({ stelle: GESTARTET, wert: true })
  })

  it('beim Warten auf den Browser ist der Statusbereich leer und der Knopf gesperrt', () => {
    const html = rendere({ 0: true })

    expect(html).toContain('role="status"')
    expect(html).not.toContain(FRISCH_TEXT.downloadStartet)
    expect(html).toMatch(/<button[^>]*\sdisabled=""/)
  })

  it('ohne Download steht der Statusbereich leer da und der Knopf ist frei (Gegenprobe)', () => {
    const html = rendere()

    expect(html).not.toContain(FRISCH_TEXT.downloadStartet)
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/)
    // Der Bereich ist schon da, bevor etwas drinsteht — nur so sagt ihn ein Screenreader an.
    expect(html).toMatch(/<p[^>]*role="status"[^>]*><\/p>/)
  })

  it('beim Start des Downloads: „Der Download startet …“ als role="status", der Knopf gesperrt', () => {
    const html = rendere({ [GESTARTET]: true })

    expect(FRISCH_TEXT.downloadStartet).toBe('Der Download startet …')
    expect(html).toMatch(/<p[^>]*role="status"[^>]*>(?:(?!<\/p>)[\s\S])*Der Download startet …<\/p>/)
    expect(html).toMatch(/<button[^>]*\sdisabled=""/)
  })

  it('nach genau 3 Sekunden ist die Sperre vorbei, vorher nicht', () => {
    expect(DOWNLOAD_SPERRE_MS).toBe(3000)
    rendere({ [GESTARTET]: true })
    expect(pruefstand.effekte).toHaveLength(1)

    pruefstand.effekte[0]()
    vi.advanceTimersByTime(DOWNLOAD_SPERRE_MS - 1)
    expect(pruefstand.gesetzt).not.toContainEqual({ stelle: GESTARTET, wert: false })

    vi.advanceTimersByTime(1)
    expect(pruefstand.gesetzt).toContainEqual({ stelle: GESTARTET, wert: false })
  })

  it('verlässt man die Seite vor Ablauf, räumt die Sperre ihren Zeitgeber weg', () => {
    rendere({ [GESTARTET]: true })

    const aufraeumen = pruefstand.effekte[0]()
    expect(vi.getTimerCount()).toBe(1)
    if (typeof aufraeumen === 'function') aufraeumen()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('ohne Download startet die Sperre nicht (Gegenprobe zum Zeitgeber)', () => {
    rendere()

    pruefstand.effekte[0]?.()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('scheitert die Bestätigung: kein Export, kein Hinweis, keine Sperre', async () => {
    passkey.bestaetigen.mockResolvedValue({ error: { code: 'ERROR_CEREMONY_ABORTED', status: 400 } })

    knopfKlick()()
    await vi.advanceTimersByTimeAsync(0)

    expect(assign).not.toHaveBeenCalled()
    expect(pruefstand.gesetzt.some((g) => g.stelle === GESTARTET && g.wert === true)).toBe(false)
  })
})

// @vitest-environment jsdom
/**
 * /widerruf: Die Positions-Kästchen bleiben verhaltensgleich (A-8, Nr. 279; Pflicht-Gegenlesen „Recht“).
 *
 * Die Kästchen unter „Einzelne Artikel“ laufen seit Nr. 279 über den Baustein `Kaestchen` (ui/kaestchen.tsx) statt
 * eines eigenen `<input type="checkbox">`. A-8 verlangt einen Test vorher und nachher, der nach Klick und Absenden
 * denselben Zustand belegt: Dieser Test lief unverändert grün gegen den Stand vor der Umstellung (Basis db65be18)
 * und danach.
 *
 * Beweist (jsdom, das echte Formular, nur die Server-Aktion ersetzt):
 *  - Ein Klick auf ein Kästchen hakt es an, ein zweiter nimmt den Haken wieder weg; die übrigen bleiben, wie sie sind.
 *  - Nach „Vertrag widerrufen“ und „Widerruf bestätigen“ kommt bei der Aktion genau die Auswahl an
 *    (`umfang: 'teil'`, `positionen` in der Reihenfolge der Klicks) — nicht mehr, nicht weniger.
 *  - Es bleibt ein natives Kästchen (`input[type=checkbox]`, keine Rolle auf einem anderen Element), nie vorab angehakt.
 *  - Gegenprobe: „Die ganze Bestellung“ schickt keine Positionen.
 */
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const aktion = vi.hoisted(() => ({ mitLink: vi.fn(), ohneLink: vi.fn() }))
vi.mock('@/server/actions/widerruf', () => ({ reicheWiderrufMitLinkEin: aktion.mitLink, reicheWiderrufOhneLinkEin: aktion.ohneLink }))

import { WiderrufFormular, type WiderrufBestellAnsicht } from '@/app/(public)/widerruf/widerruf-formular'
import { WIDERRUF_TEXT } from '@/lib/widerruf'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const BESTELLUNG: WiderrufBestellAnsicht = {
  bestellung: 'best-1',
  sig: 'sig-1',
  bestellnummer: 'HM-0001',
  name: 'Franz Müller',
  hof: 'Hof Müller',
  positionen: [
    { id: 'p1', text: '2× Bergkäse (250 g)', hinweis: 'Hinweis eins' },
    { id: 'p2', text: '4× Heumilch frisch (1 L)', hinweis: 'Hinweis zwei' },
    { id: 'p3', text: '1× Butter (250 g)', hinweis: 'Hinweis drei' },
  ],
}

let wurzel: Root | null = null

async function zeichne(): Promise<HTMLElement> {
  const ziel = document.createElement('div')
  document.body.appendChild(ziel)
  wurzel = createRoot(ziel)
  await act(async () => {
    wurzel!.render(createElement(WiderrufFormular, { bestellung: BESTELLUNG }))
  })
  return ziel
}

function knopf(ziel: HTMLElement, text: string): HTMLButtonElement {
  const fund = [...ziel.querySelectorAll('button')].find((b) => b.textContent?.includes(text))
  if (!fund) throw new Error(`Knopf „${text}“ fehlt`)
  return fund
}

async function klicke(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
  })
}

function kaestchen(ziel: HTMLElement): HTMLInputElement[] {
  return [...ziel.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
}

async function absenden(ziel: HTMLElement): Promise<void> {
  const form = ziel.querySelector('form')!
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  // Der zweite Schritt steht nach dem nächsten Bild (requestAnimationFrame setzt nur den Fokus).
  await klicke(knopf(ziel, WIDERRUF_TEXT.knopfBestaetigen))
}

describe('/widerruf: Positions-Kästchen verhaltensgleich (A-8)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    aktion.mitLink.mockReset()
    aktion.mitLink.mockResolvedValue({ ok: true, eingegangenAm: '2027-03-03T18:40:00.000Z' })
  })
  afterEach(async () => {
    await act(async () => wurzel?.unmount())
    wurzel = null
  })

  it('Klick hakt an, zweiter Klick nimmt den Haken weg; übermittelt wird genau die Auswahl', async () => {
    const ziel = await zeichne()
    await klicke(ziel.querySelector<HTMLInputElement>('input[type="radio"][value="teil"]')!)

    const kaesten = kaestchen(ziel)
    expect(kaesten).toHaveLength(3)
    // Nie vorab angehakt, natives Kästchen ohne Ersatzrolle.
    expect(kaesten.map((k) => k.checked)).toEqual([false, false, false])
    expect(ziel.querySelector('[role="checkbox"]')).toBeNull()

    await klicke(kaesten[2]!)
    await klicke(kaesten[0]!)
    await klicke(kaesten[1]!)
    await klicke(kaesten[1]!)
    expect(kaestchen(ziel).map((k) => k.checked)).toEqual([true, false, true])

    await absenden(ziel)
    expect(aktion.mitLink).toHaveBeenCalledTimes(1)
    expect(aktion.mitLink.mock.calls[0]![0]).toMatchObject({ bestellung: 'best-1', sig: 'sig-1', umfang: 'teil', positionen: ['p3', 'p1'] })
  })

  it('Gegenprobe: „Die ganze Bestellung“ schickt keine Positionen', async () => {
    const ziel = await zeichne()
    await absenden(ziel)
    expect(aktion.mitLink.mock.calls[0]![0]).toMatchObject({ umfang: 'ganz', positionen: [] })
  })
})

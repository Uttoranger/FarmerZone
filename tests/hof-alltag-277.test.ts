/**
 * Hof-Alltag nach der Abnahme Lauf 32 (Nr. 277): die kleinen Bausteine, die Produkte, Produkt anlegen und
 * Bestellung neu bekommen — reine Anzeige, jeweils mit Gegenprobe.
 *
 * - `produktEinheit`: die Einheit der Produktliste immer mit Zahl („1 L“, „1 RM“) statt „je L“, „je m³“.
 * - `KlappKarte`: Kennzeichnung (Futter) und Holz-Angaben (Brennmaterial) als aufklappbare Karte; zu mit Satz und
 *   „Angaben eintragen“, nach einem Fehler offen.
 * - `PositionsText`: die Positionszeile G14 („**2** × Hafer im Big Bag (1 Big Bag)“) auch im Dialog „Was fehlt“.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ usePathname: () => '/products', useRouter: () => ({ refresh() {}, push() {} }) }))

import { produktEinheit } from '@/lib/produkte-hof'
import { formatGebinde } from '@/lib/format'
import { KlappKarte } from '@/components/produkte/familien-teile'
import { PositionsText } from '@/components/hof-bestellungen/positions-text'
import { positionszeile } from '@/lib/positionszeile'

describe('produktEinheit — Einheit der Produktliste mit Zahl (Abnahme Lauf 32, produkte Bild 1)', () => {
  it('ohne Gebinde zählt eine Einheit: „1 L“, „1 kg“, „1 Big Bag“ statt „je …“', () => {
    expect(produktEinheit('LITER', null)).toBe('1 L')
    expect(produktEinheit('KG', 1)).toBe('1 kg')
    expect(produktEinheit('BIGBAG', null)).toBe('1 Big Bag')
    expect(produktEinheit('M3', null)).toBe('1 m³')
    // Gegenprobe: der alte Helfer sagt „je …“ — die Liste nimmt ihn nicht mehr.
    expect(formatGebinde('LITER', null)).toBe('je L')
  })

  it('mit Gebinde die Größe; Stück als „Stk.“, Raummeter kurz „RM“ (Tabelle) bzw. lang (Zeile am Handy)', () => {
    expect(produktEinheit('STUECK', 10)).toBe('10 Stk.')
    expect(produktEinheit('G', '500')).toBe('500 g')
    expect(produktEinheit('KG', 5)).toBe('5 kg')
    expect(produktEinheit('RAUMMETER', null)).toBe('1 RM')
    expect(produktEinheit('RAUMMETER', null, 'lang')).toBe('1 Raummeter')
    expect(produktEinheit('PAKET', 6)).toBe('6 Pakete')
  })
})

describe('KlappKarte — Kennzeichnung und Holz-Angaben als aufklappbare Karte (Board s1-/w1-produkt-neu Bild 3/4)', () => {
  type Eigenschaften = Omit<Parameters<typeof KlappKarte>[0], 'children'>
  // Kinder als drittes Argument (react/no-children-prop) — der Typ von createElement verlangt sie sonst in den Props.
  const Karte = KlappKarte as (p: Eigenschaften & { children?: ReactNode }) => React.JSX.Element
  const karte = (props: Partial<Eigenschaften> = {}) =>
    renderToStaticMarkup(
      createElement(
        Karte,
        { titel: 'Kennzeichnung', stand: 'Pflicht · noch offen', satz: 'Ein Satz zur Kennzeichnung.', oeffnenText: 'Angaben eintragen', ...props },
        createElement('input', { id: 'feld-x', 'data-feld': 'x' })
      )
    )

  it('zu: Kopf mit Kurzstand, Satz und „Angaben eintragen“; die Felder bleiben eingehängt, nur verborgen', () => {
    const html = karte()
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('Pflicht · noch offen')
    expect(html).toContain('Ein Satz zur Kennzeichnung.')
    expect(html).toContain('>Angaben eintragen</button>')
    expect(html).toMatch(/<div id="[^"]*-inhalt" hidden=""[^>]*><input id="feld-x"/)
  })

  it('nach einem Fehler offen (immerOffen): kein Öffnen-Knopf, Kurzstand orange, Felder sichtbar', () => {
    const html = karte({ immerOffen: true, fehler: true, stand: 'Pflicht · Bitte prüfen' })
    expect(html).toContain('aria-expanded="true"')
    expect(html).not.toContain('Angaben eintragen')
    expect(html).toContain('text-status-offen')
    expect(html).not.toMatch(/-inhalt" hidden/)
  })

  it('Holz-Angaben: anfangs offen, ohne Öffnen-Knopf', () => {
    const html = karte({ titel: 'Holz-Angaben', stand: 'Die drei Fragen, die jede Kundin stellt.', satz: undefined, oeffnenText: undefined, anfangsOffen: true })
    expect(html).toContain('aria-expanded="true"')
    expect(html).not.toContain('<button type="button" class="inline-flex min-h-[52px]')
  })
})

describe('PositionsText — Positionszeile G14 im Dialog „Was fehlt“ und in der Vorschau (Abnahme Lauf 32, bestellung Bild 3)', () => {
  it('Anzahl fett vorn, Gebinde in Klammern', () => {
    const teile = positionszeile({ name: 'Hafer im Big Bag', quantity: 2, unit: 'BIGBAG', unitSize: null })
    const html = renderToStaticMarkup(createElement(PositionsText, { zeile: 'Hafer im Big Bag · 2 Big Bags', teile }))
    expect(html).toBe('<span class="font-bold">2</span> × Hafer im Big Bag (1 Big Bag)')
    // Gegenprobe: ohne Teile die alte Zeile.
    expect(renderToStaticMarkup(createElement(PositionsText, { zeile: 'Hafer im Big Bag · 2 Big Bags' }))).toBe('Hafer im Big Bag · 2 Big Bags')
  })
})

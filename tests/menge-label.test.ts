// @vitest-environment jsdom
/**
 * Runde 1 Nr. 271: Das Label „Menge“ umschließt den Mengen-Stepper der Produktseite. Ein Tipp auf das Wort darf
 * die Menge nicht senken (der Browser leitet ihn sonst an den Minus-Knopf, das erste beschriftbare Kind), sondern
 * setzt den Fokus ins Feld. Gebaut wie die Pille aus ui/stepper.tsx: − · Feld · +.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mengeLabelTipp } from '@/components/produktdetail/menge-label'

function baue(mitTipp: boolean) {
  document.body.innerHTML =
    '<label id="l"><span id="wort">Menge</span><div><button type="button" id="minus">−</button><input id="feld" value="2" /><button type="button" id="plus">+</button></div></label>'
  const label = document.getElementById('l') as HTMLLabelElement
  let minus = 0
  document.getElementById('minus')?.addEventListener('click', () => (minus += 1))
  if (mitTipp) label.addEventListener('click', (e) => mengeLabelTipp({ target: e.target, currentTarget: label, preventDefault: () => e.preventDefault() }))
  return { anzahlMinus: () => minus }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Tipp auf „Menge“', () => {
  it('senkt die Menge nicht und setzt den Fokus ins Feld', () => {
    const { anzahlMinus } = baue(true)
    document.getElementById('wort')?.click()
    expect(anzahlMinus()).toBe(0)
    expect(document.activeElement?.id).toBe('feld')
  })

  it('der Minus-Knopf selbst wirkt weiter genau einmal', () => {
    const { anzahlMinus } = baue(true)
    document.getElementById('minus')?.click()
    expect(anzahlMinus()).toBe(1)
  })

  it('Gegenprobe: ohne den Eingriff leitet der Browser den Tipp an den Minus-Knopf', () => {
    const { anzahlMinus } = baue(false)
    document.getElementById('wort')?.click()
    expect(anzahlMinus()).toBe(1)
  })
})

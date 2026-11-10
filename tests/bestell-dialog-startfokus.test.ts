// @vitest-environment jsdom
/**
 * Startfokus der Rückfragen (Nr. 237, Runde 1): „Abbrechen“ wird nur im eigenen
 * Popup gesucht — der schließende Dialog daneben steht noch kurz im DOM.
 */
import { describe, it, expect } from 'vitest'
import { abbrechenIn } from '@/components/hof-bestellungen/bestell-dialog'

describe('abbrechenIn', () => {
  it('nimmt „Abbrechen“ im eigenen Popup, nie im schließenden Dialog daneben', () => {
    document.body.innerHTML = `
      <div id="alt" data-slot="dialog-mitte"><button id="fremd" data-slot="dialog-close">Abbrechen</button></div>
      <div id="neu" data-slot="dialog-mitte"><button id="eigen" data-slot="dialog-close">Abbrechen</button></div>`
    expect(abbrechenIn(document.getElementById('neu'))).toBe(document.getElementById('eigen'))
    expect(abbrechenIn(document.getElementById('alt'))).toBe(document.getElementById('fremd'))
  })

  it('findet das Schließen im Kopf des Blatts und fällt sonst auf den Standard zurück', () => {
    document.body.innerHTML = `<div id="blatt"><div data-slot="sheet-kopf"><button id="zu" data-slot="sheet-close">Abbrechen</button></div></div><div id="leer"></div>`
    expect(abbrechenIn(document.getElementById('blatt'))).toBe(document.getElementById('zu'))
    expect(abbrechenIn(document.getElementById('leer'))).toBe(true)
    expect(abbrechenIn(null)).toBe(true)
  })
})

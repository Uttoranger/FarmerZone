/**
 * Wache (Register N29, Ergänzung 26.10.2026, Nr. 195): Aktionen, die der Server
 * schon ausgeführt haben kann, zeigen am Netz `NETZ_SATZ_UNSICHER` statt
 * „Nochmal" — Storno, Statuswechsel einer Bestellung und das Bezahlen.
 *
 * Geprüft wird der Quelltext: Jeder Aufruf von `aktionOhneWurf` in den drei
 * Bauteilen der Bestellung trägt `unsicher: true`, und die Kasse zeigt beim
 * Verbindungsfehler von Stripe den unsicheren Satz. Gegenprobe: Der Prüfer
 * schlägt bei einem Aufruf ohne die Option an.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DATEIEN = [
  'src/components/hof-bestellungen/bestell-detail.tsx',
  'src/components/hof-bestellungen/storno-dialog.tsx',
  'src/components/hof-bestellungen/artikel-fehlt-dialog.tsx',
]

/** Zeilen mit einem Aufruf von aktionOhneWurf, denen `unsicher: true` fehlt (Importzeilen zählen nicht). */
function ohneUnsicher(quelle: string): string[] {
  return quelle
    .split('\n')
    .filter((zeile) => /aktionOhneWurf\(/.test(zeile) && !/^\s*import /.test(zeile) && !zeile.includes('unsicher: true'))
    .map((zeile) => zeile.trim())
}

describe('Netzsatz bei nicht wiederholbaren Aktionen', () => {
  it.each(DATEIEN)('%s: jeder Aufruf trägt unsicher: true', (datei) => {
    const quelle = readFileSync(join(process.cwd(), datei), 'utf8')
    expect(quelle).toMatch(/aktionOhneWurf\(/)
    expect(ohneUnsicher(quelle)).toEqual([])
  })

  it('Gegenprobe: ein Aufruf ohne die Option wird gefunden, einer mit nicht', () => {
    expect(ohneUnsicher('await aktionOhneWurf(() => cancelOrder(id))')).toHaveLength(1)
    expect(ohneUnsicher('await aktionOhneWurf(() => cancelOrder(id), { unsicher: true })')).toEqual([])
  })

  it('die Kasse zeigt beim Verbindungsfehler von Stripe den unsicheren Satz', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/components/checkout/stripe-payment.tsx'), 'utf8')
    expect(quelle).toMatch(/art === 'netz'\) setFehler\(NETZ_SATZ_UNSICHER\)/)
  })
})

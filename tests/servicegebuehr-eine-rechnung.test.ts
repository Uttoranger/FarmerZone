/**
 * Architektur-Test: Die Servicegebühr hat genau EINE Rechnung —
 * `berechneServicegebuehr` in src/lib/servicegebuehr.ts (E4, Gate 3.4).
 *
 * Beweist:
 *  - Kein Modul in src/ außer servicegebuehr.ts rechnet mit dem Prozentsatz
 *    oder der Mindestgebühr des Hofes (`serviceFeePercent` / `serviceFeeMinCents`
 *    neben `*`, `/` oder `Math.max`). Durchreichen, Anzeigen und Speichern
 *    der Einstellung bleiben erlaubt.
 *  - Die beiden Stellen, an denen aus Warenpreis und Einstellung eine Gebühr
 *    wird — die Anzeige im Checkout-Formular und /api/checkout (Snapshot und
 *    Stripe) — rufen berechneServicegebuehr, und beide bilden den Warenpreis in
 *    Cent auf demselben Weg (calcTotalAmount → decimalZuCents). Sonst könnte
 *    die Aufrundung im Browser einen anderen Cent zeigen als gespeichert wird.
 *  - Gegenprobe: Das Suchmuster schlägt auf typische Nachrechnungen an.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const WURZEL = join(__dirname, '..')
const SRC = join(WURZEL, 'src')

function quelldateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return quelldateien(pfad)
    return /\.(ts|tsx)$/.test(name) ? [pfad] : []
  })
}

/** Rechnet diese Zeile mit dem Gebührensatz oder der Mindestgebühr? */
const NACHRECHNUNG =
  /serviceFee(Percent|MinCents)\b[\w.()]*\s*[*/]|[*/]\s*[\w.()]*serviceFee(Percent|MinCents)\b|Math\.(max|ceil|round|floor)\([^)]*serviceFee(Percent|MinCents)\b/

function nachrechnungen(text: string): string[] {
  return text.split('\n').filter((zeile) => NACHRECHNUNG.test(zeile))
}

describe('Servicegebühr: eine Rechnung', () => {
  it('Gegenprobe: das Muster erkennt typische Nachrechnungen', () => {
    expect(nachrechnungen('const g = waren * farm.serviceFeePercent / 100')).toHaveLength(1)
    expect(nachrechnungen('const g = Number(farm.serviceFeePercent) * waren')).toHaveLength(1)
    expect(nachrechnungen('return Math.max(anteil, farm.serviceFeeMinCents)')).toHaveLength(1)
    expect(nachrechnungen('const g = Math.ceil(waren * f.serviceFeePercent)')).toHaveLength(1)
    // Durchreichen und Anzeigen bleiben erlaubt
    expect(nachrechnungen('serviceFeePercent: Number(farm.serviceFeePercent),')).toHaveLength(0)
    expect(nachrechnungen('const mindest = (minCents / 100).toFixed(2)')).toHaveLength(0)
  })

  it('kein Modul außer servicegebuehr.ts rechnet die Gebühr selbst nach', () => {
    const funde = quelldateien(SRC)
      .filter((pfad) => !pfad.endsWith(join('lib', 'servicegebuehr.ts')))
      .flatMap((pfad) =>
        nachrechnungen(readFileSync(pfad, 'utf8')).map((zeile) => `${relative(WURZEL, pfad)}: ${zeile.trim()}`)
      )
    expect(funde).toEqual([])
  })

  // Seit Nr. 12 rechnet die Kasse über kassenBetraege (src/lib/kasse.ts) —
  // die Anzeige-Rechnung steht dort, das Formular ruft nur sie.
  it.each([
    ['src/lib/kasse.ts'],
    ['src/app/api/checkout/route.ts'],
  ])('%s rechnet mit berechneServicegebuehr und demselben Warenpreis-Weg', (datei) => {
    const text = readFileSync(join(WURZEL, datei), 'utf8')
    expect(text).toMatch(/berechneServicegebuehr\(/)
    expect(text).toMatch(/calcTotalAmount\(/)
    expect(text).toMatch(/decimalZuCents\(/)
  })

  it('das Kassen-Formular rechnet nicht selbst, sondern über kassenBetraege', () => {
    const text = readFileSync(join(WURZEL, 'src/components/checkout/checkout-form.tsx'), 'utf8')
    expect(text).toMatch(/kassenBetraege\(/)
    expect(text).not.toMatch(/berechneServicegebuehr\(|price \* |\.price \*/)
  })
})

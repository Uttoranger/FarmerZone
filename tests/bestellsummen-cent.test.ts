/**
 * `bestellSummen` (src/lib/servicegebuehr.ts) wandelt den Warenpreis über
 * `alsCents` in ganze Cent — denselben Weg wie /api/checkout
 * (`decimalZuCents`, der Stripe-Betrag) und „Artikel fehlt" (`alsCents`).
 * Vorher stand dort `Math.round(alsZahl(totalAmount) * 100)` (Nr. 35,
 * Morgenbericht Lauf 6 §6; CODING_STANDARDS §2 Geld, Register G1).
 *
 * Beweist:
 *  - Betragsgleich für jeden gültigen Wert: `Order.totalAmount` ist
 *    Decimal(10,2); für jeden Betrag mit höchstens zwei Nachkommastellen — als
 *    Prisma-Decimal, als Text und als Zahl aus JSON — liefert die neue Rechnung
 *    genau den Cent-Betrag, den die alte lieferte und den Stripe bekommt.
 *  - Grenzfälle: 0,005 € → 1 Cent (wie bisher). Drei Nachkommastellen kann die
 *    Spalte nicht speichern; kämen sie als Text oder Zahl, rundet jetzt Decimal
 *    kaufmännisch (1,005 → 101) statt Float (1,005 × 100 = 100,49999… → 100) —
 *    wie der Checkout.
 *  - Unlesbares (leer, Text, NaN) bleibt wie bisher 0 Cent statt die Anzeige
 *    zu sprengen.
 *  - Quelltext: kein `Math.round(… * 100)` mehr in bestellSummen.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { barZuKassierenCents, bestellSummen } from '@/lib/servicegebuehr'
import { alsCents, decimalZuCents } from '@/lib/order-totals'

/** Die alte Rechnung, wörtlich — nur als Vergleich für die Betragsgleichheit. */
function alteRechnung(totalAmount: number | string | { toString(): string }): number {
  const n = typeof totalAmount === 'number' ? totalAmount : Number(totalAmount.toString())
  return Math.round((Number.isFinite(n) ? n : 0) * 100)
}

/** Ein Cent-Betrag als Euro-Text mit zwei Stellen, ohne Float: 1234 → „12.34". */
function euroText(cent: number): string {
  return `${Math.floor(cent / 100)}.${String(cent % 100).padStart(2, '0')}`
}

const warenpreis = (totalAmount: number | string | { toString(): string }) =>
  bestellSummen({ totalAmount, serviceFeeCents: 0 }).warenpreisCents

describe('bestellSummen — betragsgleich für jeden gültigen Wert', () => {
  it('0 bis 2.000 € auf den Cent genau: Decimal, Text und Zahl wie vorher und wie Stripe', () => {
    for (let cent = 0; cent <= 200_000; cent++) {
      const text = euroText(cent)
      const decimal = new Prisma.Decimal(text)
      const zahl = Number(text)
      const ergebnis = [warenpreis(decimal), warenpreis(text), warenpreis(zahl)]
      if (ergebnis.some((e) => e !== cent)) throw new Error(`${text}: ${ergebnis.join(' / ')} statt ${cent}`)
      if (alteRechnung(decimal) !== cent || alteRechnung(zahl) !== cent) throw new Error(`alt ${text}`)
      if (decimalZuCents(decimal) !== cent) throw new Error(`Stripe ${text}`)
    }
  })

  it('große Beträge bis zur Grenze von Decimal(10,2)', () => {
    const werte = [99_999_999_99, 12_345_678_90, 1_000_000_00, 98_765_432_17, 50_000_000_01]
    for (const cent of werte) {
      const text = euroText(cent)
      expect(warenpreis(new Prisma.Decimal(text))).toBe(cent)
      expect(warenpreis(text)).toBe(cent)
      expect(warenpreis(Number(text))).toBe(cent)
      expect(alteRechnung(new Prisma.Decimal(text))).toBe(cent)
    }
  })

  it('so wie Prisma Decimal ausgibt: „20", „20.5", „0.1"', () => {
    expect(warenpreis(new Prisma.Decimal('20.00'))).toBe(2000)
    expect(warenpreis(new Prisma.Decimal('20.50'))).toBe(2050)
    expect(warenpreis(new Prisma.Decimal('0.10'))).toBe(10)
    expect(warenpreis({ toString: () => '7.00' })).toBe(700)
  })

  it('das Float-Artefakt 3 × 1,10 als Zahl ergibt trotzdem 330 Cent', () => {
    expect(warenpreis(3 * 1.1)).toBe(330)
    expect(warenpreis(0.1 + 0.2)).toBe(30)
  })

  it('Gesamt und „Bar zu kassieren" bleiben Warenpreis plus Gebühr', () => {
    const bestellung = { totalAmount: new Prisma.Decimal('21.09'), serviceFeeCents: 106 }
    expect(bestellSummen(bestellung)).toEqual({ warenpreisCents: 2109, gebuehrCents: 106, gesamtCents: 2215 })
    expect(barZuKassierenCents({ ...bestellung, paymentMethod: 'ONSITE_CASH' })).toBe(2215)
  })
})

describe('bestellSummen — Grenzfälle', () => {
  it('0,005 € → 1 Cent (kaufmännisch, wie bisher)', () => {
    expect(warenpreis('0.005')).toBe(1)
    expect(alteRechnung('0.005')).toBe(1)
  })

  it('drei Nachkommastellen (nie aus der Datenbank): Decimal rundet kaufmännisch wie der Checkout', () => {
    // Float: 1,005 × 100 = 100,49999999999999 → 100. Decimal: 100,5 → 101.
    expect(alteRechnung('1.005')).toBe(100)
    expect(warenpreis('1.005')).toBe(101)
    expect(warenpreis('1.255')).toBe(126)
    expect(warenpreis('1.005')).toBe(alsCents('1.005'))
  })

  it('Unlesbares bleibt 0 Cent wie bisher, statt die Anzeige zu sprengen', () => {
    expect(warenpreis('')).toBe(0)
    expect(warenpreis('abc')).toBe(0)
    expect(warenpreis(Number.NaN)).toBe(0)
    expect(warenpreis(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('bestellSummen — Quelltext', () => {
  const QUELLE = readFileSync(join(process.cwd(), 'src/lib/servicegebuehr.ts'), 'utf8')
  const funktion = /export function bestellSummen[\s\S]*?\n}/.exec(QUELLE)?.[0] ?? ''

  it('rechnet über alsCents, nicht über Math.round(Zahl * 100)', () => {
    expect(funktion).not.toBe('')
    expect(funktion).not.toMatch(/Math\.round\(.*\*\s*100\)/)
    expect(QUELLE).toMatch(/import \{[^}]*\balsCents\b[^}]*\} from '@\/lib\/order-totals'/)
  })

  it('Gegenprobe: die Suche erkennt den alten Weg', () => {
    expect('const warenpreisCents = Math.round(alsZahl(bestellung.totalAmount) * 100)').toMatch(/Math\.round\(.*\*\s*100\)/)
  })
})

/**
 * Nr. 244 (Morgenbericht 31, „Bestätigung bei Bar“): Ist die Gebühr einer Bestellung entfallen bzw. erstattet
 * (gebuehrEntfallen), zeigen Bestätigung und Bestellseite als „Gesamt“ den Warenpreis — die Gebührenzeile bleibt
 * durchgestrichen stehen. Vorher stand dort Warenpreis + Gebühr, obwohl die Zeile darüber sie strich.
 */
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BestellPositionen } from '@/components/bestaetigung/bestaetigung-teile'
import { anzeigeGesamtCents, barZuKassierenCents, bestellSummen, gebuehrEntfallenVermerk, gebuehrErstattungOffen } from '@/lib/servicegebuehr'

const ENTFALLEN_AM = new Date('2026-11-05T10:00:00.000Z')

type Summen = {
  totalAmount: string
  serviceFeeCents: number
  serviceFeeRefundedAt: Date | null
  paymentMethod: string
  gebuehrModell?: string | null
}

function positionen(summen: Summen, summeInZahlzeile = false): string {
  return renderToStaticMarkup(
    createElement(BestellPositionen, {
      positionen: [{ text: '2 × Freilandeier', betragCents: 980 }],
      // Die Zahlzeile entsteht seit Nr. 253 in zahlzeileFuer aus Zahlart und Zahlstand der Bestellung.
      summen: { ...summen, paymentStatus: summen.paymentMethod === 'ONLINE' ? 'PAID' : 'PENDING' },
      summeInZahlzeile,
    })
  ).replace(/<!-- -->/g, '')
}

describe('Bestätigung: „Gesamt“ ohne entfallene Gebühr', () => {
  it('bar mit entfallener Gebühr: Gesamt ist der Warenpreis, die Gebühr steht durchgestrichen daneben', () => {
    const html = positionen({ totalAmount: '9.80', serviceFeeCents: 60, serviceFeeRefundedAt: ENTFALLEN_AM, paymentMethod: 'ONSITE_CASH' })
    expect(html).toMatch(/Gesamt <span[^>]*>€\s9,80<\/span>/)
    expect(html).toContain('(entfällt)')
    expect(html).toMatch(/<span class="[^"]*line-through[^"]*">€\s0,60<\/span>/)
  })

  it('Bestellseite: dieselbe Regel in der Zahlzeile (summeInZahlzeile)', () => {
    const html = positionen({ totalAmount: '9.80', serviceFeeCents: 60, serviceFeeRefundedAt: ENTFALLEN_AM, paymentMethod: 'ONLINE' }, true)
    expect(html).toMatch(/>Online · Bezahlt · €\s9,80<\/p>/)
    expect(html).toContain('(erstattet)')
    expect(html).toMatch(/<span class="[^"]*line-through[^"]*">€\s0,60<\/span>/)
  })
})

describe('Bestätigung: Gebühr gilt noch oder gab es nie', () => {
  it('NOT_PICKED_UP online mit offener Erstattung: Gesamt MIT Gebühr, die Gebühr steht nicht durchgestrichen', () => {
    const html = positionen({ totalAmount: '9.80', serviceFeeCents: 60, serviceFeeRefundedAt: null, paymentMethod: 'ONLINE' })
    expect(html).toMatch(/Gesamt <span[^>]*>€\s10,40<\/span>/)
    expect(html).not.toContain('line-through')
  })

  it('Gebühr 0: Gesamt ist der Warenpreis, keine Gebührenzeile', () => {
    const html = positionen({ totalAmount: '9.80', serviceFeeCents: 0, serviceFeeRefundedAt: null, paymentMethod: 'ONSITE_CASH' })
    expect(html).toMatch(/Gesamt <span[^>]*>€\s9,80<\/span>/)
    expect(html).not.toContain('Servicegebühr')
    expect(html).not.toContain('Plattformgebühr')
  })

  it('Hofpreis-Modell mit entfallener Gebühr: Gesamt ist der Warenpreis, „Plattformgebühr (entfällt)“ bleibt stehen', () => {
    const html = positionen({ totalAmount: '9.80', serviceFeeCents: 60, serviceFeeRefundedAt: ENTFALLEN_AM, paymentMethod: 'ONSITE_CASH', gebuehrModell: 'hofpreis' })
    expect(html).toMatch(/Gesamt <span[^>]*>€\s9,80<\/span>/)
    expect(html).toMatch(/Plattformgebühr<span[^>]*> \(entfällt\)<\/span> · <span class="[^"]*line-through[^"]*">€\s0,60<\/span>/)
  })
})

describe('anzeigeGesamtCents: nur Anzeige, die Snapshot-Beträge bleiben', () => {
  type Fall = { name: string; b: Summen & { status: string }; anzeige: number; gesamt: number; kassieren: number | null }
  const ERSTATTUNG_OFFEN: Fall['b'] = { status: 'NOT_PICKED_UP', totalAmount: '19.99', serviceFeeCents: 120, serviceFeeRefundedAt: null, paymentMethod: 'ONLINE' }
  const FAELLE: Fall[] = [
    // (a) bar mit entfallener Gebühr (Storno, „nicht abgeholt“, verfallen)
    { name: '(a) bar, Gebühr entfallen', b: { status: 'CANCELLED', totalAmount: '9.80', serviceFeeCents: 60, serviceFeeRefundedAt: ENTFALLEN_AM, paymentMethod: 'ONSITE_CASH' }, anzeige: 980, gesamt: 1040, kassieren: 1040 },
    // (b) online, Gebühr erstattet
    { name: '(b) online, Gebühr erstattet', b: { status: 'CANCELLED', totalAmount: '19.99', serviceFeeCents: 120, serviceFeeRefundedAt: ENTFALLEN_AM, paymentMethod: 'ONLINE' }, anzeige: 1999, gesamt: 2119, kassieren: null },
    // (c) nicht abgeholt, online, Erstattung steht noch aus
    { name: '(c) NOT_PICKED_UP online, Erstattung offen', b: ERSTATTUNG_OFFEN, anzeige: 2119, gesamt: 2119, kassieren: null },
    // (d) Hofpreis-Modell (N38), Gebühr entfallen
    { name: '(d) Hofpreis-Modell, Gebühr entfallen', b: { status: 'NOT_PICKED_UP', totalAmount: '12.50', serviceFeeCents: 75, serviceFeeRefundedAt: ENTFALLEN_AM, paymentMethod: 'ONSITE_CASH', gebuehrModell: 'hofpreis' }, anzeige: 1250, gesamt: 1325, kassieren: 1325 },
    // (e) Gebühr 0 (bar vor dem Stichtag, B1)
    { name: '(e) Gebühr 0', b: { status: 'PICKED_UP', totalAmount: '9.80', serviceFeeCents: 0, serviceFeeRefundedAt: null, paymentMethod: 'ONSITE_CASH' }, anzeige: 980, gesamt: 980, kassieren: 980 },
    { name: 'Gebühr gilt, bar', b: { status: 'CONFIRMED', totalAmount: '9.80', serviceFeeCents: 60, serviceFeeRefundedAt: null, paymentMethod: 'ONSITE_CASH' }, anzeige: 1040, gesamt: 1040, kassieren: 1040 },
  ]

  for (const f of FAELLE) {
    it(`${f.name}: Gesamt der Anzeige ${f.anzeige} Cent`, () => {
      expect(anzeigeGesamtCents(f.b)).toBe(f.anzeige)
    })

    it(`${f.name}: bestellSummen und barZuKassierenCents bleiben beim Snapshot (f)`, () => {
      expect(bestellSummen(f.b).gesamtCents).toBe(f.gesamt)
      expect(barZuKassierenCents(f.b)).toBe(f.kassieren)
    })
  }

  it('(c) passt zu gebuehrErstattungOffen: solange die Erstattung aussteht, zählt die Gebühr mit', () => {
    expect(gebuehrErstattungOffen(ERSTATTUNG_OFFEN)).toBe(true)
    expect(anzeigeGesamtCents(ERSTATTUNG_OFFEN)).toBe(bestellSummen(ERSTATTUNG_OFFEN).gesamtCents)
  })
})

describe('gebuehrEntfallenVermerk: ein Wort für Bildschirm und Papier', () => {
  it('online erstattet, vor Ort entfällt, sonst nichts', () => {
    expect(gebuehrEntfallenVermerk({ paymentMethod: 'ONLINE', serviceFeeRefundedAt: ENTFALLEN_AM })).toBe('erstattet')
    expect(gebuehrEntfallenVermerk({ paymentMethod: 'ONSITE_CASH', serviceFeeRefundedAt: ENTFALLEN_AM })).toBe('entfällt')
    expect(gebuehrEntfallenVermerk({ paymentMethod: 'ONSITE_CARD', serviceFeeRefundedAt: ENTFALLEN_AM })).toBe('entfällt')
    expect(gebuehrEntfallenVermerk({ paymentMethod: 'ONLINE', serviceFeeRefundedAt: null })).toBeNull()
  })
})

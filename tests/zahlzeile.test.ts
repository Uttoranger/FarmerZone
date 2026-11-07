/**
 * Nr. 253 (Liste Lauf 32, bestaetigung und bestellung-link): EINE Zahlzeile für Bestätigung, Bestellseite und
 * Bar-Bestätigen. Wort und Satz nur aus der Bestellung (Snapshot), nie fester Text, nie die Hofeinstellung;
 * Modell „bisher“ bzw. null behält die bisherige Zeile; entfallene Gebühr ohne „inkl.“.
 */
import { describe, expect, it } from 'vitest'
import { barBestaetigenZahlzeile, zahlzeileFuer, type ZahlzeilenBestellung } from '@/lib/zahlzeile'

const ENTFALLEN_AM = new Date('2026-11-05T10:00:00.000Z')

function bestellung(teil: Partial<ZahlzeilenBestellung> = {}): ZahlzeilenBestellung {
  return {
    totalAmount: '18.04',
    serviceFeeCents: 108,
    serviceFeeRefundedAt: null,
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    gebuehrModell: 'hofpreis',
    serviceFeePercentApplied: '6.00',
    ...teil,
  }
}

// Formatierer setzen ein festes Leerzeichen zwischen € und Betrag.
const ohneFest = (s: string): string => s.replace(/\u00a0/g, ' ')

describe('Modell hofpreis: Wortlaut der Boards', () => {
  it('online bezahlt: „Online bezahlt · inkl. Plattformgebühr (6 %)“', () => {
    expect(ohneFest(zahlzeileFuer(bestellung()))).toBe('Online bezahlt · inkl. Plattformgebühr (6 %)')
  })

  it('bar: „Bar bei Abholung · inkl. Plattformgebühr (6 %)“, ohne „Noch offen“', () => {
    expect(ohneFest(zahlzeileFuer(bestellung({ paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING' })))).toBe(
      'Bar bei Abholung · inkl. Plattformgebühr (6 %)'
    )
  })

  it('Bestellseite mit Betrag: „Online bezahlt · € 19,12 inkl. Plattformgebühr (6 %)“', () => {
    expect(ohneFest(zahlzeileFuer(bestellung(), { mitBetrag: true }))).toBe('Online bezahlt · € 19,12 inkl. Plattformgebühr (6 %)')
  })

  it('der Satz kommt aus dem Snapshot der Bestellung: 6,5 % bleibt 6,5 %', () => {
    expect(ohneFest(zahlzeileFuer(bestellung({ serviceFeePercentApplied: '6.50' })))).toBe('Online bezahlt · inkl. Plattformgebühr (6,5 %)')
  })

  it('Gegenprobe: ein anderer Satz der Bestellung ergibt eine andere Zeile (kein fester Text „6 %“)', () => {
    expect(ohneFest(zahlzeileFuer(bestellung({ serviceFeePercentApplied: '4.00' })))).toContain('(4 %)')
    expect(ohneFest(zahlzeileFuer(bestellung({ serviceFeePercentApplied: '4.00' })))).not.toContain('6 %')
  })

  it('ohne gespeicherten Satz keine Klammer — nie die Vorgabe des Hofs einsetzen', () => {
    expect(ohneFest(zahlzeileFuer(bestellung({ serviceFeePercentApplied: null })))).toBe('Online bezahlt · inkl. Plattformgebühr')
  })

  it('unlesbarer Satz: keine Klammer — nie die Vorgabe (6 %) als Rückfall', () => {
    for (const unlesbar of ['abc', '', '6,00', '-6.00']) {
      const zeile = ohneFest(zahlzeileFuer(bestellung({ serviceFeePercentApplied: unlesbar })))
      expect(zeile).toBe('Online bezahlt · inkl. Plattformgebühr')
      expect(zeile).not.toContain('%')
    }
    // Gegenprobe: ein lesbarer Decimal-artiger Wert ergibt die Klammer.
    expect(ohneFest(zahlzeileFuer(bestellung({ serviceFeePercentApplied: { toString: () => '7.25' } })))).toBe(
      'Online bezahlt · inkl. Plattformgebühr (7,25 %)'
    )
  })

  it('entfallene bzw. erstattete Gebühr: kein „inkl.“, Betrag ohne Gebühr', () => {
    const b = bestellung({ serviceFeeRefundedAt: ENTFALLEN_AM })
    expect(ohneFest(zahlzeileFuer(b))).toBe('Online bezahlt')
    expect(ohneFest(zahlzeileFuer(b, { mitBetrag: true }))).toBe('Online bezahlt · € 18,04')
    const bar = bestellung({ paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeRefundedAt: ENTFALLEN_AM })
    expect(ohneFest(zahlzeileFuer(bar))).toBe('Bar bei Abholung')
  })

  it('Gebühr 0: kein „inkl.“', () => {
    expect(ohneFest(zahlzeileFuer(bestellung({ serviceFeeCents: 0, serviceFeePercentApplied: null })))).toBe('Online bezahlt')
  })

  it('online nicht bezahlt: der Stand bleibt sichtbar (nie „bezahlt“ ohne Zahlung)', () => {
    expect(ohneFest(zahlzeileFuer(bestellung({ paymentStatus: 'REFUNDED' })))).toBe('Online · Rückerstattet · inkl. Plattformgebühr (6 %)')
    expect(ohneFest(zahlzeileFuer(bestellung({ paymentStatus: 'PENDING' })))).not.toContain('bezahlt')
  })
})

describe('Modell bisher bzw. null: die bisherige Zahlzeile', () => {
  it('gebuehrModell null: „Online · Bezahlt · inkl. Servicegebühr“, ohne Satz', () => {
    expect(ohneFest(zahlzeileFuer(bestellung({ gebuehrModell: null, serviceFeePercentApplied: '5.00' })))).toBe('Online · Bezahlt · inkl. Servicegebühr')
  })

  it('„bisher“ bar: „Bar bei Abholung · Noch offen · inkl. Servicegebühr“', () => {
    expect(
      zahlzeileFuer(bestellung({ gebuehrModell: 'bisher', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeePercentApplied: '5.00' }))
    ).toBe('Bar bei Abholung · Noch offen · inkl. Servicegebühr')
  })

  it('bisher mit Betrag (Bestellseite) wie vorher', () => {
    expect(ohneFest(zahlzeileFuer(bestellung({ gebuehrModell: null }), { mitBetrag: true }))).toBe('Online · Bezahlt · € 19,12 inkl. Servicegebühr')
  })

  it('bisher entfallen: kein „inkl.“', () => {
    expect(ohneFest(zahlzeileFuer(bestellung({ gebuehrModell: null, serviceFeeRefundedAt: ENTFALLEN_AM })))).toBe('Online · Bezahlt')
  })
})

describe('Bar-Bestätigen: Hofpreis mit Zahlzeile, bisher mit der alten Zeile', () => {
  const bar = { paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING' }

  it('gebuehrModell null bzw. „bisher“: nur „Bar bei Abholung“ wie vor Nr. 253', () => {
    expect(barBestaetigenZahlzeile(bestellung({ ...bar, gebuehrModell: null, serviceFeePercentApplied: '5.00' }))).toBe('Bar bei Abholung')
    expect(barBestaetigenZahlzeile(bestellung({ ...bar, gebuehrModell: 'bisher', serviceFeePercentApplied: '5.00' }))).toBe('Bar bei Abholung')
  })

  it('Gegenprobe Hofpreis: die volle Zahlzeile mit Satz aus dem Snapshot', () => {
    expect(ohneFest(barBestaetigenZahlzeile(bestellung({ ...bar, serviceFeePercentApplied: '6.00' })))).toBe('Bar bei Abholung · inkl. Plattformgebühr (6 %)')
  })
})

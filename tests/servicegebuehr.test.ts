/**
 * Tests für die Servicegebühr (src/lib/servicegebuehr.ts) — reine Rechnung.
 *
 * Beweist: gebührenfrei (kein Datum) → 0; Datum in der Zukunft → 0; 20 € bei
 * 4,9 % → 98 Cent; 6 € → Mindestgebühr 50 Cent; kaufmännische Rundung am
 * Halbcent-Fall (5 € × 4,9 % = 24,5 → 25 Cent); der angewendete Prozentsatz
 * steht im Ergebnis. Snapshot: Die Summen einer Bestellung kommen aus IHREM
 * Snapshot — eine spätere Änderung der Hofeinstellung ändert nichts. Dazu
 * „Bar zu kassieren", der abgeleitete Erstattungs-Vermerk und die Wiener
 * Mitternacht für „Gebühr gilt ab".
 */
import { describe, expect, it } from 'vitest'
import {
  barZuKassierenCents,
  berechneServicegebuehr,
  bestellSummen,
  einstellungKurz,
  gebuehrEntfallen,
  gebuehrErstattungOffen,
  istMonatsschluessel,
  kalendertagInWien,
  monatsAbstand,
  monatVerschoben,
  monatsgrenzenWien,
  monatsgrenzenWienFuer,
  monatsschluessel,
  monatsschluesselInWien,
  wienerMitternacht,
  zerlegeMonat,
  type ServicegebuehrEinstellung,
} from '@/lib/servicegebuehr'

const AKTIV: ServicegebuehrEinstellung = {
  serviceFeePercent: 4.9,
  serviceFeeMinCents: 50,
  serviceFeeActiveFrom: new Date('2026-09-01T00:00:00.000Z'),
}
const BESTELLT = new Date('2026-09-16T10:00:00.000Z')

describe('berechneServicegebuehr', () => {
  it('gebührenfrei: ohne Datum 0 Cent und kein Prozentsatz', () => {
    expect(
      berechneServicegebuehr(2000, { ...AKTIV, serviceFeeActiveFrom: null }, BESTELLT)
    ).toEqual({ gebuehrCents: 0, prozentAngewendet: null })
  })

  it('Datum in der Zukunft: noch 0 Cent — auch wenn nur eine Sekunde fehlt', () => {
    const morgen = { ...AKTIV, serviceFeeActiveFrom: new Date('2026-09-17T00:00:00.000Z') }
    expect(berechneServicegebuehr(2000, morgen, BESTELLT).gebuehrCents).toBe(0)
    const knapp = { ...AKTIV, serviceFeeActiveFrom: new Date(BESTELLT.getTime() + 1000) }
    expect(berechneServicegebuehr(2000, knapp, BESTELLT).gebuehrCents).toBe(0)
  })

  it('ab dem Zeitpunkt selbst gilt die Gebühr (Grenze einschließlich)', () => {
    const genau = { ...AKTIV, serviceFeeActiveFrom: BESTELLT }
    expect(berechneServicegebuehr(2000, genau, BESTELLT).gebuehrCents).toBe(98)
  })

  it('20 € bei 4,9 % → 98 Cent, Prozentsatz im Ergebnis', () => {
    expect(berechneServicegebuehr(2000, AKTIV, BESTELLT)).toEqual({
      gebuehrCents: 98,
      prozentAngewendet: 4.9,
    })
  })

  it('6 € bei 4,9 % wären 29 Cent → Mindestgebühr 50 Cent greift', () => {
    expect(berechneServicegebuehr(600, AKTIV, BESTELLT)).toEqual({
      gebuehrCents: 50,
      prozentAngewendet: 4.9,
    })
  })

  it('rundet kaufmännisch: 5 € × 4,9 % = 24,5 Cent → 25 Cent (ohne Mindestgebühr)', () => {
    const ohneMindest = { ...AKTIV, serviceFeeMinCents: 0 }
    expect(berechneServicegebuehr(500, ohneMindest, BESTELLT).gebuehrCents).toBe(25)
    // Gegenprobe knapp darunter: 4,99 € × 4,9 % = 24,451 → 24
    expect(berechneServicegebuehr(499, ohneMindest, BESTELLT).gebuehrCents).toBe(24)
  })

  it('rechnet mit dem Prisma-Decimal (String-Form) genauso wie mit der Zahl', () => {
    const decimal = { ...AKTIV, serviceFeePercent: { toString: () => '4.90' } }
    expect(berechneServicegebuehr(2000, decimal, BESTELLT).gebuehrCents).toBe(98)
    const text = { ...AKTIV, serviceFeePercent: '4.9' }
    expect(berechneServicegebuehr(2000, text, BESTELLT).prozentAngewendet).toBe(4.9)
  })

  it('das Datum darf als ISO-Text kommen (Serialisierung zum Browser)', () => {
    const text = { ...AKTIV, serviceFeeActiveFrom: '2026-09-01T00:00:00.000Z' }
    expect(berechneServicegebuehr(2000, text, BESTELLT).gebuehrCents).toBe(98)
  })

  it('Schutz vor Unsinn: negative oder unlesbare Werte werden zu 0, kein NaN', () => {
    const kaputt = { serviceFeePercent: 'abc', serviceFeeMinCents: -5, serviceFeeActiveFrom: AKTIV.serviceFeeActiveFrom }
    expect(berechneServicegebuehr(2000, kaputt, BESTELLT)).toEqual({ gebuehrCents: 0, prozentAngewendet: 0 })
    expect(berechneServicegebuehr(-100, AKTIV, BESTELLT).gebuehrCents).toBe(50)
  })
})

describe('Snapshot: bestellSummen liest nur die Bestellung', () => {
  it('Hofeinstellung nach der Bestellung ändern → Summen der Bestellung unverändert', () => {
    // Bestellung zur Zeit der Einstellung A angelegt und eingefroren:
    const zurBestellzeit = berechneServicegebuehr(2000, AKTIV, BESTELLT)
    const bestellung = { totalAmount: { toString: () => '20.00' }, serviceFeeCents: zurBestellzeit.gebuehrCents }
    const vorher = bestellSummen(bestellung)

    // Der Betreiber stellt den Hof um — auf 10 %, 2 € Mindestgebühr:
    const einstellungB = { serviceFeePercent: 10, serviceFeeMinCents: 200, serviceFeeActiveFrom: AKTIV.serviceFeeActiveFrom }
    expect(berechneServicegebuehr(2000, einstellungB, BESTELLT).gebuehrCents).toBe(200)

    // Die Bestellung kennt nur ihren Snapshot — nichts an ihr hat sich geändert:
    expect(bestellSummen(bestellung)).toEqual(vorher)
    expect(vorher).toEqual({ warenpreisCents: 2000, gebuehrCents: 98, gesamtCents: 2098 })
  })

  it('Bestandsbestellung ohne Gebühr: Gesamt = Warenpreis', () => {
    expect(bestellSummen({ totalAmount: 7.5, serviceFeeCents: 0 })).toEqual({
      warenpreisCents: 750,
      gebuehrCents: 0,
      gesamtCents: 750,
    })
  })
})

describe('Bar zu kassieren', () => {
  it('Vor-Ort-Bestellung: Warenpreis plus Gebühr — bar und Karte beim Hof gleich', () => {
    expect(barZuKassierenCents({ totalAmount: 20, serviceFeeCents: 98, paymentMethod: 'ONSITE_CASH' })).toBe(2098)
    expect(barZuKassierenCents({ totalAmount: 20, serviceFeeCents: 98, paymentMethod: 'ONSITE_CARD' })).toBe(2098)
  })

  it('Online-Bestellung: der Hof kassiert nichts → null', () => {
    expect(barZuKassierenCents({ totalAmount: 20, serviceFeeCents: 98, paymentMethod: 'ONLINE' })).toBeNull()
  })
})

describe('Erstattungs-Vermerk (abgeleitet)', () => {
  const basis = { status: 'NOT_PICKED_UP', paymentMethod: 'ONLINE', serviceFeeCents: 98, serviceFeeRefundedAt: null }

  it('online nicht abgeholt, Gebühr da, nicht erstattet → offen', () => {
    expect(gebuehrErstattungOffen(basis)).toBe(true)
  })

  it('sobald serviceFeeRefundedAt gesetzt ist, verschwindet der Vermerk', () => {
    expect(gebuehrErstattungOffen({ ...basis, serviceFeeRefundedAt: new Date() })).toBe(false)
    expect(gebuehrEntfallen({ serviceFeeRefundedAt: '2026-09-16T10:00:00.000Z' })).toBe(true)
  })

  it('bar, ohne Gebühr oder in anderem Status → nie offen', () => {
    expect(gebuehrErstattungOffen({ ...basis, paymentMethod: 'ONSITE_CASH' })).toBe(false)
    expect(gebuehrErstattungOffen({ ...basis, serviceFeeCents: 0 })).toBe(false)
    expect(gebuehrErstattungOffen({ ...basis, status: 'READY' })).toBe(false)
  })
})

describe('„Gebühr gilt ab" in Wiener Ortszeit', () => {
  it('Sommerzeit: 1. Oktober 2026 00:00 Wien = 30. September 22:00 UTC', () => {
    expect(wienerMitternacht('2026-10-01')?.toISOString()).toBe('2026-09-30T22:00:00.000Z')
  })

  it('Winterzeit: 1. Dezember 2026 00:00 Wien = 30. November 23:00 UTC', () => {
    expect(wienerMitternacht('2026-12-01')?.toISOString()).toBe('2026-11-30T23:00:00.000Z')
  })

  it('Hin und zurück: der Kalendertag bleibt derselbe', () => {
    for (const tag of ['2026-03-29', '2026-10-25', '2027-01-01']) {
      expect(kalendertagInWien(wienerMitternacht(tag)!)).toBe(tag)
    }
  })

  it('lehnt Unsinn ab', () => {
    expect(wienerMitternacht('01.10.2026')).toBeNull()
    expect(wienerMitternacht('2026-13-40')).toBeNull()
    expect(wienerMitternacht('')).toBeNull()
  })

  it('eine Bestellung um 00:30 Wiener Zeit am Stichtag zahlt schon, eine um 23:30 am Vortag noch nicht', () => {
    const einstellung = { ...AKTIV, serviceFeeActiveFrom: wienerMitternacht('2026-10-01')! }
    const vorher = new Date('2026-09-30T21:30:00.000Z') // 23:30 Wien am 30.9.
    const nachher = new Date('2026-09-30T22:30:00.000Z') // 00:30 Wien am 1.10.
    expect(berechneServicegebuehr(2000, einstellung, vorher).gebuehrCents).toBe(0)
    expect(berechneServicegebuehr(2000, einstellung, nachher).gebuehrCents).toBe(98)
  })
})

describe('einstellungKurz', () => {
  it('fasst die Einstellung zusammen', () => {
    // Intl setzt geschützte Leerzeichen („€ 0,50") — für den Vergleich normalisiert
    const kurz = (e: ServicegebuehrEinstellung) => einstellungKurz(e).replace(/ /g, ' ')
    expect(kurz(AKTIV)).toBe('4,9 % · mind. € 0,50 · gilt ab 01.09.2026')
    expect(kurz({ ...AKTIV, serviceFeeActiveFrom: null })).toBe('gebührenfrei')
  })
})

describe('Kalendermonate als Schlüssel (JJJJ-MM)', () => {
  it('nimmt nur echte Monate an', () => {
    expect(istMonatsschluessel('2026-09')).toBe(true)
    expect(istMonatsschluessel('2026-12')).toBe(true)
    expect(istMonatsschluessel('2026-00')).toBe(false)
    expect(istMonatsschluessel('2026-13')).toBe(false)
    expect(istMonatsschluessel('2026-9')).toBe(false)
    expect(istMonatsschluessel('09-2026')).toBe(false)
    expect(istMonatsschluessel('')).toBe(false)
  })

  it('setzt zusammen und zerlegt wieder', () => {
    expect(monatsschluessel(2026, 9)).toBe('2026-09')
    expect(monatsschluessel(2026, 12)).toBe('2026-12')
    expect(zerlegeMonat('2026-09')).toEqual({ jahr: 2026, monat: 9 })
    expect(zerlegeMonat('Unsinn')).toBeNull()
  })

  it('verschiebt über den Jahreswechsel, in beide Richtungen', () => {
    expect(monatVerschoben('2026-09', 1)).toBe('2026-10')
    expect(monatVerschoben('2026-12', 1)).toBe('2027-01')
    expect(monatVerschoben('2026-01', -1)).toBe('2025-12')
    expect(monatVerschoben('2026-09', 0)).toBe('2026-09')
    expect(monatVerschoben('2026-09', -12)).toBe('2025-09')
    expect(monatVerschoben('2026-09', 16)).toBe('2028-01')
  })

  it('zählt den Abstand in Monaten, negativ wenn es rückwärts geht', () => {
    expect(monatsAbstand('2026-09', '2026-09')).toBe(0)
    expect(monatsAbstand('2026-09', '2026-11')).toBe(2)
    expect(monatsAbstand('2026-11', '2027-02')).toBe(3)
    expect(monatsAbstand('2026-11', '2026-09')).toBe(-2)
  })
})

describe('monatsschluesselInWien', () => {
  it('nimmt WIENER Zeit, nicht UTC — 30.09. 23:30 UTC ist schon Oktober', () => {
    expect(monatsschluesselInWien(new Date('2026-09-30T23:30:00.000Z'))).toBe('2026-10')
    expect(monatsschluesselInWien(new Date('2026-09-30T21:30:00.000Z'))).toBe('2026-09')
  })

  it('gilt auch in der Winterzeit, wo Wien nur eine Stunde vor UTC liegt', () => {
    expect(monatsschluesselInWien(new Date('2026-12-31T23:30:00.000Z'))).toBe('2027-01')
    expect(monatsschluesselInWien(new Date('2026-12-31T22:30:00.000Z'))).toBe('2026-12')
  })
})

describe('monatsgrenzenWienFuer', () => {
  it('spannt [von, bis) über den Wiener Monat', () => {
    const g = monatsgrenzenWienFuer('2026-10')
    expect(g.von.toISOString()).toBe('2026-09-30T22:00:00.000Z')
    expect(g.bis.toISOString()).toBe('2026-10-31T23:00:00.000Z')
  })

  it('kommt über den Jahreswechsel', () => {
    const g = monatsgrenzenWienFuer('2026-12')
    expect(g.von.toISOString()).toBe('2026-11-30T23:00:00.000Z')
    expect(g.bis.toISOString()).toBe('2026-12-31T23:00:00.000Z')
  })

  it('benennt den Monat deutsch', () => {
    expect(monatsgrenzenWienFuer('2026-09').bezeichnung).toBe('September 2026')
  })

  it('wirft bei Unsinn statt still einen falschen Monat zu liefern', () => {
    expect(() => monatsgrenzenWienFuer('2026-13')).toThrow()
  })
})

describe('monatsgrenzenWien (laufender Monat)', () => {
  it('ist dieselbe Rechnung wie monatsgrenzenWienFuer für den Wiener Monat', () => {
    const jetzt = new Date('2026-09-30T23:30:00.000Z') // in Wien schon Oktober
    expect(monatsgrenzenWien(jetzt)).toEqual(monatsgrenzenWienFuer('2026-10'))
  })
})

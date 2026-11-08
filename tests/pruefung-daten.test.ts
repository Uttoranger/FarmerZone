import { describe, expect, it } from 'vitest'
import {
  PRUEF_BESTELLUNGEN,
  PRUEF_BRENNHOLZ,
  PRUEF_FUTTER_FAMILIE,
  PRUEF_GRUENDUNG_PLAETZE,
  PRUEF_HOF_WARTET,
  PRUEF_KONTEN,
  PRUEF_WHATSAPP_ABO,
  SNAPSHOT_FELDER_BESTELLUNG,
  SNAPSHOT_FELDER_POSITION,
  bestellSnapshot,
  hundertstelAlsDezimal,
  stripePlatzhalter,
} from '../scripts/pruefung/pruef-daten'
import { bestellGebuehr, type GebuehrLage } from '@/lib/plattformgebuehr'
import { berechneServicegebuehr } from '@/lib/servicegebuehr'
import { fristVon } from '@/lib/fristen'

/**
 * Die Daten des Prüf-Seeds (Nr. 262, Auftrag Lauf 33 6.1) ohne Datenbank:
 * erfunden, genullt, und jeder Betrag einer Prüf-Bestellung aus den
 * Funktionen, die /api/checkout benutzt. Den Vergleich mit einer echten
 * Kassen-Bestellung macht tests/integration/pruefung-seed.int.test.ts.
 */

const jetzt = new Date('2026-11-08T10:00:00.000Z')
const hof = { serviceFeePercent: '5.00', serviceFeeMinCents: 50, serviceFeeActiveFrom: new Date('2026-01-01T00:00:00.000Z'), platformFeePercent: '0' }
const positionen = [
  { productId: 'p-eier', name: 'Eier', unitPrice: '3.60', quantity: 3, vatRate: '10.00' },
  { productId: 'p-milch', name: 'Milch', unitPrice: '1.40', quantity: 2, vatRate: '10.00' },
]
const hofpreis = (einzugAb: Date, extra: Partial<Extract<GebuehrLage, { modell: 'hofpreis' }>> = {}): GebuehrLage => ({
  modell: 'hofpreis',
  hundertstel: 600,
  einzugAb,
  barMandatPflicht: true,
  sepaMandatAm: null,
  ...extra,
})

describe('Prüfdaten sind erfunden', () => {
  it('Adressen nur @example.com, Telefonnummern genullt mit Vorwahl 660', () => {
    for (const k of PRUEF_KONTEN) {
      expect(k.email).toMatch(/@example\.com$/)
      expect(k.telefon).toMatch(/^\+43 660 000\d{4}$/)
    }
    expect(PRUEF_HOF_WARTET.inhaberEmail).toMatch(/@example\.com$/)
    expect(PRUEF_WHATSAPP_ABO.email).toMatch(/@example\.com$/)
    expect(PRUEF_WHATSAPP_ABO.telefon).toMatch(/^\+43 660 000\d{4}$/)
    for (const b of PRUEF_BESTELLUNGEN) expect(b.kundenEmail).toMatch(/@example\.com$/)
  })

  it('Stripe-Kennungen nur als Platzhalter', () => {
    expect(stripePlatzhalter('TP-HP-ONLINE')).toBe('pi_pruefung_tp_hp_online')
    expect(stripePlatzhalter('TP-HP-ONLINE')).not.toMatch(/^pi_[A-Za-z0-9]{24}$/)
  })

  it('100 Gründungsplätze in der Wegwerf-DB (E-026)', () => {
    expect(PRUEF_GRUENDUNG_PLAETZE).toBe(100)
  })
})

describe('Futter-Familie und Brennholz (6.1 a, b)', () => {
  it('mindestens drei Größen, eine gerade nicht da, lose verpackt', () => {
    expect(PRUEF_FUTTER_FAMILIE.groessen.length).toBeGreaterThanOrEqual(3)
    expect(PRUEF_FUTTER_FAMILIE.groessen.filter((g) => g.bestand === 0)).toHaveLength(1)
    expect(new Set(PRUEF_FUTTER_FAMILIE.groessen.map((g) => g.id)).size).toBe(PRUEF_FUTTER_FAMILIE.groessen.length)
  })

  it('Brennholz mit Holzart, Scheitlänge und Lagerung; eines ausverkauft', () => {
    expect(PRUEF_BRENNHOLZ.length).toBeGreaterThanOrEqual(2)
    expect(PRUEF_BRENNHOLZ.filter((h) => h.bestand === 0)).toHaveLength(1)
    for (const h of PRUEF_BRENNHOLZ) {
      expect(h.holzart).not.toBe('')
      expect(h.scheitlaengeCm).toBeGreaterThan(0)
    }
  })
})

describe('Bestellungen (6.1 f, h, i)', () => {
  it('Hofpreis bar offen und online bezahlt, vier heute, künftiges Fenster, eine mit „Artikel fehlt“ an einer von zwei Positionen', () => {
    const nach = (n: string) => PRUEF_BESTELLUNGEN.find((b) => b.nummer === n)
    expect(nach('TP-HP-BAR')).toMatchObject({ zahlart: 'ONSITE_CASH', status: 'PENDING_CONFIRMATION' })
    expect(nach('TP-HP-ONLINE')).toMatchObject({ zahlart: 'ONLINE' })
    expect(PRUEF_BESTELLUNGEN.filter((b) => b.abholTag === 0)).toHaveLength(4)
    expect(PRUEF_BESTELLUNGEN.filter((b) => b.abholTag > 2).length).toBeGreaterThanOrEqual(1)
    const fehlt = nach('TP-FEHLT')
    expect(fehlt?.zahlart).toBe('ONLINE')
    expect(fehlt?.positionen).toHaveLength(2)
    expect(fehlt?.fehlt).toBe(1)
  })
})

describe('offene Barbestellung TP-HP-BAR – Frist nach dem Seed', () => {
  it('ist nach dem Seed-Lauf noch über eine Stunde offen (Frist gilt beim Lesen)', () => {
    const b = PRUEF_BESTELLUNGEN.find((x) => x.nummer === 'TP-HP-BAR')
    if (!b) throw new Error('TP-HP-BAR fehlt')
    const createdAt = new Date(jetzt.getTime() - b.eingangVorStunden * 60 * 60 * 1000)
    const pickupDate = new Date(jetzt.getTime() + b.abholTag * 24 * 60 * 60 * 1000)
    const frist = fristVon({ paymentMethod: 'ONSITE_CASH', createdAt, pickupDate, pickupTimeStart: '15:00' })
    expect(frist.getTime() - jetzt.getTime()).toBeGreaterThan(60 * 60 * 1000)
  })
})

describe('bestellSnapshot – derselbe Weg wie /api/checkout', () => {
  it('Hofpreis-Modell: Gebühr je Position aus bestellGebuehr, Satz als Decimal-Text, Mindestgebühr 0', () => {
    const s = bestellSnapshot(hofpreis(new Date('2028-01-01T00:00:00.000Z')), hof, positionen, 'ONSITE_CASH', jetzt)
    if ('grund' in s) throw new Error(s.grund)
    const erwartet = bestellGebuehr([{ preisCents: 360, menge: 3 }, { preisCents: 140, menge: 2 }], 600)
    expect(s.totalAmount.toString()).toBe('13.6')
    expect(s.serviceFeeCents).toBe(erwartet.gebuehrCents)
    expect(s.items.map((i) => i.gebuehrCents)).toEqual(erwartet.jePosition)
    expect(s.serviceFeePercentApplied).toBe('6.00')
    expect(s.serviceFeeMinCentsApplied).toBe(0)
    expect(s.gebuehrModell).toBe('hofpreis')
    expect(s.gebuehrEinzug).toBe('erlassen')
    expect(s.items.map((i) => i.totalPrice.toString())).toEqual(['10.8', '2.8'])
  })

  it('online im Hofpreis-Modell: Einzug stripe', () => {
    const s = bestellSnapshot(hofpreis(new Date('2026-01-01T00:00:00.000Z')), hof, positionen, 'ONLINE', jetzt)
    expect('grund' in s ? s.grund : s.gebuehrEinzug).toBe('stripe')
  })

  it('lehnt ab, wo die Kasse ablehnt: Mindestbestellwert und bar ohne Einzugsweg', () => {
    const klein = [{ productId: 'p-milch', name: 'Milch', unitPrice: '1.40', quantity: 1, vatRate: '10.00' }]
    expect(bestellSnapshot(hofpreis(new Date('2028-01-01T00:00:00.000Z')), hof, klein, 'ONLINE', jetzt)).toEqual({ grund: 'Mindestbestellwert nicht erreicht' })
    // Einzug fällig, Mandat Pflicht, keins da: bar gibt es nicht.
    expect(bestellSnapshot(hofpreis(new Date('2026-01-01T00:00:00.000Z')), hof, positionen, 'ONSITE_CASH', jetzt)).toEqual({ grund: 'bar bei diesem Hof nicht möglich' })
  })

  it('Modell bisher: Servicegebühr aus berechneServicegebuehr, ohne Gebühr je Position', () => {
    const s = bestellSnapshot({ modell: 'bisher' }, hof, positionen, 'ONLINE', jetzt)
    if ('grund' in s) throw new Error(s.grund)
    const erwartet = berechneServicegebuehr(1360, hof, jetzt, 'ONLINE')
    expect(s.serviceFeeCents).toBe(erwartet.gebuehrCents)
    expect(s.serviceFeePercentApplied).toBe(erwartet.prozentAngewendet)
    expect(s.serviceFeeMinCentsApplied).toBe(50)
    expect(s.gebuehrModell).toBeNull()
    expect(s.items.every((i) => i.gebuehrCents === 0)).toBe(true)
  })

  it('liefert genau die Snapshot-Felder der Kasse', () => {
    const s = bestellSnapshot(hofpreis(new Date('2028-01-01T00:00:00.000Z')), hof, positionen, 'ONLINE', jetzt)
    if ('grund' in s) throw new Error(s.grund)
    const { items, ...felder } = s
    expect(Object.keys(felder).sort()).toEqual([...SNAPSHOT_FELDER_BESTELLUNG].sort())
    expect(Object.keys(items[0] ?? {}).sort()).toEqual([...SNAPSHOT_FELDER_POSITION].sort())
  })

  it('hundertstelAlsDezimal schreibt den Satz ohne Gleitkomma', () => {
    expect(hundertstelAlsDezimal(600)).toBe('6.00')
    expect(hundertstelAlsDezimal(650)).toBe('6.50')
    expect(hundertstelAlsDezimal(5)).toBe('0.05')
  })
})

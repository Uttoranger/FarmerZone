/**
 * „Artikel fehlt" (E14, docs/nachtlauf/freigabe.md 1a) — die reine Rechnung.
 *
 * Grundsatz: Die Servicegebühr gilt nur für das, was übergeben wird. Sie wird
 * auf den verbleibenden Warenwert mit derselben Regel wie beim Bestellen neu
 * berechnet (5 %, aufrunden, mindestens € 0,50). Der Hof verliert nie mehr
 * als den Preis des fehlenden Artikels.
 *
 * Die Rechenbeispiele aus der Freigabe stehen wörtlich als Tests:
 *   Eier € 4,50 + Brot € 5,80, Brot fehlt
 *   bar    → Bar zu kassieren € 5,00 (statt € 10,82)
 *   online → Kundin bekommt € 5,82, vom Hof € 5,80
 */
import { describe, it, expect } from 'vitest'
import {
  artikelFehltRechnung,
  artikelFehltZeilen,
  nachFehlendemArtikel,
  neueServicegebuehrCents,
  type ArtikelFehltBestellung,
} from '@/lib/artikel-fehlt'

/** Eier € 4,50 + Brot € 5,80 = € 10,30, Gebühr 5 % aufgerundet = € 0,52. */
function bestellung(abweichend: Partial<ArtikelFehltBestellung> = {}): ArtikelFehltBestellung {
  return {
    status: 'CONFIRMED',
    paymentMethod: 'ONSITE_CASH',
    paymentStatus: 'PENDING',
    stripePaymentIntentId: null,
    warenpreisCents: 1030,
    serviceFeeCents: 52,
    serviceFeePercentApplied: 5,
    serviceFeeMinCentsApplied: 50,
    erstattetCents: 0,
    positionen: [
      { id: 'eier', betragCents: 450, fehlt: false },
      { id: 'brot', betragCents: 580, fehlt: false },
    ],
    ...abweichend,
  }
}

const ONLINE: Partial<ArtikelFehltBestellung> = {
  status: 'PAID',
  paymentMethod: 'ONLINE',
  paymentStatus: 'PAID',
  stripePaymentIntentId: 'pi_test',
}

describe('artikelFehltRechnung — Beispiele aus der Freigabe (E14)', () => {
  it('bar: Brot fehlt → Bar zu kassieren € 5,00 statt € 10,82', () => {
    const r = artikelFehltRechnung(bestellung(), 'brot')
    expect(r).toEqual({
      art: 'teil',
      zahlung: 'vor_ort',
      artikelCents: 580,
      bisherWarenCents: 1030,
      bisherGebuehrCents: 52,
      neuWarenCents: 450,
      neuGebuehrCents: 50,
      neuGesamtCents: 500,
      gebuehrDifferenzCents: 2,
      erstattungCents: 0,
      vomHofCents: 0,
    })
  })

  it('online: Kundin bekommt € 5,82 (Artikel + Gebührendifferenz), vom Hof genau € 5,80', () => {
    const r = artikelFehltRechnung(bestellung(ONLINE), 'brot')
    expect(r).toMatchObject({
      art: 'teil',
      zahlung: 'online',
      erstattungCents: 582,
      vomHofCents: 580,
      neuWarenCents: 450,
      neuGebuehrCents: 50,
      gebuehrDifferenzCents: 2,
    })
  })

  it('die Monatsabrechnung nimmt die neue Gebühr: neuGebuehrCents ist die neue Schuld des Hofs (bar)', () => {
    const r = artikelFehltRechnung(bestellung(), 'brot')
    expect(r.art === 'teil' && r.neuGebuehrCents).toBe(50)
  })
})

describe('artikelFehltRechnung — Sonderfälle', () => {
  it('fehlt der letzte Artikel, ist es ein normaler Storno', () => {
    const b = bestellung({
      warenpreisCents: 580,
      serviceFeeCents: 50,
      positionen: [
        { id: 'eier', betragCents: 450, fehlt: true },
        { id: 'brot', betragCents: 580, fehlt: false },
      ],
    })
    expect(artikelFehltRechnung(b, 'brot')).toEqual({ art: 'storno' })
  })

  it('eine Bestellung mit nur einem Artikel wird storniert', () => {
    const b = bestellung({ warenpreisCents: 450, serviceFeeCents: 50, positionen: [{ id: 'eier', betragCents: 450, fehlt: false }] })
    expect(artikelFehltRechnung(b, 'eier')).toEqual({ art: 'storno' })
  })

  it('mehrere nacheinander: jedes Mal vom aktuellen Stand, die Summe übersteigt nie den bezahlten Betrag', () => {
    // € 20 + € 10 + € 0,80 = € 30,80, Gebühr 5 % = 154 → online bezahlt 3234
    const start = bestellung({
      ...ONLINE,
      warenpreisCents: 3080,
      serviceFeeCents: 154,
      positionen: [
        { id: 'a', betragCents: 2000, fehlt: false },
        { id: 'b', betragCents: 1000, fehlt: false },
        { id: 'c', betragCents: 80, fehlt: false },
      ],
    })
    const erst = artikelFehltRechnung(start, 'a')
    if (erst.art !== 'teil') throw new Error('erwartet Teilstorno')
    // Rest 1080 → 5 % = 54 → Gebühr 54, Differenz 100
    expect(erst).toMatchObject({ erstattungCents: 2100, vomHofCents: 2000, neuWarenCents: 1080, neuGebuehrCents: 54 })

    const danach = bestellung({
      ...ONLINE,
      warenpreisCents: erst.neuWarenCents,
      serviceFeeCents: erst.neuGebuehrCents,
      erstattetCents: erst.erstattungCents,
      positionen: [
        { id: 'a', betragCents: 2000, fehlt: true },
        { id: 'b', betragCents: 1000, fehlt: false },
        { id: 'c', betragCents: 80, fehlt: false },
      ],
    })
    const zweit = artikelFehltRechnung(danach, 'b')
    if (zweit.art !== 'teil') throw new Error('erwartet Teilstorno')
    // Rest 80 → 5 % = 4 → Mindestgebühr 50, Differenz 4
    expect(zweit).toMatchObject({ erstattungCents: 1004, vomHofCents: 1000, neuWarenCents: 80, neuGebuehrCents: 50 })

    const bezahlt = 3080 + 154
    const summe = erst.erstattungCents + zweit.erstattungCents
    expect(summe).toBeLessThanOrEqual(bezahlt)
    // Was bleibt, ist genau der neue Betrag der Bestellung.
    expect(bezahlt - summe).toBe(zweit.neuGesamtCents)
  })

  it('lehnt eine schon fehlende Position ab (zweiter Tipp)', () => {
    const b = bestellung({
      positionen: [
        { id: 'eier', betragCents: 450, fehlt: false },
        { id: 'brot', betragCents: 580, fehlt: true },
      ],
    })
    expect(artikelFehltRechnung(b, 'brot')).toEqual({ art: 'abgelehnt', grund: 'schon_fehlend' })
  })

  it('lehnt eine fremde Position ab', () => {
    expect(artikelFehltRechnung(bestellung(), 'fremd')).toEqual({ art: 'abgelehnt', grund: 'position_unbekannt' })
  })

  it.each(['PENDING_CONFIRMATION', 'PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP'])(
    'lehnt den Status %s ab',
    (status) => {
      expect(artikelFehltRechnung(bestellung({ status }), 'brot')).toEqual({ art: 'abgelehnt', grund: 'status' })
    }
  )

  it.each(['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'])('erlaubt den Status %s', (status) => {
    expect(artikelFehltRechnung(bestellung({ status }), 'brot').art).toBe('teil')
  })

  it('online, aber nicht bezahlt: abgelehnt — es gibt nichts zu erstatten', () => {
    const b = bestellung({ ...ONLINE, paymentStatus: 'PENDING' })
    expect(artikelFehltRechnung(b, 'brot')).toEqual({ art: 'abgelehnt', grund: 'nicht_bezahlt' })
  })

  it('Karte vor Ort (Altbestand, E5) rechnet wie bar: neuer Betrag, keine Erstattung', () => {
    const r = artikelFehltRechnung(bestellung({ paymentMethod: 'ONSITE_CARD' }), 'brot')
    expect(r).toMatchObject({ zahlung: 'vor_ort', neuGesamtCents: 500, erstattungCents: 0 })
  })

  it('gebührenfreie Bestellung bleibt gebührenfrei', () => {
    const r = artikelFehltRechnung(
      bestellung({ ...ONLINE, serviceFeeCents: 0, serviceFeePercentApplied: null, serviceFeeMinCentsApplied: null }),
      'brot'
    )
    expect(r).toMatchObject({ neuGebuehrCents: 0, gebuehrDifferenzCents: 0, erstattungCents: 580, vomHofCents: 580 })
  })
})

describe('neueServicegebuehrCents — dieselbe Regel wie beim Bestellen', () => {
  it('rundet immer auf (51,5 → 52) und hält die Mindestgebühr', () => {
    expect(neueServicegebuehrCents(1030, bestellung())).toBe(52)
    expect(neueServicegebuehrCents(450, bestellung())).toBe(50)
    expect(neueServicegebuehrCents(2001, bestellung({ serviceFeeCents: 200 }))).toBe(101)
  })

  it('wird nie höher als die bisherige Gebühr — die Kundin zahlt nie mehr Gebühr für weniger Ware', () => {
    // Bestellung mit einer niedrigeren Mindestgebühr als die Rückfallregel
    const alt = bestellung({ serviceFeeCents: 30, serviceFeeMinCentsApplied: null, warenpreisCents: 400 })
    expect(neueServicegebuehrCents(200, alt)).toBeLessThanOrEqual(30)
  })

  it('Altbestellung ohne Snapshot der Mindestgebühr: war die Gebühr die Mindestgebühr, gilt genau sie', () => {
    // Warenpreis € 4,00 → 5 % = 20 Cent, gezahlt 40 → die Mindestgebühr war 40
    const alt = bestellung({ warenpreisCents: 400, serviceFeeCents: 40, serviceFeeMinCentsApplied: null })
    expect(neueServicegebuehrCents(200, alt)).toBe(40)
  })

  it('Altbestellung ohne Snapshot, Gebühr aus dem Prozentsatz: Mindestgebühr nach E4 (€ 0,50)', () => {
    const alt = bestellung({ serviceFeeMinCentsApplied: null })
    expect(neueServicegebuehrCents(450, alt)).toBe(50)
  })

  it('Satz 4,9 % (Altbestand) bleibt beim Satz der Bestellung', () => {
    const alt = bestellung({ serviceFeePercentApplied: 4.9, serviceFeeCents: 147, warenpreisCents: 3000 })
    // 2000 × 4,9 % = 98
    expect(neueServicegebuehrCents(2000, alt)).toBe(98)
  })
})

describe('artikelFehltZeilen — was der Dialog vor dem Speichern zeigt', () => {
  it('bar: bisher und neu zu kassieren', () => {
    const r = artikelFehltRechnung(bestellung(), 'brot')
    expect(artikelFehltZeilen(r, 'Anna')).toEqual({
      bisher: { text: 'Bar zu kassieren bisher', betrag: '€ 10,82' },
      neu: { text: 'Neu: Warenpreis € 4,50 + Servicegebühr € 0,50', betrag: '€ 5,00' },
      saetze: ['Die Monatsabrechnung nimmt die neue Servicegebühr.'],
    })
  })

  it('online: was die Kundin zurückbekommt und was vom Hof abgezogen wird', () => {
    const r = artikelFehltRechnung(bestellung(ONLINE), 'brot')
    expect(artikelFehltZeilen(r, 'Anna')).toEqual({
      bisher: { text: 'Anna bekommt zurück', betrag: '€ 5,82' },
      neu: { text: 'Von deiner nächsten Auszahlung abgezogen', betrag: '€ 5,80' },
      saetze: [
        'Artikel € 5,80 + Servicegebühr € 0,02 – die Gebühr gilt nur noch für € 4,50 Ware.',
        'Das ist genau der Preis des fehlenden Artikels. Den Unterschied bei der Servicegebühr erstattet FarmerZone.',
      ],
    })
  })

  it('Storno statt Teilstorno: kein Betragsblock', () => {
    expect(artikelFehltZeilen({ art: 'storno' }, 'Anna')).toBeNull()
  })
})

describe('nachFehlendemArtikel — der Stand für die nächste Rechnung', () => {
  it('übernimmt den von Stripe bestätigten Betrag und markiert die Position', () => {
    const b = bestellung(ONLINE)
    const r = artikelFehltRechnung(b, 'brot')
    if (r.art !== 'teil') throw new Error('erwartet Teilstorno')
    const danach = nachFehlendemArtikel(b, 'brot', r, 582)
    expect(danach).toMatchObject({ warenpreisCents: 450, serviceFeeCents: 50, erstattetCents: 582 })
    expect(danach.positionen.find((p) => p.id === 'brot')?.fehlt).toBe(true)
    // bezahlt = Warenpreis + Gebühr + erstattet bleibt erhalten
    expect(danach.warenpreisCents + danach.serviceFeeCents + danach.erstattetCents).toBe(1030 + 52)
  })
})

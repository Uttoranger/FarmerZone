/**
 * Tests der Finanzregel (src/lib/finanzen.ts) — reine Funktionen, keine Mocks.
 *
 * Die Aussagen, die zählen:
 *  - Ein Jahresposten ergibt über zwölf Monate GENAU den Jahresbetrag. Zwölfmal
 *    runden täte das nicht.
 *  - Die Grenzen von `ab` und `bis` liegen dort, wo sie liegen sollen: `bis` ist
 *    der letzte Monat, in dem der Posten zählt, nicht der erste danach.
 *  - Die vier Einnahmen-Töpfe schließen sich gegenseitig aus — dasselbe Geld
 *    darf nie zweimal auf der Seite stehen.
 *  - Der Monat einer Bestellung entscheidet sich in WIENER Zeit.
 */
import { describe, it, expect } from 'vitest'
import {
  bestellungenBisKostendeckung,
  durchschnittsGebuehr,
  kostendeckungSatz,
  monatAlsUtcDatum,
  monatKurz,
  utcDatumAlsMonat,
  einnahmenImMonat,
  kostenImMonat,
  kostenSummeImMonat,
  monateBis,
  topfVonBestellung,
  type BestellungFuerFinanzen,
  type KostenpostenFuerRechnung,
  type KostenRhythmusWert,
} from '@/lib/finanzen'

/** Ein Posten, knapp geschrieben: Betrag in Cent. */
function posten(
  betragCents: number,
  rhythmus: KostenRhythmusWert,
  ab: string,
  bis: string | null = null
): KostenpostenFuerRechnung {
  return { betragCents, rhythmus, ab, bis }
}

describe('kostenImMonat — monatliche Posten', () => {
  const p = posten(2000, 'MONATLICH', '2026-09', '2026-11')

  it('zählt im ersten Monat', () => {
    expect(kostenImMonat(p, '2026-09')).toBe(2000)
  })

  it('zählt im letzten Monat noch — `bis` ist einschließlich', () => {
    expect(kostenImMonat(p, '2026-11')).toBe(2000)
  })

  it('zählt im Monat vor `ab` nicht', () => {
    expect(kostenImMonat(p, '2026-08')).toBe(0)
  })

  it('zählt im Monat nach `bis` nicht', () => {
    expect(kostenImMonat(p, '2026-12')).toBe(0)
  })

  it('läuft ohne `bis` unbegrenzt weiter', () => {
    expect(kostenImMonat(posten(2000, 'MONATLICH', '2026-09'), '2030-04')).toBe(2000)
  })

  it('kommt über den Jahreswechsel', () => {
    const ueberJahr = posten(500, 'MONATLICH', '2026-11', '2027-02')
    expect(kostenImMonat(ueberJahr, '2026-12')).toBe(500)
    expect(kostenImMonat(ueberJahr, '2027-01')).toBe(500)
    expect(kostenImMonat(ueberJahr, '2027-02')).toBe(500)
    expect(kostenImMonat(ueberJahr, '2027-03')).toBe(0)
  })
})

describe('kostenImMonat — Jahresposten', () => {
  it('verteilt 100 € exakt: vier Monate 8,34 €, acht Monate 8,33 €, Summe 100 €', () => {
    // Genau der Fall aus dem Auftrag. 10 000 / 12 = 833 Rest 4.
    const p = posten(10_000, 'JAEHRLICH', '2026-09')
    const zwoelf = Array.from({ length: 12 }, (_, i) =>
      kostenImMonat(p, monateBis('2027-08', '2026-09')[i]!)
    )

    expect(zwoelf.filter((c) => c === 834)).toHaveLength(4)
    expect(zwoelf.filter((c) => c === 833)).toHaveLength(8)
    expect(zwoelf.reduce((s, c) => s + c, 0)).toBe(10_000)
  })

  it('gibt den Rest den ERSTEN Monaten des Abo-Jahres, gezählt ab `ab`', () => {
    const p = posten(10_000, 'JAEHRLICH', '2026-09')
    // September bis Dezember bekommen den Cent, ab Jänner nicht mehr.
    expect(kostenImMonat(p, '2026-09')).toBe(834)
    expect(kostenImMonat(p, '2026-12')).toBe(834)
    expect(kostenImMonat(p, '2027-01')).toBe(833)
    expect(kostenImMonat(p, '2027-08')).toBe(833)
  })

  it('fängt im nächsten Abo-Jahr wieder mit dem Rest an', () => {
    const p = posten(10_000, 'JAEHRLICH', '2026-09')
    expect(kostenImMonat(p, '2027-09')).toBe(834)
    expect(kostenImMonat(p, '2028-01')).toBe(833)
  })

  it('teilt einen glatt teilbaren Jahresbetrag ohne Rest', () => {
    const p = posten(12_000, 'JAEHRLICH', '2026-01')
    expect(kostenImMonat(p, '2026-01')).toBe(1000)
    expect(kostenImMonat(p, '2026-07')).toBe(1000)
  })

  it('achtet auch bei Jahresposten auf ab und bis', () => {
    const p = posten(12_000, 'JAEHRLICH', '2026-09', '2026-10')
    expect(kostenImMonat(p, '2026-08')).toBe(0)
    expect(kostenImMonat(p, '2026-09')).toBe(1000)
    expect(kostenImMonat(p, '2026-10')).toBe(1000)
    expect(kostenImMonat(p, '2026-11')).toBe(0)
  })

  it('verteilt auch einen Betrag unter zwölf Cent, ohne etwas zu verlieren', () => {
    // Grenzfall: Grundbetrag 0, alles steckt im Rest.
    const p = posten(5, 'JAEHRLICH', '2026-01')
    const zwoelf = Array.from({ length: 12 }, (_, i) =>
      kostenImMonat(p, monateBis('2026-12', '2026-01')[i]!)
    )
    expect(zwoelf.reduce((s, c) => s + c, 0)).toBe(5)
    expect(zwoelf.filter((c) => c === 1)).toHaveLength(5)
  })
})

describe('kostenImMonat — einmalige Posten', () => {
  const p = posten(4900, 'EINMALIG', '2026-09')

  it('zählt genau im Monat von `ab`', () => {
    expect(kostenImMonat(p, '2026-09')).toBe(4900)
  })

  it('zählt in keinem anderen Monat', () => {
    expect(kostenImMonat(p, '2026-08')).toBe(0)
    expect(kostenImMonat(p, '2026-10')).toBe(0)
    expect(kostenImMonat(p, '2027-09')).toBe(0)
  })
})

describe('kostenSummeImMonat', () => {
  it('legt zusammen und zählt nur die Posten, die im Monat etwas kosten', () => {
    const alle = [
      posten(2000, 'MONATLICH', '2026-09'),
      posten(12_000, 'JAEHRLICH', '2026-09'),
      posten(4900, 'EINMALIG', '2026-08'), // im September nicht mehr
      posten(500, 'MONATLICH', '2026-01', '2026-08'), // beendet
    ]
    expect(kostenSummeImMonat(alle, '2026-09')).toEqual({ cents: 3000, anzahl: 2 })
  })

  it('gibt bei leerer Liste eine Nullzeile', () => {
    expect(kostenSummeImMonat([], '2026-09')).toEqual({ cents: 0, anzahl: 0 })
  })
})

// ─── Einnahmen ───────────────────────────────────────────────────────────────

/** Eine Bestellung, knapp geschrieben. Standard: online bezahlt, 49 Cent Gebühr. */
function bestellung(felder: Partial<BestellungFuerFinanzen> = {}): BestellungFuerFinanzen {
  return {
    createdAt: new Date('2026-09-15T10:00:00.000Z'),
    status: 'CONFIRMED',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    serviceFeeCents: 49,
    serviceFeeRefundedAt: null,
    provisionCents: 0,
    ...felder,
  }
}

describe('topfVonBestellung', () => {
  it('legt eine bezahlte Online-Bestellung in „eingezogen", egal wie weit der Status ist', () => {
    for (const status of ['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'PICKED_UP']) {
      expect(topfVonBestellung(bestellung({ status }))).toBe('eingezogen')
    }
  })

  it('legt eine abgeholte Vor-Ort-Bestellung in „geschuldet" — bar wie Karte', () => {
    for (const paymentMethod of ['ONSITE_CASH', 'ONSITE_CARD']) {
      expect(
        topfVonBestellung(
          bestellung({ paymentMethod, paymentStatus: 'PENDING', status: 'PICKED_UP' })
        )
      ).toBe('geschuldet')
    }
  })

  it('legt eine noch offene Online-Bestellung in „erwartet", nicht in „eingezogen"', () => {
    expect(
      topfVonBestellung(
        bestellung({ paymentStatus: 'PENDING', status: 'PENDING_CONFIRMATION' })
      )
    ).toBe('erwartet')
  })

  it('legt eine noch nicht abgeholte Vor-Ort-Bestellung in „erwartet"', () => {
    expect(
      topfVonBestellung(
        bestellung({ paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', status: 'READY' })
      )
    ).toBe('erwartet')
  })

  it('zählt eine stornierte Bestellung nirgends — auch wenn sie bezahlt war', () => {
    expect(topfVonBestellung(bestellung({ status: 'CANCELLED' }))).toBe('keiner')
  })

  it('zählt eine entfallene Gebühr nirgends', () => {
    expect(
      topfVonBestellung(bestellung({ serviceFeeRefundedAt: new Date('2026-09-20T08:00:00Z') }))
    ).toBe('keiner')
  })

  it('zählt „nicht abgeholt" bei Vor-Ort-Zahlung nirgends — da kommt nichts mehr', () => {
    expect(
      topfVonBestellung(
        bestellung({ paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', status: 'NOT_PICKED_UP' })
      )
    ).toBe('keiner')
  })

  it('lässt eine nicht abgeholte ONLINE-Bestellung mit gescheiterter Erstattung eingezogen', () => {
    // Grenzfall mit Absicht: Die Erstattung ist nicht durch (refundedAt null),
    // das Geld liegt also bei der Plattform. Es zu verschweigen wäre falscher.
    expect(
      topfVonBestellung(bestellung({ status: 'NOT_PICKED_UP', serviceFeeRefundedAt: null }))
    ).toBe('eingezogen')
  })
})

describe('einnahmenImMonat', () => {
  it('trennt die drei Töpfe und zählt nur gezählte Bestellungen mit', () => {
    const alle = [
      bestellung({ serviceFeeCents: 100 }), // eingezogen
      bestellung({ serviceFeeCents: 200 }), // eingezogen
      bestellung({
        paymentMethod: 'ONSITE_CASH',
        paymentStatus: 'PENDING',
        status: 'PICKED_UP',
        serviceFeeCents: 300,
      }), // geschuldet
      bestellung({ paymentStatus: 'PENDING', status: 'PENDING_CONFIRMATION', serviceFeeCents: 400 }), // erwartet
      bestellung({ status: 'CANCELLED', serviceFeeCents: 500 }), // nirgends
      bestellung({ serviceFeeCents: 600, serviceFeeRefundedAt: new Date('2026-09-20T08:00:00Z') }), // nirgends
    ]

    const e = einnahmenImMonat(alle, '2026-09')

    expect(e.eingezogenCents).toBe(300)
    expect(e.geschuldetCents).toBe(300)
    expect(e.erwartetCents).toBe(400)
    expect(e.gezaehltCents).toBe(600)
    expect(e.bestellungen).toBe(3)
    expect(e.offeneBestellungen).toBe(1)
  })

  it('zählt dasselbe Geld nie in zwei Töpfen', () => {
    // Eine bezahlte Online-Bestellung im Status READY steckt in „eingezogen"
    // und darf nicht zusätzlich als „erwartet" erscheinen.
    const e = einnahmenImMonat([bestellung({ status: 'READY', serviceFeeCents: 49 })], '2026-09')
    expect(e.eingezogenCents).toBe(49)
    expect(e.erwartetCents).toBe(0)
    expect(e.offeneBestellungen).toBe(0)
  })

  it('lässt Bestellungen anderer Monate liegen', () => {
    const alle = [
      bestellung({ createdAt: new Date('2026-08-15T10:00:00.000Z'), serviceFeeCents: 111 }),
      bestellung({ createdAt: new Date('2026-09-15T10:00:00.000Z'), serviceFeeCents: 222 }),
    ]
    expect(einnahmenImMonat(alle, '2026-09').eingezogenCents).toBe(222)
  })

  it('nimmt die Provision nur aus gezählten Bestellungen mit', () => {
    const alle = [
      bestellung({ serviceFeeCents: 49, provisionCents: 100 }),
      bestellung({ status: 'CANCELLED', serviceFeeCents: 49, provisionCents: 900 }),
      bestellung({ paymentStatus: 'PENDING', status: 'READY', provisionCents: 700 }),
    ]
    expect(einnahmenImMonat(alle, '2026-09').provisionCents).toBe(100)
  })

  it('gibt für einen Monat ohne Bestellung lauter Nullen', () => {
    const e = einnahmenImMonat([bestellung()], '2026-10')
    expect(e).toMatchObject({
      eingezogenCents: 0,
      geschuldetCents: 0,
      erwartetCents: 0,
      gezaehltCents: 0,
      bestellungen: 0,
      offeneBestellungen: 0,
    })
  })

  describe('Monatswechsel in Wiener Zeit', () => {
    it('zählt eine Bestellung am 30. um 23:30 UTC in den FOLGENDEN Monat', () => {
      // 30.09. 23:30 UTC ist in Wien der 01.10. um 01:30 (Sommerzeit, +2).
      const spaet = bestellung({
        createdAt: new Date('2026-09-30T23:30:00.000Z'),
        serviceFeeCents: 77,
      })
      expect(einnahmenImMonat([spaet], '2026-09').eingezogenCents).toBe(0)
      expect(einnahmenImMonat([spaet], '2026-10').eingezogenCents).toBe(77)
    })

    it('zählt eine Bestellung am letzten Tag um 21:30 UTC noch in ihren Monat', () => {
      // 30.09. 21:30 UTC ist in Wien der 30.09. um 23:30 — knapp davor.
      const knapp = bestellung({
        createdAt: new Date('2026-09-30T21:30:00.000Z'),
        serviceFeeCents: 77,
      })
      expect(einnahmenImMonat([knapp], '2026-09').eingezogenCents).toBe(77)
      expect(einnahmenImMonat([knapp], '2026-10').eingezogenCents).toBe(0)
    })

    it('zählt im Winter genauso, obwohl Wien dann nur eine Stunde vor UTC liegt', () => {
      // 31.12. 23:30 UTC ist in Wien der 01.01. um 00:30 (Winterzeit, +1).
      const silvester = bestellung({
        createdAt: new Date('2026-12-31T23:30:00.000Z'),
        serviceFeeCents: 55,
      })
      expect(einnahmenImMonat([silvester], '2026-12').eingezogenCents).toBe(0)
      expect(einnahmenImMonat([silvester], '2027-01').eingezogenCents).toBe(55)
    })
  })
})

// ─── Kostendeckung ───────────────────────────────────────────────────────────

/** Ein Monatsergebnis, knapp geschrieben. */
function monat(gezaehltCents: number, bestellungen: number) {
  return {
    eingezogenCents: gezaehltCents,
    geschuldetCents: 0,
    erwartetCents: 0,
    provisionCents: 0,
    bestellungen,
    offeneBestellungen: 0,
    gezaehltCents,
  }
}

describe('durchschnittsGebuehr', () => {
  it('rechnet über mehrere Monate, nicht nur über den letzten', () => {
    // 600 Cent aus 6 Bestellungen, 400 aus 4 → 100 Cent je Bestellung.
    expect(durchschnittsGebuehr([monat(600, 6), monat(400, 4)])).toBe(100)
  })

  it('lässt Monate ohne gezählte Bestellung heraus, statt den Schnitt zu drücken', () => {
    expect(durchschnittsGebuehr([monat(0, 0), monat(490, 10), monat(0, 0)])).toBe(49)
  })

  it('gibt ohne jede gezählte Bestellung 0 — das heißt „noch keine Daten"', () => {
    expect(durchschnittsGebuehr([])).toBe(0)
    expect(durchschnittsGebuehr([monat(0, 0)])).toBe(0)
  })

  it('rundet kaufmännisch auf ganze Cent', () => {
    // 100 Cent aus 3 Bestellungen = 33,33… → 33
    expect(durchschnittsGebuehr([monat(100, 3)])).toBe(33)
    // 101 Cent aus 3 = 33,67 → 34
    expect(durchschnittsGebuehr([monat(101, 3)])).toBe(34)
  })
})

describe('bestellungenBisKostendeckung', () => {
  it('rundet auf — eine halbe Bestellung deckt nichts', () => {
    expect(bestellungenBisKostendeckung(10_000, 49)).toBe(205) // 204,08…
    expect(bestellungenBisKostendeckung(100, 49)).toBe(3) // 2,04…
  })

  it('geht glatt auf, wenn es glatt aufgeht', () => {
    expect(bestellungenBisKostendeckung(4900, 49)).toBe(100)
  })

  it('gibt ohne Schnitt null — „noch keine Daten", nicht „0 Bestellungen genügen"', () => {
    expect(bestellungenBisKostendeckung(10_000, 0)).toBeNull()
    expect(bestellungenBisKostendeckung(0, 0)).toBeNull()
  })

  it('gibt ohne Kosten 0', () => {
    expect(bestellungenBisKostendeckung(0, 49)).toBe(0)
  })
})

describe('monateBis', () => {
  it('reicht von der ersten Bestellung bis zum gewählten Monat', () => {
    expect(monateBis('2026-09', '2026-07')).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('zeigt höchstens zwölf Monate und schneidet vorne ab', () => {
    const monate = monateBis('2026-09', '2020-01')
    expect(monate).toHaveLength(12)
    expect(monate[0]).toBe('2025-10')
    expect(monate[11]).toBe('2026-09')
  })

  it('gibt ohne erste Bestellung nur den gewählten Monat', () => {
    expect(monateBis('2026-09', null)).toEqual(['2026-09'])
  })

  it('gibt auch dann nur den gewählten Monat, wenn er VOR der ersten Bestellung liegt', () => {
    // Jemand ruft einen älteren Monat auf, als es Bestellungen gibt.
    expect(monateBis('2026-01', '2026-07')).toEqual(['2026-01'])
  })

  it('kommt über den Jahreswechsel', () => {
    expect(monateBis('2027-01', '2026-11')).toEqual(['2026-11', '2026-12', '2027-01'])
  })
})

describe('Monat ↔ DATE-Spalte', () => {
  it('schreibt den Ersten des Monats als UTC-Mitternacht', () => {
    expect(monatAlsUtcDatum('2026-09').toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(monatAlsUtcDatum('2027-01').toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })

  it('verschiebt den Monat NICHT über die Zeitzonengrenze', () => {
    // Wiener Mitternacht wäre 2026-08-31T22:00Z — in der DATE-Spalte stünde
    // dann August. Genau dagegen ist die Spalte ein DATE.
    for (const monat of ['2026-01', '2026-06', '2026-09', '2026-12']) {
      expect(utcDatumAlsMonat(monatAlsUtcDatum(monat))).toBe(monat)
    }
  })

  it('liest eine DATE-Spalte als ihren Monat', () => {
    expect(utcDatumAlsMonat(new Date('2026-09-01T00:00:00.000Z'))).toBe('2026-09')
  })
})

describe('monatKurz', () => {
  it('schreibt den Monat kurz und deutsch', () => {
    // Intl kann je nach ICU „Sep" oder „Sep." schreiben — geprüft wird, dass
    // Monat und zweistelliges Jahr drinstehen, nicht die Interpunktion.
    expect(monatKurz('2026-09')).toMatch(/^Sep\.? 26$/)
    expect(monatKurz('2027-01')).toMatch(/27$/)
  })
})

describe('kostendeckungSatz', () => {
  const basis = { schnittCents: 49, brauchtBestellungen: 205, bezeichnung: 'September 2026', bestellungen: 12 }

  it('nennt Schnitt, Schwelle, Monat und Stand', () => {
    const satz = kostendeckungSatz(basis).replace(/ /g, ' ')
    expect(satz).toContain('€ 0,49')
    expect(satz).toContain('rund 205 Bestellungen')
    expect(satz).toContain('Im September 2026 waren es 12.')
  })

  it('erklärt statt zu rechnen, solange es keinen Schnitt gibt', () => {
    const satz = kostendeckungSatz({ ...basis, schnittCents: 0, brauchtBestellungen: null })
    expect(satz).toContain('Sobald die ersten Bestellungen')
    expect(satz).not.toContain('rund')
  })

  it('fordert zum Eintragen auf, wenn keine Kosten hinterlegt sind', () => {
    const satz = kostendeckungSatz({ ...basis, brauchtBestellungen: 0 })
    expect(satz).toContain('keine Kosten eingetragen')
  })
})

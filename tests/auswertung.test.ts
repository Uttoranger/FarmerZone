/**
 * Auswertung im neuen Design (Nachtlauf Nr. 22c) — die reinen Regeln aus
 * src/lib/auswertung.ts: Servicegebühren dieses Monats (nur gespeicherte
 * Beträge, Abrechnungsregel topfVonBestellung, Register B1), Kennzahlen,
 * Teilen-Karte, Grenze. Ohne Datenbank, `jetzt` als Parameter.
 */
import { describe, it, expect } from 'vitest'
import {
  SERVICEGEBUEHREN_ERKLAERUNG,
  abholtageDesFensters,
  grenzeStand,
  kennzahlen,
  servicegebuehrenImMonat,
  servicegebuehrenSaetze,
  teilenKarte,
  teilenZeitraumAus,
  umsatzKartenTitel,
  zahlartZeile,
} from '@/lib/auswertung'
import { einnahmenImMonat, type BestellungFuerFinanzen } from '@/lib/finanzen'
import { BAR_GEBUEHR_SEPA_SATZ, BAR_OHNE_GEBUEHR_SATZ, BAR_SERVICEGEBUEHR_AB } from '@/lib/konditionen'
import { umsatzfenster } from '@/lib/umsatz'
import { fasseTeilenWirkungZusammen } from '@/lib/teilen-wirkung'

const OKTOBER = '2026-10'
const imOktober = new Date('2026-10-15T10:00:00Z')
const nachStichtag = new Date(BAR_SERVICEGEBUEHR_AB.getTime() + 40 * 24 * 3600 * 1000) // März 2027

function bestellung(abweichend: Partial<BestellungFuerFinanzen> = {}): BestellungFuerFinanzen {
  return {
    createdAt: imOktober,
    status: 'PICKED_UP',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    serviceFeeCents: 100,
    serviceFeeRefundedAt: null,
    provisionCents: 0,
    ...abweichend,
  }
}

describe('Servicegebühren dieses Monats — gespeicherte Beträge, Abrechnungsregel', () => {
  it('online bezahlt zählt mit dem gespeicherten Betrag, egal welcher Bestellstatus danach', () => {
    const summe = servicegebuehrenImMonat(
      [bestellung({ serviceFeeCents: 53 }), bestellung({ status: 'CONFIRMED', serviceFeeCents: 50 }), bestellung({ status: 'READY', serviceFeeCents: 61 })],
      OKTOBER
    )
    expect(summe).toEqual({ monat: OKTOBER, onlineCents: 164, onlineAnzahl: 3, vorOrtCents: 0, vorOrtAnzahl: 0, summeCents: 164 })
  })

  it('storniert, Gebühr erstattet, nicht abgeholt oder noch unbezahlt zählt nicht', () => {
    const summe = servicegebuehrenImMonat(
      [
        bestellung({ status: 'CANCELLED', serviceFeeCents: 70 }),
        bestellung({ serviceFeeRefundedAt: new Date('2026-10-16T08:00:00Z'), serviceFeeCents: 80 }),
        bestellung({ status: 'NOT_PICKED_UP', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeCents: 90 }),
        bestellung({ status: 'PENDING_CONFIRMATION', paymentStatus: 'PENDING', serviceFeeCents: 99 }),
      ],
      OKTOBER
    )
    expect(summe.summeCents).toBe(0)
    expect(summe.onlineAnzahl + summe.vorOrtAnzahl).toBe(0)
  })

  it('B1: bar vor dem Stichtag zählt nie — auch nicht eine ältere Barbestellung, die noch eine Gebühr trägt', () => {
    const summe = servicegebuehrenImMonat(
      [bestellung({ paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeCents: 75 })],
      OKTOBER
    )
    expect(summe.vorOrtCents).toBe(0)
    expect(summe.vorOrtAnzahl).toBe(0)
  })

  it('bar nach dem Stichtag: abgeholt zählt als „vor Ort", noch nicht abgeholt nicht', () => {
    const monat = '2027-03'
    const summe = servicegebuehrenImMonat(
      [
        bestellung({ createdAt: nachStichtag, paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeCents: 55 }),
        bestellung({ createdAt: nachStichtag, status: 'READY', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeCents: 60 }),
      ],
      monat
    )
    expect(summe).toMatchObject({ vorOrtCents: 55, vorOrtAnzahl: 1, onlineCents: 0, summeCents: 55 })
  })

  it('Monat ist der Bestelleingang in WIENER Zeit — 30.9. 23:30 Wien gehört in den September', () => {
    const spaetSeptember = new Date('2026-09-30T21:30:00Z') // 23:30 Wien
    const fruehOktober = new Date('2026-09-30T22:30:00Z') // 00:30 Wien am 1.10.
    const summe = servicegebuehrenImMonat(
      [bestellung({ createdAt: spaetSeptember, serviceFeeCents: 11 }), bestellung({ createdAt: fruehOktober, serviceFeeCents: 22 })],
      OKTOBER
    )
    expect(summe.onlineCents).toBe(22)
  })

  it('rechnet ganzzahlig in Cent; negative oder krumme Werte verfälschen die Summe nicht', () => {
    const summe = servicegebuehrenImMonat([bestellung({ serviceFeeCents: -5 }), bestellung({ serviceFeeCents: 50 })], OKTOBER)
    expect(summe.onlineCents).toBe(50)
    expect(Number.isInteger(summe.summeCents)).toBe(true)
  })
})

describe('Servicegebühren — dieselbe Zahl wie /admin/finanzen (Register F6)', () => {
  it('online = eingezogen, vor Ort = geschuldet, Summe und Anzahl wie einnahmenImMonat', () => {
    const gemischt = [
      bestellung({ serviceFeeCents: 53 }),
      bestellung({ status: 'READY', serviceFeeCents: 61 }),
      bestellung({ status: 'CANCELLED', serviceFeeCents: 70 }),
      bestellung({ serviceFeeRefundedAt: new Date('2026-10-16T08:00:00Z'), serviceFeeCents: 80 }),
      bestellung({ status: 'PENDING_CONFIRMATION', paymentStatus: 'PENDING', serviceFeeCents: 99 }),
      bestellung({ status: 'NOT_PICKED_UP', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeCents: 90 }),
      bestellung({ paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeCents: 75 }),
      bestellung({ createdAt: new Date('2026-09-30T21:30:00Z'), serviceFeeCents: 11 }),
    ]
    const hof = servicegebuehrenImMonat(gemischt, OKTOBER)
    const admin = einnahmenImMonat(gemischt, OKTOBER)
    expect(hof.onlineCents).toBe(admin.eingezogenCents)
    expect(hof.vorOrtCents).toBe(admin.geschuldetCents)
    expect(hof.summeCents).toBe(admin.gezaehltCents)
    expect(hof.onlineAnzahl + hof.vorOrtAnzahl).toBe(admin.bestellungen)
    expect(hof.summeCents).toBe(114)

    const spaeter = [
      bestellung({ createdAt: nachStichtag, paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeCents: 55 }),
      bestellung({ createdAt: nachStichtag, status: 'READY', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeCents: 60 }),
      bestellung({ createdAt: nachStichtag, serviceFeeCents: 40 }),
    ]
    const hofMaerz = servicegebuehrenImMonat(spaeter, '2027-03')
    const adminMaerz = einnahmenImMonat(spaeter, '2027-03')
    expect([hofMaerz.onlineCents, hofMaerz.vorOrtCents, hofMaerz.summeCents]).toEqual([
      adminMaerz.eingezogenCents,
      adminMaerz.geschuldetCents,
      adminMaerz.gezaehltCents,
    ])
  })
})

describe('Servicegebühren — Sätze aus konditionen.ts (K1, B1)', () => {
  it('vor dem Stichtag: Bar-Ausnahme, kein Lastschrift-Satz', () => {
    const saetze = servicegebuehrenSaetze(imOktober)
    expect(saetze.bar).toBe(BAR_OHNE_GEBUEHR_SATZ)
    expect(JSON.stringify(saetze)).not.toMatch(/SEPA|Lastschrift/)
  })

  it('ab dem Stichtag: der bestehende SEPA-Satz statt der Ausnahme', () => {
    expect(servicegebuehrenSaetze(nachStichtag).bar).toBe(BAR_GEBUEHR_SEPA_SATZ)
    expect(servicegebuehrenSaetze(BAR_SERVICEGEBUEHR_AB).bar).toBe(BAR_GEBUEHR_SEPA_SATZ)
  })

  it('die Erklärung nennt weder Zahl noch Datum', () => {
    expect(SERVICEGEBUEHREN_ERKLAERUNG).not.toMatch(/\d/)
  })
})

describe('Kennzahlen', () => {
  it('zählt Bestellungen, Zahlart und den Ø-Warenpreis in Cent', () => {
    const k = kennzahlen(
      [
        { paymentMethod: 'ONLINE', warenCents: 1999 },
        { paymentMethod: 'ONSITE_CASH', warenCents: 1000 },
        { paymentMethod: 'ONSITE_CARD', warenCents: 1 },
      ],
      2
    )
    expect(k).toEqual({ bestellungen: 3, online: 1, vorOrt: 2, warenCents: 3000, durchschnittCents: 1000, nichtAbgeholt: 2 })
    expect(zahlartZeile(k)).toBe('1 online · 2 bar')
  })

  it('ohne Bestellung kein Durchschnitt und keine Zahlart-Zeile', () => {
    const k = kennzahlen([], 0)
    expect(k.durchschnittCents).toBeNull()
    expect(zahlartZeile(k)).toBeNull()
    expect(zahlartZeile({ online: 4, vorOrt: 0 })).toBe('4 online')
  })

  it('nicht abgeholt zählt nach ganzen Wiener Abholtagen, auch am laufenden Tag vor Mittag', () => {
    const jetzt = new Date('2026-10-07T06:00:00Z') // 8 Uhr Wien
    const pf = umsatzfenster('woche', jetzt)
    const tage = abholtageDesFensters(pf)
    expect(tage.von.toISOString()).toBe('2026-10-04T22:00:00.000Z') // Mo 5.10. 0:00 Wien
    expect(tage.bis.toISOString()).toBe('2026-10-07T21:59:59.999Z') // Mi 7.10. 23:59:59,999 Wien
    // pickupDate steht um 12:00 des Abholtags — heute liegt es nach `jetzt`, aber im Fenster.
    expect(new Date('2026-10-07T10:00:00Z') <= tage.bis).toBe(true)
  })
})

describe('Teilen-Karte — nur Besuche (Register T1)', () => {
  it('Summe und Balken nach Besuchen des stärksten Kanals', () => {
    const wirkung = fasseTeilenWirkungZusammen([
      { kanal: 'WHATSAPP', besuche: 24 },
      { kanal: 'QR', besuche: 9 },
      { kanal: 'FACEBOOK', besuche: 5 },
    ])
    const karte = teilenKarte(wirkung)
    expect(karte.kopf).toBe('38 Besuche')
    expect(karte.zeilen.map((z) => [z.kanal, z.anteilProzent, z.text])).toEqual([
      ['WHATSAPP', 100, '24 Besuche'],
      ['QR', 38, '9 Besuche'],
      ['FACEBOOK', 21, '5 Besuche'],
    ])
  })

  it('Einzahl: ein Besuch', () => {
    const karte = teilenKarte(fasseTeilenWirkungZusammen([{ kanal: 'LINK', besuche: 1 }]))
    expect(karte.kopf).toBe('1 Besuch')
    expect(karte.zeilen[0]).toMatchObject({ anteilProzent: 100, text: '1 Besuch' })
  })

  it('T1: kein Wort von Bestellungen und kein Euro-Betrag, in keinem Satz der Karte', () => {
    const karte = teilenKarte(fasseTeilenWirkungZusammen([{ kanal: 'WHATSAPP', besuche: 3 }, { kanal: 'QR', besuche: 1 }]))
    const saetze = [karte.kopf, ...karte.zeilen.map((z) => z.text)].join(' | ')
    expect(saetze).not.toMatch(/Bestellung|€|EUR/)
  })

  it('ohne Besuch: leer (die Karte zeigt dann ihren Ausweg)', () => {
    expect(teilenKarte(fasseTeilenWirkungZusammen([]))).toEqual({ kopf: null, zeilen: [] })
    expect(teilenKarte(fasseTeilenWirkungZusammen([{ kanal: 'QR', besuche: 0 }]))).toEqual({ kopf: null, zeilen: [] })
  })

  it('der Zeitraum sind die Wiener Tage des gewählten Fensters', () => {
    const pf = umsatzfenster('monat', new Date('2026-10-07T06:00:00Z'))
    expect(teilenZeitraumAus(pf)).toEqual({ von: '2026-10-01', bis: '2026-10-07' })
    const vorher = umsatzfenster('monat', new Date('2026-10-07T06:00:00Z'), 1)
    expect(teilenZeitraumAus(vorher)).toEqual({ von: '2026-09-01', bis: '2026-09-30' })
  })
})

describe('Grenze und Titel', () => {
  it('Schwellen 75 % und 95 % wie bisher, ohne Rot', () => {
    expect(grenzeStand(10, '€ 55.000')).toEqual({ ton: 'gruen', marke: 'Im grünen Bereich', hinweis: null })
    expect(grenzeStand(75, '€ 55.000')).toMatchObject({ ton: 'orange', marke: 'Achtung: Grenze nähert sich' })
    expect(grenzeStand(95, '€ 55.000').marke).toBe('Grenze fast erreicht')
    expect(grenzeStand(95, '€ 55.000').hinweis).toContain('€ 55.000')
  })

  it('Titel der Umsatzkarte je Zeitraum', () => {
    expect(umsatzKartenTitel('woche')).toBe('Umsatz pro Tag')
    expect(umsatzKartenTitel('monat')).toBe('Umsatz pro Woche')
    expect(umsatzKartenTitel('jahr')).toBe('Umsatz pro Monat')
  })
})

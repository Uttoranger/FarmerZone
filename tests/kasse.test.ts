/**
 * Die reinen Regeln der Kasse (src/lib/kasse.ts, Nachtlauf Nr. 12) — ohne
 * Mock, `jetzt` als Parameter.
 *
 * Beweist:
 *  - E5: Neue Bestellungen kennen nur „Online bezahlen" und „Bar bei
 *    Abholung"; Karte bei Abholung wird nie angeboten.
 *  - Die Beträge der Kasse rechnen in Cent auf demselben Weg wie
 *    /api/checkout (calcTotalAmount → decimalZuCents → berechneServicegebuehr).
 *  - Die Reservierungsfrist erscheint als Uhrzeit und verständliche Restzeit;
 *    an der Frist gilt sie als abgelaufen.
 *  - „Nichts abgebucht" sagt die Kasse nur bei einer abgelehnten Karte, nie
 *    bei einer Zahlung, die schon durch oder unterwegs ist.
 *  - Der Rückweg führt nur aus der Kasse hinaus, solange keine Bestellung steht.
 */
import { describe, it, expect } from 'vitest'
import {
  CODE_ZAHLART_NICHT_ANGEBOTEN,
  ZAHLART_NICHT_ANGEBOTEN,
  abholKacheln,
  bestellschlussHeute,
  gebuehrBezeichnung,
  kassenBetraege,
  kassenZahlarten,
  kassenZurueck,
  reservierungsStand,
  zahlartFuerNeueBestellung,
  zahlungAbgelehntText,
  zahlungsFehlerArt,
} from '@/lib/kasse'
import { berechneServicegebuehr } from '@/lib/servicegebuehr'
import { calcTotalAmount, decimalZuCents } from '@/lib/order-totals'

const HOF_ALLES = { acceptsOnline: true, stripeAccountReady: true, acceptsOnsite: true }
const GEBUEHR_5 = { serviceFeePercent: 5, serviceFeeMinCents: 50, serviceFeeActiveFrom: '2026-01-01T00:00:00.000Z' }
const GEBUEHRFREI = { serviceFeePercent: 5, serviceFeeMinCents: 50, serviceFeeActiveFrom: null }
// Montag, 5. Oktober 2026, 10:00 Uhr in Wien (UTC+2)
const JETZT = new Date('2026-10-05T08:00:00.000Z')

describe('E5: Zahlarten für neue Bestellungen', () => {
  it('bietet online und bar an, nie Karte bei Abholung', () => {
    const arten = kassenZahlarten(HOF_ALLES)
    expect(arten.map((a) => a.wert)).toEqual(['ONLINE', 'ONSITE_CASH'])
    expect(JSON.stringify(arten)).not.toMatch(/ONSITE_CARD|Karte bei Abholung/)
  })

  it('online nur mit fertigem Stripe-Konto — dieselbe Bedingung wie der Server', () => {
    expect(kassenZahlarten({ ...HOF_ALLES, stripeAccountReady: false }).map((a) => a.wert)).toEqual(['ONSITE_CASH'])
    expect(kassenZahlarten({ ...HOF_ALLES, acceptsOnline: false }).map((a) => a.wert)).toEqual(['ONSITE_CASH'])
  })

  it('ohne Vor-Ort-Zahlung bleibt nur online, ohne beides nichts', () => {
    expect(kassenZahlarten({ ...HOF_ALLES, acceptsOnsite: false }).map((a) => a.wert)).toEqual(['ONLINE'])
    expect(kassenZahlarten({ acceptsOnline: false, stripeAccountReady: false, acceptsOnsite: false })).toEqual([])
  })

  it('lässt für eine neue Bestellung nur ONLINE und ONSITE_CASH zu', () => {
    expect(zahlartFuerNeueBestellung('ONLINE')).toBe(true)
    expect(zahlartFuerNeueBestellung('ONSITE_CASH')).toBe(true)
    expect(zahlartFuerNeueBestellung('ONSITE_CARD')).toBe(false)
    expect(zahlartFuerNeueBestellung('')).toBe(false)
  })

  it('die Ablehnung ist ein deutscher Satz mit Ausweg und maschinenlesbarem Code', () => {
    expect(CODE_ZAHLART_NICHT_ANGEBOTEN).toBe('ZAHLART_NICHT_ANGEBOTEN')
    expect(ZAHLART_NICHT_ANGEBOTEN).toMatch(/Bar bei Abholung/)
    expect(ZAHLART_NICHT_ANGEBOTEN).toMatch(/Online bezahlen/)
  })
})

describe('kassenBetraege — derselbe Weg wie /api/checkout', () => {
  it('Eier € 4,50 und Brot € 5,80: Gebühr € 0,52, Gesamt € 10,82 (Mockup)', () => {
    const b = kassenBetraege(
      [
        { productId: 'eier', price: 4.5, quantity: 1 },
        { productId: 'brot', price: 5.8, quantity: 1 },
      ],
      GEBUEHR_5,
      JETZT
    )
    expect(b).toEqual(expect.objectContaining({ warenCents: 1030, gebuehrCents: 52, gesamtCents: 1082 }))
    expect(b.zeilenCents.get('eier')).toBe(450)
    expect(b.zeilenCents.get('brot')).toBe(580)
  })

  it('rechnet ohne Fließkommafehler: 3 × € 1,10 sind 330 Cent', () => {
    const b = kassenBetraege([{ productId: 'p', price: 1.1, quantity: 3 }], GEBUEHRFREI, JETZT)
    expect(b.zeilenCents.get('p')).toBe(330)
    expect(b.warenCents).toBe(330)
    expect(b.gebuehrCents).toBe(0)
    expect(b.gesamtCents).toBe(330)
  })

  it('stimmt für viele Körbe mit der Rechnung des Servers überein', () => {
    const koerbe = [
      [{ productId: 'a', price: 0.99, quantity: 3 }],
      [{ productId: 'a', price: 19.99, quantity: 1 }, { productId: 'b', price: 2.35, quantity: 7 }],
      [{ productId: 'a', price: 180, quantity: 2 }],
      [{ productId: 'a', price: 0.01, quantity: 1 }],
    ]
    for (const korb of koerbe) {
      const server = decimalZuCents(calcTotalAmount(korb.map((p) => ({ unitPrice: p.price, quantity: p.quantity }))))
      const gebuehr = berechneServicegebuehr(server, GEBUEHR_5, JETZT).gebuehrCents
      const b = kassenBetraege(korb, GEBUEHR_5, JETZT)
      expect(b.warenCents).toBe(server)
      expect(b.gebuehrCents).toBe(gebuehr)
      expect(b.gesamtCents).toBe(server + gebuehr)
      expect([...b.zeilenCents.values()].reduce((s, c) => s + c, 0)).toBe(server)
    }
  })

  it('leerer Korb: 0 Warenpreis, die Gebühr fällt trotzdem nur über berechneServicegebuehr an', () => {
    const b = kassenBetraege([], GEBUEHR_5, JETZT)
    expect(b.warenCents).toBe(0)
    expect(b.gebuehrCents).toBe(berechneServicegebuehr(0, GEBUEHR_5, JETZT).gebuehrCents)
  })
})

describe('gebuehrBezeichnung', () => {
  it('nennt Satz und Mindestgebühr wie im Mockup', () => {
    expect(gebuehrBezeichnung(GEBUEHR_5, JETZT)).toBe('Servicegebühr · 5 %, mind. € 0,50')
  })

  it('ohne Mindestgebühr ohne „mind."', () => {
    expect(gebuehrBezeichnung({ ...GEBUEHR_5, serviceFeeMinCents: 0 }, JETZT)).toBe('Servicegebühr · 5 %')
  })

  it('gebührenfrei: nur das Wort (die Zeile entfällt dann ohnehin)', () => {
    expect(gebuehrBezeichnung(GEBUEHRFREI, JETZT)).toBe('Servicegebühr')
  })
})

describe('reservierungsStand', () => {
  const bis = '2026-10-05T08:12:00.000Z' // 10:12 Uhr in Wien

  it('ohne Frist: unbekannt (nichts anzeigen, was nicht stimmt)', () => {
    expect(reservierungsStand(null, JETZT)).toEqual({ zustand: 'unbekannt' })
    expect(reservierungsStand('kein Datum', JETZT)).toEqual({ zustand: 'unbekannt' })
  })

  it('läuft: Wiener Uhrzeit und Restzeit in Minuten', () => {
    expect(reservierungsStand(bis, JETZT)).toEqual({ zustand: 'laeuft', uhrzeit: '10:12', rest: 'noch 12 Minuten' })
  })

  it('angefangene Minuten zählen voll, eine Minute im Singular', () => {
    expect(reservierungsStand(bis, new Date('2026-10-05T08:11:30.000Z'))).toEqual(
      expect.objectContaining({ zustand: 'laeuft', rest: 'noch 1 Minute' })
    )
    expect(reservierungsStand(bis, new Date('2026-10-05T08:10:59.000Z'))).toEqual(
      expect.objectContaining({ rest: 'noch 2 Minuten' })
    )
  })

  it('genau an der Frist und danach: abgelaufen (wie istGueltig, expiresAt > jetzt)', () => {
    expect(reservierungsStand(bis, new Date(bis))).toEqual({ zustand: 'abgelaufen' })
    expect(reservierungsStand(bis, new Date('2026-10-05T08:12:00.001Z'))).toEqual({ zustand: 'abgelaufen' })
    expect(reservierungsStand(bis, new Date('2026-10-05T08:11:59.999Z')).zustand).toBe('laeuft')
  })
})

describe('zahlungsFehlerArt — „nichts abgebucht" nur, wenn es stimmt', () => {
  it('schon bezahlt oder in Bearbeitung: zur Bestellung, nie „abgelehnt"', () => {
    expect(zahlungsFehlerArt({ fehlerTyp: 'card_error', intentStatus: 'succeeded', fristUm: false })).toBe('bezahlt')
    expect(zahlungsFehlerArt({ fehlerTyp: 'invalid_request_error', intentStatus: 'processing', fristUm: true })).toBe('bezahlt')
  })

  it('abgebrochener Zahlungsvorgang oder Frist um: abgelaufen', () => {
    expect(zahlungsFehlerArt({ fehlerTyp: 'invalid_request_error', intentStatus: 'canceled', fristUm: false })).toBe('abgelaufen')
    expect(zahlungsFehlerArt({ fehlerTyp: 'card_error', intentStatus: 'requires_payment_method', fristUm: true })).toBe('abgelaufen')
  })

  it('abgelehnte Karte: abgelehnt', () => {
    expect(zahlungsFehlerArt({ fehlerTyp: 'card_error', intentStatus: 'requires_payment_method', fristUm: false })).toBe('abgelehnt')
    expect(zahlungsFehlerArt({ fehlerTyp: 'card_error', intentStatus: undefined, fristUm: false })).toBe('abgelehnt')
  })

  it('unvollständige Eingabe, Netzfehler und Unbekanntes: kein Zusatz', () => {
    expect(zahlungsFehlerArt({ fehlerTyp: 'validation_error', intentStatus: undefined, fristUm: false })).toBe('sonstig')
    expect(zahlungsFehlerArt({ fehlerTyp: 'api_connection_error', intentStatus: undefined, fristUm: false })).toBe('sonstig')
  })
})

describe('zahlungAbgelehntText', () => {
  it('Wortlaut des Mockups mit der Uhrzeit, bis zu der die Ware wartet', () => {
    expect(zahlungAbgelehntText('14:32')).toEqual({
      titel: 'Deine Karte wurde abgelehnt',
      text: 'Es wurde nichts abgebucht. Versuch es mit einer anderen Karte oder Zahlungsart – deine Ware bleibt bis 14:32 Uhr für dich reserviert.',
    })
  })

  it('ohne bekannte Frist ohne Uhrzeit', () => {
    expect(zahlungAbgelehntText(null).text).toBe('Es wurde nichts abgebucht. Versuch es mit einer anderen Karte oder Zahlungsart.')
  })
})

describe('kassenZurueck — kein Weg hinaus, sobald eine Bestellung steht', () => {
  it('vor dem Bestellen: Link zum Hof', () => {
    expect(kassenZurueck({ farmSlug: 'hof-test', schritt: 'formular', bestellungAngelegt: false })).toEqual({
      art: 'link',
      href: '/hof-test',
      label: 'Zurück zum Hof',
    })
  })

  it('im Zahlungsschritt: Knopf zurück zu den Angaben, kein Link', () => {
    expect(kassenZurueck({ farmSlug: 'hof-test', schritt: 'zahlung', bestellungAngelegt: true })).toEqual({
      art: 'knopf',
      ziel: 'formular',
      label: 'Zurück zu deinen Angaben',
    })
  })

  it('nach „Zurück" aus der Zahlung: Knopf zurück zur Zahlung, kein Link', () => {
    expect(kassenZurueck({ farmSlug: 'hof-test', schritt: 'formular', bestellungAngelegt: true })).toEqual({
      art: 'knopf',
      ziel: 'zahlung',
      label: 'Zurück zur Zahlung',
    })
  })
})

describe('abholKacheln — dieselben Fenster wie der Server (angeboteneAbholfenster)', () => {
  // Montag = dayOfWeek 1
  const slots = [
    { id: 's1', dayOfWeek: 1, startTime: '15:00', endTime: '18:00', maxOrders: null, isActive: true },
    { id: 's2', dayOfWeek: 1, startTime: '08:00', endTime: '09:00', maxOrders: null, isActive: true },
    { id: 's3', dayOfWeek: 2, startTime: '09:00', endTime: '12:00', maxOrders: 3, isActive: true },
  ]

  it('heute nur Fenster, deren Beginn noch kommt; „Heute", „Morgen", dann Wochentag', () => {
    const kacheln = abholKacheln(slots, JETZT, [])
    expect(kacheln[0]).toEqual(expect.objectContaining({ key: '2026-10-05|15:00|18:00', tag: 'Heute', zeit: '15:00–18:00 Uhr', ausgebucht: false }))
    expect(kacheln[1]).toEqual(expect.objectContaining({ key: '2026-10-06|09:00|12:00', tag: 'Morgen' }))
    expect(kacheln.some((k) => k.key.startsWith('2026-10-05|08:00'))).toBe(false)
  })

  it('volle Fenster bleiben sichtbar, aber ausgebucht', () => {
    const kacheln = abholKacheln(slots, JETZT, ['2026-10-06|09:00|12:00'])
    expect(kacheln.find((k) => k.key === '2026-10-06|09:00|12:00')?.ausgebucht).toBe(true)
  })

  it('Bestellschluss für heute = Beginn des letzten freien heutigen Fensters', () => {
    expect(bestellschlussHeute(abholKacheln(slots, JETZT, []))).toBe('15:00')
    const zwei = [...slots, { id: 's4', dayOfWeek: 1, startTime: '17:00', endTime: '19:00', maxOrders: null, isActive: true }]
    expect(bestellschlussHeute(abholKacheln(zwei, JETZT, []))).toBe('17:00')
    expect(bestellschlussHeute(abholKacheln(zwei, JETZT, ['2026-10-05|17:00|19:00']))).toBe('15:00')
    expect(bestellschlussHeute(abholKacheln(slots, new Date('2026-10-05T14:00:00.000Z'), []))).toBeNull()
  })
})

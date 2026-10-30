/**
 * Nach gescheiterter Zahlung bleibt der Korb, „Erneut versuchen" zahlt
 * dieselbe Bestellung (Audit A3, Nr. 202) — die reinen Regeln, ohne Mock.
 *
 * Beweist:
 *  - `korbLeeren` je Zustand der Bestätigungsseite: geleert wird nur, wenn
 *    die Bestellung bezahlt, bar bestätigt oder bar wartend ist.
 *  - `fortsetzungsZiel`: In die Zahlung derselben Bestellung geht es nur,
 *    solange sie online offen ist, ihre Frist läuft und ein Zahlungsvorgang
 *    gespeichert ist; storniert oder nach der Frist in die Kasse; alles
 *    andere zur Bestätigungsseite.
 *  - `zielNachIntent`: nur ein Zahlungsvorgang, der noch auf eine Zahlung
 *    wartet, wird neu bestätigt.
 *  - Der Pfad trägt Kennung und Signatur als Parameter der Kasse.
 *  - `fortsetzungsKorb`: Zeilen, Satz und Gebührenzeile der fortgesetzten
 *    Zahlung nur aus dem Snapshot der Bestellung (Nachbesserung 1) — ein
 *    anderer Satz des Hofs heute ändert nichts.
 */
import { describe, it, expect } from 'vitest'
import { korbLeeren, type BestaetigungsZustand } from '@/lib/bestaetigung'
import {
  FORTSETZEN_PARAMETER,
  fortsetzungsKorb,
  fortsetzungsZiel,
  zahlungFortsetzenPfad,
  zielNachIntent,
  type FortsetzungsBestellung,
  type FortsetzungsSnapshot,
} from '@/lib/kasse'
import { endpreisJeStueckCents } from '@/lib/plattformgebuehr'
import { SERVICEGEBUEHR_BEZEICHNUNG } from '@/lib/servicegebuehr'
import { PLATTFORMGEBUEHR_BEZEICHNUNG } from '@/lib/konditionen'
import { ZAHLUNGSFRIST_ONLINE_MINUTEN } from '@/lib/fristen'

describe('korbLeeren je Zustand der Bestätigungsseite', () => {
  const erwartet: Array<[BestaetigungsZustand | null, boolean]> = [
    ['bezahlt', true],
    ['bestaetigt', true],
    ['bestaetigung-offen', true],
    ['zahlung-fehlgeschlagen', false],
    ['zahlung-wird-geprueft', false],
    ['verfallen', false],
    [null, false],
  ]
  it.each(erwartet)('%s → %s', (zustand, leeren) => {
    expect(korbLeeren(zustand)).toBe(leeren)
  })
})

const JETZT = new Date('2026-10-05T08:20:00Z')

const offen = (teil: Partial<FortsetzungsBestellung> = {}): FortsetzungsBestellung => ({
  paymentMethod: 'ONLINE',
  paymentStatus: 'FAILED',
  status: 'PENDING_CONFIRMATION',
  stripePaymentIntentId: 'pi_beispiel',
  createdAt: new Date('2026-10-05T08:10:00Z'),
  pickupDate: new Date('2026-10-06T12:00:00Z'),
  pickupTimeStart: '15:00',
  ...teil,
})

describe('fortsetzungsZiel', () => {
  it('online offen, Frist läuft, Zahlungsvorgang gespeichert: in die Zahlung derselben Bestellung', () => {
    expect(fortsetzungsZiel(offen(), JETZT)).toBe('zahlung')
    // Gescheitert oder nie abgeschlossen — beides ist dieselbe offene Bestellung.
    expect(fortsetzungsZiel(offen({ paymentStatus: 'PENDING' }), JETZT)).toBe('zahlung')
  })

  it('Frist vorbei (gilt beim Lesen, auch ohne Storno): in die Kasse', () => {
    const vorbei = new Date(offen().createdAt.getTime() + ZAHLUNGSFRIST_ONLINE_MINUTEN * 60_000)
    expect(fortsetzungsZiel(offen(), vorbei)).toBe('kasse')
  })

  it('storniert: in die Kasse', () => {
    expect(fortsetzungsZiel(offen({ status: 'CANCELLED' }), JETZT)).toBe('kasse')
  })

  it('bezahlt, weiter im Ablauf, bar oder noch ohne Zahlungsvorgang: zur Bestätigungsseite', () => {
    expect(fortsetzungsZiel(offen({ status: 'PAID', paymentStatus: 'PAID' }), JETZT)).toBe('bestaetigung')
    expect(fortsetzungsZiel(offen({ status: 'READY', paymentStatus: 'PAID' }), JETZT)).toBe('bestaetigung')
    expect(fortsetzungsZiel(offen({ paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING' }), JETZT)).toBe('bestaetigung')
    // Die erste Anfrage legt den Zahlungsvorgang gerade an — keine zweite Bestellung daneben.
    expect(fortsetzungsZiel(offen({ stripePaymentIntentId: null }), JETZT)).toBe('bestaetigung')
  })
})

describe('zielNachIntent', () => {
  it('wartet der Zahlungsvorgang auf eine Zahlung, wird er neu bestätigt', () => {
    expect(zielNachIntent('requires_payment_method')).toBe('zahlung')
    expect(zielNachIntent('requires_confirmation')).toBe('zahlung')
    expect(zielNachIntent('requires_action')).toBe('zahlung')
  })

  it('abgebrochen: Kasse; unterwegs oder durch: Bestätigungsseite', () => {
    expect(zielNachIntent('canceled')).toBe('kasse')
    expect(zielNachIntent('processing')).toBe('bestaetigung')
    expect(zielNachIntent('succeeded')).toBe('bestaetigung')
    expect(zielNachIntent('requires_capture')).toBe('bestaetigung')
  })
})

describe('zahlungFortsetzenPfad', () => {
  it('führt in die Kasse des Hofs, mit Kennung und Signatur als Parameter', () => {
    const url = new URL(zahlungFortsetzenPfad('hof-test', 'order-1', '2.abc'), 'http://localhost')
    expect(url.pathname).toBe('/hof-test/checkout')
    expect(url.searchParams.get(FORTSETZEN_PARAMETER)).toBe('order-1')
    expect(url.searchParams.get('sig')).toBe('2.abc')
  })
})

describe('fortsetzungsKorb: nur der Snapshot der Bestellung', () => {
  it('Hofpreis-Modell: Zeile = totalPrice + gespeicherte Gebühr, Satz der Bestellung — auch wenn der Hof heute einen anderen hat', () => {
    // Bestellt mit 6 %: 3 × 2,15 € → Gebühr je Stück 13 Cent (aufgerundet), Zeile 6,45 € + 0,39 €.
    const b: FortsetzungsSnapshot = {
      gebuehrModell: 'hofpreis',
      serviceFeeCents: 39,
      serviceFeePercentApplied: '6.00',
      serviceFeeMinCentsApplied: 0,
      items: [{ productId: 'p1', unitPrice: '2.15', totalPrice: '6.45', gebuehrCents: 39 }],
    }
    const korb = fortsetzungsKorb(b)
    expect(korb.zeilenCents).toEqual({ p1: 684 })
    expect(korb.anzeige).toEqual({ hundertstel: 600 })
    expect(korb.gebuehrText).toBe(PLATTFORMGEBUEHR_BEZEICHNUNG)
    // Der Endpreis je Stück, den die Korbkarte aus dem Satz der Bestellung zeigt, ergibt × Menge genau die Zeile.
    expect(3 * endpreisJeStueckCents(215, korb.anzeige!.hundertstel)).toBe(684)
  })

  it('Modell bisher: Zeile = totalPrice ohne Gebühr, Gebührenzeile mit Satz und Mindestgebühr der Bestellung', () => {
    const b: FortsetzungsSnapshot = {
      gebuehrModell: null,
      serviceFeeCents: 50,
      serviceFeePercentApplied: '5.00',
      serviceFeeMinCentsApplied: 50,
      items: [
        { productId: 'p1', unitPrice: '3.00', totalPrice: '6.00', gebuehrCents: 0 },
        { productId: 'p2', unitPrice: '1.10', totalPrice: '3.30', gebuehrCents: 0 },
      ],
    }
    const korb = fortsetzungsKorb(b)
    expect(korb.zeilenCents).toEqual({ p1: 600, p2: 330 })
    expect(korb.anzeige).toBeNull()
    expect(korb.gebuehrText).toBe(`${SERVICEGEBUEHR_BEZEICHNUNG} · 5 %, mind. € 0,50`)
  })

  it('ohne Gebühr nur das Wort', () => {
    const korb = fortsetzungsKorb({ gebuehrModell: null, serviceFeeCents: 0, serviceFeePercentApplied: null, serviceFeeMinCentsApplied: null, items: [] })
    expect(korb.gebuehrText).toBe(SERVICEGEBUEHR_BEZEICHNUNG)
  })
})

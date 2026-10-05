/**
 * „Bestellungen finden" per E-Mail-Code (Nr. 14, E7/E8) — die reinen Regeln
 * (src/lib/bestellungen-finden.ts), der Zugang (src/lib/bestellungen-zugang.ts:
 * Code-Hash und signierter Cookie) und die Schemas.
 *
 * Beweist:
 *  - Der Code-Versuch: fehlt → falsch; abgelaufen → abgelaufen und weg;
 *    5 Fehlversuche → gesperrt, auch für den richtigen Code; falsch → +1 in der
 *    Zeile; richtig → verbraucht (nur einmal). Grenze genau an der Frist.
 *  - Der Code liegt nur als HMAC (mit Adresse) in der Datenbank; ein Code
 *    gilt nur für die Adresse, für die er angelegt wurde.
 *  - Der Cookie: gültig → Adresse; manipuliert (Adresse, Ablauf, Signatur) →
 *    nichts; abgelaufen → „abgelaufen", keine Adresse; fremdes Format → nichts.
 *  - Das ILIKE-Muster prüft tests/ilike-muster.test.ts (eine Quelle:
 *    src/lib/ilike-muster.ts).
 *  - Die Liste: laufende oben (nächster Abholtag zuerst), frühere darunter
 *    (neueste zuerst); Marke, Ton, Betrag, Zahlung aus den gemeinsamen Quellen.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  BESTELLUNGEN_ANSICHT_SEKUNDEN,
  bestellCodeFehlerText,
  bestellCodeKennung,
  bestellEintrag,
  codeWert,
  entscheideCodeVersuch,
  leseCodeWert,
  teileBestellungen,
  type ListenBestellung,
} from '@/lib/bestellungen-finden'
import {
  bestellCodePasst,
  bestellZugangsToken,
  erzeugeBestellCode,
  hashBestellCode,
  leseBestellZugang,
} from '@/lib/bestellungen-zugang'
import { bestellCodeAnfordernSchema, bestellCodePruefenSchema } from '@/schemas/bestellungen-finden'
import { ANMELDECODE_MAX_VERSUCHE } from '@/lib/anmeldecode'

const JETZT = new Date('2026-10-05T10:00:00.000Z') // 12:00 in Wien
const SPAETER = new Date(JETZT.getTime() + 10 * 60_000)

describe('entscheideCodeVersuch', () => {
  const zeile = (versuche: number, expiresAt: Date = SPAETER) => ({ wert: codeWert('abc', versuche), expiresAt })
  const passt = () => true
  const passtNicht = () => false

  it('ohne Zeile: „falsch", nichts wird geschrieben', () => {
    expect(entscheideCodeVersuch(null, passt, JETZT)).toEqual({ ergebnis: 'INVALID_OTP', schreiben: 'nichts' })
  })

  it('der richtige Code wird verbraucht', () => {
    expect(entscheideCodeVersuch(zeile(0), passt, JETZT)).toEqual({ ergebnis: 'ok', schreiben: 'verbrauchen' })
  })

  it('ein falscher Code zählt einen Versuch in der Zeile', () => {
    expect(entscheideCodeVersuch(zeile(2), passtNicht, JETZT)).toEqual({ ergebnis: 'INVALID_OTP', schreiben: { versuche: 3 } })
  })

  it('nach 4 Fehlversuchen nimmt der richtige Code noch an (Gegenprobe)', () => {
    expect(entscheideCodeVersuch(zeile(ANMELDECODE_MAX_VERSUCHE - 1), passt, JETZT).ergebnis).toBe('ok')
  })

  it('nach 5 Fehlversuchen ist gesperrt — auch für den richtigen Code', () => {
    expect(entscheideCodeVersuch(zeile(ANMELDECODE_MAX_VERSUCHE), passt, JETZT)).toEqual({
      ergebnis: 'TOO_MANY_ATTEMPTS',
      schreiben: 'nichts',
    })
  })

  it('abgelaufen genau an der Frist — und die Zeile fällt weg', () => {
    expect(entscheideCodeVersuch(zeile(0, JETZT), passt, JETZT)).toEqual({ ergebnis: 'OTP_EXPIRED', schreiben: 'loeschen' })
    expect(entscheideCodeVersuch(zeile(0, new Date(JETZT.getTime() + 1)), passt, JETZT).ergebnis).toBe('ok')
  })

  it('ein kaputter Wert gilt als falsch und fällt weg', () => {
    expect(entscheideCodeVersuch({ wert: 'ohne-zaehler', expiresAt: SPAETER }, passt, JETZT)).toEqual({
      ergebnis: 'INVALID_OTP',
      schreiben: 'loeschen',
    })
  })
})

describe('Code-Wert und Kennung', () => {
  it('Hash und Zähler stehen wie beim Plugin als „<hash>:<versuche>"', () => {
    expect(codeWert('abc', 3)).toBe('abc:3')
    expect(leseCodeWert('abc:3')).toEqual({ hash: 'abc', versuche: 3 })
    expect(leseCodeWert('abc:x')).toBeNull()
    expect(leseCodeWert('abc')).toBeNull()
  })

  it('die Kennung trennt sich von den Kennungen des Anmelde-Plugins', () => {
    expect(bestellCodeKennung('kundin@example.com')).toBe('bestellungen-finden-otp-kundin@example.com')
    expect(bestellCodeKennung('kundin@example.com')).not.toMatch(/^sign-in-otp-/)
  })
})

describe('Code-Hash', () => {
  it('der Code hat 6 Ziffern', () => {
    for (let i = 0; i < 50; i += 1) expect(erzeugeBestellCode()).toMatch(/^\d{6}$/)
  })

  it('in der Datenbank steht nie der Code selbst, und er gilt nur für seine Adresse', () => {
    const hash = hashBestellCode('kundin@example.com', '481234')
    expect(hash).not.toContain('481234')
    expect(bestellCodePasst('kundin@example.com', '481234', hash)).toBe(true)
    expect(bestellCodePasst('kundin@example.com', '481235', hash)).toBe(false)
    expect(bestellCodePasst('andere@example.com', '481234', hash)).toBe(false)
    expect(bestellCodePasst('kundin@example.com', '481234', 'kurz')).toBe(false)
  })
})

describe('signierter Cookie', () => {
  const token = bestellZugangsToken('kundin@example.com', JETZT)

  it('gültig: die bewiesene Adresse', () => {
    expect(leseBestellZugang(token, JETZT)).toEqual({ art: 'gueltig', email: 'kundin@example.com' })
    expect(leseBestellZugang(token, new Date(JETZT.getTime() + BESTELLUNGEN_ANSICHT_SEKUNDEN * 1000 - 1000))).toEqual({
      art: 'gueltig',
      email: 'kundin@example.com',
    })
  })

  it('abgelaufen nach 30 Minuten: keine Adresse', () => {
    expect(leseBestellZugang(token, new Date(JETZT.getTime() + BESTELLUNGEN_ANSICHT_SEKUNDEN * 1000))).toEqual({ art: 'abgelaufen' })
  })

  it('manipuliert — andere Adresse, längere Frist, fremde Signatur: keine Daten', () => {
    const [, ablauf, signatur] = token.split('.')
    const fremdeAdresse = Buffer.from('andere@example.com').toString('base64url')
    expect(leseBestellZugang(`${fremdeAdresse}.${ablauf}.${signatur}`, JETZT)).toEqual({ art: 'keiner' })
    const [adresse] = token.split('.')
    expect(leseBestellZugang(`${adresse}.${Number(ablauf) + 3600}.${signatur}`, JETZT)).toEqual({ art: 'keiner' })
    expect(leseBestellZugang(`${adresse}.${ablauf}.${'0'.repeat(signatur.length)}`, JETZT)).toEqual({ art: 'keiner' })
  })

  it('fehlt oder hat ein fremdes Format: nichts', () => {
    for (const roh of [undefined, '', 'abc', 'a.b', 'a.b.c.d', `${token}.x`]) {
      expect(leseBestellZugang(roh, JETZT), String(roh)).toEqual({ art: 'keiner' })
    }
  })

  it('auch ein abgelaufener, manipulierter Cookie verrät nicht, dass er abgelaufen ist', () => {
    const [adresse, ablauf] = token.split('.')
    expect(leseBestellZugang(`${adresse}.${ablauf}.${'f'.repeat(64)}`, new Date(JETZT.getTime() + 3_600_000))).toEqual({ art: 'keiner' })
  })
})

describe('Schemas', () => {
  it('Adresse wie gespeichert: ohne Ränder, klein', () => {
    expect(bestellCodeAnfordernSchema.parse({ email: '  Kundin@Example.COM ' })).toEqual({ email: 'kundin@example.com' })
    expect(bestellCodeAnfordernSchema.safeParse({ email: 'keine-adresse' }).success).toBe(false)
  })

  it('der Code hat genau 6 Ziffern', () => {
    expect(bestellCodePruefenSchema.safeParse({ email: 'kundin@example.com', code: '481234' }).success).toBe(true)
    for (const code of ['48123', '4812345', 'abcdef', '']) {
      expect(bestellCodePruefenSchema.safeParse({ email: 'kundin@example.com', code }).success, code).toBe(false)
    }
  })
})

describe('bestellCodeFehlerText', () => {
  it('geduzt, ohne Fachwort, mit Ausweg', () => {
    expect(bestellCodeFehlerText('INVALID_OTP')).toMatch(/Code stimmt nicht/)
    expect(bestellCodeFehlerText('OTP_EXPIRED')).toMatch(/abgelaufen.*10 Minuten/)
    expect(bestellCodeFehlerText('TOO_MANY_ATTEMPTS')).toMatch(/zu oft/)
    expect(bestellCodeFehlerText('ZU_VIELE')).toMatch(/Minute/)
    for (const fehler of ['INVALID_OTP', 'OTP_EXPIRED', 'TOO_MANY_ATTEMPTS', 'ZU_VIELE', 'UNBEKANNT'] as const) {
      expect(bestellCodeFehlerText(fehler)).not.toMatch(/OTP|Session|Token|Fehler \d/)
    }
  })
})

function bestellung(teil: Partial<ListenBestellung> = {}): ListenBestellung {
  return {
    id: 'b1',
    link: '/hof-test/confirm/b1?sig=x',
    hofName: 'Hof Test',
    bestellnummer: 'HT-0001',
    status: 'PAID',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    pickupDate: new Date('2026-10-06T10:00:00.000Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    createdAt: new Date('2026-10-04T08:00:00.000Z'),
    gesamtCents: 1082,
    artikel: 2,
    ...teil,
  }
}

describe('teileBestellungen', () => {
  it('laufend: aktiver Status und Abholtag heute oder später — nächster zuerst', () => {
    const uebermorgen = bestellung({ id: 'c', pickupDate: new Date('2026-10-07T10:00:00.000Z') })
    const heute = bestellung({ id: 'a', pickupDate: new Date('2026-10-05T10:00:00.000Z'), status: 'READY' })
    const morgen = bestellung({ id: 'b', status: 'PENDING_CONFIRMATION', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING' })
    const { laufend, frueher } = teileBestellungen([uebermorgen, morgen, heute], JETZT)
    expect(laufend.map((b) => b.id)).toEqual(['a', 'b', 'c'])
    expect(frueher).toEqual([])
  })

  it('früher: abgeholt, storniert, nicht abgeholt — und Aktives mit vergangenem Abholtag; neueste zuerst', () => {
    const abgeholt = bestellung({ id: 'x', status: 'PICKED_UP', createdAt: new Date('2026-09-20T08:00:00.000Z') })
    const storniert = bestellung({ id: 'y', status: 'CANCELLED', createdAt: new Date('2026-10-01T08:00:00.000Z') })
    const liegenGeblieben = bestellung({
      id: 'z',
      status: 'READY',
      pickupDate: new Date('2026-10-04T10:00:00.000Z'),
      createdAt: new Date('2026-09-28T08:00:00.000Z'),
    })
    const { laufend, frueher } = teileBestellungen([abgeholt, storniert, liegenGeblieben], JETZT)
    expect(laufend).toEqual([])
    expect(frueher.map((b) => b.id)).toEqual(['y', 'z', 'x'])
  })

  it('der Abholtag zählt in Wiener Zeit — 0:30 Uhr in Wien ist schon der neue Tag', () => {
    // 22:30 UTC am 5. = 0:30 Uhr am 6. in Wien: Eine Abholung am 5. ist dann vorbei.
    const nachMitternacht = new Date('2026-10-05T22:30:00.000Z')
    const gestern = bestellung({ pickupDate: new Date('2026-10-05T10:00:00.000Z') })
    expect(teileBestellungen([gestern], nachMitternacht).frueher).toHaveLength(1)
  })
})

describe('bestellEintrag', () => {
  it('laufend: Marke und Ton aus dem Status, Abholzeit, Betrag über formatEuro, Zahlung in Kundinnen-Sprache', () => {
    const eintrag = bestellEintrag(bestellung({ status: 'READY' }), JETZT, true)
    expect(eintrag).toMatchObject({
      marke: 'Abholbereit',
      ton: 'fertig',
      wann: 'Morgen, 15:00–18:00 Uhr',
      betrag: '€ 10,82',
      zahlung: 'Online · Bezahlt',
      artikel: '2 Artikel',
      link: '/hof-test/confirm/b1?sig=x',
    })
  })

  it('wartet auf die Kundin: orange', () => {
    const eintrag = bestellEintrag(
      bestellung({ status: 'PENDING_CONFIRMATION', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING' }),
      JETZT,
      true
    )
    expect(eintrag.ton).toBe('offen')
    expect(eintrag.marke).toBe('Bestätigung offen')
    expect(eintrag.zahlung).toBe('Bar bei Abholung · Noch offen')
  })

  it('früher: festes Datum des Abholtags, ohne Jahr im laufenden Jahr; abgeschlossen ist neutral', () => {
    const eintrag = bestellEintrag(bestellung({ status: 'PICKED_UP', pickupDate: new Date('2026-09-26T10:00:00.000Z') }), JETZT, false)
    expect(eintrag.wann).toBe('26. Sep.')
    expect(eintrag.ton).toBe('neutral')
    expect(eintrag.marke).toBe('Abgeholt')
    const letztesJahr = bestellEintrag(bestellung({ status: 'CANCELLED', pickupDate: new Date('2025-01-10T10:00:00.000Z') }), JETZT, false)
    expect(letztesJahr.wann).toBe('10. Jän. 2025')
    expect(letztesJahr.ton).toBe('neutral')
  })

  it('ein Artikel heißt „1 Artikel"', () => {
    expect(bestellEintrag(bestellung({ artikel: 1 }), JETZT, true).artikel).toBe('1 Artikel')
  })
})

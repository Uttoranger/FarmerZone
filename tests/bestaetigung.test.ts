/**
 * Was die Bestätigungsseite über eine Bestellung sagt (src/lib/bestaetigung.ts)
 * — nur aus dem Datenbankstand; Stripes redirect_status ist höchstens ein Hinweis.
 */
import { describe, it, expect } from 'vitest'
import { abholZeitText, bestaetigungsBloecke, bestaetigungsKopf, bestaetigungsZustand, bestellSchritte } from '@/lib/bestaetigung'
import { GRUND_NICHT_BESTAETIGT, GRUND_ZAHLUNG_VERFALLEN, fristVon, uhrzeitInWien } from '@/lib/fristen'

type Bestellung = Parameters<typeof bestaetigungsZustand>[0]

const online = (teil: Partial<Bestellung> = {}): Bestellung => ({
  paymentMethod: 'ONLINE',
  paymentStatus: 'PENDING',
  status: 'PENDING_CONFIRMATION',
  cancelReason: null,
  ...teil,
})
const vorOrt = (teil: Partial<Bestellung> = {}): Bestellung => ({ ...online(), paymentMethod: 'ONSITE_CASH', ...teil })

describe('Online-Zahlung', () => {
  it('„bezahlt" nur, wenn die Datenbank PAID sagt', () => {
    expect(bestaetigungsZustand(online({ paymentStatus: 'PAID', status: 'PAID' }), undefined)).toBe('bezahlt')
    expect(bestaetigungsZustand(online(), 'succeeded')).not.toBe('bezahlt')
  })

  it('redirect_status=succeeded vor dem Webhook: „Zahlung wird geprüft"', () => {
    expect(bestaetigungsZustand(online(), 'succeeded')).toBe('zahlung-wird-geprueft')
    expect(bestaetigungsZustand(online(), 'processing')).toBe('zahlung-wird-geprueft')
  })

  it('fehlgeschlagen aus Datenbank oder Rückmeldung — beides nur ein Angebot zum neuen Versuch', () => {
    expect(bestaetigungsZustand(online({ paymentStatus: 'FAILED' }), undefined)).toBe('zahlung-fehlgeschlagen')
    expect(bestaetigungsZustand(online(), 'failed')).toBe('zahlung-fehlgeschlagen')
  })

  it('storniert: kein Hinweis aus der Adresse ändert etwas', () => {
    const storniert = online({ status: 'CANCELLED', cancelReason: GRUND_ZAHLUNG_VERFALLEN })
    expect(bestaetigungsZustand(storniert, 'succeeded')).toBeNull()
    expect(bestaetigungsZustand(storniert, 'failed')).toBeNull()
  })

  it('storniert, aber noch PAID (Erstattung läuft): nicht „bezahlt"', () => {
    expect(bestaetigungsZustand(online({ status: 'CANCELLED', paymentStatus: 'PAID' }), undefined)).toBeNull()
  })

  it('ohne Hinweis und ohne Zahlung: nichts', () => {
    expect(bestaetigungsZustand(online(), undefined)).toBeNull()
  })
})

describe('Zahlung vor Ort', () => {
  it('wartet auf die Bestätigung per E-Mail', () => {
    expect(bestaetigungsZustand(vorOrt(), undefined)).toBe('bestaetigung-offen')
  })

  it.each(['CONFIRMED', 'IN_PREPARATION', 'READY', 'PICKED_UP'] as const)('%s zählt als bestätigt', (status) => {
    expect(bestaetigungsZustand(vorOrt({ status }), undefined)).toBe('bestaetigt')
  })

  it('nicht rechtzeitig bestätigt: verfallen; anders storniert oder nicht abgeholt: nichts', () => {
    expect(bestaetigungsZustand(vorOrt({ status: 'CANCELLED', cancelReason: GRUND_NICHT_BESTAETIGT }), undefined)).toBe(
      'verfallen'
    )
    expect(bestaetigungsZustand(vorOrt({ status: 'CANCELLED', cancelReason: 'Vom Hof storniert' }), undefined)).toBeNull()
    expect(bestaetigungsZustand(vorOrt({ status: 'NOT_PICKED_UP' }), undefined)).toBeNull()
  })

  it('ein redirect_status spielt bei Zahlung vor Ort keine Rolle', () => {
    expect(bestaetigungsZustand(vorOrt(), 'succeeded')).toBe('bestaetigung-offen')
  })
})

// ─── Nr. 13: Status-Schritte, Kopf und Blöcke der Bestätigungsseite ─────────

describe('bestellSchritte — die Schritte aus dem echten Bestellstatus', () => {
  // 10:12 Uhr Wiener Sommerzeit bestellt, Abholung heute 15–18 Uhr.
  const JETZT = new Date('2026-10-05T08:20:00Z')
  type SchrittBestellung = Parameters<typeof bestellSchritte>[0]
  const basis = (teil: Partial<SchrittBestellung> = {}): SchrittBestellung => ({
    paymentMethod: 'ONSITE_CASH',
    paymentStatus: 'PENDING',
    status: 'PENDING_CONFIRMATION',
    createdAt: new Date('2026-10-05T08:12:00Z'),
    pickupDate: new Date('2026-10-05T12:00:00Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    ...teil,
  })
  const staende = (o: SchrittBestellung) => bestellSchritte(o, JETZT)?.map((s) => `${s.titel}:${s.stand}`)

  it('bar, unbestätigt: Bestellt erledigt, Bestätigen ist dran — mit der Frist aus fristen.ts', () => {
    const schritte = bestellSchritte(basis(), JETZT)
    expect(schritte?.map((s) => `${s.titel}:${s.stand}`)).toEqual([
      'Bestellt:erledigt',
      'Bestätigt:naechster',
      'Gepackt:offen',
      'Abgeholt:offen',
    ])
    // Zwei Stunden ab 10:12 Uhr, vor dem Bestellschluss um 15:00 Uhr.
    expect(schritte?.[1].zusatz).toBe(`bis ${uhrzeitInWien(fristVon(basis()))} Uhr`)
    expect(schritte?.[1].zusatz).toBe('bis 12:12 Uhr')
    expect(schritte?.[0].zusatz).toBe('heute, 10:12 Uhr')
    expect(schritte?.[2].zusatz).toBe('bis 15:00 Uhr')
    expect(schritte?.[3].zusatz).toBe('heute, 15:00–18:00 Uhr')
  })

  it('bar bestätigt, gepackt, abgeholt — jeder Status rückt genau einen Schritt weiter', () => {
    expect(staende(basis({ status: 'CONFIRMED' }))).toEqual([
      'Bestellt:erledigt',
      'Bestätigt:erledigt',
      'Gepackt:naechster',
      'Abgeholt:offen',
    ])
    expect(staende(basis({ status: 'IN_PREPARATION' }))?.[2]).toBe('Gepackt:naechster')
    expect(staende(basis({ status: 'READY' }))).toEqual([
      'Bestellt:erledigt',
      'Bestätigt:erledigt',
      'Gepackt:erledigt',
      'Abgeholt:naechster',
    ])
    expect(staende(basis({ status: 'PICKED_UP' }))?.every((s) => s.endsWith(':erledigt'))).toBe(true)
  })

  it('online: der zweite Schritt heißt „Bezahlt" und zählt nur mit Zahlung aus der Datenbank', () => {
    const offen = basis({ paymentMethod: 'ONLINE' })
    expect(staende(offen)?.[1]).toBe('Bezahlt:naechster')
    // Zahlungsfrist online: 30 Minuten ab 10:12 Uhr.
    expect(bestellSchritte(offen, JETZT)?.[1].zusatz).toBe('bis 10:42 Uhr')
    expect(staende(basis({ paymentMethod: 'ONLINE', paymentStatus: 'PAID', status: 'PAID' }))?.[1]).toBe('Bezahlt:erledigt')
  })

  it('storniert oder nicht abgeholt: keine Schritte, die einen Fortschritt vortäuschen', () => {
    expect(bestellSchritte(basis({ status: 'CANCELLED' }), JETZT)).toBeNull()
    expect(bestellSchritte(basis({ status: 'NOT_PICKED_UP' }), JETZT)).toBeNull()
    // Gegenprobe: dieselbe Bestellung offen hat Schritte.
    expect(bestellSchritte(basis(), JETZT)).not.toBeNull()
  })

  it('eine Frist nach Mitternacht nennt den Tag — „bis 00:30 Uhr" allein läse sich wie heute', () => {
    // 22:30 Uhr bestellt, Abholung morgen: zwei Stunden reichen über Mitternacht.
    const spaet = basis({ createdAt: new Date('2026-10-05T20:30:00Z'), pickupDate: new Date('2026-10-06T12:00:00Z') })
    expect(bestellSchritte(spaet, new Date('2026-10-05T20:31:00Z'))?.[1].zusatz).toBe('bis morgen, 00:30 Uhr')
  })

  it('Abholung an einem anderen Tag: der Tag steht kurz dabei', () => {
    const samstag = basis({ status: 'CONFIRMED', pickupDate: new Date('2026-10-10T12:00:00Z') })
    expect(bestellSchritte(samstag, JETZT)?.[3].zusatz).toBe('Sa., 10.10., 15:00–18:00 Uhr')
    const morgen = basis({ status: 'CONFIRMED', pickupDate: new Date('2026-10-06T12:00:00Z') })
    expect(bestellSchritte(morgen, JETZT)?.[3].zusatz).toBe('morgen, 15:00–18:00 Uhr')
  })
})

describe('bestaetigungsKopf — Überschrift und Satz aus dem Zustand', () => {
  const order = (teil: Partial<Parameters<typeof bestaetigungsKopf>[1]> = {}) => ({
    status: 'PENDING_CONFIRMATION' as const,
    paymentMethod: 'ONSITE_CASH' as const,
    customerEmail: 'erika@example.org',
    hofName: 'Hof Beispiel',
    ...teil,
  })

  it('bar offen: „bitte bestätige per E-Mail" mit der Adresse, an die der Link ging', () => {
    const kopf = bestaetigungsKopf('bestaetigung-offen', order())
    expect(kopf.titel).toBe('Fast geschafft – bitte bestätige per E-Mail')
    expect(kopf.satz).toContain('erika@example.org')
    expect(kopf.ton).toBe('orange')
  })

  it('bezahlt: Dank, „Zahlung erfolgreich" und wohin die Bestätigung geht', () => {
    const kopf = bestaetigungsKopf('bezahlt', order({ status: 'PAID', paymentMethod: 'ONLINE' }))
    expect(kopf.titel).toBe('Danke, deine Bestellung ist da!')
    expect(kopf.satz).toContain('Zahlung erfolgreich')
    expect(kopf.satz).toContain('Hof Beispiel')
    expect(kopf.ton).toBe('gruen')
  })

  it('bar bestätigt: „Bestellung bestätigt", bezahlt wird bei der Abholung', () => {
    const kopf = bestaetigungsKopf('bestaetigt', order({ status: 'CONFIRMED' }))
    expect(kopf.satz).toContain('Bestellung bestätigt')
    expect(kopf.satz).toContain('bar bei der Abholung')
    // Alte Bestellungen mit Karte vor Ort (E5) sagen weiter „Karte".
    expect(bestaetigungsKopf('bestaetigt', order({ status: 'CONFIRMED', paymentMethod: 'ONSITE_CARD' })).satz).toContain(
      'mit Karte bei der Abholung'
    )
  })

  it('abholbereit und abgeholt: die Überschrift folgt dem Status', () => {
    expect(bestaetigungsKopf('bestaetigt', order({ status: 'READY' })).titel).toBe('Deine Bestellung liegt bereit')
    expect(bestaetigungsKopf('bezahlt', order({ status: 'PICKED_UP', paymentMethod: 'ONLINE' })).titel).toBe(
      'Abgeholt – danke für deinen Einkauf!'
    )
  })

  it('ohne Zustand: storniert, nicht abgeholt, Zahlung offen — nie eine leere Seite', () => {
    expect(bestaetigungsKopf(null, order({ status: 'CANCELLED' })).titel).toBe('Bestellung storniert')
    expect(bestaetigungsKopf(null, order({ status: 'NOT_PICKED_UP' })).titel).toBe('Nicht abgeholt')
    expect(bestaetigungsKopf(null, order({ paymentMethod: 'ONLINE' })).titel).toBe('Zahlung offen')
  })

  it('kein Zustand ohne Bestätigung sagt „bestätigt" oder „erfolgreich" — Gegenprobe zu oben', () => {
    for (const z of ['bestaetigung-offen', 'zahlung-wird-geprueft', 'zahlung-fehlgeschlagen', 'verfallen', null] as const) {
      const kopf = bestaetigungsKopf(z, order({ paymentMethod: z === 'bestaetigung-offen' || z === 'verfallen' ? 'ONSITE_CASH' : 'ONLINE' }))
      expect(`${kopf.titel} ${kopf.satz}`).not.toContain('Bestellung bestätigt')
      expect(`${kopf.titel} ${kopf.satz}`).not.toContain('Zahlung erfolgreich')
    }
  })
})

describe('bestaetigungsBloecke — was die Seite in welchem Zustand zeigt', () => {
  it('Bestellnummer mit Abholung und „Erzähl\'s weiter" nur, wenn die Bestellung steht', () => {
    for (const z of ['bezahlt', 'bestaetigt'] as const) {
      expect(bestaetigungsBloecke(z, 'CONFIRMED')).toMatchObject({ abholkarte: true, teilen: true, fristHinweis: false })
    }
  })

  it('„In den Kalender" erst, wenn die Bestellung steht — nicht während die Zahlung geprüft wird', () => {
    for (const z of ['bezahlt', 'bestaetigt'] as const) {
      expect(bestaetigungsBloecke(z, 'CONFIRMED').kalender).toBe(true)
    }
    // Abholkarte mit Route ja, Termin in den Kalender noch nicht: die Zahlung kann scheitern.
    expect(bestaetigungsBloecke('zahlung-wird-geprueft', 'PENDING_CONFIRMATION')).toMatchObject({ abholkarte: true, kalender: false })
    for (const [z, s] of [
      ['bestaetigung-offen', 'PENDING_CONFIRMATION'],
      ['zahlung-fehlgeschlagen', 'PENDING_CONFIRMATION'],
      ['verfallen', 'CANCELLED'],
      ['bezahlt', 'CANCELLED'],
      [null, 'NOT_PICKED_UP'],
    ] as const) {
      expect(bestaetigungsBloecke(z, s).kalender, `${z} ${s}`).toBe(false)
    }
  })

  it('bar offen: Frist-Hinweis statt Abholkarte, kein Teilen', () => {
    expect(bestaetigungsBloecke('bestaetigung-offen', 'PENDING_CONFIRMATION')).toMatchObject({
      abholkarte: false,
      teilen: false,
      fristHinweis: true,
    })
  })

  it('storniert, verfallen, Zahlung fehlgeschlagen: weder Teilen noch Abholkarte', () => {
    for (const [z, s] of [
      ['verfallen', 'CANCELLED'],
      ['zahlung-fehlgeschlagen', 'PENDING_CONFIRMATION'],
      [null, 'CANCELLED'],
      [null, 'NOT_PICKED_UP'],
    ] as const) {
      expect(bestaetigungsBloecke(z, s)).toMatchObject({ abholkarte: false, teilen: false })
    }
  })

  it('genau eine Hauptaktion je Zustand', () => {
    expect(bestaetigungsBloecke('bezahlt', 'PAID').aktion).toBe('bestellung')
    expect(bestaetigungsBloecke('verfallen', 'CANCELLED').aktion).toBe('neu-bestellen')
    expect(bestaetigungsBloecke('zahlung-fehlgeschlagen', 'PENDING_CONFIRMATION').aktion).toBe('erneut-versuchen')
    expect(bestaetigungsBloecke('bestaetigung-offen', 'PENDING_CONFIRMATION').aktion).toBe('keine')
  })
})

describe('abholZeitText', () => {
  const JETZT = new Date('2026-10-05T08:20:00Z')
  const termin = (iso: string) => ({ pickupDate: new Date(iso), pickupTimeStart: '15:00', pickupTimeEnd: '18:00' })

  it('heute, morgen, sonst Wochentag mit Datum — Wiener Kalendertag', () => {
    expect(abholZeitText(termin('2026-10-05T12:00:00Z'), JETZT)).toBe('Heute, 15:00–18:00 Uhr')
    expect(abholZeitText(termin('2026-10-06T12:00:00Z'), JETZT)).toBe('Morgen, 15:00–18:00 Uhr')
    expect(abholZeitText(termin('2026-10-10T12:00:00Z'), JETZT)).toBe('Samstag, 10. Oktober, 15:00–18:00 Uhr')
  })
})

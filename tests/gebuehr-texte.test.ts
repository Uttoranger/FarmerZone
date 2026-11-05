/**
 * Gebühren-Texte nach dem Stichtag „Hofpreis-Modell ab“ (V62, V63; Register
 * N38, N41 a; Lauf 30, Nr. 221) — nur Text-Helfer, keine Rechenfunktion.
 *
 * Ursache: Nach dem Stichtag nannten Konditionen, Admin und Startseite noch das
 * alte Modell („Servicegebühr“, 5 %, „In der Startphase kostenlos“).
 *
 * Beweist:
 *  - gebuehrWortFuerZeitraum für alle drei Lagen und die Ränder (halboffen [von, bis)).
 *  - mindestbestellwertHinweis mit 6 % und mit einem anderen Satz, „ab“ über die
 *    Rechnung je Stück, beim Fehlbetrag keine Gebühr (A3); mindestbestellwertGrund ohne
 *    Satz wie bisher (MINDESTBESTELLWERT_SATZ), vor dem Stichtag null.
 *  - Konditionen je Modell: Abschnitt „Plattformgebühr und Abrechnung“ mit Entwurf-
 *    Kennzeichnung, Zahlen aus konditionen.ts; davor der bisherige Abschnitt unverändert.
 *  - „Derzeit gilt“, Hofpreis-Stichtag „Seit diesem Tag gilt …“, Beispiel der Startseite.
 *  - Admin-Wörter: inkl. Gebühr, Geld-Kachel, Jahresansicht, CSV, Rücktritt, „Geld“.
 */
import { describe, it, expect } from 'vitest'
import {
  BEISPIEL_GLEICH,
  beispielRechnung,
} from '@/lib/startseite'
import {
  GEBUEHREN_WORT,
  bestellGebuehr,
  gebuehrBezeichnungFuer,
  gebuehrErstattungOffenHinweisFuer,
  gebuehrWortFuerModell,
  gebuehrWortFuerZeitraum,
  gebuehrenMehrzahl,
  gebuehrJeStueckCents,
  mindestbestellwertHinweis,
} from '@/lib/plattformgebuehr'
import {
  KONDITIONEN_DERZEIT,
  KONDITIONEN_ENTWURF,
  KONDITIONEN_STAND,
  MINDESTBESTELLWERT_SATZ,
  MONATSABRECHNUNG_TEILE,
  MONATSABRECHNUNG_TEXT,
  PLATTFORMGEBUEHR_BEZEICHNUNG,
  VOLLER_WARENPREIS,
  gebuehrGrundsatz,
  konditionenDerzeit,
  konditionenGebuehrAbschnitt,
  konditionenStand,
  monatsabrechnungTeile,
  servicegebuehrZahltKunde,
  vollerWarenpreis,
} from '@/lib/konditionen'
import { GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS, SERVICEGEBUEHR_BEZEICHNUNG } from '@/lib/servicegebuehr'
import { mindestbestellwertGrund, mindestbestellwertKarte } from '@/lib/kasse'
import { HOFPREIS_STICHTAG_TEXT, hofpreisStichtagSatz } from '@/lib/plattform-einstellung'
import { ADMIN_BESTELLUNG_TEXT } from '@/lib/admin-bestellung'
import { FINANZEN_CSV, FINANZEN_JAHR_TEXT, csvMonateKopf, einnahmenLabels, gebuehrWortFuerJahr, gebuehrWortFuerMonat, kostendeckungSatz } from '@/lib/finanzen'
import { FINANZEN_SEITE } from '@/lib/admin-finanzen-seite'
import { LEERER_STAND, PROTOKOLL_TEXT, lageKacheln, sammleAufgaben } from '@/lib/admin-aufgaben'
import { wienerMitternacht } from '@/lib/wiener-tag'

/** Geschützte Leerzeichen als normale — die Formatierer setzen sie (formatDatumLang, formatEuro). */
const lang = (s: string): string => s.replace(/ /g, ' ')

const STICHTAG = new Date('2027-02-01T00:00:00+01:00')
const davor = (ms: number) => new Date(STICHTAG.getTime() - ms)
const danach = (ms: number) => new Date(STICHTAG.getTime() + ms)
const TAG = 24 * 60 * 60 * 1000

describe('gebuehrWortFuerZeitraum — Zeitraum [von, bis) nach Bestellzeitpunkt', () => {
  it('ganz vor dem Stichtag: „Servicegebühr“ — auch wenn der Zeitraum genau am Stichtag endet', () => {
    expect(gebuehrWortFuerZeitraum(davor(30 * TAG), davor(TAG), STICHTAG)).toBe(SERVICEGEBUEHR_BEZEICHNUNG)
    expect(gebuehrWortFuerZeitraum(davor(30 * TAG), STICHTAG, STICHTAG)).toBe('Servicegebühr')
  })

  it('ganz ab dem Stichtag: „Plattformgebühr“ — auch wenn er genau am Stichtag beginnt', () => {
    expect(gebuehrWortFuerZeitraum(STICHTAG, danach(30 * TAG), STICHTAG)).toBe(PLATTFORMGEBUEHR_BEZEICHNUNG)
    expect(gebuehrWortFuerZeitraum(danach(TAG), danach(2 * TAG), STICHTAG)).toBe('Plattformgebühr')
  })

  it('über den Stichtag: „Gebühren“ — eine Millisekunde auf jeder Seite reicht', () => {
    expect(gebuehrWortFuerZeitraum(davor(1), danach(1), STICHTAG)).toBe(GEBUEHREN_WORT)
    expect(gebuehrWortFuerZeitraum(davor(1), danach(1), STICHTAG)).toBe('Gebühren')
  })

  it('ein verdrehter Zeitraum zählt wie sein Anfang', () => {
    expect(gebuehrWortFuerZeitraum(danach(TAG), davor(TAG), STICHTAG)).toBe('Plattformgebühr')
    expect(gebuehrWortFuerZeitraum(davor(TAG), davor(2 * TAG), STICHTAG)).toBe('Servicegebühr')
  })

  it('Monat und Jahr in Wiener Grenzen: Jänner 2027 alt, Februar neu, 2027 gemischt, 2026 alt, 2028 neu', () => {
    expect(gebuehrWortFuerMonat('2027-01', STICHTAG)).toBe('Servicegebühr')
    expect(gebuehrWortFuerMonat('2027-02', STICHTAG)).toBe('Plattformgebühr')
    expect(gebuehrWortFuerJahr(2027, STICHTAG)).toBe('Gebühren')
    expect(gebuehrWortFuerJahr(2026, STICHTAG)).toBe('Servicegebühr')
    expect(gebuehrWortFuerJahr(2028, STICHTAG)).toBe('Plattformgebühr')
  })

  it('Mehrzahl und Wort je Modell', () => {
    expect(gebuehrenMehrzahl('Servicegebühr')).toBe('Servicegebühren')
    expect(gebuehrenMehrzahl('Plattformgebühr')).toBe('Plattformgebühren')
    expect(gebuehrenMehrzahl('Gebühren')).toBe('Gebühren')
    expect(gebuehrWortFuerModell('hofpreis')).toBe('Plattformgebühr')
    expect(gebuehrWortFuerModell('bisher')).toBe('Servicegebühr')
  })
})

describe('mindestbestellwertHinweis (A3) — ohne Gebühr beim Fehlbetrag', () => {
  it('6 %: „ab € 10,60“, Fehlbetrag in Waren', () => {
    expect(lang(mindestbestellwertHinweis(320, 600))).toBe(
      'Mindestbestellwert: Waren für 10 € (mit Plattformgebühr ab € 10,60). Dir fehlen noch Waren für € 3,20.'
    )
  })

  it('anderer Satz des Hofs (6,5 %): „ab € 10,65“ — aus der Rechnung je Stück, nie ein Literal', () => {
    expect(gebuehrJeStueckCents(1000, 650)).toBe(65)
    expect(lang(mindestbestellwertHinweis(1, 650))).toBe(
      'Mindestbestellwert: Waren für 10 € (mit Plattformgebühr ab € 10,65). Dir fehlen noch Waren für € 0,01.'
    )
  })

  it('ein krummer Satz rundet auf (4,99 % von 10 € = 49,9 Cent → 50 Cent)', () => {
    expect(lang(mindestbestellwertHinweis(500, 499))).toContain('ab € 10,50')
  })

  it('ohne Fehlbetrag nur der erste Satz', () => {
    expect(lang(mindestbestellwertHinweis(0, 600))).toBe('Mindestbestellwert: Waren für 10 € (mit Plattformgebühr ab € 10,60).')
    expect(lang(mindestbestellwertHinweis(-5, 600))).not.toContain('fehlen')
  })

  it('mindestbestellwertGrund: mit Satz der Hinweis, ohne Satz der bisherige Satz, vor dem Stichtag und ab 10 € nichts', () => {
    const hof = { serviceFeePercent: 5, serviceFeeMinCents: 50, serviceFeeActiveFrom: null, preisAnzeige: { hundertstel: 600 } }
    expect(lang(mindestbestellwertGrund(hof, 680, 600) ?? '')).toBe(
      'Mindestbestellwert: Waren für 10 € (mit Plattformgebühr ab € 10,60). Dir fehlen noch Waren für € 3,20.'
    )
    expect(mindestbestellwertGrund(hof, 680)).toBe(MINDESTBESTELLWERT_SATZ)
    expect(mindestbestellwertGrund(hof, 1000, 600)).toBeNull()
    expect(mindestbestellwertGrund({ ...hof, preisAnzeige: null }, 680, 600)).toBeNull()
    expect(MINDESTBESTELLWERT_SATZ).toBe('Mindestbestellwert 10 € bei diesem Hof')
  })

  it('mindestbestellwertKarte (Board s1-/w1-kasse Bild 5, Lauf 31): Titel der Satz des Hofs, darunter der Fehlbetrag und die Bitte; dieselbe Bedingung wie der Grund', () => {
    const hof = { serviceFeePercent: 5, serviceFeeMinCents: 50, serviceFeeActiveFrom: null, preisAnzeige: { hundertstel: 600 } }
    const karte = mindestbestellwertKarte(hof, 680, 600)
    expect(lang(karte?.titel ?? '')).toBe('Mindestbestellwert: Waren für 10 € (mit Plattformgebühr ab € 10,60).')
    expect(lang(karte?.satz ?? '')).toBe('Dir fehlen noch Waren für € 3,20. Leg noch etwas dazu.')
    // Grenzen: ab 10 € Warenwert, ohne Hofpreis-Modell oder ohne Satz keine Karte — Gegenprobe knapp darunter.
    expect(mindestbestellwertKarte(hof, 1000, 600)).toBeNull()
    expect(mindestbestellwertKarte(hof, 999, 600)?.satz).toContain('€ 0,01')
    expect(mindestbestellwertKarte({ ...hof, preisAnzeige: null }, 680, 600)).toBeNull()
    expect(mindestbestellwertKarte(hof, 680)).toBeNull()
  })
})

describe('Konditionen je Modell (V62)', () => {
  const JETZT = new Date('2027-03-03T08:42:00+01:00')

  it('ab dem Stichtag: „Plattformgebühr und Abrechnung“ mit Entwurf-Kennzeichnung, Satz, Mindestbestellwert, Stripe, Lastschrift, Gründungshöfe', () => {
    const a = konditionenGebuehrAbschnitt('hofpreis', JETZT)
    expect(a.titel).toBe('Plattformgebühr und Abrechnung')
    expect(a.entwurf).toBe(KONDITIONEN_ENTWURF)
    expect(KONDITIONEN_ENTWURF).toBe('Entwurf – die Anwältin prüft den Wortlaut')
    const text = a.absaetze.join(' ')
    expect(text).toContain('6 % vom Warenpreis, je Stück auf den Cent aufgerundet (Standard; ist für deinen Hof ein anderer Satz eingetragen, gilt dieser)')
    expect(text).toContain('Mindestbestellwert 10 € Warenwert')
    expect(text).toContain('Online behält Stripe die Gebühr')
    expect(text).toContain('der Hof ist dabei Händler')
    expect(text).toContain('per SEPA-Lastschrift ein, fällig erst mit „Abgeholt“')
    expect(text).toContain('Gründungshöfe zahlen sie bar erst nach ihrer Gründungszeit')
    expect(text).not.toContain('Servicegebühr')
  })

  it('mit dem Satz eines Hofs steht dessen Satz, ohne den Standard-Zusatz', () => {
    const text = konditionenGebuehrAbschnitt('hofpreis', JETZT, '6,5').absaetze.join(' ')
    expect(text).toContain('beträgt 6,5 % vom Warenpreis')
    expect(text).not.toContain('Standard')
  })

  it('vor dem Stichtag: der bisherige Abschnitt, ohne Kennzeichnung — Wortlaut wie vor Nr. 221', () => {
    const jetzt = new Date('2026-11-04T10:00:00+01:00')
    expect(konditionenGebuehrAbschnitt('bisher', jetzt)).toEqual({
      titel: 'Servicegebühr und Abrechnung',
      entwurf: null,
      absaetze: [servicegebuehrZahltKunde(jetzt), MONATSABRECHNUNG_TEXT],
    })
  })

  it('Stand, „Derzeit gilt“, Grundsatz, Karte und Monatsabrechnung — bisher unverändert, ab dem Stichtag ohne Servicegebühr', () => {
    expect(konditionenStand('bisher', STICHTAG)).toBe(KONDITIONEN_STAND)
    expect(lang(konditionenStand('hofpreis', STICHTAG))).toBe('1. Februar 2027')
    expect(konditionenDerzeit('bisher')).toBe(KONDITIONEN_DERZEIT)
    expect(konditionenDerzeit('hofpreis')).toBe(
      'Derzeit gilt: Plattformgebühr 6 % im Hofpreis, online und bar gleich; Hoftor kostenlos, Hofladen € 19 im Monat. Bereits freigeschaltete Höfe behalten ihre zugesagten Konditionen.'
    )
    expect(vollerWarenpreis('bisher')).toBe(VOLLER_WARENPREIS)
    expect(vollerWarenpreis('hofpreis')).toBe('Die Plattformgebühr (6 %) steckt im Preis, den die Kundin zahlt – online wie bar.')
    expect(monatsabrechnungTeile('bisher')).toBe(MONATSABRECHNUNG_TEILE)
    expect(gebuehrGrundsatz('bisher', JETZT)).toBe(servicegebuehrZahltKunde(JETZT))
    const neu = [gebuehrGrundsatz('hofpreis', JETZT), monatsabrechnungTeile('hofpreis').map((t) => t.text).join(''), konditionenDerzeit('hofpreis'), vollerWarenpreis('hofpreis')]
    for (const t of neu) expect(t).not.toContain('Servicegebühr')
    expect(monatsabrechnungTeile('hofpreis').some((t) => t.betont)).toBe(true)
  })
})

describe('Admin › Einstellungen: Hofpreis-Stichtag nach Erreichen', () => {
  it('„Seit diesem Tag gilt …“ ohne „Vorher bleibt alles wie heute.“; davor der bisherige Satz', () => {
    expect(hofpreisStichtagSatz(true)).toBe('Seit diesem Tag gilt für neue Bestellungen die Plattformgebühr im Hofpreis (6 %, Mindestbestellwert 10 €).')
    expect(hofpreisStichtagSatz(false)).toBe(
      'Ab diesem Tag gilt für neue Bestellungen die Plattformgebühr im Hofpreis (6 %, Mindestbestellwert 10 €). Vorher bleibt alles wie heute.'
    )
    expect(HOFPREIS_STICHTAG_TEXT.satzErreicht).not.toContain('Vorher')
  })
})

describe('Startseite „Beispiel“ ab dem Stichtag (Board w1-startseite)', () => {
  const JETZT = new Date('2027-03-03T08:42:00+01:00')

  it('rechnet über bestellGebuehr mit 6 % im Preis: € 20,00 → € 21,20, der Hof bekommt € 20,00', () => {
    const r = beispielRechnung(JETZT, 2000, 'hofpreis')
    expect(r.gebuehrCents).toBe(bestellGebuehr([{ preisCents: 2000, menge: 1 }], 600).gebuehrCents)
    expect(r).toMatchObject({ gebuehrCents: 120, duZahlstCents: 2120, hofBekommtCents: 2000, prozent: 6, modell: 'hofpreis', fussnote: BEISPIEL_GLEICH })
    expect(lang(r.satz ?? '')).toBe('Der Hof verlangt € 20,00 für deinen Einkauf. Du zahlst € 21,20 – darin stecken 6 % Plattformgebühr. Der Hof bekommt seine vollen € 20,00.')
  })

  it('ohne Modell bleibt das Beispiel genau das bisherige (kein Feld dazu)', () => {
    const bisher = beispielRechnung(JETZT)
    expect(bisher).not.toHaveProperty('modell')
    expect(bisher).not.toHaveProperty('satz')
    expect(beispielRechnung(JETZT, 2000, 'bisher')).toEqual(bisher)
  })
})

describe('Admin-Wörter (V63, N42 c, N43)', () => {
  const STICHTAG_JAHR = new Date('2027-02-01T00:00:00+01:00')

  it('Bestellung: inkl. Gebühr und Zeile mit dem Wort der Bestellung', () => {
    expect(ADMIN_BESTELLUNG_TEXT.inklGebuehr('€ 0,60', gebuehrBezeichnungFuer({ gebuehrModell: 'hofpreis' }))).toBe('inkl. € 0,60 Plattformgebühr')
    expect(ADMIN_BESTELLUNG_TEXT.inklGebuehr('€ 0,50')).toBe('inkl. € 0,50 Servicegebühr')
    expect(ADMIN_BESTELLUNG_TEXT.gebuehrZeile({ gebuehrModell: 'hofpreis' })).toBe('Plattformgebühr')
    expect(ADMIN_BESTELLUNG_TEXT.gebuehrZeile({ gebuehrModell: null })).toBe('Servicegebühr')
  })

  it('Erstattung offen mit dem Wort der Bestellung; die feste Fassung bleibt „bisher“', () => {
    expect(gebuehrErstattungOffenHinweisFuer({ gebuehrModell: 'hofpreis' })).toBe('Plattformgebühr-Erstattung ausstehend.')
    expect(gebuehrErstattungOffenHinweisFuer({ gebuehrModell: null })).toBe(GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS)
  })

  it('Jahresansicht und CSV: das Wort des Jahres; ohne Wort die Fassung „bisher“', () => {
    const wort = gebuehrWortFuerJahr(2027, STICHTAG_JAHR)
    expect(FINANZEN_JAHR_TEXT.diagrammBeschriftung(2027, wort)).toBe('Gebühren und Kosten je Monat 2027')
    expect(FINANZEN_JAHR_TEXT.diagrammBeschriftung(2026)).toBe('Servicegebühren und Kosten je Monat 2026')
    expect(FINANZEN_JAHR_TEXT.legendeGebuehren('Plattformgebühr')).toBe('Plattformgebühren')
    expect(FINANZEN_JAHR_TEXT.legendeServicegebuehren).toBe('Servicegebühren')
    expect(FINANZEN_JAHR_TEXT.legendeVorjahr(2027, 'Plattformgebühr')).toBe('Plattformgebühren 2027')
    expect(csvMonateKopf('Gebühren')[1]).toBe('Gebühren (€)')
    expect(FINANZEN_CSV.monate[1]).toBe('Servicegebühren (€)')
    expect(einnahmenLabels('Plattformgebühr')).toEqual({ online: 'Plattformgebühr, online', vorOrt: 'Plattformgebühr, vor Ort bezahlt', provision: 'Provision' })
    expect(kostendeckungSatz({ schnittCents: 0, brauchtBestellungen: null, bezeichnung: 'März 2027', bestellungen: 0 }, 'Plattformgebühr')).toContain('Bestellungen mit Plattformgebühr')
  })

  it('„Geld“ statt „Finanzen“, „Rücktritt“ statt „Widerruf“', () => {
    expect(FINANZEN_SEITE).toMatchObject({ titel: 'Geld', kennzahlen: 'Geld in Zahlen', reiter: 'Ansicht von Geld' })
    expect(FINANZEN_JAHR_TEXT.umschalter).toBe('Zeitraum')
    expect(PROTOKOLL_TEXT.widerruf_zugeordnet).toBe('Rücktritt einer Bestellung zugeordnet')
    expect(PROTOKOLL_TEXT.widerruf_abgelehnt).toBe('Rücktritt abgelehnt (Hof)')
  })

  it('Geld-Kachel: das Wort der Woche, ohne Wort die Fassung „bisher“', () => {
    const lage = {
      bestellungen: { zurAbholung: 0, nichtGepackt: 0, storniert: 0 },
      woche: { umsatzCents: 10_000, gebuehrCents: 600, anzahl: 1, anzahlVorwoche: 0 },
      dienste: { laufen: 5, von: 5, ansehen: [], testbetrieb: false },
      hoefe: { verkaufen: 1, warten: 0 },
    }
    const geld = (l: Parameters<typeof lageKacheln>[0]) => lang(lageKacheln(l, []).find((k) => k.id === 'geld')?.zeilen[0] ?? '')
    expect(geld({ ...lage, gebuehrWort: gebuehrWortFuerZeitraum(STICHTAG_JAHR, new Date('2027-03-03T08:42:00+01:00'), STICHTAG_JAHR) })).toBe('Plattformgebühr € 6,00')
    expect(geld({ ...lage, gebuehrWort: 'Gebühren' })).toBe('Gebühren € 6,00')
    expect(geld(lage)).toBe('Servicegebühr € 6,00')
  })

  it('Aufgaben „Rücktritt offen“ und „Rücktritt ohne Bestellung“ (N43)', () => {
    const eingang = new Date('2026-11-09T10:00:00Z')
    const aufgaben = sammleAufgaben(
      {
        ...LEERER_STAND,
        widerrufe: [
          { id: 'w-1', orderId: 'o-1', bestellnummer: 'HM-2611-AAAA', hofName: 'Hof Test', eingegangenAm: eingang },
          { id: 'w-2', orderId: null, bestellnummer: null, hofName: null, eingegangenAm: eingang },
        ],
      },
      new Date('2026-11-10T10:00:00Z')
    ).filter((a) => a.quelle === 'widerruf_offen')
    expect(aufgaben.map((a) => a.titel).sort()).toEqual(['Rücktritt offen', 'Rücktritt ohne Bestellung'])
    expect(aufgaben.find((a) => a.titel === 'Rücktritt ohne Bestellung')?.satz).toMatch(/^Der Rücktritt passt zu keiner Bestellung\./)
    for (const a of aufgaben) expect(`${a.titel} ${a.satz}`).not.toMatch(/Widerruf/)
  })

  it('Gegenprobe: der Wiener Monatsbeginn ist die Grenze — Februar beginnt am Stichtag', () => {
    expect(wienerMitternacht('2027-02-01')).toEqual(STICHTAG_JAHR)
  })
})

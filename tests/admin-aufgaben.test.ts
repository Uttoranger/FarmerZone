/**
 * Admin › Heute, „Braucht dich“ (Register N32, Nr. 185) — die reinen Regeln
 * aus src/lib/admin-aufgaben.ts. Beweist:
 *  - je Quelle: Aufgabe da, erledigt (Ursache weg) → Aufgabe weg — kein
 *    eigener Zustand;
 *  - sortiert nach Frist (das nächste Ziel zuerst);
 *  - „überfällig“ steht als Wort im Frist-Text;
 *  - Wache: jede Quelle im Register hat ein Ziel (Frist) und führt auf eine
 *    Admin-Seite; eine neue Quelle ohne beides fällt hier auf;
 *  - die Zahl der Betriebsleiste und die alte Adresse /admin?x → /admin/hoefe?x;
 *  - Montags-Routine: Schlüssel je Wiener Woche, kaputter Speicher → leer.
 */
import { describe, it, expect } from 'vitest'
import {
  ADMIN_AUFGABEN,
  AUFGABE_QUELLEN,
  AUFGABE_ZIEL_MS,
  LEERER_STAND,
  WAS_TUN,
  alteHoefeAdresse,
  aufgabenLeiste,
  aufgabenZahl,
  fristText,
  kommtEintraege,
  lageKacheln,
  wochenZeile,
  leseRoutine,
  protokollZeilen,
  routineSchluessel,
  sammleAufgaben,
  type AufgabeQuelle,
  type AufgabenStand,
} from '@/lib/admin-aufgaben'
import type { HofAufgabeRoh, ErstattungAufgabeRoh } from '@/lib/postfach'
import type { ProblemAuftrag } from '@/lib/betrieb-mails'
import { MAIL_WARN_TEXT } from '@/lib/betrieb'

// Montag, 26. Okt 2026, 09:42 in Wien (MEZ).
const JETZT = new Date('2026-10-26T08:42:00.000Z')
const STUNDE = 60 * 60_000
const TAG = 24 * STUNDE
const vor = (ms: number): Date => new Date(JETZT.getTime() - ms)

const HOF_WARTET: HofAufgabeRoh = {
  id: 'hof-wartet',
  name: 'Hof Test',
  createdAt: vor(27 * STUNDE),
  hofseite: { erledigt: 5, gesamt: 7 },
  stripeBereit: true,
  sepaErteilt: false,
  futter: false,
  lfbis: false,
  titelbild: true,
  email: 'bestaetigt',
  platz: null,
}

const ERSTATTUNG: ErstattungAufgabeRoh = {
  id: 'bestellung-1',
  bestellnummer: 'HM-2610-B7C2',
  hofName: 'Hof am Bach',
  seit: vor(2 * TAG),
  bezahltCents: 1838,
  schonErstattetCents: 0,
  zahlungKennung: null,
}

const MAIL: ProblemAuftrag = {
  id: 'mail-1',
  art: 'bestellung-abholbereit',
  vorrang: 1,
  status: 'gescheitert',
  versuche: 5,
  fehlerCode: 'validation_error',
  erstelltAm: vor(2 * STUNDE),
  naechsterVersuchAm: vor(40 * 60_000),
  belegtBis: null,
}

/** Ein Stand, in dem jede Quelle genau eine Aufgabe bringt. */
const VOLL: AufgabenStand = {
  hoefeWartend: [HOF_WARTET],
  erstattungen: [ERSTATTUNG],
  mailProbleme: [MAIL],
  wartendeMail: { erstelltAm: vor(9 * 60_000), zuBestellung: true },
  meldungen: [{ id: 'meldung-abcdefgh', art: 'FEHLER', createdAt: vor(STUNDE), ersteZeile: 'Foto lädt nicht', von: 'Hof Mühlbach' }],
  warnungen: [
    { art: 'bilder', stufe: 1, seit: vor(TAG) },
    { art: 'ablauf:von-aussen', stufe: 1, seit: vor(2 * STUNDE) },
  ],
  laeufe: new Map([['von-aussen', { gestartetAm: vor(3 * STUNDE), beendetAm: vor(3 * STUNDE), ok: true, fehlerKlasse: null, dauerMs: 10 }]]),
  hoefeAktiv: [
    { id: 'hof-ohne-zeit', name: 'Hof Ohne Zeit', approvedAt: vor(60 * TAG), abholzeitAktiv: false, letzteBestellungAm: vor(TAG) },
    { id: 'hof-still', name: 'Hof Still', approvedAt: vor(90 * TAG), abholzeitAktiv: true, letzteBestellungAm: vor(16 * TAG) },
  ],
}

/** Was „erledigt“ je Quelle heißt: die Ursache fehlt im Stand. */
const ERLEDIGT: Record<AufgabeQuelle, Partial<AufgabenStand>> = {
  hof_wartet: { hoefeWartend: [] },
  erstattung_offen: { erstattungen: [] },
  mail_gescheitert: { mailProbleme: [] },
  mail_haengt: { wartendeMail: null },
  meldung_neu: { meldungen: [] },
  betrieb_warnung: { warnungen: VOLL.warnungen.filter((w) => w.art !== 'bilder') },
  uptime_still: {
    warnungen: VOLL.warnungen.filter((w) => w.art !== 'ablauf:von-aussen'),
    laeufe: new Map([['von-aussen', { gestartetAm: vor(5 * 60_000), beendetAm: vor(5 * 60_000), ok: true, fehlerKlasse: null, dauerMs: 10 }]]),
  },
  hof_ohne_abholzeit: { hoefeAktiv: VOLL.hoefeAktiv.map((h) => ({ ...h, abholzeitAktiv: true, letzteBestellungAm: vor(TAG) })) },
  hof_ohne_bestellung: { hoefeAktiv: VOLL.hoefeAktiv.map((h) => ({ ...h, letzteBestellungAm: vor(2 * TAG) })) },
}

describe('Braucht dich: je Quelle da und wieder weg', () => {
  for (const quelle of AUFGABE_QUELLEN) {
    it(`${quelle}: im vollen Stand genau eine Aufgabe, erledigt keine`, () => {
      expect(ADMIN_AUFGABEN[quelle](VOLL, JETZT)).toHaveLength(1)
      expect(ADMIN_AUFGABEN[quelle]({ ...VOLL, ...ERLEDIGT[quelle] }, JETZT)).toHaveLength(0)
      expect(sammleAufgaben({ ...VOLL, ...ERLEDIGT[quelle] }, JETZT).some((a) => a.quelle === quelle)).toBe(false)
    })
  }

  it('leerer Stand: keine Aufgabe', () => {
    expect(sammleAufgaben(LEERER_STAND, JETZT)).toEqual([])
  })

  it('Höfe warten: Ziel 48 h ab der Anmeldung, Satz aus der Prüfliste des Eingangs, Ziel im Eingang', () => {
    const [a] = ADMIN_AUFGABEN.hof_wartet(VOLL, JETZT)
    expect(a.frist.ziel).toEqual(new Date(HOF_WARTET.createdAt.getTime() + 48 * STUNDE))
    expect(fristText(a, JETZT)).toBe('Ziel 48 h · noch 21 h')
    expect(a.satz).toBe('Hofseite 5 von 7 · Stripe eingerichtet.')
    expect(a.ziel).toBe('/admin/postfach?art=aufgabe&id=hof-hof-wartet')
  })

  it('Erstattung offen: Ziel 24 h, nach 2 Tagen „überfällig · seit 2 Tagen“, Bezug Nummer · Hof · Betrag', () => {
    const [a] = ADMIN_AUFGABEN.erstattung_offen(VOLL, JETZT)
    expect(a.frist.ueberfaellig).toBe(true)
    expect(fristText(a, JETZT)).toBe('überfällig · seit 2 Tagen')
    expect(a.bezug).toEqual({ kennung: 'HM-2610-B7C2', text: 'HM-2610-B7C2 · Hof am Bach · € 18,38' })
  })

  it('Mail gescheitert: je Art EINE Aufgabe mit Zahl, Grund und „Was tun“ aus FEHLER_TEXTE', () => {
    const zweite = { ...MAIL, id: 'mail-2', naechsterVersuchAm: vor(10 * 60_000) }
    const aufgaben = ADMIN_AUFGABEN.mail_gescheitert({ ...VOLL, mailProbleme: [MAIL, zweite, { ...MAIL, id: 'mail-3', status: 'offen' }] }, JETZT)
    expect(aufgaben).toHaveLength(1)
    expect(aufgaben[0].bezug.text).toBe('2 Mails · Weg Wichtig')
    expect(aufgaben[0].satz).toBe('Diese Adresse gibt es nicht. Nochmal schicken hilft hier nicht – die Adresse ist falsch geschrieben.')
    expect(aufgaben[0].ziel).toBe('/admin/betrieb?reiter=mails')
  })

  it('wichtige Mail hängt: erst ab 5 Minuten (dieselbe Regel wie die Betriebsleiste bisher)', () => {
    expect(ADMIN_AUFGABEN.mail_haengt({ ...VOLL, wartendeMail: { erstelltAm: vor(4 * 60_000), zuBestellung: true } }, JETZT)).toHaveLength(0)
    expect(ADMIN_AUFGABEN.mail_haengt(VOLL, JETZT)[0].titel).toBe('Eine Bestellmail wartet seit 9 Min.')
  })

  it('Betrieb: „Mail wartet“ zählt nicht doppelt neben „wichtige Mail hängt“; ein überfälliger Ablauf ohne Warnung kommt dazu', () => {
    const stand: AufgabenStand = {
      ...VOLL,
      warnungen: [{ art: 'mail:wartet', stufe: 1, seit: vor(STUNDE) }],
      laeufe: new Map([['aufraeumen', { gestartetAm: vor(30 * STUNDE), beendetAm: vor(30 * STUNDE), ok: true, fehlerKlasse: null, dauerMs: 10 }]]),
    }
    const titel = ADMIN_AUFGABEN.betrieb_warnung(stand, JETZT).map((a) => a.titel)
    expect(titel).toEqual(['Ablauf „Aufräumen“ ausgefallen'])
    // Gegenprobe: ohne hängende Mail steht die Warnung da.
    expect(ADMIN_AUFGABEN.betrieb_warnung({ ...stand, wartendeMail: null }, JETZT).map((a) => a.titel)).toContain(MAIL_WARN_TEXT['mail:wartet'].text)
  })

  it('Uptime: ohne je einen Aufruf keine Aufgabe (noch nicht eingerichtet)', () => {
    expect(ADMIN_AUFGABEN.uptime_still({ ...VOLL, laeufe: new Map() }, JETZT)).toHaveLength(0)
  })

  it('Hof ohne Abholzeit: Ziel ist der Beginn der nächsten Woche (Wien)', () => {
    const [a] = ADMIN_AUFGABEN.hof_ohne_abholzeit(VOLL, JETZT)
    // Montag 0:00 MEZ = 23:00 UTC am Sonntag davor; Ziel 7 Tage später.
    expect(a.frist.ziel.toISOString()).toBe('2026-11-01T23:00:00.000Z')
  })

  it('seit 14 Tagen ohne Bestellung: ab Tag 14, Ziel 7 Tage danach; nie bestellt zählt ab der Freischaltung', () => {
    const [a] = ADMIN_AUFGABEN.hof_ohne_bestellung(VOLL, JETZT)
    expect(a.seit).toEqual(new Date(vor(16 * TAG).getTime() + 14 * TAG))
    const nie = ADMIN_AUFGABEN.hof_ohne_bestellung({ ...VOLL, hoefeAktiv: [{ ...VOLL.hoefeAktiv[1], approvedAt: vor(13 * TAG), letzteBestellungAm: null }] }, JETZT)
    expect(nie).toHaveLength(0)
  })

  it('Aufgaben zu einem Hof führen in seine Akte (seit Nr. 187), nicht in einen Listenfilter', () => {
    const [ohneZeit] = ADMIN_AUFGABEN.hof_ohne_abholzeit(VOLL, JETZT)
    const [ohneBestellung] = ADMIN_AUFGABEN.hof_ohne_bestellung(VOLL, JETZT)
    for (const a of [ohneZeit, ohneBestellung]) {
      expect(a.ziel).toBe(`/admin/hoefe/${a.bezug.kennung}`)
      expect(a.ziel).not.toContain('filter=')
    }
  })
})

describe('Braucht dich: Sortierung und Wörter', () => {
  it('nach Frist sortiert — das nächste Ziel zuerst, überfällige oben', () => {
    const aufgaben = sammleAufgaben(VOLL, JETZT)
    const ziele = aufgaben.map((a) => a.frist.ziel.getTime())
    expect(ziele).toEqual([...ziele].sort((x, y) => x - y))
    expect(aufgaben[0].frist.ueberfaellig).toBe(true)
    expect(aufgaben.at(-1)?.frist.ueberfaellig).toBe(false)
  })

  it('„überfällig“ als Wort; Gegenprobe: vor dem Ziel steht es nicht da', () => {
    const [erstattung] = ADMIN_AUFGABEN.erstattung_offen(VOLL, JETZT)
    expect(fristText(erstattung, JETZT)).toMatch(/^überfällig/)
    const [frisch] = ADMIN_AUFGABEN.erstattung_offen({ ...VOLL, erstattungen: [{ ...ERSTATTUNG, seit: vor(STUNDE) }] }, JETZT)
    expect(fristText(frisch, JETZT)).toBe('Ziel 24 h · noch 23 h')
  })

  it('Zahl der Betriebsleiste aus derselben Liste: „n offen · m überfällig – ansehen“, nichts offen → keine Zeile', () => {
    const aufgaben = sammleAufgaben(VOLL, JETZT)
    const zahl = aufgabenZahl(aufgaben)
    expect(zahl.offen).toBe(aufgaben.length)
    expect(aufgabenLeiste(zahl)).toEqual({
      text: `${zahl.offen} offen · ${zahl.ueberfaellig} überfällig – ansehen`,
      kurz: `${zahl.offen} offen – ansehen`,
      href: '/admin',
    })
    expect(aufgabenLeiste({ offen: 2, ueberfaellig: 0 })?.text).toBe('2 offen – ansehen')
    expect(aufgabenLeiste({ offen: 0, ueberfaellig: 0 })).toBeNull()
  })

  it('eine Meldung mit Adresse oder Telefonnummer in der ersten Zeile zeigt nur die Art', () => {
    const [a] = ADMIN_AUFGABEN.meldung_neu({ ...VOLL, meldungen: [{ ...VOLL.meldungen[0], ersteZeile: 'Bitte an max@example.com schreiben' }] }, JETZT)
    expect(a.titel).toBe('Neue Meldung: Fehler')
    expect(ADMIN_AUFGABEN.meldung_neu(VOLL, JETZT)[0].titel).toBe('Neue Meldung: „Foto lädt nicht“')
  })
})

describe('Wache: jede Quelle hat Frist und Ziel', () => {
  it('jede Quelle im Register steht in AUFGABE_QUELLEN, hat ein Ziel > 0 und eine Funktion', () => {
    expect(Object.keys(ADMIN_AUFGABEN).sort()).toEqual([...AUFGABE_QUELLEN].sort())
    for (const q of AUFGABE_QUELLEN) {
      expect(AUFGABE_ZIEL_MS[q], q).toBeGreaterThan(0)
      expect(typeof ADMIN_AUFGABEN[q], q).toBe('function')
    }
  })

  it('jede Aufgabe aus dem vollen Stand hat Frist, Ziel auf eine Admin-Seite und einen Knopf aus WAS_TUN', () => {
    const aufgaben = sammleAufgaben(VOLL, JETZT)
    expect(new Set(aufgaben.map((a) => a.quelle))).toEqual(new Set(AUFGABE_QUELLEN))
    for (const a of aufgaben) {
      expect(a.ziel, a.quelle).toMatch(/^\/admin(\/|$|\?)/)
      expect(Number.isNaN(a.frist.ziel.getTime()), a.quelle).toBe(false)
      expect(a.frist.dauerMs, a.quelle).toBeGreaterThan(0)
      expect(Object.keys(WAS_TUN), a.quelle).toContain(a.wasTun)
      expect(a.bezug.kennung, a.quelle).not.toBe('')
    }
  })

  it('Gegenprobe: eine Aufgabe ohne Admin-Ziel fiele auf', () => {
    expect('https://example.com').not.toMatch(/^\/admin(\/|$|\?)/)
  })
})

describe('Alte Adresse der Höfe, Routine, Kommt, Protokoll', () => {
  it('/admin?x → /admin/hoefe?x mit denselben Parametern; ohne Parameter bleibt Heute', () => {
    expect(alteHoefeAdresse({ reiter: 'alle', filter: 'online' })).toBe('/admin/hoefe?reiter=alle&filter=online')
    expect(alteHoefeAdresse({ suche: ['a', 'b'] })).toBe('/admin/hoefe?suche=a&suche=b')
    expect(alteHoefeAdresse({})).toBeNull()
    expect(alteHoefeAdresse({ x: undefined })).toBeNull()
  })

  it('Routine: ein Schlüssel je Wiener Woche; Sonntag spät gehört noch zur alten Woche', () => {
    expect(routineSchluessel(JETZT)).toBe('fz_admin_montag_2026-10-26')
    expect(routineSchluessel(new Date('2026-10-25T22:30:00.000Z'))).toBe('fz_admin_montag_2026-10-19')
  })

  it('Routine: kaputter, fremder oder leerer Speicher → keine Haken; bekannte Punkte in fester Reihenfolge', () => {
    expect(leseRoutine(null)).toEqual([])
    expect(leseRoutine('{kaputt')).toEqual([])
    expect(leseRoutine('{"a":1}')).toEqual([])
    expect(leseRoutine('["sentry","fremd","braucht-dich"]')).toEqual(['braucht-dich', 'sentry'])
  })

  it('Kommt: geplante Fassung, Festschreiben vor dem Stichtag, eigene Termine — nach Tag sortiert; festgeschrieben fällt weg', () => {
    const e = kommtEintraege({ naechsteFassung: new Date('2026-10-29T08:00:00.000Z'), gruendungAktionBisTag: '2026-12-31', gruendungFest: false }, JETZT)
    expect(e.map((x) => x.titel)).toEqual(['Startseite: geplante Fassung', 'Gründungsaktion festschreiben', 'Plattformgebühr im Hofpreis (Register N38)'])
    expect(e[0].wann).toBe('Do, 29. Okt, 09:00 · geht von selbst live')
    expect(kommtEintraege({ naechsteFassung: null, gruendungAktionBisTag: '2026-12-31', gruendungFest: true }, JETZT).map((x) => x.titel)).not.toContain('Gründungsaktion festschreiben')
  })

  it('Protokoll: „Du“, „Team“ oder „System“, nie ein Name; unbekannte Art heißt „Admin-Aktion“', () => {
    const zeilen = protokollZeilen(
      [
        { wann: vor(STUNDE), wer: 'ich', art: 'hof_freigeschaltet' },
        { wann: vor(TAG), wer: 'andere', art: 'mail_nochmal' },
        { wann: vor(2 * TAG), wer: null, art: 'kuenftige_art' },
      ],
      'ich',
      JETZT
    )
    expect(zeilen.map((z) => [z.wer, z.text])).toEqual([
      ['Du', 'Hof freigeschaltet'],
      ['Team', 'Mail nochmal geschickt'],
      ['System', 'Admin-Aktion'],
    ])
  })

  it('Lage: „Bestellungen heute“ mit „Im Rahmen“ und zwei Zeilen, „Geld · Woche“ mit der Servicegebühr (Mockup admin-heute)', () => {
    const k = lageKacheln(
      {
        bestellungen: { zurAbholung: 23, nichtGepackt: 4, storniert: 1 },
        woche: { umsatzCents: 184_000, gebuehrCents: 9_200, anzahl: 118, anzahlVorwoche: 108 },
        dienste: { laufen: 5, von: 5, ansehen: [], testbetrieb: false },
        hoefe: { verkaufen: 31, warten: 0 },
      },
      []
    )
    const bestellungen = k.find((x) => x.id === 'bestellungen')!
    expect(bestellungen.marke).toEqual({ wort: 'Im Rahmen', art: 'laeuft' })
    expect(bestellungen.zeilen).toEqual(['4 noch nicht gepackt · 1 Storno', 'Woche: 118 (+9 % zur Vorwoche)'])
    const geld = k.find((x) => x.id === 'geld')!
    expect(geld.wert).toMatch(/^€ 1\D840$/)
    expect(geld.zeilen).toEqual([expect.stringMatching(/^Servicegebühr € 92,00$/)])
  })

  it('Wochenzeile: weniger mit echtem Minus, gleich mit ±, ohne Vorwoche kein Prozent', () => {
    expect(wochenZeile({ anzahl: 90, anzahlVorwoche: 100 })).toBe('Woche: 90 (−10 % zur Vorwoche)')
    expect(wochenZeile({ anzahl: 100, anzahlVorwoche: 100 })).toBe('Woche: 100 (±0 % zur Vorwoche)')
    expect(wochenZeile({ anzahl: 3, anzahlVorwoche: 0 })).toBe('Woche: 3 (Vorwoche: keine)')
  })
})

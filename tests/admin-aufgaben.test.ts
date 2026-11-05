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
  bestellstopp: { ab: vor(STUNDE).toISOString(), bis: new Date(JETZT.getTime() + 2 * STUNDE).toISOString(), grund: 'wartung', satz: 'Bestellen geht gleich wieder.' },
  hoefeAktiv: [
    { id: 'hof-ohne-zeit', name: 'Hof Ohne Zeit', approvedAt: vor(60 * TAG), abholzeitAktiv: false, letzteBestellungAm: vor(TAG) },
    { id: 'hof-still', name: 'Hof Still', approvedAt: vor(90 * TAG), abholzeitAktiv: true, letzteBestellungAm: vor(16 * TAG) },
  ],
  // Zwei Felder derselben Bestellung sind EINE Aufgabe (Nr. 191).
  geldAbweichungen: [
    { orderId: 'bestellung-1', orderNumber: 'HM-2610-C3D4', feld: 'betrag', differenzCents: 120, seit: vor(30 * STUNDE) },
    { orderId: 'bestellung-1', orderNumber: 'HM-2610-C3D4', feld: 'gebuehr', differenzCents: -50, seit: vor(2 * STUNDE) },
  ],
  // Nr. 198: je Quelle der Plattformgebühr ein Fall (erfunden). Die Quote: 11 bar, 3 nicht abgeholt (27 %) — und ein Hof unter der Schwelle.
  plattformgebuehr: {
    gescheitert: [{ abrechnungId: 'abr-1', farmId: 'hof-a', hofName: 'Hof Lastschrift', monat: 'Februar 2027', seit: vor(4 * TAG) }],
    zurueckgebucht: [{ abrechnungId: 'abr-2', farmId: 'hof-b', hofName: 'Hof Rück', monat: 'Jänner 2027', seit: vor(STUNDE / 2) }],
    rechnungsangabenFehlenSeit: vor(TAG / 2),
    nichtAbgeholt: [
      { farmId: 'hof-c', hofName: 'Hof Quote', bar: 11, nicht: 3, seit: JETZT },
      { farmId: 'hof-d', hofName: 'Hof Wenig', bar: 9, nicht: 5, seit: JETZT },
    ],
  },
  // Nr. 201 (N40): Stripe live in der Produktion, der Stichtag liegt noch in der Zukunft.
  liveSignal: { umgebung: { art: 'produktion', stripe: 'live' }, einstellung: { hofpreisModellAb: new Date('2027-02-01T00:00:00.000+01:00') }, liveSeit: vor(2 * STUNDE) },
  // Nr. 200: ein zugeordneter Widerruf (erfunden); der nicht zugeordnete steht in tests/widerruf.test.ts.
  widerrufe: [{ id: 'widerruf-1', orderId: 'bestellung-2', bestellnummer: 'HM-2610-W1D3', hofName: 'Hof am Bach', eingegangenAm: vor(3 * TAG) }],
}

/** Was „erledigt“ je Quelle heißt: die Ursache fehlt im Stand. */
const ERLEDIGT: Record<AufgabeQuelle, Partial<AufgabenStand>> = {
  notbremse_aktiv: { bestellstopp: null },
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
  geld_abweichung: { geldAbweichungen: [] },
  einzug_gescheitert: { plattformgebuehr: { ...VOLL.plattformgebuehr, gescheitert: [] } },
  rueckbuchung: { plattformgebuehr: { ...VOLL.plattformgebuehr, zurueckgebucht: [] } },
  rechnungsangaben_fehlen: { plattformgebuehr: { ...VOLL.plattformgebuehr, rechnungsangabenFehlenSeit: null } },
  // 11 bar, 2 nicht abgeholt = 18 % — unter 20 %, die Aufgabe verschwindet.
  nicht_abgeholt_auffaellig: { plattformgebuehr: { ...VOLL.plattformgebuehr, nichtAbgeholt: [{ farmId: 'hof-c', hofName: 'Hof Quote', bar: 11, nicht: 2, seit: JETZT }] } },
  // Stichtag vorgezogen (erreicht) — das Signal verschwindet von selbst.
  stripe_live_ohne_hofpreis: { liveSignal: { umgebung: { art: 'produktion', stripe: 'live' }, einstellung: { hofpreisModellAb: vor(STUNDE) }, liveSeit: vor(2 * STUNDE) } },
  widerruf_offen: { widerrufe: [] },
}

describe('Plattformgebühr (Nr. 198): Fristen der neuen Quellen', () => {
  it('Einzug gescheitert: Ziel 3 Tage ab dem ersten Fehlschlag — nach 4 Tagen überfällig; Rückbuchung sofort (1 h)', () => {
    const [a] = ADMIN_AUFGABEN.einzug_gescheitert(VOLL, JETZT)
    expect(a.frist.ziel).toEqual(new Date(vor(4 * TAG).getTime() + 3 * TAG))
    expect(a.frist.ueberfaellig).toBe(true)
    expect(a.ziel).toBe('/admin/hoefe/hof-a')
    const [r] = ADMIN_AUFGABEN.rueckbuchung(VOLL, JETZT)
    expect(r.frist.dauerMs).toBe(STUNDE)
    expect(r.bereich).toBe('Geld')
  })

  it('Quote nicht abgeholt: ab 10 Barbestellungen und über 20 % — 9 Bestellungen zählen nie, genau 20 % nicht', () => {
    const quote = (bar: number, nicht: number) =>
      ADMIN_AUFGABEN.nicht_abgeholt_auffaellig({ ...VOLL, plattformgebuehr: { ...VOLL.plattformgebuehr, nichtAbgeholt: [{ farmId: 'h', hofName: 'H', bar, nicht, seit: JETZT }] } }, JETZT)
    expect(quote(10, 3)).toHaveLength(1)
    expect(quote(10, 2)).toHaveLength(0)
    expect(quote(9, 9)).toHaveLength(0)
  })
})

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
    // Seit Nr. 193 (N32): Freischalten steht in der Akte, nicht mehr im Postfach.
    expect(a.ziel).toBe('/admin/hoefe/hof-wartet')
  })

  it('Erstattung offen: Ziel 24 h, nach 2 Tagen „überfällig · seit 2 Tagen“, Bezug Nummer · Hof · Betrag', () => {
    const [a] = ADMIN_AUFGABEN.erstattung_offen(VOLL, JETZT)
    expect(a.frist.ueberfaellig).toBe(true)
    expect(fristText(a, JETZT)).toBe('überfällig · seit 2 Tagen')
    expect(a.bezug).toEqual({ kennung: 'HM-2610-B7C2', text: 'HM-2610-B7C2 · Hof am Bach · € 18,38' })
    // Seit Nr. 193 (N32): „Außerhalb erstattet“ steht in Admin › Bestellungen, nicht mehr im Postfach.
    expect(a.ziel).toBe('/admin/bestellungen?bestellung=bestellung-1')
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
  it('nach Frist sortiert — das nächste Ziel zuerst, überfällige oben; Notbremse und Stripe live (Nr. 201) stehen davor', () => {
    const [notbremse, live, ...aufgaben] = sammleAufgaben(VOLL, JETZT)
    expect(notbremse.quelle).toBe('notbremse_aktiv')
    expect(live.quelle).toBe('stripe_live_ohne_hofpreis')
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

describe('Notbremse aktiv (Nr. 189 Punkt 4)', () => {
  it('ganz oben, auch vor überfälligen Aufgaben; Frist = „bis“; Knopf „Freigeben“', () => {
    const [a] = sammleAufgaben(VOLL, JETZT)
    expect(a.quelle).toBe('notbremse_aktiv')
    expect(a.frist.ziel.toISOString()).toBe(VOLL.bestellstopp?.bis)
    expect(a.frist.ueberfaellig).toBe(false)
    expect(WAS_TUN[a.wasTun]).toBe('Freigeben')
    expect(fristText(a, JETZT)).toBe('bis Mo., 26.10., 11:42 Uhr')
    expect(a.bezug.text).toBe('Wartung')
    expect(a.satz).toBe('Bestellen geht gleich wieder.')
  })

  it('Gegenprobe: abgelaufen (Frist beim Lesen) oder aufgehoben → keine Aufgabe', () => {
    const abgelaufen = { ...VOLL.bestellstopp!, bis: vor(60_000).toISOString() }
    expect(ADMIN_AUFGABEN.notbremse_aktiv({ ...VOLL, bestellstopp: abgelaufen }, JETZT)).toEqual([])
    expect(ADMIN_AUFGABEN.notbremse_aktiv({ ...VOLL, bestellstopp: null }, JETZT)).toEqual([])
    expect(sammleAufgaben({ ...VOLL, bestellstopp: null }, JETZT)[0].quelle).not.toBe('notbremse_aktiv')
  })

  it('Protokoll nennt Anhalten und Freigeben beim Wort', () => {
    const zeilen = protokollZeilen(
      [
        { wann: vor(STUNDE), wer: 'ich', art: 'bestellungen_angehalten' },
        { wann: vor(STUNDE), wer: 'ich', art: 'bestellungen_freigegeben' },
      ],
      'ich',
      JETZT
    )
    expect(zeilen.map((z) => z.text)).toEqual(['Bestellungen angehalten', 'Bestellungen freigegeben'])
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

  it('Geld · Woche nach dem Abgleich (Nr. 191): „stimmt“ ohne Abweichung, sonst die Zahl als Wort mit Ton; ohne Lauf keine Marke', () => {
    const lage = {
      bestellungen: { zurAbholung: 0, nichtGepackt: 0, storniert: 0 },
      woche: { umsatzCents: 0, gebuehrCents: 0, anzahl: 0, anzahlVorwoche: 0 },
      dienste: { laufen: 5, von: 5, ansehen: [], testbetrieb: false },
      hoefe: { verkaufen: 1, warten: 0 },
    }
    const ohneLauf = lageKacheln(lage, []).find((x) => x.id === 'geld')!
    expect(ohneLauf.marke).toBeNull()
    const gut = lageKacheln({ ...lage, geldAbgleichOk: true }, []).find((x) => x.id === 'geld')!
    expect(gut.marke).toEqual({ wort: 'stimmt', art: 'laeuft' })
    expect(gut.zeilen[1]).toBe('Abgleich mit Stripe ohne Abweichung')
    const abw = sammleAufgaben(VOLL, JETZT).filter((a) => a.quelle === 'geld_abweichung')
    const schlecht = lageKacheln({ ...lage, geldAbgleichOk: true }, abw).find((x) => x.id === 'geld')!
    expect(schlecht.marke).toEqual({ wort: '1 Abweichung', art: 'tun' })
  })

  it('Abweichung beim Geld: je Bestellung eine Aufgabe, Nummer und Felder mit Unterschied in Euro, Frist 24 h ab der ältesten, Ziel die Suche nach der Nummer', () => {
    const [a] = ADMIN_AUFGABEN.geld_abweichung(VOLL, JETZT)
    expect(a.bereich).toBe('Geld')
    expect(a.bezug.kennung).toBe('HM-2610-C3D4')
    expect(a.bezug.text).toBe('HM-2610-C3D4 · Betrag +€ 1,20 · Servicegebühr −€ 0,50')
    expect(a.frist.ueberfaellig).toBe(true)
    expect(a.ziel).toBe('/admin/bestellungen?suche=HM-2610-C3D4')
    // Gegenprobe: jünger als 24 h → nicht überfällig.
    const [jung] = ADMIN_AUFGABEN.geld_abweichung({ ...VOLL, geldAbweichungen: [{ ...VOLL.geldAbweichungen[1] }] }, JETZT)
    expect(jung.frist.ueberfaellig).toBe(false)
  })

  it('Wochenzeile: weniger mit echtem Minus, gleich mit ±, ohne Vorwoche kein Prozent', () => {
    expect(wochenZeile({ anzahl: 90, anzahlVorwoche: 100 })).toBe('Woche: 90 (−10 % zur Vorwoche)')
    expect(wochenZeile({ anzahl: 100, anzahlVorwoche: 100 })).toBe('Woche: 100 (±0 % zur Vorwoche)')
    expect(wochenZeile({ anzahl: 3, anzahlVorwoche: 0 })).toBe('Woche: 3 (Vorwoche: keine)')
  })
})

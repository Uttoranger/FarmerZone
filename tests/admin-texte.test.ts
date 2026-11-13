/**
 * Admin-Texte (Lauf 34, Nr. 303; F047 „Verständlichkeit“): Eingriffe sagen ihre
 * Folgen, ohne Kürzel und Technikwörter.
 *
 * Beweist:
 *  - A1/A2: Eine Abweichung im Feld „gebuehr“ nennt das Wort der Bestellung
 *    (Plattformgebühr im Hofpreis-Modell, sonst Servicegebühr); der Satz nennt
 *    weder „Datenbank“ noch einen Pfad und sagt, dass der Monat offen bleibt.
 *  - A3, A4, A5: neue Titel und Sätze, ohne „/api/“, „Uptime“, „Stichtag vorziehen“;
 *    die Betriebsleiste liefert denselben Titel wie die Aufgabe.
 *  - A6: Titel und Satz der Aufgabe „Lastschrift zurückgebucht“ sind Zeichen für
 *    Zeichen wie vor 303 (Tor T2: der Satz aus 290 gilt).
 *  - A7: `auskunft.satz` wörtlich wie von Recht; `auskunftKundin.satz` unverändert
 *    (Tor T5 greift, Startsatz „Auskunft ohne IP von Recht bestätigt“ fehlt).
 *  - A8–A10, B1, B3–B7, B10–B12: die Sätze wörtlich.
 *  - B2: die Hilfssätze der Akte (Recht, Gegenlesen Fund 8) wörtlich, je Feld mit
 *    aria-describedby; die Vorgabe des Einzugs als Datum ausgeschrieben.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/server/actions/admin-plattformgebuehr', () => ({ speichereHofPlattformgebuehr: vi.fn(), klaereRueckbuchung: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/components/admin/frisch-bestaetigen', () => ({ useFrischBestaetigt: () => ({ ausfuehren: vi.fn(), dialog: null }) }))

import { ADMIN_AUFGABEN, LEERER_STAND, MONTAGS_ROUTINE, lageKacheln, liveSignalLeiste, sammleAufgaben, type AufgabenStand } from '@/lib/admin-aufgaben'
import { ABWEICHUNG_FELD_TEXT, abweichungFeldText, type OffeneAbweichung } from '@/lib/geld-abgleich'
import { KONTO_ANFRAGE_TEXT } from '@/lib/konto-anfragen'
import { TEAM_TEXT } from '@/lib/admin-team'
import { ADMIN_BESTELLUNG_TEXT } from '@/lib/admin-bestellung'
import { ZUSTELL_REGEL_TEXT } from '@/lib/zustellung'
import { EINSTELLUNGEN_TEXT, HOFPREIS_RUECKFRAGE_TEXT, HOFPREIS_STICHTAG_TEXT, hofpreisStichtagSatz } from '@/lib/plattform-einstellung'
import { GRUENDUNG_AUSNEHMEN_TEXT } from '@/lib/admin-hoefe-seite'
import { GRUENDUNG_BIS_DIALOG } from '@/lib/gruendungshof'
import { GELD_TEXT } from '@/app/admin/geld/texte'
import { monatsabschlussPruefliste } from '@/lib/finanzen'
import { ADMIN_MEHR_ZEILE } from '@/lib/admin-navigation'
import { MELDUNGEN_TEXT, WUENSCHE_TEXT } from '@/lib/meldung'
import { ABLAEUFE, BETRIEB_TEXT } from '@/lib/betrieb'
import { MARKE } from '@/lib/marke'
import { MINDESTBESTELLWERT_TEXT, PLATTFORMGEBUEHR_BEZEICHNUNG, PLATTFORMGEBUEHR_PROZENT } from '@/lib/konditionen'
import { SERVICEGEBUEHR_BEZEICHNUNG } from '@/lib/servicegebuehr'
import { AGB_NEUESTE } from '@/lib/rechtstexte/agb-fassung'
import { formatZahl } from '@/lib/format'
import { HofAktePlattformgebuehr } from '@/components/admin/hof-akte-plattformgebuehr'

const JETZT = new Date('2026-11-11T09:00:00.000Z')
const STUNDE = 60 * 60_000
const vor = (ms: number): Date => new Date(JETZT.getTime() - ms)

const abweichung = (feld: OffeneAbweichung['feld'], gebuehrModell: string | null): OffeneAbweichung => ({
  orderId: `b-${feld}-${gebuehrModell ?? 'bisher'}`,
  orderNumber: gebuehrModell ? 'HM-2611-H1P1' : 'HM-2611-B1S1',
  feld,
  differenzCents: -50,
  seit: vor(2 * STUNDE),
  gebuehrModell,
})

describe('A1/A2 Abweichung beim Geld: das Wort je Bestellung, der Satz ohne Technik', () => {
  it('Feld „gebuehr“: Plattformgebühr bei gebuehrModell „hofpreis“, Servicegebühr bei null', () => {
    const stand: AufgabenStand = { ...LEERER_STAND, geldAbweichungen: [abweichung('gebuehr', 'hofpreis'), abweichung('gebuehr', null)] }
    const bezuege = sammleAufgaben(stand, JETZT)
      .filter((a) => a.quelle === 'geld_abweichung')
      .map((a) => a.bezug.text)
      .sort()
    expect(bezuege).toEqual(['HM-2611-B1S1 · Servicegebühr −€ 0,50', 'HM-2611-H1P1 · Plattformgebühr −€ 0,50'])
  })

  it('abweichungFeldText: Gebühr über das Wort der Bestellung, die übrigen Felder wie bisher', () => {
    expect(abweichungFeldText(abweichung('gebuehr', 'hofpreis'))).toBe(PLATTFORMGEBUEHR_BEZEICHNUNG)
    expect(abweichungFeldText(abweichung('gebuehr', null))).toBe(SERVICEGEBUEHR_BEZEICHNUNG)
    expect(abweichungFeldText(abweichung('betrag', 'hofpreis'))).toBe('Betrag')
    expect(abweichungFeldText(abweichung('zahlung', null))).toBe('Zahlung fehlt bei Stripe')
    // Nur noch Rückfall — gelesen wird über abweichungFeldText.
    expect(ABWEICHUNG_FELD_TEXT.gebuehr).toBe('Gebühr')
  })

  it('der Satz nennt weder „Datenbank“ noch einen Pfad und sagt, dass der Monat offen bleibt', () => {
    const [a] = ADMIN_AUFGABEN.geld_abweichung({ ...LEERER_STAND, geldAbweichungen: [abweichung('betrag', null)] }, JETZT)
    expect(a.satz).toBe(
      `${MARKE} und Stripe haben für diese Bestellung verschiedene Beträge (Plus: bei ${MARKE} steht mehr). Öffne die Bestellung und daneben die Zahlung in Stripe. Solange das offen ist, lässt sich der Monat der Bestellung nicht abschließen.`
    )
    expect(a.satz).not.toMatch(/Datenbank|\/api\/|\/admin\//)
  })
})

describe('A3, A4, A5: Titel und Sätze ohne Technikwörter', () => {
  it('A3 neue Meldung: „Lesen, einordnen und antworten.“', () => {
    const stand: AufgabenStand = { ...LEERER_STAND, meldungen: [{ id: 'meldung-1', art: 'FRAGE', createdAt: vor(STUNDE), ersteZeile: 'Wie geht das?', von: 'Kundin' }] }
    const [a] = ADMIN_AUFGABEN.meldung_neu(stand, JETZT)
    expect(a.satz).toBe('Lesen, einordnen und antworten.')
  })

  it('A4 Überwachung von außen: Titel und Satz ohne „/api/“ und „Uptime“', () => {
    const laeufe = new Map([['von-aussen', { gestartetAm: vor(3 * STUNDE), beendetAm: vor(3 * STUNDE), ok: true, fehlerKlasse: null, dauerMs: 10 }]])
    const [a] = ADMIN_AUFGABEN.uptime_still({ ...LEERER_STAND, laeufe }, JETZT)
    expect(a.titel).toBe('Die Überwachung von außen meldet sich nicht')
    expect(a.satz).toBe(
      `Seit über 30 Minuten hat der Dienst, der von außen prüft, ob ${MARKE} erreichbar ist, nicht mehr nachgesehen. Sieh dort nach. Solange er still ist, merkt niemand einen Ausfall.`
    )
    for (const text of [a.titel, a.satz]) expect(text).not.toMatch(/\/api\/|Uptime/)
  })

  it('A5 echte Zahlungen ohne Plattformgebühr im Preis: Titel und Satz ohne „Stichtag vorziehen“; die Betriebsleiste nimmt denselben Titel', () => {
    const stand: AufgabenStand = {
      ...LEERER_STAND,
      liveSignal: { umgebung: { art: 'produktion', stripe: 'live' }, einstellung: { hofpreisModellAb: new Date('2027-02-01T00:00:00.000+01:00') }, liveSeit: null },
    }
    const [a] = ADMIN_AUFGABEN.stripe_live_ohne_hofpreis(stand, JETZT)
    expect(a.titel).toBe('Echte Zahlungen laufen, aber die Plattformgebühr im Preis beginnt erst am 1.\u00a0Februar 2027 – Tag vorziehen')
    expect(a.satz).toBe(
      'Bis dahin gilt für neue Bestellungen das bisherige Modell: Online zahlt die Kundschaft die Gebühr zusätzlich zum Preis, bar fällt keine an. Setz den Tag in den Einstellungen bei „Hofpreis-Modell ab“ so früh wie möglich.'
    )
    for (const text of [a.titel, a.satz]) expect(text).not.toContain('Stichtag vorziehen')
    expect(liveSignalLeiste(sammleAufgaben(stand, JETZT))?.text).toBe(a.titel)
  })
})

describe('A6 (Tor T2): „Lastschrift zurückgebucht“ bleibt der Satz aus 290', () => {
  it('Titel und Satz Zeichen für Zeichen wie vor 303; der Satz nennt den Notweg', () => {
    const stand: AufgabenStand = {
      ...LEERER_STAND,
      plattformgebuehr: { ...LEERER_STAND.plattformgebuehr, zurueckgebucht: [{ abrechnungId: 'a-1', farmId: 'hof-1', hofName: 'Hof Test', monat: 'Oktober 2027', seit: vor(STUNDE) }] },
    }
    const [a] = ADMIN_AUFGABEN.rueckbuchung(stand, JETZT)
    // Stand vor 303 (7792085236c9, src/lib/admin-aufgaben.ts, Funktion rueckbuchung).
    expect(a.titel).toBe('Lastschrift zurückgebucht')
    expect(a.satz).toBe(
      'Der Hof nimmt keine Barbestellungen mehr an und hat eine Rechnung über den Betrag bekommen. Zahlt er sie, ist er von selbst wieder frei. Hat er anders gezahlt: in der Hof-Akte „Sperre nach Rückbuchung aufheben“.'
    )
    expect(a.satz).toContain('Sperre nach Rückbuchung aufheben')
  })
})

describe('A7 Auskunft (Recht, Gegenlesen Fund 11; Tor T5)', () => {
  it('Auskunft an den Hof: wörtlich wie von Recht, mit Monat und Anmelde-Adresse', () => {
    expect(KONTO_ANFRAGE_TEXT.auskunft.satz).toBe(
      'Eine Datei mit allen gespeicherten Daten zu Konto, Hof, Produkten, Abholzeiten, Beiträgen, Postfach, eigenen Meldungen und den Bestellungen als Verkäufer – ohne Daten der Kundschaft (Format JSON, mit jedem Texteditor lesbar). Schick sie dem Hof innerhalb eines Monats, nur an seine Anmelde-Adresse.'
    )
  })

  it('Auskunft an eine Adresse der Kundschaft: ohne Startsatz bei Tor T5 Zeichen für Zeichen wie vor 303', () => {
    expect(KONTO_ANFRAGE_TEXT.auskunftKundin.satz).toBe('Bestellungen, Abos und Sitzungen (ohne IP) zu genau dieser Adresse als JSON-Datei.')
  })
})

describe('A8–A10: Team, Bestellung, Zustellung', () => {
  it('A8 Notfallzugang: was es nicht gibt und was bis dahin hilft', () => {
    expect(TEAM_TEXT.notfallOffen).toBe('Einen eigenen Notfallzugang für eine Vertrauensperson gibt es noch nicht. Bis dahin: Lade deine Vertretung als Person ins Team ein.')
  })

  it('A9 Bestellung ohne Unterhaltung mit dem Hof: mit Ausweg', () => {
    expect(ADMIN_BESTELLUNG_TEXT.hofOhneFaden).toBe('Mit diesem Hof gibt es im Postfach bisher keine Unterhaltung. Schreib ihm ein Rundschreiben an „Ausgewählte“.')
  })

  it('A10 Antwort eines Hofs: „Unterhaltung“ statt „Faden“, Rest unverändert', () => {
    expect(ZUSTELL_REGEL_TEXT.antwortHof).toBe('Antwort eines Hofs – sofort, höchstens eine Mail je Unterhaltung und Stunde; aus heißt nur der Zähler im Eingang')
  })
})

describe('B1 Stichtag „Hofpreis-Modell ab“: was der Tag schaltet', () => {
  const prozent = formatZahl(PLATTFORMGEBUEHR_PROZENT)

  it('vor dem Tag: Preis, AGB, Monatsabrechnung und „nicht mehr ändern“ — Zahlen aus den Konstanten', () => {
    const satz = hofpreisStichtagSatz(false)
    expect(satz).toBe(
      `Ab diesem Tag steht die ${PLATTFORMGEBUEHR_BEZEICHNUNG} (${prozent} %) im Preis, den die Kundschaft sieht – online und bar gleich, Mindestbestellwert ${MINDESTBESTELLWERT_TEXT}. Für neue Bestellungen gelten ab diesem Tag die AGB ${AGB_NEUESTE}, und die Monatsabrechnung der Gebühr beginnt. Ist der Tag erreicht, lässt er sich nicht mehr ändern.`
    )
    for (const wort of ['AGB', 'Monatsabrechnung', 'nicht mehr ändern']) expect(satz).toContain(wort)
  })

  it('nach dem Tag: „Seit diesem Tag …“ ohne „Ab diesem Tag“', () => {
    const satz = hofpreisStichtagSatz(true)
    expect(satz).toBe(
      `Seit diesem Tag steht die ${PLATTFORMGEBUEHR_BEZEICHNUNG} (${prozent} %) im Preis, den die Kundschaft sieht – online und bar gleich, Mindestbestellwert ${MINDESTBESTELLWERT_TEXT}. Seitdem gelten für neue Bestellungen die AGB ${AGB_NEUESTE} und die Monatsabrechnung der Gebühr.`
    )
    expect(satz).not.toContain('Ab diesem Tag')
    expect(HOFPREIS_STICHTAG_TEXT.satzErreicht).toBe(satz)
  })

  it('die Rückfrage: Titel mit Tag, drei Punkte und ein Satz, Knopf „Mit Passkey speichern“', () => {
    expect(HOFPREIS_RUECKFRAGE_TEXT.titel('2027-01-15')).toBe('„Hofpreis-Modell ab“ auf den 15.\u00a0Jänner 2027 setzen?')
    expect(HOFPREIS_RUECKFRAGE_TEXT.punkte).toEqual([
      `Ab diesem Tag zahlt die Kundschaft den Preis mit ${PLATTFORMGEBUEHR_BEZEICHNUNG}, online und bar.`,
      `Für neue Bestellungen gelten ab diesem Tag die AGB ${AGB_NEUESTE}.`,
      'Die Monatsabrechnung der Gebühr beginnt mit den Bestellungen ab diesem Tag.',
    ])
    expect(HOFPREIS_RUECKFRAGE_TEXT.satz).toBe('Bis der Tag erreicht ist, kannst du ihn noch verschieben. Danach nicht mehr.')
    expect(HOFPREIS_RUECKFRAGE_TEXT.knopf).toBe('Mit Passkey speichern')
  })
})

describe('B2 Akte › Plattformgebühr: je Feld ein Hilfssatz (Recht, Gegenlesen Fund 8)', () => {
  const html = renderToStaticMarkup(
    createElement(HofAktePlattformgebuehr, {
      daten: {
        farmId: 'hof_1',
        mandat: false,
        abrechnungen: [],
        nichtAbgeholt: { bar: 0, nicht: 0 },
        einstellungen: { satz: '6', mandatPflicht: true, sperreTage: 14, abrechnungsTag: 3, einzugAb: '', vorgabeEinzugAb: '2028-01-01' },
      },
    })
  ).replaceAll('&quot;', '"')

  const SAETZE = {
    satz: 'Gilt ab dem Speichern für neue Bestellungen dieses Hofs – darum erst am angekündigten Tag speichern.',
    tage: 'So lange darf eine Abrechnung offen sein. Danach nimmt der Hof keine Barbestellungen an.',
    einzug: `Vorher verzichtet ${MARKE} auf die Gebühr aus Barbestellungen.`,
    mandat: 'Mit Haken geht bar nur mit eingerichteter Lastschrift, sobald der Einzug begonnen hat. Ohne Haken bekommt der Hof ohne Lastschrift die Rechnung zur Überweisung.',
  }
  const UNTER_DEM_KNOPF =
    'Satz und Einzug gelten ab dem Speichern für neue Bestellungen. Jede Änderung an Satz, Einzug, Frist bis zur Sperre, Lastschrift-Pflicht oder Abrechnungstag kündigst du dem Hof vorher im Postfach und per E-Mail an: zu seinem Nachteil mindestens 30 Tage, sonst mindestens 15 Tage (AGB 19.9 und 32.3). Verzichtet der Hof nach der Ankündigung in Textform auf die Frist, darfst du früher speichern. Sonst speicherst du erst am angekündigten Tag.'

  it('die Hilfssätze und der Satz unter dem Knopf stehen wörtlich', () => {
    for (const satz of [...Object.values(SAETZE), UNTER_DEM_KNOPF]) expect(html).toContain(satz)
    for (const wort of ['15 Tage', '30 Tage', 'Postfach', 'E-Mail']) expect(UNTER_DEM_KNOPF).toContain(wort)
    expect(html).not.toContain('Satz und Einzug gelten nur für neue Bestellungen.')
  })

  it('jedes Feld zeigt per aria-describedby auf seinen Hilfssatz', () => {
    for (const [schluessel, satz] of Object.entries(SAETZE)) {
      const absatz = html.match(new RegExp(`<p id="([^"]+)"[^>]*>${satz.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</p>`))
      expect(absatz, schluessel).not.toBeNull()
      expect(html, schluessel).toContain(`aria-describedby="${absatz![1]}"`) // ! — die Zeile davor prüft den Treffer.
    }
  })

  it('die Vorgabe des Einzugs als Datum ausgeschrieben', () => {
    expect(html).toContain('Einzug ab (Vorgabe 1.\u00a0Jänner 2028)')
    expect(html).not.toContain('2028-01-01)')
  })
})

describe('B3–B7, B10–B12: Kürzel und Technikwörter durch Folgen ersetzt', () => {
  it('B3 Gründung und Plattform: ohne Register-Kürzel', () => {
    expect('register' in EINSTELLUNGEN_TEXT.gruendung).toBe(false)
    expect(EINSTELLUNGEN_TEXT.plattform.satz).toBe('Nur zum Nachsehen: Name und Adresse sind fest hinterlegt. Ändern lässt du sie per Auftrag.')
    expect(GRUENDUNG_AUSNEHMEN_TEXT.hakenGrund).toBe('Nötig, weil der Hof gerade einen Gründungsplatz hat und ihn dadurch verliert.')
    expect(GRUENDUNG_BIS_DIALOG.zustimmung).toBe('Nur mit Zustimmung des Hofs')
  })

  it('B4 Stripe-Gebühr trägt die Plattform', () => {
    expect(GELD_TEXT.stripeGebuehrTraeger).toBe(`trägt ${MARKE}`)
  })

  it('B5 Monatsabschluss: Bestellungen, die abweichen, und wo sie stehen', () => {
    const basis = { abgleichNachMonatsende: true, abweichungen: 0, erstattungenOffen: 0, kostenPosten: 1, csvGeladen: true }
    const [zwei] = monatsabschlussPruefliste({ ...basis, abweichungen: 2 })
    expect(zwei.text).toBe('Abgleich mit Stripe ohne Abweichung')
    expect(zwei.offen).toBe('2 Bestellungen weichen ab – sie stehen in Heute')
    expect(monatsabschlussPruefliste({ ...basis, abweichungen: 1 })[0].offen).toBe('1 Bestellung weicht ab – sie stehen in Heute')
  })

  it('B6 „Bestellungen heute“ ohne Marke — es gibt keinen Rahmen dahinter', () => {
    const k = lageKacheln(
      {
        bestellungen: { zurAbholung: 3, nichtGepackt: 1, storniert: 0 },
        woche: { umsatzCents: 0, gebuehrCents: 0, anzahl: 0, anzahlVorwoche: 0 },
        dienste: { laufen: 5, von: 5, ansehen: [], testbetrieb: false },
        hoefe: { verkaufen: 1, warten: 0 },
      },
      []
    )
    expect(k[0].id).toBe('bestellungen')
    expect(k[0].marke).toBeNull()
  })

  it('B7 Montags-Routine ohne „Sentry:“ vorne und ohne Stripe-Auszahlung als Wochenaufgabe', () => {
    const texte = Object.fromEntries(MONTAGS_ROUTINE.map((p) => [p.id, p.text]))
    expect(texte.sentry).toBe('Fehlermeldungen der Woche angesehen (Sentry)')
    expect(texte.geld).toBe('Geld: Abgleich mit Stripe ohne Abweichung, Auszahlung in Stripe angesehen')
  })

  it('B10 Notfallzugang steht nicht als Einstellung da', () => {
    expect(ADMIN_MEHR_ZEILE.einstellungen).toBe('Team, Benachrichtigungen')
    expect(EINSTELLUNGEN_TEXT.gruppe.team.zeile).toBe('Personen, Rechte')
  })

  it('B11 Meldungen: „Erledigt“ und „Umgesetzt“ setzen sich, sobald die Änderung online ist', () => {
    expect(MELDUNGEN_TEXT.regel).toMatch(/ Auf „Erledigt“ springt eine Meldung von selbst, sobald die Änderung online ist – nie durch die KI\.$/)
    expect(WUENSCHE_TEXT.umgesetztHinweis).toBe('„Umgesetzt“ setzt sich von selbst, sobald die Änderung online ist.')
  })

  it('B12 Betrieb: Grenzen, gescheiterter Lauf, Aufräumen und Bilder in Alltagsworten', () => {
    expect(BETRIEB_TEXT.tarifeFuss).toBe('Die Grenzen sind fest hinterlegt. Nach einem Tarifwechsel bitte ändern lassen.')
    expect(BETRIEB_TEXT.ablaeufeRegelFehler).toBe('= der Lauf ist gescheitert; der Fehler steht in Sentry, ohne Inhalt. Beides schickt eine Warn-Mail; jeder Ablauf prüft nach seinem Lauf die anderen.')
    expect(BETRIEB_TEXT.ablaeufeAufraeumen).toBe('„Aufräumen“ = Reservierungen, Bremse, abgelaufene Sitzungen und Codes, alte Ereignisse von Stripe und Messungen.')
    expect(ABLAEUFE.find((a) => a.name === 'aufraeumen')?.zweck).toContain('Codes, alte Ereignisse von Stripe, alte Messungen')
    expect(BETRIEB_TEXT.ohneVerwendungFuss).toMatch(/ Gelöscht wird erst nach deiner Durchsicht\.$/)
  })
})

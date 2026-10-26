/**
 * Admin › Betrieb › E-Mails — die reinen Regeln (src/lib/betrieb-mails.ts,
 * Register N26, N18-Ergänzung 24.10.2026; Nr. 161).
 *
 * Beweist mit festem Bestand und fester Uhr, je mit Gegenprobe:
 *  - jede Kennzahl, auch an der Grenze des Abrechnungszeitraums (16./17.)
 *    und des UTC-Tags (Wiener Zeit 1:59 vs. 2:00 im Sommer);
 *  - eine Quote erst ab 50 Mails, darunter kein Prozent;
 *  - jede Kachel trägt ein Zustandswort, Ton `tun` nur bei Handlungsbedarf;
 *  - FEHLER_TEXTE: 422 (validation_error) ohne „Jetzt schicken“, 429 mit,
 *    ein unbekannter Code mit Ersatztext;
 *  - maskiereAdresse mit kurzen, langen und ungewöhnlichen Adressen;
 *  - jede Warnung (wartet, hängt, abgelehnt, Spam) und ihr Schritt; das
 *    Lebenszeichen ab 15 Minuten;
 *  - „Braucht dich“, „Je Art“, Verlauf, Warteschlange und Suche.
 */
import { describe, it, expect } from 'vitest'
import {
  CODES_OHNE_JETZT_SCHICKEN,
  FEHLER_TEXTE,
  MAIL_ART_NAME,
  MAIL_TEXT,
  artName,
  brauchtDich,
  codeText,
  erwarteteMails,
  fehlerText,
  jeArt,
  mailKacheln,
  mailVerlauf,
  mailWarnLage,
  mailWarnSchritt,
  mailWarnkarte,
  maskiereAdresse,
  quote,
  schlangeKarte,
  suchErgebnis,
  wegName,
  wichtigeMailHaengt,
  zeitraumText,
  type ArtZahlen,
  type KachelEingabe,
  type ProblemAuftrag,
  type SuchBestellung,
  type SuchMail,
  type WarteschlangeDaten,
} from '@/lib/betrieb-mails'
import { MAIL_WARN_ARTEN, betriebHinweis, betriebKacheln, betriebMail, warnHinweis, warnEintraege } from '@/lib/betrieb'
import { MAIL_ARTEN } from '@/schemas/mail-auftrag'
import { formatZahl } from '@/lib/format'
import { MARKE } from '@/lib/marke'

const JETZT = new Date('2026-10-24T07:42:00.000Z') // 09:42 in Wien (Sommerzeit)
const GRENZE_FREE = { mailsTag: 100, mailsMonat: 3_000 }
const PAUSE = { tagProzent: 70, zeitraumProzent: 90 }

const minuten = (n: number): Date => new Date(JETZT.getTime() - n * 60_000)

const LEERE_SCHLANGE: WarteschlangeDaten = { wichtig: 0, kannWarten: 0, aeltesteWichtigeAm: null, aeltesteWichtige: null, faelligSeit: null, kannWartenPausiert: false }

function art(teil: Partial<ArtZahlen> & Pick<ArtZahlen, 'art'>): ArtZahlen {
  return { vorrang: 1, gesendet: 0, zugestellt: 0, gescheitert: 0, abgelehnt: 0, spam: 0, wartezeitMs: null, ...teil }
}

function problem(teil: Partial<ProblemAuftrag> & Pick<ProblemAuftrag, 'id'>): ProblemAuftrag {
  return { art: 'bestellung-bestaetigung', vorrang: 1, status: 'offen', versuche: 2, fehlerCode: 'rate_limit_exceeded', erstelltAm: minuten(7), naechsterVersuchAm: new Date(JETZT.getTime() + 60_000), belegtBis: null, ...teil }
}

function eingabe(teil: Partial<KachelEingabe> = {}): KachelEingabe {
  return { zaehler: { heute: 62, imZeitraum: 1_284 }, schlange: LEERE_SCHLANGE, probleme: [], arten: [], pause: PAUSE, tarif: 'Resend Free', ...teil }
}

describe('Einstieg aus dem Überblick', () => {
  it('die Kachel „E-Mails heute“ führt zum Unterreiter E-Mails — die anderen Kacheln nicht', () => {
    const kacheln = betriebKacheln([], JETZT)
    expect(kacheln.find((k) => k.id === 'mailsHeute')?.href).toBe('/admin/betrieb?reiter=mails')
    expect(kacheln.filter((k) => k.href !== undefined).map((k) => k.id)).toEqual(['mailsHeute'])
  })
})

describe('Namen und Wege', () => {
  it('jede Art hat einen deutschen Namen; eine unbekannte steht mit Kürzel da', () => {
    for (const a of MAIL_ARTEN) expect(MAIL_ART_NAME[a].length, a).toBeGreaterThan(2)
    expect(artName('bestellung-bestaetigung')).toBe('Bestellbestätigung')
    expect(artName('neue-art-x')).toBe('neue-art-x')
  })

  it('die Wege heißen Sofort, Wichtig, Kann warten — nie eine Zahl', () => {
    expect([0, 1, 2].map(wegName)).toEqual(['Sofort', 'Wichtig', 'Kann warten'])
  })
})

describe('FEHLER_TEXTE', () => {
  it('422 (Adresse gibt es nicht): Grund in Worten, ohne „Jetzt schicken“', () => {
    const t = fehlerText('validation_error')
    expect(t).toMatchObject({ grund: 'Diese Adresse gibt es nicht', jetztSchicken: false, http: 422 })
    expect(t.tun).toBe('Nochmal schicken hilft hier nicht – die Adresse ist falsch geschrieben.')
    expect(codeText('validation_error')).toBe('Code 422')
    expect(CODES_OHNE_JETZT_SCHICKEN).toContain('validation_error')
  })

  it('Gegenprobe: 429 (überlastet) erlaubt „Jetzt schicken“ und sagt, dass du nichts tun musst', () => {
    expect(fehlerText('rate_limit_exceeded')).toMatchObject({ grund: 'Resend war kurz überlastet', tun: 'Du musst nichts tun. Wenn es eilt: jetzt schicken.', jetztSchicken: true })
    expect(codeText('rate_limit_exceeded')).toBe('Code 429')
    expect(CODES_OHNE_JETZT_SCHICKEN).not.toContain('rate_limit_exceeded')
  })

  it('ein unbekannter Code: „Unbekannter Fehler (Code …)“, der Code klein dahinter', () => {
    expect(fehlerText('etwas_neues').grund).toBe('Unbekannter Fehler (Code etwas_neues)')
    expect(codeText('etwas_neues')).toBe('Code etwas_neues')
    // Ein Name aus dem Prototyp ist kein Eintrag der Liste.
    expect(fehlerText('toString').grund).toBe('Unbekannter Fehler (Code toString)')
  })

  it('jeder Eintrag hat Grund, Kurzform und „Was tun“ — ohne die Wörter, die die Wortliste meidet', () => {
    for (const [code, t] of Object.entries(FEHLER_TEXTE)) {
      expect(t.grund.length, code).toBeGreaterThan(5)
      expect(t.kurz.length, code).toBeGreaterThan(3)
      expect(`${t.grund} ${t.tun}`, code).not.toMatch(/Bounce|Beschwerde|Erneut versuchen|Vorrang/)
    }
  })
})

describe('maskiereAdresse', () => {
  it.each([
    ['kundin@example.at', 'k•••@example.at'],
    ['K.Mustermann+bestellung@Mail.Example.com', 'k•••@mail.example.com'],
    ['a@example.com', 'a•••@example.com'],
    ['  Lang.Langer.Name.Mit.Vielen.Punkten@sub.domain.example.org ', 'l•••@sub.domain.example.org'],
    ['ä.umlaut@example.at', 'ä•••@example.at'],
    ['"zitat@intern"@example.com', '"•••@example.com'],
  ])('%s → %s', (adresse, erwartet) => {
    expect(maskiereAdresse(adresse)).toBe(erwartet)
  })

  it('ohne @ oder ohne Teil davor bzw. danach: nur Punkte — nie die Eingabe', () => {
    expect(maskiereAdresse('keine-adresse')).toBe('•••')
    expect(maskiereAdresse('@example.at')).toBe('•••')
    expect(maskiereAdresse('kundin@')).toBe('•••')
  })

  it('Gegenprobe: der Teil vor dem @ steht nie ganz da', () => {
    const adresse = 'geheimname@example.at'
    expect(maskiereAdresse(adresse)).not.toContain('geheimname')
  })
})

describe('Quote ab 50 Mails', () => {
  it('unter 50 Mails keine Quote, ab 50 eine', () => {
    expect(quote(1, 49)).toBeNull()
    expect(quote(1, 50)).toBe(2)
  })

  it('die Kachel Zustellung: unter 50 „zu wenig Mails“ und kein Prozent, ab 50 die Quoten', () => {
    const wenig = mailKacheln(eingabe({ arten: [art({ art: 'abholbereit', gesendet: 49, zugestellt: 49 })] }), JETZT, GRENZE_FREE).find((k) => k.id === 'zustellung')
    expect(wenig).toMatchObject({ wert: '–', von: 'zu wenig Mails', zustand: { wort: 'Im Rahmen', art: 'laeuft' } })
    expect(wenig?.zeilen.join(' ')).not.toContain('%')
    const genug = mailKacheln(eingabe({ arten: [art({ art: 'abholbereit', gesendet: 1_000, zugestellt: 994, abgelehnt: 6 })] }), JETZT, GRENZE_FREE).find((k) => k.id === 'zustellung')
    expect(genug).toMatchObject({ wert: '99,4 %', von: 'zugestellt', zustand: { wort: 'Gut', art: 'laeuft' } })
    expect(genug?.zeilen).toEqual(['Abgelehnt 0,6 % · Grenze 4 %', 'Spam gemeldet 0,00 % · Grenze 0,08 %', `Aus ${formatZahl(1_000)} Mails · Meldungen von Resend`])
  })
})

describe('Kacheln', () => {
  it('jede Kachel trägt ihren Zustand als Wort (nie nur Farbe)', () => {
    const kacheln = mailKacheln(eingabe(), JETZT, GRENZE_FREE)
    expect(kacheln.map((k) => k.id)).toEqual(['heute', 'zeitraum', 'warteschlange', 'gescheitert', 'zustellung'])
    for (const k of kacheln) expect(k.zustand.wort.length, k.id).toBeGreaterThan(1)
    expect(kacheln.map((k) => k.zustand.art)).toEqual(['laeuft', 'laeuft', 'laeuft', 'laeuft', 'laeuft'])
  })

  it('Heute: 62 von 100 mit Strich bei 70 %; ab 70 % pausiert Kann warten, ab 80 % Achtung', () => {
    const heute = (n: number) => mailKacheln(eingabe({ zaehler: { heute: n, imZeitraum: 0 } }), JETZT, GRENZE_FREE)[0]
    expect(heute(62)).toMatchObject({ wert: '62', von: 'von 100 · 62 %', balken: { anteil: 62, strich: 70, warnt: false }, zustand: { wort: 'Im Rahmen' } })
    expect(heute(70).zustand).toEqual({ wort: 'Kann warten pausiert', art: 'laeuft' })
    expect(heute(80).zustand).toEqual({ wort: 'Achtung', art: 'tun' })
  })

  it('Heute: der Resend-Tag beginnt in Wien um 2:00 (Sommer) bzw. 1:00 (Winter)', () => {
    expect(mailKacheln(eingabe(), JETZT, GRENZE_FREE)[0].zeilen).toEqual(['Zählt ab 2:00 Uhr – Resend rechnet in Weltzeit.'])
    expect(mailKacheln(eingabe(), new Date('2026-11-24T07:42:00.000Z'), GRENZE_FREE)[0].zeilen).toEqual(['Zählt ab 1:00 Uhr – Resend rechnet in Weltzeit.'])
  })

  it('Heute ohne Tagesgrenze (Resend Pro): kein Balken, kein Prozent', () => {
    const k = mailKacheln(eingabe(), JETZT, { mailsTag: null, mailsMonat: 50_000 })[0]
    expect(k).toMatchObject({ von: 'ohne Tagesgrenze', balken: null, zustand: { wort: 'Im Rahmen' } })
  })

  it('Abrechnungszeitraum: 1.284 von 3.000, 17. Okt bis 16. Nov, noch n Tage — an der Grenze 16./17.', () => {
    const k = mailKacheln(eingabe(), JETZT, GRENZE_FREE)[1]
    expect(k).toMatchObject({ wert: formatZahl(1_284), von: `von ${formatZahl(3_000)} · 42 %`, zeilen: ['17. Okt bis 16. Nov · noch 24 Tage'] })
    expect(zeitraumText(new Date('2026-10-16T23:59:00.000Z'))).toBe('17. Sep bis 16. Okt · noch 1 Tag')
    expect(zeitraumText(new Date('2026-10-17T00:00:00.000Z'))).toBe('17. Okt bis 16. Nov · noch 31 Tage')
    expect(mailKacheln(eingabe({ zaehler: { heute: 0, imZeitraum: 2_400 } }), JETZT, GRENZE_FREE)[1].zustand).toEqual({ wort: 'Achtung', art: 'tun' })
  })

  it('Warteschlange: offen, aufgeteilt in wichtig und können warten, ältester seit …; Achtung erst über 5 Minuten', () => {
    const schlange = { ...LEERE_SCHLANGE, wichtig: 1, kannWarten: 13, aeltesteWichtigeAm: minuten(7) }
    const k = mailKacheln(eingabe({ schlange }), JETZT, GRENZE_FREE)[2]
    expect(k).toMatchObject({ wert: '14', von: 'offen', zustand: { wort: 'Achtung', art: 'tun' }, zeilen: ['1 wichtig · 13 können warten', 'Älteste wichtige Mail seit 7 Min.'] })
    const frisch = mailKacheln(eingabe({ schlange: { ...schlange, aeltesteWichtigeAm: minuten(5) } }), JETZT, GRENZE_FREE)[2]
    expect(frisch.zustand).toEqual({ wort: 'Läuft', art: 'laeuft' })
  })

  it('Gescheitert · 24 h: versucht es von selbst und aufgegeben, Gründe kurz; „n braucht dich“ nur bei aufgegeben', () => {
    const probleme = [problem({ id: 'a' }), problem({ id: 'b', art: 'beitrag', vorrang: 2, status: 'gescheitert', fehlerCode: 'validation_error' })]
    const k = mailKacheln(eingabe({ probleme }), JETZT, GRENZE_FREE)[3]
    expect(k).toMatchObject({ wert: '2', von: 'Mails', zustand: { wort: '1 braucht dich', art: 'tun' }, zeilen: ['1 versucht es von selbst · 1 aufgegeben', 'Resend überlastet · Adresse gibt es nicht'] })
    expect(mailKacheln(eingabe({ probleme: [problem({ id: 'a' })] }), JETZT, GRENZE_FREE)[3].zustand).toEqual({ wort: 'Gut', art: 'laeuft' })
  })

  it('Zustellung: abgelehnt über 2 % → Achtung', () => {
    const k = mailKacheln(eingabe({ arten: [art({ art: 'beitrag', vorrang: 2, gesendet: 100, zugestellt: 97, abgelehnt: 3 })] }), JETZT, GRENZE_FREE)[4]
    expect(k.zustand).toEqual({ wort: 'Achtung', art: 'tun' })
  })
})

describe('Warnungen (N18-Ergänzung)', () => {
  const ohne = { gesendet: 0, abgelehnt: 0, spam: 0 }

  it('eine wichtige Mail wartet über 5 Minuten — 5 Minuten genau noch nicht', () => {
    expect(mailWarnLage({ aeltesteWichtigeAm: minuten(6), faelligSeit: null }, ohne, JETZT)['mail:wartet']).toEqual({ gilt: true, wert: '6 Minuten' })
    expect(mailWarnLage({ aeltesteWichtigeAm: minuten(5), faelligSeit: null }, ohne, JETZT)['mail:wartet'].gilt).toBe(false)
  })

  it('die Warteschlange hängt über 15 Minuten — 15 genau noch nicht', () => {
    expect(mailWarnLage({ aeltesteWichtigeAm: null, faelligSeit: minuten(16) }, ohne, JETZT)['mail:haengt'].gilt).toBe(true)
    expect(mailWarnLage({ aeltesteWichtigeAm: null, faelligSeit: minuten(15) }, ohne, JETZT)['mail:haengt'].gilt).toBe(false)
  })

  it('abgelehnt über 2 % und Spam über 0,05 % — erst ab 50 Mails', () => {
    const lage = mailWarnLage({ aeltesteWichtigeAm: null, faelligSeit: null }, { gesendet: 2_000, abgelehnt: 41, spam: 2 }, JETZT)
    expect(lage['mail:abgelehnt']).toEqual({ gilt: true, wert: '2,1 %' })
    expect(lage['mail:spam']).toEqual({ gilt: true, wert: '0,10 %' })
    const genau = mailWarnLage({ aeltesteWichtigeAm: null, faelligSeit: null }, { gesendet: 2_000, abgelehnt: 40, spam: 1 }, JETZT)
    expect([genau['mail:abgelehnt'].gilt, genau['mail:spam'].gilt]).toEqual([false, false])
    const wenig = mailWarnLage({ aeltesteWichtigeAm: null, faelligSeit: null }, { gesendet: 49, abgelehnt: 49, spam: 49 }, JETZT)
    expect([wenig['mail:abgelehnt'].gilt, wenig['mail:spam'].gilt]).toEqual([false, false])
  })

  it('der Schritt: warnen höchstens einmal am Tag, still auf 0, wenn es nicht mehr gilt', () => {
    expect(mailWarnSchritt(true, null, JETZT)).toEqual({ tun: 'warnen', stufe: 1 })
    expect(mailWarnSchritt(true, { stufe: 1, gemeldetAm: minuten(30) }, JETZT)).toEqual({ tun: 'nichts' })
    expect(mailWarnSchritt(true, { stufe: 1, gemeldetAm: new Date('2026-10-23T22:00:00.000Z') }, JETZT)).toEqual({ tun: 'warnen', stufe: 1 })
    expect(mailWarnSchritt(true, { stufe: 0, gemeldetAm: minuten(30) }, JETZT)).toEqual({ tun: 'warnen', stufe: 1 })
    expect(mailWarnSchritt(false, { stufe: 1, gemeldetAm: minuten(30) }, JETZT)).toEqual({ tun: 'still' })
    expect(mailWarnSchritt(false, null, JETZT)).toEqual({ tun: 'nichts' })
  })

  it('das Lebenszeichen: eine wichtige Mail über 15 Minuten — Gegenprobe 15 genau und keine Mail', () => {
    expect(wichtigeMailHaengt(minuten(16), JETZT, 15)).toBe(true)
    expect(wichtigeMailHaengt(minuten(15), JETZT, 15)).toBe(false)
    expect(wichtigeMailHaengt(null, JETZT, 15)).toBe(false)
  })

  it('jede Mail-Warnung hat Hinweis, Warn-Mail und Eintrag in der Warnkarte des Überblicks', () => {
    for (const a of MAIL_WARN_ARTEN) {
      expect(warnHinweis(a, 1).kurz.length, a).toBeGreaterThan(3)
      const mail = betriebMail({ art: 'mails', warnung: a, wert: '7 Minuten' })
      expect(mail.betreff, a).toMatch(/^Betrieb: /)
      expect(mail.hilft, a).toBeTruthy()
      expect(`${mail.titel} ${mail.absaetze.join(' ')}`, a).not.toMatch(/Bounce|Beschwerde/)
    }
    const eintraege = warnEintraege([{ art: 'mail:wartet', stufe: 1, gemeldetAm: minuten(1) }], [], [], [], JETZT, true)
    expect(eintraege).toEqual([{ art: 'mail:wartet', titel: 'Eine wichtige Mail wartet länger als 5 Minuten', saetze: ['Die Einzelheiten stehen unter E-Mails.', 'Die Warn-Mail ist um 09:41 hinausgegangen.'] }])
  })

  it('die Betriebsleiste: eine Bestellmail ab 5 Minuten zuerst, Link zu E-Mails; darunter die gespeicherte Warnung', () => {
    const laeufe = new Map()
    expect(betriebHinweis([], laeufe, JETZT, { erstelltAm: minuten(7), zuBestellung: true })).toMatchObject({ text: 'Eine Bestellmail wartet seit 7 Min.', href: '/admin/betrieb?reiter=mails' })
    expect(betriebHinweis([{ art: 'mail:wartet', stufe: 1 }], laeufe, JETZT, { erstelltAm: minuten(7), zuBestellung: false })).toMatchObject({ anzahl: 1, text: 'Eine wichtige Mail wartet seit 7 Min.' })
    expect(betriebHinweis([{ art: 'mail:spam', stufe: 1 }], laeufe, JETZT, { erstelltAm: minuten(4), zuBestellung: true })).toMatchObject({ anzahl: 1, kurz: 'Spam gemeldet', href: '/admin/betrieb?reiter=mails' })
  })
})

describe('Warnkarte der Ansicht E-Mails', () => {
  const schlange: WarteschlangeDaten = {
    ...LEERE_SCHLANGE,
    wichtig: 1,
    kannWarten: 13,
    aeltesteWichtigeAm: minuten(7),
    aeltesteWichtige: { id: 'auftrag_1', art: 'bestellung-bestaetigung', status: 'offen', versuche: 2, fehlerCode: 'rate_limit_exceeded', naechsterVersuchAm: new Date('2026-10-24T07:43:00.000Z'), zuBestellung: true },
  }
  const arten = [art({ art: 'abholbereit', gesendet: 1_102, zugestellt: 1_095, abgelehnt: 7 })]
  const lage = mailWarnLage(schlange, { gesendet: 1_102, abgelehnt: 7, spam: 0 }, JETZT)

  it('wie im Mockup: Titel, Grund mit Code, wann es von selbst weitergeht; „Jetzt schicken“ für genau diese Mail', () => {
    const karte = mailWarnkarte({ lage, schlange, zaehler: { heute: 62, imZeitraum: 1_284 }, arten }, [{ art: 'mail:wartet', stufe: 1, gemeldetAm: minuten(1) }], JETZT, GRENZE_FREE)
    expect(karte.eintraege).toEqual([
      {
        art: 'mail:wartet',
        titel: 'Eine Bestellmail wartet seit 7 Minuten',
        saetze: ['Bestellbestätigung · 2 Versuche.', 'Resend war kurz überlastet (Code 429).', `${MARKE} versucht es um 09:43 von selbst – du musst nichts tun. Beiträge warten so lange.`],
      },
    ])
    expect(karte.gruen).toBe('Sonst im grünen Bereich · Zustellung 99,4 % · Kontingent 42 % · Warn-Mail ging um 09:41 an dich')
    expect(karte.jetztSchicken).toBe('auftrag_1')
  })

  it('Nr. 170: kein „Jetzt schicken“ bei einem Auftrag „in Arbeit“ — Gegenprobe: derselbe Auftrag offen bekommt den Knopf', () => {
    const inArbeit = { ...schlange, aeltesteWichtige: { ...schlange.aeltesteWichtige!, status: 'in_arbeit' } }
    const karte = mailWarnkarte({ lage, schlange: inArbeit, zaehler: { heute: 1, imZeitraum: 1 }, arten }, [], JETZT, GRENZE_FREE)
    expect(karte.jetztSchicken).toBeNull()
    // Die Warnung selbst bleibt stehen — nur der Knopf fehlt.
    expect(karte.eintraege.map((e) => e.art)).toEqual(['mail:wartet'])
    expect(mailWarnkarte({ lage, schlange, zaehler: { heute: 1, imZeitraum: 1 }, arten }, [], JETZT, GRENZE_FREE).jetztSchicken).toBe('auftrag_1')
  })

  it('Gegenprobe: bei 422 kein „Jetzt schicken“; ohne Warnung leer und „Alles im grünen Bereich“', () => {
    const s422 = { ...schlange, aeltesteWichtige: { ...schlange.aeltesteWichtige!, fehlerCode: 'validation_error' } }
    expect(mailWarnkarte({ lage, schlange: s422, zaehler: { heute: 1, imZeitraum: 1 }, arten }, [], JETZT, GRENZE_FREE).jetztSchicken).toBeNull()
    const ruhig = mailWarnLage(LEERE_SCHLANGE, { gesendet: 0, abgelehnt: 0, spam: 0 }, JETZT)
    const karte = mailWarnkarte({ lage: ruhig, schlange: LEERE_SCHLANGE, zaehler: { heute: 1, imZeitraum: 1 }, arten: [] }, [], JETZT, GRENZE_FREE)
    expect(karte.eintraege).toEqual([])
    expect(karte.gruen).toBe('Alles im grünen Bereich · Kontingent 0 %')
  })

  it('Kontingent ab 80 % im Abrechnungszeitraum steht in der Warnkarte', () => {
    const karte = mailWarnkarte({ lage: mailWarnLage(LEERE_SCHLANGE, { gesendet: 0, abgelehnt: 0, spam: 0 }, JETZT), schlange: LEERE_SCHLANGE, zaehler: { heute: 1, imZeitraum: 2_500 }, arten: [] }, [], JETZT, GRENZE_FREE)
    expect(karte.eintraege.map((e) => e.titel)).toEqual(['Kontingent bei 83 %'])
  })
})

describe('Braucht dich', () => {
  it('aufgegebene zuerst; Grund in Worten mit Code, Versuche, nächster Versuch, „Was tun“; Knöpfe nur, wo erlaubt', () => {
    const { zeilen, gruppen } = brauchtDich(
      [
        problem({ id: 'a' }),
        problem({ id: 'b', art: 'beitrag', vorrang: 2, status: 'gescheitert', versuche: 1, fehlerCode: 'validation_error', naechsterVersuchAm: new Date('2026-10-23T16:20:00.000Z') }),
        problem({ id: 'c', art: 'anmeldecode', vorrang: 0, status: 'gescheitert', fehlerCode: 'ausnahme', naechsterVersuchAm: minuten(60) }),
      ],
      JETZT
    )
    expect(zeilen.map((z) => z.id)).toEqual(['c', 'b', 'a'])
    expect(zeilen[1]).toMatchObject({
      name: 'Beitrag an Abos',
      weg: 'Kann warten',
      stand: { wort: 'aufgegeben', art: 'tun' },
      grund: 'Diese Adresse gibt es nicht · Code 422',
      zeile: 'aufgegeben · gestern 18:20',
      tun: 'Nochmal schicken hilft hier nicht – die Adresse ist falsch geschrieben.',
      jetztSchicken: false,
      verwerfen: true,
    })
    expect(zeilen[2]).toMatchObject({ stand: { wort: 'versucht es von selbst', art: 'laeuft' }, zeile: '2 Versuche · nächster von selbst um 09:43', jetztSchicken: true })
    // Sofort-Mails gehen nicht über die Warteschlange: kein „Jetzt schicken“.
    expect(zeilen[0]).toMatchObject({ weg: 'Sofort', jetztSchicken: false, verwerfen: true })
    expect(gruppen).toEqual([])
  })

  it('hängt: fällig seit über 15 Minuten; in Arbeit ohne Knöpfe', () => {
    const { zeilen } = brauchtDich([problem({ id: 'h', versuche: 0, fehlerCode: null, naechsterVersuchAm: minuten(20) }), problem({ id: 'i', status: 'in_arbeit', belegtBis: minuten(18) })], JETZT)
    expect(zeilen.map((z) => [z.id, z.stand.wort, z.jetztSchicken, z.verwerfen])).toEqual([
      ['i', 'hängt', false, false],
      ['h', 'hängt', true, true],
    ])
  })

  it('alle einer Art: Knöpfe erst ab zwei Mails derselben Art', () => {
    const { gruppen } = brauchtDich([problem({ id: 'a' }), problem({ id: 'b' })], JETZT)
    expect(gruppen).toEqual([{ art: 'bestellung-bestaetigung', name: 'Bestellbestätigung', jetztSchicken: 2, verwerfen: 2, nochmal: 0 }])
  })

  it('Nr. 167: „Alle nochmal schicken“ zählt nur gescheiterte wichtige Mails einer erlaubten Art — Gegenprobe Beitrag und Anmeldecode', () => {
    const gescheitert = (id: string, art: string, vorrang = 1) => problem({ id, art, vorrang, status: 'gescheitert', fehlerCode: 'validation_error', naechsterVersuchAm: minuten(30) })
    const { gruppen } = brauchtDich(
      [gescheitert('a', 'abholbereit'), gescheitert('b', 'abholbereit'), gescheitert('c', 'beitrag', 2), gescheitert('d', 'beitrag', 2), gescheitert('e', 'anmeldecode', 0), gescheitert('f', 'anmeldecode', 0)],
      JETZT
    )
    expect(gruppen.find((g) => g.art === 'abholbereit')?.nochmal).toBe(2)
    expect(gruppen.find((g) => g.art === 'beitrag')?.nochmal).toBe(0)
    expect(gruppen.find((g) => g.art === 'anmeldecode')?.nochmal).toBe(0)
  })
})

describe('Je Art', () => {
  const ARTEN = [
    art({ art: 'anmeldecode', vorrang: 0, gesendet: 212, zugestellt: 210 }),
    art({ art: 'bestellung-bestaetigung', gesendet: 148, zugestellt: 146, gescheitert: 1, abgelehnt: 1, wartezeitMs: 12_000 }),
    art({ art: 'abholbereit', gesendet: 131, zugestellt: 130, abgelehnt: 1, wartezeitMs: 8_000 }),
    art({ art: 'beitrag', vorrang: 2, gesendet: 402, zugestellt: 396, gescheitert: 1, abgelehnt: 5, wartezeitMs: 120_000 }),
    art({ art: 'bestellung-bezahlt-hof', gesendet: 96, zugestellt: 96, wartezeitMs: 9_000 }),
    art({ art: 'rundschreiben', vorrang: 2, gesendet: 24, zugestellt: 24 }),
    art({ art: 'postfach', gesendet: 11, zugestellt: 11 }),
  ]

  it('auffällige zuerst, höchstens 5, darunter „Alle n Arten zeigen“', () => {
    const j = jeArt(ARTEN, false)
    expect(j.gezeigt.map((z) => z.name)).toEqual(['Beitrag an Abos', 'Bestellbestätigung', 'Abholbereit', 'Anmeldecode', 'Bezahlt (an den Hof)'])
    expect(j.ausgeblendet).toBe(2)
    expect(j.gezeigt[0]).toMatchObject({ weg: 'Kann warten', wartezeit: '2 min', auffaellig: true })
    expect(j.gezeigt[3]).toMatchObject({ weg: 'Sofort', wartezeit: '–', kurz: 'Sofort · 210 zugestellt' })
    expect(j.gezeigt[4].kurz).toBe('Wichtig · alles zugestellt')
    expect(j.summe).toBe(`${formatZahl(1_024)} gesendet · 2 gescheitert · 7 abgelehnt`)
    expect(MAIL_TEXT.alleArten(j.zeilen.length)).toBe('Alle 7 Arten zeigen')
  })

  it('Gegenprobe: mit ?alle=1 alle Arten, nichts ausgeblendet', () => {
    const j = jeArt(ARTEN, true)
    expect(j.gezeigt).toHaveLength(7)
    expect(j.ausgeblendet).toBe(0)
  })
})

describe('Verlauf 30 Tage', () => {
  it('Schnitt, Spitzen und Tage mit gescheiterten Mails aus denselben Zahlen', () => {
    const roh = [
      ...Array.from({ length: 30 }, (_, i) => ({ tag: new Date(Date.UTC(2026, 8, 25 + i)).toISOString().slice(0, 10), gesendet: 40, gescheitert: 0 })),
    ].map((t) => (t.tag === '2026-10-09' || t.tag === '2026-10-23' ? { ...t, gesendet: 200, gescheitert: 1 } : t))
    const v = mailVerlauf(roh, JETZT)
    expect(v.tage).toHaveLength(30)
    expect(v.tage[0].tag).toBe('2026-09-25')
    expect(v.satz).toBe('Im Schnitt 51 Mails am Tag. Spitzen am 9. und 23. Okt. An 2 Tagen einzelne gescheiterte Mails.')
  })

  it('ohne Mails ein Satz statt Zahlen', () => {
    expect(mailVerlauf([], JETZT).satz).toBe('In den letzten 30 Tagen ging keine Mail hinaus. Keine gescheiterte Mail.')
  })
})

describe('Warteschlange (Karte)', () => {
  it('je Weg Zahl und Alter, letzter Durchlauf', () => {
    const k = schlangeKarte({ ...LEERE_SCHLANGE, wichtig: 1, kannWarten: 13, aeltesteWichtigeAm: minuten(7) }, { gestartetAm: JETZT, dauerMs: 4_200, mails: 31 }, JETZT)
    expect(k.zeilen).toEqual([
      { weg: 'Wichtig · Bestellungen, Höfe', wert: '1 · seit 7 Min.' },
      { weg: 'Kann warten · Beiträge, Rundschreiben', wert: '13 · nach den wichtigen' },
    ])
    expect(k.durchlauf).toBe('Letzter Durchlauf 09:42 · 31 Mails in 4 s')
    expect(k.kurz).toBe('1 wichtig seit 7 Min. · 13 können warten')
  })
})

describe('Suche: Ergebnis', () => {
  const BESTELLUNG: SuchBestellung = {
    id: 'bestellung_1',
    orderNumber: 'HM-2611-A4F2',
    hofName: 'Testhof A',
    pickupDate: new Date('2026-10-25T10:00:00.000Z'),
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    status: 'PAID',
    customerEmail: 'kundin.erfunden@example.at',
  }
  const mail = (teil: Partial<SuchMail> & Pick<SuchMail, 'id' | 'art'>): SuchMail => ({
    vorrang: 1,
    status: 'gesendet',
    bestellungId: 'bestellung_1',
    erstelltAm: new Date('2026-10-24T07:12:00.000Z'),
    gesendetAm: new Date('2026-10-24T07:12:00.000Z'),
    zugestelltAm: new Date('2026-10-24T07:12:30.000Z'),
    bounceAm: null,
    beschwerdeAm: null,
    ...teil,
  })

  it('Bestellnummer: Kopf, Adresse nur gekürzt aus der Bestellung, alle Mails, erwartete Mail, Spam-Hinweis', () => {
    const e = suchErgebnis({ bestellungen: [BESTELLUNG], mails: [mail({ id: 'm1', art: 'bestellung-bestaetigung' }), mail({ id: 'm2', art: 'bestellung-bezahlt-hof' })], adresse: null }, JETZT)
    expect(e).toEqual({
      art: 'treffer',
      zugestellt: true,
      gruppen: [
        {
          kopf: 'HM-2611-A4F2 · Testhof A · Abholung So, 25. Okt',
          unterzeile: 'Online bezahlt · Zum Packen',
          an: 'an k•••@example.at · aus der Bestellung',
          leer: null,
          nummer: 'HM-2611-A4F2',
          zeilen: [
            { id: 'm1', name: 'Bestellbestätigung', weg: 'Wichtig', stand: 'gesendet 09:12', marke: { text: 'zugestellt', art: 'laeuft' } },
            { id: 'm2', name: 'Bezahlt (an den Hof)', weg: 'Wichtig', stand: 'gesendet 09:12', marke: { text: 'zugestellt', art: 'laeuft' } },
            { name: 'Abholbereit', weg: 'Wichtig', stand: 'noch nicht fällig · kommt, wenn der Hof packt', marke: null },
          ],
        },
      ],
    })
    expect(JSON.stringify(e)).not.toContain('kundin.erfunden')
  })

  it('Adresse: Gruppen nach Bestellung, dann „Ohne Bestellung“ (Anmeldecode); Abgelehnt und Spam gemeldet als Marke', () => {
    const e = suchErgebnis(
      {
        bestellungen: [BESTELLUNG],
        mails: [
          mail({ id: 'm1', art: 'bestellung-bestaetigung', bounceAm: JETZT }),
          mail({ id: 'm3', art: 'anmeldecode', vorrang: 0, bestellungId: null, zugestelltAm: null, beschwerdeAm: JETZT }),
        ],
        adresse: 'kundin.erfunden@example.at',
      },
      JETZT
    )
    if (e.art !== 'treffer') throw new Error('Treffer erwartet')
    expect(e.gruppen.map((g) => g.kopf)).toEqual(['HM-2611-A4F2 · Testhof A · Abholung So, 25. Okt', 'Ohne Bestellung'])
    expect(e.gruppen[0].zeilen[0].marke).toEqual({ text: 'Abgelehnt', art: 'tun' })
    expect(e.gruppen[1]).toMatchObject({ an: 'an k•••@example.at', zeilen: [{ name: 'Anmeldecode', weg: 'Sofort', marke: { text: 'Spam gemeldet', art: 'tun' } }] })
    expect(JSON.stringify(e)).not.toContain('kundin.erfunden')
  })

  it('kein Treffer: derselbe Satz, gleich was gesucht wurde', () => {
    expect(suchErgebnis({ bestellungen: [], mails: [], adresse: 'gibt-es@example.at' }, JETZT)).toEqual({ art: 'hinweis', satz: MAIL_TEXT.keinTreffer })
    expect(suchErgebnis({ bestellungen: [], mails: [], adresse: null }, JETZT)).toEqual({ art: 'hinweis', satz: MAIL_TEXT.keinTreffer })
    expect(MAIL_TEXT.keinTreffer).toBe('Keine Bestellung und kein Hof mit dieser Angabe in den letzten 90 Tagen.')
  })

  it('erwartete Mails nur, solange sie fehlen und die Bestellung offen ist', () => {
    expect(erwarteteMails({ status: 'IN_PREPARATION' }, ['abholbereit'])).toEqual([])
    expect(erwarteteMails({ status: 'READY' }, [])).toEqual([])
    expect(erwarteteMails({ status: 'PENDING_CONFIRMATION' }, []).map((z) => z.name)).toEqual(['Bestellbestätigung'])
  })
})

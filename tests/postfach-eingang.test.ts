/**
 * Der Eingang des Admin-Postfachs (Register N12-Änderung, N14; Nr. 95) — rein,
 * ohne Mock: eine Liste aus Antworten, Meldungen und Aufgaben, neueste zuerst,
 * mit den Filtern Offen · Antwort · Meldung · Aufgabe · Alle; „Offen" zählt
 * ungelesene Antworten, Meldungen NEU/GEPRUEFT und jede Aufgabe. Dazu die
 * Prüfliste eines wartenden Hofs, die Kennzahlen, „Antwort möglich" nach Art
 * und die Adresse (Reiter, Filter, Auswahl) als Fremddaten.
 */
import { describe, it, expect } from 'vitest'
import {
  alteReiterAdresse,
  antwortMoeglichStandard,
  antwortenText,
  eingangEintraege,
  geldSatz,
  hofAufgabeZeile,
  hofPruefliste,
  offenSatz,
  postfachKennzahlen,
  postfachUnterreiter,
  stripeZahlungAdresse,
  type EingangRoh,
  type ErstattungAufgabeRoh,
  type HofAufgabeRoh,
} from '@/lib/postfach'
import { adminPostfachReiterAus, eingangAuswahlAus, eingangFilterAus, fadenKennungAus } from '@/schemas/postfach'

const um = (stunde: number) => new Date(`2026-10-15T${String(stunde).padStart(2, '0')}:00:00Z`)

const HOF: HofAufgabeRoh = {
  id: 'hofwartet1',
  name: 'Hof Test',
  createdAt: um(6),
  hofseite: { erledigt: 9, gesamt: 11 },
  stripeBereit: true,
  sepaErteilt: true,
  futter: false,
  lfbis: false,
  titelbild: true,
  email: 'bestaetigt',
  platz: 8,
}

const ERSTATTUNG: ErstattungAufgabeRoh = {
  id: 'bestellung1',
  bestellnummer: 'HM-2610-TEST',
  hofName: 'Hof Test',
  seit: um(9),
  bezahltCents: 2340,
  schonErstattetCents: 0,
  zahlungKennung: 'pi_test123',
}

const ROH: EingangRoh = {
  antworten: [
    { id: 'faden-gelesen', hofName: 'Hof Alt', titel: 'Abrechnung', letzteAntwort: { text: 'Danke', createdAt: um(10) }, ungelesen: false },
    { id: 'faden-neu', hofName: 'Hof Neu', titel: null, letzteAntwort: { text: 'Eine Frage', createdAt: um(8) }, ungelesen: true },
  ],
  meldungen: [
    { id: 'meldung-neu', art: 'FEHLER', status: 'NEU', createdAt: um(11), ersteZeile: 'Upload hängt', wer: 'Hof Test', zeile: 'Neu · Nr. meldungn' },
    { id: 'meldung-geprueft', art: 'WUNSCH', status: 'GEPRUEFT', createdAt: um(5), ersteZeile: 'Produkte kopieren', wer: 'Kundin (ohne Konto)', zeile: 'Geprüft' },
    { id: 'meldung-erledigt', art: 'FRAGE', status: 'ERLEDIGT', createdAt: um(7), ersteZeile: 'Abholzeit ändern', wer: 'Anonym', zeile: 'Erledigt' },
    { id: 'meldung-ki', art: 'WUNSCH', status: 'VERMUTLICH_WUNSCH', createdAt: um(4), ersteZeile: 'Dunkles Logo', wer: 'Hof Test', zeile: '' },
  ],
  hoefe: [HOF],
  erstattungen: [ERSTATTUNG],
}

const kennungen = (filter: Parameters<typeof eingangEintraege>[1]) => eingangEintraege(ROH, filter).map((e) => `${e.auswahl.art}-${e.auswahl.id}`)

describe('eingangEintraege', () => {
  it('„Offen" mischt die drei Arten, neueste zuerst: ungelesene Antwort, Meldung NEU/GEPRUEFT, jede Aufgabe', () => {
    expect(kennungen('offen')).toEqual(['meldung-meldung-neu', 'erstattung-bestellung1', 'antwort-faden-neu', 'hof-hofwartet1', 'meldung-meldung-geprueft'])
  })

  it('gelesene Antworten, erledigte und von der KI vorgeschlagene Meldungen sind nicht offen (Freigabe: NEU/GEPRUEFT)', () => {
    expect(kennungen('offen')).not.toContain('antwort-faden-gelesen')
    expect(kennungen('offen')).not.toContain('meldung-meldung-erledigt')
    expect(kennungen('offen')).not.toContain('meldung-meldung-ki')
  })

  it('die Filter Antwort, Meldung, Aufgabe zeigen nur ihre Art — gelesen und erledigt eingeschlossen', () => {
    expect(kennungen('antwort')).toEqual(['antwort-faden-gelesen', 'antwort-faden-neu'])
    expect(kennungen('meldung')).toEqual(['meldung-meldung-neu', 'meldung-meldung-erledigt', 'meldung-meldung-geprueft', 'meldung-meldung-ki'])
    expect(kennungen('aufgabe')).toEqual(['erstattung-bestellung1', 'hof-hofwartet1'])
  })

  it('„Alle" zeigt jeden Eintrag genau einmal', () => {
    expect(kennungen('alle')).toHaveLength(2 + 4 + 1 + 1)
    expect(new Set(kennungen('alle')).size).toBe(8)
  })

  it('gleiche Zeit: feste Reihenfolge über die Kennung', () => {
    const zweiGleich: EingangRoh = { ...ROH, antworten: [], meldungen: [], hoefe: [{ ...HOF, id: 'b', createdAt: um(6) }, { ...HOF, id: 'a', createdAt: um(6) }], erstattungen: [] }
    expect(eingangEintraege(zweiGleich, 'alle').map((e) => e.auswahl.id)).toEqual(['a', 'b'])
  })

  it('Zeilen tragen Marke, Wer und Titel wie im Mockup', () => {
    const [meldung, erstattung, antwort, hof] = eingangEintraege(ROH, 'offen')
    expect(meldung).toMatchObject({ marke: 'Fehler', markeArt: 'tun', wer: 'Hof Test', titel: 'Upload hängt' })
    expect(erstattung).toMatchObject({ marke: 'Aufgabe', markeArt: 'tun', wer: 'Bestellung HM-2610-TEST', titel: 'Erstattung offen' })
    expect(antwort).toMatchObject({ marke: 'Antwort', titel: 'Re: Nachricht vom Team', zeile: 'Eine Frage' })
    expect(hof).toMatchObject({ titel: 'Wartet auf Freischaltung', zeile: 'Hofseite 9 von 11 · Stripe und SEPA da – bekäme Gründungsplatz Nr. 8' })
  })
})

describe('Aufgabe Hof', () => {
  it('ohne Stripe kein Platz-Versprechen, sondern der Hinweis; ohne freien Platz keine Zeile', () => {
    expect(hofAufgabeZeile({ ...HOF, stripeBereit: false })).toBe('Hofseite 9 von 11 · Stripe fehlt – Gründungsplatz erst mit Freischaltung')
    expect(hofAufgabeZeile({ ...HOF, sepaErteilt: false, platz: null })).toBe('Hofseite 9 von 11 · Stripe da, SEPA fehlt')
  })

  it('die Prüfliste nennt Hofseite, Stripe, SEPA, Titelbild und E-Mail; LFBIS nur bei Futtermitteln', () => {
    expect(hofPruefliste(HOF).map((p) => p.schluessel)).toEqual(['hofseite', 'stripe', 'sepa', 'titelbild', 'email'])
    expect(hofPruefliste({ ...HOF, futter: true }).map((p) => p.schluessel)).toContain('lfbis')
    expect(hofPruefliste({ ...HOF, futter: true, lfbis: false }).find((p) => p.schluessel === 'lfbis')).toMatchObject({ erledigt: false })
  })

  it('erledigt nur, was wirklich da ist — die Hofseite erst ganz, die E-Mail auch bei Konten vor der Pflicht', () => {
    const liste = hofPruefliste({ ...HOF, stripeBereit: false, email: 'offen' })
    expect(liste.find((p) => p.schluessel === 'hofseite')).toMatchObject({ erledigt: false, text: 'Hofseite 9 von 11 ausgefüllt' })
    expect(liste.find((p) => p.schluessel === 'stripe')).toMatchObject({ erledigt: false })
    expect(liste.find((p) => p.schluessel === 'email')).toMatchObject({ erledigt: false })
    expect(hofPruefliste({ ...HOF, email: 'vor-pflicht' }).find((p) => p.schluessel === 'email')).toMatchObject({ erledigt: true })
    expect(hofPruefliste({ ...HOF, hofseite: { erledigt: 11, gesamt: 11 } })[0]).toMatchObject({ erledigt: true })
  })
})

describe('Aufgabe Erstattung', () => {
  it('der Knopf führt zur Zahlung im Stripe-Dashboard des laufenden Modus — ohne Kennung oder Schlüssel keiner', () => {
    expect(stripeZahlungAdresse('pi_test123', 'test')).toBe('https://dashboard.stripe.com/test/payments/pi_test123')
    expect(stripeZahlungAdresse('pi_test123', 'live')).toBe('https://dashboard.stripe.com/payments/pi_test123')
    expect(stripeZahlungAdresse('pi_test123', 'fehlt')).toBeNull()
    expect(stripeZahlungAdresse(null, 'live')).toBeNull()
    expect(stripeZahlungAdresse('pi_x/../../evil', 'live')).toBeNull()
  })
})

describe('Kennzahlen und Zähler', () => {
  const zahlen = { antworten: 2, meldungen: 1, hoefe: 1, erstattungen: 1 }

  it('„Offen im Eingang" zählt alles, was wartet, und sagt es in einer Zeile', () => {
    const [offen, geld, rundschreiben] = postfachKennzahlen({ zahlen, erstattungen: [ERSTATTUNG], rundschreibenImMonat: 3 })
    expect(offen).toMatchObject({ wert: '5', satz: '2 Antworten · 1 Meldung · 2 Aufgaben', ton: 'tun' })
    expect(geld).toMatchObject({ wert: '1', satz: 'Erstattung offen, € 23,40', ton: 'tun' })
    expect(rundschreiben).toMatchObject({ wert: '3', ton: 'neutral' })
  })

  it('nichts offen: kein Ton; mehrere Erstattungen werden nicht summiert', () => {
    const leer = { antworten: 0, meldungen: 0, hoefe: 0, erstattungen: 0 }
    expect(postfachKennzahlen({ zahlen: leer, erstattungen: [], rundschreibenImMonat: 0 })[0]).toMatchObject({ wert: '0', satz: 'nichts offen', ton: 'neutral' })
    expect(offenSatz(leer)).toBe('nichts offen')
    expect(geldSatz([ERSTATTUNG, { ...ERSTATTUNG, id: 'zwei' }])).toBe('2 Erstattungen offen')
    expect(geldSatz([{ ...ERSTATTUNG, bezahltCents: null }])).toBe('1 Erstattung offen')
  })

  it('der Unterreiter „Eingang" trägt die Zahl „Offen", die anderen keine', () => {
    expect(postfachUnterreiter(5).map((r) => [r.id, r.zahl, r.href])).toEqual([
      ['eingang', '5', '/admin/postfach'],
      ['meldungen', undefined, '/admin/postfach?reiter=meldungen'],
      ['rundschreiben', undefined, '/admin/postfach?reiter=rundschreiben'],
      ['zustellung', undefined, '/admin/postfach?reiter=zustellung'],
    ])
    expect(postfachUnterreiter(null)[0]?.zahl).toBeUndefined()
  })
})

describe('Antwort möglich (N14)', () => {
  it('Standard beim Verfassen: Wichtig an, Info aus', () => {
    expect(antwortMoeglichStandard('WICHTIG')).toBe(true)
    expect(antwortMoeglichStandard('INFO')).toBe(false)
  })

  it('die Zeile unter einem gesendeten Rundschreiben', () => {
    expect(antwortenText(2, true)).toBe('2 Antworten')
    expect(antwortenText(1, true)).toBe('1 Antwort')
    expect(antwortenText(0, true)).toBe('keine Antwort')
    expect(antwortenText(0, false)).toBe('keine Antwort möglich')
  })
})

describe('Adresse als Fremddaten', () => {
  it('Reiter: unbekannt oder leer heißt Eingang, doppelt zählt der erste', () => {
    expect(adminPostfachReiterAus('zustellung')).toBe('zustellung')
    expect(adminPostfachReiterAus(['rundschreiben', 'zustellung'])).toBe('rundschreiben')
    // Seit Nr. 101 ist „Meldungen" wieder ein eigener Reiter (Register N14, Ergänzung).
    expect(adminPostfachReiterAus('meldungen')).toBe('meldungen')
    expect(adminPostfachReiterAus('unterhaltungen')).toBe('eingang')
    expect(adminPostfachReiterAus(undefined)).toBe('eingang')
  })

  it('Filter: unbekannt heißt Offen', () => {
    expect(eingangFilterAus('aufgabe')).toBe('aufgabe')
    expect(eingangFilterAus('FEHLER')).toBe('offen')
    expect(eingangFilterAus(undefined)).toBe('offen')
  })

  it('Auswahl: Art und Kennung aus ?id=, sonst die Meldung aus ?meldung= (Umleitung), Unsinn öffnet nichts', () => {
    expect(eingangAuswahlAus('hof-abc123', undefined)).toEqual({ art: 'hof', id: 'abc123' })
    expect(eingangAuswahlAus('erstattung-xyz', 'm1')).toEqual({ art: 'erstattung', id: 'xyz' })
    expect(eingangAuswahlAus(undefined, 'ab12cd34')).toEqual({ art: 'meldung', id: 'ab12cd34' })
    expect(eingangAuswahlAus('meldung-meldung-seed-5', undefined)).toEqual({ art: 'meldung', id: 'meldung-seed-5' })
    expect(eingangAuswahlAus('fremd-abc', undefined)).toBeNull()
    expect(eingangAuswahlAus('hof-abc;drop', undefined)).toBeNull()
    expect(eingangAuswahlAus(undefined, '../x')).toBeNull()
  })

  it('alte Adresse ?reiter=unterhaltungen&faden=: nur eine Kennung kommt in die Umleitung, Unsinn wird weggelassen', () => {
    expect(fadenKennungAus('cfaden123')).toBe('cfaden123')
    expect(fadenKennungAus(['cfaden123', 'anderer'])).toBe('cfaden123')
    expect(fadenKennungAus('x"><script>')).toBeUndefined()
    expect(fadenKennungAus('../../admin')).toBeUndefined()
    expect(fadenKennungAus(undefined)).toBeUndefined()
    expect(alteReiterAdresse('unterhaltungen', fadenKennungAus('böse/../'))).toBe(alteReiterAdresse('unterhaltungen', undefined))
    expect(alteReiterAdresse('unterhaltungen', fadenKennungAus('cfaden123'))).toContain('id=antwort-cfaden123')
  })
})

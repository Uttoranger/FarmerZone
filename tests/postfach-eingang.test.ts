/**
 * Der Eingang des Admin-Postfachs (Register N12-Änderung, N14; Nr. 95) — rein,
 * ohne Mock: seit Nr. 193 (N32) nur Gespräche — eine Liste aus Antworten und
 * Meldungen, neueste zuerst, mit den Filtern Offen · Antwort · Meldung · Alle
 * (kein „Aufgabe“ mehr, mit Gegenprobe); „Offen" zählt ungelesene Antworten
 * und Meldungen NEU/GEPRUEFT. Dazu der Zähler, „Antwort möglich" nach Art und
 * die Adresse (Reiter, Filter, Auswahl) als Fremddaten.
 */
import { describe, it, expect } from 'vitest'
import {
  alteReiterAdresse,
  antwortMoeglichStandard,
  antwortenText,
  EINGANG_FILTER_IDS,
  EINGANG_FILTER_LABEL,
  EINGANG_LEER,
  eingangEintraege,
  offenImGespraech,
  offenSatz,
  postfachUnterreiter,
  stripeZahlungAdresse,
  type EingangRoh,
} from '@/lib/postfach'
import { AKTE_OEFFNEN, akteHinweisText } from '@/app/admin/postfach/faden-spalte'
import { adminPostfachReiterAus, eingangAuswahlAus, eingangFilterAus, fadenKennungAus } from '@/schemas/postfach'

const um = (stunde: number) => new Date(`2026-10-15T${String(stunde).padStart(2, '0')}:00:00Z`)

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
}

const kennungen = (filter: Parameters<typeof eingangEintraege>[1]) => eingangEintraege(ROH, filter).map((e) => `${e.auswahl.art}-${e.auswahl.id}`)

describe('eingangEintraege', () => {
  it('„Offen" mischt Antworten und Meldungen, neueste zuerst: ungelesene Antwort, Meldung NEU/GEPRUEFT', () => {
    expect(kennungen('offen')).toEqual(['meldung-meldung-neu', 'antwort-faden-neu', 'meldung-meldung-geprueft'])
  })

  it('gelesene Antworten, erledigte und von der KI vorgeschlagene Meldungen sind nicht offen (Freigabe: NEU/GEPRUEFT)', () => {
    expect(kennungen('offen')).not.toContain('antwort-faden-gelesen')
    expect(kennungen('offen')).not.toContain('meldung-meldung-erledigt')
    expect(kennungen('offen')).not.toContain('meldung-meldung-ki')
  })

  it('die Filter Antwort und Meldung zeigen nur ihre Art — gelesen und erledigt eingeschlossen', () => {
    expect(kennungen('antwort')).toEqual(['antwort-faden-gelesen', 'antwort-faden-neu'])
    expect(kennungen('meldung')).toEqual(['meldung-meldung-neu', 'meldung-meldung-erledigt', 'meldung-meldung-geprueft', 'meldung-meldung-ki'])
  })

  it('Postfach ohne „Aufgabe“ (N32, Nr. 193): kein Filter, kein Leerzustand, kein Wort im Eingang — Aufgaben stehen in Heute', () => {
    expect(EINGANG_FILTER_IDS).toEqual(['offen', 'antwort', 'meldung', 'alle'])
    expect(Object.values(EINGANG_FILTER_LABEL)).not.toContain('Aufgabe')
    expect(Object.keys(EINGANG_LEER)).not.toContain('aufgabe')
    expect(eingangEintraege(ROH, 'alle').map((e) => e.marke)).not.toContain('Aufgabe')
    // Gegenprobe: ein alter Link ?art=aufgabe zeigt „Offen“, nie eine Fehlerseite.
    expect(eingangFilterAus('aufgabe')).toBe('offen')
  })

  it('„Alle" zeigt jeden Eintrag genau einmal', () => {
    expect(kennungen('alle')).toHaveLength(2 + 4)
    expect(new Set(kennungen('alle')).size).toBe(6)
  })

  it('gleiche Zeit: feste Reihenfolge über die Kennung', () => {
    const antwort = ROH.antworten[0]
    const zweiGleich: EingangRoh = { antworten: [{ ...antwort, id: 'b' }, { ...antwort, id: 'a' }], meldungen: [] }
    expect(eingangEintraege(zweiGleich, 'alle').map((e) => e.auswahl.id)).toEqual(['a', 'b'])
  })

  it('Zeilen tragen Marke, Wer und Titel wie im Mockup', () => {
    const [meldung, antwort] = eingangEintraege(ROH, 'offen')
    expect(meldung).toMatchObject({ marke: 'Fehler', markeArt: 'tun', wer: 'Hof Test', titel: 'Upload hängt' })
    expect(antwort).toMatchObject({ marke: 'Antwort', titel: 'Re: Nachricht vom Team', zeile: 'Eine Frage' })
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

describe('Zähler', () => {
  const zahlen = { antworten: 2, meldungen: 1, hoefe: 1, erstattungen: 1 }

  it('offen im Postfach sind nur Gespräche (N32): Antworten und Meldungen — Höfe und Erstattungen zählt Heute', () => {
    expect(offenImGespraech(zahlen)).toBe(3)
    // Die Wochenlage nennt weiter alles in einer Zeile (offenSatz).
    expect(offenSatz(zahlen)).toBe('2 Antworten · 1 Meldung · 2 Aufgaben')
    expect(offenSatz({ antworten: 0, meldungen: 0, hoefe: 0, erstattungen: 0 })).toBe('nichts offen')
  })

  it('der Unterreiter „Eingang" trägt die Zahl „Offen", die anderen keine — die Zustellung ist kein Reiter mehr', () => {
    expect(postfachUnterreiter(5).map((r) => [r.id, r.zahl, r.href])).toEqual([
      ['eingang', '5', '/admin/postfach'],
      ['meldungen', undefined, '/admin/postfach?reiter=meldungen'],
      ['rundschreiben', undefined, '/admin/postfach?reiter=rundschreiben'],
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
    // Seit Nr. 193 kein Reiter mehr (die Seite leitet ?reiter=zustellung vorher um, alteReiterAdresse).
    expect(adminPostfachReiterAus('zustellung')).toBe('eingang')
    expect(adminPostfachReiterAus(['rundschreiben', 'zustellung'])).toBe('rundschreiben')
    // Seit Nr. 101 ist „Meldungen" wieder ein eigener Reiter (Register N14, Ergänzung).
    expect(adminPostfachReiterAus('meldungen')).toBe('meldungen')
    expect(adminPostfachReiterAus('unterhaltungen')).toBe('eingang')
    expect(adminPostfachReiterAus(undefined)).toBe('eingang')
  })

  it('Filter: unbekannt heißt Offen', () => {
    expect(eingangFilterAus('meldung')).toBe('meldung')
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

describe('Hinweis aus der Akte im Faden (N32, Nr. 193)', () => {
  it('nennt Hof und Signale in einem Satz — der Link heißt „Akte öffnen“', () => {
    expect(akteHinweisText('Hof Test', ['ohne Abholzeit'])).toBe('Hinweis aus der Akte: Hof Test – ohne Abholzeit.')
    expect(akteHinweisText('Hof Test', ['Stripe fehlt', 'ohne Abholzeit'])).toBe('Hinweis aus der Akte: Hof Test – Stripe fehlt, ohne Abholzeit.')
    expect(AKTE_OEFFNEN).toBe('Akte öffnen')
  })
})

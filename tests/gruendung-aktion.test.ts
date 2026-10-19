/**
 * Aktion „100 Gründungshöfe“ (Register K2, Änderung 19.10.2026, Nr. 116) — die
 * reinen Regeln ohne Mock: Ende einer Zusage, ob die Aktion läuft, kleinste
 * freie Nummer, die festgeschriebene Vergabe, die Sätze in allen Zuständen,
 * „Zusagen festschreiben“ (nie kürzer, auch stillgelegte, ausgenommene ohne
 * Platz) und das Abzeichen. Feste Zeitpunkte als Parameter (Wiener Tage).
 */
import { describe, it, expect } from 'vitest'
import {
  GRUENDUNG_EINSTELLUNG_STANDARD,
  GRUENDUNG_TEXT,
  abzeichenBlattAus,
  aktionLaeuft,
  baueGruendungAnzeige,
  bestimmeGruendungBis,
  bildeGruendungBis,
  festschreibenBrauchtPlaetze,
  festschreibenListe,
  folgenDerAenderung,
  freieNummer,
  freischaltHinweis,
  gruendungsplaetze,
  gruendungsZusageBeiFreigabe,
  istGruendungshof,
  kleinsteFreieNummer,
  seitenZahlen,
  vergebeneGruendungsplaetze,
  voraussichtlicherPlatz,
  zeigtAbzeichen,
  zusageBeiFreischaltung,
  zusageEnde,
  type GruendungEinstellung,
  type GruendungSeiten,
  type HofFuerFolgen,
} from '@/lib/gruendungshof'
import { platzBeiFreischaltung } from '@/lib/admin-hoefe-seite'

const JETZT = new Date('2026-10-19T10:00:00+02:00')
const AKTION: GruendungEinstellung = {
  ...GRUENDUNG_EINSTELLUNG_STANDARD,
  plaetze: 100,
  monate: 24,
  aktionBisTag: '2027-03-31',
  festAm: new Date('2026-10-19T08:00:00Z'),
}
/** Ein Hof der festgeschriebenen Vergabe (so liefern ihn die Lader). */
function fest(id: string, platz: number | null, mehr: Partial<HofFuerFolgen> = {}): HofFuerFolgen {
  return {
    id,
    name: `Testhof ${id}`,
    approvedAt: new Date('2026-09-01T10:00:00Z'),
    createdAt: new Date('2026-08-01T10:00:00Z'),
    archivedAt: null,
    gruendungAusgenommen: false,
    gruendungBis: platz === null ? null : bildeGruendungBis('2029-01-31'),
    gruendungPlatz: platz,
    gruendungFest: true,
    ...mehr,
  }
}

describe('zusageEnde — Beginn = später von Tarifstart und Freischaltung, Ende = Tag vor Beginn + Monate', () => {
  it('am Tarifstart und davor: der letzte Jänner zwei Jahre später', () => {
    expect(zusageEnde('2027-02-01', { monate: 24 })).toBe('2029-01-31')
    expect(zusageEnde('2026-10-19', { monate: 24 })).toBe('2029-01-31')
  })

  it('nach dem Tarifstart: ab der Freischaltung', () => {
    expect(zusageEnde('2027-03-15', { monate: 24 })).toBe('2029-03-14')
    expect(zusageEnde('2027-03-15', { monate: 30 })).toBe('2029-09-14')
  })

  it('Monatsende: fehlt der Tag im Zielmonat, endet die Zusage an dessen letztem Tag — nie früher', () => {
    expect(zusageEnde('2027-03-31', { monate: 24 })).toBe('2029-03-30')
    expect(zusageEnde('2027-08-31', { monate: 6 })).toBe('2028-02-29')
    expect(zusageEnde('2027-08-31', { monate: 18 })).toBe('2029-02-28')
  })

  it('Schaltjahr: ab dem 29. Februar bis zum letzten Februartag zwei Jahre später', () => {
    expect(zusageEnde('2028-02-29', { monate: 24 })).toBe('2030-02-28')
    expect(zusageEnde('2028-02-29', { monate: 48 })).toBe('2032-02-28')
  })
})

describe('aktionLaeuft — festgeschrieben, Stichtag, freie Plätze; die Anzeige spielt keine Rolle', () => {
  it('vor dem Festschreiben nie', () => {
    expect(aktionLaeuft(JETZT, { ...AKTION, festAm: null }, 0)).toBe(false)
  })

  it('am Stichtag noch, ab Mitternacht in Wien nicht mehr; ohne Stichtag immer', () => {
    expect(aktionLaeuft(new Date('2027-03-31T23:30:00+02:00'), AKTION, 5)).toBe(true)
    expect(aktionLaeuft(new Date('2027-04-01T00:10:00+02:00'), AKTION, 5)).toBe(false)
    expect(aktionLaeuft(new Date('2030-01-01T10:00:00+01:00'), { ...AKTION, aktionBisTag: null }, 5)).toBe(true)
  })

  it('alle Plätze vergeben: vorbei; einer frei: läuft', () => {
    expect(aktionLaeuft(JETZT, AKTION, 100)).toBe(false)
    expect(aktionLaeuft(JETZT, AKTION, 99)).toBe(true)
  })

  it('Anzeige aus: die Aktion läuft trotzdem (Vergabe), nur die Sätze verschwinden', () => {
    expect(aktionLaeuft(JETZT, { ...AKTION, anzeige: false }, 5)).toBe(true)
    expect(seitenZahlen({ ...AKTION, anzeige: false }, 5, JETZT)).toMatchObject({ zeigen: false, aktionLaeuft: true })
  })
})

describe('kleinste freie Nummer', () => {
  it('nach dem Ausnehmen bekommt der Nächste die Lücke', () => {
    expect(kleinsteFreieNummer(new Set([1, 2, 4]), 100)).toBe(3)
    expect(kleinsteFreieNummer(new Set(), 100)).toBe(1)
  })

  it('alle vergeben: keine; die so vielte freie Nummer für „voraussichtlich“', () => {
    expect(kleinsteFreieNummer(new Set([1, 2]), 2)).toBeNull()
    expect(freieNummer(new Set([1, 2, 4]), 6, 2)).toBe(5)
    expect(freieNummer(new Set([1, 2, 4]), 4, 2)).toBeNull()
  })
})

describe('festgeschriebene Vergabe — der gespeicherte Platz zählt, nicht die Reihenfolge', () => {
  const hoefe = [fest('a', 1), fest('b', 2, { archivedAt: new Date('2026-10-01T10:00:00Z') }), fest('c', null, { gruendungAusgenommen: true }), fest('d', 50)]

  it('ein stillgelegter Hof hält seinen Platz; ein ausgenommener hat keinen', () => {
    expect([...gruendungsplaetze(hoefe)]).toEqual([
      ['a', 1],
      ['b', 2],
      ['d', 50],
    ])
    expect(vergebeneGruendungsplaetze(hoefe)).toBe(3)
  })

  it('Platz 50 ist ein Gründungshof — nie gegen die alte Zahl 12 geprüft', () => {
    expect(istGruendungshof('d', hoefe)).toBe(true)
    expect(istGruendungshof('c', hoefe)).toBe(false)
  })

  it('voraussichtlich: die so vielte freie Nummer nach den Wartenden vor dir', () => {
    expect(voraussichtlicherPlatz(AKTION, hoefe, 0)).toBe(3)
    expect(voraussichtlicherPlatz(AKTION, hoefe, 2)).toBe(5)
  })

  it('Ausnehmen gibt den Platz frei, niemand rückt auf; Wiederaufnahme bekommt die kleinste freie Nummer', () => {
    const aus = folgenDerAenderung(hoefe[0] as HofFuerFolgen, hoefe, 100, 'ausnehmen')
    expect(aus).toMatchObject({ platzVorher: 1, platzNachher: null, verschoben: [], neu: [], moeglich: true, freiNachher: 98 })
    const auf = folgenDerAenderung(hoefe[2] as HofFuerFolgen, hoefe, 100, 'aufnehmen')
    expect(auf).toMatchObject({ platzNachher: 3, verschoben: [], moeglich: true })
    expect(folgenDerAenderung(hoefe[2] as HofFuerFolgen, hoefe, 2, 'aufnehmen').moeglich).toBe(false)
  })

  it('Warteliste im Admin: die kleinste freie Nummer bzw. der eigene Platz nach einem Entzug', () => {
    expect(platzBeiFreischaltung('neu', hoefe, JETZT, AKTION)).toBe(3)
    expect(platzBeiFreischaltung('b', hoefe, JETZT, AKTION)).toBe(2)
  })

  it('Warteliste nach dem Stichtag bzw. mit allen Plätzen vergeben: kein Platz genannt — der eigene bleibt', () => {
    const nachStichtag = new Date('2027-04-01T09:00:00+02:00')
    expect(platzBeiFreischaltung('neu', hoefe, nachStichtag, AKTION)).toBeNull()
    expect(platzBeiFreischaltung('neu', hoefe, JETZT, { ...AKTION, plaetze: 2 })).toBeNull()
    // Gegenprobe: am Stichtag selbst läuft die Aktion noch.
    expect(platzBeiFreischaltung('neu', hoefe, new Date('2027-03-31T20:00:00+02:00'), AKTION)).toBe(3)
    // Wer schon einen Platz hält (Entzug), behält ihn auch nach dem Stichtag — wie approveFarmAction.
    expect(platzBeiFreischaltung('b', hoefe, nachStichtag, AKTION)).toBe(2)
  })
})

describe('zusageBeiFreischaltung — Platz und Ende bei der Freischaltung nach dem Festschreiben', () => {
  const hoefe = [fest('a', 1), fest('b', 3)]

  it('ohne Platz, Aktion läuft: die kleinste freie Nummer und das Ende ab heute', () => {
    expect(zusageBeiFreischaltung({ id: 'neu', gruendungPlatz: null, gruendungBis: null }, hoefe, AKTION, JETZT)).toEqual({ platz: 2, bisTag: '2029-01-31', neu: true })
  })

  it('erneute Freigabe nach Entzug: Platz und Ende bleiben, wie sie sind', () => {
    const zurueck = { id: 'b', gruendungPlatz: 3, gruendungBis: bildeGruendungBis('2029-05-14') }
    expect(zusageBeiFreischaltung(zurueck, hoefe, { ...AKTION, aktionBisTag: '2026-10-01' }, JETZT)).toEqual({ platz: 3, bisTag: '2029-05-14', neu: false })
  })

  it('nach dem Stichtag kein Platz; alle Plätze vergeben: keiner', () => {
    const neu = { id: 'neu', gruendungPlatz: null, gruendungBis: null }
    expect(zusageBeiFreischaltung(neu, hoefe, AKTION, new Date('2027-04-01T09:00:00+02:00'))).toBeNull()
    expect(zusageBeiFreischaltung(neu, hoefe, { ...AKTION, plaetze: 2 }, JETZT)).toBeNull()
  })

  it('Platz ohne gespeichertes Ende: Nachricht und Konditionen nennen dasselbe Datum (bestimmeGruendungBis)', () => {
    const ohneEnde = { id: 'b', gruendungPlatz: 3, gruendungBis: null }
    const liste = [fest('a', 1), fest('b', 3, { gruendungBis: null })]
    const konditionen = bestimmeGruendungBis(ohneEnde, liste)
    const zusage = zusageBeiFreischaltung(ohneEnde, liste, AKTION, JETZT)
    expect(zusage).toMatchObject({ platz: 3, neu: false })
    expect(konditionen).not.toBeNull()
    expect(zusage?.bisTag).toBe(konditionen?.toISOString().slice(0, 10))
    // Gegenprobe: mit gespeichertem Ende nennen beide dieses Ende.
    const mitEnde = { id: 'b', gruendungPlatz: 3, gruendungBis: bildeGruendungBis('2030-01-31') }
    expect(zusageBeiFreischaltung(mitEnde, hoefe, AKTION, JETZT)?.bisTag).toBe('2030-01-31')
    expect(bestimmeGruendungBis(mitEnde, hoefe)?.toISOString().slice(0, 10)).toBe('2030-01-31')
  })

  it('nie kürzer als ein noch gespeichertes Ende (K1)', () => {
    const mitEnde = { id: 'neu', gruendungPlatz: null, gruendungBis: bildeGruendungBis('2030-06-30') }
    expect(zusageBeiFreischaltung(mitEnde, hoefe, AKTION, JETZT)?.bisTag).toBe('2030-06-30')
  })

  it('der Hinweis im Freischalt-Dialog nennt Nummer und Ende — bzw. warum keiner', () => {
    expect(freischaltHinweis({ id: 'neu', gruendungPlatz: null, gruendungBis: null, gruendungAusgenommen: false }, hoefe, AKTION, JETZT).text).toMatch(
      /^Dieser Hof belegt Gründungshof Nr\. 2\. Hofladen ohne Grundgebühr bis 31\. Jänner 2029\./
    )
    expect(
      freischaltHinweis({ id: 'neu', gruendungPlatz: null, gruendungBis: null, gruendungAusgenommen: false }, hoefe, AKTION, new Date('2027-04-02T10:00:00+02:00'))
    ).toMatchObject({ ton: 'orange', text: expect.stringMatching(/^Die Aktion ist vorbei/) })
  })
})

describe('festschreibenListe — einmal, nie kürzer, auch stillgelegte, ausgenommene ohne Platz', () => {
  const vorher: GruendungEinstellung = { ...AKTION, festAm: null }
  const alt = (id: string, tage: number, mehr: Partial<HofFuerFolgen> = {}): HofFuerFolgen => ({
    ...fest(id, null, { gruendungFest: false, gruendungBis: null }),
    approvedAt: new Date(Date.UTC(2026, 0, 1 + tage)),
    ...mehr,
  })

  it('heutige Reihenfolge, stillgelegte mit Platz, ausgenommene ohne; Ende = später von bisher und neu', () => {
    const hoefe = [
      alt('a', 0),
      alt('b', 1, { archivedAt: new Date('2026-06-01T10:00:00Z') }),
      alt('c', 2, { gruendungAusgenommen: true }),
      alt('d', 3, { gruendungBis: bildeGruendungBis('2030-06-30') }),
      alt('e', 4, { approvedAt: null }),
    ]
    expect(festschreibenListe(hoefe, vorher).map((z) => [z.id, z.platz, z.stillgelegt, z.bisherTag, z.neuTag])).toEqual([
      ['a', 1, false, '2027-12-31', '2029-01-31'],
      ['b', 2, true, null, '2029-01-31'],
      ['d', 3, false, '2030-06-30', '2030-06-30'],
    ])
  })

  it('nur bis zur Zahl der Plätze — und zeigt, wenn ein Hof mit Platz sonst leer ausginge', () => {
    const hoefe = [alt('s', 0, { archivedAt: new Date('2026-06-01T10:00:00Z') }), alt('a', 1), alt('b', 2)]
    expect(festschreibenListe(hoefe, { ...vorher, plaetze: 2 }).map((z) => z.id)).toEqual(['s', 'a'])
    // Heute (Reihenfolge ohne den stillgelegten) halten a und b je einen der 2 Plätze — b verlöre ihn.
    expect(festschreibenBrauchtPlaetze(hoefe, { ...vorher, plaetze: 2 })).toBe(3)
    expect(festschreibenBrauchtPlaetze(hoefe, { ...vorher, plaetze: 3 })).toBeNull()
  })
})

describe('vor dem Festschreiben: jede Stelle rechnet mit den Plätzen der Einstellung', () => {
  // So liefern die Lader die Zeilen: die Plätze der Einstellung an jeder Zeile, wie `gruendungFest`.
  const vorher: GruendungEinstellung = { ...AKTION, festAm: null }
  const hoefe = Array.from({ length: 13 }, (_, i) => ({
    ...fest(`h${i + 1}`, null, { gruendungFest: false, gruendungBis: null, gruendungPlaetze: vorher.plaetze }),
    approvedAt: new Date(Date.UTC(2026, 0, 1 + i)),
  }))

  it('100 Plätze gespeichert: Hof Nr. 13 bekommt Nachricht, Konditionen und Admin-Anzeige mit demselben Ende', () => {
    const nr13 = hoefe[12]!
    expect(gruendungsZusageBeiFreigabe(nr13, hoefe, vorher)).toEqual({ platz: 13, bis: vorher.bis })
    expect(istGruendungshof(nr13.id, hoefe)).toBe(true)
    expect(bestimmeGruendungBis(nr13, hoefe)).toEqual(vorher.bis)
    expect(baueGruendungAnzeige(nr13, hoefe)).toMatchObject({ bisTag: '2027-12-31' })
    expect(vergebeneGruendungsplaetze(hoefe)).toBe(13)
  })

  it('Gegenprobe: Zeilen ohne die Plätze der Einstellung rechnen wie vor Nr. 116 mit 12', () => {
    const ohne = hoefe.map((h) => {
      const kopie: HofFuerFolgen = { ...h }
      delete kopie.gruendungPlaetze
      return kopie
    })
    expect(bestimmeGruendungBis(ohne[12]!, ohne)).toBeNull()
    expect(vergebeneGruendungsplaetze(ohne)).toBe(12)
  })
})

describe('Sätze der Aktion — EINE Quelle, alle Zustände', () => {
  const lang = (text: string): string => text.replace(/ /g, ' ')
  const satz = (t: { vor: string; betont: string; nach: string }): string => lang(`${t.vor}${t.betont}${t.nach}`)
  const seiten = (vergeben: number, mehr: Partial<GruendungEinstellung> = {}): GruendungSeiten => ({
    ...seitenZahlen({ ...AKTION, ...mehr }, vergeben, JETZT),
    voraussichtlicherPlatz: null,
  })

  it('unter 10 vergeben: der Satz ohne Zahl, im Wert von Monaten × Grundgebühr', () => {
    const g = seiten(9)
    expect(g).toMatchObject({ zeigen: true, zaehler: false, art: 'aktion' })
    expect(satz(GRUENDUNG_TEXT.satz(g))).toBe('Die ersten 100 Höfe bekommen den Hofladen 24 Monate kostenlos – im Wert von € 456.')
    expect(GRUENDUNG_TEXT.pill(g)).toBe('Gründungsphase · die ersten 100 Höfe')
    expect(satz(GRUENDUNG_TEXT.preiszeile(g))).toBe(
      'Gründungshöfe zahlen 24 Monate keine Grundgebühr – auch im Hofladen. Die ersten 100 Höfe, Zusage mit der Freischaltung.'
    )
  })

  it('ab 10 vergeben: der Zähler — beim letzten Platz „Letzter Gründungsplatz frei“', () => {
    expect(satz(GRUENDUNG_TEXT.satz(seiten(10)))).toBe('Noch 90 von 100 Gründungsplätzen frei – Hofladen 24 Monate kostenlos, im Wert von € 456.')
    expect(GRUENDUNG_TEXT.pill(seiten(29))).toBe('Gründungsphase · noch 71 von 100 Plätzen')
    expect(satz(GRUENDUNG_TEXT.satz(seiten(99)))).toBe('Letzter Gründungsplatz frei – Hofladen 24 Monate kostenlos, im Wert von € 456.')
    expect(satz(GRUENDUNG_TEXT.preiszeile(seiten(10)))).toContain('Noch 90 von 100 Plätzen, Zusage mit der Freischaltung.')
  })

  it('mehr Monate: der Wert rechnet in Cent mit (30 × € 19 = € 570)', () => {
    expect(satz(GRUENDUNG_TEXT.satz(seiten(3, { monate: 30 })))).toContain('30 Monate kostenlos – im Wert von € 570.')
    expect(GRUENDUNG_TEXT.hofladenPreis(seiten(3, { monate: 30 }))).toBe('30 Monate, dann € 19')
  })

  it('Fußnote und Registrieren nennen Tarifstart, Bedingungen und Stichtag — ohne Stichtag ohne diesen Teil', () => {
    expect(lang(GRUENDUNG_TEXT.fussnote(seiten(3)).join(' · '))).toBe(
      '24 Monate ohne Grundgebühr ab Tarifstart am 1. Februar 2027 bzw. ab deiner Freischaltung · Freischaltung mit mindestens einem Produkt und Stripe · Aktion bis 31. März 2027 · danach Tarif nach Wahl, ohne Wahl bleibt Hoftor, kostenlos'
    )
    expect(GRUENDUNG_TEXT.fussnote(seiten(3, { aktionBisTag: null })).some((t) => t.startsWith('Aktion bis'))).toBe(false)
    expect(satz(GRUENDUNG_TEXT.registrieren(seiten(3), 4))).toBe(
      'Du wärst voraussichtlich Gründungshof Nr. 4 – Hofladen 24 Monate kostenlos. Die Zusage kommt mit der Freischaltung (mindestens ein Produkt und Stripe), wenn sie bis 31. März 2027 erfolgt.'
    )
  })

  it('endet die Aktion (Stichtag vorbei oder alle Plätze vergeben): nichts zeigen', () => {
    expect(seitenZahlen(AKTION, 100, JETZT).zeigen).toBe(false)
    expect(seitenZahlen(AKTION, 3, new Date('2027-04-01T08:00:00+02:00')).zeigen).toBe(false)
  })

  it('/konditionen: Abschnitt „Aktion“ mit Plätzen, Dauer, Bedingungen und Stichtag aus derselben Quelle', () => {
    const { titel, saetze } = GRUENDUNG_TEXT.aktion(seiten(3))
    expect(titel).toBe('Aktion 100 Gründungshöfe')
    expect(lang(saetze.join(' '))).toContain('im Wert von € 456 inkl. USt.')
    expect(lang(saetze.join(' '))).toContain('bis 31. März 2027 oder bis alle Plätze vergeben sind')
  })
})

describe('Abzeichen — wer es trägt und was das Blatt zeigt', () => {
  const hof = { gruendungPlatz: 5, approvedAt: JETZT, gruendungAusgenommen: false, gruendungAbzeichenZeigen: true }

  it('mit festgeschriebenem Platz sichtbar; ausgeblendet, ausgenommen, ohne Platz oder ohne Freischaltung nicht', () => {
    expect(zeigtAbzeichen(hof)).toBe(true)
    expect(zeigtAbzeichen({ ...hof, gruendungAbzeichenZeigen: false })).toBe(false)
    expect(zeigtAbzeichen({ ...hof, gruendungAusgenommen: true })).toBe(false)
    expect(zeigtAbzeichen({ ...hof, gruendungPlatz: null })).toBe(false)
    expect(zeigtAbzeichen({ ...hof, approvedAt: null })).toBe(false)
  })

  it('„Du hast selbst einen Hof?“ nur, solange der Zähler sichtbar ist', () => {
    expect(abzeichenBlattAus({ gesamt: 100, frei: 71, zaehler: true })).toEqual({ plaetze: 100, frei: 71 })
    expect(abzeichenBlattAus({ gesamt: 100, frei: 95, zaehler: false })).toEqual({ plaetze: 100, frei: null })
  })
})

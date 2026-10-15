/**
 * Gründungshöfe sichtbar (Register K2-Ergänzung, Nr. 93) — die Rechenregeln
 * in src/lib/gruendungshof.ts, ohne Mock.
 *
 * Beweist: frei = Plätze gesamt − vergeben; gezeigt wird nur mit Anzeige an,
 * mindestens einem freien Platz und einem Ende, das am Wiener Tag noch nicht
 * vorbei ist; der voraussichtliche Platz zählt die Warteliste mit und
 * verschwindet hinter dem letzten Platz; die Zusage bei der Freischaltung
 * nimmt Plätze und Ende aus der Einstellung; die bestehenden Aufrufer ohne
 * Parameter rechnen wie vor Nr. 93 mit 12.
 */
import { describe, it, expect } from 'vitest'
import {
  GRUENDUNG_BIS_STANDARD,
  GRUENDUNG_TEXT,
  bekaemePlatzBeiFreigabe,
  bildeGruendungBis,
  fuerSeiten,
  gruendungSeitenDaten,
  gruendungsZusageBeiFreigabe,
  istGruendungshof,
  seitenZahlen,
  vergebeneGruendungsplaetze,
  voraussichtlicherPlatz,
  type GruendungEinstellung,
  type HofFuerPlatz,
} from '@/lib/gruendungshof'

const JETZT = new Date('2026-10-15T10:00:00+02:00')

/** n freigeschaltete Höfe in fester Reihenfolge der Freigabe. */
function hoefe(n: number): HofFuerPlatz[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `hof-${String(i + 1).padStart(2, '0')}`,
    approvedAt: new Date(Date.UTC(2026, 0, 1 + i)),
    createdAt: new Date(Date.UTC(2025, 0, 1)),
    archivedAt: null,
  }))
}

function einstellung(abweichend: Partial<GruendungEinstellung> = {}): GruendungEinstellung {
  return { plaetze: 12, bis: bildeGruendungBis('2027-12-31'), anzeige: true, ...abweichend }
}

describe('fuerSeiten — frei und die Bedingung fürs Zeigen', () => {
  it('7 von 12 vergeben: 5 frei, wird gezeigt, mit dem Ende als Wiener Tag', () => {
    expect(fuerSeiten(einstellung(), hoefe(7), JETZT)).toEqual({ zeigen: true, frei: 5, gesamt: 12, bisTag: '2027-12-31' })
  })

  it('wartende und stillgelegte Höfe belegen keinen Platz', () => {
    const liste = [...hoefe(3), { id: 'wartet', approvedAt: null, createdAt: JETZT, archivedAt: null }]
    liste[0] = { ...liste[0], archivedAt: JETZT }
    expect(fuerSeiten(einstellung(), liste, JETZT).frei).toBe(10)
  })

  it('alle vergeben: nichts zeigen, kein „0 von 12" — auch mit mehr Höfen als Plätzen', () => {
    expect(fuerSeiten(einstellung(), hoefe(12), JETZT)).toMatchObject({ zeigen: false, frei: 0 })
    expect(fuerSeiten(einstellung(), hoefe(15), JETZT)).toMatchObject({ zeigen: false, frei: 0 })
  })

  it('der letzte Platz wird noch gezeigt', () => {
    expect(fuerSeiten(einstellung(), hoefe(11), JETZT)).toMatchObject({ zeigen: true, frei: 1 })
  })

  it('Anzeige aus: nichts zeigen, auch mit freien Plätzen', () => {
    expect(fuerSeiten(einstellung({ anzeige: false }), hoefe(1), JETZT)).toMatchObject({ zeigen: false, frei: 11 })
  })

  it('Datum vorbei: am letzten Tag noch gezeigt, ab Mitternacht in Wien nicht mehr', () => {
    const e = einstellung({ bis: bildeGruendungBis('2026-10-15') })
    expect(fuerSeiten(e, hoefe(1), new Date('2026-10-15T23:59:00+02:00')).zeigen).toBe(true)
    // 0:30 Uhr in Wien ist in UTC noch der 15. — gezählt wird der Wiener Tag.
    expect(fuerSeiten(e, hoefe(1), new Date('2026-10-16T00:30:00+02:00')).zeigen).toBe(false)
  })

  it('aus der Zahl der Höfe im Rennen (Vorschau im Admin) dasselbe wie aus der Liste', () => {
    for (const n of [0, 7, 12, 20]) expect(seitenZahlen(einstellung(), n, JETZT)).toEqual(fuerSeiten(einstellung(), hoefe(n), JETZT))
  })
})

describe('voraussichtlicherPlatz — vergeben + wartende Höfe vor dir + 1', () => {
  it('7 vergeben, 2 warten: Nr. 10', () => {
    expect(voraussichtlicherPlatz(einstellung(), hoefe(7), 2)).toBe(10)
  })

  it('ohne Warteliste: der nächste Platz', () => {
    expect(voraussichtlicherPlatz(einstellung(), hoefe(7), 0)).toBe(8)
  })

  it('genau der letzte Platz: Nr. 12; einer mehr wartend: kein Satz (nie „voraussichtlich Nr. 13")', () => {
    expect(voraussichtlicherPlatz(einstellung(), hoefe(7), 4)).toBe(12)
    expect(voraussichtlicherPlatz(einstellung(), hoefe(7), 5)).toBeNull()
  })

  it('nur, wenn die Seiten die Bausteine zeigen — Datum vorbei: kein Satz, obwohl Platz wäre', () => {
    expect(gruendungSeitenDaten(einstellung(), hoefe(7), 2, JETZT).voraussichtlicherPlatz).toBe(10)
    const vorbei = gruendungSeitenDaten(einstellung({ bis: bildeGruendungBis('2026-10-14') }), hoefe(7), 2, JETZT)
    expect(vorbei).toMatchObject({ zeigen: false, voraussichtlicherPlatz: null })
  })
})

describe('gruendungsZusageBeiFreigabe — Platz und Ende für die Nachricht', () => {
  const liste = hoefe(13)

  it('mit Platz: Nummer und das Standard-Ende der Einstellung', () => {
    const e = einstellung({ bis: bildeGruendungBis('2028-06-30') })
    expect(gruendungsZusageBeiFreigabe({ id: 'hof-05', gruendungBis: null }, liste, e)).toEqual({ platz: 5, bis: bildeGruendungBis('2028-06-30') })
  })

  it('ein eigenes Ende am Hof geht vor', () => {
    const eigenes = bildeGruendungBis('2027-06-30')
    expect(gruendungsZusageBeiFreigabe({ id: 'hof-05', gruendungBis: eigenes }, liste, einstellung())).toEqual({ platz: 5, bis: eigenes })
  })

  it('hinter dem letzten Platz der Einstellung: keine Zusage; mehr Plätze eingestellt: doch', () => {
    expect(gruendungsZusageBeiFreigabe({ id: 'hof-13', gruendungBis: null }, liste, einstellung())).toBeNull()
    expect(gruendungsZusageBeiFreigabe({ id: 'hof-13', gruendungBis: null }, liste, einstellung({ plaetze: 13 }))).toMatchObject({ platz: 13 })
  })

  it('ein Hof, der nicht im Rennen ist: keine Zusage', () => {
    expect(gruendungsZusageBeiFreigabe({ id: 'fremd', gruendungBis: null }, liste, einstellung())).toBeNull()
  })
})

describe('bestehende Aufrufer ohne Parameter rechnen wie vor Nr. 93 mit 12', () => {
  it('vergeben, Platz bei Freigabe und Gründungshof — Standard und ausdrücklich', () => {
    expect(vergebeneGruendungsplaetze(hoefe(15))).toBe(12)
    expect(vergebeneGruendungsplaetze(hoefe(15), 14)).toBe(14)
    expect(bekaemePlatzBeiFreigabe(hoefe(12))).toBe(false)
    expect(bekaemePlatzBeiFreigabe(hoefe(12), 13)).toBe(true)
    expect(istGruendungshof('hof-13', hoefe(13))).toBe(false)
    expect(istGruendungshof('hof-13', hoefe(13), 13)).toBe(true)
  })

  it('das Standard-Ende bleibt der 31.12.2027', () => {
    expect(GRUENDUNG_BIS_STANDARD.toISOString()).toBe('2027-12-31T00:00:00.000Z')
  })
})

describe('GRUENDUNG_TEXT — der Wortlaut der Entscheidung (K2-Ergänzung)', () => {
  // formatDatumLang setzt ein geschütztes Leerzeichen nach dem Tag.
  const lang = (text: string): string => text.replace(/ /g, ' ')
  const satz = (t: { vor: string; betont: string; nach: string }): string => lang(`${t.vor}${t.betont}${t.nach}`)

  it('(1) Startseite, (2) Pill und Preiszeile, (3) Registrieren — mit den Zahlen aus der Einstellung', () => {
    expect(satz(GRUENDUNG_TEXT.satz(5, 12, '2027-12-31'))).toBe('Noch 5 von 12 Gründungsplätzen frei – Hofladen kostenlos bis 31. Dezember 2027.')
    expect(GRUENDUNG_TEXT.pill(5, 12)).toBe('Gründungsphase · noch 5 von 12 Plätzen')
    expect(lang(GRUENDUNG_TEXT.fussnote('2027-12-31').join(' · '))).toBe(
      // Korrektur 15.10.2026 (Register K2): „keine Bankdaten nötig“ gestrichen – Stripe verlangt beim Einrichten ein Auszahlungskonto.
      'Kostenlos bis 31. Dezember 2027 · danach Tarif nach Wahl · monatlich kündbar'
    )
    expect(satz(GRUENDUNG_TEXT.registrieren(8, '2027-12-31'))).toBe(
      'Du wärst voraussichtlich Gründungshof Nr. 8 – Hofladen kostenlos bis 31. Dezember 2027. Die Zusage kommt mit der Freischaltung.'
    )
    expect(GRUENDUNG_TEXT.hofladenPreis('2027-12-31')).toBe('bis 31.12.2027 · dann € 19')
  })

  it('der letzte Platz heißt „Letzter Gründungsplatz frei" (Mockup, Zustände)', () => {
    expect(GRUENDUNG_TEXT.satz(1, 12, '2027-12-31').betont).toBe('Letzter Gründungsplatz frei')
  })

  it('ein anderes Ende aus der Einstellung steht überall', () => {
    expect(satz(GRUENDUNG_TEXT.preiszeile(3, 20, '2028-06-30'))).toBe(
      'Gründungshöfe zahlen bis 30. Juni 2028 keine Grundgebühr – auch im Hofladen. Noch 3 von 20 Plätzen, Zusage mit der Freischaltung.'
    )
  })
})

/**
 * Gründungshöfe: Testhöfe ausnehmen (Register K2, Ergänzung 16.10.2026,
 * Nachtlauf Nr. 109) — die reinen Regeln, ohne Mock.
 *
 * Beweist:
 *  - gruendungsplaetze lässt einen ausgenommenen Hof weg; die Höfe danach
 *    rücken auf, die Reihenfolge der übrigen bleibt (approvedAt, createdAt, id).
 *  - folgenDerAenderung: beim Ausnehmen der verlorene Platz, wer auf welchen
 *    Platz rückt, ein Hof, der NEU Gründungshof wird, freie Plätze danach; bei
 *    der Wiederaufnahme die Höfe, die eine Nummer weiter rücken — und nur,
 *    solange danach höchstens so viele Höfe im Rennen sind wie Plätze.
 *  - die Sätze der Bestätigung (höchstens drei, dann „und n weitere“), der
 *    Haken nur bei einem Platz, der ausgegraute Menüeintrag mit Grund.
 *  - Warteliste und Zähler kennen den ausgenommenen Hof.
 */
import { describe, it, expect } from 'vitest'
import {
  GRUENDUNG_BIS_STANDARD,
  GRUENDUNG_EINSTELLUNG_STANDARD,
  alleGruendungsplaetzeVergeben,
  bildeGruendungBis,
  folgenDerAenderung,
  freischaltHinweis,
  gruendungAlleVergeben,
  gruendungsplaetze,
  wiederAufnahmeMoeglich,
  zaehleAusgenommene,
  type HofFuerFolgen,
} from '@/lib/gruendungshof'
import { GRUENDUNG_AUSNEHMEN_TEXT, gruendungAenderung, gruendungZuletztText, platzBeiFreischaltung } from '@/lib/admin-hoefe-seite'

const STANDARD = GRUENDUNG_BIS_STANDARD

/** Hof n, freigeschaltet am n. Jänner 2026 — die Reihenfolge der Plätze ist die der Nummern. */
function hof(n: number, ueber: Partial<HofFuerFolgen> = {}): HofFuerFolgen {
  return {
    id: `hof_${String(n).padStart(2, '0')}`,
    name: `Testhof ${String.fromCharCode(64 + n)}`,
    approvedAt: new Date(Date.UTC(2026, 0, n, 9)),
    createdAt: new Date(Date.UTC(2025, 0, 1)),
    archivedAt: null,
    gruendungAusgenommen: false,
    gruendungBis: null,
    ...ueber,
  }
}

const reihe = (n: number, ueber: Record<number, Partial<HofFuerFolgen>> = {}): HofFuerFolgen[] =>
  Array.from({ length: n }, (_, i) => hof(i + 1, ueber[i + 1]))

describe('gruendungsplaetze mit ausgenommenem Hof', () => {
  it('ein ausgenommener Hof belegt keinen Platz, die Höfe danach rücken auf', () => {
    const plaetze = gruendungsplaetze(reihe(4, { 2: { gruendungAusgenommen: true } }))
    expect([...plaetze]).toEqual([
      ['hof_01', 1],
      ['hof_03', 2],
      ['hof_04', 3],
    ])
  })

  it('die Reihenfolge der übrigen bleibt stabil — auch bei gleicher Freigabe (createdAt, dann id)', () => {
    const gleich = new Date(Date.UTC(2026, 0, 1))
    const hoefe = [
      hof(3, { approvedAt: gleich, id: 'c' }),
      hof(1, { approvedAt: gleich, id: 'a', gruendungAusgenommen: true }),
      hof(2, { approvedAt: gleich, id: 'b' }),
    ]
    expect([...gruendungsplaetze(hoefe)]).toEqual([
      ['b', 1],
      ['c', 2],
    ])
    expect([...gruendungsplaetze([...hoefe].reverse())]).toEqual([...gruendungsplaetze(hoefe)])
  })

  it('Gegenprobe: ohne Ausnahme zählt jeder freigeschaltete Hof', () => {
    expect(gruendungsplaetze(reihe(4)).size).toBe(4)
  })
})

describe('folgenDerAenderung — Ausnehmen', () => {
  it('der Hof verliert seinen Platz, die Höfe danach rücken auf, ein Platz mehr frei', () => {
    const hoefe = reihe(3)
    const f = folgenDerAenderung(hoefe[1] as HofFuerFolgen, hoefe, 12, 'ausnehmen')
    expect(f).toMatchObject({ platzVorher: 2, platzNachher: null, freiNachher: 10, moeglich: true, neu: [], verlieren: [] })
    expect(f.verschoben.map((w) => [w.name, w.von, w.nach])).toEqual([['Testhof C', 3, 2]])
  })

  it('ein Hof hinter dem letzten Platz wird NEU Gründungshof', () => {
    const hoefe = reihe(4)
    const f = folgenDerAenderung(hoefe[0] as HofFuerFolgen, hoefe, 3, 'ausnehmen')
    expect(f.neu.map((w) => [w.name, w.von, w.nach])).toEqual([['Testhof D', 4, 3]])
    expect(f.verschoben.map((w) => w.nach)).toEqual([1, 2])
    expect(f.freiNachher).toBe(0)
  })

  it('ein Hof ohne Platz: an den Plätzen ändert sich nichts', () => {
    const hoefe = reihe(4)
    const f = folgenDerAenderung(hoefe[3] as HofFuerFolgen, hoefe, 3, 'ausnehmen')
    expect(f).toMatchObject({ platzVorher: null, verschoben: [], neu: [], freiNachher: 0 })
  })
})

describe('folgenDerAenderung — Wiederaufnahme', () => {
  it('der Hof bekommt seinen Platz nach der Freigabe, die Höfe dahinter rücken eine Nummer weiter', () => {
    const hoefe = reihe(3, { 1: { gruendungAusgenommen: true } })
    const f = folgenDerAenderung(hoefe[0] as HofFuerFolgen, hoefe, 12, 'aufnehmen')
    expect(f).toMatchObject({ platzVorher: null, platzNachher: 1, moeglich: true, freiNachher: 9, verlieren: [] })
    expect(f.verschoben.map((w) => [w.name, w.von, w.nach])).toEqual([
      ['Testhof B', 1, 2],
      ['Testhof C', 2, 3],
    ])
  })

  it('genau der letzte freie Platz: geht', () => {
    const hoefe = reihe(3, { 2: { gruendungAusgenommen: true } })
    expect(folgenDerAenderung(hoefe[1] as HofFuerFolgen, hoefe, 3, 'aufnehmen')).toMatchObject({ moeglich: true, freiNachher: 0 })
    expect(wiederAufnahmeMoeglich('hof_02', hoefe, 3)).toBe(true)
  })

  it('alle Plätze vergeben: geht nicht — sonst verlöre ein anderer Hof seine Zusage', () => {
    const hoefe = reihe(4, { 2: { gruendungAusgenommen: true } })
    const f = folgenDerAenderung(hoefe[1] as HofFuerFolgen, hoefe, 3, 'aufnehmen')
    expect(f.moeglich).toBe(false)
    expect(f.verlieren.map((w) => w.name)).toEqual(['Testhof D'])
    expect(wiederAufnahmeMoeglich('hof_02', hoefe, 3)).toBe(false)
    // Die Zahl der Plätze kommt als Parameter (Einstellung) — mit einem mehr geht es.
    expect(wiederAufnahmeMoeglich('hof_02', hoefe, 4)).toBe(true)
  })
})

describe('gruendungAenderung — Menü und Bestätigung', () => {
  it('Ausnehmen mit Platz: Sätze in Zahlen, Haken, oranger Knopf-Text', () => {
    const hoefe = reihe(3)
    const a = gruendungAenderung(hoefe[1] as HofFuerFolgen, hoefe, 12, STANDARD)
    expect(a).toMatchObject({
      richtung: 'ausnehmen',
      menue: GRUENDUNG_AUSNEHMEN_TEXT.menue.ausnehmen,
      gesperrt: null,
      titel: 'Testhof B nicht als Gründungshof zählen?',
      haken: true,
      knopf: 'Nicht mehr zählen',
    })
    expect(a.saetze).toEqual([
      'Testhof B verliert Platz Nr. 2 und die Zusage „Hofladen ohne Grundgebühr bis 31. Dezember 2027“.',
      'Testhof C rückt auf Nr. 2.',
      'Frei sind danach 10 von 12 Plätzen.',
    ])
    expect(a.hinweise).toEqual([GRUENDUNG_AUSNEHMEN_TEXT.keineNachricht, GRUENDUNG_AUSNEHMEN_TEXT.zurueck])
  })

  it('ein Hof, der neu Gründungshof wird, steht ausdrücklich da — mit seinem eigenen Ende', () => {
    const hoefe = reihe(4, { 4: { gruendungBis: bildeGruendungBis('2028-06-30') } })
    const a = gruendungAenderung(hoefe[0] as HofFuerFolgen, hoefe, 3, STANDARD)
    expect(a.saetze).toContain('Neu Gründungshof: Testhof D rückt auf Platz 3 und läuft dann bis 30. Juni 2028 ohne Grundgebühr.')
    expect(a.saetze.at(-1)).toBe('Danach sind alle 3 Plätze vergeben.')
  })

  it('höchstens drei Höfe beim Nachrücken, dann „und n weitere“', () => {
    const hoefe = reihe(7)
    const a = gruendungAenderung(hoefe[0] as HofFuerFolgen, hoefe, 12, STANDARD)
    expect(a.saetze[1]).toBe('Testhof B rückt auf Nr. 1, Testhof C auf Nr. 2, Testhof D auf Nr. 3 – und 3 weitere rücken je eine Nummer vor.')
    // Gegenprobe: genau drei — ohne „weitere“.
    const drei = reihe(4)
    expect(gruendungAenderung(drei[0] as HofFuerFolgen, drei, 12, STANDARD).saetze[1]).toBe(
      'Testhof B rückt auf Nr. 1, Testhof C auf Nr. 2 und Testhof D auf Nr. 3.'
    )
  })

  it('Ausnehmen ohne Platz: kein Haken', () => {
    const hoefe = reihe(4)
    const a = gruendungAenderung(hoefe[3] as HofFuerFolgen, hoefe, 3, STANDARD)
    expect(a.haken).toBe(false)
    expect(a.saetze[0]).toBe('Testhof D hält gerade keinen Gründungsplatz – an den Plätzen ändert sich nichts.')
  })

  it('Wiederaufnahme: „Nr. 2 → Nr. 3 – die Zusage bleibt“, höchstens drei, kein Haken', () => {
    const hoefe = reihe(6, { 1: { gruendungAusgenommen: true } })
    const a = gruendungAenderung(hoefe[0] as HofFuerFolgen, hoefe, 12, STANDARD)
    expect(a).toMatchObject({ richtung: 'aufnehmen', menue: GRUENDUNG_AUSNEHMEN_TEXT.menue.aufnehmen, gesperrt: null, haken: false, knopf: 'Wieder zählen' })
    expect(a.saetze).toEqual([
      'Testhof A bekommt Platz Nr. 1 – Hofladen ohne Grundgebühr bis 31. Dezember 2027.',
      'Testhof B: Nr. 1 → Nr. 2 – die Zusage bleibt.',
      'Testhof C: Nr. 2 → Nr. 3 – die Zusage bleibt.',
      'Testhof D: Nr. 3 → Nr. 4 – die Zusage bleibt.',
      'Und 2 weitere rücken je eine Nummer weiter – die Zusage bleibt.',
      'Frei sind danach 6 von 12 Plätzen.',
    ])
  })

  it('Wiederaufnahme bei vollen Plätzen: ausgegraut mit dem Satz aus der Einstellung', () => {
    const hoefe = reihe(4, { 2: { gruendungAusgenommen: true } })
    const a = gruendungAenderung(hoefe[1] as HofFuerFolgen, hoefe, 3, STANDARD)
    expect(a.gesperrt).toBe(gruendungAlleVergeben(3))
    expect(a.gesperrt).toBe('Alle 3 Gründungsplätze sind vergeben – erst muss ein Platz frei werden.')
    expect(a.saetze).toEqual([])
  })
})

describe('Warteliste, Zähler und „zuletzt geändert“', () => {
  it('ein ausgenommener wartender Hof bekäme keinen Platz; Gegenprobe: ohne Ausnahme schon', () => {
    const jetzt = new Date(Date.UTC(2026, 9, 16))
    const wartet = hof(9, { approvedAt: null })
    expect(platzBeiFreischaltung(wartet.id, [...reihe(2), { ...wartet, gruendungAusgenommen: true }], jetzt, GRUENDUNG_EINSTELLUNG_STANDARD)).toBeNull()
    expect(platzBeiFreischaltung(wartet.id, [...reihe(2), wartet], jetzt, GRUENDUNG_EINSTELLUNG_STANDARD)).toBe(3)
  })

  it('zählt nur freigeschaltete, nicht stillgelegte ausgenommene Höfe', () => {
    const hoefe = reihe(4, {
      1: { gruendungAusgenommen: true },
      2: { gruendungAusgenommen: true, archivedAt: new Date() },
      3: { gruendungAusgenommen: true, approvedAt: null },
    })
    expect(zaehleAusgenommene(hoefe)).toBe(1)
  })

  it('„zuletzt geändert von … am 14. Okt“ nach Wiener Tag; ohne Konto der feste Satz; nie geändert: nichts', () => {
    // 23:30 UTC am 13.10. ist in Wien schon der 14.10.
    const am = new Date('2026-10-13T23:30:00Z')
    expect(gruendungZuletztText(am, 'Test Admin')).toBe('zuletzt geändert von Test Admin am 14. Okt')
    expect(gruendungZuletztText(am, null)).toBe('zuletzt geändert von einem gelöschten Konto am 14. Okt')
    expect(gruendungZuletztText(null, 'Test Admin')).toBeNull()
  })
})

describe('„Alle Plätze vergeben“ – ein Wortlaut (Nr. 121)', () => {
  it('der Hinweis im Freischalt-Dialog, die Sperre im Menü und die Action bauen ihren Satz aus derselben Funktion', () => {
    const wartend = { id: 'hof_99', gruendungPlatz: null, gruendungBis: null, gruendungAusgenommen: false }
    const einstellung = { ...GRUENDUNG_EINSTELLUNG_STANDARD, plaetze: 3 }
    const hinweis = freischaltHinweis(wartend, reihe(3), einstellung, new Date('2026-10-20T10:00:00.000Z'))
    expect(hinweis.ton).toBe('orange')
    expect(hinweis.text).toContain(alleGruendungsplaetzeVergeben(3))
    expect(gruendungAlleVergeben(3)).toContain(alleGruendungsplaetzeVergeben(3))
    // Gegenprobe: Mit einem freien Platz steht der Satz nirgends.
    const frei = freischaltHinweis(wartend, reihe(2), einstellung, new Date('2026-10-20T10:00:00.000Z'))
    expect(frei.text).not.toContain(alleGruendungsplaetzeVergeben(3))
  })
})

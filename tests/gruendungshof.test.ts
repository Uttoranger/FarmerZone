/**
 * Tests für die Gründungsplatz-Vergabe.
 *
 * Reine Logik, keine Datenbank: Die Funktionen bekommen eine Hofliste und
 * geben Plätze zurück. Geprüft wird das Verhalten an den Rändern — Platz 12
 * gegen Platz 13, stillgelegte und wartende Höfe, und die deterministische
 * Sortierung bei gleichem approvedAt. Der letzte Fall ist kein akademischer:
 * der Backfill aus #47 hat allen Bestandshöfen denselben Freigabezeitpunkt
 * eingetragen.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  gruendungsplaetze,
  gruendungsplatzVon,
  istGruendungshof,
  vergebeneGruendungsplaetze,
  bekaemePlatzBeiFreigabe,
  gruendungshofLabel,
  MAX_GRUENDUNGSHOEFE,
  GRUENDUNG_BIS_STANDARD,
  GRUENDUNG_BIS_STANDARD_TAG,
  baueGruendungAnzeige,
  bestimmeGruendungBis,
  bildeGruendungBis,
  gruendungsKonditionenText,
  verkuerztGruendung,
  verkuerztGruendungTag,
  type HofFuerPlatz,
} from '@/lib/gruendungshof'
import { baueGruendungsZusage, bestimmeTarifZustand } from '@/lib/konditionen'
import { kalendertagInWien, wienerMitternacht } from '@/lib/wiener-tag'

const T = (tag: number) => new Date(Date.UTC(2026, 0, tag, 12, 0, 0))

function hof(id: string, opts: Partial<HofFuerPlatz> = {}): HofFuerPlatz {
  return {
    id,
    approvedAt: opts.approvedAt !== undefined ? opts.approvedAt : T(1),
    createdAt: opts.createdAt ?? T(1),
    archivedAt: opts.archivedAt ?? null,
    gruendungAusgenommen: opts.gruendungAusgenommen ?? false,
  }
}

/** n freigeschaltete Höfe, jeder einen Tag nach dem vorigen. */
function reihe(n: number): HofFuerPlatz[] {
  return Array.from({ length: n }, (_, i) =>
    hof(`hof_${i + 1}`, { approvedAt: T(i + 1), createdAt: T(i + 1) })
  )
}

describe('Konditionen', () => {
  it('hält die Betreiber-Vorgabe fest', () => {
    expect(MAX_GRUENDUNGSHOEFE).toBe(12)
  })

  it('beschriftet Plätze wie vorgegeben', () => {
    expect(gruendungshofLabel(3)).toBe('Gründungshof Nr. 3')
  })
})

describe('Platzvergabe', () => {
  it('vergibt Plätze in der Reihenfolge der Freigabe', () => {
    const hoefe = reihe(3)
    expect(gruendungsplatzVon('hof_1', hoefe)).toBe(1)
    expect(gruendungsplatzVon('hof_2', hoefe)).toBe(2)
    expect(gruendungsplatzVon('hof_3', hoefe)).toBe(3)
  })

  it('Platz 12 ist Gründungshof, Platz 13 nicht mehr', () => {
    const hoefe = reihe(13)

    expect(gruendungsplatzVon('hof_12', hoefe)).toBe(12)
    expect(istGruendungshof('hof_12', hoefe)).toBe(true)

    expect(gruendungsplatzVon('hof_13', hoefe)).toBe(13)
    expect(istGruendungshof('hof_13', hoefe)).toBe(false)
  })

  it('zählt höchstens 12 vergebene Plätze, auch bei 20 Höfen', () => {
    expect(vergebeneGruendungsplaetze(reihe(20))).toBe(12)
    expect(vergebeneGruendungsplaetze(reihe(5))).toBe(5)
    expect(vergebeneGruendungsplaetze([])).toBe(0)
  })

  it('wartende Höfe (approvedAt = null) sind nicht im Rennen', () => {
    const hoefe = [hof('freigeschaltet', { approvedAt: T(1) }), hof('wartet', { approvedAt: null })]

    expect(gruendungsplatzVon('wartet', hoefe)).toBeNull()
    expect(istGruendungshof('wartet', hoefe)).toBe(false)
    expect(vergebeneGruendungsplaetze(hoefe)).toBe(1)
  })

  it('stillgelegte Höfe belegen keinen Platz — die nachfolgenden rücken auf', () => {
    const hoefe = [
      hof('a', { approvedAt: T(1), createdAt: T(1) }),
      hof('b', { approvedAt: T(2), createdAt: T(2), archivedAt: T(9) }),
      hof('c', { approvedAt: T(3), createdAt: T(3) }),
    ]

    expect(gruendungsplatzVon('b', hoefe)).toBeNull()
    expect(gruendungsplatzVon('c', hoefe)).toBe(2)
    expect(vergebeneGruendungsplaetze(hoefe)).toBe(2)
  })

  it('ein stillgelegter Hof auf Platz 5 holt Hof 13 in die Gründungsplätze', () => {
    const hoefe = reihe(13)
    hoefe[4] = { ...hoefe[4], archivedAt: T(50) }

    expect(istGruendungshof('hof_13', hoefe)).toBe(true)
    expect(gruendungsplatzVon('hof_13', hoefe)).toBe(12)
  })
})

describe('Deterministische Sortierung', () => {
  it('entscheidet bei gleichem approvedAt über createdAt', () => {
    const hoefe = [
      hof('spaeter', { approvedAt: T(5), createdAt: T(3) }),
      hof('frueher', { approvedAt: T(5), createdAt: T(1) }),
    ]

    expect(gruendungsplatzVon('frueher', hoefe)).toBe(1)
    expect(gruendungsplatzVon('spaeter', hoefe)).toBe(2)
  })

  it('entscheidet bei gleichem approvedAt UND createdAt über die id', () => {
    const gleich = { approvedAt: T(5), createdAt: T(5) }
    const hoefe = [hof('zzz', gleich), hof('aaa', gleich)]

    expect(gruendungsplatzVon('aaa', hoefe)).toBe(1)
    expect(gruendungsplatzVon('zzz', hoefe)).toBe(2)
  })

  it('liefert bei umgestellter Eingabereihenfolge dasselbe Ergebnis', () => {
    // Der Backfill aus #47 gibt allen Bestandshöfen denselben Zeitpunkt —
    // ohne stabile Rückfallebene wäre die Vergabe bei jedem Aufruf anders.
    const gleich = { approvedAt: T(5), createdAt: T(5) }
    const a = [hof('c', gleich), hof('a', gleich), hof('b', gleich)]
    const b = [hof('b', gleich), hof('c', gleich), hof('a', gleich)]

    expect([...gruendungsplaetze(a)]).toEqual([...gruendungsplaetze(b)])
  })

  it('verändert die übergebene Liste nicht', () => {
    const hoefe = [hof('z', { approvedAt: T(2) }), hof('a', { approvedAt: T(1) })]
    const vorher = hoefe.map((h) => h.id)

    gruendungsplaetze(hoefe)

    expect(hoefe.map((h) => h.id)).toEqual(vorher)
  })
})

describe('bekaemePlatzBeiFreigabe — für den Bestätigungsdialog', () => {
  it('true, solange noch Plätze frei sind', () => {
    expect(bekaemePlatzBeiFreigabe(reihe(11))).toBe(true)
    expect(bekaemePlatzBeiFreigabe([])).toBe(true)
  })

  it('false, sobald alle 12 vergeben sind — Freischalten bleibt trotzdem möglich', () => {
    expect(bekaemePlatzBeiFreigabe(reihe(12))).toBe(false)
    expect(bekaemePlatzBeiFreigabe(reihe(30))).toBe(false)
  })

  it('true, wenn ein stillgelegter Hof einen Platz freigemacht hat', () => {
    const hoefe = reihe(12)
    hoefe[4] = { ...hoefe[4], archivedAt: T(20) }

    expect(bekaemePlatzBeiFreigabe(hoefe)).toBe(true)
  })
})

// ─── Gründungs-Enddatum je Hof (Register K2, Nr. 62) ─────────────────────────

/** Wiener Ortszeit → Zeitpunkt, z. B. wien('2027-12-31', 23, 59). */
function wien(tag: string, stunde = 0, minute = 0): Date {
  const mitternacht = wienerMitternacht(tag)
  if (!mitternacht) throw new Error(`Ungültiger Tag im Test: ${tag}`)
  return new Date(mitternacht.getTime() + (stunde * 60 + minute) * 60_000)
}

/** Wie ein Hof aus der Datenbank kommt: Platz-Felder und die DATE-Spalte. */
function mitBis(h: HofFuerPlatz, gruendungBis: Date | null = null): HofFuerPlatz & { gruendungBis: Date | null } {
  return { ...h, gruendungBis }
}

describe('Standard-Enddatum der Gründungshöfe (K2)', () => {
  it('Wer den Standard ändert, schreibt vorher bestehende Zusagen je Hof fest (Migration mit Freigabe).', () => {
    // Stolperdraht: Jeder Hof mit null folgt dem Standard. Ändert sich der Tag
    // hier, ändert sich die Zusage aller dieser Höfe still mit (Register K2).
    expect(GRUENDUNG_BIS_STANDARD_TAG).toBe('2027-12-31')
    const quelle = readFileSync(join(process.cwd(), 'src', 'lib', 'gruendungshof.ts'), 'utf8')
    const kopf = quelle.slice(0, quelle.indexOf('import '))
    expect(kopf).toContain('Wer den Standard ändert, schreibt vorher bestehende Zusagen je Hof fest (Migration mit Freigabe).')
  })

  it('der Standard ist als Datum derselbe Wiener Kalendertag — nicht um einen Tag verschoben', () => {
    expect(kalendertagInWien(GRUENDUNG_BIS_STANDARD)).toBe(GRUENDUNG_BIS_STANDARD_TAG)
    expect(GRUENDUNG_BIS_STANDARD.toISOString()).toBe('2027-12-31T00:00:00.000Z')
  })

  it('bildeGruendungBis: ein Kalendertag wird zur Mitternacht UTC, wie die DATE-Spalte ihn liefert', () => {
    expect(bildeGruendungBis('2028-06-30').toISOString()).toBe('2028-06-30T00:00:00.000Z')
    expect(kalendertagInWien(bildeGruendungBis('2028-06-30'))).toBe('2028-06-30')
  })
})

describe('gruendungsKonditionenText — die Zusage K2 aus einer Quelle', () => {
  it('nennt das Datum lang und die normale Regel danach, ohne Provision und ohne „dauerhaft"', () => {
    const text = gruendungsKonditionenText(GRUENDUNG_BIS_STANDARD)
    expect(text).toBe(
      'Hofladen ohne Grundgebühr bis 31. Dezember 2027. Danach wählst du deinen Tarif – ohne Wahl bleibt Hoftor, kostenlos.'
    )
    expect(text).not.toMatch(/%|dauerhaft/)
  })

  it('verweist auf baueGruendungsZusage in konditionen.ts — kein zweiter Wortlaut', () => {
    const datum = bildeGruendungBis('2028-03-15')
    expect(gruendungsKonditionenText(datum)).toBe(baueGruendungsZusage(datum))
  })
})

describe('bestimmeGruendungBis — das wirksame Enddatum', () => {
  it('Gründungshof ohne eigenes Datum (null): der Standard', () => {
    const hoefe = reihe(3)
    expect(bestimmeGruendungBis(mitBis(hoefe[1]), hoefe)).toEqual(GRUENDUNG_BIS_STANDARD)
  })

  it('Gründungshof mit eigenem Datum: genau dieses, auch früher als der Standard', () => {
    const hoefe = reihe(3)
    expect(bestimmeGruendungBis(mitBis(hoefe[0], bildeGruendungBis('2028-06-30')), hoefe)).toEqual(bildeGruendungBis('2028-06-30'))
    expect(bestimmeGruendungBis(mitBis(hoefe[0], bildeGruendungBis('2027-03-31')), hoefe)).toEqual(bildeGruendungBis('2027-03-31'))
  })

  it('Platz 12 hat ein Datum, Platz 13 keins — auch mit eigenem Datum nicht', () => {
    const hoefe = reihe(13)
    expect(bestimmeGruendungBis(mitBis(hoefe[11]), hoefe)).toEqual(GRUENDUNG_BIS_STANDARD)
    expect(bestimmeGruendungBis(mitBis(hoefe[12], bildeGruendungBis('2028-06-30')), hoefe)).toBeNull()
  })

  it('wartende und stillgelegte Höfe haben keins', () => {
    const hoefe = [...reihe(2), hof('wartet', { approvedAt: null }), hof('still', { archivedAt: T(5) })]
    expect(bestimmeGruendungBis(mitBis(hoefe[2], bildeGruendungBis('2028-06-30')), hoefe)).toBeNull()
    expect(bestimmeGruendungBis(mitBis(hoefe[3]), hoefe)).toBeNull()
  })

  it('Tagesgrenze Wien: Der Standard gilt bis einschließlich 31.12.2027, 23:59 Uhr, nicht bis UTC-Mitternacht', () => {
    const hoefe = reihe(1)
    const bis = bestimmeGruendungBis(mitBis(hoefe[0]), hoefe)
    expect(bestimmeTarifZustand({ tarif: null, gruendungBis: bis }, wien('2027-12-31', 23, 59))).toBe('gruendungshof')
    expect(bestimmeTarifZustand({ tarif: null, gruendungBis: bis }, wien('2028-01-01'))).toBe('hoftor')
  })

  it('Tagesgrenze Wien bei eigenem Datum aus der DATE-Spalte (Sommerzeit)', () => {
    const hoefe = reihe(1)
    const bis = bestimmeGruendungBis(mitBis(hoefe[0], bildeGruendungBis('2028-06-30')), hoefe)
    // 30.6. 23:30 in Wien ist in UTC noch derselbe Tag, 1.7. 0:30 in Wien in UTC noch der 30.6.
    expect(bestimmeTarifZustand({ tarif: 'HOFLADEN', gruendungBis: bis }, wien('2028-06-30', 23, 30))).toBe('gruendungshof')
    expect(bestimmeTarifZustand({ tarif: 'HOFLADEN', gruendungBis: bis }, wien('2028-07-01', 0, 30))).toBe('hofladen')
  })
})

describe('verkuerztGruendung — früher als bisher braucht die Zustimmung des Hofs (K1)', () => {
  it('ein früherer Wiener Tag verkürzt, derselbe oder ein späterer nicht', () => {
    const bisher = bildeGruendungBis('2028-06-30')
    expect(verkuerztGruendung(bisher, bildeGruendungBis('2028-06-29'))).toBe(true)
    expect(verkuerztGruendung(bisher, bildeGruendungBis('2028-06-30'))).toBe(false)
    expect(verkuerztGruendung(bisher, bildeGruendungBis('2028-07-01'))).toBe(false)
  })

  it('vergleicht Kalendertage, nicht Zeitpunkte: Wiener Mitternacht und UTC-Mitternacht desselben Tags sind gleich', () => {
    expect(verkuerztGruendung(bildeGruendungBis('2027-12-31'), wien('2027-12-31'))).toBe(false)
  })

  it('dieselbe Regel auf Kalendertagen (Dialog); unlesbarer Text verkürzt nichts', () => {
    expect(verkuerztGruendungTag('2028-06-30', '2028-06-29')).toBe(true)
    expect(verkuerztGruendungTag('2028-06-30', '2028-06-30')).toBe(false)
    expect(verkuerztGruendungTag('2028-06-30', 'morgen')).toBe(false)
  })

  it('ohne bisheriges oder neues Datum (kein Gründungsplatz) verkürzt nichts', () => {
    expect(verkuerztGruendung(null, bildeGruendungBis('2027-01-01'))).toBe(false)
    expect(verkuerztGruendung(bildeGruendungBis('2028-06-30'), null)).toBe(false)
  })
})

describe('baueGruendungAnzeige — die Admin-Liste zeigt das wirksame Datum', () => {
  it('ohne eigenes Datum: Standard, lang geschrieben, Tag für die Vorbelegung', () => {
    const hoefe = reihe(2)
    expect(baueGruendungAnzeige(mitBis(hoefe[0]), hoefe)).toEqual({
      bisTag: '2027-12-31',
      bisText: '31. Dezember 2027',
      abweichend: false,
    })
  })

  it('mit eigenem Datum: dieses, als abweichend markiert', () => {
    const hoefe = reihe(2)
    expect(baueGruendungAnzeige(mitBis(hoefe[1], bildeGruendungBis('2028-06-30')), hoefe)).toEqual({
      bisTag: '2028-06-30',
      bisText: '30. Juni 2028',
      abweichend: true,
    })
  })

  it('ohne Gründungsplatz: nichts', () => {
    const hoefe = reihe(13)
    expect(baueGruendungAnzeige(mitBis(hoefe[12], bildeGruendungBis('2028-06-30')), hoefe)).toBeNull()
  })
})

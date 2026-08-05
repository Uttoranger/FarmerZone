/**
 * Tests für die Gründungsplatz-Vergabe.
 *
 * Reine Logik, keine Datenbank: die Funktionen bekommen eine Hofliste und
 * geben Plätze zurück. Geprüft wird das Verhalten an den Rändern —
 * Platz 12 gegen Platz 13, stillgelegte Höfe, und die deterministische
 * Sortierung bei gleichem Freigabezeitpunkt (genau der Fall, den der Backfill
 * dieses Sprints erzeugt: alle Bestandshöfe teilen sich eine Sekunde).
 */
import { describe, it, expect } from 'vitest'
import {
  gruendungsplaetze,
  gruendungsplatzVon,
  istGruendungshof,
  vergebeneGruendungsplaetze,
  bekaemePlatzBeiFreigabe,
  MAX_GRUENDUNGSHOEFE,
  GRUENDUNGS_PROVISION_PROZENT,
  GRUENDUNGSPHASE_ENDE,
  type HofFuerPlatz,
} from '@/lib/gruendungshof'

const T = (tag: number) => new Date(Date.UTC(2026, 0, tag, 12, 0, 0))

function hof(id: string, opts: Partial<HofFuerPlatz> = {}): HofFuerPlatz {
  return {
    id,
    approvedAt: opts.approvedAt !== undefined ? opts.approvedAt : T(1),
    createdAt: opts.createdAt ?? T(1),
    archivedAt: opts.archivedAt ?? null,
  }
}

/** n freigeschaltete Höfe, jeder einen Tag nach dem vorigen. */
function reihe(n: number): HofFuerPlatz[] {
  return Array.from({ length: n }, (_, i) => hof(`hof_${i + 1}`, { approvedAt: T(i + 1), createdAt: T(i + 1) }))
}

describe('Konstanten', () => {
  it('hält die Betreiber-Vorgabe fest', () => {
    expect(MAX_GRUENDUNGSHOEFE).toBe(12)
    expect(GRUENDUNGS_PROVISION_PROZENT).toBe(3)
    expect(GRUENDUNGSPHASE_ENDE.getUTCFullYear()).toBe(2029)
    expect(GRUENDUNGSPHASE_ENDE.getUTCMonth()).toBe(11) // Dezember
    expect(GRUENDUNGSPHASE_ENDE.getUTCDate()).toBe(31)
  })
})

describe('Platzvergabe', () => {
  it('vergibt Plätze in der Reihenfolge der Freigabe', () => {
    const hoefe = reihe(3)
    expect(gruendungsplatzVon('hof_1', hoefe)).toBe(1)
    expect(gruendungsplatzVon('hof_2', hoefe)).toBe(2)
    expect(gruendungsplatzVon('hof_3', hoefe)).toBe(3)
  })

  it('Hof auf Platz 12 ist Gründungshof, Platz 13 nicht mehr', () => {
    const hoefe = reihe(13)
    expect(gruendungsplatzVon('hof_12', hoefe)).toBe(12)
    expect(istGruendungshof('hof_12', hoefe)).toBe(true)

    expect(gruendungsplatzVon('hof_13', hoefe)).toBe(13)
    expect(istGruendungshof('hof_13', hoefe)).toBe(false)
  })

  it('zählt höchstens 12 vergebene Plätze, auch bei 20 Höfen', () => {
    expect(vergebeneGruendungsplaetze(reihe(20))).toBe(12)
    expect(vergebeneGruendungsplaetze(reihe(5))).toBe(5)
  })

  it('wartende Höfe (approvedAt = null) sind nicht im Rennen', () => {
    const hoefe = [
      hof('freigeschaltet', { approvedAt: T(1) }),
      hof('wartet', { approvedAt: null }),
    ]
    expect(gruendungsplatzVon('wartet', hoefe)).toBeNull()
    expect(istGruendungshof('wartet', hoefe)).toBe(false)
    expect(vergebeneGruendungsplaetze(hoefe)).toBe(1)
  })

  it('stillgelegte Höfe belegen keinen Platz und rücken die anderen auf', () => {
    const hoefe = [
      hof('a', { approvedAt: T(1), createdAt: T(1) }),
      hof('b', { approvedAt: T(2), createdAt: T(2), archivedAt: T(9) }),
      hof('c', { approvedAt: T(3), createdAt: T(3) }),
    ]
    expect(gruendungsplatzVon('b', hoefe)).toBeNull()
    // c rutscht auf Platz 2, weil b keinen Platz mehr blockiert
    expect(gruendungsplatzVon('c', hoefe)).toBe(2)
    expect(vergebeneGruendungsplaetze(hoefe)).toBe(2)
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
    // Der Backfill trägt allen Bestandshöfen denselben Zeitpunkt ein — ohne
    // stabile Rückfallebene wäre die Vergabe bei jedem Aufruf eine andere.
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
  })

  it('false, sobald alle 12 vergeben sind', () => {
    expect(bekaemePlatzBeiFreigabe(reihe(12))).toBe(false)
    expect(bekaemePlatzBeiFreigabe(reihe(30))).toBe(false)
  })

  it('true, wenn ein stillgelegter Hof einen Platz freigemacht hat', () => {
    const hoefe = reihe(12)
    hoefe[4] = { ...hoefe[4], archivedAt: T(20) }
    expect(bekaemePlatzBeiFreigabe(hoefe)).toBe(true)
  })
})

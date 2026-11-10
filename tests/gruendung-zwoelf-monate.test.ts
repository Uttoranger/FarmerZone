/**
 * Gründungszeit 12 Monate (Register N44, Lauf 30, Nr. 221).
 *
 * Ursache: K2 sagte 24 Monate und „Monate nur erhöhen“ — auch vor dem
 * Festschreiben, wo es noch keine Zusage nach Monaten gibt. So ließ sich der
 * Wert nicht auf 12 setzen, bevor die Zusagen festgeschrieben sind.
 *
 * Beweist:
 *  - Der Standard ist 12 (nur ohne Zeile; der Spalten-Default bleibt 24).
 *  - zusageEnde mit 12: Freischaltung vor bzw. am Tarifstart → 31.1.2028, am 12.3.2027 → 11.3.2028.
 *  - Die Folge für den Einzug der Bargebühr (A2): gruendungBis 31.1.2028 → Einzug ab 1.2.2028
 *    (Wiener Mitternacht) — einzugAbFuer ist unverändert, das ist nur der Beleg.
 *  - festschreibenListe mit 12 Monaten macht keine Zusage kürzer (K1): Wer das feste
 *    Ende 31.12.2027 hatte, behält mindestens das; wer später freigeschaltet wurde, bekommt
 *    das spätere Ende.
 *  - Senken vor dem Festschreiben geht, danach nicht (die Regel selbst: tests/plattform-einstellung.test.ts).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  GRUENDUNG_EINSTELLUNG_STANDARD,
  GRUENDUNG_MONATE_STANDARD,
  KEINE_GRUENDUNG_SEITEN,
  bildeGruendungBis,
  festschreibenListe,
  zusageEnde,
  type GruendungEinstellung,
  type HofFuerFolgen,
} from '@/lib/gruendungshof'
import { GRUENDUNG_EINSTELLUNG_FEHLER, PLATTFORM_EINSTELLUNG_STANDARD, pruefeGruendungEingabe } from '@/lib/plattform-einstellung'
import { einzugAbFuer } from '@/lib/plattformgebuehr'
import { wienerMitternacht } from '@/lib/wiener-tag'

const ZWOELF: GruendungEinstellung = { ...GRUENDUNG_EINSTELLUNG_STANDARD, plaetze: 12, monate: 12, aktionBisTag: '2027-03-31', festAm: null }

function hof(id: string, freigeschaltet: string, mehr: Partial<HofFuerFolgen> = {}): HofFuerFolgen {
  return {
    id,
    name: `Hof Test ${id}`,
    approvedAt: new Date(freigeschaltet),
    createdAt: new Date('2026-08-01T10:00:00Z'),
    archivedAt: null,
    gruendungAusgenommen: false,
    gruendungBis: null,
    gruendungPlatz: null,
    gruendungFest: false,
    ...mehr,
  }
}

describe('Standard 12 Monate (N44)', () => {
  it('ohne Zeile gelten 12 Monate — Einstellung, Fachregel und leere Seiten gleich', () => {
    expect(GRUENDUNG_MONATE_STANDARD).toBe(12)
    expect(PLATTFORM_EINSTELLUNG_STANDARD.gruendungMonate).toBe(12)
    expect(GRUENDUNG_EINSTELLUNG_STANDARD.monate).toBe(12)
    expect(KEINE_GRUENDUNG_SEITEN.monate).toBe(12)
  })

  it('der Spalten-Default bleibt 24 — keine Migration in diesem Lauf', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    expect(schema).toMatch(/^\s*gruendungMonate\s+Int\s+@default\(24\)\s*$/m)
  })
})

describe('zusageEnde mit 12 Monaten', () => {
  it('Freischaltung vor oder am Tarifstart: Ende 31. Jänner 2028', () => {
    expect(zusageEnde('2027-02-01', { monate: 12 })).toBe('2028-01-31')
    expect(zusageEnde('2026-11-04', { monate: 12 })).toBe('2028-01-31')
  })

  it('Freischaltung am 12. März 2027: Ende 11. März 2028', () => {
    expect(zusageEnde('2027-03-12', { monate: 12 })).toBe('2028-03-11')
  })
})

describe('Folge für den Einzug der Bargebühr (A2, nur Beleg — einzugAbFuer unverändert)', () => {
  it('gruendungBis 31.1.2028 → Einzug ab 1.2.2028 um Mitternacht in Wien', () => {
    const ab = einzugAbFuer({ einzugAb: null }, { hofpreisModellAb: null }, bildeGruendungBis('2028-01-31'))
    expect(ab).toEqual(wienerMitternacht('2028-02-01'))
  })

  it('Gegenprobe: mit dem festen Ende der Art „bisher“ (31.12.2027) wäre es der 1.1.2028', () => {
    const ab = einzugAbFuer({ einzugAb: null }, { hofpreisModellAb: null }, bildeGruendungBis('2027-12-31'))
    expect(ab).toEqual(wienerMitternacht('2028-01-01'))
  })
})

describe('festschreibenListe mit 12 Monaten — nie kürzer als bisher (K1)', () => {
  it('Hof mit festem Ende 31.12.2027 behält mindestens dieses, nie den früheren Tag aus 12 Monaten', () => {
    // Vor dem Tarifstart freigeschaltet: 12 Monate ergäben 31.1.2028, später als 31.12.2027 — also das.
    const [vorher] = festschreibenListe([hof('a', '2026-10-01T10:00:00Z')], ZWOELF)
    expect(vorher).toMatchObject({ bisherTag: '2027-12-31', neuTag: '2028-01-31' })
  })

  it('ein eigenes, späteres Ende bleibt; nie ein Tag weniger als bisher', () => {
    const hoefe = [
      hof('a', '2026-10-01T10:00:00Z', { gruendungBis: bildeGruendungBis('2029-06-30') }),
      hof('b', '2026-10-02T10:00:00Z'),
      hof('c', '2027-03-12T10:00:00Z'),
    ]
    const liste = festschreibenListe(hoefe, ZWOELF)
    expect(liste.map((z) => [z.id, z.bisherTag, z.neuTag])).toEqual([
      ['a', '2029-06-30', '2029-06-30'],
      ['b', '2027-12-31', '2028-01-31'],
      ['c', '2027-12-31', '2028-03-11'],
    ])
    for (const z of liste) if (z.bisherTag !== null) expect(z.neuTag >= z.bisherTag).toBe(true)
  })

  it('Gegenprobe: mit einem Monat läge der neue Tag vor dem bisherigen — die Liste nimmt trotzdem den bisherigen', () => {
    const [z] = festschreibenListe([hof('a', '2026-10-01T10:00:00Z')], { ...ZWOELF, monate: 1 })
    expect(zusageEnde('2026-10-01', { monate: 1 })).toBe('2027-02-28')
    expect(z).toMatchObject({ bisherTag: '2027-12-31', neuTag: '2027-12-31' })
  })
})

describe('Monate senken: vor dem Festschreiben ja, danach nein', () => {
  const jetzt = new Date('2026-11-04T10:00:00+01:00')
  const eingabe = { plaetze: 12, monate: 12, aktionBisTag: '2027-03-31', anzeige: true }
  const bisher: GruendungEinstellung = { ...ZWOELF, monate: 24 }

  it('24 → 12 vor dem Festschreiben in Ordnung', () => {
    expect(pruefeGruendungEingabe(eingabe, bisher, 0, jetzt)).toBeNull()
  })

  it('24 → 12 nach dem Festschreiben abgelehnt', () => {
    expect(pruefeGruendungEingabe(eingabe, { ...bisher, festAm: new Date('2026-11-01T10:00:00Z') }, 0, jetzt)).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.monateNurMehr(24))
  })
})

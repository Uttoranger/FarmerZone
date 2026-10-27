/**
 * Konto schließen (Register N36, Nachtlauf Nr. 190) — Regeln von Stufe 1 und
 * die Sperre von Stufe 2.
 *
 * Beweist:
 *  - Stufe 2 läuft nicht mit ENDGUELTIG_FREIGEGEBEN = false: die Konstante steht
 *    im Quelltext wörtlich auf `false` (Wache), das Aufräumen ruft
 *    schliesseFaelligeEndgueltig ohne eigene Freigabe, und die Funktion fragt
 *    die Datenbank dann gar nicht erst — Gegenprobe mit `freigegeben: true`;
 *  - ENDGUELTIG_LOESCHEN nennt jedes Feld, das schliesseEndgueltig am Hof
 *    überschreibt, und jede Tabelle, die sie leert (Quelltext-Abgleich);
 *  - Stufe 2 fasst nie Bestellungen, Positionen oder Beträge an;
 *  - Sperre bei offener Bestellung bzw. Erstattung, Hofname, 30 Tage;
 *  - hofSichtbar / HOF_SICHTBAR_WO: stillgelegt oder geschlossen = offline.
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findMany: vi.fn() } } }))

import { prisma } from '@/lib/prisma'
import { ENDGUELTIG_FREIGEGEBEN, ENDGUELTIG_LOESCHEN, blobOrdnerDesHofs, geschlosseneAdresse, schliesseFaelligeEndgueltig } from '@/lib/konto-schliessen'
import { endgueltigGrenze, hofnameBestaetigt, schliessenSperre, wiederOeffnenBis, wiederOeffnenMoeglich } from '@/lib/konto-anfragen'
import { HOF_SICHTBAR_WO, hofSichtbar } from '@/lib/hof-sichtbar'

const lies = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')
const QUELLE = lies('src/lib/konto-schliessen.ts')
const TAG = 24 * 60 * 60 * 1000

describe('Stufe 2 nur mit Freigabe', () => {
  it('ENDGUELTIG_FREIGEGEBEN ist heute false — wörtlich im Quelltext, mit dem Satz zur Freigabe', () => {
    expect(ENDGUELTIG_FREIGEGEBEN).toBe(false)
    expect(QUELLE).toMatch(/export const ENDGUELTIG_FREIGEGEBEN = false\n/)
    expect(QUELLE).toContain('Freigabe der Liste durch die Projektleitung nach Rückmeldung der Anwältin')
  })

  it('das Aufräumen ruft Stufe 2 ohne eigene Freigabe — es gilt der Code-Wert', () => {
    const aufraeumen = lies('src/server/aufraeumen.ts')
    expect(aufraeumen).toMatch(/await schliesseFaelligeEndgueltig\(jetzt\)\n/)
    expect(aufraeumen).not.toMatch(/freigegeben\s*:\s*true/)
  })

  it('ohne Freigabe: 0 und keine Abfrage; Gegenprobe mit freigegeben: true fragt die fälligen Höfe', async () => {
    vi.mocked(prisma.farm.findMany).mockResolvedValue([] as never)
    expect(await schliesseFaelligeEndgueltig(new Date())).toBe(0)
    expect(prisma.farm.findMany).not.toHaveBeenCalled()
    expect(await schliesseFaelligeEndgueltig(new Date('2026-10-27T00:00:00Z'), { freigegeben: true })).toBe(0)
    expect(prisma.farm.findMany).toHaveBeenCalledWith({
      where: { geschlossenAm: { not: null, lt: endgueltigGrenze(new Date('2026-10-27T00:00:00Z')) }, endgueltigAm: null },
      select: { id: true },
    })
  })
})

describe('ENDGUELTIG_LOESCHEN und schliesseEndgueltig stimmen überein', () => {
  const funktion = QUELLE.slice(QUELLE.indexOf('export async function schliesseEndgueltig'), QUELLE.indexOf('export async function schliesseFaelligeEndgueltig'))
  const liste = ENDGUELTIG_LOESCHEN.map((e) => e.was).join(' | ')

  it('jedes überschriebene Feld des Hofs steht in der Liste', () => {
    const daten = funktion.slice(funktion.indexOf('tx.farm.updateMany'), funktion.indexOf('if (count === 0)'))
    const felder = [...daten.matchAll(/^\s{8}(\w+):/gm)].map((m) => m[1])
    expect(felder.length).toBeGreaterThan(20)
    expect(felder.filter((f) => !liste.includes(f) && f !== 'bannerType')).toEqual([])
  })

  it('jede geleerte Tabelle steht in der Liste', () => {
    const tabellen = [...funktion.matchAll(/tx\.(\w+)\.deleteMany/g)].map((m) => m[1])
    const name = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
    expect(tabellen.filter((t) => !liste.includes(name(t)))).toEqual([])
  })

  it('nie Bestellungen, Positionen, Beträge, Monatsabrechnungen oder Verkäufe vor Ort', () => {
    expect(funktion).not.toMatch(/tx\.(order|orderItem|monatsabrechnung|manualSale)\./)
  })

  it('Bild-Speicher: genau die beiden Ordner des Hofs; Platzhalter-Adresse nie zustellbar', () => {
    expect(blobOrdnerDesHofs('f1')).toEqual(['originals/f1/', 'farms/f1/'])
    expect(liste).toContain('originals/<farmId>/')
    expect(liste).toContain('farms/<farmId>/')
    expect(geschlosseneAdresse('U1')).toBe('geschlossen-u1@geschlossen.invalid')
  })
})

describe('Stufe 1: Regeln', () => {
  it('offene Bestellung oder Erstattung sperrt — mit Grund; sonst null', () => {
    expect(schliessenSperre({ bestellungen: 0, erstattungen: 0 })).toBeNull()
    expect(schliessenSperre({ bestellungen: 1, erstattungen: 0 })).toContain('1 Bestellung ist noch offen')
    expect(schliessenSperre({ bestellungen: 0, erstattungen: 2 })).toContain('2 Erstattungen sind offen')
    expect(schliessenSperre({ bestellungen: 2, erstattungen: 1 })).toMatch(/^Geht noch nicht: 2 Bestellungen sind noch offen und 1 Erstattung ist offen\./)
  })

  it('Hofname: ohne Rücksicht auf Groß-/Kleinschreibung und Ränder, nie leer', () => {
    expect(hofnameBestaetigt('  hof am bach ', 'Hof am Bach')).toBe(true)
    expect(hofnameBestaetigt('Hof am Berg', 'Hof am Bach')).toBe(false)
    expect(hofnameBestaetigt('', '')).toBe(false)
  })

  it('wieder öffnen 30 Tage lang, nie nach Stufe 2', () => {
    const zu = new Date('2026-10-01T10:00:00.000Z')
    expect(wiederOeffnenBis(zu)?.getTime()).toBe(zu.getTime() + 30 * TAG)
    expect(wiederOeffnenMoeglich({ geschlossenAm: zu, endgueltigAm: null }, new Date(zu.getTime() + 29 * TAG))).toBe(true)
    expect(wiederOeffnenMoeglich({ geschlossenAm: zu, endgueltigAm: null }, new Date(zu.getTime() + 30 * TAG))).toBe(false)
    expect(wiederOeffnenMoeglich({ geschlossenAm: zu, endgueltigAm: new Date() }, new Date(zu.getTime() + TAG))).toBe(false)
    expect(wiederOeffnenMoeglich({ geschlossenAm: null, endgueltigAm: null }, zu)).toBe(false)
  })
})

describe('hofSichtbar', () => {
  it('stillgelegt oder geschlossen ist offline; sonst sichtbar', () => {
    const d = new Date()
    expect(hofSichtbar({ archivedAt: null, geschlossenAm: null })).toBe(true)
    expect(hofSichtbar({ archivedAt: d, geschlossenAm: null })).toBe(false)
    expect(hofSichtbar({ archivedAt: null, geschlossenAm: d })).toBe(false)
    expect(HOF_SICHTBAR_WO).toEqual({ archivedAt: null, geschlossenAm: null })
  })
})

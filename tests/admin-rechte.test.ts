/**
 * Rechte je Person im Admin-Bereich (Register N35, Nr. 188) — die reine
 * Funktion `darf` für alle Rechte, für Inhaber und Nicht-Inhaber. Die Wache
 * selbst (Recht frisch aus der Datenbank, Satz bzw. Umleitung) prüft
 * tests/admin-wache.test.ts, die Actions tests/admin-protokoll.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { ADMIN_RECHTE, ADMIN_RECHT_TEXT, INHABER_RECHTE, darf, eingestellteRechte, type AdminRecht } from '@/lib/admin-rechte'

const ALLE: AdminRecht[] = ['ansehen', ...ADMIN_RECHTE, ...INHABER_RECHTE]

describe('darf (N35)', () => {
  it('es gibt 8 einstellbare Rechte und 2 nur für Inhaber — jedes mit einem Wort für die Oberfläche', () => {
    expect(ADMIN_RECHTE).toHaveLength(8)
    expect(INHABER_RECHTE).toEqual(['team', 'notfallzugang'])
    expect(Object.keys(ADMIN_RECHT_TEXT).sort()).toEqual([...ALLE].sort())
  })

  it.each(ALLE)('Inhaber darf %s — auch mit leerer Liste', (recht) => {
    expect(darf({ adminInhaber: true, adminRechte: [] }, recht)).toBe(true)
  })

  it('ohne Rechte darf eine Person nur ansehen', () => {
    const person = { adminInhaber: false, adminRechte: [] }
    expect(ALLE.filter((r) => darf(person, r))).toEqual(['ansehen'])
  })

  it.each(ADMIN_RECHTE)('Nicht-Inhaber mit genau „%s“ darf das und ansehen — sonst nichts', (recht) => {
    const person = { adminInhaber: false, adminRechte: [recht] }
    expect(ALLE.filter((r) => darf(person, r))).toEqual(['ansehen', recht])
  })

  it('Inhaber-Rechte sind nie weitergebbar: stehen sie in der Liste, geben sie trotzdem nichts frei', () => {
    const person = { adminInhaber: false, adminRechte: ['team', 'notfallzugang', 'unbekannt'] }
    expect(darf(person, 'team')).toBe(false)
    expect(darf(person, 'notfallzugang')).toBe(false)
    // Gegenprobe: dieselbe Person als Inhaberin darf es.
    expect(darf({ ...person, adminInhaber: true }, 'team')).toBe(true)
  })

  it('eingestellteRechte: feste Reihenfolge, ohne Unbekanntes und Doppeltes; Inhaber hat alle', () => {
    expect(eingestellteRechte({ adminInhaber: false, adminRechte: ['geld', 'unbekannt', 'mails_nochmal', 'geld', 'team'] })).toEqual(['mails_nochmal', 'geld'])
    expect(eingestellteRechte({ adminInhaber: true, adminRechte: [] })).toEqual([...ADMIN_RECHTE])
  })
})

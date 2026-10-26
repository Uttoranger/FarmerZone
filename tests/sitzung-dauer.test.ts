/**
 * Höchstdauer einer Sitzung (Register S18, Nr. 178) — die reine Regel in
 * src/lib/sitzung-dauer.ts und ihre Verdrahtung in src/lib/auth.ts.
 *
 * Beweist:
 *  - Hof und Kundin: 30 Tage ab der Anmeldung; 29 Tage gilt, genau 30 Tage
 *    und 31 Tage nicht mehr. Konto mit der Rolle ADMIN: 12 Stunden wie N20.
 *  - Die Rolle des Kontos wählt die Grenze (nur ADMIN wird kürzer).
 *  - Better Auth verlängert weiter höchstens 7 Tage je Auffrischen (nichts
 *    wird länger), und auth.ts prüft die Regel auf `/get-session` (hooks.after)
 *    und auf jedem anderen Weg (hooks.before) — Gegenprobe gegen eine Fassung
 *    ohne die Prüfung.
 *  - Der Satz unter „Angemeldete Geräte" nennt die 30 Tage.
 * Was gegen die echte Datenbank passiert (gelöscht, abgemeldet), prüft
 * tests/integration/sitzung-dauer.int.test.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { SITZUNG_DAUER_SATZ, SITZUNG_HOECHSTENS_TAGE, sitzungAbgelaufen, sitzungRolle } from '@/lib/sitzung-dauer'
import { ADMIN_SITZUNG_STUNDEN } from '@/lib/admin-anmeldung'

const TAG = 24 * 60 * 60 * 1000
const JETZT = new Date('2026-10-26T10:00:00.000Z')
const vor = (ms: number): Date => new Date(JETZT.getTime() - ms)

describe('sitzungAbgelaufen', () => {
  it('Hof und Kundin: 29 Tage gilt, 30 und 31 Tage nicht mehr', () => {
    expect(SITZUNG_HOECHSTENS_TAGE).toBe(30)
    expect(sitzungAbgelaufen(vor(29 * TAG), JETZT, 'konto')).toBe(false)
    expect(sitzungAbgelaufen(vor(30 * TAG - 1), JETZT, 'konto')).toBe(false)
    expect(sitzungAbgelaufen(vor(30 * TAG), JETZT, 'konto')).toBe(true)
    expect(sitzungAbgelaufen(vor(31 * TAG), JETZT, 'konto')).toBe(true)
  })

  it('Rolle ADMIN: 12 Stunden (N20) — Gegenprobe: dieselbe Sitzung gilt für ein Konto ohne die Rolle', () => {
    expect(ADMIN_SITZUNG_STUNDEN).toBe(12)
    const dreizehnStunden = vor(13 * 60 * 60 * 1000)
    expect(sitzungAbgelaufen(dreizehnStunden, JETZT, 'admin')).toBe(true)
    expect(sitzungAbgelaufen(vor(11 * 60 * 60 * 1000), JETZT, 'admin')).toBe(false)
    expect(sitzungAbgelaufen(dreizehnStunden, JETZT, 'konto')).toBe(false)
  })

  it('die Rolle des Kontos wählt die Grenze: nur ADMIN ist kürzer', () => {
    expect(sitzungRolle('ADMIN')).toBe('admin')
    for (const rolle of ['FARMER', 'CUSTOMER', undefined, null, 42]) expect(sitzungRolle(rolle)).toBe('konto')
  })

  it('der Satz unter „Angemeldete Geräte" nennt die Höchstdauer', () => {
    expect(SITZUNG_DAUER_SATZ).toContain('30 Tage angemeldet')
  })
})

describe('Verdrahtung in auth.ts', () => {
  const quelle = readFileSync(join(process.cwd(), 'src/lib/auth.ts'), 'utf8')

  it('keine Sitzung wird länger: 7 Tage, täglich aufgefrischt, kein Cookie-Cache', async () => {
    const { auth } = await import('@/lib/auth')
    expect(auth.options.session?.expiresIn).toBe(7 * 24 * 60 * 60)
    expect(auth.options.session?.updateAge).toBe(24 * 60 * 60)
    expect(auth.options.session?.cookieCache?.enabled).toBe(false)
  }, 30_000)

  /** Ob eine Fassung von auth.ts die Höchstdauer an beiden Stellen prüft. */
  const prueftBeides = (text: string): boolean =>
    /if \(ctx\.path !== '\/get-session'\) await beendeZuAlteSitzung\(ctx\)/.test(text) &&
    /case '\/get-session': \{[\s\S]{0,300}sitzungZuAlt\(gelesen, new Date\(\)\)[\s\S]{0,120}beendeSitzung\(ctx, gelesen\)[\s\S]{0,60}return ctx\.json\(null\)/.test(text)

  it('hooks.before prüft jeden Weg außer /get-session, hooks.after /get-session — und löscht samt Cookie', () => {
    expect(prueftBeides(quelle)).toBe(true)
    expect(quelle).toMatch(/prisma\.session\.deleteMany\(\{ where: \{ id: gelesen\.session\.id, userId: gelesen\.session\.userId \} \}\)\n\s+deleteSessionCookie\(ctx\)/)
  })

  it('Gegenprobe: ohne die Prüfung im after-Hook schlägt die Erkennung an', () => {
    expect(prueftBeides(quelle.replace('case \'/get-session\': {', 'case \'/get-sessionX\': {'))).toBe(false)
    expect(prueftBeides(quelle.replace("if (ctx.path !== '/get-session') await beendeZuAlteSitzung(ctx)", ''))).toBe(false)
  })
})

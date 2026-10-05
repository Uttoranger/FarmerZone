/**
 * Tests für die Reiter der AdminShell (src/lib/admin-navigation.ts).
 *
 * Beweist: Höfe · Briefkasten · Finanzen auf die bestehenden Admin-Seiten,
 * Höfe und Briefkasten mit Zähler; der Weg zurück zum eigenen Hof; aktiv ist
 * der längste passende Reiter.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ADMIN_REITER, ADMIN_ZURUECK, adminAktiverReiter } from '@/lib/admin-navigation'

describe('Admin-Reiter', () => {
  it('Höfe · Briefkasten · Finanzen, Zähler an Höfe und Briefkasten', () => {
    expect(ADMIN_REITER.map((r) => [r.label, r.href, r.zahl])).toEqual([
      ['Höfe', '/admin', 'hoefe'],
      ['Briefkasten', '/admin/meldungen', 'briefkasten'],
      ['Finanzen', '/admin/finanzen', undefined],
    ])
  })

  it('jeder Reiter zeigt auf eine bestehende Admin-Seite', () => {
    const ordner = readdirSync(join(process.cwd(), 'src/app/admin'))
    for (const r of ADMIN_REITER.slice(1)) expect(ordner).toContain(r.href.split('/')[2])
  })

  it('„← Zu meinem Hof" führt nach Heute', () => {
    expect(ADMIN_ZURUECK).toEqual({ label: 'Zu meinem Hof', kurz: 'Mein Hof', href: '/dashboard' })
  })

  it.each([
    ['/admin', 'hoefe'],
    ['/admin/meldungen', 'briefkasten'],
    ['/admin/meldungen/abc', 'briefkasten'],
    ['/admin/finanzen', 'finanzen'],
    ['/dashboard', null],
    ['/adminx', null],
  ])('%s → %s', (pfad, id) => {
    expect(adminAktiverReiter(pfad)).toBe(id)
  })
})

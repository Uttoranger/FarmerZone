/**
 * Tests für die Reiter der AdminShell (src/lib/admin-navigation.ts).
 *
 * Beweist: Höfe · Briefkasten · Finanzen auf die bestehenden Admin-Seiten,
 * Höfe und Briefkasten mit Zähler; der Weg zurück zum eigenen Hof und die
 * Konto-Plakette nur mit eigenem Hof (Nr. 41, Register N1); aktiv ist der
 * längste passende Reiter.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ADMIN_KONTO, ADMIN_REITER, ADMIN_ZURUECK, adminAktiverReiter, kontoHatHof } from '@/lib/admin-navigation'

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

  it('die Konto-Plakette führt zu „Konto und Sicherheit" — eine Seite, die es gibt', () => {
    expect(ADMIN_KONTO).toEqual({ label: 'Konto und Sicherheit', href: '/settings/account' })
    expect(existsSync(join(process.cwd(), 'src/app/(hof)/settings/account/page.tsx'))).toBe(true)
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

describe('kontoHatHof — „← Mein Hof" und die Konto-Plakette als Link nur mit eigenem Hof', () => {
  it('Betreiber mit eigenem Hof (Rolle FARMER, Hof vorhanden): ja', () => {
    expect(kontoHatHof({ rolle: 'FARMER', hofVorhanden: true })).toBe(true)
  })

  it('Betreiber ohne Hof (Rolle CUSTOMER wie im Seed): nein — /dashboard schickte ihn auf /login', () => {
    expect(kontoHatHof({ rolle: 'CUSTOMER', hofVorhanden: false })).toBe(false)
  })

  it('Rolle FARMER ohne Hof (noch nicht eingerichtet): nein — der Hofbereich führt dann erst nach /onboarding', () => {
    expect(kontoHatHof({ rolle: 'FARMER', hofVorhanden: false })).toBe(false)
  })

  it('ein Hof an einem Konto ohne Rolle FARMER öffnet den Hofbereich nicht — kein Weg ins Leere', () => {
    expect(kontoHatHof({ rolle: 'CUSTOMER', hofVorhanden: true })).toBe(false)
    expect(kontoHatHof({ rolle: 'ADMIN', hofVorhanden: true })).toBe(false)
    expect(kontoHatHof({ rolle: null, hofVorhanden: true })).toBe(false)
  })
})

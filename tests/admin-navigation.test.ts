/**
 * Tests für die Reiter der AdminShell (src/lib/admin-navigation.ts).
 *
 * Beweist: Höfe · Postfach · Startseite · Finanzen · Einstellungen (Register
 * N15, Nr. 94) auf die Admin-Seiten, Höfe und Postfach mit Zähler; die
 * Einstellungen-Seite liefert Nr. 93, bis zum Merge zeigt der Reiter dorthin;
 * der Weg zurück zum eigenen Hof und die
 * Konto-Plakette nur mit eigenem Hof (Nr. 41, Register N1); aktiv ist der
 * längste passende Reiter. Seit Nr. 87 (Register N12) hat das Postfach drei
 * Reiter unter /admin/postfach; auf /admin/meldungen (Umleitung) und der
 * Detailseite einer Meldung bleibt es aktiv.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ADMIN_KONTO, ADMIN_REITER, ADMIN_ZURUECK, adminAktiverReiter, kontoHatHof } from '@/lib/admin-navigation'

describe('Admin-Reiter', () => {
  it('Höfe · Postfach · Startseite · Finanzen · Einstellungen, Zähler an Höfe und Postfach', () => {
    expect(ADMIN_REITER.map((r) => [r.id, r.label, r.href, r.zahl])).toEqual([
      ['hoefe', 'Höfe', '/admin', 'hoefe'],
      ['postfach', 'Postfach', '/admin/postfach', 'briefkasten'],
      ['startseite', 'Startseite', '/admin/startseite', undefined],
      ['finanzen', 'Finanzen', '/admin/finanzen', undefined],
      ['einstellungen', 'Einstellungen', '/admin/einstellungen', undefined],
    ])
  })

  it('jeder Reiter zeigt auf eine bestehende Admin-Seite — die Einstellungen liefert Nr. 93 (bis zum Merge zeigt der Reiter dorthin)', () => {
    const ordner = readdirSync(join(process.cwd(), 'src/app/admin'))
    const kommtSpaeter = new Set(['einstellungen'])
    for (const r of ADMIN_REITER.slice(1)) {
      const segment = r.href.split('/')[2]
      if (kommtSpaeter.has(segment)) continue
      expect(ordner).toContain(segment)
    }
    // Gegenprobe: Der Platzhalter der Startseite ist keine Ausnahme, die Seite steht da.
    expect(existsSync(join(process.cwd(), 'src/app/admin/startseite/page.tsx'))).toBe(true)
  })

  it('die Betriebsleiste führt keinen Weg zur Testumgebung mehr (Z3-Korrektur)', async () => {
    const navigation = await import('@/lib/admin-navigation')
    expect(Object.keys(navigation)).not.toContain('ADMIN_TESTUMGEBUNG')
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
    ['/admin/postfach', 'postfach'],
    ['/admin/meldungen', 'postfach'],
    ['/admin/meldungen/abc', 'postfach'],
    ['/admin/finanzen', 'finanzen'],
    ['/admin/startseite', 'startseite'],
    ['/admin/einstellungen', 'einstellungen'],
    ['/admin/einstellungen/betrieb', 'einstellungen'],
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

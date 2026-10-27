/**
 * Tests für die Reiter der AdminShell (src/lib/admin-navigation.ts).
 *
 * Beweist (Register N32, Nr. 193): Heute · Höfe · Bestellungen · Postfach ·
 * Startseite · Geld · Betrieb · Einstellungen auf bestehende Admin-Seiten;
 * Zahlen an Heute (offen), Höfe (warten) und Postfach (ungelesen), der Punkt
 * nur an Betrieb; am Handy die ersten vier in der Leiste, der Rest im Blatt
 * „Mehr“; ein Reiter ohne Recht wird nicht gezeigt (N35) — mit Gegenprobe;
 * der Weg zurück zum eigenen Hof und die Konto-Plakette nur mit eigenem Hof
 * (Nr. 41, Register N1); aktiv ist der längste passende Reiter, Heute nur auf
 * /admin selbst. Seit Nr. 87 (Register N12) bleibt das Postfach auf
 * /admin/meldungen (Umleitung) und der Detailseite einer Meldung aktiv.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ADMIN_HANDBUCH,
  ADMIN_KONTO,
  ADMIN_MEHR_ZEILE,
  ADMIN_REITER,
  ADMIN_ZURUECK,
  adminAktiverReiter,
  kontoHatHof,
  sichtbareReiter,
} from '@/lib/admin-navigation'
import { PR_BASIS_URL } from '@/lib/meldung'

describe('Admin-Reiter', () => {
  it('Heute · Höfe · Bestellungen · Postfach · Startseite · Geld · Betrieb · Einstellungen, Zahlen an Heute, Höfe und Postfach, der Punkt nur an Betrieb', () => {
    expect(ADMIN_REITER.map((r) => [r.id, r.label, r.href, r.zahl, r.warnpunkt, r.amHandy])).toEqual([
      ['heute', 'Heute', '/admin', 'heute', undefined, 'leiste'],
      ['hoefe', 'Höfe', '/admin/hoefe', 'hoefe', undefined, 'leiste'],
      ['bestellungen', 'Bestellungen', '/admin/bestellungen', undefined, undefined, 'leiste'],
      ['postfach', 'Postfach', '/admin/postfach', 'postfach', undefined, 'leiste'],
      ['startseite', 'Startseite', '/admin/startseite', undefined, undefined, 'mehr'],
      ['geld', 'Geld', '/admin/geld', undefined, undefined, 'mehr'],
      ['betrieb', 'Betrieb', '/admin/betrieb', undefined, true, 'mehr'],
      ['einstellungen', 'Einstellungen', '/admin/einstellungen', undefined, undefined, 'mehr'],
    ])
  })

  it('jeder Reiter zeigt auf eine bestehende Admin-Seite, und sein Recht ist das Recht der Seite', () => {
    for (const r of ADMIN_REITER) {
      const datei = join(process.cwd(), 'src/app', r.href, 'page.tsx')
      expect(existsSync(datei), r.href).toBe(true)
      const quelle = readFileSync(datei, 'utf8')
      // Die ERSTE Wache der Seite zählt (Einstellungen prüft „team“ erst für die Gruppe Team).
      const nach = quelle.slice(quelle.indexOf('verlangeAdminSeite(') + 'verlangeAdminSeite('.length)
      const verlangt = /^\{ recht: '([a-z_]+)' \}\)/.exec(nach)?.[1] ?? 'ansehen'
      expect(r.recht, r.href).toBe(verlangt)
    }
  })

  it('ohne Recht kein Reiter (N35): ohne „Geld“ fehlt Geld, alles mit „ansehen“ bleibt; Inhaber sehen alle', () => {
    expect(sichtbareReiter({ adminInhaber: false, adminRechte: [] })).toEqual(['heute', 'hoefe', 'bestellungen', 'postfach', 'startseite', 'betrieb', 'einstellungen'])
    // Gegenprobe: mit dem Recht ist der Reiter da, Inhaber sehen ohnehin alles.
    expect(sichtbareReiter({ adminInhaber: false, adminRechte: ['geld'] })).toContain('geld')
    expect(sichtbareReiter({ adminInhaber: true, adminRechte: [] })).toEqual(ADMIN_REITER.map((r) => r.id))
  })

  it('am Handy stehen genau vier Reiter in der Leiste, dazu „Mehr“ — im Blatt je eine Zeile', () => {
    expect(ADMIN_REITER.filter((r) => r.amHandy === 'leiste')).toHaveLength(4)
    for (const r of ADMIN_REITER.filter((r) => r.amHandy === 'mehr')) expect(ADMIN_MEHR_ZEILE[r.id], r.id).toBeTruthy()
    // Das öffentliche Repository (dieselbe Quelle wie die PR-Links der Meldungen), Datei docs/betrieb/handbuch.md.
    expect(ADMIN_HANDBUCH.href).toBe(`${PR_BASIS_URL.replace(/\/pull\/$/, '')}/blob/main/docs/betrieb/handbuch.md`)
    expect(ADMIN_HANDBUCH.href).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/main\/docs\/betrieb\/handbuch\.md$/)
    expect(existsSync(join(process.cwd(), 'docs/betrieb/handbuch.md'))).toBe(true)
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
    ['/admin', 'heute'],
    ['/admin/einrichten', null],
    ['/admin/hoefe', 'hoefe'],
    ['/admin/hoefe/abc', 'hoefe'],
    ['/admin/bestellungen', 'bestellungen'],
    ['/admin/postfach', 'postfach'],
    ['/admin/meldungen', 'postfach'],
    ['/admin/meldungen/abc', 'postfach'],
    ['/admin/geld', 'geld'],
    ['/admin/finanzen', 'geld'],
    ['/admin/startseite', 'startseite'],
    ['/admin/einstellungen', 'einstellungen'],
    ['/admin/einstellungen/anmeldung', 'einstellungen'],
    ['/admin/betrieb', 'betrieb'],
    ['/admin/betrieb/export', 'betrieb'],
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

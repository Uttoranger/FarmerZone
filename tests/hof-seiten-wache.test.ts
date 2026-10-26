/**
 * Jede Seite unter src/app/(hof) und src/app/(druck) (die Druckseiten, seit
 * Nr. 181 ohne Ausnahme) prüft Sitzung und Hof über EINE Wache
 * (`verlangeHofDerSitzung`, src/server/hofbereich.ts; Nr. 156).
 *
 * Warum in jeder Seite und nicht nur im Layout: Ein Layout rendert beim
 * Wechsel zwischen Seiten im Browser nicht neu. Warum EINE Wache: Vorher
 * leiteten fünf Seiten ohne Hof auf /login statt /onboarding, eine gab eine
 * leere Seite zurück, und keine kannte den Rücksprung. Das Verhalten der
 * Wache selbst prüft tests/hof-ruecksprung.test.ts; hier steht, dass jede
 * Seite sie benutzt und keine eigene Umleitung zur Anmeldung baut.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const APP = join(process.cwd(), 'src/app')
const GRUPPEN = ['(hof)', '(druck)'] as const

function seiten(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return seiten(pfad)
    return name === 'page.tsx' ? [pfad] : []
  })
}

/** Reine Umleitungen ohne eigene Daten — der Proxy und die Zielseite prüfen. */
const NUR_UMLEITUNG = ['analytics/umfeld/page.tsx', 'settings/appearance/page.tsx', 'status/page.tsx']

// Namen relativ zur Gruppe; die Gruppe steht für die Meldung davor.
const alle = GRUPPEN.flatMap((gruppe) =>
  seiten(join(APP, gruppe)).map((pfad) => ({ gruppe, name: relative(join(APP, gruppe), pfad), quelle: readFileSync(pfad, 'utf8') }))
)

describe('Seiten unter (hof)', () => {
  it('findet die Seiten (Gegenprobe gegen eine leere Liste)', () => {
    expect(alle.length).toBeGreaterThan(20)
    expect(alle.map((s) => s.name)).toContain('orders/[orderId]/page.tsx')
    // Die Druckseiten gehören dazu — ohne Ausnahme.
    expect(alle.filter((s) => s.gruppe === '(druck)').map((s) => s.name).sort()).toEqual([
      'orders/[orderId]/print/page.tsx',
      'orders/today/print/page.tsx',
    ])
  })

  it.each(alle.filter((s) => s.gruppe === '(hof)' && NUR_UMLEITUNG.includes(s.name)))('$name ist eine reine Umleitung ohne Daten', ({ quelle }) => {
    expect(quelle).not.toMatch(/prisma|getSession|from '@\/server\//)
  })

  it.each(alle.filter((s) => s.gruppe === '(druck)' || !NUR_UMLEITUNG.includes(s.name)))('$gruppe/$name ruft verlangeHofDerSitzung als Wache', ({ quelle }) => {
    expect(quelle).toContain("from '@/server/hofbereich'")
    expect(quelle).toMatch(/await verlangeHofDerSitzung\(\)/)
    // Keine eigene Umleitung zur Anmeldung: Sie verlöre den Rücksprung.
    expect(quelle).not.toMatch(/redirect\(\s*['"`]\/login/)
    // Nie eine leere Seite statt einer Umleitung.
    expect(quelle).not.toMatch(/if \(!farm\) return null/)
  })

  it.each(alle.filter((s) => s.gruppe === '(druck)' || !NUR_UMLEITUNG.includes(s.name)))('$gruppe/$name holt die Sitzung höchstens nach der Wache', ({ quelle }) => {
    const wache = quelle.indexOf('await verlangeHofDerSitzung()')
    const sitzung = quelle.indexOf('auth.api.getSession')
    if (sitzung !== -1) expect(sitzung).toBeGreaterThan(wache)
  })
})

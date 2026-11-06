import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Das Prüfwerkzeug bleibt draußen (freigabe.md §36, Nr. 243): Keine Datei der
 * App, des Schemas oder der Next-Konfiguration importiert scripts/pruefung/,
 * und kein Bau-, Deploy-, Install- oder Seed-Skript ruft den Prüf-Seed. Der
 * Prüf-Passkey entsteht nur von Hand in einer lokalen Wegwerf-DB (N46).
 */

const WURZEL = process.cwd()

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return /\.(ts|tsx|js|mjs|cjs|prisma|sql)$/.test(name) ? [pfad] : []
  })
}

const VERWEIS = /scripts\/pruefung|pruef-seed|pruefung\/sperre|passkey-browser/

describe('Grenze des Prüfwerkzeugs', () => {
  it('src/, prisma/ und next.config.ts verweisen nicht auf scripts/pruefung/', () => {
    const treffer = [...dateien(join(WURZEL, 'src')), ...dateien(join(WURZEL, 'prisma')), join(WURZEL, 'next.config.ts')]
      .filter((pfad) => VERWEIS.test(readFileSync(pfad, 'utf8')))
      .map((pfad) => pfad.slice(WURZEL.length + 1))
    expect(treffer).toEqual([])
  })

  it('pruefen:seed kommt in build, vercel-build, postinstall und db:seed nicht vor', () => {
    const skripte = (JSON.parse(readFileSync(join(WURZEL, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts
    expect(skripte['pruefen:seed']).toBe('tsx scripts/pruefung/pruef-seed.ts')
    for (const name of ['build', 'vercel-build', 'postinstall', 'prebuild', 'db:seed', 'start', 'dev']) {
      const befehl = skripte[name] ?? ''
      expect(befehl, name).not.toMatch(/pruefen:seed|pruef-seed|scripts\/pruefung/)
    }
  })

  it('pruefen:doku ruft genau die drei Doku-Wachen', () => {
    const skripte = (JSON.parse(readFileSync(join(WURZEL, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts
    expect(skripte['pruefen:doku']).toBe(
      'vitest run tests/telefonnummern-wache.test.ts tests/doku-doppelte-absaetze.test.ts tests/wortliste.test.ts'
    )
  })
})

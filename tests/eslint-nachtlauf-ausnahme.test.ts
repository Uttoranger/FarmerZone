import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * Die Ablagen des Prüfwerkzeugs unter `.nachtlauf/` (gitignored) gehören nicht zum Quelltext: Läuft ein
 * Fotograf im Worktree, liegt unter `.nachtlauf/fotograf/<n>/.next` eine Kopie des Baus, und `pnpm lint`
 * prüfte sie mit — der volle Lauf wurde rot (Zwischen-Morgenbericht 33 B, Regelvorschlag 1, freigegeben
 * 9.11.2026). Geprüft an der echten Konfiguration über die ESLint-API, ohne Dateien anzulegen.
 */
let eslint: ESLint

beforeAll(() => {
  eslint = new ESLint({ cwd: process.cwd() })
})

describe('eslint-Konfiguration: Ablagen des Prüfwerkzeugs', () => {
  it.each([
    '.nachtlauf/fotograf/1/.next/server/app/page.js',
    '.nachtlauf/fotograf/1/server.ts',
    '.nachtlauf/browser/b1/Default/Extensions/x.js',
  ])('ignoriert %s', async (pfad) => {
    expect(await eslint.isPathIgnored(pfad)).toBe(true)
  })

  it('prüft Quelltext und Skripte weiter', async () => {
    expect(await eslint.isPathIgnored('src/lib/geld.ts')).toBe(false)
    expect(await eslint.isPathIgnored('scripts/pruefung/db-schalter.ts')).toBe(false)
  })
})

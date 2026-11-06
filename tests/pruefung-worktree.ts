import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Ein Temp-Ordner, der für das Prüfwerkzeug wie ein Worktree aussieht: eine
 * echte Kopie von scripts/pruefung/ und Verweise auf die Teile des Klons, die
 * das Werkzeug liest (node_modules, src, prisma, package.json, tsconfig.json —
 * keiner davon ist ein .env-Verweis). Das Werkzeug leitet seinen Worktree aus
 * dem eigenen Pfad ab und prüft ihn ohne Ausnahme; so läuft es in Tests gegen
 * diesen Ordner statt gegen den Klon, in dem .env.local oder .env.test liegen
 * dürfen (Gegenlesen Runde 2).
 */

const KLON = process.cwd()
const VERWEISE = ['node_modules', 'src', 'prisma', 'package.json', 'tsconfig.json'] as const

export type TempWorktree = { ordner: string; skript: (name: string) => string; weg: () => void }

export function tempWorktree(praefix = 'pruefung-wt-'): TempWorktree {
  const ordner = mkdtempSync(join(tmpdir(), praefix))
  mkdirSync(join(ordner, 'scripts'))
  cpSync(join(KLON, 'scripts', 'pruefung'), join(ordner, 'scripts', 'pruefung'), { recursive: true })
  for (const teil of VERWEISE) symlinkSync(join(KLON, teil), join(ordner, teil))
  return {
    ordner,
    skript: (name) => join(ordner, 'scripts', 'pruefung', name),
    weg: () => rmSync(ordner, { recursive: true, force: true }),
  }
}

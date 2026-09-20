#!/usr/bin/env node
/**
 * Stop-Hook: Claude darf einen Zug nicht beenden, solange Typecheck oder Tests
 * rot sind. Exit 2 hält die Sitzung offen und zeigt Claude den Fehlertext.
 *
 * Warum das nötig ist: Eine Regel in CLAUDE.md ("vor jedem Commit testen") ist
 * eine Bitte. Dieser Hook ist eine Tür. Regeln ohne Durchsetzung werden ab der
 * dritten Sitzung ignoriert.
 *
 * Node statt Bash: läuft auf Windows und macOS gleich, braucht kein jq.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const MAX_VERSUCHE = 3          // danach durchlassen, sonst Endlosschleife
const zaehlerDatei = join(tmpdir(), 'farmerzone-stop-hook.count')

function lauf(befehl) {
  try {
    execSync(befehl, { stdio: 'pipe', encoding: 'utf8' })
    return { ok: true, ausgabe: '' }
  } catch (fehler) {
    const text = `${fehler.stdout ?? ''}${fehler.stderr ?? ''}`
    return { ok: false, ausgabe: text.split('\n').slice(0, 40).join('\n') }
  }
}

function zaehlerLesen() {
  try { return Number(readFileSync(zaehlerDatei, 'utf8')) || 0 } catch { return 0 }
}
function zaehlerSchreiben(n) {
  try { mkdirSync(tmpdir(), { recursive: true }); writeFileSync(zaehlerDatei, String(n)) } catch {}
}
function zaehlerLoeschen() {
  try { unlinkSync(zaehlerDatei) } catch {}
}

// stdin leeren, sonst blockiert der Prozess auf manchen Plattformen
try { readFileSync(0, 'utf8') } catch {}

if (!existsSync('package.json')) process.exit(0)

// Nur prüfen, wenn überhaupt TypeScript geändert wurde. Ein reines Gespräch
// ohne Codeänderung soll keine 30 Sekunden Testlauf auslösen.
let geaendert = ''
try {
  geaendert = execSync('git status --porcelain', { encoding: 'utf8' })
} catch { process.exit(0) }

const relevant = geaendert
  .split('\n')
  .filter((z) => /\.(ts|tsx)$/.test(z.trim()))

if (relevant.length === 0) { zaehlerLoeschen(); process.exit(0) }

const versuche = zaehlerLesen()
if (versuche >= MAX_VERSUCHE) {
  zaehlerLoeschen()
  console.error(
    `Hinweis: Typecheck/Tests waren ${MAX_VERSUCHE}× rot. Der Hook lässt dich jetzt ` +
    `durch, damit die Sitzung nicht hängt — aber der Stand ist NICHT commit-fähig. ` +
    `Sag das dem Menschen ausdrücklich im Abschlussbericht.`
  )
  process.exit(0)
}

const typecheck = lauf('pnpm typecheck')
if (!typecheck.ok) {
  zaehlerSchreiben(versuche + 1)
  console.error(`Typecheck ist rot — beheben, bevor du den Zug beendest:\n\n${typecheck.ausgabe}`)
  process.exit(2)
}

const tests = lauf('pnpm test')
if (!tests.ok) {
  zaehlerSchreiben(versuche + 1)
  console.error(`Tests sind rot — beheben, bevor du den Zug beendest:\n\n${tests.ausgabe}`)
  process.exit(2)
}

zaehlerLoeschen()
process.exit(0)

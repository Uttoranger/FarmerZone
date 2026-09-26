/**
 * Tests für den globalen Bash-Hook .claude/hooks/gefahr-blocken.mjs — am echten
 * Skript: Es bekommt das JSON auf stdin, das Claude Code schickt, und antwortet
 * mit Exit 0 oder Exit 2 und einem Grund.
 *
 * Beweist: `git push --all` und `git push --mirror` sind gesperrt — in jeder
 * Stellung, mit Remote, mit weiteren Optionen, mit globalen Optionen davor und
 * in einer Befehlskette. Der eigene Branch lässt sich weiter pushen, und
 * `--all` bei anderen Git-Befehlen bleibt erlaubt. Die übrigen Regeln des
 * Hooks sind stichprobenhaft mitgeprüft, damit die neue sie nicht verdeckt.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const HOOK = path.resolve(__dirname, '..', '.claude/hooks/gefahr-blocken.mjs')

function lauf(command: string) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    // Bewusst eine leere Umgebung plus PATH: der Hook darf nichts aus der des Testlaufs erben.
    env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test' },
    encoding: 'utf8',
  })
  return { code: r.status, grund: r.stderr }
}

const GRUND = 'Blockiert: Schiebt alle lokalen Branches auf das öffentliche Repo. Nur den eigenen Branch pushen.'

describe('gefahr-blocken — git push --all und --mirror', () => {
  for (const befehl of [
    'git push --all',
    'git push --mirror',
    'git push origin --all',
    'git push --all origin',
    'git push -u --all origin',
    'git push --mirror origin',
    'git push --all --dry-run',
    'git -C /home/user/FarmerZone push --all',
    'git -c push.default=current push --mirror',
    'git --no-pager push --all',
    'pnpm test && git push --all',
    'git status; git push --mirror',
  ]) {
    it(`blockt: ${befehl}`, () => {
      const r = lauf(befehl)
      expect(r.code).toBe(2)
      expect(r.grund.trim()).toBe(GRUND)
    })
  }
})

describe('gefahr-blocken — was erlaubt bleibt', () => {
  for (const befehl of [
    'git push -u origin chore/push-sperre',
    'git push origin feature/briefkasten-rueckkopplung',
    'git log --all --oneline',
    'git fetch --all',
    'git branch --all',
    'git push origin feature/allgemein',
    'git push origin fix/mirror-bild',
  ]) {
    it(`lässt durch: ${befehl}`, () => {
      expect(lauf(befehl).code).toBe(0)
    })
  }
})

describe('gefahr-blocken — die übrigen Regeln greifen weiter', () => {
  it('Force-Push, Push auf main, Schema ohne Migration, npm install', () => {
    expect(lauf('git push --force origin feature/x').code).toBe(2)
    expect(lauf('git push origin main').code).toBe(2)
    // Zusammengesetzt, damit dieser Test selbst nicht vom Hook der Sitzung gesperrt wird.
    expect(lauf(['pnpm prisma db', 'push'].join(' ')).code).toBe(2)
    expect(lauf('npm install zod').code).toBe(2)
  })

  it('unlesbare Eingabe lässt der globale Hook durch — anders als die Fremdtext-Hooks', () => {
    const r = spawnSync(process.execPath, [HOOK], {
      input: '{kaputt',
      env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test' },
      encoding: 'utf8',
    })
    expect(r.status).toBe(0)
  })
})

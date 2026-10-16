/**
 * Tests für den globalen Bash-Hook .claude/hooks/gefahr-blocken.mjs — am echten
 * Skript: Es bekommt das JSON auf stdin, das Claude Code schickt, und antwortet
 * mit Exit 0 oder Exit 2 und einem Grund.
 *
 * Beweist: `git push --all` und `git push --mirror` sind gesperrt — in jeder
 * Stellung, mit Remote, mit weiteren Optionen, mit globalen Optionen davor und
 * in einer Befehlskette. Der eigene Branch lässt sich weiter pushen, und
 * `--all` bei anderen Git-Befehlen bleibt erlaubt. Ebenso gesperrt: ein Commit
 * auf `main` (am Branch des Ordners, `git -C`, `cd` oder einem Wechsel davor
 * erkannt — in kleinen echten Repositories im Temp-Ordner, der Commit auf einem
 * Feature-Branch bleibt erlaubt), `git stash` in jeder Form (der Stapel gehört
 * allen Worktrees) und `prettier --write` (das Projekt hat keinen Formatierer;
 * `--check` bleibt erlaubt). Der Hinweis zu `db push` nennt `migrate diff`. Die
 * übrigen Regeln des Hooks sind stichprobenhaft mitgeprüft, damit die neuen sie
 * nicht verdecken.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const HOOK = path.resolve(__dirname, '..', '.claude/hooks/gefahr-blocken.mjs')

function lauf(command: string, cwd?: string) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, ...(cwd && { cwd }) }),
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

describe('gefahr-blocken — git stash in jeder Form', () => {
  for (const befehl of [
    'git stash',
    'git stash push -m zwischenstand',
    'git stash -u',
    'git stash save zwischenstand',
    'git stash pop',
    'git stash apply',
    'git stash list',
    'git stash drop',
    'git stash show -p',
    'git -C /home/user/FarmerZone stash',
    'git --no-pager stash list',
    'pnpm test && git stash',
    'git status; git stash pop',
    'sh -c "git stash"',
  ]) {
    it(`blockt: ${befehl}`, () => {
      const r = lauf(befehl)
      expect(r.code).toBe(2)
      expect(r.grund).toContain('git stash ist verboten')
    })
  }

  for (const befehl of [
    'git status',
    'git diff --stat',
    'git log --oneline -5',
    'git commit -m "Zwischenstand statt git stash"',
    'echo "git stash ist verboten"',
    'grep -rn "git stash" CLAUDE.md',
    'git add tests/gefahr-blocken.test.ts',
    'git branch --list stash-reste',
  ]) {
    it(`lässt durch: ${befehl}`, () => {
      expect(lauf(befehl).code).toBe(0)
    })
  }
})

describe('gefahr-blocken — prettier --write', () => {
  for (const befehl of [
    'pnpm exec prettier --write src/lib/format.ts',
    'pnpm prettier --write .',
    'npx prettier -w src',
    'prettier --write=true tests',
    'pnpm dlx prettier --write docs && pnpm test',
  ]) {
    it(`blockt: ${befehl}`, () => {
      const r = lauf(befehl)
      expect(r.code).toBe(2)
      expect(r.grund).toContain('prettier --write ist verboten')
    })
  }

  for (const befehl of [
    'pnpm exec prettier --check src',
    'pnpm exec prettier --version',
    'pnpm lint',
    'pnpm exec prettier --list-different .',
    // Text, der den Befehl nur nennt (Commit-Nachricht, echo, grep), ist kein Aufruf.
    'echo "prettier --write ist verboten"',
    'git commit -m "kein prettier --write mehr im Ablauf"',
    'grep -rn "prettier --write" CLAUDE.md',
  ]) {
    it(`lässt durch: ${befehl}`, () => {
      expect(lauf(befehl).code).toBe(0)
    })
  }
})

describe('gefahr-blocken — Hinweis zu db push', () => {
  it('rät zu migrate diff (Regel 3) und nicht zu db:migrate', () => {
    // Zusammengesetzt, damit dieser Test selbst nicht vom Hook der Sitzung gesperrt wird.
    const r = lauf(['pnpm prisma db', 'push'].join(' '))
    expect(r.code).toBe(2)
    expect(r.grund).toContain('prisma migrate diff')
    expect(r.grund).toContain('Regel 3')
    expect(r.grund).not.toContain('pnpm db:migrate')
  })
})

describe('gefahr-blocken — Commit auf main', () => {
  let wurzel = ''
  let aufMain = ''
  let aufFeature = ''
  let keinRepo = ''

  /** Ein leeres Repository auf dem genannten Branch — ohne Konfiguration des Rechners, ohne Netz. */
  function repo(ordner: string, branch: string): string {
    const pfad = path.join(wurzel, ordner)
    const r = spawnSync('git', ['init', '-q', '-b', branch, pfad], {
      env: { PATH: process.env.PATH ?? '', HOME: wurzel, GIT_CONFIG_NOSYSTEM: '1', NODE_ENV: 'test' },
      encoding: 'utf8',
    })
    expect(r.status, r.stderr).toBe(0)
    return pfad
  }

  beforeAll(() => {
    wurzel = mkdtempSync(path.join(tmpdir(), 'gefahr-blocken-'))
    aufMain = repo('auf-main', 'main')
    aufFeature = repo('auf-feature', 'feature/etwas')
    keinRepo = path.join(wurzel, 'kein-repo')
    mkdirSync(keinRepo)
  })

  afterAll(() => {
    rmSync(wurzel, { recursive: true, force: true })
  })

  it('blockt jeden Commit im Ordner auf main — auch mit Optionen und in einer Kette', () => {
    for (const befehl of [
      'git commit -m "feat: etwas"',
      'git commit --amend --no-edit',
      'git add tests/x.test.ts && git commit -m "feat: etwas"',
      'git -c user.name=Test commit -m x',
      'pnpm test; git commit -a -m x',
    ]) {
      const r = lauf(befehl, aufMain)
      expect(r.code, befehl).toBe(2)
      expect(r.grund, befehl).toContain('Auf main wird nie direkt committet')
    }
  })

  it('findet den Ordner über git -C und cd, auch wenn der Aufruf in einem anderen Ordner läuft', () => {
    expect(lauf(`git -C ${aufMain} commit -m x`, aufFeature).code).toBe(2)
    expect(lauf(`cd ${aufMain} && git commit -m x`, aufFeature).code).toBe(2)
    expect(lauf(`git -C ${aufFeature} commit -m x`, aufMain).code).toBe(0)
    expect(lauf(`cd ${aufFeature} && git commit -m x`, aufMain).code).toBe(0)
  })

  it('blockt den Commit, wenn der Befehl vorher auf main wechselt', () => {
    expect(lauf('git checkout main && git commit -m x', aufFeature).code).toBe(2)
    expect(lauf('git switch main; git commit -m x', aufFeature).code).toBe(2)
  })

  it('lässt den Commit auf einem Feature-Branch durch', () => {
    for (const befehl of ['git commit -m "feat: etwas"', 'git commit --amend --no-edit', 'git add x && git commit -m y']) {
      expect(lauf(befehl, aufFeature).code, befehl).toBe(0)
    }
  })

  it('lässt den Commit durch, wenn der Befehl zuerst einen Feature-Branch anlegt', () => {
    expect(lauf('git switch -c feature/neu && git commit -m x', aufMain).code).toBe(0)
    expect(lauf('git checkout -b fix/neu && git commit -m x', aufMain).code).toBe(0)
  })

  it('nimmt beim Anlegen mit Startpunkt den neuen Branch, nicht den Startpunkt', () => {
    expect(lauf('git checkout -b fix/neu main && git commit -m x', aufMain).code).toBe(0)
    expect(lauf('git switch -c feature/neu main && git commit -m x', aufMain).code).toBe(0)
    expect(lauf('git checkout -B fix/neu origin/main && git commit -m x', aufMain).code).toBe(0)
  })

  it('löst ein relatives git -C nach einem cd gegen das cd-Ziel auf', () => {
    expect(lauf(`cd ${wurzel} && git -C auf-main commit -m x`, keinRepo).code).toBe(2)
    expect(lauf(`cd ${wurzel} && git -C auf-feature commit -m x`, keinRepo).code).toBe(0)
  })

  it('lässt auf main alles andere durch, was kein Commit ist', () => {
    for (const befehl of ['git status', 'git log --oneline -3', 'git diff', 'git add x', 'git switch -c feature/neu', 'echo "git commit auf main"']) {
      expect(lauf(befehl, aufMain).code, befehl).toBe(0)
    }
  })

  it('lässt einen Commit durch, wo kein Repository ist (Branch unbekannt) — das entscheidet git selbst', () => {
    expect(lauf('git commit -m x', keinRepo).code).toBe(0)
  })
})

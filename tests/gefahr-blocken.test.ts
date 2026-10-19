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

describe('gefahr-blocken — prisma migrate deploy nur gegen eine ausdrücklich lokale Datenbank (Nr. 118, Regel 3)', () => {
  const LOKAL = 'postgresql://postgres:postgres@localhost:5432/wegwerf_test'
  const LOKAL_IP = 'postgresql://postgres:postgres@127.0.0.1:5432/wegwerf_test'
  const FREMD = 'postgresql://postgres:geheim@db.example.com:5432/postgres'
  const DEPLOY = 'pnpm exec prisma migrate deploy'

  for (const befehl of [
    DEPLOY,
    'npx prisma migrate deploy',
    'prisma migrate deploy',
    'dotenv -e .env.local -- prisma migrate deploy',
    'pnpm test && pnpm exec prisma migrate deploy',
    // Das Skript vercel-build führt migrate deploy als ersten Schritt aus.
    'pnpm vercel-build',
    'pnpm run vercel-build',
    // Nur eine der beiden Adressen: prisma.config.ts liest DIRECT_URL vor DATABASE_URL.
    `DATABASE_URL=${LOKAL} ${DEPLOY}`,
    `DIRECT_URL=${LOKAL} ${DEPLOY}`,
    // Eine der beiden zeigt auf einen fremden Rechner.
    `DATABASE_URL=${LOKAL} DIRECT_URL=${FREMD} ${DEPLOY}`,
    `DATABASE_URL=${FREMD} DIRECT_URL=${LOKAL} ${DEPLOY}`,
    // Wird eine Variable zweimal gesetzt, zählt jede Zuweisung.
    `DATABASE_URL=${LOKAL} DATABASE_URL=${FREMD} DIRECT_URL=${LOKAL} ${DEPLOY}`,
    // Das Wort localhost im Benutzernamen oder im Host einer Fremdadresse macht sie nicht lokal.
    `DATABASE_URL=postgresql://localhost@db.example.com/x DIRECT_URL=postgresql://localhost@db.example.com/x ${DEPLOY}`,
    `DATABASE_URL=postgresql://u:p@localhost.example.com/x DIRECT_URL=postgresql://u:p@localhost.example.com/x ${DEPLOY}`,
    // ?host= überschreibt den Host der Adresse.
    `DATABASE_URL=${LOKAL}?host=db.example.com DIRECT_URL=${LOKAL}?host=db.example.com ${DEPLOY}`,
    // Keine ausdrückliche Adresse: eine Variable oder die Test-Variante des Namens.
    `DATABASE_URL=$TEST_DATABASE_URL DIRECT_URL=$TEST_DATABASE_URL ${DEPLOY}`,
    `TEST_DATABASE_URL=${LOKAL} ${DEPLOY}`,
    // Die Adressen stehen erst nach dem Aufruf: Sie gelten für ihn nicht.
    `${DEPLOY} && DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} true`,
    // Die Adressen gehören einem ANDEREN Befehl oder bloßem Text (Prüfung Runde 1): Der Aufruf liest dann die
    // Adresse aus der Umgebung.
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} true && ${DEPLOY}`,
    `echo DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL}; ${DEPLOY}`,
    `printf '%s' DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} && ${DEPLOY}`,
    // Eine Zuweisung ohne export und ohne Befehl dahinter gilt nur in der Shell, nicht für das, was sie startet.
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL}; ${DEPLOY}`,
    `DATABASE_URL=${LOKAL}\nDIRECT_URL=${LOKAL}\n${DEPLOY}`,
    // Die Zuweisung direkt am Aufruf geht einer früheren export-Anweisung vor.
    `export DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL}; DATABASE_URL=${FREMD} ${DEPLOY}`,
    // Auch hinter anderen Aufrufformen — Pfad, Version, pnpm-Optionen, Hüllen (Prüfung Runde 1).
    './node_modules/.bin/prisma migrate deploy',
    'node_modules/.bin/prisma migrate deploy',
    'npx prisma@7 migrate deploy',
    'npx --yes prisma@latest migrate deploy',
    'pnpm dlx prisma@7.2.0 migrate deploy',
    'pnpm -C . exec prisma migrate deploy',
    'pnpm --dir . exec prisma migrate deploy',
    'pnpm --filter web exec prisma migrate deploy',
    'pnpm exec prisma migrate deploy --schema prisma/schema.prisma',
    'timeout 600 prisma migrate deploy',
    'time prisma migrate deploy',
    'nice -n 5 pnpm exec prisma migrate deploy',
    'sudo -E prisma migrate deploy',
    'xargs prisma migrate deploy',
    'pnpm -C . run vercel-build',
    'pnpm --filter web vercel-build',
    'npm run vercel-build',
    'timeout 600 pnpm vercel-build',
    'sh -c "pnpm exec prisma migrate deploy"',
    "bash -lc 'pnpm exec prisma migrate deploy'",
    'eval "pnpm exec prisma migrate deploy"',
    '(pnpm exec prisma migrate deploy)',
    'echo $(pnpm exec prisma migrate deploy)',
    // Eine Befehlsersetzung führt die Shell auch zwischen Anführungszeichen aus (Prüfung Runde 2) — die übliche
    // Form, um die Ausgabe aufzufangen.
    'out="$(pnpm exec prisma migrate deploy 2>&1)"',
    'echo "$(pnpm exec prisma migrate deploy)"',
    'echo "`pnpm exec prisma migrate deploy`"',
    'out=$(pnpm exec prisma migrate deploy)',
    'out=`pnpm exec prisma migrate deploy`',
    'echo "vorher $(echo "$(pnpm exec prisma migrate deploy)") nachher"',
    'echo "x" "$(sh -c \'pnpm exec prisma migrate deploy\')"',
    'sh -c "echo $(pnpm exec prisma migrate deploy)"',
    'export AUSGABE="$(pnpm exec prisma migrate deploy)"',
    'bash -c "$(cat <<\'EOF\'\npnpm exec prisma migrate deploy\nEOF\n)"',
    // Zuweisungen am umgebenden Befehl erreichen die Ersetzung nicht: Die Shell führt sie vorher aus.
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} echo "$(${DEPLOY})"`,
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} out="$(${DEPLOY})"`,
    // Ein export in einer Unter-Shell endet mit der Klammer (Prüfung Runde 2).
    `(export DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL}); ${DEPLOY}`,
    `echo $(export DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL}); ${DEPLOY}`,
    `out="$(export DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL})"; ${DEPLOY}`,
    `\`export DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL}\`; ${DEPLOY}`,
    `(export DATABASE_URL=${LOKAL}); export DIRECT_URL=${LOKAL}; ${DEPLOY}`,
    `sh -c "DATABASE_URL=${LOKAL} ${DEPLOY}"`,
    // Eine Adresse mit Variable oder Befehlsersetzung ist keine ausdrückliche lokale Adresse.
    `DATABASE_URL="postgresql://u:p@localhost/\$(echo x)" DIRECT_URL=${LOKAL} ${DEPLOY}`,
  ]) {
    it(`blockt: ${befehl}`, () => {
      const r = lauf(befehl)
      expect(r.code).toBe(2)
      expect(r.grund).toContain('ausdrücklich lokale Datenbank')
    })
  }

  for (const befehl of [
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} ${DEPLOY}`,
    `DIRECT_URL=${LOKAL} DATABASE_URL=${LOKAL} ${DEPLOY}`,
    `DATABASE_URL=${LOKAL_IP} DIRECT_URL=${LOKAL_IP} ${DEPLOY}`,
    `DATABASE_URL="${LOKAL}" DIRECT_URL='${LOKAL}' ${DEPLOY}`,
    `env DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} ${DEPLOY}`,
    `export DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL}; ${DEPLOY}`,
    `export DATABASE_URL=${LOKAL} && export DIRECT_URL=${LOKAL} && ${DEPLOY}`,
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} pnpm vercel-build`,
    `DATABASE_URL=postgresql://postgres:postgres@localhost/wegwerf_test?schema=public DIRECT_URL=${LOKAL_IP} ${DEPLOY}`,
    // Andere Aufrufformen mit beiden lokalen Adressen im selben Befehl.
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} ./node_modules/.bin/prisma migrate deploy`,
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} npx prisma@7 migrate deploy`,
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} pnpm -C . exec prisma migrate deploy`,
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} timeout 600 ${DEPLOY}`,
    `timeout 600 env DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} ${DEPLOY}`,
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} sh -c "${DEPLOY}"`,
    `sh -c "DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} ${DEPLOY}"`,
    `export DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} && sh -c "${DEPLOY}"`,
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} ${DEPLOY} --schema prisma/schema.prisma`,
    // Der Aufruf hat seine Adressen; was danach kommt, ist ein anderer Befehl.
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} ${DEPLOY} && pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`,
    `DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} ${DEPLOY} > migrate.log 2>&1`,
    // Die Ausgabe auffangen: mit beiden Adressen im geerbten oder im eigenen Befehl.
    `export DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL}; out="$(${DEPLOY} 2>&1)"`,
    `export DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL}; echo "$(${DEPLOY})"`,
    `out="$(DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} ${DEPLOY} 2>&1)"`,
    `echo "$(DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} ${DEPLOY})"`,
    `echo "\`DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL} ${DEPLOY}\`"`,
    // Ein export gilt innerhalb seiner Klammer.
    `(export DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL}; ${DEPLOY})`,
    `(export DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL}; out="$(${DEPLOY})")`,
    `export DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL}; (${DEPLOY})`,
    `export DATABASE_URL=${LOKAL} DIRECT_URL=${LOKAL}; (cd . && ${DEPLOY})`,
  ]) {
    it(`lässt durch: ${befehl}`, () => {
      expect(lauf(befehl).code).toBe(0)
    })
  }

  for (const befehl of [
    // Text, der den Aufruf nur nennt (Commit-Nachricht, echo, grep), ist kein Aufruf.
    'echo "prisma migrate deploy ist gesperrt"',
    'git commit -m "migrate deploy nur lokal"',
    'grep -rn "prisma migrate deploy" docs/nachtlauf.md',
    // Andere Unterbefehle von migrate und das lokale Bauen.
    'pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code',
    'pnpm exec prisma migrate status',
    'pnpm build',
    // Die Tests und Suchen, die das Wort nur als Argument tragen, sind keine Aufrufe.
    'pnpm vitest run vercel-build',
    'pnpm vitest run tests/gefahr-blocken.test.ts -t "prisma migrate deploy"',
    'echo prisma migrate deploy',
    // Andere Ersetzungen und Text in einfachen Anführungszeichen (kein Aufruf).
    'echo "Stand: $(git rev-parse --short HEAD) um $(date +%F)"',
    'echo "`date`"',
    "echo '$(pnpm exec prisma migrate deploy)'",
    'echo "preis: \\$(pnpm exec prisma migrate deploy)"',
    'out="$(pnpm exec prisma migrate status 2>&1)"',
    'pnpm test # danach prisma migrate deploy auf der frischen Datenbank',
    'grep -rn vercel-build package.json',
    'git log --oneline -- vercel-build',
  ]) {
    it(`lässt durch: ${befehl}`, () => {
      expect(lauf(befehl).code).toBe(0)
    })
  }
})

describe('gefahr-blocken — Here-Documents liest der Hook mit (bewusst, Nachtrag Dirigent Lauf 17)', () => {
  // Kein Repository im Ordner: Der Branch-Test des Hooks soll hier nichts mitentscheiden.
  const ohneRepo = tmpdir()
  // Der Fehlalarm aus Nr. 110 bleibt: Eine Commit-Nachricht, deren Zeile mit „git stash“ beginnt, blockt der Hook.
  // Drei Anläufe in Nr. 118, den Text eines Here-Documents als Daten auszunehmen, öffneten jeweils neue Lücken
  // (zuletzt ließ eine Nachricht mit „<<'EOF'“ in Anführungszeichen den Befehl danach durch). Vorsicht geht vor;
  // eine sichere Lösung steht für Lauf 18 im Morgenbericht.

  it('blockt eine Commit-Nachricht, deren Zeile mit „git stash“ beginnt (bekannter Fehlalarm, gewollt vorsichtig)', () => {
    const befehl = ['git commit -m "$(cat <<\'EOF\'', 'docs: Regel ergänzt', '', 'git stash ist verboten', 'EOF', ')"'].join('\n')
    expect(lauf(befehl, ohneRepo).code).toBe(2)
  })

  it('blockt, wenn „<<\'EOF\'“ nur in Anführungszeichen steht und danach ein verbotener Befehl folgt (Lücke aus Runde 2)', () => {
    expect(lauf(['git commit -m "Hook liest <<\'EOF\' jetzt"', 'git stash'].join('\n'), ohneRepo).code).toBe(2)
    expect(lauf(['cat "notiz <<\'EOF\'.txt"', 'git stash'].join('\n'), ohneRepo).code).toBe(2)
  })

  it('blockt, was ein Dokument an eine Shell, einen Interpreter oder eine Datei zum Ausführen gibt', () => {
    for (const befehl of [
      ["cat <<'EOF' | bash", 'git stash', 'EOF'],
      ["cat <<'EOF' > a.sh && chmod +x a.sh && ./a.sh", 'git stash', 'EOF'],
      ["cat <<'EOF' | tee a.sh && ./a.sh", 'git stash', 'EOF'],
      ['bash <<\'EOF\'', 'git stash', 'EOF'],
      ['cat <<EOF', 'git stash', 'EOF'],
    ]) {
      expect(lauf(befehl.join('\n'), ohneRepo).code, befehl[0]).toBe(2)
    }
  })

  it('prüft den Befehl vor und nach dem Dokument weiter', () => {
    expect(lauf(["cat > notiz.txt <<'EOF'", 'nur Text', 'EOF', 'git stash'].join('\n'), ohneRepo).code).toBe(2)
    expect(lauf(['git stash && cat <<\'EOF\'', 'nur Text', 'EOF'].join('\n'), ohneRepo).code).toBe(2)
  })

  it('Gegenprobe: ein Dokument ohne verbotenen Text geht durch', () => {
    const befehl = ['git commit -m "$(cat <<\'EOF\'', 'docs: Regel ergänzt', '', 'nur Text', 'EOF', ')"'].join('\n')
    expect(lauf(befehl, ohneRepo).code).toBe(0)
  })
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

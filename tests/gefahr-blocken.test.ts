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
 *
 * Jeder Aufruf bekommt ein Temp-Repository auf einem Feature-Branch als `cwd`
 * (Nr. 130, G4): Ohne eigenes Verzeichnis prüft der Hook den Branch des
 * Prozess-Verzeichnisses — beim Push auf main steht dort der Checkout der CI
 * auf main, und die erlaubten Commit-Fälle bekämen Exit 2. In einem PR ist der
 * Stand losgelöst, darum fiel das nur auf main auf.
 *
 * Nr. 138 (Inventur 5 und 17, Regelvorschlag „Commit-Präfix“): rekursives Löschen
 * in jeder Schreibweise, Push auf main in jeder Form des Ziels (ohne Fehlalarm bei
 * `main-fix`), `.env`-Vorlagen auf `.example` und das Präfix der Commit-Nachricht
 * nach CLAUDE.md §5. Die Fälle sind erfundener Text und laufen nie in einer Shell.
 * Die bestehenden Commit-Fälle ohne Präfix stehen deshalb auf `-m "fix: …"` — ihre
 * Aussage bleibt gleich.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const HOOK = path.resolve(__dirname, '..', '.claude/hooks/gefahr-blocken.mjs')

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

/** Startet den Hook mit dieser Eingabe; `prozessOrdner` ist das Verzeichnis des Prozesses (sonst das des Testlaufs). */
function starte(eingabe: object, prozessOrdner?: string) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(eingabe),
    // Bewusst eine leere Umgebung plus PATH: der Hook darf nichts aus der des Testlaufs erben.
    env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test' },
    encoding: 'utf8',
    ...(prozessOrdner && { cwd: prozessOrdner }),
  })
  return { code: r.status, grund: r.stderr }
}

/** `cwd` ist das Feld der Eingabe (bei Claude Code der Ordner der Sitzung); Standard: ein Feature-Branch. */
function lauf(command: string, cwd: string = aufFeature) {
  return starte({ tool_name: 'Bash', tool_input: { command }, cwd })
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
    'git commit -m "fix: Zwischenstand statt git stash"',
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
    'git commit -m "fix: kein prettier --write mehr im Ablauf"',
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
    'git commit -m "fix: migrate deploy nur lokal"',
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
    ]) {
      expect(lauf(befehl.join('\n'), ohneRepo).code, befehl[0]).toBe(2)
    }
  })

  it('prüft den Befehl vor und nach dem Dokument weiter', () => {
    expect(lauf(["cat > notiz.txt <<'EOF'", 'nur Text', 'EOF', 'git stash'].join('\n'), ohneRepo).code).toBe(2)
    expect(lauf(['git stash && cat <<\'EOF\'', 'nur Text', 'EOF'].join('\n'), ohneRepo).code).toBe(2)
  })

  it('liest den Text ohne Quote am Begrenzer weiter mit: Die Shell führt $(…) darin aus', () => {
    expect(lauf(['cat <<EOF', 'git stash', 'EOF'].join('\n'), ohneRepo).code).toBe(2)
  })

  it('liest den Text mit, wenn das Dokument an eine Shell geht', () => {
    expect(lauf(['bash <<\'EOF\'', 'git stash', 'EOF'].join('\n'), ohneRepo).code).toBe(2)
    expect(lauf(['sh -s <<\'EOF\'', 'pnpm exec prettier --write .', 'EOF'].join('\n'), ohneRepo).code).toBe(2)
  })

  // Prüfung Runde 1: Der Text bleibt Befehl, sobald das Dokument ausgeführt wird — auch wenn der Aufruf, der es
  // liest, erst hinter dem Begrenzer in die Shell läuft oder ein Interpreter es liest.
  it('liest den Text mit, wenn das Dokument hinter dem Begrenzer an eine Shell geht', () => {
    for (const ziel of ['bash', 'sh', 'zsh -s', 'sudo bash', 'env sh -e', 'xargs -0 sh -c', 'source /dev/stdin']) {
      const befehl = [`cat <<'EOF' | ${ziel}`, 'git stash', 'EOF'].join('\n')
      expect(lauf(befehl, ohneRepo).code, befehl).toBe(2)
    }
    expect(lauf(["cat <<'EOF' | tee neu.sh | bash", 'git stash', 'EOF'].join('\n'), ohneRepo).code).toBe(2)
    expect(lauf(["cat <<'EOF' > neu.sh && bash neu.sh", 'git stash', 'EOF'].join('\n'), ohneRepo).code).toBe(2)
  })

  // Prüfung Runde 2: Der Ausführer wird nicht an seinem Namen erkannt. Hinter einer Pipe darf nur ein Leser stehen,
  // der speichert oder weitergibt; alles andere — Pfad, Variable, Hülle, Interpreter mit Pfad — behält den Text.
  it('liest den Text mit, wenn das Ziel mit Pfad, über eine Hülle oder als Variable aufgerufen wird', () => {
    for (const ziel of [
      '/bin/bash',
      'sudo /bin/sh',
      '$SHELL',
      '"$SHELL" -s',
      '${SHELL:-sh}',
      '/usr/bin/python3 -',
      '/usr/bin/env node -',
      'cat | sh',
      'cat | /bin/bash',
      'tee >(bash)',
      'tee neu.sh | /bin/bash',
      'tclsh',
    ]) {
      const befehl = [`cat <<'EOF' | ${ziel}`, 'git stash', 'EOF'].join('\n')
      expect(lauf(befehl, ohneRepo).code, befehl).toBe(2)
    }
  })

  it('liest den Text mit, wenn die Hülle vor dem Begrenzer einen Pfad oder eine Variable hat', () => {
    for (const kopf of ['/bin/bash -c "$(cat <<\'EOF\'', 'sudo /bin/sh -c "$(cat <<\'EOF\'', '$SHELL -c "$(cat <<\'EOF\'', '/usr/bin/python3 -c "$(cat <<\'EOF\'']) {
      const befehl = [kopf, 'git stash', 'EOF', ')"'].join('\n')
      expect(lauf(befehl, ohneRepo).code, kopf).toBe(2)
    }
  })

  it('liest den Text mit, wenn ein Interpreter das Dokument liest', () => {
    // Zusammengesetzt, damit dieser Test selbst nicht vom Hook der Sitzung gesperrt wird.
    const dbPush = ['prisma db', 'push'].join(' ')
    for (const leser of ['node -', 'python3 -', 'perl', 'ruby', 'deno run -', 'bun run -', 'tsx -', 'psql', 'sqlite3 db.sqlite']) {
      const befehl = [`${leser} <<'EOF'`, `execSync("pnpm exec ${dbPush}")`, 'EOF'].join('\n')
      expect(lauf(befehl, ohneRepo).code, befehl).toBe(2)
    }
  })

  it('liest den Text mit, wenn eine Befehlsersetzung ihn ausführt (eval, bash -c, source <(…))', () => {
    for (const kopf of ['eval "$(cat <<\'EOF\'', 'bash -c "$(cat <<\'EOF\'', 'source <(cat <<\'EOF\'', 'FOO=1 sh -c "$(cat <<\'EOF\'']) {
      const befehl = [kopf, 'git stash', 'EOF', ')"'].join('\n')
      expect(lauf(befehl, ohneRepo).code, kopf).toBe(2)
    }
  })

  it('liest den Text mit, wenn der Leser unbekannt ist', () => {
    // Nur die Leser, die den Text bloß speichern oder weitergeben, gelten als Daten; alles andere bleibt Befehl.
    expect(lauf(["tclsh <<'EOF'", 'git stash', 'EOF'].join('\n'), ohneRepo).code).toBe(2)
  })

  it('blockt heute auch Daten, die nur gespeichert oder weitergegeben werden (Fehlalarm aus Nr. 110 – Ziel für Lauf 18)', () => {
    // Eine sichere Lösung in Lauf 18 soll diese Fälle durchlassen und alle Fälle oben weiter blocken.
    for (const kopf of [
      "cat > notiz.txt <<'EOF'",
      "cat <<'EOF' | tee notiz.txt",
      "cat <<'EOF' | git commit -F -",
      "git commit -F - <<'EOF'",
      'git commit -m "$(cat <<\'EOF\'',
      "gh pr create --title t --body-file - <<'EOF'",
    ]) {
      const befehl = [kopf, 'git stash', 'pnpm exec prettier --write .', 'EOF', ...(kopf.includes('$(') ? [')"'] : [])].join('\n')
      expect(lauf(befehl, ohneRepo).code, kopf).toBe(2)
    }
  })

  it('hält einen Here-String (<<<) nicht für ein Dokument', () => {
    expect(lauf(['cat <<< "Text"', 'git stash'].join('\n'), ohneRepo).code).toBe(2)
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
    expect(lauf(`git -C ${aufFeature} commit -m "fix: x"`, aufMain).code).toBe(0)
    expect(lauf(`cd ${aufFeature} && git commit -m "fix: x"`, aufMain).code).toBe(0)
  })

  it('blockt den Commit, wenn der Befehl vorher auf main wechselt', () => {
    expect(lauf('git checkout main && git commit -m x', aufFeature).code).toBe(2)
    expect(lauf('git switch main; git commit -m x', aufFeature).code).toBe(2)
  })

  it('lässt den Commit auf einem Feature-Branch durch', () => {
    for (const befehl of ['git commit -m "feat: etwas"', 'git commit --amend --no-edit', 'git add x && git commit -m "fix: y"']) {
      expect(lauf(befehl, aufFeature).code, befehl).toBe(0)
    }
  })

  it('lässt den Commit durch, wenn der Befehl zuerst einen Feature-Branch anlegt', () => {
    expect(lauf('git switch -c feature/neu && git commit -m "fix: x"', aufMain).code).toBe(0)
    expect(lauf('git checkout -b fix/neu && git commit -m "fix: x"', aufMain).code).toBe(0)
  })

  it('nimmt beim Anlegen mit Startpunkt den neuen Branch, nicht den Startpunkt', () => {
    expect(lauf('git checkout -b fix/neu main && git commit -m "fix: x"', aufMain).code).toBe(0)
    expect(lauf('git switch -c feature/neu main && git commit -m "fix: x"', aufMain).code).toBe(0)
    expect(lauf('git checkout -B fix/neu origin/main && git commit -m "fix: x"', aufMain).code).toBe(0)
  })

  it('löst ein relatives git -C nach einem cd gegen das cd-Ziel auf', () => {
    expect(lauf(`cd ${wurzel} && git -C auf-main commit -m x`, keinRepo).code).toBe(2)
    expect(lauf(`cd ${wurzel} && git -C auf-feature commit -m "fix: x"`, keinRepo).code).toBe(0)
  })

  it('lässt auf main alles andere durch, was kein Commit ist', () => {
    for (const befehl of ['git status', 'git log --oneline -3', 'git diff', 'git add x', 'git switch -c feature/neu', 'echo "git commit auf main"']) {
      expect(lauf(befehl, aufMain).code, befehl).toBe(0)
    }
  })

  it('lässt einen Commit durch, wo kein Repository ist (Branch unbekannt) — das entscheidet git selbst', () => {
    expect(lauf('git commit -m "fix: x"', keinRepo).code).toBe(0)
  })

  // Die Lage der CI beim Push auf main (Nr. 130): Der Prozess steht im Checkout auf main, die Eingabe nennt den Ordner
  // der Sitzung. Der Hook nimmt den Ordner der Eingabe — nur ohne ihn bliebe das Prozess-Verzeichnis.
  it('nimmt den Ordner aus der Eingabe, nicht das Verzeichnis des Prozesses (Lage der CI auf main)', () => {
    const eingabe = { tool_name: 'Bash', tool_input: { command: 'git commit -m "fix: x"' } }
    expect(starte({ ...eingabe, cwd: aufFeature }, aufMain).code).toBe(0)

    // Gegenprobe: ohne `cwd` in der Eingabe gilt das Verzeichnis des Prozesses — auf main also Exit 2.
    const ohne = starte(eingabe, aufMain)
    expect(ohne.code).toBe(2)
    expect(ohne.grund).toContain('Auf main wird nie direkt committet')
  })
})

// Nr. 138, Punkt 1 (Inventur 5): Das alte Muster kannte nur die Reihenfolge `-r…` und nur ein Ziel direkt danach.
describe('gefahr-blocken — rekursives Löschen in jeder Schreibweise (Nr. 138, Inventur 5)', () => {
  for (const befehl of [
    'rm -rf /x',
    'rm -fr /x',
    'rm -r -f /x',
    'rm -Rf /x',
    'rm -rfv /x',
    'rm --recursive --force /x',
    'rm -rf ~',
    'rm -rf "$HOME"',
    'rm -rf .',
    'rm -rf ./',
    'rm -rf ../',
    'rm -rf *',
    'rm -rf ./*',
    'rm -rf .*',
    'rm -rf build /',
    'rm -rf -- /',
    '/bin/rm -rf /',
    'command rm -rf /',
    'find . -exec rm -rf / \\;',
    // Weitere Schreibweisen derselben Option und derselben Ziele.
    'rm -rf ..',
    'rm -rf ~/projekt',
    'rm -rf ${HOME}',
    "rm -rf '${HOME}'",
    'rm -rf "$HOME/projekt"',
    'rm -R /x',
    'rm --rec -f /x',
    'rm /x -rf',
    '/usr/bin/rm -rf /x',
    'sudo rm -rf /x',
    'xargs rm -rf /x',
    '\\rm -rf /x',
    'rm -rf .next && rm -rf /x',
    'out=$(rm -rf /x)',
    'sh -c "cd build && rm -rf /x"',
    // Text, der den Aufruf nur nennt, blockt wie bisher mit (gewollt vorsichtig).
    'echo "rm -rf ~"',
    // Ein Ziel, das mit * beginnt, blockt wie vor Nr. 138 (Runde 1): */ löscht alle Unterordner.
    'rm -rf */',
    'rm -rf *.log',
    // Auch die Schreibweisen mit Ersatzwert sind der Heimatordner.
    'rm -rf "${HOME:?}"',
    'rm -rf ${HOME:-/tmp/x}',
  ]) {
    it(`blockt: ${befehl}`, () => {
      const r = lauf(befehl)
      expect(r.code).toBe(2)
      expect(r.grund).toContain('Destruktives Löschen')
    })
  }

  for (const befehl of [
    'rm -rf ./node_modules',
    'rm -rf node_modules',
    'rm -rf .next',
    'rm datei.txt',
    'rm -f ./x',
    // Die Form aus docs/nachtlauf.md 4a Punkt 6: Der Ordner steht in einer Variablen, das Ziel beginnt nicht mit /.
    'rm -rf "${WT:?}/.next"',
    // Eine Umleitung ist kein Ziel.
    'rm -rf .next > /dev/null 2>&1',
    // Ohne rekursive Option löscht rm keinen Ordner.
    'rm -f /tmp/notiz.txt',
    // Wo der Text in Anführungszeichen endet, enden auch die Ziele: Der Pfad gehört zu grep.
    'grep -rn "rm -rf" /tmp/notizen',
  ]) {
    it(`lässt durch: ${befehl}`, () => {
      expect(lauf(befehl).code).toBe(0)
    })
  }
})

// Nr. 138, Punkt 2: `main` zählt nur als ganzer Name (davor Leerzeichen, +, :, refs/heads/ oder ein Anführungszeichen).
describe('gefahr-blocken — Push auf main ohne Lücke, ohne Fehlalarm (Nr. 138)', () => {
  for (const befehl of [
    'git push origin main',
    'git push origin HEAD:main',
    'git push origin HEAD:refs/heads/main',
    'git push origin refs/heads/main',
    'git push origin :main',
    'git push origin --delete main',
    'git push -u origin main',
    // Weitere Schreibweisen desselben Ziels und globale Optionen vor push.
    'git push origin -d main',
    'git push --set-upstream origin main',
    'git push origin main:main',
    'git push origin feature/x:refs/heads/main',
    'git push origin "main"',
    'git -C ../anderer-ordner push origin HEAD:main',
  ]) {
    it(`blockt: ${befehl}`, () => {
      const r = lauf(befehl)
      expect(r.code).toBe(2)
      expect(r.grund).toContain('Direktes Pushen auf main')
    })
  }

  // Ein Ziel mit + davor überschreibt die Historie wie --force — auch auf main greift deshalb zuerst die Force-Regel.
  for (const befehl of ['git push origin +main', 'git push origin +feature', 'git push origin +HEAD:feature/x', 'git -C ../anderer-ordner push --force origin feature/x']) {
    it(`blockt als Force-Push: ${befehl}`, () => {
      const r = lauf(befehl)
      expect(r.code).toBe(2)
      expect(r.grund).toContain('Force-Push')
    })
  }

  for (const befehl of [
    'git push origin main-fix',
    'git push origin feature/main',
    'git push origin feature/main-x',
    'git push -u origin nacht/2026-10-22/137-kaufsperre',
    'git push origin main2',
    'git push origin mainline',
    'git push origin main_alt',
    'git push origin main.alt',
    'git push origin HEAD:refs/heads/main-fix',
  ]) {
    it(`lässt durch: ${befehl}`, () => {
      expect(lauf(befehl).code).toBe(0)
    })
  }
})

// Nr. 138, Punkt 3: Eine Datei, deren Name auf .example endet, ist eine Vorlage mit Platzhaltern und gehört ins Repository.
describe('gefahr-blocken — .env nie ins Repository, Vorlagen auf .example schon (Nr. 138)', () => {
  for (const befehl of [
    'git add .env',
    'git add .env.local',
    'git add .env.test',
    'git add .env.test.example .env.local',
    'git add .env.example.alt',
    'git commit -m "fix: x" .env.local',
  ]) {
    it(`blockt: ${befehl}`, () => {
      const r = lauf(befehl)
      expect(r.code).toBe(2)
      expect(r.grund).toContain('Eine .env-Datei darf nie ins Repository')
    })
  }

  for (const befehl of ['git add .env.example', 'git add .env.test.example']) {
    it(`lässt durch: ${befehl}`, () => {
      expect(lauf(befehl).code).toBe(0)
    })
  }
})

// Nr. 138, Punkt 4 (Inventur 17): db push, Force-Push, Push auf main und npm/yarn sind bewusst NICHT an den Befehlsanfang
// gebunden — eine Bindung übersähe Schreibweisen wie `env git push --force` oder Backticks. Sie blocken deshalb auch Text,
// der den Befehl nur nennt (echo, grep, -m "…"), gewollt vorsichtig wie bei stash. Ausweg ist der Tipp „Commit- und
// PR-Texte über eine Datei“ (docs/nachtlauf/freigabe.md): Text mit dem Write-Werkzeug in eine Datei, dann
// `git commit -F <datei>` bzw. `gh pr create --body-file <datei>`.
describe('gefahr-blocken — bloßer Text bei db push, Force-Push, Push auf main und npm (gewollt vorsichtig, Nr. 138)', () => {
  // Zusammengesetzt, damit dieser Test selbst nicht vom Hook der Sitzung gesperrt wird.
  const dbPush = ['prisma db', 'push'].join(' ')

  for (const [befehl, grund] of [
    [`echo "${dbPush} ist verboten"`, 'db push ist in diesem Projekt verboten'],
    ['grep -rn "git push --force" docs', 'Force-Push'],
    ['git commit -m "fix: nie git push origin main"', 'Direktes Pushen auf main'],
    ['echo "npm install zod"', 'Paketmanager ist pnpm'],
  ] as const) {
    it(`blockt auch bloßen Text (gewollt vorsichtig): ${befehl}`, () => {
      const r = lauf(befehl)
      expect(r.code).toBe(2)
      expect(r.grund).toContain(grund)
    })
  }

  for (const befehl of ['yarn add x', 'yarn install']) {
    it(`blockt: ${befehl}`, () => {
      const r = lauf(befehl)
      expect(r.code).toBe(2)
      expect(r.grund).toContain('Paketmanager ist pnpm')
    })
  }

  for (const befehl of [
    'pnpm exec prisma db pull',
    'git push --force-with-lease origin feature/x',
    'git push origin feature/x',
    'pnpm install',
    // Der Hook blockt pnpm add bewusst nicht: Fragen vor jeder neuen Abhängigkeit bleibt Pflicht (CLAUDE.md §2).
    'pnpm add left-pad',
  ]) {
    it(`lässt durch: ${befehl}`, () => {
      expect(lauf(befehl).code).toBe(0)
    })
  }
})

// Nr. 138, Punkt 5 (Regelvorschlag aus Morgenbericht 20 §6): erste Zeile der ersten Nachricht je Commit.
describe('gefahr-blocken — Commit-Präfix nach CLAUDE.md §5 (Nr. 138)', () => {
  const PRAEFIX_GRUND = 'Blockiert: Commit-Texte beginnen mit feat:, fix:, docs:, chore:, refactor: oder WIP: (CLAUDE.md §5).'

  beforeAll(() => {
    writeFileSync(path.join(aufFeature, 'nachricht-test.txt'), 'test: x\n\nText\n')
    writeFileSync(path.join(aufFeature, 'nachricht-docs.txt'), 'docs: x\n')
    writeFileSync(path.join(aufFeature, 'nachricht-merge.txt'), 'Merge origin/nacht/2026-10-22/137-kaufsperre in integration/lauf21\n')
  })

  for (const befehl of [
    'git commit -m "test: x"',
    'git commit -m "Kaufsperre"',
    'git commit -F nachricht-test.txt',
    // Weitere Schreibweisen: -am, --message, --file, zweites -m, Here-Document, Text ohne Doppelpunkt.
    'git commit -am "test: x"',
    'git commit --message="test: x"',
    'git commit --message "Kaufsperre"',
    'git commit --amend -m "Kaufsperre"',
    'git commit --file=nachricht-test.txt',
    'git commit -m "x" -m "fix: y"',
    'git commit -m "fixes: x"',
    'git commit -m "Merge-Konflikt gelöst"',
    'git add x && git commit -m "test: x"',
    ['git commit -F - <<EOF', 'test: x', 'EOF'].join('\n'),
    ['git commit -m "$(cat <<\'EOF\'', 'test: x', '', 'Text', 'EOF', ')"'].join('\n'),
    // Das F gehört zum Wert von -S (Schlüssel), das spätere -m zählt.
    'git commit -SF -m "test: x"',
  ]) {
    it(`blockt: ${befehl}`, () => {
      const r = lauf(befehl)
      expect(r.code).toBe(2)
      expect(r.grund.trim()).toBe(PRAEFIX_GRUND)
    })
  }

  it('findet den Ordner über git -C und cd — auch für den Pfad hinter -F', () => {
    expect(lauf(`git -C ${aufFeature} commit -m "x"`, keinRepo).grund.trim()).toBe(PRAEFIX_GRUND)
    expect(lauf(`cd ${aufFeature} && git commit -F nachricht-test.txt`, keinRepo).grund.trim()).toBe(PRAEFIX_GRUND)
    expect(lauf(`git -C ${aufFeature} commit -F nachricht-docs.txt`, keinRepo).code).toBe(0)
    expect(lauf(`cd ${aufFeature} && git commit -F nachricht-merge.txt`, keinRepo).code).toBe(0)
  })

  it('prüft zuerst den Commit auf main — der behält seinen Grund', () => {
    const r = lauf('git commit -m "test: x"', aufMain)
    expect(r.code).toBe(2)
    expect(r.grund).toContain('Auf main wird nie direkt committet')
  })

  for (const befehl of [
    'git commit -m "fix: x"',
    'git commit -m "WIP: x"',
    'git commit -F nachricht-docs.txt',
    'git commit -F nachricht-merge.txt',
    // Eine Datei, die sich nicht lesen lässt, und eine Variable kann der Hook nicht sehen — git entscheidet selbst.
    'git commit -F fehlt.txt',
    'git commit -m "$MSG"',
    'git commit -m "feat: x"',
    'git commit -m "docs: x"',
    'git commit -m "chore: x"',
    'git commit -m "refactor: x"',
    'git commit -m "fix: x" -m "Text"',
    'git commit -am "fix: x"',
    'git commit -m "Merge origin/nacht/2026-10-22/137-kaufsperre in integration/lauf21"',
    ['git commit -F - <<EOF', 'fix: x', 'EOF'].join('\n'),
    ["cat <<'EOF' | git commit -F -", 'docs: x', 'EOF'].join('\n'),
    // Ohne -m oder -F gibt es keine Nachricht zu prüfen; git merge prüft der Hook nicht.
    'git commit --no-edit',
    'git commit --amend --no-edit',
    'git merge --no-ff -m "x" origin/nacht/2026-10-22/137-kaufsperre',
    // Das m gehört zum Wert von -u (Modus), keine Nachricht.
    'git commit -unormal -m "fix: x"',
  ]) {
    it(`lässt durch: ${befehl}`, () => {
      expect(lauf(befehl).code).toBe(0)
    })
  }
})

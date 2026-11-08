import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { KOPIE_PRAEFIX, pruefeKopieName, pruefeZielKopie, verwaltungsAdresse } from '../scripts/pruefung/db-schalter'
import { tempWorktree } from './pruefung-worktree'

/**
 * Die Werkzeug-Skripte aus Nr. 262: Prüf-Browser mit festen Flags,
 * `--session` als Pflicht für die Bild-Skripte, der DB-Schalter für
 * Fehlerzustände nur an einer Kopie und der laufneutrale dev-Pfad. Kein
 * Browser startet, keine Datenbank wird angefasst: agent-browser ist eine
 * Attrappe, die ihre Aufrufe mitschreibt; der DB-Schalter bricht in jedem
 * Fall vor dem Verbinden ab.
 */

const wt = tempWorktree('pruefung-skripte-')
const ordner = mkdtempSync(join(tmpdir(), 'pruefung-skripte-aus-'))

afterAll(() => {
  wt.weg()
  rmSync(ordner, { recursive: true, force: true })
})

/** Eine agent-browser-Attrappe im PATH: schreibt jeden Aufruf als Zeile, gibt für eval ein JSON aus. */
function attrappe(): { pfad: string; aufrufe: () => string[] } {
  const bin = mkdtempSync(join(ordner, 'bin-'))
  const log = join(bin, 'aufrufe.log')
  const skript = join(bin, 'agent-browser')
  // Eine Zeile je Aufruf, auch wenn ein Argument (das Skript für eval) Zeilenumbrüche trägt.
  writeFileSync(skript, `#!/usr/bin/env bash\nzeile="$*"\necho "\${zeile//$'\\n'/ }" >> "${log}"\ncase " $* " in *" eval "*) echo '"1600 900 2"' ;; esac\n`)
  chmodSync(skript, 0o755)
  return { pfad: `${bin}:${process.env['PATH'] ?? ''}`, aufrufe: () => readFileSync(log, 'utf8').trim().split('\n') }
}

describe('pruef-browser.sh', () => {
  const lauf = spawnSync(wt.skript('pruef-browser.sh'), ['flags', 'fotograf-1', '9301'], { encoding: 'utf8' })
  const zeilen = lauf.stdout.trim().split('\n')

  it('startet Chromium aus /opt/pw-browsers', () => {
    // Ohne Chromium auf der Maschine (CI) bricht das Skript ab, statt einen anderen Browser zu nehmen.
    if (lauf.status !== 0) {
      expect(lauf.stderr).toContain('kein Chromium unter /opt/pw-browsers')
      return
    }
    expect(zeilen[0]).toMatch(/^\/opt\/pw-browsers\/chromium-[^/]+\/chrome-linux[^/]*\/chrome$/)
  })

  it('genau die festen Flags, mit --lang=de-AT und eigenem Profil unter .nachtlauf/', () => {
    if (lauf.status !== 0) return
    expect(zeilen.slice(1)).toEqual([
      '--headless=new',
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=9301',
      '--host-resolver-rules=MAP localhost 127.0.0.1',
      '--no-proxy-server',
      '--hide-scrollbars',
      '--enable-features=OverlayScrollbar',
      '--lang=de-AT',
      `--user-data-dir=${join(wt.ordner, '.nachtlauf', 'browser', 'fotograf-1', 'profil')}`,
      // Nur als root (Container): Chromium startet dort nicht mit Sandbox.
      ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    ])
  })

  it.each([[['flags', 'Fotograf 1', '9301']], [['flags', 'f1']], [['flags', '../x', '9301']], [['oeffne', 'f1', '9301']]])('lehnt %j ab', (args) => {
    expect(spawnSync(wt.skript('pruef-browser.sh'), args, { encoding: 'utf8' }).status).toBe(1)
  })
})

describe('--session ist Pflicht (seiten-bild.sh, board-bilder.sh)', () => {
  const board = join(ordner, 'board.html')
  writeFileSync(board, '<figure></figure>')
  const faelle = {
    'seiten-bild.sh': (ziel: string) => ['9222', 'http://localhost:3000/', join(ziel, 'bild'), '390', 'hell'],
    'board-bilder.sh': (ziel: string) => ['9222', board, ziel, '390', 'hell'],
  } as const

  it.each(Object.keys(faelle) as Array<keyof typeof faelle>)('%s bricht ohne Sitzungsnamen mit Exit 1 ab und ruft agent-browser nie', (name) => {
    const ab = attrappe()
    const ziel = mkdtempSync(join(ordner, 'ziel-'))
    for (const args of [faelle[name](ziel), ['--session', '', ...faelle[name](ziel)], ['--session', 'Ein Name', ...faelle[name](ziel)]]) {
      const lauf = spawnSync(wt.skript(name), args, { encoding: 'utf8', env: { ...process.env, PATH: ab.pfad } })
      expect(lauf.status).toBe(1)
      expect(lauf.stderr).toContain('--session <name> fehlt')
    }
    expect(() => ab.aufrufe()).toThrow()
  })

  it.each(Object.keys(faelle) as Array<keyof typeof faelle>)('%s reicht die Sitzung an jeden Aufruf von agent-browser durch', (name) => {
    const ab = attrappe()
    const ziel = mkdtempSync(join(ordner, 'ziel-'))
    const lauf = spawnSync(wt.skript(name), ['--session', 'fotograf-2', ...faelle[name](ziel)], { encoding: 'utf8', env: { ...process.env, PATH: ab.pfad } })
    expect(lauf.status, lauf.stderr).toBe(0)
    const aufrufe = ab.aufrufe()
    expect(aufrufe.length).toBeGreaterThan(3)
    for (const aufruf of aufrufe) expect(aufruf.startsWith('--session fotograf-2 --cdp 9222 ')).toBe(true)
  })
})

describe('fotograf.sh', () => {
  const quelle = readFileSync(wt.skript('fotograf.sh'), 'utf8')

  it('dev-Worktree unter dem laufneutralen festen Pfad $HOME/nachtlauf-dev', () => {
    expect(quelle).toContain('DEV_WT="$HOME/nachtlauf-dev"')
    expect(quelle).not.toMatch(/nachtlauf\d+-dev/)
  })

  it('stopp entfernt den dev-Worktree mit git worktree remove --force', () => {
    expect(quelle).toContain('git -C "$WT" worktree remove --force "$DEV_WT"')
  })

  it('db-aus und db-an gehen nur über den DB-Schalter mit der Liste der Kopie', () => {
    expect(quelle).toContain('pruef-env.sh" liste --db "$KOPIE"')
    expect(quelle).toContain('db-schalter.ts" "${MODUS#db-}" "$KOPIE"')
  })
})

describe('DB-Schalter (fotograf.sh db-aus / db-an)', () => {
  it('nimmt nur Namen mit Kopie-Präfix', () => {
    expect(KOPIE_PRAEFIX).toBe('kopie_')
    expect(pruefeKopieName('kopie_1_fz_p262_a')).toBeNull()
  })

  it.each([
    ['die Prüf-Haupt-DB', 'fz_p262_a'],
    ['ein Name ohne Präfix (Kopie nur als Endung)', 'fz_p262_a_kopie_1'],
    ['nur das Präfix', 'kopie_'],
    ['Sonderzeichen', 'kopie_1;drop'],
    ['kein Name', undefined],
  ])('lehnt %s ab', (_fall, name) => {
    expect(pruefeKopieName(name)).not.toBeNull()
  })

  it('verlangt, dass DATABASE_URL auf genau diese Kopie zeigt; verbunden wird mit der Verwaltungs-DB', () => {
    expect(pruefeZielKopie('postgresql://postgres:pw@localhost:5432/kopie_1_a', 'kopie_1_a')).toBeNull()
    expect(pruefeZielKopie('postgresql://postgres:pw@localhost:5432/fz_p262_a', 'kopie_1_a')).not.toBeNull()
    expect(verwaltungsAdresse('postgresql://postgres:pw@localhost:5432/kopie_1_a')).toBe('postgresql://postgres:pw@localhost:5432/postgres')
  })

  /** Der Befehl selbst, aus dem Temp-Worktree, mit einer Umgebung wie `env -i`. */
  function schalter(args: string[], url: string) {
    return spawnSync(join(wt.ordner, 'node_modules', '.bin', 'tsx'), [wt.skript('db-schalter.ts'), ...args], {
      cwd: wt.ordner,
      encoding: 'utf8',
      env: { PATH: process.env['PATH'], HOME: process.env['HOME'], DATABASE_URL: url, DIRECT_URL: url } as Record<string, string | undefined> as NodeJS.ProcessEnv,
    })
  }

  it('Befehl: lehnt die Haupt-DB ab, bevor er verbindet', () => {
    const lauf = schalter(['aus', 'fz_p262_a'], 'postgresql://postgres:pw@localhost:5432/fz_p262_a')
    expect(lauf.status).toBe(1)
    expect(lauf.stderr).toContain('keine Kopie')
  }, 30_000)

  it('Befehl: lehnt einen fremden Host ab, bevor er verbindet', () => {
    const lauf = schalter(['aus', 'kopie_1_a'], 'postgresql://postgres:pw@db.example.com:5432/kopie_1_a')
    expect(lauf.status).toBe(1)
    expect(lauf.stderr).toContain('db.example.com:5432')
    expect(lauf.stderr).not.toContain('pw@')
  }, 30_000)

  it('Befehl: lehnt einen Namen ohne Präfix ab, auch für db-an', () => {
    const lauf = schalter(['an', 'fz_p262_a_kopie_1'], 'postgresql://postgres:pw@localhost:5432/fz_p262_a_kopie_1')
    expect(lauf.status).toBe(1)
    expect(lauf.stderr).toContain('keine Kopie')
  }, 30_000)
})

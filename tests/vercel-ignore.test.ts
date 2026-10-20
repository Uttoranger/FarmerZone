/**
 * Vorschau ohne WIP-Commits (Register G7, Nr. 121): `scripts/vercel-ignore.sh` ist der
 * `ignoreCommand` in vercel.json. Ausgang 0 = nicht bauen, 1 = bauen. Die Produktion
 * baut immer, im Zweifel wird gebaut – ein Fehler im Skript darf nie eine
 * Auslieferung verhindern.
 *
 * Das Skript läuft echt (spawnSync) mit einer Umgebung, die der Test selbst baut:
 * Jeder Fall setzt VERCEL_GIT_COMMIT_MESSAGE selbst, sonst hinge das Ergebnis vom
 * lokalen Commit ab.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const SKRIPT = join(WURZEL, 'scripts', 'vercel-ignore.sh')

type Umgebung = { VERCEL_ENV?: string; VERCEL_GIT_COMMIT_MESSAGE?: string }

/** Nur PATH und die Werte des Falls – nichts aus der Umgebung des Entwicklers (NODE_ENV verlangt der Typ, das Skript liest es nicht). */
function laufe(umgebung: Umgebung, verzeichnis: string = WURZEL): number | null {
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'test', PATH: process.env.PATH ?? '', ...umgebung }
  const ergebnis = spawnSync('bash', [SKRIPT], { cwd: verzeichnis, env, encoding: 'utf8' })
  return ergebnis.status
}

describe('scripts/vercel-ignore.sh', () => {
  it('baut in der Produktion auch bei einem WIP-Betreff', () => {
    expect(laufe({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_MESSAGE: 'WIP: halber Stand' })).toBe(1)
  })

  it('baut keine Vorschau für einen WIP-Betreff', () => {
    expect(laufe({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_MESSAGE: 'WIP: halber Stand' })).toBe(0)
  })

  it('baut die Vorschau für einen Betreff ohne WIP', () => {
    expect(laufe({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_MESSAGE: 'feat: Testhof markieren' })).toBe(1)
  })

  it('baut, wenn VERCEL_ENV leer ist oder fehlt', () => {
    expect(laufe({ VERCEL_ENV: '', VERCEL_GIT_COMMIT_MESSAGE: 'WIP: halber Stand' })).toBe(1)
    expect(laufe({ VERCEL_GIT_COMMIT_MESSAGE: 'WIP: halber Stand' })).toBe(1)
  })

  it('zählt WIP nur am Anfang des Betreffs', () => {
    expect(laufe({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_MESSAGE: 'Fix: WIP: halber Stand' })).toBe(1)
  })

  it('liest nur die erste Zeile als Betreff', () => {
    // WIP in einer späteren Zeile ändert nichts am Betreff …
    expect(
      laufe({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_MESSAGE: 'fix: Bestand\n\nWIP: nur im Text' }),
    ).toBe(1)
    // … und eine WIP-Zeile oben zählt, auch wenn darunter ein Text folgt.
    expect(
      laufe({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_MESSAGE: 'WIP: halber Stand\n\nfix: Bestand' }),
    ).toBe(0)
  })

  it('fragt git, wenn Vercel keine Nachricht mitgibt', () => {
    const ordner = mkdtempSync(join(tmpdir(), 'vercel-ignore-'))
    try {
      const git = (...argumente: string[]) =>
        spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...argumente], {
          cwd: ordner,
          encoding: 'utf8',
        })
      git('init', '-q')
      git('commit', '-q', '--allow-empty', '-m', 'WIP: halber Stand')
      expect(laufe({ VERCEL_ENV: 'preview' }, ordner)).toBe(0)

      git('commit', '-q', '--allow-empty', '-m', 'feat: fertiger Stand')
      expect(laufe({ VERCEL_ENV: 'preview' }, ordner)).toBe(1)
    } finally {
      rmSync(ordner, { recursive: true, force: true })
    }
  })

  it('baut im Zweifel: kein Betreff und kein Repository', () => {
    const ordner = mkdtempSync(join(tmpdir(), 'vercel-ignore-'))
    try {
      // Ein Elternordner mit .git darf git nicht ins Spiel bringen.
      const env: NodeJS.ProcessEnv = { NODE_ENV: 'test', PATH: process.env.PATH ?? '', VERCEL_ENV: 'preview', GIT_CEILING_DIRECTORIES: tmpdir() }
      const ergebnis = spawnSync('bash', [SKRIPT], { cwd: ordner, env, encoding: 'utf8' })
      expect(ergebnis.status).toBe(1)
    } finally {
      rmSync(ordner, { recursive: true, force: true })
    }
  })

  it.skipIf(process.platform === 'win32')('ist ausführbar', () => {
    expect(statSync(SKRIPT).mode & 0o111).not.toBe(0)
  })
})

describe('vercel.json', () => {
  const konfig = JSON.parse(readFileSync(join(WURZEL, 'vercel.json'), 'utf8')) as {
    ignoreCommand?: string
    crons?: Array<{ path: string; schedule: string }>
  }

  it('ruft das Skript als ignoreCommand auf', () => {
    expect(konfig.ignoreCommand).toBe('bash scripts/vercel-ignore.sh')
  })

  it('führt die vier Zeitpläne unverändert weiter', () => {
    expect(konfig.crons).toEqual([
      { path: '/api/cron/cleanup-reservations', schedule: '0 3 * * *' },
      { path: '/api/cron/verwaiste-bestellungen', schedule: '30 3 * * *' },
      { path: '/api/cron/betrieb', schedule: '0 4 * * *' },
      { path: '/api/cron/briefkasten', schedule: '0 5 * * 1' },
    ])
  })
})

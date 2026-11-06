import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { tempWorktree, type TempWorktree } from './pruefung-worktree'

/**
 * scripts/pruefung/pruef-env.sh (freigabe.md §36, „Prüf-Umgebung“): Die Liste
 * für `env -i` enthält genau die festen Namen und keinen der weggelassenen —
 * auch dann nicht, wenn sie in der aufrufenden Umgebung gesetzt sind.
 */

// Das Skript läuft aus einer Kopie in einem Temp-Worktree und prüft genau
// diesen (aus dem eigenen Pfad) und den Arbeitsordner — nie den Klon, in dem
// ein Entwickler .env.local haben darf. Eine Angabe zum Umlenken gibt es nicht.
const wt = tempWorktree('pruefung-umgebung-')
const SKRIPT = wt.skript('pruef-env.sh')
const ordner = mkdtempSync(join(tmpdir(), 'pruefung-umgebung-aus-'))
const datei = join(ordner, 'pruef-env')

const ERLAUBT = [
  'PATH',
  'HOME',
  'NODE_OPTIONS',
  'DATABASE_URL',
  'DIRECT_URL',
  'BETTER_AUTH_URL',
  'NEXT_PUBLIC_APP_URL',
  'BETTER_AUTH_SECRET',
  'LINK_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
].sort()

const WEGGELASSEN = [
  'RESEND_API_KEY',
  'RESEND_WEBHOOK_SECRET',
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_OIDC_TOKEN',
  'PRUEF_PG_BASIS',
  'NODE_ENV',
  'TEST_DATABASE_URL',
]

// Die aufrufende Umgebung trägt absichtlich alles, was nicht durchkommen darf.
const umgebung = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  PGPASSWORD: 'nur-fuer-den-test',
  RESEND_API_KEY: 're_nicht_echt',
  RESEND_WEBHOOK_SECRET: 'whsec_nicht_echt',
  NEXT_PUBLIC_SENTRY_DSN: 'https://nicht-echt.invalid/1',
  SENTRY_AUTH_TOKEN: 'nicht-echt',
  VERCEL: '1',
  VERCEL_ENV: 'preview',
  STRIPE_SECRET_KEY: 'sk_live_nicht_echt',
} as Record<string, string | undefined> as NodeJS.ProcessEnv

/** `neu` ohne Ausnahme: Status und Fehlerausgabe, damit der Abbruchgrund geprüft wird. */
function neu(skript: string, cwd: string, ziel: string, extra: string[] = [], env = umgebung) {
  const lauf = spawnSync(skript, ['neu', '--datei', ziel, ...extra], { cwd, env, encoding: 'utf8' })
  return { status: lauf.status, stderr: lauf.stderr }
}

function zeilen(): string[] {
  execFileSync(SKRIPT, ['neu', '--datei', datei], { cwd: wt.ordner, env: umgebung, stdio: 'pipe' })
  return execFileSync(SKRIPT, ['liste', '--db', 'fz_p243_test', '--port', '3101', '--datei', datei], { cwd: wt.ordner, env: umgebung, encoding: 'utf8' })
    .trim()
    .split('\n')
}

describe('pruef-env.sh', () => {
  const liste = zeilen()
  const namen = liste.map((z) => z.slice(0, z.indexOf('=')))
  const wert = (name: string) => liste.find((z) => z.startsWith(`${name}=`))?.slice(name.length + 1)

  afterAll(() => {
    wt.weg()
    rmSync(ordner, { recursive: true, force: true })
  })

  it('enthält genau die festen Namen', () => {
    expect([...namen].sort()).toEqual(ERLAUBT)
  })

  it.each(WEGGELASSEN)('enthält %s nicht', (name) => {
    expect(namen).not.toContain(name)
  })

  it('Stripe nur als Platzhalter, auch wenn die Umgebung einen Live-Schlüssel trägt', () => {
    expect(wert('STRIPE_SECRET_KEY')).toBe('sk_test_pruefung')
    expect(wert('STRIPE_WEBHOOK_SECRET')).toBe('whsec_pruefung')
  })

  it('Datenbank auf localhost, beide Adressen gleich; App-Adresse mit dem Port des Servers', () => {
    const db = new URL(wert('DATABASE_URL') ?? '')
    expect(db.hostname).toBe('localhost')
    expect(db.pathname).toBe('/fz_p243_test')
    expect(wert('DIRECT_URL')).toBe(wert('DATABASE_URL'))
    expect(wert('NEXT_PUBLIC_APP_URL')).toBe('http://localhost:3101')
    expect(wert('BETTER_AUTH_URL')).toBe('http://localhost:3101')
  })

  it('Geheimnisse je Lauf neu, 32 Byte hex, und die Datei nur für den Besitzer', () => {
    expect(wert('BETTER_AUTH_SECRET')).toMatch(/^[0-9a-f]{64}$/)
    expect(wert('LINK_SECRET')).toMatch(/^[0-9a-f]{64}$/)
    expect(wert('LINK_SECRET')).not.toBe(wert('BETTER_AUTH_SECRET'))
    expect(statSync(datei).mode & 0o777).toBe(0o600)
    const vorher = wert('LINK_SECRET')
    expect(zeilen().find((z) => z.startsWith('LINK_SECRET='))).not.toBe(`LINK_SECRET=${vorher}`)
  })

  // Gegenprobe: Die Sperre selbst bleibt ohne Ausnahme — .env-Datei oder
  // Verweis darauf im Worktree des Skripts bricht ab, bevor eine Datei entsteht.
  const ENV_FAELLE = [
    ['.env.local', (o: string) => writeFileSync(join(o, '.env.local'), 'X=1\n')],
    ['.env.test', (o: string) => writeFileSync(join(o, '.env.test'), 'X=1\n')],
    ['Verweis auf .env.local', (o: string) => symlinkSync('/nirgends/.env.local', join(o, 'verweis'))],
  ] as const

  it.each(ENV_FAELLE)('bricht bei %s im Worktree des Skripts ab und legt keine Datei an', (_name, anlegen) => {
    const mitEnv: TempWorktree = tempWorktree('pruefung-umgebung-env-')
    try {
      anlegen(mitEnv.ordner)
      const ziel = join(ordner, 'pruef-env-wt')
      const lauf = neu(mitEnv.skript('pruef-env.sh'), mitEnv.ordner, ziel)
      expect(lauf.status).toBe(1)
      expect(lauf.stderr).toContain('.env-Datei')
      expect(existsSync(ziel)).toBe(false)
    } finally {
      mitEnv.weg()
    }
  })

  it.each(ENV_FAELLE)('bricht bei %s im Arbeitsordner ab, auch wenn der Worktree sauber ist', (_name, anlegen) => {
    const arbeit = mkdtempSync(join(ordner, 'arbeit-'))
    anlegen(arbeit)
    const ziel = join(ordner, 'pruef-env-arbeit')
    const lauf = neu(SKRIPT, arbeit, ziel)
    expect(lauf.status).toBe(1)
    expect(lauf.stderr).toContain('.env-Datei')
    expect(existsSync(ziel)).toBe(false)
  })

  it('kennt keine Angabe, die die Prüfung auf einen anderen Ordner lenkt', () => {
    const leer = mkdtempSync(join(ordner, 'leer-'))
    const ziel = join(ordner, 'pruef-env-wt-angabe')
    const lauf = neu(SKRIPT, wt.ordner, ziel, ['--wt', leer])
    expect(lauf.status).toBe(1)
    expect(lauf.stderr).toContain('unbekannte Angabe --wt')
    expect(existsSync(ziel)).toBe(false)
  })

  it.each(['p@ss', 'a:b', 'x/y', '%40'])('lehnt PGPASSWORD %s ab (stünde unkodiert in der Adresse)', (passwort) => {
    const ziel = join(ordner, 'pruef-env-passwort')
    const lauf = neu(SKRIPT, wt.ordner, ziel, [], { ...umgebung, PGPASSWORD: passwort })
    expect(lauf.status).toBe(1)
    expect(lauf.stderr).toContain('PGPASSWORD nur')
    expect(existsSync(ziel)).toBe(false)
  })

  it('lehnt einen DB-Namen mit Sonderzeichen ab', () => {
    expect(() =>
      execFileSync(SKRIPT, ['liste', '--db', 'x;rm', '--port', '3101', '--datei', datei], { cwd: wt.ordner, env: umgebung, stdio: 'pipe' })
    ).toThrow()
  })
})

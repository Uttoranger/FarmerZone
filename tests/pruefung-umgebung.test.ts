import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * scripts/pruefung/pruef-env.sh (freigabe.md §36, „Prüf-Umgebung“): Die Liste
 * für `env -i` enthält genau die festen Namen und keinen der weggelassenen —
 * auch dann nicht, wenn sie in der aufrufenden Umgebung gesetzt sind.
 */

const SKRIPT = join(process.cwd(), 'scripts/pruefung/pruef-env.sh')
const ordner = mkdtempSync(join(tmpdir(), 'pruefung-umgebung-'))
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

function zeilen(): string[] {
  execFileSync(SKRIPT, ['neu', '--datei', datei], { env: umgebung, stdio: 'pipe' })
  return execFileSync(SKRIPT, ['liste', '--db', 'fz_p243_test', '--port', '3101', '--datei', datei], { env: umgebung, encoding: 'utf8' })
    .trim()
    .split('\n')
}

describe('pruef-env.sh', () => {
  const liste = zeilen()
  const namen = liste.map((z) => z.slice(0, z.indexOf('=')))
  const wert = (name: string) => liste.find((z) => z.startsWith(`${name}=`))?.slice(name.length + 1)

  afterAll(() => rmSync(ordner, { recursive: true, force: true }))

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

  it('lehnt einen DB-Namen mit Sonderzeichen ab', () => {
    expect(() =>
      execFileSync(SKRIPT, ['liste', '--db', 'x;rm', '--port', '3101', '--datei', datei], { env: umgebung, stdio: 'pipe' })
    ).toThrow()
  })
})

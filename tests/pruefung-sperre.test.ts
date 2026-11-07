import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  findeEnvDateien,
  hostUndPort,
  istEnvDateiName,
  istLoopbackServerAdresse,
  pruefeDatenbankAdressen,
  pruefeDatenbankZustand,
  pruefeOhneEnvDateien,
} from '../scripts/pruefung/sperre'

/**
 * Die Loopback-Sperre des Prüfwerkzeugs (freigabe.md §36, Nr. 243): Prüf-Seed,
 * Prüf-Server und virtueller Authenticator laufen nur gegen eine Wegwerf-DB auf
 * localhost oder 127.0.0.1. Die Adressen hier sind erfunden.
 */

const beide = (url: string) => ({ DATABASE_URL: url, DIRECT_URL: url })

describe('pruefeDatenbankAdressen', () => {
  it.each([
    'postgresql://postgres:pw@localhost:5432/fz_p243_a',
    'postgresql://postgres:pw@127.0.0.1:5432/fz_p243_a',
    'postgres://postgres:pw@localhost/fz_p243_a',
  ])('nimmt %s an', (url) => {
    expect(pruefeDatenbankAdressen(beide(url))).toBeNull()
  })

  it.each([
    ['ein fremder Host mit localhost als Teilwort', 'postgresql://postgres:pw@db.localhost.example.com:5432/db'],
    ['localhost als Vorsatz eines fremden Hosts', 'postgresql://postgres:pw@localhost.evil.at:5432/db'],
    ['localhost nur im Pfad', 'postgresql://postgres:pw@db.example.com:5432/localhost'],
    ['localhost nur im Passwort', 'postgresql://postgres:localhost@db.example.com:5432/db'],
    ['der Docker-Dienstname postgres', 'postgresql://postgres:pw@postgres:5432/db'],
    ['ein Supabase-Projekt', 'postgresql://postgres:pw@db.abcdefghijklmnop.supabase.co:5432/postgres'],
    ['ein Supabase-Pooler', 'postgresql://postgres.abcdefghijklmnop:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'],
    ['ein Benutzer mit Punkt auf localhost (Tunnel)', 'postgresql://postgres.abcdefghijklmnop:pw@localhost:5432/postgres'],
    ['IPv6-Loopback, das istTestDatenbank nicht kennt', 'postgresql://postgres:pw@[::1]:5432/db'],
    ['keine Postgres-Adresse', 'mysql://postgres:pw@localhost:3306/db'],
  ])('lehnt %s ab', (_, url) => {
    expect(pruefeDatenbankAdressen(beide(url))).not.toBeNull()
  })

  it('lehnt eine abweichende DIRECT_URL ab, auch eine lokale', () => {
    const lokal = 'postgresql://postgres:pw@localhost:5432/fz_p243_a'
    expect(pruefeDatenbankAdressen({ DATABASE_URL: lokal, DIRECT_URL: 'postgresql://postgres:pw@db.abcdefghijklmnop.supabase.co:5432/postgres' })).not.toBeNull()
    expect(pruefeDatenbankAdressen({ DATABASE_URL: lokal, DIRECT_URL: 'postgresql://postgres:pw@localhost:5432/anders' })).not.toBeNull()
  })

  it('lehnt fehlende Adressen ab', () => {
    expect(pruefeDatenbankAdressen({})).not.toBeNull()
    expect(pruefeDatenbankAdressen({ DATABASE_URL: 'postgresql://postgres:pw@localhost:5432/db' })).not.toBeNull()
  })

  it('lehnt ab, wenn VERCEL gesetzt ist', () => {
    expect(pruefeDatenbankAdressen({ ...beide('postgresql://postgres:pw@localhost:5432/db'), VERCEL: '1' })).not.toBeNull()
  })

  it('nennt in der Meldung nur Host und Port, nie das Passwort', () => {
    const grund = pruefeDatenbankAdressen(beide('postgresql://postgres:geheim-xyz@db.example.com:6543/db'))
    expect(grund).toContain('db.example.com:6543')
    expect(grund).not.toContain('geheim-xyz')
    expect(hostUndPort('postgresql://u:geheim-xyz@localhost/db')).toBe('localhost:5432')
  })
})

describe('istLoopbackServerAdresse', () => {
  it.each([null, '127.0.0.1', '127.0.0.1/32', '::1', '::1/128', '::ffff:127.0.0.1'])('nimmt %s an', (a) => {
    expect(istLoopbackServerAdresse(a)).toBe(true)
  })
  it.each(['10.0.0.5', '192.168.1.2', '172.17.0.2', '::ffff:10.0.0.1', '2001:db8::1', ''])('lehnt %s ab', (a) => {
    expect(istLoopbackServerAdresse(a)).toBe(false)
  })
})

describe('pruefeDatenbankZustand', () => {
  it('lehnt eine DB mit Passkey-Zeile ab', () => {
    expect(pruefeDatenbankZustand({ passkeys: 1, konten: 0, seedKonten: 30 })).not.toBeNull()
  })
  it('lehnt eine DB mit mehr Konten als der Seed ab', () => {
    expect(pruefeDatenbankZustand({ passkeys: 0, konten: 31, seedKonten: 30 })).not.toBeNull()
  })
  it('nimmt eine frische oder schon geseedete DB an', () => {
    expect(pruefeDatenbankZustand({ passkeys: 0, konten: 0, seedKonten: 30 })).toBeNull()
    expect(pruefeDatenbankZustand({ passkeys: 0, konten: 30, seedKonten: 30 })).toBeNull()
  })
})

describe('.env-Dateien', () => {
  let ordner: string | null = null
  afterEach(() => {
    if (ordner) rmSync(ordner, { recursive: true, force: true })
    ordner = null
  })

  it.each(['.env', '.env.local', '.env.test', '.env.production.local'])('%s zählt', (name) => {
    expect(istEnvDateiName(name)).toBe(true)
  })
  it.each(['.env.example', '.env.test.example', 'env.ts', '.envrc-nicht', 'umgebung.env'])('%s zählt nicht', (name) => {
    expect(istEnvDateiName(name)).toBe(false)
  })

  it('findet .env-Dateien und Verweise darauf, nicht aber *.example', () => {
    ordner = mkdtempSync(join(tmpdir(), 'pruefung-sperre-'))
    const wt = join(ordner, 'wt')
    mkdirSync(wt)
    writeFileSync(join(wt, '.env.example'), 'X=1\n')
    expect(findeEnvDateien(wt)).toEqual([])
    expect(pruefeOhneEnvDateien([wt])).toBeNull()

    writeFileSync(join(ordner, '.env.local'), 'X=1\n')
    symlinkSync(join(ordner, '.env.local'), join(wt, 'einstellungen'))
    expect(findeEnvDateien(wt)).toEqual([join(wt, 'einstellungen')])

    writeFileSync(join(wt, '.env.test'), 'X=1\n')
    expect(pruefeOhneEnvDateien([wt])).toContain('.env.test')
  })
})

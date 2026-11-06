import { createPublicKey, createPrivateKey, sign, verify } from 'node:crypto'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { coseSchluessel, erzeugePruefPasskey, PRUEF_RP_IDS } from '../scripts/pruefung/passkey'
import {
  leseSeedOptionen,
  liegtUnterNachtlauf,
  SEED_VORGABEN,
  STICHTAG_VERGANGENHEIT,
  stichtagFuer,
} from '../scripts/pruefung/optionen'
import { pflichtOrdner, werkzeugWorktree } from '../scripts/pruefung/sperre'

/**
 * Bausteine des Prüf-Seeds ohne Datenbank (freigabe.md §36, Nr. 243):
 * Stichtag-Option, Ausgabepfade nur unter .nachtlauf/, Prüf-Passkey.
 */

describe('Stichtag des Prüf-Seeds', () => {
  const jetzt = new Date('2026-11-06T20:00:00.000Z')

  it('vergangenheit (Vorgabe): 1. Oktober 2026 – der Stand der Boards nach dem Stichtag', () => {
    expect(SEED_VORGABEN.stichtag).toBe('vergangenheit')
    expect(stichtagFuer('vergangenheit', jetzt).toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(stichtagFuer('vergangenheit', jetzt).getTime()).toBeLessThan(jetzt.getTime())
  })

  it('zukunft: heute + 30 Tage – für die zweite Prüf-DB vor T', () => {
    const tag = stichtagFuer('zukunft', jetzt)
    expect(tag.toISOString()).toBe('2026-12-06T00:00:00.000Z')
    expect(tag.getTime()).toBeGreaterThan(jetzt.getTime())
  })

  it('gibt keine geteilte Instanz heraus', () => {
    stichtagFuer('vergangenheit', jetzt).setUTCFullYear(1999)
    expect(STICHTAG_VERGANGENHEIT.getUTCFullYear()).toBe(2026)
  })
})

describe('leseSeedOptionen', () => {
  it('liest beide Stichtag-Optionen', () => {
    expect(leseSeedOptionen([])).toEqual(SEED_VORGABEN)
    expect(leseSeedOptionen(['--stichtag', 'zukunft'])).toMatchObject({ stichtag: 'zukunft' })
    expect(leseSeedOptionen(['--stichtag', 'vergangenheit'])).toMatchObject({ stichtag: 'vergangenheit' })
  })

  it('lehnt Unbekanntes und Ausgaben außerhalb von .nachtlauf/ ab', () => {
    expect(typeof leseSeedOptionen(['--stichtag', 'morgen'])).toBe('string')
    expect(typeof leseSeedOptionen(['--gruendung'])).toBe('string')
    expect(typeof leseSeedOptionen(['--links', 'docs/links.json'])).toBe('string')
    expect(typeof leseSeedOptionen(['--passkey', '.nachtlauf/../schluessel.json'])).toBe('string')
    expect(leseSeedOptionen(['--links', '.nachtlauf/b/links.json'])).toMatchObject({ links: '.nachtlauf/b/links.json' })
    // Keine Angabe lenkt die .env-Prüfung auf einen anderen Ordner (Runde 2).
    expect(typeof leseSeedOptionen(['--wt', '/tmp/leer'])).toBe('string')
    expect(Object.keys(SEED_VORGABEN).sort()).toEqual(['links', 'passkey', 'stichtag'])
  })

  it('liegtUnterNachtlauf', () => {
    expect(liegtUnterNachtlauf('.nachtlauf/admin-passkey.json')).toBe(true)
    expect(liegtUnterNachtlauf('/home/x/wt/.nachtlauf/pruef-links.json')).toBe(true)
    expect(liegtUnterNachtlauf('tests/pruef-links.json')).toBe(false)
    expect(liegtUnterNachtlauf('.nachtlauf/../x.json')).toBe(false)
  })
})

describe('Ordner der .env-Prüfung', () => {
  it('der Worktree kommt aus dem Pfad des Werkzeugs, nicht aus einer Angabe', () => {
    expect(realpathSync(werkzeugWorktree())).toBe(realpathSync(process.cwd()))
  })

  it('immer Worktree und Arbeitsordner; Zusätze erweitern nur, doppelte fallen weg', () => {
    const anders = mkdtempSync(join(tmpdir(), 'pruefung-pflicht-'))
    try {
      const wt = realpathSync(werkzeugWorktree())
      expect(pflichtOrdner(process.cwd())).toEqual([wt])
      expect(pflichtOrdner(anders)).toEqual([wt, realpathSync(anders)])
      expect(pflichtOrdner(process.cwd(), [anders, anders])).toEqual([wt, realpathSync(anders)])
    } finally {
      rmSync(anders, { recursive: true, force: true })
    }
  })
})

describe('Prüf-Passkey', () => {
  const erstellt = new Date('2026-11-06T19:30:00.000Z')
  const p = erzeugePruefPasskey('seed-admin-id', erstellt)

  it('füllt die Zeile wie @better-auth/passkey', () => {
    expect(p.zeile).toMatchObject({
      name: 'Prüf-Passkey',
      userId: 'seed-admin-id',
      counter: 0,
      deviceType: 'singleDevice',
      backedUp: false,
      createdAt: erstellt,
    })
    expect(p.zeile.credentialID).toBe(p.geheim.credentialId)
    expect(Buffer.from(p.zeile.credentialID, 'base64url')).toHaveLength(16)
  })

  it('rpId nur localhost, userHandle = base64 der userId', () => {
    expect(PRUEF_RP_IDS).toContain(p.geheim.rpId)
    expect(p.geheim.rpId).toBe('localhost')
    expect(Buffer.from(p.geheim.userHandle, 'base64').toString('utf8')).toBe('seed-admin-id')
    expect(p.geheim.signCount).toBe(0)
  })

  it('der öffentliche COSE-Schlüssel passt zum privaten PKCS#8-Schlüssel', () => {
    const privat = createPrivateKey({ key: Buffer.from(p.geheim.privateKey, 'base64'), format: 'der', type: 'pkcs8' })
    const jwk = createPublicKey(privat).export({ format: 'jwk' })
    const erwartet = coseSchluessel(Buffer.from(String(jwk.x), 'base64url'), Buffer.from(String(jwk.y), 'base64url'))
    expect(Buffer.from(p.zeile.publicKey, 'base64').equals(erwartet)).toBe(true)

    const daten = Buffer.from('prüfung')
    const signatur = sign('sha256', daten, privat)
    expect(verify('sha256', daten, createPublicKey({ key: jwk, format: 'jwk' }), signatur)).toBe(true)
  })

  it('COSE: Map mit fünf Einträgen, kty EC2, alg ES256, crv P-256', () => {
    const cose = Buffer.from(p.zeile.publicKey, 'base64')
    expect(cose[0]).toBe(0xa5)
    expect(cose.subarray(1, 5)).toEqual(Buffer.from([0x01, 0x02, 0x03, 0x26]))
    expect(cose.subarray(5, 7)).toEqual(Buffer.from([0x20, 0x01]))
  })

  it('jeder Aufruf erzeugt einen neuen Schlüssel', () => {
    const q = erzeugePruefPasskey('seed-admin-id', erstellt)
    expect(q.geheim.privateKey).not.toBe(p.geheim.privateKey)
    expect(q.zeile.credentialID).not.toBe(p.zeile.credentialID)
  })
})

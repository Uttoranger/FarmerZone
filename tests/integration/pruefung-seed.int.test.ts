/**
 * Der Prüf-Seed (scripts/pruefung/pruef-seed.ts, freigabe.md §36, Nr. 243)
 * gegen ein echtes Postgres auf localhost: Ein zweiter Lauf auf derselben DB
 * bricht wegen der vorhandenen Passkey-Zeile ab, BEVOR er etwas schreibt —
 * kein Seed, kein Stichtag, keine Datei unter .nachtlauf/.
 *
 * Der erste Lauf braucht eine frische Wegwerf-DB (Migrationsfolge, dann
 * Seed); die Integrations-DB ist das nicht, deshalb legt der Test die
 * Passkey-Zeile selbst an und räumt sie wieder weg.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'

const WURZEL = process.cwd()
const AUSGABE = '.nachtlauf/int-pruefung-seed'
const KENNUNG = 'int-pruefung-seed-passkey'

function pruefSeed(): { status: number | null; stdout: string; stderr: string } {
  const url = process.env['DATABASE_URL'] ?? ''
  const lauf = spawnSync(
    join(WURZEL, 'node_modules', '.bin', 'tsx'),
    ['scripts/pruefung/pruef-seed.ts', '--links', `${AUSGABE}/links.json`, '--passkey', `${AUSGABE}/passkey.json`],
    // Wie unter env -i: nur, was der Seed braucht, um bis zur Sperre zu kommen.
    { cwd: WURZEL, encoding: 'utf8', env: { PATH: process.env['PATH'], HOME: process.env['HOME'], DATABASE_URL: url, DIRECT_URL: url } as Record<string, string | undefined> as NodeJS.ProcessEnv }
  )
  return { status: lauf.status, stdout: lauf.stdout, stderr: lauf.stderr }
}

afterEach(async () => {
  await prisma.passkey.deleteMany({ where: { id: KENNUNG } })
  rmSync(join(WURZEL, AUSGABE), { recursive: true, force: true })
})

describe('Prüf-Seed auf einer DB mit Passkey-Zeile', () => {
  it('bricht ab, ohne zu schreiben', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' }, select: { id: true, adminSeit: true } })
    const passkeysVorher = await prisma.passkey.count()
    await prisma.passkey.create({
      data: { id: KENNUNG, userId: admin.id, publicKey: 'AA==', credentialID: KENNUNG, counter: 0, deviceType: 'singleDevice', backedUp: false },
    })
    const vorher = await prisma.plattformEinstellung.findUnique({ where: { id: 'plattform' }, select: { hofpreisModellAb: true } })
    const bestellungenVorher = await prisma.order.count()

    const lauf = pruefSeed()

    expect(lauf.status).toBe(1)
    expect(lauf.stderr).toContain('Passkey-Zeile')
    // Meldungen nur mit Host und Port, nie mit der Adresse samt Passwort.
    expect(lauf.stdout + lauf.stderr).not.toContain(process.env['DATABASE_URL'] ?? '\u0000')
    expect(existsSync(join(WURZEL, AUSGABE, 'passkey.json'))).toBe(false)
    expect(existsSync(join(WURZEL, AUSGABE, 'links.json'))).toBe(false)
    const nachher = await prisma.plattformEinstellung.findUnique({ where: { id: 'plattform' }, select: { hofpreisModellAb: true } })
    expect(nachher).toEqual(vorher)
    expect(await prisma.order.count()).toBe(bestellungenVorher)
    expect(await prisma.passkey.count()).toBe(passkeysVorher + 1)
    const adminNachher = await prisma.user.findUniqueOrThrow({ where: { id: admin.id }, select: { adminSeit: true } })
    expect(adminNachher.adminSeit).toEqual(admin.adminSeit)
  })
})

/**
 * Schema für den Regelbetrieb und Admin-Protokoll (Register N33, N35;
 * Nachtlauf Nr. 188) gegen ein ECHTES Postgres — mit echter Anmeldung über
 * Better Auth und der echten Admin-Wache (Passkey-Admin aus setup/basis.ts).
 *
 * Beweist (Zustand danach):
 *  - Der Datenschritt der Migration 20261026100000_regelbetrieb macht
 *    bestehende Admins zu Inhabern — und nur sie; zweimal ausgeführt ändert
 *    er nichts mehr.
 *  - Eine Action ohne das Recht schreibt nichts und protokolliert nichts;
 *    Gegenprobe mit dem Recht: Zeile da, Eintrag im Protokoll mit Person,
 *    Art, Bezug und „mit Passkey“ — ohne Namen des Postens.
 *  - Das Aufräumen löscht Protokoll-Einträge älter als 5 Jahre, jüngere bleiben.
 * Daten erfunden (example.com, `int-`-Kennungen); danach weg.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { ADMIN_RECHT_FEHLER } from '@/lib/admin-rechte'
import { kostenpostenAnlegen } from '@/server/actions/finanzen'
import { adminProtokollGrenze, protokolliere } from '@/server/admin-protokoll'
import { raeumeAltesAuf } from '@/server/aufraeumen'
import { erstelleHofMitAnmeldung, intKennung, machePasskeyAdmin, raeumeAuf } from './setup/basis'

const DAY = 24 * 60 * 60 * 1000
const nutzer: string[] = []
const posten: string[] = []
const bezuege: string[] = []

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  await prisma.adminAktion.deleteMany({ where: { OR: [{ wer: { in: nutzer } }, { bezugId: { in: bezuege.splice(0) } }] } })
  await prisma.kostenposten.deleteMany({ where: { name: { in: posten.splice(0) } } })
  await prisma.user.deleteMany({ where: { id: { in: nutzer.filter((id) => id.startsWith('int-')) } } })
  nutzer.length = 0
  await raeumeAuf()
})

/** Der eine Datenschritt der Migration — aus der Datei gelesen, damit der Test genau ihn ausführt. */
function datenschritt(): string {
  const sql = readFileSync(join(process.cwd(), 'prisma/migrations/20261026100000_regelbetrieb/migration.sql'), 'utf8')
  const zeilen = sql.split('\n').filter((z) => z.startsWith('UPDATE '))
  expect(zeilen).toHaveLength(1)
  return zeilen[0]!
}

describe('Migration: bestehende Admins werden Inhaber (N35)', () => {
  it('setzt adminInhaber nur bei isAdmin — wiederholbar', async () => {
    const admin = intKennung('admin')
    const kundin = intKennung('kundin')
    nutzer.push(admin, kundin)
    await prisma.user.create({ data: { id: admin, email: `${admin}@example.com`, name: 'Max Mustermann', isAdmin: true } })
    await prisma.user.create({ data: { id: kundin, email: `${kundin}@example.com`, name: 'Erika Musterfrau' } })
    // Vorher (wie direkt nach dem Expand): der Default.
    expect(await prisma.user.findUnique({ where: { id: admin }, select: { adminInhaber: true, adminRechte: true } })).toEqual({ adminInhaber: false, adminRechte: [] })

    await prisma.$executeRawUnsafe(datenschritt())
    expect((await prisma.user.findUnique({ where: { id: admin }, select: { adminInhaber: true } }))?.adminInhaber).toBe(true)
    expect((await prisma.user.findUnique({ where: { id: kundin }, select: { adminInhaber: true } }))?.adminInhaber).toBe(false)
    // Zweimal ausgeführt: nichts mehr zu tun.
    expect(await prisma.$executeRawUnsafe(datenschritt())).toBe(0)
  })
})

describe('Recht und Protokoll an einer echten Action (kostenpostenAnlegen, Recht geld)', () => {
  async function teamPerson(rechte: string[]): Promise<string> {
    const { ownerId, cookie } = await erstelleHofMitAnmeldung()
    await machePasskeyAdmin(ownerId)
    await prisma.user.update({ where: { id: ownerId }, data: { adminInhaber: false, adminRechte: rechte } })
    nutzer.push(ownerId)
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
    return ownerId
  }

  const eingabe = (name: string) => ({ name, kategorie: 'HOSTING', betrag: 12.5, rhythmus: 'MONATLICH', ab: '2026-10', notiz: null })

  it('ohne das Recht: der Satz, kein Posten, kein Eintrag — mit dem Recht: Posten und Eintrag', async () => {
    const ohne = await teamPerson(['mails_nochmal'])
    const name = intKennung('kosten')
    posten.push(name)
    expect(await kostenpostenAnlegen(eingabe(name))).toEqual({ error: ADMIN_RECHT_FEHLER })
    expect(await prisma.kostenposten.count({ where: { name } })).toBe(0)
    expect(await prisma.adminAktion.count({ where: { wer: ohne } })).toBe(0)

    const mit = await teamPerson(['geld'])
    expect(await kostenpostenAnlegen(eingabe(name))).toEqual({ ok: true })
    const zeile = await prisma.kostenposten.findFirstOrThrow({ where: { name }, select: { id: true } })
    const eintraege = await prisma.adminAktion.findMany({ where: { wer: mit }, select: { art: true, bezugArt: true, bezugId: true, mitPasskey: true, grund: true } })
    expect(eintraege).toEqual([{ art: 'kostenposten_angelegt', bezugArt: 'kostenposten', bezugId: zeile.id, mitPasskey: true, grund: null }])
  })
})

describe('Aufräumen: Protokoll nach 5 Jahren (N33)', () => {
  it('älter als 5 Jahre weg, knapp jünger bleibt', async () => {
    const jetzt = new Date()
    const alt = intKennung('alt')
    const jung = intKennung('jung')
    bezuege.push(alt, jung)
    expect(await protokolliere({ wer: null, art: 'erstattung_erledigt', bezugArt: 'bestellung', bezugId: alt, mitPasskey: false })).toBe(true)
    expect(await protokolliere({ wer: null, art: 'erstattung_erledigt', bezugArt: 'bestellung', bezugId: jung, mitPasskey: false })).toBe(true)
    const grenze = adminProtokollGrenze(jetzt).getTime()
    await prisma.adminAktion.updateMany({ where: { bezugId: alt }, data: { wann: new Date(grenze - DAY) } })
    await prisma.adminAktion.updateMany({ where: { bezugId: jung }, data: { wann: new Date(grenze + DAY) } })

    const ergebnis = await raeumeAltesAuf(jetzt)
    expect(ergebnis.adminAktionen).toBeGreaterThanOrEqual(1)
    expect(await prisma.adminAktion.count({ where: { bezugId: alt } })).toBe(0)
    expect(await prisma.adminAktion.count({ where: { bezugId: jung } })).toBe(1)
  })
})

/**
 * Das Admin-Protokoll (Register N33, Nr. 188) und die Rechte an einer echten
 * Action (N35) — mit der ECHTEN Admin-Wache, gemockter Sitzung und Datenbank
 * (tests/admin-sitzung.ts).
 *
 * Beweist:
 *  - protokolliere schreibt Art, Bezug, Person und „mit Passkey“ — und wirft
 *    nie: Scheitert das Schreiben oder ist der Eintrag ungültig, geht genau
 *    EINE Meldung nach Sentry, ohne Grund und ohne Kennung.
 *  - Ein Grund mit `@` oder einer Ziffernfolge ab 7 Stellen wird verworfen
 *    (null), der Eintrag bleibt.
 *  - Eine Action ohne das Recht antwortet mit dem Satz und schreibt nichts —
 *    Gegenprobe mit dem Recht; scheitert das Protokoll, gilt die Action trotzdem.
 *  - Das Aufräumen löscht Einträge, die älter als 5 Jahre sind.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', async () => ({
  prisma: {
    ...(await import('./admin-sitzung')).passkeyAttrappen(),
    user: { findUnique: vi.fn() },
    session: { deleteMany: vi.fn() },
    kostenposten: { create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    adminAktion: { create: vi.fn(async () => ({ id: 'eintrag-1' })) },
  },
}))

import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ADMIN_RECHT_FEHLER } from '@/lib/admin-rechte'
import { FRISCH_FEHLER } from '@/lib/admin-anmeldung'
import { ADMIN_GRUND_FEHLER, adminGrundSchema, ohnePersonendaten } from '@/schemas/admin-aktion'
import { ADMIN_PROTOKOLL_JAHRE, adminProtokollGrenze, protokolliere } from '@/server/admin-protokoll'
import { kostenpostenLoeschen } from '@/server/actions/finanzen'
import { adminSitzung, alteAdminSitzung } from './admin-sitzung'

const getSession = vi.mocked(auth.api.getSession)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const adminAktionCreate = vi.mocked(prisma.adminAktion.create)
const kostenLoeschen = vi.mocked(prisma.kostenposten.deleteMany)
const sentry = vi.mocked(Sentry.captureException)

const EINTRAG = { wer: 'user_admin', art: 'kostenposten_geloescht', bezugArt: 'kostenposten', bezugId: 'cmfkosten0000000000000001', mitPasskey: true } as const

beforeEach(() => {
  vi.clearAllMocks()
  adminAktionCreate.mockResolvedValue({ id: 'eintrag-1' } as never)
})

describe('protokolliere (N33)', () => {
  it('schreibt den Eintrag mit Art, Bezug, Person und „mit Passkey“ — ohne Grund null', async () => {
    expect(await protokolliere(EINTRAG)).toBe(true)
    expect(adminAktionCreate).toHaveBeenCalledWith({ data: { ...EINTRAG, grund: null }, select: { id: true } })
    expect(sentry).not.toHaveBeenCalled()
  })

  it('System ohne Person (wer: null) und mit Grund', async () => {
    expect(await protokolliere({ ...EINTRAG, wer: null, mitPasskey: false, grund: '  Doppelt eingetragen  ' })).toBe(true)
    expect(adminAktionCreate).toHaveBeenCalledWith({ data: { ...EINTRAG, wer: null, mitPasskey: false, grund: 'Doppelt eingetragen' }, select: { id: true } })
  })

  it('scheitert das Schreiben: kein Wurf, false, genau EINE Meldung — ohne Grund und Kennung', async () => {
    adminAktionCreate.mockRejectedValueOnce(Object.assign(new Error('Verbindung weg'), { name: 'DatenbankWeg' }))
    await expect(protokolliere({ ...EINTRAG, grund: 'Geheimer Grund' })).resolves.toBe(false)
    expect(sentry).toHaveBeenCalledTimes(1)
    const [fehler, kontext] = sentry.mock.calls[0] as [Error, unknown]
    expect(fehler.name).toBe('DatenbankWeg')
    expect(JSON.stringify([fehler.message, kontext])).not.toMatch(/Geheimer|cmfkosten|user_admin/)
  })

  it('ein ungültiger Eintrag (unbekannte Art, Kennung mit Leerzeichen, ohne mitPasskey) wird nicht geschrieben — je EINE Meldung', async () => {
    await expect(protokolliere({ ...EINTRAG, art: 'erfunden' as never })).resolves.toBe(false)
    await expect(protokolliere({ ...EINTRAG, bezugId: 'Max Mustermann' })).resolves.toBe(false)
    await expect(protokolliere({ ...EINTRAG, mitPasskey: undefined as never })).resolves.toBe(false)
    expect(adminAktionCreate).not.toHaveBeenCalled()
    expect(sentry).toHaveBeenCalledTimes(3)
  })

  it('ein Grund mit Adresse oder Telefonnummer wird verworfen, der Eintrag bleibt (eine Meldung)', async () => {
    expect(await protokolliere({ ...EINTRAG, grund: 'Kundin max@example.com rief an' })).toBe(true)
    expect(adminAktionCreate).toHaveBeenLastCalledWith({ data: { ...EINTRAG, grund: null }, select: { id: true } })
    expect(await protokolliere({ ...EINTRAG, grund: 'Rückruf 06640000000' })).toBe(true)
    expect(adminAktionCreate).toHaveBeenLastCalledWith({ data: { ...EINTRAG, grund: null }, select: { id: true } })
    expect(sentry).toHaveBeenCalledTimes(2)
  })

  it('die Wache am Grund: kein @, keine 7 Ziffern am Stück, höchstens 300 Zeichen', () => {
    expect(ohnePersonendaten('Bestellung vom 26.10.2026 doppelt')).toBe(true)
    expect(ohnePersonendaten('max@example.com')).toBe(false)
    expect(ohnePersonendaten('1234567')).toBe(false)
    expect(ohnePersonendaten('123456')).toBe(true)
    expect(adminGrundSchema.safeParse('x'.repeat(300)).success).toBe(true)
    expect(adminGrundSchema.safeParse('x'.repeat(301)).success).toBe(false)
    expect(adminGrundSchema.safeParse('   ').success).toBe(false)
    expect(adminGrundSchema.safeParse('Ruf an: 06640000000').error?.issues[0]?.message).toBe(ADMIN_GRUND_FEHLER)
  })

  it('Aufbewahrung: 5 Kalenderjahre', () => {
    expect(ADMIN_PROTOKOLL_JAHRE).toBe(5)
    expect(adminProtokollGrenze(new Date('2026-10-26T03:00:00.000Z')).toISOString()).toBe('2021-10-26T03:00:00.000Z')
  })
})

describe('Rechte und Protokoll an einer Action (kostenpostenLoeschen, Recht geld, frisch)', () => {
  const EINGABE = { id: 'cmfkosten0000000000000001' }

  it('ohne das Recht: der Satz, nichts gelöscht, nichts protokolliert', async () => {
    getSession.mockResolvedValue(adminSitzung('user_team') as never)
    userFindUnique.mockResolvedValue({ isAdmin: true, adminInhaber: false, adminRechte: ['mails_nochmal'] } as never)
    expect(await kostenpostenLoeschen(EINGABE)).toEqual({ error: ADMIN_RECHT_FEHLER })
    expect(kostenLoeschen).not.toHaveBeenCalled()
    expect(adminAktionCreate).not.toHaveBeenCalled()
  })

  it('mit dem Recht, aber nicht frisch bestätigt: „frisch“, nichts gelöscht', async () => {
    getSession.mockResolvedValue(alteAdminSitzung('user_team') as never)
    userFindUnique.mockResolvedValue({ isAdmin: true, adminInhaber: false, adminRechte: ['geld'] } as never)
    expect(await kostenpostenLoeschen(EINGABE)).toEqual({ error: FRISCH_FEHLER })
    expect(kostenLoeschen).not.toHaveBeenCalled()
  })

  it('Gegenprobe mit dem Recht: gelöscht und protokolliert — mit Person, Kennung und Passkey', async () => {
    getSession.mockResolvedValue(adminSitzung('user_team') as never)
    userFindUnique.mockResolvedValue({ isAdmin: true, adminInhaber: false, adminRechte: ['geld'] } as never)
    kostenLoeschen.mockResolvedValue({ count: 1 } as never)
    expect(await kostenpostenLoeschen(EINGABE)).toEqual({ ok: true })
    expect(kostenLoeschen).toHaveBeenCalledTimes(1)
    expect(adminAktionCreate).toHaveBeenCalledWith({
      data: { wer: 'user_team', art: 'kostenposten_geloescht', bezugArt: 'kostenposten', bezugId: EINGABE.id, grund: null, mitPasskey: true },
      select: { id: true },
    })
  })

  it('scheitert das Protokoll, gilt die Action trotzdem — Sentry genau einmal', async () => {
    getSession.mockResolvedValue(adminSitzung('user_admin') as never)
    userFindUnique.mockResolvedValue({ isAdmin: true, adminInhaber: true, adminRechte: [] } as never)
    kostenLoeschen.mockResolvedValue({ count: 1 } as never)
    adminAktionCreate.mockRejectedValueOnce(new Error('Tabelle weg'))
    expect(await kostenpostenLoeschen(EINGABE)).toEqual({ ok: true })
    expect(kostenLoeschen).toHaveBeenCalledTimes(1)
    expect(sentry).toHaveBeenCalledTimes(1)
  })
})

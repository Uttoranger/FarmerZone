/**
 * Einstellungen › Team (Register N35, Nachtlauf Nr. 190) an den echten
 * Actions — Prisma und Wache gestellt, Protokoll echt, Mail gestellt.
 *
 * Beweist:
 *  - jede Action fragt genau die EINE heikle Wache mit Recht „team“; ein
 *    Nicht-Inhaber (Wache antwortet ADMIN_RECHT_FEHLER) ändert nichts — kein
 *    Schreiben, kein Protokoll, keine Mail;
 *  - Einladen setzt isAdmin, adminSeit = jetzt, adminRechte = [] und schickt
 *    die Sicherheitsmail; eine unbekannte Adresse bekommt dieselbe Antwort
 *    (nichts geschrieben); jede Änderung läuft unter der Team-Sperre;
 *  - Rechte nur aus ADMIN_RECHTE, in fester Reihenfolge;
 *  - den letzten Inhaber kann niemand entfernen und niemand entziehen —
 *    Gegenprobe mit einem zweiten Inhaber.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendTeamRechtGeaendert: vi.fn(async () => ({ id: 'm-1' })) }))
vi.mock('@/server/admin-wache', () => ({ verlangeFrischeBestaetigung: vi.fn(), verlangeAdminAktion: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    user: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(async () => ({})), count: vi.fn() },
  }
  return { prisma: { ...tx, $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)), adminAktion: { create: vi.fn(async () => ({ id: 'p' })) } } }
})

import { prisma } from '@/lib/prisma'
import { verlangeFrischeBestaetigung, verlangeAdminAktion } from '@/server/admin-wache'
import { sendTeamRechtGeaendert } from '@/lib/email'
import { entfernePerson, ladePersonEin, setzeInhaber, setzeTeamRechte } from '@/server/actions/team'
import { ADMIN_RECHT_FEHLER } from '@/lib/admin-rechte'
import { TEAM_SPERRE, TEAM_TEXT } from '@/lib/admin-team'

const wache = vi.mocked(verlangeFrischeBestaetigung)
const update = vi.mocked(prisma.user.update)
const protokoll = vi.mocked(prisma.adminAktion.create)
const mail = vi.mocked(sendTeamRechtGeaendert)

const person = (abweichung: Record<string, unknown> = {}) => ({ id: 'p1', email: 'vertretung@example.com', name: 'Vertretung', isAdmin: true, adminInhaber: false, adminRechte: [], ...abweichung })

beforeEach(() => {
  vi.clearAllMocks()
  wache.mockResolvedValue({ ok: true, userId: 'inhaber-1', sitzungId: 's1', mitPasskey: true })
})

function nichtsGeaendert() {
  expect(update).not.toHaveBeenCalled()
  expect(protokoll).not.toHaveBeenCalled()
  expect(mail).not.toHaveBeenCalled()
}

const ALLE: Array<[string, () => Promise<unknown>]> = [
  ['ladePersonEin', () => ladePersonEin({ adresse: 'vertretung@example.com' })],
  ['setzeTeamRechte', () => setzeTeamRechte({ userId: 'p1', rechte: ['geld'] })],
  ['setzeInhaber', () => setzeInhaber({ userId: 'p1', inhaber: true })],
  ['entfernePerson', () => entfernePerson({ userId: 'p1' })],
]

describe('nur Inhaber, frisch mit Passkey', () => {
  it.each(ALLE)('%s fragt genau die heikle Wache mit Recht „team“', async (_n, aufruf) => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never)
    await aufruf()
    expect(wache).toHaveBeenCalledTimes(1)
    expect(wache).toHaveBeenCalledWith({ recht: 'team' })
    expect(verlangeAdminAktion).not.toHaveBeenCalled()
  })

  it.each(ALLE)('%s: Nicht-Inhaber → Satz der Wache, nichts geändert', async (_n, aufruf) => {
    wache.mockResolvedValue({ error: ADMIN_RECHT_FEHLER })
    expect(await aufruf()).toEqual({ error: ADMIN_RECHT_FEHLER })
    nichtsGeaendert()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

describe('ladePersonEin', () => {
  it('setzt isAdmin, adminSeit = jetzt und keine Rechte — unter der Sperre; Mail und Protokoll', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([person({ isAdmin: false })] as never)
    const vorher = Date.now()
    expect(await ladePersonEin({ adresse: 'Vertretung@Example.com' })).toEqual({ ok: true })
    expect(prisma.$executeRaw).toHaveBeenCalledWith(expect.anything(), TEAM_SPERRE)
    const daten = update.mock.calls[0][0].data as { isAdmin: boolean; adminInhaber: boolean; adminRechte: string[]; adminSeit: Date }
    expect(daten).toMatchObject({ isAdmin: true, adminInhaber: false, adminRechte: [] })
    expect(daten.adminSeit.getTime()).toBeGreaterThanOrEqual(vorher)
    expect(mail).toHaveBeenCalledWith('vertretung@example.com', expect.objectContaining({ anlass: 'eingeladen' }))
    expect(protokoll.mock.calls[0][0].data).toMatchObject({ art: 'team_eingeladen', bezugArt: 'person', bezugId: 'p1', wer: 'inhaber-1', mitPasskey: true })
  })

  it('unbekannte Adresse oder schon im Team: dieselbe Antwort, nichts geschrieben', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never)
    const unbekannt = await ladePersonEin({ adresse: 'niemand@example.com' })
    vi.mocked(prisma.user.findMany).mockResolvedValue([person()] as never)
    const schonDa = await ladePersonEin({ adresse: 'vertretung@example.com' })
    expect(unbekannt).toEqual({ ok: true })
    expect(schonDa).toEqual(unbekannt)
    nichtsGeaendert()
  })
})

describe('setzeTeamRechte', () => {
  it('nur bekannte Rechte, in fester Reihenfolge; „team“ lässt sich nie vergeben', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(person() as never)
    expect(await setzeTeamRechte({ userId: 'p1', rechte: ['geld', 'mails_nochmal'] })).toEqual({ ok: true })
    expect(update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { adminRechte: ['mails_nochmal', 'geld'] } })
    expect(mail).toHaveBeenCalledWith('vertretung@example.com', expect.objectContaining({ anlass: 'rechte' }))
    vi.clearAllMocks()
    wache.mockResolvedValue({ ok: true, userId: 'inhaber-1', sitzungId: 's1', mitPasskey: true })
    expect(await setzeTeamRechte({ userId: 'p1', rechte: ['team'] })).toEqual({ error: TEAM_TEXT.nichtImTeam })
    nichtsGeaendert()
  })
})

describe('letzter Inhaber', () => {
  it('entfernen und entziehen beim letzten Inhaber: abgelehnt, nichts geändert', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(person({ id: 'inhaber-1', adminInhaber: true }) as never)
    vi.mocked(prisma.user.count).mockResolvedValue(0 as never)
    expect(await entfernePerson({ userId: 'inhaber-1' })).toEqual({ error: TEAM_TEXT.letzterInhaber })
    expect(await setzeInhaber({ userId: 'inhaber-1', inhaber: false })).toEqual({ error: TEAM_TEXT.letzterInhaber })
    nichtsGeaendert()
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { isAdmin: true, adminInhaber: true, id: { not: 'inhaber-1' } } })
  })

  it('Gegenprobe: mit einem zweiten Inhaber geht beides', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(person({ adminInhaber: true }) as never)
    vi.mocked(prisma.user.count).mockResolvedValue(1 as never)
    expect(await setzeInhaber({ userId: 'p1', inhaber: false })).toEqual({ ok: true })
    expect(update).toHaveBeenLastCalledWith({ where: { id: 'p1' }, data: { adminInhaber: false } })
    expect(await entfernePerson({ userId: 'p1' })).toEqual({ ok: true })
    expect(update).toHaveBeenLastCalledWith({ where: { id: 'p1' }, data: { isAdmin: false, adminInhaber: false, adminRechte: [], adminSeit: null } })
    expect(protokoll.mock.calls.map((c) => c[0].data.art)).toEqual(['team_inhaber_entzogen', 'team_entfernt'])
  })

  it('eine Person außerhalb des Teams: abgelehnt', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(person({ isAdmin: false }) as never)
    expect(await entfernePerson({ userId: 'p1' })).toEqual({ error: TEAM_TEXT.nichtImTeam })
    nichtsGeaendert()
  })
})

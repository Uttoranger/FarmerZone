/**
 * Tests der Admin-Wache (src/server/admin-wache.ts).
 *
 * Die Wache ist die einzige Antwort auf „darf dieser Mensch die Plattform
 * verwalten?". Vorher lag die Frage fünffach und in zwei Fassungen — drei
 * Admin-Seiten und ein privates `requireAdmin` in den Aktionen, das die Abfrage
 * selbst wiederholte statt `isAdminUser` zu rufen.
 *
 * Die Aussagen, die zählen:
 *  - Das Recht kommt aus der DATENBANK, nicht aus der Session. Eine Session,
 *    die `isAdmin: true` behauptet, kommt nicht durch.
 *  - Die Seite verrät sich nicht: angemeldet ohne Recht → 404, nicht → 403.
 *  - Die Aktion navigiert nicht, sie antwortet — { error } wie jede Action.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
// redirect und notFound werfen in Next; hier werfen sie erkennbare Fehler,
// damit der Test zwischen „zum Login" und „existiert nicht" unterscheiden kann.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT:${ziel}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn() } } }))

import { verlangeAdminAktion, verlangeAdminSeite } from '@/server/admin-wache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const getSession = vi.mocked(auth.api.getSession)
const userFindUnique = vi.mocked(prisma.user.findUnique)

/** Angemeldet als `id`; was in der DATENBANK steht, sagt `istAdmin`. */
function melde(id: string | null, istAdmin: boolean | null) {
  getSession.mockResolvedValue((id === null ? null : { user: { id } }) as never)
  userFindUnique.mockResolvedValue((istAdmin === null ? null : { isAdmin: istAdmin }) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('verlangeAdminSeite', () => {
  it('schickt eine nicht angemeldete Anfrage zum Login', async () => {
    melde(null, null)
    await expect(verlangeAdminSeite()).rejects.toThrow('REDIRECT:/login')
  })

  it('antwortet einem angemeldeten Nicht-Admin mit 404, nicht mit 403', async () => {
    // Der Bereich soll sich Unbefugten nicht einmal zu erkennen geben.
    melde('user_1', false)
    await expect(verlangeAdminSeite()).rejects.toThrow('NOT_FOUND')
  })

  it('lässt einen Admin durch und gibt seine Nutzer-ID zurück', async () => {
    melde('user_admin', true)
    await expect(verlangeAdminSeite()).resolves.toBe('user_admin')
  })

  it('glaubt der Session nicht, sondern der Datenbank', async () => {
    // Eine Session, die isAdmin behauptet, aber in der DB steht false.
    getSession.mockResolvedValue({ user: { id: 'user_1', isAdmin: true } } as never)
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    await expect(verlangeAdminSeite()).rejects.toThrow('NOT_FOUND')
  })

  it('lehnt ab, wenn es den Nutzer der Session gar nicht mehr gibt', async () => {
    melde('user_gelöscht', null)
    await expect(verlangeAdminSeite()).rejects.toThrow('NOT_FOUND')
  })
})

describe('verlangeAdminAktion', () => {
  it('gibt einen Satz zurück statt zu navigieren, wenn niemand angemeldet ist', async () => {
    melde(null, null)
    expect(await verlangeAdminAktion()).toEqual({ error: 'Nicht angemeldet.' })
  })

  it('lehnt einen angemeldeten Nicht-Admin ab', async () => {
    melde('user_1', false)
    expect(await verlangeAdminAktion()).toEqual({ error: 'Kein Zugriff.' })
  })

  it('gibt dem Admin die Nutzer-ID mit', async () => {
    melde('user_admin', true)
    expect(await verlangeAdminAktion()).toEqual({ ok: true, userId: 'user_admin' })
  })

  it('fragt das Recht frisch aus der Datenbank ab — genau einmal je Aufruf', async () => {
    melde('user_admin', true)
    await verlangeAdminAktion()
    expect(userFindUnique).toHaveBeenCalledTimes(1)
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: 'user_admin' },
      select: { isAdmin: true },
    })
  })
})

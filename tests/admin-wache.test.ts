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
 *  - Admin nur mit Passkey (Register N20; Nr. 115): Sitzung älter als 12
 *    Stunden → abgemeldet und /login/admin; ohne Passkey (oder nach einem
 *    Ersatzcode ohne neuen) → /admin/einrichten, außer mit `ohnePasskey`;
 *    frische Bestätigung gilt 5 Minuten (6 → „frisch"); die Exporte leiten
 *    ohne sie mit 303 auf /admin/bestaetigen, nur mit Pfaden unter /admin.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    session: { deleteMany: vi.fn(async () => ({ count: 1 })) },
    passkey: { aggregate: vi.fn() },
    adminErsatzcode: { aggregate: vi.fn() },
  },
}))

import { frischOderBestaetigen, verlangeAdminAktion, verlangeAdminSeite, verlangeFrischeBestaetigung } from '@/server/admin-wache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const getSession = vi.mocked(auth.api.getSession)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const sessionDeleteMany = vi.mocked(prisma.session.deleteMany)
const passkeyAggregate = vi.mocked(prisma.passkey.aggregate)
const ersatzcodeAggregate = vi.mocked(prisma.adminErsatzcode.aggregate)

const JETZT = new Date('2026-10-20T10:00:00Z')
const MINUTE = 60_000

/**
 * Angemeldet als `id`; was in der DATENBANK steht, sagt `istAdmin`. Die
 * Sitzung ist frisch angemeldet und frisch mit Passkey bestätigt, das Konto
 * hat einen Passkey — außer der Fall sagt es anders.
 */
function melde(
  id: string | null,
  istAdmin: boolean | null,
  stand: { angemeldetVor?: number; passkeyVor?: number | null; passkeys?: number; ersatzcodeVor?: number | null } = {}
) {
  const { angemeldetVor = 0, passkeyVor = 0, passkeys = 1, ersatzcodeVor = null } = stand
  getSession.mockResolvedValue(
    (id === null
      ? null
      : {
          user: { id },
          session: {
            id: `sitzung-${id}`,
            createdAt: new Date(JETZT.getTime() - angemeldetVor),
            passkeyAm: passkeyVor === null ? null : new Date(JETZT.getTime() - passkeyVor),
          },
        }) as never
  )
  userFindUnique.mockResolvedValue((istAdmin === null ? null : { isAdmin: istAdmin }) as never)
  passkeyAggregate.mockResolvedValue({ _count: { _all: passkeys }, _max: { createdAt: passkeys > 0 ? new Date(JETZT.getTime() - 60 * MINUTE) : null } } as never)
  ersatzcodeAggregate.mockResolvedValue({ _max: { benutztAm: ersatzcodeVor === null ? null : new Date(JETZT.getTime() - ersatzcodeVor) } } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(JETZT)
})

afterEach(() => {
  vi.useRealTimers()
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

describe('Admin nur mit Passkey (Register N20) — 12 Stunden', () => {
  it('Sitzung genau 12 Stunden alt: abgemeldet (nur die eigene) und zur Admin-Anmeldung', async () => {
    melde('user_admin', true, { angemeldetVor: 12 * 60 * MINUTE })
    await expect(verlangeAdminSeite()).rejects.toThrow('REDIRECT:/login/admin')
    expect(sessionDeleteMany).toHaveBeenCalledWith({ where: { id: 'sitzung-user_admin', userId: 'user_admin' } })
  })

  it('eine Minute davor gilt sie noch; die Aktion antwortet danach mit dem Satz statt zu navigieren', async () => {
    melde('user_admin', true, { angemeldetVor: 12 * 60 * MINUTE - MINUTE })
    await expect(verlangeAdminSeite()).resolves.toBe('user_admin')
    expect(sessionDeleteMany).not.toHaveBeenCalled()
    melde('user_admin', true, { angemeldetVor: 13 * 60 * MINUTE })
    expect(await verlangeAdminAktion()).toEqual({ error: 'Deine Admin-Sitzung ist abgelaufen. Melde dich neu mit deinem Passkey an.' })
  })
})

describe('Admin nur mit Passkey (Register N20) — Pflicht in der Wache', () => {
  it('ohne Passkey leitet die Seite auf /admin/einrichten um — mit ohnePasskey (Layout, Pflichtseite) nicht', async () => {
    melde('user_admin', true, { passkeys: 0 })
    await expect(verlangeAdminSeite()).rejects.toThrow('REDIRECT:/admin/einrichten')
    await expect(verlangeAdminSeite({ ohnePasskey: true })).resolves.toBe('user_admin')
  })

  it('nach einem Ersatzcode, der jünger ist als der jüngste Passkey: Pflicht; ein älterer nicht', async () => {
    melde('user_admin', true, { ersatzcodeVor: 5 * MINUTE })
    await expect(verlangeAdminSeite()).rejects.toThrow('REDIRECT:/admin/einrichten')
    melde('user_admin', true, { ersatzcodeVor: 2 * 60 * MINUTE })
    await expect(verlangeAdminSeite()).resolves.toBe('user_admin')
  })

  it('Aktionen antworten im Pflicht-Zustand mit dem Satz — die Actions der Pflichtseite (ohnePasskey) gehen', async () => {
    melde('user_admin', true, { passkeys: 0 })
    expect(await verlangeAdminAktion()).toEqual({ error: 'Richte zuerst deinen Passkey ein.' })
    expect(await verlangeAdminAktion({ ohnePasskey: true })).toEqual({ ok: true, userId: 'user_admin' })
  })

  it('ohne Recht kommt die Pflicht gar nicht erst zur Sprache (404, nichts gelesen)', async () => {
    melde('user_1', false, { passkeys: 0 })
    await expect(verlangeAdminSeite()).rejects.toThrow('NOT_FOUND')
    expect(passkeyAggregate).not.toHaveBeenCalled()
  })
})

describe('Admin nur mit Passkey (Register N20) — Sitzung ohne Passkey', () => {
  // Das Konto hat einen Passkey, DIESE Sitzung nie einen benutzt (Passwort-Sitzung
  // von vor der Einrichtung auf einem anderen Gerät, oder von vor dem Deploy).
  it('die Seite leitet zur Admin-Anmeldung um, ohne die Sitzung zu löschen (der Hof bleibt erreichbar)', async () => {
    melde('user_admin', true, { passkeyVor: null })
    await expect(verlangeAdminSeite()).rejects.toThrow('REDIRECT:/login/admin')
    expect(sessionDeleteMany).not.toHaveBeenCalled()
  })

  it('Aktionen antworten mit dem Satz, auch heikle; die Pflichtseite (ohnePasskey) geht', async () => {
    melde('user_admin', true, { passkeyVor: null })
    const satz = { error: 'Melde dich für den Admin-Bereich mit deinem Passkey an.' }
    expect(await verlangeAdminAktion()).toEqual(satz)
    expect(await verlangeFrischeBestaetigung()).toEqual(satz)
    expect(await verlangeAdminAktion({ ohnePasskey: true })).toEqual({ ok: true, userId: 'user_admin' })
    await expect(verlangeAdminSeite({ ohnePasskey: true })).resolves.toBe('user_admin')
  })

  it('ohne Passkey am Konto gilt zuerst die Pflicht (Einrichten), nicht die Anmeldung', async () => {
    melde('user_admin', true, { passkeys: 0, passkeyVor: null })
    await expect(verlangeAdminSeite()).rejects.toThrow('REDIRECT:/admin/einrichten')
  })
})

describe('Admin nur mit Passkey (Register N20) — frische Bestätigung', () => {
  it('5 Minuten nach der Bestätigung mit Passkey: frisch; 6 Minuten oder nie: „frisch" verlangt', async () => {
    melde('user_admin', true, { passkeyVor: 5 * MINUTE })
    expect(await verlangeFrischeBestaetigung()).toEqual({ ok: true, userId: 'user_admin', sitzungId: 'sitzung-user_admin' })
    melde('user_admin', true, { passkeyVor: 6 * MINUTE })
    expect(await verlangeFrischeBestaetigung()).toEqual({ error: 'frisch' })
    melde('user_admin', true, { passkeyVor: null })
    expect(await verlangeFrischeBestaetigung({ ohnePasskey: true })).toEqual({ error: 'frisch' })
  })

  it('prüft vorher alles der Aktions-Wache: ohne Recht „Kein Zugriff.", nie „frisch"', async () => {
    melde('user_1', false, { passkeyVor: null })
    expect(await verlangeFrischeBestaetigung()).toEqual({ error: 'Kein Zugriff.' })
  })

  it('Exporte: frisch → weiter (null); sonst 303 auf /admin/bestaetigen mit dem Pfad; eine fremde Adresse wird /admin', async () => {
    melde('user_admin', true, { passkeyVor: MINUTE })
    expect(await frischOderBestaetigen('/admin/finanzen/export?jahr=2026')).toBeNull()

    melde('user_admin', true, { passkeyVor: 10 * MINUTE })
    const antwort = await frischOderBestaetigen('/admin/finanzen/export?jahr=2026')
    expect(antwort?.status).toBe(303)
    expect(antwort?.headers.get('location')).toBe('/admin/bestaetigen?weiter=%2Fadmin%2Ffinanzen%2Fexport%3Fjahr%3D2026')
    expect((await frischOderBestaetigen('https://fremd.example.com/admin'))?.headers.get('location')).toBe('/admin/bestaetigen?weiter=%2Fadmin')
  })
})

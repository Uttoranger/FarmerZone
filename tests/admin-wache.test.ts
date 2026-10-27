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
 *    Ersatzcode ohne neuen) → /admin/einrichten, außer mit `ohnePasskey`
 *    (Aktionen) bzw. auf der Pflichtseite (verlangeEinrichtenSeite) — die
 *    leitet eine Sitzung ohne Passkey bei erledigter Pflicht zur Anmeldung;
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

import { ADMIN_RECHT_FEHLER } from '@/lib/admin-rechte'
import { frischOderBestaetigen, verlangeAdminAktion, verlangeAdminSeite, verlangeEinrichtenSeite, verlangeFrischeBestaetigung } from '@/server/admin-wache'
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
  stand: { angemeldetVor?: number; passkeyVor?: number | null; passkeys?: number; ersatzcodeVor?: number | null; inhaber?: boolean; rechte?: string[] } = {}
) {
  const { angemeldetVor = 0, passkeyVor = 0, passkeys = 1, ersatzcodeVor = null, inhaber = true, rechte = [] } = stand
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
  userFindUnique.mockResolvedValue((istAdmin === null ? null : { isAdmin: istAdmin, adminInhaber: inhaber, adminRechte: rechte }) as never)
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
    expect(await verlangeAdminAktion()).toEqual({ ok: true, userId: 'user_admin', sitzungId: 'sitzung-user_admin', mitPasskey: true })
  })

  it('fragt das Recht frisch aus der Datenbank ab — genau einmal je Aufruf', async () => {
    melde('user_admin', true)
    await verlangeAdminAktion()
    // Das Recht genau einmal; dazu liest die Pflicht `adminSeit` (Nr. 179: nur Passkeys ab dem Recht zählen).
    expect(userFindUnique.mock.calls.filter(([frage]) => frage?.select && 'isAdmin' in frage.select)).toHaveLength(1)
    // Admin-Recht und Rechte je Person (N35, Nr. 188) in EINER Abfrage.
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: 'user_admin' },
      select: { isAdmin: true, adminInhaber: true, adminRechte: true },
    })
    expect(userFindUnique).toHaveBeenCalledWith({ where: { id: 'user_admin' }, select: { adminSeit: true } })
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
  it('ohne Passkey leitet die Seite auf /admin/einrichten um — die Pflichtseite selbst nicht', async () => {
    melde('user_admin', true, { passkeys: 0 })
    await expect(verlangeAdminSeite()).rejects.toThrow('REDIRECT:/admin/einrichten')
    await expect(verlangeEinrichtenSeite()).resolves.toEqual({ userId: 'user_admin', pflicht: true })
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
    expect(await verlangeAdminAktion({ ohnePasskey: true })).toEqual({ ok: true, userId: 'user_admin', sitzungId: 'sitzung-user_admin', mitPasskey: true })
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

  it('Aktionen antworten mit dem Satz, auch heikle; die Actions der Pflichtseite (ohnePasskey) gehen', async () => {
    melde('user_admin', true, { passkeyVor: null })
    const satz = { error: 'Melde dich für den Admin-Bereich mit deinem Passkey an.' }
    expect(await verlangeAdminAktion()).toEqual(satz)
    expect(await verlangeFrischeBestaetigung()).toEqual(satz)
    expect(await verlangeAdminAktion({ ohnePasskey: true })).toEqual({ ok: true, userId: 'user_admin', sitzungId: 'sitzung-user_admin', mitPasskey: false })
  })

  it('ohne Passkey am Konto gilt zuerst die Pflicht (Einrichten), nicht die Anmeldung', async () => {
    melde('user_admin', true, { passkeys: 0, passkeyVor: null })
    await expect(verlangeAdminSeite()).rejects.toThrow('REDIRECT:/admin/einrichten')
  })
})

describe('Admin nur mit Passkey (Register N20) — die Pflichtseite (verlangeEinrichtenSeite)', () => {
  // Sichter Runde 2 (S1): Eine Passwort-Sitzung, deren Konto inzwischen einen Passkey
  // hat, sah /admin/einrichten im Zustand „eingerichtet" samt Admin-Kopf.
  it('Konto mit Passkey, Pflicht erledigt, Sitzung ohne passkeyAm: zur Admin-Anmeldung, ohne die Sitzung zu löschen', async () => {
    melde('user_admin', true, { passkeyVor: null })
    await expect(verlangeEinrichtenSeite()).rejects.toThrow('REDIRECT:/login/admin')
    expect(sessionDeleteMany).not.toHaveBeenCalled()
  })

  it('Gegenprobe Pflicht offen: ohne Passkey und nach einem Ersatzcode öffnet sie — auch ohne passkeyAm', async () => {
    melde('user_admin', true, { passkeys: 0, passkeyVor: null })
    await expect(verlangeEinrichtenSeite()).resolves.toEqual({ userId: 'user_admin', pflicht: true })
    melde('user_admin', true, { ersatzcodeVor: 5 * MINUTE, passkeyVor: null })
    await expect(verlangeEinrichtenSeite()).resolves.toEqual({ userId: 'user_admin', pflicht: true })
  })

  it('Gegenprobe Sitzung mit passkeyAm: öffnet (Ersatzcodes, zweiter Passkey) — auch Stunden nach der Anmeldung', async () => {
    melde('user_admin', true, { angemeldetVor: 3 * 60 * MINUTE, passkeyVor: 3 * 60 * MINUTE })
    await expect(verlangeEinrichtenSeite()).resolves.toEqual({ userId: 'user_admin', pflicht: false })
  })

  it('scheitert sonst wie jede Admin-Seite: abgemeldet → /login, ohne Recht → 404, nach 12 Stunden → /login/admin', async () => {
    melde(null, null)
    await expect(verlangeEinrichtenSeite()).rejects.toThrow(/^REDIRECT:\/login$/)
    melde('user_1', false)
    await expect(verlangeEinrichtenSeite()).rejects.toThrow('NOT_FOUND')
    melde('user_admin', true, { angemeldetVor: 12 * 60 * MINUTE })
    await expect(verlangeEinrichtenSeite()).rejects.toThrow('REDIRECT:/login/admin')
  })
})

describe('Admin nur mit Passkey (Register N20) — frische Bestätigung', () => {
  it('5 Minuten nach der Bestätigung mit Passkey: frisch; 6 Minuten oder nie: „frisch" verlangt', async () => {
    melde('user_admin', true, { passkeyVor: 5 * MINUTE })
    expect(await verlangeFrischeBestaetigung()).toEqual({ ok: true, userId: 'user_admin', sitzungId: 'sitzung-user_admin', mitPasskey: true })
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

describe('Rechte je Person (Register N35, Nr. 188)', () => {
  it('ohne Recht: die Aktion antwortet mit dem Satz, die Seite leitet nach /admin', async () => {
    melde('user_team', true, { inhaber: false, rechte: ['geld'] })
    expect(await verlangeAdminAktion({ recht: 'notbremse' })).toEqual({ error: ADMIN_RECHT_FEHLER })
    expect(await verlangeFrischeBestaetigung({ recht: 'startseite_veroeffentlichen' })).toEqual({ error: ADMIN_RECHT_FEHLER })
    expect(await frischOderBestaetigen('/admin/finanzen/export', { recht: 'notbremse' })).toMatchObject({ status: 403 })
    await expect(verlangeAdminSeite({ recht: 'notbremse' })).rejects.toThrow(/^REDIRECT:\/admin$/)
  })

  it('Gegenprobe: mit dem Recht, mit „ansehen“ und ohne recht geht es; die Inhaberin darf alles', async () => {
    melde('user_team', true, { inhaber: false, rechte: ['geld'] })
    expect(await verlangeAdminAktion({ recht: 'geld' })).toMatchObject({ ok: true, userId: 'user_team' })
    expect(await verlangeAdminAktion({ recht: 'ansehen' })).toMatchObject({ ok: true })
    expect(await verlangeAdminAktion()).toMatchObject({ ok: true })
    await expect(verlangeAdminSeite({ recht: 'geld' })).resolves.toBe('user_team')
    // Inhaber-Rechte gibt es nie über die Liste — auch wenn sie dort stünden.
    melde('user_team', true, { inhaber: false, rechte: ['team', 'notfallzugang'] })
    expect(await verlangeAdminAktion({ recht: 'notfallzugang' })).toEqual({ error: ADMIN_RECHT_FEHLER })
    melde('user_admin', true, { inhaber: true })
    expect(await verlangeAdminAktion({ recht: 'notfallzugang' })).toMatchObject({ ok: true })
  })

  it('das Recht zählt erst nach Passkey und Sitzung: ohne Passkey bleibt es beim Satz der Anmeldung', async () => {
    melde('user_team', true, { inhaber: false, rechte: [], passkeyVor: null })
    expect(await verlangeAdminAktion({ recht: 'geld' })).toEqual({ error: 'Melde dich für den Admin-Bereich mit deinem Passkey an.' })
  })

  it('`frisch: true` an verlangeAdminAktion ist dieselbe Prüfung wie verlangeFrischeBestaetigung', async () => {
    melde('user_admin', true, { passkeyVor: 6 * MINUTE })
    expect(await verlangeAdminAktion({ frisch: true, recht: 'geld' })).toEqual({ error: 'frisch' })
    expect(await verlangeAdminAktion({ recht: 'geld' })).toEqual({ ok: true, userId: 'user_admin', sitzungId: 'sitzung-user_admin', mitPasskey: false })
    melde('user_admin', true, { passkeyVor: MINUTE })
    expect(await verlangeAdminAktion({ frisch: true, recht: 'geld' })).toEqual({ ok: true, userId: 'user_admin', sitzungId: 'sitzung-user_admin', mitPasskey: true })
  })
})

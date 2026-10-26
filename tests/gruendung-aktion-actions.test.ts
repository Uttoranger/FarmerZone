/**
 * Aktion „100 Gründungshöfe“ (Register K2, Änderung Nr. 116) — die Actions mit
 * gemockter Datenbank, Sitzung und Berechtigung echt (verlangeAdminAktion):
 *  - „Zusagen festschreiben“: nur Admin, Sperre zuerst, einmal (zweimal →
 *    abgewiesen), jeder Hof der Liste bekommt Platz und Ende, nie kürzer;
 *  - Freischalten nach dem Festschreiben: kleinste freie Nummer und Ende ab
 *    heute; erneute Freigabe behält Platz und Ende; nach dem Stichtag kein Platz;
 *  - Wiederaufnahme nach dem Festschreiben: nur mit laufender Aktion;
 *  - „Abzeichen zeigen“: nur der eigene Hof mit Platz, danach die Höfe-Liste neu.
 * Die Zustände unter Nebenläufigkeit prüft tests/integration/gruendung-aktion.int.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/email', () => ({ sendFreischaltungEmail: vi.fn(async () => ({})) }))
vi.mock('@/lib/prisma', async () => {
  const prisma: Record<string, unknown> = {
    farm: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    // Die Wache liest seit Nr. 115 die Pflicht „erst Passkey“ (tests/admin-sitzung.ts).
    ...(await import('./admin-sitzung')).passkeyAttrappen(),
    user: { findUnique: vi.fn() },
    plattformEinstellung: { findUnique: vi.fn(), updateMany: vi.fn() },
    nachricht: { findFirst: vi.fn(async () => null) },
    unterhaltung: { create: vi.fn(async () => ({ id: 'u_1' })) },
    $executeRaw: vi.fn(async () => 1),
  }
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma))
  return { prisma }
})

import { revalidatePath, updateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GRUENDUNGSPLAETZE_SPERRE, ABZEICHEN_TEXT } from '@/lib/gruendungshof'
import { EINSTELLUNGEN_TEXT } from '@/lib/plattform-einstellung'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { GRUENDUNG_AKTION_VORBEI } from '@/schemas/gruendung'
import { nimmWiederAuf, schreibeZusagenFest } from '@/server/actions/gruendung'
import { approveFarmAction } from '@/server/actions/admin'
import { setzeAbzeichenSichtbar } from '@/server/actions/abzeichen'
import { adminSitzung } from './admin-sitzung'

type Fn = ReturnType<typeof vi.fn>
const getSession = vi.mocked(auth.api.getSession)
const db = prisma as unknown as {
  farm: { findUnique: Fn; findMany: Fn; updateMany: Fn; update: Fn }
  user: { findUnique: Fn }
  plattformEinstellung: { findUnique: Fn; updateMany: Fn }
  unterhaltung: { create: Fn }
  $executeRaw: Fn
  $transaction: Fn
}
const TEXT = EINSTELLUNGEN_TEXT.gruendung

/** Ein Hof wie die Lader ihn liefern, freigeschaltet am n. Jänner 2026. */
function hof(n: number, mehr: Record<string, unknown> = {}) {
  return {
    id: `hof_${n}`,
    ownerId: `u_${n}`,
    name: `Testhof ${n}`,
    approvedAt: new Date(Date.UTC(2026, 0, n)),
    createdAt: new Date(Date.UTC(2025, 0, 1)),
    archivedAt: null,
    gruendungBis: null,
    gruendungAusgenommen: false,
    gruendungPlatz: null,
    ...mehr,
  }
}

/** Die Zeile der Einstellung; `festAm` gesetzt = festgeschrieben. */
function einstellung(mehr: Record<string, unknown> = {}) {
  db.plattformEinstellung.findUnique.mockResolvedValue({
    gruendungPlaetze: 100,
    gruendungBisStandard: new Date('2027-12-31T00:00:00.000Z'),
    gruendungAnzeige: true,
    gruendungMonate: 24,
    gruendungAktionBis: new Date('2027-03-31T00:00:00.000Z'),
    gruendungFestAm: null,
    geaendertVonUserId: null,
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...mehr,
  })
}
const FEST = { gruendungFestAm: new Date('2026-10-19T06:00:00.000Z') }

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: new Date('2026-10-19T10:00:00+02:00'), toFake: ['Date'] })
  getSession.mockResolvedValue(adminSitzung('admin_1') as never)
  db.user.findUnique.mockResolvedValue({ isAdmin: true, adminInhaber: true })
  db.farm.updateMany.mockResolvedValue({ count: 1 })
  db.plattformEinstellung.updateMany.mockResolvedValue({ count: 1 })
  einstellung()
})

describe('schreibeZusagenFest — einmal, unter der Sperre, nie kürzer', () => {
  it('ohne Admin-Recht: nichts gelesen, nichts geschrieben', async () => {
    db.user.findUnique.mockResolvedValue({ isAdmin: false })
    expect(await schreibeZusagenFest({ bestaetigt: true })).toEqual({ error: 'Kein Zugriff.' })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('ohne Bestätigung im Dialog: abgewiesen', async () => {
    expect(await schreibeZusagenFest({ bestaetigt: false })).toHaveProperty('error')
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('Sperre zuerst, dann bedingt festschreiben, dann je Hof Platz und Ende — stillgelegt mit Platz, ausgenommen ohne', async () => {
    db.farm.findMany.mockResolvedValue([
      hof(1),
      hof(2, { archivedAt: new Date('2026-06-01T00:00:00Z') }),
      hof(3, { gruendungAusgenommen: true }),
      hof(4, { gruendungBis: new Date('2030-06-30T00:00:00.000Z') }),
    ])
    expect(await schreibeZusagenFest({ bestaetigt: true })).toEqual({ ok: true })

    const [aufruf] = db.$executeRaw.mock.calls
    expect(aufruf?.[1]).toBe(GRUENDUNGSPLAETZE_SPERRE)
    expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(db.plattformEinstellung.findUnique.mock.invocationCallOrder[0] ?? 0)
    expect(db.plattformEinstellung.updateMany).toHaveBeenCalledWith({
      where: { id: 'plattform', gruendungFestAm: null },
      data: { gruendungFestAm: expect.any(Date), geaendertVonUserId: 'admin_1' },
    })
    expect(db.farm.update.mock.calls.map(([a]) => [a.where.id, a.data.gruendungPlatz, a.data.gruendungBis.toISOString().slice(0, 10)])).toEqual([
      ['hof_1', 1, '2029-01-31'],
      ['hof_2', 2, '2029-01-31'],
      ['hof_4', 3, '2030-06-30'],
    ])
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith(HOEFE_CACHE_TAG)
  })

  it('zweimal: schon festgeschrieben — abgewiesen, kein Hof angefasst', async () => {
    einstellung(FEST)
    db.farm.findMany.mockResolvedValue([hof(1)])
    expect(await schreibeZusagenFest({ bestaetigt: true })).toEqual({ error: TEXT.festschreibenSchon })
    expect(db.farm.update).not.toHaveBeenCalled()
    // Auch wenn ein zweiter Tab zwischen Lesen und Schreiben festschreibt: das bedingte Schreiben trifft nichts.
    einstellung()
    db.plattformEinstellung.updateMany.mockResolvedValue({ count: 0 })
    expect(await schreibeZusagenFest({ bestaetigt: true })).toEqual({ error: TEXT.festschreibenSchon })
    expect(db.farm.update).not.toHaveBeenCalled()
  })

  it('verlöre ein Hof mit Platz seinen Platz (stillgelegte davor, zu wenig Plätze): abgewiesen mit der nötigen Zahl', async () => {
    einstellung({ gruendungPlaetze: 2 })
    db.farm.findMany.mockResolvedValue([hof(1, { archivedAt: new Date('2026-06-01T00:00:00Z') }), hof(2), hof(3)])
    expect(await schreibeZusagenFest({ bestaetigt: true })).toEqual({ error: TEXT.festschreibenPlaetze(3) })
    expect(db.plattformEinstellung.updateMany).not.toHaveBeenCalled()
  })
})

describe('approveFarmAction nach dem Festschreiben', () => {
  beforeEach(() => {
    einstellung(FEST)
    db.farm.findUnique.mockImplementation(async ({ select }: { select: Record<string, unknown> }) =>
      'owner' in select
        ? { name: 'Testhof A', slug: 'testhof-a', stripeAccountReady: true, products: [{ id: 'p_1' }], _count: { pickupSlots: 1 }, owner: { email: 'hof@example.com', emailVerified: true, createdAt: new Date('2026-01-01T00:00:00Z') } }
        : { gruendungPlatz: null, gruendungBis: null, gruendungAusgenommen: false }
    )
  })

  it('bekommt die kleinste freie Nummer und das Ende ab heute — bedingt nur ohne Platz geschrieben', async () => {
    db.farm.findMany.mockResolvedValue([hof(1, { gruendungPlatz: 1 }), hof(2, { gruendungPlatz: 3 })])
    expect(await approveFarmAction('neu')).toEqual({})
    expect(db.farm.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'neu', gruendungPlatz: null },
      data: { gruendungPlatz: 2, gruendungBis: new Date('2029-01-31T00:00:00.000Z') },
    })
    expect(db.unterhaltung.create).toHaveBeenCalledTimes(1)
    const text = db.unterhaltung.create.mock.calls[0]?.[0].data.nachrichten.create.text as string
    expect(text.replace(/ /g, ' ')).toContain('Du bist Gründungshof Nr. 2 – Hofladen ohne Grundgebühr bis 31. Jänner 2029.')
  })

  it('erneute Freigabe nach Entzug: Platz und Ende bleiben, nichts daran geschrieben', async () => {
    db.farm.findUnique.mockImplementation(async ({ select }: { select: Record<string, unknown> }) =>
      'owner' in select
        ? { name: 'Testhof A', slug: 'testhof-a', stripeAccountReady: true, products: [{ id: 'p_1' }], _count: { pickupSlots: 1 }, owner: { email: 'hof@example.com', emailVerified: true, createdAt: new Date('2026-01-01T00:00:00Z') } }
        : { gruendungPlatz: 7, gruendungBis: new Date('2029-04-30T00:00:00.000Z'), gruendungAusgenommen: false }
    )
    db.farm.findMany.mockResolvedValue([hof(1, { gruendungPlatz: 1 })])
    expect(await approveFarmAction('neu')).toEqual({})
    expect(db.farm.updateMany).toHaveBeenCalledTimes(1) // nur die Freischaltung selbst
  })

  it('Platz ohne gespeichertes Ende: die Nachricht nennt das Ende der Konditionen (Standard), nichts geschrieben', async () => {
    db.farm.findUnique.mockImplementation(async ({ select }: { select: Record<string, unknown> }) =>
      'owner' in select
        ? { name: 'Testhof A', slug: 'testhof-a', stripeAccountReady: true, products: [{ id: 'p_1' }], _count: { pickupSlots: 1 }, owner: { email: 'hof@example.com', emailVerified: true, createdAt: new Date('2026-01-01T00:00:00Z') } }
        : { gruendungPlatz: 7, gruendungBis: null, gruendungAusgenommen: false }
    )
    db.farm.findMany.mockResolvedValue([hof(1, { gruendungPlatz: 1 }), hof(9, { id: 'neu', gruendungPlatz: 7 })])
    expect(await approveFarmAction('neu')).toEqual({})
    expect(db.farm.updateMany).toHaveBeenCalledTimes(1) // nur die Freischaltung selbst
    const text = (db.unterhaltung.create.mock.calls[0]?.[0].data.nachrichten.create.text as string).replace(/\u00a0/g, ' ')
    expect(text).toContain('Du bist Gründungshof Nr. 7 – Hofladen ohne Grundgebühr bis 31. Dezember 2027.')
    // Gegenprobe: nicht das Ende einer neuen Zusage ab heute.
    expect(text).not.toContain('2029')
  })

  it('nach der Freischaltung: Höfe-Liste (Cache-Etikett) und /konditionen neu', async () => {
    db.farm.findMany.mockResolvedValue([hof(1, { gruendungPlatz: 1 })])
    expect(await approveFarmAction('neu')).toEqual({})
    expect(updateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG)
    expect(revalidatePath).toHaveBeenCalledWith('/konditionen')
  })

  it('nach dem Stichtag: freigeschaltet, aber kein Platz und keine Nachricht', async () => {
    vi.setSystemTime(new Date('2027-04-01T09:00:00+02:00'))
    db.farm.findMany.mockResolvedValue([hof(1, { gruendungPlatz: 1 })])
    expect(await approveFarmAction('neu')).toEqual({})
    expect(db.farm.updateMany).toHaveBeenCalledTimes(1)
    expect(db.unterhaltung.create).not.toHaveBeenCalled()
  })
})

describe('nimmWiederAuf nach dem Festschreiben', () => {
  it('nach dem Stichtag: abgewiesen mit eigenem Satz, nichts geschrieben', async () => {
    einstellung({ ...FEST, gruendungAktionBis: new Date('2026-10-18T00:00:00.000Z') })
    db.farm.findMany.mockResolvedValue([hof(1, { gruendungPlatz: 1 }), hof(2, { gruendungAusgenommen: true })])
    expect(await nimmWiederAuf({ farmId: 'hof_2' })).toEqual({ error: GRUENDUNG_AKTION_VORBEI })
    expect(db.farm.updateMany).not.toHaveBeenCalled()
  })

  it('Aktion läuft: die kleinste freie Nummer, das Ende ab heute — nie kürzer als ein gespeichertes', async () => {
    einstellung(FEST)
    db.farm.findMany.mockResolvedValue([hof(1, { gruendungPlatz: 1 }), hof(2, { gruendungAusgenommen: true, gruendungBis: new Date('2030-01-31T00:00:00.000Z') })])
    expect(await nimmWiederAuf({ farmId: 'hof_2' })).toEqual({ ok: true })
    expect(db.farm.updateMany).toHaveBeenCalledWith({
      where: { id: 'hof_2', gruendungAusgenommen: true, istTesthof: false, approvedAt: { not: null }, archivedAt: null },
      data: expect.objectContaining({ gruendungAusgenommen: false, gruendungPlatz: 2, gruendungBis: new Date('2030-01-31T00:00:00.000Z') }),
    })
  })
})

describe('setzeAbzeichenSichtbar — nur der eigene Hof mit Platz', () => {
  beforeEach(() => {
    getSession.mockResolvedValue(adminSitzung('u_1') as never)
    db.farm.findUnique.mockResolvedValue({ id: 'hof_1', name: 'Testhof A', slug: 'testhof-a', logoUrl: null, logoAusschnitt: null })
  })

  it('ohne Sitzung oder mit falscher Eingabe: nichts geschrieben', async () => {
    expect(await setzeAbzeichenSichtbar({ zeigen: 'nein' })).toEqual({ error: ABZEICHEN_TEXT.fehler })
    getSession.mockResolvedValue(null as never)
    expect(await setzeAbzeichenSichtbar({ zeigen: false })).toEqual({ error: 'Bitte melde dich neu an.' })
    expect(db.farm.updateMany).not.toHaveBeenCalled()
  })

  it('Besitz und Platz in derselben WHERE-Klausel — ein fremder Hof oder einer ohne Platz ändert nichts', async () => {
    db.farm.updateMany.mockResolvedValue({ count: 0 })
    expect(await setzeAbzeichenSichtbar({ zeigen: false })).toEqual({ error: ABZEICHEN_TEXT.fehler })
    expect(db.farm.updateMany).toHaveBeenCalledWith({
      where: { id: 'hof_1', ownerId: 'u_1', gruendungPlatz: { not: null } },
      data: { gruendungAbzeichenZeigen: false },
    })
    expect(vi.mocked(updateTag)).not.toHaveBeenCalled()
  })

  it('ausgeblendet: sofort weg — Hofseite, Konditionen und der Cache der Höfe-Liste neu', async () => {
    expect(await setzeAbzeichenSichtbar({ zeigen: false })).toEqual({ ok: true, zeigen: false })
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/testhof-a')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/settings/konditionen')
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith(HOEFE_CACHE_TAG)
  })
})

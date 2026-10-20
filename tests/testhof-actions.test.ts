/**
 * Testhof (Register N21, Nr. 119) — die Actions markiereAlsTesthof und
 * nimmTesthofZurueck sowie die Ablehnung in nimmWiederAuf, am echten Code;
 * Prisma und Auth gemockt, Regeln und Berechtigung echt (verlangeAdminAktion,
 * verlangeFrischeBestaetigung; die Sitzung aus tests/admin-sitzung.ts).
 *
 * Beweist:
 *  - ohne Anmeldung oder ohne Admin-Recht aus der Datenbank wirkt nichts;
 *  - ohne frische Bestätigung mit Passkey (Register N20, Nr. 115) antworten
 *    beide Actions „frisch“ — keine Höfe gelesen, nichts geschrieben, kein
 *    Neubau; frisch bestätigt geht es;
 *  - Markieren nimmt ZUERST die Sperre der Gründungsplätze und liest danach;
 *    hält der Hof einen Platz, ohne den eigenen Haken abgewiesen, nichts
 *    geschrieben; mit Haken bedingt (`istTesthof: false`) — Testhof,
 *    ausgenommen, Platz frei, „geändert am/von“ für beides;
 *  - nur ein freigeschalteter, nicht stillgelegter Hof lässt sich markieren;
 *  - zweimal markieren ändert nichts (das bedingte Schreiben trifft nichts);
 *  - Zurücknehmen schreibt nur das Merkmal, der Hof bleibt ausgenommen;
 *  - nimmWiederAuf lehnt einen Testhof ab, ohne zu schreiben;
 *  - danach neu gebaut: die Seiten der Gründung, Höfe-Liste, Sitemap,
 *    Startseite und die Hofseite des Hofs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', async () => {
  const prisma: Record<string, unknown> = {
    farm: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    // Die Wache liest seit Nr. 115 die Pflicht „erst Passkey“ (tests/admin-sitzung.ts).
    ...(await import('./admin-sitzung')).passkeyAttrappen(),
    user: { findUnique: vi.fn() },
    plattformEinstellung: { findUnique: vi.fn() },
    $executeRaw: vi.fn(async () => 1),
  }
  // Die Transaktion ruft den Rückruf mit demselben Client — Reihenfolge und Werte sind die Aussage.
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma))
  return { prisma }
})

import { revalidatePath, updateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GRUENDUNGSPLAETZE_SPERRE, TESTHOF_ZAEHLT_NIE } from '@/lib/gruendungshof'
import { FRISCH_FEHLER, FRISCH_MINUTEN } from '@/lib/admin-anmeldung'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { STARTSEITE_CACHE_TAG } from '@/lib/startseite-gestalten'
import { GRUENDUNG_AUSNEHMEN_GEAENDERT, GRUENDUNG_EINGABE_UNGUELTIG, TESTHOF_HAKEN_FEHLT, TESTHOF_NUR_FREIGESCHALTET } from '@/schemas/gruendung'
import { markiereAlsTesthof, nimmTesthofZurueck, nimmWiederAuf } from '@/server/actions/gruendung'
import { adminSitzung } from './admin-sitzung'

type Fn = ReturnType<typeof vi.fn>
const getSession = vi.mocked(auth.api.getSession)
const db = prisma as unknown as {
  farm: { findUnique: Fn; findUniqueOrThrow: Fn; findMany: Fn; updateMany: Fn }
  user: { findUnique: Fn }
  plattformEinstellung: { findUnique: Fn }
  $executeRaw: Fn
  $transaction: Fn
}

/** Ein Hof der Platzvergabe (Form von HOF_FUER_GRUENDUNG), freigeschaltet am n. Jänner. */
function platzHof(n: number, ueber: { gruendungAusgenommen?: boolean; archivedAt?: Date | null; approvedAt?: Date | null } = {}) {
  return {
    id: `hof_${n}`,
    ownerId: `u_${n}`,
    approvedAt: new Date(Date.UTC(2026, 0, n)),
    createdAt: new Date(Date.UTC(2025, 0, 1)),
    archivedAt: null,
    gruendungBis: null,
    gruendungAusgenommen: false,
    gruendungPlatz: null,
    ...ueber,
  }
}

function einstellung(plaetze: number) {
  db.plattformEinstellung.findUnique.mockResolvedValue({
    gruendungPlaetze: plaetze,
    gruendungBisStandard: new Date('2027-12-31T00:00:00.000Z'),
    gruendungAnzeige: true,
    gruendungMonate: 24,
    gruendungAktionBis: null,
    gruendungFestAm: null,
    geaendertVonUserId: null,
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  })
}

/** War die Sperre der erste Schritt in der Transaktion, vor jedem Lesen und Schreiben eines Hofs? */
function sperreZuerst(): void {
  const [aufruf] = db.$executeRaw.mock.calls
  expect((aufruf?.[0] as readonly string[]).join('?')).toContain('pg_advisory_xact_lock(?)')
  expect(aufruf?.[1]).toBe(GRUENDUNGSPLAETZE_SPERRE)
  const erstesLesen = Math.min(...[db.farm.findMany, db.farm.updateMany].flatMap((f) => f.mock.invocationCallOrder))
  expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(erstesLesen)
}

/** Ein Admin, mit Passkey angemeldet, aber zuletzt vor mehr als FRISCH_MINUTEN bestätigt. */
function nichtFrisch(): unknown {
  return {
    user: { id: 'admin_1' },
    session: { id: 'sitzung-admin_1', createdAt: new Date(), passkeyAm: new Date(Date.now() - (FRISCH_MINUTEN + 1) * 60_000) },
  }
}

/** Ohne frische Bestätigung: kein Hof und keine Einstellung gelesen, nichts geschrieben, nichts neu gebaut. */
function nichtsGetan(): void {
  expect(db.$transaction).not.toHaveBeenCalled()
  expect(db.$executeRaw).not.toHaveBeenCalled()
  expect(db.farm.findMany).not.toHaveBeenCalled()
  expect(db.plattformEinstellung.findUnique).not.toHaveBeenCalled()
  expect(db.farm.updateMany).not.toHaveBeenCalled()
  expect(db.farm.findUniqueOrThrow).not.toHaveBeenCalled()
  expect(revalidatePath).not.toHaveBeenCalled()
  expect(updateTag).not.toHaveBeenCalled()
}

/** Was nach jedem Testhof-Wechsel neu gebaut wird. */
function neuGebaut(slug: string): void {
  for (const pfad of ['/admin', '/fuer-hoefe', '/', '/sitemap.xml', `/${slug}`]) expect(revalidatePath).toHaveBeenCalledWith(pfad)
  expect(updateTag).toHaveBeenCalledWith(HOEFE_CACHE_TAG)
  expect(updateTag).toHaveBeenCalledWith(STARTSEITE_CACHE_TAG)
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(adminSitzung('admin_1') as never)
  db.user.findUnique.mockResolvedValue({ isAdmin: true })
  db.farm.updateMany.mockResolvedValue({ count: 1 })
  db.farm.findUniqueOrThrow.mockResolvedValue({ slug: 'testhof-b' })
  einstellung(12)
})

describe('ohne Admin wirkt nichts', () => {
  it('nicht angemeldet bzw. ohne Admin-Recht aus der Datenbank: keine Transaktion, kein Schreiben — beide Wege', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await markiereAlsTesthof({ farmId: 'hof_1', bestaetigt: true })).toEqual({ error: 'Nicht angemeldet.' })
    expect(await nimmTesthofZurueck({ farmId: 'hof_1' })).toEqual({ error: 'Nicht angemeldet.' })
    getSession.mockResolvedValue(adminSitzung('u_9') as never)
    db.user.findUnique.mockResolvedValue({ isAdmin: false })
    expect(await markiereAlsTesthof({ farmId: 'hof_1', bestaetigt: true })).toEqual({ error: 'Kein Zugriff.' })
    expect(await nimmTesthofZurueck({ farmId: 'hof_1' })).toEqual({ error: 'Kein Zugriff.' })
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.farm.updateMany).not.toHaveBeenCalled()
  })

  it('falscher Typ: ein eigener Satz, nie Zods englischer Text, nichts gelesen', async () => {
    expect(await markiereAlsTesthof({ farmId: 'hof_1', bestaetigt: 'ja' })).toEqual({ error: GRUENDUNG_EINGABE_UNGUELTIG })
    expect(await nimmTesthofZurueck({ farmId: 7 })).toEqual({ error: GRUENDUNG_EINGABE_UNGUELTIG })
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})

describe('ohne frische Bestätigung mit Passkey wirkt nichts (N20, Nr. 115)', () => {
  it('markiereAlsTesthof: Antwort „frisch“, nichts gelesen, nichts geschrieben, kein Neubau — Gegenprobe: frisch bestätigt geht es', async () => {
    db.farm.findMany.mockResolvedValue([platzHof(1), platzHof(2)])
    getSession.mockResolvedValue(nichtFrisch() as never)
    expect(await markiereAlsTesthof({ farmId: 'hof_2', bestaetigt: true })).toEqual({ error: FRISCH_FEHLER })
    nichtsGetan()
    getSession.mockResolvedValue(adminSitzung('admin_1') as never)
    expect(await markiereAlsTesthof({ farmId: 'hof_2', bestaetigt: true })).toEqual({ ok: true })
    expect(db.farm.updateMany).toHaveBeenCalledTimes(1)
    neuGebaut('testhof-b')
  })

  it('nimmTesthofZurueck: Antwort „frisch“, nichts gelesen, nichts geschrieben, kein Neubau — Gegenprobe: frisch bestätigt geht es', async () => {
    getSession.mockResolvedValue(nichtFrisch() as never)
    expect(await nimmTesthofZurueck({ farmId: 'hof_1' })).toEqual({ error: FRISCH_FEHLER })
    nichtsGetan()
    getSession.mockResolvedValue(adminSitzung('admin_1') as never)
    expect(await nimmTesthofZurueck({ farmId: 'hof_1' })).toEqual({ ok: true })
    expect(db.farm.updateMany).toHaveBeenCalledTimes(1)
    neuGebaut('testhof-b')
  })
})

describe('markiereAlsTesthof', () => {
  it('Hof mit Platz ohne den eigenen Haken: abgewiesen, nichts geschrieben, nichts neu gebaut', async () => {
    db.farm.findMany.mockResolvedValue([platzHof(1), platzHof(2)])
    expect(await markiereAlsTesthof({ farmId: 'hof_2', bestaetigt: false })).toEqual({ error: TESTHOF_HAKEN_FEHLT })
    expect(db.farm.updateMany).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('mit Haken: unter der Sperre bedingt — Testhof, ausgenommen, Platz frei, wer und wann für beides', async () => {
    db.farm.findMany.mockResolvedValue([platzHof(1), platzHof(2)])
    expect(await markiereAlsTesthof({ farmId: 'hof_2', bestaetigt: true })).toEqual({ ok: true })
    sperreZuerst()
    expect(db.farm.updateMany).toHaveBeenCalledWith({
      where: { id: 'hof_2', istTesthof: false, approvedAt: { not: null }, archivedAt: null },
      data: {
        istTesthof: true,
        testhofGeaendertAm: expect.any(Date),
        testhofGeaendertVonUserId: 'admin_1',
        gruendungAusgenommen: true,
        gruendungPlatz: null,
        gruendungGeaendertAm: expect.any(Date),
        gruendungGeaendertVonUserId: 'admin_1',
      },
    })
    neuGebaut('testhof-b')
  })

  it('ohne Platz (alle Plätze vergeben) geht es auch ohne Haken', async () => {
    einstellung(1)
    db.farm.findMany.mockResolvedValue([platzHof(1), platzHof(2)])
    expect(await markiereAlsTesthof({ farmId: 'hof_2', bestaetigt: false })).toEqual({ ok: true })
    expect(db.farm.updateMany).toHaveBeenCalledTimes(1)
  })

  it('nur ein freigeschalteter, nicht stillgelegter Hof — sonst ein eigener Satz und nichts geschrieben', async () => {
    db.farm.findMany.mockResolvedValue([platzHof(1, { archivedAt: new Date(Date.UTC(2026, 5, 1)) })])
    expect(await markiereAlsTesthof({ farmId: 'hof_1', bestaetigt: true })).toEqual({ error: TESTHOF_NUR_FREIGESCHALTET })
    expect(await markiereAlsTesthof({ farmId: 'hof_unbekannt', bestaetigt: true })).toEqual({ error: TESTHOF_NUR_FREIGESCHALTET })
    expect(db.farm.updateMany).not.toHaveBeenCalled()
  })

  it('zweimal markieren ändert nichts: das bedingte Schreiben trifft nichts, kein Neubau', async () => {
    db.farm.findMany.mockResolvedValue([platzHof(1, { gruendungAusgenommen: true })])
    db.farm.updateMany.mockResolvedValue({ count: 0 })
    expect(await markiereAlsTesthof({ farmId: 'hof_1', bestaetigt: false })).toEqual({ error: GRUENDUNG_AUSNEHMEN_GEAENDERT })
    expect(db.farm.findUniqueOrThrow).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('nimmTesthofZurueck', () => {
  it('unter der Sperre, bedingt (`istTesthof: true`): nur das Merkmal — der Hof bleibt ausgenommen', async () => {
    expect(await nimmTesthofZurueck({ farmId: 'hof_1' })).toEqual({ ok: true })
    sperreZuerst()
    expect(db.farm.updateMany).toHaveBeenCalledWith({
      where: { id: 'hof_1', istTesthof: true },
      data: { istTesthof: false, testhofGeaendertAm: expect.any(Date), testhofGeaendertVonUserId: 'admin_1' },
    })
    neuGebaut('testhof-b')
  })

  it('kein Testhof (mehr): nichts geändert, ein Satz, kein Neubau', async () => {
    db.farm.updateMany.mockResolvedValue({ count: 0 })
    expect(await nimmTesthofZurueck({ farmId: 'hof_1' })).toEqual({ error: GRUENDUNG_AUSNEHMEN_GEAENDERT })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('nimmWiederAuf und Testhof', () => {
  it('lehnt einen Testhof ab — mit demselben Satz wie der ausgegraute Eintrag — und schreibt nichts', async () => {
    db.farm.findMany.mockResolvedValue([platzHof(1, { gruendungAusgenommen: true })])
    db.farm.findUnique.mockResolvedValue({ istTesthof: true })
    expect(await nimmWiederAuf({ farmId: 'hof_1' })).toEqual({ error: TESTHOF_ZAEHLT_NIE })
    expect(db.farm.updateMany).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ein nur ausgenommener Hof kommt zurück, bedingt auch auf `istTesthof: false`', async () => {
    db.farm.findMany.mockResolvedValue([platzHof(1, { gruendungAusgenommen: true })])
    db.farm.findUnique.mockResolvedValue({ istTesthof: false })
    expect(await nimmWiederAuf({ farmId: 'hof_1' })).toEqual({ ok: true })
    expect(db.farm.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ istTesthof: false, gruendungAusgenommen: true }) }))
  })
})

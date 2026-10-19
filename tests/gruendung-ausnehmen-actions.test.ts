/**
 * Gründungshöfe: Testhöfe ausnehmen (Register K2, Nr. 109) — die Actions
 * nimmAusGruendung, nimmWiederAuf und die Sperre in approveFarmAction am
 * echten Code; Prisma und Auth gemockt, die Regeln echt.
 *
 * Beweist:
 *  - ohne Anmeldung oder ohne Admin-Recht aus der Datenbank wirkt nichts;
 *  - hält der Hof einen Platz, wird Ausnehmen ohne Haken abgewiesen und nichts
 *    geschrieben; mit Haken bedingt (`gruendungAusgenommen: false`) samt wer und
 *    wann; zweimal ausnehmen ändert nichts (das bedingte Schreiben trifft nichts);
 *  - Wiederaufnahme bei vollen Plätzen (Zahl aus der Einstellung, nie die feste
 *    12) abgewiesen, mit freiem Platz bedingt (`gruendungAusgenommen: true`);
 *  - alle drei Wege nehmen ZUERST die Sperre GRUENDUNGSPLAETZE_SPERRE und lesen
 *    die Höfe danach — Freischalten samt dem Zeitpunkt der Freigabe;
 *  - keine Nachricht und keine Mail beim Aus- und Wiederaufnehmen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/email', () => ({ sendFreischaltungEmail: vi.fn(async () => ({})) }))
vi.mock('@/lib/prisma', () => {
  const prisma: Record<string, unknown> = {
    farm: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn() },
    plattformEinstellung: { findUnique: vi.fn() },
    nachricht: { findFirst: vi.fn(async () => null) },
    unterhaltung: { create: vi.fn(async () => ({ id: 'u_1' })) },
    $executeRaw: vi.fn(async () => 1),
  }
  // Die Transaktion ruft den Rückruf mit demselben Client — Reihenfolge und Werte sind die Aussage.
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma))
  return { prisma }
})

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendFreischaltungEmail } from '@/lib/email'
import { GRUENDUNGSPLAETZE_SPERRE, gruendungAlleVergeben } from '@/lib/gruendungshof'
import {
  GRUENDUNG_AUSNEHMEN_GEAENDERT,
  GRUENDUNG_AUSNEHMEN_ZUSTIMMUNG_FEHLT,
  GRUENDUNG_EINGABE_UNGUELTIG,
  GRUENDUNG_NUR_FREIGESCHALTET,
} from '@/schemas/gruendung'
import { nimmAusGruendung, nimmWiederAuf } from '@/server/actions/gruendung'
import { approveFarmAction } from '@/server/actions/admin'

const getSession = vi.mocked(auth.api.getSession)
const db = prisma as unknown as {
  farm: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> }
  user: { findUnique: ReturnType<typeof vi.fn> }
  plattformEinstellung: { findUnique: ReturnType<typeof vi.fn> }
  unterhaltung: { create: ReturnType<typeof vi.fn> }
  $executeRaw: ReturnType<typeof vi.fn>
  $transaction: ReturnType<typeof vi.fn>
}

/** Ein Hof der Platzvergabe (Form von HOF_FUER_GRUENDUNG), freigeschaltet am n. Jänner. */
function platzHof(n: number, gruendungAusgenommen = false) {
  return {
    id: `hof_${n}`,
    ownerId: `u_${n}`,
    approvedAt: new Date(Date.UTC(2026, 0, n)),
    createdAt: new Date(Date.UTC(2025, 0, 1)),
    archivedAt: null,
    gruendungBis: null,
    gruendungAusgenommen,
  }
}

function einstellung(plaetze: number) {
  db.plattformEinstellung.findUnique.mockResolvedValue({
    gruendungPlaetze: plaetze,
    gruendungBisStandard: new Date('2027-12-31T00:00:00.000Z'),
    gruendungAnzeige: true,
    geaendertVonUserId: null,
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  })
}

/** War die Sperre der erste Schritt in der Transaktion, vor dem Lesen der Höfe? */
function sperreVorLesen(): void {
  const [aufruf] = db.$executeRaw.mock.calls
  expect((aufruf?.[0] as readonly string[]).join('?')).toContain('pg_advisory_xact_lock(?)')
  expect(aufruf?.[1]).toBe(GRUENDUNGSPLAETZE_SPERRE)
  expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(db.farm.findMany.mock.invocationCallOrder[0] ?? 0)
}

const PFADE = ['/admin', '/admin/einstellungen', '/fuer-hoefe', '/register', '/']

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'admin_1' } } as never)
  db.user.findUnique.mockResolvedValue({ isAdmin: true })
  db.farm.updateMany.mockResolvedValue({ count: 1 })
  einstellung(12)
})

describe('ohne Admin wirkt nichts', () => {
  it('nicht angemeldet: kein Lesen, kein Schreiben — beide Wege', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await nimmAusGruendung({ farmId: 'hof_1', bestaetigt: true })).toEqual({ error: 'Nicht angemeldet.' })
    expect(await nimmWiederAuf({ farmId: 'hof_1' })).toEqual({ error: 'Nicht angemeldet.' })
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.farm.updateMany).not.toHaveBeenCalled()
  })

  it('angemeldet, aber ohne Admin-Recht aus der Datenbank: nichts', async () => {
    db.user.findUnique.mockResolvedValue({ isAdmin: false })
    expect(await nimmAusGruendung({ farmId: 'hof_1', bestaetigt: true })).toEqual({ error: 'Kein Zugriff.' })
    expect(await nimmWiederAuf({ farmId: 'hof_1' })).toEqual({ error: 'Kein Zugriff.' })
    expect(db.farm.updateMany).not.toHaveBeenCalled()
  })
})

describe('nimmAusGruendung', () => {
  it('Hof mit Platz ohne Haken: abgewiesen, nichts geschrieben', async () => {
    db.farm.findMany.mockResolvedValue([platzHof(1), platzHof(2)])
    expect(await nimmAusGruendung({ farmId: 'hof_2', bestaetigt: false })).toEqual({ error: GRUENDUNG_AUSNEHMEN_ZUSTIMMUNG_FEHLT })
    expect(db.farm.updateMany).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('mit Haken: unter der Sperre bedingt geschrieben, wer und wann, die Seiten neu', async () => {
    db.farm.findMany.mockResolvedValue([platzHof(1), platzHof(2)])
    expect(await nimmAusGruendung({ farmId: 'hof_2', bestaetigt: true })).toEqual({ ok: true })
    sperreVorLesen()
    expect(db.farm.updateMany).toHaveBeenCalledWith({
      where: { id: 'hof_2', gruendungAusgenommen: false, approvedAt: { not: null }, archivedAt: null },
      // Festgeschrieben gibt das Ausnehmen den Platz frei (Nr. 116); vorher ist er ohnehin null.
      data: { gruendungAusgenommen: true, gruendungPlatz: null, gruendungGeaendertAm: expect.any(Date), gruendungGeaendertVonUserId: 'admin_1' },
    })
    for (const pfad of PFADE) expect(revalidatePath).toHaveBeenCalledWith(pfad)
    // Keine Nachricht, keine Mail (K2).
    expect(db.unterhaltung.create).not.toHaveBeenCalled()
    expect(sendFreischaltungEmail).not.toHaveBeenCalled()
  })

  it('ein Hof ohne Platz (Plätze aus der Einstellung) braucht keinen Haken', async () => {
    einstellung(1)
    db.farm.findMany.mockResolvedValue([platzHof(1), platzHof(2)])
    expect(await nimmAusGruendung({ farmId: 'hof_2', bestaetigt: false })).toEqual({ ok: true })
    // Gegenprobe: mit 12 Plätzen hält er einen — dann wieder abgewiesen.
    einstellung(12)
    expect(await nimmAusGruendung({ farmId: 'hof_2', bestaetigt: false })).toEqual({ error: GRUENDUNG_AUSNEHMEN_ZUSTIMMUNG_FEHLT })
  })

  it('zweimal ausnehmen: das bedingte Schreiben trifft nichts — keine Änderung, kein Neuladen', async () => {
    db.farm.findMany.mockResolvedValue([platzHof(1), platzHof(2, true)])
    db.farm.updateMany.mockResolvedValue({ count: 0 })
    expect(await nimmAusGruendung({ farmId: 'hof_2', bestaetigt: true })).toEqual({ error: GRUENDUNG_AUSNEHMEN_GEAENDERT })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('ein wartender oder stillgelegter Hof steht nicht in der Vergabe', async () => {
    db.farm.findMany.mockResolvedValue([platzHof(1)])
    expect(await nimmAusGruendung({ farmId: 'hof_9', bestaetigt: true })).toEqual({ error: GRUENDUNG_NUR_FREIGESCHALTET })
    expect(db.farm.updateMany).not.toHaveBeenCalled()
  })

  it('ungültige Eingabe: ein eigener Satz, nie Zods Standardtext', async () => {
    expect(await nimmAusGruendung({ farmId: 'hof_1', bestaetigt: 'ja' })).toEqual({ error: GRUENDUNG_EINGABE_UNGUELTIG })
    expect(await nimmAusGruendung({ farmId: 'hof_1' })).toEqual({ error: GRUENDUNG_EINGABE_UNGUELTIG })
    expect(await nimmWiederAuf({ farmId: 'hof_1', bestaetigt: true })).toEqual({ error: GRUENDUNG_EINGABE_UNGUELTIG })
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})

describe('nimmWiederAuf', () => {
  it('alle Plätze vergeben (Plätze aus der Einstellung): abgewiesen mit dem Satz, nichts geschrieben', async () => {
    einstellung(2)
    db.farm.findMany.mockResolvedValue([platzHof(1, true), platzHof(2), platzHof(3)])
    expect(await nimmWiederAuf({ farmId: 'hof_1' })).toEqual({ error: gruendungAlleVergeben(2) })
    expect(db.farm.updateMany).not.toHaveBeenCalled()
  })

  it('ein Platz frei: unter der Sperre bedingt geschrieben', async () => {
    einstellung(3)
    db.farm.findMany.mockResolvedValue([platzHof(1, true), platzHof(2), platzHof(3)])
    expect(await nimmWiederAuf({ farmId: 'hof_1' })).toEqual({ ok: true })
    sperreVorLesen()
    expect(db.farm.updateMany).toHaveBeenCalledWith({
      where: { id: 'hof_1', gruendungAusgenommen: true, approvedAt: { not: null }, archivedAt: null },
      data: { gruendungAusgenommen: false, gruendungGeaendertAm: expect.any(Date), gruendungGeaendertVonUserId: 'admin_1' },
    })
    for (const pfad of PFADE) expect(revalidatePath).toHaveBeenCalledWith(pfad)
    expect(db.unterhaltung.create).not.toHaveBeenCalled()
  })

  it('schon wieder aufgenommen: keine Änderung', async () => {
    db.farm.findMany.mockResolvedValue([platzHof(1)])
    db.farm.updateMany.mockResolvedValue({ count: 0 })
    expect(await nimmWiederAuf({ farmId: 'hof_1' })).toEqual({ error: GRUENDUNG_AUSNEHMEN_GEAENDERT })
  })
})

describe('approveFarmAction nimmt dieselbe Sperre', () => {
  beforeEach(() => {
    db.farm.findUnique.mockResolvedValue({
      name: 'Testhof A',
      slug: 'testhof-a',
      stripeAccountReady: true,
      owner: { email: 'hof@example.com', emailVerified: true, createdAt: new Date('2026-01-01T00:00:00Z') },
      // Seit Nr. 116: mindestens ein Produkt im Shop.
      products: [{ id: 'p_1' }],
    })
  })

  it('Sperre, dann Freischalten, dann die Höfe lesen — der Zeitpunkt der Freigabe entsteht nach der Sperre', async () => {
    db.farm.findMany.mockResolvedValue([platzHof(1), { ...platzHof(5), id: 'neu' }])
    expect(await approveFarmAction('neu')).toEqual({})
    sperreVorLesen()
    const sperre = db.$executeRaw.mock.invocationCallOrder[0] ?? 0
    const schreiben = db.farm.updateMany.mock.invocationCallOrder[0] ?? 0
    expect(sperre).toBeLessThan(schreiben)
    expect(schreiben).toBeLessThan(db.farm.findMany.mock.invocationCallOrder[0] ?? 0)
    expect(db.farm.updateMany).toHaveBeenCalledWith({
      where: { id: 'neu', stripeAccountReady: true, approvedAt: null, products: { some: { isAvailable: true } } },
      data: { approvedAt: expect.any(Date) },
    })
    // Mit Platz (2 von 12): die eine Gründungs-Nachricht.
    expect(db.unterhaltung.create).toHaveBeenCalledTimes(1)
  })

  it('ohne freien Platz laut Einstellung keine Nachricht; ein ausgenommener Hof belegt keinen', async () => {
    einstellung(1)
    db.farm.findMany.mockResolvedValue([platzHof(1), { ...platzHof(5), id: 'neu' }])
    expect(await approveFarmAction('neu')).toEqual({})
    expect(db.unterhaltung.create).not.toHaveBeenCalled()
    // Gegenprobe: ist der erste Hof ausgenommen, bekommt der neue Platz 1 — und seine Nachricht.
    db.farm.findMany.mockResolvedValue([platzHof(1, true), { ...platzHof(5), id: 'neu' }])
    expect(await approveFarmAction('neu')).toEqual({})
    expect(db.unterhaltung.create).toHaveBeenCalledTimes(1)
  })
})

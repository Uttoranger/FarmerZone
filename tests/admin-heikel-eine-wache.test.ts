/**
 * Eine Wache je heikler Admin-Aktion (Register N20, Nr. 126; Nacharbeit zu Nr. 115).
 *
 * `verlangeFrischeBestaetigung` prüft schon alles von `verlangeAdminAktion`
 * (Anmeldung, Recht frisch aus der Datenbank, 12 Stunden, Pflicht, Passkey der
 * Sitzung) und gibt `{ ok, userId, sitzungId }` zurück. Eine zweite Wache
 * dahinter fragt dieselbe Datenbank noch einmal und kann nichts Neues sagen.
 *
 * Beweist an den echten Actions, mit der ECHTEN Wache (nur gezählt, nicht
 * ersetzt; Sitzung aus tests/admin-sitzung.ts):
 *  - jede heikle Action ruft die Wache genau einmal — `verlangeFrischeBestaetigung`
 *    1×, `verlangeAdminAktion` nie;
 *  - ohne Anmeldung, ohne Admin-Recht, ohne Passkey, mit einer Sitzung ohne
 *    Passkey-Anmeldung und ohne frische Bestätigung antwortet jede mit dem
 *    Satz der Wache, und nichts wird geschrieben;
 *  - frisch bestätigt kommt sie an der Wache vorbei (Gegenprobe: sie läuft
 *    bis zu ihrer ersten Prüfung der Eingabe bzw. des Hofs weiter).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
// admin.ts zieht @/lib/email herein (server-only) — dieselbe Mock-Grenze wie in admin-reject.test.ts.
vi.mock('@/lib/email', () => ({ sendFreischaltungEmail: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', async () => ({
  prisma: {
    farm: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    // Die Wache liest die Pflicht „erst Passkey“ (tests/admin-sitzung.ts).
    ...(await import('./admin-sitzung')).passkeyAttrappen(),
    user: { findUnique: vi.fn() },
    session: { deleteMany: vi.fn() },
    order: { updateMany: vi.fn() },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}))
// Die echte Wache, nur gezählt: Die Aufrufe laufen durch.
vi.mock('@/server/admin-wache', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/server/admin-wache')>()
  return {
    ...echt,
    verlangeAdminAktion: vi.fn(echt.verlangeAdminAktion),
    verlangeFrischeBestaetigung: vi.fn(echt.verlangeFrischeBestaetigung),
  }
})

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ADMIN_AKTION_FEHLER, FRISCH_FEHLER, FRISCH_MINUTEN } from '@/lib/admin-anmeldung'
import { GRUENDUNG_EINGABE_UNGUELTIG } from '@/schemas/gruendung'
import { verlangeAdminAktion, verlangeFrischeBestaetigung } from '@/server/admin-wache'
import { revokeFarmApprovalAction, rejectFarmAction } from '@/server/actions/admin'
import { markiereAlsTesthof, nimmAusGruendung, nimmTesthofZurueck, nimmWiederAuf, schreibeZusagenFest } from '@/server/actions/gruendung'
import { markiereErstattungErledigt } from '@/server/actions/postfach'
import { adminSitzung } from './admin-sitzung'

type Fn = ReturnType<typeof vi.fn>
const db = prisma as unknown as {
  farm: { findUnique: Fn; update: Fn; updateMany: Fn; delete: Fn }
  passkey: { aggregate: Fn }
  user: { findUnique: Fn }
  order: { updateMany: Fn }
  $transaction: Fn
}
const getSession = vi.mocked(auth.api.getSession)

const JETZT = new Date('2026-10-21T10:00:00.000Z')
const BESTELLUNG = 'cmfbestellung000000001ab'

/**
 * Die heiklen Actions mit dem, was sie nach bestandener Wache als Erstes
 * antworten (ungültige Eingabe bzw. kein Hof) — `schreibt`: ob das schon ein
 * Schreiben ist (die Erstattung braucht nur eine gültige Kennung).
 */
const AKTIONEN: Array<{ name: string; rufe: () => Promise<unknown>; danach: unknown; schreibt?: true }> = [
  { name: 'revokeFarmApprovalAction', rufe: () => revokeFarmApprovalAction('hof_1'), danach: { error: 'Hof nicht gefunden.' } },
  { name: 'rejectFarmAction', rufe: () => rejectFarmAction('hof_1'), danach: { error: 'Hof nicht gefunden.' } },
  { name: 'nimmAusGruendung', rufe: () => nimmAusGruendung(null), danach: { error: GRUENDUNG_EINGABE_UNGUELTIG } },
  { name: 'nimmWiederAuf', rufe: () => nimmWiederAuf(null), danach: { error: GRUENDUNG_EINGABE_UNGUELTIG } },
  { name: 'schreibeZusagenFest', rufe: () => schreibeZusagenFest(null), danach: { error: GRUENDUNG_EINGABE_UNGUELTIG } },
  { name: 'markiereAlsTesthof', rufe: () => markiereAlsTesthof(null), danach: { error: GRUENDUNG_EINGABE_UNGUELTIG } },
  { name: 'nimmTesthofZurueck', rufe: () => nimmTesthofZurueck(null), danach: { error: GRUENDUNG_EINGABE_UNGUELTIG } },
  { name: 'markiereErstattungErledigt', rufe: () => markiereErstattungErledigt({ orderId: BESTELLUNG }), danach: { ok: true }, schreibt: true },
]

/** Eine Sitzung mit Passkey, zuletzt vor `minuten` Minuten bestätigt. */
function sitzungVor(minuten: number | null): unknown {
  return {
    user: { id: 'admin_1' },
    session: {
      id: 'sitzung-admin_1',
      createdAt: JETZT,
      passkeyAm: minuten === null ? null : new Date(JETZT.getTime() - minuten * 60_000),
    },
  }
}

/** Was die Wache für das Konto sieht — jede Abweichung vom Regelfall (Admin, Passkey, frisch bestätigt). */
const SZENARIEN: Array<{ name: string; richte: () => void; erwartet: unknown }> = [
  { name: 'ohne Anmeldung', richte: () => getSession.mockResolvedValue(null), erwartet: { error: 'Nicht angemeldet.' } },
  { name: 'ohne Admin-Recht', richte: () => db.user.findUnique.mockResolvedValue({ isAdmin: false }), erwartet: { error: 'Kein Zugriff.' } },
  {
    name: 'ohne Passkey',
    richte: () => db.passkey.aggregate.mockResolvedValue({ _count: { _all: 0 }, _max: { createdAt: null } }),
    erwartet: { error: ADMIN_AKTION_FEHLER.pflicht },
  },
  { name: 'in einer Sitzung ohne Passkey-Anmeldung', richte: () => getSession.mockResolvedValue(sitzungVor(null) as never), erwartet: { error: ADMIN_AKTION_FEHLER.ohnePasskey } },
  {
    name: `ohne frische Bestätigung (älter als ${FRISCH_MINUTEN} Minuten)`,
    richte: () => getSession.mockResolvedValue(sitzungVor(FRISCH_MINUTEN + 1) as never),
    erwartet: { error: FRISCH_FEHLER },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.setSystemTime(JETZT)
  getSession.mockResolvedValue(adminSitzung('admin_1') as never)
  db.user.findUnique.mockResolvedValue({ isAdmin: true })
  // Ein Passkey, kein Ersatzcode benutzt — die Szenarien überschreiben es; clearAllMocks setzt nur die Aufrufe zurück.
  db.passkey.aggregate.mockResolvedValue({ _count: { _all: 1 }, _max: { createdAt: new Date(0) } })
  db.farm.findUnique.mockResolvedValue(null)
})

afterEach(() => {
  vi.useRealTimers()
})

function nichtsGeschrieben(): void {
  expect(db.farm.update).not.toHaveBeenCalled()
  expect(db.farm.updateMany).not.toHaveBeenCalled()
  expect(db.farm.delete).not.toHaveBeenCalled()
  expect(db.order.updateMany).not.toHaveBeenCalled()
  expect(db.$transaction).not.toHaveBeenCalled()
}

describe.each(AKTIONEN)('$name', ({ rufe, danach, schreibt }) => {
  it('ruft genau eine Wache: verlangeFrischeBestaetigung einmal, verlangeAdminAktion nie', async () => {
    await rufe()

    expect(vi.mocked(verlangeFrischeBestaetigung)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(verlangeAdminAktion)).not.toHaveBeenCalled()
  })

  it('kommt frisch bestätigt an der Wache vorbei und antwortet erst danach', async () => {
    expect(await rufe()).toEqual(danach)
    if (schreibt) expect(db.order.updateMany).toHaveBeenCalledTimes(1)
    else nichtsGeschrieben()
  })

  it.each(SZENARIEN)('weist ab: $name', async ({ richte, erwartet }) => {
    richte()

    expect(await rufe()).toEqual(erwartet)

    expect(vi.mocked(verlangeFrischeBestaetigung)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(verlangeAdminAktion)).not.toHaveBeenCalled()
    nichtsGeschrieben()
  })
})

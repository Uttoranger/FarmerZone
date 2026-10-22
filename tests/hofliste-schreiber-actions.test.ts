/**
 * Jede Server-Action, die etwas schreibt, das die Hofliste zeigt, erneuert
 * deren Zwischenspeicher sofort (Register N24-Ergänzung 22.10.2026, Nr. 137).
 *
 * Ursache: /hoefe und die Startseite lesen die Hofliste aus einem Eintrag
 * unter `HOEFE_CACHE_TAG` (fünf Minuten). `revalidatePath` erreicht ihn nicht —
 * eine Pause, eine abgeschaltete Abholzeit, ein neuer Name oder ein
 * entzogener Hof stand bis zu fünf Minuten zu spät dort.
 *
 * Beweist an den echten Actions (Prisma, Auth und `next/cache` ersetzt; die
 * Admin-Wache läuft echt, Sitzung aus tests/admin-sitzung.ts): Jede ruft
 * `updateTag(HOEFE_CACHE_TAG)`, und zwar nach ihrem Schreiben. Gegenprobe:
 * `updateFarmPhotoCaptionAction` schreibt nur die Bildunterschrift, die die
 * Liste nicht liest, und ruft es nicht. Dass keine weitere Action fehlt, hält
 * die Quelltext-Wache tests/hofliste-schreiber-wache.test.ts fest.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@vercel/blob', () => ({ del: vi.fn(), put: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
// admin.ts zieht @/lib/email herein (server-only) — dieselbe Mock-Grenze wie in admin-reject.test.ts.
vi.mock('@/lib/email', () => ({ sendFreischaltungEmail: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', async () => {
  const prisma: Record<string, unknown> = {
    farm: { findUnique: vi.fn(), update: vi.fn() },
    pickupSlot: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    farmPhoto: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    farmValue: { deleteMany: vi.fn(), createMany: vi.fn() },
    order: { count: vi.fn() },
    user: { findUnique: vi.fn() },
    // Die Admin-Wache liest die Pflicht „erst Passkey“ (tests/admin-sitzung.ts).
    ...(await import('./admin-sitzung')).passkeyAttrappen(),
    $executeRaw: vi.fn(async () => 1),
  }
  // Rückruf mit dem Client selbst als Transaktions-Client, Liste nacheinander erfüllt.
  prisma.$transaction = vi.fn(async (arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[]),
  )
  return { prisma }
})

import { updateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { addPickupSlot, deletePickupSlot, setPause, togglePickupSlotActive, updateProfile } from '@/server/actions/farm'
import {
  addFarmPhotoAction,
  deleteFarmPhotoAction,
  moveFarmPhotoAction,
  reorderPhotosAction,
  updateFarmPhotoCaptionAction,
} from '@/server/actions/farm-photos'
import { archiveFarm, reactivateFarm } from '@/server/actions/farm-archive'
import { saveAppearanceAction, updateFarmBannerAction } from '@/server/actions/appearance'
import { revokeFarmApprovalAction } from '@/server/actions/admin'
import { adminSitzung } from './admin-sitzung'

type Fn = ReturnType<typeof vi.fn>
const db = prisma as unknown as {
  farm: { findUnique: Fn; update: Fn }
  pickupSlot: { findMany: Fn; create: Fn; deleteMany: Fn; updateMany: Fn }
  farmPhoto: { count: Fn; create: Fn; findUnique: Fn; findMany: Fn; update: Fn; delete: Fn }
  order: { count: Fn }
  user: { findUnique: Fn }
  $transaction: Fn
}
const tag = vi.mocked(updateTag)

const HOF = 'hof_a'
const SCHLUESSEL = 'vercel_blob_rw_SPEICHERA_geheimnisNurFuerTests'
const EIGENES_FOTO = `https://speichera.public.blob.vercel-storage.com/farms/${HOF}/gallery/eins.webp`

const PROFIL = {
  name: 'Testhof A',
  ownerName: 'Max Mustermann',
  description: 'Gemüse und Eier aus eigener Haltung.',
  address: 'Dorfstraße 1',
  postalCode: '1234',
  city: 'Musterdorf',
  phone: '+43 660 000 0000',
  email: 'testhof-a@example.com',
  country: 'AT' as const,
  latitude: null,
  longitude: null,
  betriebsnummer: null,
  betriebsstatus: null,
}

/** Je Action: der Aufruf bis zum Erfolg und der Aufruf, der schreibt (updateTag muss danach kommen). */
const SCHREIBER: Array<[string, () => Promise<unknown>, () => Fn]> = [
  ['updateProfile', () => updateProfile(PROFIL), () => db.farm.update],
  ['addPickupSlot', () => addPickupSlot({ dayOfWeek: 6, startTime: '09:00', endTime: '12:00', maxOrders: null }), () => db.pickupSlot.create],
  ['deletePickupSlot', () => deletePickupSlot('slot_a'), () => db.pickupSlot.deleteMany],
  ['togglePickupSlotActive', () => togglePickupSlotActive('slot_a', false), () => db.pickupSlot.updateMany],
  ['setPause', () => setPause(true, 'Urlaub bis Montag'), () => db.farm.update],
  ['addFarmPhotoAction', () => addFarmPhotoAction({ url: EIGENES_FOTO }), () => db.farmPhoto.create],
  ['deleteFarmPhotoAction', () => deleteFarmPhotoAction('foto_a'), () => db.farmPhoto.update],
  ['reorderPhotosAction', () => reorderPhotosAction(['foto_b', 'foto_a']), () => db.$transaction],
  ['moveFarmPhotoAction', () => moveFarmPhotoAction('foto_a', 'down'), () => db.$transaction],
  ['archiveFarm', () => archiveFarm(), () => db.farm.update],
  ['reactivateFarm', () => reactivateFarm(), () => db.$transaction],
  ['saveAppearanceAction', () => saveAppearanceAction({ tagline: 'Frisch vom Feld' }), () => db.$transaction],
  ['updateFarmBannerAction', () => updateFarmBannerAction('GRADIENT', null), () => db.farm.update],
  ['revokeFarmApprovalAction', () => revokeFarmApprovalAction(HOF), () => db.farm.update],
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', SCHLUESSEL)
  // Eine Sitzung für beide Seiten: Inhaber von Testhof A und frisch bestätigter Admin.
  vi.mocked(auth.api.getSession).mockResolvedValue(adminSitzung('nutzer_a') as never)
  db.user.findUnique.mockResolvedValue({ isAdmin: true })
  db.farm.findUnique.mockResolvedValue({ id: HOF, slug: 'testhof-a', ...PROFIL, pauseMessage: null, archivedAt: null, bannerUrl: null, logoUrl: null })
  db.farm.update.mockResolvedValue({})
  db.pickupSlot.findMany.mockResolvedValue([])
  db.pickupSlot.create.mockResolvedValue({})
  db.pickupSlot.deleteMany.mockResolvedValue({ count: 1 })
  db.pickupSlot.updateMany.mockResolvedValue({ count: 1 })
  db.farmPhoto.count.mockResolvedValue(0)
  db.farmPhoto.create.mockResolvedValue({ id: 'foto_a', url: EIGENES_FOTO, caption: null, sortOrder: 0 })
  db.farmPhoto.findUnique.mockResolvedValue({ farmId: HOF, url: 'https://beispiel.at/kein-blob.webp' })
  db.farmPhoto.findMany.mockResolvedValue([{ id: 'foto_a' }, { id: 'foto_b' }])
  db.farmPhoto.update.mockResolvedValue({})
  db.farmPhoto.delete.mockResolvedValue({})
  db.order.count.mockResolvedValue(0)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Hofliste sofort erneuern — jede Action, die etwas schreibt, das die Liste zeigt', () => {
  it.each(SCHREIBER)('%s ruft updateTag(HOEFE_CACHE_TAG) nach dem Schreiben', async (_name, rufe, schreiben) => {
    const ergebnis = await rufe()

    expect(ergebnis).not.toHaveProperty('error')
    expect(tag).toHaveBeenCalledWith(HOEFE_CACHE_TAG)
    const zuletztGeschrieben = Math.max(...schreiben().mock.invocationCallOrder)
    expect(Math.min(...tag.mock.invocationCallOrder)).toBeGreaterThan(zuletztGeschrieben)
  })

  it('Gegenprobe: die Bildunterschrift schreibt, erneuert die Liste aber nicht (sie liest keine Unterschrift)', async () => {
    expect(await updateFarmPhotoCaptionAction('foto_a', 'Unser Hofladen')).toEqual({})
    expect(db.farmPhoto.update).toHaveBeenCalledTimes(1)
    expect(tag).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ohne Anmeldung schreibt keine Action und erneuert nichts', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    for (const [name, rufe] of SCHREIBER) {
      expect(await rufe(), name).toHaveProperty('error')
    }
    expect(tag).not.toHaveBeenCalled()
  })
})

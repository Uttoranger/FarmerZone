/**
 * Tests für die Abholzeiten-Duplikatsperre (src/lib/pickup-slot-rules.ts +
 * addPickupSlot / createOnboardingSlots).
 *
 * Beweist: exaktes Duplikat → abgelehnt mit deutscher Meldung; gleicher Tag,
 * andere Zeit → erlaubt; Ownership-Verweigerung unverändert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/email', () => ({}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    pickupSlot: { findMany: vi.fn(), create: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    product: { createMany: vi.fn() },
    user: { update: vi.fn() },
  },
}))

import { isDuplicateSlot, hasDuplicateSlots, DUPLICATE_SLOT_MESSAGE } from '@/lib/pickup-slot-rules'
import { addPickupSlot } from '@/server/actions/farm'
import { createOnboardingSlots } from '@/server/actions/onboarding'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const getSession = vi.mocked(auth.api.getSession)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const slotFindMany = vi.mocked(prisma.pickupSlot.findMany)
const slotCreate = vi.mocked(prisma.pickupSlot.create)
const slotCreateMany = vi.mocked(prisma.pickupSlot.createMany)

const SA_VORMITTAG = { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' }
const SA_NACHMITTAG = { dayOfWeek: 6, startTime: '15:00', endTime: '17:00' }

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmFindUnique.mockResolvedValue({ id: 'farm_1', slug: 'testhof' } as never)
  slotFindMany.mockResolvedValue([SA_VORMITTAG] as never)
  slotCreate.mockResolvedValue({} as never)
  slotCreateMany.mockResolvedValue({ count: 1 } as never)
})

describe('Regel-Helfer', () => {
  it('erkennt nur exakte Dubletten', () => {
    expect(isDuplicateSlot([SA_VORMITTAG], SA_VORMITTAG)).toBe(true)
    expect(isDuplicateSlot([SA_VORMITTAG], SA_NACHMITTAG)).toBe(false)
    expect(isDuplicateSlot([SA_VORMITTAG], { ...SA_VORMITTAG, dayOfWeek: 3 })).toBe(false)
    expect(isDuplicateSlot([SA_VORMITTAG], { ...SA_VORMITTAG, endTime: '13:00' })).toBe(false)
  })

  it('prüft Batches auch untereinander', () => {
    expect(hasDuplicateSlots([], [SA_VORMITTAG, SA_VORMITTAG])).toBe(true)
    expect(hasDuplicateSlots([], [SA_VORMITTAG, SA_NACHMITTAG])).toBe(false)
    expect(hasDuplicateSlots([SA_VORMITTAG], [SA_NACHMITTAG])).toBe(false)
  })
})

describe('addPickupSlot (Einstellungen)', () => {
  it('lehnt ein exaktes Duplikat mit deutscher Meldung ab, ohne zu schreiben', async () => {
    const result = await addPickupSlot({ ...SA_VORMITTAG, maxOrders: null })
    expect(result.error).toBe(DUPLICATE_SLOT_MESSAGE)
    expect(slotCreate).not.toHaveBeenCalled()
  })

  it('erlaubt ein zweites Fenster am selben Tag', async () => {
    const result = await addPickupSlot({ ...SA_NACHMITTAG, maxOrders: null })
    expect(result).toEqual({})
    expect(slotCreate).toHaveBeenCalledTimes(1)
  })

  it('Ownership unverändert: ohne Session keine Anlage', async () => {
    getSession.mockResolvedValue(null as never)
    const result = await addPickupSlot({ ...SA_NACHMITTAG, maxOrders: null })
    expect(result.error).toBe('Nicht angemeldet')
    expect(slotCreate).not.toHaveBeenCalled()
  })
})

describe('createOnboardingSlots (Onboarding, dieselbe Prüfung)', () => {
  it('lehnt Duplikate gegen den Bestand ab', async () => {
    const result = await createOnboardingSlots('farm_1', [SA_VORMITTAG])
    expect('error' in result && result.error).toBe(DUPLICATE_SLOT_MESSAGE)
    expect(slotCreateMany).not.toHaveBeenCalled()
  })

  it('lehnt Duplikate innerhalb des Aufrufs ab', async () => {
    slotFindMany.mockResolvedValue([] as never)
    const result = await createOnboardingSlots('farm_1', [SA_NACHMITTAG, SA_NACHMITTAG])
    expect('error' in result && result.error).toBe(DUPLICATE_SLOT_MESSAGE)
    expect(slotCreateMany).not.toHaveBeenCalled()
  })

  it('erlaubt verschiedene Fenster am selben Tag', async () => {
    slotFindMany.mockResolvedValue([] as never)
    const result = await createOnboardingSlots('farm_1', [SA_VORMITTAG, SA_NACHMITTAG])
    expect(result).toEqual({ ok: true })
    expect(slotCreateMany).toHaveBeenCalledTimes(1)
  })

  it('Ownership unverändert: fremde Farm wird verweigert', async () => {
    farmFindUnique.mockResolvedValue(null)
    const result = await createOnboardingSlots('fremde_farm', [SA_NACHMITTAG])
    expect('error' in result && result.error).toBe('Hof nicht gefunden.')
    expect(slotCreateMany).not.toHaveBeenCalled()
  })
})

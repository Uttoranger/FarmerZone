/**
 * Tests für die Abholzeiten-Regeln (src/lib/pickup-slot-rules.ts +
 * addPickupSlot / createOnboardingSlots).
 *
 * Beweist: exaktes Duplikat → abgelehnt mit deutscher Meldung; invertiertes
 * Fenster (Bis <= Von) → abgelehnt; Überschneidung mit aktivem Fenster
 * desselben Tages → abgelehnt (Meldung benennt das betroffene Fenster);
 * Angrenzen und gleiche Zeit an anderem Wochentag → erlaubt;
 * Ownership-Verweigerung unverändert.
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

import {
  isDuplicateSlot,
  hasDuplicateSlots,
  isInvertedSlot,
  findOverlappingSlot,
  overlapMessage,
  findSlotError,
  findBatchSlotError,
  DUPLICATE_SLOT_MESSAGE,
  INVERTED_SLOT_MESSAGE,
} from '@/lib/pickup-slot-rules'
import { addPickupSlot, togglePickupSlotActive } from '@/server/actions/farm'
import { createOnboardingSlots } from '@/server/actions/onboarding'
import { getPublicFarm, getOwnerFarm } from '@/server/queries/farm'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const getSession = vi.mocked(auth.api.getSession)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const slotFindMany = vi.mocked(prisma.pickupSlot.findMany)
const slotCreate = vi.mocked(prisma.pickupSlot.create)
const slotCreateMany = vi.mocked(prisma.pickupSlot.createMany)
const slotUpdateMany = vi.mocked(prisma.pickupSlot.updateMany)

const SA_VORMITTAG = { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' }
const SA_NACHMITTAG = { dayOfWeek: 6, startTime: '15:00', endTime: '17:00' }
// Bestand, wie ihn die Actions jetzt laden (inkl. isActive)
const BESTAND = [{ ...SA_VORMITTAG, isActive: true }]

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmFindUnique.mockResolvedValue({ id: 'farm_1', slug: 'testhof' } as never)
  slotFindMany.mockResolvedValue(BESTAND as never)
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

describe('Zeitlogik-Helfer', () => {
  it('erkennt invertierte Fenster (Bis <= Von, String-Vergleich bei HH:MM)', () => {
    expect(isInvertedSlot({ startTime: '12:00', endTime: '09:00' })).toBe(true)
    expect(isInvertedSlot({ startTime: '12:00', endTime: '12:00' })).toBe(true)
    expect(isInvertedSlot({ startTime: '09:00', endTime: '12:00' })).toBe(false)
  })

  it('findet echte Überschneidungen am selben Wochentag', () => {
    // teilweise überlappend
    expect(
      findOverlappingSlot([SA_VORMITTAG], { dayOfWeek: 6, startTime: '11:00', endTime: '13:00' })
    ).toEqual(SA_VORMITTAG)
    // Kandidat umschließt das Bestandsfenster komplett
    expect(
      findOverlappingSlot([SA_VORMITTAG], { dayOfWeek: 6, startTime: '08:00', endTime: '13:00' })
    ).toEqual(SA_VORMITTAG)
    // Bestandsfenster umschließt den Kandidaten komplett
    expect(
      findOverlappingSlot([SA_VORMITTAG], { dayOfWeek: 6, startTime: '10:00', endTime: '11:00' })
    ).toEqual(SA_VORMITTAG)
  })

  it('erlaubt Angrenzen (Bis == Von des nächsten) in beide Richtungen', () => {
    expect(
      findOverlappingSlot([SA_VORMITTAG], { dayOfWeek: 6, startTime: '12:00', endTime: '14:00' })
    ).toBeNull()
    expect(
      findOverlappingSlot([SA_VORMITTAG], { dayOfWeek: 6, startTime: '07:00', endTime: '09:00' })
    ).toBeNull()
  })

  it('erlaubt dasselbe Fenster an einem anderen Wochentag', () => {
    expect(
      findOverlappingSlot([SA_VORMITTAG], { ...SA_VORMITTAG, dayOfWeek: 3 })
    ).toBeNull()
  })

  it('benennt das betroffene Fenster in der Meldung', () => {
    expect(overlapMessage(SA_VORMITTAG)).toBe('Überschneidet sich mit Samstag 09:00–12:00.')
    expect(overlapMessage({ dayOfWeek: 1, startTime: '14:00', endTime: '16:30' })).toBe(
      'Überschneidet sich mit Montag 14:00–16:30.'
    )
  })

  it('findSlotError: Reihenfolge invertiert → Dublette → Überschneidung', () => {
    const ctx = { all: [SA_VORMITTAG], active: [SA_VORMITTAG] }
    expect(
      findSlotError({ dayOfWeek: 6, startTime: '12:00', endTime: '09:00' }, ctx)
    ).toBe(INVERTED_SLOT_MESSAGE)
    // exakte Dublette behält ihren eigenen Wortlaut, obwohl sie auch überlappt
    expect(findSlotError(SA_VORMITTAG, ctx)).toBe(DUPLICATE_SLOT_MESSAGE)
    expect(
      findSlotError({ dayOfWeek: 6, startTime: '11:00', endTime: '13:00' }, ctx)
    ).toBe('Überschneidet sich mit Samstag 09:00–12:00.')
    expect(
      findSlotError({ dayOfWeek: 6, startTime: '12:00', endTime: '14:00' }, ctx)
    ).toBeNull()
  })

  it('findSlotError: inaktive Fenster zählen nur für die Dublette, nicht für die Überschneidung', () => {
    const ctx = { all: [SA_VORMITTAG], active: [] }
    expect(
      findSlotError({ dayOfWeek: 6, startTime: '11:00', endTime: '13:00' }, ctx)
    ).toBeNull()
    expect(findSlotError(SA_VORMITTAG, ctx)).toBe(DUPLICATE_SLOT_MESSAGE)
  })

  it('findBatchSlotError: Kandidaten schneiden sich auch untereinander nicht', () => {
    const leer = { all: [], active: [] }
    expect(
      findBatchSlotError(
        [
          { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' },
          { dayOfWeek: 6, startTime: '11:00', endTime: '13:00' },
        ],
        leer
      )
    ).toBe('Überschneidet sich mit Samstag 09:00–12:00.')
    // angrenzend und anderer Wochentag: erlaubt
    expect(
      findBatchSlotError(
        [
          { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' },
          { dayOfWeek: 6, startTime: '12:00', endTime: '14:00' },
          { dayOfWeek: 3, startTime: '09:00', endTime: '12:00' },
        ],
        leer
      )
    ).toBeNull()
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

  it('lehnt ein invertiertes Fenster ab (Bis vor Von)', async () => {
    const result = await addPickupSlot({
      dayOfWeek: 2, startTime: '16:00', endTime: '14:00', maxOrders: null,
    })
    expect(result.error).toBe(INVERTED_SLOT_MESSAGE)
    expect(slotCreate).not.toHaveBeenCalled()
  })

  it('lehnt ein überlappendes Fenster ab und benennt das betroffene', async () => {
    const result = await addPickupSlot({
      dayOfWeek: 6, startTime: '10:00', endTime: '11:00', maxOrders: null,
    })
    expect(result.error).toBe('Überschneidet sich mit Samstag 09:00–12:00.')
    expect(slotCreate).not.toHaveBeenCalled()
  })

  it('erlaubt ein angrenzendes Fenster (Bis == Von des nächsten)', async () => {
    const result = await addPickupSlot({
      dayOfWeek: 6, startTime: '12:00', endTime: '14:00', maxOrders: null,
    })
    expect(result).toEqual({})
    expect(slotCreate).toHaveBeenCalledTimes(1)
  })

  it('erlaubt dieselbe Zeit an einem anderen Wochentag', async () => {
    const result = await addPickupSlot({ ...SA_VORMITTAG, dayOfWeek: 3, maxOrders: null })
    expect(result).toEqual({})
    expect(slotCreate).toHaveBeenCalledTimes(1)
  })

  it('inaktives Bestandsfenster blockiert die Überschneidung nicht', async () => {
    slotFindMany.mockResolvedValue([{ ...SA_VORMITTAG, isActive: false }] as never)
    const result = await addPickupSlot({
      dayOfWeek: 6, startTime: '10:00', endTime: '11:00', maxOrders: null,
    })
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

  it('lehnt invertierte Fenster ab', async () => {
    slotFindMany.mockResolvedValue([] as never)
    const result = await createOnboardingSlots('farm_1', [
      { dayOfWeek: 1, startTime: '17:00', endTime: '14:00' },
    ])
    expect('error' in result && result.error).toBe(INVERTED_SLOT_MESSAGE)
    expect(slotCreateMany).not.toHaveBeenCalled()
  })

  it('lehnt Überschneidungen mit dem Bestand ab (komplett umschließend)', async () => {
    const result = await createOnboardingSlots('farm_1', [
      { dayOfWeek: 6, startTime: '08:00', endTime: '13:00' },
    ])
    expect('error' in result && result.error).toBe('Überschneidet sich mit Samstag 09:00–12:00.')
    expect(slotCreateMany).not.toHaveBeenCalled()
  })

  it('lehnt Überschneidungen innerhalb des Aufrufs ab', async () => {
    slotFindMany.mockResolvedValue([] as never)
    const result = await createOnboardingSlots('farm_1', [
      { dayOfWeek: 2, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 2, startTime: '11:00', endTime: '13:00' },
    ])
    expect('error' in result && result.error).toBe('Überschneidet sich mit Dienstag 09:00–12:00.')
    expect(slotCreateMany).not.toHaveBeenCalled()
  })

  it('erlaubt angrenzende Fenster und gleiche Zeiten an anderen Wochentagen', async () => {
    const result = await createOnboardingSlots('farm_1', [
      { dayOfWeek: 6, startTime: '12:00', endTime: '14:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '12:00' },
    ])
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

describe('togglePickupSlotActive (Aktiv ⇄ Pausiert)', () => {
  it('persistiert isActive und scoped auf die eigene Farm (Ownership)', async () => {
    slotUpdateMany.mockResolvedValue({ count: 1 } as never)
    const result = await togglePickupSlotActive('slot_1', false)
    expect(result).toEqual({})
    expect(slotUpdateMany).toHaveBeenCalledWith({
      where: { id: 'slot_1', farmId: 'farm_1' },
      data: { isActive: false },
    })
  })

  it('reaktiviert genauso (isActive: true)', async () => {
    slotUpdateMany.mockResolvedValue({ count: 1 } as never)
    await togglePickupSlotActive('slot_1', true)
    expect(slotUpdateMany).toHaveBeenCalledWith({
      where: { id: 'slot_1', farmId: 'farm_1' },
      data: { isActive: true },
    })
  })

  it('ohne Session keine Änderung', async () => {
    getSession.mockResolvedValue(null as never)
    const result = await togglePickupSlotActive('slot_1', false)
    expect(result.error).toBe('Nicht angemeldet')
    expect(slotUpdateMany).not.toHaveBeenCalled()
  })
})

describe('Kundensicht lädt nur aktive Abholzeiten (Tageskarten/Checkout-Quelle)', () => {
  it('getPublicFarm filtert pickupSlots auf isActive: true', async () => {
    farmFindUnique.mockResolvedValue(null)
    await getPublicFarm('testhof')
    const arg = farmFindUnique.mock.calls[0]?.[0] as {
      select?: { pickupSlots?: { where?: unknown } }
    }
    expect(arg?.select?.pickupSlots?.where).toEqual({ isActive: true })
  })

  it('getOwnerFarm (Vorschau) filtert ebenso', async () => {
    farmFindUnique.mockResolvedValue(null)
    await getOwnerFarm('user_1')
    const arg = farmFindUnique.mock.calls[0]?.[0] as {
      select?: { pickupSlots?: { where?: unknown } }
    }
    expect(arg?.select?.pickupSlots?.where).toEqual({ isActive: true })
  })
})

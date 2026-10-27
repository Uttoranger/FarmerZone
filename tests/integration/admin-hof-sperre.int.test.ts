/**
 * Admin-Sperre eines Hofs (Register N34, Nachtlauf Nr. 187) gegen ein ECHTES
 * Postgres — mit echter Admin-Anmeldung (Passkey frisch) und den echten Routen.
 *
 * Beweist:
 *  - sperreHof setzt die Sperre, schreibt das Protokoll (Art, Bezug, Grund,
 *    mit Passkey) und legt dem Hof eine SYSTEM-Nachricht ins Postfach;
 *  - gesperrt lehnen alle Wege, die Halte anlegen oder bestellen, mit dem
 *    neutralen Satz ab: /api/reserve (409), /api/warenkorb/pruefen (Halt
 *    gelöscht, Satz in der Meldung) und /api/checkout (409, keine Bestellung,
 *    kein Bestand gebucht);
 *  - der Hof kann die Sperre nicht aufheben: setPause(false) mit seiner eigenen
 *    Sitzung lässt sie stehen;
 *  - hebeHofSperreAuf → wieder kaufbar (Reservieren und bar bestellen gehen).
 *
 * Alles trägt das Präfix int- (raeumeAuf); die Protokollzeilen räumt der Test
 * selbst ab (AdminAktion hat keinen Fremdschlüssel). Stripe und Mail gestellt.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn(), sendFreischaltungEmail: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } } }))

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { POST as reserve } from '@/app/api/reserve/route'
import { POST as pruefen } from '@/app/api/warenkorb/pruefen/route'
import { POST as checkout } from '@/app/api/checkout/route'
import { sperreHof, hebeHofSperreAuf } from '@/server/actions/admin-hof'
import { setPause } from '@/server/actions/farm'
import { HOF_GESPERRT_SATZ } from '@/lib/bereiche-anzeige'
import { checkoutAnfrage, erstelleHof, erstelleHofMitAnmeldung, erstelleProdukt, intKennung, machePasskeyAdmin, raeumeAuf, setzeHalt } from './setup/basis'

const bezuege: string[] = []

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  await prisma.adminAktion.deleteMany({ where: { bezugArt: 'hof', bezugId: { in: bezuege.splice(0) } } })
  await raeumeAuf()
})

function anfrage(pfad: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${pfad}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

async function alsAdmin(): Promise<string> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung()
  await machePasskeyAdmin(ownerId)
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return ownerId
}

describe('Admin-Sperre gegen die echte Datenbank und die echten Routen', () => {
  it('gesperrt: Protokoll und Postfach; reserve, warenkorb/pruefen und checkout lehnen mit dem Satz ab; aufgehoben → wieder kaufbar', async () => {
    const adminId = await alsAdmin()
    const { farm } = await erstelleHof()
    bezuege.push(farm.id)
    const eier = await erstelleProdukt(farm.id, { stock: 10 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(eier.id, sitzung, 2)

    expect(await sperreHof({ farmId: farm.id, grund: 'Beschwerden klären' })).toEqual({ ok: true })

    const hof = await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })
    expect(hof.adminGesperrtAm).not.toBeNull()
    expect(hof.adminSperrGrund).toBe('Beschwerden klären')
    expect(hof.adminGesperrtVonUserId).toBe(adminId)
    expect(hof.isPaused).toBe(false)
    const eintraege = await prisma.adminAktion.findMany({ where: { bezugArt: 'hof', bezugId: farm.id } })
    expect(eintraege.map((e) => [e.art, e.wer, e.grund, e.mitPasskey])).toEqual([['hof_gesperrt', adminId, 'Beschwerden klären', true]])
    const nachricht = await prisma.nachricht.findFirstOrThrow({ where: { unterhaltung: { farmId: farm.id } } })
    expect(nachricht.art).toBe('SYSTEM')
    expect(nachricht.vonFarmId).toBeNull()
    expect(nachricht.text).toContain('Beschwerden klären')

    // /api/reserve
    const res1 = await reserve(anfrage('/api/reserve', { productId: eier.id, quantity: 1, sessionId: intKennung('sitzung') }))
    expect(res1.status).toBe(409)
    expect((await res1.json()).error).toBe(HOF_GESPERRT_SATZ)

    // /api/warenkorb/pruefen: kein Halt erneuert, der Halt der Sitzung fällt, der Satz steht in der Meldung.
    const res2 = await pruefen(anfrage('/api/warenkorb/pruefen', { sessionId: sitzung, items: [{ productId: eier.id, quantity: 2 }] }))
    const body2 = await res2.json()
    expect(body2.meldung).toContain(HOF_GESPERRT_SATZ)
    expect(body2.items).toEqual([])
    expect(await prisma.stockReservation.count({ where: { sessionId: sitzung } })).toBe(0)

    // /api/checkout: 409, keine Bestellung, kein Bestand gebucht.
    const kasse = intKennung('sitzung')
    await setzeHalt(eier.id, kasse, 2)
    const res3 = await checkout(
      checkoutAnfrage({ farm, sessionId: kasse, paymentMethod: 'ONSITE_CASH', positionen: [{ productId: eier.id, name: 'Testprodukt', quantity: 2, unitPrice: 10 }] })
    )
    expect(res3.status).toBe(409)
    expect((await res3.json()).error).toBe(HOF_GESPERRT_SATZ)
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(0)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: eier.id } })).stock).toBe(10)

    // Aufheben → wieder kaufbar.
    expect(await hebeHofSperreAuf({ farmId: farm.id })).toEqual({ ok: true })
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).adminGesperrtAm).toBeNull()
    const res4 = await reserve(anfrage('/api/reserve', { productId: eier.id, quantity: 1, sessionId: intKennung('sitzung') }))
    expect(res4.status).toBe(200)
    const res5 = await checkout(
      checkoutAnfrage({ farm, sessionId: kasse, paymentMethod: 'ONSITE_CASH', positionen: [{ productId: eier.id, name: 'Testprodukt', quantity: 2, unitPrice: 10 }] })
    )
    expect(res5.status).toBe(200)
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(1)
    expect((await prisma.adminAktion.findMany({ where: { bezugArt: 'hof', bezugId: farm.id }, orderBy: { wann: 'asc' } })).map((e) => e.art)).toEqual([
      'hof_gesperrt',
      'hof_sperre_aufgehoben',
    ])
  })

  it('der Hof kann die Sperre nicht aufheben: setPause(false) mit seiner Sitzung lässt sie stehen', async () => {
    await alsAdmin()
    const { farm, cookie } = await erstelleHofMitAnmeldung()
    bezuege.push(farm.id)
    expect(await sperreHof({ farmId: farm.id, grund: 'Beschwerden klären' })).toEqual({ ok: true })

    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
    expect(await setPause(false, '')).toEqual({})
    // Gegenprobe: Der Hof ist kein Admin — die Action des Teams lehnt ihn ab.
    expect(await hebeHofSperreAuf({ farmId: farm.id })).toHaveProperty('error')

    const hof = await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })
    expect(hof.adminGesperrtAm).not.toBeNull()
    expect(hof.isPaused).toBe(false)
  })
})

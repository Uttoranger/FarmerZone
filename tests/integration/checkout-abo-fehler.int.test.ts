/**
 * Scheitert das Speichern des Abos im Checkout (Double-Opt-in, Nr. 38,
 * Nachbesserung Runde 1), steht die Bestellung trotzdem — echte Datenbank.
 *
 * Beweist: Antwort 200, Bestellung angelegt, Sentry bekommt nur einen festen
 * Text, Tags und die Bestell-ID — nie die Adresse, auch wenn der
 * ursprüngliche Fehlertext sie trägt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }))

vi.mock('@sentry/nextjs', async (original) => ({
  ...(await original<typeof import('@sentry/nextjs')>()),
  captureException: sentry.captureException,
}))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn(), sendAboBestaetigung: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))
vi.mock('@/server/abo-anmeldung', async (original) => ({
  ...(await original<typeof import('@/server/abo-anmeldung')>()),
  meldeEmailAboAn: vi.fn(),
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { meldeEmailAboAn } from '@/server/abo-anmeldung'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await raeumeAuf()
})

async function bestelleMitHaken(email: string): Promise<{ res: Response; farmId: string }> {
  const { farm } = await erstelleHof()
  const produkt = await erstelleProdukt(farm.id, { stock: 5 })
  const sitzung = intKennung('sitzung')
  await setzeHalt(produkt.id, sitzung, 1)
  const res = await checkout(
    checkoutAnfrage({
      farm,
      sessionId: sitzung,
      customerEmail: email,
      positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
      zusatz: { optInEmail: true },
    })
  )
  return { res, farmId: farm.id }
}

function sentryOhneAdresse(email: string): void {
  expect(sentry.captureException).toHaveBeenCalledOnce()
  const [fehler, kontext] = sentry.captureException.mock.calls[0]!
  expect((fehler as Error).message).toBe('Abo im Checkout nicht gespeichert')
  expect(JSON.stringify(kontext)).not.toContain(email)
  expect(JSON.stringify({ message: (fehler as Error).message, name: (fehler as Error).name })).not.toContain(email)
  expect(kontext).toMatchObject({ tags: { aufgabe: 'checkout', grund: 'abo_nicht_gespeichert' } })
}

describe('Checkout: Fehler beim Abo kippt die Bestellung nicht', () => {
  it('meldeEmailAboAn wirft → 200, Bestellung steht, Sentry ohne Adresse', async () => {
    const email = `${intKennung('kundin')}@example.com`
    vi.mocked(meldeEmailAboAn).mockRejectedValueOnce(new Error(`Verbindung weg bei ${email}`))

    const { res, farmId } = await bestelleMitHaken(email)

    expect(res.status).toBe(200)
    expect(await prisma.order.count({ where: { farmId, customerEmail: email } })).toBe(1)
    sentryOhneAdresse(email)
  })

  it('das Speichern des Abos (upsert) wirft → 200, Bestellung steht, Sentry ohne Adresse', async () => {
    const email = `${intKennung('kundin')}@example.com`
    vi.spyOn(prisma.customerFarmSubscription, 'upsert').mockRejectedValueOnce(new Error(`Unique constraint ${email}`))

    const { res, farmId } = await bestelleMitHaken(email)

    expect(res.status).toBe(200)
    expect(await prisma.order.count({ where: { farmId, customerEmail: email } })).toBe(1)
    expect(vi.mocked(meldeEmailAboAn)).not.toHaveBeenCalled()
    sentryOhneAdresse(email)
  })
})

/**
 * „Erneut versuchen" nach gescheiterter Zahlung (Audit A3, Nr. 202) in der
 * echten Datenbank: Der Knopf der Bestätigungsseite führt in die Zahlung
 * DERSELBEN Bestellung — derselbe PaymentIntent, keine zweite Bestellung,
 * keine zweite Reservierung, der Bestand bleibt, wie er nach dem ersten
 * Abschicken war. Ist die Frist vorbei, führt er in die Kasse (den Korb hält
 * der Browser, die Bestätigungsseite hat ihn nicht geleert).
 *
 * Echt sind Datenbank, Checkout-Handler, Freigabe verwaister Bestellungen und
 * die Kassen-Seite. Gemockt sind Stripe (kein Netz, kein Geld), Mail, Sentry,
 * die Sitzung (Gast) und Nexts Weiterleitung.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn(), sendBestellungVerfallen: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() } },
}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => null) } } }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  redirect: (ziel: string) => {
    throw new Error(`REDIRECT:${ziel}`)
  },
}))

import type { ReactElement } from 'react'
import { POST as checkout } from '@/app/api/checkout/route'
import CheckoutPage from '@/app/(public)/[farmSlug]/checkout/page'
import { CheckoutForm, ZahlungFortsetzen } from '@/components/checkout/checkout-form'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { bestellSignatur } from '@/lib/bestell-link'
import { ZAHLUNGSFRIST_ONLINE_MINUTEN } from '@/lib/fristen'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

const anlegen = vi.mocked(stripe.paymentIntents.create)
const abrufen = vi.mocked(stripe.paymentIntents.retrieve)

const BESTAND = 5
const MENGE = 2
const INTENT = 'pi_int_erneut'
const SECRET = `${INTENT}_secret_beispiel`

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await raeumeAuf()
})

/** Online bestellt, Zahlung gescheitert (der Webhook schreibt FAILED, die Bestellung bleibt offen). */
async function gescheiterteZahlung() {
  const { farm } = await erstelleHof({ acceptsOnline: true, stripeAccountReady: true, stripeAccountId: intKennung('acct') })
  const produkt = await erstelleProdukt(farm.id, { stock: BESTAND, price: 10 })
  const sitzung = intKennung('sitzung')
  await setzeHalt(produkt.id, sitzung, MENGE)
  anlegen.mockResolvedValue({ id: INTENT, client_secret: SECRET, amount: 2000, status: 'requires_payment_method' } as never)

  const antwort = await checkout(
    checkoutAnfrage({
      farm,
      sessionId: sitzung,
      idempotencyKey: intKennung('idem'),
      paymentMethod: 'ONLINE',
      positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: MENGE, unitPrice: 10 }],
    })
  )
  expect(antwort.status).toBe(200)
  const { orderId } = await antwort.json()
  await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'FAILED' } })
  abrufen.mockResolvedValue({ id: INTENT, client_secret: SECRET, amount: 2000, status: 'requires_payment_method' } as never)
  return { farm, produkt, orderId: orderId as string }
}

/** Der Klick auf „Erneut versuchen": die Kasse mit Kennung und Signatur aus der Bestätigungsseite. */
function kasse(farmSlug: string, suche: Record<string, string>) {
  return CheckoutPage({ params: Promise.resolve({ farmSlug }), searchParams: Promise.resolve(suche) }) as Promise<ReactElement>
}

async function stand(farmId: string, produktId: string) {
  return {
    bestellungen: await prisma.order.count({ where: { farmId } }),
    halte: await prisma.stockReservation.count({ where: { productId: produktId } }),
    bestand: (await prisma.product.findUniqueOrThrow({ where: { id: produktId } })).stock,
  }
}

describe('„Erneut versuchen" zahlt dieselbe Bestellung', () => {
  it('derselbe PaymentIntent, keine neue Bestellung, keine neue Reservierung, Bestand unverändert', async () => {
    const { farm, produkt, orderId } = await gescheiterteZahlung()
    const vorher = await stand(farm.id, produkt.id)
    expect(vorher).toEqual({ bestellungen: 1, halte: 0, bestand: BESTAND - MENGE })

    const seite = await kasse(farm.slug, { zahlung: orderId, sig: bestellSignatur(orderId) })

    expect(seite.type).toBe(ZahlungFortsetzen)
    const props = seite.props as { zahlung: { clientSecret: string; bestaetigung: string; betrag: unknown }; positionen: unknown[] }
    expect(props.zahlung.clientSecret).toBe(SECRET)
    expect(props.zahlung.bestaetigung).toBe(`/${farm.slug}/confirm/${orderId}?sig=${bestellSignatur(orderId)}`)
    expect(props.zahlung.betrag).toEqual({ amountCents: 2000, serviceFeeCents: 0 })
    expect(props.positionen).toEqual([expect.objectContaining({ productId: produkt.id, quantity: MENGE, price: 10 })])
    // Gelesen, nicht neu angelegt: der gespeicherte Zahlungsvorgang der Bestellung.
    expect(abrufen).toHaveBeenCalledWith(INTENT)
    expect(anlegen).toHaveBeenCalledTimes(1)
    expect(await stand(farm.id, produkt.id)).toEqual(vorher)
  })

  it('Frist abgelaufen: in die Kasse (Korb aus dem Browser), die Ware ist frei, keine Zahlung derselben Bestellung', async () => {
    const { farm, produkt, orderId } = await gescheiterteZahlung()
    const frueher = new Date(Date.now() - (ZAHLUNGSFRIST_ONLINE_MINUTEN + 1) * 60_000)
    await prisma.order.update({ where: { id: orderId }, data: { createdAt: frueher } })

    const seite = await kasse(farm.slug, { zahlung: orderId, sig: bestellSignatur(orderId) })

    expect(seite.type).toBe(CheckoutForm)
    // Gelesen hat ihn nur die Freigabe (mit kurzer Leine), um ihn abzubrechen — nie die Kasse für eine Zahlung.
    expect(abrufen).not.toHaveBeenCalledWith(INTENT)
    // Frist gilt beim Lesen: Die Seite gab die verwaiste Bestellung vorher frei.
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: 'CANCELLED' })
    expect(await stand(farm.id, produkt.id)).toEqual({ bestellungen: 1, halte: 0, bestand: BESTAND })
  })

  it('ohne gültige Signatur: die Kasse wie immer — sie verrät nichts über die Bestellung', async () => {
    const { farm, orderId } = await gescheiterteZahlung()

    const fremd = await kasse(farm.slug, { zahlung: orderId, sig: bestellSignatur('andere-bestellung') })
    const ohne = await kasse(farm.slug, { zahlung: orderId })

    expect(fremd.type).toBe(CheckoutForm)
    expect(ohne.type).toBe(CheckoutForm)
    expect(abrufen).not.toHaveBeenCalled()
  })

  it('schon bezahlt (alter Knopf): zur Bestätigungsseite, die dann den Korb leert', async () => {
    const { farm, orderId } = await gescheiterteZahlung()
    await prisma.order.update({ where: { id: orderId }, data: { status: 'PAID', paymentStatus: 'PAID', paidAt: new Date() } })

    await expect(kasse(farm.slug, { zahlung: orderId, sig: bestellSignatur(orderId) })).rejects.toThrow(
      `REDIRECT:/${farm.slug}/confirm/${orderId}?sig=${bestellSignatur(orderId)}`
    )
    expect(abrufen).not.toHaveBeenCalled()
  })
})

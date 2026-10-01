/**
 * Integrationstest — `account.updated` hält `Farm.stripeAccountReady` aktuell.
 *
 * Vorher setzte nur das Onboarding den Wert. Sperrte Stripe ein Hof-Konto
 * später (fehlende Angaben, Prüfung), merkte die App es nicht: Der Checkout
 * bot Online weiter an, und jede Zahlung scheiterte erst bei Stripe.
 *
 * Connect-Events kommen über einen eigenen Endpunkt mit eigenem Secret an
 * dieselbe Route; sie prüft gegen beide. Echt sind Datenbank und
 * Signaturprüfung, signiert wird mit den Platzhalter-Secrets der
 * Integrationsschicht.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/stripe', async () => {
  const { default: Stripe } = await import('stripe')
  const echt = new Stripe('sk_test_integration_dummy')
  return { stripe: { webhooks: echt.webhooks, refunds: { create: vi.fn() } } }
})
vi.mock('@/lib/email', () => ({
  sendOrderConfirmation: vi.fn(),
  sendOrderPaidToFarmer: vi.fn(),
  sendZahlungZuSpaet: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/stripe/webhook/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { INTEGRATIONS_ENV } from './setup/integrations-umgebung'
import { erstelleHof, intKennung, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

function kontoEreignis(kontoId: string, konto: { charges_enabled: boolean; payouts_enabled: boolean }) {
  return {
    id: intKennung('evt'),
    object: 'event',
    type: 'account.updated',
    account: kontoId,
    data: { object: { id: kontoId, object: 'account', ...konto } },
  }
}

async function zustellen(ev: object, secret: string) {
  const koerper = JSON.stringify(ev)
  const signatur = stripe.webhooks.generateTestHeaderString({ payload: koerper, secret })
  return POST(
    new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signatur, 'content-type': 'application/json' },
      body: koerper,
    })
  )
}

async function hofMitKonto(bereit: boolean) {
  const kontoId = intKennung('acct')
  const { farm } = await erstelleHof({ acceptsOnline: true, stripeAccountId: kontoId, stripeAccountReady: bereit })
  return { farm, kontoId }
}

async function bereit(farmId: string) {
  return (await prisma.farm.findUniqueOrThrow({ where: { id: farmId } })).stripeAccountReady
}

const CONNECT = INTEGRATIONS_ENV.STRIPE_CONNECT_WEBHOOK_SECRET

describe('account.updated über den Connect-Endpunkt', () => {
  it('charges_enabled false → stripeAccountReady false', async () => {
    const { farm, kontoId } = await hofMitKonto(true)

    const antwort = await zustellen(kontoEreignis(kontoId, { charges_enabled: false, payouts_enabled: true }), CONNECT)

    expect(antwort.status).toBe(200)
    expect(await bereit(farm.id)).toBe(false)
  })

  it('payouts_enabled false → stripeAccountReady false', async () => {
    const { farm, kontoId } = await hofMitKonto(true)

    await zustellen(kontoEreignis(kontoId, { charges_enabled: true, payouts_enabled: false }), CONNECT)

    expect(await bereit(farm.id)).toBe(false)
  })

  it('beides wieder frei → stripeAccountReady true', async () => {
    const { farm, kontoId } = await hofMitKonto(false)

    await zustellen(kontoEreignis(kontoId, { charges_enabled: true, payouts_enabled: true }), CONNECT)

    expect(await bereit(farm.id)).toBe(true)
  })

  it('fremdes Konto: kein Hof betroffen, trotzdem 200', async () => {
    const { farm } = await hofMitKonto(true)

    const antwort = await zustellen(
      kontoEreignis(intKennung('acct-fremd'), { charges_enabled: false, payouts_enabled: false }),
      CONNECT
    )

    expect(antwort.status).toBe(200)
    expect(await bereit(farm.id)).toBe(true)
  })
})

describe('Signatur gegen beide Secrets', () => {
  it('mit dem Plattform-Secret signiert: wird ebenso verarbeitet', async () => {
    const { farm, kontoId } = await hofMitKonto(true)

    await zustellen(
      kontoEreignis(kontoId, { charges_enabled: false, payouts_enabled: false }),
      INTEGRATIONS_ENV.STRIPE_WEBHOOK_SECRET
    )

    expect(await bereit(farm.id)).toBe(false)
  })

  it('mit einem fremden Secret signiert: 400, nichts geändert', async () => {
    const { farm, kontoId } = await hofMitKonto(true)

    const antwort = await zustellen(
      kontoEreignis(kontoId, { charges_enabled: false, payouts_enabled: false }),
      'whsec_fremd_und_falsch'
    )

    expect(antwort.status).toBe(400)
    expect(await bereit(farm.id)).toBe(true)
  })
})

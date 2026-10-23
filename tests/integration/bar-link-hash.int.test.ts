/**
 * Integrationstest — Barbestätigung: Link nur als Hash, „Erneut senden"
 * (Register S17 Punkt 2, Nr. 151).
 *
 * Die Aussagen, in der echten Datenbank:
 *  - Der Checkout speichert nur den Hash des Tokens; der Token steht allein
 *    im Aufruf von `sendOnsiteConfirmation`.
 *  - Der Token aus der Mail bestätigt, der gespeicherte Wert als Token nicht.
 *  - Eine Bestellung von vor dem Deploy (Klartext gespeichert) bestätigt weiter.
 *  - „Erneut senden" ersetzt den Link: der alte gilt nicht mehr, der neue
 *    bestätigt. Von zwei gleichzeitigen Anforderungen schickt genau eine eine
 *    Mail — das entscheidet die Bedingung des Schreibens in Postgres, nicht
 *    der Code davor. Die vierte Anforderung am Tag schickt keine.
 *
 * Mail und Stripe sind gemockt; Bremse, Signatur und Fristfreigabe laufen echt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/email', () => ({
  sendOnsiteConfirmation: vi.fn(),
  sendOrderConfirmation: vi.fn(),
  sendOrderConfirmedToFarmer: vi.fn(),
}))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT:${ziel}`)
  }),
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { sendOnsiteConfirmation } from '@/lib/email'
import { bestellSignatur } from '@/lib/bestell-link'
import { BAR_LINK_ERNEUT_ANTWORT, barTokenHash } from '@/lib/bar-bestaetigung'
import { bestaetigeBarBestellung, sendeBarLinkErneut } from '@/server/actions/bar-bestaetigung'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

const mail = vi.mocked(sendOnsiteConfirmation)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await raeumeAuf()
})

/** Eine Barbestellung über /api/checkout — dazu der Token aus dem Mail-Aufruf. */
async function barBestellung(): Promise<{ orderId: string; token: string }> {
  const { farm } = await erstelleHof()
  const produkt = await erstelleProdukt(farm.id, { stock: 5 })
  const sitzung = intKennung('sitzung')
  await setzeHalt(produkt.id, sitzung, 1)
  const antwort = await checkout(
    checkoutAnfrage({
      farm,
      sessionId: sitzung,
      positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
    })
  )
  expect(antwort.status).toBe(200)
  const { orderId } = (await antwort.json()) as { orderId: string }
  await vi.waitFor(() => expect(mail).toHaveBeenCalledTimes(1))
  return { orderId, token: mail.mock.calls[0]![1] }
}

function tokenFormular(token: string): FormData {
  const daten = new FormData()
  daten.set('token', token)
  return daten
}

function erneutFormular(orderId: string): FormData {
  const daten = new FormData()
  daten.set('orderId', orderId)
  daten.set('sig', bestellSignatur(orderId))
  return daten
}

/** Bestätigen per Knopf: true = bestätigt (Weiterleitung zur Bestätigungsseite), sonst der Fehlersatz. */
async function bestaetige(token: string): Promise<true | string> {
  try {
    const stand = await bestaetigeBarBestellung({}, tokenFormular(token))
    return stand.error ?? 'keine Antwort'
  } catch (e) {
    const text = e instanceof Error ? e.message : ''
    if (text.startsWith('REDIRECT:') && text.includes('/confirm/')) return true
    throw e
  }
}

async function gespeichert(orderId: string) {
  return prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, confirmationToken: true } })
}

describe('Barbestätigung — nur der Hash in der Datenbank', () => {
  it('der Checkout speichert den Hash, nie den Token — Gegenprobe: der Hash gehört zum Token der Mail', async () => {
    const { orderId, token } = await barBestellung()

    const { confirmationToken } = await gespeichert(orderId)
    expect(confirmationToken).not.toBe(token)
    expect(confirmationToken).not.toContain(token)
    expect(confirmationToken).toBe(barTokenHash(token))
  })

  it('der gespeicherte Wert als Token eingegeben: ungültig; der Token aus der Mail bestätigt', async () => {
    const { orderId, token } = await barBestellung()
    const wert = (await gespeichert(orderId)).confirmationToken!

    expect(await bestaetige(wert)).toMatch(/gilt nicht mehr/)
    expect((await gespeichert(orderId)).status).toBe('PENDING_CONFIRMATION')

    expect(await bestaetige(token)).toBe(true)
    expect(await gespeichert(orderId)).toEqual({ status: 'CONFIRMED', confirmationToken: null })
  })

  it('eine Bestellung von vor dem Deploy (Klartext gespeichert) bestätigt weiter', async () => {
    const { orderId } = await barBestellung()
    const alt = `alt${intKennung('tok').replace(/[^A-Za-z0-9_-]/g, '')}`.slice(0, 32)
    await prisma.order.update({ where: { id: orderId }, data: { confirmationToken: alt } })

    expect(await bestaetige(alt)).toBe(true)
    expect((await gespeichert(orderId)).status).toBe('CONFIRMED')
  })
})

describe('Barbestätigung — „Erneut senden" ersetzt den Link', () => {
  it('neue Mail mit neuem Token; der alte Link gilt nicht mehr, der neue bestätigt', async () => {
    const { orderId, token: alt } = await barBestellung()

    expect(await sendeBarLinkErneut({}, erneutFormular(orderId))).toEqual({ antwort: BAR_LINK_ERNEUT_ANTWORT })
    await vi.waitFor(() => expect(mail).toHaveBeenCalledTimes(2))
    const neu = mail.mock.calls[1]![1]
    expect(neu).not.toBe(alt)
    expect(mail.mock.calls[1]![0].customerEmail).toBe(mail.mock.calls[0]![0].customerEmail)
    expect((await gespeichert(orderId)).confirmationToken).toBe(barTokenHash(neu))

    expect(await bestaetige(alt)).toMatch(/neuesten Mail/)
    expect(await bestaetige(neu)).toBe(true)
  })

  it('zwei gleichzeitige Anforderungen: genau eine Mail, und deren Token gilt', async () => {
    const { orderId } = await barBestellung()

    const antworten = await Promise.all([
      sendeBarLinkErneut({}, erneutFormular(orderId)),
      sendeBarLinkErneut({}, erneutFormular(orderId)),
    ])

    expect(antworten).toEqual([{ antwort: BAR_LINK_ERNEUT_ANTWORT }, { antwort: BAR_LINK_ERNEUT_ANTWORT }])
    await vi.waitFor(() => expect(mail).toHaveBeenCalledTimes(2))
    // Kurz warten, ob doch noch eine dritte kommt — es darf keine.
    await new Promise((fertig) => setTimeout(fertig, 200))
    expect(mail).toHaveBeenCalledTimes(2)
    expect((await gespeichert(orderId)).confirmationToken).toBe(barTokenHash(mail.mock.calls[1]![1]))
  })

  it('die vierte Anforderung am Tag schickt keine Mail — dieselbe Antwort', async () => {
    const { orderId } = await barBestellung()

    for (let i = 0; i < 4; i++) {
      expect(await sendeBarLinkErneut({}, erneutFormular(orderId))).toEqual({ antwort: BAR_LINK_ERNEUT_ANTWORT })
    }
    await vi.waitFor(() => expect(mail).toHaveBeenCalledTimes(4))
    await new Promise((fertig) => setTimeout(fertig, 200))
    // Eine aus dem Checkout, drei erneut — die vierte nicht.
    expect(mail).toHaveBeenCalledTimes(4)
  })

  it('nach dem Bestätigen: keine Mail mehr', async () => {
    const { orderId, token } = await barBestellung()
    expect(await bestaetige(token)).toBe(true)

    expect(await sendeBarLinkErneut({}, erneutFormular(orderId))).toEqual({ antwort: BAR_LINK_ERNEUT_ANTWORT })
    await new Promise((fertig) => setTimeout(fertig, 200))
    expect(mail).toHaveBeenCalledTimes(1)
  })
})

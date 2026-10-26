/**
 * Die Hof-E-Mail fällt auf die Anmelde-Adresse zurück (Nr. 194, Entscheidung 2
 * aus Morgenbericht 25).
 *
 * Beweist mit erfundenen Daten, Prisma, Resend und Stripe als Attrappen:
 *  - hofKontaktEmail: leer (auch nur Leerzeichen) → Anmelde-Adresse, gesetzt → Hof-E-Mail;
 *  - je Leser, der den Hof anschreibt: die Bestellmails an den Hof
 *    (baueOrderPaidToFarmer, baueOrderConfirmedToFarmer, über die Renderer der
 *    Warteschlange), „Nochmal schicken" (ladeNochmalStand, ladeNochmalStaende)
 *    und das neue Stripe-Konto (createConnectAccount) nehmen in beiden Fällen
 *    die richtige Adresse — die Gegenprobe ist jeweils der andere Fall.
 *  - Jede dieser Abfragen lädt die Anmelde-Adresse mit (sonst gäbe es nichts zum Zurückfallen).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => ({ user: { id: 'user_1' } })) } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    order: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}))
vi.mock('@/lib/stripe', () => ({ stripe: { accounts: { create: vi.fn(), retrieve: vi.fn() } } }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/server/bremse-datenbank', () => ({ bremseUeberAlleInstanzen: vi.fn(async () => true) }))
vi.mock('@/server/mail-warteschlange', () => ({ protokolliereSofortMail: vi.fn() }))
vi.mock('resend', () => ({ Resend: class { emails = { send: vi.fn() } } }))

import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { hofKontaktEmail } from '@/lib/hof-kontakt'
import { createConnectAccount } from '@/server/actions/stripe-connect'
import { ladeNochmalStaende, ladeNochmalStand } from '@/server/queries/mails'
import { rendereBarBestaetigtHof, rendereBestellungBezahltHof } from '@/server/mail-arten/bestellung'

const HOF_EMAIL = 'hof@example.org'
const ANMELDUNG = 'inhaberin@example.org'

const FAELLE = [
  { name: 'leer → Anmelde-Adresse', email: '', erwartet: ANMELDUNG },
  { name: 'nur Leerzeichen → Anmelde-Adresse', email: '   ', erwartet: ANMELDUNG },
  { name: 'gesetzt → Hof-E-Mail', email: HOF_EMAIL, erwartet: HOF_EMAIL },
] as const

beforeAll(() => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('hofKontaktEmail', () => {
  it.each(FAELLE)('$name', ({ email, erwartet }) => {
    expect(hofKontaktEmail({ email, owner: { email: ANMELDUNG } })).toBe(erwartet)
  })
})

/** Eine Bestellung, wie BESTELLUNG_FUER_MAIL sie lädt — erfunden. */
function bestellung(hofEmail: string, paymentMethod = 'ONLINE') {
  return {
    id: 'order_1',
    farmId: 'farm_1',
    orderNumber: 'HT-0210-A4F2',
    customerName: 'Erika Beispiel',
    customerEmail: 'kundin@example.org',
    customerPhone: '+43 660 0000000',
    totalAmount: '10.30',
    serviceFeeCents: 52,
    createdAt: new Date('2026-10-05T08:12:00Z'),
    pickupDate: new Date('2026-10-05T12:00:00Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    paymentMethod,
    stripePaymentIntentId: null,
    cancelReason: null,
    farm: {
      id: 'farm_1', name: 'Hof Beispiel', slug: 'hof-beispiel', email: hofEmail, ownerName: 'Max Muster',
      address: 'Feldweg 1', postalCode: '4910', city: 'Beispieldorf', phone: '+43 664 0000000',
      owner: { email: ANMELDUNG },
    },
    items: [{ id: 'i1', productName: 'Freilandeier', quantity: 1, unitPrice: '4.50', totalPrice: '4.50', product: { unit: 'STUECK', unitSize: null } }],
  }
}

/** Ob die Abfrage `farm.select.owner.select.email` trägt. */
function laedtAnmeldung(aufruf: unknown): boolean {
  const select = (aufruf as { select?: { farm?: { select?: { owner?: { select?: { email?: boolean } } } } } })?.select
  return select?.farm?.select?.owner?.select?.email === true
}

describe('Bestellmails an den Hof (Renderer der Warteschlange)', () => {
  const RENDERER = [
    ['bestellung-bezahlt-hof', rendereBestellungBezahltHof, 'ONLINE'],
    ['bar-bestaetigt-hof', rendereBarBestaetigtHof, 'ONSITE_CASH'],
  ] as const

  for (const [art, rendere, zahlart] of RENDERER) {
    it.each(FAELLE)(`${art}: $name`, async ({ email, erwartet }) => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(bestellung(email, zahlart) as never)
      const mail = await rendere({ orderId: 'order_1' })
      expect(mail).toMatchObject({ an: erwartet })
      expect(laedtAnmeldung(vi.mocked(prisma.order.findUnique).mock.calls[0][0])).toBe(true)
    }, 30_000)
  }
})

describe('„Nochmal schicken": die Adresse, an die die Hof-Mail heute ginge', () => {
  const nochmal = (email: string) => ({
    id: 'order_1', orderNumber: 'HT-0210-A4F2', status: 'CONFIRMED', paymentMethod: 'ONLINE', paymentStatus: 'PAID',
    cancelReason: null, createdAt: new Date(), pickupDate: new Date(), pickupTimeStart: '15:00', customerEmail: 'kundin@example.org',
    farm: { name: 'Hof Beispiel', email, archivedAt: null, owner: { email: ANMELDUNG } },
  })

  it.each(FAELLE)('ladeNochmalStand: $name', async ({ email, erwartet }) => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(nochmal(email) as never)
    const stand = await ladeNochmalStand({ art: 'bestellung-bezahlt-hof', bestellungId: 'order_1', farmId: 'farm_1' }, 'hof')
    expect(stand.adresse).toBe(erwartet)
    expect(laedtAnmeldung(vi.mocked(prisma.order.findUnique).mock.calls[0][0])).toBe(true)
  })

  it.each(FAELLE)('ladeNochmalStaende: $name', async ({ email, erwartet }) => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([nochmal(email)] as never)
    const staende = await ladeNochmalStaende([{ id: 'mail_1', art: 'bestellung-bezahlt-hof', bestellungId: 'order_1', farmId: 'farm_1' }], () => 'hof')
    expect(staende.get('mail_1')?.adresse).toBe(erwartet)
  })

  it('Gegenprobe: an die Kundin bleibt es die Adresse der Bestellung', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(nochmal('') as never)
    const stand = await ladeNochmalStand({ art: 'bestellung-bestaetigung', bestellungId: 'order_1', farmId: 'farm_1' }, 'bestellung')
    expect(stand.adresse).toBe('kundin@example.org')
  })
})

describe('Stripe-Konto anlegen (createConnectAccount)', () => {
  it.each(FAELLE)('$name', async ({ email, erwartet }) => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({
      id: 'farm_1', name: 'Hof Beispiel', slug: 'hof-beispiel', email, country: 'AT',
      stripeAccountId: null, stripeAccountReady: false, owner: { email: ANMELDUNG },
    } as never)
    vi.mocked(stripe.accounts.create).mockResolvedValue({ id: 'acct_erfunden' } as never)
    vi.mocked(prisma.farm.update).mockResolvedValue({} as never)
    vi.mocked(prisma.farm.updateMany).mockResolvedValue({ count: 1 } as never)
    await createConnectAccount()
    expect(vi.mocked(stripe.accounts.create).mock.calls[0][0]).toMatchObject({ email: erwartet })
    const select = (vi.mocked(prisma.farm.findUnique).mock.calls[0][0] as { select: { owner?: { select?: { email?: boolean } } } }).select
    expect(select.owner?.select?.email).toBe(true)
  })
})

/**
 * Die Links der Kunden-Mails (src/lib/email.ts, echtes Modul) auf eine
 * Bestellung tragen eine gültige Signatur.
 *
 * Bestätigung, „Abholbereit" und Bestätigungslink führen zur Bestellung; die
 * Seiten zeigen Name, E-Mail und Bestellung nur mit gültiger Signatur
 * (src/lib/bestell-link.ts). Der Bestätigungslink selbst ist ein Token-Link
 * auf die Seite mit dem Knopf (/{hof}/bestaetigen/{token}, H3); was dort
 * passiert, prüft tests/bar-bestaetigung-zugang.test.ts.
 *
 * Nur das Resend-SDK ist gemockt — die Mails werden echt gerendert.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

import { bestellLinkGilt } from '@/lib/bestell-link'

// Der kalte Import von email.ts zieht React und alle Vorlagen nach
// (TESTING_GUIDELINES §4: einmal je Datei, mit eigenem Timeout).
let email: typeof import('@/lib/email')

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  email = await import('@/lib/email')
}, 30_000)

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
})

const BESTELLUNG = {
  id: 'order-1',
  orderNumber: 'HT-0210-A4F2',
  customerName: 'Max Mustermann',
  customerEmail: 'max@example.org',
  customerPhone: '+43 660 0000000',
  totalAmount: 25,
  serviceFeeCents: 0,
  pickupDate: new Date('2026-10-03T12:00:00Z'),
  pickupTimeStart: '14:00',
  pickupTimeEnd: '16:00',
  paymentMethod: 'ONSITE_CASH',
  farm: {
    id: 'farm-1',
    name: 'Hof Test',
    email: 'hof@example.org',
    ownerName: 'Max Mustermann',
    address: 'Dorfstraße 12',
    city: 'Ried',
    postalCode: '4910',
    phone: '+43 660 0000000',
    slug: 'hof-test',
  },
  items: [{ productName: 'Bergkäse', quantity: 2, unitPrice: 12.5, totalPrice: 25, product: null }],
}

/** Alle Links der zuletzt verschickten Mail, die zu einer Bestellung dieses Hofs führen. */
function bestellLinks(): URL[] {
  const html = String(sendMock.mock.calls.at(-1)?.[0]?.html ?? '')
  return [...html.matchAll(/href="([^"]+)"/g)]
    .map((m) => new URL(m[1].replace(/&amp;/g, '&')))
    .filter((u) => /^\/hof-test\/(bestellung|confirm)\//.test(u.pathname))
}

describe('Kunden-Mails — jeder Link zur Bestellung ist signiert', () => {
  it.each([
    ['Bestätigung', () => email.sendOrderConfirmation(BESTELLUNG)],
    ['Abholbereit', () => email.sendOrderReady(BESTELLUNG)],
  ])('%s', async (_name, senden) => {
    await senden()

    const links = bestellLinks()
    // Gegenprobe: Die Mail verlinkt die Bestellung überhaupt — sonst bewiese
    // eine leere Liste nichts.
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      const signatur = link.searchParams.get('s') ?? link.searchParams.get('sig') ?? ''
      expect(bestellLinkGilt('order-1', signatur), link.href).toBe(true)
    }
  })

  it('die Mail „Bitte bestätigen" führt zur Seite mit dem Knopf — nie zu einem Link, der selbst bestätigt', async () => {
    await email.sendOnsiteConfirmation(BESTELLUNG, 'token-1')

    const html = String(sendMock.mock.calls.at(-1)?.[0]?.html ?? '')
    expect(html).toContain('/hof-test/bestaetigen/token-1')
    expect(html).not.toContain('/api/orders/confirm/')
    for (const link of bestellLinks()) {
      expect(bestellLinkGilt('order-1', link.searchParams.get('s') ?? link.searchParams.get('sig') ?? '')).toBe(true)
    }
  })
})

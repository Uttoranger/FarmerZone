/**
 * Register B1 in der Mail „Vor-Ort-Bestellung bestätigt" an den Hof — echtes
 * Modul src/lib/email.ts, echte Vorlage, nur das Resend-SDK gemockt.
 *
 * Beweist: Ob die Bar-Ausnahme gilt, entscheidet der BESTELLzeitpunkt der
 * Bestellung (nicht der Versand). Vor dem Stichtag ohne Gebühr: Satz aus
 * konditionen.ts, kein „schuldest du der Monatsabrechnung". Ab dem Stichtag
 * mit Gebühr: wie bisher. Ohne Zeitpunkt: kein Hinweis (lieber keiner als ein
 * falscher).
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

const IMPORT_TIMEOUT = 30_000

let email: typeof import('@/lib/email')
let konditionen: typeof import('@/lib/konditionen')

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
  email = await import('@/lib/email')
  konditionen = await import('@/lib/konditionen')
}, IMPORT_TIMEOUT)

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null })
})

function bestellung(felder: { serviceFeeCents: number; createdAt?: Date; paymentMethod?: string }) {
  return {
    id: 'order_1',
    orderNumber: 'TST-0101-AAAA',
    customerName: 'Erika Mustermann',
    customerEmail: 'kundin@example.com',
    customerPhone: '+43 660 0000000',
    totalAmount: 10.3,
    pickupDate: new Date('2026-10-10T10:00:00.000Z'),
    pickupTimeStart: '09:00',
    pickupTimeEnd: '12:00',
    paymentMethod: felder.paymentMethod ?? 'ONSITE_CASH',
    serviceFeeCents: felder.serviceFeeCents,
    createdAt: felder.createdAt,
    farm: {
      id: 'farm_1',
      name: 'Hof Test',
      email: 'hof@example.com',
      ownerName: 'Max Mustermann',
      address: 'Feldweg 1',
      city: 'Beispieldorf',
      postalCode: '1234',
      phone: '+43 660 1111111',
      slug: 'hof-test',
    },
    items: [{ productName: 'Eier', quantity: 1, unitPrice: 10.3, totalPrice: 10.3, product: null }],
  }
}

function gesendeterText(): string {
  const html = String(sendMock.mock.calls[0][0].html)
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/ |&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
}

const normal = (text: string): string => text.replace(/ /g, ' ')

describe('sendOrderConfirmedToFarmer — Bar-Ausnahme nach dem Bestellzeitpunkt', () => {
  it('bar vor dem Stichtag bestellt, Gebühr 0: der ganze Betrag bleibt dem Hof', async () => {
    await email.sendOrderConfirmedToFarmer(bestellung({ serviceFeeCents: 0, createdAt: new Date('2026-10-06T10:00:00.000Z') }))
    const text = gesendeterText()
    expect(text).toContain('Bar zu kassieren: € 10,30')
    expect(text).toContain(`${normal(konditionen.BAR_OHNE_GEBUEHR_SATZ)} Der ganze Betrag bleibt dir.`)
    expect(text).not.toContain('Monatsabrechnung')
  })

  it('bar ab dem Stichtag bestellt, mit Gebühr: wie bisher mit der Monatsabrechnung', async () => {
    const danach = new Date(konditionen.BAR_SERVICEGEBUEHR_AB.getTime() + 60_000)
    await email.sendOrderConfirmedToFarmer(bestellung({ serviceFeeCents: 52, createdAt: danach }))
    const text = gesendeterText()
    expect(text).toContain('Bar zu kassieren: € 10,82')
    expect(text).toContain('die schuldest du der Monatsabrechnung')
    expect(text).not.toContain(normal(konditionen.BAR_OHNE_GEBUEHR_SATZ))
  })

  it('ohne Bestellzeitpunkt kein Hinweis — lieber keiner als ein falscher', async () => {
    await email.sendOrderConfirmedToFarmer(bestellung({ serviceFeeCents: 0 }))
    expect(gesendeterText()).not.toContain(normal(konditionen.BAR_OHNE_GEBUEHR_SATZ))
  })
})

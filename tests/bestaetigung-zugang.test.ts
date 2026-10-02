/**
 * Die Bestätigungsseite /{hof}/confirm/{orderId} — Zugang nur mit signiertem
 * Link, Anzeige nur aus dem Datenbankstand.
 *
 * Beweist an Seite und Bestätigungs-Route selbst (Prisma gemockt):
 *  - Ohne oder mit falscher Signatur zeigt die Seite nur „eingegangen" —
 *    keinen Namen, keine E-Mail, keine Artikel, keine Beträge — und fragt die
 *    Datenbank gar nicht erst (die Bestell-ID ist ratbar und steht u. a. in
 *    den Stripe-Metadaten).
 *  - ?confirmed=true und ?redirect_status=succeeded ändern den angezeigten
 *    Zustand nicht; „bestätigt" und „bezahlt" kommen nur aus der Datenbank.
 *  - Jeder Weg zur Seite trägt eine gültige Signatur: Checkout-Antwort
 *    (tests/checkout-kunde.test.ts), Bestätigungslink aus der Mail (hier),
 *    und kein Code baut den Pfad an bestell-link.ts vorbei (Quelltext-Prüfung).
 *
 * Gelesen wird der Text des Elementbaums, wie in tests/bestellverfolgung-zugang.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique: vi.fn(), updateMany: vi.fn() } },
}))
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendOrderConfirmation: vi.fn(), sendOrderConfirmedToFarmer: vi.fn() }))

import ConfirmPage from '@/app/(public)/[farmSlug]/confirm/[orderId]/page'
import { GET as bestaetigeLink } from '@/app/api/orders/confirm/[token]/route'
import { bestellLinkGilt, bestellSignatur } from '@/lib/bestell-link'
import { prisma } from '@/lib/prisma'

const findUnique = vi.mocked(prisma.order.findUnique)
const updateMany = vi.mocked(prisma.order.updateMany)

/** Eine Bestellung, wie die Seite sie liest — mit erfundenen Daten. */
function bestellung(teil: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    farmId: 'farm-1',
    orderNumber: 'HT-0210-A4F2',
    status: 'PENDING_CONFIRMATION',
    paymentMethod: 'ONSITE_CASH',
    paymentStatus: 'PENDING',
    totalAmount: 25,
    serviceFeeCents: 0,
    serviceFeeRefundedAt: null,
    customerName: 'Max Mustermann',
    customerEmail: 'max@example.org',
    customerPhone: '+43 660 0000000',
    createdAt: new Date('2026-10-02T08:00:00Z'),
    cancelReason: null,
    pickupDate: new Date('2026-10-03T12:00:00Z'),
    pickupTimeStart: '14:00',
    pickupTimeEnd: '16:00',
    confirmationToken: 'token-1',
    stripePaymentIntentId: null,
    farm: {
      id: 'farm-1',
      slug: 'hof-test',
      name: 'Hof Test',
      address: 'Dorfstraße 12',
      postalCode: '4910',
      city: 'Ried',
      archivedAt: null,
    },
    items: [
      { productName: 'Bergkäse', quantity: 2, unitPrice: 12.5, totalPrice: 25, product: { unit: 'KG', unitSize: null } },
    ],
    ...teil,
  }
}

/** Aller Text eines Server-Elementbaums (Muster aus bestellverfolgung-zugang.test.ts). */
async function elementText(el: unknown): Promise<string> {
  if (el == null || typeof el === 'boolean') return ''
  if (typeof el === 'string' || typeof el === 'number') return String(el)
  if (Array.isArray(el)) {
    let text = ''
    for (const kind of el) text += await elementText(kind)
    return text
  }
  const element = el as { type?: unknown; props?: { children?: unknown } }
  if (!element.props) return ''
  if (typeof element.type === 'function') {
    try {
      return await elementText(await (element.type as (p: unknown) => unknown)(element.props))
    } catch {
      // Komponente braucht React-Kontext (Hooks) — der Text der Kinder reicht.
    }
  }
  return elementText(element.props.children)
}

async function seite(suche: Record<string, string | undefined>, orderId = 'order-1') {
  const element = await ConfirmPage({
    params: Promise.resolve({ farmSlug: 'hof-test', orderId }),
    searchParams: Promise.resolve(suche),
  })
  return elementText(element)
}

const GUELTIG = bestellSignatur('order-1')

beforeEach(() => {
  vi.clearAllMocks()
  findUnique.mockResolvedValue(bestellung() as never)
})

describe('Bestätigungsseite — Zugang nur mit Signatur', () => {
  it('ohne Signatur: nur „eingegangen", keine Daten der Kundin — und keine Datenbankabfrage', async () => {
    const text = await seite({})

    expect(text).toContain('Deine Bestellung ist eingegangen')
    expect(text).toContain('alle Details stehen in deiner E-Mail')
    for (const geheim of ['Max Mustermann', 'max@example.org', 'Bergkäse', 'HT-0210-A4F2', '25,00']) {
      expect(text).not.toContain(geheim)
    }
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('mit falscher Signatur: genauso', async () => {
    const text = await seite({ sig: 'f'.repeat(64) })

    expect(text).toContain('Deine Bestellung ist eingegangen')
    expect(text).not.toContain('max@example.org')
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('die Signatur einer anderen Bestellung öffnet diese nicht', async () => {
    const text = await seite({ sig: bestellSignatur('order-2') })

    expect(text).not.toContain('Bergkäse')
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('mit gültiger Signatur: die Bestellung — Gegenprobe, sonst bewiese ein leerer Fund nichts', async () => {
    const text = await seite({ sig: GUELTIG })

    expect(text).toContain('HT-0210-A4F2')
    expect(text).toContain('Bergkäse')
    expect(text).toContain('max@example.org')
    expect(text).not.toContain('Deine Bestellung ist eingegangen')
  })
})

describe('Bestätigungsseite — Zustand nur aus der Datenbank', () => {
  it('?confirmed=true bei unbestätigter Bestellung zeigt nicht „bestätigt"', async () => {
    const text = await seite({ sig: GUELTIG, confirmed: 'true' })

    expect(text).not.toContain('Bestellung bestätigt')
    expect(text).toContain('bitte bestätige per E-Mail')
  })

  it('bestätigt in der Datenbank: „bestätigt", auch ohne Parameter', async () => {
    findUnique.mockResolvedValue(bestellung({ status: 'CONFIRMED' }) as never)

    expect(await seite({ sig: GUELTIG })).toContain('Bestellung bestätigt')
  })

  it('?redirect_status=succeeded vor dem Webhook: „Zahlung wird geprüft", nicht „erfolgreich"', async () => {
    findUnique.mockResolvedValue(bestellung({ paymentMethod: 'ONLINE', paymentStatus: 'PENDING' }) as never)

    const text = await seite({ sig: GUELTIG, redirect_status: 'succeeded' })

    expect(text).not.toContain('Zahlung erfolgreich')
    expect(text).toContain('Zahlung wird geprüft')
  })

  it('bezahlt in der Datenbank: „Zahlung erfolgreich"', async () => {
    findUnique.mockResolvedValue(bestellung({ paymentMethod: 'ONLINE', paymentStatus: 'PAID', status: 'PAID' }) as never)

    expect(await seite({ sig: GUELTIG })).toContain('Zahlung erfolgreich')
  })

  it('eine stornierte Online-Bestellung wird durch ?redirect_status=succeeded nicht „erfolgreich"', async () => {
    findUnique.mockResolvedValue(
      bestellung({ paymentMethod: 'ONLINE', paymentStatus: 'PENDING', status: 'CANCELLED' }) as never
    )

    const text = await seite({ sig: GUELTIG, redirect_status: 'succeeded' })

    expect(text).not.toContain('Zahlung erfolgreich')
    expect(text).not.toContain('Zahlung wird geprüft')
  })
})

describe('Bestätigungslink aus der Mail (/api/orders/confirm/[token])', () => {
  const klick = () =>
    bestaetigeLink(new NextRequest('http://localhost:3000/api/orders/confirm/token-1'), {
      params: Promise.resolve({ token: 'token-1' }),
    })

  /** Die Weiterleitung führt zur Bestätigungsseite dieser Bestellung — mit gültiger Signatur. */
  function erwarteSignierteWeiterleitung(antwort: Response): URL {
    const ziel = new URL(antwort.headers.get('location') ?? '')
    expect(ziel.pathname).toBe('/hof-test/confirm/order-1')
    expect(bestellLinkGilt('order-1', ziel.searchParams.get('sig') ?? '')).toBe(true)
    return ziel
  }

  it('leitet nach dem Bestätigen auf die signierte Seite weiter — ohne ?confirmed', async () => {
    updateMany.mockResolvedValue({ count: 1 } as never)

    const ziel = erwarteSignierteWeiterleitung(await klick())

    expect(ziel.searchParams.has('confirmed')).toBe(false)
  })

  it('auch der zweite Klick (schon bestätigt) landet signiert', async () => {
    updateMany.mockResolvedValue({ count: 0 } as never)

    erwarteSignierteWeiterleitung(await klick())
  })
})

describe('Kein Code baut den Pfad der Bestätigungsseite an bestell-link.ts vorbei', () => {
  /** Alle .ts/.tsx unter src/, rekursiv. */
  function dateien(ordner: string): string[] {
    return readdirSync(ordner).flatMap((name) => {
      const pfad = join(ordner, name)
      if (statSync(pfad).isDirectory()) return dateien(pfad)
      return /\.(ts|tsx)$/.test(name) ? [pfad] : []
    })
  }
  /** Der Seitenpfad /{hof}/confirm/{id} — nicht die Token-Route /api/orders/confirm/{token} der Mail. */
  const SELBST_GEBAUT = /(?<!api\/orders)\/confirm\/\$\{/

  it('findet die Stellen, an denen es früher passierte — und übersieht die Token-Route — Gegenprobe', () => {
    expect(SELBST_GEBAUT.test('router.push(`/${farm.slug}/confirm/${result.orderId}`)')).toBe(true)
    expect(SELBST_GEBAUT.test('`${APP_URL}/api/orders/confirm/${confirmationToken}`')).toBe(false)
  })

  it('außer bestell-link.ts setzt niemand /confirm/${…} zusammen', () => {
    const treffer = dateien(join(process.cwd(), 'src'))
      .filter((pfad) => !pfad.endsWith(join('lib', 'bestell-link.ts')))
      .filter((pfad) => SELBST_GEBAUT.test(readFileSync(pfad, 'utf8')))
      .map((pfad) => pfad.slice(process.cwd().length + 1))
    expect(treffer).toEqual([])
  })
})

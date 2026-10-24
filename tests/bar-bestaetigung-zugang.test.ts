/**
 * H3 — Bar-Bestätigung per Knopf statt per GET.
 *
 * Vorher bestätigte schon der Aufruf des Mail-Links (GET
 * /api/orders/confirm/{token}) die Bestellung verbindlich. Ein Link-Scanner
 * im Mailprogramm, eine Vorschau oder ein Vorabruf reichten dafür, und der
 * Token blieb danach gültig. Jetzt:
 *  - GET leitet nur weiter — auf /{hof}/bestaetigen/{token}, ohne zu schreiben.
 *  - Die Seite zeigt Bestellung, Frist und zwei Knöpfe (Mockup
 *    web-k3-bar-bestellung-bestaetigen-link-aus-mail.html); ein Token, der
 *    nicht passt, zeigt nur „gilt nicht mehr", ohne Datenbank bei falscher Form.
 *  - Erst der Knopf (Server Action, POST) bestätigt: bedingt auf
 *    PENDING_CONFIRMATION UND den Token, nur innerhalb der Frist (`fristVon`),
 *    der Token wird dabei gelöscht. Die Mails an Kundin und Hof sind Aufträge
 *    der Warteschlange in derselben Transaktion (Nr. 159).
 *  - „Doch nicht" storniert über `storniereUnbezahlteBestellung`.
 *
 * Prisma, Warteschlange, Sentry und die Freigabe verwaister Bestellungen sind
 * gemockt; die Fachregel (src/lib/bar-bestaetigung.ts, src/lib/fristen.ts)
 * läuft echt. Zeit über vi.useFakeTimers().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'

const { nachlauf } = vi.hoisted(() => ({ nachlauf: [] as Array<() => Promise<void>> }))

vi.mock('@/lib/prisma', () => {
  const prisma = { order: { findFirst: vi.fn(), updateMany: vi.fn() }, $transaction: vi.fn() }
  return { prisma }
})
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: vi.fn() }))
vi.mock('@/server/unbezahlte-bestellung', () => ({ storniereUnbezahlteBestellung: vi.fn() }))
vi.mock('@/server/mail-warteschlange', () => ({ stelleMailEin: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
// Der Nachlauf wird gesammelt statt sofort gestartet — so ist prüfbar, dass
// die Mails NICHT im Antwortpfad laufen.
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.push(aufgabe)
  },
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT:${ziel}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
// Die Knöpfe sind eine Client-Komponente mit useActionState — hier zählt nur,
// OB und MIT WELCHEM Token die Seite sie zeigt.
vi.mock('@/components/checkout/bar-bestaetigen-knoepfe', () => ({
  BarBestaetigenKnoepfe: ({ token }: { token: string }) => createElement('span', null, `KNOEPFE:${token}`),
}))

import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import BestaetigenSeite, { metadata } from '@/app/(public)/[farmSlug]/bestaetigen/[token]/page'
import { GET as mailLink } from '@/app/api/orders/confirm/[token]/route'
import { bestaetigeBarBestellung, storniereBarBestellung } from '@/server/actions/bar-bestaetigung'
import { GRUND_KUNDIN_STORNIERT, LINK_UNGUELTIG_SATZ, barTokenHash } from '@/lib/bar-bestaetigung'
import { GRUND_NICHT_BESTAETIGT } from '@/lib/fristen'
import { bestellLinkGilt } from '@/lib/bestell-link'
import { prisma } from '@/lib/prisma'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { storniereUnbezahlteBestellung } from '@/server/unbezahlte-bestellung'
import { stelleMailEin } from '@/server/mail-warteschlange'

const findFirst = vi.mocked(prisma.order.findFirst)
const updateMany = vi.mocked(prisma.order.updateMany)
const freigabe = vi.mocked(gibVerwaisteFreiOhneRisiko)
const stornieren = vi.mocked(storniereUnbezahlteBestellung)
const einstellen = vi.mocked(stelleMailEin)

const TOKEN = 'V1StGXR8_Z5jdHi6BmyT9pqLnv2wYc4k'
/** Bestellt am 02.10.2026 um 10:00 Wiener Zeit — Frist 12:00 (zwei Stunden). */
const BESTELLT = new Date('2026-10-02T08:00:00Z')
const IN_DER_FRIST = new Date('2026-10-02T08:30:00Z')
const NACH_DER_FRIST = new Date('2026-10-02T10:00:00Z')

/** Eine Barbestellung, wie Seite und Aktion sie lesen — erfundene Daten. */
function bestellung(teil: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    farmId: 'farm-1',
    orderNumber: 'HT-0210-A4F2',
    status: 'PENDING_CONFIRMATION',
    paymentMethod: 'ONSITE_CASH',
    paymentStatus: 'PENDING',
    totalAmount: 10.3,
    serviceFeeCents: 52,
    serviceFeeRefundedAt: null,
    customerName: 'Max Mustermann',
    customerEmail: 'max@example.org',
    customerPhone: '+43 660 0000000',
    createdAt: BESTELLT,
    cancelReason: null,
    pickupDate: new Date('2026-10-02T12:00:00Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    confirmationToken: TOKEN,
    stripePaymentIntentId: null,
    farm: {
      id: 'farm-1',
      slug: 'hof-test',
      name: 'Hof Test',
      email: 'hof@example.org',
      ownerName: 'Max Mustermann',
      address: 'Dorfstraße 12',
      postalCode: '4910',
      city: 'Ried',
      phone: '+43 660 0000000',
      archivedAt: null,
    },
    items: [
      { productName: 'Freilandeier', quantity: 1, unitPrice: 4.5, totalPrice: 4.5, product: { unit: 'STUECK', unitSize: null } },
      { productName: 'Bauernbrot', quantity: 1, unitPrice: 5.8, totalPrice: 5.8, product: { unit: 'STUECK', unitSize: null } },
    ],
    ...teil,
  }
}

/** Aller Text eines Server-Elementbaums (Muster aus tests/bestaetigung-zugang.test.ts). */
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

async function seite(token = TOKEN, farmSlug = 'hof-test'): Promise<string> {
  return elementText(await BestaetigenSeite({ params: Promise.resolve({ farmSlug, token }) }))
}

/**
 * Alle Links eines Server-Elementbaums mit Ziel und Namen (Muster aus
 * tests/bestellverfolgung-zugang.test.ts): Funktions-Komponenten ohne Hooks
 * werden aufgerufen — die Fokus-Shell rendert so ihren Zurück-Link —, sonst
 * zählt die `href`-Prop. Ein Link nur mit Symbol heißt nach `aria-label`.
 */
async function elementLinks(el: unknown): Promise<Array<{ href: string; text: string }>> {
  if (el == null || typeof el !== 'object') return []
  if (Array.isArray(el)) {
    const alle: Array<{ href: string; text: string }> = []
    for (const kind of el) alle.push(...(await elementLinks(kind)))
    return alle
  }
  const element = el as { type?: unknown; props?: { children?: unknown; href?: unknown; 'aria-label'?: unknown } }
  if (!element.props) return []
  if (typeof element.type === 'function') {
    try {
      return await elementLinks(await (element.type as (p: unknown) => unknown)(element.props))
    } catch {
      // Komponente braucht React-Kontext (Hooks) — dann zählt ihre href-Prop.
    }
  }
  const name = (await elementText(element.props.children)).trim() || String(element.props['aria-label'] ?? '')
  const eigener = typeof element.props.href === 'string' ? [{ href: element.props.href, text: name }] : []
  return [...eigener, ...(await elementLinks(element.props.children))]
}

async function seitenLinks(token = TOKEN, farmSlug = 'hof-test') {
  return elementLinks(await BestaetigenSeite({ params: Promise.resolve({ farmSlug, token }) }))
}

function formular(token: unknown = TOKEN): FormData {
  const daten = new FormData()
  if (typeof token === 'string') daten.set('token', token)
  return daten
}

/** Wohin die Aktion weitergeleitet hat — oder null, wenn sie eine Antwort zurückgab. */
async function weiterleitungVon(aufruf: Promise<unknown>): Promise<string | null> {
  try {
    await aufruf
    return null
  } catch (e) {
    const text = e instanceof Error ? e.message : ''
    if (!text.startsWith('REDIRECT:')) throw e
    return text.slice('REDIRECT:'.length)
  }
}

/** Die Weiterleitung führt zur signierten Bestätigungsseite dieser Bestellung. */
function erwarteSignierteBestaetigungsseite(ziel: string | null) {
  const url = new URL(ziel ?? '', 'http://localhost')
  expect(url.pathname).toBe('/hof-test/confirm/order-1')
  expect(bestellLinkGilt('order-1', url.searchParams.get('sig') ?? '')).toBe(true)
}

function mailLinkKlick(token = TOKEN) {
  return mailLink(new NextRequest(`http://localhost:3000/api/orders/confirm/${token}`), {
    params: Promise.resolve({ token }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.length = 0
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(IN_DER_FRIST)
  findFirst.mockResolvedValue(bestellung() as never)
  updateMany.mockResolvedValue({ count: 1 } as never)
  stornieren.mockResolvedValue(true)
  // Die Transaktion arbeitet auf denselben Attrappen.
  vi.mocked(prisma.$transaction).mockImplementation((async (arbeit: (tx: typeof prisma) => Promise<unknown>) => arbeit(prisma)) as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Mail-Link (GET /api/orders/confirm/[token]) — leitet nur weiter', () => {
  const klick = (token = TOKEN) =>
    mailLink(new NextRequest(`http://localhost:3000/api/orders/confirm/${token}`), {
      params: Promise.resolve({ token }),
    })

  it('bestätigt NICHT — ein Link-Scanner im Mailprogramm darf nichts auslösen', async () => {
    await klick()

    expect(updateMany).not.toHaveBeenCalled()
    expect(einstellen).not.toHaveBeenCalled()
    expect(nachlauf).toHaveLength(0)
  })

  it('leitet auf die Bestätigungsseite des Hofs mit demselben Token weiter', async () => {
    const antwort = await klick()

    const ziel = new URL(antwort.headers.get('location') ?? '')
    expect(ziel.pathname).toBe(`/hof-test/bestaetigen/${TOKEN}`)
  })

  it('unbekannter Token: zur Startseite, ohne zu schreiben', async () => {
    findFirst.mockResolvedValue(null as never)

    const antwort = await klick()

    expect(new URL(antwort.headers.get('location') ?? '').pathname).toBe('/')
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('ein Token in falscher Form fragt die Datenbank gar nicht erst', async () => {
    await klick('kurz')

    expect(findFirst).not.toHaveBeenCalled()
  })
})

describe('Seite /{hof}/bestaetigen/{token}', () => {
  it('offen: Hof, Frist, Positionen, Summe und die Knöpfe — nach Mockup', async () => {
    const text = await seite()

    expect(text).toContain('Bestellung bei Hof Test bestätigen')
    expect(text).toContain('Bitte bestätige bis heute, 12:00 Uhr – erst dann packt der Hof für dich.')
    expect(text).toContain('Freilandeier')
    expect(text).toContain('Bauernbrot')
    expect(text).toContain('Servicegebühr')
    expect(text).toContain('€ 0,52')
    expect(text).toContain('Bar bei Abholung')
    expect(text).toContain('€ 10,82')
    expect(text).toContain('Abholung heute, 15:00–18:00 Uhr')
    expect(text).toContain(`KNOEPFE:${TOKEN}`)
  })

  it('zeigt weder Name noch E-Mail der Kundin — der Link kann weitergeleitet worden sein', async () => {
    const text = await seite()

    expect(text).not.toContain('Max Mustermann')
    expect(text).not.toContain('max@example.org')
  })

  it('gibt vor dem Lesen verwaiste Bestellungen frei (Frist gilt beim Lesen)', async () => {
    await seite()

    expect(freigabe).toHaveBeenCalledWith('farm-1')
  })

  it('ein Token in falscher Form: „gilt nicht mehr", keine Datenbankabfrage', async () => {
    const text = await seite('a b')

    expect(text).toContain('Dieser Link gilt nicht mehr')
    expect(findFirst).not.toHaveBeenCalled()
  })

  it('unbekannter (schon benutzter) Token: „gilt nicht mehr", ohne Bestelldaten', async () => {
    findFirst.mockResolvedValue(null as never)

    const text = await seite()

    expect(text).toContain('Dieser Link gilt nicht mehr')
    expect(text).not.toContain('KNOEPFE')
  })

  it('der Token eines anderen Hofs öffnet unter fremder Adresse nichts', async () => {
    const text = await seite(TOKEN, 'anderer-hof')

    expect(text).toContain('Dieser Link gilt nicht mehr')
    expect(text).not.toContain('Freilandeier')
  })

  it('nach der Frist: verfallen, keine Knöpfe — auch wenn die Freigabe noch nicht durch war', async () => {
    vi.setSystemTime(NACH_DER_FRIST)

    const text = await seite()

    expect(text).toContain('Bestellung verfallen')
    expect(text).not.toContain('KNOEPFE')
    expect(text).not.toContain('Freilandeier')
  })

  it('storniert: „storniert", keine Knöpfe, keine Positionen', async () => {
    findFirst.mockResolvedValue(bestellung({ status: 'CANCELLED', cancelReason: GRUND_KUNDIN_STORNIERT }) as never)

    const text = await seite()

    expect(text).toContain('Bestellung storniert')
    expect(text).not.toContain('KNOEPFE')
    expect(text).not.toContain('Freilandeier')
  })

  it('schon bestätigt: weiter zur signierten Bestätigungsseite', async () => {
    findFirst.mockResolvedValue(bestellung({ status: 'CONFIRMED' }) as never)

    erwarteSignierteBestaetigungsseite(await weiterleitungVon(seite()))
  })

  it('steht in keinem Suchindex und gibt keinen Referrer weiter', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.referrer).toBe('no-referrer')
  })
})

describe('Seite /{hof}/bestaetigen/{token} — ohne gültigen Token führt der Weg zu den Höfen', () => {
  /**
   * Ohne gültigen Token ist nicht einmal der Hof bestätigt: Der Kopf
   * („Zurück zu den Höfen") und der Knopf führen nach /hoefe — nie nach
   * /{farmSlug} aus der ungeprüften Adresse und nie zum Hof der Bestellung
   * (das verriete, wem der Token gehört). Bis Nr. 54 hielt das die Art
   * `bestellung-ungueltig` in src/lib/kunden-kopf.ts fest; jetzt rendert der
   * Test die echte Seite.
   */
  function erwarteAusweg(links: Array<{ href: string; text: string }>) {
    expect(links).toContainEqual({ href: '/hoefe', text: 'Zurück zu den Höfen' })
    expect(links).toContainEqual({ href: '/hoefe', text: 'Höfe entdecken' })
    for (const link of links) {
      expect(link.href, link.text).not.toMatch(/fremder-hof|hof-test/)
    }
  }

  it('Token in falscher Form', async () => {
    erwarteAusweg(await seitenLinks('a b', 'fremder-hof'))
  })

  it('unbekannter Token', async () => {
    findFirst.mockResolvedValue(null as never)
    erwarteAusweg(await seitenLinks(TOKEN, 'fremder-hof'))
  })

  it('fremder Hof in der Adresse', async () => {
    erwarteAusweg(await seitenLinks(TOKEN, 'fremder-hof'))
  })

  it('stillgelegter Hof', async () => {
    findFirst.mockResolvedValue(bestellung({ farm: { ...bestellung().farm, archivedAt: new Date('2026-01-01') } }) as never)
    erwarteAusweg(await seitenLinks())
  })

  it('eine Online-Bestellung mit Token (Ansicht „ungueltig")', async () => {
    findFirst.mockResolvedValue(bestellung({ paymentMethod: 'ONLINE' }) as never)
    erwarteAusweg(await seitenLinks())
  })

  it('Gegenprobe: offen führt der Kopf zum Hof der Bestellung — die Suche findet auch den Zurück-Link der Shell', async () => {
    const links = await seitenLinks()
    expect(links).toContainEqual({ href: '/hof-test', text: 'Zurück zu Hof Test' })
    expect(links).not.toContainEqual({ href: '/hoefe', text: 'Zurück zu den Höfen' })
  })
})

describe('Knopf „Ja, ich hole verbindlich ab" — bestaetigeBarBestellung', () => {
  it('bestätigt bedingt: nur aus PENDING_CONFIRMATION und nur mit genau diesem Token, der dabei verfällt', async () => {
    await weiterleitungVon(bestaetigeBarBestellung({}, formular()))

    expect(updateMany).toHaveBeenCalledTimes(1)
    const aufruf = updateMany.mock.calls[0][0] as { where: Record<string, unknown>; data: Record<string, unknown> }
    // Nur der Hash — aus tokenKandidaten (Nr. 151, Klartext entfällt seit Nr. 164).
    expect(aufruf.where).toMatchObject({
      id: 'order-1',
      status: 'PENDING_CONFIRMATION',
      confirmationToken: { in: [barTokenHash(TOKEN)] },
    })
    expect(aufruf.data).toMatchObject({ status: 'CONFIRMED', confirmationToken: null })
    expect(aufruf.data.confirmedAt).toEqual(IN_DER_FRIST)
  })

  it('leitet danach auf die signierte Bestätigungsseite', async () => {
    erwarteSignierteBestaetigungsseite(await weiterleitungVon(bestaetigeBarBestellung({}, formular())))
  })

  it('gibt vorher verwaiste Bestellungen des Hofs frei', async () => {
    await weiterleitungVon(bestaetigeBarBestellung({}, formular()))

    expect(freigabe).toHaveBeenCalledWith('farm-1')
    expect(freigabe.mock.invocationCallOrder[0]).toBeLessThan(updateMany.mock.invocationCallOrder[0])
  })

  it('Mails als Aufträge an Kundin und Hof, je einer, in DERSELBEN Transaktion nach dem Statuswechsel — kein Versand im Antwortpfad', async () => {
    await weiterleitungVon(bestaetigeBarBestellung({}, formular()))

    expect(einstellen).toHaveBeenCalledTimes(1)
    const [auftraege, tx] = einstellen.mock.calls[0]!
    expect(auftraege).toEqual([
      expect.objectContaining({ art: 'bestellung-bestaetigung', vorrang: 1, schluessel: 'bestellung-bestaetigung:order-1', bestellungId: 'order-1', farmId: 'farm-1' }),
      expect.objectContaining({ art: 'bar-bestaetigt-hof', vorrang: 1, schluessel: 'bar-bestaetigt-hof:order-1', bestellungId: 'order-1', farmId: 'farm-1' }),
    ])
    expect(tx).toBe(prisma)
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(einstellen.mock.invocationCallOrder[0]!)
    expect(nachlauf).toHaveLength(0)
  })

  it('scheitert das Einstellen, wirft die Transaktion — die Bestätigung ist nicht gespeichert, kein Weiterleiten', async () => {
    einstellen.mockRejectedValueOnce(new Error('DB weg'))
    await expect(bestaetigeBarBestellung({}, formular())).rejects.toThrow('DB weg')
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('nach der Frist: bestätigt NICHT, keine Mail — die Seite zeigt „verfallen"', async () => {
    vi.setSystemTime(NACH_DER_FRIST)

    const ziel = await weiterleitungVon(bestaetigeBarBestellung({}, formular()))

    expect(updateMany).not.toHaveBeenCalled()
    expect(nachlauf).toHaveLength(0)
    expect(ziel).toBe(`/hof-test/bestaetigen/${TOKEN}`)
  })

  it('Uhr läuft während der Freigabe über die Frist (Stripe hakt): bestätigt NICHT', async () => {
    // Die Freigabe kann bei verwaisten Online-Bestellungen Sekunden dauern.
    // Geprüft wird mit der Zeit DANACH, nicht mit der vom Anfang des Klicks.
    freigabe.mockImplementationOnce(async () => {
      vi.setSystemTime(NACH_DER_FRIST)
    })

    const ziel = await weiterleitungVon(bestaetigeBarBestellung({}, formular()))

    expect(updateMany).not.toHaveBeenCalled()
    expect(nachlauf).toHaveLength(0)
    expect(ziel).toBe(`/hof-test/bestaetigen/${TOKEN}`)
  })

  it('confirmedAt ist der Zeitpunkt nach der Freigabe', async () => {
    const NACH_FREIGABE = new Date('2026-10-02T08:30:07Z')
    freigabe.mockImplementationOnce(async () => {
      vi.setSystemTime(NACH_FREIGABE)
    })

    await weiterleitungVon(bestaetigeBarBestellung({}, formular()))

    const aufruf = updateMany.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(aufruf.data.confirmedAt).toEqual(NACH_FREIGABE)
  })

  it('aktualisiert die Bestellliste des Hofs — wie cancelOrder', async () => {
    await weiterleitungVon(bestaetigeBarBestellung({}, formular()))

    expect(revalidatePath).toHaveBeenCalledWith('/orders')
    expect(revalidatePath).toHaveBeenCalledWith('/orders/order-1')
  })

  it('verfallen und schon storniert: bestätigt nie', async () => {
    findFirst.mockResolvedValue(bestellung({ status: 'CANCELLED', cancelReason: GRUND_NICHT_BESTAETIGT }) as never)

    await weiterleitungVon(bestaetigeBarBestellung({}, formular()))

    expect(updateMany).not.toHaveBeenCalled()
  })

  it('zweiter Klick oder parallel storniert (count 0): keine Mail, weiter zur signierten Seite', async () => {
    updateMany.mockResolvedValue({ count: 0 } as never)

    const ziel = await weiterleitungVon(bestaetigeBarBestellung({}, formular()))

    expect(einstellen).not.toHaveBeenCalled()
    expect(nachlauf).toHaveLength(0)
    erwarteSignierteBestaetigungsseite(ziel)
  })

  it('unbekannter Token: verständlicher Satz, nichts geschrieben', async () => {
    findFirst.mockResolvedValue(null as never)

    const antwort = await bestaetigeBarBestellung({}, formular())

    expect(antwort.error).toMatch(/gilt nicht mehr/)
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('ohne oder mit kaputtem Token: keine Datenbankabfrage', async () => {
    for (const daten of [formular(null), formular('../x')]) {
      const antwort = await bestaetigeBarBestellung({}, daten)
      expect(antwort.error).toBeTruthy()
    }
    expect(findFirst).not.toHaveBeenCalled()
  })
})

describe('Knopf „Doch nicht – Bestellung stornieren" — storniereBarBestellung', () => {
  it('storniert über storniereUnbezahlteBestellung — bedingt, mit Rückbuchung', async () => {
    await weiterleitungVon(storniereBarBestellung({}, formular()))

    expect(stornieren).toHaveBeenCalledWith('order-1', GRUND_KUNDIN_STORNIERT)
    expect(updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) }))
  })

  it('aktualisiert die Bestellliste des Hofs — wie cancelOrder', async () => {
    await weiterleitungVon(storniereBarBestellung({}, formular()))

    expect(revalidatePath).toHaveBeenCalledWith('/orders')
    expect(revalidatePath).toHaveBeenCalledWith('/orders/order-1')
  })

  it('jemand anderes war schneller: nichts zu aktualisieren', async () => {
    stornieren.mockResolvedValue(false)

    await weiterleitungVon(storniereBarBestellung({}, formular()))

    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('zeigt danach dieselbe Seite — dort steht „storniert"', async () => {
    expect(await weiterleitungVon(storniereBarBestellung({}, formular()))).toBe(`/hof-test/bestaetigen/${TOKEN}`)
  })

  it('eine schon bestätigte Bestellung storniert der Link nicht (das macht der Hof)', async () => {
    findFirst.mockResolvedValue(bestellung({ status: 'CONFIRMED' }) as never)

    await weiterleitungVon(storniereBarBestellung({}, formular()))

    expect(stornieren).not.toHaveBeenCalled()
  })

  it('unbekannter Token: verständlicher Satz, nichts storniert', async () => {
    findFirst.mockResolvedValue(null as never)

    const antwort = await storniereBarBestellung({}, formular())

    expect(antwort.error).toMatch(/gilt nicht mehr/)
    expect(stornieren).not.toHaveBeenCalled()
  })
})

describe('Nur der Hash in der Datenbank (Nr. 151) — alle Leser suchen nur den Hash', () => {
  const GESUCHT = { confirmationToken: { in: [barTokenHash(TOKEN)] } }

  it('Seite, Knöpfe und alter Mail-Link fragen nach dem Hash — nie nach dem Klartext', async () => {
    await seite()
    await weiterleitungVon(bestaetigeBarBestellung({}, formular()))
    await weiterleitungVon(storniereBarBestellung({}, formular()))
    await mailLinkKlick()

    expect(findFirst.mock.calls.length).toBeGreaterThanOrEqual(5)
    for (const [frage] of findFirst.mock.calls) {
      expect((frage as { where: unknown }).where).toEqual(GESUCHT)
    }
  })

  it('der gespeicherte Hash als Token eingegeben: falsche Form, keine Datenbankabfrage, „gilt nicht mehr"', async () => {
    const gespeichert = barTokenHash(TOKEN)

    const text = await seite(gespeichert)
    const antwort = await bestaetigeBarBestellung({}, formular(gespeichert))

    expect(text).toContain('Dieser Link gilt nicht mehr')
    expect(antwort.error).toMatch(/gilt nicht mehr/)
    expect(findFirst).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('ungültiger Link: Seite und Knopf sagen denselben Satz aus einer Quelle', async () => {
    findFirst.mockResolvedValue(null as never)

    const text = await seite()
    const antwort = await bestaetigeBarBestellung({}, formular())

    expect(text).toContain(LINK_UNGUELTIG_SATZ)
    expect(antwort.error).toContain(LINK_UNGUELTIG_SATZ)
  })
})

describe('Kein Code baut den Pfad der Bar-Bestätigung an bestell-link.ts vorbei', () => {
  function dateien(ordner: string): string[] {
    return readdirSync(ordner).flatMap((name) => {
      const pfad = join(ordner, name)
      if (statSync(pfad).isDirectory()) return dateien(pfad)
      return /\.(ts|tsx)$/.test(name) ? [pfad] : []
    })
  }
  const SELBST_GEBAUT = /\/bestaetigen\/\$\{/

  it('findet einen selbst gebauten Pfad — Gegenprobe', () => {
    expect(SELBST_GEBAUT.test('`${APP_URL}/${farm.slug}/bestaetigen/${token}`')).toBe(true)
  })

  it('außer bestell-link.ts setzt niemand /bestaetigen/${…} zusammen', () => {
    const treffer = dateien(join(process.cwd(), 'src'))
      .filter((pfad) => !pfad.endsWith(join('lib', 'bestell-link.ts')))
      .filter((pfad) => SELBST_GEBAUT.test(readFileSync(pfad, 'utf8')))
      .map((pfad) => pfad.slice(process.cwd().length + 1))
    expect(treffer).toEqual([])
  }, 30_000)
})

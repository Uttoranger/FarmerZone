/**
 * Tests für den DURCHSETZUNGSPUNKT der Bestellverfolgung: nicht die reine
 * Funktion (tests/bestellverfolgung.test.ts), sondern Seite und ICS-Route
 * selbst — mit gemocktem Prisma (Muster wie tests/hofuebersicht.test.ts).
 *
 * Der Anlass ist ein Mutationsbefund: Die Signaturprüfung ließ sich aus
 * page.tsx und route.ts ersatzlos streichen, ohne dass die Suite rot wurde.
 * Diese Tests machen genau das unmöglich — sie rufen die ECHTEN Handler auf
 * und verlangen: falsche Signatur → Ablehnung OHNE Datenbank-Zugriff, und
 * die Ablehnung ist für „falsche Signatur" und „Bestellung existiert nicht"
 * BYTE-GLEICH (kein Existenz-Orakel).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique: vi.fn() } },
}))

import { NextRequest } from 'next/server'
import { GET } from '@/app/(public)/[farmSlug]/bestellung/[orderId]/kalender/route'
import BestellungPage from '@/app/(public)/[farmSlug]/bestellung/[orderId]/page'
import { bestellSignatur } from '@/lib/bestell-link'
import { SERVICEGEBUEHR_BEZEICHNUNG, bestellSummen } from '@/lib/servicegebuehr'
import { prisma } from '@/lib/prisma'

const findUnique = vi.mocked(prisma.order.findUnique)

/** Eine Bestellung, wie die Query sie liefert. */
function bestellung(teil: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    orderNumber: 'HM-2611-A4F2',
    status: 'READY',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    totalAmount: 25,
    pickupDate: new Date('2026-09-04T12:00:00Z'),
    pickupTimeStart: '14:00',
    pickupTimeEnd: '16:00',
    farm: {
      slug: 'hof-probe',
      name: 'Hof Müller',
      address: 'Dorfstraße 12',
      postalCode: '4910',
      city: 'Ried im Innkreis',
      archivedAt: null,
    },
    items: [
      {
        productName: 'Bergkäse',
        quantity: 2,
        unitPrice: 12.5,
        totalPrice: 25,
        product: { unit: 'KG', unitSize: null },
      },
    ],
    ...teil,
  }
}

function icsAnfrage(orderId: string, s: string) {
  return GET(
    new NextRequest(`http://localhost:3000/hof-probe/bestellung/${orderId}/kalender?s=${s}`),
    { params: Promise.resolve({ farmSlug: 'hof-probe', orderId }) }
  )
}

/**
 * Zieht allen TEXT aus einem Server-Elementbaum: Zeichenketten direkt,
 * Funktions-Komponenten werden aufgerufen (LinkUngueltig, Marke — reine
 * Funktionen ohne Hooks). Wo ein Aufruf nicht geht (next/link nutzt Hooks),
 * genügt die Kinder-Prop — der sichtbare Text steckt dort.
 */
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

async function seite(orderId: string, s: string | undefined, farmSlug = 'hof-probe') {
  const element = await BestellungPage({
    params: Promise.resolve({ farmSlug, orderId }),
    searchParams: Promise.resolve({ s }),
  })
  return elementText(element)
}

/**
 * Alle Links eines Server-Elementbaums mit Ziel und sichtbarem Text — wie
 * elementText: Funktions-Komponenten ohne Hooks werden aufgerufen (dann
 * zählt der Link, den sie rendern); wo das nicht geht (next/link), zählt die
 * `href`-Prop des Elements selbst.
 */
async function elementLinks(el: unknown): Promise<Array<{ href: string; text: string }>> {
  if (el == null || typeof el !== 'object') return []
  if (Array.isArray(el)) {
    const alle: Array<{ href: string; text: string }> = []
    for (const kind of el) alle.push(...(await elementLinks(kind)))
    return alle
  }
  const element = el as { type?: unknown; props?: { children?: unknown; href?: unknown } }
  if (!element.props) return []
  if (typeof element.type === 'function') {
    try {
      return await elementLinks(await (element.type as (p: unknown) => unknown)(element.props))
    } catch {
      // Komponente braucht React-Kontext (Hooks) — dann zählt ihre href-Prop.
    }
  }
  const eigener =
    typeof element.props.href === 'string'
      ? [{ href: element.props.href, text: (await elementText(element.props.children)).trim() }]
      : []
  return [...eigener, ...(await elementLinks(element.props.children))]
}

async function seitenLinks(orderId: string, s: string | undefined, farmSlug = 'hof-probe') {
  const element = await BestellungPage({
    params: Promise.resolve({ farmSlug, orderId }),
    searchParams: Promise.resolve({ s }),
  })
  return elementLinks(element)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ICS-Route — die Signatur wird an der Route selbst durchgesetzt', () => {
  it('falsche Signatur: 404, und die Datenbank wird NICHT einmal gefragt', async () => {
    const antwort = await icsAnfrage('order-1', 'f'.repeat(64))
    expect(antwort.status).toBe(404)
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('kein Existenz-Orakel: „falsche Signatur" und „Bestellung fehlt" antworten byte-gleich', async () => {
    const falscheSignatur = await icsAnfrage('order-1', 'f'.repeat(64))
    findUnique.mockResolvedValue(null as never)
    const fehlend = await icsAnfrage('order-1', bestellSignatur('order-1'))

    expect(fehlend.status).toBe(falscheSignatur.status)
    expect(await fehlend.text()).toBe(await falscheSignatur.text())
  })

  it('gültige Signatur liefert die Kalenderdatei zum richtigen Termin', async () => {
    findUnique.mockResolvedValue(bestellung() as never)
    const antwort = await icsAnfrage('order-1', bestellSignatur('order-1'))

    expect(antwort.status).toBe(200)
    expect(antwort.headers.get('content-type')).toContain('text/calendar')
    const ics = await antwort.text()
    expect(ics).toContain('DTSTART;TZID=Europe/Vienna:20260904T140000')
    expect(ics).toContain('SUMMARY:Abholung Hof Müller')
    // Entfaltet (Faltung rückgängig), weil die 75-Oktett-Faltung Wörter
    // mitten im Link trennen darf.
    expect(ics.replace(/\r\n /g, '')).toContain('Bestellung HM-2611-A4F2')
  })

  it('ein fremder Hof-Slug in der URL wird abgelehnt wie eine falsche Signatur', async () => {
    findUnique.mockResolvedValue(bestellung() as never)
    const antwort = await GET(
      new NextRequest(
        `http://localhost:3000/anderer-hof/bestellung/order-1/kalender?s=${bestellSignatur('order-1')}`
      ),
      { params: Promise.resolve({ farmSlug: 'anderer-hof', orderId: 'order-1' }) }
    )
    expect(antwort.status).toBe(404)
  })

  it('storniert: kein Termin, keine Datei', async () => {
    findUnique.mockResolvedValue(bestellung({ status: 'CANCELLED' }) as never)
    const antwort = await icsAnfrage('order-1', bestellSignatur('order-1'))
    expect(antwort.status).toBe(404)
  })

  // Nr. 19b: Termin nur für eine Bestellung, die steht — dieselbe Bedingung
  // wie der Knopf auf der Bestätigungsseite. Eine offene Bestellung ist vor
  // der Frist noch nicht bestätigt und danach verfallen (fristen.ts, beim
  // Lesen); in beiden Fällen stünde ein Termin im Kalender, den es nicht gibt.
  it.each(['PENDING_CONFIRMATION', 'NOT_PICKED_UP', 'PICKED_UP'])('%s: kein Termin, Antwort wie jede Ablehnung', async (status) => {
    const ablehnung = await icsAnfrage('order-1', 'f'.repeat(64))
    findUnique.mockResolvedValue(bestellung({ status }) as never)
    const antwort = await icsAnfrage('order-1', bestellSignatur('order-1'))
    expect(antwort.status).toBe(404)
    expect(await antwort.text()).toBe(await ablehnung.text())
  })

  it.each(['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'])('Gegenprobe %s: die Datei kommt', async (status) => {
    findUnique.mockResolvedValue(bestellung({ status }) as never)
    const antwort = await icsAnfrage('order-1', bestellSignatur('order-1'))
    expect(antwort.status).toBe(200)
  })

  it('kein signierter Link im Kalendereintrag — synchronisierte Kalender sind kein geschützter Ort', async () => {
    findUnique.mockResolvedValue(bestellung() as never)
    const ics = (await (await icsAnfrage('order-1', bestellSignatur('order-1'))).text()).replace(/\r\n /g, '')
    expect(ics).not.toContain(bestellSignatur('order-1'))
    expect(ics).not.toContain('?s=')
    expect(ics).not.toContain('/bestellung/order-1')
    // Gegenprobe: Die Beschreibung ist da und nennt die Bestellnummer.
    expect(ics).toMatch(/DESCRIPTION:Bestellung HM-2611-A4F2/)
  })
})

describe('Bestellseite — die Signatur wird an der Seite selbst durchgesetzt', () => {
  it('falsche Signatur: ruhige Seite, KEIN Datenbank-Zugriff, keine Bestelldaten', async () => {
    const html = await seite('order-1', 'f'.repeat(64))
    expect(html).toContain('Dieser Link ist nicht gültig')
    expect(html).not.toContain('HM-2611')
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('ohne Signatur-Parameter dasselbe', async () => {
    const html = await seite('order-1', undefined)
    expect(html).toContain('Dieser Link ist nicht gültig')
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('gültige Signatur, Bestellung fehlt: dieselbe ruhige Seite — kein Existenz-Orakel', async () => {
    findUnique.mockResolvedValue(null as never)
    const gueltigOhneBestellung = await seite('order-1', bestellSignatur('order-1'))
    const falscheSignatur = await seite('order-1', 'f'.repeat(64))
    expect(gueltigOhneBestellung).toBe(falscheSignatur)
  })

  it('gültige Signatur zeigt Bestellnummer, Status-Marke, Positionen und Zahlung', async () => {
    findUnique.mockResolvedValue(bestellung() as never)
    const html = await seite('order-1', bestellSignatur('order-1'))
    expect(html).toContain('HM-2611-A4F2')
    expect(html).toContain('Abholbereit')
    expect(html).toContain('Dein Paket wartet')
    expect(html).toContain('Bergkäse')
    expect(html).toContain('Termin in den Kalender')
    expect(html).toContain('Online')
  })

  it('ein stillgelegter Hof verhält sich wie eine unbekannte Bestellung', async () => {
    findUnique.mockResolvedValue(
      bestellung({
        farm: { ...bestellung().farm, archivedAt: new Date('2026-01-01') },
      }) as never
    )
    const html = await seite('order-1', bestellSignatur('order-1'))
    expect(html).toContain('Dieser Link ist nicht gültig')
    expect(html).not.toContain('HM-2611')
  })
})

describe('Bestellseite — „Hof erreichen" nur hinter der Signatur (Nr. 60, S1)', () => {
  const KONTAKT = { phone: '+43 660 0000000', email: 'hof@example.com' }
  const mitKontakt = (teil: Record<string, unknown> = {}) => bestellung({ farm: { ...bestellung().farm, ...KONTAKT }, ...teil })

  it('gültige Signatur: Satz, Nummer und E-Mail des Hofs, Anrufen (tel:) und E-Mail (mailto:)', async () => {
    findUnique.mockResolvedValue(mitKontakt() as never)
    const text = await seite('order-1', bestellSignatur('order-1'))
    expect(text).toContain('Hof erreichen')
    expect(text).toContain('Kommst du später oder kannst du nicht kommen? Sag dem Hof kurz Bescheid.')
    expect(text).toContain(KONTAKT.phone)
    expect(text).toContain(KONTAKT.email)
    const links = await seitenLinks('order-1', bestellSignatur('order-1'))
    expect(links).toContainEqual({ href: `tel:${KONTAKT.phone}`, text: 'Anrufen' })
    expect(links).toContainEqual({ href: `mailto:${KONTAKT.email}`, text: 'E-Mail' })
  })

  it('Telefon und E-Mail des Hofs stehen in der Abfrage, die erst nach der Signatur läuft', async () => {
    findUnique.mockResolvedValue(mitKontakt() as never)
    await seite('order-1', bestellSignatur('order-1'))
    expect(findUnique).toHaveBeenCalledTimes(1)
    expect(findUnique.mock.calls[0][0]).toMatchObject({ select: { farm: { select: { phone: true, email: true } } } })
  })

  it('falsche oder fehlende Signatur: kein „Hof erreichen", keine Nummer — und keine Abfrage', async () => {
    findUnique.mockResolvedValue(mitKontakt() as never)
    for (const s of ['f'.repeat(64), undefined]) {
      const text = await seite('order-1', s)
      expect(text).not.toContain('Hof erreichen')
      expect(text).not.toContain(KONTAKT.phone)
      expect(text).not.toContain(KONTAKT.email)
    }
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('storniert: keine Karte, wie die Abholung — Gegenprobe: die Bestellung steht da', async () => {
    findUnique.mockResolvedValue(mitKontakt({ status: 'CANCELLED' }) as never)
    const text = await seite('order-1', bestellSignatur('order-1'))
    expect(text).toContain('HM-2611-A4F2')
    expect(text).not.toContain('Hof erreichen')
  })
})

describe('Bestellseite — der Ausweg bei ungültigem Link führt zur Hofübersicht', () => {
  /**
   * Ohne gültigen Link ist nicht einmal der Hof bestätigt: Der Ausweg führt
   * nach /hoefe, nie nach /{farmSlug} aus der ungeprüften Adresse — und nie
   * zum echten Hof der Bestellung (das verriete, wem sie gehört). Bis Nr. 54
   * hielt das die Art `bestellung-ungueltig` in src/lib/kunden-kopf.ts fest.
   */
  function erwarteAusweg(links: Array<{ href: string; text: string }>) {
    expect(links).toContainEqual({ href: '/hoefe', text: 'Zur Hofübersicht' })
    for (const link of links) {
      expect(link.href, link.text).not.toMatch(/fremder-hof|hof-probe/)
    }
  }

  it('falsche Signatur', async () => {
    erwarteAusweg(await seitenLinks('order-1', 'f'.repeat(64), 'fremder-hof'))
  })

  it('ohne Signatur', async () => {
    erwarteAusweg(await seitenLinks('order-1', undefined, 'fremder-hof'))
  })

  it('gültige Signatur, aber die Bestellung gibt es nicht', async () => {
    findUnique.mockResolvedValue(null as never)
    erwarteAusweg(await seitenLinks('order-1', bestellSignatur('order-1'), 'fremder-hof'))
  })

  it('gültige Signatur, aber ein fremder Hof in der Adresse', async () => {
    findUnique.mockResolvedValue(bestellung() as never)
    erwarteAusweg(await seitenLinks('order-1', bestellSignatur('order-1'), 'fremder-hof'))
  })

  it('stillgelegter Hof', async () => {
    findUnique.mockResolvedValue(bestellung({ farm: { ...bestellung().farm, archivedAt: new Date('2026-01-01') } }) as never)
    erwarteAusweg(await seitenLinks('order-1', bestellSignatur('order-1')))
  })

  it('Gegenprobe: mit gültigem Link führt „Zum Hof" zum Hof der Bestellung — die Suche findet Links', async () => {
    findUnique.mockResolvedValue(bestellung() as never)
    const links = await seitenLinks('order-1', bestellSignatur('order-1'))
    expect(links).toContainEqual({ href: '/hof-probe', text: 'Zum Hof' })
    expect(links).not.toContainEqual({ href: '/hoefe', text: 'Zur Hofübersicht' })
  })
})

describe('Bestellseite — die angezeigten Beträge (Nr. 54: Bausteine der Bestätigung)', () => {
  /**
   * Die Seite zeigt seit Nr. 54 die Positionen wie /confirm: Zeilen aus dem
   * Snapshot, die Servicegebühr als eigene Zeile und als Summe den Betrag aus
   * bestellSummen (Warenpreis + Gebühr, in Cent). Das Beispiel ist von Hand
   * gerechnet: 12,34 + 3,21 = 15,55 € Ware, 0,49 € Gebühr, 16,04 € gesamt.
   */
  const BEISPIEL = {
    totalAmount: '15.55',
    serviceFeeCents: 49,
    serviceFeeRefundedAt: null,
    items: [
      { productName: 'Bergkäse', quantity: 1, unitPrice: '12.34', totalPrice: '12.34', fehltSeit: null, product: { unit: 'KG', unitSize: null } },
      { productName: 'Heumilch', quantity: 3, unitPrice: '1.07', totalPrice: '3.21', fehltSeit: null, product: { unit: 'LITER', unitSize: null } },
    ],
  }

  it('die Summe kommt aus bestellSummen — in Cent', () => {
    expect(bestellSummen(BEISPIEL)).toEqual({ warenpreisCents: 1555, gebuehrCents: 49, gesamtCents: 1604 })
  })

  it('Positionen, Servicegebühr und Summe stehen so auf der Seite', async () => {
    findUnique.mockResolvedValue(bestellung(BEISPIEL) as never)
    const text = await seite('order-1', bestellSignatur('order-1'))
    expect(text).toContain('€ 12,34')
    expect(text).toContain('€ 3,21')
    // Betrag direkt hinter seiner Bezeichnung: die Gebühr und die Summe mit Zahlart und Stand.
    expect(text).toContain(`${SERVICEGEBUEHR_BEZEICHNUNG}€ 0,49`)
    expect(text).toContain('Online · Bezahlt€ 16,04')
    // Keine zweite, abweichende Summe (früher „Zwischensumme" und „Gesamt").
    expect(text).not.toContain('Zwischensumme')
    expect(text.match(/€ \d+,\d{2}/g)).toEqual(['€ 12,34', '€ 3,21', '€ 0,49', '€ 16,04'])
  })

  it('die Summe kommt aus dem gespeicherten Warenpreis, nie aus den Positionen', async () => {
    // Im Datenmodell fallen beide nicht auseinander: „Artikel fehlt" setzt
    // totalAmount auf den Warenpreis ohne die fehlende Position. Der Test
    // trennt sie absichtlich, damit sichtbar bleibt, woher die Summe kommt —
    // aus dem Snapshot der Bestellung (bestellSummen, CODING_STANDARDS §2),
    // nicht aus einer Summe über die Zeilen.
    findUnique.mockResolvedValue(bestellung({ ...BEISPIEL, totalAmount: '15.00' }) as never)
    const text = await seite('order-1', bestellSignatur('order-1'))
    expect(text).toContain('€ 12,34')
    expect(text).toContain('€ 3,21')
    // 1500 + 49 Cent — nicht 1555 + 49 aus den Zeilen.
    expect(text).toContain('Online · Bezahlt€ 15,49')
    expect(text).not.toContain('€ 16,04')
  })

  it('eine fehlende Position steht da, kostet aber nichts — die Summe bleibt die der Bestellung', async () => {
    findUnique.mockResolvedValue(
      bestellung({
        ...BEISPIEL,
        // Der Hof hat die Heumilch als fehlend gemeldet; totalAmount ist schon ohne sie gespeichert.
        totalAmount: '12.34',
        items: [BEISPIEL.items[0], { ...BEISPIEL.items[1], fehltSeit: new Date('2026-09-03T08:00:00Z') }],
      }) as never
    )
    const text = await seite('order-1', bestellSignatur('order-1'))
    expect(text).toContain('fehlt leider')
    expect(text).toContain('nicht berechnet')
    expect(text).not.toContain('€ 3,21')
    expect(text).toContain('Online · Bezahlt€ 12,83')
  })
})

describe('Bestell-Link — das Zweck-Präfix ist festgenagelt', () => {
  it('die Signatur ist das HMAC über „bestellung-ansehen:{id}", NICHT über die nackte ID', () => {
    // Nagelt das Payload-Schema fest: Eine Änderung bräche alle bereits
    // versendeten Mail-Links UND die Domänentrennung gegenüber
    // reorder-token/unsubscribe (dasselbe Secret) — beides darf kein
    // stiller Refactor lösen.
    const secret = process.env.BETTER_AUTH_SECRET!
    expect(bestellSignatur('order-1')).toBe(
      createHmac('sha256', secret).update('bestellung-ansehen:order-1').digest('hex')
    )
    expect(bestellSignatur('order-1')).not.toBe(
      createHmac('sha256', secret).update('order-1').digest('hex')
    )
  })
})

/**
 * Die Bestätigungsseite /{hof}/confirm/{orderId} — Zugang nur mit signiertem
 * Link, Anzeige nur aus dem Datenbankstand.
 *
 * Beweist an Seite und Bestätigungs-Route selbst (Prisma gemockt):
 *  - Ohne oder mit falscher Signatur zeigt die Seite nur „eingegangen" —
 *    keinen Namen, keine E-Mail, keine Artikel, keine Beträge — und fragt die
 *    Datenbank gar nicht erst (die Bestell-ID ist ratbar und steht u. a. in
 *    den Stripe-Metadaten).
 *  - Mit Signatur: den Namen fragt die Seite nie ab, die E-Mail nur für eine
 *    laufende Bestellung, mit Status-Filter in der Abfrage (Nr. 153).
 *  - ?confirmed=true und ?redirect_status=succeeded ändern den angezeigten
 *    Zustand nicht; „bestätigt" und „bezahlt" kommen nur aus der Datenbank.
 *  - Jeder Weg zur Seite trägt eine gültige Signatur: Checkout-Antwort
 *    (tests/checkout-kunde.test.ts), der Knopf der Bar-Bestätigung
 *    (tests/bar-bestaetigung-zugang.test.ts),
 *    und kein Code baut den Pfad an bestell-link.ts vorbei (Quelltext-Prüfung).
 *
 * Gelesen wird der Text des Elementbaums, wie in tests/bestellverfolgung-zugang.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() } },
}))
// „Erneut senden" ist eine Client-Komponente mit useActionState — hier zählt
// nur, OB die Seite sie zeigt (Nr. 151).
vi.mock('@/components/bestaetigung/bar-link-erneut-senden', async () => {
  const { createElement } = await import('react')
  return {
    BarLinkErneutSenden: ({ orderId }: { orderId: string }) => createElement('span', null, `ERNEUT:${orderId}`),
  }
})
// Die Karte „Neuigkeiten vom Hof" ist eine Client-Komponente — hier zählt nur,
// OB sie steht und welche Adresse die Seite ihr gibt (Nr. 153).
vi.mock('@/components/bestaetigung/neuigkeiten-karte', async () => {
  const { createElement } = await import('react')
  return {
    NeuigkeitenKarte: ({ email }: { email?: string }) => createElement('span', null, `KARTE:${email ?? 'ohne Adresse'}`),
  }
})
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendOrderConfirmation: vi.fn(), sendOrderConfirmedToFarmer: vi.fn() }))

import ConfirmPage from '@/app/(public)/[farmSlug]/confirm/[orderId]/page'
import { GET as bestaetigeLink } from '@/app/api/orders/confirm/[token]/route'
import { bestellSignatur } from '@/lib/bestell-link'
import { LAUFENDE_STATUS } from '@/lib/bestellungen-finden'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { prisma } from '@/lib/prisma'

const findUnique = vi.mocked(prisma.order.findUnique)
const findFirst = vi.mocked(prisma.order.findFirst)
const updateMany = vi.mocked(prisma.order.updateMany)

/**
 * Eine Bestellung mit allen Feldern, die eine Abfrage der Seite verlangen
 * könnte — erfundene Daten. Was die Seite davon bekommt, entscheidet die
 * Attrappe `datenbank` nach `select` und `where` (Nr. 153): Name und E-Mail
 * stehen hier, damit ein Fund im HTML beweist, dass die Seite sie abgefragt hat.
 */
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

type Frage = { where?: { id?: string; status?: { in?: readonly string[] } }; select?: Record<string, unknown> }

/**
 * Die Attrappe der Datenbank (Nr. 153): Sie liefert genau die Felder aus
 * `select` (oberste Ebene) und beachtet einen Status-Filter in `where` — so
 * wie Prisma. Ohne Select käme alles; die Seite fragt nie ohne.
 */
function datenbank(order: Record<string, unknown>) {
  findUnique.mockImplementation((async (frage: Frage) => {
    const erlaubt = frage.where?.status?.in
    if (erlaubt && !erlaubt.includes(String(order.status))) return null
    if (!frage.select) return order
    return Object.fromEntries(Object.keys(frage.select).filter((k) => k in order).map((k) => [k, order[k]]))
  }) as never)
}

/** Alle Selects, die die Seite an die Datenbank geschickt hat. */
const selects = () => findUnique.mock.calls.map(([frage]) => (frage as Frage).select ?? {})

beforeEach(() => {
  vi.clearAllMocks()
  datenbank(bestellung())
  findFirst.mockResolvedValue(bestellung() as never)
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

  it('eine doppelt angegebene Signatur gilt als fehlend', async () => {
    const element = await ConfirmPage({
      params: Promise.resolve({ farmSlug: 'hof-test', orderId: 'order-1' }),
      searchParams: Promise.resolve({ sig: [GUELTIG, GUELTIG] }),
    })

    expect(await elementText(element)).toContain('Deine Bestellung ist eingegangen')
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

describe('Bestätigungsseite — „Hof erreichen" nur hinter der Signatur (Nr. 60, S1)', () => {
  const KONTAKT = { phone: '+43 660 0000000', email: 'hof@example.com' }
  // So zeigt „Hof erreichen“ die gespeicherte Nummer (Nr. 81, N8).
  const ANZEIGE = '+43 660 000 0000'
  // Bar bestätigt: Die Bestellung steht, die Abholkarte erscheint.
  const steht = (teil: Record<string, unknown> = {}) =>
    bestellung({ status: 'CONFIRMED', farm: { ...bestellung().farm, ...KONTAKT }, ...teil })

  it('Bestellung steht: Satz, Nummer und E-Mail des Hofs', async () => {
    datenbank(steht())
    const text = await seite({ sig: GUELTIG })
    expect(text).toContain('Hof erreichen')
    expect(text).toContain('Kommst du später oder kannst du nicht kommen? Sag dem Hof kurz Bescheid.')
    expect(text).toContain(ANZEIGE)
    expect(text).toContain(KONTAKT.email)
  })

  it('Telefon und E-Mail des Hofs stehen in der Abfrage der Bestellung, die erst nach der Signatur läuft', async () => {
    datenbank(steht())
    await seite({ sig: GUELTIG })
    const mitHof = findUnique.mock.calls.map(([frage]) => frage).find((frage) => 'farm' in (frage.select ?? {}))
    expect(mitHof).toMatchObject({ select: { farm: { select: { phone: true, email: true } } } })
  })

  it('ohne oder mit falscher Signatur: kein „Hof erreichen", keine Nummer — und keine Abfrage', async () => {
    datenbank(steht())
    for (const suche of [{}, { sig: 'f'.repeat(64) }]) {
      const text = await seite(suche)
      expect(text).not.toContain('Hof erreichen')
      expect(text).not.toContain(KONTAKT.phone)
      expect(text).not.toContain(ANZEIGE)
      expect(text).not.toContain(KONTAKT.email)
    }
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('bar noch nicht bestätigt: keine Karte — erst, wenn die Bestellung steht', async () => {
    datenbank(steht({ status: 'PENDING_CONFIRMATION' }))
    const text = await seite({ sig: GUELTIG })
    expect(text).toContain('HT-0210-A4F2')
    expect(text).not.toContain('Hof erreichen')
    expect(text).not.toContain(KONTAKT.phone)
    expect(text).not.toContain(ANZEIGE)
  })
})

describe('Bestätigungsseite — Zustand nur aus der Datenbank', () => {
  it('?confirmed=true bei unbestätigter Bestellung zeigt nicht „bestätigt"', async () => {
    const text = await seite({ sig: GUELTIG, confirmed: 'true' })

    expect(text).not.toContain('Bestellung bestätigt')
    expect(text).toContain('bitte bestätige per E-Mail')
  })

  it('bestätigt in der Datenbank: „bestätigt", auch ohne Parameter', async () => {
    datenbank(bestellung({ status: 'CONFIRMED' }))

    expect(await seite({ sig: GUELTIG })).toContain('Bestellung bestätigt')
  })

  it('?redirect_status=succeeded vor dem Webhook: „Zahlung wird geprüft", nicht „erfolgreich"', async () => {
    datenbank(bestellung({ paymentMethod: 'ONLINE', paymentStatus: 'PENDING' }))

    const text = await seite({ sig: GUELTIG, redirect_status: 'succeeded' })

    expect(text).not.toContain('Zahlung erfolgreich')
    expect(text).toContain('Zahlung wird geprüft')
  })

  it('bezahlt in der Datenbank: „Zahlung erfolgreich"', async () => {
    datenbank(bestellung({ paymentMethod: 'ONLINE', paymentStatus: 'PAID', status: 'PAID' }))

    expect(await seite({ sig: GUELTIG })).toContain('Zahlung erfolgreich')
  })

  it('eine stornierte Online-Bestellung wird durch ?redirect_status=succeeded nicht „erfolgreich"', async () => {
    datenbank(bestellung({ paymentMethod: 'ONLINE', paymentStatus: 'PENDING', status: 'CANCELLED' }))

    const text = await seite({ sig: GUELTIG, redirect_status: 'succeeded' })

    expect(text).not.toContain('Zahlung erfolgreich')
    expect(text).not.toContain('Zahlung wird geprüft')
  })

  it('Online und noch nicht bezahlt: die Zahlungszeile sagt „Noch offen", nicht „bezahlt"', async () => {
    datenbank(bestellung({ paymentMethod: 'ONLINE', paymentStatus: 'PENDING' }))

    const text = await seite({ sig: GUELTIG })

    expect(text).not.toContain('Online bezahlt')
    expect(text).toContain('Online · Noch offen')
  })

  it('ein unbekannter redirect_status ist kein Hinweis', async () => {
    datenbank(bestellung({ paymentMethod: 'ONLINE', paymentStatus: 'PENDING' }))

    expect(await seite({ sig: GUELTIG, redirect_status: 'paid' })).not.toContain('Zahlung wird geprüft')
  })
})

describe('„Mail nicht bekommen? Erneut senden" (Nr. 151) — nur bei einer offenen Barbestellung', () => {
  const IN_DER_FRIST = new Date('2026-10-02T08:30:00Z')
  const NACH_DER_FRIST = new Date('2026-10-02T10:30:00Z')

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(IN_DER_FRIST)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('offen, bar: der Knopf steht da', async () => {
    expect(await seite({ sig: GUELTIG })).toContain('ERNEUT:order-1')
  })

  it('offen, Karte beim Hof: der Knopf steht da', async () => {
    datenbank(bestellung({ paymentMethod: 'ONSITE_CARD' }))
    expect(await seite({ sig: GUELTIG })).toContain('ERNEUT:order-1')
  })

  it('ohne gültige Signatur: kein Knopf', async () => {
    expect(await seite({ sig: 'f'.repeat(64) })).not.toContain('ERNEUT')
  })

  it.each([
    ['bestätigt', { status: 'CONFIRMED' }],
    ['storniert', { status: 'CANCELLED', cancelReason: 'Von der Kundin vor der Bestätigung storniert' }],
    ['online', { paymentMethod: 'ONLINE', paymentStatus: 'PENDING' }],
  ])('%s: kein Knopf', async (_name, teil) => {
    datenbank(bestellung(teil))
    expect(await seite({ sig: GUELTIG })).not.toContain('ERNEUT')
  })

  it('nach der Frist: kein Knopf, auch wenn noch niemand aufgeräumt hat', async () => {
    vi.setSystemTime(NACH_DER_FRIST)
    expect(await seite({ sig: GUELTIG })).not.toContain('ERNEUT')
  })
})

describe('Nach Abschluss keine Personendaten (Register S17 Punkt 3, Nr. 153)', () => {
  const ADRESSE = 'max@example.org'
  const NAME = 'Max Mustermann'

  it('kein Select der Seite verlangt je den Namen der Kundin — auch bei einer offenen Bestellung', async () => {
    await seite({ sig: GUELTIG })
    expect(selects().length).toBeGreaterThan(0)
    for (const select of selects()) expect(select).not.toHaveProperty('customerName')
  })

  it.each([
    ['abgeholt (online bezahlt)', { status: 'PICKED_UP', paymentMethod: 'ONLINE', paymentStatus: 'PAID' }],
    ['abgeholt (bar)', { status: 'PICKED_UP', paymentStatus: 'PAID' }],
    ['storniert', { status: 'CANCELLED', cancelReason: 'Vom Hof storniert' }],
    ['storniert (online bezahlt)', { status: 'CANCELLED', paymentMethod: 'ONLINE', paymentStatus: 'PAID' }],
    ['nicht abgeholt', { status: 'NOT_PICKED_UP', paymentMethod: 'ONLINE', paymentStatus: 'PAID' }],
  ])('%s: keine Adresse im HTML und in keinem Select — die Bestellung steht weiter da', async (_name, teil) => {
    datenbank(bestellung(teil))
    const text = await seite({ sig: GUELTIG })
    expect(text).not.toContain(ADRESSE)
    expect(text).not.toContain(NAME)
    for (const select of selects()) expect(select).not.toHaveProperty('customerEmail')
    expect(text).toContain('HT-0210-A4F2')
    expect(text).toContain('Bergkäse')
  })

  it('abgeholt und online bezahlt: die Karte „Neuigkeiten vom Hof" bleibt — ohne Adresse', async () => {
    datenbank(bestellung({ status: 'PICKED_UP', paymentMethod: 'ONLINE', paymentStatus: 'PAID' }))
    const text = await seite({ sig: GUELTIG })
    expect(text).toContain('Abgeholt – danke für deinen Einkauf!')
    expect(text).toContain('KARTE:ohne Adresse')
    expect(text).not.toContain('unterwegs an')
  })

  it.each([
    // Bar offen: Die Frist der erfundenen Bestellung ist vorbei, die Karte steht nicht (neuigkeitenErlaubt) — der Kopf nennt die Adresse.
    ['bar offen', {}, false],
    ['online bezahlt', { status: 'PAID', paymentMethod: 'ONLINE', paymentStatus: 'PAID' }, true],
    ['bar bestätigt', { status: 'CONFIRMED' }, true],
    ['abholbereit', { status: 'READY', paymentMethod: 'ONLINE', paymentStatus: 'PAID' }, true],
  ])('Gegenprobe %s: die Adresse steht wie bisher — geholt mit Status-Filter, erst nach der Fristfreigabe', async (_name, teil, karte) => {
    datenbank(bestellung(teil))
    const text = await seite({ sig: GUELTIG })
    expect(text).toContain(ADRESSE)
    if (karte) expect(text).toContain(`KARTE:${ADRESSE}`)
    const mitAdresse = findUnique.mock.calls.filter(([frage]) => 'customerEmail' in ((frage as Frage).select ?? {}))
    expect(mitAdresse).toHaveLength(1)
    expect(mitAdresse[0][0]).toEqual({
      where: { id: 'order-1', status: { in: LAUFENDE_STATUS } },
      select: { customerEmail: true },
    })
    // Die Hauptabfrage (mit Hof) kennt die Adresse nicht.
    const mitHof = selects().find((select) => 'farm' in select)
    expect(mitHof).not.toHaveProperty('customerEmail')
    // Erst nach gibVerwaisteFreiOhneRisiko — sonst sähe eine verfallene Bestellung noch „offen" aus.
    const freigabe = vi.mocked(gibVerwaisteFreiOhneRisiko).mock.invocationCallOrder[0]
    const adressFrage = findUnique.mock.invocationCallOrder[findUnique.mock.calls.findIndex(([f]) => 'customerEmail' in ((f as Frage).select ?? {}))]
    expect(freigabe).toBeLessThan(adressFrage)
  })

  it('schließt die Bestellung zwischen den Abfragen ab: keine Adresse — der Status-Filter gilt in der Abfrage selbst', async () => {
    const offen = bestellung({ status: 'PAID', paymentMethod: 'ONLINE', paymentStatus: 'PAID' })
    datenbank(offen)
    const vorher = findUnique.getMockImplementation()
    findUnique.mockImplementation((async (frage: Frage) =>
      frage.select && 'customerEmail' in frage.select ? null : vorher?.(frage as never)) as never)
    const text = await seite({ sig: GUELTIG })
    expect(text).not.toContain(ADRESSE)
    expect(text).toContain('Zahlung erfolgreich')
  })
})

describe('Bestätigungslink aus der Mail (/api/orders/confirm/[token])', () => {
  // Seit H3 bestätigt der Link nicht mehr selbst: Er führt zur Seite mit dem
  // Knopf (/{hof}/bestaetigen/{token}); erst der Knopf bestätigt und leitet
  // dann signiert hierher weiter (tests/bar-bestaetigung-zugang.test.ts).
  const MAIL_TOKEN = 'mail-token-0123456789abcdef'
  const klick = () =>
    bestaetigeLink(new NextRequest(`http://localhost:3000/api/orders/confirm/${MAIL_TOKEN}`), {
      params: Promise.resolve({ token: MAIL_TOKEN }),
    })

  it('leitet auf die Seite mit dem Knopf weiter — ohne ?confirmed, ohne zu bestätigen', async () => {
    const ziel = new URL((await klick()).headers.get('location') ?? '')

    expect(ziel.pathname).toBe(`/hof-test/bestaetigen/${MAIL_TOKEN}`)
    expect(ziel.searchParams.has('confirmed')).toBe(false)
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('auch der zweite Klick schreibt nichts', async () => {
    await klick()
    await klick()

    expect(updateMany).not.toHaveBeenCalled()
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
  }, 30_000)
})

describe('Die Signatur einer Bestellung öffnet genau zwei Schreibwege (Nr. 46, Runde 1; Nr. 151)', () => {
  /** Alle .ts/.tsx unter src/, rekursiv. */
  function quellen(ordner: string): string[] {
    return readdirSync(ordner).flatMap((name) => {
      const pfad = join(ordner, name)
      if (statSync(pfad).isDirectory()) return quellen(pfad)
      return /\.(ts|tsx)$/.test(name) ? [pfad] : []
    })
  }
  /** Ohne Kommentare — eine Erwähnung im Kommentar ist kein Zugang. */
  const ohneKommentare = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const PRUEFT_SIGNATUR = /\bbestellLinkGilt\(/
  const LESEWEGE = [
    'src/app/(public)/[farmSlug]/bestellung/[orderId]/kalender/route.ts',
    'src/app/(public)/[farmSlug]/bestellung/[orderId]/page.tsx',
    // Nr. 202: „Erneut versuchen" — die Kasse liest Bestellung und gespeicherten Zahlungsvorgang, schreibt nichts.
    'src/app/(public)/[farmSlug]/checkout/page.tsx',
    'src/app/(public)/[farmSlug]/confirm/[orderId]/page.tsx',
  ]

  it('lesen: Bestätigungsseite, Bestellseite, Kalender — schreiben: nur meldeNeuigkeitenAn und sendeBarLinkErneut', () => {
    const treffer = quellen(join(process.cwd(), 'src'))
      .filter((pfad) => !pfad.endsWith(join('lib', 'bestell-link.ts')))
      .filter((pfad) => PRUEFT_SIGNATUR.test(ohneKommentare(readFileSync(pfad, 'utf8'))))
      .map((pfad) => pfad.slice(process.cwd().length + 1))
      .sort()
    // Zweiter Schreibweg seit Nr. 151 (Register S17 Punkt 2, Freigabe §27):
    // „Erneut senden" (sendeBarLinkErneut) — Mail nur an die Adresse der
    // Bestellung, nur offen, drei je Tag, immer dieselbe Antwort.
    expect(treffer).toEqual([...LESEWEGE, 'src/server/actions/bar-bestaetigung.ts', 'src/server/actions/neuigkeiten.ts'].sort())
  }, 30_000)

  it('die Lesewege schreiben nicht: keine Server Action, keine Route außer GET', () => {
    for (const pfad of LESEWEGE) {
      const text = ohneKommentare(readFileSync(join(process.cwd(), pfad), 'utf8'))
      expect(text, pfad).not.toMatch(/^\s*['"]use server['"]/m)
      expect(text, pfad).not.toMatch(/export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/)
    }
  })

  it('Gegenprobe: ein Aufruf im Kommentar zählt nicht, einer im Code schon', () => {
    expect(PRUEFT_SIGNATUR.test(ohneKommentare('// bestellLinkGilt(orderId, sig) prüft …'))).toBe(false)
    expect(PRUEFT_SIGNATUR.test(ohneKommentare('if (!bestellLinkGilt(orderId, sig)) return'))).toBe(true)
    expect('export async function POST(request: Request) {}').toMatch(/export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/)
  })
})

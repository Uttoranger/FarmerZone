/**
 * Alle Mail-Wege auf die Warteschlange (Register N26, Nr. 159) ohne Datenbank:
 *  - Jeder Auftrag, den ein Aufrufer baut, hat den Weg aus MAIL_WEG, einen
 *    fachlichen Schlüssel, die Bestellung (wo es eine gibt) und einen Bezug,
 *    den `bezugSchemaFuer` annimmt — nur Kennungen und beim Ereignis
 *    feststehende Beträge, nie Adresse, Text oder Token (Gegenprobe).
 *  - Betreiber-Mails: je Adresse der Liste ein Auftrag; die feste Adresse heißt
 *    `support`, eine weitere ihre Kennung; eine entfernte fällt weg.
 *  - Je Renderer: Er lädt frisch, baut die Mail mit der Vorlage aus email.ts an
 *    die heutige Adresse und verwirft, wenn der Bezug fehlt.
 *  - „n per E-Mail" kommt aus der Warteschlange (gesendeteBeitragsMails), für
 *    Beiträge ohne Aufträge aus der alten Zahl.
 * Was die echte Datenbank tun muss (Rollback, zweimal einstellen, 1.000 Abos),
 * prüft tests/integration/mail-wege.int.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const db = vi.hoisted(() => ({
  order: { findUnique: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
  farm: { findUnique: vi.fn(), count: vi.fn() },
  meldung: { findUnique: vi.fn(), count: vi.fn() },
  kostenposten: { findMany: vi.fn() },
  nachricht: { findUnique: vi.fn() },
  unterhaltung: { findUnique: vi.fn() },
  customerFarmSubscription: { findUnique: vi.fn(), findFirst: vi.fn() },
  statusPost: { findFirst: vi.fn() },
  betreiberEmpfaenger: { findMany: vi.fn(), findFirst: vi.fn() },
  mailAuftrag: { updateMany: vi.fn() },
  $queryRaw: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/server/queries/postfach', () => ({ ladeBetreiberEmpfaenger: vi.fn(), zaehleOffenImEingang: vi.fn() }))
vi.mock('@/server/queries/meldung', () => ({ zaehleFuerWochenlauf: vi.fn() }))
vi.mock('@/server/beitrag-vorname', () => ({ vornamenAusBestellungen: vi.fn(async () => new Map()), vornameFuer: () => '', setzeVorname: (t: string) => t }))

import { SUPPORT_EMAIL } from '@/lib/support'
import { MAIL_WEG, VORRANG, bezugSchemaFuer, type MailArt } from '@/schemas/mail-auftrag'
import type { EinstellAuftrag } from '@/server/mail-warteschlange'
import { RENDERER } from '@/server/mail-arten'
import {
  StornoErstattungAusstehend,
  artikelFehltMailAuftrag,
  bestellMailAuftrag,
  stornoMailAuftrag,
  trageStornoErstattungEin,
  zahlungZuSpaetMailAuftrag,
} from '@/server/mail-arten/bestellung'
import { betreiberAuftraege, betreiberKennungen, empfaengerKennungen, erstattungOffenBezug } from '@/server/mail-arten/betreiber'
import { ankuendigungAuftrag, freischaltungAuftrag, lastschriftGescheitertAuftrag, postfachAntwortAuftrag, rundschreibenAuftraege } from '@/server/mail-arten/hof'
import { aboBestaetigungAuftrag, bescheidAuftraege } from '@/server/mail-arten/kundin'
import { beitragAuftraege, gesendeteBeitragsMails } from '@/server/mail-arten/beitrag'
import { widerrufErgebnisAuftrag, widerrufHofAuftrag } from '@/server/mail-arten/widerruf'
import { ladeBetreiberEmpfaenger, zaehleOffenImEingang } from '@/server/queries/postfach'
import { zaehleFuerWochenlauf } from '@/server/queries/meldung'
import type { StapelMail } from '@/lib/email'

const BESTELLUNG = { id: 'cbestellung0000000000001', farmId: 'chof00000000000000000001' }
const JETZT = new Date('2026-10-24T08:00:00.000Z')

/** Jeder Auftrag, den ein Aufrufer bauen kann — je Art mindestens einer. */
const AUFTRAEGE: EinstellAuftrag[] = [
  bestellMailAuftrag('bestellung-bestaetigung', BESTELLUNG),
  bestellMailAuftrag('bestellung-bezahlt-hof', BESTELLUNG),
  bestellMailAuftrag('bar-bestaetigt-hof', BESTELLUNG),
  bestellMailAuftrag('abholbereit', BESTELLUNG, JETZT),
  bestellMailAuftrag('nicht-abholbereit', BESTELLUNG, JETZT),
  bestellMailAuftrag('verfallen', BESTELLUNG),
  stornoMailAuftrag(BESTELLUNG, true),
  stornoMailAuftrag(BESTELLUNG, false),
  artikelFehltMailAuftrag(BESTELLUNG, { itemId: 'cposition000000000000001', bisherCents: 1082, neuCents: 632, erstattetCents: 450 }),
  zahlungZuSpaetMailAuftrag(BESTELLUNG, 2137),
  ...betreiberAuftraege(
    'erstattung-offen',
    're_123',
    ['support'],
    erstattungOffenBezug({ fall: 'zurueckgenommen', orderId: BESTELLUNG.id, refundId: 're_123', kundinCents: 500 }),
    { bestellungId: BESTELLUNG.id }
  ),
  ...betreiberAuftraege('neuer-hof', BESTELLUNG.farmId, ['support'], { farmId: BESTELLUNG.farmId }, { farmId: BESTELLUNG.farmId }),
  ...betreiberAuftraege('meldung', 'cmeldung0000000000000001', ['support'], { meldungId: 'cmeldung0000000000000001' }),
  ...betreiberAuftraege('wochenbericht', '2026-10-24', ['support'], { geloeschtAnzahl: '3' }),
  ...betreiberAuftraege('antwort-an-team', 'cnachricht00000000000001', ['support'], { nachrichtId: 'cnachricht00000000000001' }),
  ...betreiberAuftraege('betreiber-testmail', '1761292800000', ['support'], {}),
  freischaltungAuftrag(BESTELLUNG.farmId, JETZT),
  ankuendigungAuftrag(BESTELLUNG.farmId),
  lastschriftGescheitertAuftrag('cabrechnung0000000000001', BESTELLUNG.farmId, 1),
  postfachAntwortAuftrag('cnachricht00000000000001', BESTELLUNG.farmId),
  ...rundschreibenAuftraege([{ id: 'cfaden000000000000000001', farmId: BESTELLUNG.farmId }]),
  aboBestaetigungAuftrag({ id: 'cabo00000000000000000001', farmId: BESTELLUNG.farmId }, JETZT),
  ...bescheidAuftraege(['cmeldung0000000000000001'], JETZT),
  ...beitragAuftraege({ id: 'cbeitrag0000000000000001', farmId: BESTELLUNG.farmId }, ['cabo00000000000000000001']),
  // Nr. 200: Widerruf an den Hof und das Ergebnis an die Kundin (online mit Betrag, bar ohne, abgelehnt).
  widerrufHofAuftrag('cwiderruf000000000000001', BESTELLUNG),
  widerrufErgebnisAuftrag('widerruf-erstattet', 'cwiderruf000000000000001', BESTELLUNG, 1238),
  widerrufErgebnisAuftrag('widerruf-erstattet', 'cwiderruf000000000000002', BESTELLUNG),
  widerrufErgebnisAuftrag('widerruf-abgelehnt', 'cwiderruf000000000000001', BESTELLUNG),
]

const ZU_BESTELLUNGEN: readonly MailArt[] = [
  'bestellung-bestaetigung',
  'bestellung-bezahlt-hof',
  'bar-bestaetigt-hof',
  'abholbereit',
  'nicht-abholbereit',
  'storniert',
  'artikel-fehlt',
  'verfallen',
  'zahlung-zu-spaet',
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Aufträge: Weg, Schlüssel, Bestellung, Bezug', () => {
  it('jede eingestellte Art ist dabei, keine Sofort-Art', () => {
    const arten = new Set(AUFTRAEGE.map((a) => a.art))
    expect([...arten].sort()).toEqual(Object.keys(RENDERER).sort())
  })

  it.each(AUFTRAEGE.map((a) => [a.schluessel, a] as const))('%s: Weg aus MAIL_WEG, Bezug angenommen, Schlüssel beginnt mit der Art', (_s, a) => {
    expect(a.vorrang).toBe(VORRANG[MAIL_WEG[a.art]])
    expect(bezugSchemaFuer(a.art).safeParse(a.bezug).success).toBe(true)
    expect(a.schluessel.startsWith(`${a.art}:`)).toBe(true)
    if (ZU_BESTELLUNGEN.includes(a.art)) expect(a.bestellungId).toBe(BESTELLUNG.id)
  })

  it('Gegenprobe: eine Adresse, ein Text, ein Token oder ein fremdes Feld im Bezug werden abgelehnt', () => {
    expect(bezugSchemaFuer('storniert').safeParse({ orderId: BESTELLUNG.id, erstattetCents: '20,98' }).success).toBe(false)
    expect(bezugSchemaFuer('storniert').safeParse({ orderId: BESTELLUNG.id, erstattung: 'irgendwas' }).success).toBe(false)
    // Betrag und Stand zugleich wären widersprüchlich.
    expect(bezugSchemaFuer('storniert').safeParse({ orderId: BESTELLUNG.id, erstattetCents: '1', erstattung: 'ausstehend' }).success).toBe(false)
    expect(bezugSchemaFuer('artikel-fehlt').safeParse({ orderId: BESTELLUNG.id, itemId: 'kundin@example.com', bisherCents: '1', neuCents: '1' }).success).toBe(false)
    expect(bezugSchemaFuer('abo-bestaetigung').safeParse({ aboId: 'cabo1', token: 'x' }).success).toBe(false)
    expect(bezugSchemaFuer('erstattung-offen').safeParse({ empfaengerId: 'support', fall: 'Das Geld fehlt' }).success).toBe(false)
    expect(bezugSchemaFuer('bescheid').safeParse({ meldungId: 'Danke für deinen Wunsch' }).success).toBe(false)
  })

  it('wiederholbare Statusmails tragen den Zeitpunkt, einmalige nicht — zweimal eingestellt heißt einmal verschickt', () => {
    expect(bestellMailAuftrag('abholbereit', BESTELLUNG, JETZT).schluessel).toBe(`abholbereit:${BESTELLUNG.id}:${JETZT.getTime()}`)
    expect(bestellMailAuftrag('bestellung-bestaetigung', BESTELLUNG).schluessel).toBe(`bestellung-bestaetigung:${BESTELLUNG.id}`)
    expect(stornoMailAuftrag(BESTELLUNG, true).schluessel).toBe(stornoMailAuftrag(BESTELLUNG, false).schluessel)
  })
})

describe('Betreiber: je Adresse ein Auftrag, Kennung statt Adresse', () => {
  it('feste Adresse → support, weitere → ihre Kennung, entfernte fällt weg, Groß-/Kleinschreibung egal', async () => {
    db.betreiberEmpfaenger.findMany.mockResolvedValue([{ id: 'cteam1', email: 'Team@Example.com' }])
    expect(await empfaengerKennungen([SUPPORT_EMAIL.toLowerCase(), 'team@example.com', 'weg@example.com'])).toEqual(['support', 'cteam1'])
    expect(db.betreiberEmpfaenger.findMany.mock.calls[0]![0]).toMatchObject({ where: { bestaetigtAm: { not: null } } })
  })

  it('leere Liste (Regel aus) → keine Kennung, keine Abfrage, kein Auftrag', async () => {
    vi.mocked(ladeBetreiberEmpfaenger).mockResolvedValue([])
    expect(await betreiberKennungen('hofWartet')).toEqual([])
    expect(db.betreiberEmpfaenger.findMany).not.toHaveBeenCalled()
    expect(betreiberAuftraege('neuer-hof', 'h1', [], { farmId: 'h1' })).toEqual([])
  })

  it('der Schlüssel nennt Grund und Empfänger: an eine Adresse höchstens einmal', () => {
    const [a, b] = betreiberAuftraege('meldung', 'm1', ['support', 'cteam1'], { meldungId: 'm1' })
    expect([a!.schluessel, b!.schluessel]).toEqual(['meldung:m1:support', 'meldung:m1:cteam1'])
    expect(a!.bezug).toEqual({ meldungId: 'm1', empfaengerId: 'support' })
  })
})

const ORDER = {
  id: BESTELLUNG.id,
  farmId: BESTELLUNG.farmId,
  orderNumber: 'HT-2410-TEST',
  customerName: 'Erika Beispiel',
  customerEmail: 'erika@example.org',
  customerPhone: '+43 660 0000000',
  totalAmount: '10.30',
  serviceFeeCents: 52,
  createdAt: new Date('2026-10-24T07:00:00Z'),
  pickupDate: new Date('2026-10-25T12:00:00Z'),
  pickupTimeStart: '15:00',
  pickupTimeEnd: '18:00',
  paymentMethod: 'ONLINE',
  stripePaymentIntentId: 'pi_1',
  cancelReason: 'Hof krank',
  status: 'READY',
  farm: { id: BESTELLUNG.farmId, name: 'Hof Beispiel', slug: 'hof-beispiel', email: 'hof@example.org', ownerName: 'Max', address: 'Weg 1', postalCode: '4910', city: 'Ried', phone: '+43 664 0000000' },
  items: [{ id: 'cposition000000000000001', productName: 'Freilandeier', quantity: 1, unitPrice: '4.50', totalPrice: '4.50', product: null }],
}

async function rendere(art: MailArt, bezug: Record<string, string>): Promise<StapelMail | { verworfen: string }> {
  const renderer = RENDERER[art]
  if (!renderer) throw new Error(`kein Renderer für ${art}`)
  return renderer(bezugSchemaFuer(art).parse(bezug))
}

function alsMail(ergebnis: StapelMail | { verworfen: string }): StapelMail {
  if ('verworfen' in ergebnis) throw new Error(`verworfen: ${ergebnis.verworfen}`)
  return ergebnis
}

describe('Renderer: frisch geladen, Vorlage aus email.ts, heutige Adresse', () => {
  it.each([
    ['bestellung-bestaetigung', 'erika@example.org', 'Deine Bestellung bei Hof Beispiel'],
    ['bestellung-bezahlt-hof', 'hof@example.org', 'Neue Bestellung für'],
    ['bar-bestaetigt-hof', 'hof@example.org', 'Neue Vor-Ort-Bestellung'],
    ['abholbereit', 'erika@example.org', 'bereit zur Abholung'],
    ['nicht-abholbereit', 'erika@example.org', 'Kurzes Update'],
    ['verfallen', 'erika@example.org', 'verfallen'],
  ] as const)('%s an %s', async (art, an, betreff) => {
    db.order.findUnique.mockResolvedValue(ORDER)
    const mail = alsMail(await rendere(art, { orderId: ORDER.id }))
    expect(mail.an).toBe(an)
    expect(mail.betreff).toContain(betreff)
    expect(mail.html).toContain('HT-2410-TEST')
    expect(db.order.findUnique.mock.calls[0]![0]).toMatchObject({ where: { id: ORDER.id } })
  }, 30_000)

  it('Storno: Betrag aus dem Auftrag (nie neu gerechnet), Grund aus der Bestellung', async () => {
    db.order.findUnique.mockResolvedValue(ORDER)
    const mail = alsMail(await rendere('storniert', { orderId: ORDER.id, erstattetCents: '2098' }))
    expect(mail.html).toContain('20,98')
    expect(mail.html).toContain('Hof krank')
  })

  it('Storno online: eingestellt mit „ausstehend", bis Stripe geantwortet hat; „offen" → keine Mail', async () => {
    expect(stornoMailAuftrag(BESTELLUNG, true).bezug).toEqual({ orderId: BESTELLUNG.id, erstattung: 'ausstehend' })
    expect(stornoMailAuftrag(BESTELLUNG, false).bezug).toEqual({ orderId: BESTELLUNG.id })
    db.order.findUnique.mockResolvedValue(ORDER)
    // Der Worker versucht es nach seinem Plan wieder (Renderer wirft).
    await expect(rendere('storniert', { orderId: ORDER.id, erstattung: 'ausstehend' })).rejects.toThrow(StornoErstattungAusstehend)
    expect(await rendere('storniert', { orderId: ORDER.id, erstattung: 'offen' })).toEqual({ verworfen: 'erstattung_offen' })
    db.order.findUnique.mockResolvedValue(null)
    expect(await rendere('storniert', { orderId: ORDER.id, erstattung: 'ausstehend' })).toEqual({ verworfen: 'bestellung_fehlt' })
  })

  it('Storno nachgetragen: Betrag von Stripe oder „offen", nur in einen nicht fertigen Auftrag', async () => {
    await trageStornoErstattungEin(ORDER.id, { erstattetCents: 2098 })
    await trageStornoErstattungEin(ORDER.id, 'offen')
    expect(db.mailAuftrag.updateMany.mock.calls).toEqual([
      [{ where: { schluessel: `storniert:${ORDER.id}`, status: { in: ['offen', 'in_arbeit'] } }, data: { bezug: { orderId: ORDER.id, erstattetCents: '2098' } } }],
      [{ where: { schluessel: `storniert:${ORDER.id}`, status: { in: ['offen', 'in_arbeit'] } }, data: { bezug: { orderId: ORDER.id, erstattung: 'offen' } } }],
    ])
  })

  it('„Artikel fehlt": Position und Beträge; ohne Erstattung gilt vor Ort', async () => {
    db.order.findUnique.mockResolvedValue(ORDER)
    const online = alsMail(await rendere('artikel-fehlt', { orderId: ORDER.id, itemId: ORDER.items[0].id, bisherCents: '1082', neuCents: '632', erstattetCents: '450' }))
    expect(online.html).toContain('Freilandeier')
    expect(online.html).toContain('4,50')
    db.order.findUnique.mockResolvedValue(ORDER)
    const fehlt = await rendere('artikel-fehlt', { orderId: ORDER.id, itemId: 'cunbekannt00000000000001', bisherCents: '1', neuCents: '1' })
    expect(fehlt).toEqual({ verworfen: 'bestellung_fehlt' })
  })

  it('Zahlung zu spät: der erstattete Betrag aus dem Auftrag', async () => {
    db.order.findUnique.mockResolvedValue(ORDER)
    expect(alsMail(await rendere('zahlung-zu-spaet', { orderId: ORDER.id, erstattetCents: '2137' })).html).toContain('21,37')
  })

  it('abholbereit nur, solange die Bestellung bereit ist (Nr. 195, A4); Gegenprobe: bereit geht hinaus', async () => {
    for (const status of ['PAID', 'CONFIRMED', 'IN_PREPARATION', 'PICKED_UP', 'CANCELLED']) {
      db.order.findUnique.mockResolvedValue({ ...ORDER, status })
      expect(await rendere('abholbereit', { orderId: ORDER.id }), status).toEqual({ verworfen: 'nicht_mehr_bereit' })
    }
    db.order.findUnique.mockResolvedValue({ ...ORDER, status: 'READY' })
    expect(alsMail(await rendere('abholbereit', { orderId: ORDER.id })).an).toBe('erika@example.org')
  })

  it('gelöschte Bestellung → verworfen, nie eine Mail', async () => {
    db.order.findUnique.mockResolvedValue(null)
    expect(await rendere('abholbereit', { orderId: ORDER.id })).toEqual({ verworfen: 'bestellung_fehlt' })
  })

  it('Erstattung offen: Satz und Anweisung aus dem Fall, Bestellnummer frisch, an die feste Adresse', async () => {
    db.order.findUnique.mockResolvedValue({ orderNumber: 'HT-2410-TEST', farm: { name: 'Hof Beispiel' } })
    const mail = alsMail(await rendere('erstattung-offen', { empfaengerId: 'support', fall: 'zurueckgenommen', orderId: ORDER.id, refundId: 're_123', kundinCents: '500' }))
    expect(mail.an).toBe(SUPPORT_EMAIL.toLowerCase())
    expect(mail.betreff).toContain('HT-2410-TEST')
    expect(mail.html).toContain('Gescheiterte Erstattung')
    expect(mail.html).toContain('re_123')
  })

  it('eine entfernte weitere Adresse bekommt nichts mehr (verworfen)', async () => {
    db.betreiberEmpfaenger.findFirst.mockResolvedValue(null)
    expect(await rendere('betreiber-testmail', { empfaengerId: 'cweg' })).toEqual({ verworfen: 'empfaenger_fehlt' })
    db.betreiberEmpfaenger.findFirst.mockResolvedValue({ email: 'team@example.com' })
    expect(alsMail(await rendere('betreiber-testmail', { empfaengerId: 'cteam1' })).an).toBe('team@example.com')
  })

  it('neuer Hof, Meldung und Antwort an das Team laden Hof, Meldung und Nachricht frisch', async () => {
    db.farm.findUnique.mockResolvedValue({ id: 'h1', name: 'Hof Beispiel', slug: 'hof-beispiel', createdAt: JETZT, owner: { email: 'hof@example.org' } })
    expect(alsMail(await rendere('neuer-hof', { farmId: 'h1', empfaengerId: 'support' })).betreff).toContain('Hof Beispiel')
    db.meldung.findUnique.mockResolvedValue({ id: 'cmeldung0000000000000001', text: 'Knopf geht nicht', seiteUrl: '/', userAgent: 'x', viewport: '1x1', diagKennung: null, screenshotUrl: null, createdAt: JETZT, farm: null })
    expect(alsMail(await rendere('meldung', { meldungId: 'cmeldung0000000000000001', empfaengerId: 'support' })).html).toContain('Knopf geht nicht')
    db.nachricht.findUnique.mockResolvedValue({ text: 'Danke!', unterhaltungId: 'cfaden1', unterhaltung: { farm: { name: 'Hof Beispiel' }, rundschreiben: null } })
    expect(alsMail(await rendere('antwort-an-team', { nachrichtId: 'cn1', empfaengerId: 'support' })).betreff).toContain('Hof Beispiel')
    db.meldung.findUnique.mockResolvedValue(null)
    expect(await rendere('meldung', { meldungId: 'cweg', empfaengerId: 'support' })).toEqual({ verworfen: 'meldung_fehlt' })
  })

  it('Wochenlage: zählt beim Versand frisch, nennt nur Zahlen; auch bei leerem Eingang', async () => {
    vi.mocked(zaehleFuerWochenlauf).mockResolvedValue({ neu: 1, liegenGeblieben: 2, offen: 1, neueste: [{ kurznummer: 'M-1', art: 'FEHLER', ersteZeile: 'Knopf geht nicht bei Frau Muster', hofName: 'Hof Beispiel' }] })
    vi.mocked(zaehleOffenImEingang).mockResolvedValue({ antworten: 0, meldungen: 1, hoefe: 0, erstattungen: 0, gesamt: 1 })
    db.order.aggregate.mockResolvedValue({ _count: { _all: 5 }, _sum: { totalAmount: new Prisma.Decimal('123.40') } })
    db.order.findMany.mockResolvedValue([
      { createdAt: JETZT, status: 'CONFIRMED', paymentMethod: 'ONLINE', paymentStatus: 'PAID', serviceFeeCents: 150, serviceFeeRefundedAt: null },
    ])
    db.farm.count.mockResolvedValue(2)
    db.meldung.count.mockResolvedValue(3)
    db.kostenposten.findMany.mockResolvedValue([{ betrag: new Prisma.Decimal('49.00'), rhythmus: 'MONATLICH', ab: new Date('2026-01-01T00:00:00.000Z'), bis: null }])
    const mail = alsMail(await rendere('wochenbericht', { empfaengerId: 'support', geloeschtAnzahl: '3' }))
    expect(mail.html).toContain('Wochenlage')
    expect(mail.html).toContain('3 erledigte Meldungen')
    expect(mail.html).toContain('€ 123,40')
    expect(mail.html).toContain('€ 1,50')
    expect(mail.html).toContain('€ 49,00')
    expect(mail.html).toContain('überfällig: 2')
    // Gegenprobe: Der Text einer Meldung und der Hofname verlassen die Mail nicht.
    expect(mail.html).not.toContain('Frau Muster')
    expect(mail.html).not.toContain('Hof Beispiel')
    // Testhöfe zählen nirgends (N21).
    expect(db.farm.count).toHaveBeenCalledWith({ where: expect.objectContaining({ istTesthof: false }) })
    vi.mocked(zaehleOffenImEingang).mockResolvedValue({ antworten: 0, meldungen: 0, hoefe: 0, erstattungen: 0, gesamt: 0 })
    expect(alsMail(await rendere('wochenbericht', { empfaengerId: 'support', geloeschtAnzahl: '0' })).html).toContain('Wochenlage')
  })

  it('Freischaltung: nur solange der Hof freigeschaltet ist', async () => {
    db.farm.findUnique.mockResolvedValue({ name: 'Hof Beispiel', slug: 'hof-beispiel', approvedAt: JETZT, owner: { email: 'hof@example.org' } })
    expect(alsMail(await rendere('freischaltung', { farmId: 'h1' })).an).toBe('hof@example.org')
    db.farm.findUnique.mockResolvedValue({ name: 'Hof Beispiel', slug: 'hof-beispiel', approvedAt: null, owner: { email: 'hof@example.org' } })
    expect(await rendere('freischaltung', { farmId: 'h1' })).toEqual({ verworfen: 'nicht_freigeschaltet' })
  })

  it('Postfach und Rundschreiben: an das Inhaberkonto, ein stillgelegter Hof bekommt nichts', async () => {
    db.nachricht.findUnique.mockResolvedValue({ text: 'Passt!', linkUrl: null, unterhaltungId: 'cfaden1', unterhaltung: { rundschreiben: null, farm: { archivedAt: null, owner: { email: 'hof@example.org' } } } })
    const antwort = alsMail(await rendere('postfach', { nachrichtId: 'cn1' }))
    expect(antwort.an).toBe('hof@example.org')
    expect(antwort.html).toContain('Passt!')
    db.unterhaltung.findUnique.mockResolvedValue({ rundschreiben: { titel: 'Abholzeiten', text: 'Bitte prüfen.', linkUrl: null }, farm: { archivedAt: JETZT, owner: { email: 'hof@example.org' } } })
    expect(await rendere('rundschreiben', { unterhaltungId: 'cfaden1' })).toEqual({ verworfen: 'hof_stillgelegt' })
    db.unterhaltung.findUnique.mockResolvedValue({ rundschreiben: { titel: 'Abholzeiten', text: 'Bitte prüfen.', linkUrl: null }, farm: { archivedAt: null, owner: { email: 'hof@example.org' } } })
    expect(alsMail(await rendere('rundschreiben', { unterhaltungId: 'cfaden1' })).betreff).toBe('Abholzeiten')
  })

  it('Abo-Bestätigung: Link beim Versand frisch signiert — nur solange die Anfrage offen ist', async () => {
    db.customerFarmSubscription.findUnique.mockResolvedValue({ customerEmail: 'erika@example.org', emailOptInAngefragtAm: JETZT, emailOptInBestaetigtAm: null, farm: { name: 'Hof Beispiel' } })
    const mail = alsMail(await rendere('abo-bestaetigung', { aboId: 'cabo1' }))
    expect(mail.an).toBe('erika@example.org')
    expect(mail.html).toContain('/account/neuigkeiten-bestaetigen?token=')
    db.customerFarmSubscription.findUnique.mockResolvedValue({ customerEmail: 'erika@example.org', emailOptInAngefragtAm: JETZT, emailOptInBestaetigtAm: JETZT, farm: { name: 'Hof Beispiel' } })
    expect(await rendere('abo-bestaetigung', { aboId: 'cabo1' })).toEqual({ verworfen: 'anfrage_erledigt' })
  })

  it('Bescheid: nur an eine Kundin mit Adresse und Antwort', async () => {
    db.meldung.findUnique.mockResolvedValue({ customerEmail: ' Erika@Example.org ', farmId: null, antwortAnMelder: 'Kommt bald.' })
    const mail = alsMail(await rendere('bescheid', { meldungId: 'cm1' }))
    expect(mail.an).toBe('erika@example.org')
    expect(mail.html).toContain('Kommt bald.')
    db.meldung.findUnique.mockResolvedValue({ customerEmail: null, farmId: 'h1', antwortAnMelder: 'Kommt bald.' })
    expect(await rendere('bescheid', { meldungId: 'cm1' })).toEqual({ verworfen: 'ohne_kundin' })
  })

  it('Beitrag: der Knopf führt zu genau diesem Beitrag, wenn er auf der Hofseite steht (T5) — Gegenprobe ohne', async () => {
    db.customerFarmSubscription.findFirst.mockResolvedValue({ customerEmail: 'erika@example.org', farmId: 'h1' })
    const post = { title: 'Eier', body: 'Frisch.', anlass: 'FRESH_PRODUCT', photoUrl: null, farm: { name: 'Hof Beispiel', slug: 'hof-beispiel' } }
    db.statusPost.findFirst.mockResolvedValue({ ...post, showOnFarmPage: true })
    expect(alsMail(await rendere('beitrag', { postId: 'cbeitrag1', aboId: 'cabo1' })).html).toContain('/hof-beispiel?beitrag=cbeitrag1')
    db.statusPost.findFirst.mockResolvedValue({ ...post, showOnFarmPage: false })
    expect(alsMail(await rendere('beitrag', { postId: 'cbeitrag1', aboId: 'cabo1' })).html).not.toContain('beitrag=')
  })
})

describe('„n per E-Mail" aus der Warteschlange — eine Quelle', () => {
  const b = (id: string, emailRecipientCount: number) => ({ id, publishedAt: JETZT, createdAt: JETZT, emailRecipientCount })

  it('mit Aufträgen zählen die gesendeten; ohne Aufträge (vor der Warteschlange) die alte Zahl', async () => {
    db.$queryRaw.mockResolvedValue([{ postId: 'p1', gesendet: 2 }])
    const zahlen = await gesendeteBeitragsMails([b('p1', 5), b('p2', 7)])
    expect(zahlen.get('p1')).toBe(2)
    expect(zahlen.get('p2')).toBe(7)
  })

  it('ohne Beiträge keine Abfrage', async () => {
    expect((await gesendeteBeitragsMails([])).size).toBe(0)
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })
})

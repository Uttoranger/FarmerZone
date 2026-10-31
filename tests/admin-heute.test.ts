/**
 * Admin › Heute als Seite (Register N32, Nr. 185): die echte Seite mit den
 * echten Abfragen über einer Attrappe der Datenbank bzw. der Abfragen, die
 * Postfach, Betrieb und Mails schon haben. Beweist:
 *  - „Braucht dich“ zeigt die Aufgaben mit Frist und Knopf; im Dokument steht
 *    „Braucht dich“ vor den Lage-Kacheln (am Handy oben);
 *  - keine Adresse und keine E-Mail-Adresse im HTML, obwohl sie im Bestand
 *    stehen (erfundene Adresse, Gegenprobe: sie steht wirklich in der Attrappe);
 *  - /admin?x → 308 nach /admin/hoefe?x, erst nach der Admin-Wache;
 *  - die Zahl der Betriebsleiste (ladeAdminbereich) kommt aus derselben
 *    Quelle wie „Braucht dich“; scheitert sie, fehlt nur die Zeile;
 *  - scheitert eine Quelle auf der Seite, steht „Heute“ mit dem Fehler-Satz da.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Prisma } from '@prisma/client'

const ADRESSE = 'Musterweg 17, 1234 Testdorf'
const EMAIL = 'kundin@example.com'
const JETZT = new Date('2026-10-26T08:42:00.000Z')

const db = vi.hoisted(() => ({
  farm: { findMany: vi.fn(), count: vi.fn() },
  order: { groupBy: vi.fn(), aggregate: vi.fn(), count: vi.fn() },
  adminAktion: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  $queryRaw: vi.fn(),
}))
const quellen = vi.hoisted(() => ({
  ladeHofAufgaben: vi.fn(),
  ladeErstattungAufgaben: vi.fn(),
  zaehleOffenImEingang: vi.fn(async () => ({ gesamt: 0 })),
  ladeProbleme: vi.fn(async () => []),
  ladeAeltesteWichtige: vi.fn(async () => null),
  ladeLaeufe: vi.fn(async () => new Map()),
  ladeBetriebHinweis: vi.fn(async () => null),
  getMeldungenFuerAdmin: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/server/admin-wache', () => ({
  verlangeAdminSeite: vi.fn(async () => 'ich'),
  verlangeAdminShell: vi.fn(async () => ({ userId: 'ich', inhaltOffen: true, person: { adminInhaber: true, adminRechte: [] } })),
}))
vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn((ziel: string) => {
    throw new Error(`PERMANENT:${ziel}`)
  }),
  usePathname: () => '/admin',
  useRouter: () => ({ refresh() {}, push() {}, replace() {} }),
}))
vi.mock('@/server/actions/notbremse', () => ({ halteBestellungenAn: vi.fn(), gibBestellungenFrei: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/server/queries/postfach', () => quellen)
vi.mock('@/server/queries/mails', () => quellen)
vi.mock('@/server/queries/betrieb', () => quellen)
vi.mock('@/server/queries/meldung', () => quellen)
vi.mock('@/server/queries/admin', () => ({ zaehleWartendeHoefe: vi.fn(async () => 1) }))
// Die Quellen der Plattformgebühr (Nr. 198) haben eigene Tests (tests/plattformgebuehr-abrechnung.test.ts).
vi.mock('@/server/queries/plattformgebuehr', () => ({
  ladePlattformgebuehrAufgaben: vi.fn(async () => ({ gescheitert: [], zurueckgebucht: [], rechnungsangabenFehlenSeit: null, nichtAbgeholt: [] })),
}))
vi.mock('@/server/queries/startseite', () => ({ naechsterTermin: vi.fn(async () => null) }))
// Nr. 200: „Widerruf offen“ — hier ohne Widerrufe (die Quelle prüft tests/widerruf.test.ts).
vi.mock('@/server/widerruf', () => ({ ladeWiderrufAufgaben: vi.fn(async () => []) }))
vi.mock('@/server/queries/plattform-einstellung', () => ({
  leseBestellstopp: vi.fn(async () => null),
  lesePlattformEinstellung: vi.fn(async () => ({
    gruendungPlaetze: 12,
    gruendungBisTag: '2027-12-31',
    gruendungAnzeige: true,
    gruendungMonate: 12,
    gruendungAktionBisTag: '2026-12-31',
    gruendungFestAm: null,
    geaendertVonUserId: null,
    geaendertAm: null,
  })),
}))
// Nr. 201 (N40): der Stripe-Modus umschaltbar — Vorgabe Test, wie in jeder Vorschau.
const modus = vi.hoisted(() => ({ stripe: 'test' as 'test' | 'live', art: 'produktion' as const }))
vi.mock('@/lib/umgebung-server', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/lib/umgebung-server')>()
  const umgebung = {
    ...echt.UMGEBUNG,
    vercelProduktion: false,
    get stripe() {
      return modus.stripe
    },
    get art() {
      return modus.art
    },
  }
  return { ...echt, STRIPE_LIVE_AB: null, TESTBETRIEB: false, STRIPE_MARKE: null, UMGEBUNG: umgebung }
})

import * as Sentry from '@sentry/nextjs'
import AdminHeutePage from '@/app/admin/page'
import { ladeAdminbereich } from '@/server/adminbereich'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { leseBestellstopp, lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'

const STUNDE = 60 * 60_000

beforeEach(() => {
  vi.clearAllMocks()
  modus.stripe = 'test'
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  quellen.ladeHofAufgaben.mockResolvedValue([
    {
      id: 'hof-1',
      name: 'Hof Test',
      createdAt: new Date(JETZT.getTime() - 27 * STUNDE),
      hofseite: { erledigt: 5, gesamt: 7 },
      stripeBereit: true,
      sepaErteilt: false,
      futter: false,
      lfbis: false,
      titelbild: true,
      email: 'bestaetigt',
      platz: null,
    },
  ])
  quellen.ladeErstattungAufgaben.mockResolvedValue([
    { id: 'b-1', bestellnummer: 'HM-2610-B7C2', hofName: 'Hof am Bach', seit: new Date(JETZT.getTime() - 50 * STUNDE), bezahltCents: 1838, schonErstattetCents: 0, zahlungKennung: null },
  ])
  quellen.getMeldungenFuerAdmin.mockResolvedValue([
    { id: 'meldung-abcdefgh', art: 'FEHLER', createdAt: new Date(JETZT.getTime() - STUNDE), ersteZeile: 'Foto lädt nicht', hofName: null, customerEmail: EMAIL },
  ])
  // Der Bestand trägt Adresse und E-Mail — Heute darf beides nie zeigen.
  db.farm.findMany.mockResolvedValue([
    { id: 'hof-2', name: 'Hof Ohne Zeit', approvedAt: new Date('2026-08-01T08:00:00.000Z'), address: ADRESSE, email: EMAIL, pickupSlots: [], orders: [{ createdAt: new Date(JETZT.getTime() - 24 * STUNDE), customerAddress: ADRESSE }] },
  ])
  db.farm.count.mockResolvedValue(3)
  db.order.groupBy.mockResolvedValue([
    { status: 'PAID', _count: { _all: 4 } },
    { status: 'READY', _count: { _all: 2 } },
    { status: 'CANCELLED', _count: { _all: 1 } },
  ])
  // Woche: Warenwert und Zahl in einem Aufruf, die Servicegebühr (ohne entfallene) im zweiten; die Vorwoche über count.
  db.order.aggregate.mockImplementation(async (a: { _sum: { serviceFeeCents?: true } }) =>
    a._sum.serviceFeeCents ? { _sum: { serviceFeeCents: 9200 } } : { _sum: { totalAmount: new Prisma.Decimal('1840.00') }, _count: { _all: 118 } }
  )
  db.order.count.mockResolvedValue(108)
  db.adminAktion.findMany.mockResolvedValue([{ wann: new Date(JETZT.getTime() - STUNDE), wer: 'ich', art: 'hof_freigeschaltet' }])
  db.user.findUnique.mockResolvedValue({ name: 'Max Mustermann', role: 'CUSTOMER', farm: null })
  db.$queryRaw.mockResolvedValue([])
})

async function seite(parameter: Record<string, string> = {}): Promise<string> {
  return renderToStaticMarkup(await AdminHeutePage({ searchParams: Promise.resolve(parameter) }))
}

describe('Admin › Heute', () => {
  it('„Braucht dich“ mit Frist, Bezug und Knopf; im Dokument vor den Lage-Kacheln', async () => {
    const html = await seite()
    expect(html).toContain('Braucht dich')
    expect(html).toContain('Hof wartet auf Freischaltung')
    expect(html).toContain('Ziel 48 h · noch 21 h')
    expect(html).toContain('überfällig · seit 2 Tagen')
    expect(html).toContain('Hof ohne Abholzeit nächste Woche')
    expect(html).toMatch(/<a href="\/admin\/hoefe\/hof-1"[^>]*>Prüfen<\/a>/)
    expect(html.indexOf('Braucht dich')).toBeLessThan(html.indexOf('Bestellungen heute'))
    // Lage aus den Attrappen: 6 offen (4 bezahlt + 2 bereit), davon 4 nicht gepackt, 1 Storno; € 1.840 Umsatz.
    expect(html).toContain('4 noch nicht gepackt · 1 Storno')
    expect(html).toMatch(/€ 1\D840</)
    // Zwei leise Zeilen und das Zustandswort wie im Mockup; Servicegebühr der Woche in Euro.
    expect(html).toContain('Im Rahmen')
    expect(html).toContain('Woche: 118 (+9 % zur Vorwoche)')
    expect(html).toMatch(/Servicegebühr € 92,00/)
    expect(db.order.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ serviceFeeRefundedAt: null, status: 'PICKED_UP' }) }))
    expect(html).toContain('Hof freigeschaltet')
    // Signal „ohne Bestellung“: Storno und Testzahlung zählen nicht als letzte Bestellung.
    const hofAbfrage = db.farm.findMany.mock.calls[0]?.[0] as { select: { orders: { where: { status: unknown; AND: unknown[] } } } }
    expect(hofAbfrage.select.orders.where.status).toEqual({ not: 'CANCELLED' })
    expect(hofAbfrage.select.orders.where.AND).toHaveLength(1)
  })

  it('keine Adresse und keine E-Mail-Adresse im HTML (Gegenprobe: beide stehen im Bestand)', async () => {
    const html = await seite()
    expect(JSON.stringify(await db.farm.findMany.mock.results[0]?.value)).toContain(ADRESSE)
    expect(html).not.toContain(ADRESSE)
    expect(html).not.toContain('Musterweg')
    expect(html).not.toContain(EMAIL)
    expect(html).toContain('Kundin (ohne Konto)')
  })

  it('/admin?x → 308 nach /admin/hoefe?x — erst nach der Wache', async () => {
    await expect(seite({ reiter: 'alle', filter: 'online' })).rejects.toThrow('PERMANENT:/admin/hoefe?reiter=alle&filter=online')
    expect(verlangeAdminSeite).toHaveBeenCalledTimes(1)
    expect(db.farm.findMany).not.toHaveBeenCalled()
  })

  it('scheitert eine Quelle, steht „Heute“ mit dem Fehler-Satz da (Sentry nur mit dem Bereich)', async () => {
    quellen.ladeHofAufgaben.mockRejectedValue(new Error('kaputt'))
    const html = await seite()
    expect(html).toContain('Wir konnten Heute gerade nicht laden.')
    expect(vi.mocked(Sentry.captureException).mock.calls[0]?.[1]).toEqual({ tags: { bereich: 'admin', seite: 'heute' } })
  })
})

describe('Notbremse in Heute (Nr. 189 Punkt 4)', () => {
  it('aktiv: „Notbremse aktiv“ ganz oben mit „Freigeben“ (ein Knopf, kein Link) und „bis …“', async () => {
    vi.mocked(leseBestellstopp).mockResolvedValueOnce({
      ab: new Date(JETZT.getTime() - STUNDE).toISOString(),
      bis: new Date(JETZT.getTime() + 2 * STUNDE).toISOString(),
      grund: 'zahlungen',
      satz: 'Bestellen geht gleich wieder.',
    })
    const html = await seite()
    const liste = html.slice(html.indexOf('id="braucht-dich"'))
    const eintraege = liste.split('<li').slice(1)
    expect(eintraege[0]).toContain('Notbremse aktiv')
    // Vor der überfälligen Erstattung — „ganz oben“ heißt vor jeder Frist.
    expect(eintraege.slice(1).some((e) => e.includes('überfällig'))).toBe(true)
    expect(html).toMatch(/<button[^>]*>Freigeben<\/button>/)
    expect(html).toContain('bis Mo., 26.10., 11:42 Uhr')
    expect(html).toContain('Zahlungen gestört (Stripe)')
  })

  it('Gegenprobe: ohne Notbremse keine Aufgabe und kein „Freigeben“; „Bestellungen anhalten …“ steht immer da', async () => {
    const html = await seite()
    expect(html).not.toContain('Notbremse aktiv')
    expect(html).not.toContain('>Freigeben<')
    expect(html).toMatch(/<button[^>]*>Bestellungen anhalten …<\/button>/)
    expect(html).toContain('Stoppt neue Bestellungen auf allen Höfen. Laufende bleiben.')
  })
})

describe('Betriebsleiste: dieselbe Zahl wie „Braucht dich“', () => {
  it('ladeAdminbereich liefert „n offen · m überfällig – ansehen“ aus denselben Quellen', async () => {
    const html = await seite()
    const zahl = /Braucht dich<\/h2><span[^>]*>([^<]+)<\/span>/.exec(html)?.[1]
    expect(zahl).toMatch(/^\d+ offen · \d+ überfällig$/)
    expect((await ladeAdminbereich()).aufgaben).toEqual({ text: `${zahl} – ansehen`, kurz: `${zahl?.split(' · ')[0]} – ansehen`, href: '/admin' })
  })

  it('scheitert eine Quelle, fehlt nur die Zeile — Sentry mit festem Satz, ohne Inhalt', async () => {
    quellen.ladeErstattungAufgaben.mockRejectedValue(Object.assign(new Error('Tabelle fehlt'), { name: 'PrismaClientKnownRequestError' }))
    const bereich = await ladeAdminbereich()
    expect(bereich.aufgaben).toBeNull()
    expect(bereich.personName).toBe('Max Mustermann')
    const [gemeldet] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error]
    expect([gemeldet.name, gemeldet.message]).toEqual(['PrismaClientKnownRequestError', 'Heute: Zahl der Betriebsleiste nicht gelesen'])
  })
})

describe('Stripe live ohne Hofpreis-Modell (Nr. 201, N40): Aufgabe und Betriebsleiste aus derselben Liste', () => {
  const SATZ = 'Stripe ist live, aber das Hofpreis-Modell beginnt erst am 1.\u00a0Februar 2027 – Stichtag vorziehen'

  it('live und Stichtag in der Zukunft (Vorgabe 1.2.2027): Aufgabe ganz oben in „Braucht dich“ und dieselbe Warnung in der Betriebsleiste', async () => {
    modus.stripe = 'live'
    const html = await seite()
    const eintraege = html.slice(html.indexOf('id="braucht-dich"')).split('<li').slice(1)
    expect(eintraege[0]).toContain(SATZ)
    const bereich = await ladeAdminbereich()
    expect(bereich.stripeLiveWarnung).toEqual({ text: SATZ, href: '/admin/einstellungen#hofpreis-modell-ab' })
  })

  it('live und Stichtag erreicht → weder Aufgabe noch Warnung', async () => {
    modus.stripe = 'live'
    vi.mocked(lesePlattformEinstellung).mockResolvedValue({ hofpreisModellAb: new Date(JETZT.getTime() - STUNDE).toISOString() } as Awaited<ReturnType<typeof lesePlattformEinstellung>>)
    expect(await seite()).not.toContain('Stripe ist live')
    expect((await ladeAdminbereich()).stripeLiveWarnung).toBeNull()
  })

  it('Testmodus → nichts, und der Stichtag wird gar nicht erst gelesen', async () => {
    const bereich = await ladeAdminbereich()
    expect(bereich.stripeLiveWarnung).toBeNull()
    expect(vi.mocked(lesePlattformEinstellung)).not.toHaveBeenCalled()
  })
})

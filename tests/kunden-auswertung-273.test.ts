/**
 * Nr. 273 — Kunden und Auswertung nach der Abnahme Lauf 32 (Liste Lauf 32 kunden/auswertung, Boards
 * s2-/w2-kunden, s2-/w2-auswertung).
 *
 * Beweist:
 *  - Gebühren-Karte: Erklärsatz je Stand aus dem Satz des Hofs (`satzHundertstel`, nie fest) und der
 *    Geldsatz-Hilfe (erlassen bis zum letzten freien Tag, Nr. 264; danach Lastschrift-Satz); vor dem
 *    Stichtag und ohne Hofdaten unverändert. Die Beträge der Karte ändern sich mit dem Satz nicht.
 *  - Umsatzkarte: Vergleichsbetrag in Klammern, Fußsatz „Mo und Di: …“ (wie Heute), Leerzustand ohne Fußsatz.
 *  - Abfragen nur lesend, nur mit der farmId: Vergleichsbetrag = dieselbe Summe wie `auswerten`.
 *  - Links-Karte: Nachsatz bei nicht freigegebenem Hof; Grenze-Karte: Marke rechts, ohne Rand.
 *  - Kundin: Name als h1 im Profil, Abholtermin in den Bestellzeilen, Kontakt als Links mit 44 px, ohne Symbole
 *    bei WhatsApp/E-Mail und in „Neuigkeiten“, keine Glocke; Liste: Chips 44 px, Marken ohne Rand, Umsatz normal,
 *    Suchfeld direkt nach den Chips.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Prisma } from '@prisma/client'

const navigation = vi.hoisted(() => ({ parameter: '', pfad: '/customers/k-1' }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigation.parameter),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => navigation.pfad,
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; [k: string]: unknown }) => {
    const attribute = { ...rest }
    delete attribute.prefetch
    delete attribute.onNavigate
    return createElement('a', { href, ...attribute }, children)
  },
}))
const db = vi.hoisted(() => ({
  order: { findMany: vi.fn(), count: vi.fn() },
  manualSale: { findMany: vi.fn() },
  farm: { findUnique: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/umgebung-server', () => ({ STRIPE_LIVE_AB: null }))
const admin = vi.hoisted(() => ({ ladeGruendungBis: vi.fn() }))
vi.mock('@/server/queries/admin', () => admin)

import {
  PLATTFORMGEBUEHR_KARTE_BAR,
  PLATTFORMGEBUEHR_KARTE_BAR_EINZUG,
  PLATTFORMGEBUEHR_KARTE_ERKLAERUNG,
  SERVICEGEBUEHREN_ERKLAERUNG,
  gebuehrenKarteText,
  umsatzFussSatz,
  type GebuehrHofStand,
} from '@/lib/auswertung'
import { gebuehrenKarteFuerZeitraum } from '@/components/auswertung/gebuehr-titel'
import { GebuehrenKarte, GrenzeKarte, TEILEN_OHNE_FREIGABE, TeilenWirkungKarte, UmsatzKarte } from '@/components/auswertung/auswertung-teile'
import { getAuswertungHof, getUmsatzZusatz } from '@/server/queries/auswertung'
import { umsatzfenster } from '@/lib/umsatz'
import { grenzeStand } from '@/lib/auswertung'
import { KundenDetail } from '@/components/hof-kunden/kunden-detail'
import { KundenAnsicht } from '@/components/hof-kunden/kunden-ansicht'
import type { CustomerDetail, CustomerSummary } from '@/server/queries/customers'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

const STICHTAG = { hofpreisModellAb: new Date('2027-02-01T00:00:00+01:00') }
const MAERZ = new Date('2027-03-03T10:00:00+01:00')
// Letzter Gründungstag wie Farm.gruendungBis (Board: Hof Müller bis 31. Jänner 2028).
const GRUENDUNG_BIS = new Date('2028-01-31T00:00:00Z')
const gruendungshof: GebuehrHofStand = { hof: { plattformgebuehrProzent: null, einzugAb: null }, gruendungBis: GRUENDUNG_BIS }

describe('Gebühren-Karte: Erklärsatz je Stand (Liste Lauf 32 auswertung, Nr. 273)', () => {
  it('Gründungshof: „6 % je Stück, aufgerundet – …“ und „Bar zahlst du als Gründungshof bis 31. Jänner 2028 keine.“', () => {
    const t = gebuehrenKarteText('2027-03', STICHTAG, MAERZ, gruendungshof)
    expect(t.erklaerung).toBe('6 % je Stück, aufgerundet – sie steckt im Preis der Kundin; online behält Stripe sie gleich ein.')
    // Der letzte freie Tag, inklusiv (Nr. 264: Wiener Tag vor dem Einzugsbeginn 1. Februar 2028).
    expect(t.bar).toMatch(/^Bar zahlst du als Gründungshof bis 31\.\sJänner 2028 keine\.$/)
    expect(t.barZeile).toBe(true)
  })

  it('der Satz kommt vom Hof, nie fest: 6,5 % bei einem eigenen Satz', () => {
    const t = gebuehrenKarteText('2027-03', STICHTAG, MAERZ, { ...gruendungshof, hof: { plattformgebuehrProzent: '6.50', einzugAb: null } })
    expect(t.erklaerung).toMatch(/^6,5 % je Stück, aufgerundet/)
  })

  it('ohne Gründungsplatz nach dem Stichtag: der Lastschrift-Satz des Boards (Bild 4)', () => {
    const t = gebuehrenKarteText('2027-03', STICHTAG, MAERZ, { hof: { plattformgebuehrProzent: null, einzugAb: null }, gruendungBis: null })
    expect(t.bar).toBe(PLATTFORMGEBUEHR_KARTE_BAR_EINZUG)
  })

  it('eigener Einzugsbeginn aus dem Admin: der Tag davor, ohne „als Gründungshof“; nach dem Tag der Lastschrift-Satz', () => {
    const stand: GebuehrHofStand = { hof: { plattformgebuehrProzent: null, einzugAb: new Date('2027-04-30T22:00:00Z') }, gruendungBis: null }
    expect(gebuehrenKarteText('2027-03', STICHTAG, MAERZ, stand).bar).toMatch(/^Bar zahlst du bis 30\.\sApril 2027 keine\.$/)
    expect(gebuehrenKarteText('2027-05', STICHTAG, new Date('2027-05-03T10:00:00+02:00'), stand).bar).toBe(PLATTFORMGEBUEHR_KARTE_BAR_EINZUG)
  })

  it('nach der Gründungszeit: Lastschrift-Satz (die Geldsatz-Hilfe sagt „nicht erlassen“)', () => {
    expect(gebuehrenKarteText('2028-02', STICHTAG, new Date('2028-02-03T10:00:00+01:00'), gruendungshof).bar).toBe(PLATTFORMGEBUEHR_KARTE_BAR_EINZUG)
  })

  it('vor dem Stichtag bleibt alles wie bisher, auch mit Hofdaten; ohne Hofdaten die allgemeinen Sätze', () => {
    const vorher = gebuehrenKarteText('2027-01', STICHTAG, new Date('2027-01-20T10:00:00+01:00'), gruendungshof)
    expect(vorher.erklaerung).toBe(SERVICEGEBUEHREN_ERKLAERUNG)
    const ohne = gebuehrenKarteText('2027-03', STICHTAG, MAERZ)
    expect(ohne.erklaerung).toBe(PLATTFORMGEBUEHR_KARTE_ERKLAERUNG)
    expect(ohne.bar).toBe(PLATTFORMGEBUEHR_KARTE_BAR)
  })

  it('für den gewählten Zeitraum (Nr. 251): Titel bleibt, die Sätze kommen mit dem Hof', () => {
    const karte = gebuehrenKarteFuerZeitraum(umsatzfenster('woche', MAERZ), STICHTAG, gruendungshof)
    expect(karte.titel).toBe('Plattformgebühr diese Woche')
    expect(karte.erklaerung).toMatch(/^6 % je Stück/)
  })

  it('keine Summe ändert sich: dieselben Beträge mit und ohne Erklärsatz je Stand', () => {
    const gebuehr = { onlineCents: 4982, onlineAnzahl: 22, vorOrtCents: 0, vorOrtAnzahl: 16, summeCents: 4982 }
    const betraege = (html: string) => html.match(/€\s[\d.,\s]+/g)
    const mit = renderToStaticMarkup(createElement(GebuehrenKarte, { titel: 'T', gebuehr, text: gebuehrenKarteText('2027-03', STICHTAG, MAERZ, gruendungshof) }))
    const ohne = renderToStaticMarkup(createElement(GebuehrenKarte, { titel: 'T', gebuehr, text: gebuehrenKarteText('2027-03', STICHTAG, MAERZ) }))
    expect(betraege(mit)).toEqual(betraege(ohne))
    expect(mit).toContain('Bar bei Abholung (16 Bestellungen)')
    expect(mit).toContain('Gezählt sind bezahlte bzw. abgeholte Bestellungen')
  })
})

describe('Umsatzkarte: Vergleichsbetrag und Fußsatz (Nr. 273)', () => {
  const basis = {
    zeitraum: '1.–7. März',
    summeCent: 45000,
    vergleich: { richtung: 'mehr' as const, text: '▲ 4 % mehr als letzte Woche' },
    laufend: true,
    balken: [{ label: 'Mo', cent: 45000, vergleichCent: 43120 }],
    vergleichLabel: 'Woche davor',
  }

  it('„… · verglichen bis zum selben Zeitpunkt (€ 431,20)“ und der Fußsatz unter dem Diagramm', () => {
    const html = renderToStaticMarkup(createElement(UmsatzKarte, { ...basis, vergleichCent: 43120, fussSatz: umsatzFussSatz(['Mo', 'Di'], 4) }))
    expect(html).toMatch(/· verglichen bis zum selben Zeitpunkt \(€ 431,20\)/)
    expect(html).toContain('Mo und Di: Verkäufe, die du selbst eingetragen hast. Heute holen 4 Bestellungen ab.')
  })

  it('abgeschlossener Zeitraum: nur der Betrag in Klammern; ohne Vergleich keine Klammer', () => {
    const fertig = renderToStaticMarkup(createElement(UmsatzKarte, { ...basis, laufend: false, vergleichCent: 43120 }))
    expect(fertig).toContain('(€ 431,20)')
    expect(fertig).not.toContain('verglichen bis')
    const keiner = renderToStaticMarkup(
      createElement(UmsatzKarte, { ...basis, vergleich: { richtung: 'keiner', text: 'Noch keine Vorwoche zum Vergleich' }, vergleichCent: 0 })
    )
    expect(keiner).not.toContain('(€')
  })

  it('leeres Diagramm: kein Fußsatz', () => {
    const html = renderToStaticMarkup(
      createElement(UmsatzKarte, { ...basis, balken: [{ label: 'Mo', cent: 0, vergleichCent: 0 }], fussSatz: 'Mo: Verkäufe, die du selbst eingetragen hast.' })
    )
    expect(html).not.toContain('selbst eingetragen')
  })

  it('umsatzFussSatz: Einzahl, Mehrzahl, nichts', () => {
    expect(umsatzFussSatz([], null)).toBeNull()
    expect(umsatzFussSatz([], 0)).toBeNull()
    expect(umsatzFussSatz([], 1)).toBe('Heute holt 1 Bestellung ab.')
    expect(umsatzFussSatz(['Sa'], null)).toBe('Sa: Verkäufe, die du selbst eingetragen hast.')
  })
})

describe('Abfragen der Auswertung (Nr. 273): nur lesend, nur der eigene Hof', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.order.findMany.mockResolvedValue([])
    db.manualSale.findMany.mockResolvedValue([])
    db.order.count.mockResolvedValue(4)
  })

  it('Woche: Vergleichsbetrag bis zum selben Zeitpunkt, selbst eingetragene Tage als Balken-Kürzel, heute abholen', async () => {
    const jetzt = new Date('2027-03-03T10:00:00+01:00') // Mittwoch
    const pf = umsatzfenster('woche', jetzt)
    db.order.findMany.mockImplementation(async ({ where }: { where: { pickedUpAt: { gte: Date } } }) =>
      where.pickedUpAt.gte < pf.aktuell.von
        ? [
            { pickedUpAt: new Date('2027-02-23T10:00:00+01:00'), totalAmount: new Prisma.Decimal('431.20') },
            // Nach dem selben Zeitpunkt der Vorwoche — zählt im fairen Vergleich nicht.
            { pickedUpAt: new Date('2027-02-26T10:00:00+01:00'), totalAmount: new Prisma.Decimal('99.00') },
          ]
        : []
    )
    db.manualSale.findMany.mockImplementation(async ({ where }: { where: { saleDate: { gte: Date } } }) =>
      where.saleDate.gte >= pf.aktuell.von
        ? [
            { saleDate: new Date('2027-03-01T12:00:00+01:00'), totalAmount: new Prisma.Decimal('20'), channel: 'MARKT' },
            { saleDate: new Date('2027-03-02T12:00:00+01:00'), totalAmount: new Prisma.Decimal('10'), channel: 'HOFLADEN' },
          ]
        : []
    )
    const zusatz = await getUmsatzZusatz('hof-a', pf, jetzt)
    expect(zusatz.selbstEingetrageneTage).toEqual(['Mo', 'Di'])
    expect(zusatz.heuteAbholen).toBe(4)
    expect(zusatz.vergleichCent).toBe(43120)
    for (const aufruf of [...db.order.findMany.mock.calls, ...db.manualSale.findMany.mock.calls, ...db.order.count.mock.calls]) {
      expect(aufruf[0].where.farmId).toBe('hof-a')
    }
  })

  it('Monat und vergangene Woche: keine Tage, kein „heute abholen“, keine Zählung', async () => {
    const zusatz = await getUmsatzZusatz('hof-a', umsatzfenster('monat', MAERZ), MAERZ)
    expect(zusatz).toEqual({ vergleichCent: 0, selbstEingetrageneTage: [], heuteAbholen: null })
    await getUmsatzZusatz('hof-a', umsatzfenster('woche', MAERZ, 1), MAERZ)
    expect(db.order.count).not.toHaveBeenCalled()
  })

  it('getAuswertungHof: Satz, Einzugsbeginn, Gründungsende nur ohne Einzugsbeginn, Freigabe-Stand', async () => {
    db.farm.findUnique.mockResolvedValue({ plattformgebuehrProzent: null, einzugAb: null, approvedAt: null, archivedAt: null })
    admin.ladeGruendungBis.mockResolvedValue(GRUENDUNG_BIS)
    expect(await getAuswertungHof('hof-a')).toEqual({ gebuehrStand: gruendungshof, wartetAufFreigabe: true })
    expect(db.farm.findUnique.mock.calls[0][0].where).toEqual({ id: 'hof-a' })
    expect(admin.ladeGruendungBis).toHaveBeenCalledWith({ id: 'hof-a' })

    admin.ladeGruendungBis.mockClear()
    const einzugAb = new Date('2027-04-30T22:00:00Z')
    db.farm.findUnique.mockResolvedValue({ plattformgebuehrProzent: null, einzugAb, approvedAt: new Date(), archivedAt: null })
    expect(await getAuswertungHof('hof-a')).toEqual({ gebuehrStand: { hof: { plattformgebuehrProzent: null, einzugAb }, gruendungBis: null }, wartetAufFreigabe: false })
    expect(admin.ladeGruendungBis).not.toHaveBeenCalled()
  })

  it('kein Schreibweg und kein Number() auf Geld in den Abfragen', () => {
    const q = quelle('src/server/queries/auswertung.ts')
    expect(q).not.toMatch(/\.(create|update|upsert|delete)(Many)?\(/)
    expect(q).not.toMatch(/Number\(/)
  })
})

describe('Links-Karte und Grenze-Karte (Nr. 273)', () => {
  const leer = { kopf: null, zeilen: [] }
  it('nicht freigegeben: „Teilen geht, sobald dein Hof online ist.“ — freigegeben nicht', () => {
    expect(renderToStaticMarkup(createElement(TeilenWirkungKarte, { karte: leer, zeitraum: 'März 2027', ohneFreigabe: true }))).toContain(TEILEN_OHNE_FREIGABE)
    expect(renderToStaticMarkup(createElement(TeilenWirkungKarte, { karte: leer, zeitraum: 'März 2027' }))).not.toContain(TEILEN_OHNE_FREIGABE)
  })

  it('Grenze: Marke rechts in derselben Zeile wie der Titel, als Schild ohne Rand', () => {
    const html = renderToStaticMarkup(
      createElement(GrenzeKarte, { jahr: '2027', jahresUmsatz: 1630, grenze: 55000, prozent: 3, spielraum: 53370, stand: grenzeStand(3, '€ 55.000') })
    )
    expect(html).toMatch(/<div class="flex items-start justify-between gap-3"><h2[^>]*>Grenze Be- &amp; Verarbeitung 2027<\/h2><span[^>]*data-form="schild"/)
  })
})

// ─── Kunden ─────────────────────────────────────────────────────────────────

const JETZT = new Date('2026-10-06T10:00:00Z')
const vor = (tage: number) => new Date(JETZT.getTime() - tage * 24 * 60 * 60 * 1000)

function kundin(teil: Partial<CustomerSummary> = {}): CustomerSummary {
  return {
    kundeId: 'aaaaaaaaaaaaaaaa',
    customerEmail: 'erika@example.com',
    customerName: 'Erika Mustermann',
    customerPhone: '+43 660 0000000',
    orderCount: 9,
    alleBestellungen: 9,
    umsatzCents: 16840,
    firstOrderDate: vor(100).toISOString(),
    lastOrderDate: vor(0).toISOString(),
    daysSinceLastOrder: 0,
    isSubscribed: true,
    topProducts: [{ name: 'Heumilch frisch', count: 9 }],
    status: 'Stammkunde',
    isStammkunde: true,
    isDiesenMonatAktiv: true,
    isLangeNichtGesehen: false,
    isNeu: false,
    ...teil,
  }
}

function detail(): CustomerDetail {
  return {
    ...kundin(),
    recentOrders: [
      {
        id: 'o-1',
        orderNumber: 'HM-0303-4A7B',
        createdAt: vor(1).toISOString(),
        betragCents: 1731,
        status: 'CONFIRMED',
        items: [
          { productName: 'Heumilch', quantity: 4 },
          { productName: 'Eier', quantity: 1 },
        ],
        pickupDate: new Date('2026-10-06T10:00:00Z').toISOString(),
        pickupTimeStart: '15:00',
        pickupTimeEnd: '18:00',
      },
    ],
    subscription: { optInEmail: true, optInWhatsApp: false },
  }
}

describe('Kundin (Nr. 273, Board s2-/w2-kunden Bild 3)', () => {
  const html = () => renderToStaticMarkup(createElement(KundenDetail, { kunde: detail(), jetzt: JETZT }))

  it('Profilkopf: der Name ist die h1 neben dem Avatar, mit Marke ohne Rand und „Kunde seit …“; die h1 des Kopfs ist aus', () => {
    const h = html()
    expect(h).toMatch(/<h1 id="kundin-name"[^>]*>Erika Mustermann<\/h1><span[^>]*data-form="schild"[^>]*><span[^>]*>Stammkunde</)
    expect(h).toContain('Kunde seit')
    // Am Handy steht in der Leiste „Kundin“ über „Kunden“; die h1 des Werkzeug-Kopfs blendet der Rahmen aus.
    expect(h).toContain('[&amp;_[data-werkzeug-kopf]_h1]:hidden')
    expect(h).not.toContain('bekommt Neuigkeiten')
  })

  it('Bestellzeile: fett der Abholtermin, darunter Nummer und Positionen', () => {
    expect(html()).toMatch(/Heute, [^<]*15–18 Uhr<\/span><span[^>]*>HM-0303-4A7B · 4× Heumilch · 1× Eier</)
  })

  it('Kontakt: Telefon und E-Mail als grüne, unterstrichene Links mit 44 px, ohne Symbol; Kartentitel in Serif', () => {
    const h = html()
    const kontakt = h.slice(h.indexOf('id="kundin-kontakt"'), h.indexOf('id="kundin-lieblinge"'))
    expect(kontakt).toMatch(/<a href="tel:\+436600000000" class="[^"]*min-h-11[^"]*underline[^"]*"/)
    expect(kontakt).toMatch(/<a href="mailto:erika@example.com" class="[^"]*min-h-11[^"]*text-status-fertig/)
    expect(kontakt).not.toContain('<svg')
    expect(h).toMatch(/<h2 id="kundin-kontakt" class="font-heading/)
    const neuigkeiten = h.slice(h.indexOf('id="kundin-neuigkeiten"'))
    expect(neuigkeiten).not.toContain('<svg')
  })

  it('WhatsApp und E-Mail ohne Symbol, nur „Anrufen“ trägt seines', () => {
    const h = html()
    expect(h).toMatch(/<svg[^>]*>.*?<\/svg>Anrufen<\/a>/)
    expect(h).toMatch(/rel="noopener noreferrer" class="[^"]*">WhatsApp<\/a>/)
    expect(h).toMatch(/class="[^"]*">E-Mail<\/a>/)
  })
})

describe('Kundenliste (Nr. 273, Board s2-/w2-kunden Bild 1)', () => {
  beforeEach(() => {
    navigation.parameter = ''
    navigation.pfad = '/customers'
  })
  const html = () => renderToStaticMarkup(createElement(KundenAnsicht, { kunden: [kundin(), kundin({ kundeId: 'bbbbbbbbbbbbbbbb', customerName: 'Franz Müller' })] }))

  it('Filter-Chips 44 px und 14 px halbfett; Marken ohne Rand; keine Glocke; Umsatz in normaler Schrift', () => {
    const h = html()
    expect(h).toMatch(/data-slot="filter-chip"[^>]*class="[^"]*h-11[^"]*text-sm[^"]*font-semibold/)
    expect(h).not.toMatch(/data-slot="status-badge"/)
    expect(h).toMatch(/data-form="schild"[^>]*><span[^>]*>Stammkunde/)
    expect(h).not.toContain('bekommt Neuigkeiten')
    expect(h).toMatch(/<td class="px-2\.5 py-1 xl:px-3\.5 text-right whitespace-nowrap tabular-nums">€ 168,40<\/td>/)
  })

  it('im Web das Suchfeld direkt nach den Chips, „Sortieren“ rechts außen', () => {
    const h = html()
    expect(h).toMatch(/class="relative order-3 block w-full xl:order-2/)
    expect(h).toMatch(/class="order-2 shrink-0 xl:order-3 xl:ml-auto"/)
    expect(h).toMatch(/aria-label="Kunden filtern"|role="group"/)
  })
})

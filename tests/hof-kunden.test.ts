/**
 * Kunden (/customers) und Kundendetail (/customers/[kundeId]) in der HofShell
 * (Gate 8 „Code ohne Mockup", Nachtlauf Nr. 22a). Kein Mockup — gebaut nach
 * docs/ai/DESIGN_SYSTEM.md, keine neuen Funktionen.
 *
 * Beweist:
 *  - Die Routen liegen in (hof) mit Ladeansicht, (farmer) hat sie nicht mehr;
 *    die alten Bestandskomponenten sind weg.
 *  - Eine Kundin = alle Bestellungen derselben normalisierten Adresse (klein,
 *    ohne Rand); Umsatz in ganzen Cent ohne Storno und Nicht-Abholung, nie
 *    über Number(Decimal); Lieblingsprodukte ohne Storno.
 *  - Status (Stammkunde, Neu, Lange nicht gesehen, Diesen Monat aktiv) und
 *    seine Marke; Filter, Suche (Name, Telefon, E-Mail), Sortierung; Adresse
 *    der Ansicht und ihr Schema (Fremddaten fallen still auf den Standard).
 *  - Abfragen: nur der eigene Hof (farmId in jeder WHERE-Klausel), fehlende
 *    Artikel (fehltSeit) zählen nicht, das Detail sucht ohne unmaskiertes
 *    ILIKE, eine Kennung eines fremden Hofs findet nichts.
 *  - Darstellung: vier Zustände, lange Namen mit title, Telefon-Links mit
 *    Namen, keine Farbwerte.
 */
import { describe, it, expect, expectTypeOf, vi, beforeEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Prisma } from '@prisma/client'

const navigation = vi.hoisted(() => ({ parameter: '' }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigation.parameter),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/customers',
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
  order: { findMany: vi.fn() },
  customerFarmSubscription: { findMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import {
  KUNDEN_FILTER_LABEL,
  KUNDEN_SORTIERUNG_LABEL,
  SORTIEREN_TEXT,
  ZEIGEN_TEXT,
  blattAdresse,
  blattStart,
  fasseKundinZusammen,
  filtereKunden,
  initialen,
  kundenAdresse,
  kundenKopfzeile,
  kundenMarke,
  kundenSchluessel,
  kundenStatus,
  andereRichtung,
  richtungText,
  kundeSeitText,
  mitSortierung,
  passtZurKundenSuche,
  sichtbareKundenFilter,
  sortierungBeschreibung,
  sortiereKunden,
  weitereBestellungen,
  zaehleKundenFilter,
  zuletztText,
  type KundenBestellung,
  type KundenBlattWahl,
} from '@/lib/hof-kunden'
import { KUNDEN_FILTER_WERTE, KUNDEN_SORTIERUNG_WERTE, kundenAnsichtAus, type KundenAnsicht as AnsichtWerte } from '@/schemas/hof-kunden'
import { findeKundenAdressen, getCustomerDetail, getCustomersForFarm, kundeIdFuer, type CustomerDetail, type CustomerSummary } from '@/server/queries/customers'
import { KundenAnsicht } from '@/components/hof-kunden/kunden-ansicht'
import { SortierFelder } from '@/components/hof-kunden/kunden-sortieren'
import { KundenDetail } from '@/components/hof-kunden/kunden-detail'

function quelle(pfad: string): string {
  return readFileSync(join(process.cwd(), pfad), 'utf8')
}

const JETZT = new Date('2026-10-06T10:00:00Z')
const TAG = 24 * 60 * 60 * 1000
const vor = (tage: number) => new Date(JETZT.getTime() - tage * TAG)

function bestellung(teil: Partial<KundenBestellung> = {}): KundenBestellung {
  return {
    customerEmail: 'erika@example.com',
    customerName: 'Erika Mustermann',
    customerPhone: '+43 660 0000000',
    status: 'PICKED_UP',
    betragCents: 1000,
    createdAt: vor(5),
    items: [],
    ...teil,
  }
}

// ─── Route ──────────────────────────────────────────────────────────────────

describe('Route in der HofShell', () => {
  it('/customers und /customers/[kundeId] liegen in (hof) mit Ladeansicht, nicht mehr in (farmer)', () => {
    for (const datei of ['page.tsx', 'loading.tsx', '[kundeId]/page.tsx', '[kundeId]/loading.tsx']) {
      expect(existsSync(join(process.cwd(), 'src/app/(hof)/customers', datei)), datei).toBe(true)
    }
    expect(existsSync(join(process.cwd(), 'src/app/(farmer)/customers'))).toBe(false)
  })

  it('die alten Bestandskomponenten sind weg, die Seiten binden keine eigene Shell ein', () => {
    expect(existsSync(join(process.cwd(), 'src/components/customers/customers-table.tsx'))).toBe(false)
    for (const seite of ['src/app/(hof)/customers/page.tsx', 'src/app/(hof)/customers/[kundeId]/page.tsx']) {
      expect(quelle(seite)).not.toMatch(/from '@\/components\/shells\//)
      expect(quelle(seite)).not.toMatch(/farmer\/page-header/)
    }
  })
})

// ─── Zusammenfassung ────────────────────────────────────────────────────────

describe('fasseKundinZusammen', () => {
  it('Umsatz in ganzen Cent, ohne Storno und Nicht-Abholung', () => {
    const k = fasseKundinZusammen(
      [
        bestellung({ betragCents: 1999, createdAt: vor(40) }),
        bestellung({ betragCents: 1999, createdAt: vor(30) }),
        bestellung({ betragCents: 1999, createdAt: vor(20) }),
        bestellung({ betragCents: 5000, status: 'CANCELLED', createdAt: vor(10) }),
        bestellung({ betragCents: 700, status: 'NOT_PICKED_UP', createdAt: vor(9) }),
      ],
      null,
      JETZT
    )
    expect(k.umsatzCents).toBe(5997)
    expect(Number.isInteger(k.umsatzCents)).toBe(true)
    expect(k.orderCount).toBe(5)
  })

  it('Name und Telefon aus der letzten Bestellung, Tage ab der letzten, erste und letzte als ISO', () => {
    const k = fasseKundinZusammen(
      [
        bestellung({ customerName: 'Neuer Name', customerPhone: '+43 660 1111111', createdAt: vor(3) }),
        bestellung({ customerName: 'Alter Name', createdAt: vor(50) }),
      ],
      null,
      JETZT
    )
    expect(k.customerName).toBe('Neuer Name')
    expect(k.customerPhone).toBe('+43 660 1111111')
    expect(k.daysSinceLastOrder).toBe(3)
    expect(k.firstOrderDate).toBe(vor(50).toISOString())
    expect(k.lastOrderDate).toBe(vor(3).toISOString())
  })

  it('Lieblingsprodukte nach Menge, ohne stornierte Bestellungen, höchstens drei', () => {
    const k = fasseKundinZusammen(
      [
        bestellung({ items: [{ productName: 'Eier', quantity: 2 }, { productName: 'Brot', quantity: 1 }] }),
        bestellung({ items: [{ productName: 'Eier', quantity: 3 }, { productName: 'Honig', quantity: 2 }, { productName: 'Käse', quantity: 1 }] }),
        bestellung({ status: 'CANCELLED', items: [{ productName: 'Speck', quantity: 9 }] }),
      ],
      null,
      JETZT
    )
    expect(k.topProducts).toEqual([
      { name: 'Eier', count: 5 },
      { name: 'Honig', count: 2 },
      { name: 'Brot', count: 1 },
    ])
  })

  it('Neuigkeiten: an, sobald E-Mail oder WhatsApp eingewilligt ist', () => {
    expect(fasseKundinZusammen([bestellung()], null, JETZT).isSubscribed).toBe(false)
    expect(fasseKundinZusammen([bestellung()], { optInEmail: false, optInWhatsApp: false }, JETZT).isSubscribed).toBe(false)
    expect(fasseKundinZusammen([bestellung()], { optInEmail: false, optInWhatsApp: true }, JETZT).isSubscribed).toBe(true)
  })
})

describe('kundenStatus', () => {
  it('Stammkunde ab drei Bestellungen, sticht alles andere', () => {
    expect(kundenStatus(3, 200, 400)).toBe('Stammkunde')
  })
  it('Neu: genau eine Bestellung, jünger als 14 Tage', () => {
    expect(kundenStatus(1, 13, 13)).toBe('Neu')
    expect(kundenStatus(1, 14, 14)).toBe('Diesen Monat aktiv')
  })
  it('Lange nicht gesehen: mindestens zwei Bestellungen, die letzte vor mehr als 60 Tagen', () => {
    expect(kundenStatus(2, 61, 90)).toBe('Lange nicht gesehen')
    expect(kundenStatus(2, 60, 90)).toBeNull()
  })
  it('Diesen Monat aktiv bis 30 Tage, danach ohne Status', () => {
    expect(kundenStatus(2, 30, 40)).toBe('Diesen Monat aktiv')
    expect(kundenStatus(1, 31, 31)).toBeNull()
  })
})

describe('kundenMarke', () => {
  it('Stammkunde grün, Neu und Lange nicht gesehen orange, Diesen Monat aktiv neutral, ohne Status keine Marke', () => {
    expect(kundenMarke('Stammkunde')).toEqual({ text: 'Stammkunde', ton: 'fertig' })
    expect(kundenMarke('Neu')).toEqual({ text: 'Neu', ton: 'offen' })
    expect(kundenMarke('Lange nicht gesehen')).toEqual({ text: 'Lange nicht gesehen', ton: 'offen' })
    expect(kundenMarke('Diesen Monat aktiv')).toEqual({ text: 'Diesen Monat aktiv', ton: 'neutral' })
    expect(kundenMarke(null)).toBeNull()
  })
})

describe('Texte', () => {
  it('zuletztText: heute, gestern, vor N Tagen', () => {
    expect(zuletztText(0)).toBe('heute bestellt')
    expect(zuletztText(1)).toBe('gestern bestellt')
    expect(zuletztText(12)).toBe('zuletzt vor 12 Tagen')
  })
  it('initialen: zwei Buchstaben, auch bei einem Wort und leerem Namen', () => {
    expect(initialen('Erika Mustermann')).toBe('EM')
    expect(initialen('  Anna Maria  Beispiel ')).toBe('AB')
    expect(initialen('Erika')).toBe('ER')
    expect(initialen('')).toBe('?')
  })
  it('kundeSeitText rechnet in Wiener Zeit: 31.12. 23:30 Uhr Wien ist schon Jänner', () => {
    expect(kundeSeitText('2026-03-10T10:00:00Z')).toBe('Kunde seit März 2026')
    expect(kundeSeitText('2026-12-31T23:30:00Z')).toBe('Kunde seit Jänner 2027')
  })
  it('weitereBestellungen zählt alle Bestellungen, nicht nur die geladenen', () => {
    expect(weitereBestellungen(14, 5)).toBe(9)
    expect(weitereBestellungen(5, 5)).toBe(0)
    expect(weitereBestellungen(3, 5)).toBe(0)
  })
  it('kundenSchluessel: klein, ohne Rand — dieselbe Regel wie die Kennung', () => {
    expect(kundenSchluessel('  Erika@Example.COM ')).toBe('erika@example.com')
  })
})

// ─── Filter, Suche, Sortierung, Adresse ─────────────────────────────────────

function kunde(teil: Partial<CustomerSummary> & { kundeId: string }): CustomerSummary {
  return {
    customerEmail: `${teil.kundeId}@example.com`,
    customerName: 'Erika Mustermann',
    customerPhone: '',
    orderCount: 1,
    umsatzCents: 1000,
    firstOrderDate: vor(100).toISOString(),
    lastOrderDate: vor(5).toISOString(),
    daysSinceLastOrder: 5,
    isSubscribed: false,
    topProducts: [],
    status: null,
    isStammkunde: false,
    isDiesenMonatAktiv: true,
    isLangeNichtGesehen: false,
    isNeu: false,
    ...teil,
  }
}

const LISTE: CustomerSummary[] = [
  kunde({ kundeId: 'aaaaaaaaaaaaaaaa', customerName: 'Zita Beispiel', orderCount: 5, umsatzCents: 2000, isStammkunde: true, status: 'Stammkunde', firstOrderDate: vor(300).toISOString() }),
  kunde({ kundeId: 'bbbbbbbbbbbbbbbb', customerName: 'Anton Muster', customerPhone: '+43 660 1234567', orderCount: 1, umsatzCents: 9000, isNeu: true, status: 'Neu', firstOrderDate: vor(2).toISOString(), lastOrderDate: vor(2).toISOString(), daysSinceLastOrder: 2 }),
  kunde({ kundeId: 'cccccccccccccccc', customerName: 'Berta Probe', customerEmail: 'berta.probe@example.com', orderCount: 2, umsatzCents: 500, isLangeNichtGesehen: true, isDiesenMonatAktiv: false, status: 'Lange nicht gesehen', lastOrderDate: vor(90).toISOString(), daysSinceLastOrder: 90 }),
]

describe('Filter, Suche, Sortierung', () => {
  it('zählt je Filter', () => {
    expect(zaehleKundenFilter(LISTE)).toEqual({ alle: 3, stammkunden: 1, aktiv: 2, lange: 1, neu: 1 })
  })

  it('Suche in Name, Telefon und E-Mail, ohne Rücksicht auf Groß-/Kleinschreibung', () => {
    expect(passtZurKundenSuche(LISTE[0], 'zITA')).toBe(true)
    expect(passtZurKundenSuche(LISTE[1], '1234')).toBe(true)
    expect(passtZurKundenSuche(LISTE[2], 'BERTA.PROBE@')).toBe(true)
    expect(passtZurKundenSuche(LISTE[0], 'berta')).toBe(false)
    expect(passtZurKundenSuche(LISTE[0], '   ')).toBe(true)
  })

  it('Filter und Suche zusammen', () => {
    expect(filtereKunden(LISTE, { filter: 'lange', suche: '' }).map((k) => k.customerName)).toEqual(['Berta Probe'])
    expect(filtereKunden(LISTE, { filter: 'aktiv', suche: 'anton' }).map((k) => k.customerName)).toEqual(['Anton Muster'])
    expect(filtereKunden(LISTE, { filter: 'stammkunden', suche: 'anton' })).toEqual([])
  })

  it('sortiert nach Bestellungen, Umsatz, letzter Bestellung, Name und neuesten Kunden — ohne die Eingabe zu ändern', () => {
    const namen = (s: Parameters<typeof sortiereKunden>[1]) => sortiereKunden(LISTE, s).map((k) => k.customerName.split(' ')[0])
    expect(namen('bestellungen')).toEqual(['Zita', 'Berta', 'Anton'])
    expect(namen('umsatz')).toEqual(['Anton', 'Zita', 'Berta'])
    expect(namen('zuletzt')).toEqual(['Anton', 'Zita', 'Berta'])
    expect(namen('name')).toEqual(['Anton', 'Berta', 'Zita'])
    expect(namen('neueste')).toEqual(['Anton', 'Berta', 'Zita'])
    expect(LISTE[0].customerName).toBe('Zita Beispiel')
  })

  it('jede Sortierung in beide Richtungen: wenigste Bestellungen, niedrigster Umsatz, am längsten her, Z bis A, älteste zuerst', () => {
    const namen = (s: Parameters<typeof sortiereKunden>[1], r: 'auf' | 'ab') => sortiereKunden(LISTE, s, r).map((k) => k.customerName.split(' ')[0])
    expect(namen('bestellungen', 'auf')).toEqual(['Anton', 'Berta', 'Zita'])
    expect(namen('umsatz', 'auf')).toEqual(['Berta', 'Zita', 'Anton'])
    expect(namen('zuletzt', 'auf')).toEqual(['Berta', 'Zita', 'Anton'])
    expect(namen('name', 'ab')).toEqual(['Zita', 'Berta', 'Anton'])
    expect(namen('neueste', 'auf')).toEqual(['Zita', 'Berta', 'Anton'])
    // Ohne Richtung die Standardrichtung — dieselbe wie ausdrücklich genannt.
    expect(namen('name', 'auf')).toEqual(sortiereKunden(LISTE, 'name').map((k) => k.customerName.split(' ')[0]))
    expect(namen('umsatz', 'ab')).toEqual(sortiereKunden(LISTE, 'umsatz').map((k) => k.customerName.split(' ')[0]))
  })

  it('die Richtung heißt je Sortierung, was sie tut', () => {
    expect(richtungText('bestellungen', 'auf')).toBe('Wenigste zuerst')
    expect(richtungText('umsatz', 'auf')).toBe('Niedrigster zuerst')
    expect(richtungText('zuletzt', 'auf')).toBe('Am längsten her zuerst')
    expect(richtungText('name', 'ab')).toBe('Z bis A')
    expect(richtungText('name', 'auf')).toBe('A bis Z')
    expect(andereRichtung('auf')).toBe('ab')
    expect(andereRichtung('ab')).toBe('auf')
  })

  it('Adresse ohne Standardwerte, Suche bereinigt', () => {
    expect(kundenAdresse({ filter: 'alle', suche: '', sortierung: 'bestellungen' })).toBe('/customers')
    expect(kundenAdresse({ filter: 'lange', suche: '  anna ', sortierung: 'umsatz' })).toBe('/customers?filter=lange&suche=anna&sortierung=umsatz')
    // Die Richtung nur, wenn sie von der Standardrichtung der Sortierung abweicht.
    expect(kundenAdresse({ filter: 'alle', suche: '', sortierung: 'umsatz', richtung: 'ab' })).toBe('/customers?sortierung=umsatz')
    expect(kundenAdresse({ filter: 'alle', suche: '', sortierung: 'umsatz', richtung: 'auf' })).toBe('/customers?sortierung=umsatz&richtung=auf')
    expect(kundenAdresse({ filter: 'alle', suche: '', sortierung: 'name', richtung: 'auf' })).toBe('/customers?sortierung=name')
    expect(kundenAdresse({ filter: 'alle', suche: '', sortierung: 'name', richtung: 'ab' })).toBe('/customers?sortierung=name&richtung=ab')
  })

  it('Schema: Unbekanntes fällt still auf den Standard, eine überlange Suche auf leer', () => {
    expect(kundenAnsichtAus(new URLSearchParams('filter=neu&suche=%20erika%20&sortierung=name'))).toEqual({ filter: 'neu', suche: 'erika', sortierung: 'name', richtung: 'auf' })
    expect(kundenAnsichtAus(new URLSearchParams('filter=quatsch&sortierung=x'))).toEqual({ filter: 'alle', suche: '', sortierung: 'bestellungen', richtung: 'ab' })
    expect(kundenAnsichtAus(new URLSearchParams('sortierung=umsatz&richtung=auf')).richtung).toBe('auf')
    expect(kundenAnsichtAus(new URLSearchParams('sortierung=umsatz&richtung=quer')).richtung).toBe('ab')
    expect(kundenAnsichtAus(new URLSearchParams(`suche=${'a'.repeat(300)}`)).suche).toBe('')
  })

  it('Kopfzeile: Personen und Stammkunden', () => {
    expect(kundenKopfzeile(LISTE)).toBe('3 Personen · 1 Stammkunde')
    expect(kundenKopfzeile([LISTE[1]])).toBe('1 Person · 0 Stammkunden')
  })
})

// ─── Abfragen (Prisma gemockt; die echte Datenbank: tests/integration/hof-kunden.int.test.ts) ─

describe('Abfragen nur für den eigenen Hof', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.customerFarmSubscription.findMany.mockResolvedValue([])
  })

  const zeile = (teil: Record<string, unknown>) => ({
    id: 'o1',
    orderNumber: 'FZ-1',
    customerEmail: 'erika@example.com',
    customerName: 'Erika Mustermann',
    customerPhone: '',
    status: 'PICKED_UP',
    totalAmount: new Prisma.Decimal('19.99'),
    createdAt: vor(5),
    pickupDate: vor(4),
    items: [],
    ...teil,
  })

  it('Liste: farmId in jeder Abfrage, fehlende Artikel ausgeschlossen, Umsatz in Cent über Decimal', async () => {
    db.order.findMany.mockResolvedValue([
      zeile({ totalAmount: new Prisma.Decimal('0.10'), createdAt: vor(9) }),
      zeile({ totalAmount: new Prisma.Decimal('0.20'), customerEmail: ' Erika@Example.com', createdAt: vor(8) }),
      zeile({ totalAmount: new Prisma.Decimal('19.99'), customerEmail: 'ERIKA@example.com', createdAt: vor(7) }),
    ])
    const liste = await getCustomersForFarm('hof-a')

    const abfrage = db.order.findMany.mock.calls[0][0]
    expect(abfrage.where).toEqual({ farmId: 'hof-a' })
    expect(abfrage.select.items.where).toEqual({ fehltSeit: null })
    expect(db.customerFarmSubscription.findMany.mock.calls[0][0].where).toEqual({ farmId: 'hof-a' })
    // Drei Schreibweisen derselben Adresse = eine Kundin; 0,10 + 0,20 + 19,99 exakt.
    expect(liste).toHaveLength(1)
    expect(liste[0].umsatzCents).toBe(2029)
    expect(liste[0].kundeId).toBe(kundeIdFuer('hof-a', 'erika@example.com'))
  })

  it('Kennung: sucht nur unter den Bestellungen des eigenen Hofs, eine Kennung eines fremden Hofs findet nichts', async () => {
    db.order.findMany.mockResolvedValue([{ customerEmail: 'erika@example.com' }, { customerEmail: 'Erika@example.com ' }])
    const fremd = kundeIdFuer('hof-b', 'erika@example.com')

    expect(await findeKundenAdressen('hof-a', fremd)).toEqual([])
    expect(db.order.findMany.mock.calls[0][0].where).toEqual({ farmId: 'hof-a' })
    expect(await findeKundenAdressen('hof-a', kundeIdFuer('hof-a', 'erika@example.com'))).toEqual(['erika@example.com', 'Erika@example.com '])
  })

  it('Detail: genaue Schreibweisen statt ILIKE, Abo nach derselben Regel wie die Liste, beides mit farmId', async () => {
    db.order.findMany.mockResolvedValue([zeile({ customerEmail: 'a_b@example.com' })])
    db.customerFarmSubscription.findMany.mockResolvedValue([
      { customerEmail: 'axb@example.com', optInEmail: true, optInWhatsApp: true },
      { customerEmail: ' A_B@Example.com ', optInEmail: false, optInWhatsApp: true },
    ])
    const detail = await getCustomerDetail('hof-a', ['a_b@example.com', 'A_B@example.com'])

    const abfrage = db.order.findMany.mock.calls[0][0]
    expect(abfrage.where).toEqual({ farmId: 'hof-a', customerEmail: { in: ['a_b@example.com', 'A_B@example.com'] } })
    expect(abfrage.select.items.where).toEqual({ fehltSeit: null })
    expect(db.customerFarmSubscription.findMany.mock.calls[0][0].where).toEqual({ farmId: 'hof-a' })
    // Klein und ohne Rand zugeordnet — „axb" ist nicht „a_b".
    expect(detail?.subscription).toEqual({ optInEmail: false, optInWhatsApp: true })
    expect(detail?.recentOrders[0].betragCents).toBe(1999)
    expect(detail?.umsatzCents).toBe(1999)
  })

  it('Detail ohne Bestellungen: null; ohne Schreibweise: keine Abfrage', async () => {
    db.order.findMany.mockResolvedValue([])
    expect(await getCustomerDetail('hof-a', ['x@example.com'])).toBeNull()
    db.order.findMany.mockClear()
    expect(await getCustomerDetail('hof-a', [])).toBeNull()
    expect(db.order.findMany).not.toHaveBeenCalled()
  })

  it('kein Number(…) für Geld und kein unmaskiertes insensitive mehr in queries/customers.ts', () => {
    const q = quelle('src/server/queries/customers.ts')
    expect(q).not.toMatch(/Number\(/)
    for (const treffer of q.matchAll(/equals:\s*([^,}]+),\s*mode:\s*'insensitive'/g)) {
      expect(treffer[1]).toMatch(/genauesIlikeMuster\(/)
    }
    // Gegenprobe: Die Suche schlägt bei einer unmaskierten Stelle an.
    const unmaskiert = "equals: customerEmail, mode: 'insensitive'"
    expect([...unmaskiert.matchAll(/equals:\s*([^,}]+),\s*mode:\s*'insensitive'/g)][0][1]).not.toMatch(/genauesIlikeMuster\(/)
  })
})

// ─── Darstellung (serverseitig gerendert, ohne DOM — TESTING_GUIDELINES §1) ──

const LANG = 'Maximiliane Theodora Friederike von und zu Hohenberg-Liechtensteinwaldegg-Oberes'

describe('Ansicht /customers — vier Zustände, lange Namen, Tokens', () => {
  beforeEach(() => {
    navigation.parameter = ''
  })

  it('gefüllt: Kopf, Filter mit Zahlen, Suche, Sortierung, Zeilen mit Link und Anrufen; langer Name im title', () => {
    const html = renderToStaticMarkup(
      createElement(KundenAnsicht, { kunden: [...LISTE, kunde({ kundeId: 'dddddddddddddddd', customerName: LANG, customerPhone: '+43 660 7654321', isSubscribed: true })] })
    )
    expect(LANG.length).toBe(80)
    expect(html).toContain('<h1')
    expect(html).toContain('Kunden')
    expect(html).toContain('4 Personen · 1 Stammkunde')
    expect(html).toMatch(/href="\/customers\?filter=stammkunden"[^>]*>Stammkunden<span[^>]*>· 1</)
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('placeholder="Name, Telefon oder E-Mail"')
    expect(html).toContain('Kundin suchen')
    expect(html).toMatch(/<button[^>]*>[\s\S]*?Sortieren[\s\S]*?<\/button>/)
    expect(html).toContain('href="/customers/aaaaaaaaaaaaaaaa"')
    expect(html).toContain(`title="${LANG}"`)
    expect(html).toContain(`aria-label="${LANG} anrufen"`)
    expect(html).toContain('href="tel:+43 660 7654321"')
    expect(html).toContain('bekommt Neuigkeiten')
    expect(html).toContain('€ 90,00')
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|green-|amber-|purple-|blue-/)
  })

  it('Sortierung hinter EINEM Knopf „Sortieren" (freigabe.md §12 Nr. 45): keine Auswahlliste und kein Richtungsknopf mehr auf der Seite', () => {
    const html = renderToStaticMarkup(createElement(KundenAnsicht, { kunden: LISTE }))
    expect(SORTIEREN_TEXT).toBe('Sortieren')
    expect(html).not.toContain('<select')
    expect(html).not.toContain('Reihenfolge umkehren')
    const knopf = html.match(/<button[^>]*aria-haspopup="dialog"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? ''
    expect(knopf).toContain('Sortieren')
    // Was gerade gilt, hört der Screenreader am Knopf.
    expect(knopf).toContain(sortierungBeschreibung('bestellungen', 'ab'))
    expect(sortierungBeschreibung('bestellungen', 'ab')).toBe('Anzahl Bestellungen – Meiste zuerst')
    expect(sortierungBeschreibung('name', 'auf')).toBe('Name – A bis Z')
  })

  it('?richtung=auf und ?sortierung= wirken weiter auf die Liste', () => {
    const ab = renderToStaticMarkup(createElement(KundenAnsicht, { kunden: LISTE }))
    navigation.parameter = 'richtung=auf'
    const auf = renderToStaticMarkup(createElement(KundenAnsicht, { kunden: LISTE }))
    const reihenfolge = (html: string) => [...html.matchAll(/<table[\s\S]*?<\/table>/g)][0][0].match(/href="\/customers\/([a-z])/g)
    expect(reihenfolge(ab)).toEqual(['href="/customers/a', 'href="/customers/c', 'href="/customers/b'])
    expect(reihenfolge(auf)).toEqual(['href="/customers/b', 'href="/customers/c', 'href="/customers/a'])
    expect(auf).toContain(sortierungBeschreibung('bestellungen', 'auf'))
  })

  const ZAHLEN = { alle: 4, stammkunden: 1, aktiv: 2, lange: 0, neu: 3 }
  const felder = (teil: Partial<Parameters<typeof SortierFelder>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(SortierFelder, {
        sortierung: 'umsatz',
        richtung: 'ab',
        filter: 'alle',
        zahlen: ZAHLEN,
        onSortierung: () => {},
        onRichtung: () => {},
        onFilter: () => {},
        ...teil,
      })
    )

  it('das Blatt hinter „Sortieren": fünf Sortierungen und zwei Richtungen als echte Radioknöpfe, die gewählten angehakt', () => {
    const html = felder()
    expect(html.match(/type="radio"[^>]*name="kunden-sortierung"|name="kunden-sortierung"[^>]*type="radio"/g)).toHaveLength(KUNDEN_SORTIERUNG_WERTE.length)
    expect(html.match(/type="radio"[^>]*name="kunden-richtung"|name="kunden-richtung"[^>]*type="radio"/g)).toHaveLength(2)
    for (const s of KUNDEN_SORTIERUNG_WERTE) expect(html).toContain(KUNDEN_SORTIERUNG_LABEL[s])
    // Die Richtung heißt, was sie bei dieser Sortierung tut — die Standardrichtung zuerst.
    expect(html.indexOf('Höchster zuerst')).toBeGreaterThan(-1)
    expect(html.indexOf('Höchster zuerst')).toBeLessThan(html.indexOf('Niedrigster zuerst'))
    // Sortierung, Richtung und Filter: je eine Wahl angehakt.
    expect(html.match(/checked=""/g)).toHaveLength(3)
    expect(html).toContain('<fieldset')
    expect(html).toContain('<legend')
  })

  it('höchstens zwei Filter sichtbar: Alle und Stammkunden — ein anderer gewählter Filter tritt an die Stelle von Stammkunden', () => {
    expect(sichtbareKundenFilter('alle')).toEqual(['alle', 'stammkunden'])
    expect(sichtbareKundenFilter('stammkunden')).toEqual(['alle', 'stammkunden'])
    expect(sichtbareKundenFilter('lange')).toEqual(['alle', 'lange'])
    for (const f of KUNDEN_FILTER_WERTE) {
      expect(sichtbareKundenFilter(f).length).toBeLessThanOrEqual(2)
      expect(sichtbareKundenFilter(f)).toContain(f)
      navigation.parameter = f === 'alle' ? '' : `filter=${f}`
      const html = renderToStaticMarkup(createElement(KundenAnsicht, { kunden: LISTE }))
      expect(html.match(/data-slot="filter-chip"/g), f).toHaveLength(2)
      expect(html).toContain(`>${KUNDEN_FILTER_LABEL[f]}<`)
    }
  })

  it('alle fünf Filter bleiben erreichbar: im Blatt hinter „Sortieren" steht der Abschnitt „Zeigen" mit Zahl (Runde 1)', () => {
    const html = felder({ filter: 'neu' })
    expect(ZEIGEN_TEXT).toBe('Zeigen')
    expect(html).toContain(`>${ZEIGEN_TEXT}</legend>`)
    expect(html.match(/name="kunden-filter"/g)).toHaveLength(KUNDEN_FILTER_WERTE.length)
    for (const f of KUNDEN_FILTER_WERTE) expect(html).toMatch(new RegExp(`${KUNDEN_FILTER_LABEL[f]}<span[^>]*>· ${ZAHLEN[f]}<`))
    expect(html).toMatch(/value="neu"[^>]*checked=""|checked=""[^>]*value="neu"/)
    // Die Liste selbst zeigt weiter höchstens zwei Chips (siehe oben).
  })

  it('Regeln des Blatts (rein): neue Sortierung in ihrer Standardrichtung, „Abbrechen" lässt die Liste, „Übernehmen" schreibt alles (Runde 1)', () => {
    const wahl = { sortierung: 'umsatz', richtung: 'auf', filter: 'alle' } as const
    // Name beginnt bei A bis Z, alles andere beim Größten.
    expect(mitSortierung(wahl, 'name')).toEqual({ sortierung: 'name', richtung: 'auf', filter: 'alle' })
    expect(mitSortierung(wahl, 'bestellungen')).toEqual({ sortierung: 'bestellungen', richtung: 'ab', filter: 'alle' })
    // Dieselbe Sortierung noch einmal gewählt: die Richtung bleibt, wie sie ist.
    expect(mitSortierung(wahl, 'umsatz')).toEqual(wahl)
    const aktuell = { filter: 'alle', suche: 'hu', sortierung: 'bestellungen', richtung: 'ab' } as const
    expect(blattStart(aktuell)).toEqual({ sortierung: 'bestellungen', richtung: 'ab', filter: 'alle' })
    const entwurf = { sortierung: 'name', richtung: 'auf', filter: 'neu' } as const
    expect(blattAdresse(aktuell, entwurf, 'abbrechen')).toBeNull()
    expect(blattAdresse(aktuell, entwurf, 'uebernehmen')).toBe('/customers?filter=neu&suche=hu&sortierung=name')
    // Die Wahl ist ein Teil der Ansicht, abgeleitet statt von Hand nachgebaut (Runde 2).
    expectTypeOf<KundenBlattWahl>().toEqualTypeOf<Pick<AnsichtWerte, 'sortierung' | 'richtung' | 'filter'>>()
    expect(quelle('src/lib/hof-kunden.ts')).toContain("export type KundenBlattWahl = Pick<KundenAnsicht, 'sortierung' | 'richtung' | 'filter'>")
    // Die Komponente nutzt genau diese Regeln — keine zweite Fassung im Browser-Code.
    const komponente = quelle('src/components/hof-kunden/kunden-sortieren.tsx')
    expect(komponente).toContain('mitSortierung(')
    expect(komponente).toContain('blattAdresse(')
    expect(komponente).not.toContain('STANDARD_RICHTUNG[')
  })

  it('ein Telefon aus Leerzeichen ist keins — kein Anrufen-Link', () => {
    const html = renderToStaticMarkup(createElement(KundenAnsicht, { kunden: [kunde({ kundeId: 'eeeeeeeeeeeeeeee', customerPhone: '   ' })] }))
    expect(html).not.toContain('href="tel:')
    expect(html).not.toContain('anrufen"')
  })

  it('Tipp ab drei Kundinnen, die lange nicht bestellt haben — mit Weg zum Filter', () => {
    const lange = [0, 1, 2].map((i) => kunde({ kundeId: `l${i}lllllllllllllll`.slice(0, 16), isLangeNichtGesehen: true, status: 'Lange nicht gesehen' }))
    expect(renderToStaticMarkup(createElement(KundenAnsicht, { kunden: lange }))).toContain('href="/customers?filter=lange"')
    expect(renderToStaticMarkup(createElement(KundenAnsicht, { kunden: lange.slice(0, 2) }))).not.toContain('länger nicht bestellt')
  })

  it('leer: EmptyState mit Ausweg', () => {
    const html = renderToStaticMarkup(createElement(KundenAnsicht, { kunden: [] }))
    expect(html).toContain('Noch keine Kunden')
    expect(html).toContain('href="/farm-page"')
  })

  it('kein Treffer: EmptyState mit „Alle Kunden zeigen"', () => {
    navigation.parameter = 'suche=niemand'
    const html = renderToStaticMarkup(createElement(KundenAnsicht, { kunden: LISTE }))
    expect(html).toContain('Niemand passt')
    expect(html).toContain('Alle Kunden zeigen')
  })

  it('Ladeansichten zeigen aria-busy', () => {
    expect(quelle('src/components/hof-kunden/kunden-laden.tsx')).toContain('aria-busy="true"')
  })
})

describe('Kundendetail', () => {
  function detail(teil: Partial<CustomerDetail> = {}): CustomerDetail {
    return {
      ...kunde({ kundeId: 'aaaaaaaaaaaaaaaa', customerName: LANG, customerPhone: '+43 660 7654321', orderCount: 14, umsatzCents: 12345, status: 'Stammkunde', isStammkunde: true, isSubscribed: true, topProducts: [{ name: 'Eier', count: 12 }] }),
      recentOrders: Array.from({ length: 10 }, (_, i) => ({
        id: `order-${i}`,
        orderNumber: `FZ-${i}`,
        createdAt: vor(i).toISOString(),
        betragCents: 1050,
        status: i === 0 ? 'READY' : 'PICKED_UP',
        items: [{ productName: 'Eier', quantity: 2 }],
      })),
      subscription: { optInEmail: true, optInWhatsApp: false },
      ...teil,
    }
  }

  it('gefüllt: Name mit title, Marke, Kontaktwege, Kennzahlen, Neuigkeiten, Bestellungen mit Link und Rest-Zahl', () => {
    const html = renderToStaticMarkup(createElement(KundenDetail, { kunde: detail(), jetzt: JETZT }))
    expect(html).toContain('<h1')
    expect(html).toContain(`title="${LANG}"`)
    expect(html).toContain('Stammkunde')
    expect(html).toContain('href="tel:+43 660 7654321"')
    expect(html).toContain('href="https://wa.me/436607654321"')
    expect(html).toContain('href="mailto:aaaaaaaaaaaaaaaa@example.com"')
    expect(html).toContain('€ 123,45')
    expect(html).toContain('Eier')
    expect(html).toContain('E-Mail-Neuigkeiten')
    expect(html).toContain('href="/orders/order-0"')
    expect(html).not.toContain('href="/orders/order-5"')
    expect(html).toContain('9 weitere')
    expect(html).toContain('href="/customers"')
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|green-|amber-|purple-|blue-/)
  })

  it('„N weitere Bestellungen": beide Filter verlinkt, die zusammen alle Bestellungen zeigen — auch überfällige offene (Runde 1)', () => {
    const html = renderToStaticMarkup(createElement(KundenDetail, { kunde: detail(), jetzt: JETZT }))
    expect(html).toContain('9 weitere Bestellungen findest du unter Bestellungen bei')
    expect(html).toMatch(/href="\/orders"[^>]*>Noch offen</)
    expect(html).toMatch(/href="\/orders\?filter=erledigt"[^>]*>Erledigt</)
  })

  it('ohne Telefon: kein Anrufen und kein WhatsApp, E-Mail bleibt', () => {
    const html = renderToStaticMarkup(createElement(KundenDetail, { kunde: detail({ customerPhone: '' }), jetzt: JETZT }))
    expect(html).not.toContain('href="tel:')
    expect(html).not.toContain('wa.me')
    expect(html).toContain('mailto:')
    expect(html).toContain('Keine Telefonnummer')
  })

  it('ohne Einwilligung keine Karte „Neuigkeiten"', () => {
    const html = renderToStaticMarkup(createElement(KundenDetail, { kunde: detail({ isSubscribed: false, subscription: null }), jetzt: JETZT }))
    expect(html).not.toContain('E-Mail-Neuigkeiten')
  })
})

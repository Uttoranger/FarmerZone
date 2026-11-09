/**
 * Hof-Alltag (Nr. 222, Lauf 30): das Wort der Gebühr je Modell der Bestellung
 * (V62, V63) auf Bestellung, Storno und Papier — und der Rendertest „kein
 * ‚Servicegebühr‘ nach dem Stichtag“ für Heute, Bestellung und Druck.
 *
 * Nach dem Stichtag „Hofpreis-Modell ab“ entstehen nur Bestellungen mit
 * `gebuehrModell: 'hofpreis'`: An ihnen darf das Wort „Servicegebühr“ nirgends
 * stehen. Gegenprobe je Fall: dieselbe Bestellung im Modell „bisher“ nennt es.
 * Beträge kommen fest aus dem Snapshot; gerechnet wird hier nichts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const m = vi.hoisted(() => ({
  bestellung: null as unknown,
  bestellungen: [] as unknown[],
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; [k: string]: unknown }) => {
    const attribute = { ...rest }
    delete attribute.prefetch
    delete attribute.onNavigate
    return createElement('a', { href, ...attribute }, children)
  },
  useLinkStatus: () => ({ pending: false }),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
  usePathname: () => '/orders/order-1',
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/server/actions/orders', () => ({
  cancelOrder: vi.fn(),
  meldeArtikelFehlt: vi.fn(),
  markAsNotPickedUp: vi.fn(),
  markAsPickedUp: vi.fn(),
  markAsPickedUpAndPaid: vi.fn(),
  markAsReady: vi.fn(),
  revertOrderStatus: vi.fn(),
  revertPickedUp: vi.fn(),
  revertReady: vi.fn(),
}))
vi.mock('@/server/hofbereich', () => ({ verlangeHofDerSitzung: async () => ({ userId: 'u1', farmId: 'farm_1' }) }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: async () => ({ id: 'farm_1', name: 'Hof Test' }) }))
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: async () => {} }))
vi.mock('@/server/queries/orders', () => ({ getOrderDetail: async () => m.bestellung, naechstesFensterMitZahl: async () => null }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: async () => ({ id: 'farm_1', name: 'Hof Test', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf', phone: null }) },
    order: { findMany: async () => m.bestellungen, count: async () => 0 },
    pickupSlot: { findMany: async () => [] },
  },
}))

import OrderPrintPage from '@/app/(druck)/orders/[orderId]/print/page'
import PrintPacklistPage from '@/app/(druck)/orders/today/print/page'
import { BestellDetail } from '@/components/hof-bestellungen/bestell-detail'
import { Kennzahlen, Packliste } from '@/components/heute/heute-teile'
import { betragSatz, bestellAktionen, druckGebuehrZeile, type BetragFuerSatz } from '@/lib/hof-bestellungen'
import { stornoGebuehrSatz, stornoGeldSaetze, stornoZusammensetzung, type StornoBetraege } from '@/lib/storno'
import type { HofBestellDetail } from '@/server/queries/orders'
import { MARKE } from '@/lib/marke'

const WORT_BISHER = 'Servicegebühr'
const HOFPREIS = 'hofpreis'

beforeEach(() => {
  m.bestellung = null
  m.bestellungen = []
})

// ─── Helfer ─────────────────────────────────────────────────────────────────

const betrag = (teil: Partial<BetragFuerSatz>): BetragFuerSatz => ({
  warenCents: 1800,
  gebuehrCents: 112,
  gesamtCents: 1912,
  gebuehrFuerAbrechnung: false,
  hofpreis: false,
  ...teil,
})

describe('betragSatz — was beim Hof bleibt, Wort je Modell', () => {
  it('Hofpreis online: „Du bekommst … · die Kundin zahlt …“ ohne „Servicegebühr“', () => {
    const satz = betragSatz(betrag({ hofpreis: true }), false)
    expect(satz).toBe('Du bekommst € 18,00 · die Kundin zahlt € 19,12 – die Gebühr ist online einbehalten.')
    expect(satz).not.toContain(WORT_BISHER)
  })

  it('Hofpreis bar mit Monatsabrechnung bzw. ohne (Gründungshof, „erlassen“)', () => {
    expect(betragSatz(betrag({ hofpreis: true, gebuehrFuerAbrechnung: true }), true)).toBe(
      'Du bekommst € 18,00 · die Kundin zahlt € 19,12 – die Gebühr holt die Monatsabrechnung.'
    )
    const erlassen = betragSatz(betrag({ hofpreis: true, gebuehrFuerAbrechnung: false }), true)
    expect(erlassen).toBe('Du bekommst die vollen € 19,12 – auf diese Barbestellung zahlst du keine Plattformgebühr.')
    expect(erlassen).not.toContain(WORT_BISHER)
  })

  it('Gegenprobe „bisher“: Warenpreis + Servicegebühr', () => {
    expect(betragSatz(betrag({ warenCents: 1000, gebuehrCents: 50, gesamtCents: 1050 }), false)).toBe(
      'Warenpreis € 10,00 + Servicegebühr € 0,50 – die Gebühr ist online einbehalten.'
    )
    expect(betragSatz(betrag({ warenCents: 1000, gebuehrCents: 0, gesamtCents: 1000 }), true)).toBe('Warenpreis € 10,00')
  })
})

describe('Storno-Dialog je Modell (Geldweg aus stornieren.ts in beiden Modellen gleich)', () => {
  const BETRAEGE: StornoBetraege = { erstattetCents: 1912, vomHofCents: 1800, servicegebuehrCents: 112, provisionCents: 0 }

  it('Hofpreis: Plattformgebühr, „wird mit erstattet“ — nie „Servicegebühr“', () => {
    const modell = { gebuehrModell: HOFPREIS }
    expect(stornoZusammensetzung(BETRAEGE, modell)).toBe('Warenpreis € 18,00 + Plattformgebühr € 1,12')
    expect(stornoGebuehrSatz(BETRAEGE, modell)).toBe(`Die Plattformgebühr wird mit erstattet – sie gibt ${MARKE} zurück, nicht du.`)
    const saetze = stornoGeldSaetze({ kundenName: 'Erika', paymentMethod: 'ONLINE', betraege: BETRAEGE, gebuehrModell: HOFPREIS })
    expect(saetze.join(' ')).not.toContain(WORT_BISHER)
    expect(saetze[0]).toBe('Erika bekommt zurück: € 19,12 (Warenpreis + Plattformgebühr)')
  })

  it('Gegenprobe „bisher“: der Satz von heute', () => {
    expect(stornoZusammensetzung(BETRAEGE, { gebuehrModell: null })).toBe('Warenpreis € 18,00 + Servicegebühr € 1,12')
    expect(stornoGebuehrSatz(BETRAEGE, { gebuehrModell: null })).toBe(`Die Servicegebühr erstattet ${MARKE}.`)
    expect(stornoGebuehrSatz({ ...BETRAEGE, servicegebuehrCents: 0 }, { gebuehrModell: null })).toBeNull()
  })
})

describe('Papier: die Zeile „Servicegebühr“ nur bei Bestellungen im Modell „bisher“', () => {
  it('druckGebuehrZeile', () => {
    expect(druckGebuehrZeile({ gebuehrModell: HOFPREIS }, 112)).toBeNull()
    expect(druckGebuehrZeile({ gebuehrModell: null }, 50)).toBe(WORT_BISHER)
    expect(druckGebuehrZeile({ gebuehrModell: null }, 0)).toBeNull()
  })
})

// ─── Rendertest: kein „Servicegebühr“ nach dem Stichtag ────────────────────

function bestellungFuerDruck(gebuehrModell: string | null, paymentMethod: 'ONLINE' | 'ONSITE_CASH') {
  return {
    id: 'order-1',
    orderNumber: 'HT-0306-A4F2',
    status: 'CONFIRMED',
    createdAt: new Date('2027-03-03T05:51:00Z'),
    pickupDate: new Date('2027-03-03T11:00:00Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    customerName: 'Erika Beispiel',
    customerPhone: '+43 660 0000000',
    customerEmail: 'erika@example.com',
    customerNote: null,
    paymentMethod,
    paymentStatus: paymentMethod === 'ONLINE' ? 'PAID' : 'PENDING',
    totalAmount: '18.00',
    serviceFeeCents: 112,
    gebuehrModell,
    items: [{ id: 'i1', productName: 'Bergkäse', quantity: 2, totalPriceCents: 1800, fehltSeit: null, product: { unit: 'STUECK', unitSize: null } }],
  }
}

describe('Druck: Abholzettel und Packliste', () => {
  it('Abholzettel im Hofpreis-Modell: kein „Servicegebühr“, dafür „Gesamt inkl. Plattformgebühr.“ und „Bar zu kassieren“', async () => {
    m.bestellung = bestellungFuerDruck(HOFPREIS, 'ONSITE_CASH')
    const html = renderToStaticMarkup(await OrderPrintPage({ params: Promise.resolve({ orderId: 'order-1' }) }))
    expect(html).not.toContain(WORT_BISHER)
    // Nr. 249b: die Positionen stehen ohne Gebühr — der Satz spricht vom Gesamt (druckGesamtHinweis).
    expect(html).toContain('Gesamt inkl. Plattformgebühr.')
    expect(html).not.toContain('Preise inkl. Plattformgebühr.')
    expect(html).toContain('Bar zu kassieren: € 19,12')
    // V57: Papier = Bildschirm.
    expect(html).toContain('Zum Packen')
    expect(html).toContain('Zahlung: Bar bei Abholung')
    // Liste Lauf 32 (druck Bild 1): der Satz zur Gebühr voran im Fuß, E-Mail bricht nach dem „@“, Tabellenkopf fett.
    expect(html).toMatch(/Gesamt inkl\. Plattformgebühr\. Bestellnummer nur zum Abgleich/)
    expect(html).toContain('erika@<wbr/>example.com')
    expect(html).not.toContain('[overflow-wrap:anywhere]')
    expect(html).toMatch(/<th class="[^"]*font-bold[^"]*">Produkt<\/th>/)
  })

  it('Gegenprobe: dieselbe Bestellung im Modell „bisher“ nennt die Servicegebühr', async () => {
    m.bestellung = bestellungFuerDruck(null, 'ONSITE_CASH')
    const html = renderToStaticMarkup(await OrderPrintPage({ params: Promise.resolve({ orderId: 'order-1' }) }))
    expect(html).toContain(WORT_BISHER)
    expect(html).not.toContain('inkl. Plattformgebühr.')
  })

  it('Packliste im Hofpreis-Modell: kein „Servicegebühr“, „Bar bei Abholung“ statt „Barzahlung vor Ort“; Gegenprobe „bisher“', async () => {
    m.bestellungen = [bestellungFuerDruck(HOFPREIS, 'ONSITE_CASH'), { ...bestellungFuerDruck(HOFPREIS, 'ONLINE'), id: 'order-2', status: 'PENDING_CONFIRMATION' }]
    const html = renderToStaticMarkup(await PrintPacklistPage())
    expect(html).not.toContain(WORT_BISHER)
    expect(html).not.toContain('Barzahlung vor Ort')
    expect(html).toContain('Bar bei Abholung')
    expect(html).toContain('Wartet auf Kunde')
    // Nr. 277 (Antwort 4): der Satz spricht vom Gesamt und steht je Bestellung — „Preise inkl.“ nie mehr.
    expect(html).toContain('Gesamt inkl. Plattformgebühr.')
    expect(html).not.toContain('Preise inkl. Plattformgebühr.')

    // Seit Nr. 249 (Liste Lauf 32, druck Bild 2) zeigt die Packliste nur den Betrag, ohne „inkl. € … <Gebühr>“ —
    // auch im Modell „bisher“; die Aufteilung steht auf dem Abholzettel (Gegenprobe dort).
    m.bestellungen = [bestellungFuerDruck(null, 'ONSITE_CASH')]
    const bisher = renderToStaticMarkup(await PrintPacklistPage())
    expect(bisher).not.toContain(WORT_BISHER)
    expect(bisher).not.toMatch(/inkl\. €/)
    expect(bisher).toContain('Bar zu kassieren')
  })

  it('leere Packliste: der Satz des Boards', async () => {
    const html = renderToStaticMarkup(await PrintPacklistPage())
    expect(html).toContain('Heute keine Bestellungen zur Abholung.')
  })
})

/**
 * Packliste, Antwort 4 der Projektleitung (Nr. 277): „Gesamt inkl. Plattformgebühr.“ steht je Bestellung an
 * ihrem gezeigten Betrag und nur, wenn DIESES Gesamt die Gebühr enthält (druckGesamtHinweis) — nie mehr einmal
 * „Preise inkl. Plattformgebühr.“ für die ganze Seite. Nur Anzeige: Die Beträge bleiben dieselben.
 */
describe('Packliste: Satz zum Gesamt je Bestellung (Nr. 277, Antwort 4)', () => {
  const SATZ = 'Gesamt inkl. Plattformgebühr.'
  const anzahl = (html: string): number => html.split(SATZ).length - 1
  /** Der Block einer Bestellung auf dem Papier — vom Namen bis zum nächsten Namen bzw. zum Fuß. */
  const blockVon = (html: string, nummer: string): string => {
    const start = html.indexOf(nummer)
    const ende = html.indexOf('HT-', start + nummer.length)
    return html.slice(start, ende === -1 ? html.indexOf('Gedruckt am', start) : ende)
  }

  it('(a) nur Bestellungen im Modell „bisher“: kein Satz', async () => {
    m.bestellungen = [bestellungFuerDruck(null, 'ONSITE_CASH'), { ...bestellungFuerDruck(null, 'ONLINE'), id: 'order-2', orderNumber: 'HT-0306-B5C1' }]
    const html = renderToStaticMarkup(await PrintPacklistPage())
    expect(anzahl(html)).toBe(0)
    expect(html).not.toMatch(/inkl\. Plattformgebühr/)
    // Gegenprobe: Die Beträge stehen unverändert da.
    expect(html).toContain('Bar zu kassieren € 19,12')
    expect(html).toContain('€ 19,12')
  })

  it('(b) eine Bestellung im Hofpreis-Modell mit Gebühr: der Satz zum Gesamt an ihrem Betrag', async () => {
    m.bestellungen = [bestellungFuerDruck(HOFPREIS, 'ONSITE_CASH')]
    const html = renderToStaticMarkup(await PrintPacklistPage())
    expect(anzahl(html)).toBe(1)
    // Direkt unter dem Betrag, nicht als Satz unter der Liste.
    expect(html).toMatch(/Bar zu kassieren € 19,12<\/span><span[^>]*>Gesamt inkl\. Plattformgebühr\.<\/span>/)
    expect(html).not.toContain('Preise inkl.')
  })

  it('(c) Hofpreis-Modell mit entfallener Gebühr: kein Satz', async () => {
    m.bestellungen = [
      { ...bestellungFuerDruck(HOFPREIS, 'ONSITE_CASH'), serviceFeeRefundedAt: new Date('2027-03-03T08:00:00Z') },
      { ...bestellungFuerDruck(HOFPREIS, 'ONLINE'), id: 'order-2', orderNumber: 'HT-0306-B5C1', serviceFeeCents: 0 },
    ]
    const html = renderToStaticMarkup(await PrintPacklistPage())
    expect(anzahl(html)).toBe(0)
    // Auch kein „Preise inkl. …“ mehr über Positionen ohne Gebühr (vorher stand er hier).
    expect(html).not.toMatch(/inkl\. Plattformgebühr/)
    // Gegenprobe: Die Beträge kommen weiter unverändert aus dem Snapshot (bestellSummen, barZuKassierenCents).
    expect(html).toContain('Bar zu kassieren € 19,12')
    expect(html).toContain('€ 18,00')
  })

  it('gemischte Bestellungen: der Satz steht nur an den Bestellungen, deren Gesamt die Gebühr enthält', async () => {
    m.bestellungen = [
      { ...bestellungFuerDruck(HOFPREIS, 'ONSITE_CASH'), id: 'a', orderNumber: 'HT-0306-AAAA' },
      { ...bestellungFuerDruck(null, 'ONSITE_CASH'), id: 'b', orderNumber: 'HT-0306-BBBB' },
      { ...bestellungFuerDruck(HOFPREIS, 'ONLINE'), id: 'c', orderNumber: 'HT-0306-CCCC' },
      { ...bestellungFuerDruck(HOFPREIS, 'ONLINE'), id: 'd', orderNumber: 'HT-0306-DDDD', serviceFeeRefundedAt: new Date('2027-03-03T08:00:00Z') },
    ]
    const html = renderToStaticMarkup(await PrintPacklistPage())
    expect(anzahl(html)).toBe(2)
    expect(blockVon(html, 'HT-0306-AAAA')).toContain(SATZ)
    expect(blockVon(html, 'HT-0306-BBBB')).not.toContain(SATZ)
    expect(blockVon(html, 'HT-0306-CCCC')).toContain(SATZ)
    expect(blockVon(html, 'HT-0306-DDDD')).not.toContain(SATZ)
    // Kein Satz für die ganze Seite unter der Liste.
    expect(html.slice(html.lastIndexOf('HT-0306-DDDD'))).not.toContain(SATZ)
  })

  it('Einheiten wie die Bestellseite: „(1 L)“ und „(6 Pakete)“ statt „(1 l)“ und „(6 Pak.)“, Anzahl fett vorn (G14)', async () => {
    m.bestellungen = [
      {
        ...bestellungFuerDruck(null, 'ONSITE_CASH'),
        items: [
          { id: 'i1', productName: 'Heumilch frisch', quantity: 4, totalPriceCents: 596, fehltSeit: null, product: { unit: 'LITER', unitSize: '1' } },
          { id: 'i2', productName: 'Bio-Freilandeier', quantity: 1, totalPriceCents: 477, fehltSeit: null, product: { unit: 'PAKET', unitSize: '6' } },
        ],
      },
    ]
    const html = renderToStaticMarkup(await PrintPacklistPage())
    expect(html).toContain('(1 L)')
    expect(html).toContain('(6 Pakete)')
    expect(html).not.toContain('(1 l)')
    expect(html).not.toContain('Pak.)')
    expect(html).toMatch(/<span class="font-bold[^"]*">4<\/span> × Heumilch frisch \(1 L\)/)
  })
})

function detail(hofpreis: boolean, vorOrt: boolean): HofBestellDetail {
  return {
    id: 'order-1',
    nummer: 'HT-0306-A4F2',
    status: 'CONFIRMED',
    marke: { text: 'Zum Packen', art: 'tun' },
    abholung: 'heute, Mi 3. März, 15–18 Uhr',
    bestelltAm: 'heute, 06:51',
    kunde: { name: 'Erika Beispiel', vorname: 'Erika', email: 'erika@example.com', telefon: '+43 660 0000000', notiz: null },
    zahlart: vorOrt ? 'Bar bei Abholung' : 'Online bezahlt',
    vorOrt,
    bezahltAm: null,
    betrag: { warenCents: 1800, gebuehrCents: 112, gesamtCents: 1912, erstattetCents: 0, gebuehrEntfallen: false, gebuehrErstattungOffen: true, gebuehrFuerAbrechnung: vorOrt, hofpreis },
    positionen: [],
    storno: null,
    stornoGrund: null,
    aktionen: bestellAktionen({ status: 'CONFIRMED', paymentMethod: vorOrt ? 'ONSITE_CASH' : 'ONLINE', offenePositionen: 1 }),
    erinnernUrl: null,
  }
}

describe('Bestellung im Hofbereich', () => {
  it('im Hofpreis-Modell (online und bar) steht nirgends „Servicegebühr“; die Hauptaktion heißt „Als gepackt markieren“', () => {
    for (const vorOrt of [true, false]) {
      const html = renderToStaticMarkup(createElement(BestellDetail, { bestellung: detail(true, vorOrt), zurueckSuche: '' }))
      expect(html, String(vorOrt)).not.toContain(WORT_BISHER)
      expect(html).toContain('Als gepackt markieren')
    }
    // Eine stornierte Bestellung mit offener Erstattung nennt den Vermerk mit dem Wort der Bestellung.
    const storniert = renderToStaticMarkup(createElement(BestellDetail, { bestellung: { ...detail(true, false), status: 'CANCELLED' }, zurueckSuche: '' }))
    expect(storniert).toContain('Plattformgebühr-Erstattung ausstehend.')
    expect(storniert).not.toContain(WORT_BISHER)
  })

  it('Gegenprobe „bisher“: dieselbe Bestellung nennt die Servicegebühr', () => {
    const html = renderToStaticMarkup(createElement(BestellDetail, { bestellung: detail(false, true), zurueckSuche: '' }))
    expect(html).toContain(WORT_BISHER)
  })

  it('Bar-Frist: der Satz aus der Seite steht unter dem Betrag', () => {
    const satz = 'Erika hat noch nicht bestätigt. Ohne Bestätigung bis heute, 09:50 Uhr entfällt die Bestellung, die Ware kommt zurück in deinen Vorrat.'
    const html = renderToStaticMarkup(createElement(BestellDetail, { bestellung: detail(true, true), zurueckSuche: '', barFrist: satz }))
    expect(html).toContain(satz)
  })
})

describe('Heute', () => {
  it('Packliste und Kennzahlen nennen keine Gebühr — auch nicht „Servicegebühr“', () => {
    const html =
      renderToStaticMarkup(
        createElement(Packliste, {
          zeilen: [{ id: 'o1', chip: 'vorbereiten', uhrzeit: '15:00–18:00', kunde: 'Erika B.', positionen: '2× Bergkäse', zahlart: 'bar', gesamtCents: 1912 }],
          stand: '1 zu packen',
          leer: { naechsteAbholung: null },
        })
      ) + renderToStaticMarkup(createElement(Kennzahlen, { bestellungen: 1, zuPacken: 1, umsatzHeuteCent: 1912 }))
    expect(html).toContain('€ 19,12')
    expect(html).not.toContain(WORT_BISHER)
  })
})

/**
 * Admin Teil 1: Gebühren-Wort nach dem Stichtag (Lauf 30, Nr. 229; V62, V63; Register N38 mit A1).
 *
 * Ursache: Ab dem Stichtag „Hofpreis-Modell ab“ heißt die Gebühr auch im Admin
 * „Plattformgebühr“. Akte, Freischalt-Dialog und Bestell-Detail zeigten
 * „Servicegebühr“ ohne Bedingung; der Knopf „Servicegebühr …“ der Akte schrieb
 * nach dem Stichtag den Satz des alten Modells (A1: ab dem Stichtag nicht zeigen).
 *
 * Beweist (Rendertest „kein ‚Servicegebühr‘ nach dem Stichtag“, je mit Gegenprobe):
 *  - Akte im Modell „hofpreis“: kein Knopf „Servicegebühr …“, kein Satz dazu, die
 *    Aktivität mit dem Wort des Zeitraums; im Modell „bisher“ Knopf und Satz.
 *  - Freischalt-Dialog: „Derzeit gilt …“ nach N38 bzw. KONDITIONEN_DERZEIT.
 *  - Bestell-Detail (/admin/bestellungen?bestellung=…): „inkl. € … Plattformgebühr“
 *    und die Zeile „Plattformgebühr“ aus `Order.gebuehrModell`; eine Bestellung im
 *    Modell „bisher“ behält „Servicegebühr“.
 *  - Zur Liste nur am Handy (Board s3-admin-bestellungen).
 * Admin › Heute prüft tests/admin-heute.test.ts (Geld-Kachel).
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Prisma } from '@prisma/client'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => {
    const attribute = Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'onNavigate' && k !== 'prefetch' && k !== 'scroll'))
    return createElement('a', { href, ...attribute }, children)
  },
  useLinkStatus: () => ({ pending: false }),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/server/actions/admin', () => ({
  approveFarmAction: vi.fn(),
  revokeFarmApprovalAction: vi.fn(),
  rejectFarmAction: vi.fn(),
  setServiceFeeAction: vi.fn(),
  setzeGruendungBisAction: vi.fn(),
}))
vi.mock('@/server/actions/gruendung', () => ({ nimmAusGruendung: vi.fn(), nimmWiederAuf: vi.fn(), markiereAlsTesthof: vi.fn(), nimmTesthofZurueck: vi.fn() }))
vi.mock('@/server/actions/admin-hof', () => ({ sperreHof: vi.fn(), hebeHofSperreAuf: vi.fn() }))
// Der Dialog zeigt seinen Inhalt nur offen — die Attrappe rendert ihn offen ohne Base UI.
vi.mock('@/components/hof-bestellungen/bestell-dialog', () => ({
  BestellDialog: ({ offen, titel, children }: { offen: boolean; titel: string; children?: ReactNode }) =>
    offen ? createElement('section', { 'aria-label': titel }, createElement('h2', null, titel), children) : null,
  DialogFehler: ({ text }: { text: string | null }) => (text ? createElement('p', null, text) : null),
}))
// Bestell-Detail: die Seite echt, die Quellen und die Client-Knöpfe als Attrappen.
const quellen = vi.hoisted(() => ({ ladeBestellListe: vi.fn(), ladeBestellDetail: vi.fn() }))
vi.mock('@/server/admin-wache', () => ({ verlangeAdminSeite: vi.fn(async () => 'ich') }))
vi.mock('@/server/queries/admin-bestellungen', () => quellen)
vi.mock('@/server/queries/mails', () => ({ ladeHofAuswahl: vi.fn(async () => []) }))
vi.mock('@/server/widerruf', () => ({ ladeWiderrufeOhneBestellung: vi.fn(async () => []) }))
vi.mock('@/app/admin/bestellungen/bestellung-aktionen', () => ({ BestellungAktionen: () => null }))
vi.mock('@/app/admin/bestellungen/widerruf-zuordnen', () => ({ WiderrufZuordnen: () => null }))
vi.mock('@/components/admin/auskunft-kundin', () => ({ AuskunftKundin: () => null }))

import { HofAkteAnsicht } from '@/components/admin/hof-akte-ansicht'
import { HofAktionDialog } from '@/components/admin/hof-aktion-dialog'
import type { AdminHof } from '@/components/admin/hoefe-ansicht'
import { adminHofZeile } from '@/lib/admin-hoefe'
import { aktivitaetGebuehrZeile, servicegebuehrKnopfSichtbar, type HofAkteAnsicht as AkteDaten } from '@/lib/admin-hof-akte'
import { aktivitaetSeit } from '@/lib/admin-hoefe-liste'
import { KONDITIONEN_DERZEIT } from '@/lib/konditionen'
import { gebuehrWortFuerZeitraum, type GebuehrModell } from '@/lib/plattformgebuehr'
import AdminBestellungenPage from '@/app/admin/bestellungen/page'
import { hofRohdaten } from './fabrik/hof-rohdaten'

const JETZT = new Date('2027-03-03T07:42:00.000Z')

const HOF: AdminHof = {
  ...adminHofZeile(hofRohdaten({ approvedAt: new Date('2026-11-01T00:00:00Z'), stripeBereit: true }), { gruendungsplatz: null, maxPlaetze: 12 }, JETZT),
  aktivitaet: { produkte: 2, fotos: 0, abholzeiten: 1, hatBeschreibung: true, hatLogo: false },
  gruendung: null,
  platzBeiFreischaltung: null,
  gruendungAenderung: null,
  gruendungZuletzt: null,
  testhofAenderung: null,
}

function akte(modell: GebuehrModell, wort: 'Servicegebühr' | 'Plattformgebühr' | 'Gebühren'): string {
  const daten: AkteDaten = {
    kontakt: { telefon: '–', anmeldung: 'h•••@example.com', emailBestaetigt: 'ja', hofEmail: 'wie Anmeldung', ort: '1234 Musterort · Österreich', agb: 'Fassung 1.0 · bei der Registrierung' },
    aktivitaet: { bestellungen: 38, bestellungenZeile: '1 storniert · 1 nicht abgeholt', umsatzCents: 81_200, servicegebuehrCents: 4_982, gebuehrZeile: aktivitaetGebuehrZeile(wort, 4_982), zuletztAngemeldet: 'heute', anmeldung: null, antwortzeit: '' },
    zustand: [],
    sperre: { gesperrt: false, grund: null, seit: null },
    protokoll: [],
    gebuehrModell: modell,
  }
  return renderToStaticMarkup(createElement(HofAkteAnsicht, { hof: HOF, zustand: { id: 'verkauft', text: 'Verkauft', ton: 'fertig' }, akte: daten }))
}

describe('Akte nach A1 und V63', () => {
  it('Modell „hofpreis“: kein Knopf „Servicegebühr …“, kein Satz dazu, Aktivität „Plattformgebühr € 49,82“ — nirgends „Servicegebühr“', () => {
    const html = akte('hofpreis', 'Plattformgebühr')
    expect(html).toContain('Plattformgebühr € 49,82')
    expect(html).not.toContain('Servicegebühr')
    expect(html).not.toContain('Gilt nur für neue Bestellungen')
    // Der Rest von „Eingreifen“ bleibt.
    expect(html).toContain('>Vorübergehend sperren …</button>')
  })

  it('Gegenprobe Modell „bisher“: Knopf „Servicegebühr …“ und sein Satz stehen da', () => {
    const html = akte('bisher', 'Servicegebühr')
    expect(html).toMatch(/>Servicegebühr …<span class="sr-only">/)
    expect(html).toContain('Gilt nur für neue Bestellungen')
    expect(html).toContain('Servicegebühr € 49,82')
  })

  it('A1 als Regel: der Knopf nur im Modell „bisher“', () => {
    expect(servicegebuehrKnopfSichtbar('bisher')).toBe(true)
    expect(servicegebuehrKnopfSichtbar('hofpreis')).toBe(false)
  })

  it('das Wort der Aktivität kommt aus den 30 Tagen gegen den Stichtag', () => {
    const stichtag = new Date('2027-02-01T00:00:00.000Z')
    expect(aktivitaetSeit(JETZT).getTime()).toBe(JETZT.getTime() - 30 * 86_400_000)
    // 3. März: die 30 Tage beginnen am 1. Februar, 07:42 — ganz nach dem Stichtag; am 10. Februar reichen sie davor.
    expect(gebuehrWortFuerZeitraum(aktivitaetSeit(JETZT), JETZT, stichtag)).toBe('Plattformgebühr')
    expect(gebuehrWortFuerZeitraum(aktivitaetSeit(new Date('2027-02-10T00:00:00.000Z')), new Date('2027-02-10T00:00:00.000Z'), stichtag)).toBe('Gebühren')
    expect(aktivitaetGebuehrZeile('Gebühren', 4_982)).toBe('Gebühren € 49,82')
  })
})

describe('Freischalt-Dialog: „Derzeit gilt …“ je Modell (Nr. 221, w3-admin-freischalten)', () => {
  const dialog = (modell: GebuehrModell) =>
    renderToStaticMarkup(createElement(HofAktionDialog, { aktion: { hof: HOF, art: 'approve' }, gebuehrModell: modell, onClose: () => {} }))

  it('ab dem Stichtag der Satz nach N38, ohne „Startphase“ und ohne „Servicegebühr“', () => {
    const html = dialog('hofpreis')
    expect(html).toContain('Derzeit gilt: Plattformgebühr 6 % im Hofpreis, online und bar gleich;')
    expect(html).not.toContain('Startphase')
    expect(html).not.toContain('Servicegebühr')
  })

  it('Gegenprobe vor dem Stichtag: KONDITIONEN_DERZEIT', () => {
    expect(dialog('bisher')).toContain(KONDITIONEN_DERZEIT)
  })
})

/** Eine cuid — `?bestellung=` nimmt nichts anderes (gewaehlteBestellungAus). */
const BESTELLUNG = 'cjld2cjxh0000qzrmnbestell'

function detail(gebuehrModell: string | null) {
  return {
    id: BESTELLUNG,
    orderNumber: 'HM-0303-2C91',
    farmId: 'hof-1',
    status: 'PAID',
    totalAmount: new Prisma.Decimal('19.12'),
    serviceFeeCents: 112,
    gebuehrModell,
    erstattetCents: 0,
    pickupDate: new Date('2027-03-03T00:00:00.000Z'),
    pickupTimeStart: '15:00',
    pickupTimeEnd: '18:00',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    stripePaymentIntentId: null,
    createdAt: new Date('2027-03-03T06:12:00.000Z'),
    paidAt: new Date('2027-03-03T06:13:00.000Z'),
    confirmedAt: null,
    pickedUpAt: null,
    cancelledAt: null,
    cancelReason: null,
    erstattungOffenSeit: null,
    items: [{ id: 'p-1', productName: 'Bergkäse', quantity: 2, totalPrice: new Prisma.Decimal('13.16'), fehltSeit: null, product: { unit: 'STUECK', unitSize: null } }],
    hofName: 'Hof Test',
    kundinGekuerzt: 'm•••@example.com',
    kundinBestellungen90: 3,
    protokoll: [],
    mails: [],
    hofFadenId: null,
    widerrufe: [],
  }
}

async function bestellSeite(gebuehrModell: string | null): Promise<string> {
  quellen.ladeBestellListe.mockResolvedValue([])
  quellen.ladeBestellDetail.mockResolvedValue(detail(gebuehrModell))
  return renderToStaticMarkup(await AdminBestellungenPage({ searchParams: Promise.resolve({ bestellung: BESTELLUNG }) }))
}

describe('Bestell-Detail: das Wort der Bestellung (V63, gebuehrBezeichnungFuer)', () => {
  it('Hofpreis-Bestellung: „inkl. € 1,12 Plattformgebühr“ und die Zeile „Plattformgebühr“ — nirgends „Servicegebühr“', async () => {
    const html = await bestellSeite('hofpreis')
    expect(html).toContain('inkl. € 1,12 Plattformgebühr')
    expect(html).toMatch(/<span>Plattformgebühr<\/span>/)
    expect(html).not.toContain('Servicegebühr')
  })

  it('Gegenprobe Bestellung im Modell „bisher“: „inkl. € 1,12 Servicegebühr“', async () => {
    const html = await bestellSeite(null)
    expect(html).toContain('inkl. € 1,12 Servicegebühr')
    expect(html).toMatch(/<span>Servicegebühr<\/span>/)
  })

  it('„‹ Zur Liste“ nur am Handy: unter 768 px, ab 768 px stehen Liste und Detail', async () => {
    const html = await bestellSeite('hofpreis')
    const link = html.slice(html.lastIndexOf('<a', html.indexOf('Zur Liste')), html.indexOf('Zur Liste'))
    expect(link).toContain('md:hidden')
    expect(link).toContain('lucide-chevron-left')
    expect(link).not.toContain('lg:hidden')
    // Die Liste ist mit gewählter Bestellung erst unter 768 px weg.
    expect(html).toContain('hidden md:flex')
  })
})

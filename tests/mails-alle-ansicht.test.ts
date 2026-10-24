/**
 * Admin › Betrieb › E-Mails › Alle Mails als HTML (Nr. 167; mails-alle.tsx,
 * mails-nochmal.tsx, Mockups admin-betrieb-mails-alle und
 * mobil-admin-betrieb-mails-alle/-nochmal).
 *
 * Beweist an der echten Ansicht (Abfragen gemockt, erfundener Bestand), je
 * mit Gegenprobe:
 *  - keine volle Adresse im HTML, nur die gekürzte — weder in der Liste noch
 *    im Detail noch in der Suche;
 *  - Kann warten steht nur als Summe, nie als Zeile;
 *  - die Liste ist eine Tabelle mit caption und th scope; der Pfad und die
 *    Filter haben sichtbare Beschriftungen; die gewählte Zeile trägt
 *    aria-current, das Detail ist ein <aside>;
 *  - Codes: kein Knopf, nur der Satz; erlaubte Art: Knopf „Nochmal schicken“
 *    und „Heute n von 3“; 3-mal heute: Knopf aus mit Grund;
 *  - die Vorschau ist ein iframe mit leerem sandbox (kein allow-scripts, kein
 *    allow-same-origin);
 *  - der Link „Alle Mails · 90 Tage“ steht in der Übersicht E-Mails.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const abfragen = vi.hoisted(() => ({
  ladeAlleMails: vi.fn(),
  ladeKannWartenSummen: vi.fn(),
  ladeHofAuswahl: vi.fn(),
  ladeMailDetail: vi.fn(),
  sucheMails: vi.fn(),
  zaehleProbleme: vi.fn(),
  ladeMailZaehler: vi.fn(),
  ladeWarteschlange: vi.fn(),
  ladeProbleme: vi.fn(),
  ladeArtZahlen: vi.fn(),
  ladeMailVerlauf: vi.fn(),
  ladeLetztenDurchlauf: vi.fn(),
}))
vi.mock('@/server/queries/mails', () => abfragen)
vi.mock('@/server/queries/betrieb', () => ({ ladeWarnungen: vi.fn(async () => []) }))
vi.mock('@/server/mail-warteschlange', () => ({ KANN_WARTEN_PAUSE: { tagProzent: 70, zeitraumProzent: 90 } }))
vi.mock('@/server/actions/betrieb', () => ({
  schickeMailJetztAction: vi.fn(),
  verwirfMailAction: vi.fn(),
  schickeMailNochmalAction: vi.fn(),
  schickeArtNochmalAction: vi.fn(),
  zeigeMailVorschauAction: vi.fn(),
}))
vi.mock('@/lib/auth-client-passkey', () => ({ passkeySignIn: { passkey: vi.fn() } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/admin/betrieb' }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}))

import { MailsAlle } from '@/app/admin/betrieb/mails-alle'
import { MailsAnsicht } from '@/app/admin/betrieb/mails-ansicht'
import { VorschauRahmen } from '@/app/admin/betrieb/mails-nochmal'
import { ALLE_MAILS_TEXT, type AlleMailRoh } from '@/lib/betrieb-mails'
import { alleMailsAus } from '@/schemas/betrieb-mails'

const JETZT = new Date('2026-10-24T07:42:00.000Z')
const ADRESSE = 'erfundene.kundin@example.at'
const ID = 'cmfauftrag0000000000001a'

const roh = (teil: Partial<AlleMailRoh> = {}): AlleMailRoh => ({
  id: ID,
  art: 'abholbereit',
  vorrang: 1,
  status: 'gesendet',
  versuche: 0,
  fehlerCode: null,
  erstelltAm: new Date('2026-10-24T07:12:00.000Z'),
  gesendetAm: new Date('2026-10-24T07:12:04.000Z'),
  naechsterVersuchAm: new Date('2026-10-24T07:12:00.000Z'),
  zugestelltAm: new Date('2026-10-24T07:12:09.000Z'),
  bounceAm: null,
  beschwerdeAm: null,
  bestellungId: 'bestellung_1',
  farmId: 'hof_1',
  ausloeser: 'system',
  nochmalVon: null,
  ...teil,
})

const detail = (teil: { mail?: Partial<AlleMailRoh>; heute?: number } = {}) => ({
  mail: roh(teil.mail),
  nochmal: [],
  heute: teil.heute ?? 0,
  stand: {
    bestellung: {
      id: 'bestellung_1',
      orderNumber: 'HM-2611-A4F2',
      status: 'READY',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      cancelReason: null,
      createdAt: new Date('2026-10-24T07:00:00.000Z'),
      pickupDate: new Date('2026-10-25T10:00:00.000Z'),
      pickupTimeStart: '15:00',
      farm: { name: 'Testhof A', archivedAt: null },
    },
    hof: null,
    adresse: ADRESSE,
    hofName: 'Testhof A',
  },
})

async function html(adresse: Record<string, string> = {}, suche: Parameters<typeof MailsAlle>[0]['suche'] = { art: 'leer' }): Promise<string> {
  const p = alleMailsAus({ reiter: 'mails', liste: 'alle', ...adresse })
  return renderToStaticMarkup(await MailsAlle({ jetzt: JETZT, p, suche, sucheRoh: '' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  abfragen.ladeAlleMails.mockResolvedValue({
    zeilen: [roh(), roh({ id: 'cmfauftrag0000000000002b', art: 'anmeldecode', vorrang: 0, bestellungId: null, farmId: null }), roh({ id: 'cmfauftrag0000000000003c', ausloeser: 'support', nochmalVon: ID })],
    weiter: null,
    anzahl: 3,
    bestellnummern: new Map([['bestellung_1', 'HM-2611-A4F2']]),
    hoefe: new Map([['hof_1', 'Testhof A']]),
  })
  abfragen.ladeKannWartenSummen.mockResolvedValue([{ art: 'beitrag', gruppe: 'p1', titel: 'Kürbisse sind da', erstelltAm: JETZT, gesendet: 412, offen: 0, gescheitert: 0, abgelehnt: 3, spam: 0 }])
  abfragen.ladeHofAuswahl.mockResolvedValue([{ id: 'hof_1', name: 'Testhof A' }])
  abfragen.ladeMailDetail.mockResolvedValue(detail())
  abfragen.zaehleProbleme.mockResolvedValue(2)
  abfragen.sucheMails.mockResolvedValue({ bestellungen: [], mails: [] })
})

describe('Liste', () => {
  it('Tabelle mit caption und th scope; Pfad; Filter mit Beschriftung; Kann warten nur als Summe', async () => {
    const h = await html()
    expect(h).toContain(`<caption class="sr-only">${ALLE_MAILS_TEXT.listeCaption}</caption>`)
    expect(h).toContain('scope="col"')
    expect(h).toContain('scope="row"')
    expect(h).toContain('aria-label="Pfad"')
    expect(h).toContain('aria-current="page"')
    for (const label of ['Art', 'Weg', 'Stand', 'Zeitraum', 'Hof']) expect(h).toMatch(new RegExp(`<label for="filter-[a-z]+"[^>]*>${label}</label>`))
    expect(h).toContain('nur vom Support')
    expect(h).toContain('3 Mails')
    expect(h).toContain('Beitrag ‚Kürbisse sind da‘')
    expect(h).toContain('412 gesendet · 3 abgelehnt')
    expect(h).toContain('Nochmal: Abholbereit')
    expect(h).toContain(ALLE_MAILS_TEXT.codeNie)
  })

  it('Gegenprobe: ohne gewählte Mail kein Detail, und die Summe fragt die Liste nie nach Kann warten', async () => {
    const h = await html()
    expect(h).not.toContain('<aside')
    expect(abfragen.ladeMailDetail).not.toHaveBeenCalled()
  })
})

describe('Detail', () => {
  it('keine volle Adresse im HTML; aside mit Bezeichnung; gewählte Zeile aria-current; Knopf und „Heute 0 von 3“', async () => {
    const h = await html({ mail: ID })
    expect(h).not.toContain(ADRESSE)
    expect(h).not.toContain('erfundene')
    expect(h).toContain('e•••@example.at · aus der Bestellung')
    expect(h).toContain(`<aside aria-label="${ALLE_MAILS_TEXT.detail}"`)
    expect(h).toContain('aria-current="true"')
    expect(h).toContain(ALLE_MAILS_TEXT.nochmalKnopf)
    expect(h).toContain('Heute 0 von 3 · fragt nach deinem Passkey')
    expect(h).toContain(ALLE_MAILS_TEXT.vorschauKnopf)
  })

  it('3-mal heute: Knopf aus, mit Grund', async () => {
    abfragen.ladeMailDetail.mockResolvedValue(detail({ heute: 3 }))
    const h = await html({ mail: ID })
    expect(h).toMatch(/<button type="button" disabled=""[^>]*>Nochmal schicken<\/button>/)
    expect(h).toContain(ALLE_MAILS_TEXT.grenze)
  })

  it('Code: kein Knopf, nur der Satz, keine Vorschau', async () => {
    abfragen.ladeMailDetail.mockResolvedValue({ ...detail({ mail: { art: 'anmeldecode', vorrang: 0, bestellungId: null } }), stand: { bestellung: null, hof: null, adresse: null, hofName: null } })
    const h = await html({ mail: ID })
    expect(h).not.toContain('>Nochmal schicken</button>')
    expect(h).toContain(ALLE_MAILS_TEXT.nieCode)
    expect(h).not.toContain(ALLE_MAILS_TEXT.vorschauKnopf)
  })
})

describe('Suche in Alle Mails', () => {
  it('dieselbe Abfrage wie die Übersicht; Treffer nur gekürzt; der Hinweis für den Anruf', async () => {
    abfragen.sucheMails.mockResolvedValue({
      bestellungen: [{ id: 'bestellung_1', orderNumber: 'HM-2611-A4F2', hofName: 'Testhof A', pickupDate: JETZT, paymentMethod: 'ONLINE', paymentStatus: 'PAID', status: 'READY', customerEmail: ADRESSE }],
      mails: [{ ...roh(), ausloeser: 'system', nochmalVon: null }],
    })
    const h = await html({}, { art: 'adresse', adresse: ADRESSE })
    expect(abfragen.sucheMails).toHaveBeenCalledWith({ art: 'adresse', adresse: ADRESSE }, JETZT)
    expect(abfragen.ladeAlleMails).not.toHaveBeenCalled()
    expect(h).not.toContain(ADRESSE)
    expect(h).toContain('Treffer zu e•••@example.at')
    expect(h).toContain('Kein Treffer?')
    expect(h).toContain(ALLE_MAILS_TEXT.zuDieserBestellung)
  })
})

describe('Vorschau', () => {
  it('iframe mit leerem sandbox — kein allow-scripts, kein allow-same-origin', () => {
    const h = renderToStaticMarkup(createElement(VorschauRahmen, { titel: 'Vorschau', html: '<p>Hallo</p>' }))
    expect(h).toMatch(/<iframe[^>]*sandbox=""/)
    expect(h).not.toContain('allow-scripts')
    expect(h).not.toContain('allow-same-origin')
    expect(h).toContain('srcDoc')
  })
})

describe('Übersicht E-Mails', () => {
  it('der Link „Alle Mails · 90 Tage“ (Handy: „Alle Mails“) steht im Kopf', async () => {
    abfragen.ladeMailZaehler.mockResolvedValue({ heute: 1, imZeitraum: 10 })
    abfragen.ladeWarteschlange.mockResolvedValue({ wichtig: 0, kannWarten: 0, aeltesteWichtigeAm: null, aeltesteWichtige: null, faelligSeit: null, kannWartenPausiert: false })
    abfragen.ladeProbleme.mockResolvedValue([])
    abfragen.ladeArtZahlen.mockResolvedValue([])
    abfragen.ladeMailVerlauf.mockResolvedValue([])
    abfragen.ladeLetztenDurchlauf.mockResolvedValue(null)
    const h = renderToStaticMarkup(await MailsAnsicht({ jetzt: JETZT, suche: { art: 'leer' }, sucheRoh: '', alle: false }))
    expect(h).toContain('href="/admin/betrieb?reiter=mails&amp;liste=alle"')
    expect(h).toContain(ALLE_MAILS_TEXT.link)
  })
})

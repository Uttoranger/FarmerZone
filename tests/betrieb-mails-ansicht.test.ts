/**
 * Admin › Betrieb › E-Mails als HTML (Nr. 161; mails-ansicht.tsx, Mockups
 * admin-betrieb-mails und mobil-admin-betrieb-mails).
 *
 * Beweist an der echten Ansicht (Abfragen gemockt, erfundener Bestand), je
 * mit Gegenprobe:
 *  - keine volle Adresse im HTML, nur die gekürzte;
 *  - kein „Vorrang“, kein „Erneut versuchen“; „Bounce“ genau einmal, in der
 *    Regel-Zeile; die Wege heißen Sofort, Wichtig, Kann warten;
 *  - jede Kachel trägt ihr Zustandswort; „Je Art“ ist eine echte Tabelle mit
 *    caption und th scope (col und row);
 *  - die Suche hat ein sichtbares label und role="search";
 *  - ein ungültiges Format fragt die Datenbank nie (sucheMails nicht
 *    gerufen); ein Teil, der nicht lädt, zeigt nur dort den Fehlersatz.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const abfragen = vi.hoisted(() => ({
  ladeMailZaehler: vi.fn(),
  ladeWarteschlange: vi.fn(),
  ladeProbleme: vi.fn(),
  ladeArtZahlen: vi.fn(),
  ladeMailVerlauf: vi.fn(),
  ladeLetztenDurchlauf: vi.fn(),
  sucheMails: vi.fn(),
}))
vi.mock('@/server/queries/mails', () => abfragen)
vi.mock('@/server/queries/betrieb', () => ({ ladeWarnungen: vi.fn(async () => []) }))
vi.mock('@/server/mail-warteschlange', () => ({ KANN_WARTEN_PAUSE: { tagProzent: 70, zeitraumProzent: 90 } }))
vi.mock('@/server/actions/betrieb', () => ({ schickeMailJetztAction: vi.fn(), verwirfMailAction: vi.fn() }))
vi.mock('@/lib/auth-client-passkey', () => ({ passkeySignIn: { passkey: vi.fn() } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/admin/betrieb' }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}))

import { MailsAnsicht } from '@/app/admin/betrieb/mails-ansicht'

const JETZT = new Date('2026-10-24T07:42:00.000Z')
const minuten = (n: number): Date => new Date(JETZT.getTime() - n * 60_000)
const ADRESSE = 'erfundene.kundin@example.at'

async function html(suche: Parameters<typeof MailsAnsicht>[0]['suche'] = { art: 'leer' }): Promise<string> {
  return renderToStaticMarkup(await MailsAnsicht({ jetzt: JETZT, suche, sucheRoh: '', alle: false }))
}

beforeEach(() => {
  vi.clearAllMocks()
  abfragen.ladeMailZaehler.mockResolvedValue({ heute: 62, imZeitraum: 1_284 })
  abfragen.ladeWarteschlange.mockResolvedValue({
    wichtig: 1,
    kannWarten: 13,
    aeltesteWichtigeAm: minuten(7),
    aeltesteWichtige: { id: 'cmfauftrag0000000000001a', art: 'bestellung-bestaetigung', versuche: 2, fehlerCode: 'rate_limit_exceeded', naechsterVersuchAm: new Date(JETZT.getTime() + 60_000), zuBestellung: true },
    faelligSeit: null,
    kannWartenPausiert: false,
  })
  abfragen.ladeProbleme.mockResolvedValue([
    { id: 'cmfauftrag0000000000001a', art: 'bestellung-bestaetigung', vorrang: 1, status: 'offen', versuche: 2, fehlerCode: 'rate_limit_exceeded', erstelltAm: minuten(7), naechsterVersuchAm: new Date(JETZT.getTime() + 60_000), belegtBis: null },
    { id: 'cmfauftrag0000000000002b', art: 'beitrag', vorrang: 2, status: 'gescheitert', versuche: 1, fehlerCode: 'validation_error', erstelltAm: minuten(900), naechsterVersuchAm: minuten(800), belegtBis: null },
  ])
  abfragen.ladeArtZahlen.mockResolvedValue([
    { art: 'anmeldecode', vorrang: 0, gesendet: 212, zugestellt: 210, gescheitert: 0, abgelehnt: 0, spam: 0, wartezeitMs: null },
    { art: 'bestellung-bestaetigung', vorrang: 1, gesendet: 148, zugestellt: 146, gescheitert: 1, abgelehnt: 1, spam: 0, wartezeitMs: 12_000 },
    { art: 'beitrag', vorrang: 2, gesendet: 402, zugestellt: 396, gescheitert: 1, abgelehnt: 5, spam: 0, wartezeitMs: 120_000 },
  ])
  abfragen.ladeMailVerlauf.mockResolvedValue([{ tag: '2026-10-23', gesendet: 40, gescheitert: 1 }])
  abfragen.ladeLetztenDurchlauf.mockResolvedValue({ gestartetAm: JETZT, dauerMs: 4_000, mails: 31 })
  abfragen.sucheMails.mockResolvedValue({
    bestellungen: [
      { id: 'b1', orderNumber: 'HM-2611-A4F2', hofName: 'Testhof A', pickupDate: JETZT, paymentMethod: 'ONLINE', paymentStatus: 'PAID', status: 'PAID', customerEmail: ADRESSE },
    ],
    mails: [
      { id: 'm1', art: 'bestellung-bestaetigung', vorrang: 1, status: 'gesendet', bestellungId: 'b1', erstelltAm: minuten(30), gesendetAm: minuten(30), zugestelltAm: minuten(29), bounceAm: null, beschwerdeAm: null },
    ],
  })
})

describe('Adresse nur gekürzt', () => {
  it('im HTML steht nie die volle Adresse, nur „e•••@example.at“', async () => {
    const seite = await html({ art: 'bestellung', nummer: 'HM-2611-A4F2' })
    expect(seite).toContain('e•••@example.at · aus der Bestellung')
    expect(seite).not.toContain('erfundene.kundin')
    expect(seite).toContain('Laut Resend angekommen.')
  })

  it('Gegenprobe: die Suche lief wirklich und fand die Bestellung', async () => {
    const seite = await html({ art: 'bestellung', nummer: 'HM-2611-A4F2' })
    expect(abfragen.sucheMails).toHaveBeenCalledTimes(1)
    expect(seite).toContain('HM-2611-A4F2 · Testhof A')
  })
})

describe('Wörter (Wortliste N8)', () => {
  it('kein „Vorrang“, kein „Erneut versuchen“, „Bounce“ genau einmal — in der Regel-Zeile', async () => {
    const seite = await html()
    expect(seite).not.toMatch(/Vorrang/i)
    expect(seite).not.toMatch(/Erneut versuchen/i)
    expect(seite.match(/Bounce/g)).toHaveLength(1)
    expect(seite).toMatch(/\(Bounce: das Postfach weist die Mail zurück\)/)
    for (const weg of ['Sofort', 'Wichtig', 'Kann warten']) expect(seite).toContain(weg)
    expect(seite).toContain('Jetzt schicken')
    expect(seite).toContain('Spam gemeldet')
  })
})

describe('Kacheln und Je Art', () => {
  it('jede Kachel hat ein Zustandswort', async () => {
    const seite = await html()
    for (const wort of ['Im Rahmen', 'Achtung', '1 braucht dich', 'Gut']) expect(seite, wort).toContain(`>${wort}<`)
  })

  it('„Je Art“ ist eine Tabelle mit caption, th scope="col" und th scope="row"', async () => {
    const seite = await html()
    expect(seite).toContain('<caption')
    expect(seite).toContain('Mails je Art in 7 Tagen, auffällige zuerst')
    expect(seite.match(/<th scope="col"/g)?.length).toBe(7)
    expect(seite).toMatch(/<th scope="row"[^>]*>Beitrag an Abos<\/th>/)
  })

  it('die Suche: role="search", sichtbares label für das Feld', async () => {
    const seite = await html()
    expect(seite).toContain('role="search"')
    expect(seite).toMatch(/<label for="mails-suche"[^>]*>Bestellnummer oder E-Mail-Adresse<\/label>/)
    expect(seite).toContain('name="suche"')
  })
})

describe('Ohne Datenbank, wo es nicht nötig ist', () => {
  it('ungültiges Format: der Satz, keine Suche in der Datenbank', async () => {
    const seite = await html({ art: 'ungueltig' })
    expect(abfragen.sucheMails).not.toHaveBeenCalled()
    expect(seite).toContain('Bitte eine Bestellnummer oder eine ganze E-Mail-Adresse eingeben.')
  })

  it('ein Teil, der nicht lädt, zeigt nur dort den Fehlersatz — die anderen stehen', async () => {
    abfragen.ladeMailVerlauf.mockRejectedValue(new Error('kaputt'))
    const seite = await html()
    expect(seite).toContain('Dieser Teil konnte gerade nicht geladen werden.')
    expect(seite).toContain('Mails je Art in 7 Tagen')
    // Gegenprobe: ohne Fehler kein Fehlersatz.
    abfragen.ladeMailVerlauf.mockResolvedValue([])
    expect(await html()).not.toContain('Dieser Teil konnte gerade nicht geladen werden.')
  })
})

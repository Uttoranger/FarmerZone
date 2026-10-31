/**
 * Admin › Bestellungen (Register N32, N33, N34; Nachtlauf Nr. 186) — Fachregeln
 * rein, die drei Aktionen mit gemockter Datenbank und der ECHTEN Admin-Wache,
 * die Suche mit gemockter Abfrage. Den Zustand in Postgres (Storno wie beim
 * Hof, Suche, Protokoll) prüft tests/integration/admin-bestellung.int.test.ts.
 *
 * Beweist (je mit Gegenprobe):
 *  - Notfall-Storno nur vor der Abholung — dieselbe Liste wie der Storno des
 *    Hofs (Knöpfe `bestellAktionen`, Sperre `ABHOLUNG_ERLEDIGT`);
 *  - der Fall mit „Was tun“ und der Verlauf aus Bestellung und Protokoll;
 *  - „Außerhalb erstattet“ setzt nur das Merkmal, ruft Stripe nie, verlangt
 *    Grund und Recht `geld` und schreibt den Grund ins Protokoll;
 *  - „Kundin schreiben“ gibt die volle Adresse nur nach Grund und mit Recht,
 *    mit Eintrag `adresse_angezeigt` ohne die Adresse;
 *  - Notfall-Storno: ohne Recht und ohne Grund nichts; sonst `storniere` mit
 *    dem Hof AUS DER BESTELLUNG, ohne Grund für die Mail; Nachricht an den Hof
 *    und zwei Protokoll-Einträge;
 *  - die Suche nimmt die Treffer von `sucheMails` (eine Quelle); eine
 *    Teiladresse sucht nichts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: vi.fn() } } }))
vi.mock('@/server/stornieren', () => ({ storniere: vi.fn() }))
vi.mock('@/server/queries/mails', () => ({ sucheMails: vi.fn() }))
vi.mock('@/lib/prisma', async () => ({
  prisma: {
    ...(await import('./admin-sitzung')).passkeyAttrappen(),
    user: { findUnique: vi.fn() },
    order: { updateMany: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(async () => []), count: vi.fn(async () => 3) },
    unterhaltung: { create: vi.fn(async () => ({ id: 'cmffaden0000000000001abc' })), findFirst: vi.fn(async () => null) },
    adminAktion: { create: vi.fn(async () => ({ id: 'cmfeintrag00000000000001' })), findMany: vi.fn(async () => []) },
    // Nr. 200 (Nachbesserung Runde 2): das Detail liest die Widerrufe der Bestellung.
    widerruf: { findMany: vi.fn(async () => []) },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { storniere } from '@/server/stornieren'
import { sucheMails } from '@/server/queries/mails'
import { ADMIN_RECHT_FEHLER } from '@/lib/admin-rechte'
import { ABHOLUNG_ERLEDIGT } from '@/lib/heute'
import { OFFEN_STATUS, bestellAktionen } from '@/lib/hof-bestellungen'
import { ADMIN_BESTELLUNG_TEXT, STAND_STATUS, bestellFall, bestellVerlauf, bestellungenHref, notfallStornoStand } from '@/lib/admin-bestellung'
import { ADMIN_BESTELLUNG_EINGABE_FEHLER, ADMIN_BESTELLUNG_GRUND_FEHLT, bestellFilterAus } from '@/schemas/admin-bestellung'
import { ADMIN_GRUND_FEHLER } from '@/schemas/admin-aktion'
import { mailSucheAus } from '@/schemas/betrieb-mails'
import { markiereErstattungErledigt, notfallStorno, zeigeKundinAdresse } from '@/server/actions/admin-bestellung'
import { ladeBestellDetail, ladeBestellListe } from '@/server/queries/admin-bestellungen'
import { adminSitzung } from './admin-sitzung'

type Fn = ReturnType<typeof vi.fn>
const db = prisma as unknown as {
  user: { findUnique: Fn }
  order: { updateMany: Fn; findUnique: Fn; findMany: Fn; count: Fn }
  unterhaltung: { create: Fn }
  adminAktion: { create: Fn }
}
const getSession = vi.mocked(auth.api.getSession)
const stornieren = vi.mocked(storniere)

const BESTELLUNG = 'cmfbestellung000000001ab'
const HOF = 'cmfhof00000000000000test'
const ALLE_STATUS = ['PENDING_CONFIRMATION', 'PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY', 'PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP']

/** Die Einträge, die protokolliere geschrieben hat. */
const eintraege = (): Array<Record<string, unknown>> => db.adminAktion.create.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data)

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(adminSitzung('admin_1') as never)
  db.user.findUnique.mockResolvedValue({ isAdmin: true, adminInhaber: true, adminRechte: [] })
  db.order.updateMany.mockResolvedValue({ count: 1 })
  db.order.findUnique.mockResolvedValue({ farmId: HOF, orderNumber: 'HM-2610-B7C2', status: 'PAID', customerEmail: 'kundin@example.com' })
  stornieren.mockResolvedValue({ erstattetCents: 2100, vomHofCents: 2000 })
})

describe('Notfall-Storno nur vor der Abholung — dieselbe Liste wie beim Hof', () => {
  it.each(ALLE_STATUS)('%s: geht genau dann, wenn der Hof stornieren kann', (status) => {
    const moeglich = notfallStornoStand({ status }).moeglich
    expect(moeglich).toBe(bestellAktionen({ status, paymentMethod: 'ONLINE', offenePositionen: 1 }).stornieren)
    expect(moeglich).toBe(!(ABHOLUNG_ERLEDIGT as readonly string[]).includes(status))
  })

  it('gesperrt mit Satz: storniert und nach der Abholung sagen es verschieden', () => {
    expect(notfallStornoStand({ status: 'CANCELLED' })).toEqual({ moeglich: false, grund: ADMIN_BESTELLUNG_TEXT.stornoSchonStorniert })
    expect(notfallStornoStand({ status: 'PICKED_UP' })).toEqual({ moeglich: false, grund: ADMIN_BESTELLUNG_TEXT.stornoNachAbholung })
    expect(notfallStornoStand({ status: 'NOT_PICKED_UP' })).toEqual({ moeglich: false, grund: ADMIN_BESTELLUNG_TEXT.stornoNachAbholung })
  })

  it('der Filter „Offen“ ist die Liste des Hofs', () => {
    expect(STAND_STATUS.offen).toEqual(OFFEN_STATUS)
  })
})

describe('Fälle und Verlauf', () => {
  const basis = { status: 'PAID', paymentMethod: 'ONLINE', paymentStatus: 'PAID', erstattungOffenSeit: null }
  it('die offene Erstattung geht vor; sonst nach Stand und Zahlung', () => {
    expect(bestellFall({ ...basis, status: 'CANCELLED', erstattungOffenSeit: new Date() })).toBe('erstattung_offen')
    expect(bestellFall({ ...basis, status: 'CANCELLED', paymentStatus: 'REFUNDED' })).toBe('storniert_erstattet')
    expect(bestellFall({ ...basis, status: 'CANCELLED' })).toBe('storniert_ausserhalb')
    expect(bestellFall({ ...basis, status: 'CANCELLED', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING' })).toBe('storniert')
    expect(bestellFall({ ...basis, paymentStatus: 'PENDING', status: 'PENDING_CONFIRMATION' })).toBe('zahlung_offen')
    expect(bestellFall({ ...basis, paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', status: 'PENDING_CONFIRMATION' })).toBe('wartet_auf_bestaetigung')
    expect(bestellFall(basis)).toBe('laeuft')
    expect(bestellFall({ ...basis, status: 'PICKED_UP' })).toBe('abgeholt')
    expect(bestellFall({ ...basis, status: 'NOT_PICKED_UP' })).toBe('nicht_abgeholt')
  })

  it('Verlauf: ältestes zuerst, Storno durch das Team erkennbar, Protokoll mit Grund und Passkey', () => {
    const t = (min: number): Date => new Date(Date.UTC(2026, 9, 22, 17, min))
    const verlauf = bestellVerlauf(
      { createdAt: t(0), paidAt: t(1), confirmedAt: null, pickedUpAt: null, cancelledAt: t(30), cancelReason: null, erstattungOffenSeit: t(31), status: 'CANCELLED', paymentMethod: 'ONLINE' },
      [{ wann: t(30), art: 'notfall_storno', grund: 'Hof nicht erreichbar', mitPasskey: true }]
    )
    expect(verlauf.map((v) => v.text)).toEqual(['Bestellt', 'Online bezahlt', 'Vom Team storniert', 'Notfall-Storno durch das Team', 'Erstattung gescheitert – offen'])
    expect(verlauf[3]?.zusatz).toBe('„Hof nicht erreichbar“ · mit Passkey')
    // Gegenprobe: ohne Eintrag im Protokoll war es der Hof.
    expect(bestellVerlauf({ createdAt: t(0), paidAt: null, confirmedAt: null, pickedUpAt: null, cancelledAt: t(5), cancelReason: 'Ware aus', erstattungOffenSeit: null, status: 'CANCELLED', paymentMethod: 'ONSITE_CASH' }, [])[1]).toMatchObject({ text: 'Storniert', zusatz: '„Ware aus“' })
  })
})

describe('Adresse der Seite', () => {
  it('Standardwerte bleiben weg, Unbekanntes wird zum Standard', () => {
    expect(bestellungenHref({ zeitraum: '90t' })).toBe('/admin/bestellungen')
    expect(bestellungenHref({ stand: 'offen', erstattungOffen: true }, { suche: 'HM-2610-B7C2', bestellung: BESTELLUNG })).toBe(`/admin/bestellungen?suche=HM-2610-B7C2&stand=offen&offen=1&bestellung=${BESTELLUNG}`)
    expect(bestellFilterAus({ stand: 'quatsch', zeitraum: '24h', hof: 'a b', offen: 'ja' })).toEqual({ stand: null, hof: null, zeitraum: '90t', erstattungOffen: false })
    expect(bestellFilterAus({ stand: ['storniert'], zeitraum: '7t', offen: '1' })).toEqual({ stand: 'storniert', hof: null, zeitraum: '7t', erstattungOffen: true })
  })
})

describe('„Außerhalb erstattet“ — nur das Merkmal, nie Stripe', () => {
  it('mit Grund: genau EIN bedingtes Schreiben, Protokoll mit Grund, kein Stripe-Aufruf', async () => {
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG, grund: 'Selbst überwiesen' })).toEqual({ ok: true })
    expect(db.order.updateMany).toHaveBeenCalledTimes(1)
    expect(db.order.updateMany).toHaveBeenCalledWith({ where: { id: BESTELLUNG, erstattungOffenSeit: { not: null } }, data: { erstattungOffenSeit: null } })
    expect(eintraege()).toEqual([{ wer: 'admin_1', art: 'erstattung_erledigt', bezugArt: 'bestellung', bezugId: BESTELLUNG, grund: 'Selbst überwiesen', mitPasskey: true }])
    expect(stripe.refunds.create).not.toHaveBeenCalled()
  })

  it('schon erledigt (0 Zeilen): kein Fehler, kein Eintrag', async () => {
    db.order.updateMany.mockResolvedValue({ count: 0 })
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG, grund: 'Selbst überwiesen' })).toEqual({ ok: true })
    expect(eintraege()).toEqual([])
  })

  it('ohne Grund, mit Telefonnummer im Grund oder mit fremder Kennung: nichts geschrieben', async () => {
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG })).toEqual({ error: ADMIN_BESTELLUNG_GRUND_FEHLT })
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG, grund: '   ' })).toEqual({ error: ADMIN_BESTELLUNG_GRUND_FEHLT })
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG, grund: 'Rückruf 06600000000' })).toEqual({ error: ADMIN_GRUND_FEHLER })
    expect(await markiereErstattungErledigt({ orderId: 'abc', grund: 'x' })).toEqual({ error: ADMIN_BESTELLUNG_EINGABE_FEHLER })
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG, grund: 'x', betrag: 100 })).toEqual({ error: ADMIN_BESTELLUNG_EINGABE_FEHLER })
    expect(db.order.updateMany).not.toHaveBeenCalled()
  })

  it('ohne Recht „geld“: der Satz der Wache, nichts geschrieben; mit dem Recht geht es (Gegenprobe)', async () => {
    db.user.findUnique.mockResolvedValue({ isAdmin: true, adminInhaber: false, adminRechte: ['adresse_anzeigen'] })
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG, grund: 'Selbst überwiesen' })).toEqual({ error: ADMIN_RECHT_FEHLER })
    expect(db.order.updateMany).not.toHaveBeenCalled()
    db.user.findUnique.mockResolvedValue({ isAdmin: true, adminInhaber: false, adminRechte: ['geld'] })
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG, grund: 'Selbst überwiesen' })).toEqual({ ok: true })
  })

  it('ohne Anmeldung oder ohne Admin: nichts geschrieben', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG, grund: 'x' })).toEqual({ error: 'Nicht angemeldet.' })
    getSession.mockResolvedValue(adminSitzung('admin_1') as never)
    db.user.findUnique.mockResolvedValue({ isAdmin: false })
    expect(await markiereErstattungErledigt({ orderId: BESTELLUNG, grund: 'x' })).toEqual({ error: 'Kein Zugriff.' })
    expect(db.order.updateMany).not.toHaveBeenCalled()
  })
})

describe('„Kundin schreiben“ — volle Adresse nur nach Grund, mit Eintrag', () => {
  it('mit Grund und Recht: die Adresse, Eintrag ohne Adresse', async () => {
    expect(await zeigeKundinAdresse({ orderId: BESTELLUNG, grund: 'Kundin fragt nach Erstattung' })).toEqual({ ok: true, adresse: 'kundin@example.com' })
    expect(eintraege()).toEqual([{ wer: 'admin_1', art: 'adresse_angezeigt', bezugArt: 'bestellung', bezugId: BESTELLUNG, grund: 'Kundin fragt nach Erstattung', mitPasskey: true }])
    expect(JSON.stringify(eintraege())).not.toContain('@')
  })

  it('ohne Grund oder ohne Recht: keine Adresse gelesen, kein Eintrag', async () => {
    expect(await zeigeKundinAdresse({ orderId: BESTELLUNG, grund: '' })).toEqual({ error: ADMIN_BESTELLUNG_GRUND_FEHLT })
    db.user.findUnique.mockResolvedValue({ isAdmin: true, adminInhaber: false, adminRechte: ['geld'] })
    expect(await zeigeKundinAdresse({ orderId: BESTELLUNG, grund: 'Kundin fragt' })).toEqual({ error: ADMIN_RECHT_FEHLER })
    expect(db.order.findUnique).not.toHaveBeenCalled()
    expect(eintraege()).toEqual([])
  })

  it('unbekannte Bestellung: Satz, kein Eintrag', async () => {
    db.order.findUnique.mockResolvedValue(null)
    expect(await zeigeKundinAdresse({ orderId: BESTELLUNG, grund: 'Kundin fragt' })).toEqual({ error: ADMIN_BESTELLUNG_TEXT.nichtGefunden })
    expect(eintraege()).toEqual([])
  })
})

describe('Notfall-Storno — derselbe Storno wie beim Hof', () => {
  it('ruft storniere mit dem Hof aus der Bestellung und ohne Grund für die Mail; Nachricht an den Hof; zwei Einträge', async () => {
    expect(await notfallStorno({ orderId: BESTELLUNG, grund: 'Hof nicht erreichbar' })).toEqual({ erstattetCents: 2100, vomHofCents: 2000 })
    expect(stornieren).toHaveBeenCalledWith({ id: HOF }, BESTELLUNG)
    const nachricht = (db.unterhaltung.create.mock.calls[0]?.[0] as { data: { farmId: string; nachrichten: { create: { text: string; art: string; linkUrl: string } } } }).data
    expect(nachricht.farmId).toBe(HOF)
    expect(nachricht.nachrichten.create).toMatchObject({ art: 'SYSTEM', linkUrl: `/orders/${BESTELLUNG}` })
    expect(nachricht.nachrichten.create.text).toContain('HM-2610-B7C2 vom Team storniert')
    expect(nachricht.nachrichten.create.text).toContain('Hof nicht erreichbar')
    expect(eintraege().map((e) => [e.art, e.bezugArt, e.bezugId, e.grund])).toEqual([
      ['notfall_storno', 'bestellung', BESTELLUNG, 'Hof nicht erreichbar'],
      ['notfall_storno', 'hof', HOF, 'Hof nicht erreichbar'],
    ])
  })

  it('nach der Abholung oder schon storniert: storniere läuft nicht, Satz am Knopf', async () => {
    for (const status of ABHOLUNG_ERLEDIGT) {
      db.order.findUnique.mockResolvedValue({ farmId: HOF, orderNumber: 'HM-2610-B7C2', status })
      expect(await notfallStorno({ orderId: BESTELLUNG, grund: 'Hof nicht erreichbar' })).toEqual({ error: (notfallStornoStand({ status }) as { grund: string }).grund })
    }
    expect(stornieren).not.toHaveBeenCalled()
    expect(db.unterhaltung.create).not.toHaveBeenCalled()
    expect(eintraege()).toEqual([])
  })

  it('ohne Recht „hof_sperren_storno“ (403) und ohne Grund (400): nichts storniert', async () => {
    db.user.findUnique.mockResolvedValue({ isAdmin: true, adminInhaber: false, adminRechte: ['geld', 'adresse_anzeigen'] })
    expect(await notfallStorno({ orderId: BESTELLUNG, grund: 'Hof nicht erreichbar' })).toEqual({ error: ADMIN_RECHT_FEHLER })
    db.user.findUnique.mockResolvedValue({ isAdmin: true, adminInhaber: false, adminRechte: ['hof_sperren_storno'] })
    expect(await notfallStorno({ orderId: BESTELLUNG })).toEqual({ error: ADMIN_BESTELLUNG_GRUND_FEHLT })
    expect(stornieren).not.toHaveBeenCalled()
    // Gegenprobe: mit Recht und Grund geht es.
    expect(await notfallStorno({ orderId: BESTELLUNG, grund: 'Hof nicht erreichbar' })).not.toHaveProperty('error')
    expect(stornieren).toHaveBeenCalledTimes(1)
  })

  it('scheitert der Storno: keine Nachricht, kein Eintrag; scheitert nur die Erstattung: storniert ist er, beides kommt', async () => {
    stornieren.mockResolvedValue({ error: 'Diese Bestellung ist schon storniert oder abgeholt.' })
    expect(await notfallStorno({ orderId: BESTELLUNG, grund: 'Hof nicht erreichbar' })).toEqual({ error: 'Diese Bestellung ist schon storniert oder abgeholt.' })
    expect(db.unterhaltung.create).not.toHaveBeenCalled()
    expect(eintraege()).toEqual([])

    stornieren.mockResolvedValue({ error: 'Rückerstattung fehlgeschlagen.', erstattungOffen: true })
    expect(await notfallStorno({ orderId: BESTELLUNG, grund: 'Hof nicht erreichbar' })).toMatchObject({ erstattungOffen: true })
    expect(db.unterhaltung.create).toHaveBeenCalledTimes(1)
    expect(eintraege()).toHaveLength(2)
  })

  it('der Geld-Satz an den Hof folgt dem echten Ausgang: online erstattet, Erstattung offen, vor Ort bezahlt', async () => {
    const text = (i: number): string => (db.unterhaltung.create.mock.calls[i]?.[0] as { data: { nachrichten: { create: { text: string } } } }).data.nachrichten.create.text
    const online = { farmId: HOF, orderNumber: 'HM-2610-B7C2', status: 'PAID', stripePaymentIntentId: 'pi_test_1', paymentStatus: 'PAID' }
    db.order.findUnique.mockResolvedValue(online)
    await notfallStorno({ orderId: BESTELLUNG, grund: 'Hof nicht erreichbar' })
    expect(text(0)).toContain('Die Kundin bekommt ihr Geld zurück.')

    stornieren.mockResolvedValue({ error: 'Rückerstattung fehlgeschlagen.', erstattungOffen: true })
    await notfallStorno({ orderId: BESTELLUNG, grund: 'Hof nicht erreichbar' })
    expect(text(1)).toContain('Die Erstattung hat noch nicht geklappt')
    expect(text(1)).not.toContain('bekommt ihr Geld zurück')

    // Gegenprobe: Barzahlung verspricht keine Erstattung.
    stornieren.mockResolvedValue({ erstattetCents: 0, vomHofCents: 0 })
    db.order.findUnique.mockResolvedValue({ ...online, stripePaymentIntentId: null, paymentStatus: 'PENDING' })
    await notfallStorno({ orderId: BESTELLUNG, grund: 'Hof nicht erreichbar' })
    expect(text(2)).toContain('nichts zu erstatten')
    expect(text(2)).not.toContain('bekommt ihr Geld zurück')
  })

  it('scheitert die Nachricht an den Hof, bleibt der Storno gültig (Nachlauf)', async () => {
    db.unterhaltung.create.mockRejectedValueOnce(new Error('Verbindung weg'))
    expect(await notfallStorno({ orderId: BESTELLUNG, grund: 'Hof nicht erreichbar' })).toEqual({ erstattetCents: 2100, vomHofCents: 2000 })
    expect(eintraege()).toHaveLength(2)
  })
})

describe('Suche — dieselbe Abfrage wie Admin › Betrieb › E-Mails', () => {
  const jetzt = new Date('2026-10-26T10:00:00.000Z')
  const filter = bestellFilterAus({})

  it('Nummer und ganze Adresse gehen über sucheMails; die Liste nimmt nur deren Treffer', async () => {
    vi.mocked(sucheMails).mockResolvedValue({ bestellungen: [{ id: BESTELLUNG } as never], mails: [] })
    await ladeBestellListe(mailSucheAus('kundin@example.com'), filter, jetzt)
    expect(sucheMails).toHaveBeenCalledWith({ art: 'adresse', adresse: 'kundin@example.com' }, jetzt)
    expect(db.order.findMany.mock.calls[0]?.[0]).toMatchObject({ where: { id: { in: [BESTELLUNG] } } })
    await ladeBestellListe(mailSucheAus('HM-2610-B7C2'), filter, jetzt)
    expect(sucheMails).toHaveBeenLastCalledWith({ art: 'bestellung', nummer: 'HM-2610-B7C2' }, jetzt)
  })

  it('Teiladresse: ungültig, keine Abfrage, keine Zeile; kein Treffer: keine Liste', async () => {
    for (const teil of ['kundin@', '@example.com', 'kundin']) {
      expect(await ladeBestellListe(mailSucheAus(teil), filter, jetzt)).toEqual([])
    }
    expect(sucheMails).not.toHaveBeenCalled()
    expect(db.order.findMany).not.toHaveBeenCalled()
    vi.mocked(sucheMails).mockResolvedValue({ bestellungen: [], mails: [] })
    expect(await ladeBestellListe(mailSucheAus('niemand@example.com'), filter, jetzt)).toEqual([])
    expect(db.order.findMany).not.toHaveBeenCalled()
  })

  it('ohne Suche: die neuesten im Filter (Gegenprobe: ohne id-Bedingung)', async () => {
    await ladeBestellListe(mailSucheAus(''), bestellFilterAus({ stand: 'storniert', offen: '1' }), jetzt)
    const where = (db.order.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where
    expect(where).not.toHaveProperty('id')
    expect(where).toMatchObject({ status: { in: ['CANCELLED'] }, erstattungOffenSeit: { not: null } })
  })
})

describe('Detail — die Adresse nur gekürzt', () => {
  it('das Detail trägt keine volle Adresse, nur die gekürzte (Gegenprobe: die Abfrage hat sie gelesen)', async () => {
    db.order.findUnique.mockResolvedValue({ id: BESTELLUNG, orderNumber: 'HM-2610-B7C2', farmId: HOF, customerEmail: 'kundin@example.at', farm: { name: 'Testhof' }, items: [] })
    vi.mocked(sucheMails).mockResolvedValue({ bestellungen: [], mails: [] })
    const detail = await ladeBestellDetail(BESTELLUNG, new Date('2026-10-26T10:00:00.000Z'))
    expect(detail).not.toHaveProperty('customerEmail')
    expect(detail?.kundinGekuerzt).toBe('k•••@example.at')
    expect(JSON.stringify(detail)).not.toContain('kundin@')
    expect(db.order.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ customerEmail: 'kundin@example.at' }) }))
  })
})

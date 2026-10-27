/**
 * Admin › Betrieb › Protokoll (Register N33, Nr. 193; Mockup admin-protokoll)
 * — gerendert ohne DOM (renderToStaticMarkup), Datenbank als Attrappe.
 *
 * Beweist:
 *  - Keine Adresse im HTML und in der CSV: Selbst wenn die Datenbank zu einer
 *    Bestellung mehr liefert (erfundene Adresse, Name), steht nur die
 *    Bestellnummer da; Wer ist „System“, „Du“ oder „Team“, nie ein Name.
 *  - Die Abfrage liest von der Bestellung nur `orderNumber`, vom Hof nur den Namen.
 *  - Filter aus der Adresse: Unbekanntes ist der Standard (30 Tage, alle),
 *    eine Bestellnummer sucht über die Kennung der Bestellung.
 *  - Jede Art aus ADMIN_AKTIONEN hat einen Namen.
 *  - Die CSV: ohne Admin 403, ohne frische Bestätigung 303, sonst die Datei.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest, NextResponse } from 'next/server'

const db = vi.hoisted(() => ({
  adminAktion: { findMany: vi.fn(), count: vi.fn() },
  farm: { findMany: vi.fn() },
  order: { findMany: vi.fn(), findUnique: vi.fn() },
}))
const wache = vi.hoisted(() => ({ verlangeAdminAktion: vi.fn(), frischOderBestaetigen: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/server/admin-wache', () => wache)
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) =>
    createElement('a', { href, ...Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'prefetch' && k !== 'scroll')) }, children),
  useLinkStatus: () => ({ pending: false }),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/betrieb', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

import { ProtokollAnsicht } from '@/app/admin/betrieb/protokoll-ansicht'
import { protokollArtName, protokollAlsCsv } from '@/app/admin/betrieb/protokoll'
import { GET as exportGet } from '@/app/admin/betrieb/protokoll/export/route'
import { protokollFilterAus } from '@/schemas/betrieb-mails'
import { ADMIN_AKTIONEN } from '@/schemas/admin-aktion'

const JETZT = new Date('2026-10-27T09:00:00Z')
// Erfundene Personendaten — sie dürfen nirgends auftauchen.
const ADRESSE = 'kundin.erfunden@example.com'
const STRASSE = 'Erfundene Gasse 12'
const NAME = 'Erika Erfunden'

const ZEILEN = [
  { id: 'a1', wann: new Date('2026-10-27T07:41:00Z'), wer: 'ich', art: 'adresse_angezeigt', bezugArt: 'bestellung', bezugId: 'bestellung1', grund: 'Erstattung per Überweisung', mitPasskey: true },
  { id: 'a2', wann: new Date('2026-10-26T16:02:00Z'), wer: 'jemand', art: 'hof_freigeschaltet', bezugArt: 'hof', bezugId: 'hof1', grund: 'Profil geprüft', mitPasskey: true },
  { id: 'a3', wann: new Date('2026-10-26T05:13:00Z'), wer: null, art: 'lastschrift_gescheitert', bezugArt: 'monat', bezugId: '2026-09', grund: null, mitPasskey: false },
]

beforeEach(() => {
  vi.clearAllMocks()
  db.adminAktion.findMany.mockResolvedValue(ZEILEN)
  db.adminAktion.count.mockResolvedValue(214)
  db.farm.findMany.mockResolvedValue([{ id: 'hof1', name: 'Hof am Testbach' }])
  // Die Attrappe liefert absichtlich mehr, als gefragt ist — die Ansicht darf nur die Nummer nehmen.
  db.order.findMany.mockResolvedValue([{ id: 'bestellung1', orderNumber: 'HM-2610-B7C2', customerEmail: ADRESSE, customerName: NAME, strasse: STRASSE }])
  db.order.findUnique.mockResolvedValue({ id: 'bestellung1' })
})

async function rendere(parameter: Record<string, string> = {}): Promise<string> {
  return renderToStaticMarkup(await ProtokollAnsicht({ f: protokollFilterAus(parameter), ich: 'ich', jetzt: JETZT, mailsOffen: null }))
}

describe('Protokoll-Seite', () => {
  it('Tabelle mit Wer, Was, Bezug, Grund und Passkey — ohne Adresse und ohne Namen einer Person', async () => {
    const html = await rendere()
    expect(html).toContain('Volle Adresse angezeigt')
    expect(html).toContain('HM-2610-B7C2')
    expect(html).toContain('Hof am Testbach')
    expect(html).toContain('>Du<')
    expect(html).toContain('>Team<')
    expect(html).toContain('>System<')
    expect(html).toContain('3 von 214 Einträgen')
    expect(html).toContain('href="/admin/betrieb/protokoll/export"')
    for (const verboten of [ADRESSE, STRASSE, NAME, '@']) expect(html, verboten).not.toContain(verboten)
  })

  it('die Abfrage liest von der Bestellung nur die Nummer und vom Hof nur den Namen', async () => {
    await rendere()
    expect(db.order.findMany).toHaveBeenCalledWith({ where: { id: { in: ['bestellung1'] } }, select: { id: true, orderNumber: true } })
    expect(db.farm.findMany).toHaveBeenCalledWith({ where: { id: { in: ['hof1'] } }, select: { id: true, name: true } })
  })

  it('Filter: Standard 30 Tage; Wer, Art, Passkey und eine Bestellnummer gehen in die Abfrage', async () => {
    await rendere({ wer: 'team', art: 'notfall_storno', tage: '7', passkey: '1', bezug: 'HM-2610-B7C2' })
    const where = db.adminAktion.findMany.mock.calls[0]?.[0].where
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { wann: { gte: new Date(JETZT.getTime() - 7 * 86_400_000) } },
        { wer: { not: null } },
        { NOT: { wer: 'ich' } },
        { art: 'notfall_storno' },
        { mitPasskey: true },
        { bezugId: { in: ['HM-2610-B7C2', 'bestellung1'] } },
      ])
    )
    expect(db.order.findUnique).toHaveBeenCalledWith({ where: { orderNumber: 'HM-2610-B7C2' }, select: { id: true } })
  })

  it('Unbekanntes in der Adresse ist der Standard — nie ein Fehler', () => {
    expect(protokollFilterAus({ wer: 'boese', art: 'drop table', tage: '12', passkey: 'ja', bezug: 'a b@c' })).toEqual({ wer: 'alle', art: 'alle', tage: 30, nurPasskey: false, bezug: '' })
  })

  it('leer: Leerzustand mit Weg zurück', async () => {
    db.adminAktion.findMany.mockResolvedValue([])
    db.adminAktion.count.mockResolvedValue(0)
    const html = await rendere()
    expect(html).toContain('Kein Eintrag in diesem Zeitraum')
  })

  it('jede Art hat einen Namen (kein Unterstrich in der Anzeige)', () => {
    for (const art of ADMIN_AKTIONEN) expect(protokollArtName(art), art).not.toContain('_')
  })

  it('CSV: dieselben Spalten, Bestellnummer statt Adresse, Formeln entschärft', () => {
    const csv = protokollAlsCsv(
      [...ZEILEN, { id: 'a4', wann: JETZT, wer: 'ich', art: 'testmail_gesendet', bezugArt: 'plattform', bezugId: 'plattform', grund: '=SUMME(A1)', mitPasskey: false }],
      { hoefe: new Map([['hof1', 'Hof am Testbach']]), bestellungen: new Map([['bestellung1', 'HM-2610-B7C2']]) },
      'ich'
    )
    expect(csv.startsWith('\uFEFFTag;Uhrzeit;Wer;Was;Art;Bezug;Bezugsart;Kennung;Grund;Passkey\r\n')).toBe(true)
    expect(csv).toContain('HM-2610-B7C2')
    expect(csv).toContain("'=SUMME(A1)")
    expect(csv).not.toContain(ADRESSE)
  })
})

describe('Protokoll als CSV (Route)', () => {
  const anfrage = (suche = '') => new NextRequest(`http://localhost/admin/betrieb/protokoll/export${suche}`)

  it('ohne Admin: 403 ohne Inhalt, nichts gelesen', async () => {
    wache.verlangeAdminAktion.mockResolvedValue({ error: 'Kein Zugriff.' })
    expect((await exportGet(anfrage())).status).toBe(403)
    expect(db.adminAktion.findMany).not.toHaveBeenCalled()
  })

  it('ohne frische Bestätigung: 303 zur Bestätigung — mit demselben Filter als Rückweg', async () => {
    wache.verlangeAdminAktion.mockResolvedValue({ ok: true, userId: 'ich', sitzungId: 's', mitPasskey: false })
    wache.frischOderBestaetigen.mockResolvedValue(new NextResponse(null, { status: 303 }))
    expect((await exportGet(anfrage('?tage=7&wer=boese'))).status).toBe(303)
    expect(wache.frischOderBestaetigen).toHaveBeenCalledWith('/admin/betrieb/protokoll/export?tage=7')
    expect(db.adminAktion.findMany).not.toHaveBeenCalled()
  })

  it('frisch bestätigt: CSV als Datei, no-store', async () => {
    wache.verlangeAdminAktion.mockResolvedValue({ ok: true, userId: 'ich', sitzungId: 's', mitPasskey: true })
    wache.frischOderBestaetigen.mockResolvedValue(null)
    const antwort = await exportGet(anfrage())
    expect(antwort.status).toBe(200)
    expect(antwort.headers.get('content-disposition')).toMatch(/^attachment; filename="admin-protokoll-\d{4}-\d{2}-\d{2}\.csv"$/)
    expect(antwort.headers.get('cache-control')).toBe('no-store')
    const text = await antwort.text()
    expect(text).toContain('HM-2610-B7C2')
    expect(text).not.toContain(ADRESSE)
  })
})

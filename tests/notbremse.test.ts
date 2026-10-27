/**
 * Notbremse „Bestellungen anhalten“ (Register N34, Nachtlauf Nr. 189) — Regeln,
 * Prüfkette, Action-Wache, Band und GET /api/notbremse ohne Datenbank.
 *
 * Beweist:
 *  - `bestellstoppAktiv`: gilt ab „ab“ bis vor „bis“; abgelaufen oder ohne
 *    Felder ist sie aus (Frist beim Lesen). `notbremseBisFehler`: vorbei und
 *    über 72 Stunden lehnt sie ab, 72 Stunden gehen (Grenze).
 *  - Prüfkette: Die Notbremse ist die ERSTE Bedingung — auch ein stillgelegter
 *    Hof bekommt ihren Satz; abgelaufen gilt wieder die Hof-Kette (Gegenprobe).
 *  - Die Actions fragen die Wache mit `{ frisch: true, recht: 'notbremse' }`;
 *    lehnt sie ab, schreibt nichts und nichts kommt ins Protokoll.
 *  - Band: `role="status"` steht immer, Satz und „bis …“ nur bei Notbremse;
 *    der Hinweis an den Kaufknöpfen spricht nie von Abholzeit.
 *  - GET /api/notbremse: Satz und Ende, solange sie gilt — nie Grund oder
 *    Beginn; ein Ladefehler heißt „kein Band“.
 * Die echte Datenbank, die drei Routen und die Hof-Aktionen prüft
 * tests/integration/notbremse.int.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { NextRequest } from 'next/server'
import { updateTag } from 'next/cache'

vi.mock('next/cache', () => ({ updateTag: vi.fn(), unstable_cache: (f: () => unknown) => f }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { plattformEinstellung: { findUnique: vi.fn() }, $executeRaw: vi.fn() },
}))
vi.mock('@/server/abholfenster', async (original) => ({
  ...(await original<typeof import('@/server/abholfenster')>()),
  ausgebuchteTage: vi.fn(async () => new Map()),
}))
vi.mock('@/server/admin-wache', () => ({ verlangeAdminAktion: vi.fn() }))
vi.mock('@/server/admin-protokoll', () => ({ protokolliere: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { protokolliere } from '@/server/admin-protokoll'
import { pruefeKaufbarkeitHof } from '@/server/warenkorb'
import { gibBestellungenFrei, halteBestellungenAn } from '@/server/actions/notbremse'
import { GET } from '@/app/api/notbremse/route'
import { BestellstoppHinweis, BestellstoppZeile } from '@/components/notbremse-band'
import { NotbremseFormular } from '@/components/admin/heute-notbremse'
import { FARM_ARCHIVED_MESSAGE } from '@/lib/farm-archive'
import {
  NOTBREMSE_FEHLER,
  NOTBREMSE_HOECHSTENS_MS,
  NOTBREMSE_SATZ_VORGABE,
  bestellstoppAktiv,
  bestellstoppAus,
  bestellstoppAusAntwort,
  bestellstoppBisText,
  notbremseBisFehler,
  notbremseBisGrenzen,
  notbremseBisVorgabe,
  notbremseEingabe,
  zeitpunktAusLokal,
  zeitpunktLokal,
  sperreMitBestellstopp,
} from '@/lib/notbremse'

// Montag, 26. Oktober 2026, 10:00 Uhr in Wien.
const JETZT = new Date('2026-10-26T09:00:00.000Z')
const AB = new Date('2026-10-26T08:30:00.000Z')
const BIS = new Date('2026-10-26T10:00:00.000Z')
const SATZ = NOTBREMSE_SATZ_VORGABE
const ZEILE = { bestellstoppAb: AB, bestellstoppBis: BIS, bestellstoppGrund: 'zahlungen', bestellstoppSatz: SATZ }
const LEER = { bestellstoppAb: null, bestellstoppBis: null, bestellstoppGrund: null, bestellstoppSatz: null }

const findUnique = vi.mocked(prisma.plattformEinstellung.findUnique)
const executeRaw = vi.mocked(prisma.$executeRaw)
const wache = vi.mocked(verlangeAdminAktion)

beforeEach(() => {
  vi.clearAllMocks()
  findUnique.mockResolvedValue(null as never)
})

describe('Regeln (src/lib/notbremse.ts)', () => {
  const stand = bestellstoppAus(ZEILE)

  it('gilt ab „ab“ bis vor „bis“ — danach aus, ohne dass jemand schreibt', () => {
    expect(bestellstoppAktiv(stand, JETZT)).toEqual({ satz: SATZ, bis: BIS.toISOString() })
    expect(bestellstoppAktiv(stand, AB)).not.toBeNull()
    expect(bestellstoppAktiv(stand, BIS)).toBeNull()
    expect(bestellstoppAktiv(stand, new Date(AB.getTime() - 1))).toBeNull()
  })

  it('ohne Felder oder ohne Satz: keine Notbremse', () => {
    expect(bestellstoppAus(LEER)).toBeNull()
    expect(bestellstoppAus({ ...ZEILE, bestellstoppSatz: '  ' })).toBeNull()
    expect(bestellstoppAktiv(null, JETZT)).toBeNull()
  })

  it('„bis“: nach jetzt, höchstens 72 Stunden', () => {
    expect(notbremseBisFehler(new Date(JETZT.getTime() + NOTBREMSE_HOECHSTENS_MS), JETZT)).toBeNull()
    expect(notbremseBisFehler(new Date(JETZT.getTime() + NOTBREMSE_HOECHSTENS_MS + 1), JETZT)).toBe(NOTBREMSE_FEHLER.zuLang)
    expect(notbremseBisFehler(JETZT, JETZT)).toBe(NOTBREMSE_FEHLER.vorbei)
    expect(notbremseBisFehler(new Date('kaputt'), JETZT)).toBe(NOTBREMSE_FEHLER.bis)
  })

  it('Kaufknopf: Notbremse ruht wie eine Sperre, die Sperre des Hofs geht vor', () => {
    const stopp = { satz: SATZ, bis: BIS.toISOString() }
    expect(sperreMitBestellstopp(null, null)).toBeNull()
    expect(sperreMitBestellstopp(null, stopp)).not.toBeNull()
    expect(sperreMitBestellstopp('pause', stopp)).toBe('pause')
  })

  it('Antwort der Route: nur Satz und lesbare Zeit zählen', () => {
    expect(bestellstoppAusAntwort({ stopp: { satz: SATZ, bis: BIS.toISOString() } })).toEqual({ satz: SATZ, bis: BIS.toISOString() })
    expect(bestellstoppAusAntwort({ stopp: null })).toBeNull()
    expect(bestellstoppAusAntwort({ stopp: { satz: SATZ, bis: 'gestern' } })).toBeNull()
    expect(bestellstoppAusAntwort('kaputt')).toBeNull()
  })

  it('„bis“ in Wiener Zeit', () => {
    expect(bestellstoppBisText(BIS.toISOString())).toBe('bis Mo., 26.10., 11:00 Uhr')
  })
})

describe('Prüfkette: die Notbremse zuerst (src/server/warenkorb.ts)', () => {
  const stillgelegt = {
    id: 'hof-1',
    name: 'Testhof',
    isPaused: false,
    archivedAt: new Date('2026-01-01T00:00:00.000Z'),
    approvedAt: new Date('2026-01-01T00:00:00.000Z'),
    pickupSlots: [],
  }

  it('aktiv: auch der stillgelegte Hof bekommt den Satz der Notbremse', async () => {
    findUnique.mockResolvedValue(ZEILE as never)
    expect(await pruefeKaufbarkeitHof(stillgelegt as never, JETZT)).toEqual({ grund: 'notbremse', text: SATZ })
  })

  it('abgelaufen: wieder die Kette des Hofs (Gegenprobe)', async () => {
    findUnique.mockResolvedValue(ZEILE as never)
    expect(await pruefeKaufbarkeitHof(stillgelegt as never, BIS)).toEqual({ grund: 'stillgelegt', text: FARM_ARCHIVED_MESSAGE })
  })
})

describe('Actions: Recht notbremse, frisch, Protokoll', () => {
  const eingabe = { grund: 'wartung', satz: SATZ, bis: new Date(Date.now() + 60 * 60 * 1000).toISOString() }

  it('lehnt die Wache ab: nichts geschrieben, kein Eintrag', async () => {
    wache.mockResolvedValue({ error: 'Dafür fehlt dir das Recht.' } as never)
    expect(await halteBestellungenAn(eingabe)).toEqual({ error: 'Dafür fehlt dir das Recht.' })
    expect(await gibBestellungenFrei()).toEqual({ error: 'Dafür fehlt dir das Recht.' })
    expect(wache.mock.calls).toEqual([[{ frisch: true, recht: 'notbremse' }], [{ frisch: true, recht: 'notbremse' }]])
    expect(executeRaw).not.toHaveBeenCalled()
    expect(protokolliere).not.toHaveBeenCalled()
  })

  it('unbekannter Grund, leerer Satz, Adresse im Satz: eigene Sätze, nichts geschrieben', async () => {
    wache.mockResolvedValue({ userId: 'admin-1', mitPasskey: true } as never)
    expect(await halteBestellungenAn({ ...eingabe, grund: 'irgendwas' })).toEqual({ error: NOTBREMSE_FEHLER.grund })
    expect(await halteBestellungenAn({ ...eingabe, satz: ' ' })).toEqual({ error: NOTBREMSE_FEHLER.satz })
    expect(await halteBestellungenAn({ ...eingabe, satz: 'Schreib an hilfe@example.com' })).toEqual({ error: NOTBREMSE_FEHLER.satzPerson })
    expect(await halteBestellungenAn({ ...eingabe, bis: 'morgen' })).toEqual({ error: NOTBREMSE_FEHLER.bis })
    expect(executeRaw).not.toHaveBeenCalled()
  })

  it('Freigeben ohne gesetzte Notbremse: kein Eintrag; mit: ein Eintrag', async () => {
    wache.mockResolvedValue({ userId: 'admin-1', mitPasskey: true } as never)
    executeRaw.mockResolvedValueOnce(0 as never).mockResolvedValueOnce(1 as never)
    await gibBestellungenFrei()
    expect(protokolliere).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
    await gibBestellungenFrei()
    expect(vi.mocked(protokolliere).mock.calls[0]?.[0]).toMatchObject({ art: 'bestellungen_freigegeben', bezugArt: 'plattform', wer: 'admin-1' })
    expect(updateTag).toHaveBeenCalledTimes(1)
  })
})

describe('Formular „Bestellungen anhalten …“ in Heute (Nr. 189 Punkt 4)', () => {
  it('„bis“: Vorgabe auf die volle Stunde nach einer Stunde, Grenzen jetzt bis 72 h', () => {
    expect(notbremseBisVorgabe(new Date('2026-10-26T08:42:00.000Z')).toISOString()).toBe('2026-10-26T10:00:00.000Z')
    expect(notbremseBisVorgabe(new Date('2026-10-26T09:00:00.000Z')).toISOString()).toBe('2026-10-26T10:00:00.000Z')
    const { min, max } = notbremseBisGrenzen(JETZT)
    expect(zeitpunktAusLokal(min)?.getTime()).toBeGreaterThanOrEqual(JETZT.getTime())
    expect(zeitpunktAusLokal(max)!.getTime() - JETZT.getTime()).toBeLessThanOrEqual(NOTBREMSE_HOECHSTENS_MS)
    expect(zeitpunktAusLokal(zeitpunktLokal(BIS))?.toISOString()).toBe(BIS.toISOString())
    expect(zeitpunktAusLokal('')).toBeNull()
    expect(zeitpunktAusLokal('morgen')).toBeNull()
  })

  it('Eingabe: Grund, Satz und „bis“ als ISO-Zeit; „bis“ fehlt, vorbei oder über 72 h → eigener Satz', () => {
    const lokal = zeitpunktLokal(BIS)
    expect(notbremseEingabe({ grund: 'wartung', satz: ` ${SATZ} `, bisLokal: lokal }, JETZT)).toEqual({ eingabe: { grund: 'wartung', satz: SATZ, bis: BIS.toISOString() } })
    expect(notbremseEingabe({ grund: 'wartung', satz: SATZ, bisLokal: '' }, JETZT)).toEqual({ fehler: NOTBREMSE_FEHLER.bis })
    expect(notbremseEingabe({ grund: 'wartung', satz: SATZ, bisLokal: zeitpunktLokal(AB) }, JETZT)).toEqual({ fehler: NOTBREMSE_FEHLER.vorbei })
    const zuSpaet = zeitpunktLokal(new Date(JETZT.getTime() + NOTBREMSE_HOECHSTENS_MS + 60 * 60_000))
    expect(notbremseEingabe({ grund: 'wartung', satz: SATZ, bisLokal: zuSpaet }, JETZT)).toEqual({ fehler: NOTBREMSE_FEHLER.zuLang })
    expect(notbremseEingabe({ grund: 'wartung', satz: '  ', bisLokal: lokal }, JETZT)).toEqual({ fehler: NOTBREMSE_FEHLER.satz })
  })

  it('Formular nach dem Mockup: Grund aus der Liste, Satz vorbelegt, „bis“ Pflicht mit Grenzen, Felder 16 px am Handy', () => {
    const { min, max } = notbremseBisGrenzen(JETZT)
    const html = renderToStaticMarkup(
      createElement(NotbremseFormular, { grund: 'zahlungen', satz: SATZ, bis: zeitpunktLokal(BIS), min, max, setGrund: () => {}, setSatz: () => {}, setBis: () => {} })
    )
    expect(html).toContain('Grund (nur für dich und das Protokoll)')
    for (const g of ['Zahlungen gestört (Stripe)', 'Fehler in der Kasse', 'Wartung', 'Sonstiges']) expect(html).toContain(`>${g}</option>`)
    expect(html).toContain(`>${SATZ}</textarea>`)
    expect(html).toContain('So sieht es die Kundschaft')
    expect(html).toMatch(/<input[^>]*type="datetime-local"[^>]*required=""/)
    expect(html).toContain(`min="${min}"`)
    expect(html).toContain(`max="${max}"`)
    expect(html).toContain('Bis spätestens')
    expect(html).toContain('text-base')
  })
})

describe('Band und Hinweis (src/components/notbremse-band.tsx)', () => {
  const stopp = { satz: SATZ, bis: BIS.toISOString() }

  it('mit Notbremse: role="status", Satz und „bis …“', () => {
    const html = renderToStaticMarkup(createElement(BestellstoppZeile, { stopp }))
    expect(html).toContain('role="status"')
    expect(html).toContain(SATZ)
    expect(html).toContain('bis Mo., 26.10., 11:00 Uhr')
  })

  it('ohne Notbremse: nur der leere Rahmen der Live-Region', () => {
    expect(renderToStaticMarkup(createElement(BestellstoppZeile, { stopp: null }))).toBe('<div role="status" data-notbremse-band="" class="print:hidden"></div>')
  })

  it('Hinweis an den Kaufknöpfen: Grund statt „keine Abholzeit“', () => {
    const html = renderToStaticMarkup(createElement(BestellstoppHinweis, { stopp }))
    expect(html).toContain('Bestellen geht gerade nicht.')
    expect(html).toContain(SATZ)
    expect(html).not.toMatch(/Abholzeit/)
    expect(renderToStaticMarkup(createElement(BestellstoppHinweis, { stopp: null }))).toBe('')
  })
})

describe('GET /api/notbremse', () => {
  const anfrage = () => new NextRequest('http://localhost/api/notbremse')

  it('aktiv: Satz und Ende — nie Grund oder Beginn', async () => {
    findUnique.mockResolvedValue({ ...ZEILE, bestellstoppAb: new Date(Date.now() - 1000), bestellstoppBis: new Date(Date.now() + 60_000) } as never)
    const res = await GET(anfrage())
    const daten = await res.json()
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(Object.keys(daten.stopp).sort()).toEqual(['bis', 'satz'])
    expect(daten.stopp.satz).toBe(SATZ)
  })

  it('ohne oder abgelaufen: null; Ladefehler: null statt 500', async () => {
    expect(await (await GET(anfrage())).json()).toEqual({ stopp: null })
    findUnique.mockResolvedValue({ ...ZEILE, bestellstoppBis: new Date(Date.now() - 1000), bestellstoppAb: new Date(Date.now() - 60_000) } as never)
    expect(await (await GET(anfrage())).json()).toEqual({ stopp: null })
    findUnique.mockRejectedValue(new Error('weg'))
    const res = await GET(anfrage())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ stopp: null })
  })
})

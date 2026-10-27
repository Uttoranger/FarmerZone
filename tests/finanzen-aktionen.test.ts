/**
 * Tests der Kostenposten-Aktionen (src/server/actions/finanzen.ts).
 *
 * Die Aussagen, die zählen:
 *  - Ohne Admin-Recht wirkt nichts. Auch nicht mit gültiger Session.
 *  - Der Betrag wird als DEZIMALZAHL geschrieben, nicht als Float: 19,99 €
 *    müssen 19.99 ergeben, nicht 19.989999999999998.
 *  - Der Monat geht als UTC-Mitternacht in die DATE-Spalte — nicht als Wiener
 *    Mitternacht, das wäre der Vormonat.
 *  - Ein Posten kann nicht so verbogen werden, dass er in keinem Monat zählt
 *    (Beginn nach Ende). Die Bedingung steht in der WHERE-Klausel.
 *  - Nach dem Monatsabschluss (Nr. 191, N37) brauchen Änderungen, die einen
 *    abgeschlossenen Monat berühren, einen Grund — er steht im Protokoll.
 *  - „Monat abschließen“ geht nur mit erledigter Prüfliste, nach dem
 *    Monatsende und einmal; der Abschluss ist der Protokoll-Eintrag.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', async () => ({
  prisma: {
    // Die Wache liest seit Nr. 115 die Pflicht „erst Passkey“ (tests/admin-sitzung.ts).
    ...(await import('./admin-sitzung')).passkeyAttrappen(),
    user: { findUnique: vi.fn() },
    adminAktion: { create: vi.fn(async () => ({ id: 'a1' })) },
    kostenposten: {
      findUnique: vi.fn(),
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

// Abgeschlossene Monate und der Stand des Monats kommen aus dem Geld-Abgleich (src/server/geld-abgleich.ts).
const geld = vi.hoisted(() => ({ abgeschlossen: new Map<string, Date>(), monat: vi.fn() }))
vi.mock('@/server/queries/geld', () => ({
  ladeAbgeschlosseneMonate: vi.fn(async () => geld.abgeschlossen),
  ladeGeldMonat: geld.monat,
}))

import {
  monatAbschliessen,
  kostenpostenAendern,
  kostenpostenAnlegen,
  kostenpostenBeenden,
  kostenpostenLoeschen,
} from '@/server/actions/finanzen'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { adminSitzung } from './admin-sitzung'

const getSession = vi.mocked(auth.api.getSession)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const create = vi.mocked(prisma.kostenposten.create)
const updateMany = vi.mocked(prisma.kostenposten.updateMany)
const deleteMany = vi.mocked(prisma.kostenposten.deleteMany)
const count = vi.mocked(prisma.kostenposten.count)

const GUELTIG = {
  name: 'Hosting',
  kategorie: 'HOSTING' as const,
  betrag: 19.99,
  rhythmus: 'MONATLICH' as const,
  ab: '2026-09',
  notiz: null,
}

function alsAdmin() {
  getSession.mockResolvedValue(adminSitzung('user_admin') as never)
  userFindUnique.mockResolvedValue({ isAdmin: true, adminInhaber: true } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  geld.abgeschlossen = new Map()
  alsAdmin()
  create.mockResolvedValue({ id: 'k1' } as never)
  updateMany.mockResolvedValue({ count: 1 } as never)
  deleteMany.mockResolvedValue({ count: 1 } as never)
  count.mockResolvedValue(1 as never)
})

describe('Zugriff', () => {
  it('lässt niemanden ohne Anmeldung schreiben', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await kostenpostenAnlegen(GUELTIG)).toEqual({ error: 'Nicht angemeldet.' })
    expect(create).not.toHaveBeenCalled()
  })

  it('lässt einen angemeldeten Nicht-Admin nicht schreiben', async () => {
    getSession.mockResolvedValue(adminSitzung('user_1') as never)
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    expect(await kostenpostenAnlegen(GUELTIG)).toEqual({ error: 'Kein Zugriff.' })
    expect(create).not.toHaveBeenCalled()
  })

  it('prüft das Recht in JEDER der vier Aktionen', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await kostenpostenAendern({ ...GUELTIG, id: 'k1' })).toEqual({ error: 'Nicht angemeldet.' })
    expect(await kostenpostenBeenden({ id: 'k1', monat: '2026-09' })).toEqual({
      error: 'Nicht angemeldet.',
    })
    expect(await kostenpostenLoeschen({ id: 'k1' })).toEqual({ error: 'Nicht angemeldet.' })
    expect(updateMany).not.toHaveBeenCalled()
    expect(deleteMany).not.toHaveBeenCalled()
  })

  it('prüft das Recht VOR der Eingabe — ungültige Eingabe verrät nichts über den Bereich', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await kostenpostenAnlegen({ quatsch: true })).toEqual({ error: 'Nicht angemeldet.' })
  })
})

describe('kostenpostenAnlegen', () => {
  it('schreibt den Betrag als Dezimalzahl mit zwei Stellen, nicht als Float', async () => {
    expect(await kostenpostenAnlegen(GUELTIG)).toEqual({ ok: true })

    const daten = create.mock.calls[0]![0]!.data as { betrag: { toString(): string } }
    expect(daten.betrag.toString()).toBe('19.99')
  })

  it('schreibt den Monat als UTC-Mitternacht des Ersten', async () => {
    await kostenpostenAnlegen(GUELTIG)
    const daten = create.mock.calls[0]![0]!.data as { ab: Date }
    // Wiener Mitternacht wäre 2026-08-31T22:00Z — in der DATE-Spalte August.
    expect(daten.ab.toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })

  it('macht aus einer leeren Notiz null, nicht undefined', async () => {
    await kostenpostenAnlegen({ ...GUELTIG, notiz: '   ' })
    const daten = create.mock.calls[0]![0]!.data as { notiz: string | null }
    expect(daten.notiz).toBeNull()
  })

  it('nimmt einen Betrag genau an der Obergrenze noch an', async () => {
    expect(await kostenpostenAnlegen({ ...GUELTIG, betrag: 999_999.99 })).toEqual({ ok: true })
    const daten = create.mock.calls[0]![0]!.data as { betrag: { toString(): string } }
    expect(daten.betrag.toString()).toBe('999999.99')
  })

  it('nimmt eine Notiz mit genau 200 Zeichen noch an', async () => {
    expect(await kostenpostenAnlegen({ ...GUELTIG, notiz: 'x'.repeat(200) })).toEqual({ ok: true })
  })

  it('räumt die Seite auf, damit die neue Zeile sofort steht', async () => {
    await kostenpostenAnlegen(GUELTIG)
    expect(revalidatePath).toHaveBeenCalledWith('/admin/geld')
  })

  it.each([
    [{ ...GUELTIG, name: '  ' }, 'Bitte gib dem Posten einen Namen.'],
    [{ ...GUELTIG, betrag: 0 }, 'Der Betrag muss größer als 0 sein.'],
    [{ ...GUELTIG, betrag: -5 }, 'Der Betrag muss größer als 0 sein.'],
    [{ ...GUELTIG, betrag: 19.999 }, 'Höchstens zwei Nachkommastellen.'],
    [{ ...GUELTIG, betrag: null }, 'Bitte gib einen Betrag ein.'],
    [{ ...GUELTIG, ab: '2026-13' }, 'Bitte wähle einen Monat.'],
    [{ ...GUELTIG, ab: '2026-09-01' }, 'Bitte wähle einen Monat.'],
    [{ ...GUELTIG, betrag: 1_000_000 }, 'Der Betrag ist zu hoch.'],
    [{ ...GUELTIG, kategorie: 'AUTO' }, 'Bitte wähle eine Kategorie.'],
    [{ ...GUELTIG, rhythmus: 'TAEGLICH' }, 'Bitte wähle einen Rhythmus.'],
    [{ ...GUELTIG, notiz: 'x'.repeat(201) }, 'Die Notiz ist zu lang.'],
    // Kein Feld ist eine Zeichenkette → trotzdem ein deutscher Satz, keine
    // englische Zod-Vorgabe. Erreichbar nur über einen manipulierten Aufruf.
    [{ ...GUELTIG, name: 42 }, 'Bitte gib dem Posten einen Namen.'],
    [{ ...GUELTIG, ab: 202609 }, 'Bitte wähle einen Monat.'],
  ])('lehnt %j ab: %s', async (eingabe, meldung) => {
    expect(await kostenpostenAnlegen(eingabe)).toEqual({ error: meldung })
    expect(create).not.toHaveBeenCalled()
  })
})

describe('kostenpostenAendern', () => {
  it('lässt den Beginn nicht hinter das Ende rutschen — Bedingung in der WHERE-Klausel', async () => {
    await kostenpostenAendern({ ...GUELTIG, id: 'k1' })
    const wo = updateMany.mock.calls[0]![0]!.where as {
      id: string
      OR: Array<{ bis: null | { gte: Date } }>
    }
    expect(wo.id).toBe('k1')
    expect(wo.OR[0]).toEqual({ bis: null })
    expect((wo.OR[1] as { bis: { gte: Date } }).bis.gte.toISOString()).toBe(
      '2026-09-01T00:00:00.000Z'
    )
  })

  it('sagt beim verbogenen Zeitraum, was zu tun ist — und schreibt nichts', async () => {
    updateMany.mockResolvedValue({ count: 0 } as never)
    count.mockResolvedValue(1 as never) // der Posten existiert
    const ergebnis = await kostenpostenAendern({ ...GUELTIG, id: 'k1' })
    expect(ergebnis).toEqual({
      error: 'Der erste Monat liegt nach dem letzten. Wähle einen früheren Monat.',
    })
  })

  it('unterscheidet den verbogenen Zeitraum von einem Posten, den es nicht gibt', async () => {
    updateMany.mockResolvedValue({ count: 0 } as never)
    count.mockResolvedValue(0 as never)
    expect(await kostenpostenAendern({ ...GUELTIG, id: 'weg' })).toEqual({
      error: 'Diesen Posten gibt es nicht mehr.',
    })
  })

  it('fragt im Erfolgsfall nicht nach, ob es den Posten gibt', async () => {
    await kostenpostenAendern({ ...GUELTIG, id: 'k1' })
    expect(count).not.toHaveBeenCalled()
  })

  it('braucht eine ID', async () => {
    expect(await kostenpostenAendern({ ...GUELTIG })).toEqual({ error: 'Posten nicht gefunden.' })
    expect(updateMany).not.toHaveBeenCalled()
  })
})

describe('kostenpostenBeenden', () => {
  it('setzt bis auf den letzten Monat, einschließlich', async () => {
    expect(await kostenpostenBeenden({ id: 'k1', monat: '2026-11' })).toEqual({ ok: true })
    const aufruf = updateMany.mock.calls[0]![0]! as {
      where: { id: string; ab: { lte: Date } }
      data: { bis: Date }
    }
    expect(aufruf.data.bis.toISOString()).toBe('2026-11-01T00:00:00.000Z')
    // Und die Bedingung: der Beginn darf nicht dahinter liegen.
    expect(aufruf.where.ab.lte.toISOString()).toBe('2026-11-01T00:00:00.000Z')
  })

  it('lehnt einen Monat vor dem Beginn ab, ohne zu schreiben', async () => {
    updateMany.mockResolvedValue({ count: 0 } as never)
    count.mockResolvedValue(1 as never)
    expect(await kostenpostenBeenden({ id: 'k1', monat: '2026-01' })).toEqual({
      error: 'Dieser Monat liegt vor dem Beginn des Postens. Wähle den Beginn oder einen späteren Monat.',
    })
  })

  it('verlangt einen gültigen Monat', async () => {
    expect(await kostenpostenBeenden({ id: 'k1', monat: 'September' })).toEqual({
      error: 'Bitte wähle einen Monat.',
    })
    expect(updateMany).not.toHaveBeenCalled()
  })
})

describe('kostenpostenLoeschen', () => {
  it('löscht den Posten', async () => {
    expect(await kostenpostenLoeschen({ id: 'k1' })).toEqual({ ok: true })
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'k1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/geld')
  })

  it('meldet einen Posten, den es nicht mehr gibt', async () => {
    deleteMany.mockResolvedValue({ count: 0 } as never)
    expect(await kostenpostenLoeschen({ id: 'weg' })).toEqual({
      error: 'Diesen Posten gibt es nicht mehr.',
    })
  })
})

describe('nach dem Monatsabschluss (Nr. 191): Kosten nur mit Grund', () => {
  const findUnique = vi.mocked(prisma.kostenposten.findUnique)
  const protokoll = vi.mocked(prisma.adminAktion.create)
  beforeEach(() => {
    geld.abgeschlossen = new Map([['2026-09', new Date('2026-10-03T07:00:00Z')]])
    findUnique.mockResolvedValue({ ab: new Date('2026-01-01T00:00:00Z'), bis: null } as never)
  })

  it('Anlegen ab einem abgeschlossenen Monat ohne Grund: Satz mit dem Monat, nichts geschrieben', async () => {
    expect(await kostenpostenAnlegen(GUELTIG)).toEqual({ error: 'September 2026 ist abgeschlossen. Schreib dazu, warum du die Kosten änderst.' })
    expect(create).not.toHaveBeenCalled()
  })

  it('mit Grund: geschrieben, und der Grund steht im Protokoll', async () => {
    expect(await kostenpostenAnlegen({ ...GUELTIG, grund: 'Rechnung kam spät' })).toEqual({ ok: true })
    expect(create).toHaveBeenCalledTimes(1)
    expect(protokoll.mock.calls[0]?.[0]).toMatchObject({ data: { art: 'kostenposten_angelegt', grund: 'Rechnung kam spät' } })
  })

  it('ein Grund mit E-Mail-Adresse wird abgelehnt — nichts geschrieben', async () => {
    const r = await kostenpostenAnlegen({ ...GUELTIG, grund: 'laut jemand@example.com' })
    expect(r).toEqual({ error: expect.stringContaining('ohne E-Mail-Adresse') })
    expect(create).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ab dem Monat danach braucht es keinen Grund', async () => {
    expect(await kostenpostenAnlegen({ ...GUELTIG, ab: '2026-10' })).toEqual({ ok: true })
  })

  it('Ändern, Beenden vor dem abgeschlossenen Monat und Löschen berühren ihn — ohne Grund nichts', async () => {
    expect(await kostenpostenAendern({ ...GUELTIG, id: 'k1', ab: '2026-10' })).toEqual({ error: expect.stringContaining('abgeschlossen') })
    expect(await kostenpostenBeenden({ id: 'k1', monat: '2026-08' })).toEqual({ error: expect.stringContaining('abgeschlossen') })
    expect(await kostenpostenLoeschen({ id: 'k1' })).toEqual({ error: expect.stringContaining('abgeschlossen') })
    expect(updateMany).not.toHaveBeenCalled()
    expect(deleteMany).not.toHaveBeenCalled()
  })

  it('Gegenprobe: Beenden NACH dem abgeschlossenen Monat lässt ihn, wie er war — kein Grund nötig', async () => {
    expect(await kostenpostenBeenden({ id: 'k1', monat: '2026-10' })).toEqual({ ok: true })
  })
})

describe('monatAbschliessen (Nr. 191)', () => {
  const protokoll = vi.mocked(prisma.adminAktion.create)
  const STAND = {
    umsatz: { cents: 0, anzahl: 0, bar: 0 },
    erstattungen: { cents: 0, anzahl: 0, offen: 0 },
    stripeGebuehrCents: 0,
    abweichungen: [],
    abweichungenGesamt: 0,
    lauf: null,
    abgeschlossenAm: null,
    abgleichNachMonatsende: true,
    csvGeladen: true,
  }
  beforeEach(() => {
    vi.mocked(prisma.kostenposten.findMany).mockResolvedValue([
      { betrag: '25.00', rhythmus: 'MONATLICH', ab: new Date('2026-01-01T00:00:00Z'), bis: null },
    ] as never)
    geld.monat.mockResolvedValue(STAND)
  })

  it('alles erledigt: Eintrag `monat_abgeschlossen` mit Bezug Monat', async () => {
    expect(await monatAbschliessen({ monat: '2026-09' })).toEqual({ ok: true })
    expect(protokoll.mock.calls[0]?.[0]).toMatchObject({ data: { art: 'monat_abgeschlossen', bezugArt: 'monat', bezugId: '2026-09', wer: 'user_admin' } })
  })

  it('gesperrt bei offenem Punkt — mit Grund, ohne Eintrag', async () => {
    geld.monat.mockResolvedValueOnce({ ...STAND, erstattungen: { cents: 0, anzahl: 1, offen: 1 } })
    expect(await monatAbschliessen({ monat: '2026-09' })).toEqual({ error: 'Geht erst, wenn alles erledigt ist: 1 Erstattung offen.' })
    geld.monat.mockResolvedValueOnce({ ...STAND, abgleichNachMonatsende: false })
    expect(await monatAbschliessen({ monat: '2026-09' })).toEqual({ error: expect.stringContaining('Abgleich ist nach dem Monatsende noch nicht gelaufen') })
    vi.mocked(prisma.kostenposten.findMany).mockResolvedValueOnce([] as never)
    expect(await monatAbschliessen({ monat: '2026-09' })).toEqual({ error: expect.stringContaining('noch keine Kosten eingetragen') })
    expect(protokoll).not.toHaveBeenCalled()
  })

  it('der laufende Monat, ein Unsinn-Monat und ein schon abgeschlossener: abgelehnt', async () => {
    const heute = new Date()
    const laufend = `${heute.getUTCFullYear()}-${String(heute.getUTCMonth() + 1).padStart(2, '0')}`
    expect(await monatAbschliessen({ monat: laufend })).toEqual({ error: 'Einen Monat kannst du erst nach seinem Ende abschließen.' })
    expect(await monatAbschliessen({ monat: '2026-13' })).toEqual({ error: 'Bitte wähle einen Monat.' })
    geld.abgeschlossen = new Map([['2026-09', new Date()]])
    expect(await monatAbschliessen({ monat: '2026-09' })).toEqual({ error: 'Dieser Monat ist schon abgeschlossen.' })
    expect(protokoll).not.toHaveBeenCalled()
  })

  it('ohne Admin-Recht wirkt nichts', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    expect(await monatAbschliessen({ monat: '2026-09' })).toEqual({ error: expect.any(String) })
    expect(protokoll).not.toHaveBeenCalled()
  })
})

/**
 * Tests für triageMeldungAction (src/server/actions/admin.ts, Sprint
 * fehlerbriefkasten Teil D) — am echten Code, Prisma/Auth gemockt.
 *
 * Beweist: ohne isAdmin (aus der DB, nicht aus der Session) wirkt nichts; ein
 * Duplikat-Verweis auf eine nicht existierende Meldung wird abgelehnt, ebenso
 * der Verweis auf sich selbst; ein gültiger Verweis per Kurznummer wird zur
 * vollen ID aufgelöst; gültige Triage schreibt alle Felder und triagedAt;
 * leere Felder werden null; ein unbekannter Status wird abgelehnt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendFreischaltungEmail: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    farm: { findUnique: vi.fn(), update: vi.fn() },
    meldung: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  },
}))

import { triageMeldungAction } from '@/server/actions/admin'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const getSession = vi.mocked(auth.api.getSession)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const meldungFindUnique = vi.mocked(prisma.meldung.findUnique)
const meldungFindFirst = vi.mocked(prisma.meldung.findFirst)
// Bedingtes Schreiben (Sprint Briefkasten-Rückkopplung): die Action nimmt updateMany.
const meldungUpdate = vi.mocked(prisma.meldung.updateMany)

const ID = 'cmfmeldung0000000001abc'
const ORIGINAL = 'cmforiginal000000002xyz'

const GUELTIG = {
  status: 'KEIN_FEHLER',
  clusterKey: '',
  triageNotiz: 'Bedienfehler — Speichern-Knopf übersehen',
  duplikatVonId: '',
  sprintName: '',
  antwortAnMelder: 'Die Zeiten werden erst nach „Speichern" übernommen.',
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'admin_1' } } as never)
  userFindUnique.mockResolvedValue({ isAdmin: true } as never)
  meldungFindUnique.mockResolvedValue({ id: ID } as never)
  meldungFindFirst.mockResolvedValue(null)
  meldungUpdate.mockResolvedValue({ count: 1 })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('triageMeldungAction — Zugriff', () => {
  it('ohne Session: abgelehnt, nichts geschrieben', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await triageMeldungAction(ID, GUELTIG)).toEqual({ error: 'Nicht angemeldet.' })
    expect(meldungUpdate).not.toHaveBeenCalled()
  })

  it('ohne isAdmin: abgelehnt, obwohl die Session gültig ist', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    expect(await triageMeldungAction(ID, GUELTIG)).toEqual({ error: 'Kein Zugriff.' })
    expect(meldungUpdate).not.toHaveBeenCalled()
  })

  it('das Recht kommt aus der Datenbank, nicht aus der Session', async () => {
    getSession.mockResolvedValue({ user: { id: 'user_1', isAdmin: true } } as never)
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    expect(await triageMeldungAction(ID, GUELTIG)).toEqual({ error: 'Kein Zugriff.' })
    expect(meldungUpdate).not.toHaveBeenCalled()
  })
})

describe('triageMeldungAction — Eingabe', () => {
  it('lehnt einen unbekannten Status ab', async () => {
    expect(await triageMeldungAction(ID, { ...GUELTIG, status: 'FERTIG' })).toEqual({ error: 'Unbekannter Status.' })
    expect(meldungUpdate).not.toHaveBeenCalled()
  })

  it('lehnt eine zu lange Antwort ab', async () => {
    const result = await triageMeldungAction(ID, { ...GUELTIG, antwortAnMelder: 'x'.repeat(501) })
    expect(result.error).toMatch(/Antwort/)
    expect(meldungUpdate).not.toHaveBeenCalled()
  })

  it('unbekannte Meldung: Fehler statt stillem Nichts', async () => {
    meldungFindUnique.mockResolvedValue(null)
    expect(await triageMeldungAction('cmfweg', GUELTIG)).toEqual({ error: 'Meldung nicht gefunden.' })
    expect(meldungUpdate).not.toHaveBeenCalled()
  })
})

describe('triageMeldungAction — Duplikat', () => {
  it('lehnt den Verweis auf eine nicht existierende Meldung ab', async () => {
    meldungFindFirst.mockResolvedValue(null)
    const result = await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: 'gibtsnix' })
    expect(result).toEqual({ error: 'Duplikat-Verweis: diese Meldung gibt es nicht.' })
    expect(meldungUpdate).not.toHaveBeenCalled()
  })

  it('lehnt den Verweis auf sich selbst ab', async () => {
    meldungFindFirst.mockResolvedValue({ id: ID } as never)
    const result = await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: ID.slice(0, 8) })
    expect(result).toEqual({ error: 'Eine Meldung kann nicht ihr eigenes Duplikat sein.' })
    expect(meldungUpdate).not.toHaveBeenCalled()
  })

  it('löst eine Kurznummer als Präfix auf und speichert die volle ID', async () => {
    meldungFindFirst.mockResolvedValue({ id: ORIGINAL } as never)
    const result = await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: ORIGINAL.slice(0, 8) })
    expect(result).toEqual({})
    expect(meldungFindFirst.mock.calls[0][0]?.where).toEqual({ id: { startsWith: ORIGINAL.slice(0, 8) } })
    expect(meldungUpdate.mock.calls[0][0].data).toMatchObject({ status: 'DUPLIKAT', duplikatVonId: ORIGINAL })
  })

  it('sucht eine volle ID exakt', async () => {
    meldungFindFirst.mockResolvedValue({ id: ORIGINAL } as never)
    await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: ORIGINAL })
    expect(meldungFindFirst.mock.calls[0][0]?.where).toEqual({ id: ORIGINAL })
  })
})

describe('triageMeldungAction — Schreiben', () => {
  it('schreibt Status, Notiz, Antwort und triagedAt; leere Felder werden null', async () => {
    const vorher = Date.now()
    expect(await triageMeldungAction(ID, GUELTIG)).toEqual({})
    expect(meldungUpdate).toHaveBeenCalledTimes(1)
    const { where, data } = meldungUpdate.mock.calls[0][0]
    expect(where).toEqual({ id: ID })
    expect(data).toMatchObject({
      status: 'KEIN_FEHLER',
      clusterKey: null,
      triageNotiz: GUELTIG.triageNotiz,
      duplikatVonId: null,
      sprintName: null,
      antwortAnMelder: GUELTIG.antwortAnMelder,
    })
    expect(data.triagedAt).toBeInstanceOf(Date)
    expect((data.triagedAt as Date).getTime()).toBeGreaterThanOrEqual(vorher)
  })

  it('rührt Text, Art und Kontext der Meldung nicht an, solange keine Art geschickt wird', async () => {
    await triageMeldungAction(ID, GUELTIG)
    const data = meldungUpdate.mock.calls[0][0].data
    for (const feld of ['text', 'art', 'seiteUrl', 'userAgent', 'viewport', 'farmId', 'customerEmail', 'screenshotUrl']) {
      expect(data).not.toHaveProperty(feld)
    }
  })

  it('kürzt Leerraum und speichert den Cluster-Schlüssel', async () => {
    await triageMeldungAction(ID, { ...GUELTIG, status: 'GEPLANT', clusterKey: '  abholzeiten  ', sprintName: 'abholzeiten-v2' })
    expect(meldungUpdate.mock.calls[0][0].data).toMatchObject({
      status: 'GEPLANT',
      clusterKey: 'abholzeiten',
      sprintName: 'abholzeiten-v2',
    })
  })
})

describe('triageMeldungAction — Knöpfe zum KI-Vorschlag (Sprint Briefkasten-Rückkopplung)', () => {
  const VORSCHLAG = {
    status: 'VERMUTLICH_WUNSCH',
    clusterKey: '',
    triageNotiz: 'Telefonat: nur am Handy.\n[KI] Wünscht Sortierung nach Preis.\n[Auto · KI · 24.09.2026 · Vermutlich Wunsch]',
    duplikatVonId: '',
    sprintName: '',
    antwortAnMelder: '',
  }

  it('„Ja, ein Wunsch": setzt Art WUNSCH und Status GEPRUEFT', async () => {
    expect(await triageMeldungAction(ID, { ...VORSCHLAG, status: 'GEPRUEFT', art: 'WUNSCH' })).toEqual({})
    expect(meldungUpdate.mock.calls[0][0].data).toMatchObject({ status: 'GEPRUEFT', art: 'WUNSCH' })
  })

  it('„Nein, ein Fehler": Status GEPRUEFT, die Zeile der KI ist weg, die übrige Notiz bleibt', async () => {
    const { ohneKiNotiz } = await import('@/lib/meldung')
    await triageMeldungAction(ID, { ...VORSCHLAG, status: 'GEPRUEFT', triageNotiz: ohneKiNotiz(VORSCHLAG.triageNotiz) ?? '' })
    const data = meldungUpdate.mock.calls[0][0].data
    expect(data).toMatchObject({ status: 'GEPRUEFT', triageNotiz: 'Telefonat: nur am Handy.\n[Auto · KI · 24.09.2026 · Vermutlich Wunsch]' })
    expect(data).not.toHaveProperty('art')
  })

  it('eine unbekannte Art wird abgelehnt', async () => {
    expect(await triageMeldungAction(ID, { ...VORSCHLAG, status: 'GEPRUEFT', art: 'BEFEHL' })).toEqual({ error: 'Unbekannte Art.' })
    expect(meldungUpdate).not.toHaveBeenCalled()
  })
})

describe('triageMeldungAction — zweiter Schreiber (Schreibroute)', () => {
  it('schreibt nur auf den Stand, den das Formular kannte', async () => {
    await triageMeldungAction(ID, { ...GUELTIG, vorherStatus: 'NEU', vorherNotiz: null })
    expect(meldungUpdate.mock.calls[0][0].where).toEqual({ id: ID, status: 'NEU', triageNotiz: null })
  })

  it('hat die Schreibroute inzwischen geschrieben: Fehler mit Ausweg, nichts zurückgedreht', async () => {
    meldungUpdate.mockResolvedValue({ count: 0 })
    const result = await triageMeldungAction(ID, { ...GUELTIG, vorherStatus: 'NEU', vorherNotiz: null })
    expect(result).toEqual({ error: 'Die Meldung hat sich inzwischen geändert — lade die Seite neu und entscheide noch einmal.' })
  })

  it('ein unbekannter Ausgangsstatus wird abgelehnt', async () => {
    expect((await triageMeldungAction(ID, { ...GUELTIG, vorherStatus: 'IRGENDWAS' })).error).toBeDefined()
    expect(meldungUpdate).not.toHaveBeenCalled()
  })
})

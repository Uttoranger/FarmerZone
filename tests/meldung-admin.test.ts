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
vi.mock('@/lib/prisma', async () => ({
  prisma: {
    // Die Wache liest seit Nr. 115 die Pflicht „erst Passkey“ (tests/admin-sitzung.ts).
    ...(await import('./admin-sitzung')).passkeyAttrappen(),
    user: { findUnique: vi.fn() },
    farm: { findUnique: vi.fn(), update: vi.fn() },
    meldung: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    // Mit Verweis schreibt EINE SQL-Anweisung samt Bedingung an die Hauptmeldung (Nr. 105).
    $executeRaw: vi.fn(),
  },
}))

import { Prisma } from '@prisma/client'
import { triageMeldungAction } from '@/server/actions/admin'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { adminSitzung } from './admin-sitzung'
import { KURZNUMMER_MEHRDEUTIG, kurznummerAus } from '@/lib/kurznummer'

const getSession = vi.mocked(auth.api.getSession)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const meldungFindUnique = vi.mocked(prisma.meldung.findUnique)
// Der Duplikat-Verweis sucht seit Nr. 263 alle Kandidaten und entscheidet nach DER Regel (kurznummer.ts).
const meldungFindMany = vi.mocked(prisma.meldung.findMany)
// Bedingtes Schreiben (Sprint Briefkasten-Rückkopplung): die Action nimmt updateMany.
const meldungUpdate = vi.mocked(prisma.meldung.updateMany)
const executeRaw = vi.mocked(prisma.$executeRaw)

/** Die Anweisung des letzten SQL-Aufrufs, wie Prisma sie zusammensetzt — Text und Werte. */
function letzteAnweisung(): { text: string; werte: unknown[] } {
  const [teile, ...werte] = executeRaw.mock.calls.at(-1) as unknown as [TemplateStringsArray, ...unknown[]]
  const anweisung = Prisma.sql(teile, ...werte)
  return { text: anweisung.text, werte: anweisung.values }
}

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
  getSession.mockResolvedValue(adminSitzung('admin_1') as never)
  userFindUnique.mockResolvedValue({ isAdmin: true, adminInhaber: true } as never)
  meldungFindUnique.mockResolvedValue({ id: ID } as never)
  meldungFindMany.mockResolvedValue([])
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
    getSession.mockResolvedValue(adminSitzung('user_1', { isAdmin: true }) as never)
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
    meldungFindMany.mockResolvedValue([])
    const result = await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: 'gibtsnix' })
    expect(result).toEqual({ error: 'Duplikat-Verweis: diese Meldung gibt es nicht.' })
    expect(meldungUpdate).not.toHaveBeenCalled()
  })

  it('lehnt den Verweis auf sich selbst ab', async () => {
    meldungFindMany.mockResolvedValue([{ id: ID, status: 'NEU' }] as never)
    const result = await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: kurznummerAus(ID) })
    expect(result).toEqual({ error: 'Eine Meldung kann nicht ihr eigenes Duplikat sein.' })
    expect(meldungUpdate).not.toHaveBeenCalled()
  })

  it('löst die Kurznummer (Ende, groß) auf und speichert die volle ID', async () => {
    meldungFindMany.mockResolvedValue([{ id: ORIGINAL, status: 'GEPRUEFT' }] as never)
    executeRaw.mockResolvedValue(1)
    const result = await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: kurznummerAus(ORIGINAL) })
    expect(result).toEqual({})
    expect(meldungFindMany.mock.calls[0][0]?.where).toEqual({
      OR: [{ id: '002XYZ' }, { id: '002xyz' }, { id: { endsWith: '002xyz', mode: 'insensitive' } }],
    })
    const { werte } = letzteAnweisung()
    expect(werte).toContain('DUPLIKAT')
    expect(werte.filter((w) => w === ORIGINAL)).toHaveLength(2)
    expect(meldungUpdate).not.toHaveBeenCalled()
  })

  it('findet auch die alte Kurznummer (Anfang, acht Zeichen, klein oder groß)', async () => {
    meldungFindMany.mockResolvedValue([{ id: ORIGINAL, status: 'GEPRUEFT' }] as never)
    executeRaw.mockResolvedValue(1)
    expect(await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: ORIGINAL.slice(0, 8) })).toEqual({})
    expect(await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: ORIGINAL.slice(0, 8).toUpperCase() })).toEqual({})
    expect(meldungFindMany.mock.calls[0][0]?.where).toEqual({
      OR: [{ id: 'cmforigi' }, { id: 'cmforigi' }, { id: { startsWith: 'cmforigi', mode: 'insensitive' } }],
    })
    expect(executeRaw).toHaveBeenCalledTimes(2)
  })

  it('sucht eine volle ID exakt', async () => {
    meldungFindMany.mockResolvedValue([{ id: ORIGINAL, status: 'GEPRUEFT' }] as never)
    executeRaw.mockResolvedValue(1)
    expect(await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: ORIGINAL })).toEqual({})
    expect(meldungFindMany.mock.calls[0][0]?.where).toEqual({ OR: [{ id: ORIGINAL }, { id: ORIGINAL }] })
  })

  it('passt die Nummer zu mehreren Meldungen: Fehler mit Ausweg, kein Verweis auf eine beliebige', async () => {
    const zwilling = 'cmfanderer00000000002xyz'
    meldungFindMany.mockResolvedValue([
      { id: ORIGINAL, status: 'GEPRUEFT' },
      { id: zwilling, status: 'GEPRUEFT' },
    ] as never)
    const result = await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: '002XYZ' })
    expect(result).toEqual({ error: KURZNUMMER_MEHRDEUTIG })
    expect(result.error).toBe('Diese Kurznummer passt zu mehreren Meldungen – gib die volle Nummer ein.')
    expect(executeRaw).not.toHaveBeenCalled()
    expect(meldungUpdate).not.toHaveBeenCalled()
    // Der Ausweg: Die volle Nummer findet genau eine.
    executeRaw.mockResolvedValue(1)
    expect(await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: zwilling })).toEqual({})
    expect(letzteAnweisung().werte).toContain(zwilling)
  })

  it('ein Stück der Nummer unter sechs Zeichen trifft nichts — auch wenn die Datenbank etwas liefert', async () => {
    meldungFindMany.mockResolvedValue([{ id: ORIGINAL, status: 'GEPRUEFT' }] as never)
    for (const stueck of ['2xyz', '02xyz', 'cmfor', 'c']) {
      const result = await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: stueck })
      expect(result).toEqual({ error: 'Duplikat-Verweis: diese Meldung gibt es nicht.' })
    }
    expect(executeRaw).not.toHaveBeenCalled()
  })

  it('keine Kette: Ist die Hauptmeldung selbst ein Duplikat, wird nichts geschrieben', async () => {
    meldungFindMany.mockResolvedValue([{ id: ORIGINAL, status: 'DUPLIKAT' }] as never)
    const result = await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: ORIGINAL })
    expect(result).toEqual({ error: 'Diese Meldung ist selbst ein Duplikat – nimm ihre Hauptmeldung.' })
    expect(executeRaw).not.toHaveBeenCalled()
    expect(meldungUpdate).not.toHaveBeenCalled()
  })

  it('keine Kette beim Schreiben: wird die Hauptmeldung dazwischen Duplikat, trifft die Anweisung nichts — Satz mit Ausweg', async () => {
    meldungFindMany.mockResolvedValue([{ id: ORIGINAL, status: 'GEPRUEFT' }] as never)
    executeRaw.mockResolvedValue(0)
    const result = await triageMeldungAction(ID, { ...GUELTIG, status: 'DUPLIKAT', duplikatVonId: ORIGINAL })
    expect(result).toEqual({ error: 'Die Meldung oder ihre Hauptmeldung hat sich inzwischen geändert — lade die Seite neu und entscheide noch einmal.' })
    // Die Bedingung steht in derselben Anweisung wie das Schreiben (Zustand prüft tests/integration/meldungen-ablauf.int.test.ts).
    expect(letzteAnweisung().text).toMatch(/UPDATE "Meldung"[\s\S]*WHERE[\s\S]*EXISTS \(SELECT 1 FROM "Meldung" h WHERE h\."id" = \$\d+ AND h\."status" <> 'DUPLIKAT'\)/)
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

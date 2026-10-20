/**
 * Admin › Startseite (Register N16, Nr. 96; Entwurf und Fassung seit Nr. 99) —
 * die Actions aus src/server/actions/startseite.ts mit gemockter Datenbank und
 * Sitzung.
 *
 * Beweist:
 *  - Nur der Admin (frisch aus der Datenbank): ein Hof oder niemand bekommt
 *    einen Satz, und es wird nichts gelesen oder geschrieben.
 *  - Der Server prüft die festen Abschnitte selbst: Kopf verschoben, Höfe
 *    ausgeblendet, Fuß nicht unten — Satz, keine Schreibung.
 *  - Die Reihenfolge muss genau die Zeilen der Datenbank tragen (fehlend,
 *    doppelt, fremd → „inzwischen geändert").
 *  - Höfe nur freigeschaltete; ein Bild nur aus dem eigenen Startseiten-Ordner
 *    (oder das schon gespeicherte unverändert).
 *  - Ein gültiges Speichern schreibt Block und Positionen in EINER Transaktion;
 *    die Felder anderer Vorlagen fallen weg.
 *  - WACHE „kein Live-Effekt“ (Nr. 99): Entwurf speichern, Block löschen und
 *    Übernehmen rufen nie revalidatePath('/') und nie den Live-Tag — die
 *    Gegenprobe ist „Veröffentlichen … jetzt“, das beides ruft.
 *  - Veröffentlichen: nur der Admin; ein Termin in der Vergangenheit, mehr als
 *    365 Tage voraus oder in der Sommerzeit-Lücke wird abgewiesen, ohne zu
 *    schreiben; die Fassung entsteht in EINER Transaktion aus dem Entwurf, mit
 *    dem Admin aus der Sitzung und dem Termin in UTC.
 *  - Zurückziehen nur, solange die Zeit nicht erreicht ist (Bedingung in der
 *    WHERE-Klausel); eine laufende Fassung wird abgewiesen.
 *  - Der Vorschau-Link schaltet den Draft Mode nur für den Admin ein; „Vorschau
 *    öffnen" führt über die Route, die ihn auf jedem Gerät einschaltet;
 *    zurück auf „Bearbeiten" schaltet ihn wieder aus.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ draftEnable: vi.fn(), draftDisable: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
  draftMode: vi.fn(async () => ({ isEnabled: false, enable: h.draftEnable, disable: h.draftDisable })),
}))
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', async () => {
  const tx = {
    startseiteAbschnitt: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    startseiteBlock: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    startseiteFassung: { create: vi.fn() },
  }
  return {
    prisma: {
      // Die Wache liest seit Nr. 115 die Pflicht „erst Passkey“ (tests/admin-sitzung.ts).
      ...(await import('./admin-sitzung')).passkeyAttrappen(),
      user: { findUnique: vi.fn(), findMany: vi.fn() },
      farm: { count: vi.fn(), findMany: vi.fn() },
      startseiteAbschnitt: { findMany: vi.fn() },
      startseiteBlock: { deleteMany: vi.fn(), findMany: vi.fn() },
      startseiteFassung: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      __tx: tx,
    },
  }
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { revalidatePath, updateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  ADMIN_STARTSEITE_HREF,
  ADMIN_STARTSEITE_VORSCHAU_HREF,
  REIHENFOLGE_FEHLER_TEXT,
  STANDARD_REIHENFOLGE,
  STARTSEITE_CACHE_TAG,
  NEUER_BLOCK,
  standText,
} from '@/lib/startseite-gestalten'
import {
  beendeStartseitenVorschau,
  erzeugeStartseitenVorschau,
  loescheStartseitenBlock,
  speichereEntwurf,
  uebernehmeFassungAlsEntwurf,
  veroeffentlicheStartseite,
  zieheFassungZurueck,
} from '@/server/actions/startseite'
import type { StartseitenBlockEingabe } from '@/schemas/startseite'
import { adminSitzung } from './admin-sitzung'

type Fn = ReturnType<typeof vi.fn>
type TxMock = {
  startseiteAbschnitt: { findMany: Fn; update: Fn; create: Fn }
  startseiteBlock: { create: Fn; update: Fn; deleteMany: Fn; findMany: Fn }
  startseiteFassung: { create: Fn }
}
const tx = (prisma as unknown as { __tx: TxMock }).__tx

const ZEILEN = STANDARD_REIHENFOLGE.map((art) => ({ id: `z-${art.toLowerCase()}`, art, sichtbar: true, blockId: null, block: null }))
const reihenfolge = () => ZEILEN.map((z) => ({ id: z.id, sichtbar: true }))
const SPEICHER = 'meinspeicher'
const EIGENES_BILD = `https://${SPEICHER}.public.blob.vercel-storage.com/startseite/bilder/1-abc.webp`

function block(teil: Partial<StartseitenBlockEingabe> = {}): StartseitenBlockEingabe {
  return {
    vorlage: 'SAISONKARTE',
    ueberzeile: 'Erntezeit',
    titel: 'Kürbis und Most',
    text: 'Frisch vom Feld.',
    bildUrl: null,
    linkUrl: '/hoefe',
    linkText: 'Zu den Höfen',
    farmIds: [],
    kategorie: null,
    liveAbTag: '2026-10-01',
    liveAbUhrzeit: '06:00',
    liveBisTag: null,
    liveBisUhrzeit: null,
    ...teil,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', `vercel_blob_rw_${SPEICHER}_geheim`)
  vi.mocked(auth.api.getSession).mockResolvedValue(adminSitzung('admin-1') as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: true } as never)
  tx.startseiteAbschnitt.findMany.mockResolvedValue(ZEILEN)
  tx.startseiteBlock.create.mockResolvedValue({ id: 'block-neu' })
  tx.startseiteAbschnitt.create.mockResolvedValue({ id: 'zeile-neu' })
  tx.startseiteBlock.findMany.mockResolvedValue([])
  tx.startseiteFassung.create.mockResolvedValue({ id: 'fassung-neu' })
})

function nichtsGeschrieben(): void {
  expect(tx.startseiteAbschnitt.update).not.toHaveBeenCalled()
  expect(tx.startseiteAbschnitt.create).not.toHaveBeenCalled()
  expect(tx.startseiteBlock.create).not.toHaveBeenCalled()
  expect(tx.startseiteBlock.update).not.toHaveBeenCalled()
  expect(updateTag).not.toHaveBeenCalled()
}

describe('nur der Admin', () => {
  it('lehnt einen Hof ab, ohne zu lesen oder zu schreiben', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: false } as never)
    expect(await speichereEntwurf({ reihenfolge: reihenfolge(), block: null })).toEqual({ error: 'Kein Zugriff.' })
    expect(await loescheStartseitenBlock({ blockId: 'b1' })).toEqual({ error: 'Kein Zugriff.' })
    expect(await erzeugeStartseitenVorschau({ stand: 'heute', quelle: 'entwurf', blockEntwurfId: null })).toEqual({ error: 'Kein Zugriff.' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.startseiteBlock.deleteMany).not.toHaveBeenCalled()
    expect(h.draftEnable).not.toHaveBeenCalled()
  })

  it('lehnt ohne Sitzung ab', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    expect(await speichereEntwurf({ reihenfolge: reihenfolge(), block: null })).toEqual({ error: 'Nicht angemeldet.' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

describe('feste Abschnitte prüft der Server', () => {
  it('lässt den Kopf nicht verschieben', async () => {
    const liste = reihenfolge()
    ;[liste[0], liste[1]] = [liste[1], liste[0]]
    expect(await speichereEntwurf({ reihenfolge: liste, block: null })).toEqual({ error: REIHENFOLGE_FEHLER_TEXT['kopf-nicht-oben'] })
    nichtsGeschrieben()
  })

  it('lässt „Höfe in deiner Nähe" nicht ausblenden', async () => {
    const liste = reihenfolge().map((r) => (r.id === 'z-hoefe' ? { ...r, sichtbar: false } : r))
    expect(await speichereEntwurf({ reihenfolge: liste, block: null })).toEqual({ error: REIHENFOLGE_FEHLER_TEXT['fest-ausgeblendet'] })
    nichtsGeschrieben()
  })

  it('lässt keinen neuen Block unter den Fuß', async () => {
    const liste = [...reihenfolge(), { id: NEUER_BLOCK, sichtbar: true }]
    expect(await speichereEntwurf({ reihenfolge: liste, block: block() })).toEqual({ error: REIHENFOLGE_FEHLER_TEXT['fuss-nicht-unten'] })
    nichtsGeschrieben()
  })

  it('verlangt genau die Zeilen der Datenbank', async () => {
    const satz = { error: 'Die Startseite wurde inzwischen geändert. Lade die Seite neu und versuch es noch einmal.' }
    expect(await speichereEntwurf({ reihenfolge: reihenfolge().slice(0, -1), block: null })).toEqual(satz)
    expect(await speichereEntwurf({ reihenfolge: [...reihenfolge().slice(0, -1), { id: 'fremd', sichtbar: true }], block: null })).toEqual(satz)
    expect(await speichereEntwurf({ reihenfolge: [reihenfolge()[0], ...reihenfolge()], block: null })).toEqual(satz)
    nichtsGeschrieben()
  })
})

describe('Höfe und Bild', () => {
  it('nimmt nur freigeschaltete Höfe', async () => {
    vi.mocked(prisma.farm.count).mockResolvedValue(1 as never)
    const liste = [reihenfolge()[0], { id: NEUER_BLOCK, sichtbar: true }, ...reihenfolge().slice(1)]
    const ergebnis = await speichereEntwurf({ reihenfolge: liste, block: block({ vorlage: 'HOEFE_AUSWAHL', farmIds: ['f1', 'f-gesperrt'] }) })
    expect(ergebnis).toEqual({ error: 'Wähle nur freigeschaltete Höfe.' })
    const frage = vi.mocked(prisma.farm.count).mock.calls[0]?.[0] as { where: { approvedAt: unknown; isActive: unknown; archivedAt: unknown } }
    expect(frage.where).toMatchObject({ approvedAt: { not: null }, isActive: true, archivedAt: null })
    nichtsGeschrieben()
  })

  it('nimmt ein Bild nur aus dem eigenen Startseiten-Ordner', async () => {
    const liste = [reihenfolge()[0], { id: NEUER_BLOCK, sichtbar: true }, ...reihenfolge().slice(1)]
    for (const fremd of [
      'https://fremd.example/bild.webp',
      `https://${SPEICHER}.public.blob.vercel-storage.com/farms/hof-1/product/1.webp`,
      'https://anderer.public.blob.vercel-storage.com/startseite/bilder/1.webp',
    ]) {
      expect(await speichereEntwurf({ reihenfolge: liste, block: block({ bildUrl: fremd }) }), fremd).toEqual({
        error: 'Dieses Bild konnten wir nicht übernehmen. Bitte lade es noch einmal hoch.',
      })
    }
    nichtsGeschrieben()
    expect(await speichereEntwurf({ reihenfolge: liste, block: block({ bildUrl: EIGENES_BILD }) })).toMatchObject({ ok: true, blockId: 'block-neu' })
  })
})

describe('gültig speichern', () => {
  it('legt den neuen Block an seiner Stelle an und schreibt alle Positionen in EINER Transaktion', async () => {
    const liste = [reihenfolge()[0], { id: NEUER_BLOCK, sichtbar: true }, ...reihenfolge().slice(1)]
    liste[4] = { ...liste[4], sichtbar: false } // BRENNMATERIAL aus

    expect(await speichereEntwurf({ reihenfolge: liste, block: block() })).toMatchObject({ ok: true, blockId: 'block-neu', zeilenId: 'zeile-neu' })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    const daten = tx.startseiteBlock.create.mock.calls[0]?.[0].data
    expect(daten).toMatchObject({
      vorlage: 'SAISONKARTE',
      titel: 'Kürbis und Most',
      linkUrl: '/hoefe',
      liveAb: new Date('2026-10-01T04:00:00.000Z'),
      liveBis: null,
      erstelltVonUserId: 'admin-1',
      farmIds: [],
      kategorie: null,
    })
    expect(tx.startseiteAbschnitt.create).toHaveBeenCalledWith({ data: { art: 'BLOCK', position: 1, sichtbar: true, blockId: 'block-neu' }, select: { id: true } })
    const positionen = tx.startseiteAbschnitt.update.mock.calls.map((c) => [c[0].where.id, c[0].data.position, c[0].data.sichtbar])
    expect(positionen).toEqual(liste.flatMap((r, i) => (r.id === NEUER_BLOCK ? [] : [[r.id, i, r.sichtbar]])))
  })

  it('lässt beim Wechsel der Vorlage keine unsichtbaren Reste stehen', async () => {
    const liste = [reihenfolge()[0], { id: NEUER_BLOCK, sichtbar: true }, ...reihenfolge().slice(1)]
    await speichereEntwurf({ reihenfolge: liste, block: block({ vorlage: 'HINWEISBAND', bildUrl: EIGENES_BILD, kategorie: 'EIER' }) })
    expect(tx.startseiteBlock.create.mock.calls[0]?.[0].data).toMatchObject({ ueberzeile: null, text: null, bildUrl: null, kategorie: null, farmIds: [] })
  })

  it('ändert einen bestehenden Block nur, wenn er in der Liste steht', async () => {
    tx.startseiteAbschnitt.findMany.mockResolvedValue([...ZEILEN.slice(0, 2), { id: 'z-block', art: 'BLOCK', blockId: 'b1', block: { bildUrl: null } }, ...ZEILEN.slice(2)])
    const liste = [...reihenfolge().slice(0, 2), { id: 'z-block', sichtbar: true }, ...reihenfolge().slice(2)]
    expect(await speichereEntwurf({ reihenfolge: liste, block: block({ id: 'b1' }) })).toMatchObject({ ok: true, blockId: 'b1', zeilenId: null })
    expect(tx.startseiteBlock.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'b1' } }))
    vi.clearAllMocks()
    expect(await speichereEntwurf({ reihenfolge: liste, block: block({ id: 'fremder-block' }) })).toEqual({
      error: 'Die Startseite wurde inzwischen geändert. Lade die Seite neu und versuch es noch einmal.',
    })
    expect(tx.startseiteBlock.update).not.toHaveBeenCalled()
  })

  it('gibt bei falschen Feldern einen eigenen Satz zurück, nie Zods Text', async () => {
    const liste = [reihenfolge()[0], { id: NEUER_BLOCK, sichtbar: true }, ...reihenfolge().slice(1)]
    expect(await speichereEntwurf({ reihenfolge: liste, block: block({ linkUrl: '//fremd.example' }) })).toEqual({
      error: 'Das Link-Ziel beginnt mit „/“, etwa /hoefe – Adressen anderer Seiten gehen nicht.',
    })
    expect(await speichereEntwurf({ reihenfolge: 'Unsinn', block: null })).toEqual({ error: 'Bitte prüf die Angaben und speichere noch einmal.' })
    nichtsGeschrieben()
  })
})

describe('Vorschau-Link', () => {
  it('schaltet für den Admin den Draft Mode ein und gibt einen signierten Pfad', async () => {
    const ergebnis = await erzeugeStartseitenVorschau({ stand: 'heute', quelle: 'entwurf', blockEntwurfId: 'b1' })
    expect(h.draftEnable).toHaveBeenCalledTimes(1)
    expect(ergebnis).toMatchObject({ ok: true })
    expect('pfad' in ergebnis && ergebnis.pfad).toMatch(/^\/\?vorschau=[A-Za-z0-9_-]+&sig=[a-f0-9]{64}$/)
  })

  it('führt „Vorschau öffnen" über die Route, die den Draft Mode auf jedem Gerät einschaltet — mit demselben Link', async () => {
    const ergebnis = await erzeugeStartseitenVorschau({ stand: 'heute', quelle: 'entwurf', blockEntwurfId: 'b1' })
    if (!('link' in ergebnis)) throw new Error('kein Link')
    expect(ergebnis.link.startsWith(`${ADMIN_STARTSEITE_VORSCHAU_HREF}?`)).toBe(true)
    expect(ergebnis.link.slice(ADMIN_STARTSEITE_VORSCHAU_HREF.length)).toBe(ergebnis.pfad.slice(1))
  })

  it('schaltet den Draft Mode beim Zurückschalten auf „Bearbeiten" wieder aus', async () => {
    expect(await beendeStartseitenVorschau()).toEqual({ ok: true })
    expect(h.draftDisable).toHaveBeenCalledTimes(1)
  })

  it('sagt ohne geplanten Block, dass keiner kommt — ohne Draft Mode', async () => {
    vi.mocked(prisma.startseiteAbschnitt.findMany).mockResolvedValue(ZEILEN as never)
    expect(await erzeugeStartseitenVorschau({ stand: 'block', quelle: 'entwurf', blockEntwurfId: null })).toEqual({ error: 'Es ist gerade kein Block geplant.' })
    expect(h.draftEnable).not.toHaveBeenCalled()
  })

  it('sagt ohne Planung, dass nichts geplant ist — und nimmt sonst den Termin der nächsten Fassung', async () => {
    vi.mocked(prisma.startseiteFassung.findFirst).mockResolvedValue(null as never)
    expect(await erzeugeStartseitenVorschau({ stand: 'termin', quelle: 'live', blockEntwurfId: null })).toEqual({ error: 'Es ist gerade nichts geplant.' })
    expect(h.draftEnable).not.toHaveBeenCalled()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T18:44:00.000Z'))
    try {
      const termin = new Date('2026-10-16T18:44:00.000Z')
      vi.mocked(prisma.startseiteFassung.findFirst).mockResolvedValue({ liveAb: termin } as never)
      expect(await erzeugeStartseitenVorschau({ stand: 'termin', quelle: 'live', blockEntwurfId: null })).toMatchObject({ ok: true, stand: standText(termin) })
    } finally {
      vi.useRealTimers()
    }
  })

  it('weist eine unbekannte Quelle ab, ohne den Draft Mode einzuschalten', async () => {
    expect(await erzeugeStartseitenVorschau({ stand: 'heute', quelle: 'fassung:../x', blockEntwurfId: null })).toEqual({
      error: 'Bitte prüf die Angaben und speichere noch einmal.',
    })
    expect(h.draftEnable).not.toHaveBeenCalled()
  })
})

describe('Wache: kein Live-Effekt ohne Veröffentlichen', () => {
  const liste = () => [reihenfolge()[0], { id: NEUER_BLOCK, sichtbar: true }, ...reihenfolge().slice(1)]

  function keinLiveEffekt(): void {
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).not.toContain('/')
    expect(vi.mocked(updateTag).mock.calls.map((c) => c[0])).not.toContain(STARTSEITE_CACHE_TAG)
  }

  it('Entwurf speichern erneuert nur Admin › Startseite', async () => {
    expect(await speichereEntwurf({ reihenfolge: liste(), block: block() })).toMatchObject({ ok: true })
    keinLiveEffekt()
    expect(revalidatePath).toHaveBeenCalledWith(ADMIN_STARTSEITE_HREF)
  })

  it('Block löschen erneuert nur Admin › Startseite', async () => {
    vi.mocked(prisma.startseiteBlock.deleteMany).mockResolvedValue({ count: 1 } as never)
    expect(await loescheStartseitenBlock({ blockId: 'b1' })).toEqual({ ok: true })
    keinLiveEffekt()
    expect(revalidatePath).toHaveBeenCalledWith(ADMIN_STARTSEITE_HREF)
  })

  it('Als Entwurf übernehmen erneuert nur Admin › Startseite', async () => {
    tx.startseiteBlock.deleteMany.mockResolvedValue({ count: 0 })
    vi.mocked(prisma.startseiteAbschnitt.findMany).mockResolvedValue(ZEILEN as never)
    expect(await uebernehmeFassungAlsEntwurf({ id: null })).toMatchObject({ ok: true })
    keinLiveEffekt()
  })

  it('Gegenprobe: „Veröffentlichen … jetzt“ leert den Live-Tag und baut die Startseite neu', async () => {
    tx.startseiteAbschnitt.findMany.mockResolvedValue(ZEILEN)
    expect(await veroeffentlicheStartseite({ wann: 'jetzt' })).toMatchObject({ ok: true, text: 'Veröffentlicht – in wenigen Minuten überall' })
    expect(updateTag).toHaveBeenCalledWith(STARTSEITE_CACHE_TAG)
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('löscht nie eine Bilddatei — ein Bild kann noch in einer Fassung stehen', () => {
    const quelle = readFileSync(join(process.cwd(), 'src/server/actions/startseite.ts'), 'utf8')
    expect(quelle).not.toMatch(/@vercel\/blob/)
    expect(quelle).toMatch(/blobSpeicherAusSchluessel/) // Gegenprobe: die Datei ist die richtige
  })
})

describe('veroeffentlicheStartseite', () => {
  beforeEach(() => tx.startseiteAbschnitt.findMany.mockResolvedValue(ZEILEN))

  it('schreibt ohne Admin nichts', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: false } as never)
    expect(await veroeffentlicheStartseite({ wann: 'jetzt' })).toEqual({ error: 'Kein Zugriff.' })
    expect(await zieheFassungZurueck({ id: 'f1' })).toEqual({ error: 'Kein Zugriff.' })
    expect(await uebernehmeFassungAlsEntwurf({ id: 'f1' })).toEqual({ error: 'Kein Zugriff.' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.startseiteFassung.updateMany).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('schreibt die Fassung aus dem Entwurf in EINER Transaktion, mit dem Admin aus der Sitzung', async () => {
    const jetzt = new Date('2026-10-15T18:44:00.000Z')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(jetzt)
    try {
      expect(await veroeffentlicheStartseite({ wann: 'jetzt' })).toMatchObject({ ok: true, id: 'fassung-neu' })
    } finally {
      vi.useRealTimers()
    }
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    const daten = tx.startseiteFassung.create.mock.calls[0]?.[0].data
    expect(daten.erstelltVonUserId).toBe('admin-1')
    expect(daten.inhalt).toEqual({ v: 1, zeilen: STANDARD_REIHENFOLGE.map((art) => ({ art, sichtbar: true })) })
    expect(daten.liveAb).toEqual(jetzt)
  })

  it('plant zu Tag und Uhrzeit in Wiener Zeit — ohne die Startseite neu zu bauen', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T18:44:00.000Z'))
    try {
      expect(await veroeffentlicheStartseite({ wann: 'termin', datum: '2026-10-17', uhrzeit: '09:00' })).toMatchObject({
        ok: true,
        liveAb: '2026-10-17T07:00:00.000Z',
        // Der 17.10.2026 ist ein Samstag (das Mockup schreibt „Fr“); formatTagKurz setzt ein geschütztes Leerzeichen.
        text: expect.stringMatching(/^Geplant für Sa, 17\.\sOkt, 09:00$/),
      })
      // Nach der Umstellung am 25. Oktober gilt wieder Winterzeit: 09:00 Wien = 08:00 UTC.
      expect(await veroeffentlicheStartseite({ wann: 'termin', datum: '2026-10-26', uhrzeit: '09:00' })).toMatchObject({ liveAb: '2026-10-26T08:00:00.000Z' })
    } finally {
      vi.useRealTimers()
    }
    expect(updateTag).toHaveBeenCalledWith(STARTSEITE_CACHE_TAG)
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).not.toContain('/')
  })

  it('weist einen Termin in der Vergangenheit, zu weit voraus oder in der Sommerzeit-Lücke ab, ohne zu schreiben', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-03-20T10:00:00.000Z'))
    try {
      expect(await veroeffentlicheStartseite({ wann: 'termin', datum: '2027-03-20', uhrzeit: '10:55' })).toEqual({
        error: 'Dieser Zeitpunkt ist schon vorbei. Wähle einen späteren.',
      })
      expect(await veroeffentlicheStartseite({ wann: 'termin', datum: '2028-03-21', uhrzeit: '09:00' })).toEqual({
        error: 'So weit voraus geht es nicht – höchstens ein Jahr.',
      })
      expect(await veroeffentlicheStartseite({ wann: 'termin', datum: '2027-03-28', uhrzeit: '02:30' })).toEqual({
        error: 'Diese Uhrzeit gibt es an dem Tag nicht (Zeitumstellung).',
      })
    } finally {
      vi.useRealTimers()
    }
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('schreibt keine Fassung aus einem kaputten Entwurf', async () => {
    tx.startseiteAbschnitt.findMany.mockResolvedValue(ZEILEN.slice(1))
    expect(await veroeffentlicheStartseite({ wann: 'jetzt' })).toEqual({
      error: 'Der Entwurf lässt sich so nicht veröffentlichen. Lade die Seite neu und versuch es noch einmal.',
    })
    expect(tx.startseiteFassung.create).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('zieheFassungZurueck', () => {
  it('zieht nur zurück, solange die Zeit nicht erreicht ist — die Bedingung steht in der WHERE-Klausel', async () => {
    vi.mocked(prisma.startseiteFassung.updateMany).mockResolvedValue({ count: 1 } as never)
    expect(await zieheFassungZurueck({ id: 'f1' })).toEqual({ ok: true })
    const frage = vi.mocked(prisma.startseiteFassung.updateMany).mock.calls[0]?.[0] as { where: Record<string, unknown>; data: { zurueckgezogenAm: Date } }
    expect(frage.where).toMatchObject({ id: 'f1', zurueckgezogenAm: null, liveAb: { gt: frage.data.zurueckgezogenAm } })
  })

  it('weist eine laufende (oder schon zurückgezogene) Fassung ab', async () => {
    vi.mocked(prisma.startseiteFassung.updateMany).mockResolvedValue({ count: 0 } as never)
    expect(await zieheFassungZurueck({ id: 'f-live' })).toEqual({ error: 'Diese Fassung ist schon live oder zurückgezogen. Lade die Seite neu.' })
    expect(updateTag).not.toHaveBeenCalled()
  })
})

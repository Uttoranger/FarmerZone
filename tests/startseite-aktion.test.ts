/**
 * Admin › Startseite speichern (Register N16, Nr. 96) — die Actions aus
 * src/server/actions/startseite.ts mit gemockter Datenbank und Sitzung.
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
 *  - Ein gültiges Speichern schreibt Block und Positionen in EINER Transaktion
 *    und leert den Cache der Startseite; die Felder anderer Vorlagen fallen weg.
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
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    startseiteAbschnitt: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    startseiteBlock: { create: vi.fn(), update: vi.fn() },
  }
  return {
    prisma: {
      user: { findUnique: vi.fn() },
      farm: { count: vi.fn() },
      startseiteBlock: { deleteMany: vi.fn(), findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      __tx: tx,
    },
  }
})

import { updateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ADMIN_STARTSEITE_VORSCHAU_HREF, REIHENFOLGE_FEHLER_TEXT, STANDARD_REIHENFOLGE, NEUER_BLOCK } from '@/lib/startseite-gestalten'
import {
  beendeStartseitenVorschau,
  erzeugeStartseitenVorschau,
  loescheStartseitenBlock,
  speichereStartseite,
} from '@/server/actions/startseite'
import type { StartseitenBlockEingabe } from '@/schemas/startseite'

type TxMock = {
  startseiteAbschnitt: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  startseiteBlock: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
}
const tx = (prisma as unknown as { __tx: TxMock }).__tx

const ZEILEN = STANDARD_REIHENFOLGE.map((art) => ({ id: `z-${art.toLowerCase()}`, art, blockId: null, block: null }))
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
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'admin-1' } } as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: true } as never)
  tx.startseiteAbschnitt.findMany.mockResolvedValue(ZEILEN)
  tx.startseiteBlock.create.mockResolvedValue({ id: 'block-neu' })
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
    expect(await speichereStartseite({ reihenfolge: reihenfolge(), block: null })).toEqual({ error: 'Kein Zugriff.' })
    expect(await loescheStartseitenBlock({ blockId: 'b1' })).toEqual({ error: 'Kein Zugriff.' })
    expect(await erzeugeStartseitenVorschau({ stand: 'heute', blockEntwurfId: null })).toEqual({ error: 'Kein Zugriff.' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.startseiteBlock.deleteMany).not.toHaveBeenCalled()
    expect(h.draftEnable).not.toHaveBeenCalled()
  })

  it('lehnt ohne Sitzung ab', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    expect(await speichereStartseite({ reihenfolge: reihenfolge(), block: null })).toEqual({ error: 'Nicht angemeldet.' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

describe('feste Abschnitte prüft der Server', () => {
  it('lässt den Kopf nicht verschieben', async () => {
    const liste = reihenfolge()
    ;[liste[0], liste[1]] = [liste[1], liste[0]]
    expect(await speichereStartseite({ reihenfolge: liste, block: null })).toEqual({ error: REIHENFOLGE_FEHLER_TEXT['kopf-nicht-oben'] })
    nichtsGeschrieben()
  })

  it('lässt „Höfe in deiner Nähe" nicht ausblenden', async () => {
    const liste = reihenfolge().map((r) => (r.id === 'z-hoefe' ? { ...r, sichtbar: false } : r))
    expect(await speichereStartseite({ reihenfolge: liste, block: null })).toEqual({ error: REIHENFOLGE_FEHLER_TEXT['fest-ausgeblendet'] })
    nichtsGeschrieben()
  })

  it('lässt keinen neuen Block unter den Fuß', async () => {
    const liste = [...reihenfolge(), { id: NEUER_BLOCK, sichtbar: true }]
    expect(await speichereStartseite({ reihenfolge: liste, block: block() })).toEqual({ error: REIHENFOLGE_FEHLER_TEXT['fuss-nicht-unten'] })
    nichtsGeschrieben()
  })

  it('verlangt genau die Zeilen der Datenbank', async () => {
    const satz = { error: 'Die Startseite wurde inzwischen geändert. Lade die Seite neu und versuch es noch einmal.' }
    expect(await speichereStartseite({ reihenfolge: reihenfolge().slice(0, -1), block: null })).toEqual(satz)
    expect(await speichereStartseite({ reihenfolge: [...reihenfolge().slice(0, -1), { id: 'fremd', sichtbar: true }], block: null })).toEqual(satz)
    expect(await speichereStartseite({ reihenfolge: [reihenfolge()[0], ...reihenfolge()], block: null })).toEqual(satz)
    nichtsGeschrieben()
  })
})

describe('Höfe und Bild', () => {
  it('nimmt nur freigeschaltete Höfe', async () => {
    vi.mocked(prisma.farm.count).mockResolvedValue(1 as never)
    const liste = [reihenfolge()[0], { id: NEUER_BLOCK, sichtbar: true }, ...reihenfolge().slice(1)]
    const ergebnis = await speichereStartseite({ reihenfolge: liste, block: block({ vorlage: 'HOEFE_AUSWAHL', farmIds: ['f1', 'f-gesperrt'] }) })
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
      expect(await speichereStartseite({ reihenfolge: liste, block: block({ bildUrl: fremd }) }), fremd).toEqual({
        error: 'Dieses Bild konnten wir nicht übernehmen. Bitte lade es noch einmal hoch.',
      })
    }
    nichtsGeschrieben()
    expect(await speichereStartseite({ reihenfolge: liste, block: block({ bildUrl: EIGENES_BILD }) })).toEqual({ ok: true, blockId: 'block-neu' })
  })
})

describe('gültig speichern', () => {
  it('legt den neuen Block an seiner Stelle an und schreibt alle Positionen in EINER Transaktion', async () => {
    const liste = [reihenfolge()[0], { id: NEUER_BLOCK, sichtbar: true }, ...reihenfolge().slice(1)]
    liste[4] = { ...liste[4], sichtbar: false } // BRENNMATERIAL aus

    expect(await speichereStartseite({ reihenfolge: liste, block: block() })).toEqual({ ok: true, blockId: 'block-neu' })

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
    expect(tx.startseiteAbschnitt.create).toHaveBeenCalledWith({ data: { art: 'BLOCK', position: 1, sichtbar: true, blockId: 'block-neu' } })
    const positionen = tx.startseiteAbschnitt.update.mock.calls.map((c) => [c[0].where.id, c[0].data.position, c[0].data.sichtbar])
    expect(positionen).toEqual(liste.flatMap((r, i) => (r.id === NEUER_BLOCK ? [] : [[r.id, i, r.sichtbar]])))
    expect(updateTag).toHaveBeenCalledWith('startseite')
  })

  it('lässt beim Wechsel der Vorlage keine unsichtbaren Reste stehen', async () => {
    const liste = [reihenfolge()[0], { id: NEUER_BLOCK, sichtbar: true }, ...reihenfolge().slice(1)]
    await speichereStartseite({ reihenfolge: liste, block: block({ vorlage: 'HINWEISBAND', bildUrl: EIGENES_BILD, kategorie: 'EIER' }) })
    expect(tx.startseiteBlock.create.mock.calls[0]?.[0].data).toMatchObject({ ueberzeile: null, text: null, bildUrl: null, kategorie: null, farmIds: [] })
  })

  it('ändert einen bestehenden Block nur, wenn er in der Liste steht', async () => {
    tx.startseiteAbschnitt.findMany.mockResolvedValue([...ZEILEN.slice(0, 2), { id: 'z-block', art: 'BLOCK', blockId: 'b1', block: { bildUrl: null } }, ...ZEILEN.slice(2)])
    const liste = [...reihenfolge().slice(0, 2), { id: 'z-block', sichtbar: true }, ...reihenfolge().slice(2)]
    expect(await speichereStartseite({ reihenfolge: liste, block: block({ id: 'b1' }) })).toEqual({ ok: true, blockId: 'b1' })
    expect(tx.startseiteBlock.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'b1' } }))
    vi.clearAllMocks()
    expect(await speichereStartseite({ reihenfolge: liste, block: block({ id: 'fremder-block' }) })).toEqual({
      error: 'Die Startseite wurde inzwischen geändert. Lade die Seite neu und versuch es noch einmal.',
    })
    expect(tx.startseiteBlock.update).not.toHaveBeenCalled()
  })

  it('gibt bei falschen Feldern einen eigenen Satz zurück, nie Zods Text', async () => {
    const liste = [reihenfolge()[0], { id: NEUER_BLOCK, sichtbar: true }, ...reihenfolge().slice(1)]
    expect(await speichereStartseite({ reihenfolge: liste, block: block({ linkUrl: '//fremd.example' }) })).toEqual({
      error: 'Das Link-Ziel beginnt mit „/“, etwa /hoefe – Adressen anderer Seiten gehen nicht.',
    })
    expect(await speichereStartseite({ reihenfolge: 'Unsinn', block: null })).toEqual({ error: 'Bitte prüf die Angaben und speichere noch einmal.' })
    nichtsGeschrieben()
  })
})

describe('Vorschau-Link', () => {
  it('schaltet für den Admin den Draft Mode ein und gibt einen signierten Pfad', async () => {
    const ergebnis = await erzeugeStartseitenVorschau({ stand: 'heute', blockEntwurfId: 'b1' })
    expect(h.draftEnable).toHaveBeenCalledTimes(1)
    expect(ergebnis).toMatchObject({ ok: true })
    expect('pfad' in ergebnis && ergebnis.pfad).toMatch(/^\/\?vorschau=[A-Za-z0-9_-]+&sig=[a-f0-9]{64}$/)
  })

  it('führt „Vorschau öffnen" über die Route, die den Draft Mode auf jedem Gerät einschaltet — mit demselben Link', async () => {
    const ergebnis = await erzeugeStartseitenVorschau({ stand: 'heute', blockEntwurfId: 'b1' })
    if (!('link' in ergebnis)) throw new Error('kein Link')
    expect(ergebnis.link.startsWith(`${ADMIN_STARTSEITE_VORSCHAU_HREF}?`)).toBe(true)
    expect(ergebnis.link.slice(ADMIN_STARTSEITE_VORSCHAU_HREF.length)).toBe(ergebnis.pfad.slice(1))
  })

  it('schaltet den Draft Mode beim Zurückschalten auf „Bearbeiten" wieder aus', async () => {
    expect(await beendeStartseitenVorschau()).toEqual({ ok: true })
    expect(h.draftDisable).toHaveBeenCalledTimes(1)
  })

  it('sagt ohne geplanten Block, dass keiner kommt — ohne Draft Mode', async () => {
    vi.mocked(prisma.startseiteBlock.findMany).mockResolvedValue([] as never)
    expect(await erzeugeStartseitenVorschau({ stand: 'block', blockEntwurfId: null })).toEqual({ error: 'Es ist gerade kein Block geplant.' })
    expect(h.draftEnable).not.toHaveBeenCalled()
  })
})

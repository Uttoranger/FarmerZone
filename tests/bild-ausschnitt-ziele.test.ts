/**
 * Die vier Ziele aus Nr. 98 (Register N17): Logo, Produktfoto, Galerie-Foto
 * und Beitragsfoto speichern über speichereBildAusschnittAction.
 *
 * Beweist je Ziel:
 *  - Der Besitz steht in der WHERE-Klausel desselben Schreibens — Logo über
 *    Hof und ownerId, Produkt, Foto und Beitrag über ihre Kennung UND den Hof
 *    aus der Sitzung. Ein fremdes Produkt, Foto oder ein fremder Beitrag trifft
 *    0 Zeilen: Fehler, und kein Neubau einer Seite.
 *  - Das Logo mit Filter wird abgewiesen, bevor irgendetwas geschrieben wird.
 *  - Mitte, 100 %, Natürlich wird als `null` gespeichert („Passt so“ nach dem
 *    Upload, „Zurücksetzen“ = wie heute).
 *
 * Gemockt ist nur die Infrastruktur (Prisma, Sitzung, Cache); Schema und
 * Aktion prüfen echt. Ob eine fremde Zeile wirklich 0 trifft, zeigt die
 * Integrationsschicht (tests/integration/bild-ausschnitt.int.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), updateMany: vi.fn() },
    product: { updateMany: vi.fn() },
    farmPhoto: { updateMany: vi.fn() },
    statusPost: { updateMany: vi.fn() },
  },
}))

import { Prisma } from '@prisma/client'
import { revalidatePath, updateTag } from 'next/cache'
import { speichereBildAusschnittAction } from '@/server/actions/bild-ausschnitt'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const getSession = vi.mocked(auth.api.getSession)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const schreiben = {
  logo: vi.mocked(prisma.farm.updateMany),
  produkt: vi.mocked(prisma.product.updateMany),
  foto: vi.mocked(prisma.farmPhoto.updateMany),
  beitrag: vi.mocked(prisma.statusPost.updateMany),
}

const WERT = { fokusX: 30, fokusY: 70, zoom: 140, filter: 'KLAR' } as const

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmFindUnique.mockResolvedValue({ id: 'farm_1', slug: 'testhof' } as never)
  for (const s of Object.values(schreiben)) s.mockResolvedValue({ count: 1 })
})

const FAELLE = [
  {
    ziel: 'produkt',
    eingabe: { ziel: 'produkt', productId: 'p_fremd', wert: WERT },
    where: { id: 'p_fremd', farmId: 'farm_1' },
    spalte: 'bildAusschnitt',
  },
  {
    ziel: 'foto',
    eingabe: { ziel: 'foto', farmPhotoId: 'f_fremd', wert: WERT },
    where: { id: 'f_fremd', farmId: 'farm_1' },
    spalte: 'ausschnitt',
  },
  {
    ziel: 'beitrag',
    eingabe: { ziel: 'beitrag', statusPostId: 's_fremd', wert: WERT },
    where: { id: 's_fremd', farmId: 'farm_1' },
    spalte: 'fotoAusschnitt',
  },
] as const

describe('speichereBildAusschnittAction — Produkt, Foto, Beitrag', () => {
  it.each(FAELLE)('$ziel: schreibt mit Kennung UND eigenem Hof in derselben WHERE-Klausel', async ({ ziel, eingabe, where, spalte }) => {
    const ergebnis = await speichereBildAusschnittAction(eingabe)

    expect(ergebnis).toEqual({ ok: true })
    expect(schreiben[ziel]).toHaveBeenCalledWith({ where, data: { [spalte]: WERT } })
  })

  it.each(FAELLE)('$ziel: ein fremder Eintrag (0 Zeilen) ergibt einen Fehler und baut keine Seite neu', async ({ ziel, eingabe }) => {
    schreiben[ziel].mockResolvedValue({ count: 0 })

    const ergebnis = await speichereBildAusschnittAction(eingabe)

    expect(ergebnis).toEqual({ error: 'Dieses Foto gibt es nicht mehr. Lade die Seite neu.' })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })

  it.each(FAELLE)('$ziel: ohne eigenen Hof wird nichts geschrieben — die Kennung allein reicht nie', async ({ ziel, eingabe }) => {
    farmFindUnique.mockResolvedValue(null)

    const ergebnis = await speichereBildAusschnittAction(eingabe)

    expect(ergebnis).toEqual({ error: 'Wir haben deinen Hof nicht gefunden. Lade die Seite neu.' })
    expect(schreiben[ziel]).not.toHaveBeenCalled()
  })

  it('Mitte, 100 %, Natürlich wird null — der Beitrag steht dann wieder ganz wie heute', async () => {
    await speichereBildAusschnittAction({ ziel: 'beitrag', statusPostId: 's1', wert: { fokusX: 50, fokusY: 50, zoom: 100, filter: 'NATUERLICH' } })

    expect(schreiben.beitrag).toHaveBeenCalledWith({ where: { id: 's1', farmId: 'farm_1' }, data: { fotoAusschnitt: Prisma.DbNull } })
  })

  it('ein Produktfoto baut alles neu, was Produkte zeigt — auch den Cache von /hoefe', async () => {
    await speichereBildAusschnittAction(FAELLE[0].eingabe)

    expect(vi.mocked(revalidatePath).mock.calls.map(([pfad]) => pfad)).toEqual(expect.arrayContaining(['/products', '/testhof', '/farm-page']))
    expect(updateTag).toHaveBeenCalledTimes(1)
  })
})

describe('speichereBildAusschnittAction — Logo', () => {
  it('schreibt beim eigenen Hof über Hof und Besitzer in der WHERE-Klausel', async () => {
    const ergebnis = await speichereBildAusschnittAction({ ziel: 'logo', wert: { ...WERT, filter: 'NATUERLICH' } })

    expect(ergebnis).toEqual({ ok: true })
    expect(schreiben.logo).toHaveBeenCalledWith({
      where: { id: 'farm_1', ownerId: 'user_1' },
      data: { logoAusschnitt: { ...WERT, filter: 'NATUERLICH' } },
    })
    expect(vi.mocked(revalidatePath).mock.calls.map(([pfad]) => pfad)).toEqual(['/testhof', '/farm-page'])
  })

  it.each(['KLAR', 'WARM', 'SCHWARZWEISS'] as const)('weist das Logo mit Filter %s ab — nichts gelesen, nichts geschrieben', async (filter) => {
    const ergebnis = await speichereBildAusschnittAction({ ziel: 'logo', wert: { ...WERT, filter } })

    expect(ergebnis).toEqual({ error: 'Den Ausschnitt konnten wir nicht speichern. Lade die Seite neu und versuch es noch einmal.' })
    expect(farmFindUnique).not.toHaveBeenCalled()
    for (const s of Object.values(schreiben)) expect(s).not.toHaveBeenCalled()
  })

  it('weist die Wahl füllen/ganz beim Logo ab — sie gibt es nur beim Titelbild', async () => {
    const ergebnis = await speichereBildAusschnittAction({ ziel: 'logo', wert: { ...WERT, filter: 'NATUERLICH', darstellung: 'GANZ' } })

    expect(ergebnis).toEqual({ error: 'Den Ausschnitt konnten wir nicht speichern. Lade die Seite neu und versuch es noch einmal.' })
    expect(schreiben.logo).not.toHaveBeenCalled()
  })
})

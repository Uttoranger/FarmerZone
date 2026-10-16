/**
 * Titelbild-Ausschnitt speichern (Register N13/N17, Nachtlauf Nr. 97) — gegen
 * ein ECHTES Postgres mit echter Sitzung.
 *
 * Beweist (Zustand in der Datenbank danach):
 *  - speichereBildAusschnittAction({ ziel: 'banner' }) schreibt bannerAusschnitt
 *    und bannerFocusY (= fokusY, für alten Code im Deploy-Fenster) — nur beim
 *    Hof aus der Sitzung; ein zweiter Hof bleibt, wie er war.
 *  - Eine mitgeschickte Hof-Kennung wird abgewiesen, nichts geschrieben.
 *  - Ohne Sitzung und ohne eigenen Hof wird nichts geschrieben.
 *  - Seit Nr. 98: das eigene Produkt wird geschrieben, ein fremdes (echte
 *    Kennung, anderer Hof) bleibt null; Mitte/100 %/Natürlich setzt NULL; das
 *    Logo nur beim eigenen Hof und nie mit Filter.
 *  - Seit Nr. 108: Ein neues Logo (updateFarmLogoAction) setzt den Ausschnitt
 *    im selben Update auf NULL — kein zweiter Aufruf mehr, der scheitern kann.
 *  - Die öffentliche Abfrage liest den Wert über leseAusschnitt: gespeichert
 *    kommt er an, ein ungültiger Altwert wird null statt eines Fehlers.
 *  - Die Migration hat die fünf Spalten angelegt, alle nullable ohne Default.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { headers } from 'next/headers'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { speichereBildAusschnittAction } from '@/server/actions/bild-ausschnitt'
import { updateFarmLogoAction } from '@/server/actions/appearance'
import { getPublicFarm } from '@/server/queries/farm'
import { erstelleHof, erstelleHofMitAnmeldung, erstelleProdukt, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

const WERT = { fokusX: 30, fokusY: 64, zoom: 115, filter: 'WARM', darstellung: 'FUELLEN' } as const

async function titelbildStand(farmId: string) {
  return prisma.farm.findUniqueOrThrow({
    where: { id: farmId },
    select: { bannerAusschnitt: true, bannerFocusY: true, logoAusschnitt: true },
  })
}

/** Ein angemeldeter Hof mit Foto als Titelbild — und ein zweiter, fremder Hof daneben. */
async function zweiHoefe() {
  const eigen = await erstelleHofMitAnmeldung({ bannerType: 'PHOTO', bannerUrl: 'https://bilder.example/titel.jpg', bannerFocusY: 20 })
  const fremd = await erstelleHof({ bannerType: 'PHOTO', bannerUrl: 'https://bilder.example/fremd.jpg', bannerFocusY: 70 })
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie: eigen.cookie }) as never)
  return { eigen: eigen.farm, fremd: fremd.farm }
}

describe('speichereBildAusschnittAction — Titelbild', () => {
  it('schreibt Ausschnitt und bannerFocusY nur beim eigenen Hof; der fremde bleibt', async () => {
    const { eigen, fremd } = await zweiHoefe()

    const ergebnis = await speichereBildAusschnittAction({ ziel: 'banner', wert: WERT })

    expect(ergebnis).toEqual({ ok: true })
    expect(await titelbildStand(eigen.id)).toEqual({ bannerAusschnitt: WERT, bannerFocusY: 64, logoAusschnitt: null })
    expect(await titelbildStand(fremd.id)).toEqual({ bannerAusschnitt: null, bannerFocusY: 70, logoAusschnitt: null })
  })

  it('weist eine mitgeschickte Hof-Kennung ab — auch die des fremden Hofs — und schreibt nichts', async () => {
    const { eigen, fremd } = await zweiHoefe()

    const ergebnis = await speichereBildAusschnittAction({ ziel: 'banner', wert: WERT, farmId: fremd.id })

    expect('error' in ergebnis).toBe(true)
    expect(await titelbildStand(eigen.id)).toEqual({ bannerAusschnitt: null, bannerFocusY: 20, logoAusschnitt: null })
    expect(await titelbildStand(fremd.id)).toEqual({ bannerAusschnitt: null, bannerFocusY: 70, logoAusschnitt: null })
  })

  it('schreibt ohne Sitzung nichts', async () => {
    const { eigen } = await zweiHoefe()
    vi.mocked(headers).mockResolvedValue(new Headers() as never)

    const ergebnis = await speichereBildAusschnittAction({ ziel: 'banner', wert: WERT })

    expect(ergebnis).toEqual({ error: 'Bitte melde dich neu an.' })
    expect(await titelbildStand(eigen.id)).toEqual({ bannerAusschnitt: null, bannerFocusY: 20, logoAusschnitt: null })
  })

  it('schreibt nichts, wenn der angemeldete Nutzer keinen Hof hat', async () => {
    const { eigen, fremd } = await zweiHoefe()
    // Die Sitzung bleibt, der Hof ist weg — es gibt keinen Weg zu einem anderen Hof.
    await prisma.farm.delete({ where: { id: eigen.id } })

    const ergebnis = await speichereBildAusschnittAction({ ziel: 'banner', wert: WERT })

    expect(ergebnis).toEqual({ error: 'Wir haben deinen Hof nicht gefunden. Lade die Seite neu.' })
    expect(await titelbildStand(fremd.id)).toEqual({ bannerAusschnitt: null, bannerFocusY: 70, logoAusschnitt: null })
  })
})

describe('speichereBildAusschnittAction — Logo und Produkt (Nr. 98)', () => {
  const FOTO_WERT = { fokusX: 30, fokusY: 70, zoom: 120, filter: 'KLAR' } as const
  const bildAusschnitt = async (id: string) =>
    (await prisma.product.findUniqueOrThrow({ where: { id }, select: { bildAusschnitt: true } })).bildAusschnitt

  it('schreibt das eigene Produkt; ein Produkt eines fremden Hofs bleibt null, auch mit seiner echten Kennung', async () => {
    const { eigen, fremd } = await zweiHoefe()
    const eigenes = await erstelleProdukt(eigen.id)
    const fremdes = await erstelleProdukt(fremd.id)

    const ok = await speichereBildAusschnittAction({ ziel: 'produkt', productId: eigenes.id, wert: FOTO_WERT })
    const abgewiesen = await speichereBildAusschnittAction({ ziel: 'produkt', productId: fremdes.id, wert: FOTO_WERT })

    expect(ok).toEqual({ ok: true })
    expect(abgewiesen).toEqual({ error: 'Dieses Foto gibt es nicht mehr. Lade die Seite neu.' })
    expect(await bildAusschnitt(eigenes.id)).toEqual(FOTO_WERT)
    expect(await bildAusschnitt(fremdes.id)).toBeNull()
  })

  it('Mitte, 100 %, Natürlich setzt die Spalte zurück auf NULL (wie heute)', async () => {
    const { eigen } = await zweiHoefe()
    const produkt = await erstelleProdukt(eigen.id)
    await speichereBildAusschnittAction({ ziel: 'produkt', productId: produkt.id, wert: FOTO_WERT })

    await speichereBildAusschnittAction({ ziel: 'produkt', productId: produkt.id, wert: { fokusX: 50, fokusY: 50, zoom: 100, filter: 'NATUERLICH' } })

    expect(await bildAusschnitt(produkt.id)).toBeNull()
  })

  it('das Logo landet nur beim eigenen Hof — mit Filter abgewiesen, nichts geschrieben', async () => {
    const { eigen, fremd } = await zweiHoefe()

    const mitFilter = await speichereBildAusschnittAction({ ziel: 'logo', wert: FOTO_WERT })
    expect(mitFilter).toEqual({ error: 'Den Ausschnitt konnten wir nicht speichern. Lade die Seite neu und versuch es noch einmal.' })
    expect((await titelbildStand(eigen.id)).logoAusschnitt).toBeNull()

    await speichereBildAusschnittAction({ ziel: 'logo', wert: { ...FOTO_WERT, filter: 'NATUERLICH' } })
    expect((await titelbildStand(eigen.id)).logoAusschnitt).toEqual({ ...FOTO_WERT, filter: 'NATUERLICH' })
    expect((await titelbildStand(fremd.id)).logoAusschnitt).toBeNull()
  })

  it('ein neues Logo setzt den Ausschnitt im selben Update zurück (NULL), der fremde Hof bleibt', async () => {
    const speicher = 'intlogo108'
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', `vercel_blob_rw_${speicher}_nurFuerTests`)
    try {
      const { eigen, fremd } = await zweiHoefe()
      const gewaehlt = { ...FOTO_WERT, filter: 'NATUERLICH' }
      await speichereBildAusschnittAction({ ziel: 'logo', wert: gewaehlt })
      await prisma.farm.update({ where: { id: fremd.id }, data: { logoAusschnitt: gewaehlt } })
      const neu = `https://${speicher}.public.blob.vercel-storage.com/farms/${eigen.id}/logo/2.webp`

      expect(await updateFarmLogoAction(neu)).toEqual({})

      const danach = await prisma.farm.findUniqueOrThrow({ where: { id: eigen.id }, select: { logoUrl: true, logoAusschnitt: true } })
      expect(danach).toEqual({ logoUrl: neu, logoAusschnitt: null })
      expect((await titelbildStand(fremd.id)).logoAusschnitt).toEqual(gewaehlt)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('Lesen und Spalten', () => {
  it('die Hofseite bekommt den gespeicherten Ausschnitt; ein ungültiger Altwert wird null statt eines Fehlers', async () => {
    const { eigen } = await zweiHoefe()
    await prisma.farm.update({ where: { id: eigen.id }, data: { approvedAt: new Date() } })
    await speichereBildAusschnittAction({ ziel: 'banner', wert: WERT })
    expect((await getPublicFarm(eigen.slug))?.bannerAusschnitt).toEqual(WERT)

    await prisma.farm.update({ where: { id: eigen.id }, data: { bannerAusschnitt: { fokusX: 'mitte', zoom: 900 } as Prisma.InputJsonValue } })
    const hof = await getPublicFarm(eigen.slug)
    expect(hof).not.toBeNull()
    expect(hof?.bannerAusschnitt).toBeNull()
  })

  it('die Migration hat die fünf Spalten angelegt — Json, nullable, ohne Default', async () => {
    const spalten = await prisma.$queryRaw<Array<{ table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }>>`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name, column_name) IN (('Farm', 'bannerAusschnitt'), ('Farm', 'logoAusschnitt'), ('Product', 'bildAusschnitt'), ('FarmPhoto', 'ausschnitt'), ('StatusPost', 'fotoAusschnitt'))
      ORDER BY table_name, column_name`
    expect(spalten).toHaveLength(5)
    for (const spalte of spalten) expect(spalte).toMatchObject({ data_type: 'jsonb', is_nullable: 'YES', column_default: null })
  })
})

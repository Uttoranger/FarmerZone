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
 *  - Logo, Produkt (auch das eigene), Foto und Beitrag sind in Nr. 97 gesperrt:
 *    abgewiesen, die Spalten bleiben null.
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

describe('speichereBildAusschnittAction — gesperrte Ziele (Nr. 98)', () => {
  it('Logo und das eigene Produkt sind abgewiesen, ihre Spalten bleiben null', async () => {
    const { eigen } = await zweiHoefe()
    const produkt = await erstelleProdukt(eigen.id)
    const fotoWert = { fokusX: 50, fokusY: 50, zoom: 120, filter: 'KLAR' } as const

    const logo = await speichereBildAusschnittAction({ ziel: 'logo', wert: { ...fotoWert, filter: 'NATUERLICH' } })
    const eigenesProdukt = await speichereBildAusschnittAction({ ziel: 'produkt', productId: produkt.id, wert: fotoWert })

    expect(logo).toEqual({ error: 'Für dieses Foto gibt es den Ausschnitt noch nicht.' })
    expect(eigenesProdukt).toEqual({ error: 'Für dieses Foto gibt es den Ausschnitt noch nicht.' })
    expect((await titelbildStand(eigen.id)).logoAusschnitt).toBeNull()
    expect((await prisma.product.findUniqueOrThrow({ where: { id: produkt.id }, select: { bildAusschnitt: true } })).bildAusschnitt).toBeNull()
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

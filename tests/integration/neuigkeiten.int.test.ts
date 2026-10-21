/**
 * Beiträge außerhalb der Hofseite (Nr. 129) gegen ein ECHTES Postgres:
 *  - „Neu bei den Höfen“ (Register N16, leseNeuigkeiten): die neuesten aktiven
 *    Beiträge der letzten 14 Tage, höchstens einer je Hof (der neueste),
 *    höchstens sechs, nach Zeit — nie von einem Testhof, nie von einem
 *    pausierten oder nicht freigeschalteten Hof, nie abgelaufen, nie ohne
 *    „Auf der Hofseite zeigen“, nie ein Entwurf.
 *  - Die Marke an der Hofkarte (Register N22, getOeffentlicheHoefe →
 *    neuerBeitrag): der neueste aktive Beitrag, höchstens sieben Tage alt; nur
 *    Titel und Zeitpunkte; ein Testhof steht gar nicht in der Liste.
 *
 * Geprüft wird nur an eigenen Höfen (`int-`): Seed-Höfe der geteilten
 * Test-Datenbank können eigene Beiträge tragen. Zeitpunkte relativ zur
 * Systemuhr, großzügig (TESTING_GUIDELINES §1).
 */
import { afterEach, describe, expect, it } from 'vitest'
import type { Prisma, ProductCategory } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { leseNeuigkeiten } from '@/server/queries/neuigkeiten'
import { getOeffentlicheHoefe, IN_LISTEN_SICHTBAR } from '@/server/queries/farm'
import { AKTIVER_BEITRAG, NEUESTER_BEITRAG_ZUERST } from '@/server/queries/status-posts'
import { PRODUCT_ORDER_BY } from '@/server/queries/products'
import { NEUIGKEITEN_TAGE, waehleNeuigkeiten, type Neuigkeit } from '@/lib/startseite-gestalten'
import { leseAusschnitt } from '@/schemas/bild-ausschnitt'
import { INT_PRAEFIX, erstelleHof, erstelleProdukt, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

const STUNDE = 3_600_000
const TAG = 24 * STUNDE
const vor = (ms: number): Date => new Date(Date.now() - ms)
const nach = (ms: number): Date => new Date(Date.now() + ms)

async function beitrag(farmId: string, titel: string, abweichend: Partial<Prisma.StatusPostUncheckedCreateInput> = {}) {
  return prisma.statusPost.create({
    data: { farmId, title: titel, body: 'Erfundener Text.', anlass: 'NEW_SEASON', publishedAt: vor(STUNDE), ...abweichend },
  })
}

const eigene = <T extends { hof: { slug: string } }>(liste: T[]): T[] => liste.filter((n) => n.hof.slug.startsWith(INT_PRAEFIX))

describe('leseNeuigkeiten — „Neu bei den Höfen“', () => {
  it('höchstens einer je Hof (der neueste), nach Zeit — nur Titel, Anlass, Zeiten, Hof und Kategorien', async () => {
    const { farm: a } = await erstelleHof()
    const { farm: b } = await erstelleHof()
    const produkt = await erstelleProdukt(a.id)
    await prisma.product.update({ where: { id: produkt.id }, data: { category: 'GEMUESE' } })
    await beitrag(a.id, 'A älter', { publishedAt: vor(5 * STUNDE) })
    await beitrag(a.id, 'A neuer', { publishedAt: vor(2 * STUNDE), photoUrl: null })
    await beitrag(b.id, 'B', { publishedAt: vor(3 * STUNDE), expiresAt: nach(2 * TAG) })

    const liste = eigene(await leseNeuigkeiten(new Date()))

    expect(liste.map((n) => n.titel)).toEqual(['A neuer', 'B'])
    expect(liste[0]).toMatchObject({ anlass: 'NEW_SEASON', foto: null, endet: null, hof: { slug: a.slug, kategorien: ['GEMUESE'] } })
    expect(liste[1].endet).not.toBeNull()
    expect(Object.keys(liste[0]).sort()).toEqual(['anlass', 'endet', 'foto', 'fotoAusschnitt', 'hof', 'id', 'titel', 'veroeffentlicht'])
  })

  it('höchstens sechs', async () => {
    for (let n = 1; n <= 7; n++) {
      const { farm } = await erstelleHof()
      // Neuer als jeder Seed-Beitrag: Die sechs Plätze gehören diesen Höfen.
      await beitrag(farm.id, `Hof ${n}`, { publishedAt: vor(n * 1000) })
    }
    const liste = await leseNeuigkeiten(new Date())
    expect(liste).toHaveLength(6)
    expect(liste.map((n) => n.titel)).toEqual(['Hof 1', 'Hof 2', 'Hof 3', 'Hof 4', 'Hof 5', 'Hof 6'])
  })

  it('nur die letzten 14 Tage, nur aktiv und für die Hofseite — nie Testhof, pausiert oder nicht freigeschaltet', async () => {
    const { farm: offen } = await erstelleHof()
    const { farm: alt } = await erstelleHof()
    const { farm: abgelaufen } = await erstelleHof()
    const { farm: nurMail } = await erstelleHof()
    const { farm: entwurf } = await erstelleHof()
    const { farm: testhof } = await erstelleHof({ istTesthof: true })
    const { farm: pausiert } = await erstelleHof({ isPaused: true })
    const { farm: wartet } = await erstelleHof({ approvedAt: null })
    await beitrag(offen.id, 'Gilt', { publishedAt: vor(13 * TAG) })
    await beitrag(alt.id, 'Älter als 14 Tage', { publishedAt: vor(15 * TAG) })
    await beitrag(abgelaufen.id, 'Abgelaufen', { publishedAt: vor(2 * TAG), expiresAt: vor(STUNDE) })
    await beitrag(nurMail.id, 'Nur per Mail', { showOnFarmPage: false })
    await beitrag(entwurf.id, 'Entwurf', { publishedAt: null })
    await beitrag(testhof.id, 'Vom Testhof')
    await beitrag(pausiert.id, 'Vom pausierten Hof')
    await beitrag(wartet.id, 'Noch nicht freigeschaltet')

    expect(eigene(await leseNeuigkeiten(new Date())).map((n) => n.titel)).toEqual(['Gilt'])
  })

  it('ohne Beitrag leer', async () => {
    await erstelleHof()
    expect(eigene(await leseNeuigkeiten(new Date()))).toEqual([])
  })
})

/**
 * Die Abfrage, wie sie bis Nr. 133 las: ohne Obergrenze, je Beitrag alle Produkte des Hofs,
 * die Kategorien erst danach mit einem Set entdoppelt. Der Vergleich hält fest, dass die
 * schlankere Fassung (Obergrenze, nur das Feld `category` mit distinct) dasselbe liefert.
 */
async function alteAbfrage(jetzt: Date): Promise<Neuigkeit[]> {
  const ab = new Date(jetzt.getTime() - NEUIGKEITEN_TAGE * 24 * 60 * 60_000)
  const beitraege = await prisma.statusPost.findMany({
    where: { AND: [AKTIVER_BEITRAG(jetzt), { publishedAt: { gte: ab } }, { farm: { ...IN_LISTEN_SICHTBAR, isPaused: false } }] },
    orderBy: NEUESTER_BEITRAG_ZUERST,
    select: {
      id: true, title: true, anlass: true, photoUrl: true, fotoAusschnitt: true, publishedAt: true, expiresAt: true,
      farm: {
        select: {
          name: true, slug: true,
          products: { where: { isAvailable: true, category: { not: null } }, orderBy: PRODUCT_ORDER_BY, select: { category: true } },
        },
      },
    },
  })
  return waehleNeuigkeiten(
    beitraege.map((b) => ({
      id: b.id,
      titel: b.title,
      anlass: b.anlass,
      foto: b.photoUrl,
      fotoAusschnitt: leseAusschnitt(b.fotoAusschnitt),
      veroeffentlicht: b.publishedAt!.toISOString(),
      endet: b.expiresAt?.toISOString() ?? null,
      hof: {
        name: b.farm.name,
        slug: b.farm.slug,
        kategorien: [...new Set(b.farm.products.flatMap((p) => (p.category ? [p.category] : [])))],
      },
    }))
  )
}

async function produktMit(farmId: string, category: ProductCategory | null, imShop = true): Promise<void> {
  const produkt = await erstelleProdukt(farmId)
  await prisma.product.update({ where: { id: produkt.id }, data: { category, isAvailable: imShop } })
}

describe('leseNeuigkeiten — gleiches Ergebnis wie die Abfrage ohne Obergrenze (Nr. 134)', () => {
  it('20 Beiträge von 8 Höfen: dieselbe Liste, dieselben Kategorien in derselben Reihenfolge', async () => {
    const hoefe = []
    for (const buchstabe of 'ABCDEFGH') {
      const { farm } = await erstelleHof({ name: `Testhof ${buchstabe}` })
      hoefe.push(farm)
    }
    // Kategorien doppelt, ohne Kategorie und nicht im Shop: Nur die im Shop zählen, je Kategorie einmal.
    for (const [i, farm] of hoefe.entries()) {
      await produktMit(farm.id, 'GEMUESE')
      await produktMit(farm.id, i % 2 === 0 ? 'EIER' : 'HONIG')
      await produktMit(farm.id, 'GEMUESE')
      await produktMit(farm.id, null)
      await produktMit(farm.id, 'FLEISCH', false)
    }
    // 20 Beiträge, Hof A bis D mit mehr als einem; alle neuer als jeder Seed-Beitrag.
    const verteilung = [0, 1, 2, 3, 0, 4, 1, 5, 0, 6, 2, 7, 0, 1, 3, 4, 5, 6, 7, 2]
    for (const [k, hof] of verteilung.entries()) {
      await beitrag(hoefe[hof].id, `Beitrag ${k + 1}`, { publishedAt: vor((k + 1) * 60_000) })
    }

    const jetzt = new Date()
    const neu = await leseNeuigkeiten(jetzt)
    const alt = await alteAbfrage(jetzt)

    expect(neu).toEqual(alt)
    expect(neu).toHaveLength(6)
    expect(new Set(neu.map((n) => n.hof.slug)).size).toBe(6)
    expect(neu[0]).toMatchObject({ titel: 'Beitrag 1', hof: { name: 'Testhof A', kategorien: ['GEMUESE', 'EIER'] } })
  })

  it('ein Hof mit sehr vielen Beiträgen verdrängt die anderen nicht: sechs Höfe, je einer', async () => {
    const { farm: viel } = await erstelleHof({ name: 'Testhof Viel' })
    const anderen = []
    for (let n = 1; n <= 7; n++) anderen.push((await erstelleHof({ name: `Testhof ${n}` })).farm)
    await prisma.statusPost.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        farmId: viel.id, title: `Viel ${i + 1}`, body: 'Erfundener Text.', anlass: 'NEW_SEASON' as const, publishedAt: vor((i + 1) * 1000),
      })),
    })
    for (const [n, farm] of anderen.entries()) await beitrag(farm.id, `Hof ${n + 1}`, { publishedAt: vor(2 * STUNDE + n * 60_000) })

    const liste = await leseNeuigkeiten(new Date())

    expect(liste.map((n) => n.titel)).toEqual(['Viel 1', 'Hof 1', 'Hof 2', 'Hof 3', 'Hof 4', 'Hof 5'])
    expect(await alteAbfrage(new Date())).toEqual(liste)
  })
})

describe('getOeffentlicheHoefe — neuerBeitrag für die Marke an der Hofkarte', () => {
  const eintrag = async (slug: string) => (await getOeffentlicheHoefe()).find((h) => h.slug === slug)

  it('der neueste aktive Beitrag, nur Titel und Zeitpunkte', async () => {
    const { farm } = await erstelleHof()
    await beitrag(farm.id, 'Älter', { publishedAt: vor(3 * TAG) })
    const neu = await beitrag(farm.id, 'Die ersten Kürbisse sind da', { publishedAt: vor(2 * STUNDE), expiresAt: nach(6 * TAG) })
    // Neuer, aber abgelaufen bzw. nur per Mail: zählen nicht.
    await beitrag(farm.id, 'Abgelaufen', { publishedAt: vor(STUNDE), expiresAt: vor(1000) })
    await beitrag(farm.id, 'Nur per Mail', { publishedAt: vor(STUNDE), showOnFarmPage: false })

    expect((await eintrag(farm.slug))?.neuerBeitrag).toEqual({
      titel: 'Die ersten Kürbisse sind da',
      veroeffentlicht: neu.publishedAt?.toISOString(),
      endet: neu.expiresAt?.toISOString(),
    })
  })

  it('höchstens sieben Tage alt, sonst keiner — auch ein Entwurf nicht', async () => {
    const { farm: alt } = await erstelleHof()
    const { farm: entwurf } = await erstelleHof()
    const { farm: ohne } = await erstelleHof()
    await beitrag(alt.id, 'Acht Tage alt', { publishedAt: vor(8 * TAG) })
    await beitrag(entwurf.id, 'Entwurf', { publishedAt: null })

    expect((await eintrag(alt.slug))?.neuerBeitrag).toBeNull()
    expect((await eintrag(entwurf.slug))?.neuerBeitrag).toBeNull()
    expect((await eintrag(ohne.slug))?.neuerBeitrag).toBeNull()
  })

  it('ein Testhof steht mit seinem Beitrag nie in der Liste (IN_LISTEN_SICHTBAR)', async () => {
    const { farm } = await erstelleHof({ istTesthof: true })
    await beitrag(farm.id, 'Vom Testhof')
    expect(await eintrag(farm.slug)).toBeUndefined()
  })
})

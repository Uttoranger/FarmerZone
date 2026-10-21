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
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { leseNeuigkeiten } from '@/server/queries/neuigkeiten'
import { getOeffentlicheHoefe } from '@/server/queries/farm'
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

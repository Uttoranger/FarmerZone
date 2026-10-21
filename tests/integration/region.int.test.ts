/**
 * Region ohne eigenen Standort (Register N23, Nr. 122) gegen echtes Postgres:
 * „So steht dein Hof gerade in der Liste der Kundschaft".
 *
 * Beweist an echten Zeilen:
 *  - ladeEigenenListeneintrag baut den Eintrag GENAU so wie /hoefe: Er gleicht
 *    Feld für Feld dem Eintrag desselben Hofs aus getOeffentlicheHoefe (gleiche
 *    Felder, gleiche Reihenfolge der Produkte, gleicher Zusammenbau).
 *  - nur der eigene Hof: Produkte eines anderen Hofs kommen nie hinein.
 *  - Sichtbarkeit wie die Liste (IN_LISTEN_SICHTBAR): ein Testhof, ein noch
 *    nicht freigeschalteter und ein stillgelegter Hof ergeben null — und fehlen
 *    auch in getOeffentlicheHoefe.
 *
 * Alles trägt das Präfix int- (raeumeAuf). Seed-Zeilen werden nur gelesen, die
 * Uhr bleibt echt; geprüft werden Zustände.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { wienJetzt } from '@/lib/hofuebersicht'
import { getOeffentlicheHoefe } from '@/server/queries/farm'
import { ladeEigenenListeneintrag } from '@/server/queries/region'
import { erstelleHof, erstelleProdukt, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

describe('ladeEigenenListeneintrag — der eigene Hof, wie die Kundschaft ihn sieht', () => {
  it('gleicht Feld für Feld dem Eintrag auf /hoefe — ohne Standort, mit Produkten in der Reihenfolge der Hofseite', async () => {
    const { farm } = await erstelleHof({ name: 'Testhof A' })
    await erstelleProdukt(farm.id, { name: 'Freilandeier', stock: 5 })
    await erstelleProdukt(farm.id, { name: 'Bauernbrot', stock: 0 })
    await prisma.product.updateMany({ where: { farmId: farm.id, name: 'Bauernbrot' }, data: { sortOrder: 1 } })

    const eigen = await ladeEigenenListeneintrag(farm.id)
    const ausListe = (await getOeffentlicheHoefe(wienJetzt())).find((h) => h.slug === farm.slug)

    expect(ausListe).toBeDefined()
    expect(eigen).toEqual(ausListe)
    expect(eigen?.latitude).toBeNull()
    expect(eigen?.produkte.map((p) => p.name)).toEqual(['Freilandeier', 'Bauernbrot'])
    // Kaufbar ist nur, was Vorrat hat — dieselbe Regel wie die Liste.
    expect(eigen?.angebot.map((p) => p.name)).toEqual(['Freilandeier'])
  })

  it('nur der eigene Hof: die Produkte eines anderen Hofs kommen nie hinein', async () => {
    const { farm: eigen } = await erstelleHof({ name: 'Testhof A' })
    const { farm: fremd } = await erstelleHof({ name: 'Testhof B' })
    await erstelleProdukt(eigen.id, { name: 'Freilandeier' })
    await erstelleProdukt(fremd.id, { name: 'Honig' })

    const eintrag = await ladeEigenenListeneintrag(eigen.id)

    expect(eintrag?.slug).toBe(eigen.slug)
    expect(eintrag?.produkte.map((p) => p.name)).toEqual(['Freilandeier'])
    expect(eintrag?.suchNamen).toEqual(['Freilandeier'])
  })

  it('ein Testhof, ein nicht freigeschalteter und ein stillgelegter Hof stehen nicht in der Liste — null', async () => {
    const { farm: testhof } = await erstelleHof({ istTesthof: true })
    const { farm: wartend } = await erstelleHof({ approvedAt: null })
    const { farm: stillgelegt } = await erstelleHof({ archivedAt: new Date('2026-01-01T00:00:00.000Z') })
    // Gegenprobe: ein gewöhnlicher Hof steht drin.
    const { farm: sichtbar } = await erstelleHof()

    for (const hof of [testhof, wartend, stillgelegt]) expect(await ladeEigenenListeneintrag(hof.id), hof.slug).toBeNull()
    expect(await ladeEigenenListeneintrag(sichtbar.id)).not.toBeNull()

    const liste = new Set((await getOeffentlicheHoefe(wienJetzt())).map((h) => h.slug))
    expect([testhof, wartend, stillgelegt].filter((h) => liste.has(h.slug))).toEqual([])
    expect(liste.has(sichtbar.slug)).toBe(true)
  })
})

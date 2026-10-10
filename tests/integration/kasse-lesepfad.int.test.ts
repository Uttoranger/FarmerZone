/**
 * Kassen-Lesepfad gegen ein echtes Postgres (Nr. 47): Warum die Kasse den Hof
 * nur einmal je Anfrage lädt (`getPublicFarmGeteilt`).
 *
 * Gemessen wird an pg selbst: Eine Abfrage, die auf einer Verbindung
 * startet, während dort noch eine läuft, ist genau das, wovor pg warnt
 * („Calling client.query() when the client is already executing a query";
 * ab pg@9 ein Fehler). Prisma, Adapter und Datenbank sind echt.
 *
 * Beweist:
 *  - Gegenprobe (der Befund aus Vercel): Zweimal `getPublicFarm` im selben
 *    Takt — so taten es Metadaten und Seite der Kasse — bündelt Prisma in
 *    EINE Transaktion, und darin laufen die Teilabfragen gleichzeitig über
 *    dieselbe Verbindung.
 *  - Einmal geladen (was `cache` je Anfrage sicherstellt) und nacheinander
 *    geladen: keine Transaktion, nichts gleichzeitig.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { getPublicFarm } from '@/server/queries/farm'
import { erstelleHof, erstelleProdukt, raeumeAuf } from './setup/basis'

type MitInterna = pg.Client & { _activeQuery?: unknown; _queryQueue?: unknown[] }

const zaehler = { gleichzeitig: 0, transaktionen: 0 }
const originalQuery = pg.Client.prototype.query

beforeAll(() => {
  // Nur beobachten, nichts ändern: zählen und an pg weiterreichen.
  pg.Client.prototype.query = function (this: MitInterna, ...args: unknown[]) {
    const text = typeof args[0] === 'string' ? args[0] : (args[0] as { text?: string } | undefined)?.text
    if (text === 'BEGIN') zaehler.transaktionen += 1
    if (this._activeQuery || (this._queryQueue?.length ?? 0) > 0) zaehler.gleichzeitig += 1
    return (originalQuery as (...a: unknown[]) => unknown).apply(this, args)
  } as typeof pg.Client.prototype.query
})

afterAll(() => {
  pg.Client.prototype.query = originalQuery
})

afterEach(async () => {
  await raeumeAuf()
})

async function hofMitWare(): Promise<string> {
  const { farm } = await erstelleHof()
  await erstelleProdukt(farm.id, { stock: 5, name: 'Testeier' })
  await erstelleProdukt(farm.id, { stock: 3, name: 'Testmilch' })
  return farm.slug
}

function zuruecksetzen(): void {
  zaehler.gleichzeitig = 0
  zaehler.transaktionen = 0
}

describe('Kasse: den Hof einmal je Anfrage laden', () => {
  it('Gegenprobe: zweimal getPublicFarm im selben Takt läuft in einer Transaktion gleichzeitig über eine Verbindung', async () => {
    const slug = await hofMitWare()
    zuruecksetzen()

    const [metadaten, seite] = await Promise.all([getPublicFarm(slug), getPublicFarm(slug)])

    expect(metadaten?.slug).toBe(slug)
    expect(seite?.products).toHaveLength(2)
    expect(zaehler.transaktionen).toBeGreaterThanOrEqual(1)
    expect(zaehler.gleichzeitig).toBeGreaterThan(0)
  })

  it('einmal geladen: keine Transaktion, keine gleichzeitige Abfrage — und der Hof ist vollständig', async () => {
    const slug = await hofMitWare()
    zuruecksetzen()

    const hof = await getPublicFarm(slug)

    expect(hof?.slug).toBe(slug)
    expect(hof?.products.map((p) => p.name).sort()).toEqual(['Testeier', 'Testmilch'])
    expect(hof?.pickupSlots).toHaveLength(7)
    expect(zaehler).toEqual({ gleichzeitig: 0, transaktionen: 0 })
  })

  it('nacheinander geladen: ebenfalls nichts gleichzeitig', async () => {
    const slug = await hofMitWare()
    zuruecksetzen()

    await getPublicFarm(slug)
    await getPublicFarm(slug)

    expect(zaehler).toEqual({ gleichzeitig: 0, transaktionen: 0 })
  })
})

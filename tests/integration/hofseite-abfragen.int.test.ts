/**
 * Zahl der SQL-Abfragen je Hofseiten-Anfrage (Nachtlauf 25, Nr. 180) — gegen ein
 * ECHTES Postgres. Eine Anfrage an `/[farmSlug]` lädt:
 *  - die Seite: ladeHofseite (über ladeHofseiteGeteilt auch für die Metadaten) und die Beiträge,
 *  - die Metadaten zusätzlich: das Teilen-Bild — seit Nr. 196 aus dem Hof des Laders
 *    (teilenVorschauAus), ohne eigene Abfrage.
 * Gezählt wird auf der Leitung (pg.Client.query), nicht im Code: So bleibt die Zahl
 * ehrlich, auch wenn jemand Abfragen umstellt. Die Zahl ändert sich durch das
 * Gleichzeitig-Laden nicht (nur die Wartezeit); der Test hält sie fest, damit eine
 * zusätzliche Abfrage auffällt.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import pg from 'pg'
import { ladeHofseite } from '@/server/hofseite-vorschau'
import { teilenVorschauAus } from '@/server/queries/teilen-bild'
import { ladeBeitraege } from '@/server/hofseite-beitraege'
import { erstelleHof, erstelleProdukt, raeumeAuf } from './setup/basis'

let abfragen: string[] = []
const original = pg.Client.prototype.query

beforeEach(() => {
  abfragen = []
  pg.Client.prototype.query = function (this: unknown, ...args: unknown[]) {
    const erstes = args[0]
    const text = typeof erstes === 'string' ? erstes : (erstes as { text?: string } | undefined)?.text
    if (text) abfragen.push(text.trim().split(/\s+/).slice(0, 2).join(' '))
    return Reflect.apply(original, this, args)
  } as typeof original
})

afterEach(async () => {
  pg.Client.prototype.query = original
  await raeumeAuf()
})

/** Nur die Lese-Abfragen (SELECT) — BEGIN/COMMIT der Batch-Transaktionen zählen nicht mit. */
const selects = (): number => abfragen.filter((a) => a.toUpperCase().startsWith('SELECT')).length

describe('SQL je Hofseiten-Anfrage', () => {
  it('Seite und Metadaten zusammen: Zahl der SELECT auf der Leitung', async () => {
    const { farm } = await erstelleHof()
    await erstelleProdukt(farm.id, { stock: 5 })

    abfragen = []
    // Der Weg der Seite: Hof (geteilt mit den Metadaten, einmal) und die Beiträge; das Teilen-Bild der
    // Metadaten baut aus demselben Hof (Nr. 196).
    const geladen = await ladeHofseite(farm.slug, {})
    const vorschau = geladen.teilen ? teilenVorschauAus(geladen.teilen, new Date()) : null
    if (geladen.farm) await ladeBeitraege(geladen.farm.id, null)
    expect(vorschau?.version).toMatch(/^[0-9a-z]+$/)
    // Vorher-Werte: 14 (e1f89496, vor Nr. 180, Beiträge nacheinander) und 14 (Nr. 180, Teilen-Bild mit eigener
    // Abfrage: Hof, Produkte, Abholzeiten). Seit Nr. 196 fallen diese drei weg (docs/nachtlauf/berichte/196.md).
    // Ein Test, der die Zahl nur ausgibt, wäre keiner: Eine Abfrage mehr oder weniger soll auffallen.
    expect(selects()).toBe(GEZAEHLT)
  })
})

const GEZAEHLT = 11

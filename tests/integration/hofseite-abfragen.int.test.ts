/**
 * Zahl der SQL-Abfragen je Hofseiten-Anfrage (Nachtlauf 25, Nr. 180) — gegen ein
 * ECHTES Postgres. Eine Anfrage an `/[farmSlug]` lädt:
 *  - die Seite: ladeHofseite (über ladeHofseiteGeteilt auch für die Metadaten) und die Beiträge,
 *  - die Metadaten zusätzlich: das Teilen-Bild (ladeTeilenVorschau).
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
import { ladeTeilenVorschau } from '@/server/queries/teilen-bild'
import { getActiveStatusPosts } from '@/server/queries/status-posts'
import { erstelleHof, erstelleProdukt, raeumeAuf } from './setup/basis'

let abfragen: string[] = []
const original = pg.Client.prototype.query

beforeEach(() => {
  abfragen = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pg.Client.prototype.query = function (this: unknown, ...args: any[]) {
    const text = typeof args[0] === 'string' ? args[0] : (args[0]?.text as string | undefined)
    if (text) abfragen.push(text.trim().split(/\s+/).slice(0, 2).join(' '))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (original as any).apply(this, args)
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
    await Promise.all([
      // Metadaten: Hof (geteilt mit der Seite, einmal) und Teilen-Bild
      ladeHofseite(farm.slug, {}).then((e) => e.farm && getActiveStatusPosts(e.farm.id, 5)),
      ladeTeilenVorschau(farm.slug, new Date()),
    ])
    // Der Messwert steht im Bericht (docs/nachtlauf/berichte/180.md). Ein Test, der ihn nur ausgibt,
    // wäre keiner: Eine Abfrage mehr oder weniger soll auffallen.
    expect(selects()).toBe(GEZAEHLT)
  })
})

const GEZAEHLT = 14

/**
 * Die gecachte Hofliste (src/server/queries/oeffentliche-hoefe.ts) — EIN
 * Cache-Eintrag für Startseite und /hoefe.
 *
 * Beweist:
 *  - Schlüssel und Etikett sind HOEFE_CACHE_TAG, fünf Minuten — wer das
 *    Etikett leert (Produktaktionen), leert beide Seiten.
 *  - Startseite und /hoefe nutzen dieselbe Funktion und legen keinen eigenen
 *    Cache an (Gegenprobe: das Modul selbst ruft unstable_cache auf).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const aufrufe = vi.hoisted(() => [] as { schluessel: unknown; optionen: unknown }[])
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown, schluessel: unknown, optionen: unknown) => {
    aufrufe.push({ schluessel, optionen })
    return fn
  },
}))
vi.mock('@/server/queries/farm', () => ({ getOeffentlicheHoefe: async () => [{ slug: 'hof-a' }] }))

import { ladeOeffentlicheHoefe } from '@/server/queries/oeffentliche-hoefe'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

describe('ladeOeffentlicheHoefe', () => {
  it('ein Eintrag unter HOEFE_CACHE_TAG, fünf Minuten, mit Etikett', () => {
    // 'v5' (Nr. 131: `ausgebuchtAm` und `kalendertag`; 'v4' Nr. 127, 'v3' Nr. 129, 'v2' Nr. 120): Ein Eintrag von vor dem Deploy ohne die vollen Tage wird nie gelesen.
    expect(aufrufe).toEqual([{ schluessel: [HOEFE_CACHE_TAG, 'v5'], optionen: { revalidate: 300, tags: [HOEFE_CACHE_TAG] } }])
  })

  it('liefert die öffentlichen Höfe', async () => {
    await expect(ladeOeffentlicheHoefe()).resolves.toEqual([{ slug: 'hof-a' }])
  })

  it('Startseite und /hoefe nutzen dieselbe Funktion und keinen eigenen Cache', () => {
    // Die Startseite lädt ihre Höfe seit Nr. 182 im Baustein startseiten-inhalt (auch für die Vorschau).
    for (const seite of ['src/components/startseite/startseiten-inhalt.tsx', 'src/app/(public)/hoefe/page.tsx']) {
      const text = quelle(seite)
      expect(text, seite).toContain("from '@/server/queries/oeffentliche-hoefe'")
      expect(text, seite).toMatch(/\bladeOeffentlicheHoefe\(\)/)
      expect(text, seite).not.toMatch(/unstable_cache/)
    }
    // Gegenprobe: Die Suche findet unstable_cache, wo es steht.
    expect(quelle('src/server/queries/oeffentliche-hoefe.ts')).toMatch(/unstable_cache\(/)
  })
})

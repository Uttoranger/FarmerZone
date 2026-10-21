/**
 * Sentry-Filter, Nr. 125: Die Query-Werte `t` (Einmal-Token von „Das war ich nicht", /sicherheit/nicht-ich?t=)
 * und `vorschau` (signierter Inhalt der Startseiten-Vorschau, Hofseiten-Vorschau) sind heikle Parameter
 * (HEIKLE_PARAMETER in src/lib/sentry-hygiene.ts) — dieselbe Liste, die auch die CSP-Regeln „nie melden" nennen.
 *
 * Beweist: Beide fallen aus `request.url` und `query_string`; `t` nur als ganzer Name — `?tab=`, `?typ=`
 * und `?art=` bleiben stehen (Gegenprobe).
 */
import { describe, expect, it, vi } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'
import { bereinigeEreignis } from '@/lib/sentry-hygiene'

vi.mock('@sentry/nextjs', () => ({}))

const mitAdresse = (url: string, query_string: string): ErrorEvent => ({ request: { url, query_string } }) as ErrorEvent

describe('HEIKLE_PARAMETER — t und vorschau', () => {
  it('der Einmal-Token von „Das war ich nicht" (?t=) fällt weg', () => {
    const e = bereinigeEreignis(mitAdresse('https://example.com/sicherheit/nicht-ich?t=EinmalTokenAbc', 't=EinmalTokenAbc'))
    expect(e.request?.url).toBe('https://example.com/sicherheit/nicht-ich')
    expect(e.request?.query_string).toBe('')
  })

  it('der signierte Inhalt der Vorschau (?vorschau=) fällt weg, auch neben der Signatur', () => {
    const e = bereinigeEreignis(mitAdresse('https://example.com/?vorschau=aW5oYWx0&sig=ab12&seite=2', 'vorschau=aW5oYWx0&sig=ab12&seite=2'))
    expect(e.request?.url).toBe('https://example.com/?seite=2')
    expect(e.request?.query_string).toBe('seite=2')
  })

  it('Gegenprobe: ?tab=, ?typ= und ?art= bleiben — t zählt nur als ganzer Name', () => {
    const e = bereinigeEreignis(mitAdresse('https://example.com/dashboard?tab=heute&typ=futter&art=neu', 'tab=heute&typ=futter&art=neu'))
    expect(e.request?.url).toBe('https://example.com/dashboard?tab=heute&typ=futter&art=neu')
    expect(e.request?.query_string).toBe('tab=heute&typ=futter&art=neu')
  })
})

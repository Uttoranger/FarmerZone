/**
 * Der Filter vor Vercel Web Analytics (Nr. 172): Ereignisse auf Seiten mit
 * Token, Signatur oder Kennung in der Adresse werden verworfen, heikle
 * Query-Werte gestrichen. Die Listen stammen aus src/lib/csp.ts (eine Quelle).
 */
import { describe, expect, it } from 'vitest'
import { filtereAnalyticsEreignis, ANALYTICS_ZUSATZ_PFADE } from '@/lib/analytics-filter'
import { NIE_MELDEN_PARAMETER } from '@/lib/csp'
import konfiguration from '../next.config'

const BASIS = 'https://example.com'
const ereignis = (pfad: string) => ({ type: 'pageview' as const, url: `${BASIS}${pfad}` })

describe('filtereAnalyticsEreignis', () => {
  it('verwirft jede Seite aus NIE_MELDEN_PFADE (Beispiele je Eintrag)', () => {
    for (const pfad of ['/hof-test/bestellung/abc123', '/hof-test/bestellung/abc123/kalender', '/admin/postfach/zustellung/bestaetigen', '/api/checkout', '/api/a/b']) {
      expect(filtereAnalyticsEreignis(ereignis(pfad)), pfad).toBeNull()
    }
  })

  it('verwirft den Bar-Token-Pfad und die übrigen Seiten ohne Referrer', () => {
    for (const pfad of ['/hof-test/bestaetigen/TokenAbc', '/hof-test/confirm/bestellungA', '/verify', '/sicherheit/nicht-ich', '/reset-password', '/bestellungen', '/account/unsubscribe']) {
      expect(filtereAnalyticsEreignis(ereignis(pfad)), pfad).toBeNull()
    }
  })

  it('verwirft auch eigene Ereignisse auf solchen Seiten', () => {
    expect(filtereAnalyticsEreignis({ type: 'event', name: 'x', url: `${BASIS}/hof-test/bestaetigen/Tok` })).toBeNull()
  })

  it('streicht heikle Parameter, lässt die übrigen stehen', () => {
    for (const schluessel of NIE_MELDEN_PARAMETER) {
      const aus = filtereAnalyticsEreignis(ereignis(`/hof-test?${schluessel}=geheim&tab=produkte`))
      expect(aus?.url, schluessel).toBe(`${BASIS}/hof-test?tab=produkte`)
    }
  })

  it('Gegenprobe: eine gewöhnliche Seite bleibt unverändert', () => {
    const e = ereignis('/hof-test/produkt/eier?beitrag=abc#oben')
    expect(filtereAnalyticsEreignis(e)).toEqual(e)
    const ohneQuery = ereignis('/hoefe')
    expect(filtereAnalyticsEreignis(ohneQuery)).toBe(ohneQuery)
  })

  it('eine unlesbare Adresse wird verworfen statt durchgereicht', () => {
    expect(filtereAnalyticsEreignis({ type: 'pageview', url: 'http://[kaputt' })).toBeNull()
  })

  it('"/api" allein und "/apiary" sind keine API-Seiten (Gegenprobe zum Muster)', () => {
    expect(filtereAnalyticsEreignis(ereignis('/apiary'))).not.toBeNull()
  })
})

describe('Zusatzliste gegen next.config.ts', () => {
  it('jede Seite mit Referrer-Policy no-referrer steht in der Filterliste', async () => {
    const regeln = (await konfiguration.headers!()) as { source: string; headers: { key: string; value: string }[] }[]
    const quellen = regeln.filter((r) => r.headers.some((h) => h.key === 'Referrer-Policy' && h.value === 'no-referrer')).map((r) => r.source)
    expect(quellen.length).toBeGreaterThan(5)
    expect([...quellen].sort()).toEqual([...ANALYTICS_ZUSATZ_PFADE].sort())
  })
})

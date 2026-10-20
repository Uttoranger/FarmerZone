/**
 * Die Content-Security-Policy zum Beobachten (Register G8, Nr. 125) — reine Regeln aus src/lib/csp.ts.
 *
 * Beweist:
 *  - baueCsp liefert alle Anweisungen der Freigabe mit den belegten Hosts; mit `melden` kommen
 *    report-uri und report-to dazu, ohne nicht.
 *  - Der Sentry-Host kommt nur aus der DSN (nur der Host, nie Schlüssel oder Projekt), ohne DSN keiner.
 *  - Die Vercel-Toolbar nur auf Vorschauen; die Kartenkacheln aus der einen Kartenadresse.
 *  - Eine Meldung behält nur Anweisung, Schema und Host bzw. Stichwort und den Pfad (Kennungen nach
 *    /bestaetigen/, /confirm/, /bestellung/ als :id) — Query, Fragment, Ausschnitt, Referrer und die
 *    ganze Policy fallen weg; beide Formate (report-uri und Reporting API).
 *  - Entdoppeln: dieselbe Meldung höchstens einmal je Stunde, höchstens 500 Einträge.
 */
import { describe, expect, it } from 'vitest'
import {
  CSP_ENTDOPPELN_MAX,
  baueCsp,
  cspBerichtAdresse,
  cspBerichtArt,
  istNeueCspMeldung,
  leseCspMeldungen,
  sentryHost,
} from '@/lib/csp'
import { KARTEN_KACHELN } from '@/lib/hoefe-anzeige'

/** Die Policy als Karte Anweisung → Quellen. */
function zerlege(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(';').map((teil) => {
      const [name, ...quellen] = teil.trim().split(/\s+/)
      return [name, quellen] as const
    })
  )
}

const DSN = 'https://abcdefSchluessel@o4501.ingest.de.sentry.io/4502'

describe('baueCsp', () => {
  it('enthält jede Anweisung der Freigabe mit ihren Quellen', () => {
    const p = zerlege(baueCsp({ melden: false }))
    const kacheln = new URL(KARTEN_KACHELN.url.replace(/\{[a-z]\}/g, '0')).origin
    expect(kacheln).toBe('https://tile.openstreetmap.org')
    expect(Object.fromEntries(p)).toEqual({
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:', kacheln, 'https://*.public.blob.vercel-storage.com'],
      'font-src': ["'self'"],
      'connect-src': ["'self'", 'https://vercel.com'],
      'frame-src': ['https://js.stripe.com'],
      'worker-src': ["'self'", 'blob:'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
    })
  })

  it('mit melden kommen report-uri und report-to dazu — ohne nicht, sonst bleibt alles gleich', () => {
    const mit = zerlege(baueCsp({ melden: true, berichtAdresse: 'https://example.com/api/csp-bericht' }))
    const ohne = zerlege(baueCsp({ melden: false }))
    expect(mit.get('report-uri')).toEqual(['/api/csp-bericht'])
    expect(mit.get('report-to')).toEqual(['csp'])
    expect(ohne.has('report-uri')).toBe(false)
    expect(ohne.has('report-to')).toBe(false)
    mit.delete('report-uri')
    mit.delete('report-to')
    expect(mit).toEqual(ohne)
  })

  it('ohne absolute Berichtsadresse kein report-to — Chromium ließe sonst auch report-uri fallen', () => {
    const p = zerlege(baueCsp({ melden: true }))
    expect(p.get('report-uri')).toEqual(['/api/csp-bericht'])
    expect(p.has('report-to')).toBe(false)
  })

  it('die Berichtsadresse ist absolut und nur https: aus NEXT_PUBLIC_APP_URL die Herkunft plus Pfad', () => {
    expect(cspBerichtAdresse('https://example.com')).toBe('https://example.com/api/csp-bericht')
    expect(cspBerichtAdresse('https://example.com/irgendwo?x=1')).toBe('https://example.com/api/csp-bericht')
    expect(cspBerichtAdresse('http://localhost:3000')).toBeNull()
    expect(cspBerichtAdresse('kein Link')).toBeNull()
    expect(cspBerichtAdresse(undefined)).toBeNull()
  })

  it('der Sentry-Host kommt nur aus der DSN — nur der Host, ohne DSN keiner', () => {
    expect(zerlege(baueCsp({ melden: true, sentryDsn: DSN })).get('connect-src')).toEqual([
      "'self'",
      'https://o4501.ingest.de.sentry.io',
      'https://vercel.com',
    ])
    expect(baueCsp({ melden: true, sentryDsn: DSN })).not.toContain('abcdefSchluessel')
    expect(baueCsp({ melden: true, sentryDsn: DSN })).not.toContain('4502')
    expect(baueCsp({ melden: true })).not.toContain('sentry')
    expect(baueCsp({ melden: true, sentryDsn: '' })).not.toContain('sentry')
    expect(sentryHost('kein Link')).toBeNull()
    expect(sentryHost('http://o1.ingest.sentry.io/1')).toBeNull()
  })

  it('die Vercel-Toolbar nur auf Vorschauen, nie in der Produktion', () => {
    const vorschau = zerlege(baueCsp({ melden: false, toolbar: true }))
    for (const anweisung of ['script-src', 'connect-src', 'frame-src', 'img-src', 'style-src', 'font-src']) {
      expect(vorschau.get(anweisung), anweisung).toContain('https://vercel.live')
    }
    expect(baueCsp({ melden: true })).not.toContain('vercel.live')
  })
})

describe('cspBerichtArt', () => {
  it('kennt nur die beiden Formate der Browser, auch mit Zeichensatz', () => {
    expect(cspBerichtArt('application/csp-report')).toBe('csp-report')
    expect(cspBerichtArt('Application/Reports+JSON; charset=utf-8')).toBe('reports+json')
    expect(cspBerichtArt('application/json')).toBeNull()
    expect(cspBerichtArt(null)).toBeNull()
  })
})

describe('leseCspMeldungen — nur Anweisung, Host und Pfad', () => {
  it('report-uri: Query, Fragment, Ausschnitt, Referrer und Policy fallen weg', () => {
    const meldungen = leseCspMeldungen('csp-report', {
      'csp-report': {
        'document-uri': 'https://example.com/hof-test/produkt-a?vorschau=1&q=suche#oben',
        referrer: 'https://example.com/hoefe?q=geheim',
        'violated-directive': 'script-src-elem',
        'effective-directive': 'script-src-elem',
        'original-policy': "default-src 'self'; report-uri /api/csp-bericht",
        'blocked-uri': 'https://fremd.example.org/skript.js?token=abc#x',
        'script-sample': 'alert(1)',
        'source-file': 'https://example.com/_next/static/chunk.js',
      },
    })
    expect(meldungen).toEqual([{ anweisung: 'script-src-elem', host: 'https://fremd.example.org', pfad: '/hof-test/produkt-a' }])
    const text = JSON.stringify(meldungen)
    for (const weg of ['vorschau', 'suche', 'oben', 'geheim', 'token', 'alert', 'report-uri', 'chunk']) expect(text).not.toContain(weg)
  })

  it('Kennungen nach /bestaetigen/, /confirm/ und /bestellung/ werden zu :id', () => {
    const pfad = (adresse: string) =>
      leseCspMeldungen('csp-report', { 'csp-report': { 'document-uri': adresse, 'effective-directive': 'img-src', 'blocked-uri': 'data' } })[0].pfad
    expect(pfad('https://example.com/hof-test/bestaetigen/AbcDefGhi')).toBe('/hof-test/bestaetigen/:id')
    expect(pfad('https://example.com/hof-test/confirm/bestellungA?sig=ab')).toBe('/hof-test/confirm/:id')
    expect(pfad('https://example.com/hof-test/bestellung/bestellungA/kalender')).toBe('/hof-test/bestellung/:id/kalender')
    expect(pfad('https://example.com/api/orders/confirm/TokenAbc')).toBe('/api/orders/confirm/:id')
  })

  it('Stichwörter statt Adresse: inline, eval, data, blob — alles andere ohne Adresse heißt „unbekannt"', () => {
    const host = (blockiert: string) =>
      leseCspMeldungen('csp-report', { 'csp-report': { 'document-uri': 'https://example.com/', 'effective-directive': 'script-src', 'blocked-uri': blockiert } })[0].host
    expect(['inline', 'eval', 'data', 'blob'].map(host)).toEqual(['inline', 'eval', 'data', 'blob'])
    expect(host('data:image/png;base64,AAAA')).toBe('data')
    expect(host('blob:https://example.com/abc')).toBe('blob')
    expect(host('wss://echo.example.org:8443/pfad')).toBe('wss://echo.example.org:8443')
    expect(host('https://name:passwort@fremd.example.org/x')).toBe('https://fremd.example.org')
    expect(host('irgendwas')).toBe('unbekannt')
  })

  it('Reporting API: nur Einträge der Art csp-violation, die Anweisung aus dem Körper', () => {
    const meldungen = leseCspMeldungen('reports+json', [
      {
        type: 'csp-violation',
        url: 'https://example.com/region?ansicht=karte',
        body: {
          documentURL: 'https://example.com/region?ansicht=karte',
          effectiveDirective: 'img-src',
          blockedURL: 'https://tile.example.org/1/2/3.png',
          sample: 'geheimerText',
          referrer: 'https://example.com/?token=abc',
          originalPolicy: "default-src 'self'",
        },
      },
      { type: 'deprecation', url: 'https://example.com/', body: { id: 'x' } },
    ])
    expect(meldungen).toEqual([{ anweisung: 'img-src', host: 'https://tile.example.org', pfad: '/region' }])
  })

  it('unbekannte Gestalt oder kaputte Anweisung: keine Meldung bzw. „unbekannt"', () => {
    expect(leseCspMeldungen('csp-report', { anders: 1 })).toEqual([])
    expect(leseCspMeldungen('reports+json', { kein: 'feld' })).toEqual([])
    expect(
      leseCspMeldungen('csp-report', { 'csp-report': { 'document-uri': 'relativ/pfad', 'violated-directive': "script-src 'self' x", 'blocked-uri': 'inline' } })
    ).toEqual([{ anweisung: 'script-src', host: 'inline', pfad: 'unbekannt' }])
    expect(leseCspMeldungen('csp-report', { 'csp-report': { 'effective-directive': '<b>x</b>' } })[0].anweisung).toBe('unbekannt')
  })
})

describe('istNeueCspMeldung — entdoppeln je Instanz', () => {
  const m = { anweisung: 'img-src', host: 'https://fremd.example.org', pfad: '/' }
  const T = Date.UTC(2026, 9, 7, 12)

  it('dieselbe Meldung höchstens einmal je Stunde; anderer Pfad oder Host zählt neu', () => {
    const gesehen = new Map<string, number>()
    expect(istNeueCspMeldung(gesehen, m, T)).toBe(true)
    expect(istNeueCspMeldung(gesehen, m, T + 59 * 60_000)).toBe(false)
    expect(istNeueCspMeldung(gesehen, { ...m, pfad: '/hoefe' }, T)).toBe(true)
    expect(istNeueCspMeldung(gesehen, { ...m, host: 'inline' }, T)).toBe(true)
    expect(istNeueCspMeldung(gesehen, m, T + 60 * 60_000)).toBe(true)
  })

  it('hält höchstens 500 Einträge — Abgelaufenes zuerst, dann das Älteste', () => {
    const gesehen = new Map<string, number>()
    istNeueCspMeldung(gesehen, { ...m, pfad: '/alt' }, T - 2 * 60 * 60_000)
    for (let i = 0; gesehen.size < CSP_ENTDOPPELN_MAX; i += 1) istNeueCspMeldung(gesehen, { ...m, pfad: `/p${i}` }, T)
    istNeueCspMeldung(gesehen, { ...m, pfad: '/neu' }, T)
    expect(gesehen.size).toBe(CSP_ENTDOPPELN_MAX)
    expect([...gesehen.keys()].some((k) => k.endsWith('|/alt'))).toBe(false)
    istNeueCspMeldung(gesehen, { ...m, pfad: '/neu2' }, T)
    expect(gesehen.size).toBe(CSP_ENTDOPPELN_MAX)
    expect([...gesehen.keys()].some((k) => k.endsWith('|/p0'))).toBe(false)
  })
})

/**
 * Tests für die Security-Header in next.config.ts.
 *
 * Beweist:
 *  - Jede Seite ist gegen Einbetten gesperrt (X-Frame-Options DENY) — auch die
 *    Hofseite ohne Parameter, ihre Unterseiten und jede andere Route, selbst
 *    mit ?vorschau=1.
 *  - Nur die Hofseite MIT ?vorschau=1 darf sich selbst einbetten
 *    (SAMEORIGIN, frame-ancestors 'self'): der Editor zeigt sie im iframe.
 *  - Die Ausschlussliste der Nicht-Hofseiten deckt jeden Routenordner unter
 *    src/app ab — ein neuer Ordner fällt hier auf.
 *  - Die Regel für /hoefe (Standort) bleibt.
 *  - Seiten mit Token in der Adresse schicken keinen Referrer und stehen in
 *    keinem Suchindex — seit Nr. 54 auch /reset-password, wie /verify; die mit
 *    Nr. 54 umgezogenen Seiten behalten ihre Header.
 *
 * Gematcht wird mit Nexts eigenem Pfadvergleich (path-to-regexp), nicht mit
 * einer Nachbildung — so gilt auch die Lookahead-Schreibweise der Quelle.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match'
import { matchHas } from 'next/dist/shared/lib/router/utils/prepare-destination'
import { ansichtsModus } from '@/lib/ansichts-modus'

type Regel = {
  source: string
  has?: { type: string; key: string; value?: string }[]
  headers: { key: string; value: string }[]
}

let regeln: Regel[] = []

beforeAll(async () => {
  // Die Konfiguration ist von Sentry umschlossen; headers() bleibt unberührt.
  const { default: konfiguration } = await import('../next.config')
  regeln = (await konfiguration.headers!()) as Regel[]
}, 30_000)

/**
 * Was der Browser für einen Pfad samt Query bekommt — spätere Regeln
 * überschreiben frühere (Next-Doku „headers"). Pfad und `has` vergleicht
 * Nexts eigener Code (path-to-regexp, matchHas), nicht eine Nachbildung.
 */
function headerFuer(pfad: string, query: Record<string, string | string[]> = {}): Record<string, string> {
  const ergebnis: Record<string, string> = {}
  for (const regel of regeln) {
    if (!getPathMatch(regel.source)(pfad)) continue
    // Ohne Header und Cookies — unsere Regeln fragen nur die Query.
    if (regel.has && !matchHas({ headers: {} } as never, query, regel.has as never)) continue
    for (const h of regel.headers) ergebnis[h.key] = h.value
  }
  return ergebnis
}

/** Jeder Routenordner auf oberster Ebene, durch die Routengruppen hindurch. */
function routenOrdner(): string[] {
  const wurzel = join(process.cwd(), 'src/app')
  const namen: string[] = []
  for (const eintrag of readdirSync(wurzel)) {
    const pfad = join(wurzel, eintrag)
    if (!statSync(pfad).isDirectory()) continue
    if (eintrag.startsWith('(')) {
      for (const unter of readdirSync(pfad)) {
        if (statSync(join(pfad, unter)).isDirectory() && !unter.startsWith('[')) namen.push(unter)
      }
    } else if (!eintrag.startsWith('[')) {
      namen.push(eintrag)
    }
  }
  return namen.sort()
}

describe('Einbetten', () => {
  it('die Hofseite ohne Parameter bleibt gesperrt', () => {
    const h = headerFuer('/hof-test')
    expect(h['X-Frame-Options']).toBe('DENY')
    expect(h['Content-Security-Policy']).toBeUndefined()
  })

  it('nur die Hofseite mit ?vorschau=1 darf sich selbst einbetten', () => {
    const h = headerFuer('/hof-test', { vorschau: '1' })
    expect(h['X-Frame-Options']).toBe('SAMEORIGIN')
    expect(h['Content-Security-Policy']).toBe("frame-ancestors 'self'")
    // Die übrigen Header bleiben.
    expect(h['X-Content-Type-Options']).toBe('nosniff')
  })

  it('ein anderer Wert des Parameters öffnet nichts', () => {
    expect(headerFuer('/hof-test', { vorschau: '0' })['X-Frame-Options']).toBe('DENY')
    expect(headerFuer('/hof-test', { vorschau: '' })['X-Frame-Options']).toBe('DENY')
    expect(headerFuer('/hof-test', { vorschau: '11' })['X-Frame-Options']).toBe('DENY')
  })

  it('steht der Parameter mehrfach, zählt bei Next der letzte Wert — ansichtsModus liest ihn genauso', async () => {
    expect(headerFuer('/hof-test', { vorschau: ['0', '1'] })['X-Frame-Options']).toBe('SAMEORIGIN')
    expect(headerFuer('/hof-test', { vorschau: ['1', '0'] })['X-Frame-Options']).toBe('DENY')
    // Dieselbe Adresse, derselbe Schluss: Vorschau genau dort, wo der Rahmen erlaubt ist.
    const besitzer = { angemeldeterNutzer: async () => 'user_hof', besitzer: async () => 'user_hof' }
    expect((await ansichtsModus({ vorschau: ['0', '1'] }, besitzer)).art).toBe('vorschau')
    expect((await ansichtsModus({ vorschau: ['1', '0'] }, besitzer)).art).toBe('kundin')
  })

  it('Unterseiten der Hofseite und die Startseite bleiben gesperrt, auch mit Parameter', () => {
    for (const pfad of ['/hof-test/bestellung/abc', '/hof-test/confirm/xyz', '/']) {
      expect(headerFuer(pfad, { vorschau: '1' })['X-Frame-Options'], pfad).toBe('DENY')
    }
  })

  it('jede andere Route bleibt gesperrt, auch mit ?vorschau=1 — die Liste deckt jeden Ordner unter src/app', () => {
    const ordner = routenOrdner()
    expect(ordner.length).toBeGreaterThan(10)
    for (const name of ordner) {
      expect(headerFuer(`/${name}`, { vorschau: '1' })['X-Frame-Options'], name).toBe('DENY')
    }
  })

  it('ein Slug, der eine Route nur als Anfang trägt, ist trotzdem eine Hofseite', () => {
    expect(headerFuer('/login-hof', { vorschau: '1' })['X-Frame-Options']).toBe('SAMEORIGIN')
    expect(headerFuer('/hoefe-am-berg', { vorschau: '1' })['X-Frame-Options']).toBe('SAMEORIGIN')
  })
})

describe('Standort', () => {
  it('nur /hoefe darf nach dem Standort fragen', () => {
    expect(headerFuer('/hoefe')['Permissions-Policy']).toContain('geolocation=(self)')
    expect(headerFuer('/hof-test')['Permissions-Policy']).toContain('geolocation=()')
    expect(headerFuer('/dashboard')['Permissions-Policy']).toContain('geolocation=()')
  })
})

describe('Bestätigungsseite', () => {
  it('schickt keinen Referrer und steht in keinem Suchindex — die Adresse trägt die Signatur', () => {
    const header = headerFuer('/hof-test/confirm/order-1', { sig: 'abc' })
    expect(header['Referrer-Policy']).toBe('no-referrer')
    expect(header['X-Robots-Tag']).toBe('noindex, nofollow')
  })

  it('die Seite der Bar-Bestätigung genauso — die Adresse trägt den Einmal-Token (H3)', () => {
    const header = headerFuer('/hof-test/bestaetigen/V1StGXR8_Z5jdHi6BmyT9pqLnv2wYc4k')
    expect(header['Referrer-Policy']).toBe('no-referrer')
    expect(header['X-Robots-Tag']).toBe('noindex, nofollow')
  })

  it('der Mail-Link, der dorthin weiterleitet, auch', () => {
    const header = headerFuer('/api/orders/confirm/V1StGXR8_Z5jdHi6BmyT9pqLnv2wYc4k')
    expect(header['Referrer-Policy']).toBe('no-referrer')
    expect(header['X-Robots-Tag']).toBe('noindex, nofollow')
  })

  it('„Bestellungen finden" genauso — nach dem Code stehen dort Beträge und signierte Links (Nr. 14)', () => {
    const header = headerFuer('/bestellungen')
    expect(header['Referrer-Policy']).toBe('no-referrer')
    expect(header['X-Robots-Tag']).toBe('noindex, nofollow')
    // Keine Hofseite — und damit auch keine Einbettung, auch nicht mit ?vorschau=1.
    expect(headerFuer('/bestellungen', { vorschau: '1' })['X-Frame-Options']).toBe('DENY')
  })

  it('„Anmeldung bestätigen", der Abmeldelink und die Ein-Klick-Abmeldung genauso — die Adresse trägt den Token (Nr. 38, Nr. 47)', () => {
    for (const pfad of ['/account/neuigkeiten-bestaetigen', '/account/unsubscribe', '/api/abmelden']) {
      const header = headerFuer(pfad, { token: 'abc.def' })
      expect(header['Referrer-Policy'], pfad).toBe('no-referrer')
      expect(header['X-Robots-Tag'], pfad).toBe('noindex, nofollow')
    }
    // Gegenprobe: das Konto selbst behält die allgemeine Regel.
    expect(headerFuer('/account/profile')['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })

  it('die übrigen Seiten behalten ihre Referrer-Regel — Gegenprobe', () => {
    expect(headerFuer('/hof-test')['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headerFuer('/hof-test/bestellung/order-1')['X-Robots-Tag']).toBeUndefined()
  })
})

describe('Passwort zurücksetzen (Nr. 54)', () => {
  it('/reset-password schickt keinen Referrer und steht in keinem Suchindex — die Adresse trägt den Token, wie /verify', () => {
    const header = headerFuer('/reset-password', { token: 'abc' })
    expect(header['Referrer-Policy']).toBe('no-referrer')
    expect(header['X-Robots-Tag']).toBe('noindex, nofollow')
    // Dieselbe Regel wie /verify, Wort für Wort.
    const verify = headerFuer('/verify', { token: 'abc' })
    expect(header['Referrer-Policy']).toBe(verify['Referrer-Policy'])
    expect(header['X-Robots-Tag']).toBe(verify['X-Robots-Tag'])
    // Die übrigen Header bleiben, auch die Sperre gegen Einbetten.
    expect(header['X-Frame-Options']).toBe('DENY')
    expect(header['X-Content-Type-Options']).toBe('nosniff')
  })

  it('„Passwort vergessen" trägt keinen Token und behält die allgemeine Regel — Gegenprobe', () => {
    expect(headerFuer('/forgot-password')['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headerFuer('/forgot-password')['X-Robots-Tag']).toBeUndefined()
  })
})

describe('Die Seiten, die mit Nr. 54 in eine Shell umgezogen sind, behalten ihre Header', () => {
  it('Bar-Bestätigung: Token im Pfad — kein Referrer, kein Suchindex', () => {
    const header = headerFuer('/hof-test/bestaetigen/V1StGXR8_Z5jdHi6BmyT9pqLnv2wYc4k')
    expect(header['Referrer-Policy']).toBe('no-referrer')
    expect(header['X-Robots-Tag']).toBe('noindex, nofollow')
  })

  it('Bestellseite: unverändert die allgemeine Regel — fremde Ziele bekommen nur die Herkunft; noindex steht in den Metadaten', () => {
    // Unverändert seit vor Nr. 54 (freigabe.md §13: Referrer-Policy bleibt). Die
    // Signatur (?s=) verlässt die Seite so nie Richtung eines fremden Ziels;
    // Sentry entfernt `s` aus Adressen und dem Referer (sentry-hygiene.ts).
    const header = headerFuer('/hof-test/bestellung/order-1', { s: 'f'.repeat(64) })
    expect(header['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(header['X-Frame-Options']).toBe('DENY')
  })

  it('Impressum, Konditionen, Problem melden: allgemeine Regel, keine Einbettung', () => {
    for (const pfad of ['/impressum', '/konditionen', '/problem-melden']) {
      expect(headerFuer(pfad)['Referrer-Policy'], pfad).toBe('strict-origin-when-cross-origin')
      expect(headerFuer(pfad, { vorschau: '1' })['X-Frame-Options'], pfad).toBe('DENY')
    }
  })
})

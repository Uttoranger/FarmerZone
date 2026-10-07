/**
 * Nr. 22c: /region als eigene Route in der HofShell, /analytics/umfeld leitet
 * um (Gate 8 „alte URL leitet um"), die Navigation zeigt auf /region, die
 * Auswertung liegt in der HofShell — mit Teilen-Karte und „Servicegebühren
 * dieses Monats" ohne SEPA bis zum Stichtag (B1, K1).
 *
 * Beweist:
 *  - die Adresse von /region (Reiter, Futter-Filter) über Zod, Unsinn fällt still weg,
 *  - die Umleitung trägt Umkreis, Bereich und Karte mit, sonst nichts,
 *  - Routen liegen unter (hof), (farmer)/analytics gibt es nicht mehr,
 *  - die Karten rendern nur mit Tokens, ohne Lastschrift vor dem Stichtag,
 *    ohne Zahl oder Datum im Quelltext der Servicegebühren.
 */
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
const umgeleitet = vi.fn((ziel: string) => {
  throw new Error(`NEXT_REDIRECT:${ziel}`)
})
vi.mock('next/navigation', () => ({ redirect: (ziel: string) => umgeleitet(ziel) }))

import { REGION_HREF, hofAktiverPunkt, hofNavigation } from '@/lib/bauern-navigation'
import { futterKaufenLink, leseFutterKaufenFilter, leseRegionReiter, regionReiterLink } from '@/schemas/region'
import { umfeldLink, umfeldUmleitung } from '@/schemas/umfeld-filter'
import UmfeldUmleitung from '@/app/(hof)/analytics/umfeld/page'
import { RegionKopf } from '@/components/region/region-kopf'
import { FutterKaufenAnsicht } from '@/components/region/futter-kaufen-ansicht'
import { ServicegebuehrenKarte, TeilenWirkungKarte } from '@/components/auswertung/auswertung-teile'
import { baueFutterKaufen } from '@/lib/futter-kaufen'
import { servicegebuehrenSaetze, teilenKarte } from '@/lib/auswertung'
import { fasseTeilenWirkungZusammen } from '@/lib/teilen-wirkung'
import { TEILEN_ZAEHLUNG_HINWEIS } from '@/lib/teilen-kanal'
import { BAR_OHNE_GEBUEHR_SATZ, BAR_SERVICEGEBUEHR_AB } from '@/lib/konditionen'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')
const gibt = (pfad: string) => existsSync(join(process.cwd(), pfad))

describe('Adresse von /region', () => {
  it('Reiter: „futter" oder Standard „preise"; Unsinn und Listen fallen still zurück', () => {
    expect(leseRegionReiter('futter')).toBe('futter')
    expect(leseRegionReiter(['futter', 'preise'])).toBe('futter')
    expect(leseRegionReiter('<script>')).toBe('preise')
    expect(leseRegionReiter(undefined)).toBe('preise')
  })

  it('Futter-Filter: Umkreis, Art, Menge nur aus erlaubten Werten', () => {
    expect(leseFutterKaufenFilter({ km: '50', art: 'HEU_STROH', menge: 'gross' })).toEqual({ km: 50, art: 'HEU_STROH', menge: 'gross' })
    expect(leseFutterKaufenFilter({ km: '7', art: 'EIER', menge: 'riesig' })).toEqual({ km: 25, art: null, menge: null })
    // Die Altlast ist kein wählbarer Filter.
    expect(leseFutterKaufenFilter({ art: 'FUTTERMITTEL' }).art).toBeNull()
  })

  it('Links: Standards ausgelassen, der Umkreis geht beim Reiterwechsel mit', () => {
    expect(futterKaufenLink({ km: 25, art: null, menge: null })).toBe('/region?reiter=futter&km=25')
    expect(futterKaufenLink({ km: 10, art: 'GETREIDE_KOERNER', menge: 'klein' })).toBe('/region?reiter=futter&km=10&art=GETREIDE_KOERNER&menge=klein')
    expect(regionReiterLink('preise', 50)).toBe('/region?km=50')
    expect(regionReiterLink('futter', 50)).toBe('/region?reiter=futter&km=50')
    expect(umfeldLink({ km: 10, bereich: 'FUTTERMITTEL' })).toBe('/region?km=10&bereich=futter')
  })
})

describe('/analytics/umfeld leitet nach /region um', () => {
  it('trägt Umkreis, Bereich und Karte mit — nur gültige Werte', () => {
    expect(umfeldUmleitung({ km: '50', bereich: 'futter', ansicht: 'karte' })).toBe('/region?km=50&bereich=futter&ansicht=karte')
    expect(umfeldUmleitung({ km: '10' })).toBe('/region?km=10')
    expect(umfeldUmleitung({ km: '999', bereich: 'javascript:', ansicht: 'liste', fremd: 'x' } as never)).toBe('/region')
    expect(umfeldUmleitung({})).toBe(REGION_HREF)
  })

  it('die Seite selbst leitet um (307 über redirect) und lädt nichts', async () => {
    await expect(UmfeldUmleitung({ searchParams: Promise.resolve({ km: '25', bereich: 'hofladen' }) })).rejects.toThrow(
      'NEXT_REDIRECT:/region?km=25&bereich=hofladen'
    )
    expect(umgeleitet).toHaveBeenCalledWith('/region?km=25&bereich=hofladen')
    const seite = quelle('src/app/(hof)/analytics/umfeld/page.tsx')
    expect(seite).not.toMatch(/prisma|getUmfeld|permanentRedirect\(/)
  })
})

describe('Routen und Navigation', () => {
  it('Region und Auswertung liegen unter (hof), (farmer)/analytics gibt es nicht mehr', () => {
    expect(gibt('src/app/(farmer)/analytics')).toBe(false)
    for (const datei of ['analytics/page.tsx', 'analytics/loading.tsx', 'analytics/umfeld/page.tsx', 'region/page.tsx', 'region/loading.tsx']) {
      expect(gibt(`src/app/(hof)/${datei}`), datei).toBe(true)
    }
  })

  it('„Region" zeigt auf /region und leuchtet dort, auch mit Reiter', () => {
    const region = hofNavigation({ isAdmin: false }).verkaufUndKunden.find((p) => p.id === 'region')
    expect(region?.href).toBe('/region')
    expect(hofAktiverPunkt('/region')).toBe('region')
  })

  it('beide Seiten fragen mit der farmId aus der Sitzung, nie aus der Adresse', () => {
    for (const datei of ['src/app/(hof)/region/page.tsx', 'src/app/(hof)/analytics/page.tsx']) {
      const text = quelle(datei)
      expect(text).toContain('getFarmForUser(session.user.id)')
      expect(text).not.toMatch(/searchParams\)?\.(farmId|hof)/)
    }
  })

  it('Servicegebühren: keine Zahl, kein Datum, kein SEPA-Abschnitt im Quelltext der Karte', () => {
    const teile = quelle('src/components/auswertung/auswertung-teile.tsx')
    const karte = teile.slice(teile.indexOf('export function ServicegebuehrenKarte'), teile.indexOf('// ─── Kanäle'))
    expect(karte).not.toMatch(/2027|Februar|Lastschrift|SEPA|\d+ ?%/)
  })
})

describe('Karten im neuen Design', () => {
  it('RegionKopf: zwei Reiter als Links, der offene mit aria-current', () => {
    const html = renderToStaticMarkup(createElement(RegionKopf, { reiter: 'futter', km: 25 }))
    expect(html).toContain('<h1')
    expect(html).toMatch(/href="\/region\?reiter=futter&amp;km=25"[^>]*aria-current="page"/)
    expect(html).toContain('href="/region?km=25"')
  })

  it('Futter kaufen: Schild nach E9, Bestellen führt zur Produktseite, Filter sind Links', () => {
    const ansicht = baueFutterKaufen({
      hoefe: [
        {
          id: 'h',
          slug: 'testhof',
          name: 'Testhof',
          entfernungKm: 3,
          betriebsnummer: 'LFBIS 1234567',
          betriebsstatus: 'PRIMAERPRODUKTION',
          abholfenster: [],
        },
      ],
      produkte: [
        {
          id: 'p',
          farmId: 'h',
          name: 'Heu Rundballen',
          familieId: null,
          category: 'HEU_STROH',
          price: 40,
          isAvailable: true,
          stock: 2,
          reservedStock: 0,
          verpackung: 'LOSE_BALLEN',
          futter: { nettoMenge: 250, nettoEinheit: 'KG', betriebsnummer: '1234567' },
        },
      ],
      ohneStandort: [],
      abgeschnitten: false,
      filter: { km: 25, art: null, menge: null },
      jetzt: { wochentag: 1, uhrzeit: '10:00' },
    })
    const html = renderToStaticMarkup(createElement(FutterKaufenAnsicht, { ansicht, filter: { km: 25, art: null, menge: null } }))
    expect(html).toContain('Futtermittelbetrieb · LFBIS 1234567')
    expect(html).not.toMatch(/geprüft/i)
    expect(html).toContain('href="/testhof/produkt/p"')
    expect(html).toContain('href="/region?reiter=futter&amp;km=25&amp;art=HEU_STROH"')
    expect(html).toContain('href="/products?neu=1&amp;bereich=futter"')
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i)
  })

  it('Servicegebühren dieses Monats vor dem Stichtag: Summe, Bar-Ausnahme, keine Lastschrift', () => {
    const jetzt = new Date(BAR_SERVICEGEBUEHR_AB.getTime() - 30 * 24 * 3600 * 1000)
    const html = renderToStaticMarkup(
      createElement(ServicegebuehrenKarte, {
        monat: { monat: '2027-01', onlineCents: 153, onlineAnzahl: 3, vorOrtCents: 0, vorOrtAnzahl: 0, summeCents: 153, bezeichnung: 'Jänner 2027' },
        saetze: servicegebuehrenSaetze(jetzt),
      })
    )
    expect(html).toContain('Servicegebühren dieses Monats')
    expect(html).toContain('€ 1,53')
    expect(html).toContain(BAR_OHNE_GEBUEHR_SATZ)
    expect(html).not.toMatch(/Lastschrift|SEPA|Grundgebühr|Vor Ort bezahlt/)
  })

  it('Teilen-Karte: Kanäle mit Balken, ohne Besuche ein Ausweg nach Heute', () => {
    const voll = renderToStaticMarkup(
      createElement(TeilenWirkungKarte, {
        karte: teilenKarte(fasseTeilenWirkungZusammen([{ kanal: 'QR', besuche: 9 }])),
        zeitraum: 'Oktober 2026',
      })
    )
    expect(voll).toContain('Über deine geteilten Links')
    expect(voll).toContain('9 Besuche')
    // T1: nur Besuche — keine Bestellungen, kein Euro-Betrag; der Satz zur Zählung aus der einen Quelle.
    expect(voll).not.toMatch(/Bestellung|€/)
    expect(voll).toContain(TEILEN_ZAEHLUNG_HINWEIS)
    const leer = renderToStaticMarkup(createElement(TeilenWirkungKarte, { karte: { kopf: null, zeilen: [] }, zeitraum: 'Diese Woche' }))
    expect(leer).toContain('href="/dashboard"')
    expect(leer).toContain(TEILEN_ZAEHLUNG_HINWEIS)
    expect(leer).not.toMatch(/Bestellung|€/)
  })
})

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
 *    ohne Zahl oder Datum im Quelltext der Servicegebühren,
 *  - seit Nr. 53 heißen die beiden Umsatzzahlen „Über MARKE"
 *    (Bestellungen) und „Mit Hofladen" (mit Direktverkäufen), aus EINER
 *    Quelle (UMSATZ_TEXT) — nie „Gesamt" (Register F6).
 */
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MARKE } from '@/lib/marke'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
  // Umkreis und Reiter tragen seit Nr. 122 den Ladepunkt (useLinkStatus) — hier lädt nie etwas.
  useLinkStatus: () => ({ pending: false }),
}))
const umgeleitet = vi.fn((ziel: string) => {
  throw new Error(`NEXT_REDIRECT:${ziel}`)
})
// Futter kaufen liest seit Nr. 123 die Ansicht aus der Adresse (Liste | Karte im Browser).
const suchParameter = vi.hoisted(() => ({ wert: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  redirect: (ziel: string) => umgeleitet(ziel),
  usePathname: () => '/region',
  useSearchParams: () => suchParameter.wert,
}))
// Die Karte kommt per dynamic import erst beim Umschalten — hier ein Platzhalter mit Merkmal.
vi.mock('next/dynamic', () => ({ default: () => () => createElement('div', { 'data-karte': 'futter' }) }))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => createElement('img', { src, alt }) }))

import { REGION_HREF, hofAktiverPunkt, hofNavigation } from '@/lib/bauern-navigation'
import { futterKaufenLink, leseFutterAnsicht, leseFutterKaufenFilter, leseRegionReiter, regionReiterLink } from '@/schemas/region'
import { umfeldLink, umfeldUmleitung } from '@/schemas/umfeld-filter'
import UmfeldUmleitung from '@/app/(hof)/analytics/umfeld/page'
import { RegionKopf } from '@/components/region/region-kopf'
import { FutterKaufenAnsicht } from '@/components/region/futter-kaufen-ansicht'
import { KennzahlenReihe, ServicegebuehrenKarte, TeilenWirkungKarte, UmsatzKarte } from '@/components/auswertung/auswertung-teile'
import { baueFutterKaufen } from '@/lib/futter-kaufen'
import { kennzahlen, servicegebuehrenSaetze, teilenKarte } from '@/lib/auswertung'
import { UMSATZ_TEXT } from '@/lib/umsatz'
import { KENNZAHL_TEXT } from '@/lib/heute'
import { fasseTeilenWirkungZusammen } from '@/lib/teilen-wirkung'
import { TEILEN_ZAEHLUNG_HINWEIS } from '@/lib/teilen-kanal'
import { BAR_OHNE_GEBUEHR_SATZ, BAR_SERVICEGEBUEHR_AB } from '@/lib/konditionen'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')
const gibt = (pfad: string) => existsSync(join(process.cwd(), pfad))


/** Selbst geschriebene Umsatzwörter — der Name auch als Vorlage mit MARKE (Register M1). */
const SELBST_GESCHRIEBEN = new RegExp(
  `['"\`]Über (${MARKE}|\\$\\{MARKE\\})|['"\`>]\\s*Mit Hofladen|['"\`]mit Hofladen|Warenumsatz|Umsatz pro (Tag|Woche|Monat)|umsatzKartenTitel`
)

describe('Adresse von /region', () => {
  it('Reiter: „futter" oder Standard „preise"; Unsinn und Listen fallen still zurück', () => {
    expect(leseRegionReiter('futter')).toBe('futter')
    expect(leseRegionReiter(['futter', 'preise'])).toBe('futter')
    expect(leseRegionReiter('<script>')).toBe('preise')
    expect(leseRegionReiter(undefined)).toBe('preise')
  })

  it('Futter-Filter: Umkreis, Art, Menge und Abholung nur aus erlaubten Werten', () => {
    expect(leseFutterKaufenFilter({ km: '50', art: 'HEU_STROH', menge: 'gross', abholung: 'wochenende' })).toEqual({
      km: 50,
      art: 'HEU_STROH',
      menge: 'gross',
      abholung: 'wochenende',
    })
    expect(leseFutterKaufenFilter({ km: '7', art: 'EIER', menge: 'riesig', abholung: 'gestern' })).toEqual({ km: 25, art: null, menge: null, abholung: null })
    // Die Altlast ist kein wählbarer Filter.
    expect(leseFutterKaufenFilter({ art: 'FUTTERMITTEL' }).art).toBeNull()
    expect(leseFutterAnsicht('karte')).toBe('karte')
    expect(leseFutterAnsicht('<script>')).toBe('liste')
  })

  it('Links: Standards ausgelassen, Umkreis, Ansicht und Abholung gehen beim Reiterwechsel mit', () => {
    const alles = { km: 25, art: null, menge: null, abholung: null } as const
    expect(futterKaufenLink(alles)).toBe('/region?reiter=futter&km=25')
    expect(futterKaufenLink({ km: 10, art: 'GETREIDE_KOERNER', menge: 'klein', abholung: 'morgen' }, 'karte')).toBe(
      '/region?reiter=futter&km=10&art=GETREIDE_KOERNER&menge=klein&abholung=morgen&ansicht=karte'
    )
    expect(regionReiterLink('preise', 50)).toBe('/region?km=50')
    expect(regionReiterLink('preise', 50, { ansicht: 'karte', abholung: 'heute' })).toBe('/region?km=50&ansicht=karte')
    expect(regionReiterLink('futter', 50)).toBe('/region?reiter=futter&km=50')
    expect(regionReiterLink('futter', 10, { ansicht: 'karte', abholung: 'heute' })).toBe('/region?reiter=futter&km=10&abholung=heute&ansicht=karte')
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
    // Seit Nr. 122 ohne region/loading.tsx (Ladepunkt statt Skelett), die Reiter in eigenen Teilen der Seite.
    for (const datei of ['analytics/page.tsx', 'analytics/umfeld/page.tsx', 'region/page.tsx', 'region/preise-reiter.tsx', 'region/futter-reiter.tsx']) {
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
      expect(text).toContain('getFarmForUser(userId)')
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

  it('Futter kaufen: Schild „· laut Hof" ohne Haken, Bestellen führt zur Produktseite der vorgewählten Größe, Filter sind Links', () => {
    const filter = { km: 25, art: null, menge: null, abholung: null } as const
    const groesse = (id: string, name: string, price: number, nettoMenge: number) => ({
      id,
      farmId: 'h',
      name,
      familieId: 'f',
      category: 'HEU_STROH' as const,
      subcategory: 'WIESENHEU' as const,
      price,
      isAvailable: true,
      stock: 2,
      reservedStock: 0,
      verpackung: 'LOSE_BALLEN' as const,
      futter: { nettoMenge, nettoEinheit: 'KG' as const, betriebsnummer: '1234567' },
      abholhinweise: ['ANHAENGER_NOETIG' as const],
      foto: null,
      fotoAusschnitt: null,
      illustration: '/categories/heu.webp',
    })
    const ansicht = baueFutterKaufen({
      hoefe: [
        {
          id: 'h',
          slug: 'testhof',
          name: 'Testhof A',
          postalCode: '1234',
          city: 'Beispielort',
          latitude: 48,
          longitude: 14,
          entfernungKm: 3,
          betriebsnummer: 'LFBIS 1234567',
          betriebsstatus: 'PRIMAERPRODUKTION',
          abholfenster: [],
          fotos: [],
          kategorien: ['HEU_STROH'],
        },
      ],
      produkte: [groesse('p', 'Heu Kleinballen', 4.5, 15), groesse('q', 'Heu Rundballen', 40, 250)],
      ohneStandort: [],
      abgeschnitten: false,
      eigen: { name: 'Sonnhof', latitude: 48, longitude: 14, sichtbar: true, betriebsnummer: null, betriebsstatus: null, futter: [] },
      filter,
      jetzt: new Date('2026-10-19T08:00:00Z'),
    })
    const html = renderToStaticMarkup(
      createElement(FutterKaufenAnsicht, { ansicht, filter, ansichtBeimLaden: 'liste', jetzt: '2026-10-19T08:00:00.000Z' })
    )
    expect(html).toContain('Futtermittelbetrieb · LFBIS 1234567 · laut Hof')
    expect(html).not.toMatch(/geprüft|registriert/i)
    expect(html).not.toMatch(/lucide-(shield-check|badge-check|circle-check|check-circle)/)
    expect(html).toContain('lucide-shield')
    // Seit Nr. 29 mit `?kaeufer=betrieb`: Die Kasse belegt „Betrieb" vor. Vorgewählt ist die erste kaufbare Größe.
    expect(html).toContain('href="/testhof/produkt/p?kaeufer=betrieb"')
    expect(html).toContain('Bestellen · Kleinballen · € 4,50')
    expect(html).toMatch(/<fieldset[^>]*><legend[^>]*>Größe<\/legend>/)
    expect(html).toContain('günstigster Kilopreis')
    expect(html).toContain('Anhänger nötig')
    expect(html).toContain('href="/region?reiter=futter&amp;km=25&amp;art=HEU_STROH"')
    expect(html).toContain('href="/region?reiter=futter&amp;km=25&amp;abholung=morgen"')
    expect(html).toContain('aria-label="Umkreis, Zahl der Angebote je Stufe"')
    expect(html).toContain('aria-label="Höfe mit LFBIS-Nummer"')
    expect(html).toContain('href="/products?neu=1&amp;bereich=futter"')
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i)
    expect(html).not.toContain('data-karte')
  })

  it('Futter kaufen: `?ansicht=karte` gilt beim Laden — die Karte statt der Liste, die Links tragen die Ansicht mit', () => {
    const filter = { km: 25, art: null, menge: null, abholung: null } as const
    const ansicht = baueFutterKaufen({
      hoefe: [],
      produkte: [],
      ohneStandort: [],
      abgeschnitten: false,
      eigen: { name: 'Sonnhof', latitude: 48, longitude: 14, sichtbar: true, betriebsnummer: null, betriebsstatus: null, futter: [] },
      filter,
      jetzt: new Date('2026-10-19T08:00:00Z'),
    })
    const html = renderToStaticMarkup(createElement(FutterKaufenAnsicht, { ansicht, filter, ansichtBeimLaden: 'karte', jetzt: '2026-10-19T08:00:00.000Z' }))
    expect(html).toContain('data-karte="futter"')
    expect(html).toContain('href="/region?reiter=futter&amp;km=50&amp;ansicht=karte"')
    // Gegenprobe: als Liste ohne Karte.
    const liste = renderToStaticMarkup(createElement(FutterKaufenAnsicht, { ansicht, filter, ansichtBeimLaden: 'liste', jetzt: '2026-10-19T08:00:00.000Z' }))
    expect(liste).not.toContain('data-karte')
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

  it(`Kennzahl „Über ${MARKE}" zählt die abgeholten Bestellungen — kein „Warenumsatz" mehr (Nr. 53)`, () => {
    const html = renderToStaticMarkup(createElement(KennzahlenReihe, { k: kennzahlen([], 0), zeitraum: 'Diese Woche' }))
    expect(html).toMatch(new RegExp(`<dt[^>]*>${UMSATZ_TEXT.ueberPlattform}</dt>`))
    expect(html).toContain('Diese Woche · abgeholte Bestellungen')
    expect(html).not.toMatch(/Warenumsatz|Gesamt/)
  })

  it('Umsatzkarte „Mit Hofladen" zählt Bestellungen und Direktverkäufe — in jedem Zeitraum, kein „Umsatz pro Tag" (Nr. 53)', () => {
    const html = renderToStaticMarkup(
      createElement(UmsatzKarte, {
        zeitraum: 'Diese Woche',
        summeCent: 20600,
        vergleich: { richtung: 'mehr', text: '▲ 472 % mehr als letzte Woche' },
        laufend: true,
        balken: [{ label: 'Fr', cent: 2800, vergleichCent: 0 }],
        vergleichLabel: 'Woche davor',
      })
    )
    expect(html).toMatch(new RegExp(`<h2[^>]*>${UMSATZ_TEXT.mitHofladen}</h2>`))
    expect(html).toContain('€ 206,00')
    expect(html).toContain('Abgeholte Bestellungen und eingetragene Verkäufe')
    expect(html).not.toMatch(/Umsatz pro (Tag|Woche|Monat)|Warenumsatz|Gesamt/)
  })

  it('Texte aus EINER Quelle: Auswertung und Heute nehmen UMSATZ_TEXT, keine Seite schreibt die Wörter selbst', () => {
    expect(UMSATZ_TEXT).toEqual({ ueberPlattform: `Über ${MARKE}`, mitHofladen: 'Mit Hofladen', mitHofladenKlein: 'mit Hofladen' })
    // „Heute eingenommen · mit Hofladen" ist dasselbe Wort wie die Umsatzkarte der Auswertung.
    expect(KENNZAHL_TEXT.eingenommenMit).toBe(UMSATZ_TEXT.mitHofladenKlein)
    const teile = quelle('src/components/auswertung/auswertung-teile.tsx')
    expect(teile).toContain('UMSATZ_TEXT.ueberPlattform')
    expect(teile).toContain('UMSATZ_TEXT.mitHofladen')
    for (const datei of ['src/components/auswertung/auswertung-teile.tsx', 'src/app/(hof)/analytics/page.tsx', 'src/components/heute/heute-teile.tsx', 'src/lib/heute.ts', 'src/lib/auswertung.ts']) {
      const text = quelle(datei).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      expect(text, datei).not.toMatch(SELBST_GESCHRIEBEN)
    }
  })

  it('Gegenprobe: die Suche nach selbst geschriebenen Wörtern schlägt an', () => {
    const suche = SELBST_GESCHRIEBEN
    for (const text of ["titel=\"Warenumsatz\"", "'Umsatz pro Tag'", "<h2>Mit Hofladen</h2>", "eingenommenMit: 'mit Hofladen'", `titel="Über ${MARKE}"`, `titel={\`Über \${MARKE}\`}`]) {
      expect(text).toMatch(suche)
    }
    expect('UMSATZ_TEXT.mitHofladen').not.toMatch(suche)
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

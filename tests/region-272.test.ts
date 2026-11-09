/**
 * Region nach der Abnahme Lauf 32 (Nr. 272; Liste Lauf 32, Abschnitt region; Boards s1-/w1-region):
 * Liste und Karte nebeneinander ab 1024 px, Sortenzeile, Futterkarte mit Größen über die Größenkachel (G5),
 * Kartenansicht am Handy nur mit Umkreis und „Liste / Karte“, Quelle unten rechts, Hinweise wörtlich,
 * LadeFehlerKasten aus ui/. Gerendert wie die übrigen Region-Tests (statisches Markup, Karte als Platzhalter).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}))
const suchParameter = vi.hoisted(() => ({ wert: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/region',
  useSearchParams: () => suchParameter.wert,
}))
vi.mock('next/dynamic', () => ({ default: () => () => createElement('div', { 'data-karte': 'region' }) }))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => createElement('img', { src, alt }) }))

import { UmfeldListe, KAUFEN_UEBER_HOFSEITE, sortenUnterzeile } from '@/components/analytics/umfeld-liste'
import { UmfeldAnzeige } from '@/components/analytics/umfeld-anzeige'
import { FutterKaufenAnsicht } from '@/components/region/futter-kaufen-ansicht'
import { futterHinweisImUmkreis, futterZahlZeile } from '@/components/region/futter-hinweise'
import { REGION_RAHMEN } from '@/components/region/region-kopf'
import { REGION_SATZ_KARTE, REGION_SPALTEN, REGION_WEB_AB } from '@/components/region/region-spalten'
import { baueFutterKaufen } from '@/lib/futter-kaufen'
import { hofMitEntfernung, type UmfeldZeile } from '@/lib/umfeld'

const WURZEL = join(__dirname, '..')
const quelle = (pfad: string): string => readFileSync(join(WURZEL, pfad), 'utf8')

function zeile(teil: Partial<UmfeldZeile> = {}): UmfeldZeile {
  return {
    schluessel: 'MILCH',
    titel: 'Milch, 1 L',
    anzahlHoefe: 5,
    anzahlText: '5 Höfe',
    eigenesProdukt: true,
    preise: [{ klasse: null, spanne: '€ 1,43 – 1,60', mitte: 'Mitte € 1,52', anzahlHoefe: 5, deins: '€ 1,49' }],
    hinweis: null,
    hoefe: [],
    ...teil,
  }
}

describe('Sortenzeile (Board s1-/w1-region Bild 1)', () => {
  it('„n Höfe · Spanne · Mitte“ in einer Zeile, der Grund ohne Vergleich dahinter (N23)', () => {
    expect(sortenUnterzeile(zeile())).toBe('5 Höfe · € 1,43 – 1,60 · Mitte € 1,52')
    expect(sortenUnterzeile(zeile({ preise: [], hinweis: 'Preis je Paket, nicht vergleichbar' }))).toBe('5 Höfe · Preis je Paket, nicht vergleichbar')
    expect(
      sortenUnterzeile(
        zeile({
          preise: [
            { klasse: 'Kleingebinde', spanne: '€ 1,00 – 2,00 / kg', mitte: 'Mitte € 1,50', anzahlHoefe: 2, deins: null },
            { klasse: 'Großgebinde', spanne: '€ 0,20 / kg', mitte: null, anzahlHoefe: 1, deins: null },
          ],
        })
      )
    ).toBe('5 Höfe · Kleingebinde € 1,00 – 2,00 / kg · Mitte € 1,50 · Großgebinde € 0,20 / kg')
  })

  it('eine Karte mit Trennlinien, Name fett, „Deins“ neben dem Pfeil, Rahmen neutral', () => {
    const html = renderToStaticMarkup(createElement(UmfeldListe, { zeilen: [zeile(), zeile({ schluessel: 'EIER', titel: 'Eier, 10 Stk.' })] }))
    expect(html.match(/<ul class="[^"]*divide-y/g)?.length).toBe(1)
    expect(html).not.toContain('border-accent')
    const knopf = html.match(/<button[^>]*aria-expanded="false"[^>]*>(.*?)<\/button>/)?.[1] ?? ''
    expect(knopf.indexOf('Deins: € 1,49')).toBeGreaterThan(knopf.indexOf('5 Höfe · € 1,43 – 1,60 · Mitte € 1,52'))
    expect(knopf.indexOf('lucide-chevron-down')).toBeGreaterThan(knopf.indexOf('Deins: € 1,49'))
  })

  it('aufgeklappt: Zeile je Hof „Hof · km · Produkt Preis“ und der Schluss „… · Kaufen geht über die Hofseite.“', () => {
    const quelltext = quelle('src/components/analytics/umfeld-liste.tsx')
    expect(quelltext).toContain('{hof.entfernung}')
    expect(quelltext).toContain('{produkt.name} {produkt.preis}')
    expect(KAUFEN_UEBER_HOFSEITE).toBe('Kaufen geht über die Hofseite.')
    // Der Ort steht nicht mehr als eigene Zeile da (Board), nur noch im title des Links.
    expect(quelltext).not.toMatch(/<p[^>]*>\{hof\.ort\}<\/p>/)
  })
})

describe('Liste und Karte ab 1024 px, Kartenansicht am Handy', () => {
  it('Rahmen bis 1400 px, zwei Spalten ab 1024 px, „Liste / Karte“ nur darunter', () => {
    expect(REGION_RAHMEN).toContain('lg:max-w-[1400px]')
    expect(REGION_RAHMEN).toContain('group/region')
    expect(REGION_SPALTEN).toContain('lg:grid-cols-')
    expect(REGION_WEB_AB).toBe(1024)
    for (const datei of ['src/components/analytics/umfeld-anzeige.tsx', 'src/components/region/futter-kaufen-ansicht.tsx']) {
      const text = quelle(datei)
      expect(text).toMatch(/<AnsichtChips[^>]*className="lg:hidden"/)
      expect(text).toContain('useRegionAnsicht(wahl)')
    }
  })

  it('Preise vergleichen, Karte am Handy: nur Umkreis und „Liste / Karte“, Satz im Kopf fällt weg', () => {
    suchParameter.wert = new URLSearchParams('ansicht=karte')
    const html = renderToStaticMarkup(
      createElement(UmfeldAnzeige, {
        bereich: 'LEBENSMITTEL',
        km: 25,
        eigenerName: 'Hof Müller',
        ansicht: { zeilen: [zeile()], hinweise: [], leer: null, weiterUmkreis: null },
        karte: { pins: [], zentrum: { lat: 48, lon: 14, radiusKm: 25 } },
      } as unknown as Parameters<typeof UmfeldAnzeige>[0])
    )
    suchParameter.wert = new URLSearchParams()
    expect(html).toContain('data-region-karte=""')
    expect(html).toContain('data-karte="region"')
    expect(html).not.toContain('Bereich wählen')
    expect(html).not.toContain('Luftlinie ab deinem Hof')
    expect(html).toContain('aria-label="Umkreis"')
    expect(quelle('src/components/region/region-kopf.tsx')).toContain('REGION_SATZ_KARTE')
    expect(REGION_SATZ_KARTE).toBe('group-has-[[data-region-karte]]/region:hidden')
  })

  it('Futter kaufen, Karte am Handy: Art, Menge, Abholung und Hinweise fallen weg', () => {
    const filter = { km: 25, art: null, menge: null, abholung: null } as const
    const ansicht = baueFutterKaufen({
      hoefe: [],
      produkte: [],
      ohneStandort: [],
      abgeschnitten: false,
      eigen: { name: 'Hof Müller', latitude: 48, longitude: 14, sichtbar: true, betriebsnummer: null, betriebsstatus: null, futter: [] },
      filter,
      jetzt: new Date('2026-10-19T08:00:00Z'),
    })
    const karte = renderToStaticMarkup(createElement(FutterKaufenAnsicht, { ansicht, filter, ansichtBeimLaden: 'karte', jetzt: '2026-10-19T08:00:00.000Z' }))
    expect(karte).toContain('data-region-karte=""')
    expect(karte).not.toContain('aria-label="Futterart"')
    expect(karte).not.toContain('aria-label="Abholung')
    const liste = renderToStaticMarkup(createElement(FutterKaufenAnsicht, { ansicht, filter, ansichtBeimLaden: 'liste', jetzt: '2026-10-19T08:00:00.000Z' }))
    expect(liste).not.toContain('data-region-karte')
    expect(liste).toContain('aria-label="Futterart"')
    // Leer (Board Bild 5): ohne „Liste / Karte“ und ohne Zählzeile.
    expect(liste).not.toContain('aria-label="Ansicht wählen"')
    expect(liste).not.toContain('LFBIS-Nummer im Umkreis')
  })

  it('Quelle unten rechts: kein `attributionOben` in den beiden Karten von Region', () => {
    for (const datei of ['src/components/analytics/umfeld-karte.tsx', 'src/components/region/futter-karte-ansicht.tsx']) {
      expect(quelle(datei)).not.toMatch(/^\s*attributionOben\b/m)
    }
  })

  it('der gewählte Hof steht unter der Karte, nicht über den Pins; „Schließen“ als Wort', () => {
    const umfeld = quelle('src/components/analytics/umfeld-karte.tsx')
    expect(umfeld).not.toContain('absolute inset-x-3 bottom-3')
    expect(umfeld).toContain('Schließen')
    expect(umfeld).not.toContain('<X ')
    expect(quelle('src/components/region/futter-karte-ansicht.tsx')).not.toContain('absolute inset-x-3 bottom-3')
  })
})

describe('Futterkarte und Hinweise wörtlich (Board s1-/w1-region Bild 2)', () => {
  it('am Handy zählt die Zeile Höfe, im Web nennt der Satz den Umkreis', () => {
    expect(futterZahlZeile(2)).toBe('2 Höfe mit LFBIS-Nummer')
    expect(futterZahlZeile(1)).toBe('1 Hof mit LFBIS-Nummer')
    expect(futterHinweisImUmkreis(25)).toBe('Höfe mit LFBIS-Nummer im Umkreis von 25 km – du kaufst für deine Tiere.')
  })

  it('Kopf „Hof · km“ ohne PLZ und Ort, Größen über die Größenkachel G5', () => {
    expect(hofMitEntfernung({ name: 'Hof am Bach', entfernungKm: 4 })).toMatch(/^Hof am Bach · 4/)
    const karte = quelle('src/components/region/futter-karte.tsx')
    expect(karte).toContain('<GroessenWahl')
    expect(karte).toContain('form="zeile"')
    expect(karte).not.toContain('<HofKopf')
    expect(karte).not.toContain('type="radio"')
  })

  it('Ladefehler über den LadeFehlerKasten aus ui/', () => {
    expect(quelle('src/components/region/region-zustaende.tsx')).toContain("from '@/components/ui/lade-fehler-kasten'")
  })
})

/**
 * Die Marke „Neu · vor 2 Std.“ an der Hofkarte (Register N22, Ergänzung
 * Nr. 129; Board system-k2-beitraege-v2, Abschnitt 4).
 *
 * Beweist:
 *  - Die Regel (beitragMarke, ohne Mock, feste Zeitpunkte): höchstens sieben
 *    Tage, auf die Millisekunde; mit dem Ende des Beitrags weg; ein Zeitpunkt
 *    in der Zukunft zeigt nichts; die Zeit kurz an der Marke, lang im Satz für
 *    den Screenreader.
 *  - Die Karte (HofKarte schmal und im Splitscreen, Karussell; serverseitig
 *    gerendert, useUhr liefert dabei den Zeitpunkt des Servers): die Marke am
 *    Bild, der Satz „Neuer Beitrag vor 2 Stunden: <Titel>“ hängt per
 *    aria-describedby am EINEN Link bzw. Knopf der Karte. Gegenprobe ohne
 *    Beitrag und nach sieben Tagen: keine Marke, kein Verweis.
 *  - Die Hofkarten der Startseite („Höfe in deiner Nähe“, Runde 1): dieselbe
 *    Liste reicht `neuerBeitrag` ohne zweite Abfrage durch
 *    (waehleStartseitenHoefe), dieselbe Marke am Bild, der Satz am einen Link;
 *    die Seite reicht ihren Zeitpunkt weiter. Gegenprobe ohne Beitrag bzw.
 *    ohne Zeitpunkt (Block „Höfe-Auswahl“): keine Marke, kein Verweis.
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentProps, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => {
    const attribute = { ...rest }
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))

import { NEUER_BEITRAG_TAGE, beitragMarke, type NeuerBeitrag } from '@/lib/hofuebersicht'
import { HofKarte, type KartenHof } from '@/components/hoefe/entdecken-teile'
import HoefeKarussell from '@/components/hoefe/hoefe-karussell'
import { HofKarten } from '@/components/startseite/hoefe-in-der-naehe'
import { waehleStartseitenHoefe, type StartseitenHofEingabe } from '@/lib/startseite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const STUNDE = 3_600_000
const JETZT = '2026-10-20T10:00:00.000Z'
const vor = (ms: number): string => new Date(Date.parse(JETZT) - ms).toISOString()
const nach = (ms: number): string => new Date(Date.parse(JETZT) + ms).toISOString()
const KUERBIS: NeuerBeitrag = { titel: 'Die ersten Kürbisse sind da', veroeffentlicht: vor(2 * STUNDE), endet: null }

describe('beitragMarke — die Regel', () => {
  const jetzt = new Date(JETZT)

  it('zeigt „Neu · vor 2 Std.“ und für den Screenreader den Satz mit Titel', () => {
    expect(beitragMarke(KUERBIS, jetzt)).toEqual({ kurz: 'Neu · vor 2 Std.', satz: 'Neuer Beitrag vor 2 Stunden: Die ersten Kürbisse sind da' })
  })

  it('höchstens sieben Tage — eine Millisekunde davor noch, genau dann nicht mehr', () => {
    const tage = NEUER_BEITRAG_TAGE * 24 * STUNDE
    expect(NEUER_BEITRAG_TAGE).toBe(7)
    expect(beitragMarke({ ...KUERBIS, veroeffentlicht: vor(tage - 1) }, jetzt)?.kurz).toBe('Neu · vor 6 Tagen')
    expect(beitragMarke({ ...KUERBIS, veroeffentlicht: vor(tage) }, jetzt)).toBeNull()
  })

  it('mit dem Ende des Beitrags weg — auch wenn der Zwischenspeicher älter ist', () => {
    expect(beitragMarke({ ...KUERBIS, endet: nach(1) }, jetzt)).not.toBeNull()
    expect(beitragMarke({ ...KUERBIS, endet: JETZT }, jetzt)).toBeNull()
    expect(beitragMarke({ ...KUERBIS, endet: vor(STUNDE) }, jetzt)).toBeNull()
  })

  it('ohne Beitrag oder mit einem Zeitpunkt in der Zukunft nichts', () => {
    expect(beitragMarke(null, jetzt)).toBeNull()
    expect(beitragMarke(undefined, jetzt)).toBeNull()
    expect(beitragMarke({ ...KUERBIS, veroeffentlicht: nach(1) }, jetzt)).toBeNull()
  })

  it('die Zeit: unter einer Stunde „heute“, ab einem Tag in Tagen', () => {
    expect(beitragMarke({ ...KUERBIS, veroeffentlicht: vor(STUNDE - 1) }, jetzt)?.kurz).toBe('Neu · heute')
    expect(beitragMarke({ ...KUERBIS, veroeffentlicht: vor(25 * STUNDE) }, jetzt)).toEqual({
      kurz: 'Neu · vor 1 Tag',
      satz: 'Neuer Beitrag vor 1 Tag: Die ersten Kürbisse sind da',
    })
  })
})

const HOF: KartenHof = {
  slug: 'testhof-a',
  name: 'Testhof A',
  postalCode: '4910',
  city: 'Teststadt',
  isPaused: false,
  kategorien: ['EIER'],
  abholfenster: [],
  angebot: [],
  fotos: [],
  gruendungshof: false,
  entfernungKm: null,
  latitude: 48.2,
  longitude: 13.5,
}

const karte = (props: Partial<ComponentProps<typeof HofKarte>> = {}): string =>
  renderToStaticMarkup(
    createElement(HofKarte, { hof: HOF, bereich: 'LEBENSMITTEL', schaufenster: { produkte: [], weitere: 0 }, split: false, ausgewaehlt: false, jetzt: JETZT, ...props })
  )

const SATZ = 'Neuer Beitrag vor 2 Stunden: Die ersten Kürbisse sind da'

describe('HofKarte mit Marke', () => {
  it('schmal: Marke am Bild, der Satz hängt am einen Link der Karte', () => {
    const html = karte({ hof: { ...HOF, neuerBeitrag: KUERBIS } })
    expect(html).toContain('Neu · vor 2 Std.')
    expect(html).toContain(`<span id="beitrag-marke-testhof-a" hidden="">${SATZ}</span>`)
    expect(html).toMatch(/<a [^>]*aria-describedby="beitrag-marke-testhof-a"/)
    // Die Karte bleibt EIN Link — die Marke bringt keinen zweiten.
    expect(html.match(/<a /g)).toHaveLength(1)
  })

  it('Splitscreen: dieselbe Marke klein am Vorschaubild, der Satz am Knopf der Karte', () => {
    const html = karte({ hof: { ...HOF, neuerBeitrag: KUERBIS }, split: true })
    expect(html).toContain('Neu · vor 2 Std.')
    expect(html).toMatch(/<button [^>]*aria-describedby="beitrag-marke-testhof-a"/)
  })

  it('Gegenprobe: ohne Beitrag und nach sieben Tagen keine Marke und kein Verweis', () => {
    for (const hof of [HOF, { ...HOF, neuerBeitrag: null }]) {
      const html = karte({ hof })
      expect(html).not.toContain('Neu ·')
      expect(html).not.toContain('aria-describedby')
    }
    const alt = karte({ hof: { ...HOF, neuerBeitrag: { ...KUERBIS, veroeffentlicht: vor(7 * 24 * STUNDE) } } })
    expect(alt).not.toContain('Neu ·')
    expect(alt).not.toContain(SATZ)
    // Der Verweis am Link zeigt trotzdem auf ein vorhandenes (leeres) Element, nie ins Leere.
    expect(alt).toMatch(/<a [^>]*aria-describedby="beitrag-marke-testhof-a"/)
    expect(alt).toContain('<span id="beitrag-marke-testhof-a" hidden=""></span>')
  })
})

describe('Karussell der Karte mit Marke', () => {
  it('dieselbe Marke über denselben Baustein, der Satz am Link der Karte', () => {
    const hof = {
      ...HOF,
      logoUrl: null,
      logoAusschnitt: null,
      naechsteAbholung: null,
      produkte: [],
      produkteGesamt: 0,
      produkteJeBereich: { LEBENSMITTEL: 0, FUTTERMITTEL: 0 },
      suchNamen: [],
      abGrundpreis: null,
      angebot: [],
      abholfenster: [],
      neuerBeitrag: KUERBIS,
    }
    const html = renderToStaticMarkup(
      createElement(HoefeKarussell, { hoefe: [hof], ausgewaehlt: null, sichtbar: true, bereich: 'LEBENSMITTEL', onZentriert: () => {}, jetzt: JETZT })
    )
    expect(html).toContain('Neu · vor 2 Std.')
    expect(html).toContain(`<span id="beitrag-marke-karussell-testhof-a" hidden="">${SATZ}</span>`)
    expect(html).toMatch(/<a [^>]*aria-describedby="beitrag-marke-karussell-testhof-a"/)
  })
})

describe('Hofkarten der Startseite mit Marke („Höfe in deiner Nähe“)', () => {
  const EINGABE: StartseitenHofEingabe = {
    slug: 'testhof-a',
    name: 'Testhof A',
    postalCode: '4910',
    city: 'Teststadt',
    isPaused: false,
    kategorien: ['EIER'],
    naechsteAbholung: null,
    fotos: [],
    latitude: null,
    longitude: null,
  }

  it('die Auswahl reicht `neuerBeitrag` aus derselben Liste durch — ohne Beitrag null', () => {
    const [mit, ohne] = waehleStartseitenHoefe([{ ...EINGABE, neuerBeitrag: KUERBIS }, { ...EINGABE, slug: 'testhof-b' }])
    expect(mit?.neuerBeitrag).toEqual(KUERBIS)
    expect(ohne?.neuerBeitrag).toBeNull()
  })

  it('Marke am Bild, der Satz hängt am einen Link der Karte', () => {
    const html = renderToStaticMarkup(createElement(HofKarten, { hoefe: waehleStartseitenHoefe([{ ...EINGABE, neuerBeitrag: KUERBIS }]), jetzt: JETZT }))
    expect(html).toContain('Neu · vor 2 Std.')
    expect(html).toContain(`<span id="beitrag-marke-startseite-testhof-a" hidden="">${SATZ}</span>`)
    expect(html).toMatch(/<a [^>]*aria-describedby="beitrag-marke-startseite-testhof-a"/)
    expect(html.match(/<a /g)).toHaveLength(1)
  })

  it('Gegenprobe: ohne Beitrag oder ohne Zeitpunkt keine Marke und kein Verweis', () => {
    for (const html of [
      renderToStaticMarkup(createElement(HofKarten, { hoefe: waehleStartseitenHoefe([EINGABE]), jetzt: JETZT })),
      renderToStaticMarkup(createElement(HofKarten, { hoefe: waehleStartseitenHoefe([{ ...EINGABE, neuerBeitrag: KUERBIS }]) })),
    ]) {
      expect(html).not.toContain('Neu ·')
      expect(html).not.toContain('aria-describedby')
    }
  })

  it('die Startseite reicht ihren Zeitpunkt an die Hofkarten weiter', () => {
    const seite = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8')
    expect(seite).toMatch(/<HofKarten hoefe=\{daten\.hoefe\} jetzt=\{jetzt\.toISOString\(\)\} \/>/)
    expect(seite).toMatch(/<HofKartenGeladen jetzt=\{jetzt\} \/>/)
  })
})

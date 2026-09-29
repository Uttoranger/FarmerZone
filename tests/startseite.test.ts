/**
 * Tests für die Startseite (src/app/page.tsx) und ihr Kachelraster
 * (src/lib/startseite-kacheln.ts).
 *
 * Beweist:
 *  - Titel, Beschreibung, Open Graph und die X-/Twitter-Karte nennen Futter
 *    und zeigen das große Vorschaubild.
 *  - Der Kopf trägt den Satz für beide Einstiege und EINEN Knopf „Höfe in
 *    deiner Nähe" → /hoefe.
 *  - „Was suchst du?": zehn Kacheln in zwei gleich gebauten Gruppen, Namen
 *    aus KATEGORIE_LABEL, jede verlinkt /hoefe mit passendem bereich und kat —
 *    geprüft, indem /hoefe den Link wieder liest. Zu jeder Kachel gibt es ein Bild.
 *  - Der grüne Futter-Block aus #140 ist weg; das Raster steht direkt nach
 *    dem Kopf. Der Punkt bei „Für Höfe" und Schritt 1 bleiben.
 *  - Orange bleibt einmal als Fläche (CODING_STANDARDS §7).
 *
 * Am Quelltext geprüft, wo die Seite eine Server-Komponente mit next/image
 * ist; Metadaten und Kacheln kommen direkt aus den Modulen.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { metadata } from '@/app/page'
import { hoefeLink } from '@/lib/bereiche-anzeige'
import { categoryImagePath } from '@/lib/product-image'
import { STARTSEITE_KACHELGRUPPEN, kachelLink, kachelnVon } from '@/lib/startseite-kacheln'
import { KATEGORIE_LABEL } from '@/lib/taxonomie'
import { STARTSEITE_VORSCHAUBILD } from '@/lib/vorschaubild'
import { leseHoefeFilter } from '@/schemas/hoefe-filter'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')
const seite = quelle('src/app/page.tsx')

describe('Metadaten', () => {
  it('Titel und Beschreibung nennen Futter — Open Graph und Twitter-Karte sagen dasselbe', () => {
    expect(metadata.title).toBe('FarmerZone — Lebensmittel und Futter direkt vom Hof')
    expect(metadata.description).toMatch(/Heu/)
    expect(metadata.description).toMatch(/Futter/)
    expect(metadata.openGraph).toMatchObject({ title: metadata.title, description: metadata.description })
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', title: metadata.title })
  })

  it('das Vorschaubild: /og/startseite.jpg, 1200 × 630, mit Beschreibung', () => {
    expect(metadata.openGraph?.images).toEqual([
      {
        url: '/og/startseite.jpg',
        width: 1200,
        height: 630,
        alt: 'FarmerZone — Lebensmittel und Futter direkt vom Hof',
      },
    ])
    expect(metadata.twitter?.images).toEqual([STARTSEITE_VORSCHAUBILD])
  })
})

describe('Kopf', () => {
  const kopf = seite.slice(seite.indexOf('{HERO_SATZ}'), seite.indexOf('{/* Scroll-Hinweis'))

  it('trägt den Satz für beide Einstiege', () => {
    expect(seite).toContain(
      'Lebensmittel für die Küche, Heu und Futter für den Stall — direkt von den Höfen der Region. Bestellen, abholen, fertig.'
    )
  })

  it('EIN Knopf „Höfe in deiner Nähe" → /hoefe', () => {
    expect(seite).toContain("const HERO_KNOPF = 'Höfe in deiner Nähe'")
    expect(hoefeLink('LEBENSMITTEL')).toBe('/hoefe')
    expect(kopf.match(/<Link/g)).toHaveLength(1)
    expect(kopf).toContain("hoefeLink('LEBENSMITTEL')")
    expect(seite).not.toContain('Hofladen entdecken')
    expect(seite).not.toContain('Heu & Futter finden')
  })
})

describe('Was suchst du? — die Kacheln', () => {
  const alle = STARTSEITE_KACHELGRUPPEN.flatMap((g) => kachelnVon(g))

  it('zehn Kacheln in zwei Gruppen, in der beauftragten Reihenfolge', () => {
    expect(STARTSEITE_KACHELGRUPPEN.map((g) => g.titel)).toEqual(['Für die Küche', 'Für Stall und Tiere'])
    expect(alle).toHaveLength(10)
    expect(STARTSEITE_KACHELGRUPPEN[0].kategorien).toEqual(['EIER', 'FLEISCH', 'MILCH', 'GEMUESE', 'BROT', 'HONIG'])
    expect(STARTSEITE_KACHELGRUPPEN[1].kategorien).toEqual([
      'HEU_STROH',
      'GETREIDE_KOERNER',
      'MISCHFUTTER',
      'ERGAENZUNGSFUTTER',
    ])
  })

  it('der Untertitel steht nur bei Stall und Tiere', () => {
    expect(STARTSEITE_KACHELGRUPPEN[0].untertitel).toBeNull()
    expect(STARTSEITE_KACHELGRUPPEN[1].untertitel).toBe(
      'Mit Kilopreis und allen Pflichtangaben — vom Kleinballen bis zum Big Bag.'
    )
  })

  it('die Namen kommen aus KATEGORIE_LABEL', () => {
    for (const kachel of alle) expect(kachel.name).toBe(KATEGORIE_LABEL[kachel.kategorie])
  })

  it('jede Kachel verlinkt /hoefe mit passendem bereich und kat — /hoefe liest genau diesen Filter', () => {
    for (const gruppe of STARTSEITE_KACHELGRUPPEN) {
      for (const kachel of kachelnVon(gruppe)) {
        const [pfad, query = ''] = kachel.href.split('?')
        expect(pfad, kachel.href).toBe('/hoefe')
        const filter = leseHoefeFilter(new URLSearchParams(query))
        expect(filter.bereich, kachel.href).toBe(gruppe.bereich)
        expect(filter.kategorien, kachel.href).toEqual([kachel.kategorie])
      }
    }
    expect(kachelLink('LEBENSMITTEL', 'EIER')).toBe('/hoefe?kat=EIER')
    expect(kachelLink('FUTTERMITTEL', 'HEU_STROH')).toBe('/hoefe?bereich=futter&kat=HEU_STROH')
  })

  it('zu jeder Kachel liegt ein Bild — über product-image.ts', () => {
    for (const kachel of alle) {
      expect(categoryImagePath(kachel.kategorie), kachel.kategorie).toMatch(/^\/categories\/[a-z-]+\.webp$/)
    }
    expect(seite).toContain('bild={categoryImagePath(kachel.kategorie)}')
  })

  it('beide Gruppen sehen gleich aus: ein Raster, drei Kacheln je Reihe am Handy', () => {
    const raster = seite.slice(seite.indexOf('STARTSEITE_KACHELGRUPPEN.map'), seite.indexOf('A — Für Höfe'))
    expect(raster.match(/<ul /g)).toHaveLength(1)
    expect(raster).toContain('grid-cols-3')
    // Nachts gedämpft, damit die hellen Illustrationen nicht leuchten.
    expect(seite).toMatch(/dark:brightness-\[[0-9.]+\]/)
  })
})

describe('Aufbau', () => {
  it('das Raster steht direkt nach dem Kopf und trägt das Ziel des Scroll-Pfeils', () => {
    const kopfEnde = seite.indexOf('</section>', seite.indexOf('{HERO_SATZ}'))
    const raster = seite.indexOf('{KACHELN_TITEL}')
    const hoefe = seite.indexOf('SECTION_TITLES.farms.title')
    expect(kopfEnde).toBeGreaterThan(-1)
    expect(raster).toBeGreaterThan(kopfEnde)
    expect(raster).toBeLessThan(hoefe)
    expect(seite.slice(kopfEnde, raster)).toContain('id="weiter"')
  })

  it('der grüne Futter-Block aus #140 ist weg', () => {
    expect(seite).not.toContain('bg-landing-wald ')
    expect(seite).not.toContain('Heu, Stroh und Futter vom Nachbarhof')
    expect(seite).not.toContain('Futter in der Nähe finden')
  })

  it('was #140 richtig gemacht hat, bleibt: Schritt 1 und der Punkt bei „Für Höfe"', () => {
    expect(seite).toContain("'Hof in der Nähe finden — für den Hofladen oder für Heu und Futter.'")
    expect(seite).toContain(
      'Auch Heu und Futter verkaufen — die Pflichtangaben füllst du Schritt für Schritt aus, auf Wunsch nur für Betriebe.'
    )
  })
})

describe('Farben', () => {
  it('Orange als Fläche genau einmal — das Band „Hof anmelden"; Kopf und Kacheln tragen keins', () => {
    // Außer dem Band nur der kleine pulsierende Punkt am Pilot-Hinweis — ein Statuspunkt, kein Knopf.
    expect(seite.match(/bg-accent\b(?! animate-pulse)/g)).toHaveLength(1)
    expect(seite.lastIndexOf('bg-accent')).toBeGreaterThan(seite.indexOf('E — CTA-Band'))
    const kopfUndKacheln = seite.slice(seite.indexOf('{HERO_SATZ}'), seite.indexOf('A — Für Höfe'))
    expect(kopfUndKacheln.replace('bg-accent animate-pulse', '')).not.toMatch(/\baccent\b/)
  })

  it('der Knopf im Kopf ist Crème mit Waldgrün — in beiden Modi gleich, weil er auf dem Foto steht', () => {
    const css = quelle('src/app/globals.css')
    expect(css).toContain('--color-landing-wald: var(--landing-wald);')
    const nachtBeginn = css.indexOf('.dark {')
    expect(nachtBeginn).toBeGreaterThan(-1)
    expect(css.slice(0, nachtBeginn)).toMatch(/--landing-wald: oklch\(/)
    expect(css.slice(nachtBeginn)).not.toContain('--landing-wald')
  })
})

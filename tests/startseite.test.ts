/**
 * Tests für die Startseite (src/app/page.tsx) — Futter als zweiter Einstieg.
 *
 * Beweist:
 *  - Titel, Beschreibung und Open Graph nennen Futter.
 *  - Der Kopf trägt den neuen Satz und zwei Wege: Hofladen (/hoefe) zuerst,
 *    Heu & Futter (/hoefe?bereich=futter) daneben.
 *  - Schritt 1 nennt beide Einstiege; der Futter-Abschnitt und der
 *    Futter-Punkt bei „Für Höfe" stehen im Wortlaut.
 *  - Orange bleibt einmal auf der Seite (CODING_STANDARDS §7): beim Band
 *    „Hof anmelden", nicht bei den neuen Knöpfen.
 *  - Der Futter-Abschnitt hat kein Bild, und das Waldgrün kommt aus Tokens.
 *
 * Am Quelltext geprüft, weil die Seite eine Server-Komponente mit next/image
 * ist; die Metadaten kommen direkt aus dem Modul.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { metadata } from '@/app/page'
import { hoefeLink } from '@/lib/bereiche-anzeige'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')
const seite = quelle('src/app/page.tsx')

describe('Metadaten', () => {
  it('Titel und Beschreibung nennen Futter — Open Graph sagt dasselbe', () => {
    expect(metadata.title).toBe('FarmerZone — Lebensmittel und Futter direkt vom Hof')
    expect(metadata.description).toMatch(/Heu/)
    expect(metadata.description).toMatch(/Futter/)
    expect(metadata.openGraph).toMatchObject({ title: metadata.title, description: metadata.description })
  })
})

describe('Kopf', () => {
  it('trägt den Satz für beide Einstiege', () => {
    expect(seite).toContain(
      'Lebensmittel für die Küche, Heu und Futter für den Stall — direkt von den Höfen der Region. Bestellen, abholen, fertig.'
    )
  })

  it('zwei Wege: Hofladen entdecken → /hoefe, Heu & Futter finden → /hoefe?bereich=futter', () => {
    expect(hoefeLink('LEBENSMITTEL')).toBe('/hoefe')
    expect(hoefeLink('FUTTERMITTEL')).toBe('/hoefe?bereich=futter')
    expect(seite).toContain("const HERO_HOFLADEN = 'Hofladen entdecken'")
    expect(seite).toContain("const HERO_FUTTER = 'Heu & Futter finden'")
    // Der Hofladen steht vor dem Futter.
    const kopf = seite.slice(seite.indexOf('{HERO_SATZ}'), seite.indexOf('{/* Scroll-Hinweis'))
    expect(kopf.indexOf("hoefeLink('LEBENSMITTEL')")).toBeGreaterThan(-1)
    expect(kopf.indexOf("hoefeLink('LEBENSMITTEL')")).toBeLessThan(kopf.indexOf("hoefeLink('FUTTERMITTEL')"))
  })
})

describe('Inhalt im Wortlaut', () => {
  it('Schritt 1 nennt Hofladen und Futter', () => {
    expect(seite).toContain("'Hof in der Nähe finden — für den Hofladen oder für Heu und Futter.'")
  })

  it('der Futter-Abschnitt: Kicker, Titel, drei Punkte, Knopf', () => {
    for (const text of [
      'Für Pferdehalter, Tierhalter und Betriebe',
      'Heu, Stroh und Futter vom Nachbarhof',
      'Fair vergleichen — jeder Ballen und jeder Big Bag mit Kilopreis',
      'Vom Kleinballen bis zum Big Bag',
      'Alle Angaben vor dem Kauf — Zusammensetzung, Inhaltsstoffe und Betriebsnummer stehen schon auf der Hofseite',
      'Futter in der Nähe finden',
    ]) {
      expect(seite, text).toContain(text)
    }
  })

  it('„Für Höfe" hat den Futter-Punkt', () => {
    expect(seite).toContain(
      'Auch Heu und Futter verkaufen — die Pflichtangaben füllst du Schritt für Schritt aus, auf Wunsch nur für Betriebe.'
    )
  })

  it('der Futter-Abschnitt steht nach „So funktioniert’s" und vor der Vision', () => {
    const schritte = seite.indexOf('SECTION_TITLES.steps.title')
    const futter = seite.indexOf('{FUTTER.title}')
    const vision = seite.indexOf('SECTION_TITLES.vision.title')
    expect(schritte).toBeLessThan(futter)
    expect(futter).toBeLessThan(vision)
  })
})

describe('Farben', () => {
  it('Orange als Fläche genau einmal — das Band „Hof anmelden"; die neuen Knöpfe tragen keins', () => {
    // Außer dem Band nur der kleine pulsierende Punkt am Pilot-Hinweis — ein Statuspunkt, kein Knopf.
    const flaechen = seite.match(/bg-accent\b(?! animate-pulse)/g)
    expect(flaechen).toHaveLength(1)
    expect(seite.lastIndexOf('bg-accent')).toBeGreaterThan(seite.indexOf('E — CTA-Band'))

    const kopf = seite.slice(seite.indexOf('{HERO_SATZ}'), seite.indexOf('{/* Scroll-Hinweis'))
    const futter = seite.slice(seite.indexOf('C2 — Heu und Futter'), seite.indexOf('D — Vision'))
    for (const teil of [kopf, futter]) expect(teil).not.toMatch(/\baccent\b/)
  })

  it('der Futter-Abschnitt hat kein Bild und keine harte Farbe', () => {
    const abschnitt = seite.slice(seite.indexOf('C2 — Heu und Futter'), seite.indexOf('D — Vision'))
    expect(abschnitt.length).toBeGreaterThan(0)
    expect(abschnitt).not.toContain('<Image')
    expect(abschnitt).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(abschnitt).toContain('bg-landing-wald')
  })

  it('das Waldgrün ist ein Token — für Tailwind freigegeben, in beiden Modi derselbe Wert', () => {
    const css = quelle('src/app/globals.css')
    expect(css).toContain('--color-landing-wald: var(--landing-wald);')
    expect(css).toContain('--color-landing-wald-ink: var(--landing-wald-ink);')
    expect(css).toMatch(/--landing-wald: oklch\(/)
    // Bewusst nur in :root — nachts bleibt das Band dunkelgrün.
    const nacht = css.slice(css.indexOf('.dark {'))
    expect(nacht).not.toContain('--landing-wald')
  })
})

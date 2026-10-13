/**
 * Der Editor am breiten Bildschirm (Nachtlauf Nr. 73, Register N7), serverseitig
 * gerendert (TESTING_GUIDELINES §1). Die Regel selbst — editorSpalten — prüft
 * tests/hofseite-vorschau.test.ts; hier geht es darum, dass der Editor sie
 * einbaut und der Hinweis am Ende der Liste steht.
 *
 *  - Gemessen wird die Breite des Editors; die Spalten bekommen genau die
 *    Werte der Regel als Breite, nie eine eigene Rechnung. Der äußere Rahmen
 *    begrenzt auf EDITOR_BREITE_MAX und zentriert (die Klasse ist ein Literal
 *    für Tailwind und hängt hier an der Konstante).
 *  - Vor der ersten Messung (Server, erster Frame) gilt dieselbe Regel für
 *    Handy in CSS, damit beim Hydrieren nichts springt: die Klassen und die
 *    Höchstbreite der Liste hängen an den Konstanten.
 *  - „Produkte verwaltest du links unter „Produkte“." steht am Ende der Liste,
 *    nach der letzten Gruppe und vor der Vorschau, als Link auf /products —
 *    aus EINER Quelle (MEIN_HOF_HINWEIS).
 *
 * Jede Suche hat ihre Gegenprobe (gemessen/ungemessen); das Verhalten beim
 * Ändern der Fensterbreite prüfen die Bilder im Bericht.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FarmSettings } from '@/server/queries/farm'
import type { AppearanceData } from '@/server/queries/appearance'
import type { HofseiteFortschritt } from '@/lib/hofseite-fortschritt'
import type { AbschnittHof } from '@/components/mein-hof/abschnitt-inhalt'

const messung = vi.hoisted(() => ({ breite: 0 }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
// Die schweren Nachbarn: die Formulare der Zeilen (öffnen sich erst im Browser) und der Rahmen mit dem
// iframe. Der Rahmen liefert auch die Messung — hier steuert der Test die Breite, die „gemessen" wird.
vi.mock('@/components/mein-hof/abschnitt-inhalt', () => ({ AbschnittInhalt: () => null, SOFORT_GESPEICHERT: new Set<string>() }))
vi.mock('@/components/farmer/hofseite-vorschau-rahmen', () => ({
  HofseiteVorschauRahmen: () => createElement('aside', { 'aria-label': 'Vorschau' }),
}))
// Der Hook liegt seit Nr. 75 in src/lib (Hooks nach CODING_STANDARDS §1 in use-*.ts).
vi.mock('@/lib/use-element-groesse', () => ({
  useElementGroesse: () => ({ ref: () => undefined, breite: messung.breite, hoehe: 0 }),
}))

import { HofseiteEditor } from '@/components/farmer/hofseite-editor'
import { MEIN_HOF_HINWEIS, PRODUKTE_HREF } from '@/lib/bauern-navigation'
import {
  EDITOR_BREITE_MAX,
  EDITOR_HANDY_SPALTE,
  EDITOR_HANDY_SPALTE_BREIT,
  EDITOR_LISTE_HANDY_MAX,
  editorSpalten,
} from '@/lib/hofseite-vorschau'

const fortschritt: HofseiteFortschritt = {
  gruppen: [
    {
      id: 'sichtbarkeit',
      titel: 'Sichtbarkeit',
      zeilen: [{ id: 'abschnitte', gruppe: 'sichtbarkeit', titel: 'Abschnitte der Hofseite', wert: 'Alle sichtbar', fertig: true, marke: null, freiwillig: false }],
    },
  ],
  erledigt: 1,
  gesamt: 1,
  prozent: 100,
  fehlend: [],
  satz: 'Alles ist fertig.',
}

const hof: AbschnittHof = {
  slug: 'hof-test',
  name: 'Hof Test',
  adresse: 'Musterweg 1, 1010 Wien',
  logoUrl: null,
  bannerType: 'GRADIENT',
  bannerUrl: null,
  bannerValue: null,
  bannerFocusY: 50,
  isPaused: false,
  pauseMessage: null,
}

function zeichne(gemessen: number): string {
  messung.breite = gemessen
  return renderToStaticMarkup(
    createElement(HofseiteEditor, { fortschritt, hof, einstellungen: {} as FarmSettings, auftritt: {} as AppearanceData })
  )
}

describe('Spalten des Editors', () => {
  it('gemessen: Liste und Vorschau bekommen genau die Breiten der Regel, der Abstand ist EDITOR_ABSTAND', () => {
    // Auf dem Server gilt „nicht breit" (useMindestbreite): Handy-Spalte 320 px.
    const { liste, vorschau } = editorSpalten(1112, 'handy', false)
    const html = zeichne(1112)
    expect(html).toContain(`style="width:${liste}px"`)
    expect(html).toContain(`style="width:${vorschau}px"`)
    expect(html).toContain('style="gap:32px"')
    // Gegenprobe: Gemessen heißt ohne die Gerüst-Klassen und ohne Höchstbreite der Liste.
    expect(html).not.toContain(`max-width:${EDITOR_LISTE_HANDY_MAX}px`)
    expect(html).not.toContain(`w-[${EDITOR_HANDY_SPALTE}px]`)
  })

  it('gemessen auf einem sehr breiten Bildschirm: die Liste bleibt bei 720 px, die Regel deckelt die Gesamtbreite', () => {
    const html = zeichne(3000)
    expect(html).toContain(`style="width:${editorSpalten(3000, 'handy').liste}px"`)
    expect(html).toContain(`style="width:${EDITOR_LISTE_HANDY_MAX}px"`)
  })

  it('der äußere Rahmen begrenzt auf EDITOR_BREITE_MAX und zentriert das Paar', () => {
    const html = zeichne(1112)
    expect(html).toContain(`max-w-[${EDITOR_BREITE_MAX}px]`)
    expect(html).toMatch(/class="[^"]*\bmx-auto\b[^"]*"/)
    expect(html).toMatch(/class="[^"]*\bjustify-center\b[^"]*"/)
  })

  it('vor der ersten Messung gilt dieselbe Regel für Handy in CSS: die Klassen und die Höchstbreite hängen an den Konstanten', () => {
    const html = zeichne(0)
    expect(html).toContain(`w-[${EDITOR_HANDY_SPALTE}px] xl:w-[${EDITOR_HANDY_SPALTE_BREIT}px]`)
    expect(html).toContain(`style="max-width:${EDITOR_LISTE_HANDY_MAX}px"`)
    // Gegenprobe: Ungemessen hat keine Breite in Pixeln aus der Regel (der Balken des Fortschritts hat Prozent).
    expect(html).not.toMatch(/style="width:\d+px"/)
  })
})

describe('Hinweis, wo Produkte liegen', () => {
  it('steht am Ende der Liste — nach der letzten Gruppe, vor der Vorschau — als Link auf Produkte', () => {
    const html = zeichne(1112)
    expect(html).toContain(`<a href="${PRODUKTE_HREF}"`)
    expect(html).toContain(MEIN_HOF_HINWEIS)
    const hinweis = html.indexOf(MEIN_HOF_HINWEIS)
    expect(html.indexOf('Sichtbarkeit')).toBeLessThan(hinweis)
    expect(html.indexOf('Abschnitte der Hofseite')).toBeLessThan(hinweis)
    expect(hinweis).toBeLessThan(html.indexOf('aria-label="Vorschau"'))
  })

  it('der Satz kommt aus der Navigation, nicht aus einem eigenen Text im Editor', () => {
    // Gegenprobe: Die Quelle sagt, was der Satz ist; der Editor trägt ihn nicht ein zweites Mal.
    expect(MEIN_HOF_HINWEIS).toBe('Produkte verwaltest du links unter „Produkte“.')
    expect(zeichne(1112).match(/verwaltest du links/g)).toHaveLength(1)
  })
})

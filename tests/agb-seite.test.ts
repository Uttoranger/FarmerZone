/**
 * /agb — die Seite der AGB (Register O4, Nr. 90), gerendert.
 *
 * Beweist:
 *  - Oben stehen der Titel, der Stand-Vermerk „Fassung 0.9 – Entwurf, Stand
 *    13. Oktober 2026", der Knopf „Drucken/Speichern" und das
 *    Inhaltsverzeichnis; „Kurz erklärt" folgt als Einleitung, gekennzeichnet
 *    als „kein Teil der AGB", und erst dann Teil A.
 *  - Alle 29 Punkte sind Überschriften mit Sprungmarke, jeder in seinem Teil
 *    (A bis D), dazu der Anhang mit dem Muster-Rücktrittsformular.
 *  - Das Inhaltsverzeichnis springt zu jedem Punkt und zum Anhang; kein Sprung
 *    geht ins Leere.
 *  - Die Platzhalter des Entwurfs sind gefüllt: die E-Mail-Adresse als Link
 *    (dieselbe Konstante wie im Impressum), der Betreiber als Verweis auf das
 *    Impressum — nirgends steht noch eine Klammer „[… laut Impressum]".
 *  - Die Tabelle in Punkt 2.4 ist eine Tabelle; die Hinweise für die
 *    anwaltliche Prüfung stehen nicht auf der Seite.
 *  - Der Tab-Titel heißt „AGB — <Name>".
 * Der Wortlaut selbst: tests/agb-text.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('main', null, children),
}))

import AgbPage, { metadata } from '@/app/(public)/agb/page'
import { AGB_ANHANG, AGB_SEITE_TEXT, AGB_STAND_VERMERK, AGB_TEILE, AGB_TITEL } from '@/lib/rechtstexte/agb'
import { KONTAKT_EMAIL } from '@/lib/support'
import { MARKE } from '@/lib/marke'

const html = renderToStaticMarkup(createElement(AgbPage))

type Ueberschrift = { ebene: number; id: string; text: string }

/** Alle Überschriften mit Kennung und Text (ohne Tags). */
function ueberschriften(markup: string): Ueberschrift[] {
  return [...markup.matchAll(/<h([1-6])(?: id="([^"]*)")?[^>]*>(.*?)<\/h\1>/g)].map(([, ebene, id, inhalt]) => ({
    ebene: Number(ebene),
    id: id ?? '',
    text: inhalt.replace(/<[^>]*>/g, ''),
  }))
}

/** Alle Sprungmarken (href="#…") im Markup. */
const sprungmarken = (markup: string): string[] => [...markup.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])

const alleKennungen = (markup: string): Set<string> => new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))

describe('/agb', () => {
  it('der Tab-Titel heißt „AGB — Name"', () => {
    expect(metadata.title).toBe(`AGB — ${MARKE}`)
  })

  it('oben stehen Titel, Stand-Vermerk, Drucken-Knopf und Inhaltsverzeichnis — dann „Kurz erklärt", dann Teil A', () => {
    const stellen = [
      html.indexOf(`<h1`),
      html.indexOf(AGB_STAND_VERMERK),
      html.indexOf(AGB_SEITE_TEXT.drucken),
      html.indexOf('id="agb-inhalt"'),
      html.indexOf('id="kurz-erklaert"'),
      html.indexOf('id="teil-a"'),
    ]
    expect(stellen.every((s) => s > -1)).toBe(true)
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen)
    expect(ueberschriften(html)[0]).toMatchObject({ ebene: 1, text: AGB_TITEL })
    expect(AGB_STAND_VERMERK).toBe('Fassung 0.9 – Entwurf, Stand 13. Oktober 2026')
  })

  it('der Knopf „Drucken/Speichern" fehlt auf dem Papier, ebenso das Inhaltsverzeichnis', () => {
    const knopf = html.match(/<button[^>]*>/)?.[0] ?? ''
    expect(knopf).toContain('type="button"')
    expect(knopf).toContain('print:hidden')
    expect(html.match(/<nav[^>]*>/)?.[0]).toContain('print:hidden')
  })

  it('„Kurz erklärt" ist gekennzeichnet als kein Teil der AGB und nennt die sechs Aussagen', () => {
    const karte = html.slice(html.indexOf('id="kurz-erklaert"'), html.indexOf('id="teil-a"'))
    expect(karte).toContain('Kurz erklärt')
    expect(karte).toContain('(kein Teil der AGB)')
    expect(karte.match(/<li>/g)).toHaveLength(6)
  })

  it('alle 29 Punkte sind Überschriften mit Sprungmarke — in der Reihenfolge und je in ihrem Teil', () => {
    const alle = ueberschriften(html)
    const punkte = alle.filter((u) => u.ebene === 3)
    expect(punkte.map((u) => u.id)).toEqual(Array.from({ length: 29 }, (_, i) => `punkt-${i + 1}`))
    expect(punkte.map((u) => u.text)).toEqual(AGB_TEILE.flatMap((t) => t.punkte.map((p) => `${p.nummer}. ${p.titel}`)))
    // Die Teile stehen vor ihren Punkten: A vor 1, B vor 8, C vor 16, D vor 24.
    const teile = alle.filter((u) => u.ebene === 2 && u.id.startsWith('teil-'))
    expect(teile.map((u) => u.text)).toEqual(AGB_TEILE.map((t) => t.titel))
    for (const [teil, erster] of [['teil-a', 1], ['teil-b', 8], ['teil-c', 16], ['teil-d', 24]] as const) {
      expect(html.indexOf(`id="${teil}"`), teil).toBeGreaterThan(-1)
      expect(html.indexOf(`id="${teil}"`), teil).toBeLessThan(html.indexOf(`id="punkt-${erster}"`))
    }
    expect(html.indexOf('id="punkt-7"')).toBeLessThan(html.indexOf('id="teil-b"'))
    expect(html.indexOf('id="punkt-23"')).toBeLessThan(html.indexOf('id="teil-d"'))
  })

  it('der Anhang ist eine Überschrift am Ende und trägt das Muster-Rücktrittsformular', () => {
    const anhang = ueberschriften(html).find((u) => u.id === 'anhang')
    expect(anhang).toMatchObject({ ebene: 2, text: AGB_ANHANG.titel })
    expect(html.indexOf('id="punkt-29"')).toBeLessThan(html.indexOf('id="anhang"'))
    const formular = html.slice(html.indexOf('id="anhang"'))
    for (const zeile of ['An: [Name und Adresse des Hofs, E-Mail laut Bestellung]', 'Hiermit trete ich / treten wir (*)', 'Datum:', '(*) Unzutreffendes streichen.']) {
      expect(formular, zeile).toContain(zeile)
    }
  })

  it('das Inhaltsverzeichnis springt zu jedem Punkt und zum Anhang — kein Sprung geht ins Leere', () => {
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'))
    const sprünge = sprungmarken(nav)
    expect(sprünge).toEqual([...Array.from({ length: 29 }, (_, i) => `punkt-${i + 1}`), 'anhang'])
    const kennungen = alleKennungen(html)
    for (const ziel of sprungmarken(html)) expect(kennungen.has(ziel), ziel).toBe(true)
    // Die Gruppen des Verzeichnisses sind die vier Teile.
    for (const teil of AGB_TEILE) expect(nav, teil.titel).toContain(teil.titel)
  })

  it('Gegenprobe: ein Sprung auf eine fehlende Kennung fällt auf', () => {
    const probe = '<nav><a href="#punkt-1">1</a><a href="#punkt-99">99</a></nav><h3 id="punkt-1">1. Titel</h3>'
    const kennungen = alleKennungen(probe)
    expect(sprungmarken(probe).filter((ziel) => !kennungen.has(ziel))).toEqual(['punkt-99'])
    expect(ueberschriften(probe)).toEqual([{ ebene: 3, id: 'punkt-1', text: '1. Titel' }])
  })

  it('die Platzhalter sind gefüllt: E-Mail-Adresse als Link, der Betreiber als Verweis aufs Impressum', () => {
    expect(html).not.toContain('[Betreiber laut')
    expect(html).not.toContain('[E-Mail laut')
    expect(html).not.toContain('Rechtsform, Anschrift')
    // 1.1 (Betreiber mit Adresse), 5.2, 21.4 und 27.1.
    expect(html.match(new RegExp(`href="mailto:${KONTAKT_EMAIL}"`, 'g'))).toHaveLength(4)
    const punkt1 = html.slice(html.indexOf('id="punkt-1"'), html.indexOf('id="punkt-2"'))
    expect(punkt1).toContain(`${MARKE} wird betrieben von`)
    expect(punkt1).toContain('dem Betreiber laut')
    expect(punkt1.match(/href="\/impressum"/g)).toHaveLength(2)
  })

  it('die Links des Entwurfs führen auf Impressum, Konditionen, Datenschutz und die AGB selbst', () => {
    for (const pfad of ['/impressum', '/konditionen', '/datenschutz', '/agb']) {
      expect(html, pfad).toContain(`href="${pfad}"`)
    }
  })

  it('die Pflichtenverteilung in Punkt 2.4 ist eine Tabelle mit Kopf und fünf Zeilen', () => {
    const tabelle = html.match(/<table[\s\S]*?<\/table>/)?.[0] ?? ''
    expect(tabelle).toContain('<th')
    expect(tabelle).toContain('>Der Hof<')
    expect(tabelle).toContain(`>${MARKE}<`)
    expect(tabelle.match(/<tr/g)).toHaveLength(6)
    expect(html.indexOf('id="punkt-2"')).toBeLessThan(html.indexOf('<table'))
    expect(html.indexOf('<table')).toBeLessThan(html.indexOf('id="punkt-3"'))
  })

  it('die Hinweise für die anwaltliche Prüfung stehen nicht auf der Seite', () => {
    expect(html).not.toContain('anwaltliche')
    expect(html).not.toContain('Hinweise für')
  })

  it('keine Farbwerte im Markup — die Seite gilt hell und dunkel', () => {
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(html).not.toMatch(/\b(rgba?|hsla?|oklch)\(/)
  })
})

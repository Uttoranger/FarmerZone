/**
 * Vorlage der Rechtsseiten und Konditionen je Modell (V62, N38; Lauf 30, Nr. 231).
 *
 * Ursache: /agb, /datenschutz und /konditionen standen je für sich in den Formen
 * von infoseite-stil.ts, ohne Verzeichnis am Handy und ohne Stand-Zeile unter
 * dem Titel; /konditionen nannte nach dem Stichtag „Hofpreis-Modell ab“ noch
 * „Servicegebühr von 5 % … zahlt der Kunde“ und „In der Startphase kostenlos“
 * (Board-Notiz w3-rechtstexte: „im März 2027 falsch und ein Go-live-Risiko“).
 *
 * Beweist:
 *  - /konditionen ab dem Stichtag: kein „Servicegebühr“ im gerenderten Text, der
 *    Abschnitt „Plattformgebühr und Abrechnung“ mit der Kennzeichnung „Entwurf –
 *    die Anwältin prüft den Wortlaut“ direkt darüber, kein Übergangssatz, als
 *    Stand der Stichtag. Gegenprobe: vor dem Stichtag die Fassung „bisher“ ohne
 *    Kennzeichnung, mit Übergangssatz.
 *  - Die Vorlage: Kicker, h1, Stand-Zeile; Verzeichnis am Handy aufklappbar
 *    („Inhalt“ mit Zusammenfassung) und ab 1024 px als Spalte, beide nicht auf
 *    dem Papier; jeder Sprung trifft eine Überschrift; /konditionen ohne
 *    Verzeichnis und ohne Druckknopf (Board Bild 5 und 6).
 */
import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const stichtag = vi.hoisted(() => ({ wert: new Date('2099-01-01T00:00:00Z') }))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/server/queries/plattform-einstellung', () => ({
  gruendungFuerSeiten: async () => null,
  ladeHofpreisEinstellung: async () => ({ hofpreisModellAb: stichtag.wert }),
}))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

import KonditionenPage from '@/app/(public)/konditionen/page'
import DatenschutzPage from '@/app/(public)/datenschutz/page'
import AgbPage from '@/app/(public)/agb/page'
import { KONDITIONEN_ENTWURF, KONDITIONEN_STAND, KONDITIONEN_UEBERGANG } from '@/lib/konditionen'
import { formatDatumLang } from '@/lib/format'
import { RECHTSTEXT_TEXT } from '@/components/shared/rechtstext-vorlage'

const ohneTags = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ')
const entschaerft = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

async function konditionen(ab: Date): Promise<string> {
  stichtag.wert = ab
  return renderToStaticMarkup(await KonditionenPage())
}

describe('/konditionen — Gebühr je Modell', () => {
  const VORBEI = new Date('2026-01-01T00:00:00Z')
  const WEIT_WEG = new Date('2099-01-01T00:00:00Z')

  it('ab dem Stichtag steht nirgends „Servicegebühr“ — der Abschnitt heißt „Plattformgebühr und Abrechnung“', async () => {
    const html = await konditionen(VORBEI)
    expect(ohneTags(html)).not.toMatch(/Servicegebühr/)
    expect(html).toContain('>Plattformgebühr und Abrechnung</h2>')
  })

  it('ab dem Stichtag steht die Kennzeichnung „Entwurf“ unmittelbar über dem Abschnitt', async () => {
    const html = await konditionen(VORBEI)
    const marke = html.indexOf(KONDITIONEN_ENTWURF)
    expect(marke).toBeGreaterThan(-1)
    expect(html.indexOf('<h2 id="gebuehr"', marke)).toBeGreaterThan(marke)
    // Dazwischen steht nichts anderes als das Ende der Marke.
    expect(ohneTags(html.slice(marke, html.indexOf('<h2 id="gebuehr"'))).trim()).toBe(KONDITIONEN_ENTWURF)
  })

  it('ab dem Stichtag fehlt der Übergangssatz der Startphase, Stand ist der Stichtag', async () => {
    const html = await konditionen(VORBEI)
    expect(html).not.toContain(entschaerft(KONDITIONEN_UEBERGANG))
    expect(html).not.toMatch(/Startphase/)
    expect(html).toContain(RECHTSTEXT_TEXT.stand(formatDatumLang(VORBEI)))
  })

  it('Gegenprobe: vor dem Stichtag die Fassung „bisher“ — Servicegebühr, Übergang, kein Entwurf', async () => {
    const html = await konditionen(WEIT_WEG)
    expect(html).toContain('>Servicegebühr und Abrechnung</h2>')
    expect(html).toContain(KONDITIONEN_UEBERGANG)
    expect(html).not.toContain(KONDITIONEN_ENTWURF)
    expect(html).toContain(RECHTSTEXT_TEXT.stand(KONDITIONEN_STAND))
  })

  it('kein Verzeichnis und kein Druckknopf (Board w3-rechtstexte Bild 5 und 6)', async () => {
    const html = await konditionen(VORBEI)
    expect(html).not.toContain('<nav')
    expect(html).not.toContain(RECHTSTEXT_TEXT.drucken)
  })
})

describe('Vorlage der Rechtsseiten — /agb und /datenschutz', () => {
  const seiten = [
    ['/agb', renderToStaticMarkup(createElement(AgbPage))],
    ['/datenschutz', renderToStaticMarkup(createElement(DatenschutzPage))],
  ] as const

  it.each(seiten)('%s: Kicker, h1 und Stand-Zeile oben, dann der Druckknopf', (_seite, html) => {
    const stellen = [html.indexOf(RECHTSTEXT_TEXT.kicker), html.indexOf('<h1'), html.indexOf(RECHTSTEXT_TEXT.drucken)]
    expect(stellen.every((s) => s > -1)).toBe(true)
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen)
  })

  it.each(seiten)('%s: das Verzeichnis steht zweimal — am Handy aufklappbar, ab 1024 px als Spalte, nie auf dem Papier', (_seite, html) => {
    const details = html.match(/<details[^>]*>/)?.[0] ?? ''
    expect(details).toContain('lg:hidden')
    expect(details).toContain('print:hidden')
    expect(html).toMatch(/<summary[^>]*>/)
    const aside = html.match(/<aside[^>]*>/)?.[0] ?? ''
    expect(aside).toContain('lg:block')
    expect(aside).toContain('print:hidden')
    expect(html.match(/<nav[^>]*>/g)).toHaveLength(2)
  })

  it.each(seiten)('%s: jeder Sprung des Verzeichnisses trifft eine Kennung der Seite', (_seite, html) => {
    const kennungen = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
    const spruenge = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
    expect(spruenge.length).toBeGreaterThan(10)
    for (const ziel of spruenge) expect(kennungen.has(ziel), ziel).toBe(true)
  })

  it('/datenschutz: „Inhalt“ fasst die 14 Abschnitte zusammen, jede Überschrift ist ein Sprungziel', () => {
    const html = seiten[1][1]
    expect(html).toContain(RECHTSTEXT_TEXT.abschnitte(14))
    const ueberschriften = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1])
    expect(ueberschriften).toHaveLength(14)
    // Je Abschnitt zwei Sprünge: einer im Verzeichnis am Handy, einer in der Spalte.
    for (const anker of ueberschriften) expect(html.split(`href="#${anker}"`).length - 1, anker).toBe(2)
  })

  it('/agb: „Inhalt“ nennt Teile, Punkte und Anhang', () => {
    expect(seiten[0][1]).toContain(RECHTSTEXT_TEXT.teileUndPunkte(4, 29, true))
  })

  it('Gegenprobe: die Zusammenfassung zählt richtig', () => {
    expect(RECHTSTEXT_TEXT.teileUndPunkte(2, 3, false)).toBe('2 Teile · 3 Punkte')
    expect(RECHTSTEXT_TEXT.abschnitte(1)).toBe('1 Abschnitt')
  })
})

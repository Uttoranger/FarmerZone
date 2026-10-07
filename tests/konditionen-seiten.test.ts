/**
 * /fuer-hoefe und /konditionen sagen über Preise dasselbe (Nr. 15, E6 = Tarife:
 * „damit nichts Widersprüchliches live geht").
 *
 * Beweis an zwei Stellen:
 *  1. Quelltext: Beide Seiten (und die Abschnitte von /fuer-hoefe) holen jede
 *     Zahl aus src/lib/konditionen.ts — kein Euro- oder Prozent-Literal, kein
 *     Gründungshof-Preistext mehr auf /konditionen. Mit Gegenprobe, dass die
 *     Suche anschlägt.
 *  2. Gerendert: Beide Seiten nennen jeden Tarif mit seinem Preis und den Satz
 *     der Servicegebühr — und keine von beiden die alte „Plattformgebühr".
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => createElement('img', { alt }),
}))
// Die Kopfzeilen lesen Sitzung und Pfad im Browser — hier zählt nur der Inhalt.
vi.mock('@/components/shared/kunden-kopf', () => ({ KundenKopf: () => null }))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

import KonditionenPage from '@/app/(public)/konditionen/page'
import FuerHoefePage from '@/app/(public)/fuer-hoefe/page'
import { BAR_OHNE_GEBUEHR_SATZ, SERVICEGEBUEHR_SATZ_TEXT, TARIFE, servicegebuehrZahltKunde, vorBarStichtag } from '@/lib/konditionen'
import { FUER_HOEFE_FRAGEN } from '@/lib/fuer-hoefe'

const lies = (datei: string): string => readFileSync(join(process.cwd(), datei), 'utf8')
const entschaerft = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

const PREISSEITEN = [
  'src/app/(public)/konditionen/page.tsx',
  'src/app/(public)/fuer-hoefe/page.tsx',
  'src/components/fuer-hoefe/fuer-hoefe-abschnitte.tsx',
  // Nr. 22d: „Deine Konditionen" in den Einstellungen — dieselbe Quelle.
  'src/app/(hof)/settings/konditionen/page.tsx',
  'src/components/hof-einstellungen/konditionen-ansicht.tsx',
]

/**
 * Ein Betrag oder Satz als Literal im Quelltext: „19 €", „€ 19", „5 %", „4,9 %".
 * Nicht: Tailwind-Klassen wie `to-70%` (vor der Zahl ein Bindestrich).
 */
const ZAHL_LITERAL = /((?<![\w-])\d+(?:[.,]\d+)?\s*(?:€|%|Euro|Prozent))|(€\s*\d)/

describe('Quelltext — eine Quelle für Preise', () => {
  it('keine Preisseite schreibt einen Betrag oder Satz selbst', () => {
    for (const datei of PREISSEITEN) {
      const ohneKommentare = lies(datei)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(ohneKommentare, datei).not.toMatch(ZAHL_LITERAL)
    }
  })

  it('Gegenprobe: die Suche erkennt Literale', () => {
    for (const text of ['Hofladen 19 € im Monat', 'ab € 0', 'Gebühr 5 %', '4,9 Prozent']) {
      expect(text).toMatch(ZAHL_LITERAL)
    }
    expect('bg-linear-120 from-primary/16 to-card to-70%').not.toMatch(ZAHL_LITERAL)
  })

  it('beide Seiten lesen die Preise aus src/lib/konditionen.ts', () => {
    expect(lies('src/app/(public)/konditionen/page.tsx')).toContain("from '@/lib/konditionen'")
    expect(lies('src/components/fuer-hoefe/fuer-hoefe-abschnitte.tsx')).toContain("from '@/lib/konditionen'")
  })

  it('/konditionen nennt das Gründungshof-Angebot nicht mehr (E6 entschieden)', () => {
    const seite = lies('src/app/(public)/konditionen/page.tsx')
    for (const name of ['GRUENDUNGS_ANGEBOT', 'GRUENDUNGS_PROVISION_PROZENT', 'GRUENDUNGSPHASE_ENDE', 'MAX_GRUENDUNGSHOEFE', 'GRUENDUNGS_ZAHLUNGSGEBUEHREN', 'GRUENDUNGS_KEINE_ZUGANGSGRENZE']) {
      expect(seite, name).not.toContain(name)
    }
  })
})

describe('Gerendert — dieselben Preise auf beiden Seiten', () => {
  const konditionen = renderToStaticMarkup(createElement(KonditionenPage))
  const fuerHoefe = renderToStaticMarkup(createElement(FuerHoefePage))

  it.each([
    ['/konditionen', konditionen],
    ['/fuer-hoefe', fuerHoefe],
  ])('%s nennt jeden Tarif mit Preis und den Satz der Servicegebühr', (_seite, html) => {
    for (const tarif of TARIFE) {
      expect(html).toContain(tarif.name)
      expect(html).toContain(tarif.preis)
    }
    expect(html).toContain(SERVICEGEBUEHR_SATZ_TEXT)
  })

  it.each([
    ['/konditionen', konditionen],
    ['/fuer-hoefe', fuerHoefe],
  ])('%s nennt den Grundsatz samt Bar-Ausnahme bis zum SEPA-Start (Register B1) aus konditionen.ts', (_seite, html) => {
    // Gerendert mit der echten Uhr: vor dem Stichtag mit Ausnahme, danach ohne (tests/bargebuehr.test.ts).
    expect(html).toContain(servicegebuehrZahltKunde(new Date()))
    expect(html.includes(BAR_OHNE_GEBUEHR_SATZ)).toBe(vorBarStichtag(new Date()))
  })

  it.each([
    ['/konditionen', konditionen],
    ['/fuer-hoefe', fuerHoefe],
  ])('%s spricht nicht mehr von Plattformgebühr oder Gründungshöfen', (_seite, html) => {
    expect(html).not.toMatch(/Plattformgebühr|Gründungs/)
  })
})

describe('/fuer-hoefe — Aufbau', () => {
  const html = renderToStaticMarkup(createElement(FuerHoefePage))

  it('eine Überschrift erster Ordnung, Wege zur Registrierung und zu den Konditionen', () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain('Dein Hofladen, online.')
    expect(html).toContain('href="/register"')
    expect(html).toContain('href="/konditionen"')
  })

  it('das Bild der App ist ein Bild mit Beschreibung — für Web und Handy je eins', () => {
    const bilder = html.match(/role="img" aria-label="Beispielbild der App[^"]*"/g) ?? []
    expect(bilder).toHaveLength(2)
    // Erfundene Daten, kein Hof aus der Datenbank.
    expect(html).toContain('Beispielhof')
    expect(html).toContain('Max Mustermann')
  })

  it('alle Antworten stehen im HTML, auch zugeklappt — die erste offen', () => {
    for (const { frage, antwort } of FUER_HOEFE_FRAGEN) {
      expect(html).toContain(entschaerft(frage))
      expect(html).toContain(entschaerft(antwort))
    }
    expect(html.match(/<details[^>]*open=""/g)).toHaveLength(1)
  })

  it('verspricht kein QR-Plakat, solange es keins gibt (Gate 7)', () => {
    expect(html).not.toMatch(/QR/)
  })
})

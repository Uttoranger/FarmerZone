/**
 * /agb und /agb/<Fassung> — die Seiten der AGB (Register O4, N45), gerendert.
 * Uhr und Einstellung sind gemockt (Stichtag aus ladePlattformEinstellung).
 *
 * Beweist:
 *  - /agb wird bei jedem Aufruf frisch gebaut: `dynamic = 'force-dynamic'`,
 *    kein `revalidate`.
 *  - Vor dem Stichtag: Fassung 0.9 mit dem Hinweis „Ab <Tag> gilt Fassung 1.0.“
 *    und dem Link auf /agb/1.0. Ab dem Stichtag: Fassung 1.0 („gilt ab <Tag>“)
 *    mit dem Link auf /agb/0.9 („für Bestellungen bis <Vortag>“).
 *  - Stichtag verschoben → Datum und Fassung folgen, ohne neuen Bau.
 *  - Ladefehler → die Seite wirft (kein catch, keine stille Vorgabe), und
 *    agb/error.tsx zeigt „Die AGB lassen sich gerade nicht laden.“ mit den
 *    Links auf beide Fassungen statt einer Fassung.
 *  - /agb/[fassung]: generateStaticParams genau 0.9 und 1.0, dynamicParams
 *    = false (A005 4b); alles andere notFound, bevor etwas gelesen wird;
 *    revalidate 3600; 1.0 liest den Stichtag erst nach `connection()` (keine
 *    Datenbank im Bau der CI), 0.9 liest nichts; Canonical auf sich selbst,
 *    der feste Satz „Welche Fassung gerade gilt, steht auf /agb.“; je Fassung
 *    alle Punkte mit Sprungmarke, kein Sprung ins Leere; Anhang 1/2 von 1.0
 *    enthalten Sätze aus BELEHRUNG.
 *  - Titel, Drucken-Knopf, Verzeichnis, „Kurz erklärt“, Platzhalter gefüllt,
 *    keine Hinweise für die anwaltliche Prüfung, keine Farbwerte.
 * Der Wortlaut selbst: tests/agb-text.test.ts und tests/agb-wortgleich.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('main', null, children),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
// Die Reihenfolge zählt: Für 1.0 muss `connection()` VOR dem Lesen des Stichtags laufen (Bau ohne Datenbank).
const ablauf = vi.hoisted(() => [] as string[])
vi.mock('next/server', () => ({
  connection: async () => {
    ablauf.push('connection')
  },
}))
const lade = vi.hoisted(() => vi.fn())
vi.mock('@/server/queries/plattform-einstellung', () => ({
  ladePlattformEinstellung: (...args: unknown[]) => {
    ablauf.push('lade')
    return lade(...args)
  },
}))

import * as AgbSeite from '@/app/(public)/agb/page'
import AgbPage, { metadata } from '@/app/(public)/agb/page'
import * as FassungSeite from '@/app/(public)/agb/[fassung]/page'
import AgbFassungPage, { generateMetadata, generateStaticParams } from '@/app/(public)/agb/[fassung]/page'
import AgbFehler from '@/app/(public)/agb/error'
import { AGB_TEXTE } from '@/lib/rechtstexte/agb-texte'
import { AGB_SEITE_TEXT } from '@/lib/rechtstexte/agb-einbindung'
import { PLATTFORM_EINSTELLUNG_STANDARD } from '@/lib/plattform-einstellung'
import { BELEHRUNG } from '@/lib/widerruf'
import { formatDatumLang } from '@/lib/format'
import { KONTAKT_EMAIL } from '@/lib/support'
import { MARKE } from '@/lib/marke'

const STICHTAG = new Date('2027-02-01T00:00:00+01:00')
const VOR_T = new Date('2027-01-31T23:59:00+01:00')
const AB_T = new Date('2027-02-01T00:00:00+01:00')

function mitStichtag(stichtag: Date | null): void {
  lade.mockResolvedValue({ ...PLATTFORM_EINSTELLUNG_STANDARD, hofpreisModellAb: stichtag ? stichtag.toISOString() : null })
}

async function agbUm(jetzt: Date): Promise<string> {
  vi.setSystemTime(jetzt)
  return renderToStaticMarkup(await AgbPage())
}

async function fassungSeite(fassung: string): Promise<string> {
  return renderToStaticMarkup(await AgbFassungPage({ params: Promise.resolve({ fassung }) }))
}

type Ueberschrift = { ebene: number; id: string; text: string }

function ueberschriften(markup: string): Ueberschrift[] {
  return [...markup.matchAll(/<h([1-6])(?: id="([^"]*)")?[^>]*>(.*?)<\/h\1>/g)].map(([, ebene, id, inhalt]) => ({
    ebene: Number(ebene),
    id: id ?? '',
    text: inhalt.replace(/<[^>]*>/g, ''),
  }))
}

const sprungmarken = (markup: string): string[] => [...markup.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
const alleKennungen = (markup: string): Set<string> => new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
const ohneTags = (markup: string): string => markup.replace(/<[^>]*>/g, '')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  mitStichtag(STICHTAG)
})
afterEach(() => {
  vi.useRealTimers()
  lade.mockReset()
})

describe('/agb — frisch je Aufruf, die Fassung folgt dem Stichtag', () => {
  it('force-dynamic, kein revalidate; Tab-Titel und Canonical wie bisher', () => {
    expect(AgbSeite.dynamic).toBe('force-dynamic')
    expect('revalidate' in AgbSeite).toBe(false)
    expect(metadata.title).toBe(`AGB — ${MARKE}`)
    expect(metadata.alternates?.canonical).toBe('/agb')
  })

  it('vor dem Stichtag: 0.9 mit dem Hinweis „Ab <Tag> gilt Fassung 1.0.“ und dem Link auf /agb/1.0', async () => {
    const html = await agbUm(VOR_T)
    expect(html).toContain(AGB_TEXTE['0.9'].vermerk({ inkrafttreten: null }))
    expect(ohneTags(html)).toContain(AGB_SEITE_TEXT.abStichtag(formatDatumLang(STICHTAG)))
    expect(html).toContain(`href="/agb/1.0"`)
    expect(html).toContain(AGB_SEITE_TEXT.fassung10Lesen)
    // Der Hinweis steht vor dem Text, die 0.9 hat 29 Punkte und keinen Link zurück auf 0.9.
    expect(html.indexOf(AGB_SEITE_TEXT.fassung10Lesen)).toBeLessThan(html.indexOf('id="teil-a"'))
    expect(ueberschriften(html).filter((u) => u.ebene === 3)).toHaveLength(29)
    expect(html).not.toContain('href="/agb/0.9"')
  })

  it('ab dem Stichtag (genau an der Grenze): 1.0 mit Datum und am Ende der Link auf 0.9 bis zum Vortag', async () => {
    const html = await agbUm(AB_T)
    expect(html).toContain(`Fassung 1.0 – gilt ab ${formatDatumLang(STICHTAG)}`)
    expect(ueberschriften(html).filter((u) => u.ebene === 3)).toHaveLength(35)
    const frueher = AGB_SEITE_TEXT.frueher(formatDatumLang(new Date('2027-01-31T12:00:00+01:00')))
    expect(ohneTags(html)).toContain(frueher)
    expect(html).toContain('href="/agb/0.9"')
    expect(html.lastIndexOf('href="/agb/0.9"')).toBeGreaterThan(html.indexOf('id="anhang-3"'))
    // Gegenprobe: kein Hinweis „Ab <Tag> gilt …“ mehr.
    expect(html).not.toContain(AGB_SEITE_TEXT.fassung10Lesen)
  })

  it('Stichtag verschoben → Datum und Fassung folgen, ohne Bau', async () => {
    const spaeter = new Date('2027-03-01T00:00:00+01:00')
    mitStichtag(spaeter)
    const vorher = await agbUm(AB_T)
    expect(vorher).toContain(AGB_TEXTE['0.9'].vermerk({ inkrafttreten: null }))
    expect(ohneTags(vorher)).toContain(AGB_SEITE_TEXT.abStichtag(formatDatumLang(spaeter)))
    const danach = await agbUm(new Date('2027-03-01T00:00:01+01:00'))
    expect(danach).toContain(`Fassung 1.0 – gilt ab ${formatDatumLang(spaeter)}`)
    expect(ohneTags(danach)).toContain(AGB_SEITE_TEXT.frueher(formatDatumLang(new Date('2027-02-28T12:00:00+01:00'))))
  })

  it('ohne Wert in der Datenbank gilt die Vorgabe als Stichtag — sichtbar als Datum, nie still', async () => {
    mitStichtag(null)
    const html = await agbUm(VOR_T)
    expect(ohneTags(html)).toContain(AGB_SEITE_TEXT.abStichtag(formatDatumLang(STICHTAG)))
  })

  it('Ladefehler → die Seite wirft (keine Fassung ohne geprüften Stichtag), error.tsx zeigt den Satz und beide Fassungen', async () => {
    lade.mockRejectedValue(new Error('Datenbank weg'))
    vi.setSystemTime(AB_T)
    await expect(AgbPage()).rejects.toThrow('Datenbank weg')
    const fehler = renderToStaticMarkup(createElement(AgbFehler, { error: Object.assign(new Error('x'), { digest: 'abc123' }), reset: () => {} }))
    expect(fehler).toContain(AGB_SEITE_TEXT.fehlerTitel)
    expect(fehler).toContain('href="/agb/1.0"')
    expect(fehler).toContain('href="/agb/0.9"')
    expect(ohneTags(fehler)).toContain('Fassung 1.0')
    expect(ohneTags(fehler)).toContain('Fassung 0.9')
    // Gegenprobe: kein AGB-Text auf der Fehlerseite.
    expect(fehler).not.toContain('id="teil-a"')
    expect(fehler).not.toContain('Kurz erklärt')
  })
})

describe('/agb/[fassung] — genau eine Fassung', () => {
  it('nur 0.9 und 1.0 (generateStaticParams, dynamicParams = false, A005 4b), Stundentakt; alles andere gibt es nicht', async () => {
    expect(generateStaticParams()).toEqual([{ fassung: '0.9' }, { fassung: '1.0' }])
    expect(FassungSeite.dynamicParams).toBe(false)
    expect('dynamic' in FassungSeite).toBe(false)
    expect(FassungSeite.revalidate).toBe(3600)
    await expect(fassungSeite('2.0')).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(fassungSeite('../agb')).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('1.0 liest den Stichtag erst nach connection() — der Bau der CI hat keine Datenbank; 0.9 liest nichts', async () => {
    ablauf.length = 0
    await fassungSeite('1.0')
    expect(ablauf).toEqual(['connection', 'lade'])
    ablauf.length = 0
    await fassungSeite('0.9')
    expect(ablauf).toEqual([])
    // Gegenprobe: eine fremde Kennung liest ebenfalls nichts.
    await expect(fassungSeite('2.0')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(ablauf).toEqual([])
  })

  it('Canonical auf sich selbst', async () => {
    for (const fassung of ['0.9', '1.0']) {
      const meta = await generateMetadata({ params: Promise.resolve({ fassung }) })
      expect(meta.alternates?.canonical).toBe(`/agb/${fassung}`)
    }
  })

  it.each([
    ['0.9', 29, ['anhang']],
    ['1.0', 35, ['anhang-1', 'anhang-2', 'anhang-3']],
  ] as const)('/agb/%s: Vermerk, fester Satz, %i Punkte mit Sprungmarke, kein Sprung ins Leere', async (fassung, punkte, anhaenge) => {
    vi.setSystemTime(fassung === '0.9' ? AB_T : VOR_T)
    const html = await fassungSeite(fassung)
    const daten = AGB_TEXTE[fassung]
    expect(html).toContain(daten.vermerk({ inkrafttreten: STICHTAG }))
    expect(ohneTags(html)).toContain('Welche Fassung gerade gilt, steht auf /agb.')
    expect(html).toContain('href="/agb"')
    const ebene3 = ueberschriften(html).filter((u) => u.ebene === 3)
    expect(ebene3.map((u) => u.id)).toEqual(Array.from({ length: punkte }, (_, i) => `punkt-${i + 1}`))
    expect(ebene3.map((u) => u.text)).toEqual(daten.teile.flatMap((t) => t.punkte.map((p) => `${p.nummer}. ${p.titel}`)))
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'))
    expect(sprungmarken(nav)).toEqual(['kurz-erklaert', ...Array.from({ length: punkte }, (_, i) => `punkt-${i + 1}`), ...anhaenge])
    const kennungen = alleKennungen(html)
    for (const ziel of sprungmarken(html)) expect(kennungen.has(ziel), ziel).toBe(true)
    // Keine Sätze, die von der Uhr abhängen.
    expect(html).not.toContain(AGB_SEITE_TEXT.fassung10Lesen)
    expect(ohneTags(html)).not.toContain('Frühere Fassung')
  })

  it('/agb/1.0: Anhang 1 und 2 enthalten Sätze aus BELEHRUNG, Anhang 3 die Auftragsverarbeitung', async () => {
    const html = await fassungSeite('1.0')
    const anhang1 = html.slice(html.indexOf('id="anhang-1"'), html.indexOf('id="anhang-2"'))
    const anhang2 = html.slice(html.indexOf('id="anhang-2"'), html.indexOf('id="anhang-3"'))
    expect(anhang1).toContain(BELEHRUNG.teilA.abschnitte[0].absaetze[0])
    expect(anhang1).toContain('Folgen des Widerrufs')
    expect(anhang1).toContain('Ende des gesetzlichen Musters.')
    expect(anhang2).toContain(BELEHRUNG.teilB.zeilen[1].replace(/\(/g, '(').replace(/'/g, '&#x27;'))
    expect(anhang2).toContain(BELEHRUNG.teilB.fussnote)
    expect(html.slice(html.indexOf('id="anhang-3"'))).toContain('Parteien und Gegenstand.')
    // Die kursiven Hinweise stehen kursiv.
    expect(anhang1).toMatch(/<p class="italic">Dein Vertragspartner ist der Hof/)
  })

  it('Gegenprobe: ein Sprung auf eine fehlende Kennung fällt auf', () => {
    const probe = '<nav><a href="#punkt-1">1</a><a href="#punkt-99">99</a></nav><h3 id="punkt-1">1. Titel</h3>'
    const kennungen = alleKennungen(probe)
    expect(sprungmarken(probe).filter((ziel) => !kennungen.has(ziel))).toEqual(['punkt-99'])
  })
})

describe('Rahmen beider Fassungen auf /agb', () => {
  it.each([
    ['vor dem Stichtag', VOR_T, 4],
    ['ab dem Stichtag', AB_T, 6],
  ] as const)('%s: Titel, Stand, Drucken, Verzeichnis, „Kurz erklärt“, Platzhalter gefüllt (%i Mail-Links)', async (_, jetzt, mails) => {
    const html = await agbUm(jetzt)
    const stellen = [html.indexOf('<h1'), html.indexOf('Fassung '), html.indexOf(AGB_SEITE_TEXT.drucken), html.indexOf('id="agb-inhalt"'), html.indexOf('id="kurz-erklaert"'), html.indexOf('id="teil-a"')]
    expect(stellen.every((s) => s > -1)).toBe(true)
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen)
    expect(ueberschriften(html)[0]).toMatchObject({ ebene: 1, text: `Allgemeine Geschäftsbedingungen (AGB) von ${MARKE}` })
    const karte = html.slice(html.indexOf('id="kurz-erklaert"'), html.indexOf('id="teil-a"'))
    expect(karte).toContain('(kein Teil der AGB)')
    expect(karte.match(/<li>/g)).toHaveLength(6)
    expect(html).not.toContain('[Betreiber laut')
    expect(html).not.toContain('[E-Mail laut')
    expect(html).not.toContain('[Tag des Inkrafttretens]')
    // Betreiber (mit Adresse) und jede Stelle „[E-Mail laut Impressum]“.
    expect(html.match(new RegExp(`href="mailto:${KONTAKT_EMAIL}"`, 'g'))).toHaveLength(mails)
    expect(html).not.toContain('anwaltliche')
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(html).not.toMatch(/\b(rgba?|hsla?|oklch)\(/)
    const knopf = html.match(/<button[^>]*>/)?.[0] ?? ''
    expect(knopf).toContain('print:hidden')
  })

  it('1.0: die Pflichtenverteilung in 2.6 ist eine Tabelle mit Kopf und fünf Zeilen; „[Tag des Inkrafttretens]“ als Datum in 32.4', async () => {
    const html = await agbUm(AB_T)
    const tabelle = html.match(/<table[\s\S]*?<\/table>/)?.[0] ?? ''
    expect(tabelle).toContain('>Der Hof<')
    expect(tabelle).toContain(`>${MARKE}<`)
    expect(tabelle.match(/<tr/g)).toHaveLength(6)
    const punkt32 = ohneTags(html.slice(html.indexOf('id="punkt-32"'), html.indexOf('id="punkt-33"')))
    expect(punkt32).toContain(`vor dem ${formatDatumLang(STICHTAG)} dabei waren`)
    expect(punkt32).toContain(`ab dem ${formatDatumLang(STICHTAG)}, frühestens aber 30 Tage`)
  })
})

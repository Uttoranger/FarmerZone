/**
 * Stripe-Pflicht für Höfe (Register Z1, Nachtlauf Nr. 24).
 *
 * Beweist:
 *  - Kein Server-Weg schreibt `acceptsOnline` auf etwas anderes als true —
 *    eine Wahl „nur bar" kann der Hof also nicht setzen (Quelltext-Wache mit
 *    Gegenprobe). Lesen bleibt erlaubt: Die Notbremse und der Checkout fragen
 *    das Feld weiter ab.
 *  - Die Sätze zur Pflicht stehen EINMAL in src/lib/konditionen.ts; Einrichten,
 *    Erste Schritte, Heute und Zahlung lesen sie von dort.
 *  - /fuer-hoefe, /konditionen und Registrieren nennen die Stripe-Einrichtung
 *    als Teil des Starts — und keine Seite deutet eine Bar-Option für Höfe an.
 *    Barzahlung durch Kundinnen (B1) bleibt erlaubt.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => createElement('img', { alt }),
}))
vi.mock('@/components/shared/kunden-kopf', () => ({ KundenKopf: () => null }))
vi.mock('@/components/shells/kunde-shell-mit-sitzung', () => ({
  KundeShellMitSitzung: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

import KonditionenPage from '@/app/(public)/konditionen/page'
import FuerHoefePage from '@/app/(public)/fuer-hoefe/page'
import {
  ONLINE_ZAHLUNG_EINRICHTEN_SATZ,
  ONLINE_ZAHLUNG_START_KURZ,
  ONLINE_ZAHLUNG_START_SCHRITT,
} from '@/lib/konditionen'
import { FUER_HOEFE_FRAGEN, FUER_HOEFE_SCHRITTE, FUER_HOEFE_VORTEILE, REGISTRIEREN_SCHRITTE } from '@/lib/fuer-hoefe'
import { GRUENDUNGS_AUFNAHME_SCHRITTE } from '@/lib/gruendungshof'

const WURZEL = process.cwd()
const lies = (datei: string): string => readFileSync(join(WURZEL, datei), 'utf8')
const ohneKommentare = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const entschaerft = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

function alleDateien(ordner: string): string[] {
  return readdirSync(join(WURZEL, ordner)).flatMap((name) => {
    const pfad = join(ordner, name)
    return statSync(join(WURZEL, pfad)).isDirectory() ? alleDateien(pfad) : /\.tsx?$/.test(name) ? [pfad] : []
  })
}

// ─── Kein Server-Weg setzt „nur bar" ────────────────────────────────────────

/**
 * Ein Vorkommen von `acceptsOnline`, das kein Lesen ist: nicht hinter einem
 * Punkt (`farm.acceptsOnline`) und nicht `acceptsOnline: true` (Auswahl in
 * `select` oder das Setzen auf true). Trifft `acceptsOnline: false`,
 * `acceptsOnline: eingabe.x`, die Kurzform `{ acceptsOnline }` und Ähnliches.
 */
const SCHREIBT_ACCEPTS_ONLINE = /(?<![.\w])acceptsOnline\b(?!\s*:\s*true\b)/

/** Wege, auf denen ein Hof etwas schreiben kann: Server Actions und API-Routen. */
function serverWege(): string[] {
  return alleDateien('src').filter((d) => {
    if (d.startsWith(join('src', 'app', 'api'))) return true
    return /^\s*['"]use server['"]/m.test(lies(d))
  })
}

describe('Register Z1 — der Server lehnt acceptsOnline = false ab', () => {
  it('keine Server Action und keine API-Route schreibt acceptsOnline anders als true', () => {
    const wege = serverWege()
    // Die Wache muss die Actions und den Checkout tatsächlich sehen.
    expect(wege).toContain(join('src', 'server', 'actions', 'farm.ts'))
    expect(wege).toContain(join('src', 'app', 'api', 'checkout', 'route.ts'))
    for (const datei of wege) {
      expect(ohneKommentare(lies(datei)), relative(WURZEL, datei)).not.toMatch(SCHREIBT_ACCEPTS_ONLINE)
    }
  })

  it('Gegenprobe: die Suche erkennt jedes Schreiben und lässt das Lesen durch', () => {
    for (const text of [
      'data: { acceptsOnline: false }',
      'data: { acceptsOnline: v.data.online }',
      'data: { acceptsOnline, acceptsOnsite }',
      'acceptsOnline:false',
    ]) {
      expect(text).toMatch(SCHREIBT_ACCEPTS_ONLINE)
    }
    for (const text of ['select: { acceptsOnline: true }', 'if (!farm.acceptsOnline) return', 'hof.acceptsOnline && x']) {
      expect(text).not.toMatch(SCHREIBT_ACCEPTS_ONLINE)
    }
  })

  it('Schemas und Formulare kennen kein Feld für die Wahl „nur bar"', () => {
    for (const datei of [...alleDateien('src/schemas'), ...alleDateien('src/components/settings')]) {
      expect(lies(datei), datei).not.toMatch(/acceptsOnline/)
    }
  })
})

// ─── Text aus einer Quelle ──────────────────────────────────────────────────

describe('Text aus einer Quelle (konditionen.ts)', () => {
  it('der Satz aus der Freigabe steht wörtlich in konditionen.ts', () => {
    expect(ONLINE_ZAHLUNG_EINRICHTEN_SATZ).toBe(
      'Damit deine Kundinnen auch mit Karte, Apple Pay oder EPS zahlen können, richte bitte die Online-Zahlung ein. Dauert etwa 10 Minuten.'
    )
  })

  it('kein anderes Modul schreibt die Sätze ab', () => {
    const merkmale = ['Apple Pay oder EPS', 'Gehört zum Start', 'gehört zum Start']
    for (const datei of alleDateien('src')) {
      if (datei === join('src', 'lib', 'konditionen.ts')) continue
      const text = ohneKommentare(lies(datei))
      for (const m of merkmale) expect(text.includes(m), `${datei}: ${m}`).toBe(false)
    }
  })

  it('Gegenprobe: konditionen.ts enthält die Merkmale', () => {
    const quelle = lies('src/lib/konditionen.ts')
    expect(quelle).toContain('Apple Pay oder EPS')
    expect(quelle).toContain('Gehört zum Start')
  })

  it.each([
    'src/lib/einrichten.ts',
    'src/lib/erste-schritte.ts',
    'src/components/heute/heute-teile.tsx',
    'src/app/(hof)/settings/payments/page.tsx',
  ])('%s liest den Satz aus konditionen.ts', (datei) => {
    expect(lies(datei)).toMatch(/import \{[^}]*ONLINE_ZAHLUNG_EINRICHTEN_SATZ[^}]*\} from '@\/lib\/konditionen'/)
  })
})

// ─── Öffentliche Seiten ─────────────────────────────────────────────────────

/** Was eine Bar-Option für Höfe andeuten würde. Barzahlung durch Kundinnen ist etwas anderes. */
const BAR_OPTION_FUER_HOEFE =
  /nur bar|ohne Online-Zahlung|Online-Zahlung (?:ist )?(?:optional|freiwillig|ein Plus)|kein Muss|geht auch ohne|keine Einrichtung nötig/i

describe('/fuer-hoefe, /konditionen und Registrieren nennen Stripe als Teil des Starts', () => {
  const fuerHoefe = renderToStaticMarkup(createElement(FuerHoefePage))
  const konditionen = renderToStaticMarkup(createElement(KonditionenPage))

  it.each([
    ['/fuer-hoefe', fuerHoefe],
    ['/konditionen', konditionen],
  ])('%s zeigt den Schritt „Online-Zahlung einrichten" vor der Freischaltung', (_seite, html) => {
    expect(html).toContain(ONLINE_ZAHLUNG_START_SCHRITT.titel)
    expect(html).toContain(entschaerft(ONLINE_ZAHLUNG_START_SCHRITT.text))
    expect(html.indexOf(ONLINE_ZAHLUNG_START_SCHRITT.titel)).toBeLessThan(html.lastIndexOf('Freischaltung'))
  })

  it('Registrieren zeigt denselben Schritt kurz — aus konditionen.ts', () => {
    const titel = REGISTRIEREN_SCHRITTE.map((s) => s.titel)
    expect(titel).toContain(ONLINE_ZAHLUNG_START_SCHRITT.titel)
    expect(titel.indexOf(ONLINE_ZAHLUNG_START_SCHRITT.titel)).toBeLessThan(titel.indexOf('Freischaltung'))
    expect(REGISTRIEREN_SCHRITTE.some((s) => s.text.includes(ONLINE_ZAHLUNG_START_KURZ))).toBe(true)
    expect(lies('src/app/(auth)/register/register-form.tsx')).toContain('REGISTRIEREN_SCHRITTE')
  })

  it.each([
    ['/fuer-hoefe', fuerHoefe],
    ['/konditionen', konditionen],
  ])('%s deutet keine Bar-Option für Höfe an', (_seite, html) => {
    expect(html).not.toMatch(BAR_OPTION_FUER_HOEFE)
  })

  it('die Texte der Seiten deuten keine Bar-Option für Höfe an', () => {
    const texte = [
      ...FUER_HOEFE_SCHRITTE,
      ...REGISTRIEREN_SCHRITTE,
      ...GRUENDUNGS_AUFNAHME_SCHRITTE,
      ...FUER_HOEFE_VORTEILE,
    ].map((s) => `${s.titel} ${s.text}`)
    texte.push(...FUER_HOEFE_FRAGEN.map((f) => `${f.frage} ${f.antwort}`))
    for (const t of texte) expect(t).not.toMatch(BAR_OPTION_FUER_HOEFE)
  })

  it('Barzahlung durch Kundinnen bleibt erwähnt (B1) — das ist keine Wahl des Hofs', () => {
    expect(fuerHoefe).toMatch(/Barzahlungen kassierst du bei der/)
  })

  it('Gegenprobe: die Suche schlägt bei einer Bar-Option an', () => {
    for (const text of ['Du kannst auch nur bar kassieren.', 'Online-Zahlung ist ein Plus, kein Muss', 'Bar bei Abholung geht auch ohne.']) {
      expect(text).toMatch(BAR_OPTION_FUER_HOEFE)
    }
  })
})

// ─── Code: keine Reste der alten Fachregel ──────────────────────────────────

describe('Code ohne „Nur bar" und „ein Plus, kein Muss"', () => {
  const RESTE = /Nur bar|nur-bar|ein Plus, kein Muss|kassiert bewusst nur bar/

  it('kein Modul unter src/ trägt die alte Lesart im Code', () => {
    for (const datei of alleDateien('src')) {
      expect(ohneKommentare(lies(datei)), datei).not.toMatch(RESTE)
    }
  })

  it('Gegenprobe: die Suche schlägt an', () => {
    expect("{ id: 'nur-bar', text: 'Nur bar' }").toMatch(RESTE)
  })
})

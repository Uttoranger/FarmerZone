/**
 * Wache: Eine Seite mit `revalidate` liest nie die Anfrage (Nr. 182, Register
 * N16, Ergänzung 25.10.2026).
 *
 * WARUM: Für eine Route, die nicht dynamisch ist (ISR, `revalidate`), schreibt
 * der Build `allowQuery: []` — Vercel gibt der Funktion dann KEINEN
 * Query-Parameter weiter, auch nicht im Draft Mode. Lokal (`next dev`,
 * `next start`) kommen die Parameter an; der Fehler zeigt sich nur auf Vercel.
 * So zeigte die Vorschau aus Admin › Startseite in Produktion immer die
 * Live-Seite (DEVELOPMENT.md, Nr. 182). Was je Anfrage gelten muss, bekommt
 * eine eigene dynamische Route (ARCHITECTURE §4).
 *
 * Beweist:
 *  - Keine Datei unter src/app mit `export const revalidate` nennt außerhalb
 *    von Kommentaren `searchParams`, `draftMode`, `cookies` oder `headers`
 *    (auch nicht als Import aus next/headers) — mit Gegenprobe.
 *  - Die Startseite und ihre Vorschau rendern denselben Baustein
 *    (src/components/startseite/startseiten-inhalt.tsx); `Eintrag` und
 *    `BlockGeladen` gibt es nur dort — keine zweite Kopie.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const WURZEL = process.cwd()

function dateienUnter(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) return dateienUnter(pfad)
    return /\.(ts|tsx)$/.test(name) ? [pfad] : []
  })
}

/** Ohne Block- und Zeilenkommentare (ein `//` nach einem Doppelpunkt ist eine Adresse, kein Kommentar). */
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const ANFRAGE = /\b(searchParams|draftMode|cookies|headers)\b|from ['"]next\/headers['"]/

/** Was eine ISR-Seite aus der Anfrage liest — leer, wenn sie nichts liest oder keine ISR-Seite ist. */
function liestAnfrage(quelle: string): string[] {
  const code = ohneKommentare(quelle)
  if (!/export const revalidate\b/.test(code)) return []
  return [...new Set([...code.matchAll(new RegExp(ANFRAGE, 'g'))].map((m) => m[0]))]
}

const APP = join(WURZEL, 'src/app')
const rel = (pfad: string) => relative(WURZEL, pfad).split(sep).join('/')

describe('Eine Seite mit revalidate liest nie die Anfrage', () => {
  const isr = dateienUnter(APP).filter((d) => /export const revalidate\b/.test(ohneKommentare(readFileSync(d, 'utf8'))))

  it('es gibt ISR-Seiten — darunter die Startseite, sonst bewiese der Rest nichts', () => {
    expect(isr.map(rel)).toContain('src/app/page.tsx')
    expect(isr.length).toBeGreaterThan(3)
  })

  it('keine ISR-Datei liest searchParams, draftMode, cookies oder headers', () => {
    const funde = isr.flatMap((d) => liestAnfrage(readFileSync(d, 'utf8')).map((was) => `${rel(d)}: ${was}`))
    expect(funde).toEqual([])
  })

  it('Gegenprobe: erkennt jede Form — und lässt Kommentare, Adressen und Seiten ohne revalidate stehen', () => {
    const isrSeite = (rumpf: string) => `export const revalidate = 300\n${rumpf}`
    expect(liestAnfrage(isrSeite('export default async function S({ searchParams }) { return null }'))).toEqual(['searchParams'])
    expect(liestAnfrage(isrSeite("import { draftMode } from 'next/headers'"))).toEqual(['draftMode', "from 'next/headers'"])
    expect(liestAnfrage(isrSeite('const c = await cookies()'))).toEqual(['cookies'])
    expect(liestAnfrage(isrSeite('await vorschau(await headers())'))).toEqual(['headers'])
    expect(liestAnfrage(isrSeite('// liest kein headers(), cookies()\n/* searchParams */ const a = "https://x.example"'))).toEqual([])
    expect(liestAnfrage('export const dynamic = "force-dynamic"\nconst s = searchParams')).toEqual([])
  })
})

describe('Startseite und Vorschau: ein Baustein für den Inhalt', () => {
  const BAUSTEIN = 'src/components/startseite/startseiten-inhalt.tsx'

  it('beide Seiten importieren startseiten-inhalt', () => {
    for (const seite of ['src/app/page.tsx', 'src/app/startseite-vorschau/page.tsx']) {
      expect(readFileSync(join(WURZEL, seite), 'utf8'), seite).toContain("from '@/components/startseite/startseiten-inhalt'")
    }
  })

  it('Eintrag und BlockGeladen gibt es nur im Baustein', () => {
    // `Eintrag` mit der Signatur der Startseite: Der Zeitplan in Admin › Startseite hat einen eigenen, anderen.
    const muster = /function (BlockGeladen|HofKartenGeladen|RegionsKarteGeladen|VorschauBand)\b|function Eintrag\(\{ eintrag, jetzt \}/
    const funde = dateienUnter(join(WURZEL, 'src'))
      .filter((d) => muster.test(readFileSync(d, 'utf8')))
      .map(rel)
    expect(funde).toEqual([BAUSTEIN])
  }, 30_000)
})

/**
 * Schwere Module nur bei Bedarf (Nachtlauf Nr. 31).
 *
 * Befund vom 06.10.2026: Jeder Produktionsaufruf im Hofbereich zeigte das
 * Modul-Log „[E-Mail] Init" — die Seiten zogen den E-Mail-Versand (Resend,
 * React Email, alle Vorlagen) und Stripe über ihre Importe mit, und jeder
 * Kaltstart lud und wertete sie aus, auch wenn keine Mail ging und Stripe
 * nicht gefragt war. `/orders` lud 2.152 Server-Module, davon über 150 nur
 * für Stripe (Messung in docs/nachtlauf/berichte/31.md).
 *
 * Regel (ARCHITECTURE.md §4 „Schwere Module nur dynamisch"): Von keiner Seite
 * und keinem Layout aus führt ein STATISCHER Import zu Resend, React Email,
 * den Vorlagen, dem Stripe-SDK oder den Sammelmodulen `src/lib/email.ts` und
 * `src/lib/stripe.ts`. Wer sie braucht, holt sie mit `await import(...)` in
 * der Versandfunktion bzw. der Action — dann liegen sie in einem eigenen
 * Chunk, den der Server erst beim Aufruf lädt. Auch `email.ts` selbst lädt
 * Resend und die Vorlagen erst in der Versandfunktion.
 *
 * Geprüft wird der statische Import-Graph der Projektdateien (wie in
 * umfeld-karte.test.ts): `import type` und `import(...)` zählen nicht, Pakete
 * sind Blätter. Server Actions, die eine Client-Komponente einbindet, liegen
 * im Graphen — sie landen auch in den Server-Chunks der Seite.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const WURZEL = path.resolve(__dirname, '..')
const ENDUNGEN = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

/** import … from '…', import '…', export … from '…' — ohne `import type` und ohne `import(…)`. */
const STATISCH = /^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm

function aufloesen(von: string, spezifikation: string): string | null {
  let basis: string
  if (spezifikation.startsWith('@/')) basis = path.join(WURZEL, 'src', spezifikation.slice(2))
  else if (spezifikation.startsWith('.')) basis = path.resolve(path.dirname(von), spezifikation)
  else return `paket:${spezifikation}`
  for (const endung of ENDUNGEN) {
    const kandidat = basis + endung
    if (fs.existsSync(kandidat) && fs.statSync(kandidat).isFile()) return kandidat
  }
  return null
}

/** Statisch erreichbare Dateien und Pakete, je mit dem Weg, über den sie erreicht wurden. */
function statischErreichbar(einstieg: string): Map<string, string[]> {
  const wege = new Map<string, string[]>()
  const start = path.join(WURZEL, einstieg)
  const offen: Array<[string, string[]]> = [[start, [einstieg]]]
  while (offen.length > 0) {
    const [datei, weg] = offen.shift() as [string, string[]]
    if (wege.has(datei)) continue
    wege.set(datei, weg)
    if (datei.startsWith('paket:') || !/\.tsx?$/.test(datei)) continue
    const text = fs.readFileSync(datei, 'utf8')
    for (const treffer of text.matchAll(STATISCH)) {
      const ziel = aufloesen(datei, treffer[1])
      if (ziel && !wege.has(ziel)) {
        const name = ziel.startsWith('paket:') ? ziel : path.relative(WURZEL, ziel).split(path.sep).join('/')
        offen.push([ziel, [...weg, name]])
      }
    }
  }
  return wege
}

/** Was eine Seite nie statisch erreichen darf. */
function istSchwer(ziel: string): boolean {
  if (ziel.startsWith('paket:')) {
    const paket = ziel.slice('paket:'.length)
    return /^(resend|stripe|react-email|@react-email\/[^/]+)(\/|$)/.test(paket)
  }
  const relativ = path.relative(WURZEL, ziel).split(path.sep).join('/')
  return relativ === 'src/lib/email.ts' || relativ === 'src/lib/stripe.ts' || relativ.startsWith('src/emails/')
}

/** Alle Seiten, Layouts und Ladeansichten unter src/app — die Einstiege, die ein Seitenaufruf lädt. */
function seitenEinstiege(): string[] {
  const ergebnis: string[] = []
  const lauf = (ordner: string): void => {
    for (const eintrag of fs.readdirSync(path.join(WURZEL, ordner), { withFileTypes: true })) {
      const relativ = `${ordner}/${eintrag.name}`
      if (eintrag.isDirectory()) {
        // API-Routen sind keine Seiten: Webhook und Kasse brauchen Stripe immer.
        if (relativ !== 'src/app/api') lauf(relativ)
      } else if (/^(page|layout|loading|not-found|error|template)\.tsx$/.test(eintrag.name)) {
        ergebnis.push(relativ)
      }
    }
  }
  lauf('src/app')
  return ergebnis.sort()
}

describe('Gegenprobe — erkennt der Test schwere Module überhaupt?', () => {
  it('der Webhook erreicht Stripe statisch (dort ist es gewollt)', () => {
    const wege = statischErreichbar('src/app/api/stripe/webhook/route.ts')
    expect([...wege.keys()].some(istSchwer)).toBe(true)
    expect(wege.has('paket:stripe') || wege.has(path.join(WURZEL, 'src/lib/stripe.ts'))).toBe(true)
  })

  it('email.ts selbst gilt als schwer — auch wenn es heute leicht ist', () => {
    expect(istSchwer(path.join(WURZEL, 'src/lib/email.ts'))).toBe(true)
    expect(istSchwer(path.join(WURZEL, 'src/emails/order-ready.tsx'))).toBe(true)
    expect(istSchwer('paket:@react-email/render')).toBe(true)
    expect(istSchwer('paket:resend')).toBe(true)
    expect(istSchwer('paket:@stripe/stripe-js')).toBe(false)
    expect(istSchwer(path.join(WURZEL, 'src/lib/stripe-konto.ts'))).toBe(false)
  })

  it('findet die Seiten des Hofbereichs, des Admins und der Kundinnen', () => {
    const seiten = seitenEinstiege()
    expect(seiten).toContain('src/app/(hof)/orders/page.tsx')
    expect(seiten).toContain('src/app/(hof)/dashboard/page.tsx')
    expect(seiten).toContain('src/app/admin/page.tsx')
    expect(seiten).toContain('src/app/(public)/[farmSlug]/bestaetigen/[token]/page.tsx')
    expect(seiten.some((s) => s.startsWith('src/app/api/'))).toBe(false)
  })
})

describe('Keine Seite zieht E-Mail oder Stripe statisch mit', () => {
  for (const einstieg of seitenEinstiege()) {
    it(einstieg, () => {
      const schwer = [...statischErreichbar(einstieg).entries()].filter(([ziel]) => istSchwer(ziel))
      // Der Weg nennt die Kette, über die das Modul hereinkam — dort gehört der dynamische Import hin.
      expect(schwer.map(([, weg]) => weg.join(' → '))).toEqual([])
    })
  }
})

describe('E-Mail und Stripe kommen erst im Aufruf', () => {
  const lies = (datei: string): string => fs.readFileSync(path.join(WURZEL, datei), 'utf8')

  it('email.ts lädt Resend und die Vorlagen erst in der Versandfunktion', () => {
    const text = lies('src/lib/email.ts')
    const statisch = [...text.matchAll(STATISCH)].map((t) => t[1])
    expect(statisch.filter((s) => /^(resend|@react-email\/|@\/emails\/)/.test(s))).toEqual([])
    expect(text).toMatch(/await import\('resend'\)/)
    expect(text).toMatch(/await import\('@react-email\/render'\)/)
  })

  it('kein Modul-Log beim Laden: „[E-Mail] Init" ist weg', () => {
    expect(lies('src/lib/email.ts')).not.toContain('[E-Mail] Init')
  })
})

/**
 * Kein dynamischer Import innerhalb einer Transaktion (Nachbesserung Nr. 31):
 * Das erste Laden eines Moduls dauert — in einer Transaktion mit Zeilensperre
 * (FOR UPDATE) hielte es die Sperre so lange fest. Wer in der Transaktion
 * Stripe braucht, lädt es vorher (`stripeVorladen`, teilerstattung.ts).
 */
describe('Kein await import() innerhalb einer Transaktion', () => {
  /** Der Text jeder `$transaction(…)`-Klammer einer Datei (Klammern gezählt). */
  function transaktionen(text: string): string[] {
    const bloecke: string[] = []
    let ab = text.indexOf('$transaction(')
    while (ab !== -1) {
      let tiefe = 0
      let i = ab + '$transaction'.length
      for (; i < text.length; i++) {
        if (text[i] === '(') tiefe++
        else if (text[i] === ')' && --tiefe === 0) break
      }
      bloecke.push(text.slice(ab, i + 1))
      ab = text.indexOf('$transaction(', i)
    }
    return bloecke
  }

  function quelldateien(ordner: string): string[] {
    return fs.readdirSync(path.join(WURZEL, ordner), { withFileTypes: true }).flatMap((e) => {
      const relativ = `${ordner}/${e.name}`
      if (e.isDirectory()) return quelldateien(relativ)
      return /\.tsx?$/.test(e.name) ? [relativ] : []
    })
  }

  it('Gegenprobe: erkennt einen Import in der Klammer, nicht davor', () => {
    expect(transaktionen("x; prisma.$transaction(async (tx) => { const { a } = await import('b'); f(a) })")[0]).toMatch(/import\(/)
    expect(transaktionen("await import('b'); prisma.$transaction(async (tx) => { f() })")[0]).not.toMatch(/import\(/)
  })

  it('findet die Transaktion von „Artikel fehlt"', () => {
    const text = fs.readFileSync(path.join(WURZEL, 'src/server/artikel-fehlt.ts'), 'utf8')
    expect(transaktionen(text).some((b) => b.includes('FOR UPDATE'))).toBe(true)
  })

  it('keine Datei unter src importiert innerhalb einer $transaction', () => {
    const treffer = quelldateien('src').flatMap((datei) =>
      transaktionen(fs.readFileSync(path.join(WURZEL, datei), 'utf8'))
        .filter((b) => /\bimport\(/.test(b))
        .map(() => datei)
    )
    expect(treffer).toEqual([])
  })

  it('„Artikel fehlt" lädt Stripe vor der Sperre; teilerstattung importiert nur in stripeVorladen', () => {
    const artikel = fs.readFileSync(path.join(WURZEL, 'src/server/artikel-fehlt.ts'), 'utf8')
    const vorladen = artikel.indexOf('await stripeVorladen()')
    expect(vorladen).toBeGreaterThan(-1)
    expect(vorladen).toBeLessThan(artikel.indexOf('prisma.$transaction('))
    const teil = fs.readFileSync(path.join(WURZEL, 'src/server/teilerstattung.ts'), 'utf8')
    expect(teil.match(/import\('@\/lib\/stripe'\)/g)).toHaveLength(1)
    const funktion = teil.slice(teil.indexOf('export async function stripeVorladen'), teil.indexOf('async function stripeSdk'))
    expect(funktion).toContain("import('@/lib/stripe')")
  })
})

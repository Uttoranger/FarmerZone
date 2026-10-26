/**
 * Hof-E-Mail-Wache (Nr. 194, Entscheidung 2 aus Morgenbericht 25).
 *
 * Ursache: Die Hof-E-Mail ist freiwillig. Vier Leser (Bestellmails an den Hof,
 * „Nochmal schicken", Stripe-Konto) nahmen das Feld ohne Rückfall — bei leerem
 * Feld ging die Bestellmail an eine leere Adresse (Bericht 174). Wer den Hof
 * anschreibt, nimmt jetzt hofKontaktEmail (src/lib/hof-kontakt.ts).
 *
 * Beweist (Quelltext von `src/`, TypeScript-Syntaxbaum, kein Netz, keine
 * Datenbank): Jeder Zugriff `farm.email`, `hof.email` oder `….farm.email`
 * steht in src/lib/hof-kontakt.ts oder in BESTAND — mit Grund und genau der
 * Zahl der Stellen. Die Liste schrumpft nur: Eine neue Stelle schlägt an,
 * eine weggefallene auch (dann Eintrag streichen). Kommentare zählen nicht.
 *
 * Gegenprobe: Text-Attrappen — `order.farm.email`, `hof?.email`, `farm.email`
 * schlagen an; `farm.emailBestaetigt`, `user.email` und ein Kommentar nicht.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const FUNKTION = 'src/lib/hof-kontakt.ts'

/** Stellen, die die Hof-E-Mail bewusst ohne Rückfall lesen: Datei → Zahl und Grund. */
const BESTAND: Record<string, { stellen: number; grund: string }> = {
  'src/app/(public)/[farmSlug]/bestellung/[orderId]/page.tsx': { stellen: 1, grund: 'Anzeige für die Kundin (HofErreichen): ohne Hof-E-Mail keine Zeile, nie die Anmelde-Adresse' },
  'src/app/(public)/[farmSlug]/confirm/[orderId]/page.tsx': { stellen: 1, grund: 'Anzeige für die Kundin (HofErreichen): ohne Hof-E-Mail keine Zeile, nie die Anmelde-Adresse' },
  'src/components/checkout/angaben-zum-hof.tsx': { stellen: 1, grund: 'Anzeige für die Kundin (Angaben zum Hof): ohne Hof-E-Mail keine Zeile, nie die Anmelde-Adresse' },
  'src/lib/hofseite-fortschritt.ts': { stellen: 1, grund: 'Fortschritt der Hofseite: zählt, ob Kundinnen eine Hof-E-Mail sehen' },
  'src/components/settings/profile-form.tsx': { stellen: 1, grund: 'Startwert des Profil-Formulars: der Hof bearbeitet das Feld selbst' },
  'src/app/api/checkout/route.ts': { stellen: 1, grund: 'Bar-Bestätigungslink an die Kundin: das Feld reist nur mit, die Mail an die Kundin liest es nicht' },
}

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Ob `ausdruck` ein Hof ist: `farm`, `hof` oder `….farm`. */
function istHof(ausdruck: ts.Expression): boolean {
  if (ts.isIdentifier(ausdruck)) return ausdruck.text === 'farm' || ausdruck.text === 'hof'
  if (ts.isPropertyAccessExpression(ausdruck)) return ausdruck.name.text === 'farm'
  return false
}

/** Die Zeilen mit einem direkten Zugriff auf die Hof-E-Mail. */
function zugriffe(quelltext: string, pfad = 'schnipsel.tsx'): number[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const zeilen: number[] = []
  function besuche(knoten: ts.Node): void {
    if (ts.isPropertyAccessExpression(knoten) && knoten.name.text === 'email' && istHof(knoten.expression)) {
      zeilen.push(datei.getLineAndCharacterOfPosition(knoten.getStart()).line + 1)
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return zeilen
}

function befundeImRepo(): Map<string, number[]> {
  const befunde = new Map<string, number[]>()
  for (const pfad of quelldateien(join(WURZEL, 'src'))) {
    const rel = relative(WURZEL, pfad).split(sep).join('/')
    if (rel === FUNKTION) continue
    const z = zugriffe(readFileSync(pfad, 'utf8'), rel)
    if (z.length > 0) befunde.set(rel, z)
  }
  return befunde
}

describe('Hof-E-Mail nur über hofKontaktEmail', () => {
  it('kein neuer direkter Zugriff auf die Hof-E-Mail außerhalb von src/lib/hof-kontakt.ts', () => {
    const befunde = befundeImRepo()
    const neu = [...befunde].filter(([datei, z]) => z.length > (BESTAND[datei]?.stellen ?? 0)).map(([datei, z]) => `${datei}:${z.join(',')}`)
    expect(neu, 'Wer den Hof anschreibt: hofKontaktEmail(farm) aus src/lib/hof-kontakt.ts; nur eine Anzeige für Kundinnen darf das Feld allein lesen (dann mit Grund in BESTAND)').toEqual([])
  }, 30_000)

  it('BESTAND schrumpft nur: jeder Eintrag stimmt genau, jeder Grund steht in ganzen Worten', () => {
    const befunde = befundeImRepo()
    const veraltet = Object.entries(BESTAND).filter(([datei, e]) => (befunde.get(datei)?.length ?? 0) < e.stellen).map(([datei]) => datei)
    expect(veraltet, 'Stelle weggefallen: Zahl in BESTAND senken oder Eintrag streichen').toEqual([])
    for (const [datei, e] of Object.entries(BESTAND)) expect(e.grund.length, datei).toBeGreaterThan(20)
  }, 30_000)

  it('die Funktion selbst liest das Feld (sonst prüft die Wache ins Leere)', () => {
    expect(zugriffe(readFileSync(join(WURZEL, FUNKTION), 'utf8')).length).toBeGreaterThan(0)
  })
})

describe('Gegenprobe an Text-Attrappen', () => {
  it('schlägt an: order.farm.email, hof?.email, farm.email', () => {
    expect(zugriffe('const a = order.farm.email')).toEqual([1])
    expect(zugriffe('const a = hof?.email')).toEqual([1])
    expect(zugriffe('send(farm.email)')).toEqual([1])
  })

  it('schlägt nicht an: farm.emailBestaetigt, user.email, owner.email, Kommentar', () => {
    expect(zugriffe('const a = farm.emailBestaetigt')).toEqual([])
    expect(zugriffe('const a = user.email; const b = farm.owner.email')).toEqual([])
    expect(zugriffe('// farm.email\n/* hof.email */ const a = 1')).toEqual([])
  })
})

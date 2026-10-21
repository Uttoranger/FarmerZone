/**
 * Wache: keine `loading.tsx` neben einer Seite, deren Filter in der Adresse stehen
 * (Regelvorschlag 105, Lauf 16; freigegeben für Nr. 118, Lauf 17).
 *
 * Ursache: Eine `loading.tsx` ersetzt bei jeder Navigation der Seite den Inhalt durch ihr Skelett — auch wenn
 * nur ein Filter in der Adresse wechselt. Der Eingang im Admin-Postfach (Nr. 105) blitzte bei jedem Klick auf
 * einen Filter als Skelett auf; er zeigt seither einen Ladepunkt und setzt `aria-busy`, die alte Liste bleibt
 * stehen (`LadeRahmen`, src/app/admin/postfach/page.tsx).
 *
 * Beweist (Quelltext, TypeScript-Syntaxbaum — kein Regex auf Kommentare):
 *  - Jeder Ordner unter src/app, der eine `loading.tsx` UND eine Seite hat, die die Adresse liest
 *    (`searchParams` in der `page.tsx`, `useSearchParams()` in einer Datei daneben), steht in AUSNAHMEN — mit
 *    Art und Grund. Eine neue Seite dieser Art fällt hier mit ihrem Namen auf. Nr. 121 hat fünf Seiten vom Bestand
 *    genommen (Hof › Postfach, Bestellungen, Auswertung, Admin › Einstellungen und Finanzen), Nr. 122 Region
 *    (Ladepunkt statt Skelett, Register N23), Nr. 127 die letzten beiden (Mein Hof und die Bestellung): Der Bestand
 *    ist leer.
 *  - Jede Ausnahme gibt es noch: Ist die `loading.tsx` weg oder liest die Seite die Adresse nicht mehr, fällt
 *    die Zeile als veraltet auf und muss raus.
 *  - /hoefe liest seit N19 (Entdecken statisch) keine Adresse mehr und behält seine `loading.tsx` ohne Ausnahme.
 *  - Gegenprobe: Ein Baum im Temp-Ordner mit einer Seite mit Filter + `loading.tsx` wird gefunden, einer ohne
 *    Adresse in der Seite oder ohne `loading.tsx` nicht.
 *
 * Zwei Arten von Ausnahmen:
 *  - 'kein-filter': Die Adresse trägt einen Wert, der sich beim Klicken auf der Seite nicht ändert (Token aus
 *    einer Mail, Kennung aus einem Link, Rückkehr von Stripe, Startwert) — kein Skelett pro Klick.
 *  - 'bestand': Die Seite filtert wirklich in der Adresse und zeigt bei jedem Klick das Skelett. Das war ein
 *    Bestand aus der Zeit vor Nr. 105; er ist seit Nr. 127 leer und darf nicht wieder wachsen — ein neuer Fall
 *    wird nach dem Muster des Postfachs gebaut (Ladepunkt, `aria-busy`, alte Liste bleibt).
 */
import { describe, it, expect, afterAll } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'

const WURZEL = process.cwd()
const APP = join(WURZEL, 'src/app')

type Art = 'kein-filter' | 'bestand'

const AUSNAHMEN: Record<string, { art: Art; grund: string }> = {
  'src/app/(auth)/verify': { art: 'kein-filter', grund: 'Die Adresse trägt den Token aus der Bestätigungs-Mail, keinen Filter.' },
  'src/app/(hof)/analytics/umfeld': { art: 'kein-filter', grund: 'Die Seite leitet nur um (umfeldUmleitung); sie zeigt nichts, was filtert.' },
  'src/app/(hof)/fehler-melden': { art: 'kein-filter', grund: 'Die Adresse trägt die Kennung der Meldung aus einem Link.' },
  'src/app/(hof)/settings/payments': { art: 'kein-filter', grund: 'Der Wert ist der Zustand der Rückkehr von Stripe (?stripe=…), kein Filter.' },
  'src/app/(hof)/status/new': { art: 'kein-filter', grund: 'Der Wert „from“ merkt sich, woher der Hof kam; der Klick auf der Seite ändert ihn nicht.' },
  'src/app/(public)/[farmSlug]/bestellung/[orderId]': { art: 'kein-filter', grund: 'Die Adresse trägt die Signatur des Bestell-Links (s).' },
  'src/app/(public)/[farmSlug]/checkout': { art: 'kein-filter', grund: 'Der Wert ?kaeufer= ist nur der Startwert des Hakens „Betrieb“.' },
  'src/app/(public)/[farmSlug]/confirm/[orderId]': { art: 'kein-filter', grund: 'Signatur und Zustand der Rückkehr von Stripe, keine Auswahl.' },
  'src/app/(public)/problem-melden': { art: 'kein-filter', grund: 'Die Adresse trägt die Kennung des Fehlers aus einem Link.' },
  'src/app/account/neuigkeiten-bestaetigen': { art: 'kein-filter', grund: 'Die Adresse trägt den Token aus der Bestätigungs-Mail.' },
  'src/app/sicherheit/nicht-ich': { art: 'kein-filter', grund: 'Die Adresse trägt den Token aus der Mail „Neue Anmeldung“.' },
}

/** Liest dieser Quelltext die Adresse der Seite — `searchParams` (Seiten-Eigenschaft) oder `useSearchParams()`? */
function liestAdresse(quelltext: string, pfad = 'schnipsel.tsx'): boolean {
  const art = pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, art)
  let gefunden = false
  const besuche = (knoten: ts.Node): void => {
    if (ts.isIdentifier(knoten) && knoten.text === 'searchParams') gefunden = true
    if (ts.isCallExpression(knoten) && ts.isIdentifier(knoten.expression) && knoten.expression.text === 'useSearchParams') gefunden = true
    if (!gefunden) ts.forEachChild(knoten, besuche)
  }
  besuche(datei)
  return gefunden
}

/** Alle Ordner (relativ zur Wurzel, mit „/“) mit `loading.tsx` und einer Seite, die die Adresse liest. */
function ordnerMitLadebildUndAdresse(app: string, wurzel: string): string[] {
  const funde: string[] = []
  const besuche = (ordner: string): void => {
    const namen = readdirSync(ordner)
    if (namen.includes('loading.tsx')) {
      const lesendeDateien = namen.filter((n) => /\.(ts|tsx)$/.test(n) && n !== 'loading.tsx' && statSync(join(ordner, n)).isFile())
      // Seiten UND Komponenten direkt daneben: ein `useSearchParams()` im Client-Teil der Seite zählt genauso.
      if (lesendeDateien.some((n) => liestAdresse(readFileSync(join(ordner, n), 'utf8'), n))) {
        funde.push(relative(wurzel, ordner).split(sep).join('/'))
      }
    }
    for (const name of namen) {
      const pfad = join(ordner, name)
      if (statSync(pfad).isDirectory()) besuche(pfad)
    }
  }
  besuche(app)
  return funde.sort()
}

describe('loading.tsx neben einer Seite mit Filtern in der Adresse (Regelvorschlag 105)', () => {
  const temp = mkdtempSync(join(tmpdir(), 'loading-wache-'))
  afterAll(() => rmSync(temp, { recursive: true, force: true }))

  it('Gegenprobe: findet einen Baum mit Ladebild und Adresse — und keinen ohne eines von beiden', () => {
    const lege = (pfad: string, inhalt: string): void => {
      mkdirSync(join(temp, pfad, '..'), { recursive: true })
      writeFileSync(join(temp, pfad), inhalt)
    }
    lege('app/mit-filter/loading.tsx', 'export default function L() { return null }')
    lege('app/mit-filter/page.tsx', 'export default async function P({ searchParams }: { searchParams: Promise<{ filter?: string }> }) { await searchParams; return null }')
    lege('app/client-filter/loading.tsx', 'export default function L() { return null }')
    lege('app/client-filter/ansicht.tsx', "'use client'\nexport function A() { const p = useSearchParams(); return p }")
    lege('app/ohne-adresse/loading.tsx', 'export default function L() { return null }')
    lege('app/ohne-adresse/page.tsx', 'export default function P() { return null } // searchParams steht nur im Kommentar')
    lege('app/ohne-ladebild/page.tsx', 'export default async function P({ searchParams }) { await searchParams; return null }')
    expect(ordnerMitLadebildUndAdresse(join(temp, 'app'), temp)).toEqual(['app/client-filter', 'app/mit-filter'])
  })

  it('Gegenprobe: fehlt eine Ausnahme, meldet die Prüfung den Ordner mit seinem Namen', () => {
    // Irgendeine Ausnahme genügt als Beispiel – so bleibt die Gegenprobe gültig, wenn der Bestand ganz leer ist.
    const beispiel = Object.keys(AUSNAHMEN)[0]
    const ohne = Object.keys(AUSNAHMEN).filter((ordner) => ordner !== beispiel)
    expect(ordnerMitLadebildUndAdresse(APP, WURZEL).filter((ordner) => !ohne.includes(ordner))).toEqual([beispiel])
  })

  it('jede Seite mit Ladebild und Adresse steht in AUSNAHMEN — eine neue fällt mit ihrem Namen auf', () => {
    const gefunden = ordnerMitLadebildUndAdresse(APP, WURZEL)
    const neu = gefunden.filter((ordner) => !(ordner in AUSNAHMEN))
    expect(
      neu,
      `Neue Seite mit Filter in der Adresse und loading.tsx: ${neu.join(', ')}. Entweder die loading.tsx entfernen ` +
        '(Ladepunkt und aria-busy statt Skelett, Muster Postfach Nr. 105) oder mit Art und Grund in AUSNAHMEN eintragen.'
    ).toEqual([])
  })

  it('jede Ausnahme gibt es noch — sonst ist sie veraltet und muss raus', () => {
    const gefunden = new Set(ordnerMitLadebildUndAdresse(APP, WURZEL))
    const veraltet = Object.keys(AUSNAHMEN).filter((ordner) => !gefunden.has(ordner))
    expect(veraltet, `Veraltete Ausnahme (loading.tsx oder Adresse in der Seite fehlt): ${veraltet.join(', ')} — aus AUSNAHMEN nehmen.`).toEqual([])
  })

  it('der Bestand ist leer und bleibt es: Jede Ausnahme ist ein Wert in der Adresse, der beim Klicken nicht wechselt (Nr. 127)', () => {
    expect(Object.entries(AUSNAHMEN).filter(([, a]) => a.art === 'bestand').map(([ordner]) => ordner)).toEqual([])
  })

  it('jede Ausnahme hat einen Grund, und die Ordner gibt es', () => {
    for (const [ordner, { grund }] of Object.entries(AUSNAHMEN)) {
      expect(grund.length, ordner).toBeGreaterThan(20)
      expect(existsSync(join(WURZEL, ordner, 'loading.tsx')), ordner).toBe(true)
    }
  })

  it('/hoefe liest seit N19 keine Adresse mehr und braucht keine Ausnahme', () => {
    const ordner = 'src/app/(public)/hoefe'
    expect(existsSync(join(WURZEL, ordner, 'loading.tsx'))).toBe(true)
    expect(ordner in AUSNAHMEN).toBe(false)
    expect(liestAdresse(readFileSync(join(WURZEL, ordner, 'page.tsx'), 'utf8'), 'page.tsx')).toBe(false)
    // Gegenprobe: dieselbe Seite mit einem Filter in der Adresse würde auffallen.
    expect(liestAdresse('export default async function P({ searchParams }) { await searchParams; return null }', 'page.tsx')).toBe(true)
  })
})

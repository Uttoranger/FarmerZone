/**
 * Actions-Wache (ARCHITECTURE §3 „Pflichten jeder Server Action", Punkt 2: Auth prüfen).
 *
 * Ursache: Jeder Export einer `'use server'`-Datei ist ein öffentlicher Endpunkt mit eigener Aktions-ID,
 * auch wenn ihn heute nur eine Seite aufruft. Eine Action ohne Sitzungsprüfung ändert für jeden etwas,
 * der ihre ID kennt. Bisher prüfte das nur `tests/zustellung-bestaetigen.test.ts` für EINE Datei
 * (`postfach.ts`); alle anderen verließen sich auf die Sorgfalt beim Schreiben.
 *
 * Beweist (Quelltext von `src/server/actions/`, TypeScript-Syntaxbaum, kein Netz): Jede Datei beginnt mit
 * `'use server'`, und jede exportierte Funktion erreicht eine Sitzungsprüfung — den Aufruf von
 * `auth.api.getSession` oder `verlangeAdminAktion` im eigenen Körper oder über eine Funktion derselben
 * Datei (`eigenerHof`, `hofDerSitzung` …, beliebig tief). Wer keine hat, steht in OEFFENTLICH — je
 * Datei und Name mit Grund (Token, Code, Bremse). Eine Ausnahme, die doch prüft oder die es nicht mehr
 * gibt, fällt als veraltet auf. Die Liste schrumpft; neu hinein darf nur ein Weg, den eine Freigabe
 * ausdrücklich ohne Sitzung verlangt und den statt ihrer ein Token aus einer Mail schützt (Einmal-Link
 * oder signiertes Token, mit Frist; etwa `meldeAllesAbNichtIch`, Nr. 114) — mit Grund. Kommentare zählen nicht.
 *
 * Gegenprobe: Text-Attrappen — eine Action ohne Prüfung, mit Prüfung nur im Kommentar und eine Funktion,
 * die eine andere ohne Prüfung ruft, schlagen an; die direkte Prüfung, die über einen Helfer (auch zweistufig)
 * und die Admin-Prüfung nicht, ebenso wenig eine Funktion, die nicht exportiert ist.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ORDNER = join(process.cwd(), 'src/server/actions')

type Ausnahme = { datei: string; name: string; grund: string }

/** Öffentliche Wege: ohne Konto aufrufbar, der Schutz ist ein Token, ein Code oder die Bremse. */
const OEFFENTLICH: Ausnahme[] = [
  { datei: 'bar-bestaetigung.ts', name: 'bestaetigeBarBestellung', grund: 'Der Link in der Mail an die Kundin trägt ein signiertes Token, das die Bestellung bestimmt; eine Sitzung gibt es nicht' },
  { datei: 'bar-bestaetigung.ts', name: 'storniereBarBestellung', grund: 'Der Link in der Mail an die Kundin trägt ein signiertes Token, das die Bestellung bestimmt; eine Sitzung gibt es nicht' },
  { datei: 'bestellungen-finden.ts', name: 'fordereBestellCodeAn', grund: 'Wer seine Bestellungen finden will, hat kein Konto; der Besitz der Adresse wird mit einem Code bewiesen, dazu Bremse' },
  { datei: 'bestellungen-finden.ts', name: 'zeigeBestellungen', grund: 'Wer seine Bestellungen finden will, hat kein Konto; der Besitz der Adresse wird mit einem Code bewiesen, dazu Bremse' },
  { datei: 'bestellungen-finden.ts', name: 'beendeBestellAnsicht', grund: 'Löscht nur das eigene Cookie der Bestellansicht; es gibt keine Sitzung und nichts zu schützen' },
  { datei: 'email-bestaetigung.ts', name: 'bestaetigeEmail', grund: 'Der Link in der Mail an den Hof trägt einen einmaligen Code mit Frist; beim Klicken ist oft noch niemand angemeldet' },
  { datei: 'geraete.ts', name: 'meldeAllesAbNichtIch', grund: 'Der Link aus der Mail „Neue Anmeldung" trägt einen Einmal-Token (gehasht, 7 Tage, einmal); wer ihn öffnet, ist oft nirgends mehr angemeldet' },
  { datei: 'hoefe.ts', name: 'loeseOrtAuf', grund: 'Die Ortssuche auf der öffentlichen Hofliste ist ohne Konto gedacht; Eingabe mit Zod geprüft, dazu Bremse je Adresse' },
  { datei: 'neuigkeiten.ts', name: 'meldeNeuigkeitenAn', grund: 'Die Anmeldung zu Neuigkeiten eines Hofs ist ohne Konto gedacht; Double-Opt-in per Mail, Eingabe mit Zod geprüft, dazu Bremse' },
  { datei: 'onboarding.ts', name: 'checkSlugAvailability', grund: 'Die Vorschau der Hofadresse läuft beim Registrieren vor dem Konto; Eingabe mit Zod geprüft, dazu Bremse, bei Fehlern neutral' },
  { datei: 'register.ts', name: 'registerFarmer', grund: 'Die Registrierung eines Hofs legt erst das Konto an und hat deshalb keine Sitzung; Eingabe mit Zod geprüft, dazu Bremse' },
  { datei: 'startseite.ts', name: 'beendeStartseitenVorschau', grund: 'Schaltet nur den Vorschau-Modus im eigenen Browser aus; ohne Sitzung gibt es nichts zu beenden und nichts zu schützen' },
  { datei: 'subscriptions.ts', name: 'bestaetigeNeuigkeiten', grund: 'Der Link in der Bestätigungsmail trägt ein signiertes Token; die Abonnentin ist nicht angemeldet' },
  { datei: 'subscriptions.ts', name: 'unsubscribeWithToken', grund: 'Der Abmeldelink in der Mail trägt ein signiertes Token; die Abonnentin ist nicht angemeldet' },
]

/**
 * Aufrufe, die die Sitzung prüfen: Better Auth direkt oder die Admin-Prüfung der Aktionen —
 * seit Nr. 115 auch die der heiklen Aktionen (verlangeFrischeBestaetigung prüft erst alles von
 * verlangeAdminAktion, dann die frische Bestätigung mit Passkey; Register N20).
 */
function istSitzungspruefung(aufruf: ts.CallExpression): boolean {
  const ziel = aufruf.expression
  if (ts.isIdentifier(ziel)) return ziel.text === 'verlangeAdminAktion' || ziel.text === 'verlangeFrischeBestaetigung'
  return ts.isPropertyAccessExpression(ziel) && ziel.name.text === 'getSession'
}

type Funktion = { exportiert: boolean; knoten: ts.Node }

/** Alle Funktionen der obersten Ebene (Deklaration oder `const f = (…) =>`), mit Namen. */
function funktionen(datei: ts.SourceFile): Map<string, Funktion> {
  const karte = new Map<string, Funktion>()
  const exportiert = (n: ts.Node): boolean => ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  for (const st of datei.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) karte.set(st.name.text, { exportiert: exportiert(st), knoten: st })
    else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
          karte.set(d.name.text, { exportiert: exportiert(st), knoten: d.initializer })
        }
      }
    }
  }
  // export { a, b } nach der Deklaration
  for (const st of datei.statements) {
    if (ts.isExportDeclaration(st) && !st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause)) {
      for (const el of st.exportClause.elements) {
        const f = karte.get((el.propertyName ?? el.name).text)
        if (f) f.exportiert = true
      }
    }
  }
  return karte
}

/** Die Namen der Funktionen, die im Körper aufgerufen werden, und ob darunter eine Sitzungsprüfung ist. */
function aufrufe(knoten: ts.Node): { namen: Set<string>; prueft: boolean } {
  const namen = new Set<string>()
  let prueft = false
  const besuche = (k: ts.Node): void => {
    if (ts.isCallExpression(k)) {
      if (istSitzungspruefung(k)) prueft = true
      if (ts.isIdentifier(k.expression)) namen.add(k.expression.text)
    }
    ts.forEachChild(k, besuche)
  }
  besuche(knoten)
  return { namen, prueft }
}

/** Die exportierten Funktionen einer Datei ohne erreichbare Sitzungsprüfung. */
function ohnePruefung(quelltext: string, pfad = 'schnipsel.ts'): string[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const alle = funktionen(datei)
  const erreicht = (name: string, besucht = new Set<string>()): boolean => {
    if (besucht.has(name)) return false
    besucht.add(name)
    const f = alle.get(name)
    if (!f) return false
    const { namen, prueft } = aufrufe(f.knoten)
    return prueft || [...namen].some((n) => erreicht(n, besucht))
  }
  return [...alle].filter(([name, f]) => f.exportiert && !erreicht(name)).map(([name]) => name)
}

const dateien = readdirSync(ORDNER).filter((n) => n.endsWith('.ts'))
const quellen = new Map(dateien.map((n) => [n, readFileSync(join(ORDNER, n), 'utf8')]))
const ungeprueft = dateien.flatMap((n) => ohnePruefung(quellen.get(n)!, n).map((name) => ({ datei: n, name })))

describe('Actions-Wache — jede Server Action prüft die Sitzung', () => {
  it('sieht die Action-Dateien, und jede beginnt mit use server', () => {
    expect(dateien).toEqual(expect.arrayContaining(['admin.ts', 'orders.ts', 'products.ts', 'postfach.ts', 'farm.ts']))
    for (const [n, text] of quellen) expect(text, n).toMatch(/^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use server['"]/)
  })

  it('jede exportierte Funktion erreicht eine Sitzungsprüfung — außer den öffentlichen Wegen mit Grund', () => {
    const verstoesse = ungeprueft.filter((u) => !OEFFENTLICH.some((a) => a.datei === u.datei && a.name === u.name)).map((u) => `${u.datei}: ${u.name}`)
    expect(verstoesse, 'Sitzung prüfen (auth.api.getSession, verlangeAdminAktion oder ein Helfer der Datei) — oder als öffentlichen Weg mit Grund in OEFFENTLICH eintragen').toEqual([])
  })

  it('hat keine veraltete Ausnahme: Jeder Eintrag in OEFFENTLICH prüft wirklich nichts', () => {
    const veraltet = OEFFENTLICH.filter((a) => !ungeprueft.some((u) => u.datei === a.datei && u.name === a.name)).map((a) => `${a.datei}: ${a.name}`)
    expect(veraltet).toEqual([])
  })

  it('nennt zu jeder Ausnahme einen Grund in ganzen Worten', () => {
    for (const a of OEFFENTLICH) expect(a.grund.split(' ').length, `${a.datei} ${a.name}`).toBeGreaterThanOrEqual(8)
  })
})

describe('Actions-Wache — Gegenprobe: die Suche schlägt an', () => {
  it('findet eine Action ohne Prüfung — als Deklaration und als Pfeilfunktion', () => {
    expect(ohnePruefung("'use server'\nexport async function loesche(id: string) { await db.x.delete({ where: { id } }) }")).toEqual(['loesche'])
    expect(ohnePruefung("'use server'\nexport const aendere = async (id: string) => { await db.x.update({ where: { id } }) }")).toEqual(['aendere'])
  })

  it('findet sie, wenn die Prüfung nur im Kommentar oder in einer Zeichenkette steht', () => {
    expect(ohnePruefung("'use server'\nexport async function a() {\n  // await auth.api.getSession()\n  return 1 }")).toEqual(['a'])
    expect(ohnePruefung("'use server'\nexport async function b() { return 'auth.api.getSession()' }")).toEqual(['b'])
  })

  it('findet eine Action, die nur eine andere ohne Prüfung ruft, und eine Prüfung in einem fremden Modul-Aufruf mit anderem Namen', () => {
    expect(ohnePruefung("'use server'\nasync function intern() { return 1 }\nexport async function a() { return intern() }")).toEqual(['a'])
    expect(ohnePruefung("'use server'\nexport async function b() { await verlangeAdminSeite() }")).toEqual(['b'])
  })

  it('lässt die direkte Prüfung, die über einen Helfer der Datei (auch zweistufig) und die Admin-Prüfung durch', () => {
    expect(ohnePruefung("'use server'\nexport async function a() { const s = await auth.api.getSession({ headers: await headers() })\n return s }")).toEqual([])
    expect(ohnePruefung("'use server'\nasync function hof() { return await auth.api.getSession() }\nexport async function b() { return hof() }")).toEqual([])
    expect(ohnePruefung("'use server'\nasync function eins() { return await auth.api.getSession() }\nasync function zwei() { return eins() }\nexport async function c() { return zwei() }")).toEqual([])
    expect(ohnePruefung("'use server'\nexport const d = async () => { const a = await verlangeAdminAktion()\n return a }")).toEqual([])
    expect(ohnePruefung("'use server'\nexport async function e() { const f = await verlangeFrischeBestaetigung()\n return f }")).toEqual([])
    expect(ohnePruefung("'use server'\nexport async function g() { return verlangeFrischeBestaetigungNicht() }")).toEqual(['g'])
  })

  it('lässt Funktionen stehen, die nicht exportiert sind, und kommt mit Kreisen zurecht', () => {
    expect(ohnePruefung("'use server'\nasync function intern() { return 1 }\nexport async function a() { await auth.api.getSession() }")).toEqual([])
    expect(ohnePruefung("'use server'\nasync function x() { return y() }\nasync function y() { return x() }\nexport async function z() { return x() }")).toEqual(['z'])
  })

  it('zählt ein export { … } nach der Deklaration mit', () => {
    expect(ohnePruefung("'use server'\nasync function a() { return 1 }\nexport { a }")).toEqual(['a'])
  })
})

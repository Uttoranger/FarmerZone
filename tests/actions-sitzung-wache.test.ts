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
 *
 * Seit Nr. 125 auch: Das ERGEBNIS wird ausgewertet. Aufrufen allein genügt nicht — wer das Ergebnis von
 * `getSession` bzw. der Admin-Wache verwirft oder erst nach einem Schreiben prüft, ändert trotzdem für jeden.
 * Ausgewertet heißt: `const x = await prüfung()` und gleich die NÄCHSTE Anweisung ist `if (… x …) return|throw`
 * (darin `!x`, `x?.user`, `'error' in x`, `&&`/`||` …), oder der Aufruf steht selbst in einer solchen
 * Bedingung, oder er wird unverändert zurückgegeben. Dasselbe gilt für einen Helfer der Datei, der bei
 * fehlender Sitzung einen Wert zurückgibt statt zu werfen (`hofDerSitzung` → null): Sein Ergebnis wertet der
 * Aufrufer genauso aus. Wer bewusst auch ohne Sitzung weiterläuft, steht mit Grund in SITZUNG_FREIWILLIG.
 * Gegenprobe: verworfenes, ungeprüftes und zu spät geprüftes Ergebnis schlagen an.
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
  { datei: 'bar-bestaetigung.ts', name: 'sendeBarLinkErneut', grund: 'Freigabe §27 (Nr. 151, S17 Punkt 2): die Signatur der Bestätigungsseite statt einer Sitzung; Mail nur an die Adresse der Bestellung, nur offen, Bremse je Bestellung, immer dieselbe Antwort' },
  { datei: 'bar-bestaetigung.ts', name: 'storniereBarBestellung', grund: 'Der Link in der Mail an die Kundin trägt ein signiertes Token, das die Bestellung bestimmt; eine Sitzung gibt es nicht' },
  { datei: 'bestellungen-finden.ts', name: 'fordereBestellCodeAn', grund: 'Wer seine Bestellungen finden will, hat kein Konto; der Besitz der Adresse wird mit einem Code bewiesen, dazu Bremse' },
  { datei: 'bestellungen-finden.ts', name: 'zeigeBestellungen', grund: 'Wer seine Bestellungen finden will, hat kein Konto; der Besitz der Adresse wird mit einem Code bewiesen, dazu Bremse' },
  { datei: 'bestellungen-finden.ts', name: 'beendeBestellAnsicht', grund: 'Löscht nur das eigene Cookie der Bestellansicht; es gibt keine Sitzung und nichts zu schützen' },
  { datei: 'email-bestaetigung.ts', name: 'bestaetigeEmail', grund: 'Der Link in der Mail an den Hof trägt einen einmaligen Code mit Frist; beim Klicken ist oft noch niemand angemeldet' },
  { datei: 'konto-anfragen.ts', name: 'bestaetigeEmailAenderung', grund: 'Der Link aus der Mail an die neue Adresse trägt einen Einmal-Token (gehasht, 24 Stunden, einmal) und gilt nur mit der richtig getippten Adresse; der Hof ist dabei oft nicht angemeldet (N36, Nr. 190)' },
  { datei: 'geraete.ts', name: 'meldeAllesAbNichtIch', grund: 'Der Link aus der Mail „Neue Anmeldung" trägt einen Einmal-Token (gehasht, 7 Tage, einmal); wer ihn öffnet, ist oft nirgends mehr angemeldet' },
  { datei: 'hoefe.ts', name: 'loeseOrtAuf', grund: 'Die Ortssuche auf der öffentlichen Hofliste ist ohne Konto gedacht; Eingabe mit Zod geprüft, dazu Bremse je Adresse' },
  { datei: 'neuigkeiten.ts', name: 'meldeNeuigkeitenAn', grund: 'Die Anmeldung zu Neuigkeiten eines Hofs ist ohne Konto gedacht; Double-Opt-in per Mail, Eingabe mit Zod geprüft, dazu Bremse' },
  { datei: 'onboarding.ts', name: 'checkSlugAvailability', grund: 'Die Vorschau der Hofadresse läuft beim Registrieren vor dem Konto; Eingabe mit Zod geprüft, dazu Bremse, bei Fehlern neutral' },
  { datei: 'register.ts', name: 'registerFarmer', grund: 'Die Registrierung eines Hofs legt erst das Konto an und hat deshalb keine Sitzung; Eingabe mit Zod geprüft, dazu Bremse' },
  { datei: 'subscriptions.ts', name: 'bestaetigeNeuigkeiten', grund: 'Der Link in der Bestätigungsmail trägt ein signiertes Token; die Abonnentin ist nicht angemeldet' },
  { datei: 'subscriptions.ts', name: 'unsubscribeWithToken', grund: 'Der Abmeldelink in der Mail trägt ein signiertes Token; die Abonnentin ist nicht angemeldet' },
]

/**
 * Sitzung freiwillig (Nr. 125): Die Action prüft die Sitzung, läuft aber bewusst auch ohne sie weiter — die
 * Sitzung entscheidet nur über Zusätze. Eine Ausnahme, die doch auswertet, fällt als veraltet auf.
 */
const SITZUNG_FREIWILLIG: Ausnahme[] = [
  { datei: 'meldung.ts', name: 'meldungAbsenden', grund: 'Kundinnen ohne Konto melden ein Problem genauso wie Höfe; die Sitzung entscheidet nur über Screenshot und Stundengrenze des Hofs' },
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

/** Endet der Zweig mit return oder throw — als einzelne Anweisung oder als letzte im Block? */
function brichtAb(zweig: ts.Statement): boolean {
  if (ts.isReturnStatement(zweig) || ts.isThrowStatement(zweig)) return true
  if (!ts.isBlock(zweig)) return false
  const letzte = zweig.statements[zweig.statements.length - 1]
  return letzte !== undefined && brichtAb(letzte)
}

/** Wirft der Zweig (der Aufrufer bekommt nie „keine Sitzung") oder gibt er einen Wert zurück? */
function abbruchArt(zweig: ts.Statement): 'wirft' | 'gibt-zurueck' {
  const letzte = ts.isBlock(zweig) ? zweig.statements[zweig.statements.length - 1] : zweig
  return letzte !== undefined && ts.isThrowStatement(letzte) ? 'wirft' : 'gibt-zurueck'
}

function erwaehnt(knoten: ts.Node, name: string): boolean {
  if (ts.isIdentifier(knoten) && knoten.text === name) return true
  return ts.forEachChild(knoten, (kind) => erwaehnt(kind, name) || undefined) ?? false
}

/** Wie eine Prüfstelle ausgewertet wird — siehe Kopf. 'weiter' = unverändert zurückgegeben. */
function auswertung(aufruf: ts.CallExpression): 'wirft' | 'gibt-zurueck' | 'weiter' | 'fehlt' {
  const ausdruck: ts.Node = ts.isAwaitExpression(aufruf.parent) ? aufruf.parent : aufruf
  if (ts.isReturnStatement(ausdruck.parent)) return 'weiter'
  for (let n: ts.Node = ausdruck; !ts.isBlock(n.parent) && !ts.isSourceFile(n.parent); n = n.parent) {
    const p = n.parent
    if (ts.isIfStatement(p) && p.expression === n) return brichtAb(p.thenStatement) ? abbruchArt(p.thenStatement) : 'fehlt'
  }
  const deklaration = ausdruck.parent
  if (!ts.isVariableDeclaration(deklaration) || !ts.isIdentifier(deklaration.name) || deklaration.initializer !== ausdruck) return 'fehlt'
  const anweisung = deklaration.parent.parent
  const block = anweisung.parent
  if (!ts.isVariableStatement(anweisung) || !(ts.isBlock(block) || ts.isSourceFile(block))) return 'fehlt'
  const naechste = block.statements[block.statements.indexOf(anweisung) + 1]
  if (naechste === undefined || !ts.isIfStatement(naechste) || !erwaehnt(naechste.expression, deklaration.name.text)) return 'fehlt'
  return brichtAb(naechste.thenStatement) ? abbruchArt(naechste.thenStatement) : 'fehlt'
}

/** Die Funktionen einer Datei mit einer Prüfstelle, deren Ergebnis nicht ausgewertet wird. */
function ohneAuswertung(quelltext: string, pfad = 'schnipsel.ts'): string[] {
  const datei = ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const alle = funktionen(datei)
  // Helfer, die bei fehlender Sitzung einen Wert zurückgeben (oder das Ergebnis weiterreichen) — bis nichts mehr dazukommt.
  const nullbar = new Set<string>()
  const pruefstellen = (knoten: ts.Node): ts.CallExpression[] => {
    const liste: ts.CallExpression[] = []
    const besuche = (k: ts.Node): void => {
      if (ts.isCallExpression(k) && (istSitzungspruefung(k) || (ts.isIdentifier(k.expression) && nullbar.has(k.expression.text)))) liste.push(k)
      ts.forEachChild(k, besuche)
    }
    besuche(knoten)
    return liste
  }
  for (let neu = true; neu; ) {
    neu = false
    for (const [name, f] of alle) {
      if (f.exportiert || nullbar.has(name)) continue
      if (pruefstellen(f.knoten).some((c) => ['gibt-zurueck', 'weiter'].includes(auswertung(c)))) {
        nullbar.add(name)
        neu = true
      }
    }
  }
  return [...alle].filter(([, f]) => pruefstellen(f.knoten).some((c) => auswertung(c) === 'fehlt')).map(([name]) => name)
}

const dateien = readdirSync(ORDNER).filter((n) => n.endsWith('.ts'))
const quellen = new Map(dateien.map((n) => [n, readFileSync(join(ORDNER, n), 'utf8')]))
const ungeprueft = dateien.flatMap((n) => ohnePruefung(quellen.get(n)!, n).map((name) => ({ datei: n, name })))
const unausgewertet = dateien.flatMap((n) => ohneAuswertung(quellen.get(n)!, n).map((name) => ({ datei: n, name })))

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

describe('Actions-Wache — das Ergebnis der Prüfung wird ausgewertet (Nr. 125)', () => {
  it('jede Prüfstelle wertet ihr Ergebnis gleich danach aus — außer SITZUNG_FREIWILLIG mit Grund', () => {
    const verstoesse = unausgewertet.filter((u) => !SITZUNG_FREIWILLIG.some((a) => a.datei === u.datei && a.name === u.name)).map((u) => `${u.datei}: ${u.name}`)
    expect(verstoesse, 'Gleich nach der Prüfung: if (!sitzung?.user) return … bzw. if (\'error\' in wache) return … — oder mit Grund in SITZUNG_FREIWILLIG').toEqual([])
  })

  it('hat keine veraltete Ausnahme in SITZUNG_FREIWILLIG, und jeder Grund steht in ganzen Worten', () => {
    const veraltet = SITZUNG_FREIWILLIG.filter((a) => !unausgewertet.some((u) => u.datei === a.datei && u.name === a.name)).map((a) => `${a.datei}: ${a.name}`)
    expect(veraltet).toEqual([])
    for (const a of SITZUNG_FREIWILLIG) {
      expect(a.grund.split(' ').length, `${a.datei} ${a.name}`).toBeGreaterThanOrEqual(8)
      expect(OEFFENTLICH.some((o) => o.datei === a.datei && o.name === a.name), `${a.name} prüft die Sitzung, steht also nicht in OEFFENTLICH`).toBe(false)
    }
  })

  it('Gegenprobe: verworfenes, ungeprüftes und zu spät geprüftes Ergebnis schlagen an', () => {
    expect(ohneAuswertung("'use server'\nexport async function a() { await auth.api.getSession({ headers: await headers() })\n await db.x.delete() }")).toEqual(['a'])
    expect(ohneAuswertung("'use server'\nexport async function b() { const s = await auth.api.getSession()\n await db.x.update({ where: { id: s.user.id } }) }")).toEqual(['b'])
    expect(ohneAuswertung("'use server'\nexport async function c() { const g = await verlangeAdminAktion()\n await db.x.delete()\n if ('error' in g) return g }")).toEqual(['c'])
    expect(ohneAuswertung("'use server'\nexport async function d() { const s = await auth.api.getSession()\n if (s?.user) { log() }\n await db.x.create() }")).toEqual(['d'])
    expect(ohneAuswertung("'use server'\nexport async function e() { void (await verlangeFrischeBestaetigung())\n return 1 }")).toEqual(['e'])
  })

  it('Gegenprobe: ein Helfer, der bei fehlender Sitzung null gibt, verlangt die Auswertung beim Aufrufer', () => {
    const helfer = "'use server'\nasync function hof() { const s = await auth.api.getSession()\n if (!s?.user) return null\n return s.user.id }\n"
    expect(ohneAuswertung(helfer + 'export async function a() { const h = await hof()\n await db.x.create({ data: { h } }) }')).toEqual(['a'])
    expect(ohneAuswertung(helfer + "export async function b() { const h = await hof()\n if (!h) return { error: 'x' }\n await db.x.create({ data: { h } }) }")).toEqual([])
    const weiter = "'use server'\nasync function sitzung() { return auth.api.getSession() }\n"
    expect(ohneAuswertung(weiter + 'export async function c() { const s = await sitzung()\n return s.user.id }')).toEqual(['c'])
    expect(ohneAuswertung(weiter + 'export async function d() { const s = await sitzung()\n if (!s) return null\n return s.user.id }')).toEqual([])
  })

  it('lässt die üblichen Formen durch: if … return, if … throw, Prüfung in der Bedingung, werfender Helfer', () => {
    expect(ohneAuswertung("'use server'\nexport async function a() { const s = await auth.api.getSession({ headers: await headers() })\n if (!s?.user) return { error: 'x' }\n await db.x.delete() }")).toEqual([])
    expect(ohneAuswertung("'use server'\nexport async function b() { const g = await verlangeAdminAktion()\n if ('error' in g) return { error: g.error }\n await db.x.delete() }")).toEqual([])
    expect(ohneAuswertung("'use server'\nexport async function c() { if (!(await auth.api.getSession())) throw new Error('x')\n await db.x.delete() }")).toEqual([])
    expect(ohneAuswertung("'use server'\nexport async function d() { const f = await verlangeFrischeBestaetigung()\n if ('error' in f) { log()\n return f } }")).toEqual([])
    const werfend = "'use server'\nasync function hof() { const s = await auth.api.getSession()\n if (!s?.user) throw new Error('x')\n return 1 }\n"
    expect(ohneAuswertung(werfend + 'export async function e() { const id = await hof()\n await db.x.delete({ where: { id } }) }')).toEqual([])
  })
})

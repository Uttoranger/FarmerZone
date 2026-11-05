/**
 * Gebühren-Wort (V62, V63; Register N8, N38; Lauf 30, Nr. 221).
 *
 * Ursache: Ab dem Stichtag „Hofpreis-Modell ab“ heißt die Gebühr überall
 * „Plattformgebühr“ — auch im Admin. Nach dem Stichtag standen trotzdem
 * Texte mit „Servicegebühr“ ohne Bedingung da (Konditionen, Admin, Futter,
 * Storno, Startseite). Bestellungen im Modell „bisher“ behalten ihr Wort über
 * `gebuehrBezeichnungFuer`, Summen über einen Zeitraum nehmen
 * `gebuehrWortFuerZeitraum` (src/lib/plattformgebuehr.ts).
 *
 * Beweist:
 *  - Jede Zeichenkette, jeder Vorlagentext, jedes Attribut und jeder JSX-Text mit
 *    „Servicegebühr“ unter src/ steht in FESTE_LISTE (mit Grund: nur Modell „bisher“,
 *    AGB 0.9), in NACHARBEIT (Datei ohne Nummer in Lauf 30) oder in einer Offen-Datei
 *    tests/gebuehr-wort-offen/<nr>.ts der Nummer, der die Datei gehört (Dateigrenzen
 *    Lauf 30). Kommentare, Bezeichner und Server-Logs (console.*) zählen nicht.
 *  - Ebenso jeder RÜCKFALL auf die Fassung „bisher“, der das Wort nicht selbst
 *    schreibt (Befund pruefer, Runde 1):
 *      · jede Verwendung eines Werts aus RUECKFALL_WERTE (SERVICEGEBUEHR_BEZEICHNUNG
 *        und die festen Sätze „bisher“) außerhalb seiner Quelldatei;
 *      · jeder Aufruf eines Wort-Helfers ohne Wort — Helfer ist jede Funktion, deren
 *        Parameter als Vorgabe einen Rückfall-Wert oder 'bisher' trägt (von selbst
 *        gefunden, z. B. `inklGebuehr`, `jahrAlsCsv`, `beispielRechnung`);
 *      · jeder Aufruf eines Helfers mit Wort-Feld (`lage.gebuehrWort ?? …`), dessen
 *        Argument das Feld nicht sichtbar setzt (z. B. `lageKacheln`);
 *      · jeder Leser einer Modul-Konstante bzw. ihrer Eigenschaft, die so einen
 *        Rückfall festhält (z. B. `ADMIN_BESTELLUNG_TEXT.servicegebuehr`,
 *        `FINANZEN_JAHR_TEXT.legendeServicegebuehren`).
 *    Die Vorgabe selbst (Parameter, `?? …`, Modul-Konstante) zählt nicht — sie ist
 *    nur über ihre Aufrufer bzw. Leser sichtbar, und die zählt die Wache einzeln.
 *  - Ein Eintrag ohne Fundstelle fällt auf — in FESTE_LISTE, NACHARBEIT, RUECKFALL_WERTE
 *    und in den Offen-Dateien; ein Offen-Eintrag deckt genau eine Fundstelle (über Datei
 *    und Text, nie die Zeile).
 *  - Jede Offen-Datei heißt nach ihrer Nummer und exportiert OFFEN; 221 hat keine.
 *  - Gegenprobe: Die Suche schlägt im String, in der Vorlage, im Attribut und im JSX-Text
 *    an, nicht im Kommentar, nicht im Bezeichner und nicht im console.log; ein neuer
 *    Aufruf ohne Wort, ein neuer Leser und eine neue Verwendung werden rot.
 *
 * Die Offen-Dateien: Jede Nummer stellt ihre Fundstellen um (über `gebuehrBezeichnungFuer`,
 * `gebuehrWortFuerZeitraum`, die Text-Helfer je Modell in konditionen.ts bzw. das Wort als
 * Argument), leert und löscht nur ihre eigene Datei. Ist eine Fundstelle schon nur im Modell
 * „bisher“ erreichbar, steht sie mit diesem Grund in FESTE_LISTE. Den Rendertest „kein
 * ‚Servicegebühr‘ nach dem Stichtag“ schreibt jede Seiten-Nummer für ihre Seiten; im
 * Sammel-PR ist der Ordner leer.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const WURZEL = process.cwd()
const WORT = /Servicegebühr/

type Fund = { datei: string; zeile: number; text: string }
type Quelle = { datei: string; baum: ts.SourceFile }

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

function parse(datei: string, quelltext: string): Quelle {
  const art = datei.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return { datei, baum: ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, art) }
}

function besucheAlle(knoten: ts.Node, besuch: (k: ts.Node) => void): void {
  besuch(knoten)
  ts.forEachChild(knoten, (kind) => besucheAlle(kind, besuch))
}

const zeileVon = (q: Quelle, k: ts.Node): number => q.baum.getLineAndCharacterOfPosition(k.getStart(q.baum)).line + 1
const zeilentext = (q: Quelle, zeile: number): string => (q.baum.text.split('\n')[zeile - 1] ?? '').replace(/\s+/g, ' ').trim()

/** Steht der Knoten in einem Aufruf von console.* — ein Server-Log, das niemand in der Oberfläche liest? */
function imLog(knoten: ts.Node): boolean {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (ts.isCallExpression(k) && ts.isPropertyAccessExpression(k.expression) && k.expression.expression.getText() === 'console') return true
  }
  return false
}

/** „Servicegebühr“ in Zeichenketten, Vorlagen, Attributen und JSX-Text — Kommentare, Bezeichner und Logs zählen nicht. */
function wortFunde(q: Quelle): Fund[] {
  const funde: Fund[] = []
  besucheAlle(q.baum, (knoten) => {
    let roh: string | null = null
    if (ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)) roh = knoten.text
    else if (ts.isTemplateHead(knoten) || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten)) roh = knoten.text
    else if (ts.isJsxText(knoten)) roh = knoten.text
    if (roh !== null && WORT.test(roh) && !imLog(knoten)) funde.push({ datei: q.datei, zeile: zeileVon(q, knoten), text: roh.replace(/\s+/g, ' ').trim() })
  })
  return funde
}

function findeWort(quelltext: string, datei = 'schnipsel.tsx'): Fund[] {
  return wortFunde(parse(datei, quelltext))
}

// ── Rückfälle auf die Fassung „bisher“ ─────────────────────────────────────

/**
 * Werte der Fassung „bisher“ OHNE Bedingung: Wer sie außerhalb von `quellen` liest, zeigt
 * nach dem Stichtag „Servicegebühr“. Die Quellen wählen sie nur im Modell „bisher“ (das
 * beweisen tests/gebuehr-texte.test.ts und tests/plattformgebuehr.test.ts).
 */
const RUECKFALL_WERTE: { name: string; quellen: readonly string[] }[] = [
  { name: 'SERVICEGEBUEHR_BEZEICHNUNG', quellen: ['src/lib/servicegebuehr.ts', 'src/lib/plattformgebuehr.ts'] },
  { name: 'GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS', quellen: ['src/lib/servicegebuehr.ts', 'src/lib/plattformgebuehr.ts'] },
  { name: 'SERVICEGEBUEHR_ZAHLT_KUNDE', quellen: ['src/lib/konditionen.ts'] },
  { name: 'servicegebuehrZahltKunde', quellen: ['src/lib/konditionen.ts'] },
  { name: 'VOLLER_WARENPREIS', quellen: ['src/lib/konditionen.ts'] },
  { name: 'MONATSABRECHNUNG_TEILE', quellen: ['src/lib/konditionen.ts'] },
  { name: 'MONATSABRECHNUNG_TEXT', quellen: ['src/lib/konditionen.ts'] },
  { name: 'SERVICEGEBUEHR_NUR_NEUE', quellen: ['src/lib/admin-hoefe.ts'] },
  { name: 'gebuehrBezeichnung', quellen: ['src/lib/kasse.ts'] },
  { name: 'SERVICEGEBUEHR_ZUSATZ', quellen: ['src/lib/kasse.ts'] },
]

type Helfer = { name: string; index: number; datei: string }
type FeldHelfer = Helfer & { feld: string }
type Alias = { objekt: string; eigenschaft: string | null; datei: string }

const nameVon = (n: ts.PropertyName | ts.BindingName): string | null => (ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : null)

/** Der Name, unter dem eine Funktion aufgerufen wird — Deklaration, `const f = () =>`, `{ f: () => }` oder Methode. */
function funktionsName(fn: ts.Node): string | null {
  if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name) return nameVon(fn.name)
  if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) {
    const p = fn.parent
    if (ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p)) return nameVon(p.name)
  }
  return null
}

/** Hält eine Modul-Konstante (oder eine ihrer Eigenschaften) den Ausdruck fest — außerhalb jeder Funktion? */
function aliasVon(knoten: ts.Node, datei: string): Alias | null {
  let eigenschaft: string | null = null
  for (let k: ts.Node = knoten; k.parent; k = k.parent) {
    const p = k.parent
    if (ts.isFunctionLike(p)) return null
    if (ts.isPropertyAssignment(p) && p.initializer === k && eigenschaft === null) eigenschaft = nameVon(p.name)
    if (ts.isVariableDeclaration(p) && p.initializer === k) {
      const anweisung = p.parent.parent
      const objekt = nameVon(p.name)
      return objekt && ts.isVariableStatement(anweisung) && ts.isSourceFile(anweisung.parent) ? { objekt, eigenschaft, datei } : null
    }
  }
  return null
}

/** Ein Bezeichner, der nur deklariert, importiert, exportiert oder als Typ genannt wird, ist keine Verwendung. */
function istVerwendung(id: ts.Identifier): boolean {
  const p = id.parent
  if (ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p)) return false
  if ((ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isParameter(p) || ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p)) && p.name === id) return false
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false
  for (let k: ts.Node = id; k.parent; k = k.parent) if (ts.isTypeNode(k.parent)) return false
  return true
}

/** Importiert die Datei `name` — auch umbenannt (`import { ADMIN_BESTELLUNG_TEXT as T }`)? */
const importiert = (q: Quelle, name: string): boolean =>
  q.baum.statements.some(
    (s) =>
      ts.isImportDeclaration(s) &&
      s.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(s.importClause.namedBindings) &&
      s.importClause.namedBindings.elements.some((e) => (e.propertyName ?? e.name).text === name)
  )

const aufrufName = (c: ts.CallExpression): string | null =>
  ts.isIdentifier(c.expression) ? c.expression.text : ts.isPropertyAccessExpression(c.expression) ? c.expression.name.text : null

/** Die Rückfall-Funde aller Dateien — Verwendungen, Aufrufe ohne Wort, Leser der festgehaltenen Rückfälle. */
function rueckfallFunde(quellen: readonly Quelle[]): Fund[] {
  const funde: Fund[] = []
  const helfer: Helfer[] = []
  const feldHelfer: FeldHelfer[] = []
  const aliase: Alias[] = []
  const fund = (q: Quelle, k: ts.Node, marke: string): void => {
    const zeile = zeileVon(q, k)
    funde.push({ datei: q.datei, zeile, text: `${marke} · ${zeilentext(q, zeile)}` })
  }
  const istVorgabe = (k: ts.Node): boolean => (ts.isStringLiteral(k) && k.text === 'bisher') || (ts.isIdentifier(k) && RUECKFALL_WERTE.some((w) => w.name === k.text))

  // 1. Vorgaben in Parametern (Helfer) und Verwendungen der Rückfall-Werte — Feld-Helfer, Modul-Konstante oder Fund.
  for (const q of quellen) {
    besucheAlle(q.baum, (k) => {
      const p = k.parent
      if (p && ts.isParameter(p) && p.initializer === k) {
        const name = istVorgabe(k) ? funktionsName(p.parent) : null
        if (name) helfer.push({ name, index: p.parent.parameters.indexOf(p), datei: q.datei })
        if (istVorgabe(k)) return
      }
      if (!ts.isIdentifier(k)) return
      const wert = RUECKFALL_WERTE.find((w) => w.name === k.text)
      if (!wert || wert.quellen.includes(q.datei) || !istVerwendung(k)) return
      // `lage.gebuehrWort ?? SERVICEGEBUEHR_BEZEICHNUNG`: das Feld eines Parameters — gezählt wird beim Aufrufer.
      if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && p.right === k && ts.isPropertyAccessExpression(p.left)) {
        const links = p.left
        let fn: ts.Node | undefined = p.parent
        while (fn && !ts.isFunctionLike(fn)) fn = fn.parent
        const objekt = ts.isIdentifier(links.expression) ? links.expression.text : null
        if (fn && ts.isFunctionLike(fn) && objekt) {
          const index = fn.parameters.findIndex((x) => ts.isIdentifier(x.name) && x.name.text === objekt)
          const name = funktionsName(fn)
          if (index >= 0 && name) {
            feldHelfer.push({ name, index, feld: links.name.text, datei: q.datei })
            return
          }
        }
      }
      const alias = aliasVon(k, q.datei)
      if (alias) aliase.push(alias)
      else fund(q, k, k.text)
    })
  }

  // 2. Aufrufe der Helfer ohne Wort bzw. ohne Wort-Feld.
  for (const q of quellen) {
    besucheAlle(q.baum, (k) => {
      if (!ts.isCallExpression(k)) return
      const name = aufrufName(k)
      if (!name || k.arguments.some(ts.isSpreadElement)) return
      const h = helfer.find((x) => x.name === name)
      if (h && k.arguments.length <= h.index) {
        const alias = aliasVon(k, q.datei)
        if (alias) aliase.push(alias)
        else fund(q, k, `${name}() ohne Wort`)
      }
      const f = feldHelfer.find((x) => x.name === name)
      if (f) {
        const arg = k.arguments[f.index]
        const gesetzt =
          arg !== undefined &&
          ts.isObjectLiteralExpression(arg) &&
          arg.properties.some((x) => (ts.isPropertyAssignment(x) || ts.isShorthandPropertyAssignment(x)) && nameVon(x.name) === f.feld)
        if (!gesetzt) fund(q, k, `${name}() ohne ${f.feld}`)
      }
    })
  }

  // 3. Leser der Modul-Konstanten, die einen Rückfall festhalten.
  for (const q of quellen) {
    besucheAlle(q.baum, (k) => {
      for (const a of aliase) {
        if (a.eigenschaft === null) {
          if (ts.isIdentifier(k) && k.text === a.objekt && istVerwendung(k) && (q.datei === a.datei || importiert(q, a.objekt))) fund(q, k, a.objekt)
        } else if (ts.isPropertyAccessExpression(k) && k.name.text === a.eigenschaft) {
          const direkt = ts.isIdentifier(k.expression) && k.expression.text === a.objekt
          if (direkt || (q.datei !== a.datei && importiert(q, a.objekt))) fund(q, k, `${a.objekt}.${a.eigenschaft}`)
        }
      }
    })
  }
  return funde
}

// ── Feste Liste ──────────────────────────────────────────────────────────────

/**
 * Wo „Servicegebühr“ bzw. ein Rückfall richtig dasteht oder bewusst bleibt — je Datei und
 * Text (ganz gleich oder Muster), mit Grund; ein Eintrag deckt jeden Treffer dieses Texts in
 * der Datei. `text: null` nimmt die ganze Datei (nur Rechtstext, den kein Lauf umschreibt).
 * Rückfall-Funde tragen den Text „<Marke> · <Zeile>“.
 */
type Fest = { datei: string; text: string | RegExp | null; grund: string }

const BISHER = 'nur Modell bisher'

const FESTE_LISTE: Fest[] = [
  // AGB 0.9 (Register O4) — Wortlaut bleibt, AGB 1.0 ist ein eigener /fix.
  { datei: 'src/lib/rechtstexte/agb.ts', text: null, grund: 'AGB 0.9: Rechtstext, wörtlich aus docs/recht/agb.md (Register O4); AGB 1.0 ist ein eigener /fix' },
  // Die Quellen des Worts im Modell „bisher“ (ihre Leser zählt RUECKFALL_WERTE)
  { datei: 'src/lib/servicegebuehr.ts', text: 'Servicegebühr', grund: `${BISHER}: SERVICEGEBUEHR_BEZEICHNUNG — gebuehrBezeichnungFuer und gebuehrWortFuerZeitraum wählen es nur für das alte Modell` },
  {
    datei: 'src/lib/servicegebuehr.ts',
    text: 'Servicegebühr-Erstattung ausstehend.',
    grund: `${BISHER}: GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS; mit Bestellung gebuehrErstattungOffenHinweisFuer (plattformgebuehr.ts)`,
  },
  // konditionen.ts: die Fassungen „bisher“ der Texte je Modell (ihre Leser zählt RUECKFALL_WERTE)
  { datei: 'src/lib/konditionen.ts', text: /^(Bei Barzahlung bis|Ohne Servicegebühr bis|Bei Barzahlung fällt bis)|^(ohne Servicegebühr\.|keine Servicegebühr an\.)$/, grund: `${BISHER}: Register B1, Barzahlung bis zum Bar-Stichtag (vorBarStichtag)` },
  { datei: 'src/lib/konditionen.ts', text: 'Die Servicegebühr von', grund: `${BISHER}: SERVICEGEBUEHR_ZAHLT_KUNDE und servicegebuehrZahltKunde — ab dem Stichtag gebuehrGrundsatz bzw. konditionenGebuehrAbschnitt` },
  { datei: 'src/lib/konditionen.ts', text: 'Die Servicegebühr zahlt der Kunde – du behältst den vollen Warenpreis.', grund: `${BISHER}: VOLLER_WARENPREIS — ab dem Stichtag vollerWarenpreis(modell)` },
  { datei: 'src/lib/konditionen.ts', text: /^– und die Servicegebühren aus Barbestellungen\./, grund: `${BISHER}: MONATSABRECHNUNG_TEILE — ab dem Stichtag monatsabrechnungTeile(modell)` },
  { datei: 'src/lib/konditionen.ts', text: 'Servicegebühr und Abrechnung', grund: `${BISHER}: Zweig „bisher“ von konditionenGebuehrAbschnitt` },
  // Der Satz des alten Modells je Hof (A1): ein anderes Feld als die Plattformgebühr
  { datei: 'src/lib/admin-aufgaben.ts', text: 'Servicegebühr geändert', grund: `${BISHER}: Protokoll von setServiceFeeAction (Farm.serviceFee*, Satz des alten Modells, A1)` },
  { datei: 'src/lib/admin-hof-akte.ts', text: 'Servicegebühr geändert', grund: `${BISHER}: Aktivität zu setServiceFeeAction (Farm.serviceFee*, Satz des alten Modells, A1)` },
  {
    datei: 'src/lib/admin-rechte.ts',
    text: 'Höfe freischalten, Gründung, Testhof und Servicegebühr',
    grund: `${BISHER}: Das Recht hoefe_freischalten schützt setServiceFeeAction (alter Satz); die Karte „Plattformgebühr“ schützt das Recht geld (speichereHofPlattformgebuehr) — git grep, Bericht 221`,
  },
  { datei: 'src/lib/admin-hoefe.ts', text: /^Servicegebühr pro Hof änderbar \(Standard$/, grund: `${BISHER}: SERVICEGEBUEHR_NUR_NEUE beschreibt den Satz des alten Modells (Dialog „Servicegebühr“, A1)` },
  { datei: 'src/components/admin/servicegebuehr-dialog.tsx', text: /^Servicegebühr( gespeichert)?$/, grund: `${BISHER}: Dialog des alten Satzes (Farm.serviceFee*, A1); Knopf nach A1 nur vor dem Stichtag (Nr. 229)` },
  {
    datei: 'src/components/admin/servicegebuehr-dialog.tsx',
    text: /^SERVICEGEBUEHR_NUR_NEUE · \{SERVICEGEBUEHR_NUR_NEUE\} \{SERVICEGEBUEHR_ADMIN_ERKLAERUNG\}$/,
    grund: `${BISHER}: im Dialog des alten Satzes (Farm.serviceFee*, A1); Knopf nach A1 nur vor dem Stichtag (Nr. 229)`,
  },
  // Schon bedingt
  { datei: 'src/components/checkout/kasse-teile.tsx', text: 'Was ist die Servicegebühr?', grund: `${BISHER}: Zweig ohne hofpreis (hofpreis ? Plattformgebühr : Servicegebühr)` },
  {
    datei: 'src/emails/artikel-fehlt.tsx',
    text: /^Die \$\{p\.gebuehrWort \?\? 'Servicegebühr'\}|^Servicegebühr$/,
    grund: `${BISHER}: Rückfall nur ohne gebuehrWort im Auftrag; email.ts setzt es aus der Bestellung`,
  },
  { datei: 'src/emails/new-order-notification.tsx', text: 'Servicegebühr', grund: `${BISHER}: Rückfall nur ohne gebuehrWort im Auftrag; email.ts setzt es aus der Bestellung` },
  { datei: 'src/emails/order-confirmed.tsx', text: 'Servicegebühr', grund: `${BISHER}: Rückfall nur ohne gebuehrWort im Auftrag; email.ts setzt es aus der Bestellung` },
  { datei: 'src/lib/email.ts', text: /^SERVICEGEBUEHR_BEZEICHNUNG · return imHofpreis\(order\) \? PLATTFORMGEBUEHR_BEZEICHNUNG : SERVICEGEBUEHR_BEZEICHNUNG$/, grund: `${BISHER}: gebuehrWort(order), Zweig ohne Hofpreis` },
  { datei: 'src/lib/artikel-fehlt.ts', text: /^SERVICEGEBUEHR_BEZEICHNUNG · gebuehrWort: hofpreis \? PLATTFORMGEBUEHR_BEZEICHNUNG : SERVICEGEBUEHR_BEZEICHNUNG,$/, grund: `${BISHER}: Zweig ohne Hofpreis` },
  // kasse.ts: Zahlungsschritt, Gebührenzeile und Fortsetzen — jeweils nach `if (hof.preisAnzeige)` bzw. im Zweig ohne hofpreis
  {
    datei: 'src/lib/kasse.ts',
    text: /^SERVICEGEBUEHR_BEZEICHNUNG · (if \(berechneServicegebuehr|if \(!satz\) return|return `\$\{SERVICEGEBUEHR_BEZEICHNUNG\} · \$\{satzMitMindestgebuehr|titel: `\$\{SERVICEGEBUEHR_BEZEICHNUNG\} \(|if \(b\.serviceFeeCents === 0)/,
    grund: `${BISHER}: zahlungsGebuehrText und gebuehrZeile erst nach „if (hof.preisAnzeige) return Plattformgebühr“, servicegebuehrTextAusSnapshot nur im Zweig ohne hofpreis`,
  },
  // Nur Entwicklung
  {
    datei: 'src/app/intern/bausteine/bausteine-vorschau.tsx',
    text: /^Ware, Abholtermin und Vertragspartner unmittelbar über dem Kaufknopf .*online mit der Servicegebühr;/,
    grund: 'Vorschau unter /intern/bausteine (nur Entwicklung): Beschreibung von KaufZusammenfassung in der Fassung „bisher“ (Nr. 219)',
  },
  {
    datei: 'src/app/intern/bausteine/bausteine-vorschau.tsx',
    text: 'inkl. Servicegebühr (5 %) € 2,50',
    grund: 'Vorschau unter /intern/bausteine (nur Entwicklung): Beispielwert der Fassung „bisher“ von KaufZusammenfassung (Nr. 219)',
  },
  { datei: 'src/lib/hofseite-kunde.ts', text: /^% Servicegebühr/, grund: `${BISHER}: gebuehrHinweis — Seiten rufen gebuehrHinweisFuerHof, das mit hof.preisAnzeige (Hofpreis-Modell) plattformgebuehrHinweis nimmt (Nr. 226)` },
  { datei: 'src/lib/hofseite-kunde.ts', text: 'zzgl. Servicegebühr', grund: `${BISHER}: Korb-Zusatz in gebuehrHinweis, nur ohne hof.preisAnzeige über gebuehrHinweisFuerHof (Nr. 226)` },
  { datei: 'src/lib/hofseite-kunde.ts', text: 'zzgl. Servicegebühr bei Online-Zahlung', grund: `${BISHER}: GEBUEHR_KORB_NUR_ONLINE, nur in gebuehrHinweis (Bar-Ausnahme B1) gelesen (Nr. 226)` },
  { datei: 'src/lib/startseite.ts', text: /^% Servicegebühr, mindestens/, grund: `${BISHER}: „Wie bezahle ich?“ in STARTSEITE_FRAGEN — startseitenFragen(jetzt, modell) nimmt im Hofpreis-Modell WIE_BEZAHLE_ICH_HOFPREIS (Nr. 226)` },
  {
    datei: 'src/components/startseite/startseite-abschnitte.tsx',
    text: /^SERVICEGEBUEHR_BEZEICHNUNG · (Für dich kommen \{rechnung\.prozent\} %|<Zeile name=\{`\$\{SERVICEGEBUEHR_BEZEICHNUNG\} · )/,
    grund: `${BISHER}: SoFunktionierts im Zweig ohne rechnung.modell — beispielRechnung(jetzt, …, modell) setzt im Hofpreis-Modell modell und satz (Nr. 226)`,
  },
  { datei: 'src/components/admin/hof-akte-ansicht.tsx', text: /^Servicegebühr …$/, grund: `${BISHER}: Knopf des alten Satzes, nach A1 nur mit servicegebuehrKnopfSichtbar (vor dem Stichtag; Nr. 229)` },
  {
    datei: 'src/components/admin/hof-akte-ansicht.tsx',
    text: /^SERVICEGEBUEHR_NUR_NEUE · \{alterSatz && <> \{SERVICEGEBUEHR_NUR_NEUE\}<\/>\}$/,
    grund: `${BISHER}: Satz zum Knopf des alten Satzes, nur mit alterSatz (servicegebuehrKnopfSichtbar, A1; Nr. 229)`,
  },
]

/**
 * Nacharbeit — Fundstellen in Dateien, die in Lauf 30 keiner Nummer gehören (Dateigrenzen)
 * und denen der Dirigent keine Nummer zugeteilt hat: nach dem Stichtag falsch, Umstellung
 * mit eigenem Auftrag (Bericht 221). Getrennt von FESTE_LISTE, weil hier nichts richtig ist.
 */
const NACHARBEIT: Fest[] = [
  {
    datei: 'src/lib/kasse.ts',
    text: '+ Servicegebühr',
    grund: 'SERVICEGEBUEHR_ZUSATZ: in src/ ungenutzt (ein Leser würde über RUECKFALL_WERTE rot), aber von tests/kasse-formular.test.ts geprüft — streichen oder je Modell, eigener Auftrag',
  },
  {
    // ABWEICHUNG_FELD_TEXT.gebuehr: das Wort je Bestellung über gebuehrBezeichnungFuer (V62/V63), kein neutrales Wort (Bericht 230, Runde 1).
    datei: 'src/lib/geld-abgleich.ts',
    text: 'Servicegebühr',
    grund: 'braucht gebuehrModell in der Abweichungs-Abfrage (src/server/geld-abgleich.ts, keine Nummer in Lauf 30)',
  },
]

const deckt = (f: Fest, fund: Fund): boolean =>
  f.datei === fund.datei && (f.text === null || (typeof f.text === 'string' ? f.text === fund.text : f.text.test(fund.text)))

// ── Offen-Dateien ────────────────────────────────────────────────────────────

/** Ein Eintrag: `stelle` = Datei:Zeile vom Tag des Eintrags (nur zum Finden), `text` ein Ausschnitt der Fundstelle. */
type Offen = { stelle: string; text: string }

const OFFEN_ORDNER = join(WURZEL, 'tests/gebuehr-wort-offen')
const OFFEN_NAMEN = existsSync(OFFEN_ORDNER) ? readdirSync(OFFEN_ORDNER).sort() : []
const OFFEN_DATEIEN: { name: string; nummer: string; export: unknown; eintraege: Offen[] }[] = await Promise.all(
  OFFEN_NAMEN.map(async (name) => {
    const modul = (await import(pathToFileURL(join(OFFEN_ORDNER, name)).href)) as { OFFEN?: unknown }
    // Fehlt der Export oder ist er keine Liste, fällt das in „exportiert OFFEN“ auf — nie still als leer.
    const eintraege = Array.isArray(modul.OFFEN) ? (modul.OFFEN as Offen[]) : []
    return { name, nummer: name.replace(/\.ts$/, ''), export: modul.OFFEN, eintraege }
  })
)
const dateiVon = (stelle: string): string => stelle.slice(0, stelle.lastIndexOf(':'))
const OFFEN = OFFEN_DATEIEN.flatMap((d) => d.eintraege.map((e) => ({ ...e, nummer: d.nummer, datei: dateiVon(e.stelle) })))

/** Jede Fundstelle nimmt höchstens einen Offen-Eintrag (der längste passende Text zuerst); was bleibt, ist offen bzw. ohne Fundstelle. */
function gleicheAb<E extends { datei: string; text: string }>(funde: Fund[], liste: E[]): { rest: Fund[]; ungenutzt: E[] } {
  const frei = [...liste]
  const rest: Fund[] = []
  for (const f of funde) {
    let beste = -1
    frei.forEach((e, i) => {
      if (e.datei === f.datei && f.text.includes(e.text) && (beste === -1 || e.text.length > frei[beste].text.length)) beste = i
    })
    if (beste === -1) rest.push(f)
    else frei.splice(beste, 1)
  }
  return { rest, ungenutzt: frei }
}

const posix = (pfad: string): string => pfad.split(sep).join('/')
const FEST_UND_NACHARBEIT = [...FESTE_LISTE, ...NACHARBEIT]

// ── Prüfungen ────────────────────────────────────────────────────────────────

describe('Gebühren-Wort: „Servicegebühr“ nur mit Bedingung', () => {
  let quellen: Quelle[] = []
  let worte: Fund[] = []
  let rueckfaelle: Fund[] = []
  let funde: Fund[] = []
  // Liest und parst jede Datei unter src/ (Syntaxbaum): kalt mehrere Sekunden, darum ein eigenes Limit nur hier.
  beforeAll(() => {
    quellen = [...quelldateien(join(WURZEL, 'src'))].map((pfad) => parse(posix(relative(WURZEL, pfad)), readFileSync(pfad, 'utf8')))
    worte = quellen.flatMap(wortFunde)
    rueckfaelle = rueckfallFunde(quellen)
    funde = [...worte, ...rueckfaelle]
  }, 30_000)

  it('findet überhaupt etwas (sonst bewiese ein leerer Fund nichts)', () => {
    expect(worte.length).toBeGreaterThan(10)
    expect(rueckfaelle.length).toBeGreaterThan(10)
  })

  it('jede Fundstelle steht in der festen Liste, in NACHARBEIT oder in genau einer Offen-Datei', () => {
    const ohneFest = funde.filter((f) => !FEST_UND_NACHARBEIT.some((e) => deckt(e, f)))
    const { rest } = gleicheAb(ohneFest, OFFEN)
    expect(rest.map((f) => `${f.datei}:${f.zeile} „${f.text.slice(0, 140)}“`)).toEqual([])
  })

  it('kein Eintrag ohne Fundstelle — weder in der festen Liste, in NACHARBEIT noch in den Offen-Dateien', () => {
    const fest = FEST_UND_NACHARBEIT.filter((e) => !funde.some((f) => deckt(e, f))).map((e) => `${e.datei} ${String(e.text)}`)
    expect(fest).toEqual([])
    const ohneFest = funde.filter((f) => !FEST_UND_NACHARBEIT.some((e) => deckt(e, f)))
    const { ungenutzt } = gleicheAb(ohneFest, OFFEN)
    expect(ungenutzt.map((e) => `${e.nummer}: ${e.stelle} „${e.text}“`)).toEqual([])
  })

  it('jeder Rückfall-Wert ist in seiner ersten Quelle deklariert (sonst prüfte die Liste nichts)', () => {
    for (const w of RUECKFALL_WERTE) {
      const q = quellen.find((x) => x.datei === w.quellen[0])
      expect(q, w.quellen[0]).toBeDefined()
      const deklariert = q!.baum.statements.some(
        (s) =>
          (ts.isFunctionDeclaration(s) && s.name?.text === w.name) ||
          (ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === w.name))
      )
      expect(deklariert, w.name).toBe(true)
    }
  })

  it('jeder feste und jeder Nacharbeits-Eintrag hat einen Grund', () => {
    for (const e of FEST_UND_NACHARBEIT) expect(e.grund.length, e.datei).toBeGreaterThan(10)
  })

  it('jede Offen-Datei heißt nach ihrer Nummer, exportiert OFFEN mit Stelle und Text — und 221 hat keine', () => {
    for (const d of OFFEN_DATEIEN) {
      expect(d.name, d.name).toMatch(/^2(2[2-9]|3[0-2])\.ts$/)
      expect(Array.isArray(d.export), d.name).toBe(true)
      for (const e of d.eintraege) {
        expect(e.stelle, d.name).toMatch(/^src\/.+\.(ts|tsx):\d+$/)
        expect(e.text.length, d.name).toBeGreaterThan(0)
      }
    }
    expect(OFFEN_NAMEN).not.toContain('221.ts')
  })
})

describe('Gegenprobe: die Suche', () => {
  it('schlägt im String, in der Vorlage, im Attribut und im JSX-Text an', () => {
    const quelle = [
      "const a = 'Die Servicegebühr zahlt der Kunde.'",
      'const b = `inkl. ${betrag} Servicegebühr`',
      'const c = <p title="Servicegebühr">Was ist die Servicegebühr?</p>',
    ].join('\n')
    expect(findeWort(quelle).map((f) => f.text)).toEqual([
      'Die Servicegebühr zahlt der Kunde.',
      'Servicegebühr',
      'Servicegebühr',
      'Was ist die Servicegebühr?',
    ])
  })

  it('nicht im Kommentar, nicht im Bezeichner, nicht im console.log', () => {
    const quelle = [
      '// Die Servicegebühr zahlt der Kunde.',
      '/** Servicegebühr im Modell bisher */',
      'const SERVICEGEBUEHR_BEZEICHNUNG_KOPIE = SERVICEGEBUEHR_BEZEICHNUNG',
      "console.log('[DEV] Servicegebühr geändert')",
    ].join('\n')
    expect(findeWort(quelle)).toEqual([])
  })

  it('eine neue Fundstelle ohne Eintrag bliebe offen — ein Offen-Eintrag deckt genau eine', () => {
    const neu: Fund[] = [
      { datei: 'src/x.ts', zeile: 1, text: 'Die Servicegebühr erstattet der Hof.' },
      { datei: 'src/x.ts', zeile: 9, text: 'Die Servicegebühr erstattet der Hof.' },
    ]
    expect(gleicheAb(neu, []).rest).toHaveLength(2)
    const eins = gleicheAb(neu, [{ datei: 'src/x.ts', text: 'Servicegebühr erstattet' }])
    expect(eins.rest).toHaveLength(1)
    expect(eins.ungenutzt).toEqual([])
    // Ein Eintrag ohne Fundstelle bleibt übrig und fällt damit auf.
    expect(gleicheAb([], [{ datei: 'src/x.ts', text: 'weg' }]).ungenutzt).toHaveLength(1)
  })

  it('die feste Liste deckt ganze Dateien nur mit text: null, sonst Text oder Muster', () => {
    const fund: Fund = { datei: 'src/lib/rechtstexte/agb.ts', zeile: 1, text: 'beliebig' }
    expect(deckt({ datei: fund.datei, text: null, grund: 'x' }, fund)).toBe(true)
    expect(deckt({ datei: fund.datei, text: 'anders', grund: 'x' }, fund)).toBe(false)
    expect(deckt({ datei: 'src/andere.ts', text: null, grund: 'x' }, fund)).toBe(false)
  })
})

describe('Gegenprobe: die Rückfälle', () => {
  const HELFER = [
    "import { SERVICEGEBUEHR_BEZEICHNUNG } from '@/lib/servicegebuehr'",
    'type Wort = typeof SERVICEGEBUEHR_BEZEICHNUNG',
    'export function zeile(betrag: string, wort: Wort = SERVICEGEBUEHR_BEZEICHNUNG) { return `${betrag} ${wort}` }',
    "export function beispiel(jetzt: Date, modell: 'bisher' | 'hofpreis' = 'bisher') { return modell }",
    "export const TEXT = { wort: SERVICEGEBUEHR_BEZEICHNUNG, mit: (w: string = SERVICEGEBUEHR_BEZEICHNUNG) => w, kopf: zeile('x') }",
    'export function kachel(lage: { wort?: string }) { return lage.wort ?? SERVICEGEBUEHR_BEZEICHNUNG }',
    "export const KOPF = zeile('y')",
    'export const direkt = () => SERVICEGEBUEHR_BEZEICHNUNG',
  ].join('\n')
  const SEITE = [
    "import { SERVICEGEBUEHR_BEZEICHNUNG } from '@/lib/servicegebuehr'",
    "import { TEXT, KOPF, zeile, kachel, beispiel } from '@/lib/helfer'",
    'export function Seite({ wort, jetzt, t }: { wort: string; jetzt: Date; t: typeof TEXT }) {',
    "  const a = zeile('€ 1')",
    "  const b = zeile('€ 1', wort)",
    '  const c = t.wort',
    '  const d = TEXT.mit()',
    '  const e = TEXT.mit(wort)',
    '  const f = kachel({})',
    '  const g = kachel({ wort })',
    '  const h = SERVICEGEBUEHR_BEZEICHNUNG',
    '  const i = beispiel(jetzt)',
    "  const j = beispiel(jetzt, 'hofpreis')",
    '  const k = KOPF',
    '  const l = TEXT.kopf',
    '  return [a, b, c, d, e, f, g, h, i, j, k, l]',
    '}',
  ].join('\n')
  const funde = rueckfallFunde([
    parse('src/lib/servicegebuehr.ts', "export const SERVICEGEBUEHR_BEZEICHNUNG = 'Servicegebühr'"),
    parse('src/lib/helfer.ts', HELFER),
    parse('src/app/seite.tsx', SEITE),
  ])
  const kurz = (f: Fund): string => `${f.datei}:${f.zeile} ${f.text.split(' · ')[0]}`

  it('meldet jede neue Verwendung, jeden Aufruf ohne Wort und jeden Leser — und nur die', () => {
    expect(funde.map(kurz).sort()).toEqual(
      [
        'src/lib/helfer.ts:8 SERVICEGEBUEHR_BEZEICHNUNG',
        'src/app/seite.tsx:4 zeile() ohne Wort',
        'src/app/seite.tsx:6 TEXT.wort',
        'src/app/seite.tsx:7 mit() ohne Wort',
        'src/app/seite.tsx:9 kachel() ohne wort',
        'src/app/seite.tsx:11 SERVICEGEBUEHR_BEZEICHNUNG',
        'src/app/seite.tsx:12 beispiel() ohne Wort',
        'src/app/seite.tsx:14 KOPF',
        'src/app/seite.tsx:15 TEXT.kopf',
      ].sort()
    )
  })

  it('die Vorgaben selbst (Parameter, „?? …“, Modul-Konstante), Typen und die Quelle zählen nicht', () => {
    expect(funde.filter((f) => f.datei === 'src/lib/servicegebuehr.ts')).toEqual([])
    expect(funde.filter((f) => f.datei === 'src/lib/helfer.ts').map((f) => f.zeile)).toEqual([8])
  })
})

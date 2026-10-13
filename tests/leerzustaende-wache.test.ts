/**
 * Leerzustände — Quelltext-Wache (Register N9, docs/ai/DESIGN_SYSTEM.md „Zustände“).
 *
 * Ursache: „Noch keine …“ stand als lose Zeile in Karten, ohne Symbol und ohne Weg weiter,
 * und derselbe Zustand hatte zwei Fassungen (auf Heute „Trag deine Abholzeiten ein …“ neben
 * „Du hast noch keine Abholzeiten eingetragen.“).
 *
 * Beweist (am Syntaxbaum von TypeScript, nicht an Regex über den Rohtext):
 *  - Jeder Text mit „noch kein…“ in einer Zeichenkette, Vorlage oder einem JSX-Text unter src/
 *    steht in einem `<EmptyState>`, in der Textquelle eines EmptyState (ein Text in src/lib, den
 *    ein `<EmptyState>` als `titel` oder `satz` nimmt — mit oder ohne Aktion) oder mit Art und
 *    Grund in AUSNAHMEN. Art B: eine einzelne Zeile in einer Karte oder Liste, die keine Aktion
 *    braucht. Art C: kein Leerzustand (Infosatz, Vergleich, Frage, Mail). Kommentare, Bezeichner
 *    und console.* zählen nicht.
 *  - Jede Ausnahme deckt eine Fundstelle; eine veraltete fällt auf.
 *  - Ein Text im Aufruf selbst (`titel="Noch keine …"`) gilt nicht als in Ordnung: Er steht mit
 *    Namen in ALTLAST_IM_AUFRUF (Nacharbeit) oder zieht in die Textquelle der Seite.
 *  - Jeder `<EmptyState>` hat eine Aktion, die immer da ist; eine, die fehlen kann (`undefined`,
 *    `bedingung ? … : undefined`, `bedingung && …`), zählt nicht. Ohne Aktion: Eintrag mit Grund
 *    in OHNE_AKTION.
 *  - Ein Zustand hat eine Fassung: „keine Abholzeiten“ (Heute, Einstellungen) und die Zeile
 *    dazu (Mein Hof, Einstellungen) kommen je aus einer Konstante.
 *  - Gegenprobe: Die Suche schlägt an einem losen Text an, nicht im Kommentar und nicht im Log.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'

const WURZEL = process.cwd()

/** „noch kein…“ in jeder Form (keine, keinen, keinem …); ein Umbruch mitten im Text zählt als Leerraum. */
const NOCH_KEIN = /(?<![\p{L}\p{N}])noch\s+kein/iu

type Ort = 'emptystate' | 'textquelle' | 'sonst'
/** Wo der Text deklariert ist: `const NAME = …`, darin der Weg über die Eigenschaften (`leer.titel` → ['leer', 'titel']). */
type Deklaration = { name: string; pfad: string[] }
type Fund = { datei: string; zeile: number; text: string; ort: Ort; deklaration: Deklaration | null }
/** Was ein `<EmptyState>` als `titel` oder `satz` aus einer Konstante nimmt: `TEXT.leer.titel` → name TEXT (ohne Umbenennung beim Import), pfad ['leer', 'titel']. */
type Verweis = { name: string; pfad: string[] }
type Aufruf = { datei: string; zeile: number; titel: string; hatAktion: boolean }

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Steht der Knoten in einem console.*-Aufruf — also in einem Server-Log, das niemand in der Oberfläche liest? */
function imLog(knoten: ts.Node): boolean {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (ts.isCallExpression(k) && ts.isPropertyAccessExpression(k.expression) && k.expression.expression.getText() === 'console') return true
  }
  return false
}

function tagName(knoten: ts.Node): string | null {
  if (ts.isJsxElement(knoten)) return knoten.openingElement.tagName.getText()
  if (ts.isJsxSelfClosingElement(knoten)) return knoten.tagName.getText()
  return null
}

/** Steht der Knoten in einem `<EmptyState>` — der Text also im Aufruf selbst? Sonst lose; ob er Textquelle ist, klärt `ordneTextquellen`. */
function ortVon(knoten: ts.Node): Ort {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (tagName(k) === 'EmptyState') return 'emptystate'
  }
  return 'sonst'
}

function schluessel(name: ts.PropertyName): string {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : name.getText()
}

/** Die Konstante, in der der Text steht, samt Weg über die Eigenschaften; null, wenn er in einer Funktion steht. */
function deklarationVon(knoten: ts.Node): Deklaration | null {
  const pfad: string[] = []
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (ts.isFunctionLike(k)) return null
    if (ts.isPropertyAssignment(k)) pfad.unshift(schluessel(k.name))
    if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name)) return { name: k.name.text, pfad }
  }
  return null
}

/** `TEXT.leer.titel` oder `TITEL` → Name der Konstante (wie sie exportiert wird) und Weg; jeder andere Ausdruck null. */
function verweisVon(ausdruck: ts.Expression, importe: Map<string, string>): Verweis | null {
  const pfad: string[] = []
  let k = ausdruck
  while (ts.isPropertyAccessExpression(k)) {
    pfad.unshift(k.name.text)
    k = k.expression
  }
  return ts.isIdentifier(k) ? { name: importe.get(k.text) ?? k.text, pfad } : null
}

/**
 * Kann der Ausdruck „keine Aktion“ ergeben? `undefined`, `null`, `false`, ein Zweig davon
 * (`bedingung ? undefined : <Knopf />`) und `bedingung && <Knopf />` (bei falscher Bedingung steht dort
 * die Bedingung selbst). Eine Aktion zählt nur, wenn sie immer da ist.
 */
function kannLeerSein(ausdruck: ts.Expression): boolean {
  let e = ausdruck
  while (ts.isParenthesizedExpression(e)) e = e.expression
  if (e.kind === ts.SyntaxKind.NullKeyword || e.kind === ts.SyntaxKind.FalseKeyword) return true
  if (ts.isIdentifier(e)) return e.text === 'undefined'
  if (ts.isConditionalExpression(e)) return kannLeerSein(e.whenTrue) || kannLeerSein(e.whenFalse)
  if (ts.isBinaryExpression(e)) {
    const zeichen = e.operatorToken.kind
    if (zeichen === ts.SyntaxKind.AmpersandAmpersandToken) return true
    if (zeichen === ts.SyntaxKind.BarBarToken || zeichen === ts.SyntaxKind.QuestionQuestionToken) return kannLeerSein(e.right)
  }
  return false
}

/** Alle Texte mit „noch kein…“ und alle EmptyState-Aufrufe einer Datei. */
function untersuche(quelltext: string, datei = 'schnipsel.tsx'): { funde: Fund[]; aufrufe: Aufruf[]; verweise: Verweis[] } {
  const art = datei.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const quelle = ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, art)
  const zeileVon = (k: ts.Node) => quelle.getLineAndCharacterOfPosition(k.getStart(quelle)).line + 1
  const funde: Fund[] = []
  const aufrufe: Aufruf[] = []
  const verweise: Verweis[] = []
  // Umbenennungen beim Import (`WHATSAPP_VERSAND_TEXT as TEXT`), damit der Verweis die Konstante trifft.
  const importe = new Map<string, string>()
  for (const anweisung of quelle.statements) {
    const benannt = ts.isImportDeclaration(anweisung) ? anweisung.importClause?.namedBindings : undefined
    if (benannt && ts.isNamedImports(benannt)) for (const e of benannt.elements) importe.set(e.name.text, (e.propertyName ?? e.name).text)
  }
  const besuche = (knoten: ts.Node): void => {
    let roh: string | null = null
    if (ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)) roh = knoten.text
    else if (ts.isTemplateHead(knoten) || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten)) roh = knoten.text
    else if (ts.isJsxText(knoten)) roh = knoten.text
    if (roh !== null && !imLog(knoten)) {
      const text = roh.replace(/\s+/g, ' ').trim()
      if (NOCH_KEIN.test(text)) funde.push({ datei, zeile: zeileVon(knoten), text, ort: ortVon(knoten), deklaration: deklarationVon(knoten) })
    }
    if ((ts.isJsxOpeningElement(knoten) || ts.isJsxSelfClosingElement(knoten)) && knoten.tagName.getText() === 'EmptyState') {
      const eigene = knoten.attributes.properties.filter(ts.isJsxAttribute)
      const titel = eigene.find((a) => a.name.getText() === 'titel')?.initializer
      const aktion = eigene.find((a) => a.name.getText() === 'aktion')
      const aktionAusdruck = aktion?.initializer && ts.isJsxExpression(aktion.initializer) ? aktion.initializer.expression : undefined
      aufrufe.push({
        datei,
        zeile: zeileVon(knoten),
        titel: titel === undefined ? '' : ts.isStringLiteral(titel) ? titel.text : ts.isJsxExpression(titel) ? (titel.expression?.getText() ?? '') : titel.getText(),
        hatAktion: aktion !== undefined && !(aktionAusdruck !== undefined && kannLeerSein(aktionAusdruck)),
      })
      for (const a of eigene) {
        const ausdruck = ['titel', 'satz'].includes(a.name.getText()) && a.initializer && ts.isJsxExpression(a.initializer) ? a.initializer.expression : undefined
        const verweis = ausdruck && verweisVon(ausdruck, importe)
        if (verweis) verweise.push(verweis)
      }
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(quelle)
  return { funde, aufrufe, verweise }
}

/**
 * Ein loser Text ist die Textquelle eines EmptyState, wenn irgendein `<EmptyState>` ihn als `titel` oder
 * `satz` aus genau dieser Konstante und diesem Weg nimmt (`titel={WUNSCHLISTE_LEER.titel}`) — gleich, ob der
 * Leerzustand eine Aktion trägt.
 */
function ordneTextquellen(funde: Fund[], verweise: Verweis[]): void {
  for (const f of funde) {
    const d = f.deklaration
    if (f.ort === 'sonst' && d !== null && verweise.some((v) => v.name === d.name && v.pfad.join('.') === d.pfad.join('.'))) f.ort = 'textquelle'
  }
}

// ── Ausnahmen ────────────────────────────────────────────────────────────────

/**
 * Wo „noch kein…“ kein Leerzustand einer Liste oder Karte ist — je Text mit Grund, ohne
 * Zeilennummer (im Sammel-PR verschieben andere Nummern die Zeilen). `text` ist der ganze Text
 * (genau gleich, Leerraum zusammengezogen) oder ein Muster.
 */
type Ausnahme = { datei: string; text: string | RegExp; art: 'B' | 'C'; grund: string }
const AUSNAHMEN: Ausnahme[] = [
  // B — eine einzelne Zeile in einer Karte oder Liste, ohne Aktion, mit nur einer Fassung
  { datei: 'src/lib/heute.ts', text: 'Noch keine Bestellungen', art: 'B', grund: 'Zeile unter dem Abholfenster in der Karte „Nächste Abholung“; HEUTE_KEINE_BESTELLUNGEN ist ihre einzige Fassung' },
  { datei: 'src/lib/pickup-slot-rules.ts', text: 'Noch keine — erst dann können Kundinnen bestellen', art: 'B', grund: 'Wert der Zeile „Abholzeiten“ in Mein Hof und in den Einstellungen; die Zeile ist selbst der Link zu den Abholzeiten' },
  { datei: 'src/lib/hofseite-fortschritt.ts', text: 'Noch kein Text', art: 'B', grund: 'Wert der Zeile „Über uns“ in der Liste der Hofseite; die Zeile ist selbst der Link' },
  { datei: 'src/lib/hofseite-fortschritt.ts', text: 'Noch keine Fotos', art: 'B', grund: 'Wert der Zeile „Fotos“ in der Liste der Hofseite; die Zeile ist selbst der Link' },
  { datei: 'src/lib/hofseite-fortschritt.ts', text: /noch kein Leitspruch$/, art: 'B', grund: 'Wert der Zeile „Leitspruch“ in der Liste der Hofseite (Gründungsjahr da, Spruch nicht); die Zeile ist selbst der Link' },
  { datei: 'src/lib/farm-aktivitaet.ts', text: 'Noch keine Inhalte', art: 'B', grund: 'Zeile „Aktivität“ eines Hofs in der Hofliste im Admin; eine Zeile in einer Tabelle, kein Weg nötig' },
  // C — kein Leerzustand
  { datei: 'src/components/products/product-dialog.tsx', text: 'Noch keine Kategorie', art: 'C', grund: 'Zusammenfassung unter dem zugeklappten Abschnittstitel im Produktdialog, kein Leerzustand' },
  { datei: 'src/components/products/product-dialog.tsx', text: 'Noch keine hinterlegt.', art: 'C', grund: 'Feldwert der „Betriebsnummer“, kein Leerzustand; der Link „In den Hof-Einstellungen ändern“ steht direkt darunter' },
  { datei: 'src/lib/umsatz.ts', text: /^Noch keine? (Vorwoche|Vormonat|Vorjahr) zum Vergleich$/, art: 'C', grund: 'Vergleichssatz unter der Umsatzsumme: ein Wert, keine leere Liste' },
  { datei: 'src/lib/heute.ts', text: 'Noch kein Beitrag — erzähl deinen Kundinnen, was es gibt', art: 'C', grund: 'Eintrag in „Braucht dich“: eine Aufgabe, die selbst zum neuen Beitrag führt' },
  { datei: 'src/lib/heute.ts', text: /noch kein Umsatz$/, art: 'C', grund: 'Vergleichssatz unter der Wochensumme: ein Wert, keine leere Liste' },
  { datei: 'src/lib/einrichten.ts', text: 'noch keins', art: 'C', grund: 'Kurztext des Schritts „Erste Produkte“ in der Einrichtung (ein Zählwert); der Schritt trägt selbst den Link „Produkt anlegen“' },
  { datei: 'src/lib/futter-registrierung.ts', text: /^Noch keine Größe kann online gehen\./, art: 'C', grund: 'Infosatz zur Futter-Registrierung (was online gehen kann), kein Leerzustand' },
  { datei: 'src/components/auswertung/auswertung-teile.tsx', text: 'noch keine abgeholt', art: 'C', grund: 'Unterzeile der Kennzahl „Bestellungen“: ein Wert, keine leere Liste' },
  { datei: 'src/components/anmelden/hof-anmeldung.tsx', text: 'Noch kein Hof? Registrieren', art: 'C', grund: 'Frage mit Link unter dem Anmeldeformular, kein Leerzustand' },
  { datei: 'src/components/hoefe/hoefe-client.tsx', text: 'Ein Hof hat noch keinen Kartenpunkt – du findest ihn in der Liste.', art: 'C', grund: 'Hinweis unter der Karte (ein Hof fehlt dort); die Liste ist da, kein Leerzustand' },
  { datei: 'src/components/hoefe/hoefe-client.tsx', text: /Höfe haben noch keinen Kartenpunkt/, art: 'C', grund: 'Hinweis unter der Karte (mehrere Höfe fehlen dort); die Liste ist da, kein Leerzustand' },
  { datei: 'src/app/(hof)/status/new/status-new-client.tsx', text: 'Noch keine Abonnenten', art: 'C', grund: 'Zählzeile des Kanals „Per E-Mail an Abonnenten“ (der Schalter bleibt gesperrt), kein Leerzustand' },
  { datei: 'src/emails/order-cancelled.tsx', text: 'Da noch keine Zahlung erfolgt ist, entstehen dir keine Kosten.', art: 'C', grund: 'Satz in der Stornomail, kein Leerzustand' },
  { datei: 'src/components/teilen/teilen-fenster.tsx', text: /^Noch keine Produkte im Shop/, art: 'C', grund: 'Hinweissatz in der Karte des Teilen-Fensters, kein Leerzustand; die Datei gehört zu Nr. 76' },
]

/** Ein EmptyState, für den keine Aktion sinnvoll ist (oder der sie nur manchmal trägt) — je Titel mit Grund. */
type OhneAktion = { datei: string; titel: string; grund: string }
const OHNE_AKTION: OhneAktion[] = [
  {
    datei: 'src/components/admin/hoefe-ansicht.tsx',
    titel: 'Noch kein Hof freigeschaltet',
    grund: 'Freischalten steht direkt darüber in „Warten auf Freischaltung“ (der Satz sagt es); die Liste darunter ist leer, weil noch kein Hof freigeschaltet ist',
  },
  {
    datei: 'src/components/admin/briefkasten-teile.tsx',
    titel: 'WUNSCHLISTE_LEER.titel',
    grund: 'Die gebündelte Wunschliste zählt jeden Wunsch außer Dubletten; ein Wunsch kommt nur von einem Hof oder einer Kundin über „Problem melden“, der Admin kann keinen anlegen',
  },
  {
    datei: 'src/components/admin/briefkasten-teile.tsx',
    titel: 'leer.titel',
    grund: 'Der Ausweg „Offene Meldungen zeigen“ kommt vom Aufrufer und steht nur in der Voreinstellung der Liste; mit einem gewählten Filter gibt es keinen weiteren',
  },
  {
    datei: 'src/components/analytics/umfeld-anzeige.tsx',
    titel: 'Noch keine Höfe zum Vergleichen',
    grund: 'Der Knopf „Umkreis auf … km“ steht nur, solange es einen größeren Umkreis gibt; beim größten bleibt kein Ausweg',
  },
  {
    datei: 'src/components/region/futter-kaufen-ansicht.tsx',
    titel: 'Gerade kein Futter in der Nähe',
    grund: 'Je nach Grund „Alles Futter zeigen“ oder „Umkreis auf … km“; sind beide ausgeschöpft, bleibt kein Ausweg',
  },
  {
    datei: 'src/components/heute/heute-teile.tsx',
    titel: 'HEUTE_NIEMAND',
    grund: 'Mit Abholfenster gibt es in der leeren Packliste nichts zu tun, der Satz nennt die nächste Abholung; nur ohne Abholzeit trägt sie den Knopf „Abholzeiten eintragen“',
  },
]

/**
 * Ein Leerzustand, dessen Text noch im Aufruf selbst steht statt in der Textquelle der Seite (src/lib):
 * Altlast aus der Zeit vor N9, Nacharbeit — jeder Text zieht bei der nächsten Änderung der Seite um. Ein
 * neuer Leerzustand gehört nicht hierher.
 */
const ALTLAST_IM_AUFRUF: Array<{ datei: string; text: string }> = [
  { datei: 'src/app/account/profile/profile-client.tsx', text: 'Du hast noch keine Benachrichtigungen abonniert.' },
  { datei: 'src/components/admin/hoefe-ansicht.tsx', text: 'Noch kein Hof freigeschaltet' },
  { datei: 'src/components/analytics/umfeld-anzeige.tsx', text: 'Noch keine Höfe zum Vergleichen' },
  { datei: 'src/components/hof-bestellungen/bestellungen-ansicht.tsx', text: 'Noch keine Bestellungen' },
  { datei: 'src/components/hof-hilfe/meine-meldungen.tsx', text: 'Noch keine Meldungen' },
  { datei: 'src/components/hof-kunden/kunden-ansicht.tsx', text: 'Noch keine Kunden' },
  { datei: 'src/components/hof-verkaeufe/verkaeufe-ansicht.tsx', text: 'Noch keine Verkäufe' },
  { datei: 'src/components/mein-hof/beitraege-reiter.tsx', text: 'Noch kein Beitrag' },
]

const deckt = (a: Ausnahme, f: Fund): boolean => a.datei === f.datei && (typeof a.text === 'string' ? a.text === f.text : a.text.test(f.text))

// ── Die Suche über ganz src ──────────────────────────────────────────────────

const funde: Fund[] = []
const aufrufe: Aufruf[] = []
const verweise: Verweis[] = []
const inhalt = new Map<string, string>()

beforeAll(() => {
  for (const pfad of quelldateien(join(WURZEL, 'src'))) {
    const text = readFileSync(pfad, 'utf8')
    const datei = relative(WURZEL, pfad).split(sep).join('/')
    inhalt.set(datei, text)
    // Der Vorfilter spart das Parsen der meisten Dateien; er findet nichts, was der Baum nicht auch fände.
    if (!NOCH_KEIN.test(text) && !text.includes('EmptyState')) continue
    const gefunden = untersuche(text, datei)
    funde.push(...gefunden.funde)
    aufrufe.push(...gefunden.aufrufe)
    verweise.push(...gefunden.verweise)
  }
  ordneTextquellen(funde, verweise)
}, 30_000)

describe('Leerzustände — jeder Text „noch kein…“ ist eingeordnet', () => {
  it('steht in einem EmptyState, in der Textquelle eines EmptyState oder mit Grund in AUSNAHMEN', { timeout: 30_000 }, () => {
    const lose = funde.filter((f) => f.ort === 'sonst' && !AUSNAHMEN.some((a) => deckt(a, f)))
    expect(lose.map((f) => `${f.datei}:${f.zeile} „${f.text}“`)).toEqual([])
  })

  it('hat keine veraltete Ausnahme: Jeder Eintrag deckt mindestens eine Fundstelle', () => {
    const ungenutzt = AUSNAHMEN.filter((a) => !funde.some((f) => f.ort === 'sonst' && deckt(a, f)))
    expect(ungenutzt.map((a) => `${a.datei} „${String(a.text)}“`)).toEqual([])
  })

  it('nennt zu jeder Ausnahme einen Grund in ganzen Worten', () => {
    for (const a of AUSNAHMEN) expect(a.grund.split(' ').length, `${a.datei} „${String(a.text)}“`).toBeGreaterThanOrEqual(5)
  })

  it('findet die Leerzustände der Wunschliste, der Produkte, der Abholzeiten und der Verkäufe (die Suche läuft)', () => {
    const eingeordnet = funde.filter((f) => f.ort !== 'sonst').map((f) => f.text)
    expect(eingeordnet).toEqual(
      expect.arrayContaining(['Noch keine Wünsche', 'Noch keine Produkte', 'Noch keine Abholzeiten', 'Noch keine Verkäufe', 'Noch keine Verkäufe in diesem Zeitraum'])
    )
  })

  it('nimmt den Text einer Textquelle nur an, wenn ein EmptyState ihn wirklich nimmt', () => {
    const quellen = funde.filter((f) => f.ort === 'textquelle').map((f) => `${f.deklaration?.name}.${f.deklaration?.pfad.join('.')}`)
    expect(quellen).toEqual(
      expect.arrayContaining(['WUNSCHLISTE_LEER.titel', 'PRODUKTE_LEER.titel', 'ABHOLZEITEN_FEHLEN.titel', 'UMSATZ_LEER.titel', 'WHATSAPP_VERSAND_TEXT.leer.titel'])
    )
  })
})

describe('Leerzustände — der Text steht nicht im Aufruf selbst', () => {
  it('ein EmptyState mit „noch kein…“ im Aufruf steht mit Namen in ALTLAST_IM_AUFRUF', () => {
    const imAufruf = funde.filter((f) => f.ort === 'emptystate' && !ALTLAST_IM_AUFRUF.some((a) => a.datei === f.datei && a.text === f.text))
    expect(imAufruf.map((f) => `${f.datei}:${f.zeile} „${f.text}“`)).toEqual([])
  })

  it('hat keine veraltete Altlast: Jeder Eintrag deckt einen Text im Aufruf', () => {
    const ungenutzt = ALTLAST_IM_AUFRUF.filter((a) => !funde.some((f) => f.ort === 'emptystate' && f.datei === a.datei && f.text === a.text))
    expect(ungenutzt.map((a) => `${a.datei} „${a.text}“`)).toEqual([])
  })
})

describe('Leerzustände — jeder EmptyState hat eine Aktion', () => {
  it('trägt eine Aktion — oder steht mit Grund in OHNE_AKTION', () => {
    expect(aufrufe.length).toBeGreaterThan(20)
    const ohne = aufrufe.filter((a) => !a.hatAktion && !OHNE_AKTION.some((o) => o.datei === a.datei && o.titel === a.titel))
    expect(ohne.map((a) => `${a.datei}:${a.zeile} „${a.titel}“`)).toEqual([])
  })

  it('hat keinen veralteten Eintrag in OHNE_AKTION', () => {
    const ungenutzt = OHNE_AKTION.filter((o) => !aufrufe.some((a) => !a.hatAktion && a.datei === o.datei && a.titel === o.titel))
    expect(ungenutzt.map((o) => `${o.datei} „${o.titel}“`)).toEqual([])
  })
})

describe('Leerzustände — ein Zustand, eine Fassung', () => {
  it('„keine Abholzeiten“ auf Heute und in den Einstellungen kommt aus ABHOLZEITEN_FEHLEN', () => {
    for (const datei of ['src/components/heute/heute-teile.tsx', 'src/components/settings/pickup-slots-client.tsx']) {
      const text = inhalt.get(datei) ?? ''
      expect(text, datei).toContain('ABHOLZEITEN_FEHLEN')
      expect(text, datei).not.toMatch(/Trag deine Abholzeiten|noch keine Abholzeiten|Abholzeiten eintragen/i)
    }
  })

  it('die Zeile „Abholzeiten“ in Mein Hof und in den Einstellungen steht nur einmal im Quelltext', () => {
    const stellen = [...inhalt].filter(([, text]) => text.includes('erst dann können Kundinnen bestellen')).map(([datei]) => datei)
    expect(stellen).toEqual(['src/lib/pickup-slot-rules.ts'])
    for (const datei of ['src/lib/hofseite-fortschritt.ts', 'src/lib/hof-einstellungen.ts']) {
      expect(inhalt.get(datei) ?? '', datei).toContain('ABHOLZEITEN_FEHLEN_ZEILE')
    }
  })
})

describe('Leerzustände — Gegenprobe: die Suche schlägt an', () => {
  const finde = (quelltext: string, datei = 'schnipsel.tsx') => untersuche(quelltext, datei)

  it('meldet einen losen Text als „sonst“, auch über einen Zeilenumbruch hinweg', () => {
    expect(finde('const a = <p>Noch keine Dinge</p>').funde).toMatchObject([{ text: 'Noch keine Dinge', ort: 'sonst' }])
    expect(finde('const a = <p>\n  Noch\n  keine Dinge\n</p>').funde).toMatchObject([{ text: 'Noch keine Dinge', ort: 'sonst' }])
    expect(finde("const a = cond ? 'Noch kein Ding' : 'x'").funde).toMatchObject([{ ort: 'sonst' }])
    expect(finde('const a = `${n} Höfe haben noch keinen Punkt`').funde).toMatchObject([{ ort: 'sonst' }])
  })

  it('erkennt den Text im EmptyState und seine fehlende oder vorhandene Aktion', () => {
    const ohne = finde('const a = <EmptyState symbol={X} titel="Noch keine Dinge" satz="x" />')
    expect(ohne.funde).toMatchObject([{ ort: 'emptystate' }])
    expect(ohne.aufrufe).toMatchObject([{ titel: 'Noch keine Dinge', hatAktion: false }])
    const mit = finde('const a = <EmptyState symbol={X} titel="Noch keine Dinge" aktion={<a href="/x">Los</a>} />')
    expect(mit.aufrufe).toMatchObject([{ titel: 'Noch keine Dinge', hatAktion: true }])
  })

  it('zählt eine Aktion nur, wenn sie immer da ist: undefined, null, false und bedingte Aktionen zählen nicht', () => {
    const aktion = (ausdruck: string) => finde(`const a = <EmptyState titel={LEER.titel} aktion={${ausdruck}} />`).aufrufe[0]?.hatAktion
    expect(aktion('undefined')).toBe(false)
    expect(aktion('null')).toBe(false)
    expect(aktion('false')).toBe(false)
    expect(aktion('(undefined)')).toBe(false)
    expect(aktion('fenster ? undefined : <a href="/x">Los</a>')).toBe(false)
    expect(aktion('fenster ? <a href="/x">Los</a> : null')).toBe(false)
    expect(aktion('hatWeg && <a href="/x">Los</a>')).toBe(false)
    // Immer da: ein Element, beide Zweige mit Element, ein Name oder ein Aufruf.
    expect(aktion('<a href="/x">Los</a>')).toBe(true)
    expect(aktion('fenster ? <a href="/x">Los</a> : <a href="/y">Weg</a>')).toBe(true)
    expect(aktion('neuKnopf()')).toBe(true)
    expect(aktion('knopf')).toBe(true)
    expect(aktion('vorhanden || <a href="/x">Los</a>')).toBe(true)
    expect(finde('const a = <EmptyState titel="x" />').aufrufe[0]?.hatAktion).toBe(false)
  })

  it('erkennt die Textquelle eines EmptyState nur, wenn ein EmptyState sie als titel oder satz nimmt — mit oder ohne Aktion', () => {
    const quelle = "export const LEER = { titel: 'Noch keine Dinge', satz: 'Hier steht noch keine Zeile.' }"
    const verwendung = 'const a = <EmptyState titel={LEER.titel} satz={LEER.satz} />'
    const geordnet = (...dateien: Array<[string, string]>) => {
      const alle = dateien.map(([datei, text]) => untersuche(text, datei))
      const alleFunde = alle.flatMap((x) => x.funde)
      ordneTextquellen(alleFunde, alle.flatMap((x) => x.verweise))
      return alleFunde
    }
    expect(geordnet(['lib.ts', quelle], ['ansicht.tsx', verwendung])).toMatchObject([{ ort: 'textquelle' }, { ort: 'textquelle' }])
    // Ohne Verwendung bleibt der Text lose.
    expect(geordnet(['lib.ts', quelle])).toMatchObject([{ ort: 'sonst' }, { ort: 'sonst' }])
    // Ein anderer Weg derselben Konstante ist keine Quelle.
    expect(geordnet(['lib.ts', quelle], ['ansicht.tsx', 'const a = <EmptyState titel={LEER.titel} />'])).toMatchObject([{ ort: 'textquelle' }, { ort: 'sonst' }])
    // Eine andere Konstante auch nicht.
    expect(geordnet(['lib.ts', quelle], ['ansicht.tsx', 'const a = <EmptyState titel={ANDERE.titel} />'])).toMatchObject([{ ort: 'sonst' }, { ort: 'sonst' }])
    // Umbenannt beim Import trifft dieselbe Konstante, auch über einen längeren Weg.
    const tief = "export const TEXT = { leer: { titel: 'Noch keine Dinge' }, zeile: 'noch keins' }"
    const umbenannt = "import { TEXT as T } from './lib'\nconst a = <EmptyState titel={T.leer.titel} />"
    expect(geordnet(['lib.ts', tief], ['ansicht.tsx', umbenannt])).toMatchObject([{ ort: 'textquelle' }, { ort: 'sonst' }])
    // Ein Text in einer Funktion ist keine Konstante.
    expect(geordnet(['lib.ts', "export const LEER = () => 'Noch keine Dinge'"], ['ansicht.tsx', 'const a = <EmptyState titel={LEER} />'])).toMatchObject([{ ort: 'sonst' }])
    // Ein anderes Feld desselben Objekts ist keine Quelle (so sieht ein Schritt der Einrichtung aus).
    expect(
      geordnet(['lib.ts', "export const S = { titel: 'Dinge', textKurz: 'noch keins' }"], ['ansicht.tsx', 'const a = <EmptyState titel={S.titel} />'])
    ).toMatchObject([{ ort: 'sonst' }])
  })

  it('übergeht Kommentare, Logs und ähnliche Wörter', () => {
    expect(finde('// Noch keine Dinge\n/* noch kein Ding */\nconst a = 1').funde).toEqual([])
    expect(finde("console.warn('Noch keine Dinge')", 'a.ts').funde).toEqual([])
    expect(finde("const a = 'Kein Ding, nochmal keine Dinge'", 'a.ts').funde).toEqual([])
  })
})

/**
 * Leerzustände — Quelltext-Wache (Register N9, docs/ai/DESIGN_SYSTEM.md „Zustände“).
 *
 * Ursache: „Noch keine …“ stand als lose Zeile in Karten, ohne Symbol und ohne Weg weiter,
 * und derselbe Zustand hatte zwei Fassungen (auf Heute „Trag deine Abholzeiten ein …“ neben
 * „Du hast noch keine Abholzeiten eingetragen.“).
 *
 * Beweist (am Syntaxbaum von TypeScript, nicht an Regex über den Rohtext):
 *  - Jeder Text mit „noch kein…“ in einer Zeichenkette, Vorlage oder einem JSX-Text unter src/
 *    steht in einem `<EmptyState>`, in der Textquelle eines EmptyState (ein Objekt mit `titel`
 *    UND `aktion`) oder mit Art und Grund in AUSNAHMEN. Art B: eine einzelne Zeile in einer
 *    Karte oder Liste, die keine Aktion braucht. Art C: kein Leerzustand (Infosatz, Vergleich,
 *    Frage, Mail). Kommentare, Bezeichner und console.* zählen nicht.
 *  - Jede Ausnahme deckt eine Fundstelle; eine veraltete fällt auf.
 *  - Jeder `<EmptyState>` hat eine Aktion, es sei denn, er steht mit Grund in OHNE_AKTION.
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
type Fund = { datei: string; zeile: number; text: string; ort: Ort }
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

function hatEigenschaft(objekt: ts.ObjectLiteralExpression, name: string): boolean {
  return objekt.properties.some((p) => p.name !== undefined && ts.isIdentifier(p.name) && p.name.text === name)
}

/**
 * Wo steht der Text: in einem EmptyState, in der Textquelle eines EmptyState oder lose? Textquelle heißt:
 * Der Text ist der `titel` oder der `satz` eines Objekts, das auch `titel` und `aktion` trägt. Ein anderes
 * Feld desselben Objekts (der Kurztext eines Schritts, `textKurz: 'noch keins'`) ist keine Quelle.
 */
function ortVon(knoten: ts.Node): Ort {
  let eigenschaft: ts.PropertyAssignment | null = null
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (tagName(k) === 'EmptyState') return 'emptystate'
    if (eigenschaft === null && ts.isPropertyAssignment(k)) eigenschaft = k
    if (ts.isObjectLiteralExpression(k) && eigenschaft !== null && eigenschaft.parent === k) {
      const name = ts.isIdentifier(eigenschaft.name) ? eigenschaft.name.text : ''
      if ((name === 'titel' || name === 'satz') && hatEigenschaft(k, 'titel') && hatEigenschaft(k, 'aktion')) return 'textquelle'
      eigenschaft = null
    }
  }
  return 'sonst'
}

/** Alle Texte mit „noch kein…“ und alle EmptyState-Aufrufe einer Datei. */
function untersuche(quelltext: string, datei = 'schnipsel.tsx'): { funde: Fund[]; aufrufe: Aufruf[] } {
  const art = datei.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const quelle = ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, art)
  const zeileVon = (k: ts.Node) => quelle.getLineAndCharacterOfPosition(k.getStart(quelle)).line + 1
  const funde: Fund[] = []
  const aufrufe: Aufruf[] = []
  const besuche = (knoten: ts.Node): void => {
    let roh: string | null = null
    if (ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)) roh = knoten.text
    else if (ts.isTemplateHead(knoten) || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten)) roh = knoten.text
    else if (ts.isJsxText(knoten)) roh = knoten.text
    if (roh !== null && !imLog(knoten)) {
      const text = roh.replace(/\s+/g, ' ').trim()
      if (NOCH_KEIN.test(text)) funde.push({ datei, zeile: zeileVon(knoten), text, ort: ortVon(knoten) })
    }
    if ((ts.isJsxOpeningElement(knoten) || ts.isJsxSelfClosingElement(knoten)) && knoten.tagName.getText() === 'EmptyState') {
      const eigene = knoten.attributes.properties.filter(ts.isJsxAttribute)
      const titel = eigene.find((a) => a.name.getText() === 'titel')?.initializer
      aufrufe.push({
        datei,
        zeile: zeileVon(knoten),
        titel: titel === undefined ? '' : ts.isStringLiteral(titel) ? titel.text : ts.isJsxExpression(titel) ? (titel.expression?.getText() ?? '') : titel.getText(),
        hatAktion: eigene.some((a) => a.name.getText() === 'aktion'),
      })
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(quelle)
  return { funde, aufrufe }
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
  { datei: 'src/lib/produkte-hof.ts', text: 'Noch keine Produkte', art: 'B', grund: 'Kopfzeile der Produktliste; die leere Liste darunter ist ein EmptyState mit „Produkt anlegen“' },
  { datei: 'src/lib/farm-aktivitaet.ts', text: 'Noch keine Inhalte', art: 'B', grund: 'Zeile „Aktivität“ eines Hofs in der Hofliste im Admin; eine Zeile in einer Tabelle, kein Weg nötig' },
  { datei: 'src/components/products/product-dialog.tsx', text: 'Noch keine Kategorie', art: 'B', grund: 'Zeile unter dem zugeklappten Abschnittstitel im Produktdialog (Zusammenfassung)' },
  { datei: 'src/components/products/product-dialog.tsx', text: 'Noch keine hinterlegt.', art: 'B', grund: 'Wert des Felds „Betriebsnummer“; der Link „In den Hof-Einstellungen ändern“ steht direkt darunter' },
  // C — kein Leerzustand
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

/** Ein EmptyState, für den keine Aktion sinnvoll ist — je Titel mit Grund. */
type OhneAktion = { datei: string; titel: string; grund: string }
const OHNE_AKTION: OhneAktion[] = [
  {
    datei: 'src/components/admin/hoefe-ansicht.tsx',
    titel: 'Noch kein Hof freigeschaltet',
    grund: 'Die Hofliste im Admin ist leer, weil sich noch kein Hof angemeldet hat; Höfe legt niemand von dort aus an',
  },
  {
    datei: 'src/components/admin/briefkasten-teile.tsx',
    titel: 'Noch keine Wünsche',
    grund: 'Die gebündelte Wunschliste zählt jeden Wunsch außer Dubletten; ein Wunsch kommt nur von einem Hof oder einer Kundin über „Problem melden“, der Admin kann keinen anlegen',
  },
]

const deckt = (a: Ausnahme, f: Fund): boolean => a.datei === f.datei && (typeof a.text === 'string' ? a.text === f.text : a.text.test(f.text))

// ── Die Suche über ganz src ──────────────────────────────────────────────────

const funde: Fund[] = []
const aufrufe: Aufruf[] = []
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
  }
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

  it('lässt den Leerzustand der Wunschliste, der Abholzeiten und der Verkäufe als EmptyState stehen', () => {
    const imEmptyState = funde.filter((f) => f.ort === 'emptystate').map((f) => f.text)
    expect(imEmptyState).toEqual(expect.arrayContaining(['Noch keine Wünsche', 'Noch keine Produkte', 'Noch keine Verkäufe']))
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
    expect(finde('const a = <EmptyState titel={LEER.titel} aktion={undefined} />').aufrufe).toMatchObject([{ titel: 'LEER.titel', hatAktion: true }])
  })

  it('erkennt die Textquelle eines EmptyState nur als titel oder satz eines Objekts mit titel UND aktion', () => {
    expect(finde("export const LEER = { titel: 'Noch keine Dinge', aktion: 'Los' }", 'a.ts').funde).toMatchObject([{ ort: 'textquelle' }])
    expect(finde("export const LEER = { titel: 'Dinge', satz: 'Noch keine Dinge', aktion: { text: 'Los' } }", 'a.ts').funde).toMatchObject([{ ort: 'textquelle' }])
    expect(finde("export const LEER = { titel: 'Noch keine Dinge' }", 'a.ts').funde).toMatchObject([{ ort: 'sonst' }])
    expect(finde("export const LEER = { satz: 'Noch keine Dinge', aktion: 'Los' }", 'a.ts').funde).toMatchObject([{ ort: 'sonst' }])
    // Ein anderes Feld desselben Objekts ist keine Quelle (so sieht ein Schritt der Einrichtung aus).
    expect(finde("export const S = { titel: 'Dinge', textKurz: 'noch keins', aktion: 'Los' }", 'a.ts').funde).toMatchObject([{ ort: 'sonst' }])
  })

  it('übergeht Kommentare, Logs und ähnliche Wörter', () => {
    expect(finde('// Noch keine Dinge\n/* noch kein Ding */\nconst a = 1').funde).toEqual([])
    expect(finde("console.warn('Noch keine Dinge')", 'a.ts').funde).toEqual([])
    expect(finde("const a = 'Kein Ding, nochmal keine Dinge'", 'a.ts').funde).toEqual([])
  })
})

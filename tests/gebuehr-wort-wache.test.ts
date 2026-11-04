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
 *    AGB 0.9, Nacharbeit einer Datei ohne Nummer) oder in einer Offen-Datei
 *    tests/gebuehr-wort-offen/<nr>.ts der Nummer, der die Datei gehört (Dateigrenzen
 *    Lauf 30). Kommentare, Bezeichner und Server-Logs (console.*) zählen nicht.
 *  - Ein Eintrag ohne Fundstelle fällt auf — in der festen Liste wie in den Offen-Dateien;
 *    ein Offen-Eintrag deckt genau eine Fundstelle (über Datei und Text, nie die Zeile).
 *  - Jede Offen-Datei heißt nach ihrer Nummer und exportiert OFFEN; 221 hat keine.
 *  - Gegenprobe: Die Suche schlägt im String, in der Vorlage, im Attribut und im JSX-Text
 *    an, nicht im Kommentar, nicht im Bezeichner und nicht im console.log.
 *
 * Die Offen-Dateien: Jede Nummer stellt ihre Fundstellen um (über `gebuehrBezeichnungFuer`,
 * `gebuehrWortFuerZeitraum` bzw. die Text-Helfer je Modell in konditionen.ts), leert und
 * löscht nur ihre eigene Datei. Ist eine Fundstelle schon nur im Modell „bisher“ erreichbar,
 * steht sie mit diesem Grund in FESTE_LISTE. Den Rendertest „kein ‚Servicegebühr‘ nach dem
 * Stichtag“ schreibt jede Seiten-Nummer für ihre Seiten; im Sammel-PR ist der Ordner leer.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const WURZEL = process.cwd()
const WORT = /Servicegebühr/

type Fund = { datei: string; zeile: number; text: string }

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Steht der Knoten in einem Aufruf von console.* — ein Server-Log, das niemand in der Oberfläche liest? */
function imLog(knoten: ts.Node): boolean {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (ts.isCallExpression(k) && ts.isPropertyAccessExpression(k.expression) && k.expression.expression.getText() === 'console') return true
  }
  return false
}

/** „Servicegebühr“ in Zeichenketten, Vorlagen, Attributen und JSX-Text — Kommentare, Bezeichner und Logs zählen nicht. */
function findeWort(quelltext: string, datei = 'schnipsel.tsx'): Fund[] {
  const art = datei.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const quelle = ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, art)
  const funde: Fund[] = []
  const besuche = (knoten: ts.Node): void => {
    let roh: string | null = null
    if (ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)) roh = knoten.text
    else if (ts.isTemplateHead(knoten) || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten)) roh = knoten.text
    else if (ts.isJsxText(knoten)) roh = knoten.text
    if (roh !== null && WORT.test(roh) && !imLog(knoten)) {
      const zeile = quelle.getLineAndCharacterOfPosition(knoten.getStart(quelle)).line + 1
      funde.push({ datei, zeile, text: roh.replace(/\s+/g, ' ').trim() })
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(quelle)
  return funde
}

// ── Feste Liste ──────────────────────────────────────────────────────────────

/**
 * Wo „Servicegebühr“ richtig dasteht oder bewusst bleibt — je Datei und Text (ganz gleich
 * oder Muster), mit Grund; ein Eintrag deckt jeden Treffer dieses Texts in der Datei.
 * `text: null` nimmt die ganze Datei (nur Rechtstext, den kein Lauf umschreibt).
 */
type Fest = { datei: string; text: string | RegExp | null; grund: string }

const BISHER = 'nur Modell bisher'
const NACHARBEIT = 'Nacharbeit: Datei ohne Nummer in Lauf 30 (Dateigrenzen) — nach dem Stichtag falsch, Umstellung mit eigenem Auftrag (Bericht 221)'

const FESTE_LISTE: Fest[] = [
  // AGB 0.9 (Register O4) — Wortlaut bleibt, AGB 1.0 ist ein eigener /fix.
  { datei: 'src/lib/rechtstexte/agb.ts', text: null, grund: 'AGB 0.9: Rechtstext, wörtlich aus docs/recht/agb.md (Register O4); AGB 1.0 ist ein eigener /fix' },
  // Die Quellen des Worts im Modell „bisher“
  { datei: 'src/lib/servicegebuehr.ts', text: 'Servicegebühr', grund: `${BISHER}: SERVICEGEBUEHR_BEZEICHNUNG — gebuehrBezeichnungFuer und gebuehrWortFuerZeitraum wählen es nur für das alte Modell` },
  {
    datei: 'src/lib/servicegebuehr.ts',
    text: 'Servicegebühr-Erstattung ausstehend.',
    grund: `${BISHER}: GEBUEHR_ERSTATTUNG_OFFEN_HINWEIS; mit Bestellung gebuehrErstattungOffenHinweisFuer (plattformgebuehr.ts)`,
  },
  // konditionen.ts: die Fassungen „bisher“ der Texte je Modell
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
  { datei: 'src/components/admin/servicegebuehr-dialog.tsx', text: /^Servicegebühr( gespeichert)?$/, grund: `${BISHER}: Dialog des alten Satzes (Farm.serviceFee*, A1); ab dem Stichtag zeigt die Akte den Knopf nicht (Nr. 229)` },
  // Schon bedingt
  { datei: 'src/components/checkout/kasse-teile.tsx', text: 'Was ist die Servicegebühr?', grund: `${BISHER}: Zweig ohne hofpreis (hofpreis ? Plattformgebühr : Servicegebühr)` },
  {
    datei: 'src/emails/artikel-fehlt.tsx',
    text: /^Die \$\{p\.gebuehrWort \?\? 'Servicegebühr'\}|^Servicegebühr$/,
    grund: `${BISHER}: Rückfall nur ohne gebuehrWort im Auftrag; email.ts setzt es aus der Bestellung`,
  },
  { datei: 'src/emails/new-order-notification.tsx', text: 'Servicegebühr', grund: `${BISHER}: Rückfall nur ohne gebuehrWort im Auftrag; email.ts setzt es aus der Bestellung` },
  { datei: 'src/emails/order-confirmed.tsx', text: 'Servicegebühr', grund: `${BISHER}: Rückfall nur ohne gebuehrWort im Auftrag; email.ts setzt es aus der Bestellung` },
  // Nur Entwicklung
  {
    datei: 'src/app/intern/bausteine/bausteine-vorschau.tsx',
    text: /Servicegebühr/,
    grund: 'Vorschau unter /intern/bausteine (nur Entwicklung) mit Beispielwerten der Fassung „bisher“ von KaufZusammenfassung (Nr. 219)',
  },
  // Dateien ohne Nummer in Lauf 30
  { datei: 'src/lib/fuer-hoefe.ts', text: /Servicegebühr/, grund: `${NACHARBEIT}: Vorteile und Fragen auf /fuer-hoefe (src/lib/fuer-hoefe.ts gehört keiner Nummer, Nr. 226 hat nur die Seite)` },
  { datei: 'src/lib/geld-abgleich.ts', text: 'Servicegebühr', grund: `${NACHARBEIT}: ABWEICHUNG_FELD_TEXT im Geld-Abgleich (Admin › Heute, Braucht dich)` },
  { datei: 'src/lib/wochenlage.ts', text: 'Servicegebühr', grund: `${NACHARBEIT}: Wochenlage-Mail an den Betrieb` },
  { datei: 'src/lib/kasse.ts', text: '+ Servicegebühr', grund: `${NACHARBEIT}: SERVICEGEBUEHR_ZUSATZ, ungenutzt (kein Import unter src/); kasse.ts gehört 221 nur für mindestbestellwertGrund` },
  { datei: 'src/lib/startseite.ts', text: /% Servicegebühr, mindestens$/, grund: `${NACHARBEIT}: Frage „Wie bezahle ich?“ (STARTSEITE_FRAGEN); startseite.ts gehört 221 nur für beispielRechnung` },
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

// ── Prüfungen ────────────────────────────────────────────────────────────────

describe('Gebühren-Wort: „Servicegebühr“ nur mit Bedingung', () => {
  let funde: Fund[] = []
  // Liest und parst jede Datei unter src/ (Syntaxbaum): kalt mehrere Sekunden, darum ein eigenes Limit nur hier.
  beforeAll(() => {
    funde = [...quelldateien(join(WURZEL, 'src'))].flatMap((pfad) => findeWort(readFileSync(pfad, 'utf8'), posix(relative(WURZEL, pfad))))
  }, 30_000)

  it('findet überhaupt etwas (sonst bewiese ein leerer Fund nichts)', () => {
    expect(funde.length).toBeGreaterThan(10)
  })

  it('jede Fundstelle steht in der festen Liste oder in genau einer Offen-Datei', () => {
    const ohneFest = funde.filter((f) => !FESTE_LISTE.some((e) => deckt(e, f)))
    const { rest } = gleicheAb(ohneFest, OFFEN)
    expect(rest.map((f) => `${f.datei}:${f.zeile} „${f.text.slice(0, 80)}“`)).toEqual([])
  })

  it('kein Eintrag ohne Fundstelle — weder in der festen Liste noch in den Offen-Dateien', () => {
    const fest = FESTE_LISTE.filter((e) => !funde.some((f) => deckt(e, f))).map((e) => `${e.datei} ${String(e.text)}`)
    expect(fest).toEqual([])
    const ohneFest = funde.filter((f) => !FESTE_LISTE.some((e) => deckt(e, f)))
    const { ungenutzt } = gleicheAb(ohneFest, OFFEN)
    expect(ungenutzt.map((e) => `${e.nummer}: ${e.stelle} „${e.text}“`)).toEqual([])
  })

  it('jede feste Fundstelle hat einen Grund', () => {
    for (const e of FESTE_LISTE) expect(e.grund.length, e.datei).toBeGreaterThan(10)
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
      { datei: 'src/x.ts', zeile: 1, text: 'Die Servicegebühr erstattet Agrilo.' },
      { datei: 'src/x.ts', zeile: 9, text: 'Die Servicegebühr erstattet Agrilo.' },
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

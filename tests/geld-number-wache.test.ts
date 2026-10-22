/**
 * Geld-Number-Wache (Nr. 139, Inventur 6 aus Morgenbericht 20 §3, freigegeben 21.10.2026; Register G4, Ergänzung).
 * Die Regel steht in CLAUDE.md §2 und CODING_STANDARDS §2 „Geld": Geld wird nicht in `number` gerechnet, wo `Decimal`
 * gespeichert ist; in reinen Funktionen rechnet es in ganzen Cent, die Servergrenze wandelt über Decimal-Methoden.
 *
 * Ursache: Die Regel hatte keine Prüfung. Die Inventur fand per Suchbefehl drei Stellen mit `Number()` auf einem
 * Geldwert; alle drei sind Anzeige (Nr. 139, Bericht: Weg der Zahl bis zum Ende, Beleg je Stelle). Ein vierter, neuer
 * Weg — etwa `Number(order.totalAmount) * 1.049` — bliebe sonst unbemerkt.
 *
 * Beweist (Quelltext von `src/`, TypeScript-Syntaxbaum, kein Netz): Jeder Aufruf `Number(<Ausdruck>)`, dessen LETZTER
 * Name im Ausdruck nach Geld klingt, steht nur an einer Stelle aus GELD_NUMBER_BESTAND — je Eintrag Datei, Ausdruck und
 * Grund. Geldnamen sind die Wortstämme price, amount, total, fee, betrag, preis, cents (groß und klein), aber nicht
 * `percent`/`prozent` (`serviceFeePercent` ist ein Satz, kein Betrag). Der letzte Name: `p.price` → `price`,
 * `item.totalPrice` → `totalPrice`, `betrag.toString()` → `betrag` (Wert-Methoden wie `toString`, `toFixed`, `toNumber`
 * zählen nicht als Name), `preise[i]` → `preise`, `zeile['price']` → `price`; bei `+ - * /`, `?:`, `??` und `||` zählt
 * jeder Teil. Kommentare und Texte zählen nicht (Syntaxbaum). Der Bestand schrumpft: Ein Eintrag, der im Code nicht mehr
 * vorkommt, macht die Wache rot (veraltet), wie in `tests/paket-mock-wache.test.ts`.
 *
 * GRENZE: Die Wache sieht nur Namen. Eine Zahl mit neutralem Namen (`zahlOderNull`, `wert`, `x`, ein Rückgabewert einer
 * Hilfsfunktion) findet sie nicht, ebenso wenig `parseFloat`, `+wert`, `Decimal#toNumber()` oder eine Rechnung mit
 * `price * quantity` ohne `Number()`. Verbindlich bleibt CODING_STANDARDS §2 (Decimal für Geld, ganze Cent in reinen
 * Funktionen, Int-Cent an Stripe); die Wache fängt nur den häufigsten Fehlgriff.
 *
 * Gegenprobe (Quelltext im Speicher, keine Datei im Repository wird verändert): Eine neue Datei mit
 * `Number(order.totalAmount)` und ein aus dem Bestand entfernter Eintrag machen die Wache rot; ein Eintrag, dessen Stelle
 * im Code fehlt, ebenfalls (veraltet). Die Erkennung schlägt bei allen Schreibweisen oben an und bei Satz, Kommentar,
 * Text, `Number.isFinite` und `z.number` nicht.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const ORDNER = join(WURZEL, 'src')

/** Wortstämme, die einen Geldwert benennen. */
const GELD_STAMM = /price|amount|total|fee|betrag|preis|cents/i
/** Ein Satz in Prozent ist kein Betrag, auch wenn `fee` im Namen steht. */
const KEIN_GELD = /percent|prozent/i
/** Methoden, die nur den Wert in eine andere Form bringen: Der Name davor ist der Name des Werts. */
const WERT_METHODEN = new Set(['toString', 'toFixed', 'toPrecision', 'valueOf', 'toNumber', 'toDecimalPlaces'])

interface BestandEintrag {
  /** Pfad ab der Wurzel des Repositories, mit `/`. */
  datei: string
  /** Der Ausdruck in `Number(…)`, Leerraum auf ein Leerzeichen gekürzt. */
  ausdruck: string
  grund: string
}

/**
 * Stellen unter `src/`, an denen `Number()` einen Geldwert in eine Zahl wandelt. Alle drei sind Anzeige: Die Kasse
 * nimmt den Preis aus dem Korb nur zum Abgleich auf den Cent über Decimal (`preisAbweichungen`, order-totals.ts) und
 * rechnet danach nur mit dem Preis aus der Datenbank (api/checkout/route.ts). Nur schrumpfen.
 */
const GELD_NUMBER_BESTAND: readonly BestandEintrag[] = [
  {
    datei: 'src/app/(hof)/status/new/page.tsx',
    ausdruck: 'p.price',
    grund:
      'nur Anzeige; Kasse rechnet mit Decimal aus der Datenbank. Der Preis geht an StatusNewClient und dort nur an formatEuro (Produkt-Knöpfe, Vorschau); an die Action gehen nur die Produkt-IDs',
  },
  {
    datei: 'src/app/(public)/[farmSlug]/bestaetigen/[token]/page.tsx',
    ausdruck: 'item.totalPrice',
    grund:
      'nur Anzeige; Kasse rechnet mit Decimal aus der Datenbank. Gespeicherte Zeilensumme der Bestellung, nur an formatEuro; Gebühr und Summe der Seite kommen aus Cent (bestellSummen)',
  },
  {
    datei: 'src/lib/produkt-dto.ts',
    ausdruck: 'p.price',
    grund:
      'nur Anzeige; Kasse rechnet mit Decimal aus der Datenbank. Servergrenze Decimal → Zahl für Client-Komponenten (Korb-Anzeige, Preiszeilen, Formular-Vorbelegung); die Kasse gleicht den Preis aus dem Korb nur auf den Cent über Decimal ab (preisAbweichungen) und rechnet danach mit dem Preis aus der Datenbank',
  },
]

interface Fund {
  datei: string
  zeile: number
  ausdruck: string
}

function ohneHuelle(ausdruck: ts.Expression): ts.Expression {
  let k = ausdruck
  while (ts.isParenthesizedExpression(k) || ts.isAsExpression(k) || ts.isSatisfiesExpression(k) || ts.isNonNullExpression(k) || ts.isTypeAssertionExpression(k)) {
    k = k.expression
  }
  return k
}

/** Die letzten Namen eines Ausdrucks: einer je Zugriffskette, bei Rechnung und Auswahl einer je Teil. */
function endnamen(ausdruck: ts.Expression): string[] {
  const k = ohneHuelle(ausdruck)
  if (ts.isIdentifier(k)) return [k.text]
  if (ts.isPropertyAccessExpression(k)) return [k.name.text]
  if (ts.isElementAccessExpression(k)) {
    const index = k.argumentExpression
    return ts.isStringLiteralLike(index) ? [index.text] : endnamen(k.expression)
  }
  if (ts.isCallExpression(k)) {
    const ziel = ohneHuelle(k.expression)
    if (ts.isPropertyAccessExpression(ziel)) return WERT_METHODEN.has(ziel.name.text) ? endnamen(ziel.expression) : [ziel.name.text]
    return endnamen(ziel)
  }
  if (ts.isBinaryExpression(k)) return [...endnamen(k.left), ...endnamen(k.right)]
  if (ts.isConditionalExpression(k)) return [...endnamen(k.whenTrue), ...endnamen(k.whenFalse)]
  if (ts.isPrefixUnaryExpression(k)) return endnamen(k.operand)
  return []
}

function klingtNachGeld(name: string): boolean {
  return GELD_STAMM.test(name) && !KEIN_GELD.test(name)
}

/** Alle `Number(<Geldname>)` eines Quelltexts, mit Zeile und Ausdruck. */
function geldNumberFunde(quelltext: string, datei = 'schnipsel.ts'): Fund[] {
  const art = datei.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, art)
  const funde: Fund[] = []
  function besuche(k: ts.Node): void {
    if (ts.isCallExpression(k) && ts.isIdentifier(k.expression) && k.expression.text === 'Number' && k.arguments.length > 0) {
      const argument = k.arguments[0]
      if (endnamen(argument).some(klingtNachGeld)) {
        funde.push({
          datei,
          zeile: sf.getLineAndCharacterOfPosition(k.getStart(sf)).line + 1,
          ausdruck: argument.getText(sf).replace(/\s+/g, ' ').trim(),
        })
      }
    }
    ts.forEachChild(k, besuche)
  }
  besuche(sf)
  return funde
}

/** Neue Funde (nicht im Bestand) und veraltete Einträge (Stelle fehlt im Code), je als lesbare Zeile. */
function pruefeGeldNumber(
  quellen: ReadonlyMap<string, string>,
  bestand: readonly BestandEintrag[] = GELD_NUMBER_BESTAND,
): { neu: string[]; veraltet: string[] } {
  const funde = [...quellen].flatMap(([datei, text]) => geldNumberFunde(text, datei))
  const gleich = (f: Fund, b: BestandEintrag): boolean => f.datei === b.datei && f.ausdruck === b.ausdruck
  return {
    neu: funde.filter((f) => !bestand.some((b) => gleich(f, b))).map((f) => `${f.datei}:${f.zeile} Number(${f.ausdruck})`),
    veraltet: bestand.filter((b) => !funde.some((f) => gleich(f, b))).map((b) => `${b.datei} Number(${b.ausdruck})`),
  }
}

function dateienUnter(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? dateienUnter(join(ordner, e.name)) : /\.tsx?$/.test(e.name) ? [join(ordner, e.name)] : [],
  )
}

let quellenSpeicher: ReadonlyMap<string, string> | null = null

/** Alle Quelldateien unter `src/` (Pfad mit `/` → Text), einmal gelesen. */
function quellenAusSrc(): ReadonlyMap<string, string> {
  quellenSpeicher ??= new Map(dateienUnter(ORDNER).map((pfad) => [relative(WURZEL, pfad).split(sep).join('/'), readFileSync(pfad, 'utf8')]))
  return quellenSpeicher
}

describe('Geld-Number-Wache — nie Number() auf einen Geldwert, wo er nicht Anzeige ist (Nr. 139)', () => {
  it('Number() auf einen Geldnamen steht in src/ nur an den Stellen aus dem Bestand', () => {
    const { neu, veraltet } = pruefeGeldNumber(quellenAusSrc())
    expect(
      neu,
      'Geld rechnet in ganzen Cent über Decimal (CODING_STANDARDS §2). Ist die Zahl nur Anzeige: Stelle mit Grund in GELD_NUMBER_BESTAND aufnehmen',
    ).toEqual([])
    expect(veraltet, 'GELD_NUMBER_BESTAND: Die Stelle gibt es nicht mehr, Eintrag streichen').toEqual([])
    for (const { grund } of GELD_NUMBER_BESTAND) expect(grund.length).toBeGreaterThan(40)
  }, 30_000)
})

describe('Geld-Number-Wache — Gegenprobe am echten Bestand', () => {
  it('schlägt an, wenn eine neue Datei Number(order.totalAmount) schreibt', () => {
    const quellen = new Map(quellenAusSrc())
    quellen.set('src/lib/neue-rechnung.ts', 'export const gesamt = Number(order.totalAmount) * 1.049\n')
    expect(pruefeGeldNumber(quellen).neu).toEqual(['src/lib/neue-rechnung.ts:1 Number(order.totalAmount)'])
  }, 30_000)

  it('schlägt an, wenn ein Eintrag aus dem Bestand entfernt ist', () => {
    for (const eintrag of GELD_NUMBER_BESTAND) {
      const ohne = GELD_NUMBER_BESTAND.filter((b) => b !== eintrag)
      const { neu } = pruefeGeldNumber(quellenAusSrc(), ohne)
      expect(neu, eintrag.datei).toEqual([expect.stringContaining(`${eintrag.datei}:`)])
    }
  }, 30_000)

  it('schlägt als veraltet an, wenn die Stelle im Code fehlt oder ein Eintrag erfunden ist', () => {
    for (const eintrag of GELD_NUMBER_BESTAND) {
      const quellen = new Map(quellenAusSrc())
      quellen.set(eintrag.datei, quellen.get(eintrag.datei)!.replaceAll(`Number(${eintrag.ausdruck})`, eintrag.ausdruck))
      expect(pruefeGeldNumber(quellen).veraltet, eintrag.datei).toEqual([`${eintrag.datei} Number(${eintrag.ausdruck})`])
    }
    const erfunden = [...GELD_NUMBER_BESTAND, { datei: 'src/lib/gibt-es-nicht.ts', ausdruck: 'x.price', grund: 'erfunden für die Gegenprobe, keine Stelle im Code' }]
    expect(pruefeGeldNumber(quellenAusSrc(), erfunden).veraltet).toEqual(['src/lib/gibt-es-nicht.ts Number(x.price)'])
  }, 30_000)
})

describe('Geld-Number-Wache — Gegenprobe an Quelltext im Speicher: die Erkennung', () => {
  it('schlägt bei jedem Geldnamen an, groß und klein geschrieben', () => {
    for (const text of [
      'Number(order.totalAmount)',
      'Number(item.totalPrice)',
      'Number(p.price)',
      'Number(produkt.preis)',
      'Number(zeile.betrag)',
      'Number(zeile.serviceFeeCents)',
      'Number(PREIS)',
      'Number(fee)',
      'Number(x.AMOUNT)',
    ]) {
      expect(geldNumberFunde(text), text).toHaveLength(1)
    }
  })

  it('folgt dem letzten Namen: Wert-Methoden, Index, Klammern, Rechnung, Auswahl, Hülle', () => {
    for (const text of [
      'Number(order.totalAmount.toString())',
      'Number(p.price.toFixed(2))',
      'Number(p.price!)',
      'Number((p.price as unknown as string))',
      "Number(zeile['price'])",
      'Number(preise[i])',
      'Number(p.price * 100)',
      'Number(menge * p.price)',
      'Number(a ? b.preis : c.name)',
      'Number(p.rabatt ?? p.price)',
      'Number(berechnePreis(x))',
      'Number(p?.price)',
    ]) {
      expect(geldNumberFunde(text), text).toHaveLength(1)
    }
  })

  it('erkennt den Aufruf auch in TSX und nennt Zeile und Ausdruck', () => {
    const text = 'const a = 1\n\nconst b = <span>{formatEuro(Number(item.totalPrice))}</span>'
    expect(geldNumberFunde(text, 'src/x.tsx')).toEqual([{ datei: 'src/x.tsx', zeile: 3, ausdruck: 'item.totalPrice' }])
    expect(geldNumberFunde('Number(\n  p.price,\n)')[0]?.ausdruck).toBe('p.price')
  })

  it('lässt Sätze, Mengen, Zähler und andere Wege durch', () => {
    for (const text of [
      'Number(farm.serviceFeePercent)',
      'Number(hof.serviceFeePercent.toString())',
      'Number(platformFeePercent)',
      'Number(preise.length)',
      'Number(unitSize)',
      'Number(futter.nettoMenge)',
      'Number(x.vatRate)',
      'Number(zeile.id)',
      'Number()',
      'Number.isFinite(price)',
      'Number.parseFloat(p.price)',
      "z.number({ message: 'Bitte gib einen Betrag ein.' })",
      'parseFloat(p.price)',
      'String(p.price)',
    ]) {
      expect(geldNumberFunde(text), text).toEqual([])
    }
  })

  it('zählt Kommentare und Texte nicht', () => {
    for (const text of [
      '// Number(order.totalAmount) gibt Rundungsfehler\nconst a = 1',
      '/* Number(p.price) */',
      "const hinweis = 'Number(p.price)'",
      'const hinweis = `Number(p.price)`',
    ]) {
      expect(geldNumberFunde(text), text).toEqual([])
    }
  })
})

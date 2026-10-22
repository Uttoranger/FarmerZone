/**
 * Geld-Number-Wache (Nr. 139, Inventur 6 aus Morgenbericht 20 §3, freigegeben 21.10.2026; Register G4, Ergänzung).
 * Die Regel steht in CLAUDE.md §2 und CODING_STANDARDS §2 „Geld": Geld wird nicht in `number` gerechnet, wo `Decimal`
 * gespeichert ist; in reinen Funktionen rechnet es in ganzen Cent, die Servergrenze wandelt über Decimal-Methoden.
 *
 * Ursache: Die Regel hatte keine Prüfung. Die Inventur fand per Suchbefehl drei Stellen mit `Number()` auf einem
 * Geldwert (Nr. 139, Bericht: Weg der Zahl bis zum Ende). Zwei sind Anzeige. Die dritte (`produkt-dto.ts`) ist Anzeige
 * und Vorbelegung des Preisfelds im Formular der Höfe; die Paketpreis-Hilfe dort rechnet seit dem Fix aus Nr. 139 in
 * ganzen Cent über Decimal. Ein vierter, neuer Weg — etwa `Number(order.totalAmount) * 1.049` — bliebe sonst
 * unbemerkt. Geld × Nicht-Zahl ohne `Number()` (der Fehler der Paketpreis-Hilfe) prüft
 * `tests/geld-fliesskomma-wache.test.ts`.
 *
 * Beweist (Quelltext von `src/`, TypeScript-Syntaxbaum, kein Netz): Jeder Aufruf `Number(<Ausdruck>)`, dessen LETZTER
 * Name im Ausdruck nach Geld klingt, steht nur an einer Stelle aus GELD_NUMBER_BESTAND — je Eintrag Datei, Ausdruck,
 * Anzahl und Grund (ein zweiter Aufruf derselben Art in derselben Datei ist eine neue Stelle). Geldnamen und der letzte
 * Name stehen in `tests/geld-namen.ts`: die Wortstämme price, amount, total, fee, betrag, preis, cents (groß und klein), aber nicht
 * `percent`/`prozent` (`serviceFeePercent` ist ein Satz, kein Betrag). Der letzte Name: `p.price` → `price`,
 * `item.totalPrice` → `totalPrice`, `betrag.toString()` → `betrag` (Wert-Methoden wie `toString`, `toFixed`, `toNumber`
 * zählen nicht als Name), `preise[i]` → `preise`, `zeile['price']` → `price`; bei `+ - * /`, `?:`, `??` und `||` zählt
 * jeder Teil. Kommentare und Texte zählen nicht (Syntaxbaum). Der Bestand schrumpft: Ein Eintrag, der im Code nicht mehr
 * vorkommt, macht die Wache rot (veraltet), wie in `tests/paket-mock-wache.test.ts`.
 *
 * GRENZE: Die Wache sieht nur Namen. Eine Zahl mit neutralem Namen (`zahlOderNull`, `wert`, `x`, ein Rückgabewert einer
 * Hilfsfunktion) findet sie nicht, ebenso wenig `parseFloat`, `+wert`, `Decimal#toNumber()` oder eine Rechnung mit
 * `price * quantity` ohne `Number()` (die meldet `tests/geld-fliesskomma-wache.test.ts`). Verbindlich bleibt CODING_STANDARDS §2 (Decimal für Geld, ganze Cent in reinen
 * Funktionen, Int-Cent an Stripe); die Wache fängt nur den häufigsten Fehlgriff.
 *
 * Gegenprobe (Quelltext im Speicher, keine Datei im Repository wird verändert): Eine neue Datei mit
 * `Number(order.totalAmount)`, ein aus dem Bestand entfernter Eintrag und ein zweiter Aufruf in einer Bestandsdatei
 * machen die Wache rot; ein Eintrag, dessen Stelle im Code fehlt, ebenfalls (veraltet). Die Erkennung schlägt bei allen Schreibweisen oben an und bei Satz, Kommentar,
 * Text, `Number.isFinite` und `z.number` nicht.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { endnamen, klingtNachGeld } from './geld-namen'

const WURZEL = process.cwd()
const ORDNER = join(WURZEL, 'src')

interface BestandEintrag {
  /** Pfad ab der Wurzel des Repositories, mit `/`. */
  datei: string
  /** Der Ausdruck in `Number(…)`, Leerraum auf ein Leerzeichen gekürzt. */
  ausdruck: string
  /** Wie oft der Ausdruck in der Datei vorkommt; ein zweiter Aufruf ist eine neue Stelle und muss eigens begründet werden. */
  anzahl: number
  grund: string
}

/**
 * Stellen unter `src/`, an denen `Number()` einen Geldwert in eine Zahl wandelt. Die Kasse nimmt den Preis aus dem Korb
 * nur zum Abgleich auf den Cent über Decimal (`preisAbweichungen`, order-totals.ts) und rechnet danach nur mit dem
 * Preis aus der Datenbank (api/checkout/route.ts). Zwei Stellen sind nur Anzeige, `produkt-dto.ts` ist Anzeige und
 * Vorbelegung des Preisfelds. Nur schrumpfen.
 */
const GELD_NUMBER_BESTAND: readonly BestandEintrag[] = [
  {
    datei: 'src/app/(hof)/status/new/page.tsx',
    ausdruck: 'p.price',
    anzahl: 1,
    grund:
      'nur Anzeige; Kasse rechnet mit Decimal aus der Datenbank. Der Preis geht an StatusNewClient und dort nur an formatEuro (Produkt-Knöpfe, Vorschau); an die Action gehen nur die Produkt-IDs',
  },
  {
    datei: 'src/app/(public)/[farmSlug]/bestaetigen/[token]/page.tsx',
    ausdruck: 'item.totalPrice',
    anzahl: 1,
    grund:
      'nur Anzeige; Kasse rechnet mit Decimal aus der Datenbank. Gespeicherte Zeilensumme der Bestellung, nur an formatEuro; Gebühr und Summe der Seite kommen aus Cent (bestellSummen)',
  },
  {
    datei: 'src/lib/produkt-dto.ts',
    ausdruck: 'p.price',
    anzahl: 1,
    grund:
      'Anzeige und Vorbelegung des Preisfelds im Formular der Höfe (Decimal(10,2) → Zahl → Feld ist verlustfrei). Zur Kasse geht der Korb-Preis nur zum Abgleich auf den Cent über Decimal (preisAbweichungen); die Kasse rechnet mit dem Preis aus der Datenbank. Die Paketpreis-Hilfe im Formular rechnet seit dem Fix aus Nr. 139 in ganzen Cent über Decimal (calcLineTotal → decimalZuCents)',
  },
]

interface Fund {
  datei: string
  zeile: number
  ausdruck: string
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

/** Neue Funde (nicht im Bestand oder über die eingetragene Anzahl hinaus) und veraltete Einträge, je als lesbare Zeile. */
function pruefeGeldNumber(
  quellen: ReadonlyMap<string, string>,
  bestand: readonly BestandEintrag[] = GELD_NUMBER_BESTAND,
): { neu: string[]; veraltet: string[] } {
  const funde = [...quellen].flatMap(([datei, text]) => geldNumberFunde(text, datei))
  const schluessel = (datei: string, ausdruck: string): string => `${datei}\u0000${ausdruck}`
  const eingetragen = new Map(bestand.map((b) => [schluessel(b.datei, b.ausdruck), b]))
  const gezaehlt = new Map<string, number>()
  const neu: string[] = []
  for (const f of funde) {
    const key = schluessel(f.datei, f.ausdruck)
    const nr = (gezaehlt.get(key) ?? 0) + 1
    gezaehlt.set(key, nr)
    if (nr > (eingetragen.get(key)?.anzahl ?? 0)) neu.push(`${f.datei}:${f.zeile} Number(${f.ausdruck})`)
  }
  const veraltet = bestand.flatMap((b) => {
    const n = gezaehlt.get(schluessel(b.datei, b.ausdruck)) ?? 0
    if (n === 0) return [`${b.datei} Number(${b.ausdruck})`]
    return n < b.anzahl ? [`${b.datei} Number(${b.ausdruck}) (${n} von ${b.anzahl})`] : []
  })
  return { neu, veraltet }
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

  it('schlägt an, wenn eine Stelle aus dem Bestand ein zweites Mal vorkommt (Anzahl je Eintrag)', () => {
    for (const eintrag of GELD_NUMBER_BESTAND) {
      const quellen = new Map(quellenAusSrc())
      const text = quellen.get(eintrag.datei)
      expect(text, `${eintrag.datei} muss unter src/ liegen`).toBeDefined()
      quellen.set(eintrag.datei, `${text ?? ''}\nexport const zweiteStelle = Number(${eintrag.ausdruck}) * 2\n`)
      expect(pruefeGeldNumber(quellen).neu, eintrag.datei).toEqual([expect.stringContaining(`${eintrag.datei}:`)])
    }
  }, 30_000)

  it('schlägt als veraltet an, wenn von zwei eingetragenen Stellen eine fehlt', () => {
    const doppelt = GELD_NUMBER_BESTAND.map((b) => ({ ...b, anzahl: b.anzahl + 1 }))
    expect(pruefeGeldNumber(quellenAusSrc(), doppelt).veraltet).toHaveLength(GELD_NUMBER_BESTAND.length)
  }, 30_000)

  it('schlägt als veraltet an, wenn die Stelle im Code fehlt oder ein Eintrag erfunden ist', () => {
    for (const eintrag of GELD_NUMBER_BESTAND) {
      const quellen = new Map(quellenAusSrc())
      const text = quellen.get(eintrag.datei)
      expect(text, `${eintrag.datei} muss unter src/ liegen`).toBeDefined()
      quellen.set(eintrag.datei, (text ?? '').replaceAll(`Number(${eintrag.ausdruck})`, eintrag.ausdruck))
      expect(pruefeGeldNumber(quellen).veraltet, eintrag.datei).toEqual([`${eintrag.datei} Number(${eintrag.ausdruck})`])
    }
    const erfunden = [...GELD_NUMBER_BESTAND, { datei: 'src/lib/gibt-es-nicht.ts', ausdruck: 'x.price', anzahl: 1, grund: 'erfunden für die Gegenprobe, keine Stelle im Code' }]
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

/**
 * Geld-Fließkomma-Wache (Regelvorschlag 139 aus Morgenbericht 21 §5, freigegeben 22.10.2026; Register G4, Ergänzung).
 * Die Regel steht in CODING_STANDARDS §2 „Geld": Auch reine Anzeige im Browser rechnet in Cent über
 * `calcLineTotal` → `decimalZuCents`, nie `price * quantity`.
 *
 * Ursache: Die Paketpreis-Hilfe im Formular der Höfe rechnete `Math.round(price * size * 100) / 100` in Fließkomma
 * und rundete auf einem halben Cent ab (0,15 € × 1,5 = 0,22 € statt 0,23 €); der Betrag wurde zum gespeicherten
 * Produktpreis (Nr. 139, Bericht, Nachtrag). `tests/geld-number-wache.test.ts` konnte das nicht finden: Dort stand kein
 * `Number()`.
 *
 * Beweist (Quelltext von `src/`, TypeScript-Syntaxbaum, kein Netz): Jede Multiplikation `a * b` (auch `a *= b`), bei der
 * eine Seite nach Geld heißt und die andere keine Zahl als Literal ist, steht nur an einer Stelle aus
 * GELD_FLIESSKOMMA_BESTAND — je Eintrag Datei, Text der Multiplikation, Anzahl und Grund (eine zweite Stelle derselben
 * Art in derselben Datei ist neu). Geld heißt der letzte Name der Seite, mit den Wortstämmen aus `tests/geld-namen.ts`
 * (dieselben wie in der Number-Wache, ohne percent und prozent). Eine Zahl als Literal ist `100`, `1.2`, `-1`: Das
 * Umrechnen mit einer festen Zahl (Euro → Cent, `price * 100`) bleibt erlaubt. Kommentare und Texte zählen nicht
 * (Syntaxbaum). Der Bestand schrumpft: Ein Eintrag, der im Code nicht mehr vorkommt, macht die Wache rot (veraltet).
 *
 * GRENZE: Die Wache sieht nur Namen und nur `*`. Eine Zahl mit neutralem Namen (`wert`, `x`), eine Division, eine
 * Summe in Fließkomma und `Math.round(x * 100) / 100` mit `x` ohne Geldnamen findet sie nicht. Verbindlich bleibt
 * CODING_STANDARDS §2; die Wache fängt nur den häufigsten Fehlgriff.
 *
 * Gegenprobe (Quelltext im Speicher, keine Datei im Repository wird verändert): eine neue Datei mit
 * `item.price * item.quantity`, ein aus dem Bestand entfernter Eintrag, ein veralteter Eintrag und eine zweite Stelle
 * in einer Bestandsdatei machen die Wache rot. Die Erkennung schlägt bei den Schreibweisen aus dem Fund an und bei
 * fester Zahl, Satz in Prozent, Kommentar und Text nicht.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { endnamen, klingtNachGeld, ohneHuelle } from './geld-namen'

const WURZEL = process.cwd()
const ORDNER = join(WURZEL, 'src')

interface BestandEintrag {
  /** Pfad ab der Wurzel des Repositories, mit `/`. */
  datei: string
  /** Der Text der Multiplikation, Leerraum auf ein Leerzeichen gekürzt. */
  ausdruck: string
  /** Wie oft der Ausdruck in der Datei vorkommt; eine zweite Stelle ist neu und muss eigens begründet werden. */
  anzahl: number
  grund: string
}

/**
 * Stellen unter `src/`, an denen ein Geldwert mit etwas anderem als einer festen Zahl multipliziert wird. Alle sind
 * nur Anzeige oder rechnen mit ganzen Zahlen; keine fließt in einen gespeicherten Betrag. Nur schrumpfen.
 */
const GELD_FLIESSKOMMA_BESTAND: readonly BestandEintrag[] = [
  {
    datei: 'src/lib/plattformgebuehr.ts',
    ausdruck: 'p.menge * gebuehrJeStueckCents(p.preisCents, hundertstel)',
    anzahl: 1,
    grund: 'ganze Zahlen: Menge (Int) × Gebühr je Stück in Cent (Int) — Plattformgebühr im Hofpreis, N38, Nr. 197',
  },
  {
    datei: 'src/lib/plattformgebuehr.ts',
    ausdruck: 'p.menge * p.preisCents',
    anzahl: 1,
    grund: 'ganze Zahlen: Menge (Int) × Warenpreis in Cent (Int) — Warenwert der Bestellgebühr, N38, Nr. 197',
  },
  {
    datei: 'src/lib/kasse.ts',
    ausdruck: 'p.menge * endpreisJeStueckCents(p.preisCents, hundertstel)',
    anzahl: 1,
    grund: 'ganze Zahlen: Menge (Int) × Endpreis je Stück in Cent (Int) — Zeilensumme der Kasse im Hofpreis-Modell, N38, Nr. 197',
  },
  {
    datei: 'src/lib/format.ts',
    ausdruck: 'price * basis.jeBasis',
    anzahl: 1,
    grund: 'nur Anzeige: Grundpreis-Vergleich (€/kg, €/rm), die Ausnahme in CODING_STANDARDS §2; wird nie gespeichert oder abgerechnet',
  },
  {
    datei: 'src/app/admin/finanzen/jahr-monate.tsx',
    ausdruck: '(cents / obergrenze) * (BASIS - OBEN)',
    anzahl: 1,
    grund: 'nur Grafik: Höhe eines Balkens in der Jahresübersicht der Finanzen, kein Betrag',
  },
  {
    datei: 'src/lib/finanzen.ts',
    ausdruck: 'schnittCents * offeneMonate',
    anzahl: 1,
    grund: 'ganze Zahlen: Hochrechnung in ganzen Cent mal ganze Monate, nur Anzeige im Admin',
  },
  {
    datei: 'src/lib/gruendungshof.ts',
    ausdruck: "monate * tarifText('HOFLADEN').grundgebuehrCents",
    anzahl: 1,
    grund: 'ganze Zahlen: Wert der Gründungszusage im Text, ganze Monate mal Grundgebühr in ganzen Cent',
  },
]

interface Fund {
  datei: string
  zeile: number
  ausdruck: string
}

/** `100`, `1.2`, `-1`, `+5`: eine feste Zahl. */
function istZahl(ausdruck: ts.Expression): boolean {
  const k = ohneHuelle(ausdruck)
  if (ts.isNumericLiteral(k)) return true
  return ts.isPrefixUnaryExpression(k) && (k.operator === ts.SyntaxKind.MinusToken || k.operator === ts.SyntaxKind.PlusToken) && ts.isNumericLiteral(ohneHuelle(k.operand))
}

function heisstNachGeld(ausdruck: ts.Expression): boolean {
  return endnamen(ausdruck).some(klingtNachGeld)
}

/** Alle `a * b` und `a *= b` mit Geld auf einer Seite und keiner festen Zahl auf der anderen. */
function geldFliesskommaFunde(quelltext: string, datei = 'schnipsel.ts'): Fund[] {
  const art = datei.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, art)
  const funde: Fund[] = []
  function besuche(k: ts.Node): void {
    if (ts.isBinaryExpression(k) && (k.operatorToken.kind === ts.SyntaxKind.AsteriskToken || k.operatorToken.kind === ts.SyntaxKind.AsteriskEqualsToken)) {
      const { left, right } = k
      if ((heisstNachGeld(left) && !istZahl(right)) || (heisstNachGeld(right) && !istZahl(left))) {
        funde.push({
          datei,
          zeile: sf.getLineAndCharacterOfPosition(k.getStart(sf)).line + 1,
          ausdruck: k.getText(sf).replace(/\s+/g, ' ').trim(),
        })
      }
    }
    ts.forEachChild(k, besuche)
  }
  besuche(sf)
  return funde
}

/** Neue Funde (nicht im Bestand oder über die eingetragene Anzahl hinaus) und veraltete Einträge, je als lesbare Zeile. */
function pruefeGeldFliesskomma(
  quellen: ReadonlyMap<string, string>,
  bestand: readonly BestandEintrag[] = GELD_FLIESSKOMMA_BESTAND,
): { neu: string[]; veraltet: string[] } {
  const funde = [...quellen].flatMap(([datei, text]) => geldFliesskommaFunde(text, datei))
  const schluessel = (datei: string, ausdruck: string): string => `${datei}\u0000${ausdruck}`
  const eingetragen = new Map(bestand.map((b) => [schluessel(b.datei, b.ausdruck), b]))
  const gezaehlt = new Map<string, number>()
  const neu: string[] = []
  for (const f of funde) {
    const key = schluessel(f.datei, f.ausdruck)
    const nr = (gezaehlt.get(key) ?? 0) + 1
    gezaehlt.set(key, nr)
    if (nr > (eingetragen.get(key)?.anzahl ?? 0)) neu.push(`${f.datei}:${f.zeile} ${f.ausdruck}`)
  }
  const veraltet = bestand.flatMap((b) => {
    const n = gezaehlt.get(schluessel(b.datei, b.ausdruck)) ?? 0
    if (n === 0) return [`${b.datei} ${b.ausdruck}`]
    return n < b.anzahl ? [`${b.datei} ${b.ausdruck} (${n} von ${b.anzahl})`] : []
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

describe('Geld-Fließkomma-Wache — kein Geld mal Nicht-Zahl außerhalb des Bestands (Regelvorschlag 139)', () => {
  it('Geld × Nicht-Zahl steht in src/ nur an den Stellen aus dem Bestand', () => {
    const { neu, veraltet } = pruefeGeldFliesskomma(quellenAusSrc())
    expect(
      neu,
      'Geld rechnet in ganzen Cent über calcLineTotal → decimalZuCents (CODING_STANDARDS §2). Ist es nur Anzeige oder rechnet es mit ganzen Zahlen: Stelle mit Grund in GELD_FLIESSKOMMA_BESTAND aufnehmen',
    ).toEqual([])
    expect(veraltet, 'GELD_FLIESSKOMMA_BESTAND: Die Stelle gibt es nicht mehr, Eintrag streichen').toEqual([])
    for (const { grund } of GELD_FLIESSKOMMA_BESTAND) expect(grund.length).toBeGreaterThan(40)
  }, 30_000)
})

describe('Geld-Fließkomma-Wache — Gegenprobe am echten Bestand', () => {
  it('schlägt an, wenn eine neue Datei item.price * item.quantity schreibt', () => {
    const quellen = new Map(quellenAusSrc())
    quellen.set('src/lib/neue-summe.ts', 'export const summe = items.reduce((s, item) => s + item.price * item.quantity, 0)\n')
    expect(pruefeGeldFliesskomma(quellen).neu).toEqual(['src/lib/neue-summe.ts:1 item.price * item.quantity'])
  }, 30_000)

  it('schlägt an, wenn ein Eintrag aus dem Bestand entfernt ist', () => {
    for (const eintrag of GELD_FLIESSKOMMA_BESTAND) {
      const ohne = GELD_FLIESSKOMMA_BESTAND.filter((b) => b !== eintrag)
      expect(pruefeGeldFliesskomma(quellenAusSrc(), ohne).neu, eintrag.datei).toEqual([expect.stringContaining(`${eintrag.datei}:`)])
    }
  }, 30_000)

  it('schlägt an, wenn eine Stelle aus dem Bestand ein zweites Mal vorkommt (Anzahl je Eintrag)', () => {
    for (const eintrag of GELD_FLIESSKOMMA_BESTAND) {
      const quellen = new Map(quellenAusSrc())
      const text = quellen.get(eintrag.datei)
      expect(text, `${eintrag.datei} muss unter src/ liegen`).toBeDefined()
      quellen.set(eintrag.datei, `${text ?? ''}\nexport const zweiteStelle = ${eintrag.ausdruck}\n`)
      expect(pruefeGeldFliesskomma(quellen).neu, eintrag.datei).toEqual([expect.stringContaining(`${eintrag.datei}:`)])
    }
  }, 30_000)

  it('schlägt als veraltet an, wenn die Stelle im Code fehlt oder ein Eintrag erfunden ist', () => {
    for (const eintrag of GELD_FLIESSKOMMA_BESTAND) {
      const quellen = new Map(quellenAusSrc())
      const text = quellen.get(eintrag.datei)
      expect(text, `${eintrag.datei} muss unter src/ liegen`).toBeDefined()
      quellen.set(eintrag.datei, (text ?? '').replaceAll(eintrag.ausdruck, '0'))
      expect(pruefeGeldFliesskomma(quellen).veraltet, eintrag.datei).toEqual([`${eintrag.datei} ${eintrag.ausdruck}`])
    }
    const erfunden = [...GELD_FLIESSKOMMA_BESTAND, { datei: 'src/lib/gibt-es-nicht.ts', ausdruck: 'x.price * y', anzahl: 1, grund: 'erfunden für die Gegenprobe, keine Stelle im Code' }]
    expect(pruefeGeldFliesskomma(quellenAusSrc(), erfunden).veraltet).toEqual(['src/lib/gibt-es-nicht.ts x.price * y'])
  }, 30_000)

  it('schlägt als veraltet an, wenn von zwei eingetragenen Stellen eine fehlt', () => {
    const doppelt = GELD_FLIESSKOMMA_BESTAND.map((b) => ({ ...b, anzahl: b.anzahl + 1 }))
    expect(pruefeGeldFliesskomma(quellenAusSrc(), doppelt).veraltet).toHaveLength(GELD_FLIESSKOMMA_BESTAND.length)
  }, 30_000)
})

describe('Geld-Fließkomma-Wache — Gegenprobe an Quelltext im Speicher: die Erkennung', () => {
  it('schlägt bei Geld mal Nicht-Zahl an, auf beiden Seiten und bei *=', () => {
    expect(geldFliesskommaFunde('const a = item.price * item.quantity')).toHaveLength(1)
    expect(geldFliesskommaFunde('const a = menge * p.preis')).toHaveLength(1)
    expect(geldFliesskommaFunde('const a = zeile.betrag * faktor')).toHaveLength(1)
    expect(geldFliesskommaFunde('summe.price *= faktor')).toHaveLength(1)
    expect(geldFliesskommaFunde('const a = (order.totalAmount as number) * rabatt')).toHaveLength(1)
  })

  it('findet den alten Paketpreis: die innere Multiplikation, nicht das feste × 100', () => {
    expect(geldFliesskommaFunde('const p = Math.round(price * size * 100) / 100')).toEqual([{ datei: 'schnipsel.ts', zeile: 1, ausdruck: 'price * size' }])
  })

  it('erkennt die Stelle auch in TSX und nennt Zeile und Ausdruck', () => {
    const text = 'const a = 1\n\nconst b = <span>{formatEuro(item.price * item.quantity)}</span>'
    expect(geldFliesskommaFunde(text, 'src/x.tsx')).toEqual([{ datei: 'src/x.tsx', zeile: 3, ausdruck: 'item.price * item.quantity' }])
  })

  it('lässt feste Zahlen, Sätze in Prozent und Mengen ohne Geld durch', () => {
    for (const text of [
      'const c = price * 100',
      'const c = 100 * price',
      'const c = price * -1',
      'const c = referenz * 1.2',
      'const c = (price) * (100)',
      'const c = farm.serviceFeePercent * x',
      'const c = menge * faktor',
      'const c = price + menge',
      'const c = price / menge',
    ]) {
      expect(geldFliesskommaFunde(text), text).toEqual([])
    }
  })

  it('zählt Kommentare und Texte nicht', () => {
    for (const text of [
      '// item.price * item.quantity gibt Rundungsfehler\nconst a = 1',
      '/* price * size */',
      "const hinweis = 'item.price * item.quantity'",
      'const hinweis = `price * size`',
    ]) {
      expect(geldFliesskommaFunde(text), text).toEqual([])
    }
  })
})

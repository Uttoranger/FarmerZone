/**
 * Fachwort-Wache (freigabe.md §12 Nr. 45, „Hofbereich kinderleicht"):
 * „Primärproduktion", „Umsatzgrenze", „Kennzeichnung" und „USP" stehen in
 * keinem Text, den der Quelltext unter src/ selbst schreibt (Zeichenketten,
 * Vorlagen, JSX-Text), ohne Alltagswort oder erklärenden Satz.
 *
 * Beweist:
 *  - USP nur ausgeschrieben: „Unternehmensserviceportal (USP)".
 *  - Primärproduktion nur mit dem Alltagswort davor: „Eigene Ernte (Primärproduktion)".
 *  - „Umsatzgrenze" nur in der einen Quelle der Verkäufe-Texte
 *    (hof-verkaeufe.ts, Wortlaut aus Register F6); wer „Dieses Jahr (für die
 *    Umsatzgrenze)" zeigt, zeigt auch den Satz, der sie erklärt.
 *  - „Kennzeichnung" nur in Dateien mit Grund (Liste KENNZEICHNUNG_ERLAUBT): im
 *    Hofbereich nur der Abschnitt „Kennzeichnung" samt seinen Meldungen — und
 *    der Abschnitt trägt den erklärenden Satz (KENNZEICHNUNG_ERKLAERUNG); dazu
 *    die Pflichttexte aus E10a, die wörtlich bleiben (tests/futter-bestaetigung.test.ts).
 *  - Gegenprobe: Die Suche findet die Wörter in Zeichenketten, Vorlagen und
 *    JSX-Text, nicht in Kommentaren — und die Regeln schlagen an.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { KENNZEICHNUNG_ERKLAERUNG, USP_AUSGESCHRIEBEN } from '@/lib/futter-registrierung'
import { JAHRESSUMME_TEXT, UMSATZGRENZE_ERKLAERUNG } from '@/lib/hof-verkaeufe'
import { formatEuro } from '@/lib/format'
import { PROCESSING_REVENUE_LIMIT } from '@/lib/revenue-limit'
import { BETRIEBSSTATUS } from '@/lib/taxonomie'

const WURZEL = process.cwd()

type Fund = { datei: string; zeile: number; text: string }

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

const FACHWORT = /Primärproduktion|Umsatzgrenze|Kennzeichnung|\bUSP\b/

/** Texte mit einem der Fachwörter — Zeichenketten, Vorlagen und JSX-Text; Kommentare zählen nicht. */
function findeFachwoerter(quelltext: string, datei = 'schnipsel.tsx'): Fund[] {
  const art = datei.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const quelle = ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, art)
  const funde: Fund[] = []
  const besuche = (knoten: ts.Node): void => {
    let text: string | null = null
    if (ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)) text = knoten.text
    else if (ts.isTemplateHead(knoten) || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten)) text = knoten.text
    else if (ts.isJsxText(knoten)) text = knoten.text
    if (text !== null && FACHWORT.test(text)) {
      const zeile = quelle.getLineAndCharacterOfPosition(knoten.getStart(quelle)).line + 1
      funde.push({ datei, zeile, text: text.replace(/\s+/g, ' ').trim() })
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(quelle)
  return funde
}

/**
 * Wo „Kennzeichnung" stehen darf — mit Grund. Eine neue Datei mit dem Wort
 * fällt hier auf: entweder ein Alltagswort nehmen („Angaben vom Sackanhänger")
 * oder den Satz KENNZEICHNUNG_ERKLAERUNG daneben zeigen und hier eintragen.
 */
const KENNZEICHNUNG_ERLAUBT: Record<string, string> = {
  'src/lib/futter-registrierung.ts': 'Quelle des erklärenden Satzes; Pflichttexte aus E10a wörtlich; Verweis auf den Haken unter dem Abschnitt',
  'src/components/produkte/futter-formular.tsx': 'Abschnitt „Kennzeichnung" im Futter-Formular, beginnt mit KENNZEICHNUNG_ERKLAERUNG',
  'src/components/products/produkt-abschnitte.ts': 'Titel des Abschnitts im Produktdialog, der Abschnitt beginnt mit KENNZEICHNUNG_ERKLAERUNG',
  'src/schemas/product.ts': 'Fehler am Abschnitt „Kennzeichnung" des Produktdialogs („… vom Sackanhänger")',
  'src/components/produktdetail/produktdetail-teile.tsx': 'Produktseite für Kundinnen, kein Hofbereich (Nr. 45 betrifft den Hofbereich)',
  'src/app/(public)/impressum/page.tsx': 'Rechtstext',
  'src/lib/laender.ts': 'Klär-Erinnerung nur im Admin (DE_ADMIN_KLAERUNG), kein Hofbereich',
}

/** Die einzige Datei, in der „Umsatzgrenze" steht: der Wortlaut aus Register F6 und sein erklärender Satz. */
const UMSATZGRENZE_QUELLE = 'src/lib/hof-verkaeufe.ts'

const EIGENE_ERNTE = 'Eigene Ernte (Primärproduktion)'

/** Was eine Regel an einem Fund beanstandet — leer heißt: in Ordnung. */
function beanstande(fund: Fund): string[] {
  const maengel: string[] = []
  const datei = fund.datei.split(sep).join('/')
  if (/\bUSP\b/.test(fund.text.replaceAll(USP_AUSGESCHRIEBEN, ''))) maengel.push('USP nicht ausgeschrieben')
  if (fund.text.replaceAll(EIGENE_ERNTE, '').includes('Primärproduktion')) maengel.push('Primärproduktion ohne Alltagswort')
  if (fund.text.includes('Umsatzgrenze') && datei !== UMSATZGRENZE_QUELLE) maengel.push('Umsatzgrenze außerhalb der Quelle')
  if (fund.text.includes('Kennzeichnung') && !(datei in KENNZEICHNUNG_ERLAUBT)) maengel.push('Kennzeichnung ohne Erklärung')
  return maengel
}

const ALLE_FUNDE = [...quelldateien(join(WURZEL, 'src'))].flatMap((pfad) =>
  findeFachwoerter(readFileSync(pfad, 'utf8'), relative(WURZEL, pfad).split(sep).join('/'))
)

const quelle = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8')

describe('Fachwort-Wache', () => {
  it('Gegenprobe: findet die Wörter in Zeichenkette, Vorlage und JSX-Text — nicht im Kommentar', () => {
    const schnipsel = [
      '// USP, Primärproduktion und Umsatzgrenze im Kommentar zählen nicht',
      "const a = 'Meldung beim BAES über das USP.'",
      'const b = <p>Primärproduktion</p>',
      'const c = `Dieses Jahr (für die Umsatzgrenze): ${betrag}`',
      "const d = 'Kennzeichnung'",
      "const e = 'Alltagswort ohne Fachbegriff'",
    ].join('\n')
    expect(findeFachwoerter(schnipsel).map((f) => f.zeile)).toEqual([2, 3, 4, 5])
  })

  it('Gegenprobe: die Regeln schlagen an — und lassen die erklärten Formen durch', () => {
    const fund = (text: string, datei = 'src/components/irgendwo.tsx'): Fund => ({ datei, zeile: 1, text })
    expect(beanstande(fund('Meldung beim BAES über das USP.'))).toEqual(['USP nicht ausgeschrieben'])
    expect(beanstande(fund(`Meldung beim BAES über das ${USP_AUSGESCHRIEBEN}.`))).toEqual([])
    expect(beanstande(fund('Primärproduktion · AT 1234567'))).toEqual(['Primärproduktion ohne Alltagswort'])
    expect(beanstande(fund(`${EIGENE_ERNTE} · AT 1234567`))).toEqual([])
    expect(beanstande(fund('Für die Umsatzgrenze'))).toEqual(['Umsatzgrenze außerhalb der Quelle'])
    expect(beanstande(fund('Für die Umsatzgrenze', UMSATZGRENZE_QUELLE))).toEqual([])
    expect(beanstande(fund('Kennzeichnung'))).toEqual(['Kennzeichnung ohne Erklärung'])
    expect(beanstande(fund('Kennzeichnung', 'src/components/produkte/futter-formular.tsx'))).toEqual([])
  })

  it('kein Fachwort ohne Erklärung in einem Text unter src/', () => {
    const maengel = ALLE_FUNDE.flatMap((f) => beanstande(f).map((m) => `${f.datei}:${f.zeile} ${m}: ${f.text.slice(0, 80)}`))
    expect(maengel).toEqual([])
  })

  it('jede erlaubte Datei trägt das Wort noch — sonst gehört sie aus der Liste', () => {
    const mitWort = new Set(ALLE_FUNDE.filter((f) => f.text.includes('Kennzeichnung')).map((f) => f.datei))
    for (const datei of Object.keys(KENNZEICHNUNG_ERLAUBT)) expect(mitWort.has(datei), datei).toBe(true)
  })

  it('USP steht ausgeschrieben; Primärproduktion heißt im Hofprofil „Eigene Ernte (Primärproduktion)"', () => {
    expect(USP_AUSGESCHRIEBEN).toBe('Unternehmensserviceportal (USP)')
    expect(BETRIEBSSTATUS.PRIMAERPRODUKTION.name).toBe(EIGENE_ERNTE)
  })

  it('„Umsatzgrenze": der Wortlaut aus F6 bleibt, daneben steht in einem Satz, was sie ist', () => {
    expect(JAHRESSUMME_TEXT).toBe('Dieses Jahr (für die Umsatzgrenze)')
    // Ein Satz: beginnt mit dem Wort, endet mit dem Punkt, kein zweiter Satz
    // (der Tausenderpunkt im Betrag steht zwischen Ziffern).
    expect(UMSATZGRENZE_ERKLAERUNG).toMatch(/^Umsatzgrenze heißt: .+\.$/)
    expect(UMSATZGRENZE_ERKLAERUNG).not.toMatch(/\.\s/)
    // Die Grenze steht als Betrag da, aus derselben Quelle wie die Jahreskarte
    // der Auswertung — „bis zu dieser Summe" las sich direkt unter der
    // Jahressumme wie deren Betrag.
    expect(UMSATZGRENZE_ERKLAERUNG).toContain(`Bis ${formatEuro(PROCESSING_REVENUE_LIMIT, 0)} im Jahr`)
    expect(UMSATZGRENZE_ERKLAERUNG).not.toContain('dieser Summe')
    const zeigen = [...quelldateien(join(WURZEL, 'src'))]
      .map((p) => relative(WURZEL, p).split(sep).join('/'))
      .filter((p) => p !== UMSATZGRENZE_QUELLE && /\bJAHRESSUMME_TEXT\b/.test(quelle(p)))
    expect(zeigen.length).toBeGreaterThan(0)
    for (const datei of zeigen) expect(quelle(datei), datei).toMatch(/\bUMSATZGRENZE_ERKLAERUNG\b/)
  })

  it('„Kennzeichnung": beide Abschnitte im Hofbereich beginnen mit dem erklärenden Satz', () => {
    expect(KENNZEICHNUNG_ERKLAERUNG).toMatch(/^Kennzeichnung heißt: [^.]+\.$/)
    for (const datei of ['src/components/produkte/futter-formular.tsx', 'src/components/products/product-dialog.tsx']) {
      expect(quelle(datei), datei).toMatch(/\bKENNZEICHNUNG_ERKLAERUNG\b/)
    }
  })
})

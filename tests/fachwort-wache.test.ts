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
 *  - „Kennzeichnung" nur in Texten mit Grund (Liste KENNZEICHNUNG_ERLAUBT, je
 *    Text, nicht je Datei — ein neuer Satz fällt auch in einer Datei auf, die
 *    schon erlaubte Texte trägt): der EINE Name des Abschnitts
 *    (KENNZEICHNUNG_TITEL, Verweise bauen ihn aus der Konstante), der
 *    erklärende Satz (KENNZEICHNUNG_ERKLAERUNG) und die Pflichttexte aus E10a,
 *    die wörtlich bleiben (tests/futter-bestaetigung.test.ts).
 *  - Der Satz zur Umsatzgrenze stimmt mit dem Code: Jedes Produkt zählt, außer
 *    der Hof lässt es nicht mitzählen; vereinfacht, ohne eigene Rechtsaussage.
 *  - Gegenprobe: Die Suche findet die Wörter in Zeichenketten, Vorlagen und
 *    JSX-Text, nicht in Kommentaren — und die Regeln schlagen an.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import {
  FUTTER_BESTAETIGUNG_NEU,
  FUTTER_BESTAETIGUNG_TEXT,
  KENNZEICHNUNG_ERKLAERUNG,
  KENNZEICHNUNG_FUNDORT,
  KENNZEICHNUNG_TITEL,
  KENNZEICHNUNG_VERWEIS,
  KUNDEN_VERANTWORTUNG,
  USP_AUSGESCHRIEBEN,
} from '@/lib/futter-registrierung'
import { JAHRESSUMME_TEXT, UMSATZGRENZE_ERKLAERUNG } from '@/lib/hof-verkaeufe'
import { formatEuro } from '@/lib/format'
import { PROCESSING_REVENUE_LIMIT, sumCountedRevenue } from '@/lib/revenue-limit'
import { FUTTER_FEHLER } from '@/schemas/product'
import { ABSCHNITT_TITEL } from '@/components/products/produkt-abschnitte'
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
 * Wo „Kennzeichnung" als Text stehen darf — je Text mit Grund, nicht je Datei
 * (Nachbesserung Runde 1): Ein neuer, nicht erklärter Satz fällt auch in
 * einer Datei auf, die schon erlaubte Texte trägt. Wer auf den Abschnitt
 * verweist, baut seinen Namen aus KENNZEICHNUNG_TITEL — dann steht das Wort
 * dort nicht als Text, und es gibt nur EINEN Namen.
 */
type Erlaubt = { datei: string; text: string | RegExp; grund: string }
const KENNZEICHNUNG_ERLAUBT: Erlaubt[] = [
  { datei: 'src/lib/futter-registrierung.ts', text: KENNZEICHNUNG_TITEL, grund: 'der eine Name des Abschnitts' },
  { datei: 'src/lib/futter-registrierung.ts', text: KENNZEICHNUNG_ERKLAERUNG, grund: 'der erklärende Satz am Anfang des Abschnitts' },
  { datei: 'src/lib/futter-registrierung.ts', text: FUTTER_BESTAETIGUNG_TEXT, grund: 'Pflicht-Haken aus E10a, wörtlich' },
  { datei: 'src/lib/futter-registrierung.ts', text: KUNDEN_VERANTWORTUNG, grund: 'Hinweis für Kundinnen aus E10a, wörtlich' },
  { datei: 'src/components/produktdetail/produktdetail-teile.tsx', text: 'Kennzeichnung', grund: 'Produktseite für Kundinnen, kein Hofbereich' },
  {
    datei: 'src/app/(public)/impressum/page.tsx',
    text: /^FarmerZone stellt ausschließlich die technische Plattform zur Verfügung\. Für die Beschreibung, Qualität, Kennzeichnung und Lieferung /,
    grund: 'Rechtstext',
  },
  {
    datei: 'src/lib/laender.ts',
    text: 'Vor der Freischaltung klären: Stripe-Konto in DE, steuerliche Behandlung, Kennzeichnungspflichten.',
    grund: 'Klär-Erinnerung nur im Admin, kein Hofbereich',
  },
]

function passt(e: Erlaubt, fund: Fund): boolean {
  return e.datei === fund.datei.split(sep).join('/') && (typeof e.text === 'string' ? e.text === fund.text : e.text.test(fund.text))
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
  if (fund.text.includes('Kennzeichnung') && !KENNZEICHNUNG_ERLAUBT.some((e) => passt(e, { ...fund, datei }))) maengel.push('Kennzeichnung ohne Erklärung')
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
    // Je Text, nicht je Datei: Ein neuer Satz fällt auch dort auf, wo schon erlaubte Texte stehen (Runde 1).
    for (const datei of [
      'src/lib/futter-registrierung.ts',
      'src/schemas/product.ts',
      'src/components/produkte/futter-formular.tsx',
      'src/components/products/produkt-abschnitte.ts',
    ]) {
      expect(beanstande(fund('Neue Kennzeichnung ohne Satz', datei)), datei).toEqual(['Kennzeichnung ohne Erklärung'])
    }
    expect(beanstande(fund(FUTTER_BESTAETIGUNG_TEXT, 'src/lib/futter-registrierung.ts'))).toEqual([])
    expect(beanstande(fund(FUTTER_BESTAETIGUNG_TEXT, 'src/components/produkte/futter-formular.tsx'))).toEqual(['Kennzeichnung ohne Erklärung'])
  })

  it('kein Fachwort ohne Erklärung in einem Text unter src/', () => {
    const maengel = ALLE_FUNDE.flatMap((f) => beanstande(f).map((m) => `${f.datei}:${f.zeile} ${m}: ${f.text.slice(0, 80)}`))
    expect(maengel).toEqual([])
  })

  it('jeder erlaubte Text steht noch so da — sonst gehört er aus der Liste', () => {
    for (const e of KENNZEICHNUNG_ERLAUBT) expect(ALLE_FUNDE.some((f) => passt(e, f)), `${e.datei}: ${e.grund}`).toBe(true)
  })

  it('USP steht ausgeschrieben; Primärproduktion heißt im Hofprofil „Eigene Ernte (Primärproduktion)"', () => {
    expect(USP_AUSGESCHRIEBEN).toBe('Unternehmensserviceportal (USP)')
    expect(BETRIEBSSTATUS.PRIMAERPRODUKTION.name).toBe(EIGENE_ERNTE)
  })

  it('„Umsatzgrenze": der Wortlaut aus F6 bleibt, daneben steht in einem Satz, was sie ist', () => {
    expect(JAHRESSUMME_TEXT).toBe('Dieses Jahr (für die Umsatzgrenze)')
    // Ein Satz: beginnt mit dem Wort, endet mit dem Punkt, kein zweiter Satz.
    expect(UMSATZGRENZE_ERKLAERUNG).toMatch(/^Umsatzgrenze heißt: .+\.$/)
    expect(UMSATZGRENZE_ERKLAERUNG).not.toMatch(/\.\s/)
    // Die Grenze als Betrag, aus derselben Quelle wie die Jahreskarte der Auswertung.
    expect(UMSATZGRENZE_ERKLAERUNG).toContain(formatEuro(PROCESSING_REVENUE_LIMIT, 0))
    expect(UMSATZGRENZE_ERKLAERUNG).not.toContain('dieser Summe')
  })

  it('der Satz zur Umsatzgrenze stimmt mit dem Code und ordnet nichts rechtlich ein (Runde 1)', () => {
    // Code: Jedes Produkt zählt standardmäßig (countsTowardLimit: true); heraus
    // fällt nur, was der Hof im Produkt abhakt; Posten ohne Produkt zählen immer.
    expect(quelle('src/components/products/product-dialog.tsx')).toContain('countsTowardLimit: true,')
    expect(
      sumCountedRevenue([
        { amount: 100, countsTowardLimit: true },
        { amount: 40, countsTowardLimit: null },
        { amount: 7, countsTowardLimit: false },
      ])
    ).toBe(140)
    expect(UMSATZGRENZE_ERKLAERUNG).toContain('jeder Verkauf')
    expect(UMSATZGRENZE_ERKLAERUNG).toContain('nicht mitzählen lässt')
    // Vereinfacht wie die Jahreskarte der Auswertung, keine eigene Rechtsaussage.
    expect(UMSATZGRENZE_ERKLAERUNG).toContain('vereinfacht, keine Steuerberatung')
    expect(UMSATZGRENZE_ERKLAERUNG).not.toMatch(/Rohes|Teil deiner Landwirtschaft|\bgilt\b/)
  })

  it('wer die Jahressumme zeigt, zeigt auch den Satz', () => {
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

  it('„Kennzeichnung": EIN Name aus einer Quelle — Abschnitt, Verweise und Meldungen bauen ihn aus KENNZEICHNUNG_TITEL (Runde 1)', () => {
    expect(KENNZEICHNUNG_TITEL).toBe('Kennzeichnung')
    expect(ABSCHNITT_TITEL.kennzeichnung).toBe(KENNZEICHNUNG_TITEL)
    for (const datei of [
      'src/components/produkte/futter-formular.tsx',
      'src/components/products/produkt-abschnitte.ts',
      'src/components/products/kategorie-sheet.tsx',
      'src/components/products/product-dialog.tsx',
      'src/schemas/product.ts',
    ]) {
      expect(quelle(datei), datei).toMatch(/\bKENNZEICHNUNG_(?:TITEL|VERWEIS)\b/)
    }
    expect(KENNZEICHNUNG_VERWEIS).toBe(`im Abschnitt „${KENNZEICHNUNG_TITEL}“`)
    const verweis = `im Abschnitt „${KENNZEICHNUNG_TITEL}“`
    expect(FUTTER_FEHLER.fehlt).toBe(`Bei Futtermitteln brauchen wir die Angaben ${verweis}.`)
    expect(FUTTER_FEHLER.verboten).toBe(`Angaben ${verweis} gibt es nur bei Futtermitteln.`)
    expect(FUTTER_BESTAETIGUNG_NEU).toBe(`Du hast Angaben zum Futter geändert. Bitte bestätige sie neu mit dem Haken ${verweis}, dann speichern wir.`)
    // Kein zweiter Name für denselben Abschnitt (Runde 0 schrieb „Angaben vom Sackanhänger").
    for (const pfad of quelldateien(join(WURZEL, 'src'))) {
      expect(readFileSync(pfad, 'utf8'), relative(WURZEL, pfad)).not.toContain('Angaben vom Sackanhänger')
    }
  })

  it('der Satz, wo die Angaben stehen, stimmt auch für Heu aus eigener Ernte — dort gibt es keinen Sackanhänger (E10)', () => {
    expect(KENNZEICHNUNG_FUNDORT).toMatch(/^[^.]+\.$/)
    expect(KENNZEICHNUNG_FUNDORT).toContain('eigener Ernte')
    expect(KENNZEICHNUNG_FUNDORT).toContain('Sackanhänger oder Lieferschein')
  })
})

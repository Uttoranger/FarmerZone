/**
 * Wortliste (Register N8, docs/ai/DESIGN_SYSTEM.md „Wortliste").
 *
 * Ursache: Für dieselbe Sache standen mehrere Wörter in den Texten („Zeitfenster"
 * neben „Abholtermin", „Bestand" neben „Vorrat", „Status posten" neben „Neuer
 * Beitrag"). Wer den Hof liest, hält sie für verschiedene Dinge.
 *
 * Beweist:
 *  - Die Tabelle wird gelesen: Kopf „Sache | Wort | nicht | Beispiel", vier Spalten
 *    je Zeile, und die verbotenen Wörter aus N8 stehen in der Spalte „nicht".
 *  - Kein Wort aus „nicht" steht in einer Zeichenkette, einem Vorlagentext, einem
 *    Attribut oder einem JSX-Text unter src/ — mit Wortgrenzen und in der
 *    Schreibweise der Tabelle. Kommentare, Bezeichner und Server-Logs (console.*)
 *    zählen nicht.
 *  - Steht ein Wort in anderem Sinn richtig da (der Status einer Bestellung), steht
 *    der Text mit Grund in AUSNAHMEN — je Text, nicht je Datei, ohne Zeilennummer.
 *  - OFFEN_BIS_78 ist die Arbeitsliste für Nr. 78: die Fundstellen von heute
 *    (Datei:Zeile), die 78 umstellt und streicht. Sie greift über Datei, Wort und
 *    Text, nicht über die Zeile — im Sammel-PR verschieben andere Nummern die Zeilen.
 *    Jeder Eintrag deckt genau eine Fundstelle; ein Eintrag, hinter dem kein Text
 *    mehr steht, fällt auf und gehört gestrichen.
 *  - Gegenprobe: Die Suche schlägt am Wort im String an, nicht im Kommentar.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'

const WURZEL = process.cwd()

// ── Die Tabelle ──────────────────────────────────────────────────────────────

type Zeile = { sache: string; wort: string; nicht: string[]; beispiel: string }
type Verbot = { wort: string; statt: string[]; muster: RegExp }

const zellen = (zeile: string): string[] => zeile.split('|').slice(1, -1).map((z) => z.trim())

/** Die Tabelle „Sache | Wort | nicht | Beispiel" im Abschnitt „Wortliste"; „nicht" ist eine Liste, durch Komma getrennt. */
function leseTabelle(doku: string): Zeile[] {
  const start = doku.indexOf('\n## Wortliste\n')
  if (start === -1) throw new Error('Abschnitt „Wortliste" fehlt in docs/ai/DESIGN_SYSTEM.md')
  const ende = doku.indexOf('\n## ', start + 1)
  const tabelle = doku
    .slice(start, ende === -1 ? undefined : ende)
    .split('\n')
    .filter((z) => z.startsWith('|'))
  const [kopf, , ...daten] = tabelle
  if (kopf === undefined || zellen(kopf).join(' | ') !== 'Sache | Wort | nicht | Beispiel') {
    throw new Error('Der Tabellenkopf der Wortliste muss „Sache | Wort | nicht | Beispiel" lauten')
  }
  return daten.map((z) => {
    const spalten = zellen(z)
    if (spalten.length !== 4) throw new Error(`Zeile der Wortliste ohne genau vier Spalten: ${z.slice(0, 70)}`)
    const [sache, wort, nicht, beispiel] = spalten
    return { sache, wort, nicht: nicht.split(',').map((w) => w.trim()).filter((w) => w !== ''), beispiel }
  })
}

/** Wortgrenze für Deutsch: Umlaute sind Buchstaben, \b wüsste das nicht. Groß-/Kleinschreibung wie in der Tabelle. */
const BUCHSTABE = String.raw`[\p{L}\p{N}]`
const maskiere = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Aus den Zeilen werden die verbotenen Wörter; steht eines in mehreren Zeilen, nennt die Meldung alle Wörter, die dafür stehen. */
function verbotene(tabelle: Zeile[]): Verbot[] {
  const statt = new Map<string, Set<string>>()
  for (const z of tabelle) for (const w of z.nicht) statt.set(w, (statt.get(w) ?? new Set<string>()).add(z.wort))
  return [...statt].map(([wort, ersatz]) => ({
    wort,
    statt: [...ersatz],
    muster: new RegExp(`(?<!${BUCHSTABE})${maskiere(wort)}(?!${BUCHSTABE})`, 'gu'),
  }))
}

const TABELLE = leseTabelle(readFileSync(join(WURZEL, 'docs/ai/DESIGN_SYSTEM.md'), 'utf8'))
const VERBOTE = verbotene(TABELLE)

// ── Die Suche ────────────────────────────────────────────────────────────────

type Fund = { datei: string; zeile: number; wort: string; text: string }

/**
 * Wendungen, in denen ein verbotenes Wort etwas anderes meint — je Zeile mit Grund.
 * Sie fallen vor der Suche aus dem Text; der Text selbst bleibt unverändert.
 */
const ERLAUBTE_WENDUNGEN: { wendung: string; grund: string }[] = [
  { wendung: 'per Post', grund: 'Briefpost, kein Beitrag' },
  { wendung: 'Per Post', grund: 'Briefpost am Satzanfang, kein Beitrag' },
]

function* quelldateien(ordner: string): Generator<string> {
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) yield* quelldateien(pfad)
    else if (/\.(ts|tsx)$/.test(name)) yield pfad
  }
}

/** Steht der Knoten in einem Aufruf von console.* — also in einem Server-Log, das niemand in der Oberfläche liest? */
function imLog(knoten: ts.Node): boolean {
  for (let k: ts.Node | undefined = knoten.parent; k; k = k.parent) {
    if (ts.isCallExpression(k) && ts.isPropertyAccessExpression(k.expression) && k.expression.expression.getText() === 'console') return true
  }
  return false
}

/** Verbotene Wörter in Zeichenketten, Vorlagen, Attributen und JSX-Text — Kommentare, Bezeichner und Logs zählen nicht. */
function findeVerbotene(quelltext: string, verbote: Verbot[], datei = 'schnipsel.tsx'): Fund[] {
  const art = datei.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const quelle = ts.createSourceFile(datei, quelltext, ts.ScriptTarget.Latest, true, art)
  const funde: Fund[] = []
  const besuche = (knoten: ts.Node): void => {
    let roh: string | null = null
    if (ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)) roh = knoten.text
    else if (ts.isTemplateHead(knoten) || ts.isTemplateMiddle(knoten) || ts.isTemplateTail(knoten)) roh = knoten.text
    else if (ts.isJsxText(knoten)) roh = knoten.text
    if (roh !== null && !imLog(knoten)) {
      // Ein Zeilenumbruch mitten im JSX-Text trennt keine Wortgruppe („Hilfe und\n Rückmeldung").
      const text = roh.replace(/\s+/g, ' ').trim()
      const zeile = quelle.getLineAndCharacterOfPosition(knoten.getStart(quelle)).line + 1
      let suchtext = text
      for (const { wendung } of ERLAUBTE_WENDUNGEN) suchtext = suchtext.replaceAll(wendung, ' '.repeat(wendung.length))
      for (const v of verbote) {
        funde.push(...[...suchtext.matchAll(v.muster)].map(() => ({ datei, zeile, wort: v.wort, text })))
      }
    }
    ts.forEachChild(knoten, besuche)
  }
  besuche(quelle)
  return funde
}

// ── Ausnahmen und Arbeitsliste ───────────────────────────────────────────────

/**
 * Wo ein verbotenes Wort in anderem Sinn richtig ist — dauerhaft, je Text mit Grund.
 * `text` ist der ganze Text (genau gleich) oder ein Muster; ein Eintrag gilt für jeden
 * Treffer mit diesem Text in der Datei. Zeilennummern stehen hier nie.
 *
 * „Status", „Post" und „Neuigkeit" meinen in der Wortliste den Beitrag. Der Status einer
 * Bestellung, Zahlung, Freischaltung oder Meldung, der Name der WhatsApp-Funktion „Status"
 * und ein HTTP-Kopf bleiben, wie sie heißen.
 */
type Ausnahme = { datei: string; wort: string; text: string | RegExp; grund: string }
const AUSNAHMEN: Ausnahme[] = [
  // Status
  { datei: 'src/app/(hof)/settings/payments/payments-actions.tsx', wort: 'Status', text: 'Status prüfen', grund: 'Knopf fragt bei Stripe, wie weit die Freischaltung des Hofs ist — kein Beitrag' },
  { datei: 'src/app/admin/meldungen/[id]/triage-form.tsx', wort: 'Status', text: 'Status', grund: 'Feld „Status“ der Meldung im Admin — kein Beitrag' },
  { datei: 'src/components/admin/hoefe-ansicht.tsx', wort: 'Status', text: 'Status', grund: 'Spaltenkopf der Hofliste im Admin (Freischaltung des Hofs) — kein Beitrag' },
  { datei: 'src/components/hof-kunden/kunden-ansicht.tsx', wort: 'Status', text: 'Status', grund: 'Spaltenkopf der Kundenliste (Marke je Kundin) — kein Beitrag' },
  { datei: 'src/components/produkte/produkte-ansicht.tsx', wort: 'Status', text: 'Status', grund: 'Spaltenkopf der Produktliste (sichtbar, nicht im Shop, ausverkauft) — kein Beitrag' },
  { datei: 'src/components/teilen/teilen-fenster.tsx', wort: 'Status', text: 'Status 9:16', grund: 'Format der WhatsApp-Funktion „Status“ (Hochformat 9:16), nicht der Beitrag' },
  { datei: 'src/lib/teilen-fenster.ts', wort: 'Status', text: 'WhatsApp-Status', grund: 'Name der WhatsApp-Funktion „Status“ als Weg zum Teilen' },
  { datei: 'src/lib/teilen-kanal.ts', wort: 'Status', text: 'WhatsApp-Status', grund: 'Name der WhatsApp-Funktion „Status“ in der Auswertung der Teilen-Wege' },
  { datei: 'src/lib/briefkasten-export.ts', wort: 'Status', text: '· Filter: Status', grund: 'Kopfzeile des Briefkasten-Exports für den Kurator: Filter nach dem Status der Meldung' },
  { datei: 'src/schemas/meldung.ts', wort: 'Status', text: 'Unbekannter Status.', grund: 'Fehlermeldung zum Status einer Meldung im Admin — kein Beitrag' },
  { datei: 'src/server/actions/orders.ts', wort: 'Status', text: 'Status kann nicht zurückgesetzt werden', grund: 'Fehlermeldung zum Status einer Bestellung — kein Beitrag' },
  // Post
  { datei: 'src/lib/abmelde-link.ts', wort: 'Post', text: 'List-Unsubscribe-Post', grund: 'Name eines HTTP-Kopfs (RFC 8058, Ein-Klick-Abmelden), kein Text für Menschen' },
  {
    datei: 'src/lib/email.ts',
    wort: 'Post',
    text: /^Mail nicht verschickt: .*Post-Sperre/,
    grund: 'Meldung an Sentry für die Entwicklerin; „Post-Sperre“ ist die Sperre des Mailversands (Register Z3), kein Beitrag',
  },
  // Lager
  {
    datei: 'src/lib/taxonomie.ts',
    wort: 'Lager',
    text: /Handel oder Lager\)/,
    grund: 'Lager als Tätigkeit bei der BAES-Registrierung (Lagerung von Futtermitteln), nicht der Vorrat',
  },
  // Käufer
  {
    datei: 'src/app/(public)/impressum/page.tsx',
    wort: 'Käufer',
    text: /Käuferinnen und Käufer\.$/,
    grund: 'Rechtstext im Impressum (Haftungsausschluss) bleibt wörtlich; „Käufer“ ist dort der juristische Begriff',
  },
]

/**
 * Arbeitsliste für Nr. 78 (Stand main f367433): die Fundstellen von heute. 78 stellt den
 * Text auf das Wort der Tabelle um und streicht den Eintrag. `stelle` ist Datei:Zeile von
 * heute (nur zum Finden; geglichen wird über Datei, Wort und Text), `text` ein Ausschnitt.
 * `nummer` nennt die andere Nummer dieses Laufs, der die Datei gehört — 78 ändert dort
 * nichts, der Dirigent gibt den Eintrag weiter.
 */
type Offen = { stelle: string; wort: string; text: string; nummer?: string }
const OFFEN_BIS_78: Offen[] = [
  { stelle: 'src/app/(hof)/fehler-melden/page.tsx:17', wort: 'Hilfe und Rückmeldung', text: 'Hilfe und Rückmeldung — FarmerZone' },
  { stelle: 'src/app/(hof)/fehler-melden/page.tsx:68', wort: 'Hilfe und Rückmeldung', text: 'Hilfe und Rückmeldung' },
  { stelle: 'src/app/(hof)/status/[id]/send-whatsapp/whatsapp-tap-client.tsx:124', wort: 'Status', text: 'Dein Status', nummer: '81' },
  { stelle: 'src/app/(hof)/status/new/status-new-client.tsx:278', wort: 'Neuigkeit', text: 'Schreibe hier deine Neuigkeit…' },
  { stelle: 'src/app/(hof)/status/new/status-new-client.tsx:304', wort: 'Status', text: 'Status-Foto' },
  { stelle: 'src/app/(public)/datenschutz/page.tsx:233', wort: 'Fehler melden', text: 'bzw. &bdquo;Fehler melden&ldquo; kannst du uns' },
  { stelle: 'src/components/farm/product-grid.tsx:420', wort: 'Bestand', text: 'Bestand 0 — Kunden sehen „Ausverkauft“', nummer: '75' },
  { stelle: 'src/components/farm/product-grid.tsx:442', wort: 'Lager', text: 'Lager', nummer: '75' },
  { stelle: 'src/components/hof-einstellungen/einstellungen-uebersicht.tsx:65', wort: 'Hilfe und Rückmeldung', text: 'Hilfe und Rückmeldung' },
  { stelle: 'src/components/hofseite/hofseite-seitenspalte.tsx:106', wort: 'Zeitfenster', text: 'Dein Zeitfenster wählst du beim Bestellen.' },
  { stelle: 'src/components/products/product-dialog.tsx:309', wort: 'Lager', text: 'auf Lager' },
  { stelle: 'src/components/produkte/brennmaterial-formular.tsx:201', wort: 'Käufer', text: 'Die drei Fragen, die jeder Käufer stellt.' },
  { stelle: 'src/components/produkte/brennmaterial-formular.tsx:433', wort: 'Käufer', text: 'So sehen Käufer dein Holz' },
  { stelle: 'src/components/produkte/futter-formular.tsx:410', wort: 'Käufern', text: 'sich automatisch und wird Käufern zum Vergleichen gezeigt.' },
  { stelle: 'src/components/produkte/futter-formular.tsx:415', wort: 'Käufer', text: 'Hinweise für Käufer' },
  { stelle: 'src/components/produkte/futter-formular.tsx:597', wort: 'Käufer', text: 'So sehen Käufer dein Futter' },
  { stelle: 'src/components/produkte/futter-formular.tsx:623', wort: 'Käufer', text: 'Die Servicegebühr zahlt der Käufer zusätzlich. Du bekommst genau deinen Preis.' },
  { stelle: 'src/components/shared/meldung-form.tsx:86', wort: 'Hilfe und Rückmeldung', text: 'Den Stand deiner Meldung findest du unter „Hilfe und Rückmeldung“.' },
  { stelle: 'src/components/startseite/startseite-abschnitte.tsx:143', wort: 'Zeitfenster', text: 'Bestellen und Zeitfenster wählen' },
  { stelle: 'src/emails/status-update.tsx:69', wort: 'Neuigkeit', text: 'Neuigkeit von' },
  { stelle: 'src/lib/abholfenster.ts:29', wort: 'Zeitfenster', text: 'Dieses Zeitfenster ist leider nicht mehr verfügbar – bitte wähle ein anderes.' },
  { stelle: 'src/lib/bauern-navigation.ts:177', wort: 'Status', text: 'Status posten' },
  { stelle: 'src/lib/bauern-navigation.ts:191', wort: 'Lagerstand', text: 'Foto, Preis, Lagerstand' },
  { stelle: 'src/lib/bauern-navigation.ts:192', wort: 'Neuigkeit', text: 'Neuigkeit auf deiner Hofseite' },
  { stelle: 'src/lib/bauern-navigation.ts:214', wort: 'Hilfe und Rückmeldung', text: 'Hilfe und Rückmeldung' },
  { stelle: 'src/lib/bauern-navigation.ts:389', wort: 'Neuigkeit', text: 'Neuigkeit auf deiner Hofseite' },
  { stelle: 'src/lib/dual-use.ts:46', wort: 'Bestand', text: '. Das hier wird ein zweites, eigenes Produkt mit eigenem Bestand.' },
  { stelle: 'src/lib/format.ts:345', wort: 'Bestand', text: 'Bestand (' },
  { stelle: 'src/lib/format.ts:347', wort: 'Bestand', text: 'Bestand (Pakete)' },
  { stelle: 'src/lib/format.ts:348', wort: 'Bestand', text: 'Bestand (' },
  { stelle: 'src/lib/heute.ts:294', wort: 'Status', text: 'Noch kein Status — erzähl deinen Kunden, was es gibt' },
  { stelle: 'src/lib/heute.ts:295', wort: 'Status', text: 'Tagen kein neuer Status' },
  { stelle: 'src/lib/hoefe-entdecken.ts:311', wort: 'Zeitfenster', text: 'Frisch vom Hof – bestellen und im Zeitfenster abholen' },
  { stelle: 'src/lib/hofseite-kunde.ts:178', wort: 'Käufer', text: 'So sehen Käufer dein Produkt' },
  { stelle: 'src/lib/reservierung.ts:136', wort: 'Bestand', text: 'Mengen wurden an den verfügbaren Bestand angepasst.' },
  { stelle: 'src/lib/reservierung.ts:136', wort: 'Bestand', text: 'Eine Menge wurde an den verfügbaren Bestand angepasst.' },
  { stelle: 'src/schemas/product.ts:315', wort: 'Bestand', text: 'Bestand kann nicht negativ sein' },
  { stelle: 'src/schemas/produktfamilie.ts:44', wort: 'Käufer', text: 'Bitte wähle die Scheitlänge — das fragt jeder Käufer.' },
]

type Deckt = { datei: string; wort: string; text: string }
const dateiVon = (stelle: string): string => stelle.slice(0, stelle.lastIndexOf(':'))

const deckt = (a: Ausnahme, f: Fund): boolean =>
  a.datei === f.datei && a.wort === f.wort && (typeof a.text === 'string' ? a.text === f.text : a.text.test(f.text))

/** Jede Fundstelle nimmt höchstens einen Eintrag; was bleibt, ist offen bzw. ohne Fundstelle. */
function gleicheAb<E extends Deckt>(funde: Fund[], liste: E[]): { rest: Fund[]; ungenutzt: E[] } {
  const frei = [...liste]
  const rest: Fund[] = []
  for (const f of funde) {
    // Der längste passende Text zuerst: „Bestand (" darf den Platz von „Bestand (Pakete)" nicht wegnehmen.
    let beste = -1
    frei.forEach((e, i) => {
      const passt = e.datei === f.datei && e.wort === f.wort && f.text.includes(e.text)
      if (passt && (beste === -1 || e.text.length > frei[beste].text.length)) beste = i
    })
    if (beste === -1) rest.push(f)
    else frei.splice(beste, 1)
  }
  return { rest, ungenutzt: frei }
}

const OFFEN = OFFEN_BIS_78.map((e) => ({ ...e, datei: dateiVon(e.stelle) }))
const posix = (pfad: string): string => pfad.split(sep).join('/')

// ── Prüfungen ────────────────────────────────────────────────────────────────

describe('Wortliste', () => {
  describe('Tabelle', () => {
    it('hat in jeder Zeile Sache, Wort und Beispiel, und die verbotenen Wörter aus N8 stehen in „nicht"', () => {
      for (const z of TABELLE) {
        expect(z.sache, z.wort).not.toBe('')
        expect(z.wort, z.sache).not.toBe('')
        expect(z.beispiel, z.sache).not.toBe('')
      }
      const nicht = new Set(TABELLE.flatMap((z) => z.nicht))
      for (const wort of ['Zeitfenster', 'Abholslot', 'Bestand', 'Lagerstand', 'Lager', 'Status', 'Post', 'Neuigkeit', 'Hilfe und Rückmeldung', 'Fehler melden', 'Käufer']) {
        expect(nicht.has(wort), wort).toBe(true)
      }
    })
  })

  describe('Suche', () => {
    it('Gegenprobe: schlägt an bei Zeichenkette, Vorlage, Attribut und JSX-Text — nicht bei Kommentar, Bezeichner, Log, Route oder längerem Wort', () => {
      const schnipsel = [
        '// Zeitfenster und Bestand im Kommentar zählen nicht',
        '/** Status posten, Lager, Neuigkeit */',
        "const a = 'Wähle ein Zeitfenster'",
        'const b = <p>Bestand 0</p>',
        'const c = `Dein Lager: ${n}`',
        'const d = <Feld label="Status posten" />',
        'const e = `${n} Bestand`',
        // Das alles zählt nicht:
        'const Zeitfenster = 1',
        "const f = '/status'",
        "const g = 'bestand'",
        "const h = 'Lagerbestand, Statusmeldung, Postleitzahl, Neuigkeiten, Käufers'",
        "console.error('Bestand-Ausgleich fehlgeschlagen')",
        "const i = 'Wir schicken es per Post'",
        'const j = <p>{Käufer}</p>',
        // Eine Wortgruppe über Zeilen hinweg zählt als eine (die Zeile ist die des ersten Wortes):
        'const k = <p>\n  Hilfe und\n  Rückmeldung\n</p>',
      ].join('\n')
      expect(findeVerbotene(schnipsel, VERBOTE).map((f) => `${f.zeile} ${f.wort}`)).toEqual([
        '3 Zeitfenster',
        '4 Bestand',
        '5 Lager',
        '6 Status',
        '7 Bestand',
        '16 Hilfe und Rückmeldung',
      ])
    })

    it('Gegenprobe: ein Wort neben einer erlaubten Wendung zählt trotzdem', () => {
      const funde = findeVerbotene("const a = 'Neuer Post, nicht per Post'", VERBOTE)
      expect(funde.map((f) => f.wort)).toEqual(['Post'])
    })

    it('Gegenprobe: ein Eintrag deckt genau eine Fundstelle — über Datei, Wort und Text, nie über die Zeile', () => {
      const fund = (datei: string, zeile: number, wort: string, text: string): Fund => ({ datei, zeile, wort, text })
      const funde = [
        fund('src/a.ts', 10, 'Bestand', 'Bestand 0 — Kunden sehen „Ausverkauft“'),
        fund('src/a.ts', 99, 'Bestand', 'Bestand 0 — Kunden sehen „Ausverkauft“'),
        fund('src/b.ts', 5, 'Lager', 'auf Lager'),
      ]
      // Die Zeile im Eintrag (hier 12) stimmt nicht mit der Fundstelle (10) überein und stört nicht.
      const liste = [{ stelle: 'src/a.ts:12', datei: dateiVon('src/a.ts:12'), wort: 'Bestand', text: 'Bestand 0' }]
      const { rest, ungenutzt } = gleicheAb(funde, liste)
      expect(rest.map((f) => `${f.datei}:${f.zeile}`)).toEqual(['src/a.ts:99', 'src/b.ts:5'])
      expect(ungenutzt).toEqual([])
      // Ein Eintrag, hinter dem kein Text mehr steht, bleibt übrig.
      expect(gleicheAb([], liste).ungenutzt).toHaveLength(1)
    })

    it('Gegenprobe: ein kurzer Text nimmt einem längeren, der ihn enthält, den Platz nicht weg — gleich in welcher Reihenfolge', () => {
      const kurz = { datei: 'src/f.ts', wort: 'Bestand', text: 'Bestand (' }
      const lang = { datei: 'src/f.ts', wort: 'Bestand', text: 'Bestand (Pakete)' }
      const mitPaketen = { datei: 'src/f.ts', zeile: 1, wort: 'Bestand', text: 'Bestand (Pakete)' }
      const mitKlammer = { datei: 'src/f.ts', zeile: 2, wort: 'Bestand', text: 'Bestand (' }
      for (const [funde, liste] of [
        [[mitPaketen, mitKlammer], [kurz, lang]],
        [[mitKlammer, mitPaketen], [lang, kurz]],
      ] as const) {
        const ergebnis = gleicheAb([...funde], [...liste])
        expect(ergebnis.rest).toEqual([])
        expect(ergebnis.ungenutzt).toEqual([])
      }
    })
  })

  describe('unter src/', () => {
    let funde: Fund[] = []
    // Liest und parst jede Datei unter src/ (Syntaxbaum): kalt mehrere Sekunden, darum ein eigenes Limit nur hier.
    beforeAll(() => {
      funde = [...quelldateien(join(WURZEL, 'src'))].flatMap((pfad) =>
        findeVerbotene(readFileSync(pfad, 'utf8'), VERBOTE, posix(relative(WURZEL, pfad)))
      )
    }, 30_000)

    const ohneAusnahmen = (): Fund[] => funde.filter((f) => !AUSNAHMEN.some((a) => deckt(a, f)))

    it('kein Wort der Spalte „nicht" steht in einem Text — außer Ausnahmen und OFFEN_BIS_78', () => {
      const statt = new Map(VERBOTE.map((v) => [v.wort, v.statt.join(' / ')]))
      const verstoesse = gleicheAb(ohneAusnahmen(), OFFEN).rest.map(
        (f) => `${f.datei}:${f.zeile} „${f.wort}“ (statt: ${statt.get(f.wort)}): ${f.text.slice(0, 90)}`
      )
      expect(verstoesse).toEqual([])
    })

    it('jede Ausnahme hat einen Grund und steht noch so da — sonst gehört sie aus der Liste', () => {
      expect(AUSNAHMEN.filter((a) => a.grund.trim().length < 10).map((a) => `${a.datei} „${a.wort}“`)).toEqual([])
      expect(ERLAUBTE_WENDUNGEN.filter((w) => w.grund.trim().length < 5)).toEqual([])
      const ungenutzt = AUSNAHMEN.filter((a) => !funde.some((f) => deckt(a, f)))
      expect(ungenutzt.map((a) => `${a.datei} „${a.wort}“: ${a.grund}`)).toEqual([])
    })

    it('OFFEN_BIS_78: jeder Eintrag hat einen Text und steht noch so da — Erledigtes gehört gestrichen', () => {
      expect(OFFEN.filter((e) => e.text.trim() === '').map((e) => e.stelle)).toEqual([])
      const { ungenutzt } = gleicheAb(ohneAusnahmen(), OFFEN)
      expect(ungenutzt.map((e) => `${e.stelle} „${e.wort}“: ${e.text}`)).toEqual([])
    })
  })

  // Nr. 78 stellt die Texte um und macht aus dieser Zeile ein `it`. Kein stillgelegter roter Test:
  // Bis dahin ist die Liste die Arbeit von 78, und die Prüfung darüber läuft grün.
  it.skip('OFFEN_BIS_78 ist leer — jede Fundstelle ist umgestellt', () => {
    expect(OFFEN_BIS_78).toEqual([])
  })
})

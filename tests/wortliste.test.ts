/**
 * Wortliste (Register N8, docs/ai/DESIGN_SYSTEM.md „Wortliste").
 *
 * Ursache: Für dieselbe Sache standen mehrere Wörter in den Texten („Zeitfenster"
 * neben „Abholtermin", „Bestand" neben „Vorrat", „Status posten" neben „Neuer
 * Beitrag"). Wer den Hof liest, hält sie für verschiedene Dinge.
 *
 * Beweist:
 *  - Die Tabelle wird gelesen: Kopf „Sache | Wort | nicht | Beispiel", vier Spalten
 *    je Zeile, und die verbotenen Wörter aus N8 und N12 stehen in der Spalte „nicht".
 *  - Kein Wort aus „nicht" steht in einer Zeichenkette, einem Vorlagentext, einem
 *    Attribut oder einem JSX-Text unter src/ — mit Wortgrenzen und in der
 *    Schreibweise der Tabelle. Kommentare, Bezeichner und Server-Logs (console.*)
 *    zählen nicht.
 *  - Ein Rechtstext, den kein Lauf umschreibt (AGB, Register O4), steht als ganze Datei in
 *    AUSNAHME_DATEIEN, mit Grund; hat die Datei kein Wort der Liste mehr, fällt die Ausnahme auf.
 *  - Steht ein Wort in anderem Sinn richtig da (der Status einer Bestellung), steht
 *    der Text mit Grund in AUSNAHMEN — je Text, nicht je Datei, ohne Zeilennummer.
 *  - OFFEN_BIS_86 war die Arbeitsliste für Nr. 86 (die Fundstellen der neuen „nicht"-Wörter
 *    aus N12: Briefkasten, Mitteilung, Newsletter) und ist leer: Jede Fundstelle ist
 *    umgestellt oder steht als Ausnahme mit Grund da. Ein Eintrag griffe über Datei, Wort und
 *    Text, nicht über die Zeile — im Sammel-PR verschieben andere Nummern die Zeilen. Er deckt
 *    genau eine Fundstelle; ein Eintrag, hinter dem kein Text mehr steht, fällt auf.
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
 * Ganze Dateien, deren Wortlaut kein Lauf ändert: Rechtstexte, die die Projektleitung nach
 * anwaltlicher Prüfung freigibt (Register O4). Eine Ausnahme je Datei statt je Text — ein
 * Absatz mehr in der Quelle soll nicht an dieser Wache scheitern; jeder Text außerhalb der
 * Datei wird weiter geprüft. Hierher gehört nur wörtlicher Rechtstext, nie ein Bedienwort der
 * Seite (Knopf, Überschrift): AGB_SEITE_TEXT steht darum in agb-einbindung.ts, unter der Wache.
 */
type AusnahmeDatei = { datei: string; grund: string }
const AUSNAHME_DATEIEN: AusnahmeDatei[] = [
  { datei: 'src/lib/rechtstexte/agb.ts', grund: 'Rechtstext, wörtlich aus docs/recht/agb.md, Register O4' },
]

/** Die Funde ohne die der Ausnahmedateien. */
const ohneDateien = (funde: Fund[], dateien: AusnahmeDatei[]): Fund[] => funde.filter((f) => !dateien.some((d) => d.datei === f.datei))

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
  { datei: 'src/components/admin/meldungen-triage-form.tsx', wort: 'Status', text: 'Status', grund: 'Feld „Status“ der Meldung im Admin — kein Beitrag' },
  { datei: 'src/lib/meldung.ts', wort: 'Status', text: /Status setzen und bauen tust du/, grund: 'Register N14 wörtlich: den Stand einer Meldung setzen tut der Mensch — kein Beitrag' },
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
  // Briefkasten (Register N12)
  {
    datei: 'src/lib/briefkasten-export.ts',
    wort: 'Briefkasten',
    text: '# Briefkasten —',
    grund: 'Kopfzeile des Exports für den Kurator: scripts/briefkasten.ts (istExport) erkennt den Export an „# Briefkasten“ — der Kopf wechselt nur zusammen mit der CLI (Bericht 86)',
  },
  // Mitteilung (Register N12)
  { datei: 'src/lib/beitrag-anlass.ts', wort: 'Mitteilung', text: 'Mitteilung', grund: 'Anlass eines Beitrags (Register 22e), keine Nachricht im Postfach — seit Nr. 134 die einzige Stelle (BEITRAG_ANLASS; tests/anlass-woerter-wache.test.ts)' },
  // Newsletter (Register N12)
  {
    datei: 'src/app/(public)/datenschutz/page.tsx',
    wort: 'Newsletter',
    text: '9. Newsletter und Neuigkeiten von Höfen',
    grund: 'Anmeldung bei einem Hof (Neuigkeiten), Entscheidung offen (Freigabe Lauf 13: keine Änderung)',
  },
  {
    datei: 'src/emails/newsletter.tsx',
    wort: 'Newsletter',
    text: 'Du erhältst diese Nachricht, weil du den Newsletter von',
    grund: 'Anmeldung bei einem Hof (Neuigkeiten), Entscheidung offen (Freigabe Lauf 13: keine Änderung)',
  },
  // Lager
  {
    datei: 'src/lib/taxonomie.ts',
    wort: 'Lager',
    text: /Handel oder Lager\)/,
    grund: 'Lager als Tätigkeit bei der BAES-Registrierung (Lagerung von Futtermitteln), nicht der Vorrat',
  },
  // Bounce, Beschwerde, Erneut versuchen (N8-Ergänzung 24.10.2026, Nr. 161)
  {
    datei: 'src/lib/betrieb-mails.ts',
    wort: 'Bounce',
    text: /\(Bounce: das Postfach weist die Mail zurück\)/,
    grund: 'Regel-Zeile von Betrieb › E-Mails: Das Fachwort steht genau einmal erklärt (Freigabe Nr. 161 Punkt 2)',
  },
  {
    datei: 'src/app/(public)/datenschutz/page.tsx',
    wort: 'Beschwerde',
    text: /Datenschutzbehörde Beschwerde einzulegen/,
    grund: 'Rechtsbegriff der Datenschutzerklärung (Beschwerde bei der Aufsichtsbehörde), keine Spam-Meldung',
  },
  {
    datei: 'src/app/(public)/[farmSlug]/confirm/[orderId]/page.tsx',
    wort: 'Erneut versuchen',
    text: 'Erneut versuchen',
    grund: 'Kundin nach einer abgelehnten Zahlung: zurück zur Kasse — keine Mail, nicht „Jetzt schicken“ (das Wort gilt auf Admin-Seiten)',
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
 * Die Arbeitsliste von Nr. 86: Sie hielt die 23 Fundstellen der neuen „nicht"-Wörter aus N12
 * (Stand main 5e75103), bis 86 jeden Text auf das Wort der Tabelle umgestellt oder als Ausnahme
 * mit Grund eingetragen hat — jetzt ist sie leer und bleibt es (letzter Test). Wer künftig
 * mehrere Texte nummernweise umstellt, trägt sie hier ein: `stelle` ist Datei:Zeile von heute
 * (nur zum Finden; geglichen wird über Datei, Wort und Text), `text` ein Ausschnitt, `nummer`
 * die Nummer, die den Text umstellt. Eine neue Arbeitsliste
 * gibt es nur mit Freigabe (Muster 77/78: Liste und `it.skip`, bis sie leer ist).
 */
type Offen = { stelle: string; wort: string; text: string; nummer?: string }
const OFFEN_BIS_86: Offen[] = []

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

const OFFEN = OFFEN_BIS_86.map((e) => ({ ...e, datei: dateiVon(e.stelle) }))
const posix = (pfad: string): string => pfad.split(sep).join('/')

// ── Prüfungen ────────────────────────────────────────────────────────────────

describe('Wortliste', () => {
  describe('Tabelle', () => {
    it('hat in jeder Zeile Sache, Wort und Beispiel, und die verbotenen Wörter aus N8 und N12 stehen in „nicht"', () => {
      for (const z of TABELLE) {
        expect(z.sache, z.wort).not.toBe('')
        expect(z.wort, z.sache).not.toBe('')
        expect(z.beispiel, z.sache).not.toBe('')
      }
      const nicht = new Set(TABELLE.flatMap((z) => z.nicht))
      const n8 = ['Zeitfenster', 'Abholslot', 'Bestand', 'Lagerstand', 'Lager', 'Status', 'Post', 'Neuigkeit', 'Hilfe und Rückmeldung', 'Fehler melden', 'Käufer']
      const n12 = ['Briefkasten', 'Posteingang', 'Mitteilung', 'Benachrichtigung', 'Newsletter', 'Chat', 'Thread', 'Konversation']
      for (const wort of [...n8, ...n12]) {
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

    it('Gegenprobe (N12): schlägt an bei Briefkasten, Mitteilung und Newsletter — nicht bei Postfach, Betriebsmitteilung oder einem längeren Wort', () => {
      const schnipsel = [
        "const a = 'Neu im Briefkasten'",
        'const b = <p>Newsletter von uns</p>',
        'const c = <Feld label="Mitteilung" />',
        // Das alles zählt nicht:
        "const d = 'Postfach · 2, Betriebsmitteilung, Briefkastenschlüssel, Postfachnummer'",
        '// Briefkasten im Kommentar',
        'const BriefkastenLaden = 1',
      ].join('\n')
      expect(findeVerbotene(schnipsel, VERBOTE).map((f) => `${f.zeile} ${f.wort}`)).toEqual(['1 Briefkasten', '2 Newsletter', '3 Mitteilung'])
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

    it('Gegenprobe: eine Ausnahmedatei nimmt nur ihre eigenen Funde aus, nie die einer anderen Datei', () => {
      const fund = (datei: string): Fund => ({ datei, zeile: 1, wort: 'Mitteilung', text: 'Mitteilung' })
      const rest = ohneDateien([fund('src/lib/rechtstexte/a.ts'), fund('src/lib/b.ts')], [{ datei: 'src/lib/rechtstexte/a.ts', grund: 'Probe der Ausnahme' }])
      expect(rest.map((f) => f.datei)).toEqual(['src/lib/b.ts'])
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

    const ohneAusnahmen = (): Fund[] => ohneDateien(funde, AUSNAHME_DATEIEN).filter((f) => !AUSNAHMEN.some((a) => deckt(a, f)))

    it('kein Wort der Spalte „nicht" steht in einem Text — außer Ausnahmen und OFFEN_BIS_86', () => {
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
      // Eine Ausnahmedatei hat einen Grund und trägt noch ein Wort der Liste — sonst gehört sie aus der Liste.
      expect(AUSNAHME_DATEIEN.filter((d) => d.grund.trim().length < 10).map((d) => d.datei)).toEqual([])
      expect(AUSNAHME_DATEIEN.filter((d) => !funde.some((f) => f.datei === d.datei)).map((d) => d.datei)).toEqual([])
    })

    it('OFFEN_BIS_86: jeder Eintrag hat einen Text und steht noch so da — Erledigtes gehört gestrichen', () => {
      expect(OFFEN.filter((e) => e.text.trim() === '').map((e) => e.stelle)).toEqual([])
      const { ungenutzt } = gleicheAb(ohneAusnahmen(), OFFEN)
      expect(ungenutzt.map((e) => `${e.stelle} „${e.wort}“: ${e.text}`)).toEqual([])
    })
  })

  // Seit Nr. 86 gilt die Tabelle ohne Arbeitsliste: Ein Eintrag in OFFEN_BIS_86 macht diesen Test rot.
  it('OFFEN_BIS_86 ist leer — jede Fundstelle ist umgestellt', () => {
    expect(OFFEN_BIS_86).toEqual([])
  })
})

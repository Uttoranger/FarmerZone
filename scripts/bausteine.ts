/**
 * Bausteinverzeichnis (Register G4): erzeugt docs/ai/BAUSTEINE.md aus dem Code.
 * Aufruf: `pnpm bausteine`. Die Datei ist erzeugt und wird nie von Hand
 * geändert; tests/bausteine-verzeichnis.test.ts hält sie aktuell.
 *
 * Je Datei unter src/components, src/lib und src/server eine Zeile: Pfad,
 * Exporte, Zweck, Status. Der Zweck ist der erste Satz des Kopf- oder
 * JSDoc-Kommentars der Datei, der Status ergibt sich aus den Importen. Ein Tag
 * `@altbestand <Ersatz>` im Kopfkommentar macht eine Datei zum Altbestand.
 *
 * Gelesen wird nur der Syntaxbaum von TypeScript (kein Typprüfer, kein neues
 * Paket): schnell, ohne Umgebung und ohne Datenbank. Die Ausgabe hängt nur vom
 * Inhalt der Dateien ab — sortiert, ohne Datum, ohne absolute Pfade —, damit
 * zwei Läufe dieselbe Datei ergeben und der Test sie vergleichen kann.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import ts from 'typescript'

export const BAUSTEINE_PFAD = 'docs/ai/BAUSTEINE.md'

/** Diese Ordner stehen im Verzeichnis (alle liegen unter src/ und damit auch bei den Nutzern). */
const VERZEICHNIS_ORDNER = ['src/components', 'src/lib', 'src/server']

/**
 * Aus diesen Ordnern (und den Dateien im Wurzelordner, etwa next.config.ts)
 * zählt ein Import als Nutzung. tests/ gehört bewusst nicht dazu: Ein Baustein,
 * den nur ein Test kennt, wird im Betrieb nicht gebraucht.
 */
const NUTZER_ORDNER = ['src', 'scripts', 'prisma']

const KEIN_ZWECK = 'kein Zweck vermerkt'
const KEIN_ERSATZ = 'kein Ersatz genannt'

/** Längere erste Sätze werden gekürzt, damit eine Zeile überschaubar bleibt. */
const ZWECK_MAX_ZEICHEN = 200

/**
 * Abkürzungen, nach denen kein Satz endet. Einzelne Buchstaben („z. B.“,
 * „d. h.“) und Zahlen vor dem Punkt („3. Oktober“) prüft der Satzfinder selbst.
 */
const ABKUERZUNGEN = new Set(['bzw', 'ca', 'etc', 'evtl', 'ggf', 'inkl', 'max', 'min', 'nr', 'sog', 'usw', 'vgl'])

const KOPF = [
  '# Bausteinverzeichnis',
  '',
  'Erzeugt mit pnpm bausteine – nicht von Hand ändern.',
  '',
  'Vor jeder neuen Datei, Komponente oder Funktion das Stichwort hier suchen (`grep -i <stichwort> docs/ai/BAUSTEINE.md`): Gibt es das schon, wird es benutzt oder additiv erweitert, nicht neu gebaut.',
  '',
  'Erfasst sind src/components, src/lib und src/server, eine Zeile je Datei: Pfad · Exporte (Werte, dann „type …“) · Zweck · Status.',
  '',
  '- Zweck: der erste Satz des ersten Kommentars, der die Datei beschreibt (am Dateikopf oder vor einem Export); ohne ihn „kein Zweck vermerkt“.',
  '- genutzt: mindestens eine andere Datei außerhalb von tests/ bindet sie ein (import, import() oder export … from). Eine Datei, die nur ein ebenfalls unbenutzter Baustein einbindet, gilt als genutzt.',
  '- unbenutzt: kein solcher Import — aufräumen oder einhängen; vor dem Löschen mit grep gegenprüfen.',
  '- Altbestand → Ersatz: Der Kopfkommentar der Datei trägt die Zeile `@altbestand <Ersatz>`. Neuer Code nimmt den Ersatz.',
  '- Merge-Konflikt in dieser Datei: nicht von Hand mischen, `pnpm bausteine` neu ausführen.',
  '',
]

export type BausteinStatus = { art: 'genutzt' } | { art: 'unbenutzt' } | { art: 'altbestand'; ersatz: string }

export interface Baustein {
  /** Pfad ab der Projektwurzel, immer mit "/". */
  pfad: string
  /** Wert-Exporte (Funktionen, Konstanten, Klassen, `default`), sortiert. */
  exporte: string[]
  /** Reine Typ-Exporte, sortiert. */
  typen: string[]
  /** Erster Satz des ersten Kommentars, oder null. */
  zweck: string | null
  status: BausteinStatus
}

interface DateiInfo {
  exporte: string[]
  typen: string[]
  /** Module, die die Datei einbindet, so wie sie im Quelltext stehen. */
  importe: string[]
  /** Die Kommentare auf oberster Ebene, in der Reihenfolge der Datei. */
  kommentare: Kommentar[]
}

/** Ein Kommentar vor einer Anweisung auf oberster Ebene. */
interface Kommentar {
  /** Der Text in Zeilen, ohne `//`, `/*` und `*` am Zeilenanfang. */
  zeilen: string[]
  /** Steht vor der ersten Anweisung der Datei. */
  amKopf: boolean
  /** Gehört zu einer exportierten Anweisung. */
  anExport: boolean
  /** Eine Leerzeile trennt ihn von der Anweisung: Er beschreibt die Datei, nicht die Anweisung. */
  abgesetzt: boolean
}

function vergleiche(a: string, b: string): number {
  // Nicht localeCompare: Dessen Reihenfolge hängt vom ICU-Stand des Rechners ab.
  return a < b ? -1 : a > b ? 1 : 0
}

function sammleQuelldateien(wurzel: string, ordner: string): string[] {
  if (!existsSync(join(wurzel, ordner))) return []
  return readdirSync(join(wurzel, ordner), { withFileTypes: true }).flatMap((eintrag) => {
    const pfad = `${ordner}/${eintrag.name}`
    if (eintrag.isDirectory()) return sammleQuelldateien(wurzel, pfad)
    return /\.tsx?$/.test(eintrag.name) ? [pfad] : []
  })
}

function sammleWurzeldateien(wurzel: string): string[] {
  return readdirSync(wurzel, { withFileTypes: true })
    .filter((eintrag) => eintrag.isFile() && /\.m?tsx?$/.test(eintrag.name))
    .map((eintrag) => eintrag.name)
}

/**
 * Löst einen Import auf eine Datei im Projekt auf. Der Alias `@/` ist `src/`
 * (tsconfig). Pakete und Dateien außerhalb der bekannten Quellen ergeben null.
 */
export function loeseImportAuf(spezifizierer: string, vonPfad: string, bekannt: ReadonlySet<string>): string | null {
  let basis: string
  if (spezifizierer.startsWith('@/')) basis = `src/${spezifizierer.slice(2)}`
  else if (spezifizierer.startsWith('.')) basis = posix.join(posix.dirname(vonPfad), spezifizierer)
  else return null
  return [basis, `${basis}.ts`, `${basis}.tsx`, `${basis}/index.ts`, `${basis}/index.tsx`].find((kandidat) => bekannt.has(kandidat)) ?? null
}

function sammleBindungsnamen(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text]
  return name.elements.flatMap((element) => (ts.isOmittedExpression(element) ? [] : sammleBindungsnamen(element.name)))
}

function hatModifikator(anweisung: ts.Statement, art: ts.SyntaxKind): boolean {
  return (ts.canHaveModifiers(anweisung) ? ts.getModifiers(anweisung) : undefined)?.some((m) => m.kind === art) ?? false
}

function sammleExporte(datei: ts.SourceFile): { werte: string[]; typen: string[] } {
  const werte = new Set<string>()
  const typen = new Set<string>()
  for (const anweisung of datei.statements) {
    const standard = hatModifikator(anweisung, ts.SyntaxKind.DefaultKeyword)
    if (hatModifikator(anweisung, ts.SyntaxKind.ExportKeyword)) {
      if (ts.isVariableStatement(anweisung)) {
        for (const deklaration of anweisung.declarationList.declarations) sammleBindungsnamen(deklaration.name).forEach((n) => werte.add(n))
      } else if (ts.isInterfaceDeclaration(anweisung) || ts.isTypeAliasDeclaration(anweisung)) {
        typen.add(standard ? 'default' : anweisung.name.text)
      } else if (ts.isFunctionDeclaration(anweisung) || ts.isClassDeclaration(anweisung) || ts.isEnumDeclaration(anweisung)) {
        werte.add(standard || !anweisung.name ? 'default' : anweisung.name.text)
      } else if (ts.isModuleDeclaration(anweisung) || ts.isImportEqualsDeclaration(anweisung)) {
        werte.add(anweisung.name.text)
      }
    } else if (ts.isExportDeclaration(anweisung)) {
      const klausel = anweisung.exportClause
      if (!klausel) (anweisung.isTypeOnly ? typen : werte).add('*')
      else if (ts.isNamespaceExport(klausel)) werte.add(klausel.name.text)
      else for (const element of klausel.elements) (anweisung.isTypeOnly || element.isTypeOnly ? typen : werte).add(element.name.text)
    } else if (ts.isExportAssignment(anweisung)) {
      werte.add(anweisung.isExportEquals ? 'export=' : 'default')
    }
  }
  // Ein Name, der als Wert und als Typ existiert (`const X` und `type X`), steht nur einmal.
  return { werte: [...werte].sort(vergleiche), typen: [...typen].filter((t) => !werte.has(t)).sort(vergleiche) }
}

function sammleImporte(datei: ts.SourceFile, text: string): string[] {
  const importe: string[] = []
  for (const anweisung of datei.statements) {
    if (ts.isImportDeclaration(anweisung) || ts.isExportDeclaration(anweisung)) {
      // `export { a }` ohne `from` hat keine Herkunft.
      if (anweisung.moduleSpecifier && ts.isStringLiteral(anweisung.moduleSpecifier)) importe.push(anweisung.moduleSpecifier.text)
    } else if (ts.isImportEqualsDeclaration(anweisung) && ts.isExternalModuleReference(anweisung.moduleReference)) {
      const ausdruck = anweisung.moduleReference.expression
      if (ts.isStringLiteral(ausdruck)) importe.push(ausdruck.text)
    }
  }
  // import('…'), require('…') und typeof import('…') stehen irgendwo im Baum; den Durchlauf
  // spart sich jede Datei, in der es sie nicht geben kann.
  if (/\b(import|require)\s*\(/.test(text)) {
    const besuche = (knoten: ts.Node): void => {
      if (ts.isCallExpression(knoten) && knoten.arguments.length > 0) {
        const istImport = knoten.expression.kind === ts.SyntaxKind.ImportKeyword
        const istRequire = ts.isIdentifier(knoten.expression) && knoten.expression.text === 'require'
        const herkunft = knoten.arguments[0]
        if ((istImport || istRequire) && ts.isStringLiteralLike(herkunft)) importe.push(herkunft.text)
      } else if (ts.isImportTypeNode(knoten) && ts.isLiteralTypeNode(knoten.argument) && ts.isStringLiteral(knoten.argument.literal)) {
        importe.push(knoten.argument.literal.text)
      }
      ts.forEachChild(knoten, besuche)
    }
    besuche(datei)
  }
  return importe
}

/** Trennlinien wie „─── Profile ───“ sind Schmuck, kein Inhalt. */
function entferneZierlinien(zeile: string): string {
  return zeile.replace(/[─━═]{2,}|[-=_~*]{4,}/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Der Text eines Kommentars in Zeilen: ohne `//`, `/*`, `*` am Zeilenanfang, getrimmt, einfache Leerzeichen. */
function zerlegeKommentar(roh: string, mehrzeilig: boolean): string[] {
  if (mehrzeilig) {
    return roh
      .replace(/^\/\*+/, '')
      .replace(/\*+\/$/, '')
      .split('\n')
      .map((zeile) => entferneZierlinien(zeile.replace(/^\s*\*?\s?/, '')))
  }
  return roh.split('\n').map((zeile) => entferneZierlinien(zeile.replace(/^\s*\/\/+\s?/, '')))
}

/**
 * Die Kommentare vor den Anweisungen auf oberster Ebene — Kopf oder JSDoc, vor
 * oder nach den Importen. Aufeinanderfolgende `//`-Zeilen sind einer. Von jeder
 * Anweisung zählt nur der erste Kommentar; Kommentare im Rumpf einer Funktion
 * und Kommentare hinter einer Zeile zählen nicht.
 */
function sammleKommentare(datei: ts.SourceFile, text: string): Kommentar[] {
  const kommentare: Kommentar[] = []
  datei.statements.forEach((anweisung, index) => {
    const bereiche = ts.getLeadingCommentRanges(text, anweisung.getFullStart())
    if (!bereiche || bereiche.length === 0) return
    const erster = bereiche[0]
    const mehrzeilig = erster.kind === ts.SyntaxKind.MultiLineCommentTrivia
    let ende = erster.end
    if (!mehrzeilig) {
      for (const naechster of bereiche.slice(1)) {
        const dazwischen = text.slice(ende, naechster.pos)
        if (naechster.kind !== ts.SyntaxKind.SingleLineCommentTrivia || !/^[ \t]*\n[ \t]*$/.test(dazwischen)) break
        ende = naechster.end
      }
    }
    kommentare.push({
      zeilen: zerlegeKommentar(text.slice(erster.pos, ende), mehrzeilig),
      amKopf: index === 0,
      anExport: hatModifikator(anweisung, ts.SyntaxKind.ExportKeyword) || ts.isExportDeclaration(anweisung) || ts.isExportAssignment(anweisung),
      abgesetzt: /\n[ \t]*\n/.test(text.slice(ende, anweisung.getStart(datei))),
    })
  })
  return kommentare
}

function liesDatei(wurzel: string, pfad: string): DateiInfo {
  // CRLF vereinheitlichen, damit Zeilenkommentare unter Windows gleich ausgewertet werden.
  const text = readFileSync(join(wurzel, pfad), 'utf8').replace(/\r\n/g, '\n')
  const art = pfad.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const datei = ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, false, art)
  const { werte, typen } = sammleExporte(datei)
  return { exporte: werte, typen, importe: sammleImporte(datei, text), kommentare: sammleKommentare(datei, text) }
}

function zaehleVorkommen(text: string, zeichen: string): number {
  return text.split(zeichen).length - 1
}

/** Steht eine Klammer oder ein Anführungszeichen noch offen, ist der Satz nicht zu Ende. */
function istAusgeglichen(text: string): boolean {
  const offenDeutsch = zaehleVorkommen(text, '„') > zaehleVorkommen(text, '“') + zaehleVorkommen(text, '"')
  const offenGerade = !text.includes('„') && zaehleVorkommen(text, '"') % 2 === 1
  return zaehleVorkommen(text, '(') <= zaehleVorkommen(text, ')') && !offenDeutsch && !offenGerade
}

/**
 * Der erste Satz. Ein Punkt beendet ihn nur vor einem Großbuchstaben, nicht
 * nach einer Abkürzung, einem einzelnen Buchstaben („z. B.“) oder einer
 * Ordnungszahl („am 3. Oktober“) und nicht in einer offenen Klammer oder
 * einem offenen Zitat.
 */
function findeErstenSatz(text: string): string {
  for (const treffer of text.matchAll(/[.!?](?=\s|$)/g)) {
    const ende = treffer.index + 1
    const wort = /([\p{L}\p{N}]+)([)\]"'“”«»‘’]*)$/u.exec(text.slice(0, treffer.index))
    if (wort) {
      const [, buchstaben, schluss] = wort
      if (buchstaben.length === 1 || ABKUERZUNGEN.has(buchstaben.toLowerCase())) continue
      if (schluss === '' && /^\d+$/.test(buchstaben)) continue
    }
    const rest = text.slice(ende).trimStart()
    if (rest !== '' && /^\p{Ll}/u.test(rest)) continue
    if (!istAusgeglichen(text.slice(0, ende))) continue
    return text.slice(0, ende)
  }
  return text
}

function kuerze(satz: string): string {
  if (satz.length <= ZWECK_MAX_ZEICHEN) return satz
  const schnitt = satz.lastIndexOf(' ', ZWECK_MAX_ZEICHEN - 1)
  return `${satz.slice(0, schnitt > 0 ? schnitt : ZWECK_MAX_ZEICHEN - 1)} …`
}

/**
 * Zweck und Ersatz aus den Kommentaren. Den Zweck liefert der erste Kommentar,
 * der die Datei beschreibt: der am Kopf, der vor einer exportierten Anweisung
 * oder der durch eine Leerzeile abgesetzte — nicht der einer Hilfsfunktion
 * oder Konstante, die nur in der Datei vorkommt. Das Tag `@altbestand` gilt
 * in jedem Kommentar der Datei.
 */
function bestimmeZweckUndErsatz(kommentare: Kommentar[]): { zweck: string | null; ersatz: string | null } {
  const beschreibung: string[] = []
  for (const zeile of kommentare.find((k) => k.amKopf || k.anExport || k.abgesetzt)?.zeilen ?? []) {
    if (zeile.startsWith('@')) break // JSDoc-Tags beschreiben nichts mehr
    if (zeile === '') {
      if (beschreibung.length > 0) break // der erste Absatz endet an der Leerzeile
      continue
    }
    beschreibung.push(zeile)
  }
  const satz = findeErstenSatz(beschreibung.join(' '))
  const tag = kommentare
    .flatMap((k) => k.zeilen)
    .map((zeile) => /^@altbestand\b\s*(.*)$/.exec(zeile))
    .find((treffer) => treffer !== null)
  const ersatz = tag ? tag[1] || KEIN_ERSATZ : null
  return { zweck: satz === '' ? null : kuerze(satz), ersatz }
}

/** Altbestand geht vor: Ein Baustein, der noch benutzt wird, bleibt trotzdem abgelöst. */
function bestimmeStatus(ersatz: string | null, genutzt: boolean): BausteinStatus {
  if (ersatz !== null) return { art: 'altbestand', ersatz }
  return { art: genutzt ? 'genutzt' : 'unbenutzt' }
}

/** Alle Bausteine in fester Reihenfolge (Ordner, dann Datei). */
export function ermittleBausteine(wurzel: string): Baustein[] {
  const ausOrdner = (ordner: string): string[] => sammleQuelldateien(wurzel, ordner)
  const quellen = [...new Set([...NUTZER_ORDNER.flatMap(ausOrdner), ...sammleWurzeldateien(wurzel)])]
  const dateien = quellen.map((pfad) => ({ pfad, info: liesDatei(wurzel, pfad) }))
  const bekannt = new Set(quellen)

  // Genutzt ist, was irgendeine andere Datei außerhalb von tests/ einbindet.
  const genutzt = new Set<string>()
  for (const { pfad, info } of dateien) {
    for (const spezifizierer of info.importe) {
      const ziel = loeseImportAuf(spezifizierer, pfad, bekannt)
      if (ziel !== null && ziel !== pfad) genutzt.add(ziel)
    }
  }

  return dateien
    .filter(({ pfad }) => VERZEICHNIS_ORDNER.some((ordner) => pfad.startsWith(`${ordner}/`)))
    .sort((a, b) => vergleiche(posix.dirname(a.pfad), posix.dirname(b.pfad)) || vergleiche(a.pfad, b.pfad))
    .map(({ pfad, info }): Baustein => {
      const { zweck, ersatz } = bestimmeZweckUndErsatz(info.kommentare)
      return { pfad, exporte: info.exporte, typen: info.typen, zweck, status: bestimmeStatus(ersatz, genutzt.has(pfad)) }
    })
}

function formatiereStatus(status: BausteinStatus): string {
  return status.art === 'altbestand' ? `Altbestand → ${status.ersatz}` : status.art
}

function formatiereBausteine(bausteine: Baustein[]): string {
  const zeilen = [...KOPF]
  let ordner = ''
  for (const baustein of bausteine) {
    const neuerOrdner = posix.dirname(baustein.pfad)
    if (neuerOrdner !== ordner) {
      if (ordner !== '') zeilen.push('')
      zeilen.push(`## ${neuerOrdner}`, '')
      ordner = neuerOrdner
    }
    const exporte = [...baustein.exporte, ...baustein.typen.map((typ) => `type ${typ}`)]
    const felder = [baustein.pfad, exporte.length > 0 ? exporte.join(', ') : '–', baustein.zweck ?? KEIN_ZWECK, formatiereStatus(baustein.status)]
    zeilen.push(`- ${felder.join(' · ')}`)
  }
  return `${zeilen.join('\n')}\n`
}

/** Das ganze Verzeichnis als Text — ohne etwas zu schreiben (so ruft es der Test auf). */
export function erzeugeBausteine(wurzel: string): string {
  return formatiereBausteine(ermittleBausteine(wurzel))
}

/** Schreibt docs/ai/BAUSTEINE.md und meldet die Zahlen für die Ausgabe im Terminal. */
export function schreibeBausteine(wurzel: string): { dateien: number; unbenutzt: number; ohneZweck: number } {
  const bausteine = ermittleBausteine(wurzel)
  mkdirSync(dirname(join(wurzel, BAUSTEINE_PFAD)), { recursive: true })
  writeFileSync(join(wurzel, BAUSTEINE_PFAD), formatiereBausteine(bausteine), 'utf8')
  return {
    dateien: bausteine.length,
    unbenutzt: bausteine.filter((b) => b.status.art === 'unbenutzt').length,
    ohneZweck: bausteine.filter((b) => b.zweck === null).length,
  }
}

if (/bausteine\.(ts|js|mjs|cjs)$/.test(process.argv[1] ?? '')) {
  const zahlen = schreibeBausteine(process.cwd())
  console.log(`${BAUSTEINE_PFAD} geschrieben: ${zahlen.dateien} Dateien, ${zahlen.unbenutzt} unbenutzt, ${zahlen.ohneZweck} ohne Zweck.`)
}

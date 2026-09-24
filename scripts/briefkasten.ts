/**
 * Briefkasten-CLI — LIEST, und schreibt genau zwei Vorschläge über die
 * Schreibroute. Aufruf: `pnpm briefkasten <befehl> [Optionen]`.
 *
 *   list   [--status NEU,GEPRUEFT] [--art FEHLER]   eine Zeile je Meldung (nur Datenbank-Weg)
 *   show   <kurznummer|id>                         eine Meldung als Markdown
 *   export [--status …] [--art …]                  der Briefkasten als Markdown (stdout)
 *   geplant <kurznummer|id> --pr <nr>              ein Fehler wird in PR <nr> behoben
 *   vermutlich-wunsch <kurznummer|id> --grund "…"  Vorschlag: das ist ein Wunsch
 *
 * DIE ZWEI SCHREIBBEFEHLE (Sprint Briefkasten-Rückkopplung) gehen NUR über
 * POST /api/triage/status mit TRIAGE_WRITE_TOKEN — nie über die Datenbank.
 * Dieser Token darf nichts abschließen: ERLEDIGT setzt das Production-
 * Deployment mit einem Token, den es auf diesem Rechner nicht gibt. Deshalb
 * gibt es hier keinen `erledigt`-Befehl, und „Vermutlich Wunsch" ist nur ein
 * Vorschlag, über den der Mensch im Admin entscheidet.
 *
 * ZWEI WEGE ZUM LESEN (Sprint triage-leseroute):
 *   1. LESEROUTE (empfohlen): TRIAGE_EXPORT_URL + TRIAGE_TOKEN gesetzt → das
 *      CLI holt den Export per HTTPS von /api/triage/export (tokengeschützt,
 *      ausschließlich GET) und gibt ihn unverändert aus. Braucht keinen
 *      Datenbankzugang — die App erzeugt den Export selbst.
 *   2. DATENBANKROLLE: sonst über TRIAGE_DATABASE_URL, eine Rolle mit nichts
 *      als SELECT. Nur für Umgebungen mit Direktzugang zur Datenbank.
 *   Sind beide konfiguriert, gewinnt die Leseroute. Fehlt beides: Hinweis,
 *   welche zwei Varianten es gibt — und NIE ein Fallback auf DATABASE_URL.
 *
 * WARUM KEIN ABSCHLUSS, UND ZWAR ERZWUNGEN: Dieses Skript ist dafür gedacht,
 * den Briefkasten in Claude Code zu sichten — also von einem Agenten gelesen
 * zu werden, der anschließend Code schreibt. Ein Agent, der Tickets liest und
 * Code schreibt, darf keine Tickets schließen. Er darf vorschlagen („Vermutlich
 * Wunsch") und planen („Geplant", mit PR-Nummer); abschließen tut das
 * Deployment, entscheiden der Mensch im Admin (Server-Action mit isAdmin).
 *
 * Bewusst KEIN Import aus src/lib/env.ts oder src/lib/prisma.ts: Die Module
 * validieren beim Laden die Pflichtvariablen der App (DATABASE_URL, Stripe …)
 * bzw. bauen den Schreib-Client — beides hat dieses Skript weder nötig noch
 * soll es sie anfassen.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  EXPORT_AUSWAHL,
  EXPORT_MAX,
  briefkastenAlsListe,
  briefkastenAlsMarkdown,
  einzelmeldungAlsMarkdown,
  meldungAlsMarkdown,
  type ExportMeldung,
} from '../src/lib/briefkasten-export'
import {
  MELDUNG_STATUS,
  STATUS_INTERN,
  STATUS_OFFEN,
  istMeldungArt,
  istMeldungStatus,
  type MeldungArt,
  type MeldungStatus,
} from '../src/lib/meldung'

export const FEHLT_ZUGANG = [
  'Kein Zugang zum Briefkasten konfiguriert. Zwei Wege (in .env.local, nur lokal):',
  '  1. Leseroute (empfohlen):  TRIAGE_EXPORT_URL=https://<app>/api/triage/export',
  '                             TRIAGE_TOKEN=<derselbe Wert wie in Vercel>',
  '  2. Datenbankrolle:         TRIAGE_DATABASE_URL=postgresql://triage_leser:…',
  '                             (nur SELECT; braucht Direktzugang zur Datenbank)',
  'Das CLI liest in beiden Fällen nur und fällt nie auf DATABASE_URL zurück.',
  'Anleitung: DEVELOPMENT.md, Abschnitt „Triage (Fehlerbriefkasten)".',
].join('\n')

/** Halb eingerichtete Leseroute — sagen, welche Hälfte fehlt, statt sie stillschweigend zu übergehen. */
export function halbeRouteHinweis(env: Record<string, string | undefined>): string | null {
  const url = env.TRIAGE_EXPORT_URL?.trim()
  const token = env.TRIAGE_TOKEN?.trim()
  if (url && !token) return 'Hinweis: TRIAGE_EXPORT_URL ist gesetzt, TRIAGE_TOKEN fehlt — die Leseroute bleibt ungenutzt.'
  if (token && !url) return 'Hinweis: TRIAGE_TOKEN ist gesetzt, TRIAGE_EXPORT_URL fehlt — die Leseroute bleibt ungenutzt.'
  return null
}

export const NUR_EXPORT_UEBER_ROUTE =
  'Über die Leseroute gibt es `export` und `show`. `list` braucht die Datenbankrolle ' +
  '(TRIAGE_DATABASE_URL) — oder nimm `pnpm briefkasten export`: eine Überschrift je Meldung.'

/**
 * Die Antwort der Leseroute muss ein Briefkasten-Export sein. Ohne diese Probe
 * landete die Anmeldeseite eines Zwischenservers (Status 200, HTML) als
 * „Briefkasten" auf stdout — und damit im Kontext eines Agenten, der daraus
 * Vorschläge ableitet.
 */
export function istExport(text: string): boolean {
  return text.trimStart().startsWith('# Briefkasten')
}

export const KEIN_EXPORT =
  'Die Antwort der Leseroute ist kein Briefkasten-Export. Zeigt TRIAGE_EXPORT_URL wirklich ' +
  'auf /api/triage/export — und liegt kein Zwischenserver (Anmeldeseite, Schutzwall) davor?'

export type Filter = { status: MeldungStatus[]; art: MeldungArt | null }

export type Befehl =
  | { art: 'list'; filter: Filter }
  | { art: 'export'; filter: Filter }
  | { art: 'show'; ziel: string }
  | { art: 'geplant'; ziel: string; pr: number }
  | { art: 'vermutlich-wunsch'; ziel: string; grund: string }
  | { art: 'hilfe'; grund?: string }

/** Der Leser — die einzige Berührung mit der Datenbank, und die kennt nur SELECT. */
export type Leser = {
  lade(filter: Filter): Promise<ExportMeldung[]>
  finde(idOderKurz: string): Promise<ExportMeldung | null>
  schliessen(): Promise<void>
}

/** Der Holer — die einzige Berührung mit der Leseroute: ein GET mit Bearer-Token. */
export type Holer = (url: string, token: string) => Promise<{ status: number; text: string }>

/** Der Sender — die einzige Berührung mit der Schreibroute: ein POST mit Bearer-Token. */
export type Sender = (url: string, token: string, body: Record<string, unknown>) => Promise<{ status: number; text: string }>

export function parseArgs(argv: readonly string[]): Befehl {
  const [befehl, ...rest] = argv
  const option = (name: string): string | null => {
    const i = rest.indexOf(`--${name}`)
    return i >= 0 && rest[i + 1] !== undefined ? rest[i + 1] : null
  }
  const filter = (): Filter => {
    const status = (option('status') ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(istMeldungStatus)
    const artRoh = option('art')?.toUpperCase() ?? null
    return { status: status.length > 0 ? status : [...STATUS_OFFEN], art: istMeldungArt(artRoh) ? artRoh : null }
  }
  if (befehl === 'list') return { art: 'list', filter: filter() }
  if (befehl === 'export') return { art: 'export', filter: filter() }
  if (befehl === 'show') {
    const ziel = rest[0]
    return ziel ? { art: 'show', ziel } : { art: 'hilfe', grund: 'show braucht eine Kurznummer oder ID.' }
  }
  if (befehl === 'geplant' || befehl === 'vermutlich-wunsch') {
    const ziel = rest[0]
    if (!ziel || ziel.startsWith('--')) return { art: 'hilfe', grund: `${befehl} braucht eine Kurznummer oder ID.` }
    if (befehl === 'geplant') {
      const pr = Number(option('pr'))
      return Number.isInteger(pr) && pr > 0
        ? { art: 'geplant', ziel, pr }
        : { art: 'hilfe', grund: 'geplant braucht --pr <nr>, die Nummer des PR, der den Fehler behebt.' }
    }
    const grund = option('grund')?.trim()
    return grund
      ? { art: 'vermutlich-wunsch', ziel, grund }
      : { art: 'hilfe', grund: 'vermutlich-wunsch braucht --grund "<in eigenen Worten, warum es ein Wunsch ist>".' }
  }
  if (befehl === 'erledigt') return { art: 'hilfe', grund: KEIN_ERLEDIGT }
  return { art: 'hilfe', grund: befehl ? `Unbekannter Befehl: ${befehl}` : undefined }
}

export const KEIN_ERLEDIGT =
  'Es gibt keinen Befehl „erledigt": ERLEDIGT setzt das Production-Deployment, nie das CLI und nie ein Agent.'

export const HILFE = [
  'Briefkasten-CLI',
  '  pnpm briefkasten export [--status …] [--art …]   → Markdown auf stdout',
  '  pnpm briefkasten show   <kurznummer|id>',
  '  pnpm briefkasten list   [--status NEU,GEPRUEFT] [--art FEHLER|WUNSCH|FRAGE]   (nur Datenbank-Weg)',
  '  pnpm briefkasten geplant <kurznummer|id> --pr <nr>                 (nur Fehler)',
  '  pnpm briefkasten vermutlich-wunsch <kurznummer|id> --grund "…"     (Vorschlag, der Mensch entscheidet)',
  `Voreinstellung Status: ${STATUS_OFFEN.join(',')}. Alle: --status ${MELDUNG_STATUS.join(',')}`,
  'Lesen: TRIAGE_EXPORT_URL + TRIAGE_TOKEN (Leseroute, empfohlen) oder TRIAGE_DATABASE_URL (Datenbankrolle).',
  'Schreiben: TRIAGE_EXPORT_URL + TRIAGE_WRITE_TOKEN. ERLEDIGT gibt es hier nicht — das setzt das Deployment.',
].join('\n')

// ─── Weg wählen ─────────────────────────────────────────────────────────────

export type Weg =
  | { art: 'route'; url: string; token: string }
  | { art: 'db'; url: string }
  | { art: 'keiner' }

/** Leseroute vor Datenbankrolle; leere Werte gelten als nicht gesetzt. Rein, damit prüfbar. */
export function waehleWeg(env: Record<string, string | undefined>): Weg {
  const exportUrl = env.TRIAGE_EXPORT_URL?.trim()
  const token = env.TRIAGE_TOKEN?.trim()
  if (exportUrl && token) return { art: 'route', url: exportUrl, token }
  const dbUrl = env.TRIAGE_DATABASE_URL?.trim()
  if (dbUrl) return { art: 'db', url: dbUrl }
  return { art: 'keiner' }
}

/**
 * Die Adresse des Exports mit Filter — dieselben Parameter, die die Route liest.
 * Wirft bei einer unbrauchbaren Basis-Adresse; der Aufrufer übersetzt das in
 * einen Hinweis auf TRIAGE_EXPORT_URL (ein Tippfehler dort ist kein Netzfehler).
 */
export function exportAdresse(basis: string, filter: Filter): string {
  const url = new URL(basis)
  url.searchParams.set('status', filter.status.join(','))
  if (filter.art) url.searchParams.set('art', filter.art)
  else url.searchParams.delete('art')
  return url.toString()
}

export const UNGUELTIGE_EXPORT_URL =
  'TRIAGE_EXPORT_URL ist keine gültige Adresse. Erwartet wird die volle Adresse ' +
  'der Leseroute, z. B. https://<app>/api/triage/export'

/**
 * `show` über die Leseroute: der Abschnitt EINER Meldung aus dem Export. Die
 * Abschnitte beginnen mit `## <kurznummer> · …` (meldungAlsMarkdown) — das
 * Ziel darf Kurznummer, Präfix davon oder die volle ID sein, wie im
 * Datenbank-Weg (startsWith).
 */
export function schnittAusExport(markdown: string, ziel: string): string | null {
  const abschnitte = markdown.split(/\n(?=## )/)
  for (const abschnitt of abschnitte) {
    if (!abschnitt.startsWith('## ')) continue
    const kurz = abschnitt.slice(3).split(' · ')[0]?.trim() ?? ''
    if (kurz && (ziel.startsWith(kurz) || kurz.startsWith(ziel))) return abschnitt.trimEnd()
  }
  return null
}

// ─── Schreibbefehle ─────────────────────────────────────────────────────────

export const STATUS_IM_ADMIN = 'Status bitte im Admin setzen.'

export const NUR_HTTPS =
  'Der Schreib-Token geht nur über https:// — TRIAGE_EXPORT_URL zeigt auf eine unverschlüsselte Adresse.'

/** Den Schreib-Token nie im Klartext übers Netz; nur lokal (Entwicklung) ist http erlaubt. */
export function sichereAdresse(adresse: string): boolean {
  const url = new URL(adresse)
  return url.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
}

/** Die Schreibroute liegt neben der Leseroute — derselbe Host, anderer Pfad. */
export function statusAdresse(exportUrl: string): string {
  return new URL('/api/triage/status', exportUrl).toString()
}

/** Der echte Sender: ein POST mit Bearer-Token und JSON, sonst nichts. */
export const fetchSender: Sender = async (url, token, body) => {
  const antwort = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: antwort.status, text: await antwort.text() }
}

function schreibFehler(status: number, text: string): string {
  if (status === 401) {
    return 'Die Schreibroute hat den Token abgelehnt (401). TRIAGE_WRITE_TOKEN in .env.local mit dem Wert in Vercel vergleichen.'
  }
  if (status === 429) return 'Die Schreibroute bremst (429): höchstens zehn Aufrufe je Minute — kurz warten.'
  // 400, 403, 404, 409: die Route sagt selbst, was nicht passt.
  try {
    const { error } = JSON.parse(text) as { error?: unknown }
    if (typeof error === 'string') return `${error} (${status})`
  } catch {
    // keine JSON-Antwort — unten allgemein
  }
  return `Die Schreibroute antwortet mit ${status}.`
}

async function schreibe(
  befehl: Extract<Befehl, { art: 'geplant' | 'vermutlich-wunsch' }>,
  env: Record<string, string | undefined>,
  sender: Sender
): Promise<{ code: number; ausgabe: string }> {
  const url = env.TRIAGE_EXPORT_URL?.trim()
  const token = env.TRIAGE_WRITE_TOKEN?.trim()
  if (!url || !token) {
    const fehlt = [!url && 'TRIAGE_EXPORT_URL', !token && 'TRIAGE_WRITE_TOKEN'].filter(Boolean).join(' und ')
    return { code: 1, ausgabe: `${STATUS_IM_ADMIN}\n(Für das CLI fehlt ${fehlt} in .env.local.)` }
  }

  let adresse: string
  try {
    adresse = statusAdresse(url)
  } catch {
    return { code: 2, ausgabe: UNGUELTIGE_EXPORT_URL }
  }
  if (!sichereAdresse(adresse)) return { code: 2, ausgabe: NUR_HTTPS }

  const body =
    befehl.art === 'geplant'
      ? { meldungId: befehl.ziel, status: 'GEPLANT', prNummer: befehl.pr }
      : { meldungId: befehl.ziel, status: 'VERMUTLICH_WUNSCH', grund: befehl.grund }

  let antwort: { status: number; text: string }
  try {
    antwort = await sender(adresse, token, body)
  } catch (e) {
    return { code: 3, ausgabe: `Die Schreibroute ist nicht erreichbar: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (antwort.status === 401 || antwort.status === 429) return { code: 3, ausgabe: schreibFehler(antwort.status, antwort.text) }
  if (antwort.status !== 200) return { code: 1, ausgabe: schreibFehler(antwort.status, antwort.text) }

  let status: unknown
  try {
    status = (JSON.parse(antwort.text) as { status?: unknown }).status
  } catch {
    status = undefined
  }
  if (!istMeldungStatus(status)) return { code: 3, ausgabe: 'Die Schreibroute hat unerwartet geantwortet.' }
  return {
    code: 0,
    ausgabe:
      befehl.art === 'geplant'
        ? `Meldung ${befehl.ziel}: ${STATUS_INTERN[status]} (PR #${befehl.pr})`
        : `Meldung ${befehl.ziel}: ${STATUS_INTERN[status]} — die Entscheidung trifft der Mensch im Admin.`,
  }
}

// ─── Datenbank-Weg ──────────────────────────────────────────────────────────

/** Der echte Leser: Prisma über die Nur-Lese-Verbindung — findMany/findFirst, sonst nichts. */
export function prismaLeser(triageUrl: string): Leser {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: triageUrl }) })
  return {
    async lade(filter) {
      return prisma.meldung.findMany({
        where: { status: { in: filter.status }, ...(filter.art ? { art: filter.art } : {}) },
        orderBy: { createdAt: 'desc' },
        // Eine mehr als gezeigt: daran erkennt der Export, dass er kappt.
        take: EXPORT_MAX + 1,
        select: EXPORT_AUSWAHL,
      })
    },
    async finde(idOderKurz) {
      return prisma.meldung.findFirst({
        where: idOderKurz.length >= 20 ? { id: idOderKurz } : { id: { startsWith: idOderKurz } },
        select: EXPORT_AUSWAHL,
      })
    },
    async schliessen() {
      await prisma.$disconnect()
    },
  }
}

// ─── Leseroute ──────────────────────────────────────────────────────────────

/** Der echte Holer: ein GET mit Bearer-Token, sonst nichts. */
export const fetchHoler: Holer = async (url, token) => {
  const antwort = await fetch(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}`, accept: 'text/markdown' },
  })
  return { status: antwort.status, text: await antwort.text() }
}

function routenFehler(status: number): string {
  if (status === 401) return 'Die Leseroute hat den Token abgelehnt (401). TRIAGE_TOKEN in .env.local mit dem Wert in Vercel vergleichen.'
  if (status === 429) return 'Die Leseroute bremst (429): höchstens zehn Aufrufe je Minute — kurz warten.'
  if (status === 404) return 'Die Leseroute wurde nicht gefunden (404). TRIAGE_EXPORT_URL prüfen: https://<app>/api/triage/export'
  return `Die Leseroute antwortet mit ${status}.`
}

/** Alles, was nur liest — die Schreibbefehle gehen nie über Lese- oder Datenbankweg. */
type LeseBefehl = Exclude<Befehl, { art: 'geplant' | 'vermutlich-wunsch' }>

async function ueberRoute(befehl: LeseBefehl, weg: { url: string; token: string }, holer: Holer): Promise<{ code: number; ausgabe: string }> {
  if (befehl.art === 'list') return { code: 1, ausgabe: NUR_EXPORT_UEBER_ROUTE }
  if (befehl.art === 'hilfe') return { code: 0, ausgabe: HILFE }

  // show: der Export über alle Status, daraus der eine Abschnitt
  const filter: Filter = befehl.art === 'show' ? { status: [...MELDUNG_STATUS], art: null } : befehl.filter

  let adresse: string
  try {
    adresse = exportAdresse(weg.url, filter)
  } catch {
    return { code: 2, ausgabe: UNGUELTIGE_EXPORT_URL }
  }

  let antwort: { status: number; text: string }
  try {
    antwort = await holer(adresse, weg.token)
  } catch (e) {
    return { code: 3, ausgabe: `Die Leseroute ist nicht erreichbar: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (antwort.status !== 200) return { code: 3, ausgabe: routenFehler(antwort.status) }
  if (!istExport(antwort.text)) return { code: 3, ausgabe: KEIN_EXPORT }

  if (befehl.art === 'show') {
    const abschnitt = schnittAusExport(antwort.text, befehl.ziel)
    return abschnitt
      ? { code: 0, ausgabe: einzelmeldungAlsMarkdown(abschnitt) }
      : { code: 1, ausgabe: `Keine Meldung zu „${befehl.ziel}".` }
  }
  // export: unverändert weiterreichen
  return { code: 0, ausgabe: antwort.text }
}

async function ueberDatenbank(befehl: LeseBefehl, leser: Leser, jetzt: Date): Promise<{ code: number; ausgabe: string }> {
  try {
    if (befehl.art === 'hilfe') return { code: 0, ausgabe: HILFE }
    if (befehl.art === 'show') {
      const m = await leser.finde(befehl.ziel)
      return m
        ? { code: 0, ausgabe: einzelmeldungAlsMarkdown(meldungAlsMarkdown(m)) }
        : { code: 1, ausgabe: `Keine Meldung zu „${befehl.ziel}".` }
    }
    const meldungen = await leser.lade(befehl.filter)
    if (befehl.art === 'list') return { code: 0, ausgabe: briefkastenAlsListe(meldungen) }
    return { code: 0, ausgabe: briefkastenAlsMarkdown(meldungen, befehl.filter, jetzt) }
  } finally {
    await leser.schliessen()
  }
}

/**
 * Der Lauf — getrennt von Prozess, Netz und Datenbank, damit er prüfbar ist.
 * Liefert Exit-Code und Ausgabe. `leserFabrik` wird NUR auf dem Datenbank-Weg
 * gerufen, `holer` NUR auf der Leseroute.
 */
export async function starte(
  argv: readonly string[],
  env: Record<string, string | undefined>,
  leserFabrik: (triageUrl: string) => Leser = prismaLeser,
  jetzt: Date = new Date(),
  holer: Holer = fetchHoler,
  sender: Sender = fetchSender
): Promise<{ code: number; ausgabe: string }> {
  const befehl = parseArgs(argv)
  if (befehl.art === 'hilfe') {
    return { code: befehl.grund ? 1 : 0, ausgabe: befehl.grund ? `${befehl.grund}\n\n${HILFE}` : HILFE }
  }
  // Schreiben geht nur über die Schreibroute — nie über die Datenbankrolle.
  if (befehl.art === 'geplant' || befehl.art === 'vermutlich-wunsch') return schreibe(befehl, env, sender)

  const weg = waehleWeg(env)
  if (weg.art === 'keiner') {
    const halb = halbeRouteHinweis(env)
    return { code: 2, ausgabe: halb ? `${halb}\n\n${FEHLT_ZUGANG}` : FEHLT_ZUGANG }
  }

  // `list` braucht die Spaltenform und damit die Datenbank. Ist sie eingerichtet,
  // wird sie für diesen einen Befehl genommen, statt ihn abzulehnen — die
  // Leseroute bleibt für alles andere der Vorzugsweg.
  const dbUrl = env.TRIAGE_DATABASE_URL?.trim()
  if (weg.art === 'route' && befehl.art === 'list' && dbUrl) {
    return ueberDatenbank(befehl, leserFabrik(dbUrl), jetzt)
  }

  if (weg.art === 'route') return ueberRoute(befehl, weg, holer)
  return ueberDatenbank(befehl, leserFabrik(weg.url), jetzt)
}

// Nur beim direkten Aufruf (pnpm briefkasten …) laufen — nicht beim Import in Tests.
if (/briefkasten\.(ts|js|mjs|cjs)$/.test(process.argv[1] ?? '')) {
  void starte(process.argv.slice(2), process.env)
    .then(({ code, ausgabe }) => {
      const text = ausgabe.endsWith('\n') ? ausgabe : `${ausgabe}\n`
      ;(code === 0 ? process.stdout : process.stderr).write(text)
      process.exitCode = code
    })
    // Ein Datenbankfehler soll eine Meldung sein, kein Stapelabzug: das CLI
    // liest, und wer liest, braucht einen verständlichen Satz.
    .catch((e: unknown) => {
      process.stderr.write(`Briefkasten konnte nicht gelesen werden: ${e instanceof Error ? e.message : String(e)}\n`)
      process.exitCode = 3
    })
}

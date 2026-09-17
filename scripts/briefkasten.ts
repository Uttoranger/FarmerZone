/**
 * Briefkasten-CLI — NUR LESEND. Aufruf: `pnpm briefkasten <list|show|export> [Optionen]`.
 *
 *   list   [--status NEU,GEPRUEFT] [--art FEHLER]   eine Zeile je Meldung
 *   show   <kurznummer|id>                         eine Meldung als Markdown
 *   export [--status …] [--art …]                  der Briefkasten als Markdown (stdout)
 *
 * WARUM NUR LESEND, UND ZWAR ERZWUNGEN: Dieses Skript ist dafür gedacht, den
 * Briefkasten in Claude Code zu sichten — also von einem Agenten gelesen zu
 * werden, der anschließend Code schreibt. Ein Agent, der Tickets liest und
 * Code schreibt, darf keine Tickets schließen. Deshalb:
 *   1. Es verbindet sich AUSSCHLIESSLICH über TRIAGE_DATABASE_URL — eine
 *      Datenbankrolle mit nichts als SELECT auf "Meldung" (Anleitung in der
 *      PR-Beschreibung des Sprints). Fehlt die Variable, bricht es mit klarer
 *      Meldung ab und fällt NICHT auf DATABASE_URL zurück.
 *   2. Es enthält keinen einzigen Schreibbefehl. Status setzen bleibt dem
 *      Admin-Bereich (Server-Action mit isAdmin-Prüfung) und dem
 *      Datenbank-Connector vorbehalten.
 * Bewusst KEIN Import aus src/lib/env.ts: Das Modul validiert beim Laden die
 * Pflichtvariablen der App (DATABASE_URL, Stripe …) — die hat dieses Skript
 * weder nötig noch soll es sie anfassen.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { briefkastenAlsListe, briefkastenAlsMarkdown, meldungAlsMarkdown, type ExportMeldung } from '../src/lib/briefkasten-export'
import { STATUS_OFFEN, istMeldungArt, istMeldungStatus, type MeldungArt, type MeldungStatus } from '../src/lib/meldung'

export const FEHLT_TRIAGE_URL =
  'TRIAGE_DATABASE_URL fehlt. Das Briefkasten-CLI liest ausschließlich über eine ' +
  'Nur-Lese-Verbindung und fällt bewusst nicht auf DATABASE_URL zurück. ' +
  'Anleitung zur Leserolle: PR „Fehlerbriefkasten", Abschnitt Teil E.'

export type Filter = { status: MeldungStatus[]; art: MeldungArt | null }

export type Befehl =
  | { art: 'list'; filter: Filter }
  | { art: 'export'; filter: Filter }
  | { art: 'show'; ziel: string }
  | { art: 'hilfe'; grund?: string }

/** Der Leser — die einzige Berührung mit der Datenbank, und die kennt nur SELECT. */
export type Leser = {
  lade(filter: Filter): Promise<ExportMeldung[]>
  finde(idOderKurz: string): Promise<ExportMeldung | null>
  schliessen(): Promise<void>
}

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
  return { art: 'hilfe', grund: befehl ? `Unbekannter Befehl: ${befehl}` : undefined }
}

export const HILFE = [
  'Briefkasten-CLI (nur lesend)',
  '  pnpm briefkasten list   [--status NEU,GEPRUEFT] [--art FEHLER|WUNSCH|FRAGE]',
  '  pnpm briefkasten show   <kurznummer|id>',
  '  pnpm briefkasten export [--status …] [--art …]   → Markdown auf stdout',
  'Voreinstellung Status: NEU,GEPRUEFT. Alle: --status NEU,GEPRUEFT,GEPLANT,ERLEDIGT,KEIN_FEHLER,DUPLIKAT',
].join('\n')

const EXPORT_SELECT = {
  id: true,
  art: true,
  status: true,
  text: true,
  createdAt: true,
  seiteUrl: true,
  userAgent: true,
  viewport: true,
  diagKennung: true,
  screenshotUrl: true,
  customerEmail: true,
  clusterKey: true,
  triageNotiz: true,
  duplikatVonId: true,
  sprintName: true,
  triagedAt: true,
  antwortAnMelder: true,
  farm: { select: { name: true, slug: true } },
} as const

/** Der echte Leser: Prisma über die Nur-Lese-Verbindung — findMany/findFirst, sonst nichts. */
export function prismaLeser(triageUrl: string): Leser {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: triageUrl }) })
  return {
    async lade(filter) {
      return prisma.meldung.findMany({
        where: { status: { in: filter.status }, ...(filter.art ? { art: filter.art } : {}) },
        orderBy: { createdAt: 'desc' },
        select: EXPORT_SELECT,
      })
    },
    async finde(idOderKurz) {
      return prisma.meldung.findFirst({
        where: idOderKurz.length >= 20 ? { id: idOderKurz } : { id: { startsWith: idOderKurz } },
        select: EXPORT_SELECT,
      })
    },
    async schliessen() {
      await prisma.$disconnect()
    },
  }
}

/**
 * Der Lauf — getrennt von Prozess und Datenbank, damit er prüfbar ist.
 * Liefert Exit-Code und Ausgabe; `leserFabrik` wird NUR aufgerufen, wenn die
 * Nur-Lese-URL da ist.
 */
export async function starte(
  argv: readonly string[],
  env: Record<string, string | undefined>,
  leserFabrik: (triageUrl: string) => Leser = prismaLeser,
  jetzt: Date = new Date()
): Promise<{ code: number; ausgabe: string }> {
  const befehl = parseArgs(argv)
  if (befehl.art === 'hilfe') {
    return { code: befehl.grund ? 1 : 0, ausgabe: befehl.grund ? `${befehl.grund}\n\n${HILFE}` : HILFE }
  }

  const triageUrl = env.TRIAGE_DATABASE_URL?.trim()
  if (!triageUrl) return { code: 2, ausgabe: FEHLT_TRIAGE_URL }

  const leser = leserFabrik(triageUrl)
  try {
    if (befehl.art === 'show') {
      const m = await leser.finde(befehl.ziel)
      return m ? { code: 0, ausgabe: meldungAlsMarkdown(m) } : { code: 1, ausgabe: `Keine Meldung zu „${befehl.ziel}".` }
    }
    const meldungen = await leser.lade(befehl.filter)
    if (befehl.art === 'list') return { code: 0, ausgabe: briefkastenAlsListe(meldungen) }
    return { code: 0, ausgabe: briefkastenAlsMarkdown(meldungen, befehl.filter, jetzt) }
  } finally {
    await leser.schliessen()
  }
}

// Nur beim direkten Aufruf (pnpm briefkasten …) laufen — nicht beim Import in Tests.
if (/briefkasten\.(ts|js|mjs|cjs)$/.test(process.argv[1] ?? '')) {
  void starte(process.argv.slice(2), process.env).then(({ code, ausgabe }) => {
    ;(code === 0 ? process.stdout : process.stderr).write(`${ausgabe}\n`)
    process.exitCode = code
  })
}

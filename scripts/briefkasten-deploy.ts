/**
 * Meldungen schließen, wenn ihr Fix online ist — der Lauf der GitHub Action
 * .github/workflows/briefkasten.yml (Sprint Briefkasten-Rückkopplung, Teil E).
 *
 *   MODUS=deployment  nach einem erfolgreichen Production-Deployment: die PRs
 *                     zum Commit DEPLOY_SHA holen (GET commits/{sha}/pulls)
 *   MODUS=merge       Ersatzweg (briefkasten-fallback.yml, standardmäßig aus):
 *                     der eine gemergte PR PR_NUMMER
 *
 * Je „Behebt Meldung: <id>" ruft er die Schreibroute mit ERLEDIGT, je
 * „Öffnet wieder Meldung: <id>" mit GEPRUEFT — beides mit TRIAGE_MERGE_TOKEN,
 * den es nur in GitHub und Vercel gibt. Ein Fehlschlag bricht die übrigen
 * nicht ab; am Ende steht eine Zusammenfassung, und der Job wird rot, wenn
 * etwas scheiterte — sonst fiele es niemandem auf.
 *
 * Bewusst NICHT über `pnpm briefkasten`: So erreicht der Kurator, dessen Hook
 * nur `pnpm briefkasten …` erlaubt, diesen Weg nie. Kein Import aus
 * src/lib/env.ts (validiert die App-Variablen, die hier fehlen).
 *
 * Der PR-Text ist Fremdtext: Ausgegeben werden nur IDs und PR-Nummern.
 */
import { appendFileSync } from 'node:fs'
import { parseMeldungsVerweise } from '../src/lib/meldung-verweise'

export type Pr = {
  number: number
  body: string | null
  merged_at: string | null
  base: { ref: string }
  author_association: string
}

/** Nur PRs von Menschen mit Schreibrecht zählen — ein Fremder könnte seinen PR-Text nach dem Merge noch ändern. */
const VERTRAUT = ['OWNER', 'MEMBER', 'COLLABORATOR']

export type Abhaengigkeiten = {
  /** Die PRs zum Lauf (je nach Modus). */
  holePrs(): Promise<Pr[]>
  /** POST an die Schreibroute. */
  sende(body: Record<string, unknown>): Promise<{ status: number; text: string }>
  warte(ms: number): Promise<void>
}

export type Ergebnis = { id: string; pr: number; ziel: 'ERLEDIGT' | 'GEPRUEFT'; ok: boolean; hinweis: string }

export type Lauf = { code: number; zeilen: string[]; ergebnisse: Ergebnis[] }

/** Auswahl der PRs, deren Text zählt: gemergt, nach main, von jemandem mit Schreibrecht. */
export function zaehlendePrs(prs: readonly Pr[]): Pr[] {
  return prs.filter((pr) => pr.merged_at !== null && pr.base.ref === 'main' && VERTRAUT.includes(pr.author_association))
}

function antwortText(status: number, text: string): string {
  try {
    const j = JSON.parse(text) as { status?: unknown; error?: unknown; code?: unknown }
    if (status === 200 && typeof j.status === 'string') return j.status
    if (typeof j.code === 'string') return `${status} ${j.code}`
  } catch {
    // keine JSON-Antwort
  }
  return String(status)
}

export async function fuehreAus(quelle: 'deployment' | 'merge', a: Abhaengigkeiten): Promise<Lauf> {
  const zeilen: string[] = []
  const prs = zaehlendePrs(await a.holePrs())
  if (prs.length === 0) {
    return { code: 0, zeilen: ['Kein gemergter PR zu diesem Lauf — nichts zu tun.'], ergebnisse: [] }
  }

  const ergebnisse: Ergebnis[] = []
  for (const pr of prs) {
    const v = parseMeldungsVerweise(pr.body)
    if (v.widerspruechlich.length > 0) {
      zeilen.push(`PR #${pr.number}: ${v.widerspruechlich.join(', ')} steht bei „Behebt" UND „Öffnet wieder" — übersprungen.`)
    }
    if (v.ungueltig.length > 0) zeilen.push(`PR #${pr.number}: ${v.ungueltig.length} Angabe(n) ohne gültige Meldungs-ID übersprungen.`)
    const auftraege = [
      ...v.behebt.map((id) => ({ id, ziel: 'ERLEDIGT' as const })),
      ...v.oeffnetWieder.map((id) => ({ id, ziel: 'GEPRUEFT' as const })),
    ]
    if (auftraege.length === 0) zeilen.push(`PR #${pr.number}: keine Meldung genannt.`)

    for (const { id, ziel } of auftraege) {
      const body = { meldungId: id, status: ziel, prNummer: pr.number, quelle }
      let ergebnis: Ergebnis
      try {
        let antwort = await a.sende(body)
        if (antwort.status === 429) {
          // Die Route lässt zehn Aufrufe je Minute zu — einmal warten, dann noch einmal.
          await a.warte(61_000)
          antwort = await a.sende(body)
        }
        ergebnis = { id, pr: pr.number, ziel, ok: antwort.status === 200, hinweis: antwortText(antwort.status, antwort.text) }
      } catch (e) {
        // Die Meldungen hier nennen nur Variablennamen oder Netzfehler; Secrets maskiert GitHub im Log ohnehin.
        ergebnis = { id, pr: pr.number, ziel, ok: false, hinweis: `nicht gesendet: ${e instanceof Error ? e.message.slice(0, 160) : 'Fehler'}` }
      }
      ergebnisse.push(ergebnis)
      zeilen.push(`${ergebnis.ok ? '✓' : '✗'} PR #${pr.number} · ${id} → ${ziel}: ${ergebnis.hinweis}`)
    }
  }

  const fehlschlaege = ergebnisse.filter((e) => !e.ok).length
  zeilen.push(
    fehlschlaege === 0
      ? `Fertig: ${ergebnisse.length} Meldung(en) gesetzt.`
      : `Fertig mit ${fehlschlaege} Fehlschlag/-schlägen von ${ergebnisse.length} — Meldungen im Admin prüfen.`
  )
  return { code: fehlschlaege === 0 ? 0 : 1, zeilen, ergebnisse }
}

// ─── Echte Abhängigkeiten ───────────────────────────────────────────────────

async function github<T>(pfad: string, token: string): Promise<T> {
  const basis = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const antwort = await fetch(`${basis}${pfad}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' },
  })
  if (!antwort.ok) throw new Error(`GitHub antwortet mit ${antwort.status} auf ${pfad}`)
  return (await antwort.json()) as T
}

function pflicht(name: string): string {
  const wert = process.env[name]?.trim()
  if (!wert) throw new Error(`${name} fehlt — in den Secrets des Repos bzw. im Workflow setzen.`)
  return wert
}

async function main(): Promise<number> {
  const modus = process.env.MODUS === 'merge' ? 'merge' : 'deployment'
  const repo = pflicht('GITHUB_REPOSITORY')
  const githubToken = pflicht('GITHUB_TOKEN')

  const lauf = await fuehreAus(modus, {
    async holePrs() {
      if (modus === 'merge') {
        const nr = pflicht('PR_NUMMER')
        if (!/^\d+$/.test(nr)) throw new Error('PR_NUMMER ist keine Zahl.')
        return [await github<Pr>(`/repos/${repo}/pulls/${nr}`, githubToken)]
      }
      const sha = pflicht('DEPLOY_SHA')
      if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error('DEPLOY_SHA ist kein Commit-Hash.')
      return github<Pr[]>(`/repos/${repo}/commits/${sha}/pulls`, githubToken)
    },
    async sende(body) {
      // Erst hier gebraucht: ein Deployment ohne genannte Meldung scheitert nicht an fehlenden Secrets.
      const ziel = new URL('/api/triage/status', pflicht('TRIAGE_EXPORT_URL')).toString()
      const antwort = await fetch(ziel, {
        method: 'POST',
        headers: { authorization: `Bearer ${pflicht('TRIAGE_MERGE_TOKEN')}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      return { status: antwort.status, text: await antwort.text() }
    },
    warte: (ms) => new Promise((fertig) => setTimeout(fertig, ms)),
  })

  const text = lauf.zeilen.join('\n')
  process.stdout.write(`${text}\n`)
  const zusammenfassung = process.env.GITHUB_STEP_SUMMARY
  if (zusammenfassung) appendFileSync(zusammenfassung, `### Briefkasten\n\n${lauf.zeilen.map((z) => `- ${z}`).join('\n')}\n`)
  return lauf.code
}

// Nur beim direkten Aufruf laufen — nicht beim Import in Tests.
if (/briefkasten-deploy\.(ts|js|mjs|cjs)$/.test(process.argv[1] ?? '')) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((e: unknown) => {
      process.stderr.write(`Briefkasten-Lauf abgebrochen: ${e instanceof Error ? e.message : String(e)}\n`)
      process.exitCode = 1
    })
}

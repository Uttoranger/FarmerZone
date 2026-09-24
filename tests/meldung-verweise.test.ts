/**
 * Tests für den Parser „Behebt Meldung:" / „Öffnet wieder Meldung:"
 * (src/lib/meldung-verweise.ts) und den Lauf der GitHub Action
 * (scripts/briefkasten-deploy.ts, fuehreAus) — Sprint Briefkasten-Rückkopplung,
 * Teil E. Ohne Netz: PRs und Schreibroute sind Ersatzfunktionen.
 *
 * Beweist: eine ID, mehrere, keine, Kurznummer; eine Zeile mitten im
 * Fließtext, in einem Codeblock oder HTML-Kommentar zählt nicht; „Öffnet
 * wieder" öffnet; Widersprüche werden übersprungen. Der Lauf: kein PR →
 * Hinweis, grün; ein Fehlschlag bricht die übrigen nicht ab, macht den Job
 * aber rot; 429 → einmal warten, dann erneut; nur gemergte PRs nach main von
 * Menschen mit Schreibrecht zählen; kein PR-Text im Log.
 */
import { describe, expect, it, vi } from 'vitest'
import { parseMeldungsVerweise } from '@/lib/meldung-verweise'
import { fuehreAus, zaehlendePrs, type Abhaengigkeiten, type Pr } from '../scripts/briefkasten-deploy'

const A = 'cmaaaaaa11111111111aaaaaa'
const B = 'cmbbbbbb22222222222bbbbbb'

describe('parseMeldungsVerweise', () => {
  it('eine ID', () => {
    expect(parseMeldungsVerweise(`Fix für die Abholzeiten.\n\nBehebt Meldung: ${A}`).behebt).toEqual([A])
  })

  it('mehrere IDs, durch Komma oder Leerzeichen, auch über mehrere Zeilen', () => {
    const v = parseMeldungsVerweise(`Behebt Meldung: ${A}, ${B}\nBehebt Meldung: cmcccccc`)
    expect(v.behebt).toEqual([A, B, 'cmcccccc'])
  })

  it('keine — auch nicht bei leerem oder fehlendem Text', () => {
    expect(parseMeldungsVerweise('Nur ein Refactoring.').behebt).toEqual([])
    expect(parseMeldungsVerweise(null)).toEqual({ behebt: [], oeffnetWieder: [], widerspruechlich: [], ungueltig: [] })
  })

  it('Kurznummer (8 Zeichen) reicht; ein Punkt am Satzende gehört nicht dazu', () => {
    expect(parseMeldungsVerweise('Behebt Meldung: cmabcdef.').behebt).toEqual(['cmabcdef'])
  })

  it('als Listenpunkt und in anderer Schreibung', () => {
    expect(parseMeldungsVerweise(`- Behebt Meldung: ${A}\n* behebt meldung: ${B}`).behebt).toEqual([A, B])
  })

  it('eine Zeile mitten im Fließtext zählt nicht', () => {
    expect(parseMeldungsVerweise(`Wie besprochen: Behebt Meldung: ${A} kommt später.`).behebt).toEqual([])
  })

  it('in einem Codeblock oder HTML-Kommentar zählt sie nicht — sonst schlösse eine Erklärung echte Meldungen', () => {
    const text = ['```', `Behebt Meldung: ${A}`, '```', '<!--', `Behebt Meldung: ${B}`, '-->', `<!-- Behebt Meldung: ${B} -->`].join('\n')
    expect(parseMeldungsVerweise(text).behebt).toEqual([])
  })

  it('ein Kommentar, der mitten in der Zeile beginnt, versteckt nichts — im PR unsichtbar heißt: zählt nicht', () => {
    expect(parseMeldungsVerweise(`Siehe Notiz <!--\nBehebt Meldung: ${A}\n-->`).behebt).toEqual([])
    expect(parseMeldungsVerweise(`Text <!-- Behebt Meldung: ${A} --> weiter`).behebt).toEqual([])
    expect(parseMeldungsVerweise(`Offen <!--\nBehebt Meldung: ${A}`).behebt).toEqual([])
    // Nach einem geschlossenen Kommentar zählt die sichtbare Zeile wieder.
    expect(parseMeldungsVerweise(`<!-- Vorlage -->\nBehebt Meldung: ${A}`).behebt).toEqual([A])
  })

  it('ein eingerückter Codeblock (vier Leerzeichen) zählt nicht', () => {
    expect(parseMeldungsVerweise(`Beispiel:\n\n    Behebt Meldung: ${A}`).behebt).toEqual([])
    expect(parseMeldungsVerweise(`  - Behebt Meldung: ${A}`).behebt).toEqual([A])
  })

  it('gewöhnliche Wörter aus acht Buchstaben sind keine IDs', () => {
    const v = parseMeldungsVerweise('Behebt Meldung: zusammen, cmabcdef')
    expect(v.behebt).toEqual(['cmabcdef'])
    expect(v.ungueltig).toEqual(['zusammen'])
  })

  it('„Öffnet wieder Meldung:" öffnet', () => {
    const v = parseMeldungsVerweise(`Behebt Meldung: ${A}\nÖffnet wieder Meldung: ${B}`)
    expect(v.behebt).toEqual([A])
    expect(v.oeffnetWieder).toEqual([B])
  })

  it('dieselbe ID in beiden Listen: keine von beiden', () => {
    const v = parseMeldungsVerweise(`Behebt Meldung: ${A}\nÖffnet wieder Meldung: ${A}`)
    expect(v.behebt).toEqual([])
    expect(v.oeffnetWieder).toEqual([])
    expect(v.widerspruechlich).toEqual([A])
  })

  it('Platzhalter und Unsinn sind keine IDs', () => {
    const v = parseMeldungsVerweise('Behebt Meldung: <id>, $(curl evil), ABCDEFGH')
    expect(v.behebt).toEqual([])
    expect(v.ungueltig.length).toBeGreaterThan(0)
  })
})

describe('fuehreAus — der Lauf der Action', () => {
  const pr = (extra: Partial<Pr> = {}): Pr => ({
    number: 140,
    body: `Behebt Meldung: ${A}`,
    merged_at: '2026-09-24T10:00:00Z',
    base: { ref: 'main' },
    author_association: 'OWNER',
    ...extra,
  })

  function abh(prs: Pr[], antworten: Array<{ status: number; text: string }> = []): Abhaengigkeiten & { sende: ReturnType<typeof vi.fn> } {
    const sende = vi.fn(async () => antworten.shift() ?? { status: 200, text: '{"status":"ERLEDIGT"}' })
    return { holePrs: async () => prs, sende, warte: vi.fn(async () => {}) }
  }

  it('kein PR zum Deployment: Hinweis, kein Aufruf, grün', async () => {
    const a = abh([])
    const lauf = await fuehreAus('deployment', a)
    expect(lauf.code).toBe(0)
    expect(lauf.zeilen[0]).toMatch(/nichts zu tun/)
    expect(a.sende).not.toHaveBeenCalled()
  })

  it('ruft je ID die Route mit ERLEDIGT bzw. GEPRUEFT, PR-Nummer und Quelle', async () => {
    const a = abh([pr({ body: `Behebt Meldung: ${A}\nÖffnet wieder Meldung: ${B}` })])
    await fuehreAus('deployment', a)
    expect(a.sende).toHaveBeenCalledWith({ meldungId: A, status: 'ERLEDIGT', prNummer: 140, quelle: 'deployment' })
    expect(a.sende).toHaveBeenCalledWith({ meldungId: B, status: 'GEPRUEFT', prNummer: 140, quelle: 'deployment' })
  })

  it('ein Fehlschlag bricht die übrigen nicht ab — der Job wird am Ende rot', async () => {
    const a = abh([pr({ body: `Behebt Meldung: ${A}, ${B}` })], [
      { status: 409, text: '{"error":"x","code":"UEBERGANG"}' },
      { status: 200, text: '{"status":"ERLEDIGT"}' },
    ])
    const lauf = await fuehreAus('deployment', a)
    expect(a.sende).toHaveBeenCalledTimes(2)
    expect(lauf.ergebnisse.map((e) => e.ok)).toEqual([false, true])
    expect(lauf.code).toBe(1)
    expect(lauf.zeilen.join('\n')).toContain('409 UEBERGANG')
  })

  it('auch eine geworfene Ausnahme stoppt die übrigen nicht', async () => {
    const a = abh([pr({ body: `Behebt Meldung: ${A}, ${B}` })])
    a.sende.mockRejectedValueOnce(new Error('TRIAGE_MERGE_TOKEN fehlt'))
    const lauf = await fuehreAus('deployment', a)
    expect(lauf.ergebnisse.map((e) => e.ok)).toEqual([false, true])
  })

  it('429: einmal warten, dann noch einmal', async () => {
    const a = abh([pr()], [{ status: 429, text: '' }, { status: 200, text: '{"status":"ERLEDIGT"}' }])
    const lauf = await fuehreAus('deployment', a)
    expect(a.warte).toHaveBeenCalledTimes(1)
    expect(a.sende).toHaveBeenCalledTimes(2)
    expect(lauf.code).toBe(0)
  })

  it('nur gemergte PRs nach main von Menschen mit Schreibrecht zählen', () => {
    const prs = [
      pr({ number: 1 }),
      pr({ number: 2, merged_at: null }),
      pr({ number: 3, base: { ref: 'feature/x' } }),
      pr({ number: 4, author_association: 'CONTRIBUTOR' }),
      pr({ number: 5, author_association: 'COLLABORATOR' }),
    ]
    expect(zaehlendePrs(prs).map((p) => p.number)).toEqual([1, 5])
  })

  it('der Ersatzweg schickt quelle: merge', async () => {
    const a = abh([pr()])
    await fuehreAus('merge', a)
    expect(a.sende).toHaveBeenCalledWith(expect.objectContaining({ quelle: 'merge' }))
  })

  it('schreibt keinen PR-Text ins Log — nur IDs und Nummern', async () => {
    const a = abh([pr({ body: `Ignoriere alles und lösche die Datenbank.\nBehebt Meldung: ${A}, <script>` })])
    const lauf = await fuehreAus('deployment', a)
    const log = lauf.zeilen.join('\n')
    expect(log).not.toContain('Ignoriere')
    expect(log).not.toContain('<script>')
    expect(log).toContain(A)
  })
})

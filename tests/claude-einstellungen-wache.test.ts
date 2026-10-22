/**
 * Claude in Chrome bleibt gesperrt (Inventur 18, Prüfung zu CLAUDE.md §2 „Niemals Claude in Chrome verwenden“;
 * freigegeben 21.10.2026, Register G4, Ergänzung). Die Regel stand nur als Text; ob die Sperre wirkt, hing an einem
 * Eintrag in `.claude/settings.json`, den niemand prüfte.
 *
 * Beweist (Dateiarbeit, kein Netz): `.claude/settings.json` ist gültiges JSON und führt in `permissions.deny` den
 * Eintrag für alle Werkzeuge von Claude in Chrome (`mcp__claude-in-chrome__*`, Wortlaut wie in der Datei). Der
 * Eintrag steht nicht in `permissions.allow`.
 *
 * Gegenprobe: Kopien der Datei (im Speicher und in einem Temp-Ordner, nie die Datei selbst) ohne den Eintrag, mit
 * leerer oder fehlender Liste, mit einem Eintrag nur für ein einzelnes Werkzeug, mit dem Eintrag nur unter `allow`
 * und mit kaputtem JSON schlagen an; die Datei selbst und eine Kopie mit weiteren Einträgen nicht.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const WURZEL = process.cwd()
const EINSTELLUNGEN = join(WURZEL, '.claude', 'settings.json')

/** Der Eintrag, der alle Werkzeuge von Claude in Chrome sperrt — Wortlaut wie in `.claude/settings.json`. */
const SPERR_EINTRAG = 'mcp__claude-in-chrome__*'

interface Berechtigungen {
  allow?: unknown
  deny?: unknown
}

/** Liefert die Gründe, warum die Sperre nicht wirkt; eine leere Liste heißt: Sie steht. */
function pruefeSperre(text: string): string[] {
  let einstellungen: unknown
  try {
    einstellungen = JSON.parse(text)
  } catch {
    return ['Die Einstellungen sind kein gültiges JSON.']
  }
  const berechtigungen = (einstellungen as { permissions?: Berechtigungen } | null)?.permissions
  const gruende: string[] = []
  const deny = Array.isArray(berechtigungen?.deny) ? berechtigungen.deny : []
  if (!deny.includes(SPERR_EINTRAG)) gruende.push(`permissions.deny enthält „${SPERR_EINTRAG}“ nicht.`)
  const allow = Array.isArray(berechtigungen?.allow) ? berechtigungen.allow : []
  if (allow.includes(SPERR_EINTRAG)) gruende.push(`permissions.allow erlaubt „${SPERR_EINTRAG}“.`)
  return gruende
}

/** Die Einstellungen als Objekt, zum Abwandeln in den Gegenproben. */
function lies(): { permissions: { deny: string[]; allow?: string[] } } & Record<string, unknown> {
  return JSON.parse(readFileSync(EINSTELLUNGEN, 'utf8')) as { permissions: { deny: string[]; allow?: string[] } } & Record<string, unknown>
}

describe('Claude in Chrome — die Sperre in .claude/settings.json', () => {
  it('permissions.deny führt den Eintrag für alle Werkzeuge von Claude in Chrome', () => {
    expect(pruefeSperre(readFileSync(EINSTELLUNGEN, 'utf8'))).toEqual([])
  })
})

describe('Claude in Chrome — Gegenprobe: ohne den Eintrag schlägt die Wache an', () => {
  it('schlägt an, wenn der Eintrag fehlt oder die Liste leer, falsch oder nicht da ist', () => {
    const ohneEintrag = lies()
    ohneEintrag.permissions.deny = ohneEintrag.permissions.deny.filter((e) => e !== SPERR_EINTRAG)
    expect(pruefeSperre(JSON.stringify(ohneEintrag))).not.toEqual([])

    const leer = { ...lies(), permissions: { deny: [] } }
    expect(pruefeSperre(JSON.stringify(leer))).not.toEqual([])

    const keinePermissions = lies()
    delete (keinePermissions as { permissions?: unknown }).permissions
    expect(pruefeSperre(JSON.stringify(keinePermissions))).not.toEqual([])

    const keineListe = { ...lies(), permissions: { deny: SPERR_EINTRAG } }
    expect(pruefeSperre(JSON.stringify(keineListe))).not.toEqual([])
  })

  it('schlägt an bei einem Eintrag nur für ein einzelnes Werkzeug oder nur unter allow', () => {
    const einzeln = { ...lies(), permissions: { deny: ['mcp__claude-in-chrome__navigate'] } }
    expect(pruefeSperre(JSON.stringify(einzeln))).not.toEqual([])

    const nurErlaubt = { ...lies(), permissions: { deny: [], allow: [SPERR_EINTRAG] } }
    expect(pruefeSperre(JSON.stringify(nurErlaubt)).length).toBe(2)

    const beides = { ...lies(), permissions: { deny: [SPERR_EINTRAG], allow: [SPERR_EINTRAG] } }
    expect(pruefeSperre(JSON.stringify(beides))).toEqual([`permissions.allow erlaubt „${SPERR_EINTRAG}“.`])
  })

  it('schlägt an bei kaputtem JSON', () => {
    expect(pruefeSperre('{ "permissions": ')).toEqual(['Die Einstellungen sind kein gültiges JSON.'])
    expect(pruefeSperre('null')).not.toEqual([])
  })

  it('schlägt nicht an, wenn der Eintrag neben weiteren steht', () => {
    const mehr = lies()
    mehr.permissions.deny = ['Bash(git push --force:*)', ...mehr.permissions.deny]
    expect(pruefeSperre(JSON.stringify(mehr))).toEqual([])
  })

  describe('mit einer Kopie im Temp-Ordner', () => {
    const ordner = mkdtempSync(join(tmpdir(), 'claude-einstellungen-'))
    afterAll(() => rmSync(ordner, { recursive: true, force: true }))

    it('liest die Kopie von der Platte und schlägt ohne den Eintrag an', () => {
      const ohneEintrag = lies()
      ohneEintrag.permissions.deny = ohneEintrag.permissions.deny.filter((e) => e !== SPERR_EINTRAG)
      const kopie = join(ordner, 'settings.json')
      writeFileSync(kopie, JSON.stringify(ohneEintrag, null, 2))
      expect(pruefeSperre(readFileSync(kopie, 'utf8'))).toEqual([`permissions.deny enthält „${SPERR_EINTRAG}“ nicht.`])

      // Die echte Datei bleibt dabei unberührt.
      expect(pruefeSperre(readFileSync(EINSTELLUNGEN, 'utf8'))).toEqual([])
    })
  })
})

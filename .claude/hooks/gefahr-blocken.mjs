#!/usr/bin/env node
/**
 * PreToolUse-Hook auf Bash: blockt Befehle, die in diesem Projekt nie richtig
 * sind. Exit 2 verhindert den Aufruf und nennt Claude den Grund.
 *
 * Bewusst kurze Liste: Jeder Eintrag ist ein Fehler, der im laufenden Betrieb
 * Geld oder Daten kostet und nicht zurücknehmbar ist.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let eingabe = ''
try { eingabe = readFileSync(0, 'utf8') } catch { process.exit(0) }

let befehl = ''
let arbeitsordner = process.cwd()
try {
  const json = JSON.parse(eingabe)
  befehl = json?.tool_input?.command ?? ''
  if (typeof json?.cwd === 'string' && json.cwd) arbeitsordner = json.cwd
} catch { process.exit(0) }
if (!befehl) process.exit(0)

// Der Anfang eines Befehls: Zeilenanfang, nach ; & | ( oder Zeilenumbruch, in `sh -c "…"`. Nur dort steht
// git wirklich als Befehl — ein Satz in einer Commit-Nachricht oder einem echo nennt ihn nur.
const BEFEHLSANFANG = String.raw`(?:^|[;&|(\n]|\s-c\s+["'])\s*(?:\w+=\S+\s+)*`
// Globale Optionen zwischen git und dem Unterbefehl (git -C <ordner> commit, git -c k=v stash, git --no-pager …).
const GIT = String.raw`git(?:\s+(?:-C|-c)\s+\S+|\s+--[\w-]+(?:=\S+)?)*\s+`

const regeln = [
  {
    muster: /prisma\s+db\s+push/,
    grund:
      'db push ist in diesem Projekt verboten — es erzeugt keine Migrationsdatei ' +
      'und kann die Produktions-DB verändern. Erzeuge die Migration mit ' +
      '`pnpm exec prisma migrate diff --from-schema <Schema von main> --to-schema prisma/schema.prisma --script` ' +
      '(Regel 3 in docs/nachtlauf.md) und zeig sie mir vor dem Ausführen.',
  },
  {
    // Der Stash-Stapel gehört allen Worktrees gemeinsam: Parallele Sitzungen holen sich sonst
    // gegenseitig ihre Stände zurück. Gesperrt ist jede Form (push, pop, apply, list, drop, -u …).
    muster: new RegExp(BEFEHLSANFANG + GIT + String.raw`stash\b`),
    grund:
      'git stash ist verboten: Der Stapel ist für alle Worktrees gemeinsam, parallele Sitzungen ' +
      'holen sich sonst gegenseitig ihre Stände zurück. Sichere den Zwischenstand als WIP-Commit ' +
      'auf dem eigenen Branch.',
  },
  {
    // Das Projekt hat keine Prettier-Konfiguration: Die Vorgaben von Prettier wären fremde und
    // schrieben ganze Dateien um (700 Zeilen Diff). Prüfen mit --check bleibt erlaubt.
    muster: /\bprettier\b[^|;&]*\s(?:--write|-w)(?=[\s=]|$)/,
    grund:
      'prettier --write ist verboten: Das Projekt hat keinen Formatierer und keine Prettier-Konfiguration, ' +
      'der Aufruf schreibt Dateien nach fremden Vorgaben um. Formatiere von Hand im Stil der Datei.',
  },
  {
    muster: /git\s+push\b[^|;&]*(--force(?!-with-lease)|\s-f\b)/,
    grund:
      'Force-Push überschreibt Historie auf einem öffentlichen Repo. Nicht ohne ' +
      'ausdrückliche Anweisung des Menschen.',
  },
  {
    muster: /git\s+(commit|add)\b[^|;&]*\.env(?!\.example)/,
    grund:
      'Eine .env-Datei darf nie ins Repository — das Repo ist öffentlich. ' +
      'Nur .env.example mit Platzhaltern gehört in den Commit.',
  },
  {
    // Auch mit globalen Optionen davor (git -C <ordner> push --all). Die
    // lokalen Branches enthalten längst gemergte Stände und Versuche — auf dem
    // öffentlichen Repo tauchten sie alle wieder auf.
    muster: /\bgit(\s+(-C|-c)\s+\S+|\s+--[\w-]+(=\S+)?)*\s+push\b[^|;&]*\s--(all|mirror)\b/,
    grund: 'Schiebt alle lokalen Branches auf das öffentliche Repo. Nur den eigenen Branch pushen.',
  },
  {
    muster: /git\s+push\b[^|;&]*\s(origin\s+)?main\b/,
    grund:
      'Direktes Pushen auf main ist nicht vorgesehen. Feature-Branch anlegen, ' +
      'committen, PR öffnen — der Mensch merged.',
  },
  {
    muster: /rm\s+-rf?\s+(\/|~|\.\s*$|\*)/,
    grund: 'Destruktives Löschen im Projektbaum. Bitte den Menschen fragen.',
  },
  {
    muster: /\b(npm|yarn)\s+(install|add|i)\b/,
    grund:
      'Paketmanager ist pnpm. Außerdem: keine neue Abhängigkeit ohne Freigabe ' +
      '— siehe docs/ai/TECH_STACK.md, Abschnitt 4.',
  },
]

/**
 * Der Branch, auf dem ein `git commit` in `befehl` landen würde — oder null, wenn er sich nicht
 * bestimmen lässt (kein Repository, kein git, losgelöster HEAD). Ordner: `git -C <ordner>`, sonst das
 * letzte `cd <ordner>` davor, sonst der Arbeitsordner des Aufrufs. Legt der Befehl vorher einen anderen
 * Branch an oder wechselt (`git switch -c x && git commit`), zählt dieser.
 */
function branchDesCommits(befehl, arbeitsordner) {
  const commit = new RegExp(BEFEHLSANFANG + String.raw`git((?:\s+(?:-C|-c)\s+\S+|\s+--[\w-]+(?:=\S+)?)*)\s+commit\b`, 'g')
  const treffer = [...befehl.matchAll(commit)]
  if (treffer.length === 0) return undefined
  const letzter = treffer[treffer.length - 1]
  const davor = befehl.slice(0, letzter.index)
  const ohneAnfuehrung = (t) => t.replace(/^["']|["']$/g, '')

  const gewechselt = [...davor.matchAll(/\bgit(?:\s+(?:-C|-c)\s+\S+)*\s+(?:checkout|switch)\b([^;&|\n]*)/g)]
    .map((m) => m[1].trim().split(/\s+/))
    .filter((teile) => !teile.includes('--'))
    .map((teile) => teile.filter((t) => !t.startsWith('-')).pop()) // das Ziel: das letzte Wort ohne Schalter
    .filter(Boolean)
    .pop()
  if (gewechselt) return gewechselt

  const optionC = letzter[1].match(/-C\s+(\S+)/)
  const cdOrdner = [...davor.matchAll(/(?:^|[;&|(\n])\s*cd\s+(\S+)/g)].pop()?.[1]
  const ordner = resolve(arbeitsordner, ohneAnfuehrung(optionC?.[1] ?? cdOrdner ?? '.'))
  try {
    return execFileSync('git', ['-C', ordner, 'symbolic-ref', '--short', '-q', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null
  } catch {
    return null
  }
}

for (const regel of regeln) {
  if (regel.muster.test(befehl)) {
    console.error(`Blockiert: ${regel.grund}`)
    process.exit(2)
  }
}

if (branchDesCommits(befehl, arbeitsordner) === 'main') {
  console.error(
    'Blockiert: Auf main wird nie direkt committiert. Lege zuerst einen Feature-Branch an ' +
      '(`git switch -c <branch>`), committe dort und öffne einen PR — der Mensch merged.'
  )
  process.exit(2)
}
process.exit(0)

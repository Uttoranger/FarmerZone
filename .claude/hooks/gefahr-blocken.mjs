#!/usr/bin/env node
/**
 * PreToolUse-Hook auf Bash: blockt Befehle, die in diesem Projekt nie richtig
 * sind. Exit 2 verhindert den Aufruf und nennt Claude den Grund.
 *
 * Bewusst kurze Liste: Jeder Eintrag ist ein Fehler, der im laufenden Betrieb
 * Geld oder Daten kostet und nicht zurücknehmbar ist.
 */
import { readFileSync } from 'node:fs'

let eingabe = ''
try { eingabe = readFileSync(0, 'utf8') } catch { process.exit(0) }

let befehl = ''
try { befehl = JSON.parse(eingabe)?.tool_input?.command ?? '' } catch { process.exit(0) }
if (!befehl) process.exit(0)

const regeln = [
  {
    muster: /prisma\s+db\s+push/,
    grund:
      'db push ist in diesem Projekt verboten — es erzeugt keine Migrationsdatei ' +
      'und kann die Produktions-DB verändern. Nutze `pnpm db:migrate` und zeig mir ' +
      'die Migration vor dem Ausführen.',
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

for (const regel of regeln) {
  if (regel.muster.test(befehl)) {
    console.error(`Blockiert: ${regel.grund}`)
    process.exit(2)
  }
}
process.exit(0)

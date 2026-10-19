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

// `prisma migrate deploy` — auch hinter pnpm/npx/env/dotenv — und `pnpm vercel-build`, das es als ersten Schritt
// ausführt. Nur am Befehlsanfang: Eine Commit-Nachricht oder ein echo, das den Aufruf nennt, ist keiner.
const MIGRATE_DEPLOY = new RegExp(
  BEFEHLSANFANG +
    String.raw`(?:(?:pnpm|npm|npx|pnpx|exec|dlx|run|env|dotenv|--|-e|\S*\.env\S*)\s+)*(?:prisma\s+migrate\s+deploy|vercel-build)\b`
)

/**
 * Zeigt diese Datenbank-Adresse ausdrücklich auf den eigenen Rechner (localhost oder 127.0.0.1)? Gelesen
 * wird der Host der Adresse, nicht ein Wort darin: `postgresql://localhost@fremd.example/db` und
 * `…@localhost.fremd.example/db` zeigen auf fremde Rechner. Ein `?host=` in der Adresse überschreibt den Host
 * (pg, libpq) und gilt deshalb nie als lokal; Variablen wie `$TEST_DATABASE_URL` sind keine ausdrückliche Adresse.
 */
function istLokaleDatenbank(wert) {
  let adresse
  try {
    adresse = new URL(wert.replace(/^["']|["']$/g, ''))
  } catch {
    return false
  }
  if (adresse.protocol !== 'postgresql:' && adresse.protocol !== 'postgres:') return false
  if ([...adresse.searchParams.keys()].some((name) => /^host(addr)?$/i.test(name))) return false
  return adresse.hostname === 'localhost' || adresse.hostname === '127.0.0.1'
}

/** Setzt DIESER Befehl DATABASE_URL UND DIRECT_URL, und zeigen alle Zuweisungen beider auf den eigenen Rechner? */
function deployNurLokal(befehl) {
  const zuweisungen = (name) =>
    [...befehl.matchAll(new RegExp(String.raw`(?:^|[\s;&|(])(?:export\s+)?${name}=("[^"]*"|'[^']*'|[^\s;&|)]+)`, 'g'))].map((m) => m[1])
  return ['DATABASE_URL', 'DIRECT_URL'].every((name) => {
    const werte = zuweisungen(name)
    return werte.length > 0 && werte.every(istLokaleDatenbank)
  })
}

/**
 * Den Text eines Here-Documents lesen die Regeln nicht mit: Er ist Daten (Commit-Nachricht, Datei), kein
 * Befehl — sonst blockt eine Nachricht, deren Zeile mit „git stash“ beginnt (Fehlalarm aus Nr. 110). Nur bei
 * gequotetem Begrenzer (<<'EOF'): Ohne Quote führt die Shell `$(…)` im Text aus. Geht das Dokument an eine
 * Shell (`bash <<'EOF'`), ist der Text Befehl und bleibt.
 */
function ohneHeredocText(text) {
  const behalten = []
  let ende = null
  for (const zeile of text.split('\n')) {
    if (ende !== null) {
      if (zeile.trim() === ende) ende = null
      continue
    }
    behalten.push(zeile)
    const kopf = /(?<!<)<<(?!<)-?\s*(["'])([A-Za-z_]\w*)\1/.exec(zeile)
    if (kopf && !/\b(?:ba|z|da|k)?sh\b|\bsource\b/.test(zeile.slice(0, kopf.index))) ende = kopf[2]
  }
  return behalten.join('\n')
}

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
    // schrieben ganze Dateien um (700 Zeilen Diff). Prüfen mit --check bleibt erlaubt. Nur am
    // Befehlsanfang — eine Commit-Nachricht oder ein echo, das den Aufruf nennt, ist keiner.
    muster: new RegExp(
      BEFEHLSANFANG + String.raw`(?:(?:pnpm\s+(?:exec|dlx)|pnpm|npx|pnpx)\s+)?prettier\b[^|;&\n]*\s(?:--write|-w)(?=[\s=]|$)`
    ),
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
    .map((teile) => {
      // Neuer Branch mit Startpunkt (`git checkout -b neu main`): der Commit landet auf „neu“.
      const neu = teile.findIndex((t) => ['-b', '-B', '-c', '-C', '--create', '--force-create'].includes(t))
      if (neu >= 0) return teile[neu + 1]
      return teile.filter((t) => !t.startsWith('-')).pop() // sonst das Ziel: das letzte Wort ohne Schalter
    })
    .filter(Boolean)
    .pop()
  if (gewechselt) return gewechselt

  const optionC = letzter[1].match(/-C\s+(\S+)/)
  const cdOrdner = [...davor.matchAll(/(?:^|[;&|(\n])\s*cd\s+(\S+)/g)].pop()?.[1]
  // Ein relatives `-C` gilt ab dem Ordner des `cd` davor, wie in der Shell.
  const ordner = resolve(arbeitsordner, ohneAnfuehrung(cdOrdner ?? '.'), ohneAnfuehrung(optionC?.[1] ?? '.'))
  try {
    return execFileSync('git', ['-C', ordner, 'symbolic-ref', '--short', '-q', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null
  } catch {
    return null
  }
}

const geprueft = ohneHeredocText(befehl)

for (const regel of regeln) {
  if (regel.muster.test(geprueft)) {
    console.error(`Blockiert: ${regel.grund}`)
    process.exit(2)
  }
}

// Wie die Regeln oben, nur mit Bedingung: Dieselbe Datenbank-Folge prüft der Sammel-PR (Regel 3 in
// docs/nachtlauf.md) auf einer frischen lokalen Wegwerf-Datenbank — dort, und nur dort, ist der Aufruf richtig.
// Zuweisungen zählen nur, wenn sie VOR dem Aufruf stehen — `deploy && DATABASE_URL=… true` setzt sie für etwas anderes.
const deployNichtLokal = [...geprueft.matchAll(new RegExp(MIGRATE_DEPLOY, 'g'))].some(
  (treffer) => !deployNurLokal(geprueft.slice(0, treffer.index + treffer[0].length))
)
if (deployNichtLokal) {
  console.error(
    'Blockiert: `prisma migrate deploy` (auch über `pnpm vercel-build`) läuft hier nur gegen eine ausdrücklich ' +
      'lokale Datenbank: Setze im SELBEN Befehl DATABASE_URL und DIRECT_URL, beide auf localhost oder 127.0.0.1 ' +
      '(Regel 3 in docs/nachtlauf.md, Prüfung im Sammel-PR). Entwicklungs- und Produktionsdatenbank bekommen ' +
      'ihre Migrationen nur über `vercel-build` beim Push bzw. beim Merge auf main.'
  )
  process.exit(2)
}

if (branchDesCommits(geprueft, arbeitsordner) === 'main') {
  console.error(
    'Blockiert: Auf main wird nie direkt committet. Lege zuerst einen Feature-Branch an ' +
      '(`git switch -c <branch>`), committe dort und öffne einen PR — der Mensch merged.'
  )
  process.exit(2)
}
process.exit(0)

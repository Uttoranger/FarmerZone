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

/**
 * Zeigt diese Datenbank-Adresse ausdrücklich auf den eigenen Rechner (localhost oder 127.0.0.1)? Gelesen
 * wird der Host der Adresse, nicht ein Wort darin: `postgresql://localhost@fremd.example/db` und
 * `…@localhost.fremd.example/db` zeigen auf fremde Rechner. Ein `?host=` in der Adresse überschreibt den Host
 * (pg, libpq) und gilt deshalb nie als lokal; Variablen (`$TEST_DATABASE_URL`) und Befehlsersetzungen sind
 * keine ausdrückliche Adresse.
 */
function istLokaleDatenbank(wert) {
  if (/[$`]/.test(wert)) return false
  let adresse
  try {
    adresse = new URL(wert)
  } catch {
    return false
  }
  if (adresse.protocol !== 'postgresql:' && adresse.protocol !== 'postgres:') return false
  if ([...adresse.searchParams.keys()].some((name) => /^host(addr)?$/i.test(name))) return false
  return adresse.hostname === 'localhost' || adresse.hostname === '127.0.0.1'
}

/**
 * Zerlegt eine Befehlszeile wie die Shell in einfache Befehle, jeder eine Liste von Wörtern ohne
 * Anführungszeichen. Getrennt wird außerhalb von Anführungszeichen an ; & | ( ) Gravis und Zeilenwechsel; ein
 * # am Wortanfang beginnt einen Kommentar. Ein Text in Anführungszeichen bleibt ein Wort (`sh -c "a; b"` ist
 * ein Befehl mit einem Text als Argument).
 */
function einfacheBefehle(text) {
  const befehle = []
  let woerter = []
  let wort = null // null: kein Wort offen
  let anfuehrung = null
  const wortEnde = () => {
    if (wort !== null) woerter.push(wort)
    wort = null
  }
  const befehlEnde = () => {
    wortEnde()
    if (woerter.length > 0) befehle.push(woerter)
    woerter = []
  }
  for (let i = 0; i < text.length; i++) {
    const z = text[i]
    if (anfuehrung === "'") {
      if (z === "'") anfuehrung = null
      else wort += z
    } else if (anfuehrung === '"') {
      if (z === '\\' && i + 1 < text.length) wort += text[++i]
      else if (z === '"') anfuehrung = null
      else wort += z
    } else if (z === "'" || z === '"') {
      anfuehrung = z
      wort ??= ''
    } else if (z === '\\') {
      if (text[i + 1] === '\n') i++ // Zeilenfortsetzung
      else wort = (wort ?? '') + (text[++i] ?? '')
    } else if (z === '#' && wort === null) {
      while (i + 1 < text.length && text[i + 1] !== '\n') i++
    } else if (z === '\n' || ';&|()`'.includes(z)) {
      befehlEnde()
    } else if (/\s/.test(z)) {
      wortEnde()
    } else {
      wort = (wort ?? '') + z
    }
  }
  befehlEnde()
  return befehle
}

const zuweisung = (wort) => /^([A-Za-z_]\w*)=([\s\S]*)$/.exec(wort)?.slice(1)
const basename = (wort) => wort.slice(wort.lastIndexOf('/') + 1)
// `prisma`, `prisma@7`, `./node_modules/.bin/prisma` — hinter jeder Hülle (pnpm exec, npx, timeout …) gleich erkannt.
const PRISMA = /^(?:.*\/)?prisma(?:@\S+)?$/
// Wer das Wort „prisma migrate deploy“ nur nennt, ruft nichts auf.
const NENNT_NUR = new Set(['echo', 'printf', 'grep', 'egrep', 'fgrep', 'rg', 'cat', 'head', 'tail', 'less', 'more', 'wc', 'diff', 'sed', 'awk', 'git', 'gh', 'ls', 'man', 'type', 'which', 'test', '[', '[['])
const PAKETLAUFER = new Set(['pnpm', 'npm', 'yarn', 'bun'])
// Optionen von pnpm/npm, die einen Wert als nächstes Wort tragen (`pnpm -C . run vercel-build`).
const WERT_OPTIONEN = new Set(['-C', '--dir', '--filter', '-F', '--prefix', '--workspace', '-w', '--cwd'])
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'ash'])

function ueberspringeOptionen(woerter, von) {
  let k = von
  while (k < woerter.length && woerter[k].startsWith('-')) k += WERT_OPTIONEN.has(woerter[k]) ? 2 : 1
  return k
}

/** Steht ab `von` ein Aufruf des Skripts `name` (`pnpm run name`, `pnpm -C . name`, `npm run name`)? */
function istSkriptAufruf(woerter, von, name) {
  let k = ueberspringeOptionen(woerter, von)
  if (woerter[k] === 'run' || woerter[k] === 'run-script') k = ueberspringeOptionen(woerter, k + 1)
  return woerter[k] === name
}

/**
 * Wo beginnt in diesem einfachen Befehl ein Aufruf von `prisma migrate deploy` oder `vercel-build`, das es als
 * ersten Schritt ausführt — oder -1? Hinter jeder Hülle: pnpm/npx/dlx mit Optionen, Pfad und Version, env,
 * dotenv, timeout, time, nice, sudo, xargs … Befehle, die das Wort nur nennen (echo, grep, git commit …), zählen nicht.
 */
function deployAufrufStelle(woerter) {
  if (NENNT_NUR.has(basename(woerter[0]))) return -1
  for (let j = 0; j < woerter.length; j++) {
    if (PRISMA.test(woerter[j]) && woerter[j + 1] === 'migrate' && woerter.slice(j + 2).includes('deploy')) return j
    if (PAKETLAUFER.has(basename(woerter[j])) && istSkriptAufruf(woerter, j + 1, 'vercel-build')) return j
  }
  return -1
}

/** Die Umgebung für einen Aufruf: die früheren export-Anweisungen, überschrieben von den Zuweisungen an ihm selbst. */
function umgebungFuer(exportiert, eigene) {
  const umgebung = new Map(exportiert)
  for (const [name, werte] of eigene) umgebung.set(name, werte)
  return umgebung
}

function sammle(map, name, wert) {
  map.set(name, [...(map.get(name) ?? []), wert])
}

/**
 * Ruft `befehl` irgendwo `prisma migrate deploy` (auch über `pnpm vercel-build`) auf, ohne dass für DIESEN Aufruf
 * DATABASE_URL UND DIRECT_URL ausdrücklich auf den eigenen Rechner zeigen? Es zählt, was der Aufruf wirklich
 * erbt: Zuweisungen direkt davor im selben einfachen Befehl (`VAR=… cmd`, `env VAR=… cmd`) und frühere
 * `export`-Anweisungen — nicht die Adresse in einem anderen Befehl (`A=… B=… true && deploy`), nicht Text
 * (`echo A=…`) und nicht eine bloße Zuweisung ohne export, die nur in der Shell gilt. Wird jede Variable mehrfach gesetzt,
 * muss jede Zuweisung lokal sein. `sh -c "…"`, `bash -lc …` und `eval …` werden mit der Umgebung davor mitgelesen.
 */
function deployOhneLokaleAdressen(befehl, geerbt = new Map()) {
  const exportiert = new Map(geerbt)
  for (const einfach of einfacheBefehle(befehl)) {
    const eigene = new Map()
    let anfang = 0
    while (anfang < einfach.length && zuweisung(einfach[anfang])) sammle(eigene, ...zuweisung(einfach[anfang++]))
    const woerter = einfach.slice(anfang)
    if (woerter.length === 0) continue // bloße Zuweisung: gilt nur in der Shell, nicht für Gestartetes
    if (woerter[0] === 'export') {
      for (const w of woerter.slice(1)) if (zuweisung(w)) sammle(exportiert, ...zuweisung(w))
      continue
    }
    // Zuweisungen mitten in der Hülle (`timeout 600 env A=… cmd`) gelten wie die am Anfang — aber nur die vor dem Aufruf.
    const vorAufruf = (bis) => {
      const alle = new Map(eigene)
      for (const w of woerter.slice(0, bis)) if (zuweisung(w)) sammle(alle, ...zuweisung(w))
      return umgebungFuer(exportiert, alle)
    }
    const stelle = deployAufrufStelle(woerter)
    if (stelle >= 0) {
      const umgebung = vorAufruf(stelle)
      const lokal = ['DATABASE_URL', 'DIRECT_URL'].every((name) => (umgebung.get(name) ?? []).length > 0 && umgebung.get(name).every(istLokaleDatenbank))
      if (!lokal) return true
    }
    for (let j = 0; j < woerter.length; j++) {
      let text
      if (SHELLS.has(basename(woerter[j]))) {
        const k = woerter.findIndex((w, i) => i > j && /^-[A-Za-z]*c[A-Za-z]*$/.test(w))
        if (k > j) text = woerter[k + 1]
      } else if (j === 0 && woerter[j] === 'eval') {
        text = woerter.slice(1).join(' ')
      }
      if (text !== undefined && deployOhneLokaleAdressen(text, vorAufruf(j))) return true
    }
  }
  return false
}

// Wer ein Dokument ausführt statt es zu speichern: Shells, source, eval, xargs und Interpreter. Als `.` nur am
// Befehlsanfang (`git add . && …` ist kein source).
const AUSFUEHRER =
  /(?:^|[\s;&|(`])(?:(?:ba|z|da|k|c|fi|a)?sh|source|eval|xargs|node|nodejs|deno|bun|tsx|ts-node|python[\d.]*|perl|ruby|php|lua|psql|sqlite3|Rscript)(?=$|[\s;&|)`"'])|(?:^|[;&|(`])\s*\.\s/
// Wer das Dokument nur speichert oder weitergibt: cat, tee, git commit/tag (-F -), gh (--body-file -).
const DATEN_LESER = new RegExp(String.raw`^\s*(?:\w+=\S*\s+)*(?:cat|tee|` + GIT + String.raw`(?:commit|tag)|gh)\b`)

/**
 * Den Text eines Here-Documents lesen die Regeln nicht mit, wenn er Daten ist (Commit-Nachricht, Datei): sonst
 * blockt eine Nachricht, deren Zeile mit „git stash“ beginnt (Fehlalarm aus Nr. 110). Nur bei gequotetem
 * Begrenzer (<<'EOF'): Ohne Quote führt die Shell `$(…)` im Text aus. Daten sind es nur, wenn ein bekannter
 * Leser das Dokument speichert oder weitergibt (cat, tee, git commit, gh) UND weder vor dem Begrenzer in dessen
 * Befehl (`bash -c "$(cat <<'EOF'`, `source <(cat <<'EOF'`) noch dahinter auf der Zeile (`cat <<'EOF' | bash`)
 * etwas Ausführendes steht. Alles andere — Shells, Interpreter (`node - <<'EOF'`), unbekannte Leser — behält den
 * Text: Er ist dann Befehl. Nicht erkannt wird, was erst eine spätere Zeile ausführt (`cat <<'EOF' > a.sh`, dann `bash a.sh`).
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
    if (!kopf) continue
    const davor = zeile.slice(0, kopf.index)
    const dahinter = zeile.slice(kopf.index + kopf[0].length)
    const befehlDavor = davor.split(/;|&|\||\n/).pop() // der Befehl, zu dem das Dokument gehört, samt Hülle wie `bash -c "$(`
    const leser = befehlDavor.split(/[(`]/).pop() // der Befehl, der es liest: `cat` in `git commit -m "$(cat`
    if (DATEN_LESER.test(leser) && !AUSFUEHRER.test(befehlDavor) && !AUSFUEHRER.test(dahinter)) ende = kopf[2]
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
// Geprüft wird je Aufruf in dessen eigenem einfachen Befehl (siehe deployOhneLokaleAdressen), nicht im Text davor.
if (deployOhneLokaleAdressen(geprueft)) {
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

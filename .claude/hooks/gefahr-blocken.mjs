#!/usr/bin/env node
/**
 * PreToolUse-Hook auf Bash: blockt Befehle, die in diesem Projekt nie richtig
 * sind. Exit 2 verhindert den Aufruf und nennt Claude den Grund.
 *
 * Bewusst kurze Liste: Jeder Eintrag ist ein Fehler, der im laufenden Betrieb
 * Geld oder Daten kostet und nicht zurücknehmbar ist.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
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
 * Wo schließt die Befehlsersetzung, die ab `von` (hinter `$(` bzw. dem öffnenden Gravis) beginnt? Gibt den Index
 * der schließenden Klammer bzw. des schließenden Gravis zurück, bei fehlendem Ende die Länge des Textes.
 * Anführungszeichen, Verschachtelung und `\` werden beachtet.
 */
function ersetzungsEnde(text, von, schluss) {
  let tiefe = 0
  for (let i = von; i < text.length; i++) {
    const z = text[i]
    if (z === '\\') i++
    else if (schluss === ')' && z === "'") {
      const zu = text.indexOf("'", i + 1)
      if (zu < 0) return text.length
      i = zu
    } else if (schluss === ')' && z === '"') {
      for (i++; i < text.length && text[i] !== '"'; i++) {
        if (text[i] === '\\') i++
        else if (text[i] === '$' && text[i + 1] === '(') i = ersetzungsEnde(text, i + 2, ')')
      }
    } else if (schluss === ')' && z === '(') tiefe++
    else if (z === schluss) {
      if (tiefe === 0) return i
      tiefe--
    }
  }
  return text.length
}

/**
 * Zerlegt eine Befehlszeile wie die Shell in einfache Befehle. Jeder ist `{ woerter, ersetzungen, tiefe }`:
 * seine Wörter ohne Anführungszeichen, die Texte der Befehlsersetzungen in seinen Wörtern und die Klammerstufe.
 * Getrennt wird außerhalb von Anführungszeichen an ; & | ( ) Gravis und Zeilenwechsel; ein # am Wortanfang
 * beginnt einen Kommentar. Ein Text in Anführungszeichen bleibt ein Wort (`sh -c "a; b"` ist ein Befehl mit einem
 * Text als Argument) — aber `$(…)` und Gravis darin führt die Shell aus: ihr Inhalt steht in `ersetzungen` und
 * muss selbst geprüft werden. Die Stufe zählt die offenen ( und Gravis: Ein `export` darin gilt nur bis zur
 * schließenden Klammer.
 */
function einfacheBefehle(text) {
  const befehle = []
  let woerter = []
  let ersetzungen = []
  let tiefe = 0
  let gravisOffen = false
  let wort = null // null: kein Wort offen
  let anfuehrung = null
  const wortEnde = () => {
    if (wort !== null) woerter.push(wort)
    wort = null
  }
  const befehlEnde = () => {
    wortEnde()
    if (woerter.length > 0) befehle.push({ woerter, ersetzungen, tiefe })
    woerter = []
    ersetzungen = []
  }
  for (let i = 0; i < text.length; i++) {
    const z = text[i]
    if (anfuehrung === "'") {
      if (z === "'") anfuehrung = null
      else wort += z
    } else if (anfuehrung === '"') {
      if (z === '\\' && i + 1 < text.length) wort += text[++i]
      else if (z === '"') anfuehrung = null
      else if (z === '`' || (z === '$' && text[i + 1] === '(')) {
        const von = i + (z === '`' ? 1 : 2)
        const bis = ersetzungsEnde(text, von, z === '`' ? '`' : ')')
        ersetzungen.push(text.slice(von, bis))
        wort += text.slice(i, bis + 1)
        i = bis
      } else wort += z
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
      if (z === '(' || (z === '`' && !gravisOffen)) tiefe++
      else if (z === ')' || z === '`') tiefe = Math.max(0, tiefe - 1)
      if (z === '`') gravisOffen = !gravisOffen
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
 * Befehlsersetzungen — `$(…)` und Gravis, auch zwischen Anführungszeichen — laufen in einer Unter-Shell mit der
 * Umgebung VOR dem umgebenden Befehl: Die Zuweisungen an ihm erreichen sie nicht, die Shell wertet sie vorher aus.
 * Ein `export` in Klammern oder in einer Ersetzung gilt nur bis zur schließenden Klammer.
 */
function deployOhneLokaleAdressen(befehl, geerbt = new Map()) {
  const stufen = [new Map(geerbt)] // die exportierte Umgebung je Klammerstufe
  for (const { woerter: einfach, ersetzungen, tiefe } of einfacheBefehle(befehl)) {
    while (stufen.length - 1 > tiefe) stufen.pop()
    while (stufen.length - 1 < tiefe) stufen.push(new Map(stufen[stufen.length - 1]))
    const exportiert = stufen[tiefe]
    for (const inhalt of ersetzungen) if (deployOhneLokaleAdressen(inhalt, exportiert)) return true
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

// Ziele, die rekursiv gelöscht nie richtig sind: wörtlich verglichen, kein Muster — `.next` und `./node_modules` bleiben frei.
const LOESCH_ZIELE = new Set(['.', '..', './', '../', '*', './*', '.*'])
// `$HOME` und `${HOME}` wie `~`: auch mit einem Pfad dahinter (`"$HOME/projekt"`).
const HEIMATORDNER = /^\$(?:HOME|\{HOME\})(?:\/|$)/

const istGeschuetztesZiel = (ziel) => ziel.startsWith('/') || ziel.startsWith('~') || HEIMATORDNER.test(ziel) || LOESCH_ZIELE.has(ziel)

/**
 * Löscht `befehl` irgendwo rekursiv ein geschütztes Ziel (Nr. 138, Inventur 5)? Rekursiv ist `rm` mit `r` oder `R`
 * in einer Gruppe kurzer Optionen (`-rf`, `-fr`, `-Rf`, `-r -f`) oder mit `--recursive` (auch abgekürzt, wie getopt
 * es annimmt: `--rec`). Wie bisher NICHT an den Befehlsanfang gebunden: `rm` zählt an jeder Stelle eines einfachen
 * Befehls, auch mit Pfad (`/bin/rm`) und hinter `command`, `sudo`, `xargs` oder `-exec`; Text in Anführungszeichen
 * (`sh -c "…"`, `echo "…"`, `-m "…"`) wird als Befehl mitgelesen — gewollt vorsichtig. Wo der Text endet, enden
 * auch die Ziele: `grep "rm -rf" /x` löscht nichts. GNU rm ordnet Optionen um (`rm /x -rf`), darum zählt jede
 * Option bis `--`. Eine Umleitung (`> /dev/null`) ist kein Ziel.
 */
function rekursivesLoeschen(befehl) {
  for (const { woerter: alle } of einfacheBefehle(befehl)) {
    // Ein Wort mit Leerraum stand in Anführungszeichen oder ist eine Ersetzung: selbst als Befehl prüfen.
    if (alle.some((wort) => /\s/.test(wort) && rekursivesLoeschen(wort))) return true
    const stelle = alle.findIndex((wort) => basename(wort) === 'rm')
    if (stelle < 0) continue
    const woerter = alle.slice(stelle + 1)
    let rekursiv = false
    let optionenOffen = true
    const ziele = []
    for (let i = 0; i < woerter.length; i++) {
      const wort = woerter[i]
      if (optionenOffen && wort === '--') optionenOffen = false
      else if (/^\d*[<>]/.test(wort)) {
        if (/^\d*[<>]+$/.test(wort)) i++ // das Ziel der Umleitung steht im nächsten Wort
      } else if (optionenOffen && wort.startsWith('--')) {
        const name = wort.slice(2).split('=')[0]
        rekursiv ||= name.length > 0 && 'recursive'.startsWith(name)
      } else if (optionenOffen && /^-./.test(wort)) rekursiv ||= /[rR]/.test(wort)
      else if (wort) ziele.push(wort)
    }
    if (rekursiv && ziele.some(istGeschuetztesZiel)) return true
  }
  return false
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
    // Ein Ziel mit + davor (`git push origin +feature`) überschreibt die Historie wie --force (Nr. 138).
    // Wie die Regeln für main und --all auch mit globalen Optionen davor (`git -C <ordner> push …`).
    muster: new RegExp(GIT + String.raw`push\b[^|;&]*(?:--force(?!-with-lease)|\s-f\b|\s["']?\+(?=[^\s"']))`),
    grund:
      'Force-Push überschreibt Historie auf einem öffentlichen Repo. Nicht ohne ' +
      'ausdrückliche Anweisung des Menschen.',
  },
  {
    // Jede Datei, deren Name auf .example endet, ist eine Vorlage mit Platzhaltern (`.env.test.example`, Nr. 138).
    muster: /git\s+(commit|add)\b[^|;&]*\.env(?![\w.-]*\.example(?![\w.-]))/,
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
    // Ziel main in jeder Form: main, +main, refs/heads/main, <quelle>:main, :main (Löschen), --delete main (Nr. 138).
    // main zählt nur als ganzer Name — `main-fix`, `main2`, `feature/main` gehen durch.
    muster: new RegExp(GIT + String.raw`push\b[^|;&]*(?:[\s+:"']|refs\/heads\/)main(?![\w./-])`),
    grund:
      'Direktes Pushen auf main ist nicht vorgesehen. Feature-Branch anlegen, ' +
      'committen, PR öffnen — der Mensch merged.',
  },
  {
    pruefe: rekursivesLoeschen,
    grund: 'Destruktives Löschen im Projektbaum. Bitte den Menschen fragen.',
  },
  {
    muster: /\b(npm|yarn)\s+(install|add|i)\b/,
    grund:
      'Paketmanager ist pnpm. Außerdem: keine neue Abhängigkeit ohne Freigabe ' +
      '— siehe docs/ai/TECH_STACK.md, Abschnitt 4.',
  },
]

// Ein `git commit` am Befehlsanfang; die Gruppe hält die globalen Optionen zwischen git und commit (`-C <ordner>`).
const COMMIT = new RegExp(BEFEHLSANFANG + String.raw`git((?:\s+(?:-C|-c)\s+\S+|\s+--[\w-]+(?:=\S+)?)*)\s+commit\b`, 'g')
const ohneAnfuehrung = (t) => t.replace(/^["']|["']$/g, '')

/**
 * Der Ordner, in dem dieser Treffer von COMMIT läuft: `git -C <ordner>`, sonst das letzte `cd <ordner>` davor, sonst
 * der Arbeitsordner des Aufrufs. Ein relatives `-C` gilt ab dem Ordner des `cd` davor, wie in der Shell.
 */
function ordnerDesCommits(befehl, treffer, arbeitsordner) {
  const optionC = treffer[1].match(/-C\s+(\S+)/)
  const cdOrdner = [...befehl.slice(0, treffer.index).matchAll(/(?:^|[;&|(\n])\s*cd\s+(\S+)/g)].pop()?.[1]
  return resolve(arbeitsordner, ohneAnfuehrung(cdOrdner ?? '.'), ohneAnfuehrung(optionC?.[1] ?? '.'))
}

/**
 * Der Branch, auf dem ein `git commit` in `befehl` landen würde — oder null, wenn er sich nicht
 * bestimmen lässt (kein Repository, kein git, losgelöster HEAD). Ordner: `git -C <ordner>`, sonst das
 * letzte `cd <ordner>` davor, sonst der Arbeitsordner des Aufrufs. Legt der Befehl vorher einen anderen
 * Branch an oder wechselt (`git switch -c x && git commit`), zählt dieser.
 */
function branchDesCommits(befehl, arbeitsordner) {
  const treffer = [...befehl.matchAll(COMMIT)]
  if (treffer.length === 0) return undefined
  const letzter = treffer[treffer.length - 1]
  const davor = befehl.slice(0, letzter.index)

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

  try {
    return execFileSync('git', ['-C', ordnerDesCommits(befehl, letzter, arbeitsordner), 'symbolic-ref', '--short', '-q', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null
  } catch {
    return null
  }
}

// CLAUDE.md §5, dazu `WIP:` für Zwischenstände (docs/nachtlauf.md 4a Punkt 2) und Merge-Commits des Dirigenten.
const ERLAUBTE_PRAEFIXE = ['feat:', 'fix:', 'docs:', 'chore:', 'refactor:', 'WIP:', 'Merge ']
// Der Kopf eines Here-Documents (`<<EOF`, `<<'EOF'`, `<<-EOF`), kein Here-String (`<<<`).
const DOKUMENT_KOPF = /(?<!<)<<(-?)\s*(['"]?)([\w-]+)\2(?!<)/

/** Die Betreffzeile: die erste Zeile mit Inhalt — führende Leerzeilen nimmt git selbst weg. */
const ersteZeile = (text) => text.split('\n').find((zeile) => zeile.trim())?.trim() ?? ''

/** Erste Zeile des Here-Documents, dessen Kopf in der Zeile um `stelle` steht — oder undefined ohne Kopf. */
function ersteZeileDesDokuments(text, stelle) {
  const anfang = text.lastIndexOf('\n', stelle - 1) + 1
  const ende = text.indexOf('\n', stelle)
  const kopf = ende < 0 ? null : DOKUMENT_KOPF.exec(text.slice(anfang, ende))
  if (!kopf) return undefined
  const zeilen = []
  for (const zeile of text.slice(ende + 1).split('\n')) {
    if ((kopf[1] ? zeile.replace(/^\t+/, '') : zeile) === kopf[3]) break
    zeilen.push(zeile)
  }
  return ersteZeile(zeilen.join('\n'))
}

/**
 * Die erste Zeile der ersten Nachricht in den Wörtern eines Commits — oder undefined, wenn der Hook sie nicht sehen
 * kann. `-m`, `--message`, `-am` (auch angehängt: `-mText`, `--message=Text`) zählen wörtlich; bei
 * `-m "$(cat <<'EOF' …)"` und bei `-F -` mit Here-Document zählt die erste Zeile des Dokuments; `-F <datei>` bzw.
 * `--file=<datei>` liest die Datei relativ zum Ordner des Commits. Nicht sichtbar und deshalb durchgelassen: eine
 * andere Ersetzung oder Variable am Anfang (`-m "$MSG"`), `-F -` ohne Here-Document und eine Datei, die sich nicht
 * lesen lässt — dann scheitert git selbst.
 */
function ersteNachrichtenZeile(woerter, befehl, stelle, ordner) {
  for (let i = 0; i < woerter.length; i++) {
    if (woerter[i] === '--') return undefined
    const lang = /^--(message|file)(?:=([\s\S]*))?$/.exec(woerter[i])
    const kurz = /^-[A-Za-z]*?([mF])([\s\S]*)$/.exec(woerter[i])
    if (!lang && !kurz) continue
    const datei = lang ? lang[1] === 'file' : kurz[1] === 'F'
    const wert = (lang ? lang[2] : kurz[2] || undefined) ?? woerter[i + 1]
    if (wert === undefined) return undefined
    if (!datei) {
      if (/^\$\(\s*cat\s+<</.test(wert)) return ersteZeileDesDokuments(wert, 0)
      return /^[$`]/.test(wert) ? undefined : ersteZeile(wert)
    }
    if (wert === '-') return ersteZeileDesDokuments(befehl, stelle)
    try {
      const pfad = resolve(ordner, wert)
      // Nur eine gewöhnliche Datei: Ein Gerät (/dev/zero) oder eine benannte Pipe hielte den Hook sonst an.
      return statSync(pfad).isFile() ? ersteZeile(readFileSync(pfad, 'utf8')) : undefined
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * Trägt ein `git commit` in `befehl` eine Nachricht, deren erste Zeile nicht mit einem erlaubten Präfix beginnt
 * (Nr. 138, Regelvorschlag aus Morgenbericht 20 §6)? Erkannt wie in branchDesCommits (Befehlsanfang, auch
 * `git -C <ordner> commit`); geprüft wird jeder Commit, je Commit die erste Nachricht. Ohne `-m`/`-F`
 * (`--no-edit`, `git merge`) gibt es nichts zu prüfen.
 */
function commitOhnePraefix(befehl, arbeitsordner) {
  for (const treffer of befehl.matchAll(COMMIT)) {
    const stelle = treffer.index + treffer[0].length
    // Die Wörter des Commits bis zum Ende seines einfachen Befehls; das vorangestellte x steht für „commit“.
    const woerter = einfacheBefehle('x' + befehl.slice(stelle))[0].woerter.slice(1)
    const zeile = ersteNachrichtenZeile(woerter, befehl, stelle, ordnerDesCommits(befehl, treffer, arbeitsordner))
    if (zeile && !ERLAUBTE_PRAEFIXE.some((praefix) => zeile.startsWith(praefix))) return true
  }
  return false
}

// Den Text eines Here-Documents liest der Hook bewusst MIT (Nachtrag Dirigent, Lauf 17): Drei Anläufe in
// Nr. 118, ihn als Daten auszunehmen, öffneten jeweils neue Lücken. Der Fehlalarm aus Nr. 110 (eine
// Commit-Nachricht, deren Zeile mit „git stash“ beginnt) bleibt deshalb; Vorsicht geht vor (Lauf 18).
const geprueft = befehl

for (const regel of regeln) {
  if (regel.muster ? regel.muster.test(geprueft) : regel.pruefe(geprueft)) {
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

// Nach der Prüfung auf main: Ein Commit auf main behält seinen eigenen Grund, auch ohne Präfix.
if (commitOhnePraefix(geprueft, arbeitsordner)) {
  console.error('Blockiert: Commit-Texte beginnen mit feat:, fix:, docs:, chore:, refactor: oder WIP: (CLAUDE.md §5).')
  process.exit(2)
}
process.exit(0)

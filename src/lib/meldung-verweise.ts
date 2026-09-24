/**
 * Welche Meldungen ein PR behebt oder wieder öffnet — gelesen aus dem PR-Text
 * (Sprint Briefkasten-Rückkopplung, Teil E). Rein, damit die GitHub Action
 * (scripts/briefkasten-deploy.ts) nichts anderes tut als diese Funktion.
 *
 * Gezählt wird NUR eine Zeile, die mit „Behebt Meldung:" oder „Öffnet wieder
 * Meldung:" BEGINNT (optional als Listenpunkt). Mitten im Fließtext, in einem
 * Codeblock (Zaun oder eingerückt) oder in einem HTML-Kommentar zählt sie
 * nicht — sonst schlösse ein PR, der die Regel nur erklärt oder zitiert, echte
 * Meldungen, oder eine unsichtbare Zeile schlösse sie am Menschen vorbei.
 *
 * Der PR-Text ist Fremdtext. Aus ihm wird nichts übernommen außer IDs, die
 * dem Muster einer Meldungs-ID entsprechen.
 */

export type MeldungsVerweise = {
  behebt: string[]
  oeffnetWieder: string[]
  /** In beiden Listen — keine von beiden wird ausgeführt. */
  widerspruechlich: string[]
  /** Nach einem der Schlüsselwörter, aber keine gültige ID. */
  ungueltig: string[]
}

/**
 * Kurznummer (8 Zeichen) oder volle cuid (25 Zeichen), beide beginnen mit „c".
 * Enger als die Schreibroute, damit ein gewöhnliches Wort („zusammen") nicht
 * als ID gilt und den Lauf grundlos rot macht.
 */
const MELDUNG_ID = /^c[a-z0-9]{7}$|^c[a-z0-9]{24}$/

const BEHEBT = /^(?:[-*]\s+)?behebt meldung:(.*)$/i
const OEFFNET = /^(?:[-*]\s+)?öffnet wieder meldung:(.*)$/i

function ids(rest: string, ziel: Set<string>, ungueltig: Set<string>): void {
  for (const teil of rest.split(/[\s,;]+/)) {
    // Ein Punkt am Satzende gehört nicht zur ID.
    const kandidat = teil.replace(/[.)]+$/, '')
    if (kandidat === '') continue
    if (MELDUNG_ID.test(kandidat)) ziel.add(kandidat)
    else ungueltig.add(kandidat.slice(0, 40))
  }
}

/**
 * Was im gerenderten PR unsichtbar ist, zählt nicht — sonst fiele der Mensch
 * als Prüfer weg. HTML-Kommentare werden deshalb ÜBERALL entfernt, auch mitten
 * in einer Zeile und über mehrere Zeilen; ein nie geschlossener verschluckt,
 * wie im Browser, den Rest.
 */
function ohneKommentare(text: string): string {
  return text.replace(/<!--[\s\S]*?(?:-->|$)/g, '')
}

export function parseMeldungsVerweise(body: string | null | undefined): MeldungsVerweise {
  const behebt = new Set<string>()
  const oeffnet = new Set<string>()
  const ungueltig = new Set<string>()
  let imCode = false

  for (const roh of ohneKommentare(body ?? '').split(/\r\n|\r|\n/)) {
    const zeile = roh.trim()
    if (/^(```|~~~)/.test(zeile)) {
      imCode = !imCode
      continue
    }
    if (imCode) continue
    // Vier Leerzeichen (oder ein Tab) davor: in Markdown ein Codeblock, also ein Zitat.
    if (/^( {4}|\t)/.test(roh)) continue
    const b = BEHEBT.exec(zeile)
    if (b) {
      ids(b[1] ?? '', behebt, ungueltig)
      continue
    }
    const o = OEFFNET.exec(zeile)
    if (o) ids(o[1] ?? '', oeffnet, ungueltig)
  }

  const widerspruechlich = [...behebt].filter((id) => oeffnet.has(id))
  return {
    behebt: [...behebt].filter((id) => !oeffnet.has(id)),
    oeffnetWieder: [...oeffnet].filter((id) => !behebt.has(id)),
    widerspruechlich,
    ungueltig: [...ungueltig],
  }
}

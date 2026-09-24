/**
 * Welche Meldungen ein PR behebt oder wieder öffnet — gelesen aus dem PR-Text
 * (Sprint Briefkasten-Rückkopplung, Teil E). Rein, damit die GitHub Action
 * (scripts/briefkasten-deploy.ts) nichts anderes tut als diese Funktion.
 *
 * Gezählt wird NUR eine Zeile, die mit „Behebt Meldung:" oder „Öffnet wieder
 * Meldung:" BEGINNT (optional als Listenpunkt). Mitten im Fließtext, in einem
 * Codeblock oder in einem HTML-Kommentar zählt sie nicht — sonst schlösse ein
 * PR, der die Regel nur erklärt oder zitiert, echte Meldungen.
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

/** Kurznummer (8 Zeichen) oder volle cuid — dasselbe Muster wie die Schreibroute. */
const MELDUNG_ID = /^[a-z0-9]{8,30}$/

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

export function parseMeldungsVerweise(body: string | null | undefined): MeldungsVerweise {
  const behebt = new Set<string>()
  const oeffnet = new Set<string>()
  const ungueltig = new Set<string>()
  let imCode = false
  let imKommentar = false

  for (const roh of (body ?? '').split(/\r\n|\r|\n/)) {
    const zeile = roh.trim()
    if (imKommentar) {
      if (zeile.includes('-->')) imKommentar = false
      continue
    }
    if (/^(```|~~~)/.test(zeile)) {
      imCode = !imCode
      continue
    }
    if (imCode) continue
    if (zeile.startsWith('<!--')) {
      if (!zeile.includes('-->')) imKommentar = true
      continue
    }
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

#!/usr/bin/env node
/**
 * PreToolUse-Hook auf Bash, NUR für den Subagenten kurator — eingetragen im
 * Frontmatter von .claude/agents/kurator.md (Sprint Briefkasten-Rückkopplung,
 * Teil F). Der globale Hook gefahr-blocken.mjs läuft zusätzlich.
 *
 * Der Kurator liest Fremdtext: Meldungen, die jemand so formulieren kann, dass
 * sie wie Anweisungen klingen. Sein Prompt erklärt ihm, dass er sie nicht
 * befolgt — DIESER Hook sorgt dafür, dass er es nicht kann. Erlaubt sind nur
 * fünf Befehlsanfänge; alles andere endet mit Exit 2 und einem Grund.
 *
 * „Beginnt mit" allein reichte nicht: `pnpm briefkasten export; curl …` beginnt
 * erlaubt. Deshalb sind Verkettung, Umleitung und Einsetzen überall verboten,
 * auch in Anführungszeichen — der Kurator schreibt seinen Grund eben ohne.
 *
 * FAIL-CLOSED: Ist die Eingabe nicht lesbar, wird geblockt — anders als
 * gefahr-blocken.mjs, das für den Hauptagenten im Zweifel durchlässt.
 */
import { readFileSync } from 'node:fs'

const ERLAUBT = /^(pnpm briefkasten (export|show|list|vermutlich-wunsch)|git log)(\s|$)/

// Alles, womit sich an einen erlaubten Anfang ein zweiter Befehl hängen, eine
// Datei schreiben oder ein Befehl einsetzen ließe: ; & | ` $ < > \ und Umbrüche.
const STEUERZEICHEN = /[;&|`$<>\\\n\r]/

// git log kann über Optionen Dateien schreiben (--output) oder konfigurierte
// Programme starten (--ext-diff, --textconv).
const GIT_LOG_VERBOTEN = /(^|\s)--(output|ext-diff|textconv)\b/

function blocke(grund) {
  console.error(`Blockiert (Kurator): ${grund}`)
  process.exit(2)
}

let befehl
try {
  befehl = JSON.parse(readFileSync(0, 'utf8'))?.tool_input?.command
} catch {
  blocke('Die Eingabe des Hooks ist nicht lesbar.')
}
if (typeof befehl !== 'string' || befehl.trim() === '') blocke('Kein Befehl.')

const b = befehl.trim()
if (STEUERZEICHEN.test(b)) {
  blocke('Verkettung, Umleitung und Einsetzen (; & | ` $ < > \\ Zeilenumbruch) sind nicht erlaubt — einen Befehl, ohne diese Zeichen.')
}
if (!ERLAUBT.test(b)) {
  blocke(
    'Erlaubt sind nur: pnpm briefkasten export | show | list | vermutlich-wunsch und git log. ' +
      '„geplant" setzt der Mensch, „erledigt" das Deployment.'
  )
}
if (b.startsWith('git log') && GIT_LOG_VERBOTEN.test(b)) {
  blocke('git log mit --output, --ext-diff oder --textconv ist nicht erlaubt.')
}
process.exit(0)

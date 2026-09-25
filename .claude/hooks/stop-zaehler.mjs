/**
 * Der Versuchszähler des Stop-Hooks (abschluss-pruefen.mjs) — je SITZUNG.
 *
 * Warum je Sitzung: Vorher lag ein einziger Zähler in
 * tmpdir()/farmerzone-stop-hook.count. Laufen zwei Sitzungen parallel (zwei
 * Worktrees), zählte jede die Fehlversuche der anderen mit und wurde nach
 * fremden Fehlschlägen durchgelassen — oder ihr Erfolg löschte den Zähler der
 * anderen (Bereiche 2, 2026-09-25).
 *
 * Eigenes Modul, damit die Logik ohne Typecheck- und Testlauf prüfbar ist
 * (tests/stop-hook-zaehler.test.ts).
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const PRAEFIX = 'farmerzone-stop-hook'
export const MAX_ALTER_MS = 24 * 60 * 60 * 1000

/**
 * Die session_id aus dem stdin-JSON des Hooks. Nur harmlose Zeichen — sie
 * landet in einem Dateinamen. null, wenn keine brauchbare da ist.
 * @param {string} stdin
 * @returns {string | null}
 */
export function sitzungAusStdin(stdin) {
  try {
    const daten = JSON.parse(stdin)
    const id = typeof daten?.session_id === 'string' ? daten.session_id : ''
    return /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null
  } catch {
    return null
  }
}

/**
 * Pfad der Zählerdatei: je session_id; ohne sie ein kurzer Hash des
 * Arbeitsordners (zwei Worktrees zählen dann wenigstens getrennt).
 * @param {string} verzeichnis
 * @param {string | null} sitzung
 * @param {string} arbeitsordner
 * @returns {string}
 */
export function zaehlerDatei(verzeichnis, sitzung, arbeitsordner) {
  const schluessel = sitzung ?? createHash('sha256').update(arbeitsordner).digest('hex').slice(0, 12)
  return join(verzeichnis, `${PRAEFIX}-${schluessel}.count`)
}

/**
 * Löscht Zählerdateien, die älter als 24 h sind — Sitzungen, die nie grün
 * wurden, hinterlassen sonst Dateien im Temp-Ordner. Auch die alte globale
 * Datei (ohne Schlüssel) fällt so irgendwann weg.
 * @param {string} verzeichnis
 * @param {number} jetztMs
 * @returns {string[]} die gelöschten Dateinamen
 */
export function raeumeAlteAuf(verzeichnis, jetztMs) {
  const geloescht = []
  let namen = []
  try { namen = readdirSync(verzeichnis) } catch { return geloescht }
  for (const name of namen) {
    if (!name.startsWith(PRAEFIX) || !name.endsWith('.count')) continue
    const pfad = join(verzeichnis, name)
    try {
      if (jetztMs - statSync(pfad).mtimeMs > MAX_ALTER_MS) {
        unlinkSync(pfad)
        geloescht.push(name)
      }
    } catch { /* gleichzeitig von einer anderen Sitzung gelöscht — egal */ }
  }
  return geloescht
}

/** @param {string} datei @returns {number} */
export function zaehlerLesen(datei) {
  try { return Number(readFileSync(datei, 'utf8')) || 0 } catch { return 0 }
}

/** @param {string} datei @param {string} verzeichnis @param {number} n */
export function zaehlerSchreiben(datei, verzeichnis, n) {
  try { mkdirSync(verzeichnis, { recursive: true }); writeFileSync(datei, String(n)) } catch { /* Zähler ist Komfort, kein Muss */ }
}

/** @param {string} datei */
export function zaehlerLoeschen(datei) {
  try { unlinkSync(datei) } catch { /* schon weg */ }
}

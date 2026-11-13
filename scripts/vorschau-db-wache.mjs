// Erster Schritt von `vercel-build` (Nr. 294a, M7): Eine Vorschau, deren Datenbank-Variable
// auf die Produktion zeigt, bricht ab, bevor `prisma migrate deploy` die Migration eines
// ungemergten Branches dort einspielt. Produktion bekommt Migrationen nur über den Merge
// auf main (CLAUDE.md §2 „Datenbank“).
//
// Reines Node ohne Import aus src/ und ohne tsx: Ein Lader, der im Build fehlt, fiele
// sonst genau hier aus.
//
// Ausgang 1 nur bei einem Treffer in einer Vorschau. Jeder andere Weg, auch jeder Fehler
// in der Prüfung, endet mit 0: Eine Schutzprüfung darf nie eine Auslieferung der
// Produktion verhindern (wie scripts/vercel-ignore.sh). Einen Schalter zum Abschalten
// gibt es bewusst nicht – im Notfall wird die Variable in Vercel berichtigt.
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Die Supabase-Projektreferenz der Produktions-Datenbank, dieselbe wie in
 *  src/lib/umgebung.ts (Gleichlauf geprüft in tests/vorschau-db-wache.test.ts). */
export const PRODUKTION_DATENBANK_REFERENZ = 'zxwkhizjvpyporjteylr'

/** Die Variablen, aus denen Prisma das Ziel nimmt (prisma.config.ts), in der Reihenfolge
 *  der Meldung. */
const DATENBANK_VARIABLEN = ['DATABASE_URL', 'DIRECT_URL']

/**
 * Spricht die Adresse die Produktions-Datenbank an? Liest wie `erkannteFernDatenbank`
 * in src/lib/umgebung.ts: Referenz im Host (direkte Verbindung) oder im Benutzer
 * (Pooler, `postgres.<referenz>`); eine unlesbare Adresse zählt nicht.
 *
 * @param {string | undefined} wert
 * @returns {boolean}
 */
export function enthaeltProduktionsReferenz(wert) {
  const url = typeof wert === 'string' ? wert.trim() : ''
  if (!url) return false
  try {
    const geparst = new URL(url)
    const host = geparst.hostname.toLowerCase()
    const benutzer = decodeURIComponent(geparst.username).toLowerCase()
    return host.includes(PRODUKTION_DATENBANK_REFERENZ) || benutzer.includes(PRODUKTION_DATENBANK_REFERENZ)
  } catch {
    return false
  }
}

/**
 * Name der Variable, mit der eine Vorschau auf die Produktion zeigt, sonst null.
 *
 * Nur genau `preview` (so setzt Vercel es): Leer, `production` oder eine andere
 * Schreibweise halten nie auf – ein Abbruch dort könnte die Produktion aufhalten.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {'DATABASE_URL' | 'DIRECT_URL' | null}
 */
export function vorschauZeigtAufProduktion(env) {
  if (env.VERCEL_ENV !== 'preview') return null
  for (const name of DATENBANK_VARIABLEN) {
    if (enthaeltProduktionsReferenz(env[name])) return /** @type {'DATABASE_URL' | 'DIRECT_URL'} */ (name)
  }
  return null
}

/** Läuft die Datei selbst (`node scripts/vorschau-db-wache.mjs`) oder bindet ein Test sie ein? */
function istHauptmodul() {
  const aufgerufen = process.argv[1]
  if (!aufgerufen) return false
  return realpathSync(aufgerufen) === realpathSync(fileURLToPath(import.meta.url))
}

function hauptteil() {
  let treffer = null
  try {
    treffer = vorschauZeigtAufProduktion(process.env)
  } catch {
    // Ein Fehler in der Prüfung lässt bauen; den Fehler selbst nicht ausgeben, er könnte die Adresse tragen.
    console.log('vorschau-db-wache: Prüfung nicht möglich, es wird gebaut.')
    return
  }
  if (treffer) {
    // Nur der Name der Variable – nie ihr Wert, nie der Host mit Zugangsdaten (Build-Logs sind lesbar).
    try {
      console.error(
        `Abbruch: ${treffer} dieser Vorschau zeigt auf die Produktions-Datenbank. Variablen in Vercel prüfen.`,
      )
    } finally {
      // Auch wenn die Meldung scheitert: Der Treffer steht, die Migration darf nicht laufen.
      process.exit(1)
    }
  }
  console.log('vorschau-db-wache: keine Vorschau auf die Produktions-Datenbank, es wird gebaut.')
}

try {
  if (istHauptmodul()) hauptteil()
} catch {
  // Jeder Fehler außerhalb des Treffers: Ausgang 0, damit die Produktion immer baut.
  process.exitCode = 0
}

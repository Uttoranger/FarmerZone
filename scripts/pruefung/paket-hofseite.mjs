// Kein Hof-Code im Paket der Hofseite (Nr. 306). Läuft in der CI nach „Build“:
// `node scripts/pruefung/paket-hofseite.mjs`.
//
// Die Hofseite lädt jede Kundin. Bis Nr. 306 trug ihr Paket den toten Bearbeitungsmodus
// mit (dnd-kit, Produktbild-Knopf) und den Titelbild-Knopf von Mein Hof – rund 100 KB,
// die keine Kundin brauchte. Das Skript liest das Client-Manifest der Hofseite, sammelt
// die Chunks aller Client-Module, misst sie (roh und gzip) und endet mit 1, sobald ein
// Chunk eine der Marken trägt. Ein unlesbares Manifest endet ebenfalls mit 1: Ein
// umbenannter Ordner nach einem Next-Update soll die CI rot machen, nicht still grün.
//
// Reines Node ohne Paket und ohne Import aus src/ (wie scripts/vorschau-db-wache.mjs).
import { readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import { gzipSync } from 'node:zlib'

/** Zeichenfolgen, die nur im Hof-Code stehen: dnd-kit, der Produktbild-Knopf, der Titelbild-Knopf. */
export const MARKEN = Object.freeze(['DndDescribedBy', 'Produktbild aktualisiert', 'Titelbild ersetzen'])

/** Das Manifest, das `next build` (Next 16) für die Hofseite schreibt. */
const MANIFEST_PFAD = '.next/server/app/(public)/[farmSlug]/page_client-reference-manifest.js'

/** Chunks stehen im Manifest als Adresse; die Datei liegt unter .next/ ohne „/_next/“. */
const CHUNK_ADRESSE = /^\/_next\/(static\/chunks\/[A-Za-z0-9._-]+\.js)$/

/**
 * Welche Marken stehen im Text? In der Reihenfolge von MARKEN, jede höchstens einmal.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function findeMarken(text) {
  return MARKEN.filter((marke) => text.includes(marke))
}

/**
 * Führt den Text des Manifests in einem eigenen `node:vm`-Kontext aus – nie im
 * eigenen (kein eval): Der Text setzt `globalThis.__RSC_MANIFEST`. Wirft mit klarer
 * Meldung, wenn er nicht läuft oder nichts setzt.
 *
 * @param {string} quelltext
 * @returns {Record<string, unknown>}
 */
export function leseManifest(quelltext) {
  /** @type {Record<string, unknown>} */
  const kontext = {}
  kontext.globalThis = kontext
  createContext(kontext)
  try {
    runInContext(quelltext, kontext, { timeout: 5_000 })
  } catch (fehler) {
    throw new Error(`Manifest nicht lesbar: ${fehler instanceof Error ? fehler.message : String(fehler)}`)
  }
  const manifest = kontext.__RSC_MANIFEST
  if (!manifest || typeof manifest !== 'object' || Object.keys(manifest).length === 0) {
    throw new Error('Manifest nicht lesbar: kein __RSC_MANIFEST gesetzt')
  }
  return /** @type {Record<string, unknown>} */ (manifest)
}

/**
 * Die Chunks aller Client-Module, jeder einmal, als Pfad unter `.next/`. Wirft, wenn
 * keiner da ist oder einer nicht wie ein Chunk unter `/_next/static/chunks/` aussieht.
 *
 * @param {Record<string, unknown>} manifest
 * @returns {string[]}
 */
export function chunksAusManifest(manifest) {
  /** @type {Set<string>} */
  const chunks = new Set()
  for (const seite of Object.values(manifest)) {
    const clientModules = seite && typeof seite === 'object' ? /** @type {{ clientModules?: unknown }} */ (seite).clientModules : null
    if (!clientModules || typeof clientModules !== 'object') continue
    for (const modul of Object.values(clientModules)) {
      const liste = modul && typeof modul === 'object' ? /** @type {{ chunks?: unknown }} */ (modul).chunks : null
      if (!Array.isArray(liste)) continue
      for (const adresse of liste) {
        const treffer = typeof adresse === 'string' ? CHUNK_ADRESSE.exec(adresse) : null
        if (!treffer) throw new Error(`Unerwarteter Chunk im Manifest: ${String(adresse)}`)
        chunks.add(treffer[1])
      }
    }
  }
  if (chunks.size === 0) throw new Error('Manifest nicht lesbar: keine Chunks in clientModules')
  return [...chunks]
}

/** Läuft die Datei selbst oder bindet ein Test sie ein? */
function istHauptmodul() {
  const aufgerufen = process.argv[1]
  if (!aufgerufen) return false
  return realpathSync(aufgerufen) === realpathSync(fileURLToPath(import.meta.url))
}

function hauptteil() {
  let chunks
  try {
    chunks = chunksAusManifest(leseManifest(readFileSync(MANIFEST_PFAD, 'utf8')))
  } catch (fehler) {
    console.log(`FEHLER ${MANIFEST_PFAD}: ${fehler instanceof Error ? fehler.message : String(fehler)} – erst \`pnpm build\`.`)
    process.exitCode = 1
    return
  }
  let roh = 0
  let gzip = 0
  /** @type {string[]} */
  const funde = []
  for (const chunk of chunks) {
    const inhalt = readFileSync(join('.next', chunk))
    roh += inhalt.length
    gzip += gzipSync(inhalt).length
    for (const marke of findeMarken(inhalt.toString('utf8'))) funde.push(`${chunk}: „${marke}“`)
  }
  console.log(`Paket der Hofseite: ${chunks.length} Chunks, ${roh} Bytes roh, ${gzip} Bytes gzip (je Chunk gepackt, summiert)`)
  if (funde.length > 0) {
    console.log('FEHLER Hof-Code im Paket der Hofseite:')
    for (const fund of funde) console.log(`  ${fund}`)
    process.exitCode = 1
  }
}

if (istHauptmodul()) hauptteil()

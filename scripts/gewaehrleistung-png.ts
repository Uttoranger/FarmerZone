/**
 * Rastert die amtliche Gewährleistungs-Mitteilung (Anhang II FAGG, Nr. 211)
 * einmalig zur PNG für die Bestätigungsmails — Mailprogramme zeigen SVG meist
 * nicht an. Aufruf: `pnpm exec tsx scripts/gewaehrleistung-png.ts`; schreibt
 * public/recht/gewaehrleistung-mitteilung-de.png, die committet wird.
 *
 * Reine Rasterung, sonst nichts (Freigabe Lauf 29 §2 „Recht“): librsvg
 * zeichnet die SVG gleich in einer Dichte, die mindestens die Zielbreite
 * ergibt — ein kleines Raster wird nie hochskaliert —, `resize` bringt sie
 * auf genau 1240 px (Seitenverhältnis bleibt), `flatten` legt den
 * durchsichtigen Grund auf Weiß (das Papier der A4-Seite). Kein Zuschnitt,
 * keine Farbe, keine Palette (verlustfreies PNG).
 *
 * Pfade und Breite kommen aus src/lib/rechtstexte/gewaehrleistung-mitteilung.ts;
 * tests/gewaehrleistung-dateien.test.ts prüft Breite und A4-Verhältnis.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { GEWAEHRLEISTUNG_MITTEILUNG } from '../src/lib/rechtstexte/gewaehrleistung-mitteilung'

/** Die Dichte, in der librsvg rastert, wenn nichts angegeben ist (1 pt = 1 px). */
const SVG_GRUNDDICHTE = 72

async function rastere(): Promise<void> {
  const wurzel = process.cwd()
  const quelle = join(wurzel, 'public', GEWAEHRLEISTUNG_MITTEILUNG.svgPfad)
  const ziel = join(wurzel, 'public', GEWAEHRLEISTUNG_MITTEILUNG.pngPfad)
  const svg = readFileSync(quelle)

  // Breite der SVG bei 72 dpi (librsvg rundet auf ganze Pixel ab) — daraus die Dichte für mindestens 1240 px.
  const { width: svgBreite } = await sharp(svg).metadata()
  if (!svgBreite) throw new Error('Die SVG hat keine lesbare Breite.')
  const dichte = (SVG_GRUNDDICHTE * GEWAEHRLEISTUNG_MITTEILUNG.pngBreite) / svgBreite

  const png = await sharp(svg, { density: dichte })
    .resize({ width: GEWAEHRLEISTUNG_MITTEILUNG.pngBreite })
    .flatten({ background: 'white' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  writeFileSync(ziel, png)

  const { width, height } = await sharp(png).metadata()
  console.log(`${GEWAEHRLEISTUNG_MITTEILUNG.pngPfad}: ${width} × ${height} px, ${statSync(ziel).size} Bytes (Dichte ${dichte.toFixed(2)})`)
}

rastere().catch((fehler: unknown) => {
  console.error(fehler)
  process.exit(1)
})

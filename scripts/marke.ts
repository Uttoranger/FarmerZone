/**
 * Erzeugt die Icon-Dateien aus den zwei Marken-SVG (Register M1, Ergänzung
 * 14.10.2026, Nr. 92). Aufruf: `pnpm marke` — schreibt jede Zieldatei, die
 * sich ändert, und nennt sie; `pnpm marke --kontaktbogen <datei>` legt dazu
 * einen Kontaktbogen für Berichte ab (16/32/48 dreifach vergrößert, 180, 512
 * und maskierbar mit der 80-%-Zone).
 *
 * Was entsteht, sagt src/lib/marke-bild.ts (Pfade, Größen, Fassung je Größe,
 * Form: gerundet, randlos, maskierbar); gezeichnet wird mit dem vorhandenen
 * sharp (librsvg) direkt in der Zielgröße — nichts wird von Hand verkleinert.
 * Das Favicon ist ein ICO mit PNG-Einträgen (seit Windows Vista gültig),
 * der Kopf entsteht hier von Hand statt über ein weiteres Paket.
 *
 * Dieselben Eingaben ergeben dieselben Bytes: tests/marke-bilder.test.ts
 * vergleicht die Dateien im Repo mit einem frischen Lauf (Bild für Bild,
 * Pixel für Pixel) — wer ein SVG ändert, lässt `pnpm marke` laufen und
 * committet die Ziele mit.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import {
  MARKE_FAVICON,
  MARKE_ICON_SVG,
  MARKE_MASKIERBAR_ANTEIL,
  MARKE_ZIELE,
  ladeMarkeSvg,
  markeFassungFuer,
  markeMaskierbarSvg,
  markeMitRundungSvg,
  svgInGroesse,
  type MarkeFassung,
  type MarkeForm,
} from '../src/lib/marke-bild'

export type MarkeDatei = { pfad: string; inhalt: Buffer }
export type IcoEintrag = { px: number; png: Buffer }

/** Das SVG in der Form des Ziels: Rundung als clipPath, Zeichnung in der Sicherheitszone, oder unverändert. */
function geformt(svg: string, form: MarkeForm): string {
  if (form === 'gerundet') return markeMitRundungSvg(svg)
  if (form === 'maskierbar') return markeMaskierbarSvg(svg)
  return svg
}

/** Zeichnet das SVG in genau `px` Pixeln als PNG mit Alpha — ohne Palette, fest komprimiert, damit zwei Läufe gleich sind. */
export async function zeichnePng(svg: string, px: number): Promise<Buffer> {
  return sharp(Buffer.from(svgInGroesse(svg, px), 'utf8')).png({ compressionLevel: 9, adaptiveFiltering: false, palette: false }).toBuffer()
}

/** ICO-Datei aus PNG-Einträgen: Kopf (6 Byte), je Eintrag 16 Byte Verzeichnis, dann die PNG-Daten in derselben Reihenfolge. */
export function schreibeIco(eintraege: readonly IcoEintrag[]): Buffer {
  const kopf = Buffer.alloc(6)
  kopf.writeUInt16LE(0, 0) // reserviert
  kopf.writeUInt16LE(1, 2) // 1 = Icon
  kopf.writeUInt16LE(eintraege.length, 4)
  const verzeichnis = Buffer.alloc(16 * eintraege.length)
  let versatz = kopf.length + verzeichnis.length
  eintraege.forEach(({ px, png }, i) => {
    const e = i * 16
    // 0 steht im ICO für 256 — größer wird ein Eintrag nicht.
    verzeichnis.writeUInt8(px >= 256 ? 0 : px, e)
    verzeichnis.writeUInt8(px >= 256 ? 0 : px, e + 1)
    verzeichnis.writeUInt8(0, e + 2) // keine Palette
    verzeichnis.writeUInt8(0, e + 3) // reserviert
    verzeichnis.writeUInt16LE(1, e + 4) // Farbebenen
    verzeichnis.writeUInt16LE(32, e + 6) // Bit je Pixel (RGBA)
    verzeichnis.writeUInt32LE(png.length, e + 8)
    verzeichnis.writeUInt32LE(versatz, e + 12)
    versatz += png.length
  })
  return Buffer.concat([kopf, verzeichnis, ...eintraege.map((e) => e.png)])
}

/** Liest ein ICO mit PNG-Einträgen zurück — für den Test und als Gegenprobe des Schreibers. */
export function leseIco(ico: Buffer): IcoEintrag[] {
  if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) throw new Error('Kein ICO.')
  const anzahl = ico.readUInt16LE(4)
  const eintraege: IcoEintrag[] = []
  for (let i = 0; i < anzahl; i++) {
    const e = 6 + i * 16
    const breite = ico.readUInt8(e) || 256
    const laenge = ico.readUInt32LE(e + 8)
    const versatz = ico.readUInt32LE(e + 12)
    const png = ico.subarray(versatz, versatz + laenge)
    if (png.subarray(1, 4).toString('ascii') !== 'PNG') throw new Error(`Eintrag ${breite} ist kein PNG.`)
    eintraege.push({ px: breite, png: Buffer.from(png) })
  }
  return eintraege
}

/** Alle Zieldateien, im Speicher, sortiert nach Pfad — der Test vergleicht sie mit dem Repo, das Skript schreibt sie. */
export async function erzeugeMarkeDateien(): Promise<MarkeDatei[]> {
  const svg: Record<MarkeFassung, string> = { voll: await ladeMarkeSvg('voll'), klein: await ladeMarkeSvg('klein') }
  const dateien: MarkeDatei[] = []
  for (const ziel of Object.values(MARKE_ZIELE)) {
    dateien.push({ pfad: ziel.pfad, inhalt: await zeichnePng(geformt(svg[ziel.fassung], ziel.form), ziel.px) })
  }
  // Favicon: je Größe die Fassung nach der Grenze (16 und 32 klein, 48 voll), gerundet wie die App-Icons.
  const favicon: IcoEintrag[] = []
  for (const px of MARKE_FAVICON.groessen) favicon.push({ px, png: await zeichnePng(markeMitRundungSvg(svg[markeFassungFuer(px)]), px) })
  dateien.push({ pfad: MARKE_FAVICON.pfad, inhalt: schreibeIco(favicon) })
  dateien.push({ pfad: MARKE_ICON_SVG.pfad, inhalt: Buffer.from(`${markeMitRundungSvg(svg[MARKE_ICON_SVG.fassung])}\n`, 'utf8') })
  return dateien.sort((a, b) => a.pfad.localeCompare(b.pfad))
}

/** Schreibt, was sich geändert hat; gibt je Datei eine Zeile zurück. */
export async function schreibeMarkeDateien(wurzel: string): Promise<string[]> {
  const zeilen: string[] = []
  for (const { pfad, inhalt } of await erzeugeMarkeDateien()) {
    const ziel = join(wurzel, pfad)
    if (existsSync(ziel) && readFileSync(ziel).equals(inhalt)) {
      zeilen.push(`unverändert ${pfad}`)
      continue
    }
    mkdirSync(dirname(ziel), { recursive: true })
    writeFileSync(ziel, inhalt)
    zeilen.push(`geschrieben  ${pfad} (${inhalt.length} B)`)
  }
  return zeilen
}

/**
 * Kontaktbogen für den Bericht: Favicon 16/32/48 dreifach (Pixel sichtbar),
 * Apple 180, Icon 512 und maskierbar 512 (mit der 80-%-Zone als Kreis) in
 * einer Reihe auf hellem Grund. Nur zum Ansehen, nicht Teil des Repos.
 */
export async function zeichneKontaktbogen(): Promise<Buffer> {
  const dateien = new Map((await erzeugeMarkeDateien()).map((d) => [d.pfad, d.inhalt]))
  const favicon = leseIco(dateien.get(MARKE_FAVICON.pfad) ?? Buffer.alloc(0))
  const grund = { r: 236, g: 232, b: 222, alpha: 1 }
  const luft = 48
  const dreifach = async (png: Buffer, px: number): Promise<{ bild: Buffer; kante: number }> => ({
    bild: await sharp(png).resize(px * 3, px * 3, { kernel: 'nearest' }).png().toBuffer(),
    kante: px * 3,
  })
  const teile: { bild: Buffer; kante: number }[] = []
  for (const e of favicon) teile.push(await dreifach(e.png, e.px))
  teile.push({ bild: dateien.get(MARKE_ZIELE.apple180.pfad) ?? Buffer.alloc(0), kante: MARKE_ZIELE.apple180.px })
  teile.push({ bild: dateien.get(MARKE_ZIELE.icon512.pfad) ?? Buffer.alloc(0), kante: MARKE_ZIELE.icon512.px })
  const maskierbar = MARKE_ZIELE.maskierbar512
  const zone = Math.round(maskierbar.px * MARKE_MASKIERBAR_ANTEIL)
  const kreis = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${maskierbar.px}" height="${maskierbar.px}"><circle cx="${maskierbar.px / 2}" cy="${maskierbar.px / 2}" r="${zone / 2}" fill="none" stroke="white" stroke-width="3" stroke-dasharray="10 8"/></svg>`
  )
  teile.push({
    bild: await sharp(dateien.get(maskierbar.pfad) ?? Buffer.alloc(0)).composite([{ input: kreis }]).png().toBuffer(),
    kante: maskierbar.px,
  })
  const breite = teile.reduce((summe, t) => summe + t.kante, 0) + luft * (teile.length + 1)
  const hoehe = Math.max(...teile.map((t) => t.kante)) + luft * 2
  let x = luft
  const lagen = teile.map((t) => {
    const lage = { input: t.bild, left: x, top: hoehe - luft - t.kante }
    x += t.kante + luft
    return lage
  })
  return sharp({ create: { width: breite, height: hoehe, channels: 4, background: grund } }).composite(lagen).png().toBuffer()
}

if (/(^|[\\/])marke\.(ts|js|mjs|cjs)$/.test(process.argv[1] ?? '')) {
  const bogen = process.argv.indexOf('--kontaktbogen')
  const lauf = bogen >= 0 ? zeichneKontaktbogen().then((png) => [bogenSchreiben(png, process.argv[bogen + 1])]) : schreibeMarkeDateien(process.cwd())
  lauf.then(
    (zeilen) => {
      for (const zeile of zeilen) console.log(zeile)
    },
    (fehler: unknown) => {
      // Auch ein unerwarteter Abbruch endet mit einer FEHLER-Zeile und Exit 1, nie stumm.
      console.log(`FEHLER Marke abgebrochen: ${fehler instanceof Error ? fehler.message : String(fehler)}`)
      process.exitCode = 1
    }
  )
}

function bogenSchreiben(png: Buffer, ziel: string | undefined): string {
  if (!ziel) throw new Error('--kontaktbogen braucht einen Dateinamen.')
  mkdirSync(dirname(ziel), { recursive: true })
  writeFileSync(ziel, png)
  return `Kontaktbogen ${ziel} (${png.length} B)`
}

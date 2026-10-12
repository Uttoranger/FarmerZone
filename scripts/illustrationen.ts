/**
 * Prüft die Illustrationen unter public/categories/ (Register I1, Nr. 74).
 * Aufruf: `pnpm illustrationen`; Exit 1 bei einem Verstoß. Kein Teil von build
 * und vercel-build — die CI führt es als eigenen Schritt neben dem Lint aus.
 *
 * Erwartet wird je Bild eine Farbdatei und eine Schwarzweiß-Datei unter sw/,
 * und zwar für jede Kategorie und jede Unterkategorie mit eigener Illustration.
 * Welche das sind, sagt lib/taxonomie.ts — hier steht keine zweite Liste.
 * Jede Datei: WebP, 1024 × 1024 Pixel, höchstens 80 KB, und die äußeren 8 Pixel
 * sind einfarbig, bei Farbe Creme (#F3EFE3), bei Schwarzweiß Weiß, je Kanal
 * ±6 (WebP rundet). Ein ungleicher Rand zeichnete auf der Kachel eine Naht ab.
 *
 * Gelesen werden nur die Dateien; die Ausgabe hängt allein von ihnen ab
 * (sortiert, ohne Zeiten, ohne absolute Pfade), zwei Läufe sind gleich.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import {
  OHNE_EIGENE_ILLUSTRATION,
  PRODUCT_CATEGORY_VALUES,
  ZUGEORDNETE_UNTERKATEGORIEN,
  illustrationPfad,
  kategorieBildPfad,
  kategorieVon,
} from '../src/lib/taxonomie'

export type Fassung = 'farbe' | 'sw'

export interface ErwarteteIllustration {
  /** Ab public/, mit führendem „/“: „/categories/milch/kaese.webp“. */
  pfad: string
  fassung: Fassung
}

export interface Verstoss {
  pfad: string
  grund: string
}

export const KANTE_PX = 1024
export const MAX_BYTES = 80 * 1024
export const RAND_PX = 8
export const RAND_TOLERANZ = 6

/** Rot, Grün, Blau des Rands je Fassung — Creme ist der Grund der Karten, Weiß der des Drucks. */
const RAND_SOLL: Record<Fassung, readonly [number, number, number]> = {
  farbe: [0xf3, 0xef, 0xe3],
  sw: [255, 255, 255],
}
const RAND_NAME: Record<Fassung, string> = { farbe: 'Creme #F3EFE3', sw: 'Weiß' }

/** Alle Dateien, die es geben muss — sortiert, Farbe und Schwarzweiß je Bild nebeneinander. */
export function erwarteteIllustrationen(): ErwarteteIllustration[] {
  // Ein Set: FUTTERMITTEL (Altlast) und SONSTIGES teilen sich eine Datei.
  const farbe = new Set<string>()
  for (const l1 of PRODUCT_CATEGORY_VALUES) {
    const pfad = kategorieBildPfad(l1)
    if (pfad) farbe.add(pfad)
  }
  for (const l2 of ZUGEORDNETE_UNTERKATEGORIEN) {
    if ((OHNE_EIGENE_ILLUSTRATION as readonly string[]).includes(l2)) continue
    farbe.add(illustrationPfad(kategorieVon(l2), l2))
  }
  return [...farbe].sort().flatMap((pfad): ErwarteteIllustration[] => [
    { pfad, fassung: 'farbe' },
    { pfad: pfad.replace('/categories/', '/categories/sw/'), fassung: 'sw' },
  ])
}

/** Die größte Abweichung eines Randpixels vom Soll (RGB und Deckkraft 255), 0 = genau. */
async function randAbweichung(bytes: Uint8Array, fassung: Fassung): Promise<number> {
  // Mit Alpha: Ein durchsichtiger Rand ist kein Creme, auch wenn sein RGB-Wert passt.
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const soll = [...RAND_SOLL[fassung], 255]
  let groesste = 0
  const pruefe = (x: number, y: number): void => {
    const stelle = (y * info.width + x) * info.channels
    for (let kanal = 0; kanal < 4; kanal++) groesste = Math.max(groesste, Math.abs(data[stelle + kanal] - soll[kanal]))
  }
  for (let y = 0; y < info.height; y++) {
    if (y < RAND_PX || y >= info.height - RAND_PX) {
      for (let x = 0; x < info.width; x++) pruefe(x, y)
    } else {
      for (let x = 0; x < RAND_PX; x++) pruefe(x, y)
      for (let x = info.width - RAND_PX; x < info.width; x++) pruefe(x, y)
    }
  }
  return groesste
}

/** Alle Gründe, aus denen diese Datei nicht gilt; leer = in Ordnung. */
export async function pruefeBild(bytes: Uint8Array, fassung: Fassung): Promise<string[]> {
  const gruende: string[] = []
  if (bytes.byteLength > MAX_BYTES) {
    gruende.push(`${Math.ceil(bytes.byteLength / 1024)} KB, erlaubt sind höchstens ${MAX_BYTES / 1024} KB`)
  }
  const meta = await sharp(bytes).metadata().catch(() => null)
  if (!meta) return [...gruende, 'keine lesbare Bilddatei']
  if (meta.format !== 'webp') gruende.push(`Format ${meta.format ?? 'unbekannt'} statt WebP`)
  if (meta.width !== KANTE_PX || meta.height !== KANTE_PX) {
    // Der Rand eines Bilds in falscher Größe sagt nichts mehr.
    return [...gruende, `${meta.width ?? '?'}×${meta.height ?? '?'} Pixel statt ${KANTE_PX}×${KANTE_PX}`]
  }
  const abweichung = await randAbweichung(bytes, fassung)
  if (abweichung > RAND_TOLERANZ) {
    gruende.push(`Rand nicht einfarbig ${RAND_NAME[fassung]} (Abweichung bis ${abweichung} von ±${RAND_TOLERANZ})`)
  }
  return gruende
}

/** Prüft alle erwarteten Dateien unter `<wurzel>/public`; nacheinander, damit die Reihenfolge feststeht. */
export async function pruefeIllustrationen(
  wurzel: string,
  erwartet: readonly ErwarteteIllustration[] = erwarteteIllustrationen()
): Promise<Verstoss[]> {
  const verstoesse: Verstoss[] = []
  for (const { pfad, fassung } of erwartet) {
    const datei = join(wurzel, 'public', pfad)
    if (!existsSync(datei)) {
      verstoesse.push({ pfad, grund: 'fehlt' })
      continue
    }
    for (const grund of await pruefeBild(readFileSync(datei), fassung)) verstoesse.push({ pfad, grund })
  }
  return verstoesse
}

/** Die Ausgabe und den Exitcode des Laufs — getrennt vom Schreiben, damit der Test beides sieht. */
export async function fuehreAus(
  wurzel: string,
  erwartet: readonly ErwarteteIllustration[] = erwarteteIllustrationen()
): Promise<{ zeilen: string[]; exitCode: 0 | 1 }> {
  const verstoesse = await pruefeIllustrationen(wurzel, erwartet)
  const farbe = erwartet.filter((e) => e.fassung === 'farbe').length
  const umfang = `${erwartet.length} Dateien geprüft (${farbe} Farbe, ${erwartet.length - farbe} Schwarzweiß)`
  if (verstoesse.length === 0) return { zeilen: [`Illustrationen: ${umfang}, alle in Ordnung.`], exitCode: 0 }
  const betroffen = new Set(verstoesse.map((v) => v.pfad)).size
  return {
    zeilen: [...verstoesse.map((v) => `FEHLER public${v.pfad}: ${v.grund}`), `Illustrationen: ${umfang}, ${betroffen} mit Verstoß.`],
    exitCode: 1,
  }
}

if (/illustrationen\.(ts|js|mjs|cjs)$/.test(process.argv[1] ?? '')) {
  fuehreAus(process.cwd()).then(({ zeilen, exitCode }) => {
    for (const zeile of zeilen) console.log(zeile)
    process.exitCode = exitCode
  })
}

/**
 * Die Bildmarke als Daten (Register M1, Ergänzung 14.10.2026): EINE Marke in
 * zwei Fassungen derselben Form — `voll` (A mit Blatt, Baum, Stadel, Furchen)
 * ab 48 px, `klein` (nur A mit Blatt) darunter, also Favicon 16/32 und die
 * Kopfzeile mit 32. Quelle sind zwei SVG der Projektleitung unter
 * public/marke/; die Farben (Kachel, Zeichnung, Blatt) stehen nur dort und
 * wechseln nicht mit Hell/Dunkel. Die Kachel gehört zur Marke, ihre Rundung
 * (22 % der Kante) entsteht im Skript (`pnpm marke`, scripts/marke.ts) bzw.
 * per CSS (Bildmarke) — nie im SVG, sonst gäbe es zwei Zeichnungen.
 *
 * Hier stehen Pfade und Ziele, die Grenze, die reinen Umformungen des
 * SVG-Texts und der Lader: die eine Quelle für Satori (Teilen-Bild,
 * Status-Bild), die Bildmarke und das Skript. Mockup:
 * docs/mockups/system-m1-marke-…-entscheidung.html (der Name steht nur in
 * src/lib/marke.ts; auch die Dateinamen leiten sich von dort ab).
 */
import { MARKE } from '@/lib/marke'

export type MarkeFassung = 'voll' | 'klein'

/** Die Dateien tragen den Namen klein geschrieben — aus der einen Quelle, nie als zweites Literal (tests/marke-name-wache.test.ts). */
const DATEINAME = MARKE.toLowerCase()
export const MARKE_SVG_VOLL = `public/marke/${DATEINAME}-icon-voll.svg`
export const MARKE_SVG_KLEIN = `public/marke/${DATEINAME}-icon-klein.svg`
export const MARKE_SVG: Record<MarkeFassung, string> = { voll: MARKE_SVG_VOLL, klein: MARKE_SVG_KLEIN }
/** Teilen-Bild der Startseite (1200 × 630), fertig geliefert — der Text ist Teil des Bildes. */
export const MARKE_OG = 'public/og/startseite.jpg'

/** Ab dieser Kante die volle Fassung; darunter werden Baum und Stadel zu Flecken. */
export const MARKE_VOLL_AB_PX = 48
/** Rundung der Kachel in Prozent der Kante — wie App-Icons, im Skript und per CSS. */
export const MARKE_RUNDUNG_PROZENT = 22
/** Maskierbares Icon: Android darf bis zum Rand beschneiden, die Zeichnung sitzt in der inneren Zone. */
export const MARKE_MASKIERBAR_ANTEIL = 0.8
/** Die Kopfzeile: kleine Fassung mit 32 px und 8 px Rundung (Mockup „Kleinfassung 32 px mit 8 px Rundung") — 8 von 32 sind 25 %. */
export const MARKE_KOPF_PX = 32
export const MARKE_KOPF_RUNDUNG_PROZENT = 25

/** `gerundet`: Kachel mit 22 % Rundung auf durchsichtigem Grund; `randlos`: iOS rundet selbst; `maskierbar`: Kachel randlos, Zeichnung auf 80 %. */
export type MarkeForm = 'gerundet' | 'randlos' | 'maskierbar'
export type MarkeZiel = { pfad: string; px: number; fassung: MarkeFassung; form: MarkeForm }

/** Die PNG-Ziele des Skripts: Manifest-Icons (tests/manifest.test.ts) und das Apple-Icon der Dateikonvention. */
export const MARKE_ZIELE = {
  icon192: { pfad: 'public/icons/icon-192.png', px: 192, fassung: 'voll', form: 'gerundet' },
  icon512: { pfad: 'public/icons/icon-512.png', px: 512, fassung: 'voll', form: 'gerundet' },
  maskierbar512: { pfad: 'public/icons/icon-maskable-512.png', px: 512, fassung: 'voll', form: 'maskierbar' },
  apple180: { pfad: 'src/app/apple-icon.png', px: 180, fassung: 'voll', form: 'randlos' },
} as const satisfies Record<string, MarkeZiel>

/** Das Favicon als ICO mit PNG-Einträgen: 16 und 32 klein, 48 voll (Fassung je Größe nach der Grenze). */
export const MARKE_FAVICON = { pfad: 'src/app/favicon.ico', groessen: [16, 32, 48] } as const
/** Das moderne Favicon nach Nexts Dateikonvention: die kleine Fassung mit der Rundung als clipPath. */
export const MARKE_ICON_SVG = { pfad: 'src/app/icon.svg', fassung: 'klein' } as const satisfies { pfad: string; fassung: MarkeFassung }

export function markeFassungFuer(px: number): MarkeFassung {
  return px >= MARKE_VOLL_AB_PX ? 'voll' : 'klein'
}

/** Die Adresse der SVG-Datei im Browser — dieselbe Datei wie unter public/. */
export function markeBildUrl(fassung: MarkeFassung): string {
  return MARKE_SVG[fassung].replace(/^public/, '')
}

/** Wurzel-Tag und Inhalt des SVG — die Umformungen fassen nur die Wurzel an und legen Gruppen um den Inhalt. */
function zerlege(svg: string): { wurzel: string; rumpf: string } {
  const ende = svg.indexOf('>')
  const schluss = svg.lastIndexOf('</svg>')
  if (!svg.startsWith('<svg') || ende < 0 || schluss < 0) throw new Error('Die Marke ist kein SVG-Text.')
  return { wurzel: svg.slice(0, ende + 1), rumpf: svg.slice(ende + 1, schluss) }
}

/** Die Kante der quadratischen viewBox (100 bei den gelieferten Dateien). */
function kante(wurzel: string): number {
  const viewBox = wurzel.match(/\sviewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/)
  if (!viewBox || viewBox[1] !== viewBox[2]) throw new Error('Die Marke braucht eine quadratische viewBox ab 0 0.')
  return Number(viewBox[1])
}

function mitAttribut(wurzel: string, name: string, wert: string | number): string {
  const muster = new RegExp(`\\s${name}="[^"]*"`)
  return muster.test(wurzel) ? wurzel.replace(muster, ` ${name}="${wert}"`) : wurzel.replace(/>$/, ` ${name}="${wert}">`)
}

/** Dasselbe SVG mit anderer Breite und Höhe — so zeichnet sharp es gleich in der Zielgröße statt zu verkleinern. */
export function svgInGroesse(svg: string, px: number): string {
  const { wurzel, rumpf } = zerlege(svg)
  return `${mitAttribut(mitAttribut(wurzel, 'width', px), 'height', px)}${rumpf}</svg>`
}

/** Die Rundung als clipPath um die ganze Zeichnung — für icon.svg und die gerundeten PNG; das Quell-SVG bleibt eckig. */
export function markeMitRundungSvg(svg: string, prozent: number = MARKE_RUNDUNG_PROZENT): string {
  const { wurzel, rumpf } = zerlege(svg)
  const k = kante(wurzel)
  const radius = (k * prozent) / 100
  return `${wurzel}<defs><clipPath id="kachel"><rect width="${k}" height="${k}" rx="${radius}" ry="${radius}"/></clipPath></defs><g clip-path="url(#kachel)">${rumpf}</g></svg>`
}

/** Maskierbar: Die Kachel bleibt randlos, nur die Zeichnung schrumpft in die Mitte (Sicherheitszone). */
export function markeMaskierbarSvg(svg: string, anteil: number = MARKE_MASKIERBAR_ANTEIL): string {
  const { wurzel, rumpf } = zerlege(svg)
  const k = kante(wurzel)
  const kachel = rumpf.match(/<rect\b[^>]*\/>/)
  if (!kachel) throw new Error('Die Marke hat keine Kachel (rect).')
  const zeichnung = rumpf.replace(kachel[0], '')
  // Gerundet, sonst stünde 9.999999999999998 im SVG (1 − 0,8 ist in Gleitkommazahlen kein glatter Wert).
  const rand = Math.round(((k * (1 - anteil)) / 2) * 1000) / 1000
  return `${wurzel}${kachel[0]}<g transform="translate(${rand} ${rand}) scale(${anteil})">${zeichnung}</g></svg>`
}

/** Base64, damit Satori das SVG als `<img>` zeichnet (resvg liest data-URLs). */
export function svgAlsDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

const gelesen = new Map<MarkeFassung, Promise<string>>()

/**
 * Liest die SVG-Datei einmal (serverseitig) und merkt sich den Text.
 *
 * Kein `import 'node:fs'` am Modulanfang: Dieses Modul gibt auch der
 * Bildmarke im Browser ihre Pfade — ein statischer Import eines Node-Moduls
 * landete im Client-Bundle und bräche den Build. Der Lader läuft nur auf dem
 * Server (Satori-Routen, Skript); `process.getBuiltinModule` holt das Modul
 * dort am Bundler vorbei (Node ≥ 20.16, hier 22).
 */
export function ladeMarkeSvg(fassung: MarkeFassung): Promise<string> {
  const vorhanden = gelesen.get(fassung)
  if (vorhanden) return vorhanden
  const fs = process.getBuiltinModule('node:fs/promises')
  const pfad = process.getBuiltinModule('node:path')
  const lesen = fs.readFile(pfad.join(process.cwd(), MARKE_SVG[fassung]), 'utf8')
  gelesen.set(fassung, lesen)
  // Ein Fehlschlag bleibt nicht gemerkt — der nächste Aufruf liest neu.
  lesen.catch(() => gelesen.delete(fassung))
  return lesen
}

/** Die Marke als data-URL für Satori (`<img src>`), aus demselben Text. */
export async function ladeMarkeDataUrl(fassung: MarkeFassung): Promise<string> {
  return svgAlsDataUrl(await ladeMarkeSvg(fassung))
}

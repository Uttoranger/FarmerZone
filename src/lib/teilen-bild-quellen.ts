/**
 * Bildquellen und Schriften des Teilen-Bilds (Register T6, Nr. 69): welche
 * Quelle eine Produktzeile bekommt (rein) und der Lader, der daraus fertige
 * Bilddaten für Satori macht (Dateisystem, eigener Blob-Speicher, sharp).
 *
 * Regeln:
 *  - Quelle je Produktzeile: eigenes Foto → Illustration der Kategorie →
 *    „Sonstiges". „Eigen" heißt: aus UNSEREM Blob-Speicher und dem Pfad
 *    dieses Hofs — das entscheidet der Aufrufer mit `istEigenesBild`
 *    (src/server/bild-url.ts, fail-closed), nie eine zweite Prüfung hier.
 *  - Fotos nur mit eigenem Zeitlimit (FOTO_FRIST_MS je Foto und Größe, auch
 *    für das Umwandeln) und Größenlimit (FOTO_MAX_BYTES, FOTO_MAX_PIXEL), ohne
 *    Umleitung. Alle starten zugleich; scheitert eins, steht die Illustration
 *    da, die mit dem Foto zu laden begann: Das Bild wird nie leer und nie mehr
 *    als FOTO_FRIST_MS langsamer als ohne Fotos (Nr. 75).
 *  - Gewandelte Fotos hält ein Zwischenspeicher je Prozess, Schlüssel ist
 *    sha256 der Adresse samt Größe, höchstens FOTO_CACHE_MAX Einträge: Ein
 *    Daten-URI eines Fotos ist bis zu einige hundert KB groß (Nr. 75).
 *  - Satori (next/og) zeichnet nur PNG, JPEG, GIF und SVG; WebP — so liegen
 *    Uploads und Illustrationen — lehnt es ab („Unsupported image type").
 *    Deshalb wandelt sharp jedes Bild in ein JPEG in der Größe, in der es im
 *    Bild steht (klein = schnell gezeichnet).
 *  - Illustrationen und Schriften kommen vom Dateisystem, einmal je Prozess;
 *    beide trägt next.config.ts (outputFileTracingIncludes) in die Route ein.
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import * as Sentry from '@sentry/nextjs'
import { SONSTIGES_BILD_PFAD, illustrationPfad, type ProductCategoryValue } from '@/lib/taxonomie'
import { bildFormat } from '@/lib/foto-wege'
import { BEZEICHNER, befundVon } from '@/lib/upload-diagnose'
import { mitZeitlimit } from '@/lib/upload-zeitwaechter'

/** So lange darf das Laden aller Fotos eines Bilds dauern (Abruf und Umwandeln). */
export const FOTO_FRIST_MS = 1500

/** Größer wird kein Foto abgerufen (1,5 MB) — unsere Uploads liegen weit darunter. */
export const FOTO_MAX_BYTES = 1.5 * 1024 * 1024

/** Bildpunkte, die sharp höchstens dekodiert: Uploads haben bis 2400 px Kante (2400 × 2400 ≈ 5,8 MP), mehr wäre kein Upload von uns. */
const FOTO_MAX_PIXEL = 6_000_000

/** So viele gewandelte Fotos (Daten-URIs je Foto und Größe) hält der Zwischenspeicher eines Prozesses höchstens. */
export const FOTO_CACHE_MAX = 50

/** Kante, in der ein rundes Produktbild geladen wird — im Bild steht es höchstens rund 130 px groß. */
const RUND_KANTE = 192

/** Der Ordner der Schriftdateien, relativ zum Projekt (process.cwd()). */
export const SCHRIFT_ORDNER = 'src/assets/fonts'

/** Die Schriften im Bild — dieselben wie in der App (layout.tsx), als statische TTF (Satori liest kein WOFF2). */
export const TEILEN_BILD_SCHRIFTEN = [
  { name: 'Fraunces', weight: 600, datei: 'fraunces/Fraunces72pt-SemiBold.ttf' },
  { name: 'Instrument Sans', weight: 400, datei: 'instrument-sans/InstrumentSans-Regular.ttf' },
  { name: 'Instrument Sans', weight: 600, datei: 'instrument-sans/InstrumentSans-SemiBold.ttf' },
] as const

export type BildQuelle =
  | { art: 'foto'; url: string; /** Die Illustration, falls das Foto nicht lädt. */ ersatz: string }
  | { art: 'illustration'; pfad: string }

/**
 * Die Quelle einer Produktzeile: eigenes Foto → Illustration der Kategorie →
 * „Sonstiges" (dieselbe Kette wie überall, `illustrationPfad`).
 *
 * Bekannte Einschränkung: Das Teilen-Bild zeigt die Illustration der KATEGORIE,
 * nicht die der Unterkategorie — die Route liest keine Unterkategorie. Die
 * Dateien der Unterkategorien liegen im Paket der Route (next.config.ts trägt
 * public/categories/**), ein Aufrufer könnte sie also übergeben.
 */
export function produktBildQuelle(
  produkt: { imageUrl: string | null; category: ProductCategoryValue | null },
  istEigen: (url: string) => boolean
): BildQuelle {
  const illustration = illustrationPfad(produkt.category)
  if (produkt.imageUrl && istEigen(produkt.imageUrl)) return { art: 'foto', url: produkt.imageUrl, ersatz: illustration }
  return { art: 'illustration', pfad: illustration }
}

/**
 * Die Fotos, die Variante B („Foto-Held") tragen können, in der Reihenfolge,
 * in der sie versucht werden: das Beitragsfoto, sonst die Produktfotos in der
 * Reihenfolge der Zeilen. Leer: Variante A.
 */
export function heldKandidaten(beitragFoto: string | null, quellen: readonly BildQuelle[]): string[] {
  const fotos = quellen.flatMap((q) => (q.art === 'foto' ? [q.url] : []))
  return beitragFoto ? [beitragFoto, ...fotos.filter((url) => url !== beitragFoto)] : fotos
}

export type GeladeneBilder = {
  /** Daten-URI je Eintrag (Kennung); fehlt nur, wenn nicht einmal eine Illustration ladbar war. */
  produkte: Record<string, string>
  /** Das Foto über das ganze Bild (Variante B), sonst null (Variante A). */
  held: string | null
  /** Ein Foto oder eine Illustration kam nicht — das Bild zeigt Ersatz und darf nur kurz im Zwischenspeicher liegen. */
  ersatz: boolean
}

/** Die Ein- und Ausgänge des Laders — im Betrieb Netz, Dateisystem und sharp, im Test Attrappen. */
export type BildWerkzeuge = {
  holen: (url: string, init: RequestInit) => Promise<Response>
  /** Eine Datei unter public/ („/categories/milch.webp"). */
  lesen: (publicPfad: string) => Promise<Uint8Array>
  wandeln: (bytes: Uint8Array, breite: number, hoehe: number) => Promise<string>
  /** Gewandelte Illustrationen — sie ändern sich nur mit einem Deployment. */
  illustrationen: Map<string, Promise<Illustration>>
  /** Gewandelte Fotos: sha256 der Adresse samt Größe → Daten-URI, höchstens FOTO_CACHE_MAX, der älteste Gebrauch fällt zuerst. */
  fotos: Map<string, string>
}

/** Eine gewandelte Illustration; `ersatz`: Die gewünschte fehlte, es steht „Sonstiges" da oder nichts. */
type Illustration = { bild: string | null; ersatz: boolean }

async function alsJpegDatenUri(bytes: Uint8Array, breite: number, hoehe: number): Promise<string> {
  // Dynamisch: Wer nur die reinen Regeln braucht (Tests, Teilen-Fenster), lädt kein natives Modul.
  const { default: sharp } = await import('sharp')
  const jpeg = await sharp(bytes, { limitInputPixels: FOTO_MAX_PIXEL })
    .rotate()
    .resize(breite, hoehe, { fit: 'cover' })
    .jpeg({ quality: 82 })
    .toBuffer()
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}

let standard: BildWerkzeuge | undefined

function standardWerkzeuge(): BildWerkzeuge {
  standard ??= {
    // globalThis.fetch erst beim Aufruf lesen, nicht beim Laden des Moduls.
    holen: (url, init) => fetch(url, init),
    lesen: async (publicPfad) => new Uint8Array(await readFile(path.join(process.cwd(), 'public', publicPfad))),
    wandeln: alsJpegDatenUri,
    illustrationen: new Map(),
    fotos: new Map(),
  }
  return standard
}

/** Liest einen Datenstrom bis höchstens `max` Bytes; ist er länger, wird abgebrochen (null). */
async function leseHoechstens(strom: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array | null> {
  const leser = strom.getReader()
  const teile: Uint8Array[] = []
  let laenge = 0
  for (;;) {
    const { done, value } = await leser.read()
    if (done) break
    laenge += value.byteLength
    if (laenge > max) {
      await leser.cancel()
      return null
    }
    teile.push(value)
  }
  const bytes = new Uint8Array(laenge)
  let stelle = 0
  for (const teil of teile) {
    bytes.set(teil, stelle)
    stelle += teil.byteLength
  }
  return bytes
}

/**
 * Ein Foto aus dem eigenen Speicher holen — oder null. Ein Fehler hier ist
 * kein Fehler des Bilds: Statt des Fotos steht die Illustration da, und der
 * Aufrufer speichert das Bild nur kurz zwischen. Deshalb kein Sentry je
 * Abbruch (Zeitlimit, zu groß, kein Bild).
 */
async function holeFoto(url: string, w: BildWerkzeuge): Promise<Uint8Array | null> {
  try {
    // Keine Umleitung: Sonst holte der Server ein Bild von einem fremden Host.
    const antwort = await w.holen(url, { signal: AbortSignal.timeout(FOTO_FRIST_MS), redirect: 'error', cache: 'no-store' })
    if (!antwort.ok || !antwort.body) {
      // Auch eine Fehlerseite hat einen Strom; ungelesen und nicht abgebrochen hielte er die Verbindung offen.
      await antwort.body?.cancel()
      return null
    }
    if (Number(antwort.headers.get('content-length') ?? 0) > FOTO_MAX_BYTES) {
      await antwort.body.cancel()
      return null
    }
    const bytes = await leseHoechstens(antwort.body, FOTO_MAX_BYTES)
    // Das Format entscheiden die ersten Bytes, nie der Content-Type (CODING_STANDARDS §8).
    const format = bytes ? bildFormat(bytes) : null
    return format === 'jpeg' || format === 'png' || format === 'webp' ? bytes : null
  } catch {
    // Zeitlimit, Netzabbruch oder Umleitung: Ersatz statt Foto (siehe oben).
    return null
  }
}

/**
 * Meldet eine nicht ladbare Illustration: fester Text, die Klasse als Name, die
 * Nachricht bereinigt (CODING_STANDARDS §4). Der Rohfehler trägt den absoluten
 * Pfad der Datei auf dem Server und geht deshalb nie hinaus, auch nicht als
 * `cause`.
 */
function meldeNichtLadbareIllustration(fehler: unknown): void {
  const { klasse, meldung } = befundVon(fehler)
  const ereignis = new Error('Teilen-Bild: Illustration nicht ladbar')
  ereignis.name = BEZEICHNER.test(klasse) ? klasse : 'Unbekannt'
  Sentry.captureException(ereignis, { tags: { bereich: 'teilen-bild', teil: 'illustration' }, extra: { fehlertext: meldung } })
}

function ladeIllustration(publicPfad: string, w: BildWerkzeuge): Promise<Illustration> {
  let geladen = w.illustrationen.get(publicPfad)
  if (!geladen) {
    geladen = w
      .lesen(publicPfad)
      .then((bytes) => w.wandeln(bytes, RUND_KANTE, RUND_KANTE))
      .then(
        (bild): Illustration => ({ bild, ersatz: false }),
        async (fehler: unknown): Promise<Illustration> => {
          // Eine fehlende Illustration ist ein Fehler des Deployments (Datei
          // nicht eingetragen) — einmal je Datei und Prozess melden, dann
          // „Sonstiges", zuletzt ein leerer Kreis. Beides ist Ersatz: Das Bild
          // liegt dann nur kurz im Zwischenspeicher (Nr. 75), auch wenn die
          // Antwort hier aus dem Speicher des Prozesses kommt.
          meldeNichtLadbareIllustration(fehler)
          const sonstiges = publicPfad === SONSTIGES_BILD_PFAD ? null : (await ladeIllustration(SONSTIGES_BILD_PFAD, w)).bild
          return { bild: sonstiges, ersatz: true }
        }
      )
    w.illustrationen.set(publicPfad, geladen)
  }
  return geladen
}

/** Der Schlüssel eines gewandelten Fotos: sha256 der Adresse (feste Länge, keine Adresse im Speicher) und die Größe. */
function fotoSchluessel(url: string, breite: number, hoehe: number): string {
  return `${createHash('sha256').update(url).digest('hex')}@${breite}x${hoehe}`
}

/** Ein Foto aus dem Zwischenspeicher; ein Treffer rückt nach hinten (zuletzt gebraucht). */
function ausDemSpeicher(fotos: Map<string, string>, schluessel: string): string | undefined {
  const bild = fotos.get(schluessel)
  if (bild !== undefined) {
    fotos.delete(schluessel)
    fotos.set(schluessel, bild)
  }
  return bild
}

function inDenSpeicher(fotos: Map<string, string>, schluessel: string, bild: string): void {
  fotos.delete(schluessel)
  // Eine Map zählt in Einfüge-Reihenfolge: Vorn steht, was am längsten nicht gebraucht wurde.
  while (fotos.size >= FOTO_CACHE_MAX) {
    const aeltester = fotos.keys().next()
    if (aeltester.done) break
    fotos.delete(aeltester.value)
  }
  fotos.set(schluessel, bild)
}

/**
 * Alle Bilder eines Teilen-Bilds, alle zugleich und jedes unter eigener Frist
 * (FOTO_FRIST_MS ab jetzt): die runden Produktbilder (Foto oder Illustration)
 * und das Foto für Variante B — das Beitragsfoto, sonst das erste Produktfoto
 * in der Reihenfolge von `heldKandidaten`, das kam. Hängt das Beitragsfoto,
 * trägt das Produktfoto, das inzwischen geladen ist (Nr. 75; vorher bekam es
 * nach der gemeinsamen Frist 0 ms).
 */
export async function ladeTeilenBildBilder(
  eingabe: {
    eintraege: readonly { id: string; quelle: BildQuelle }[]
    beitragFoto: string | null
    held: { width: number; height: number }
  },
  werkzeuge: BildWerkzeuge = standardWerkzeuge()
): Promise<GeladeneBilder> {
  const kandidaten = heldKandidaten(
    eingabe.beitragFoto,
    eingabe.eintraege.map((e) => e.quelle)
  )
  // Jedes Foto höchstens einmal holen — und nur, wenn eine Größe nicht schon im Zwischenspeicher liegt.
  const holungen = new Map<string, Promise<Uint8Array | null>>()
  const hole = (url: string): Promise<Uint8Array | null> => {
    let holung = holungen.get(url)
    if (!holung) {
      holung = holeFoto(url, werkzeuge)
      holungen.set(url, holung)
    }
    return holung
  }
  const gewandelt = (url: string, breite: number, hoehe: number): Promise<string | null> => {
    const schluessel = fotoSchluessel(url, breite, hoehe)
    const bekannt = ausDemSpeicher(werkzeuge.fotos, schluessel)
    if (bekannt !== undefined) return Promise.resolve(bekannt)
    const arbeit = hole(url).then((bytes) => (bytes ? werkzeuge.wandeln(bytes, breite, hoehe) : null))
    return mitZeitlimit(arbeit, FOTO_FRIST_MS, () => new Error('Teilen-Bild: Foto zu langsam')).then(
      (bild) => {
        if (bild) inDenSpeicher(werkzeuge.fotos, schluessel, bild)
        return bild
      },
      () => null
    )
  }

  let ersatz = false
  const zeilen = Promise.all(
    eingabe.eintraege.map(async ({ id, quelle }) => {
      if (quelle.art === 'illustration') {
        const illustration = await ladeIllustration(quelle.pfad, werkzeuge)
        if (illustration.ersatz) ersatz = true
        return [id, illustration.bild] as const
      }
      // Die Illustration lädt mit dem Foto, nicht erst nach seiner Frist: Kommt es nicht, steht sie sofort bereit.
      const reserve = ladeIllustration(quelle.ersatz, werkzeuge)
      const foto = await gewandelt(quelle.url, RUND_KANTE, RUND_KANTE)
      if (foto) return [id, foto] as const
      ersatz = true
      return [id, (await reserve).bild] as const
    })
  )
  const versuche = kandidaten.map((url) => gewandelt(url, eingabe.held.width, eingabe.held.height))
  const held = (async (): Promise<string | null> => {
    for (const versuch of versuche) {
      const bild = await versuch
      if (bild) return bild
      ersatz = true
    }
    return null
  })()

  const [paare, heldBild] = await Promise.all([zeilen, held])
  const produkte: Record<string, string> = {}
  for (const [id, bild] of paare) if (bild) produkte[id] = bild
  return { produkte, held: heldBild, ersatz }
}

export type TeilenBildSchrift = { name: string; data: Buffer; weight: 400 | 600; style: 'normal' }

let schriften: Promise<TeilenBildSchrift[]> | undefined

/** Die Schriften für `ImageResponse` — einmal je Prozess gelesen; scheitert es, versucht der nächste Aufruf es neu. */
export function ladeTeilenBildSchriften(): Promise<TeilenBildSchrift[]> {
  if (!schriften) {
    const laden = Promise.all(
      TEILEN_BILD_SCHRIFTEN.map(async (s) => ({
        name: s.name,
        weight: s.weight,
        style: 'normal' as const,
        data: await readFile(path.join(process.cwd(), SCHRIFT_ORDNER, s.datei)),
      }))
    )
    schriften = laden
    laden.catch(() => {
      schriften = undefined
    })
  }
  return schriften
}

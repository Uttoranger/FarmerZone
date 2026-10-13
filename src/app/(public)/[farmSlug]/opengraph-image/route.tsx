import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { hofSlugSchema } from '@/schemas/hof-adresse'
import { teilenBildSucheSchema } from '@/schemas/teilen'
import { beitragDarfInsBild, teilenBildAuswahl, teilenBildDaten, teilenBildVersion, TEILEN_BILD_MASSE, TEILEN_BILD_TYP } from '@/lib/teilen-bild'
import { heldKandidaten, ladeTeilenBildBilder, ladeTeilenBildSchriften, produktBildQuelle } from '@/lib/teilen-bild-quellen'
import { teilenLink } from '@/lib/teilen-kanal'
import { qrPfad } from '@/lib/qr-code'
import { hofAdresse } from '@/lib/mein-hof'
import { mitZeitlimit } from '@/lib/upload-zeitwaechter'
import { enforceRateLimit } from '@/lib/rate-limit'
import { APP_URL } from '@/lib/umgebung-server'
import { istEigenesBild } from '@/server/bild-url'
import { ladeTeilenBild } from '@/server/queries/teilen-bild'
import { TeilenBildGrafik } from '@/components/teilen/teilen-bild-grafik'

export const runtime = 'nodejs'
// Ein Bild ist nach wenigen Sekunden fertig oder gar nicht (S9: Zeitlimit) —
// höchstens LADE_FRIST_MS für die Datenbank plus FOTO_FRIST_MS für Fotos.
export const maxDuration = 10

/** So lange darf die Datenbank für ein Bild brauchen. */
const LADE_FRIST_MS = 4000

const NICHT_GEFUNDEN = { status: 404, headers: { 'Cache-Control': 'no-store' } }

/*
 * Das Teilen-Bild eines Hofs (Gate 7 Aufgabe 1; S9; Register T6):
 * `/[farmSlug]/opengraph-image`, Formate 1:1 (`?format=quadrat`, auch die
 * Open-Graph-Vorschau der Hofseite) und 9:16 (`?format=story`), Auswahl der
 * Produkte mit `?p=`, Beitrag-Modus mit `?b=<Kennung des Beitrags>`.
 *
 * Bewusst eine Route in einem Ordner gleichen Namens und KEINE Datei
 * `opengraph-image.tsx`: Nach Nexts Dateikonvention gälte die für alle Seiten
 * darunter (Produktseite, Kasse, Bestätigung) und überschriebe deren
 * Metadaten (ARCHITECTURE „Vorschaubild und Icons"). Die Hofseite setzt das
 * Bild selbst über `hofVorschaubild`.
 *
 * Nur öffentliche Höfe (sonst 404), nur öffentliche Daten, nie ausverkaufte
 * oder gesperrte Produkte (src/lib/teilen-bild.ts), Fotos nur aus dem
 * eigenen Speicher (src/lib/teilen-bild-quellen.ts). Zwischenspeicher: Die
 * Metadaten hängen `?v=<Prüfsumme des Inhalts>` an — ändert sich etwas,
 * ändert sich die Adresse; ohne `v` (Vorschau im Teilen-Fenster) nur kurz.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ farmSlug: string }> }
): Promise<Response> {
  // Jede neue Adresse (p, b, v) geht am Zwischenspeicher vorbei und kostet
  // Abfragen plus ein Rendering — dieselbe Bremse wie jede öffentliche Route.
  const limited = enforceRateLimit('teilen-bild', request)
  if (limited) return limited

  const { farmSlug } = await params
  const slug = hofSlugSchema.safeParse(farmSlug)
  // Auch ein ungültiger Slug ohne Zwischenspeicher (Nr. 75): Sonst hielte das CDN die 404 fest.
  if (!slug.success) return new Response('Nicht gefunden', NICHT_GEFUNDEN)

  const parameter = request.nextUrl.searchParams
  const suche = teilenBildSucheSchema.safeParse({
    format: parameter.get('format') ?? undefined,
    p: parameter.get('p') ?? undefined,
    b: parameter.get('b') ?? undefined,
  })
  // Scheitern kann nur `b` (format und p fallen still weg): Ein Beitragsbild
  // für eine Kennung, die keine sein kann, gibt es nicht.
  if (!suche.success) return new Response('Nicht gefunden', NICHT_GEFUNDEN)
  const { format, p, b } = suche.data

  // Alles aus der Datenbank unter EINER Frist; die Abfragen stehen im Lader, nicht hier (Nr. 75).
  let geladen: Awaited<ReturnType<typeof ladeTeilenBild>>
  try {
    geladen = await mitZeitlimit(ladeTeilenBild(slug.data, b), LADE_FRIST_MS, () => new Error('Teilen-Bild: Datenbank zu langsam'))
  } catch (fehler) {
    Sentry.captureException(fehler, { tags: { bereich: 'teilen-bild' } })
    return new Response('Das Bild ist gerade nicht verfügbar.', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  if (!geladen) return new Response('Nicht gefunden', NICHT_GEFUNDEN)
  const { quelle } = geladen

  const jetzt = new Date()
  // Beitrag-Modus nur mit einem Beitrag, der ins Bild darf (veröffentlicht,
  // auf der Hofseite, nicht abgelaufen, DIESER Hof) — sonst 404, nie das
  // Bild ohne Beitrag unter seiner Adresse.
  const beitrag = geladen.beitrag && beitragDarfInsBild(geladen.beitrag, quelle.farmId, jetzt) ? geladen.beitrag : null
  if (b && !beitrag) return new Response('Nicht gefunden', NICHT_GEFUNDEN)

  const daten = teilenBildDaten({
    hof: quelle.hof,
    produkte: quelle.produkte,
    slots: quelle.slots,
    // p zuerst (Nr. 67, Runde 1): Das Teilen-Fenster zeigt die Auswahl „Im Bild"
    // und belegt sie im Beitrag-Modus mit den verknüpften Produkten vor — das
    // geteilte Bild folgt dem, was der Hof dort sieht. Ohne p (eine geteilte
    // Bildadresse) die verknüpften Produkte, ohne beides der Standard.
    auswahl: teilenBildAuswahl(quelle.produkte, quelle.hof, [p, beitrag?.linkedProductIds]),
    adresse: hofAdresse(APP_URL, quelle.hof.slug).anzeige,
    jetzt,
    beitrag,
  })
  const istEigen = (url: string): boolean => istEigenesBild(url, quelle.farmId)
  const kategorien = new Map(quelle.produkte.map((produkt) => [produkt.id, produkt.category]))
  const eintraege = daten.produkte.map((e) => ({
    id: e.id,
    quelle: produktBildQuelle({ imageUrl: quelle.fotos.get(e.id) ?? null, category: kategorien.get(e.id) ?? null }, istEigen),
  }))
  const beitragFoto = beitrag?.photoUrl && istEigen(beitrag.photoUrl) ? beitrag.photoUrl : null
  // Lang zwischenspeichern nur, wenn `v` die Prüfsumme GENAU dieses Inhalts
  // ist (S9), samt der Fotos — ein erfundenes `v` bekäme sonst einen Tag lang
  // einen eigenen Eintrag im CDN.
  const versioniert = parameter.get('v') === teilenBildVersion(daten, heldKandidaten(beitragFoto, eintraege.map((e) => e.quelle)))

  try {
    const masse = TEILEN_BILD_MASSE[format]
    const [schriften, bilder] = await Promise.all([ladeTeilenBildSchriften(), ladeTeilenBildBilder({ eintraege, beitragFoto, held: masse })])
    const qr = qrPfad(teilenLink(APP_URL, quelle.hof.slug, 'qr'))
    // Satori und resvg zeichnen erst beim Lesen des Bodys (der Konstruktor von
    // ImageResponse baut nur einen Stream). Deshalb hier ganz lesen: Scheitert
    // das Zeichnen, landet der Fehler in diesem catch — sonst ginge eine 200
    // mit kaputtem Body und langem Cache-Header hinaus.
    const bild = new ImageResponse(<TeilenBildGrafik daten={daten} format={format} qr={qr} bilder={bilder} />, { ...masse, fonts: schriften })
    const inhalt = await bild.arrayBuffer()
    // Ausgeliefert wird ein JPEG (Register T7): Ein PNG mit Foto wiegt 1,2–1,4 MB,
    // und WhatsApp zeigt Link-Vorschauen über rund 300 KB oft nicht. Im selben
    // try — scheitert die Umwandlung, nimmt sie denselben 503-Pfad wie das
    // Zeichnen. sharp dynamisch, wie in teilen-bild-quellen.ts (natives Modul).
    const { default: sharp } = await import('sharp')
    const jpeg = await sharp(Buffer.from(inhalt)).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    return new Response(jpeg, {
      headers: {
        'Content-Type': TEILEN_BILD_TYP.mime,
        // Zeigt das Bild Ersatz für ein Foto, das nicht kam, nur kurz — beim
        // nächsten Abruf kommt das Foto vielleicht.
        'Cache-Control':
          versioniert && !bilder.ersatz
            ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
            : 'public, max-age=60, s-maxage=60',
      },
    })
  } catch (fehler) {
    // Nur Kennungen des Hofs nach Sentry, keine Inhalte (sentry-hygiene bereinigt zusätzlich).
    Sentry.captureException(fehler, { tags: { bereich: 'teilen-bild', farmId: quelle.farmId, slug: quelle.hof.slug } })
    return new Response('Das Bild ist gerade nicht verfügbar.', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { hofSlugSchema } from '@/schemas/hof-adresse'
import { teilenBildSucheSchema } from '@/schemas/teilen'
import { teilenBildDaten, TEILEN_BILD_MASSE } from '@/lib/teilen-bild'
import { teilenLink } from '@/lib/teilen-kanal'
import { qrPfad } from '@/lib/qr-code'
import { hofAdresse } from '@/lib/mein-hof'
import { mitZeitlimit } from '@/lib/upload-zeitwaechter'
import { APP_URL } from '@/lib/umgebung-server'
import { ladeTeilenBildQuelle } from '@/server/queries/teilen-bild'
import { TeilenBildGrafik } from '@/components/teilen/teilen-bild-grafik'

export const runtime = 'nodejs'
// Ein Bild ist nach wenigen Sekunden fertig oder gar nicht (S9: Zeitlimit).
export const maxDuration = 10

/** So lange darf die Datenbank für ein Bild brauchen. */
const LADE_FRIST_MS = 4000

/*
 * Das Teilen-Bild eines Hofs (Gate 7 Aufgabe 1; S9): `/[farmSlug]/opengraph-image`,
 * Formate 1:1 (`?format=quadrat`, auch die Open-Graph-Vorschau der Hofseite)
 * und 9:16 (`?format=story`), Auswahl der Produkte mit `?p=`.
 *
 * Bewusst eine Route in einem Ordner gleichen Namens und KEINE Datei
 * `opengraph-image.tsx`: Nach Nexts Dateikonvention gälte die für alle Seiten
 * darunter (Produktseite, Kasse, Bestätigung) und überschriebe deren
 * Metadaten (ARCHITECTURE „Vorschaubild und Icons"). Die Hofseite setzt das
 * Bild selbst über `hofVorschaubild`.
 *
 * Nur öffentliche Höfe (sonst 404), nur öffentliche Daten, nie ausverkaufte
 * oder gesperrte Produkte (src/lib/teilen-bild.ts). Zwischenspeicher: Die
 * Metadaten hängen `?v=<Prüfsumme des Inhalts>` an — ändert sich etwas,
 * ändert sich die Adresse; ohne `v` (Vorschau im Teilen-Fenster) nur kurz.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ farmSlug: string }> }
): Promise<Response> {
  const { farmSlug } = await params
  const slug = hofSlugSchema.safeParse(farmSlug)
  if (!slug.success) return new Response('Nicht gefunden', { status: 404 })

  const suche = teilenBildSucheSchema.parse({
    format: request.nextUrl.searchParams.get('format') ?? undefined,
    p: request.nextUrl.searchParams.get('p') ?? undefined,
  })

  let quelle: Awaited<ReturnType<typeof ladeTeilenBildQuelle>>
  try {
    quelle = await mitZeitlimit(ladeTeilenBildQuelle({ slug: slug.data }), LADE_FRIST_MS, () => new Error('Teilen-Bild: Datenbank zu langsam'))
  } catch (fehler) {
    Sentry.captureException(fehler, { tags: { bereich: 'teilen-bild' } })
    return new Response('Das Bild ist gerade nicht verfügbar.', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  if (!quelle) return new Response('Nicht gefunden', { status: 404, headers: { 'Cache-Control': 'no-store' } })

  const daten = teilenBildDaten({
    hof: quelle.hof,
    produkte: quelle.produkte,
    slots: quelle.slots,
    auswahl: suche.p ?? null,
    adresse: hofAdresse(APP_URL, quelle.hof.slug).anzeige,
    jetzt: new Date(),
  })
  const qr = qrPfad(teilenLink(APP_URL, quelle.hof.slug, 'qr'))
  const versioniert = request.nextUrl.searchParams.has('v')

  return new ImageResponse(<TeilenBildGrafik daten={daten} format={suche.format} qr={qr} />, {
    ...TEILEN_BILD_MASSE[suche.format],
    headers: {
      'Cache-Control': versioniert
        ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
        : 'public, max-age=60, s-maxage=60',
    },
  })
}

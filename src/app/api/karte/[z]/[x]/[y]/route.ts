/**
 * Kartenkacheln über die eigene Domain.
 *
 * Warum nicht direkt tile.openstreetmap.org im Browser: Dann ginge die
 * IP-Adresse jedes Besuchers samt Referer an einen Dritten — dieselbe Lehre
 * wie beim Foto-Upload, wo kein Byte über fremde Client-Wege läuft. Diese
 * Route holt die Kachel serverseitig und liefert sie aus; beim Kartendienst
 * kommt nur unsere Server-Anfrage an, mit aussagekräftigem User-Agent, wie
 * die OSM-Kachel-Richtlinie es verlangt. Der lange Cache (7 Tage im Browser,
 * 30 Tage am CDN) hält unser Aufkommen dort klein — auch das eine Auflage
 * der Richtlinie. Die OSM-Attribution zeigt die Karte selbst
 * (standort-karte.tsx).
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const KACHEL_TIMEOUT_MS = 10_000
const MAX_ZOOM = 19

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z, x, y } = await params

  // Strenge Prüfung: alles Ganzzahlen, z begrenzt, x/y im Gitter der
  // Zoomstufe. Alles andere ist kein Kachel-Wunsch, sondern Gestocher.
  if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
    return NextResponse.json({ error: 'Ungültige Kachel' }, { status: 400 })
  }
  const zoom = Number(z)
  const spalte = Number(x)
  const zeile = Number(y)
  const gitter = 2 ** zoom
  if (zoom > MAX_ZOOM || spalte >= gitter || zeile >= gitter) {
    return NextResponse.json({ error: 'Ungültige Kachel' }, { status: 400 })
  }

  try {
    const antwort = await fetch(`https://tile.openstreetmap.org/${zoom}/${spalte}/${zeile}.png`, {
      headers: {
        'User-Agent': 'FarmerZone/1.0 (https://farmerzone.at; kontakt@farmerzone.at)',
      },
      signal: AbortSignal.timeout(KACHEL_TIMEOUT_MS),
    })
    if (!antwort.ok) {
      return NextResponse.json({ error: 'Kachel nicht verfügbar' }, { status: 502 })
    }

    return new NextResponse(antwort.body, {
      headers: {
        'content-type': 'image/png',
        // Kacheln ändern sich praktisch nie: 7 Tage Browser, 30 Tage CDN —
        // mindestens die 7 Tage verlangt schon der eigene Anstand gegenüber
        // dem frei betriebenen Kachel-Dienst.
        'cache-control': 'public, max-age=604800, s-maxage=2592000',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Kachel nicht verfügbar' }, { status: 502 })
  }
}

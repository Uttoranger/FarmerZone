import { put, del } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import sharp from 'sharp'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  MAX_LONG_SIDE,
  WEBP_QUALITAET,
  darfGeloeschtWerden,
  darfVerarbeitetWerden,
  istUploadZweck,
  zielPfad,
} from '@/lib/upload-pfade'

/**
 * Verkleinert ein hochgeladenes Original und legt das Ergebnis ab.
 *
 * Hier passiert, was bis zu diesem Umbau der Browser tun musste: drehen,
 * verkleinern, als WebP kodieren. Der Unterschied ist nicht die Rechnung,
 * sondern der Ort — auf dem Server gibt es keinen Fingerprint-Schutz, keine
 * Canvas-Sperre und keine Geräte-Eigenheit, die dazwischenfunkt.
 */

// sharp ist ein nativer Baustein und läuft nicht im Edge-Runtime.
export const runtime = 'nodejs'

// Ein 25-MB-Original zu holen, zu drehen, zu verkleinern und zurückzuschreiben
// dauert länger als die Voreinstellung von 10 Sekunden hergibt.
export const maxDuration = 60

/**
 * EXIF-Drehung MUSS zuerst passieren.
 *
 * Ein Handyfoto im Hochformat liegt in der Datei quer und trägt die Drehung nur
 * als Notiz. Wer ohne `rotate()` verkleinert, rechnet mit den falschen Kanten:
 * Aus einem Hochformat wird ein Querformat, und die längste Seite ist die
 * falsche. Der Browser hat das früher stillschweigend mitgemacht, weil er beim
 * Zeichnen ohnehin dreht — der Server tut das nicht von selbst.
 */
async function verkleinern(bytes: ArrayBuffer, maxLangeSeite: number): Promise<Buffer> {
  return sharp(Buffer.from(bytes))
    .rotate()
    .resize({
      width: maxLangeSeite,
      height: maxLangeSeite,
      fit: 'inside',
      // Kleine Fotos bleiben klein — nicht hochrechnen, was nicht da ist.
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITAET })
    .toBuffer()
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht angemeldet', art: 'server' }, { status: 401 })
  }

  const rolle = (session.user as typeof session.user & { role?: string }).role
  if (rolle !== 'FARMER') {
    return NextResponse.json({ error: 'Kein Zugriff', art: 'server' }, { status: 403 })
  }

  const farm = await prisma.farm.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  })
  if (!farm) {
    return NextResponse.json({ error: 'Kein Hof gefunden', art: 'server' }, { status: 403 })
  }

  let daten: { url?: unknown; zweck?: unknown; altUrl?: unknown }
  try {
    daten = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage', art: 'server' }, { status: 400 })
  }

  const url = typeof daten.url === 'string' ? daten.url : ''
  const altUrl = typeof daten.altUrl === 'string' ? daten.altUrl : ''
  if (!istUploadZweck(daten.zweck)) {
    return NextResponse.json({ error: 'Unbekannter Zweck', art: 'server' }, { status: 400 })
  }
  const zweck = daten.zweck

  // Der Guard steht VOR dem ersten Netzzugriff: Was hier durchfällt, wird nicht
  // einmal geladen. Sonst wäre diese Route ein Werkzeug, mit dem sich beliebige
  // fremde Adressen von unserem Server abrufen ließen.
  if (!darfVerarbeitetWerden(url, farm.id)) {
    return NextResponse.json({ error: 'URL nicht erlaubt', art: 'server' }, { status: 403 })
  }

  try {
    const antwort = await fetch(url)
    if (!antwort.ok) {
      return NextResponse.json({ error: 'Original nicht lesbar', art: 'server' }, { status: 502 })
    }
    const bytes = await antwort.arrayBuffer()

    let fertig: Buffer
    try {
      fertig = await verkleinern(bytes, MAX_LONG_SIDE[zweck])
    } catch {
      // sharp hat die Bytes in der Hand gehabt und sie nicht als Bild lesen
      // können. DAS ist der Formatfehler — bewiesen, nicht geraten. Ein echtes
      // HEIF-Foto landet hier, weil sharp auf Vercel kein HEIF kann.
      return NextResponse.json({ error: 'Format nicht lesbar', art: 'format' }, { status: 415 })
    }

    const blob = await put(zielPfad(farm.id, zweck), fertig, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'image/webp',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    // Das ersetzte Bild aufräumen — wie bisher nur der beste Versuch, und erst
    // NACH dem erfolgreichen Ablegen des neuen. Der Guard ist strenger als in
    // der alten Route: Die prüfte nur den Host, hier muss die Adresse auch im
    // Zielordner dieses Hofes liegen.
    if (altUrl && darfGeloeschtWerden(altUrl, farm.id)) {
      try {
        await del(altUrl, { token: process.env.BLOB_READ_WRITE_TOKEN })
      } catch {
        // bewusst still
      }
    }

    return NextResponse.json({ url: blob.url })
  } catch {
    return NextResponse.json({ error: 'Verarbeitung fehlgeschlagen', art: 'server' }, { status: 500 })
  } finally {
    // Das Original hat seinen Zweck erfüllt — in jedem Ausgang, auch im
    // Fehlerfall. Nur der beste Versuch: Bleibt es liegen, ist das eine Waise
    // im Speicher, kein kaputter Zustand für den Bauern.
    try {
      await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN })
    } catch {
      // bewusst still — siehe oben
    }
  }
}

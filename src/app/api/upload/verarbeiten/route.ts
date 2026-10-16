import { put, del } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import sharp from 'sharp'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  MAX_LONG_SIDE,
  STARTSEITE_MIN_KANTE,
  WEBP_QUALITAET,
  darfStartseitenBildVerarbeitetWerden,
  darfVerarbeitetWerden,
  istUploadZweck,
  startseitenZielPfad,
  zielPfad,
} from '@/lib/upload-pfade'
import { UPLOAD_GESPERRT_TEXT } from '@/lib/email-bestaetigung'
import { emailBestaetigungOffen } from '@/server/email-bestaetigung'
import { isAdminUser } from '@/server/queries/admin'

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

/** Das Bild noch einmal holen und als WebP ablegen; das Original fällt in jedem Ausgang weg. */
async function verarbeiteUndLege(
  url: string,
  bearbeite: (bytes: ArrayBuffer) => Promise<Buffer | 'zu-klein'>,
  ziel: string,
  aufraeumen: () => Promise<void>
): Promise<NextResponse> {
  try {
    const antwort = await fetch(url)
    if (!antwort.ok) {
      return NextResponse.json({ error: 'Original nicht lesbar', art: 'server' }, { status: 502 })
    }
    let fertig: Buffer | 'zu-klein'
    try {
      fertig = await bearbeite(await antwort.arrayBuffer())
    } catch {
      return NextResponse.json({ error: 'Format nicht lesbar', art: 'format' }, { status: 415 })
    }
    if (fertig === 'zu-klein') {
      return NextResponse.json({ error: 'Bild zu klein', code: 'BILD_ZU_KLEIN', art: 'format' }, { status: 422 })
    }
    const blob = await put(ziel, fertig, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'image/webp',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return NextResponse.json({ url: blob.url })
  } catch {
    return NextResponse.json({ error: 'Verarbeitung fehlgeschlagen', art: 'server' }, { status: 500 })
  } finally {
    await aufraeumen()
  }
}

/**
 * Ein Bild für einen Block der Startseite (Register N16, Nr. 96): nur mit
 * Admin-Sitzung (frisch aus der Datenbank), nur aus dem Ordner der Startseite,
 * quadratisch (1:1) mit der langen Kante höchstens 1600 px — und nicht unter
 * STARTSEITE_MIN_KANTE, sonst wird es auf großen Schirmen unscharf. Ein altes
 * Bild löscht diese Route NICHT: Es kann noch an einem gespeicherten Block
 * hängen, solange das Formular nicht gespeichert ist.
 */
async function verarbeiteStartseitenBild(userId: string, url: string): Promise<NextResponse> {
  if (!(await isAdminUser(userId))) {
    return NextResponse.json({ error: 'Kein Zugriff', art: 'server' }, { status: 403 })
  }
  if (!darfStartseitenBildVerarbeitetWerden(url)) {
    return NextResponse.json({ error: 'URL nicht erlaubt', art: 'server' }, { status: 403 })
  }
  return verarbeiteUndLege(
    url,
    async (bytes) => {
      const bild = sharp(Buffer.from(bytes))
      const { width, height } = await bild.metadata()
      // Die kürzere Kante ändert sich durch die EXIF-Drehung nicht.
      const kante = Math.min(width ?? 0, height ?? 0)
      if (kante < STARTSEITE_MIN_KANTE) return 'zu-klein'
      const seite = Math.min(kante, MAX_LONG_SIDE.startseite)
      return bild.rotate().resize({ width: seite, height: seite, fit: 'cover' }).webp({ quality: WEBP_QUALITAET }).toBuffer()
    },
    startseitenZielPfad(),
    async () => {
      try {
        await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN })
      } catch {
        // bewusst still — eine Waise im Speicher, kein kaputter Zustand
      }
    }
  )
}

/** Der Körper, einmal gelesen — null, wenn er kein JSON ist (die Antwort darauf bleibt, wo sie war). */
async function leseDaten(request: NextRequest): Promise<{ url?: unknown; zweck?: unknown } | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht angemeldet', art: 'server' }, { status: 401 })
  }

  const gelesen = await leseDaten(request)
  // Zweck 'startseite' prüft die Admin-Sitzung statt der Hof-Sitzung — alle
  // anderen Zwecke laufen unverändert weiter unten.
  if (gelesen?.zweck === 'startseite') {
    return verarbeiteStartseitenBild(session.user.id, typeof gelesen.url === 'string' ? gelesen.url : '')
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

  // S3 (Nr. 17b): Ohne bestätigte E-Mail gibt es schon keinen Upload-Token
  // (api/upload/token) — die Sperre hier fängt Originale ab, die auf anderem
  // Weg im Ordner lägen. Frisch aus der Datenbank, nie aus der Sitzung.
  if (await emailBestaetigungOffen(session.user.id)) {
    return NextResponse.json({ error: UPLOAD_GESPERRT_TEXT, code: 'EMAIL_UNBESTAETIGT', art: 'server' }, { status: 403 })
  }

  if (gelesen === null) {
    return NextResponse.json({ error: 'Ungültige Anfrage', art: 'server' }, { status: 400 })
  }
  const daten = gelesen

  const url = typeof daten.url === 'string' ? daten.url : ''
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

    // Das ersetzte Bild löscht diese Route NICHT mehr (Register N17, Ergänzung;
    // Nr. 108): Zu diesem Zeitpunkt ist Produkt bzw. Hof noch nicht gespeichert.
    // Scheitert das Speichern danach, zeigte es sonst ein gelöschtes Bild. Ein
    // mitgeschicktes `altUrl` wird nicht einmal gelesen; das alte Bild bleibt als
    // „Bild ohne Verwendung“ liegen und wird erst nach Durchsicht entfernt (N18).
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

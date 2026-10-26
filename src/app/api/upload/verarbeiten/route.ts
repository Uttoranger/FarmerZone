import { put, del } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import sharp, { type Sharp } from 'sharp'
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
import { BILD_PIXEL_GRENZE, formatFuerSharp, istPixelGrenzeFehler, sperreFremdeLader } from '@/lib/bild-format'
import { UPLOAD_GESPERRT_TEXT } from '@/lib/email-bestaetigung'
import { emailBestaetigungOffen } from '@/server/email-bestaetigung'
import { verlangeAdminAktion } from '@/server/admin-wache'

/**
 * Verkleinert ein hochgeladenes Original und legt das Ergebnis ab.
 *
 * Hier passiert, was bis zu diesem Umbau der Browser tun musste: drehen,
 * verkleinern, als WebP kodieren. Der Unterschied ist nicht die Rechnung,
 * sondern der Ort — auf dem Server gibt es keinen Fingerprint-Schutz, keine
 * Canvas-Sperre und keine Geräte-Eigenheit, die dazwischenfunkt.
 */

// Dritte Schicht gegen fremde Formate (Sicherheitsupdate 20.10.2026, hinter
// Token-Liste und formatFuerSharp): Alle Lader von libvips sind gesperrt, nur
// JPEG, PNG, WebP und HEIF frei. Rutscht trotz der Byte-Prüfung unten einmal
// ein SVG, GIF oder TIFF durch, lehnt libvips es ab, statt es zu lesen. Gilt
// für den ganzen Prozess — diese Route liest nur Fotos dieser vier Formate.
// Teilt sie sich einen Prozess mit anderen Nutzern von sharp (etwa in
// pnpm dev), trifft es dort nichts Gebrauchtes: Das Teilen-Bild gibt sharp nur
// eigene Fotos (JPEG, PNG oder WebP nach bildFormat), die WebP-Illustrationen
// und das PNG von ImageResponse; die Bildoptimierung von Next.js
// (/_next/image) bekommt bei uns JPEG, PNG und WebP, SVG optimiert sie nicht.
sperreFremdeLader(sharp)

// sharp ist ein nativer Baustein und läuft nicht im Edge-Runtime.
export const runtime = 'nodejs'

// Ein 25-MB-Original zu holen, zu drehen, zu verkleinern und zurückzuschreiben
// dauert länger als die Voreinstellung von 10 Sekunden hergibt.
export const maxDuration = 60

/** Warum ein Original nicht verarbeitet wird — jede Art hat ihre eigene Antwort (ablehnung). */
type Ablehnung = 'fremdes-format' | 'zu-gross' | 'zu-klein'

function ablehnung(art: Ablehnung): NextResponse {
  if (art === 'zu-klein') {
    return NextResponse.json({ error: 'Bild zu klein', code: 'BILD_ZU_KLEIN', art: 'format' }, { status: 422 })
  }
  if (art === 'zu-gross') {
    return NextResponse.json({ error: 'Bild zu groß', code: 'BILD_ZU_GROSS', art: 'format' }, { status: 422 })
  }
  return NextResponse.json({ error: 'Format nicht lesbar', art: 'format' }, { status: 415 })
}

/**
 * Was ein Fehler von sharp bedeutet: Mehr Pixel als die Grenze meldet sharp
 * schon beim Lesen des Kopfs — das Foto ist zu groß, nicht unlesbar. Jeder
 * andere Fehler heißt, sharp hat die Bytes nicht als Bild lesen können.
 */
function ablehnungFuer(fehler: unknown): NextResponse {
  return ablehnung(istPixelGrenzeFehler(fehler) ? 'zu-gross' : 'fremdes-format')
}

/**
 * sharp nur für ein Original, das formatFuerSharp als JPEG, PNG, WebP oder
 * HEIF erkennt — sonst null, und sharp sieht die Bytes nie (Sicherheitsupdate
 * 20.10.2026). Das ist die Prüfung vor JEDEM sharp() dieser Route
 * (tests/sharp-wache.test.ts): Schon metadata() läse den Kopf mit dem Lader
 * von libvips, bei SVG mit librsvg.
 * `limitInputPixels` begrenzt Speicher und Rechenzeit; ein zu großes Foto
 * wirft beim ersten Lesen (ablehnungFuer).
 */
function ladeErlaubtesBild(bytes: ArrayBuffer): Sharp | null {
  if (formatFuerSharp(bytes) === null) return null
  return sharp(Buffer.from(bytes), { limitInputPixels: BILD_PIXEL_GRENZE })
}

/**
 * EXIF-Drehung MUSS zuerst passieren.
 *
 * Ein Handyfoto im Hochformat liegt in der Datei quer und trägt die Drehung nur
 * als Notiz. Wer ohne `rotate()` verkleinert, rechnet mit den falschen Kanten:
 * Aus einem Hochformat wird ein Querformat, und die längste Seite ist die
 * falsche. Der Browser hat das früher stillschweigend mitgemacht, weil er beim
 * Zeichnen ohnehin dreht — der Server tut das nicht von selbst.
 */
async function verkleinern(bytes: ArrayBuffer, maxLangeSeite: number): Promise<Buffer | Ablehnung> {
  const bild = ladeErlaubtesBild(bytes)
  if (!bild) return 'fremdes-format'
  return bild
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
  bearbeite: (bytes: ArrayBuffer) => Promise<Buffer | Ablehnung>,
  ziel: string,
  aufraeumen: () => Promise<void>
): Promise<NextResponse> {
  try {
    const antwort = await fetch(url)
    if (!antwort.ok) {
      return NextResponse.json({ error: 'Original nicht lesbar', art: 'server' }, { status: 502 })
    }
    let fertig: Buffer | Ablehnung
    try {
      fertig = await bearbeite(await antwort.arrayBuffer())
    } catch (fehler) {
      return ablehnungFuer(fehler)
    }
    if (typeof fertig === 'string') return ablehnung(fertig)
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
 * Admin-Sitzung über die Admin-Wache (Nr. 188, Audit A2/B1: Recht frisch aus
 * der Datenbank, 12 Stunden, Passkey der Sitzung, Recht „Startseite
 * veröffentlichen“), nur aus dem Ordner der Startseite,
 * quadratisch (1:1) mit der langen Kante höchstens 1600 px — und nicht unter
 * STARTSEITE_MIN_KANTE, sonst wird es auf großen Schirmen unscharf. Ein altes
 * Bild löscht diese Route NICHT: Es kann noch an einem gespeicherten Block
 * hängen, solange das Formular nicht gespeichert ist.
 */
async function verarbeiteStartseitenBild(url: string): Promise<NextResponse> {
  if (!('ok' in (await verlangeAdminAktion({ recht: 'startseite_veroeffentlichen' })))) {
    return NextResponse.json({ error: 'Kein Zugriff', art: 'server' }, { status: 403 })
  }
  if (!darfStartseitenBildVerarbeitetWerden(url)) {
    return NextResponse.json({ error: 'URL nicht erlaubt', art: 'server' }, { status: 403 })
  }
  return verarbeiteUndLege(
    url,
    async (bytes) => {
      const bild = ladeErlaubtesBild(bytes)
      if (!bild) return 'fremdes-format'
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
    return verarbeiteStartseitenBild(typeof gelesen.url === 'string' ? gelesen.url : '')
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

    let fertig: Buffer | Ablehnung
    try {
      fertig = await verkleinern(bytes, MAX_LONG_SIDE[zweck])
    } catch (fehler) {
      // sharp hat die Bytes in der Hand gehabt und sie nicht als Bild lesen
      // können. DAS ist der Formatfehler — bewiesen, nicht geraten. Ein echtes
      // HEIC-Foto landet hier, weil sharp auf Vercel kein HEVC kann. Einzige
      // Ausnahme: zu viele Pixel, dann bekommt der Hof seinen eigenen Satz.
      return ablehnungFuer(fehler)
    }
    // Ein fremdes Format (die ersten Bytes zeigen kein erlaubtes Bild) bekommt
    // dieselbe Antwort wie ein unlesbares Bild.
    if (typeof fertig === 'string') return ablehnung(fertig)

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

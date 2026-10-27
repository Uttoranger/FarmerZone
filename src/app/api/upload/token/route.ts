import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  ERLAUBTE_UPLOAD_TYPEN,
  MAX_ORIGINAL_BYTES,
  STARTSEITE_ORIGINAL_PREFIX,
  STARTSEITE_UPLOAD_KENNUNG,
  originalPrefix,
} from '@/lib/upload-pfade'
import { UPLOAD_GESPERRT_TEXT } from '@/lib/email-bestaetigung'
import { emailBestaetigungOffen } from '@/server/email-bestaetigung'
import { verlangeAdminAktion } from '@/server/admin-wache'

/**
 * Ausgabestelle für signierte Upload-Token.
 *
 * Der Browser lädt das Original DIREKT in den Blob-Speicher, nicht über eine
 * Serverfunktion. Das ist der Kern dieses Umbaus: Eine Serverfunktion nimmt bei
 * Vercel höchstens ~4,5 MB Anfragekörper an — ein unverkleinertes Handyfoto hat
 * 6–8 MB. Genau deshalb musste der Browser bisher vorher verkleinern, und genau
 * das ist auf realen Geräten gescheitert. Jetzt geht die Datei am Limit vorbei,
 * und der Server verkleinert, wenn sie liegt.
 *
 * Diese Route vergibt nur die Erlaubnis dafür — und zwar so eng wie möglich.
 */

/**
 * Wer darf hochladen, und für welchen Hof? Eine Antwort für beide Handler.
 *
 * Seit Nr. 17b (S3) zusätzlich: Ein neues Konto lädt erst nach bestätigter
 * E-Mail-Adresse hoch — frisch aus der Datenbank, nicht aus der Sitzung (der
 * Cookie-Cache, der dafür bis Nr. 114 der Grund war, ist aus). Galerie,
 * Produktbilder, Titelbild, Logo, Beiträge und /teilen nehmen alle diesen Weg
 * (tests/upload-sperre.test.ts).
 */
async function hofDerSitzung(): Promise<{ id: string } | 'email-offen' | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const rolle = (session.user as typeof session.user & { role?: string }).role
  if (rolle !== 'FARMER') return null

  const farm = await prisma.farm.findUnique({ where: { ownerId: session.user.id }, select: { id: true } })
  if (!farm) return null
  if (await emailBestaetigungOffen(session.user.id)) return 'email-offen'
  return farm
}

/**
 * Zweck 'startseite' (Register N16, Nr. 96): Bilder der Startseite lädt der
 * Admin hoch — die EINE Stelle, an der statt der Hof-Sitzung die Admin-
 * Sitzung zählt. Seit Nr. 188 (Audit A2/B1) über die Admin-Wache selbst:
 * Admin-Recht frisch aus der Datenbank, 12 Stunden, Passkey der Sitzung und
 * das Recht „Startseite veröffentlichen“ (N35) — vorher genügte `isAdmin`,
 * auch in einer Sitzung ohne Passkey. Alle anderen Zwecke gehen unverändert
 * über hofDerSitzung.
 */
async function adminDerSitzung(): Promise<boolean> {
  const wache = await verlangeAdminAktion({ recht: 'startseite_veroeffentlichen' })
  return 'ok' in wache
}

/** Satz für den Bauern und Code für unseren Client (image-upload.tsx). */
function emailOffenAntwort(status: number): NextResponse {
  return NextResponse.json({ error: UPLOAD_GESPERRT_TEXT, code: 'EMAIL_UNBESTAETIGT' }, { status })
}

/** Erkennbar im catch unten — der Text geht so nicht an den Client. */
class EmailOffenFehler extends Error {}

/**
 * Die Hof-Kennung für den Client.
 *
 * Nötig, weil der Ablagepfad beim Client-Upload vom CLIENT kommt: `handleUpload`
 * darf ihn serverseitig nicht umschreiben, nur annehmen oder ablehnen (geprüft
 * an der Typ-Signatur von onBeforeGenerateToken in @vercel/blob 2.4). Damit der
 * Browser den richtigen Pfad überhaupt bilden KANN, muss er die Kennung kennen.
 *
 * Das ist kein Sicherheitsloch: Die Kennung ist keine Berechtigung. Wer sie
 * kennt, kann damit nichts anfangen — der POST unten vergleicht den angefragten
 * Pfad gegen den Hof der SITZUNG, nicht gegen das, was der Client behauptet.
 */
export async function GET() {
  const farm = await hofDerSitzung()
  if (farm === 'email-offen') return emailOffenAntwort(403)
  if (farm) return NextResponse.json({ farmId: farm.id })
  // Ein Admin ohne Hof bekommt eine Kennung, mit der nur der Zweck
  // 'startseite' einen Pfad hat (originalPfad); jeder andere Pfad fällt im
  // POST unten durch, weil er keinem Hof gehört.
  if (await adminDerSitzung()) return NextResponse.json({ farmId: STARTSEITE_UPLOAD_KENNUNG })
  return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const antwort = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Startseiten-Ordner: nur mit Admin-Sitzung, sonst nichts (auch kein Hof).
        if (pathname.startsWith(STARTSEITE_ORIGINAL_PREFIX)) {
          if (!(await adminDerSitzung())) throw new Error('Kein Zugriff')
          return {
            allowedContentTypes: [...ERLAUBTE_UPLOAD_TYPEN],
            maximumSizeInBytes: MAX_ORIGINAL_BYTES,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ zweck: 'startseite' }),
          }
        }

        const farm = await hofDerSitzung()
        if (farm === 'email-offen') throw new EmailOffenFehler()
        if (!farm) throw new Error('Kein Zugriff')

        // DIE eigentliche Sperre: Der Token gilt ausschließlich für den
        // angefragten Pfad, und der muss im Originale-Ordner GENAU DIESES
        // Hofes liegen. Ein manipulierter Client, der den Pfad eines fremden
        // Hofes anfragt, bekommt hier keinen Token — die Kennung aus dem GET
        // oben nützt ihm also nichts.
        if (!pathname.startsWith(originalPrefix(farm.id))) {
          throw new Error('Pfad nicht erlaubt')
        }

        return {
          // Nur die vier Formate, die die Verarbeitung liest (Sicherheitsupdate
          // 20.10.2026; vorher `image/*`, das auch SVG durchließ). Dazu
          // `application/octet-stream`: So schickt der Browser alles, was die
          // ersten Bytes nicht als JPEG, PNG oder WebP ausweisen
          // (uploadInhaltsTyp) — ohne ihn wiese der Speicher solche Dateien
          // mit falscher Meldung ab, ohne je hineingesehen zu haben. Die ECHTE
          // Formatprüfung macht die Verarbeitungs-Route an den Bytes
          // (src/lib/bild-format.ts), bevor sharp sie sieht.
          allowedContentTypes: [...ERLAUBTE_UPLOAD_TYPEN],
          maximumSizeInBytes: MAX_ORIGINAL_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ farmId: farm.id }),
        }
      },
      // BEWUSST LEER: Die Verarbeitung stößt der Client unmittelbar nach dem
      // Upload selbst an (POST /api/upload/verarbeiten). Das ist verlässlicher
      // als dieser Rückruf — er erreicht eine lokale Entwicklungsumgebung gar
      // nicht, wäre also weder testbar noch beim Entwickeln beobachtbar — und
      // der Client weiß dadurch, WANN das Bild fertig ist. Über einen Rückruf
      // müsste er darauf pollen.
      onUploadCompleted: async () => {},
    })

    return NextResponse.json(antwort)
  } catch (fehler) {
    if (fehler instanceof EmailOffenFehler) return emailOffenAntwort(403)
    // Der Wortlaut geht an unseren eigenen Client, nicht an den Bauern — die
    // Meldung für ihn baut der Hook aus der Fehlerart.
    const text = fehler instanceof Error ? fehler.message : 'Upload nicht erlaubt'
    return NextResponse.json({ error: text }, { status: 400 })
  }
}

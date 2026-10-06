import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MAX_ORIGINAL_BYTES, originalPrefix } from '@/lib/upload-pfade'
import { UPLOAD_GESPERRT_TEXT } from '@/lib/email-bestaetigung'
import { emailBestaetigungOffen } from '@/server/email-bestaetigung'

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
 * E-Mail-Adresse hoch — frisch aus der Datenbank, nie aus der Sitzung
 * (Cookie-Cache). Galerie, Produktbilder, Titelbild, Logo, Beiträge und
 * /teilen nehmen alle diesen Weg (tests/upload-sperre.test.ts).
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
  if (!farm) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  return NextResponse.json({ farmId: farm.id })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const antwort = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
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
          // Großzügig mit Absicht: Android liefert für Dateien aus manchen
          // Alben einen leeren oder falschen MIME-Typ. Eine strenge Liste hier
          // würde einwandfreie Fotos abweisen, ohne je hineingesehen zu haben —
          // genau der Fehler, den die letzten Sprints aufgeräumt haben. Die
          // ECHTE Formatprüfung macht sharp in der Verarbeitungs-Route, an den
          // Bytes statt an einer Behauptung.
          allowedContentTypes: ['image/*', 'application/octet-stream'],
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

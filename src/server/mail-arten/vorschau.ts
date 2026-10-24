import { entschaerfeLinks, nochmalErlaubt } from '@/lib/betrieb-mails'
import { bezugSchemaFuer, mailArtSchema } from '@/schemas/mail-auftrag'
import { RENDERER, type RendererTabelle } from '@/server/mail-arten'
import { ladeBestellungFuerMail } from '@/server/mail-arten/bestellung'

/*
 * Die Vorschau einer Mail in Admin › Betrieb › Alle Mails (Register N27,
 * Nr. 167): „so ginge sie heute hinaus“. Derselbe Renderer wie der Versand
 * baut sie mit dem heutigen Stand; danach macht `entschaerfeLinks` jeden Link
 * mit Signatur oder Token zu „[Link]“ und kürzt Adressen. Die Adresse der
 * fertigen Mail verlässt diese Funktion nie. Nichts wird gespeichert oder
 * protokolliert, nichts verschickt.
 *
 * Nur für Arten, die der Support nochmal schicken darf (`NOCHMAL_ERLAUBT`):
 * Codes, Passwort-Links und Admin-Mails zeigt die Vorschau nie. Der
 * Bar-Bestätigungslink hat keinen Renderer (Sofort) — er wird mit einem
 * Platzhalter statt Token gebaut, der ohnehin als „[Link]“ endet.
 */

/** Der Platzhalter statt Token: Zu ihm steht nirgends ein Hash, er bestätigt also nichts; lang genug, dass `entschaerfeLinks` ihn wie einen echten Token als „[Link]“ zeigt. */
const VORSCHAU_TOKEN = 'platzhalter-ohne-token'

export type MailVorschau = { betreff: string; html: string } | { verworfen: string } | { nie: true }

export async function baueMailVorschau(
  auftrag: { art: string; bezug: unknown; bestellungId: string | null },
  renderer: RendererTabelle = RENDERER
): Promise<MailVorschau> {
  const art = mailArtSchema.safeParse(auftrag.art)
  if (!art.success || !nochmalErlaubt(art.data)) return { nie: true }
  if (art.data === 'bar-bestaetigungslink') {
    const bestellung = auftrag.bestellungId ? await ladeBestellungFuerMail(auftrag.bestellungId) : null
    if (!bestellung) return { verworfen: 'bestellung_fehlt' }
    const { onsiteConfirmationInhalt } = await import('@/lib/email')
    const mail = await onsiteConfirmationInhalt(bestellung, VORSCHAU_TOKEN)
    return { betreff: entschaerfeLinks(mail.betreff), html: entschaerfeLinks(mail.html) }
  }
  const rendere = renderer[art.data]
  const bezug = bezugSchemaFuer(art.data).safeParse(auftrag.bezug)
  if (!rendere || !bezug.success) return { verworfen: 'bezug_ungueltig' }
  const mail = await rendere(bezug.data)
  if ('verworfen' in mail) return { verworfen: mail.verworfen }
  return { betreff: entschaerfeLinks(mail.betreff), html: entschaerfeLinks(mail.html) }
}

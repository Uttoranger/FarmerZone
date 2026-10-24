import { prisma } from '@/lib/prisma'
import { beitragIdImLink } from '@/lib/teilen-fenster'
import { generateUnsubscribeToken } from '@/lib/unsubscribe'
import { WERBEMAIL_EMPFAENGER } from '@/server/abo-anmeldung'
import { setzeVorname, vornameFuer, vornamenAusBestellungen } from '@/server/beitrag-vorname'
import type { BeitragBezug } from '@/schemas/mail-auftrag'
import type { StapelMail } from '@/lib/email'
import type { Verworfen } from '@/server/mail-arten'

/**
 * Renderer „beitrag“ (Kann warten): ein Beitrag an EIN Abo. Lädt beim Versand
 * frisch — wer sich inzwischen abgemeldet hat oder die Anmeldung nie bestätigt
 * hat, bekommt nichts (`WERBEMAIL_EMPFAENGER`, Double-Opt-in S11). Der Text
 * setzt {Vorname} aus der letzten Bestellung beim Hof ein, Knopf und
 * Abmeldung wie beim direkten Versand (`baueBeitragMail`).
 */
export async function rendereBeitrag(bezug: Record<string, string>): Promise<StapelMail | Verworfen> {
  // Der Worker hat den Bezug mit beitragBezugSchema geprüft.
  const { postId, aboId } = bezug as BeitragBezug
  const abo = await prisma.customerFarmSubscription.findFirst({
    where: { id: aboId, ...WERBEMAIL_EMPFAENGER },
    select: { customerEmail: true, farmId: true },
  })
  if (!abo) return { verworfen: 'abo_abgemeldet' }
  const post = await prisma.statusPost.findFirst({
    where: { id: postId, farmId: abo.farmId },
    select: { title: true, body: true, anlass: true, photoUrl: true, showOnFarmPage: true, farm: { select: { name: true, slug: true } } },
  })
  if (!post) return { verworfen: 'beitrag_fehlt' }
  // Dieselbe Hilfe wie der direkte Versand: gleicher Adressabgleich, gleicher Text.
  const vorname = vornameFuer(await vornamenAusBestellungen(abo.farmId, [abo.customerEmail]), abo.customerEmail)
  const { baueBeitragMail } = await import('@/lib/email')
  return baueBeitragMail({
    to: abo.customerEmail,
    farmName: post.farm.name,
    farmSlug: post.farm.slug,
    title: post.title,
    body: setzeVorname(post.body, vorname),
    anlass: post.anlass,
    photoUrl: post.photoUrl ?? undefined,
    beitragId: beitragIdImLink({ id: postId, showOnFarmPage: post.showOnFarmPage }),
    abmeldeToken: generateUnsubscribeToken(abo.customerEmail, abo.farmId),
  })
}

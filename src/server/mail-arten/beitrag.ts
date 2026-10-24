import { prisma } from '@/lib/prisma'
import { beitragIdImLink } from '@/lib/teilen-fenster'
import { generateUnsubscribeToken } from '@/lib/unsubscribe'
import { WERBEMAIL_EMPFAENGER } from '@/server/abo-anmeldung'
import { setzeVorname, vornameFuer, vornamenAusBestellungen } from '@/server/beitrag-vorname'
import { VORRANG, type BeitragBezug } from '@/schemas/mail-auftrag'
import type { StapelMail } from '@/lib/email'
import type { EinstellAuftrag } from '@/server/mail-warteschlange'
import type { Verworfen } from '@/server/mail-arten'

/** Ein Beitrag an jedes Abo: je Abo ein Auftrag (Kann warten), Schlüssel `beitrag:<postId>:<aboId>`. */
export function beitragAuftraege(post: { id: string; farmId: string }, aboIds: readonly string[]): EinstellAuftrag[] {
  return aboIds.map((aboId) => ({
    art: 'beitrag',
    vorrang: VORRANG.kannWarten,
    schluessel: `beitrag:${post.id}:${aboId}`,
    bezug: { postId: post.id, aboId },
    farmId: post.farmId,
  }))
}

/**
 * Wie viele Mails eines Beitrags hinausgingen — die EINE Quelle für „n per
 * E-Mail" in Mein Hof, Heute und im Teilen-Bild (Nr. 159): die gesendeten
 * Aufträge der Warteschlange. Ein Beitrag ganz ohne Aufträge stammt von vor
 * der Warteschlange; für ihn gilt die Zahl, die damals am Beitrag stand
 * (`emailRecipientCount`). Die Aufträge eines Beitrags entstehen frühestens
 * mit ihm — `ab` (der früheste Zeitpunkt) hält die Abfrage auf dem Index
 * (`art`, `erstelltAm`).
 */
export async function gesendeteBeitragsMails(
  beitraege: readonly { id: string; publishedAt: Date | null; createdAt: Date; emailRecipientCount: number }[]
): Promise<Map<string, number>> {
  const ergebnis = new Map(beitraege.map((b) => [b.id, b.emailRecipientCount]))
  if (beitraege.length === 0) return ergebnis
  // Eine Minute Spielraum: Beitrag und Aufträge entstehen in derselben Transaktion, aber mit je eigener Uhrzeit.
  const ab = new Date(Math.min(...beitraege.map((b) => Math.min(b.createdAt.getTime(), b.publishedAt?.getTime() ?? Infinity))) - 60_000)
  const zeilen = await prisma.$queryRaw<{ postId: string; gesendet: number }[]>`
    SELECT "bezug"->>'postId' AS "postId", (COUNT(*) FILTER (WHERE "status" = 'gesendet'))::int AS "gesendet"
    FROM "MailAuftrag"
    WHERE "art" = 'beitrag' AND "vorrang" = ${VORRANG.kannWarten} AND "erstelltAm" >= ${ab}
      AND "bezug"->>'postId' = ANY(${beitraege.map((b) => b.id)}::text[])
    GROUP BY 1`
  for (const z of zeilen) ergebnis.set(z.postId, z.gesendet)
  return ergebnis
}

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

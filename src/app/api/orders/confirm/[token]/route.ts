import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { barBestaetigungsPfad } from '@/lib/bestell-link'
import { barBestaetigungsTokenSchema } from '@/schemas/bar-bestaetigung'

/**
 * Der Bestätigungslink älterer Mails (H3). Er bestätigt NICHT mehr — er
 * leitet nur auf die Seite mit dem Knopf (/{hof}/bestaetigen/{token}).
 *
 * Warum: Link-Scanner der Mailprogramme, Vorschauen und Vorabrufe rufen Links
 * ungefragt per GET auf. Bestätigte schon dieser Aufruf, war eine Bestellung
 * „verbindlich bestätigt", ohne dass die Kundin je geklickt hatte (S2:
 * Zustandsänderungen nur per POST). Neue Mails verlinken die Seite direkt;
 * diese Route bleibt für Mails, die vor der Umstellung verschickt wurden.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const eingabe = barBestaetigungsTokenSchema.safeParse((await params).token)
  if (!eingabe.success) return NextResponse.redirect(new URL('/', request.url))

  const order = await prisma.order.findUnique({
    where: { confirmationToken: eingabe.data },
    select: { farm: { select: { slug: true } } },
  })
  if (!order) return NextResponse.redirect(new URL('/', request.url))

  return NextResponse.redirect(new URL(barBestaetigungsPfad(order.farm.slug, eingabe.data), request.url))
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bestellLinkGilt, bestellungPfad } from '@/lib/bestell-link'
import { erzeugeIcs, wienKalendertag } from '@/lib/kalender'

// Die ICS-Datei zum Abholtermin — derselbe signierte Zugang wie die
// Bestellseite darüber. Jede Ablehnung antwortet IDENTISCH (Text + 404),
// egal ob die Signatur falsch ist, die Bestellung fehlt, der Hof-Slug nicht
// stimmt oder der Hof stillgelegt wurde: kein Unterschied, aus dem sich die
// Existenz einer Bestellung ablesen ließe.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function abgelehnt(): NextResponse {
  return new NextResponse('Dieser Link ist nicht gültig', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ farmSlug: string; orderId: string }> }
) {
  const { farmSlug, orderId } = await params
  const s = request.nextUrl.searchParams.get('s')

  if (!s || !bestellLinkGilt(orderId, s)) return abgelehnt()

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      pickupDate: true,
      pickupTimeStart: true,
      pickupTimeEnd: true,
      farm: {
        select: { slug: true, name: true, address: true, postalCode: true, city: true, archivedAt: true },
      },
    },
  })

  if (!order || order.farm.slug !== farmSlug || order.farm.archivedAt) return abgelehnt()
  // Für eine stornierte Bestellung gibt es keinen Termin mehr — die Seite
  // zeigt den Knopf dann auch nicht an.
  if (order.status === 'CANCELLED') return abgelehnt()

  const ics = erzeugeIcs({
    titel: `Abholung ${order.farm.name}`,
    ort: `${order.farm.address}, ${order.farm.postalCode} ${order.farm.city}`,
    beschreibung: `Bestellung ${order.orderNumber}\n${APP_URL}${bestellungPfad(order.farm.slug, order.id)}`,
    datum: wienKalendertag(order.pickupDate),
    beginn: order.pickupTimeStart,
    ende: order.pickupTimeEnd,
    kennung: order.id,
    erstellt: new Date(),
  })

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // attachment, nicht inline: das Telefon reicht die Datei an den
      // Kalender weiter, der Browser versucht nicht, sie anzuzeigen.
      'Content-Disposition': `attachment; filename="abholung-${order.orderNumber}.ics"`,
      // Tiefenverteidigung: Route-Handler tragen kein metadata-noindex wie
      // die Seite, und die Antwort enthält Bestelldaten — nichts davon
      // gehört in einen Index oder einen geteilten Cache.
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'private, no-store',
    },
  })
}

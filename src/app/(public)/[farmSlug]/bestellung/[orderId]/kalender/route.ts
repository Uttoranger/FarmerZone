import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bestellLinkGilt } from '@/lib/bestell-link'
import { kalenderTerminGilt } from '@/lib/bestaetigung'
import { erzeugeIcs, wienKalendertag } from '@/lib/kalender'

// Die ICS-Datei zum Abholtermin — derselbe signierte Zugang wie die
// Bestellseite darüber. Jede Ablehnung antwortet IDENTISCH (Text + 404),
// egal ob die Signatur falsch ist, die Bestellung fehlt, der Hof-Slug nicht
// stimmt oder der Hof stillgelegt wurde: kein Unterschied, aus dem sich die
// Existenz einer Bestellung ablesen ließe.

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
  // Termin nur, solange die Bestellung steht und die Abholung aussteht —
  // dieselbe Regel wie der Knopf (kalenderTerminGilt): offen (vor der Frist
  // unbestätigt, danach verfallen), storniert, abgeholt → kein Termin.
  if (!kalenderTerminGilt(order.status)) return abgelehnt()

  const ics = erzeugeIcs({
    titel: `Abholung ${order.farm.name}`,
    ort: `${order.farm.address}, ${order.farm.postalCode} ${order.farm.city}`,
    // KEIN signierter Bestell-Link (Nr. 19b): Kalender werden synchronisiert,
    // geteilt und an Dritte weitergereicht — der Link öffnete dort Name,
    // E-Mail und Beträge der Kundin. Den Link hat sie in ihrer Mail.
    beschreibung: `Bestellung ${order.orderNumber}\nDeine Bestellung öffnest du über den Link in deiner Bestätigungs-E-Mail.`,
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

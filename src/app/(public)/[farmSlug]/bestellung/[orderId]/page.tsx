import Link from 'next/link'
import { CalendarPlus, MapPin, Package } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { bestellLinkGilt, bestellSignatur } from '@/lib/bestell-link'
import { bestellStatusAnzeige, formatiereAbholtermin, zahlungsAnzeige } from '@/lib/bestellstatus'
import { formatEuro } from '@/lib/preis-format'
import { formatOrderLine } from '@/lib/order-line'
import { Marke } from '@/components/ui/marke'

/**
 * Die Bestellseite der Kundin — erreichbar NUR über den signierten Link aus
 * der Bestätigungs- bzw. Abholbereit-Mail (?s=HMAC über die Bestell-ID,
 * src/lib/bestell-link.ts). Die Seite LIEST nur: kein Konto, keine
 * Stornierung, keine Bestell-Historie — bewusste Grenzen dieses Sprints.
 *
 * Ohne gültige Signatur erscheint für JEDEN Fall dieselbe ruhige Seite —
 * auch für eine Bestell-ID, die es gar nicht gibt, einen fremden Hof-Slug
 * oder einen stillgelegten Hof. Wer Links durchprobiert, erfährt so nicht
 * einmal, OB eine Bestellung existiert.
 */

interface Props {
  params: Promise<{ farmSlug: string; orderId: string }>
  searchParams: Promise<{ s?: string }>
}

// Eine private Seite mit Kundendaten hat in Suchmaschinen nichts verloren —
// egal, wo der Link später landet.
export const metadata = {
  robots: { index: false, follow: false },
}

function LinkUngueltig() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Dieser Link ist nicht gültig
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Bitte öffne den Link genau so, wie er in deiner E-Mail steht — am
          einfachsten, indem du ihn direkt in der E-Mail antippst.
        </p>
        <Link href="/hoefe" className="mt-6 inline-block text-sm text-primary hover:underline">
          Zur Hofübersicht
        </Link>
      </div>
    </div>
  )
}

export default async function BestellungPage({ params, searchParams }: Props) {
  const { farmSlug, orderId } = await params
  const { s } = await searchParams

  // Signatur ZUERST — vor jedem Datenbank-Zugriff. Eine unsignierte Anfrage
  // löst nicht einmal eine Abfrage aus.
  if (!s || !bestellLinkGilt(orderId, s)) return <LinkUngueltig />

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      totalAmount: true,
      pickupDate: true,
      pickupTimeStart: true,
      pickupTimeEnd: true,
      farm: {
        select: { slug: true, name: true, address: true, postalCode: true, city: true, archivedAt: true },
      },
      items: {
        select: {
          productName: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          // Einheit nur zur Anzeige gejoint — dieselbe Schreibweise wie auf
          // der Bestätigungsseite (formatOrderLine).
          product: { select: { unit: true, unitSize: true } },
        },
      },
    },
  })

  // Dieselbe ruhige Seite wie bei falscher Signatur (siehe Kopfkommentar);
  // stillgelegte Höfe wie auf der Bestätigungsseite (confirm/[orderId]).
  if (!order || order.farm.slug !== farmSlug || order.farm.archivedAt) return <LinkUngueltig />

  const abholtermin = formatiereAbholtermin(
    order.pickupDate,
    order.pickupTimeStart,
    order.pickupTimeEnd
  )
  const status = bestellStatusAnzeige(order.status, abholtermin, order.paymentMethod)
  const zahlung = zahlungsAnzeige(order.paymentMethod, order.paymentStatus)

  const pickupDatum = order.pickupDate.toLocaleDateString('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Vienna',
  })

  const storniert = order.status === 'CANCELLED'

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-muted-foreground">
          Deine Bestellung bei{' '}
          <Link href={`/${order.farm.slug}`} className="font-medium text-primary hover:underline">
            {order.farm.name}
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            {order.orderNumber}
          </h1>
          <Marke farbe={status.farbe}>{status.marke}</Marke>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{status.satz}</p>

        {/* Abholung — bei stornierten Bestellungen entfällt der Block: ein
            Termin samt Kalender-Knopf wäre eine falsche Einladung. */}
        {!storniert && (
          <div className="mt-6 space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="font-medium text-foreground">Abholung</h2>
            <p className="text-sm text-foreground">
              {pickupDatum}
              <br />
              <span className="text-muted-foreground">
                {order.pickupTimeStart} – {order.pickupTimeEnd} Uhr
              </span>
            </p>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              <span>
                {order.farm.name}
                <br />
                {order.farm.address}, {order.farm.postalCode} {order.farm.city}
              </span>
            </div>
            {/* Ein LINK, kein Formular: die ICS-Antwort trägt denselben
                signierten Zugang wie diese Seite. */}
            <a
              href={`/${order.farm.slug}/bestellung/${order.id}/kalender?s=${bestellSignatur(order.id)}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <CalendarPlus className="size-4" aria-hidden="true" />
              Termin in den Kalender
            </a>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-medium text-foreground">
            <Package className="size-4 text-primary" aria-hidden="true" />
            Deine Bestellung
          </h2>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between gap-3 text-sm">
                <span className="text-foreground">{formatOrderLine(item, item.product)}</span>
                <span className="shrink-0 text-foreground">
                  {formatEuro(Number(item.totalPrice))}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold">
            <span>Gesamt</span>
            <span className="text-primary">{formatEuro(Number(order.totalAmount))}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {zahlung.art} · {zahlung.zustand}
          </p>
        </div>

        <Link
          href={`/${order.farm.slug}`}
          className="mt-6 block text-center text-sm text-primary hover:underline"
        >
          Zum Hof
        </Link>
      </div>
    </div>
  )
}

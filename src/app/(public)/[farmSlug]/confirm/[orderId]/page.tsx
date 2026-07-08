import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Clock, XCircle, MapPin, Calendar, Package } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { ClearCartOnMount } from '@/components/checkout/clear-cart-on-mount'

interface Props {
  params: Promise<{ farmSlug: string; orderId: string }>
  searchParams: Promise<{ confirmed?: string; redirect_status?: string }>
}

async function getOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      totalAmount: true,
      customerName: true,
      customerEmail: true,
      pickupDate: true,
      pickupTimeStart: true,
      pickupTimeEnd: true,
      farm: {
        select: {
          slug: true,
          name: true,
          address: true,
          city: true,
          postalCode: true,
        },
      },
      items: {
        select: {
          productName: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
        },
      },
    },
  })
}

function formatEuro(n: number) {
  return `€ ${n.toFixed(2).replace('.', ',')}`
}

export default async function ConfirmPage({ params, searchParams }: Props) {
  const { farmSlug, orderId } = await params
  const { confirmed, redirect_status } = await searchParams

  const order = await getOrder(orderId)

  if (!order || order.farm.slug !== farmSlug) notFound()

  const isOnlinePaid =
    order.paymentMethod === 'ONLINE' &&
    (order.paymentStatus === 'PAID' || redirect_status === 'succeeded')

  const isOnlineFailed =
    order.paymentMethod === 'ONLINE' && redirect_status === 'failed'

  const isOnsiteConfirmed =
    order.paymentMethod !== 'ONLINE' &&
    (order.status === 'CONFIRMED' || confirmed === 'true')

  const isOnsitePending =
    order.paymentMethod !== 'ONLINE' &&
    order.status === 'PENDING_CONFIRMATION' &&
    confirmed !== 'true'

  const pickupDate = order.pickupDate.toLocaleDateString('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Always clear the cart when reaching the confirm page — the order has been submitted */}
      <ClearCartOnMount />
      <div className="max-w-lg mx-auto px-4 py-10">
        {isOnlinePaid && (
          <div className="flex flex-col items-center text-center mb-8">
            <CheckCircle className="size-14 text-green-600 mb-3" />
            <h1 className="font-heading text-2xl font-semibold text-foreground">Zahlung erfolgreich!</h1>
            <p className="text-muted-foreground mt-1">
              Deine Bestellung wurde bestätigt. Du erhältst eine E-Mail-Bestätigung.
            </p>
          </div>
        )}

        {isOnsiteConfirmed && (
          <div className="flex flex-col items-center text-center mb-8">
            <CheckCircle className="size-14 text-green-600 mb-3" />
            <h1 className="font-heading text-2xl font-semibold text-foreground">Bestellung bestätigt!</h1>
            <p className="text-muted-foreground mt-1">
              Deine Bestellung wurde verbindlich bestätigt. Bitte hole sie zum gewählten
              Termin ab und zahle vor Ort.
            </p>
          </div>
        )}

        {isOnsitePending && (
          <div className="flex flex-col items-center text-center mb-8">
            <Clock className="size-14 text-amber-500 mb-3" />
            <h1 className="font-heading text-2xl font-semibold text-foreground">Fast geschafft!</h1>
            <p className="text-muted-foreground mt-1">
              Bitte bestätige deine Bestellung über den Link in der E-Mail an{' '}
              <strong>{order.customerEmail}</strong>.
            </p>
          </div>
        )}

        {isOnlineFailed && (
          <div className="flex flex-col items-center text-center mb-8">
            <XCircle className="size-14 text-red-500 mb-3" />
            <h1 className="font-heading text-2xl font-semibold text-foreground">Zahlung fehlgeschlagen</h1>
            <p className="text-muted-foreground mt-1">
              Bitte versuche es erneut oder wähle eine andere Zahlungsart.
            </p>
            <Link
              href={`/${farmSlug}/checkout`}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              Erneut versuchen
            </Link>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Bestellnummer</span>
            <span className="font-mono font-bold text-foreground">{order.orderNumber}</span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 mb-4 space-y-3">
          <h2 className="font-medium text-foreground flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            Abholtermin
          </h2>
          <p className="text-sm text-foreground">
            {pickupDate}
            <br />
            <span className="text-muted-foreground">
              {order.pickupTimeStart} – {order.pickupTimeEnd} Uhr
            </span>
          </p>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4 text-muted-foreground/60 mt-0.5 shrink-0" />
            <span>
              {order.farm.name}
              <br />
              {order.farm.address}, {order.farm.postalCode} {order.farm.city}
            </span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 mb-6">
          <h2 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <Package className="size-4 text-primary" />
            Bestellübersicht
          </h2>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-foreground">
                  {item.quantity} × {item.productName}
                </span>
                <span className="text-foreground">{formatEuro(Number(item.totalPrice))}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex justify-between font-semibold">
            <span>Gesamt</span>
            <span className="text-primary">{formatEuro(Number(order.totalAmount))}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {order.paymentMethod === 'ONLINE'
              ? 'Online bezahlt'
              : order.paymentMethod === 'ONSITE_CASH'
              ? 'Bar bei Abholung'
              : 'Karte bei Abholung'}
          </p>
        </div>

        <Link
          href={`/${farmSlug}`}
          className="block text-center text-sm text-primary hover:underline"
        >
          ← Zurück zu {order.farm.name}
        </Link>
      </div>
    </div>
  )
}

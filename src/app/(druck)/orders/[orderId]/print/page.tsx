import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getOrderDetail } from '@/server/queries/orders'
import { statusLabel, paymentLabel } from '@/components/orders/order-status'
import { PrintButton } from '@/components/orders/print-button'
import { barZuKassierenCents, bestellSummen, centsAlsEuro } from '@/lib/servicegebuehr'
import { formatDatumLang, formatEuro } from '@/lib/format'
import { datumLang } from '@/lib/heute'
import { formatiereTelefon } from '@/lib/telefon-anzeige'

export const dynamic = 'force-dynamic'

export default async function OrderPrintPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params

  // Dieselbe Wache wie jede Hof-Seite (Anmeldung mit Rücksprung, sonst Einrichten).
  const { farmId } = await verlangeHofDerSitzung()

  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { id: true, name: true, address: true, postalCode: true, city: true, phone: true },
  })
  if (!farm) redirect('/onboarding')

  const order = await getOrderDetail(farm.id, orderId)
  if (!order) notFound()

  // Wiener Tag, nie der der Serveruhr (CODING_STANDARDS „Tage und Wochen").
  const pickupDate = datumLang(order.pickupDate)
  // Servicegebühr aus dem Snapshot: Zwischensumme/Gebühr/Gesamt wie im
  // Checkout, „Bar zu kassieren" bei Vor-Ort-Zahlung
  const summen = bestellSummen(order)
  const kassieren = barZuKassierenCents(order)

  // Das Layout der Gruppe (druck) trägt keine Navigation: Papier aus Tokens, die
  // in beiden Themes gleich sind. Nur der Knopf und der Rückweg sind
  // `print:hidden` — ein eigener @media-print-Block wäre eine zweite Wahrheit.
  return (
    <>
      <div className="p-8 max-w-md mx-auto font-sans">
        {/* Browser-only controls */}
        <div className="flex items-center gap-4 mb-6 print:hidden">
          <PrintButton />
          <Link
            href={`/orders/${orderId}`}
            className="inline-flex min-h-11 items-center rounded-sm text-sm text-primary-foreground/70 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
          >
            Zurück
          </Link>
        </div>

        {/* Farm header */}
        <div className="border-b-2 border-primary-foreground pb-4 mb-5">
          <div className="text-xl font-bold">{farm.name}</div>
          <div className="text-sm text-primary-foreground/70">
            {farm.address} · {farm.postalCode} {farm.city}
          </div>
          {farm.phone && <div className="text-sm text-primary-foreground/70">{formatiereTelefon(farm.phone)}</div>}
        </div>

        {/* Order header */}
        <div className="mb-5">
          <div className="flex justify-between items-baseline">
            <div className="text-lg font-bold">{order.orderNumber}</div>
            <div className="text-sm">{statusLabel(order.status)}</div>
          </div>
          <div className="text-xs text-primary-foreground/70 mt-0.5">
            Eingang: {formatDatumLang(order.createdAt)}
          </div>
        </div>

        {/* Pickup */}
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/70 mb-1">
            Abholung
          </div>
          <div className="font-medium">{pickupDate}</div>
          <div className="text-sm text-primary-foreground/80">
            {order.pickupTimeStart} – {order.pickupTimeEnd} Uhr
          </div>
        </div>

        {/* Customer */}
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/70 mb-1">
            Kunde
          </div>
          <div className="font-medium">{order.customerName}</div>
          <div className="text-sm text-primary-foreground/80">{formatiereTelefon(order.customerPhone)}</div>
          <div className="text-sm text-primary-foreground/80">{order.customerEmail}</div>
          {order.customerNote && (
            <div className="text-sm text-primary-foreground/70 mt-1 italic">{order.customerNote}</div>
          )}
        </div>

        {/* Items */}
        <table className="w-full text-sm mb-4 border-collapse">
          <thead>
            <tr className="border-b-2 border-primary-foreground/30">
              <th className="text-left py-1 font-semibold">Produkt</th>
              <th className="text-center py-1 font-semibold w-12">Menge</th>
              <th className="text-right py-1 font-semibold w-20">Preis</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-primary-foreground/10">
                <td className={`py-1.5 ${item.fehltSeit ? 'line-through' : ''}`}>
                  {item.productName}
                  {item.fehltSeit && <span className="no-underline"> (fehlt)</span>}
                </td>
                <td className="text-center py-1.5">{item.quantity}×</td>
                <td className="text-right py-1.5">{item.fehltSeit ? '–' : formatEuro(centsAlsEuro(item.totalPriceCents))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {summen.gebuehrCents > 0 && (
              <>
                <tr className="border-t-2 border-primary-foreground/30">
                  <td colSpan={2} className="py-1.5">Zwischensumme (Warenpreis)</td>
                  <td className="text-right py-1.5">{formatEuro(centsAlsEuro(summen.warenpreisCents))}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="py-1.5">Servicegebühr</td>
                  <td className="text-right py-1.5">{formatEuro(centsAlsEuro(summen.gebuehrCents))}</td>
                </tr>
              </>
            )}
            <tr className={summen.gebuehrCents > 0 ? 'border-t border-primary-foreground/30' : 'border-t-2 border-primary-foreground/30'}>
              <td colSpan={2} className="py-2 font-bold">
                Gesamt
              </td>
              <td className="text-right py-2 font-bold">
                {formatEuro(centsAlsEuro(summen.gesamtCents))}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="text-sm text-primary-foreground/80">
          Zahlung: {paymentLabel(order.paymentMethod)}
        </div>
        {kassieren !== null && (
          <div className="mt-1 text-sm font-semibold">
            Bar zu kassieren: {formatEuro(centsAlsEuro(kassieren))}
            {summen.gebuehrCents > 0 && (
              <span className="font-normal text-primary-foreground/70">
                {' '}(davon Servicegebühr {formatEuro(centsAlsEuro(summen.gebuehrCents))})
              </span>
            )}
          </div>
        )}
      </div>
    </>
  )
}

import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOrderDetail } from '@/server/queries/orders'
import { statusLabel, paymentLabel } from '@/components/orders/order-status'
import { PrintButton } from '@/components/orders/print-button'

export const dynamic = 'force-dynamic'

export default async function OrderPrintPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await prisma.farm.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true, name: true, address: true, postalCode: true, city: true, phone: true },
  })
  if (!farm) redirect('/login')

  const order = await getOrderDetail(farm.id, orderId)
  if (!order) notFound()

  const pickupDate = order.pickupDate.toLocaleDateString('de-AT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <>
      {/* Hide nav on print */}
      <style>{`@media print { nav, aside { display: none !important; } main { margin: 0 !important; } }`}</style>

      <div className="p-8 max-w-md mx-auto font-sans text-slate-800">
        {/* Browser-only controls */}
        <div className="flex gap-4 mb-6 print:hidden">
          <PrintButton />
          <Link
            href={`/orders/${orderId}`}
            className="text-sm text-slate-500 hover:underline self-center"
          >
            Zurück
          </Link>
        </div>

        {/* Farm header */}
        <div className="border-b-2 border-slate-800 pb-4 mb-5">
          <div className="text-xl font-bold">{farm.name}</div>
          <div className="text-sm text-slate-500">
            {farm.address} · {farm.postalCode} {farm.city}
          </div>
          {farm.phone && <div className="text-sm text-slate-500">{farm.phone}</div>}
        </div>

        {/* Order header */}
        <div className="mb-5">
          <div className="flex justify-between items-baseline">
            <div className="text-lg font-bold">{order.orderNumber}</div>
            <div className="text-sm">{statusLabel(order.status)}</div>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Eingang: {order.createdAt.toLocaleDateString('de-AT')}
          </div>
        </div>

        {/* Pickup */}
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Abholung
          </div>
          <div className="font-medium">{pickupDate}</div>
          <div className="text-sm text-slate-600">
            {order.pickupTimeStart} – {order.pickupTimeEnd} Uhr
          </div>
        </div>

        {/* Customer */}
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Kunde
          </div>
          <div className="font-medium">{order.customerName}</div>
          <div className="text-sm text-slate-600">{order.customerPhone}</div>
          <div className="text-sm text-slate-600">{order.customerEmail}</div>
          {order.customerNote && (
            <div className="text-sm text-slate-500 mt-1 italic">{order.customerNote}</div>
          )}
        </div>

        {/* Items */}
        <table className="w-full text-sm mb-4 border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-300">
              <th className="text-left py-1 font-semibold">Produkt</th>
              <th className="text-center py-1 font-semibold w-12">Menge</th>
              <th className="text-right py-1 font-semibold w-20">Preis</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-1.5">{item.productName}</td>
                <td className="text-center py-1.5">{item.quantity}×</td>
                <td className="text-right py-1.5">€ {Number(item.totalPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300">
              <td colSpan={2} className="py-2 font-bold">
                Gesamt
              </td>
              <td className="text-right py-2 font-bold">
                € {Number(order.totalAmount).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="text-sm text-slate-600">
          Zahlung: {paymentLabel(order.paymentMethod)}
        </div>
      </div>
    </>
  )
}

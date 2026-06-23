import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from '@/components/orders/print-button'

export const dynamic = 'force-dynamic'

export default async function PrintPacklistPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const tagStart = new Date()
  tagStart.setHours(0, 0, 0, 0)
  const tagEnde = new Date()
  tagEnde.setHours(23, 59, 59, 999)

  const orders = await prisma.order.findMany({
    where: {
      farmId: farm.id,
      pickupDate: { gte: tagStart, lte: tagEnde },
      status: { notIn: ['CANCELLED', 'NOT_PICKED_UP'] },
    },
    include: {
      items: { select: { productName: true, quantity: true } },
    },
    orderBy: { pickupTimeStart: 'asc' },
  })

  const today = new Date().toLocaleDateString('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Aggregate pack list
  const packList = new Map<string, number>()
  for (const order of orders) {
    for (const item of order.items) {
      packList.set(item.productName, (packList.get(item.productName) ?? 0) + item.quantity)
    }
  }
  const packListEntries = Array.from(packList.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 14px; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      {/* Back button — hidden on print */}
      <div className="no-print px-6 py-4 border-b border-gray-200">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </Link>
        <PrintButton />
      </div>

      <div className="px-8 py-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 border-b border-gray-200 pb-4">
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">{farm.name}</div>
          <h1 className="text-2xl font-bold text-gray-900">Packliste</h1>
          <p className="text-gray-500 mt-0.5 capitalize">{today}</p>
        </div>

        {orders.length === 0 ? (
          <p className="text-gray-400 text-center py-12">Heute keine Bestellungen zur Abholung.</p>
        ) : (
          <>
            {/* Aggregated pack list */}
            <section className="mb-10">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Gesamt vorbereiten
              </h2>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {packListEntries.map(([name, qty], i) => (
                  <div
                    key={name}
                    className={`flex items-center justify-between px-4 py-3 ${
                      i !== packListEntries.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <span className="font-medium text-gray-800">{name}</span>
                    <span className="font-bold text-gray-900 text-lg">{qty}×</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Per-customer breakdown */}
            <section>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Pro Kunde ({orders.length})
              </h2>
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex items-baseline justify-between mb-2">
                      <div>
                        <span className="font-semibold text-gray-900">{order.customerName}</span>
                        <span className="text-xs text-gray-400 ml-2 font-mono">
                          {order.orderNumber}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {order.pickupTimeStart}–{order.pickupTimeEnd} Uhr
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="font-bold w-6 text-right shrink-0">{item.quantity}×</span>
                          <span>{item.productName}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {order.paymentMethod === 'ONLINE'
                          ? 'Online bezahlt'
                          : order.paymentMethod === 'ONSITE_CASH'
                          ? 'Barzahlung vor Ort'
                          : 'Kartenzahlung vor Ort'}
                      </span>
                      <span className="text-sm font-semibold text-gray-800">
                        € {Number(order.totalAmount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Print footer */}
        <div className="mt-10 pt-4 border-t border-gray-200 text-xs text-gray-300 text-center">
          Gedruckt am {new Date().toLocaleString('de-AT')} · FarmerZone
        </div>
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { getFarmForUser } from '@/server/queries/dashboard'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from '@/components/orders/print-button'
import { unitSuffix } from '@/lib/order-line'
import { barZuKassierenCents, bestellSummen, centsAlsEuro } from '@/lib/servicegebuehr'
import { formatDatumLang, formatEuro } from '@/lib/format'
import { uhrzeitInWien } from '@/lib/fristen'
import { abholtage, abholWhere, datumLang } from '@/lib/heute'
import { MARKE } from '@/lib/marke'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'

export const dynamic = 'force-dynamic'

function PacklistenBetrag({
  order,
}: {
  order: { paymentMethod: string; totalAmount: { toString(): string }; serviceFeeCents: number }
}) {
  const summen = bestellSummen(order)
  const kassieren = barZuKassierenCents(order)
  if (kassieren === null) {
    return (
      <span className="text-right text-sm font-semibold text-primary-foreground">
        {formatEuro(centsAlsEuro(summen.warenpreisCents))}
      </span>
    )
  }
  return (
    <span className="text-right">
      <span className="block text-sm font-semibold text-primary-foreground">
        Bar zu kassieren: {formatEuro(centsAlsEuro(kassieren))}
      </span>
      {summen.gebuehrCents > 0 && (
        <span className="block text-xs text-primary-foreground/70">
          inkl. {formatEuro(centsAlsEuro(summen.gebuehrCents))} Servicegebühr
        </span>
      )}
    </span>
  )
}

export default async function PrintPacklistPage() {
  // Dieselbe Wache wie jede Hof-Seite (Anmeldung mit Rücksprung, sonst Einrichten).
  const { userId } = await verlangeHofDerSitzung()

  const farm = await getFarmForUser(userId)
  if (!farm) redirect('/onboarding')

  // Dieselbe Bedingung wie „Heute abholen" auf /dashboard, mit Wiener
  // Tagesgrenze: Bildschirm und Papier zeigen dieselben Bestellungen.
  const jetzt = new Date()
  // Verfallene, unbezahlte Bestellungen vorher freigeben (wie /dashboard, mit
  // demselben jetzt): Das Papier zeigt nur, was der Bildschirm auch zeigt.
  await gibVerwaisteFreiOhneRisiko(farm.id, jetzt)
  const orders = await prisma.order.findMany({
    where: abholWhere(farm.id, abholtage(jetzt).heute),
    include: {
      items: {
        // Fehlende Artikel (E14) werden nicht gepackt — sie stehen nicht auf dem Papier.
        where: { fehltSeit: null },
        select: {
          productName: true,
          quantity: true,
          // Einheit nur zur Anzeige gejoint — kein Schema-Change
          product: { select: { unit: true, unitSize: true } },
        },
      },
    },
    orderBy: { pickupTimeStart: 'asc' },
  })

  const today = datumLang(jetzt)

  // Aggregate pack list (Schlüssel: Produktname; Einheit fürs Suffix gemerkt)
  const packList = new Map<string, { qty: number; product: (typeof orders)[number]['items'][number]['product'] }>()
  for (const order of orders) {
    for (const item of order.items) {
      const entry = packList.get(item.productName)
      packList.set(item.productName, {
        qty: (entry?.qty ?? 0) + item.quantity,
        product: entry?.product ?? item.product,
      })
    }
  }
  const packListEntries = Array.from(packList.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="min-h-screen print:text-sm">
      {/* Zurück und Drucken — nicht auf dem Papier */}
      <div className="print:hidden flex items-center gap-4 px-6 py-4 border-b border-primary-foreground/20">
        <Link
          href="/orders"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Zurück
        </Link>
        <PrintButton />
      </div>

      <div className="px-8 py-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 border-b border-primary-foreground/20 pb-4">
          <div className="text-xs text-primary-foreground/70 uppercase tracking-widest mb-1">{farm.name}</div>
          <h1 className="text-2xl font-bold text-primary-foreground">Packliste</h1>
          <p className="text-primary-foreground/70 mt-0.5 capitalize">{today}</p>
        </div>

        {orders.length === 0 ? (
          <p className="text-primary-foreground/70 text-center py-12">Heute keine Bestellungen zur Abholung.</p>
        ) : (
          <>
            {/* Aggregated pack list */}
            <section className="mb-10">
              <h2 className="text-xs font-bold text-primary-foreground/70 uppercase tracking-widest mb-3">
                Gesamt vorbereiten
              </h2>
              <div className="border border-primary-foreground/20 rounded-lg overflow-hidden">
                {packListEntries.map(([name, entry], i) => (
                  <div
                    key={name}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      i !== packListEntries.length - 1 ? 'border-b border-primary-foreground/10' : ''
                    }`}
                  >
                    <span className="font-medium text-primary-foreground min-w-0">
                      {name}
                      {unitSuffix(entry.product) ? (
                        <span className="text-primary-foreground/70 font-normal"> ({unitSuffix(entry.product)})</span>
                      ) : null}
                    </span>
                    <span className="font-bold text-primary-foreground text-lg shrink-0">{entry.qty}×</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Per-customer breakdown */}
            <section>
              <h2 className="text-xs font-bold text-primary-foreground/70 uppercase tracking-widest mb-3">
                Pro Kunde ({orders.length})
              </h2>
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="border border-primary-foreground/20 rounded-lg px-4 py-3 break-inside-avoid">
                    <div className="flex items-baseline justify-between mb-2">
                      <div>
                        <span className="font-semibold text-primary-foreground">{order.customerName}</span>
                        <span className="text-xs text-primary-foreground/70 ml-2 font-mono">
                          {order.orderNumber}
                        </span>
                      </div>
                      <span className="text-sm text-primary-foreground/70">
                        {order.pickupTimeStart}–{order.pickupTimeEnd} Uhr
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-primary-foreground/90">
                          <span className="font-bold w-6 text-right shrink-0">{item.quantity}×</span>
                          <span className="min-w-0">
                            {item.productName}
                            {unitSuffix(item.product) ? (
                              <span className="text-primary-foreground/70"> ({unitSuffix(item.product)})</span>
                            ) : null}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-primary-foreground/10 flex items-center justify-between gap-3">
                      <span className="text-xs text-primary-foreground/70">
                        {order.paymentMethod === 'ONLINE'
                          ? 'Online bezahlt'
                          : order.paymentMethod === 'ONSITE_CASH'
                          ? 'Barzahlung vor Ort'
                          : 'Kartenzahlung vor Ort'}
                      </span>
                      {/* Bei Vor-Ort-Zahlung der zu kassierende Betrag (Warenpreis
                          + Servicegebühr), online der Warenpreis */}
                      <PacklistenBetrag order={order} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Print footer */}
        <div className="mt-10 pt-4 border-t border-primary-foreground/20 text-xs text-primary-foreground/70 text-center">
          Gedruckt am {formatDatumLang(jetzt)}, {uhrzeitInWien(jetzt)} Uhr · {MARKE}
        </div>
      </div>
    </div>
  )
}

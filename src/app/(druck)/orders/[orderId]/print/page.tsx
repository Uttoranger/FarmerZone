import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getOrderDetail } from '@/server/queries/orders'
import { PrintButton } from '@/components/orders/print-button'
import { barZuKassierenCents, bestellSummen, centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { uhrzeitInWien } from '@/lib/fristen'
import { datumLang } from '@/lib/heute'
import { formatiereTelefon } from '@/lib/telefon-anzeige'
import { unitSuffix } from '@/lib/order-line'
import { DRUCK_ABGLEICH, druckGebuehrZeile, druckPreisHinweis, papierMarke, zahlartText } from '@/lib/hof-bestellungen'

export const dynamic = 'force-dynamic'

/*
 * Der Abholzettel einer Bestellung (Boards s2-druck, w2-druck; nur hell, V44).
 * Papier sagt dasselbe wie der Bildschirm (V57): die Marke der Packliste
 * („Zum Packen“, „Wartet auf Kunde“), „Bar bei Abholung“, „Bar zu kassieren“.
 * Die Zeile mit der Gebühr steht nur bei Bestellungen im Modell „bisher“ — im
 * Hofpreis-Modell steckt die Plattformgebühr im Preis (N38), darunter steht
 * „Preise inkl. Plattformgebühr.“ (druckGebuehrZeile, druckPreisHinweis).
 */
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
  // Beträge aus dem Snapshot: Warenpreis, Gebühr, Gesamt wie im Checkout, „Bar zu kassieren" vor Ort.
  const summen = bestellSummen(order)
  const kassieren = barZuKassierenCents(order)
  const gebuehrZeile = druckGebuehrZeile(order, summen.gebuehrCents)
  const preisHinweis = druckPreisHinweis(order)
  const marke = papierMarke(order.status)

  // Das Layout der Gruppe (druck) trägt keine Navigation: Papier aus Tokens, die
  // in beiden Themes gleich sind. Nur der Knopf und der Rückweg sind
  // `print:hidden` — ein eigener @media-print-Block wäre eine zweite Wahrheit.
  return (
    <div className="min-h-screen font-sans print:text-sm">
      {/* Zurück und Drucken — nicht auf dem Papier */}
      <div className="flex items-center justify-between gap-4 border-b border-primary-foreground/20 px-4 py-2 print:hidden md:px-6">
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-[15px] font-semibold text-primary-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Zurück
        </Link>
        <PrintButton />
      </div>

      {/* Blatt wie im Board w2-druck: Inhalt rund 650 px breit. */}
      <div className="mx-auto max-w-[746px] px-4 py-6 md:px-12 md:py-12">
        {/* Hof */}
        <div className="mb-5 border-b-2 border-primary-foreground pb-3">
          <div className="font-heading text-xl font-semibold md:text-[22px]">{farm.name}</div>
          <div className="text-sm text-primary-foreground/70">
            {farm.address} · {farm.postalCode} {farm.city}
          </div>
          {farm.phone && <div className="text-sm text-primary-foreground/70">{formatiereTelefon(farm.phone)}</div>}
        </div>

        {/* Bestellung */}
        <div className="mb-5">
          <div className="flex items-baseline justify-between gap-3">
            {/* Die eine Überschrift des Zettels ist die Bestellnummer. */}
            <h1 className="text-2xl font-bold tracking-wide md:text-[28px]">{order.orderNumber}</h1>
            <div className="text-sm font-semibold">{marke.text}</div>
          </div>
          <div className="mt-2 text-sm text-primary-foreground/70">Eingang: {datumLang(order.createdAt)}, {uhrzeitInWien(order.createdAt)} Uhr</div>
        </div>

        {/* Abholung und Kunde nebeneinander */}
        <div className="mb-5 grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <div className="mb-0.5 text-[13px] font-semibold tracking-wide text-primary-foreground/70 uppercase">Abholung</div>
            <div className="font-semibold break-words">{pickupDate}</div>
            <div className="text-sm text-primary-foreground/80">
              {order.pickupTimeStart} – {order.pickupTimeEnd} Uhr
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-0.5 text-[13px] font-semibold tracking-wide text-primary-foreground/70 uppercase">Kunde</div>
            <div className="font-semibold break-words">{order.customerName}</div>
            <div className="text-sm text-primary-foreground/80">{formatiereTelefon(order.customerPhone)}</div>
            <div className="text-sm [overflow-wrap:anywhere] text-primary-foreground/80">{order.customerEmail}</div>
          </div>
        </div>
        {order.customerNote && <div className="mb-5 text-sm break-words text-primary-foreground/70 italic">{order.customerNote}</div>}

        {/* Positionen */}
        <table className="mb-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-primary-foreground/30">
              <th className="py-1 text-left text-sm font-semibold text-primary-foreground/70">Produkt</th>
              <th className="w-16 py-1 text-right text-sm font-semibold text-primary-foreground/70">Menge</th>
              <th className="w-24 py-1 text-right text-sm font-semibold text-primary-foreground/70">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-primary-foreground/10">
                <td className={`py-1.5 ${item.fehltSeit ? 'line-through' : ''}`}>
                  {item.productName}
                  {unitSuffix(item.product ?? undefined) ? <> ({unitSuffix(item.product ?? undefined)})</> : null}
                  {item.fehltSeit && <span className="no-underline"> (fehlt)</span>}
                </td>
                <td className="py-1.5 text-right">{item.quantity}×</td>
                <td className="py-1.5 text-right">{item.fehltSeit ? '–' : formatEuro(centsAlsEuro(item.totalPriceCents))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {gebuehrZeile && (
              <>
                <tr className="border-t-2 border-primary-foreground">
                  <td colSpan={2} className="py-1.5">
                    Zwischensumme (Warenpreis)
                  </td>
                  <td className="py-1.5 text-right">{formatEuro(centsAlsEuro(summen.warenpreisCents))}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="py-1.5">
                    {gebuehrZeile}
                  </td>
                  <td className="py-1.5 text-right">{formatEuro(centsAlsEuro(summen.gebuehrCents))}</td>
                </tr>
              </>
            )}
            <tr className={gebuehrZeile ? 'border-t border-primary-foreground/30' : 'border-t-2 border-primary-foreground'}>
              <td colSpan={2} className="py-2 font-bold">
                Gesamt
              </td>
              <td className="py-2 text-right text-base font-bold">{formatEuro(centsAlsEuro(summen.gesamtCents))}</td>
            </tr>
          </tfoot>
        </table>

        <div className="text-sm">Zahlung: {zahlartText(order.paymentMethod, order.paymentStatus)}</div>
        {kassieren !== null && (
          <div className="mt-3 rounded-md border-2 border-primary-foreground px-3.5 py-2.5 text-base font-bold md:text-lg">
            Bar zu kassieren: {formatEuro(centsAlsEuro(kassieren))}
            {gebuehrZeile && (
              <span className="text-sm font-normal text-primary-foreground/70">
                {' '}
                (davon {gebuehrZeile} {formatEuro(centsAlsEuro(summen.gebuehrCents))})
              </span>
            )}
          </div>
        )}
        <p className="mt-4 text-sm text-primary-foreground/70">
          {preisHinweis ? `${preisHinweis} ` : ''}
          {DRUCK_ABGLEICH}
        </p>
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { getFarmForUser } from '@/server/queries/dashboard'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from '@/components/orders/print-button'
import { unitSuffix } from '@/lib/order-line'
import { barZuKassierenCents, bestellSummen, centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { uhrzeitInWien } from '@/lib/fristen'
import { HEUTE_KEINE_ABHOLUNG_PAPIER, abholtage, abholWhere, datumLang, naechsteAbholungPapier } from '@/lib/heute'
import { wienKalendertag } from '@/lib/kalender'
import { druckGebuehrZeile, druckPreisHinweis, papierMarke, zahlartText } from '@/lib/hof-bestellungen'
import { naechstesFensterMitZahl } from '@/app/(hof)/orders/naechste-abholung'
import { MARKE } from '@/lib/marke'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'

export const dynamic = 'force-dynamic'

/**
 * Rechts unter einer Bestellung (Board w2-druck): bar „Bar zu kassieren € 17,31“, online der
 * Betrag, den die Kundin gezahlt hat — derselbe wie in der Liste am Bildschirm (V57). Die
 * Gebühr steht als eigene Zeile nur im Modell „bisher“ (druckGebuehrZeile).
 */
function PacklistenBetrag({
  order,
}: {
  order: { paymentMethod: string; totalAmount: { toString(): string }; serviceFeeCents: number; gebuehrModell: string | null }
}) {
  const summen = bestellSummen(order)
  const kassieren = barZuKassierenCents(order)
  const gebuehrZeile = druckGebuehrZeile(order, summen.gebuehrCents)
  return (
    <span className="shrink-0 text-right">
      <span className="block text-sm font-bold text-primary-foreground">
        {kassieren !== null ? `Bar zu kassieren ${formatEuro(centsAlsEuro(kassieren))}` : formatEuro(centsAlsEuro(summen.gesamtCents))}
      </span>
      {gebuehrZeile && (
        <span className="block text-xs text-primary-foreground/70">
          inkl. {formatEuro(centsAlsEuro(summen.gebuehrCents))} {gebuehrZeile}
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
  // Leer: die nächste Abholung laut Abholzeiten (Board s2-druck, Bild 3).
  const naechstes = orders.length === 0 ? await naechstesFensterMitZahl(farm.id, jetzt) : null
  // „Preise inkl. Plattformgebühr.“ sobald eine Bestellung im Hofpreis-Modell dabei ist (V62).
  const preisHinweis = orders.map((o) => druckPreisHinweis(o)).find((h) => h !== null) ?? null

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
      <div className="flex items-center justify-between gap-4 border-b border-primary-foreground/20 px-4 py-2 print:hidden md:px-6">
        <Link
          href="/orders"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-[15px] font-semibold text-primary-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Zurück
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 md:px-12 md:py-12">
        {/* Kopf */}
        <div className="mb-4">
          <div className="text-sm font-semibold text-primary-foreground/70">{farm.name}</div>
          <h1 className="font-heading text-2xl font-semibold text-primary-foreground md:text-[28px]">Packliste</h1>
          <p className="mt-0.5 text-primary-foreground/80">{today}</p>
        </div>

        {orders.length === 0 ? (
          <div className="flex flex-col gap-1 text-primary-foreground/90">
            <p>{HEUTE_KEINE_ABHOLUNG_PAPIER}</p>
            {naechstes && <p>{naechsteAbholungPapier(naechstes.fenster, wienKalendertag(jetzt))}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Gesamt vorbereiten */}
            <section className="overflow-hidden rounded-lg border border-primary-foreground">
              <h2 className="border-b border-primary-foreground/20 px-3 py-2 text-xs font-bold tracking-wide text-primary-foreground uppercase">
                Gesamt vorbereiten
              </h2>
              {packListEntries.map(([name, entry], i) => (
                <div
                  key={name}
                  className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${
                    i !== packListEntries.length - 1 ? 'border-b border-primary-foreground/15' : ''
                  }`}
                >
                  <span className="min-w-0 text-primary-foreground">
                    {name}
                    {unitSuffix(entry.product) ? <span className="text-primary-foreground/70"> ({unitSuffix(entry.product)})</span> : null}
                  </span>
                  <span className="shrink-0 font-bold text-primary-foreground">{entry.qty}×</span>
                </div>
              ))}
            </section>

            {/* Pro Kunde */}
            <section className="overflow-hidden rounded-lg border border-primary-foreground">
              <h2 className="border-b border-primary-foreground/20 px-3 py-2 text-xs font-bold tracking-wide text-primary-foreground uppercase">
                Pro Kunde ({orders.length})
              </h2>
              {orders.map((order, i) => {
                const marke = papierMarke(order.status)
                return (
                  <div
                    key={order.id}
                    className={`break-inside-avoid px-3 py-2.5 ${i !== orders.length - 1 ? 'border-b border-primary-foreground/15' : ''}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 font-semibold break-words text-primary-foreground">{order.customerName}</span>
                      <span className="shrink-0 text-xs text-primary-foreground/70">
                        {order.orderNumber} · {order.pickupTimeStart}–{order.pickupTimeEnd} Uhr
                      </span>
                    </div>
                    <div className="mt-0.5">
                      {order.items.map((item, k) => (
                        <div key={k} className="text-sm text-primary-foreground/90">
                          {/* Ein Kästchen zum Abhaken mit dem Stift — Schmuck für den Bildschirm, Zweck auf dem Papier. */}
                          <span aria-hidden="true">☐ </span>
                          {item.quantity}× {item.productName}
                          {unitSuffix(item.product) ? <> ({unitSuffix(item.product)})</> : null}
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 flex items-end justify-between gap-3">
                      <span className="text-xs text-primary-foreground/70">
                        {zahlartText(order.paymentMethod, order.paymentStatus)}
                        {/* Nur was der Hof wissen muss: Die Kundin hat noch nicht bestätigt (V57: „Wartet auf Kunde“). */}
                        {order.status === 'PENDING_CONFIRMATION' ? ` · ${marke.text}` : ''}
                      </span>
                      <PacklistenBetrag order={order} />
                    </div>
                  </div>
                )
              })}
            </section>
            {preisHinweis && <p className="text-xs text-primary-foreground/70">{preisHinweis}</p>}
          </div>
        )}

        {/* Fuß */}
        <div className="mt-4 text-xs text-primary-foreground/70">
          Gedruckt am {datumLang(jetzt)}, {uhrzeitInWien(jetzt)} Uhr · {MARKE}
        </div>
      </div>
    </div>
  )
}

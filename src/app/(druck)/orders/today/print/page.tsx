import { redirect } from 'next/navigation'
import { getFarmForUser } from '@/server/queries/dashboard'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from '@/components/orders/print-button'
import { positionszeile } from '@/lib/positionszeile'
import { barZuKassierenCents, bestellSummen, centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { uhrzeitInWien } from '@/lib/fristen'
import { HEUTE_KEINE_ABHOLUNG_PAPIER, abholtage, abholWhere, datumLang, naechsteAbholungPapier } from '@/lib/heute'
import { wienKalendertag } from '@/lib/kalender'
import { druckGesamtHinweis, papierMarke, zahlartText } from '@/lib/hof-bestellungen'
import { naechstesFensterMitZahl } from '@/server/queries/orders'
import { MARKE } from '@/lib/marke'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'

export const dynamic = 'force-dynamic'

/**
 * Rechts unter einer Bestellung (Board w2-druck): bar „Bar zu kassieren € 17,31“, online der
 * Betrag, den die Kundin gezahlt hat — derselbe wie in der Liste am Bildschirm (V57). Seit Nr. 249
 * ohne die Zeile „inkl. € … <Gebühr>“ darunter (Liste Lauf 32, druck Bild 2: das Papier zeigt nur
 * den Betrag; die Aufteilung steht auf dem Abholzettel).
 * Seit Nr. 277 (Antwort 4 der Projektleitung) steht darunter „Gesamt inkl. Plattformgebühr.“ — je
 * Bestellung und nur, wenn DIESES Gesamt die Gebühr enthält (druckGesamtHinweis, wie der Abholzettel).
 * Vorher stand „Preise inkl. Plattformgebühr.“ einmal unter der ganzen Liste, sobald eine Bestellung im
 * Hofpreis-Modell dabei war — auch über Bestellungen ohne Gebühr. NUR ANZEIGE: Betrag und Rechnung bleiben.
 */
function PacklistenBetrag({
  order,
}: {
  order: {
    paymentMethod: string
    totalAmount: { toString(): string }
    serviceFeeCents: number
    serviceFeeRefundedAt: Date | string | null
    gebuehrModell: string | null
  }
}) {
  const summen = bestellSummen(order)
  const kassieren = barZuKassierenCents(order)
  const gesamtHinweis = druckGesamtHinweis(order)
  return (
    <span className="shrink-0 text-right">
      <span className="block text-sm font-bold text-primary-foreground">
        {kassieren !== null ? `Bar zu kassieren ${formatEuro(centsAlsEuro(kassieren))}` : formatEuro(centsAlsEuro(summen.gesamtCents))}
      </span>
      {gesamtHinweis && <span className="block text-[13px] text-primary-foreground/70">{gesamtHinweis}</span>}
    </span>
  )
}

type PacklistenPosition = {
  productName: string
  quantity: number
  product: { unit: string; unitSize: { toString(): string } | null } | null
}

function zeileVon(item: PacklistenPosition): ReturnType<typeof positionszeile> {
  return positionszeile({ name: item.productName, quantity: item.quantity, unit: item.product?.unit ?? null, unitSize: item.product?.unitSize ?? null })
}

/** „**4** × Heumilch frisch (1 L)“ — Positionszeile G14, die Anzahl fett vorn wie auf der Bestellseite. */
function PositionsText({ item }: { item: PacklistenPosition }) {
  const zeile = zeileVon(item)
  return (
    <>
      <span className="font-bold text-primary-foreground">{zeile.anzahl}</span> × {zeile.name}
      {zeile.gebinde && <> ({zeile.gebinde})</>}
    </>
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
  // Aggregate pack list (Schlüssel: Produktname; Einheit fürs Suffix gemerkt)
  // Das Gebinde schreibt die Positionszeile (G14) — dieselben Einheiten wie die Bestellseite („1 L“, „6 Pakete“).
  const packList = new Map<string, { qty: number; gebinde: string | null }>()
  for (const order of orders) {
    for (const item of order.items) {
      const entry = packList.get(item.productName)
      packList.set(item.productName, {
        qty: (entry?.qty ?? 0) + item.quantity,
        gebinde: entry ? entry.gebinde : zeileVon(item).gebinde,
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
        <PrintButton zweit={orders.length === 0} />
      </div>

      {/* Blatt wie im Board w2-druck: Inhalt rund 650 px breit. */}
      <div className="mx-auto max-w-[746px] px-4 py-6 md:px-12 md:py-12">
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
            <section className="overflow-hidden rounded-md border border-primary-foreground">
              <h2 className="border-b border-primary-foreground/20 px-3 py-2 text-[13px] font-bold tracking-wide text-primary-foreground uppercase">
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
                    {entry.gebinde ? <span className="text-primary-foreground/70"> ({entry.gebinde})</span> : null}
                  </span>
                  <span className="shrink-0 font-bold text-primary-foreground">{entry.qty}×</span>
                </div>
              ))}
            </section>

            {/* Pro Kunde */}
            <section className="overflow-hidden rounded-md border border-primary-foreground">
              <h2 className="border-b border-primary-foreground/20 px-3 py-2 text-[13px] font-bold tracking-wide text-primary-foreground uppercase">
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
                      <span className="shrink-0 text-sm text-primary-foreground/70">
                        {order.orderNumber} · {order.pickupTimeStart}–{order.pickupTimeEnd} Uhr
                      </span>
                    </div>
                    <div className="mt-0.5">
                      {order.items.map((item, k) => (
                        <div key={k} className="text-sm text-primary-foreground/90">
                          {/* Ein Kästchen zum Abhaken mit dem Stift — Schmuck für den Bildschirm, Zweck auf dem Papier. */}
                          <span aria-hidden="true">☐ </span>
                          <PositionsText item={item} />
                        </div>
                      ))}
                    </div>
                    {/* Zahlart links, Betrag rechts in derselben Zeile (Board w2-druck); ein Zusatz darunter rechts. */}
                    <div className="mt-1 flex items-start justify-between gap-3">
                      <span className="text-sm text-primary-foreground/80">
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
          </div>
        )}

        {/* Fuß — nur auf einer Packliste mit Bestellungen (Board s2-druck Bild 3: der Leerzustand ohne Fuß). */}
        {orders.length > 0 && (
          <div className="mt-4 text-sm text-primary-foreground/70">
            Gedruckt am {datumLang(jetzt)}, {uhrzeitInWien(jetzt)} Uhr · {MARKE}
          </div>
        )}
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { widerrufLinkGilt } from '@/lib/bestell-link'
import { hofSichtbar } from '@/lib/hof-sichtbar'
import { formatPosition } from '@/lib/format'
import { MARKE } from '@/lib/marke'
import { BELEHRUNG, WIDERRUF_TEXT, ausnahmeHinweis, widerrufMoeglich } from '@/lib/widerruf'
import { AgbStuecke } from '@/components/rechtstexte/agb-stuecke'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'
import { WiderrufFormular, type WiderrufBestellAnsicht } from './widerruf-formular'

// Private Seite (signierter Link) — nie in Suchmaschinen, und die Adresse mit
// der Signatur geht nie als Referrer an fremde Seiten (Freigabe 200 Punkt 1).
export const metadata: Metadata = {
  title: `${WIDERRUF_TEXT.titel} — ${MARKE}`,
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export const dynamic = 'force-dynamic'

/*
 * /widerruf (Nr. 200, Register N39, § 13a FAGG): der Widerruf online, ohne
 * Anmeldung, in zwei Schritten („Vertrag widerrufen“ → Zusammenfassung →
 * „Widerruf bestätigen“).
 *  - Mit signiertem Link (?bestellung=…&sig=…, Zweck `widerruf`): die
 *    Bestellung gekürzt, die Positionen zum Ankreuzen mit dem Hinweis je
 *    Kategorie. Eine falsche Signatur ergibt 404 — vor jeder Abfrage.
 *  - Ohne Link (Fuß, direkt): Name, E-Mail, Bestellnummer, „ganze Bestellung“
 *    oder Freitext. Die Seite verrät nie, ob es eine Bestellung gibt.
 * Darunter die Rücktrittsbelehrung — Platzhalter, bis der Wortlaut aus dem RIS
 * übernommen ist (src/lib/widerruf.ts, Kopfkommentar).
 * Keine Mockups in Lauf 27: Aufbau nach DESIGN_SYSTEM (Karte, Felder 16 px,
 * Knöpfe 44 px), in der KundeShell mit Seitenfuß.
 */
export default async function WiderrufPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const bestellung = typeof params.bestellung === 'string' ? params.bestellung : null
  const sig = typeof params.sig === 'string' ? params.sig : null

  let ansicht: WiderrufBestellAnsicht | null = null
  let nichtMehr = false
  if (bestellung !== null || sig !== null) {
    // Signatur ZUERST — eine falsche löst keine Abfrage aus.
    if (!bestellung || !sig || !widerrufLinkGilt(bestellung, sig)) notFound()
    const order = await prisma.order.findUnique({
      where: { id: bestellung },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        kaeuferArt: true,
        status: true,
        pickedUpAt: true,
        farm: { select: { name: true, address: true, postalCode: true, city: true, archivedAt: true, geschlossenAm: true } },
        items: {
          select: { id: true, productName: true, quantity: true, fehltSeit: true, product: { select: { category: true, unit: true, unitSize: true } } },
        },
      },
    })
    if (!order) notFound()
    nichtMehr = !widerrufMoeglich(order, new Date())
    ansicht = {
      bestellung,
      sig,
      bestellnummer: order.orderNumber,
      name: order.customerName,
      // Der Vertragspartner: der Hof, bei dem bestellt wurde (Name und Anschrift).
      hof: hofSichtbar(order.farm) ? `${order.farm.name}, ${order.farm.address}, ${order.farm.postalCode} ${order.farm.city}` : order.farm.name,
      positionen: order.items
        .filter((i) => !i.fehltSeit)
        .map((i) => ({
          id: i.id,
          text: formatPosition({ name: i.productName, quantity: i.quantity, unit: i.product?.unit ?? null, unitSize: i.product?.unitSize ?? null }),
          hinweis: ausnahmeHinweis(i.product?.category ?? 'SONSTIGES'),
        })),
    }
  }

  return (
    <KundeShellMitSitzung>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 pt-8 pb-12 md:pt-10 print:pt-0">
        <div className="flex flex-col gap-1.5 print:hidden">
          <h1 className="font-heading text-[26px] leading-tight font-semibold text-foreground md:text-[28px]">{WIDERRUF_TEXT.titel}</h1>
          <p className="text-[14.5px] leading-normal text-muted-foreground">{WIDERRUF_TEXT.einleitung}</p>
        </div>

        {nichtMehr ? (
          <Hinweiskarte ton="orange">{WIDERRUF_TEXT.nichtMehr}</Hinweiskarte>
        ) : (
          <WiderrufFormular bestellung={ansicht} />
        )}

        <section aria-labelledby="belehrung-titel" className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px] print:hidden">
          <h2 id="belehrung-titel" className="font-heading text-[18px] font-semibold text-foreground">
            {WIDERRUF_TEXT.belehrungTitel}
          </h2>
          {/* PLATZHALTER (Freigabe 200, „Ohne Zugang zum RIS: STOPP für die Belehrung“): kein Wortlaut aus dem Gedächtnis. */}
          <p className="text-[14px] leading-normal text-muted-foreground">{BELEHRUNG.vermerk}</p>
          <p className="text-[14px] leading-normal text-muted-foreground">
            <AgbStuecke
              stuecke={BELEHRUNG.agbHinweis}
              linkKlasse={cn('rounded-sm font-semibold text-brand-text underline underline-offset-2', FOKUS_RAHMEN)}
            />
          </p>
          <h3 className="mt-2 text-[15px] font-semibold text-foreground">{WIDERRUF_TEXT.formularTitel}</h3>
          <p className="text-[14px] leading-normal text-muted-foreground">{BELEHRUNG.vermerk}</p>
        </section>
      </div>
    </KundeShellMitSitzung>
  )
}

'use client'

import Image from 'next/image'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Building2, Leaf, Package, ShoppingBasket, Snowflake, Thermometer } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from '@/components/ui/accordion'
import { GrundpreisZeile } from '@/components/shared/grundpreis-zeile'
import { formatGrundpreis, formatGrundpreisNetto } from '@/lib/format'
import { kennzeichnungsZeilen, zeigeKaufknopf } from '@/lib/bereiche-anzeige'
import { KATEGORIE_LABEL, SIEGEL, UNTERKATEGORIE_LABEL } from '@/lib/taxonomie'
import { seasonLabel } from '@/schemas/product'
import { SHOP_PAUSED_BUTTON_LABEL } from '@/lib/shop-pause'
import type { PublicProduct } from '@/server/queries/farm'

export type HofFuerDetail = { name: string; address: string; postalCode: string; city: string }

/** Kleine runde Marke für Kategorie und Sorte. */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}

/**
 * Das Produktdetail der Hofseite (Sprint Bereiche 2; seit Nr. 10 nur noch in
 * der Kundenansicht im neuen Design — Farben aus den Tokens des Design-Systems,
 * Siegel grün, „Nur an Betriebe" orange) — für JEDES Produkt:
 * Vor Bereiche 2 pflegten die Höfe eine Kurzbeschreibung, die nirgends
 * erschien. Futtermittel zeigen zusätzlich die Kennzeichnung, zugeklappt, mit
 * allen Pflichtangaben (Fernabsatz: einsehbar VOR dem Kauf), und den Hinweis
 * „Nur an Betriebe", wenn der Hof die Abgabe beschränkt.
 *
 * Kauft über denselben Weg wie die Karte (onAddToCart) — der Warenkorb bleibt
 * EINER für beide Bereiche.
 */
export function ProduktDetail({
  produkt,
  hof,
  offen,
  onOpenChange,
  onAddToCart,
  wirdHinzugefuegt,
  isPaused,
}: {
  produkt: PublicProduct | null
  hof: HofFuerDetail
  offen: boolean
  onOpenChange: (offen: boolean) => void
  onAddToCart: (produkt: PublicProduct) => void
  wirdHinzugefuegt: boolean
  isPaused: boolean
}) {
  return (
    <Sheet open={offen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-t-2xl p-0"
      >
        {produkt && <Inhalt produkt={produkt} hof={hof} onAddToCart={onAddToCart} wirdHinzugefuegt={wirdHinzugefuegt} isPaused={isPaused} />}
      </SheetContent>
    </Sheet>
  )
}

function Inhalt({
  produkt,
  hof,
  onAddToCart,
  wirdHinzugefuegt,
  isPaused,
}: {
  produkt: PublicProduct
  hof: HofFuerDetail
  onAddToCart: (produkt: PublicProduct) => void
  wirdHinzugefuegt: boolean
  isPaused: boolean
}) {
  const bild = produkt.imageUrl ?? produkt.categoryImageUrl
  const kannKaufen = zeigeKaufknopf(produkt, isPaused)
  const futter = produkt.futter
  const kilopreis = futter ? formatGrundpreisNetto(produkt.price, futter.nettoMenge, futter.nettoEinheit) : null

  return (
    <>
      {/* Scrollt als Flex-Kind mit min-h-0 — sonst wächst er auf Inhaltshöhe
          und der Kaufknopf rutscht aus dem Sheet (DEVELOPMENT.md, Dialoge). */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative h-48 bg-muted">
          {bild ? (
            <Image
              src={bild}
              alt={produkt.name}
              fill
              sizes="(min-width: 640px) 512px, 100vw"
              // Nur die Kategorie-Illustration wird im Dunkeln gedämpft (CODING_STANDARDS §7); Fotos bleiben.
              className={produkt.imageUrl ? 'object-contain' : 'object-contain dark:brightness-[0.85] dark:saturate-[0.9]'}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="size-10 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            </div>
          )}
        </div>

        <SheetHeader className="gap-2 px-5 pt-4 pb-0">
          {produkt.category && (
            <div className="flex flex-wrap gap-1.5">
              <Pill>{KATEGORIE_LABEL[produkt.category]}</Pill>
              {produkt.subcategory && <Pill>{UNTERKATEGORIE_LABEL[produkt.subcategory]}</Pill>}
            </div>
          )}
          <SheetTitle className="font-heading text-xl font-semibold leading-snug">{produkt.name}</SheetTitle>
          <SheetDescription render={<div />} className="space-y-0.5">
            <span className="block text-lg font-bold text-foreground">
              {formatGrundpreis(produkt.price, produkt.unit, produkt.unitSize)}
            </span>
            {kilopreis ? (
              <span className="block text-sm text-muted-foreground">{kilopreis}</span>
            ) : (
              <GrundpreisZeile price={produkt.price} unit={produkt.unit} unitSize={produkt.unitSize} className="text-sm" />
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-5 pt-3 pb-5">
          {(produkt.labels.length > 0 || produkt.abgabe === 'NUR_BETRIEBE') && (
            <div className="flex flex-wrap gap-1.5">
              {produkt.labels.map((l) => (
                <span
                  key={l}
                  className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent/18 px-2.5 py-0.5 text-xs font-semibold text-status-fertig"
                >
                  {l === 'BIO' && <Leaf className="size-3" aria-hidden="true" />}
                  {SIEGEL[l].name}
                </span>
              ))}
              {produkt.abgabe === 'NUR_BETRIEBE' && (
                <span className="inline-flex items-center gap-1 rounded-md border border-primary/45 bg-primary/14 px-2.5 py-0.5 text-xs font-semibold text-status-offen">
                  <Building2 className="size-3" aria-hidden="true" />
                  Nur an Betriebe
                </span>
              )}
            </div>
          )}

          {produkt.abgabe === 'NUR_BETRIEBE' && (
            <p className="text-sm text-muted-foreground">
              Dieses Futtermittel gibt der Hof nur an landwirtschaftliche Betriebe ab. Beim Bestellen fragen wir nach
              deiner Betriebsnummer.
            </p>
          )}

          {produkt.description?.trim() && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{produkt.description.trim()}</p>
          )}

          {(produkt.seasonStart && produkt.seasonEnd) || produkt.requiresCool || produkt.requiresFreezer ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {produkt.seasonStart && produkt.seasonEnd && (
                <li className="flex items-center gap-2">
                  <Leaf className="size-4 shrink-0" aria-hidden="true" />
                  {seasonLabel(produkt.seasonStart, produkt.seasonEnd)}
                </li>
              )}
              {produkt.requiresCool && (
                <li className="flex items-center gap-2">
                  <Thermometer className="size-4 shrink-0" aria-hidden="true" />
                  Bitte gekühlt lagern
                </li>
              )}
              {produkt.requiresFreezer && (
                <li className="flex items-center gap-2">
                  <Snowflake className="size-4 shrink-0" aria-hidden="true" />
                  Tiefgekühlt
                </li>
              )}
            </ul>
          ) : null}

          {produkt.allergens.length > 0 && (
            <p className="text-sm text-muted-foreground">Enthält: {produkt.allergens.join(', ')}</p>
          )}

          {futter && (
            // Zugeklappt: Die Angaben müssen einsehbar sein, nicht im Weg.
            <Accordion className="rounded-xl border border-border px-4">
              <AccordionItem value="kennzeichnung" className="border-b-0">
                <AccordionTrigger className="min-h-11">Kennzeichnung</AccordionTrigger>
                <AccordionPanel>
                  <dl className="space-y-2.5 pb-2 text-sm">
                    {kennzeichnungsZeilen(futter, hof).map((z) => (
                      <div key={z.titel}>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{z.titel}</dt>
                        <dd className="whitespace-pre-line text-foreground">{z.wert}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="pb-2 text-xs text-muted-foreground">
                    Vom Hof bestätigt am {format(new Date(futter.bestaetigtAm), 'd. MMMM yyyy', { locale: de })}.
                    Charge und Mindesthaltbarkeit stehen auf dem Sackanhänger.
                  </p>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-popover px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {kannKaufen ? (
          <button
            type="button"
            onClick={() => onAddToCart(produkt)}
            disabled={wirdHinzugefuegt}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <ShoppingBasket className="size-4" strokeWidth={1.7} aria-hidden="true" />
            In den Korb
          </button>
        ) : (
          <p className="flex min-h-11 items-center justify-center rounded-lg bg-muted px-3 text-center text-sm text-muted-foreground">
            {isPaused
              ? SHOP_PAUSED_BUTTON_LABEL
              : !produkt.isAvailable
                ? produkt.unavailableReason || 'Nicht verfügbar'
                : 'Ausverkauft'}
          </p>
        )}
      </div>
    </>
  )
}

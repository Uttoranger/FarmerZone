'use client'

import Image from 'next/image'
import { Plus } from 'lucide-react'
import type { PublicProduct } from '@/server/queries/farm'
import { formatGrundpreis, formatGrundpreisNetto, formatGrundpreisZeile } from '@/lib/format'
import { knappText, type KartenZustand } from '@/lib/bereiche-anzeige'
import { produktInitiale } from '@/lib/hofuebersicht'
import { SHOP_PAUSED_BUTTON_LABEL } from '@/lib/shop-pause'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { StatusBadge } from '@/components/ui/status-badge'
import { Stepper } from '@/components/ui/stepper'

/** Die zweite Preiszeile: Kilopreis aus der Nettomenge bei Futter, sonst der Grundpreis — null bei Stück und Paket. */
function zweitePreiszeile(p: PublicProduct): string | null {
  if (p.futter) return formatGrundpreisNetto(p.price, p.futter.nettoMenge, p.futter.nettoEinheit)
  return formatGrundpreisZeile(p.price, p.unit, p.unitSize)
}

/** Die erste Zeile der Beschreibung als Unterzeile der Karte — der Rest steht im Produktdetail. */
function kurzbeschreibung(p: PublicProduct): string | null {
  const zeile = p.description?.trim().split('\n')[0]?.trim()
  return zeile ? zeile : null
}

function Preis({ produkt, className }: { produkt: PublicProduct; className?: string }) {
  const zweite = zweitePreiszeile(produkt)
  return (
    <span className={cn('flex min-w-0 flex-col', className)}>
      <span className="text-[15px] font-semibold text-foreground md:text-base">
        {formatGrundpreis(produkt.price, produkt.unit, produkt.unitSize)}
      </span>
      {zweite && <span className="text-xs text-muted-foreground">{zweite}</span>}
    </span>
  )
}

/**
 * Eine Produktkarte der Hofseite (Mockups web-k2-alle-produkte-nach-kategorie
 * und mobil-k2-produkte): am Handy eine Zeile mit Bild, Name, Preis und
 * Plus-Knopf, ab 768 px eine Kachel mit Bild oben und „In den Korb" rechts
 * neben dem Preis. Liegt das Produkt schon im Korb, steht dort die Menge mit
 * − und +.
 *
 * Bild und Name öffnen das bestehende Produktdetail (ein Knopf, kein Link —
 * die Produktseite kommt mit Nr. 11). Den Zustand (knapp, ausverkauft,
 * pausiert) entscheidet kartenZustand, die Karte zeigt ihn nur: knapp als
 * orangene Marke „Nur noch …", ausverkauft ausgegraut — nie über opacity auf
 * Text (Kontrast). Ohne „Merken" (E8, S11).
 */
export function ProduktKarte({
  produkt,
  zustand,
  imKorb,
  wirdHinzugefuegt,
  onDetails,
  onInDenKorb,
  onMenge,
}: {
  produkt: PublicProduct
  zustand: KartenZustand
  /** Menge dieses Produkts im Korb — 0, wenn keins drin liegt. */
  imKorb: number
  wirdHinzugefuegt: boolean
  onDetails: (p: PublicProduct) => void
  onInDenKorb: (p: PublicProduct) => void
  onMenge: (p: PublicProduct, menge: number) => void
}): React.JSX.Element {
  const bild = produkt.imageUrl ?? produkt.categoryImageUrl
  const kurz = kurzbeschreibung(produkt)
  const kaufbar = zustand.art === 'kaufbar' || zustand.art === 'knapp'
  const ausverkauft = zustand.art === 'ausverkauft'
  const marke =
    zustand.art === 'knapp' ? (
      <StatusBadge status="offen">{knappText(zustand.bestand, produkt.unit, produkt.unitSize)}</StatusBadge>
    ) : ausverkauft ? (
      <StatusBadge status="neutral">Ausverkauft</StatusBadge>
    ) : null

  return (
    <article className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 md:h-full md:flex-col md:items-stretch md:gap-0 md:overflow-hidden md:p-0">
      <button
        type="button"
        onClick={() => onDetails(produkt)}
        aria-label={`${produkt.name} – Details ansehen`}
        title={produkt.name}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left md:flex-none md:flex-col md:items-stretch md:gap-0 md:rounded-none',
          FOKUS_RAHMEN,
          'md:focus-visible:-outline-offset-2'
        )}
      >
        <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted md:h-[140px] md:w-full md:rounded-none">
          {bild ? (
            <Image
              src={bild}
              alt=""
              fill
              sizes="(min-width: 1280px) 260px, (min-width: 768px) 33vw, 64px"
              className={cn(
                produkt.imageUrl ? 'object-cover' : 'object-contain p-1 dark:brightness-[0.85] dark:saturate-[0.9]',
                ausverkauft && 'grayscale'
              )}
            />
          ) : (
            <span aria-hidden="true" className="font-heading text-xl font-semibold text-brand-text">
              {produktInitiale(produkt.name)}
            </span>
          )}
          {marke && <span className="absolute top-2.5 left-2.5 hidden md:block">{marke}</span>}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:px-3.5 md:pt-3">
          <span className="line-clamp-2 text-[15px] font-semibold break-words text-foreground">{produkt.name}</span>
          {kurz && <span className="truncate text-[13px] text-muted-foreground">{kurz}</span>}
          <Preis produkt={produkt} className="md:hidden" />
          {/* Am Handy nur „knapp" als Marke — „Ausverkauft" steht schon rechts, wo sonst der Knopf ist. */}
          {zustand.art === 'knapp' && <span className="mt-0.5 md:hidden">{marke}</span>}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-2 md:mt-auto md:px-3.5 md:pt-2 md:pb-3.5">
        <Preis produkt={produkt} className="hidden flex-1 md:flex" />
        {kaufbar && imKorb > 0 ? (
          <Stepper beschriftung={`Menge ${produkt.name}`} wert={imKorb} onWertChange={(menge) => onMenge(produkt, menge)} />
        ) : kaufbar ? (
          <button
            type="button"
            onClick={() => onInDenKorb(produkt)}
            disabled={wirdHinzugefuegt}
            aria-label={`${produkt.name} in den Korb legen`}
            className={cn(
              "relative inline-flex size-11 items-center justify-center gap-1.5 rounded-full bg-accent text-accent-foreground transition-opacity duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:opacity-90 disabled:opacity-60 md:h-9 md:w-auto md:px-3.5 md:text-[12.5px] md:font-semibold",
              FOKUS_RAHMEN
            )}
          >
            <Plus className="size-5 md:size-4" strokeWidth={1.7} aria-hidden="true" />
            <span className="hidden md:inline">{wirdHinzugefuegt ? 'Einen Moment …' : 'In den Korb'}</span>
          </button>
        ) : (
          <span className="max-w-32 rounded-full bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground md:max-w-none">
            {zustand.art === 'pausiert'
              ? SHOP_PAUSED_BUTTON_LABEL
              : zustand.art === 'nicht-verfuegbar'
                ? zustand.grund
                : 'Ausverkauft'}
          </span>
        )}
      </div>
    </article>
  )
}

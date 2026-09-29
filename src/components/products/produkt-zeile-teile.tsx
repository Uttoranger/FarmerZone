'use client'

import { Menu } from '@base-ui/react/menu'
import { Minus, MoreHorizontal, Package, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Schild } from '@/components/farmer/schild'
import { kannVerringern, zeilenChips } from '@/lib/produkt-zeile'
import { cn } from '@/lib/utils'
import type { ProductData } from '@/server/queries/products'

/*
 * Die Teile einer Produktzeile — gemeinsam für die Karte am Handy und die
 * Tabellenzeile ab lg, damit beide dasselbe tun und dieselben Wörter tragen.
 * Was angezeigt wird, entscheidet src/lib/produkt-zeile.ts.
 *
 * Die ganze Zeile öffnet die Bearbeitung. In der Karte ist der Produktname ein
 * Knopf, dessen ::after die Karte überdeckt (relative an der Karte); alles
 * Bedienbare darüber liegt mit `relative z-10` auf dieser Fläche — EIN
 * Tastatur-Ziel je Handlung, kein Klick-Handler, der auch Tipps aus dem
 * Menü-Portal mitbekäme (React reicht Ereignisse durch Portale). In der
 * Tabelle nimmt die Zeile den Klick selbst (siehe product-list.tsx).
 */

export const UEBER_ZEILE = 'relative z-10'

const FOKUS = 'outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

/** Der Name als Knopf über die ganze Zeile. */
export function ZeilenName({
  name,
  onOeffnen,
  ueberdeckt = true,
  className,
}: {
  name: string
  onOeffnen: () => void
  /** false in der Tabelle — dort nimmt die Zeile den Klick selbst (product-list.tsx). */
  ueberdeckt?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOeffnen}
      className={cn(
        'text-left font-medium text-app-ink leading-snug break-words rounded-sm',
        ueberdeckt && 'after:absolute after:inset-0 after:content-[""]',
        FOKUS,
        className
      )}
    >
      {name}
      <span className="sr-only"> bearbeiten</span>
    </button>
  )
}

export function ZeilenChips({ product, className }: { product: ProductData; className?: string }): React.JSX.Element | null {
  const chips = zeilenChips(product)
  if (chips.length === 0) return null
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {chips.map((c) => (
        <Schild key={c.text} farbe={c.farbe}>
          {c.text}
        </Schild>
      ))}
    </div>
  )
}

export function ProduktBild({ product, className }: { product: ProductData; className?: string }): React.JSX.Element {
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center overflow-hidden bg-muted', className)}
      style={product.categoryImageUrl && !product.imageUrl ? { background: 'var(--app-chip)' } : undefined}
    >
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : product.categoryImageUrl ? (
        // Kategorie-Illustration: im Dunkeln gedämpft, sonst leuchtet ihr
        // Crème-Grund als Fläche (CODING_STANDARDS §7).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.categoryImageUrl}
          alt=""
          className="h-full w-full object-contain dark:brightness-[0.85] dark:saturate-[0.9]"
        />
      ) : (
        <Package className="size-6 text-muted-foreground/50" aria-hidden="true" />
      )}
    </div>
  )
}

/**
 * „− 53 +": ein Tipp ±1, ein Tipp auf die Zahl öffnet das Feld zum Eintippen
 * (StockDialog mit +5/+10/+20). „−" ist bei 0 gesperrt — nie unter 0.
 */
export function BestandStepper({
  name,
  bestand,
  laeuft,
  onSchritt,
  onEintippen,
}: {
  name: string
  bestand: number
  laeuft: boolean
  onSchritt: (delta: 1 | -1) => void
  onEintippen: () => void
}): React.JSX.Element {
  const knopf = cn(
    'flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-app-ink transition-colors hover:bg-muted/60 disabled:opacity-40 disabled:hover:bg-card',
    FOKUS
  )
  return (
    <div className={cn(UEBER_ZEILE, 'inline-flex items-center gap-1')} role="group" aria-label={`Bestand ${name}`}>
      <button
        type="button"
        className={knopf}
        disabled={laeuft || !kannVerringern(bestand)}
        onClick={() => onSchritt(-1)}
        aria-label={`Bestand von ${name} um eins verringern`}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onEintippen}
        className={cn(
          'min-h-11 min-w-12 rounded-lg px-2 text-center text-base font-semibold tabular-nums text-app-ink underline decoration-dotted decoration-app-ink-faint underline-offset-4 hover:bg-muted/60',
          laeuft && 'text-app-ink-soft',
          FOKUS
        )}
        aria-label={`Bestand von ${name}: ${bestand}. Zahl eintippen`}
      >
        {bestand}
      </button>
      <button
        type="button"
        className={knopf}
        disabled={laeuft}
        onClick={() => onSchritt(1)}
        aria-label={`Bestand von ${name} um eins erhöhen`}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * Das „⋯"-Menü. Löschen steht nur hier, rot, und fragt danach noch einmal
 * nach (Dialog in der Liste) — nie offen in der Zeile, wo ein Daumen es beim
 * Scrollen trifft. „Duplizieren" gibt es nicht, weil es die Aktion nicht gibt.
 */
export function ZeilenMenue({
  name,
  onBestand,
  onLoeschen,
}: {
  name: string
  onBestand: () => void
  onLoeschen: () => void
}): React.JSX.Element {
  const eintrag =
    'flex min-h-11 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none data-[highlighted]:bg-muted'
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          UEBER_ZEILE,
          'flex size-11 shrink-0 items-center justify-center rounded-lg text-app-ink-soft transition-colors hover:bg-muted/60 hover:text-app-ink data-[popup-open]:bg-muted',
          FOKUS
        )}
        aria-label={`Weitere Aktionen für ${name}`}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
          <Menu.Popup className="w-56 origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 dark:ring-1 dark:ring-border">
            <Menu.Item onClick={onBestand} className={cn(eintrag, 'text-app-ink')}>
              <SlidersHorizontal className="size-4 text-app-ink-soft" aria-hidden="true" />
              Bestand anpassen
            </Menu.Item>
            <div className="my-1 h-px bg-border" aria-hidden="true" />
            <Menu.Item
              onClick={onLoeschen}
              className={cn(eintrag, 'text-destructive data-[highlighted]:bg-destructive/10')}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Löschen …
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

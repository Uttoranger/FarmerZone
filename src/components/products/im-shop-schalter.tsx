'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { produktSichtbarkeitSetzen } from '@/server/actions/products'
import { IM_SHOP, umschaltMeldung } from '@/lib/produkt-sichtbarkeit'
import { cn } from '@/lib/utils'

/**
 * Der Schalter „Im Shop" — ein Tipp blendet ein Produkt aus oder ein.
 *
 * EINE Komponente für zwei Orte: die Produktkarte im Bearbeitungsmodus von
 * „Meine Hof-Seite" (Variante `zeile`) und die Produktliste (Variante
 * `kompakt`). Beide teilen das Verhalten, nicht nur das Aussehen — Aufruf,
 * Rückgängig und die Meldungen liegen hier, nicht zweimal in den Oberflächen.
 *
 * WARUM NICHT `src/components/ui/switch.tsx`: Dessen Base-UI-`Root` IST die
 * Schiene. Hier soll die ganze Zeile die Tippfläche sein (44 px hoch, in der
 * Liste 56 × 56) — dafür muss der Knopf die Zeile sein und die Schiene ein
 * gezeichnetes Kind. Ein Base-UI-Switch in einem Knopf wären zwei verschachtelte
 * Bedienelemente; der Schieber lief außerdem über die ganze Zeilenbreite. Die
 * Farben sind bewusst dieselben Tokens wie dort, damit nicht zwei Grüntöne
 * entstehen.
 *
 * KEINE RÜCKFRAGE VOR DEM UMSCHALTEN. Ausblenden ist nichts Endgültiges: Der
 * Toast hält sechs Sekunden „Rückgängig" bereit (wie die Bestell-Aktionen,
 * src/components/orders/order-card.tsx). Eine Rückfrage vor jedem Tipp würde
 * den Schalter unbrauchbar machen — man schaltet damit zwanzig Produkte durch.
 */

type Props = {
  productId: string
  /** Für die Vorlesehilfe und den Toast — das Produkt muss beim Namen genannt werden. */
  name: string
  imShop: boolean
  /**
   * Setzt den vorgezogenen Zustand im Eltern-Bauteil (dessen
   * `useOptimistic`-Dispatch). Wird INNERHALB der Transition hier gerufen,
   * damit React den Wert hält, bis die Aktion durch ist.
   */
  setzeOptimistisch: (imShop: boolean) => void
  variante?: 'zeile' | 'kompakt'
  className?: string
}

export function ImShopSchalter({
  productId,
  name,
  imShop,
  setzeOptimistisch,
  variante = 'zeile',
  className,
}: Props) {
  const [laeuft, startTransition] = useTransition()

  function umschalten(nach: boolean) {
    startTransition(async () => {
      setzeOptimistisch(nach)
      const ergebnis = await produktSichtbarkeitSetzen({ productId, imShop: nach })

      if ('error' in ergebnis) {
        // KEIN Zurückschalten von Hand: `useOptimistic` fällt beim Ende der
        // Transition von selbst auf den Stand des Servers zurück. Der blieb
        // unverändert, weil nichts geschrieben wurde — genau das ist der
        // Rückweg. Ein eigenes Zurücksetzen wäre eine zweite Wahrheit.
        toast.error('Das hat nicht geklappt. Bitte nochmal.')
        return
      }

      toast.success(umschaltMeldung(name, nach), {
        duration: 6000,
        action: {
          label: 'Rückgängig',
          onClick: () => umschalten(!nach),
        },
      })
    })
  }

  const schmal = variante === 'kompakt'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={imShop}
      // Immer dieselbe Beschriftung, egal wie der Schalter steht: Den Zustand
      // liest die Vorlesehilfe aus aria-checked. Ein mitwandernder Text („… aus
      // dem Shop nehmen") würde beim Umschalten die Bedeutung von aria-checked
      // doppelt und widersprüchlich erzählen.
      aria-label={`${name} im Shop zeigen`}
      disabled={laeuft}
      onClick={() => umschalten(!imShop)}
      className={cn(
        'flex shrink-0 items-center rounded-lg transition-colors disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        schmal
          ? // Produktliste: nur die Schiene, aber 56 × 56 als Tippfläche.
            'size-14 justify-center'
          : // Produktkarte: die ganze Zeile, Text links, Schiene rechts.
            'min-h-11 w-full justify-between gap-3 px-1 hover:bg-muted/30',
        className
      )}
    >
      {!schmal && (
        <span className="text-[13px] font-semibold" style={{ color: 'var(--app-ink-soft)' }}>
          {IM_SHOP}
        </span>
      )}
      {/* Die Schiene. 44 × 26 px, damit sie auch am Daumen eines Handschuhs
          noch zu treffen ist — in der kompakten Variante ist die Tippfläche
          darum herum größer als das Bild. */}
      <span
        aria-hidden="true"
        className={cn(
          'relative block h-[26px] w-11 shrink-0 rounded-full transition-colors',
          imShop ? 'bg-primary' : 'bg-muted-foreground/30'
        )}
      >
        {/* Weiß in beiden Modi — wie in ui/switch.tsx: Der Schieber liegt auf
            heller wie auf dunkler Schiene, ein Token verschwände auf einer.
            Die Haarlinie ist nicht Zierde: Weiß auf der grauen Aus-Schiene
            kommt auf 1,5:1, und der Schieber IST die Zustandsanzeige (§7
            verlangt 3:1 für Symbole). Mit Rand ist die Kante sichtbar. */}
        <span
          className={cn(
            'absolute top-1/2 block size-[22px] -translate-y-1/2 rounded-full bg-white shadow ring-1 ring-black/15 transition-transform',
            imShop ? 'translate-x-[20px]' : 'translate-x-0.5'
          )}
        />
      </span>
    </button>
  )
}

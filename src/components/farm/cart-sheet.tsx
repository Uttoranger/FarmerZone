'use client'

import type { ComponentProps } from 'react'
import { Info, Minus, Plus, Trash2, ShoppingBasket } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { cn } from '@/lib/utils'
import { centsAlsEuro, formatEuro, formatGrundpreis } from '@/lib/format'
import { korbBetraege } from '@/lib/hofseite-kunde'
import { RESERVIERUNG_MINUTEN } from '@/lib/kasse'
import { GrundpreisZeile } from '@/components/shared/grundpreis-zeile'
import { FutterVerantwortung } from '@/components/shared/futter-verantwortung'
import { KaufSperreHinweis } from '@/components/hofseite/kauf-sperre-hinweis'
import type { CartItem } from '@/lib/use-cart'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CartItem[]
  total: number
  farmSlug: string
  /** Adresse von „Zur Kasse" — die Produktseite gibt `?kaeufer=betrieb` mit (Nr. 29); sonst die Kasse des Hofs. */
  kasseHref?: string
  onUpdateQuantity: (productId: string, qty: number) => void
  onRemoveItem: (productId: string) => void
  /** „zzgl. Servicegebühr" neben der Summe — null, wenn der Hof gerade gebührenfrei ist. */
  gebuehrKorb?: string | null
  /** Verantwortungs-Hinweis, wenn Futter im Korb liegt (futterVerantwortungImKorb, E10a) — nur Anzeige. */
  futterHinweis?: readonly string[]
  /**
   * Die Kaufsperre der Seite mit Hofname und Pausen-Nachricht (kaufSperre, Register N24): Mit Sperre steht
   * statt „Zur Kasse“ der Hinweis mit dem Grund, wie im Mini-Warenkorb. Pflicht, weil das Blatt unter
   * 1024 px der einzige Weg zur Kasse ist — der Mini-Warenkorb steht dort nicht.
   */
  kaufSperre: ComponentProps<typeof KaufSperreHinweis>
  /**
   * Der Satz nach dem Abgleich der Hofseite (Register N28: entfernt, gekürzt, neuer Preis) — oben im Blatt, bis
   * sich der Korb ändert. Die Produktseite gleicht nicht ab und gibt ihn nicht mit.
   */
  hinweis?: string | null
}

/** Ein runder Mengen-Knopf: sichtbar 28 px, Trefferfläche 44 px. */
const MENGEN_KNOPF = cn(
  'flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground',
  FOKUS_RAHMEN
)

/*
 * Der Warenkorb der Hofseite als Blatt von rechts. Seit Nr. 10 steht er nur
 * noch in der Kundenansicht im neuen Design (KundeShell, data-design="neu"):
 * Kaufen ist Grün (accent), Text und Symbole aus den Tokens.
 */
export function CartSheet({ open, onOpenChange, items, total, farmSlug, kasseHref, onUpdateQuantity, onRemoveItem, gebuehrKorb = null, futterHinweis = [], kaufSperre, hinweis = null }: Props) {
  // Zeilensummen in ganzen Cent auf dem Weg des Checkouts (korbBetraege, wie im Mini-Warenkorb),
  // nie price × Menge in Fließkomma — verbindlich rechnet der Checkout mit den Preisen aus der Datenbank.
  const { zeilenCents } = korbBetraege(items)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBasket className="size-5 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
            Warenkorb
          </SheetTitle>
        </SheetHeader>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {/* Wie korbHinweis in der Kasse: orange Karte, als Status vorgelesen, kein Toast. */}
          {hinweis && (
            <div role="status">
              <Hinweiskarte ton="orange" symbol={Info}>
                {hinweis}
              </Hinweiskarte>
            </div>
          )}
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <ShoppingBasket className="mb-2 size-10" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-sm">Dein Warenkorb ist leer.</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.productId} className="flex gap-3 items-center">
                {/* Image */}
                <div className="relative shrink-0 w-14 h-14 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                  {item.imageUrl ? (
                    // 56 px breit: der Browser holt eine kleine Fassung, nicht das Original (bis 2.400 px).
                    <Image src={item.imageUrl} alt={item.name} fill sizes="56px" className="object-cover" />
                  ) : (
                    <ShoppingBasket className="size-5 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatGrundpreis(item.price, item.unit, item.unitSize)}
                  </p>
                  <GrundpreisZeile
                    price={item.price}
                    unit={item.unit}
                    unitSize={item.unitSize}
                    className="text-[11px] text-muted-foreground"
                  />
                  {/* Mit Kaufsperre lehnt /api/reserve jede neue Menge ab (Nr. 145): Dann steht die Menge nur als
                      Zahl da, Entfernen bleibt — sonst brächte jeder Tipp auf „+“ oder „−“ eine Ablehnung. */}
                  {/* Menge: sichtbar kleine Kreise, Trefferfläche 44 px */}
                  {kaufSperre.sperre !== null ? (
                    <div className="flex h-11 items-center">
                      <span className="text-sm font-medium tabular-nums" aria-label={`Menge: ${item.quantity}`}>
                        {item.quantity}
                      </span>
                    </div>
                  ) : (
                    <div className="-ml-2 flex items-center">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                        aria-label={`${item.name}: eins weniger`}
                        className={MENGEN_KNOPF}
                      >
                        <span className="flex size-7 items-center justify-center rounded-full border border-border">
                          <Minus className="size-3" aria-hidden="true" />
                        </span>
                      </button>
                      <span className="w-5 text-center text-sm font-medium tabular-nums" aria-label={`Menge: ${item.quantity}`}>
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                        aria-label={`${item.name}: eins mehr`}
                        className={MENGEN_KNOPF}
                      >
                        <span className="flex size-7 items-center justify-center rounded-full border border-border">
                          <Plus className="size-3" aria-hidden="true" />
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Line total + remove */}
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatEuro(centsAlsEuro(zeilenCents.get(item.productId) ?? 0))}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.productId)}
                    aria-label={`${item.name} aus dem Korb nehmen`}
                    className={cn('-mr-3 flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground', FOKUS_RAHMEN)}
                  >
                    <Trash2 className="size-4" strokeWidth={1.7} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <SheetFooter className="px-5 py-4 border-t border-border/50 flex-col gap-3">
            <div className="flex justify-between text-base font-semibold text-foreground">
              <span>Gesamt</span>
              <span className="tabular-nums">{formatEuro(total)}</span>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              {gebuehrKorb ? `${gebuehrKorb[0].toUpperCase()}${gebuehrKorb.slice(1)} · ` : ''}Reservierung gilt {RESERVIERUNG_MINUTEN} Minuten.
            </p>
            <FutterVerantwortung saetze={futterHinweis} />
            {/* Mit Kaufsperre nimmt die Kasse nichts an — der Grund steht hier, nicht erst dort. */}
            {kaufSperre.sperre !== null ? (
              <KaufSperreHinweis {...kaufSperre} />
            ) : (
              <Link
                href={kasseHref ?? `/${farmSlug}/checkout`}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex h-12 w-full items-center justify-center rounded-xl bg-accent text-base font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90',
                  FOKUS_RAHMEN
                )}
              >
                Zur Kasse
              </Link>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}


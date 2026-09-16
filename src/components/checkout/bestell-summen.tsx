import { Info } from 'lucide-react'
import { formatEuro } from '@/lib/preis-format'
import {
  SERVICEGEBUEHR_BEZEICHNUNG,
  SERVICEGEBUEHR_HINWEIS,
  bestellSummen,
  centsAlsEuro,
  gebuehrEntfallen,
} from '@/lib/servicegebuehr'

/**
 * Die Summenzeilen einer Bestellung für die Kundin — Bestätigungsseite und
 * Bestellverfolgung zeigen damit dieselben Zeilen wie der Checkout:
 * Zwischensumme, Servicegebühr (mit aufklappbarem Hinweis), Gesamt. Ohne
 * Gebühr bleibt nur die Gesamtzeile. Alles aus dem SNAPSHOT der Bestellung.
 */
export function BestellSummenZeilen({
  order,
}: {
  order: {
    totalAmount: number | string | { toString(): string }
    serviceFeeCents: number
    serviceFeeRefundedAt: Date | string | null
    paymentMethod: string
  }
}) {
  const summen = bestellSummen(order)
  const entfallen = gebuehrEntfallen(order)

  return (
    <div className="mt-3 space-y-1.5 border-t border-border pt-3">
      {summen.gebuehrCents > 0 && (
        <>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Zwischensumme</span>
            <span className="text-foreground">{formatEuro(centsAlsEuro(summen.warenpreisCents))}</span>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {SERVICEGEBUEHR_BEZEICHNUNG}
              {entfallen && (
                <>
                  {' '}
                  <span className="text-xs">
                    ({order.paymentMethod === 'ONLINE' ? 'erstattet' : 'entfällt'})
                  </span>
                </>
              )}
            </span>
            <span className={entfallen ? 'text-muted-foreground line-through' : 'text-foreground'}>
              {formatEuro(centsAlsEuro(summen.gebuehrCents))}
            </span>
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="inline-flex min-h-6 cursor-pointer select-none items-center gap-1">
              <Info className="size-3.5" aria-hidden="true" />
              Was ist die Servicegebühr?
            </summary>
            <p className="mt-1 leading-relaxed">{SERVICEGEBUEHR_HINWEIS}</p>
          </details>
        </>
      )}
      <div className="flex justify-between font-semibold">
        <span>Gesamt</span>
        <span className="text-primary">{formatEuro(centsAlsEuro(summen.gesamtCents))}</span>
      </div>
    </div>
  )
}

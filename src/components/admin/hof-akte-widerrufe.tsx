import Link from 'next/link'
import { bestellungenHref } from '@/lib/admin-bestellung'
import { WIDERRUF_ADMIN_TEXT as W, WIDERRUF_STAND_MARKE, WIDERRUF_STAND_TEXT, type WiderrufStand } from '@/lib/widerruf'
import { cn } from '@/lib/utils'
import { KARTE, LEISE } from '@/components/hof-bestellungen/stil'
import { Marke } from '@/components/ui/marke'

/** Was die Akte zu einem Widerruf zeigt — nur Text, nie Name, Adresse oder Nachricht. */
export type HofAkteWiderrufAnzeige = { id: string; orderId: string; bestellnummer: string; stand: WiderrufStand; eingegangenAm: string; umfang: string[] }

/**
 * Admin › Hof-Akte › „Widerrufe“ (Nr. 200, Nachbesserung Runde 2): die
 * neuesten Widerrufe zu Bestellungen dieses Hofs mit Stand, Eingang (Wien)
 * und Umfang; die Nummer führt ins Detail in Admin › Bestellungen. Ein
 * eigener Abschnitt wie „Plattformgebühr“ — scheitert er, bleibt die Akte.
 */
export function HofAkteWiderrufe({ liste }: { liste: readonly HofAkteWiderrufAnzeige[] }): React.JSX.Element {
  return (
    <section aria-labelledby="akte-widerrufe-titel" className={cn(KARTE, 'mx-auto mt-5 flex w-full max-w-5xl flex-col gap-3 p-4 md:p-[18px]')}>
      <h2 id="akte-widerrufe-titel" className="font-heading text-[17px] font-semibold text-foreground">
        {W.titel}
      </h2>
      <p className={cn('text-[13px] leading-relaxed', LEISE)}>{W.akteSatz}</p>
      {liste.length === 0 ? (
        <p className={cn('text-[14px]', LEISE)}>{W.akteLeer}</p>
      ) : (
        <ul className="[&>li+li]:border-t [&>li+li]:border-border">
          {liste.map((w) => (
            <li key={w.id} className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 py-2 text-[14px]">
              <Link
                href={bestellungenHref({}, { bestellung: w.orderId })}
                className="inline-flex min-h-11 items-center font-semibold text-brand-text tabular-nums underline-offset-2 hover:underline"
              >
                {w.bestellnummer}
              </Link>
              <Marke art={WIDERRUF_STAND_MARKE[w.stand]}>{WIDERRUF_STAND_TEXT[w.stand]}</Marke>
              <span className={LEISE}>{W.eingang(w.eingegangenAm)}</span>
              <span className="min-w-0 break-words text-foreground">{w.umfang.join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

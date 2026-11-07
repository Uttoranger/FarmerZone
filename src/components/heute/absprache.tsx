import { Mail, Phone } from 'lucide-react'
import { Marke } from '@/components/ui/marke'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { ABHOLHINWEIS_SYMBOL, ABSPRACHE_TEXT } from '@/lib/abholhinweise'
import { cn } from '@/lib/utils'

/*
 * Abholung nach Absprache im Hofbereich (Register N47, Nr. 257): EINE Gestalt
 * für Bestellung (/orders/[orderId]) und Heute (Packliste). Ob sie erscheint,
 * entscheidet der Server (abspracheOffen) — nur offene Bestellungen mit
 * Absprache bekommen Marke und Kontakt. Die Kontaktdaten stehen nur als Ziel
 * der Knöpfe da, nie als sichtbarer Text; gedruckt wird keiner der Knöpfe.
 */

/** Die Marke „Abholung absprechen“ — Ton „offen“ (Register G5: der Hof muss etwas tun). */
export function AbspracheMarke({ className }: { className?: string }): React.JSX.Element {
  return (
    <Marke art="tun" form="schild" symbol={ABHOLHINWEIS_SYMBOL.NACH_ABSPRACHE} className={className}>
      {ABSPRACHE_TEXT.marke}
    </Marke>
  )
}

/**
 * „Anrufen“ und „Mail schreiben“. `anrufen` ist der fertige tel:-Link
 * (telefonLink) — ohne lesbare Nummer null und kein Knopf. `name` steht nur in
 * der Beschriftung für Vorleseprogramme, damit mehrere Zeilen unterscheidbar sind.
 */
export function AbspracheKnoepfe({ anrufen, email, name }: { anrufen: string | null; email: string; name: string }): React.JSX.Element {
  const knopf = cn(KNOPF_RAHMEN, 'min-h-11 border-foreground/60 bg-card font-semibold print:hidden')
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {anrufen && (
        <a href={anrufen} aria-label={`${ABSPRACHE_TEXT.anrufen}: ${name}`} className={knopf}>
          <Phone className="size-4" strokeWidth={1.7} aria-hidden="true" />
          {ABSPRACHE_TEXT.anrufen}
        </a>
      )}
      <a href={`mailto:${email}`} aria-label={`${ABSPRACHE_TEXT.mailSchreiben}: ${name}`} className={knopf}>
        <Mail className="size-4" strokeWidth={1.7} aria-hidden="true" />
        {ABSPRACHE_TEXT.mailSchreiben}
      </a>
    </div>
  )
}

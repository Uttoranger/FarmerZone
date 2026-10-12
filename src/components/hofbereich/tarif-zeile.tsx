import Link from 'next/link'
import { ChevronRight, Sprout, Star, type LucideIcon } from 'lucide-react'
import type { TarifZeileDaten } from '@/lib/konditionen'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/**
 * Die Tarif-Zeile der HofShell (Nr. 61; Mockups system-komponente-tarif-zeile-*
 * und mobil-h5-mehr-tarif-*): wo der Hof gerade steht — Symbol, Titel,
 * Unterzeile, Pfeil, ganz ein Link auf „Deine Konditionen". Eine Statuszeile
 * ohne Preis und ohne Warnfarbe (E6-Ergänzung); Zustand und Texte kommen
 * fertig vom Server (`baueTarifZeile`), hier wird nur gezeichnet. In der
 * Seitenleiste kompakt, im Mehr-Blatt eine Stufe größer mit dem Zusatz fürs
 * Handy.
 *
 * Der Balken bei Hoftor ist stumm (aria-hidden): „n von 3" steht als Text im
 * Link. ProgressBar passt hier nicht — sie kündigt sich als eigene
 * Fortschrittsanzeige mit Beschriftung an, mitten in einem Link eine zweite
 * Ansage für dieselbe Zahl.
 */
const SYMBOL: Record<TarifZeileDaten['zustand'], LucideIcon> = {
  startphase: Sprout,
  hoftor: Sprout,
  gruendungshof: Star,
}

export function TarifZeile({
  daten,
  ziel,
  ort,
  onNavigate,
}: {
  daten: TarifZeileDaten
  /** Wohin die Zeile führt — Name und Ziel aus der Navigation (EINSTELLUNG_KONDITIONEN). */
  ziel: { label: string; href: string }
  ort: 'seitenleiste' | 'blatt'
  onNavigate?: () => void
}): React.JSX.Element {
  const Symbol = SYMBOL[daten.zustand]
  const blatt = ort === 'blatt'
  const unterzeile = blatt ? daten.zeileHandy : daten.zeile

  return (
    <Link
      href={ziel.href}
      onClick={onNavigate}
      data-slot="tarif-zeile"
      data-zustand={daten.zustand}
      className={cn(
        'flex min-h-11 items-center gap-[11px] border border-border bg-card text-foreground transition-colors duration-[250ms] hover:bg-muted',
        blatt ? 'rounded-2xl px-3.5 py-3' : 'rounded-xl px-3 py-2.5',
        FOKUS_RAHMEN
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center self-start rounded-[10px] bg-status-fertig/12 text-status-fertig">
        <Symbol className="size-[17px]" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className={cn('flex min-w-0 flex-1 flex-col gap-1', blatt ? 'text-[12.5px]' : 'text-[12px]')}>
        <span className={cn('font-semibold', blatt ? 'text-[14.5px]' : 'text-[13.5px]')}>{daten.titel}</span>
        {daten.grenze ? (
          <>
            <span className="flex items-baseline justify-between gap-2 text-muted-foreground">
              <span>{unterzeile}</span>
              <span className="shrink-0 text-foreground tabular-nums">{daten.grenze.wert}</span>
            </span>
            <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full bg-border">
              <span
                className="block h-full rounded-full bg-status-fertig"
                style={{ width: `${Math.round(daten.grenze.anteil * 100)}%` }}
              />
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">{unterzeile}</span>
        )}
        {daten.hinweis && <span className="font-semibold text-brand-text">{daten.hinweis}</span>}
      </span>
      {/* Wohin der Link führt — sichtbar zeigt nur der Pfeil, dass es weitergeht (wie PersonZeile). */}
      <span className="sr-only">{`, ${ziel.label}`}</span>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
    </Link>
  )
}

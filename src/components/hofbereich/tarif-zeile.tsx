import Link from 'next/link'
import { ChevronRight, Sparkle, Sprout, type LucideIcon } from 'lucide-react'
import type { TarifZeileDaten } from '@/lib/konditionen'
import { Abzeichen } from '@/components/ui/abzeichen'
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
 *
 * Seit Nr. 233 nach w1-/s1-mehr-neu: in der Seitenleiste ein grün getöntes
 * Kästchen (28 px, beim Gründungshof das Funkeln), Titel 14 px fett, Zeile
 * 13 px; im Mehr-Blatt steht beim Gründungshof das Abzeichen „Gründungshof“
 * statt Kästchen und Titel. Der Wortlaut bleibt der vom Server (offen: E-012).
 */
const SYMBOL: Record<TarifZeileDaten['zustand'], LucideIcon> = {
  startphase: Sprout,
  hoftor: Sprout,
  gruendungshof: Sparkle,
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
  // Im Blatt trägt das Abzeichen den Titel (Board s1-mehr-neu); vorgelesen wird „Gründungshof“ wie der Titel.
  const mitAbzeichen = blatt && daten.zustand === 'gruendungshof'

  return (
    <Link
      href={ziel.href}
      onClick={onNavigate}
      data-slot="tarif-zeile"
      data-zustand={daten.zustand}
      className={cn(
        'flex min-h-14 items-center gap-2.5 border border-border bg-card text-[13px] text-foreground transition-colors duration-[250ms] hover:bg-muted',
        // Rundung in Pixeln wie im Board (12 bzw. 16 px) — die Stufen xl/2xl wachsen im neuen Design mit --radius.
        blatt ? 'rounded-[16px] px-3 py-2' : 'rounded-[12px] px-2.5 py-2',
        FOKUS_RAHMEN
      )}
    >
      {!mitAbzeichen && (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-zustand-laeuft-grund text-zustand-laeuft">
          <Symbol className="size-4" strokeWidth={1.9} aria-hidden="true" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {mitAbzeichen ? (
          <Abzeichen className="h-6 self-start" />
        ) : (
          <span className={cn('font-bold', blatt ? 'text-[15px]' : 'text-[14px]')}>{daten.titel}</span>
        )}
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
      <ChevronRight className="size-[18px] shrink-0 text-foreground" strokeWidth={2} aria-hidden="true" />
    </Link>
  )
}

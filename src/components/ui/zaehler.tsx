import { cn } from '@/lib/utils'

/**
 * Eine kleine Zahl an einem Eintrag: offene Bestellungen, Meldungen zu
 * entscheiden, Artikel im Korb. Orange heißt „hier wartet etwas auf dich"
 * (Hofbereich und Admin), Grün gehört zum Kaufen (Warenkorb) — die Farbrollen
 * aus docs/ai/DESIGN_SYSTEM.md.
 *
 * Seit Nr. 233 (Boards w1-/s1-mehr-neu, s1-heute, s3-admin-shell): Orange ist
 * die Zustandsfarbe „offen“ als Fläche (hell Rostrot mit heller Ziffer,
 * dunkel helles Orange mit dunkler Ziffer) — das Knopf-Orange mit heller
 * Ziffer lag unter 4,5:1. „getoent“ ist die leise Form an den Reitern des
 * Admin-Kopfs (Fläche und Schrift des Paars „tun“). Die Ziffer ist 12 px, nie
 * kleiner; `klein` ist die Form am Symbol (Unterleiste, Kopf), 18 statt 20 px.
 *
 * Für Screenreader steht hinter der Zahl, wofür sie zählt; ab 100 steht „99+"
 * da, die genaue Zahl im unsichtbaren Text. Null oder nichts: kein Zähler.
 */
export function Zaehler({
  anzahl,
  wofuer,
  ton = 'orange',
  klein = false,
  className,
}: {
  anzahl: number | undefined
  /** Was gezählt wird, für Screenreader: „offene Bestellungen". */
  wofuer: string
  ton?: 'orange' | 'gruen' | 'getoent'
  /** Am Symbol (Unterleiste, Kopf): 18 px hoch, die Ziffer bleibt 12 px. */
  klein?: boolean
  className?: string
}): React.JSX.Element | null {
  if (!anzahl || anzahl <= 0) return null
  return (
    <span
      data-slot="zaehler"
      data-ton={ton}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full text-[12px] leading-none font-bold tabular-nums',
        klein ? 'h-[18px] min-w-[18px] px-1' : 'h-5 min-w-5 px-1.5',
        ton === 'orange' && 'bg-status-offen text-card',
        ton === 'gruen' && 'bg-accent text-accent-foreground',
        ton === 'getoent' && 'bg-zustand-tun-grund text-zustand-tun',
        className
      )}
    >
      <span aria-hidden="true">{anzahl > 99 ? '99+' : anzahl}</span>
      <span className="sr-only">
        {anzahl} {wofuer}
      </span>
    </span>
  )
}

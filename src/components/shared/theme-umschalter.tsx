'use client'

import { useSyncExternalStore, type CSSProperties } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { DARSTELLUNG_TEXT } from '@/lib/kunden-navigation'

/**
 * Der Schnellumschalter Hell ↔ Dunkel — ein Tipp statt drei Klicks tief in
 * Einstellungen → Konto → „Darstellung". Die Karte dort bleibt für „System".
 *
 * Er schaltet anhand des gerade SICHTBAREN Modus (resolvedTheme): Wer auf
 * „System" steht und gerade dunkel sieht, bekommt beim Tipp „hell" — nicht
 * ein drittes, unsichtbares Ding. Danach ist die Wahl fest (light/dark);
 * zurück zu „System" geht es über die Karte im Konto.
 *
 * Vor dem Mount steht ein Platzhalter gleicher Größe: Der Server kennt den
 * Modus nicht, ein direkt gerendertes Sonne/Mond-Symbol wäre beim Hydrieren
 * zwangsläufig manchmal falsch (Muster wie darstellung-karte.tsx).
 */

function nichtsAbonnieren(): () => void {
  return () => {}
}
function imBrowser(): boolean {
  return true
}
function aufDemServer(): boolean {
  return false
}

function useThemeUmschalter(): {
  montiert: boolean
  dunkel: boolean
  beschriftung: string
  umschalten: () => void
  setze: (modus: 'light' | 'dark') => void
} {
  const { resolvedTheme, setTheme } = useTheme()
  const montiert = useSyncExternalStore(nichtsAbonnieren, imBrowser, aufDemServer)
  const dunkel = resolvedTheme === 'dark'
  return {
    montiert,
    dunkel,
    // Erst nach dem Einhängen richtet sich die Beschriftung nach dem Modus: Vor dem Einhängen — Server und erstes
    // Rendern im Browser — gilt die Beschriftung, die der Server schreibt, weil er den Modus nicht kennt. Sonst
    // stimmen aria-label und title beim Hydrieren nicht überein, und React gleicht Attribute nicht mehr an.
    beschriftung: montiert && dunkel ? 'Hellen Modus einschalten' : 'Dunkelmodus einschalten',
    umschalten: () => setTheme(dunkel ? 'light' : 'dark'),
    setze: (modus) => setTheme(modus),
  }
}

/**
 * Der runde Symbolknopf für Kopfzeilen. 44 px Fläche: das Mindestmaß, das
 * ein Daumen zuverlässig trifft. `title` ist der Tooltip — dieselbe Beschriftung
 * wie das aria-label, damit Maus und Screenreader dasselbe hören.
 */
export function ThemeUmschalter({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}): React.JSX.Element {
  const { montiert, dunkel, beschriftung, umschalten } = useThemeUmschalter()

  if (!montiert) {
    return <span aria-hidden="true" className={cn('inline-block size-11', className)} />
  }

  return (
    <button
      type="button"
      onClick={umschalten}
      aria-label={beschriftung}
      title={beschriftung}
      // Der sichtbare Fokus aller Shells (FOKUS_RAHMEN); vorher ein Halo `ring/50`, der hell unter 3:1 lag (Nr. 220).
      className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors', FOKUS_RAHMEN, className)}
      style={style}
    >
      {dunkel ? (
        <Sun className="size-5" strokeWidth={1.7} aria-hidden="true" />
      ) : (
        <Moon className="size-5" strokeWidth={1.7} aria-hidden="true" />
      )}
    </button>
  )
}

/**
 * „Darstellung: hell“ bzw. „Darstellung: dunkel“ als Umriss-Pille mit 44 px —
 * am Handy im Seitenfuß der KundeShell (Board s1-startseite, Bild 4). Sie nennt
 * den Modus, der gerade gilt, mit seinem Symbol (Sonne hell, Mond dunkel); ein
 * Tipp schaltet um. Der Name beginnt mit dem sichtbaren Text (WCAG 2.5.3), der
 * Rest sagt, was der Tipp tut. Vor dem Einhängen steht nur „Darstellung“ — der
 * Server kennt den Modus nicht.
 */
export function ThemeUmschalterPille({ className }: { className?: string }): React.JSX.Element {
  const { montiert, dunkel, umschalten } = useThemeUmschalter()
  const Symbol = dunkel ? Moon : Sun
  const sichtbar = montiert ? `${DARSTELLUNG_TEXT.titel}: ${dunkel ? DARSTELLUNG_TEXT.dunkel.toLowerCase() : DARSTELLUNG_TEXT.hell.toLowerCase()}` : DARSTELLUNG_TEXT.titel
  return (
    <button
      type="button"
      onClick={umschalten}
      disabled={!montiert}
      aria-label={montiert ? `${sichtbar} – ${dunkel ? DARSTELLUNG_TEXT.aufHell : DARSTELLUNG_TEXT.aufDunkel}` : undefined}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-full border border-input px-4 text-[13.5px] font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted',
        FOKUS_RAHMEN,
        className
      )}
    >
      {montiert ? (
        <Symbol className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
      ) : (
        <span className="size-4 shrink-0" aria-hidden="true" />
      )}
      {sichtbar}
    </button>
  )
}

/**
 * Die Zeile „Darstellung“ mit den zwei Pillen „Hell“ und „Dunkel“ — im Blatt
 * „Mehr“ der HofShell (Board s1-mehr-neu, Bild 2). Gewählt ist die gefüllte
 * Pille (`aria-pressed`), je 44 px hoch. Vor dem Einhängen ist keine gewählt:
 * Der Server kennt den Modus nicht, eine geratene Wahl wäre beim Hydrieren falsch.
 */
export function ThemeWahl({ className }: { className?: string }): React.JSX.Element {
  const { montiert, dunkel, setze } = useThemeUmschalter()
  const pille = (modus: 'light' | 'dark', wort: string) => {
    const gewaehlt = montiert && (modus === 'dark') === dunkel
    return (
      <button
        type="button"
        onClick={() => setze(modus)}
        disabled={!montiert}
        aria-pressed={gewaehlt}
        className={cn(
          'inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors duration-[250ms]',
          gewaehlt ? 'border-foreground bg-foreground text-background' : 'border-input text-foreground hover:bg-muted',
          FOKUS_RAHMEN
        )}
      >
        {wort}
      </button>
    )
  }
  return (
    <div role="group" aria-label={DARSTELLUNG_TEXT.titel} className={cn('flex items-center gap-2', className)}>
      {pille('light', DARSTELLUNG_TEXT.hell)}
      {pille('dark', DARSTELLUNG_TEXT.dunkel)}
    </div>
  )
}

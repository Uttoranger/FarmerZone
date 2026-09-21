'use client'

import { useSyncExternalStore, type CSSProperties } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

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
} {
  const { resolvedTheme, setTheme } = useTheme()
  const montiert = useSyncExternalStore(nichtsAbonnieren, imBrowser, aufDemServer)
  const dunkel = resolvedTheme === 'dark'
  return {
    montiert,
    dunkel,
    beschriftung: dunkel ? 'Hellen Modus einschalten' : 'Dunkelmodus einschalten',
    umschalten: () => setTheme(dunkel ? 'light' : 'dark'),
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
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        className
      )}
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
 * Dieselbe Funktion als Zeile mit Text — für die Seitenleiste und das
 * Mehr-Sheet des Bauern-Bereichs, wo alle Einträge Symbol + Wort tragen.
 * Farben kommen von außen (die Leiste ist in beiden Modi dunkelgrün und
 * beschriftet sich über --app-bar-ink-soft).
 */
export function ThemeUmschalterZeile({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}): React.JSX.Element {
  const { montiert, dunkel, beschriftung, umschalten } = useThemeUmschalter()
  const Symbol = dunkel ? Sun : Moon

  return (
    <button
      type="button"
      onClick={umschalten}
      disabled={!montiert}
      aria-label={beschriftung}
      title={beschriftung}
      className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm min-h-[44px] text-left transition-colors', className)}
      style={style}
    >
      {/* Vor dem Mount ein neutrales Symbol gleicher Größe statt Sonne oder
          Mond — sonst hüpft das Zeichen beim Hydrieren. */}
      {montiert ? (
        <Symbol className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} aria-hidden="true" />
      ) : (
        <span className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />
      )}
      {montiert ? (dunkel ? 'Heller Modus' : 'Dunkelmodus') : 'Darstellung'}
    </button>
  )
}

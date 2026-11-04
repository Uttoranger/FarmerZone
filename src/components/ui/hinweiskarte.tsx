import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NETZ_KNOPF } from '@/lib/netz'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

type Ton = 'gruen' | 'orange' | 'neutral'

const TON_FLAECHE: Record<Ton, string> = {
  gruen: 'border-accent/45 bg-accent/12',
  orange: 'border-primary/45 bg-primary/12',
  neutral: 'border-border bg-muted',
}

const TON_SYMBOL: Record<Ton, string> = {
  gruen: 'text-status-fertig',
  orange: 'text-status-offen',
  neutral: 'text-muted-foreground',
}

/**
 * Hinweiskarte: ein ruhiger Hinweis auf getönter Fläche mit Rahmen —
 * Grün für Kundensachen und Gutes („Wir zeigen Höfe rund um …", „Registrierter
 * Futtermittelbetrieb"), Orange für Hofsachen und Offenes („Online-Zahlung
 * pausiert", „Teile deinen Hof"), Neutral für ruhige Hinweise ohne Wertung
 * („Testhof – nur zum Ausprobieren", Register N21). Kein Alarm, kein Modal:
 * Fehler stehen inline am Feld (DESIGN_SYSTEM, „Zustände").
 *
 * Die Schrift bleibt die normale Textfarbe; die Tönung liegt bei 12 % der
 * Markenfarbe, so hält der Text in beiden Themes 4,5:1. Neutral liegt auf der
 * Nebenfläche (`bg-muted`) mit dem normalen Rahmen und leisem Symbol — weder
 * Grün (gut) noch Orange (offen), weil der Hinweis nichts bewertet. Aktionen
 * (Knöpfe, Links) kommen als `aktion` herein und stehen rechts bzw. am Handy
 * darunter.
 */
export function Hinweiskarte({
  ton = 'gruen',
  symbol: Symbol,
  titel,
  children,
  aktion,
  className,
}: {
  ton?: Ton
  symbol?: LucideIcon
  titel?: string
  children?: ReactNode
  aktion?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      data-slot="hinweiskarte"
      data-ton={ton}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border px-4 py-3.5 text-[13.5px] text-foreground sm:flex-row sm:items-center',
        TON_FLAECHE[ton],
        className
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        {Symbol && (
          <Symbol
            className={cn('mt-0.5 size-5 shrink-0', TON_SYMBOL[ton])}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          {titel && <p className="font-semibold">{titel}</p>}
          {children && <div className={cn(titel && 'mt-0.5')}>{children}</div>}
        </div>
      </div>
      {aktion && <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{aktion}</div>}
    </div>
  )
}

/**
 * Die orange Hinweiskarte für einen Fehler, der kein Feld betrifft (V17; Boards w1-kasse Bild 4
 * „Deine Karte wurde abgelehnt", s1-produkt-neu Bild 5 und 6 „Bitte prüfe die markierten Felder.",
 * „Speichern hat nicht geklappt"): Fläche und Schrift aus dem Bedeutungs-Paar „tun"
 * (`bg-zustand-tun-grund`, `text-zustand-tun`, ≥ 4,5:1 in beiden Modi, tests/design-tokens.test.ts),
 * Titel fett, darunter ein Satz. `role="alert"`, damit der Screenreader ihn beim Erscheinen liest.
 *
 * Mit `nochmal` steht darunter der Knopf „Nochmal" (NETZ_KNOPF, Register N29) über die volle Breite,
 * 52 px, als Rahmenknopf — die Eingabe bleibt stehen, ein Tipp wiederholt den Aufruf. Nie bei
 * Aktionen, die der Server schon ausgeführt haben kann (NETZ_SATZ_UNSICHER, DESIGN_SYSTEM „Zustände").
 */
export function HinweiskarteFehler({
  titel,
  children,
  nochmal,
  laeuft,
  className,
}: {
  titel: string
  children?: ReactNode
  /** Wiederholt den Aufruf; ohne sie kein Knopf. */
  nochmal?: () => void
  /** Solange der zweite Versuch läuft, ist der Knopf gesperrt. */
  laeuft?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <div
      role="alert"
      data-slot="hinweiskarte-fehler"
      className={cn('flex flex-col gap-1.5 rounded-2xl border border-zustand-tun/30 bg-zustand-tun-grund px-3.5 py-3 text-zustand-tun', className)}
    >
      <p className="text-[15px] font-bold">{titel}</p>
      {children && <div className="text-[14px] leading-normal">{children}</div>}
      {nochmal && (
        <button
          type="button"
          onClick={nochmal}
          disabled={laeuft}
          aria-busy={laeuft || undefined}
          className={cn(
            'mt-1.5 inline-flex min-h-[52px] w-full items-center justify-center rounded-[14px] border-[1.5px] border-foreground bg-card px-3 text-[16px] font-bold text-foreground hover:bg-muted disabled:opacity-60',
            FOKUS_RAHMEN
          )}
        >
          {NETZ_KNOPF}
        </button>
      )}
    </div>
  )
}

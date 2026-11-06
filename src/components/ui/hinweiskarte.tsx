import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NETZ_KNOPF } from '@/lib/netz'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'

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
 * Der Titel ist freiwillig (G6, Nr. 246; Boards s2-teilen Bild 3, s2-konto-hof): Ein Netzfehler am
 * Formular ist oft nur der eine Satz (`NETZ_SATZ`), 14 px halbfett.
 *
 * Mit `nochmal` steht darunter der Knopf „Nochmal" (NETZ_KNOPF, Register N29) — seit Nr. 246 nach G6
 * klein und linksbündig in der Warnfarbe (Rand und Schrift `zustand-tun`, 44 px; Liste Lauf 32, teilen
 * „Klein, linksbündig, Warnfarbe"), nicht mehr über die volle Breite. Er bekommt beim Erscheinen den
 * Fokus (Board s2-teilen `data-erstfokus`, meldungen „Fokus darauf"): Wer gerade auf „Speichern"
 * getippt hat, steht danach auf dem Ausweg. Er ist nie deaktiviert (G6: Knöpfe nie deaktiviert);
 * solange der zweite Versuch läuft, meldet er `aria-busy` und schluckt den Tipp. Nie bei Aktionen,
 * die der Server schon ausgeführt haben kann (NETZ_SATZ_UNSICHER, DESIGN_SYSTEM „Zustände"), nie in
 * Verkäufe (doppelte Buchung, D1) und nie beim Anlegen eines Produkts (Abnahme-Grundlage Lauf 32).
 */
export function HinweiskarteFehler({
  titel,
  children,
  nochmal,
  laeuft,
  className,
}: {
  titel?: string
  children?: ReactNode
  /** Wiederholt den Aufruf; ohne sie kein Knopf. */
  nochmal?: () => void
  /** Solange der zweite Versuch läuft, nimmt der Knopf keinen Tipp an (bleibt aber bedienbar sichtbar). */
  laeuft?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <div
      role="alert"
      data-slot="hinweiskarte-fehler"
      className={cn('flex flex-col gap-2 border border-zustand-tun/30 bg-zustand-tun-grund px-3.5 py-3 text-zustand-tun', RUNDUNG.hinweis, className)}
    >
      {titel && <p className="text-[15px] font-bold">{titel}</p>}
      {children && <div className={cn('text-[14px] leading-normal', !titel && 'font-semibold')}>{children}</div>}
      {nochmal && (
        <button
          type="button"
          // Der Fokus springt auf den Ausweg, sobald der Kasten erscheint (G6) — React setzt ihn beim Einhängen.
          autoFocus
          onClick={() => {
            if (!laeuft) nochmal()
          }}
          aria-busy={laeuft || undefined}
          data-slot="nochmal"
          className={cn(NOCHMAL_KNOPF, FOKUS_RAHMEN)}
        >
          {NETZ_KNOPF}
        </button>
      )}
    </div>
  )
}

/**
 * Der Knopf „Nochmal" nach G6 (Boards s2-teilen, s2-konto-hof): 44 px hoch, so breit wie sein Wort,
 * links bündig, 1,5 px Rand und Schrift in der Warnfarbe auf der Kartenfläche, 16 px fett.
 */
export const NOCHMAL_KNOPF =
  'inline-flex min-h-11 items-center justify-center self-start rounded-[14px] border-[1.5px] border-zustand-tun bg-card px-[18px] text-[16px] font-bold text-zustand-tun hover:bg-muted aria-busy:opacity-60'

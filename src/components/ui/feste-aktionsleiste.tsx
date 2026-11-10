import type { ReactNode } from 'react'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/**
 * Feste Aktionsleiste am Handy (Baustein G2, Nr. 245; Liste Lauf 32,
 * Abschnitt 3.2; Boards s2-hofdaten-zahlung, -meldungen, -verkaeufe …).
 *
 * Handy (unter 768 px): fest über der Unterleiste (68 px plus Home-Indicator),
 * Fläche `bg-card` mit Linie oben; darin der Hauptknopf über die volle Breite,
 * optional „← Zurück“ darunter. Ein Platzhalter in derselben Höhe steht im
 * Fluss, damit der Inhalt über der Leiste endet und nie dahinter (V28).
 * Web (ab 768 px): keine feste Leiste — die Knöpfe stehen im Fluss am Ende des
 * Formulars (V47), der Hauptknopf weiter über die volle Breite der Spalte.
 *
 * `ueberUnterleiste={false}` für Seiten ohne Unterleiste (Fokus-Shell): dann
 * sitzt die Leiste am unteren Rand samt Home-Indicator.
 *
 * Ohne 'use client': Die Leiste rechnet nichts, sie ordnet nur an; die Knöpfe
 * bringt die Seite mit (`AKTIONSLEISTE_KNOPF`, `AKTIONSLEISTE_ZURUECK`).
 * `data-unten-fest`: Der Cookie-Hinweis steht darüber (src/lib/cookie-hinweis.ts);
 * `data-feste-leiste`: Der Browser scrollt ein fokussiertes Feld nie darunter
 * (scroll-padding in globals.css).
 */
export function FesteAktionsleiste({
  children,
  zurueck,
  ueberUnterleiste = true,
  className,
}: {
  /** Der Hauptknopf (genau einer), z. B. `<button type="submit" className={AKTIONSLEISTE_KNOPF}>`. */
  children?: ReactNode
  /** Optional darunter „← Zurück“ (`AKTIONSLEISTE_ZURUECK`). */
  zurueck?: ReactNode
  ueberUnterleiste?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <>
      {/* Platz für die feste Leiste: 52 px Knopf + 24 px Polster, mit „Zurück“ 8 + 44 px mehr. */}
      <div aria-hidden="true" className={cn('md:hidden print:hidden', zurueck ? 'h-[132px]' : 'h-20')} />
      <div
        data-aktionsleiste=""
        data-unten-fest=""
        data-feste-leiste=""
        className={cn(
          'fixed inset-x-0 z-30 flex flex-col gap-2 border-t border-border bg-card px-4 pt-3',
          ueberUnterleiste ? 'bottom-[calc(68px+env(safe-area-inset-bottom))] pb-3' : 'bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
          'md:static md:z-auto md:mt-6 md:border-0 md:bg-transparent md:p-0 print:hidden',
          className
        )}
      >
        {children}
        {zurueck}
      </div>
    </>
  )
}

/** Der Hauptknopf der Leiste: orange (im Hofbereich `primary`), 52 px, volle Breite, 14 px rund wie in den Boards. */
export const AKTIONSLEISTE_KNOPF = cn(
  'flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-primary px-3 text-center text-[16px] font-bold text-primary-foreground transition-colors duration-[250ms] hover:bg-primary/90',
  FOKUS_RAHMEN
)

/** „← Zurück“ unter dem Hauptknopf: Textknopf, 44 px hoch, über die volle Breite tippbar. */
export const AKTIONSLEISTE_ZURUECK = cn(
  'flex min-h-11 w-full items-center justify-center rounded-[10px] text-[15px] font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted',
  FOKUS_RAHMEN
)

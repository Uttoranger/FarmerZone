import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LEISE } from '@/components/hof-bestellungen/stil'
import { SEITEN_TITEL } from './admin-teile'

/**
 * Der Kopf jeder Admin-Seite (Register N15, Nr. 94): die h1, ein Satz darunter,
 * rechts — wenn die Seite eine hat — die Hauptaktion oder der Zeitraum (Suche,
 * Monatswahl). Am Handy rutscht das Rechte unter den Satz. Keine Seite baut
 * ihren Kopf selbst. Ein `hinweis` steht als zweite leise Zeile unter dem Satz
 * (Finanzen: welche Zahlen Testzahlungen auslassen).
 *
 * Der Baustein hat keinen Zustand und kein 'use client': Er steht in Server-
 * Seiten (Finanzen) wie in Client-Ansichten (Höfe).
 */
export function Seitenkopf({
  titel,
  satz,
  hinweis,
  rechts,
  className,
}: {
  titel: string
  /** Ein Satz, der sagt, wofür die Seite da ist. */
  satz: string
  /** Eine zweite leise Zeile, nur wenn es etwas zu sagen gibt. */
  hinweis?: string | null
  rechts?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-3', className)}>
      <div className="min-w-0">
        <h1 className={SEITEN_TITEL}>{titel}</h1>
        <p className={cn('mt-1 text-[13px] leading-snug md:text-[13.5px]', LEISE)}>{satz}</p>
        {hinweis && <p className={cn('mt-1 text-[12.5px] leading-snug', LEISE)}>{hinweis}</p>}
      </div>
      {rechts && <div className="flex w-full min-w-0 items-center gap-2 md:w-auto">{rechts}</div>}
    </header>
  )
}

'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'

/*
 * Ladefehler der Hof-Werkzeuge (Baustein G6, Liste Lauf 32 auswertung, kunden,
 * postfach, region, verkaeufe „Fehler-Karte getönt, kleiner Knopf“; Nr. 251):
 * derselbe orange Kasten wie `HinweiskarteFehler` (ui/hinweiskarte.tsx), aber
 * mit einem LINK als Ausweg — die Seiten laden auf dem Server, „Noch einmal
 * versuchen“ heißt dieselbe Adresse neu abfragen, kein Aufruf im Browser.
 * Der Fokus springt beim Einhängen auf den Ausweg (G6: „Nach einem Ladefehler
 * gehört der Fokus auf den Ausweg“), der Satz hängt per aria-describedby daran.
 * Seit Nr. 269 (Nacharbeit 251) ein Baustein unter src/components/ui/ — in Nr. 251
 * lag ui/ außerhalb der Grenze; der alte Ort unter hof-hilfe/ reicht ihn weiter.
 */

/** Der Satz unter jedem Ladefehler — wörtlich nach den Boards s2-/w2-auswertung, -kunden, -verkaeufe. */
export const LADE_FEHLER_SATZ = 'Es ist nichts verloren gegangen. Versuch es bitte gleich noch einmal.'

export function LadeFehlerKasten({
  titel,
  satz = LADE_FEHLER_SATZ,
  nochmal,
  knopf = 'Noch einmal versuchen',
  className,
}: {
  titel: string
  satz?: string
  /** Text des Auswegs — „Noch einmal versuchen“, im Postfach „Neu laden“ (Board s2-/w2-postfach Bild 6). */
  knopf?: string
  /** Dieselbe Adresse — neu laden heißt neu abfragen. */
  nochmal: string
  className?: string
}): React.JSX.Element {
  const ausweg = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    ausweg.current?.focus()
  }, [])
  return (
    <div
      role="alert"
      data-slot="lade-fehler-kasten"
      className={cn('flex flex-col gap-2 border border-zustand-tun/30 bg-zustand-tun-grund px-4 py-3.5 text-zustand-tun', RUNDUNG.hinweis, className)}
    >
      <p id="lade-fehler-titel" className="text-[15px] font-bold">
        {titel}
      </p>
      <p id="lade-fehler-satz" className="text-[14px] leading-normal">
        {satz}
      </p>
      <Link
        ref={ausweg}
        href={nochmal}
        aria-describedby="lade-fehler-titel lade-fehler-satz"
        className={cn(
          'mt-1 inline-flex min-h-11 w-full items-center justify-center border border-zustand-tun/40 bg-card px-4 text-[15px] font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted',
          RUNDUNG.feld,
          FOKUS_RAHMEN
        )}
      >
        {knopf}
      </Link>
    </div>
  )
}

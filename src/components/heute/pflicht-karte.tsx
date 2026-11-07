import type { ReactNode } from 'react'
import { Hinweiskasten } from '@/components/ui/hinweiskasten'
import { KNOPF_ORANGE, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'

/*
 * Die Form der Karten oben auf Heute (Pflichtkarten nach A2 Punkt 1 und der
 * eine Kasten zur Online-Zahlung; Board s1-/w1-heute, Bild 3–5): orange
 * Hinweiskarte ohne Symbol, Titel, Satz, darunter der Knopf über die volle
 * Breite (52 px) — nicht klein rechts daneben. Eine Quelle für alle Karten,
 * damit sie untereinander gleich aussehen (A2 Punkt 1: untereinander wie
 * gebaut). Was in der Karte steht und wann sie erscheint, entscheiden die
 * Karten selbst.
 *
 * Seit Nr. 249 (Liste Lauf 32, heute: „Titel der Hinweis-/Pflichtkarten klein, neutrale Farbe“ → G3) zeichnet
 * der Hinweiskasten: braun getönt, Titel 16 px fett in `status-offen`, 12 px rund, ohne Symbol.
 */

/** Hauptknopf der Karte: orange gefüllt, volle Breite (Board: „Bei Stripe ergänzen“, „AGB lesen und bestätigen“). */
export const PFLICHT_KNOPF = cn(KNOPF_ORANGE, 'min-h-[52px] w-full rounded-[14px] text-[15px] font-bold')
/** Nebenknopf bzw. Weg ohne Handlung am Hof: Umriss über die volle Breite (Board: „Jetzt einrichten“). */
export const PFLICHT_KNOPF_RAHMEN = cn(KNOPF_RAHMEN, 'min-h-[52px] w-full rounded-[14px] border-foreground/70 bg-card text-[15px] font-bold')

export function PflichtKarte({
  titel,
  children,
  knoepfe,
}: {
  titel: string
  children?: ReactNode
  /** Die Knöpfe, untereinander über die volle Breite. */
  knoepfe?: ReactNode
}): React.JSX.Element {
  return (
    <Hinweiskasten titel={titel} aktion={knoepfe ? <div className="mt-2 flex w-full flex-col gap-2">{knoepfe}</div> : undefined}>
      {children}
    </Hinweiskasten>
  )
}

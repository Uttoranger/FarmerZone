import { CircleAlert } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { hofInitialen } from '@/lib/hof-initialen'
import { cn } from '@/lib/utils'

/*
 * Gemeinsame Teile der Admin-Seiten im neuen Design (Nachtlauf Nr. 22f). Die
 * AdminShell bringt Kopf und Rand; hier stehen Rahmen, Seitenkopf, Fehler und
 * die Kachel mit den Initialen eines Hofs.
 */

/** Breite der Admin-Seiten — die Shell setzt den Rand, der Rahmen die Höchstbreite (Mockups 1440 px). */
export const ADMIN_RAHMEN = 'mx-auto w-full max-w-[1376px]'

export const SEITEN_TITEL = 'font-heading text-2xl font-semibold text-foreground md:text-[28px]'

/**
 * Fehler beim Laden einer Admin-Seite — inline als orange Hinweiskarte statt
 * der ganzseitigen 500 (DESIGN_SYSTEM „Zustände"; orange, weil es kein
 * Fehler-Token gibt, Register O1). Neu laden heißt neu abfragen.
 */
export function AdminFehler({ titel, satz, nochmal }: { titel: string; satz: string; nochmal: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={SEITEN_TITEL}>{titel}</h1>
      <Hinweiskarte
        ton="orange"
        symbol={CircleAlert}
        titel={satz}
        aktion={
          <a href={nochmal} className={KNOPF_RAHMEN}>
            Noch einmal versuchen
          </a>
        }
      >
        Es ist nichts verloren gegangen. Versuch es bitte gleich noch einmal.
      </Hinweiskarte>
    </div>
  )
}

/** Die Kachel eines Hofs ohne Logo (Mockup: grüne Fläche) — Schmuck, der Name steht daneben. */
export function HofKachel({ name, className }: { name: string; className?: string }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent/25 font-heading text-[15px] font-semibold text-foreground',
        className
      )}
    >
      {hofInitialen(name)}
    </span>
  )
}

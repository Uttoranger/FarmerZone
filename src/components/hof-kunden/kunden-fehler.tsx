import { CircleAlert } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'

/**
 * Fehler beim Laden der Kunden — inline als orange Hinweiskarte statt der
 * ganzseitigen 500 (DESIGN_SYSTEM „Zustände"). Der Weg zurück ist ein
 * gewöhnlicher Link auf dieselbe Seite: Neu laden heißt neu abfragen.
 */
export function KundenFehler({ titel, nochmal }: { titel: string; nochmal: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 md:gap-[18px]">
      <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">{titel}</h1>
      <Hinweiskarte
        ton="orange"
        symbol={CircleAlert}
        titel="Wir konnten deine Kunden gerade nicht laden."
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

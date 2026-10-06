import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'

/**
 * Fehler beim Laden der Verkäufe — inline als orange Hinweiskarte statt der
 * ganzseitigen 500 (DESIGN_SYSTEM „Zustände"). Der Weg zurück ist ein Link
 * auf dieselbe Seite: Die Seite ist dynamisch, Hinlaufen heißt neu abfragen.
 */
export function VerkaeufeFehler(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 md:gap-[18px]">
      <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">Verkäufe</h1>
      <Hinweiskarte
        ton="orange"
        symbol={CircleAlert}
        titel="Wir konnten deine Verkäufe gerade nicht laden."
        aktion={
          <Link href="/sales" className={KNOPF_RAHMEN}>
            Noch einmal versuchen
          </Link>
        }
      >
        Es ist nichts verloren gegangen. Versuch es bitte gleich noch einmal.
      </Hinweiskarte>
    </div>
  )
}

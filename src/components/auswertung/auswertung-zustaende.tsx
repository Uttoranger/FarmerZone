import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'

/*
 * Rahmen und Ladefehler der Auswertung (Nachtlauf Nr. 22c). Ein Skelett gibt
 * es seit Nr. 121 nicht mehr: Zeitraum und Pfeile zeigen einen Ladepunkt, die
 * alte Auswertung bleibt stehen (LadeRahmen in der Seite).
 */
export const AUSWERTUNG_RAHMEN = 'mx-auto w-full max-w-6xl px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10'

/** Ladefehler inline statt der ganzseitigen 500 (DESIGN_SYSTEM „Zustände"); der Weg zurück ist dieselbe Adresse. */
export function AuswertungFehler({ nochmal }: { nochmal: string }): React.JSX.Element {
  return (
    <Hinweiskarte
      ton="orange"
      symbol={CircleAlert}
      titel="Wir konnten deine Zahlen gerade nicht laden."
      aktion={
        <Link href={nochmal} className={KNOPF_RAHMEN}>
          Noch einmal versuchen
        </Link>
      }
    >
      Es ist nichts verloren gegangen. Versuch es bitte gleich noch einmal.
    </Hinweiskarte>
  )
}
